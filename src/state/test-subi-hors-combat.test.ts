/**
 * #1874 C0 — HORS COMBAT, les conséquences d'un Test SUBI tombent sur SON sujet, et sur lui seul.
 *
 * Un Test SUBI (effet déclenché : Critique, symptôme, État, sort) s'ouvre hors combat par la porte
 * `routeTriggeredTest` → `openSkillTest`, et sa branche parle le vocabulaire `target`/`caster`.
 * Seul le marcheur d'ACTEUR (`runCombatFlow`) honore ce vocabulaire : le marcheur de SCÈNE (`runFlow`)
 * parle `party`/`hero`+`heroId` et ne connaît ni sujet ni lanceur. Le marqueur `PendingTest.subi`
 * NOMME le vocabulaire de la branche, et `resolveTest` la confie au marcheur qui le parle
 * (`reprendreTestSubi`).
 *
 * Le cycle d'une MALADIE (`onTick.test` d'un symptôme, `dailyTest.test` d'une maladie) est lui aussi un
 * Test SUBI, mais sa porte est l'ENTRETIEN de la nuit (étape `diseaseTick`, `engine/disease.ts`
 * `opsDeLEchec` → applier de `state/restFlow.ts`) : T7/T7b le jouent par ce chemin (`nuitDuMalade`).
 *
 * Tout passe par le STORE, sur la donnée RÉELLE de `src/data`, avec QUATRE héros dont le sujet n'est
 * jamais `party[0]` : une conséquence qui atteint `h3` y est arrivée par routage, pas par défaut.
 *
 * Doctrine utilisateur 2026-08-24 (verbatim, #1874) : « À partir du moment ou je dois faire un jet,
 * il doit apparaitre. Y'a pas de "classe spéciale" si je suis a l'initiative, que je le subit, face a
 * un adversaire ou face a ... une maladie ».
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { seedBattleRng } from './battleRng';
import { routeTriggeredTest } from './combat/triggeredTest';
import { runFlow, openSkillTest, messageCibleHorsScene } from './combatEffects';
import { EMPTY_FLOW, flowFromEffects, type Flow } from './flow';
import { decorHorsCombat, noeudsDeTest, rendreMalade, nuitDuMalade, type NoeudTest } from './noeudsDeTest.testkit';
import { validateScene } from './validateScene';
import { emptyScene, type Effect, type Scene } from './scene';
import type { Combatant, EffectSource } from '../engine/types';
import type { GameOp } from '../engine/ops';
import { t } from '../i18n';
import crits from '../data/criticals.json';
import etats from '../data/etats.json';
import talents from '../data/talents.json';
import spells from '../data/spells.json';
import shipCrits from '../data/ship-criticals.json';

const get = useGame.getState;
const set = useGame.setState;

/** Décor : 4 héros, le SUJET est `h3`. */
function decor(seed = 42): Combatant {
  seedBattleRng(seed);
  useGame.setState(decorHorsCombat() as never);
  return get().party[2];
}

const heros = (id: string): Combatant => get().party.find((c) => c.id === id)!;
const etatsDe = (id: string): string[] => (heros(id).conditions ?? []).map((c) => c.id).sort();
/** Empreinte JSON des héros AUTRES que le sujet — la preuve « personne d'autre n'a bougé ». */
const lesAutres = (sujetId: string): string => JSON.stringify(get().party.filter((c) => c.id !== sujetId));

/** Résout le `pendingTest` ouvert par la porte : issue IMPOSÉE, jamais un dé qui décide du test. */
function acquitter(opts: { success: boolean; sl: number }): void {
  const pt = get().pendingTest;
  expect(pt, 'aucune modale de jet ouverte : la porte n’a pas routé le Test').toBeTruthy();
  set({ pendingTest: { ...pt!, roll: opts.success ? 1 : 99, success: opts.success, sl: opts.sl } });
  get().resolveTest();
}

/** Aller-retour JSON du COUPLE suspendu (save, coop, pending sérialisé) — réinjecté tel quel. */
function allerRetourJSON(): void {
  const snap = JSON.parse(JSON.stringify({ pendingTest: get().pendingTest, pendingCascade: get().pendingCascade }));
  set({ pendingTest: snap.pendingTest, pendingCascade: snap.pendingCascade });
}

// ── La DONNÉE, trouvée par sa FORME (jamais par un id recopié) ─────────────────────────────────

