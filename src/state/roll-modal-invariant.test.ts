import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * Garde-fou « un Test REMONTE à un humain vs se résout INLINE » — au CHOKE-POINT du prédicat, pas par
 * grep+whitelist. La décision de surfaçage suit QUI CONTRÔLE le camp, jamais le `kind` : trois
 * prédicats d'AFFORDANCE LOCALE vivent dans `netOwnership` (`humanControlled`/`pilotedByHuman`/
 * `aiDriven`) et un prédicat de SURFACE, seat-agnostique, vit dans `rollSeam` (`surfaceOf`, #1262 —
 * le porteur d'un AUTRE siège surface aussi). Quatre volets :
 *  (a) STATIQUE minimal : chaque site de surfaçage connu référence CELUI des quatre prédicats qu'il
 *      déclare (table `SURFACING`), et aucun module ne décide du surfaçage sur la CADENCE
 *      (`roundTestInteractive` : ni symbole ni module) ;
 *  (b) BEHAVIORAL : un Test de combattant piloté-humain par contexte (défense, manœuvre, upkeep, psy,
 *      maladie/exposition, corruption, test déclenché) OUVRE un `pending*` influençable ;
 *  (c) FLIP LOCAL : poser le rôle MJ (`net.gmSeat`) fait REMONTER le Test déclenché d'un ennemi conduit
 *      (`actorId===enemyId`) ; le retirer (ou un héros `aiControlled`) le résout inline ;
 *  (d) GARDE-DU-GARDE : sous un stub qui re-silencie (`humanControlled → false`), le volet (b) DOIT échouer.
 */

// Ré-silençage RÉEL (volet d) : quand `silence` est vrai, on marque le combattant testé `aiControlled` —
// `pilotedByHuman`/`humanControlled` renvoient alors false PAR LE PRÉDICAT (pas un mock qui fuit sous
// `isolate:false`). Prouve que le plancher behavioral (b) DÉPEND du prédicat de contrôleur.
let silence = false;

import { useGame } from './store';
import './combatFlow'; // effet de bord : installe appliers de cascade + routeur de Test + hook onGainCondition
import { openRoundEndCascade, openCombatEndCascade, aiCreatureFreeAttacks, maybeOpenDefense, resolveAttack, attackerFumbled } from './combatFlow';
import { gainCorruption } from './corruptionFlow';
import { createHero } from '../engine/character';
import { buildWeapon } from '../engine/items';
import { seedBattleRng } from './battleRng';
import { addCondition, COND } from '../engine/conditions';

import { testScene } from '../scenes/test-fixture';
import { resetCadence } from '../engine/cadence';

const get = useGame.getState;
const set = useGame.setState;

// ── Volet (a) — statique minimal ────────────────────────────────────────────────────────────────
const here = (f: string) => fileURLToPath(new URL(f, import.meta.url));
/** Retire commentaires de bloc et de ligne — un prédicat CITÉ en prose (« cf. `defenseSurfaced` ») n'est
 *  PAS un câblage : sans ce strip, la garde reste verte alors que le câblage a été débranché (mutation D
 *  du juge). */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((l) => { const i = l.indexOf('//'); return i >= 0 ? l.slice(0, i) : l; })
    .join('\n');
}
const readCode = (f: string) => stripComments(readFileSync(here(f), 'utf8'));
const SRC: Record<string, string> = {
  combatFlow: readCode('./combatFlow.ts'),
  combatManeuvers: readCode('./combatManeuvers.ts'),
  corruptionFlow: readCode('./corruptionFlow.ts'),
  roundHooks: readCode('./combat/roundHooks.ts'),
  turnHooks: readCode('./combat/turnHooks.ts'),
  triggeredTest: readCode('./combat/triggeredTest.ts'),
  triggeredEffects: readCode('./triggeredEffects.ts'),
};