type Rangee = { id: string; label: string; test: NoeudTest };
/** La rangée de Critique dont l'échec pose UN Sonné sur la CIBLE — « Nez cassé » (LDB 15). */
function rangeeSonneSurLaCible(): Rangee {
  for (const table of crits as { entries?: Rangee[] }[]) {
    for (const e of table.entries ?? []) {
      const f = e.test?.fail as { effect?: { type?: string; on?: string; ops?: GameOp[] } } | undefined;
      if (f?.effect?.on !== 'target' || f.effect.type !== 'ops') continue;
      const ops = f.effect.ops ?? [];
      if (ops.length === 1 && ops[0].op === 'condition' && (ops[0] as { id: string }).id === 'sonne') return e;
    }
  }
  throw new Error('aucune rangée de Critique à branche `on:target` posant un Sonné — le scan a glissé');
}

/** Le Test de fin de Round d'un État (`etats.json`) — celui de Sonné porte un `if` de branche. */
const noeudDEtat = (id: string): NoeudTest =>
  (etats as { id: string; effects?: { flow: Flow }[] }[]).find((e) => e.id === id)!
    .effects!.find((x) => x.flow.kind === 'test')!.flow as NoeudTest;

/** Le nœud `test` d'un talent (Mâchoires d'acier : branche `on:'caster'`, auto-portée). */
const noeudDeTalent = (id: string): NoeudTest =>
  (talents as { id: string; effects?: { flow: Flow }[] }[]).find((t) => t.id === id)!
    .effects!.find((x) => x.flow.kind === 'test')!.flow as NoeudTest;

/** Feuilles `ops` d'un Flow (branches comprises) — sert à CHOISIR un nœud par sa forme. */
function feuilles(f: Flow | undefined): { on?: string; ops: GameOp[] }[] {
  if (!f) return [];
  if (f.kind === 'do') return f.effect.type === 'ops' ? [f.effect as { on?: string; ops: GameOp[] }] : [];
  if (f.kind === 'seq') return f.steps.flatMap(feuilles);
  if (f.kind === 'if') return [...feuilles(f.then), ...feuilles(f.else)];
  if (f.kind === 'test') return [...feuilles(f.success), ...feuilles(f.fail)];
  return [...feuilles(f.yes), ...feuilles(f.no)];
}
/** Tous les nœuds `test` d'un Flow, racine comprise. */
function noeudsTest(f: unknown, out: NoeudTest[] = []): NoeudTest[] {
  if (Array.isArray(f)) { f.forEach((x) => noeudsTest(x, out)); return out; }
  if (!f || typeof f !== 'object') return out;
  const o = f as Record<string, unknown>;
  if (o.kind === 'test' && o.test) out.push(o as unknown as NoeudTest);
  Object.values(o).forEach((v) => noeudsTest(v, out));
  return out;
}

/** L'ENTITÉ PORTEUSE du sort d'où vient le nœud — tout producteur réel la passe à la porte, et un
 *  Test enfoui dans une branche en dérive son enjeu. */
function sourceDuSort(node: NoeudTest): EffectSource {
  const sp = (spells as { id: string; effects?: Flow }[]).find((s) => noeudsTest(s.effects).includes(node))!;
  return { kind: 'spell', id: sp.id };
}

/** LA ligne que la feuille `on:'caster'` du nœud retenu produit (`op.corruptionExposure`) — elle
 *  NOMME le porteur, donc elle dit LEQUEL des deux acteurs a reçu la conséquence. Distincte de la
 *  ligne de JET, que le sujet produit toujours : sans ce filtre, le banc serait vert à vide. */
function ligneDeLaConsequence(): string {
  const lignes = get().journal.filter((l) => /Exposition/.test(l));
  expect(lignes.length, 'la branche `on:caster` n’a produit AUCUNE conséquence').toBe(1);
  return lignes[0];
}

/** Un nœud de `spells.json` dont une branche porte une feuille `on:'caster'` MESURABLE (une ligne
 *  nommant le porteur) : c'est le seul moyen de distinguer le LANCEUR du SUJET dans la conséquence. */
function noeudDeSortACaster(): NoeudTest {
  for (const sp of spells as { effects?: Flow }[]) {
    for (const n of noeudsTest(sp.effects)) {
      const caster = [...feuilles(n.success), ...feuilles(n.fail)]
        .filter((e) => e.on === 'caster' && e.ops.some((o) => o.op !== 'narrative'));
      if (caster.length) return n;
    }
  }
  throw new Error('aucun nœud `test` de sort à branche `on:caster` mesurable — le scan a glissé');
}

/** Une scène JOUET portant la feuille à valider sous un déclencheur — le chemin d'un contenu authoré.
 *  Les 4 projets LIVRÉS sont tenus au même contrat par `scenes/bundled-projects.test.ts` (zéro erreur). */
function sceneAvecFeuille(effet: Effect): Scene {
  const s = emptyScene(5, 5);
  s.id = 'sonde-1874';
  s.triggers.push({ id: 't-0', rect: { x: 0, y: 0, w: 1, h: 1 }, flow: flowFromEffects([effet]) });
  return s;
}

// ────────────────────────────────────────────────────────────────────────────────────────────────

describe('#1874 C0 — un Test SUBI hors combat : la conséquence tombe sur SON sujet', () => {
  beforeEach(() => { decor(); });

  it('T1 — Critique « Sonné sur la cible » raté : le SUJET est Sonné, les 3 autres n’ont pas bougé', () => {
    const sujet = decor();
    const rangee = rangeeSonneSurLaCible();
    const avant = lesAutres(sujet.id);
    routeTriggeredTest(get, set, sujet, sujet, rangee.test, { label: rangee.label });
    expect(get().pendingTest!.actorId, 'la modale s’ouvre chez le sujet').toBe('h3');
    acquitter({ success: false, sl: -3 });
    expect(etatsDe('h3')).toContain('sonne');
    expect(lesAutres(sujet.id), 'un camarade a encaissé la conséquence du sujet').toBe(avant);
    expect(get().journal.length, 'la conséquence ne se dit nulle part').toBeGreaterThan(0);
    expect(get().pendingLogQueue, 'file de journal non drainée : des lignes restent en vol').toEqual([]);
  });

  it('T2 — le couple suspendu passe par JSON (save / coop / pending sérialisé) avant la reprise', () => {
    const sujet = decor();
    const rangee = rangeeSonneSurLaCible();
    const avant = lesAutres(sujet.id);
    routeTriggeredTest(get, set, sujet, sujet, rangee.test, { label: rangee.label });
    allerRetourJSON(); // aucune closure ne survit : tout ce que la reprise lit est SÉRIALISÉ
    acquitter({ success: false, sl: -3 });
    expect(etatsDe('h3')).toContain('sonne');
    expect(lesAutres(sujet.id)).toBe(avant);
  });

  it('T3 — le `if` de branche lit le SUJET (Sonné → Exténué), et `sl` alimente l’échelle', () => {
    // `etats.json` Sonné : la réussite retire 1 Sonné + 1 par DR, puis `if compare target` pose
    // Exténué quand il ne reste ni Sonné ni Exténué (LDB 16).
    const node = noeudDEtat('sonne');
    // DR 0 : un seul Sonné retiré sur trois — la Condition de l'`if` reste fausse.
    decor();
    set({ party: get().party.map((c) => (c.id === 'h3' ? { ...c, conditions: [{ id: 'sonne', value: 3 }] } : c)) as never });
    const sujet = heros('h3');
    routeTriggeredTest(get, set, sujet, sujet, node, { label: 'Résistance au Sonné' });
    acquitter({ success: true, sl: 0 });
    expect(heros('h3').conditions!.find((c) => c.id === 'sonne')!.value).toBe(2);
    expect(etatsDe('h3')).not.toContain('extenue');
    // DR 2 : 1 + 2 Sonné retirés → plus aucun → l'`if` sur le SUJET bascule et pose Exténué.
    decor();
    set({ party: get().party.map((c) => (c.id === 'h3' ? { ...c, conditions: [{ id: 'sonne', value: 3 }] } : c)) as never });
    const avant = lesAutres('h3');
    routeTriggeredTest(get, set, heros('h3'), heros('h3'), node, { label: 'Résistance au Sonné' });
    acquitter({ success: true, sl: 2 });
    expect(etatsDe('h3'), 'DR 2 : les 3 Sonné partent et Exténué se pose').toEqual(['extenue']);
    expect(lesAutres('h3')).toBe(avant);
  });

  it('T4a — branche `on:caster` AUTO-PORTÉE (Mâchoires d’acier) : elle retombe sur le sujet', () => {
    const node = noeudDeTalent('machoires-d-acier');
    decor();
    set({ party: get().party.map((c) => (c.id === 'h3' ? { ...c, conditions: [{ id: 'sonne', value: 2 }] } : c)) as never });
    const avant = lesAutres('h3');
    routeTriggeredTest(get, set, heros('h3'), heros('h3'), node, { label: 'Mâchoires d’acier' });
    acquitter({ success: true, sl: 0 });
    expect(heros('h3').conditions!.find((c) => c.id === 'sonne')!.value, 'le porteur = le sujet').toBe(1);
    expect(lesAutres('h3')).toBe(avant);
  });

  it('T4b — sujet h3, LANCEUR h4 : la feuille `on:caster` atteint le lanceur, pas le sujet', () => {
    const node = noeudDeSortACaster();
    const sujet = decor();
    routeTriggeredTest(get, set, sujet, heros('h4'), node, { label: 'Sort déclenché' });
    allerRetourJSON();
    acquitter({ success: false, sl: -1 });
    const dit = ligneDeLaConsequence();
    expect(dit, 'la conséquence `on:caster` doit nommer le LANCEUR (H4)').toContain('H4');
    expect(dit, 'le sujet n’est pas le lanceur').not.toContain('H3');
  });

  it('T4c — lanceur IRRÉSOLUBLE à la reprise : la feuille `on:caster` retombe sur le SUJET', () => {
    // Parité avec le combat (`applyTriggeredTestBranch` : `exec.caster ?? c`) — la conséquence ne se
    // perd pas parce que le porteur a quitté l'état.
    const node = noeudDeSortACaster();
    const sujet = decor();
    routeTriggeredTest(get, set, sujet, heros('h4'), node, { label: 'Sort déclenché' });
    set({ party: get().party.filter((c) => c.id !== 'h4') as never }); // le lanceur a quitté le groupe
    acquitter({ success: false, sl: -1 });
    expect(ligneDeLaConsequence(), 'lanceur introuvable → le SUJET porte la conséquence').toContain('H3');
  });

  it('T5 — Test IMBRIQUÉ dans la branche : la 2ᵉ suspension s’ouvre sur le SUJET, meta sérialisable', () => {
    // Le nœud de `spells.json` dont la branche porte elle-même un `test` (trouvé par sa forme).
    const node = (spells as { effects?: Flow }[])
      .flatMap((sp) => noeudsTest(sp.effects))
      .find((n) => noeudsTest(n.fail).length > 0 || noeudsTest(n.success).length > 0)!;
    expect(node, 'aucun nœud de sort à Test imbriqué — le scan a glissé').toBeTruthy();
    const sujet = decor();
    routeTriggeredTest(get, set, sujet, heros('h4'), node, { label: 'Sort à second jet', source: sourceDuSort(node) });
    allerRetourJSON();
    acquitter({ success: false, sl: -1 });
    const pc = get().pendingCascade;
    expect(pc, 'le Test imbriqué doit RE-suspendre hors combat').toBeTruthy();
    const etape = pc!.participants.find((p) => p.kind === 'triggeredTest');
    expect(etape, 'le second jet passe par l’étape générique `triggeredTest`').toBeTruthy();
    expect(etape!.actorId, 'le second jet reste chez le SUJET').toBe('h3');
    expect(etape!.meta?.casterId, 'le lanceur voyage par le meta (ids, sérialisable)').toBe('h4');
    expect(() => JSON.parse(JSON.stringify(pc)), 'la cascade doit rester sérialisable').not.toThrow();
  });

  it('T5b — branche à `choice` : la cascade s’ouvre hors combat, chez le SUJET', () => {
    const node = (spells as { effects?: Flow }[])
      .flatMap((sp) => noeudsTest(sp.effects))
      .find((n) => n.fail?.kind === 'choice' || n.success?.kind === 'choice')!;
    expect(node, 'aucun nœud de sort à `choice` en branche — le scan a glissé').toBeTruthy();
    const brancheChoice = node.fail?.kind === 'choice';
    const sujet = decor();
    routeTriggeredTest(get, set, sujet, sujet, node, { label: 'Sort à choix' });
    acquitter({ success: !brancheChoice, sl: brancheChoice ? -1 : 1 });
    const pc = get().pendingCascade;
    expect(pc, 'le `choice` de branche doit ouvrir sa cascade').toBeTruthy();
    expect(pc!.participants.every((p) => !p.actorId || p.actorId === 'h3'), 'le choix reste chez le sujet').toBe(true);
  });

  it('T8 — sujet MORT entre l’ouverture et la reprise : la branche n’est PAS jouée, et la perte se DIT', () => {
    const sujet = decor();
    const rangee = rangeeSonneSurLaCible();
    routeTriggeredTest(get, set, sujet, sujet, rangee.test, { label: rangee.label });
    set({ party: get().party.map((c) => (c.id === 'h3' ? { ...c, dead: true } : c)) as never });
    const avant = JSON.stringify(get().party);
    acquitter({ success: false, sl: -3 });
    expect(JSON.stringify(get().party), 'la branche d’un sujet mort a touché quelqu’un').toBe(avant);
    expect(get().journal, 'la conséquence perdue doit se NOMMER, avec sa source')
      .toContain(t('cascade.cibleDisparue', { label: rangee.label }));
  });

  it('T12 — la reprise NOMME la source comme la porte en combat (`nomDeSource` de l’`OpsCtx` d’entrée)', () => {
    // Feuille `on:target` dont l'effet posé porte le nom de sa source (`ActiveEffect.label`).
    const node = {
      kind: 'test', test: { skill: { id: 'calme' }, difficulty: 'intermediaire', label: 'Jet de Calme' },
      success: EMPTY_FLOW,
      fail: { kind: 'do', effect: { type: 'ops', on: 'target', ops: [{ op: 'corruptionExposure', easeSteps: 1 }] } },
    } as unknown as NoeudTest;
    const sujet = decor();
    routeTriggeredTest(get, set, sujet, sujet, node, { label: 'Source nommée' });
    allerRetourJSON();
    acquitter({ success: false, sl: -1 });
    const poses = (heros('h3').activeEffects ?? []).filter((e) => e.corruptionEase);
    expect(poses.map((e) => e.label), 'l’effet posé à la reprise doit porter le nom de SA source').toEqual(['Source nommée']);
  });

  it('T11 — FRONTIÈRE de `subi` : un contexte par RÉFÉRENCE (`hull`) ne franchit pas la modale, et se DIT', () => {
    // `subi` ne transporte que ce qui se résout par ID. Une branche qui exige une COQUE (op `fall` d'un
    // Critique de navire) n'a pas sa place derrière la modale : sa porte est `bandeTriggeredTest`, qui
    // tient la coque au site. Reprise sans elle → fail-fast NOMMÉ, jamais une hauteur tirée dans le vide.
    const node = (shipCrits as { tables: Record<string, { crewHit?: { test?: NoeudTest } }[]> })
      .tables.greement.map((r) => r.crewHit?.test).find((t) => t && JSON.stringify(t).includes('"fall"'))!;
    expect(node, 'aucun nœud de Critique de coque à branche `fall` — le scan a glissé').toBeTruthy();
    const sujet = decor();
    routeTriggeredTest(get, set, sujet, sujet, node, { label: 'Critique de coque' });
    expect(get().pendingTest!.subi, 'aucun `hull` n’entre dans le marqueur').toEqual({ label: 'Critique de coque' });
    expect(() => acquitter({ success: false, sl: -2 })).toThrow(/fall/);
  });

  it('T9 — non-régression : un pending SANS `subi` garde le vocabulaire de SCÈNE (`on:hero`+`heroId`)', () => {
    // Forme EXACTE de la branche de `battleAidTeam` (combatSlice.ts) : elle vise un AUTRE héros par
    // son `heroId` — vocabulaire que `runCombatFlow` n'honore pas. Sans marqueur, elle reste sur `runFlow`.
    decor();
    const onSuccess = {
      kind: 'seq',
      steps: [{ kind: 'do', effect: { type: 'ops', on: 'hero', heroId: 'h4', ops: [{ op: 'teamCommander', commanderId: 'h1' }] } }],
    } as unknown as Flow;
    openSkillTest(get, set, { skill: { id: 'commandement' }, difficulty: 'intermediaire', label: 'Commandant d’équipe' },
      onSuccess, EMPTY_FLOW, EMPTY_FLOW, { actorId: 'h1' });
    expect(get().pendingTest!.subi, 'aucun marqueur : ce n’est pas un Test SUBI').toBeUndefined();
    acquitter({ success: true, sl: 1 });
    expect(heros('h4').teamCommanderId, 'le `heroId` de scène doit rester honoré').toBe('h1');
    expect(heros('h1').teamCommanderId).toBeUndefined();
  });
});