/** Corps `{ … }` équilibré d'une fonction nommée (déclaration `function`/`export function`). */
function bodyOf(src: string, name: string): string {
  const re = new RegExp(`(?:export\\s+)?(?:async\\s+)?function\\s+${name}\\s*\\(`);
  const m = re.exec(src);
  if (!m) throw new Error(`fonction ${name} introuvable`);
  let pd = 0, i = m.index + m[0].length - 1; // au '(' des paramètres
  for (; i < src.length; i++) { if (src[i] === '(') pd++; else if (src[i] === ')') { if (--pd === 0) { i++; break; } } }
  // Type de RETOUR possiblement objet (`): { res: … } | null {`) : une accolade précédée d'un opérateur de
  // TYPE (`:`/`|`/`&`/`,`/`<`/`=`) n'est pas le corps — on la saute (bloc équilibré) et on continue.
  let open = src.indexOf('{', i);
  for (;;) {
    let k = open - 1;
    while (k >= 0 && /\s/.test(src[k])) k--;
    if (!':|&,<='.includes(src[k])) break;
    let d = 1, x = open + 1;
    while (x < src.length && d > 0) { if (src[x] === '{') d++; else if (src[x] === '}') d--; x++; }
    open = src.indexOf('{', x);
  }
  let depth = 1, j = open + 1;
  while (j < src.length && depth > 0) { if (src[j] === '{') depth++; else if (src[j] === '}') depth--; j++; }
  return src.slice(open + 1, j);
}

/** Sites de surfaçage connus (B1/B2 + Famille A) → prédicat de contrôleur qu'ils DOIVENT référencer. */
const SURFACING: { file: keyof typeof SRC; fn: string; pred: RegExp }[] = [
  { file: 'combatFlow', fn: 'maybeOpenDefense', pred: /defenseSurfaced/ },
  { file: 'combatFlow', fn: 'surfacedDefensePending', pred: /defenseSurfaced/ },
  { file: 'combatFlow', fn: 'openSurfacedDefense', pred: /surfacedDefensePending/ },
  { file: 'combatFlow', fn: 'resolveAttack', pred: /defenseSurfaced/ },
  { file: 'combatFlow', fn: 'autoCleave', pred: /aiDriven/ },
  { file: 'combatFlow', fn: 'maybeHeroCleave', pred: /tenuParUnHumain/ }, // #1426 : la SURFACE, pas l'affordance locale
  { file: 'combatFlow', fn: 'resolveEnemyFumble', pred: /aiDriven/ },
  { file: 'combatFlow', fn: 'openRoundEndCascade', pred: /surfaceOf/ }, // #1262 V1 lot 2 : la SURFACE, pas l'affordance locale
  { file: 'combatFlow', fn: 'openCombatEndCascade', pred: /surfaceOf/ }, // #1262 V1 lot 5c : la SURFACE, pas l'affordance locale
  { file: 'combatFlow', fn: 'openCombatPsychCascade', pred: /surfaceOf/ }, // #1262 V1 lot 5c : idem
  { file: 'combatFlow', fn: 'applySurprise', pred: /surfaceOf/ }, // #1262 V1 lot 5c : le guetteur d'un autre siège entre dans la bande
  { file: 'combatFlow', fn: 'approachFearTrigger', pred: /surfaceOf/ }, // #1262 V1 lot 5c : idem pour le craintif
  { file: 'roundHooks', fn: 'collectHeroRoundEndUpkeep', pred: /surfaceOf/ }, // #1262 V1 lot 2
  { file: 'turnHooks', fn: 'resolveActGates', pred: /surfaceOf/ }, // #1262 V1 : la SURFACE, pas l'affordance locale
  { file: 'turnHooks', fn: 'resolvePsychAI', pred: /aiDriven/ },
  { file: 'triggeredTest', fn: 'resolveFlowTest', pred: /surfaceOf/ }, // #1262 V1 lot 3 : la SURFACE, pas l'affordance locale
  { file: 'triggeredTest', fn: 'resolveFlowChoice', pred: /surfaceOf/ }, // #1262 V1 lot 3 : décider revient au siège du décideur
  { file: 'triggeredEffects', fn: 'applyTriggeredEffects', pred: /surfaceOf/ }, // #1262 V1 lot 2 (voie `deferInteractiveTest`) + lot 3 (l'opt-in)
  { file: 'corruptionFlow', fn: 'gainCorruption', pred: /tenuParUnHumain/ }, // #1426 : la SURFACE, pas l'affordance locale
];

/** Sites AUTORISÉS à faire jouer une défense (jet du défenseur / choix de sa meilleure défense RAW à
 *  distance) dans `combatFlow` — INVENTAIRE EXPLICITE. Toute nouvelle fonction qui roule une défense
 *  échoue la garde : la défense d'un défenseur SURFACÉ doit passer par une FENÊTRE. */
const DEFENDER_ROLL_SITES = new Set([
  'resolveAttack',        // repli non surfacé seulement (`defenseSurfaced` → undefined / defense:'none')
  'maybeOpenDefense',     // OUVRE la fenêtre (chemin instantané : IA, gratuites, balayage)
  'openSurfacedDefense',  // OUVRE la fenêtre (chemin piloté : attackConfirm)
  'resolveDualSecond',    // 2ᵉ frappe du Maniement de deux armes (LDB 10 l.767-773) — jet de défense NEUF, non surfacé
]);
/** Ouvertures de fenêtre attendues sur les chemins d'attaque INSTANTANÉS (le brief #989 : le balayage
 *  et les attaques gratuites ne roulent plus de défense en silence). */
const DEFENSE_OPENERS = ['runCleaveChain', 'applyFreeAttack', 'applyTalentFreeAttack', 'doAttack'];

/** Nom de la fonction top-level ENGLOBANTE d'un index de caractère (déclarations `function`). */
function enclosingFn(src: string, at: number): string {
  const decls = [...src.matchAll(/^(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(/gm)];
  let name = '<top-level>';
  for (const d of decls) { if (d.index! < at) name = d[1]; else break; }
  return name;
}

describe('Défense JAMAIS roulée en silence — inventaire des rouleurs (#989)', () => {
  it('aucun appel à `rollMeleeDefender`/`bestRangedDefense` hors des sites enregistrés', () => {
    const offenders = [...SRC.combatFlow.matchAll(/\b(rollMeleeDefender|bestRangedDefense)\s*\(/g)]
      .map((m) => ({ fn: enclosingFn(SRC.combatFlow, m.index!), call: m[1] }))
      .filter((x) => !DEFENDER_ROLL_SITES.has(x.fn));
    expect(offenders.map((o) => `${o.fn} → ${o.call}`)).toEqual([]);
  });

  it('les chemins d’attaque INSTANTANÉS ouvrent la fenêtre (`maybeOpenDefense`) avant de résoudre', () => {
    for (const fn of DEFENSE_OPENERS)
      expect(bodyOf(SRC.combatFlow, fn), `${fn} doit passer par maybeOpenDefense`).toMatch(/maybeOpenDefense\(/);
  });
});

describe('Surfaçage « remonte-à-un-humain » — statique au choke-point (a)', () => {
  it('le prédicat de cadence `roundTestInteractive` est SUPPRIMÉ (symbole + module `cadenceGate`)', () => {
    expect(existsSync(here('./combat/cadenceGate.ts'))).toBe(false);
    for (const [name, src] of Object.entries(SRC))
      expect(src.includes('roundTestInteractive'), `${name} référence encore roundTestInteractive`).toBe(false);
  });

  it('chaque site de surfaçage connu route vers le prédicat de contrôleur', () => {
    for (const { file, fn, pred } of SURFACING)
      expect(pred.test(bodyOf(SRC[file], fn)), `${file}.${fn} doit référencer ${pred}`).toBe(true);
    // La défense de manœuvre de zone (split défenseurs surfacés/IA) vit dans un gros résolveur — on
    // vérifie que le module la route par le prédicat de SURFACE des défenses (#989), jamais par le
    // `kind` ni par une affordance LOCALE : deux tables de vérité pour « qui peut se défendre » et le
    // défenseur d'un siège distant tombe en silence chez l'hôte.
    expect(SRC.combatManeuvers).toMatch(/defenseSurfaced/);
    expect(SRC.combatManeuvers, 'la défense de zone ne se gate pas sur l’affordance LOCALE').not.toMatch(/pilotedByHuman\(/);
  });
});

// ── Harness de combat (calqué sur round-upkeep-cascade / maneuver-defense-cascade) ───────────────
function freshCombat() {
  const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
  set({ party: [hero] });
  get().startScene(testScene);
  get().startCombat('enc-mutants');
  get().confirmRoundStart();
  vi.clearAllTimers();
  const b = get().battle!;
  const H = b.combatants.find((c) => c.kind === 'hero')!;
  H.aiControlled = silence; // volet (d) : ré-silençage réel (contrôleur ≠ humain → pas de remontée)
  const enemies = b.combatants.filter((c) => c.kind === 'enemy');
  const E = enemies[0];
  enemies.slice(1).forEach((e) => (e.dead = true)); // une seule source ennemie
  H.pos = { x: 10, y: 10 };
  E.pos = { x: 20, y: 20 };
  set({ battle: { ...b }, pendingCascade: null, pendingCorruption: null, pendingDefense: null, pendingLogQueue: [], net: { ...get().net, gmSeat: undefined } });
  return { H, E };
}

/**
 * BEHAVIORAL FLOOR (partagé par b/d) : chaque contexte fait un Test d'un combattant piloté-humain et
 * DOIT ouvrir un `pending*`. `assert` = un `expect` qui LÈVE en cas de silence → le volet (d) l'attend.
 * L'ordre commence par un contexte gaté `humanControlled` (poison) : sous le stub, il échoue d'emblée.
 */
function behavioralFloor(): void {
  // 1) Upkeep de fin de Round (Empoisonné, RAW LDB 16) — gaté `humanControlled`.
  {
    seedBattleRng(3);
    const { H } = freshCombat();
    addCondition(H, COND.empoisonne, 2);
    openRoundEndCascade(get, set);
    expect(get().pendingCascade?.participants.some((s) => s.kind === 'triggeredTest' && s.actorId === H.id), 'upkeep Empoisonné doit REMONTER').toBeTruthy();
  }
  // 2) Psychologie de fin de Round (Peur en Ligne de Vue, LDB 21) — gaté `humanControlled`.
  {
    seedBattleRng(2);
    const { H, E } = freshCombat();
    E.pos = { x: 11, y: 10 };
    E.causesPeur = 2; // H craint E (adjacent, LdV dégagée)
    openRoundEndCascade(get, set);
    expect(get().pendingCascade?.participants.some((s) => s.kind === 'combatPsych' && s.participants?.some((p) => p.id === H.id)), 'Peur de fin de Round doit REMONTER').toBeTruthy();
  }
  // 3) Exposition à la Corruption de fin de combat (LDB 19) — gaté `humanControlled`.
  {
    seedBattleRng(4);
    const { H, E } = freshCombat();
    E.traits = [{ id: 'corruption', arg: 'mineure' }];
    openCombatEndCascade(get, set);
    expect(get().pendingCascade?.participants.some((s) => s.kind === 'combatEndCorruption' && s.actorId === H.id), 'exposition Corruption doit REMONTER').toBeTruthy();
  }
  // 4) Test déclenché (Mâchoires d'acier onGainCondition, LDB 10) — gaté `humanControlled`.
  {
    seedBattleRng(7);
    const { H } = freshCombat();
    H.talents = [...(H.talents ?? []), { talentId: 'machoires-d-acier', times: 1 }];
    addCondition(H, COND.sonne, 2);
    expect(get().pendingCascade?.participants.some((s) => s.kind === 'triggeredTest' && s.actorId === H.id), 'Test déclenché (Mâchoires) doit REMONTER').toBeTruthy();
  }
  // 5) Défense réactive de mêlée (LDB 13) — gaté `defenseSurfaced` (cadence-agnostique).
  {
    seedBattleRng(1);
    const { H, E } = freshCombat();
    E.pos = { x: 11, y: 10 };
    E.weapons = [buildWeapon({ label: 'Épée', attackKind: 'arme', damage: { plusBF: true, flat: 4 } })];
    H.conditions = []; // pas Surpris → peut se défendre
    expect(maybeOpenDefense(get, set, E, H), 'attaque IA sur héros doit OUVRIR la défense').toBe(true);
    expect(get().pendingCascade?.participants.some((s) => s.kind === 'defenseJet' && s.actorId === H.id), 'défense réactive doit REMONTER').toBeTruthy();
  }
  // 6) Défense d'une manœuvre de ZONE (Souffle, LDB 85) — gaté `defenseSurfaced` (cadence-agnostique).
  {
    seedBattleRng(2);
    const { H, E } = freshCombat();
    E.traits = [{ id: 'souffle', value: 14, arg: 'Feu' }];
    E.advantage = 2; E.characteristics['capacite-de-tir'] = 85; E.characteristics.endurance = 40; E.pos = { x: 5, y: 5 };
    H.pos = { x: 5, y: 8 };
    H.characteristics.agilite = 1; H.skills = H.skills.filter((s) => s.id !== 'esquive'); H.conditions = [];
    set({ battle: { ...get().battle!, acted: true } });
    aiCreatureFreeAttacks(get, set, E);
    expect(get().pendingCascade?.participants.some((s) => s.kind === 'maneuverDefense' && s.actorId === H.id), 'défense de manœuvre doit REMONTER').toBeTruthy();
  }
  // 7) Corruption au seuil (LDB 19 l.70) — gaté `tenuParUnHumain` (surface, cadence-agnostique, modale).
  {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'C', seed: 1 });
    hero.aiControlled = silence; // volet (d) : ré-silençage réel
    hero.characteristics.endurance = 1; hero.characteristics['force-mentale'] = 1; hero.corruption = 5; // seuil 0 → dépassé
    set({ party: [hero], battle: null, pendingCorruption: null, net: { ...get().net, gmSeat: undefined } });
    gainCorruption(get, set, hero, 1);
    expect(get().pendingCorruption, 'seuil de Corruption doit REMONTER').toBeTruthy();
  }
}

describe('Surfaçage « remonte-à-un-humain » — behavioral (b) + garde-du-garde (d)', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); resetCadence(); silence = false; set({ battle: null, pendingCascade: null, pendingCorruption: null }); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); resetCadence(); silence = false; });

  it('(b) chaque contexte d’un combattant piloté-humain OUVRE un pending influençable', () => {
    behavioralFloor();
  });

  it('(d) combattant ré-silencié (contrôleur ≠ humain) → le plancher behavioral ÉCHOUE', () => {
    silence = true;
    try {
      expect(() => behavioralFloor()).toThrow();
    } finally {
      silence = false;
    }
  });
});