describe('#1874 C0 — un oubli de routage HURLE, il ne se tait jamais', () => {
  beforeEach(() => { decor(); });

  it('T10a — une feuille `on:target` jouée par le marcheur de SCÈNE LÈVE en nommant sa porte', () => {
    const flow = { kind: 'do', effect: { type: 'ops', on: 'target', ops: [{ op: 'condition', id: 'sonne' }] } } as unknown as Flow;
    expect(() => runFlow(get, set, flow, 'Feuille égarée')).toThrow(/routeTriggeredTest/);
    expect(get().party.every((c) => !(c.conditions ?? []).length), 'rien n’a été appliqué avant le refus').toBe(true);
  });

  it('T10b — idem pour `on:caster`', () => {
    const flow = { kind: 'do', effect: { type: 'ops', on: 'caster', ops: [{ op: 'condition', id: 'sonne' }] } } as unknown as Flow;
    expect(() => runFlow(get, set, flow, 'Feuille égarée')).toThrow(/routeTriggeredTest/);
  });

  it('T10c — un contenu de SCÈNE fautif se REFUSE À LA VALIDATION, du même message que la levée', () => {
    // Règle 2 (tout le contenu est éditable) : l'auteur l'apprend dans l'ÉDITEUR (`validateScene`).
    // Même source que la levée du marcheur — `EFFECT_HANDLERS.ops.refs`.
    const fautive = sceneAvecFeuille({ type: 'ops', on: 'target', ops: [{ op: 'heal', amount: 1 }] });
    const erreurs = validateScene([fautive]).filter((w) => w.level === 'error');
    expect(erreurs.map((w) => w.message)).toEqual([messageCibleHorsScene({ on: 'target' }, 'target')]);
    expect(erreurs[0].message, 'le refus NOMME la porte du vocabulaire déclenché').toContain('routeTriggeredTest');
    // Le vocabulaire de scène passe, `on` absent compris (= `party`).
    for (const feuille of [
      { type: 'ops', on: 'party', ops: [{ op: 'heal', amount: 1 }] },
      { type: 'ops', on: 'hero', heroId: 'h3', ops: [{ op: 'heal', amount: 1 }] },
      { type: 'ops', ops: [{ op: 'heal', amount: 1 }] },
    ] as Effect[]) {
      expect(validateScene([sceneAvecFeuille(feuille)]), JSON.stringify(feuille)).toEqual([]);
    }
  });
});

describe('#1874 C0 — un cycle de MALADIE hors combat : la conséquence tombe sur le MALADE, par l’entretien réel', () => {
  /** Le nœud de cycle d'un symptôme, par son id STABLE d'entrée. */
  const cycleDe = (id: string) => noeudsDeTest().find((n) => n.fichier === 'symptoms.json' && n.entryId === id && n.chemin === '.onTick.test')!;
  const sansIds = (x: unknown): string => JSON.stringify(x).replace(/\b(it|lo)-\d+\b/g, '$1-#');
  /** Une nuit du malade `h3`, Test de cycle RATÉ ; `temoin` = la MÊME nuit, Test RÉUSSI (l'applier
   *  `diseaseTick` n'applique que l'échec). La nuit touche tout le groupe (repas) : « personne d'autre »
   *  se mesure contre ce témoin. */
  const nuit = (id: string, opts?: { temoin?: boolean; destin?: number }) => {
    decor();
    set({ party: get().party.map((c) => (c.id === 'h3' ? rendreMalade({ ...c, ...(opts?.destin != null ? { fate: opts.destin } : {}) }, cycleDe(id)) : c)) as never });
    nuitDuMalade(get, cycleDe(id), 'h3', !!opts?.temoin);
    return { malade: sansIds(heros('h3')), autres: sansIds(get().party.filter((c) => c.id !== 'h3')) };
  };

  it('T7 — conséquence GRAVE (`kill` de « toxine ») : le malade meurt, personne d’autre', () => {
    // Sans Point de Destin, `kill` TUE (avec, il en brûle un : `fateSaveOrDie`) — on veut la mort nue.
    const temoin = nuit('toxine', { temoin: true, destin: 0 });
    expect(heros('h3').dead, 'le témoin (Test réussi) ne tue personne').toBeFalsy();
    const reel = nuit('toxine', { destin: 0 });
    expect(heros('h3').dead, 'la toxine tue SON porteur').toBe(true);
    expect(reel.autres, 'un camarade a encaissé la mort du malade').toBe(temoin.autres);
  });

  it('T7b — conséquence TIRÉE À LA TABLE (`rollTable` de « vers de carie ») : la rangée frappe le MALADE seul', () => {
    const temoin = nuit('vers-de-carie', { temoin: true });
    const reel = nuit('vers-de-carie');
    expect(reel.malade, 'la rangée tirée n’a rien fait au malade').not.toBe(temoin.malade);
    expect(reel.autres, 'la table a tiré sur un camarade').toBe(temoin.autres);
  });
});