// ── Volet (c) — preuve par FLIP LOCAL (le surfaçage suit le CONTRÔLEUR, jamais le kind) ───────────
describe('Surfaçage « remonte-à-un-humain » — flip local (c)', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); resetCadence(); set({ battle: null, pendingCascade: null }); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); resetCadence(); });

  it('un ENNEMI assigné à un siège humain fait REMONTER son Test déclenché (actorId===enemyId)', () => {
    seedBattleRng(7);
    const { E } = freshCombat();
    E.talents = [...(E.talents ?? []), { talentId: 'machoires-d-acier', times: 1 }];
    set({ net: { ...get().net, gmSeat: 0 } }); // rôle MJ posé sur le siège 0 (bac-à-sable) → conduit les ennemis
    addCondition(E, COND.sonne, 2); // onGainCondition → testRouter → resolveFlowTest → humanControlled(E)=true
    const c = get().pendingCascade;
    expect(c, 'l’ennemi assigné doit ouvrir une cascade').toBeTruthy();
    expect(c!.participants.some((s) => s.kind === 'triggeredTest' && s.actorId === E.id), 'le Test REMONTE au nom de l’ennemi assigné').toBe(true);
  });

  it('le même ennemi NON assigné → Test déclenché résolu INLINE (aucune cascade)', () => {
    seedBattleRng(5);
    const { E } = freshCombat();
    E.characteristics.endurance = 90; // Résistance réussie → retrait inline
    E.talents = [...(E.talents ?? []), { talentId: 'machoires-d-acier', times: 1 }];
    set({ net: { ...get().net, gmSeat: undefined } });
    addCondition(E, COND.sonne, 2);
    expect(get().pendingCascade, 'ennemi IA → jamais de cascade').toBeNull();
  });

  it('la Maladresse d’un ENNEMI conduit (MJ) REMONTE en cascade via attackConfirm (pas perdue — risque #2 du plan)', () => {
    const { H, E } = freshCombat();
    E.pos = { x: 10, y: 10 }; H.pos = { x: 11, y: 10 }; // adjacents (mêlée)
    E.weapons = [buildWeapon({ label: 'Épée', attackKind: 'arme', damage: { plusBF: true, flat: 4 } })];
    E.characteristics['capacite-de-combat'] = 20; // CC basse → un double ≥ 22 rate = Maladresse (LDB 14 l.48)
    set({ net: { ...get().net, gmSeat: 0 }, pendingCascade: null }); // rôle MJ → E est CONDUIT (controlsCombatant(E)=vrai)
    // Graine DÉTERMINISTE produisant une Maladresse de E (double raté) — via le VRAI résolveur d'attaque.
    let seed = 0;
    for (let sd = 1; sd <= 500 && !seed; sd++) {
      seedBattleRng(sd);
      const r = resolveAttack(get, E, H);
      if (r && attackerFumbled(r.res, r.weapon)) seed = sd;
    }
    expect(seed, 'une graine de Maladresse existe').toBeGreaterThan(0);
    seedBattleRng(seed);
    const r = resolveAttack(get, E, H)!; // résultat de Maladresse RÉEL (pas fabriqué)
    set({ pendingAttack: { attackerId: E.id, targetId: H.id, location: r.res.location ?? null, result: r.res, victimId: r.victim?.id, weaponUid: E.weapons[0].uid } });
    get().attackConfirm();
    // La défense du héros est SURFACÉE (#989) : `attackConfirm` interpose SA fenêtre — le héros défend,
    // PUIS l'application reprend et la Maladresse de l'ennemi conduit remonte au nom de l'ennemi.
    expect(get().pendingDefense?.defenderId, 'la défense du héros s’interpose').toBe(H.id);
    get().defenseRoll();
    get().defenseConfirm();
    const c = get().pendingCascade;
    expect(c?.participants.some((s) => s.jet === 'fumble' && s.actorId === E.id), 'la Maladresse de l’ennemi conduit REMONTE au nom de l’ennemi').toBe(true);
  });

  it('un HÉROS `aiControlled` → Test déclenché résolu INLINE (contrôleur ≠ humain)', () => {
    seedBattleRng(5);
    const { H } = freshCombat();
    H.aiControlled = true; H.characteristics.endurance = 90;
    H.talents = [...(H.talents ?? []), { talentId: 'machoires-d-acier', times: 1 }];
    set({ net: { ...get().net, gmSeat: undefined } });
    addCondition(H, COND.sonne, 2);
    expect(get().pendingCascade, 'héros piloté-IA → pas de cascade').toBeNull();
  });
});
