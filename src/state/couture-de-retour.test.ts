import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useGame, type BattleState } from './store';
import { createHero } from '../engine/character';
import { testScene } from '../scenes/test-fixture';
import { emptyScene } from './scene';
import { flowFromEffects } from './flow';
import { applyEffects } from './combatEffects';
import { finalizeBattle } from './combatFlow';
import { inBattleId } from './combatants';
import { touchActors } from './combatOrParty';
import { seedBattleRng, battleRng } from './battleRng';
import { setRule, resetRule } from '../engine/policy';
import { contractDisease, tickDisease } from '../engine/disease';
import { traumaById, dechirureFractureFicheId } from '../engine/trauma';
import { d10 } from '../engine/dice';
import { effectiveChar } from '../engine/characteristics';
import { applyExposureFailure } from '../engine/exposure';
import { traumaOnImpossibleAmbition } from '../engine/psychology';
import { entreeEnRencontre, carryOverState, isPersistentCondition, REPORT_DE_COMBATTANT } from '../engine/persistence';
import { buildApi } from './devtools';
import { bourseInstanceOf, bourseOf } from '../engine/bourse';
import { t } from '../i18n';
import type { Combatant } from '../engine/types';
import { readFileSync } from 'node:fs';
import { readCorpus } from '../../scripts/guards/lib/sourceCorpus.mjs';
import { join, posix } from 'node:path';
import { buildAdvancementView } from './advancement';
import { learnableSpells } from '../engine/grimoire';
import { itemFromTrappingById } from '../engine/items';
import { careers } from '../data';

// Coutures d'entrée et de retour d'un héros dans le combat (#2312).

const jouer = (e: unknown) => applyEffects(() => useGame.getState(), useGame.setState, [e as never]);
const tirages = (n = 6) => Array.from({ length: n }, () => battleRng().int(1, 100));
const grp = (id: string) => useGame.getState().party.find((h) => h.id === id)!;
const cbt = (id: string) => inBattleId(useGame.getState().battle, id)!;
const fin = () => finalizeBattle(() => useGame.getState(), useGame.setState);

function combat(): string {
  const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
  hero.talents.push({ talentId: 'magie-mineure', times: 1 });
  hero.spells = [];
  useGame.setState({ battle: null, party: [hero], pendingCascade: null, pendingRoundStart: null, journal: [] });
  useGame.getState().startScene(testScene());
  seedBattleRng(777);
  useGame.getState().startCombat('enc-mutants', undefined, { noSurprise: true });
  vi.clearAllTimers();
  return hero.id;
}

/** Clés dont l'objet (ou un élément de tableau) est PARTAGÉ entre les deux copies. */
function partages(a: Combatant, b: Combatant): string[] {
  if (a === b) return ['OBJET-ENTIER'];
  const ra = a as unknown as Record<string, unknown>, rb = b as unknown as Record<string, unknown>;
  const k: string[] = [];
  for (const key of Object.keys(ra)) {
    const va = ra[key], vb = rb[key];
    if (va && typeof va === 'object' && va === vb) k.push(key);
    if (Array.isArray(va) && Array.isArray(vb)) va.forEach((x, i) => { if (x && typeof x === 'object' && vb.includes(x)) k.push(`${key}[${i}]`); });
  }
  return k;
}

describe('coutures du héros en combat (#2312)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  it('aucune référence partagée entre le combattant et le héros du groupe, à l’entrée puis après chaque effet', () => {
    const id = combat();
    expect(partages(grp(id), cbt(id))).toEqual([]);
    const effets = [
      { type: 'giveTrapping', trappingId: 'corde', heroId: id },
      { type: 'learnSpell', spell: 'sommeil', heroId: id },
      { type: 'inflictDisease', disease: 'vers-de-carie', heroId: id },
      { type: 'inflictTrauma', kind: 'fracture', severity: 'mineur', location: 'brasD', heroId: id },
      { type: 'giveSin', amount: 1, heroId: id },
      { type: 'giveXp', amount: 10 },
      { type: 'mealParty' },
      { type: 'restoreFortune' },
      { type: 'giveMoney', montant: { gold: 1 } },
    ];
    for (const e of effets) {
      jouer(e);
      expect({ effet: e.type, cles: partages(grp(id), cbt(id)) }).toEqual({ effet: e.type, cles: [] });
    }
    expect(bourseInstanceOf(cbt(id))).toEqual(bourseInstanceOf(grp(id)));
    const corde = (c: Combatant) => c.items?.find((i) => i.trappingId === 'corde');
    expect(corde(cbt(id))).toBeDefined();
    expect(corde(cbt(id))).toEqual(corde(grp(id)));
    expect(bourseOf(cbt(id)).gold).toBeGreaterThan(0);
  });

  it('les handlers tirent leurs dés comme le corps de base : flux RNG inchangé', () => {
    setRule('psych-acquisition-optional', true);
    try {
      let id = combat(); seedBattleRng(4242); jouer({ type: 'inflictDisease', disease: 'vers-de-carie', heroId: id });
      const nouvD = [cbt(id).diseases?.find((d) => d.id === 'vers-de-carie'), tirages()];
      combat(); seedBattleRng(4242);
      expect(nouvD).toEqual([contractDisease('vers-de-carie', battleRng()), tirages()]);

      id = combat(); seedBattleRng(4242); jouer({ type: 'inflictTrauma', kind: 'fracture', severity: 'mineur', location: 'brasD', heroId: id });
      const nouvT = [cbt(id).traumas, tirages()];
      id = combat(); seedBattleRng(4242);
      const be = Math.floor(effectiveChar(grp(id), 'endurance') / 10);
      expect(nouvT).toEqual([[traumaById(dechirureFractureFicheId('fracture', 'mineur', 'brasD'), { be, d10: d10(battleRng()) }, 'brasD')], tirages()]);

      for (const graine of [1, 2, 3, 5, 8]) {
        id = combat(); seedBattleRng(graine); jouer({ type: 'ambitionLost', heroId: id });
        const nouvA = [cbt(id).psychTraits ?? [], tirages()];
        id = combat(); seedBattleRng(graine); const res = traumaOnImpossibleAmbition(grp(id), battleRng());
        expect(nouvA).toEqual([res?.trait ? [res.trait] : [], tirages()]);
      }
    } finally { resetRule('psych-acquisition-optional'); }
  });

  it('faim, soif et Chance gagnée en combat reviennent au groupe à finalizeBattle', () => {
    const cas: [unknown, (c: Combatant) => unknown][] = [
      [{ type: 'inflictHunger', days: 2, target: 'party' }, (c) => c.hunger],
      [{ type: 'inflictThirst', days: 2, target: 'party' }, (c) => c.thirst],
      [{ type: 'ops', on: 'hero', ops: [{ op: 'gainResource', resource: 'fortune', amount: 1 }] }, (c) => c.fortune],
    ];
    for (const [e, lire] of cas) {
      const id = combat();
      const avant = lire(grp(id));
      jouer(e);
      const enCombat = structuredClone(lire(cbt(id)));
      expect(enCombat).not.toEqual(avant);
      fin();
      expect(lire(grp(id))).toEqual(enCombat);
    }
  });

  it('la Chance dépensée en combat (pré-emption d’initiative, LDB 17 l.25) revient au groupe', () => {
    const id = combat();
    const b = useGame.getState().battle!;
    useGame.setState({ pendingRoundStart: {} as never, battle: { ...b, order: [...b.order.filter((x) => x !== id), id] } });
    cbt(id).weapons = [];
    const avant = cbt(id).fortune ?? 0;
    expect(avant).toBeGreaterThan(0);
    useGame.getState().roundStartPromote(id);
    expect(cbt(id).fortune).toBe(avant - 1);
    useGame.setState({ pendingRoundStart: null });
    fin();
    expect(grp(id).fortune).toBe(avant - 1);
  });

  it('un effet en Rounds posé hors combat entre dans le combat avec ses Rounds restants (LDB 46 l.93)', () => {
    const h = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    const base = effectiveChar(h, 'capacite-de-tir');
    h.activeEffects = [{ label: 'Sort', char: 'capacite-de-tir', bonus: 10, duration: { scale: 'rounds', left: 3 } }];
    useGame.setState({ battle: null, party: [h], pendingCascade: null, pendingRoundStart: null, journal: [] });
    useGame.getState().startScene(testScene());
    useGame.getState().startCombat('enc-mutants', undefined, { noSurprise: true });
    vi.clearAllTimers();
    expect(cbt(h.id).activeEffects?.map((e) => e.duration)).toEqual([{ scale: 'rounds', left: 3 }]);
    expect(effectiveChar(cbt(h.id), 'capacite-de-tir')).toBe(base + 10);
  });

  it('un effet d’horloge posé hors combat (Exposition au froid) entre dans le combat', () => {
    const h = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    const base = effectiveChar(h, 'capacite-de-tir');
    applyExposureFailure(h, 1, battleRng(), 'froid');
    expect(effectiveChar(h, 'capacite-de-tir')).toBeLessThan(base);
    useGame.setState({ battle: null, party: [h], pendingCascade: null, pendingRoundStart: null, journal: [] });
    useGame.getState().startScene(testScene());
    useGame.getState().startCombat('enc-mutants', undefined, { noSurprise: true });
    vi.clearAllTimers();
    expect(effectiveChar(cbt(h.id), 'capacite-de-tir')).toBe(effectiveChar(grp(h.id), 'capacite-de-tir'));
    expect(effectiveChar(cbt(h.id), 'capacite-de-tir')).toBeLessThan(base);
  });

  it('l’entrée en rencontre pose les valeurs d’entrée et ne garde que les États persistants', () => {
    const h = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    h.advantage = 3; h.tookCriticalThisFight = true; h.woundDressed = true; h.roundsAtZero = 2; h.soinRencontreUtilise = true;
    h.engagedWith = ['x']; h.conditions = [{ id: 'au-sol', value: 1 }, { id: 'extenue', value: 1 }] as never;
    const c = entreeEnRencontre(h);
    expect(c).toMatchObject({ advantage: 0, tookCriticalThisFight: false, woundDressed: false, roundsAtZero: 0, soinRencontreUtilise: false, engagedWith: [] });
    expect([isPersistentCondition('au-sol'), isPersistentCondition('extenue')]).toEqual([false, true]);
    expect(c.conditions.map((x) => x.id)).toEqual(['extenue']);
    expect(partages(h, c)).toEqual([]);
  });

  it('le retour ne reporte que les champs classés comme sortant du combat', () => {
    const h = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    const sortants = Object.entries(REPORT_DE_COMBATTANT).filter(([, r]) => r.sort !== false).map(([k]) => k);
    expect(Object.keys(carryOverState(h)).every((k) => sortants.includes(k))).toBe(true);
    expect(carryOverState({ ...h, pos: { x: 9, y: 9 } })).not.toHaveProperty('pos');
  });

  it('devtools.disease en phase active laisse le flux RNG du corps de base', () => {
    let id = combat(); seedBattleRng(99);
    buildApi().disease(id, 'vers-de-carie', { phase: 'active' });
    const nouv = tirages();
    expect(cbt(id).diseases?.find((d) => d.id === 'vers-de-carie')?.phase).toBe('active');
    id = combat(); seedBattleRng(99);
    const c = cbt(id); const dz = contractDisease('vers-de-carie', battleRng())!;
    c.diseases = [...(c.diseases ?? []), dz];
    tickDisease(c, dz.minutesLeft, battleRng(), () => {});
    expect(nouv).toEqual(tirages());
  });

  it('touchActors est la seule couture qui recopie la file de combat pour la re-rendre', () => {
    const forme = /combatants:\s*\[\.\.\.[\w!.()]*combatants\]/;
    const sites = readCorpus(['src'])
      .filter(({ rel }) => rel !== 'src/state/combatOrParty.ts')
      .flatMap(({ rel, text }) => text.split('\n').map((l, i) => [`${rel}:${i + 1}`, l] as const))
      .filter(([, l]) => forme.test(l))
      .map(([site]) => site);
    expect(sites).toEqual([]);
  });

  it('touchActors notifie la file de combat que lit le jeu', () => {
    const id = combat();
    const s = useGame.getState();
    const patch = touchActors(s);
    expect(patch.battle!.combatants).not.toBe(s.battle!.combatants);
    expect(inBattleId(patch.battle!, id)).toBe(cbt(id));
  });
});

describe('dépenses de PX refusées en combat (LDB 05 l.907)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  /** Les dépenses de PX : chaque export de `partyFlow.ts` qui passe par la couture `depenserPx`. */
  const derivees = (): string[] => {
    const src = readFileSync(join(__dirname, 'partyFlow.ts'), 'utf-8');
    return src.split(/\nexport function /).slice(1)
      .filter((corps) => corps.includes('depenserPx(get'))
      .map((corps) => corps.slice(0, corps.indexOf('(')))
      .filter((nom) => nom !== 'depenserPx');
  };

  /** Une dépense valide pour `c` (lu là où le jeu lit), hors du refus. */
  const DEPENSES: Record<string, (c: Combatant) => void> = {
    buyCharAdvance: (c) => useGame.getState().buyCharAdvance(c.id, 'capacite-de-combat'),
    buySkillAdvance: (c) => { const sk = buildAdvancementView(c).skills.find((x) => x.known)!; useGame.getState().buySkillAdvance(c.id, sk.skillId, sk.spec); },
    buyTalent: (c) => { const ta = buildAdvancementView(c).talents.find((x) => x.talentId && !x.maxReached)!; useGame.getState().buyTalent(c.id, ta.talentId!, ta.spec); },
    buySpell: (c) => useGame.getState().buySpell(c.id, learnableSpells(c).find((x) => x.cost > 0)!.spell.id),
    trainProsthesis: (c) => useGame.getState().trainProsthesis(c.id, c.items!.find((i) => i.trappingId === 'fausse-jambe')!.uid),
    changeCareer: (c) => useGame.getState().changeCareer(c.id, careers.find((x) => x.id !== c.career)!.id, 1),
  };

  const heros = (): Combatant => {
    const h = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    h.talents.push({ talentId: 'magie-mineure', times: 1 });
    h.spells = [];
    h.spells = learnableSpells(h).slice(0, 10).map((x) => x.spell.id); // au-delà des sorts inclus au Talent
    h.items = [...(h.items ?? []), { ...itemFromTrappingById('fausse-jambe')!, equipped: true }];
    h.xp = 5000;
    return h;
  };

  /** La ligne `i` est-elle dans le corps d'un appel `depenserPx(get, …)` ? Remonte jusqu'à l'appel, sans
   *  franchir une déclaration de fonction. */
  const dansLaCouture = (lignes: readonly string[], i: number): boolean => {
    for (let j = i; j >= 0; j--) {
      if (lignes[j].includes('depenserPx(get')) return true;
      if (/^(export )?(async )?function /.test(lignes[j])) return false;
    }
    return false;
  };
  const sansCommentaire = (l: string) => l.replace(/\s*\/\/.*$/, '').trim();

  /** Classement TOTAL des écritures de `xp` (forme `.xp =`, `.xp -=`, `.xp +=` ou clé `xp: `) de `src`.
   *  `depense` : doit vivre dans un appel `depenserPx` ; `moteur` : la dépense pure du moteur, que seul un
   *  flux passé à `depenserPx` importe (test suivant). Clé : `fichier | ligne sans commentaire`. */
  const ECRITURES_XP: Record<string, 'depense' | 'moteur' | 'gain' | 'creation' | 'fixture' | 'type' | 'lecture'> = {
    'src/data/index.ts | xp: number;': 'type',
    'src/data/schemas/defs/spells.ts | xp: z.number(),': 'type',
    'src/state/advancement.ts | xp: number;': 'type',
    'src/state/pendings.ts | xp: number;': 'type',
    'src/ui/creator/CreatorDice.tsx | xp: number;': 'type',
    'src/engine/persistence.ts | xp: PERSISTE, charAdvances: PERSISTE, careerLevel: PERSISTE, careerSlotChoices: PERSISTE,': 'type',
    'src/state/advancement.ts | xp: hero.xp ?? 0,': 'lecture',
    'src/state/combatFlow.ts | xp: Math.max(0, (get().party[0]?.xp ?? 0) - c.xpAvant),': 'lecture',
    'src/state/devtools.ts | xp: (amount?: number) => {': 'lecture',
    'src/state/devtools.ts | return g().party.map((h) => ({ id: h.id, label: h.label, xp: actorIn(g(), h.id)?.xp ?? 0 }));': 'lecture',
    'src/engine/character.ts | xp: opts.xpBonus ?? 0,': 'creation',
    'src/scenes/test-scenarios/magie.ts | sorc.xp = 300;': 'fixture',
    'src/scenes/test-scenarios/voyage.ts | aldric.xp = 300;': 'fixture',
    'src/engine/advancement.ts | hero.xp = (hero.xp ?? 0) - cost;': 'moteur',
    'src/engine/advancement.ts | hero.xp = (hero.xp ?? 0) - v.cost;': 'moteur',
    'src/state/combatEffects.ts | env.set((s: GameState) => ecrireActeur(s, idsDuGroupe(s), (h) => ({ ...h, xp: (h.xp ?? 0) + e.amount })));': 'gain',
    'src/state/partyFlow.ts | clone.xp = (clone.xp ?? 0) + amount;': 'gain',
    "src/state/partyFlow.ts | if (xp) { clone.xp = (clone.xp ?? 0) + xp; siennes.push(t('pf.ambitionXp', { name: clone.label, xp })); }": 'gain',
    'src/state/partyFlow.ts | clone.xp = (clone.xp ?? 0) - cost;': 'depense',
    'src/state/partyFlow.ts | clone.xp = (clone.xp ?? 0) - tier.px;': 'depense',
    'src/state/interludeFlow.ts | depenserPx(get, set, h.id, (lu) => ({ ...lu, xp: Math.max(0, (lu.xp ?? 0) - (pa.xpCost ?? 0)) }));': 'depense',
  };

  it('toute écriture de PX de src est classée, et chaque dépense vit dans un appel depenserPx', () => {
    const ecriture = /\.xp\s*[-+]?=(?!=)|\bxp:\s/;
    const sites = readCorpus(['src']).flatMap(({ rel, text }) => {
      const lignes = text.split('\n');
      return lignes.flatMap((l, i) => (ecriture.test(l) ? [{ cle: `${rel} | ${sansCommentaire(l)}`, site: `${rel}:${i + 1}`, couture: dansLaCouture(lignes, i) }] : []));
    });
    expect(sites.filter((x) => !(x.cle in ECRITURES_XP)).map((x) => `${x.site} — ${x.cle}`)).toEqual([]);
    expect(sites.filter((x) => ECRITURES_XP[x.cle] === 'depense' && !x.couture).map((x) => x.site)).toEqual([]);
    expect(Object.keys(ECRITURES_XP).filter((cle) => !sites.some((x) => x.cle === cle))).toEqual([]);
  });

  it('les dépenses du moteur ne s’importent, sous tout alias, que pour être appelées dans un appel depenserPx', () => {
    const MOTEUR = 'src/engine/advancement.ts';
    const corpus = readCorpus(['src']);
    // Les dépenses du moteur : ses exports dont le corps écrit `xp`.
    const texte = corpus.find((f) => f.rel === MOTEUR)!.text;
    const depenses = texte.split(/\nexport function /).slice(1)
      .filter((corps) => /\.xp\s*[-+]?=(?!=)/.test(corps.slice(0, corps.search(/\n}\n/))))
      .map((corps) => corps.slice(0, corps.indexOf('(')));
    expect(depenses.length).toBeGreaterThan(0);
    const fautes: string[] = [];
    const importeurs = new Set<string>();
    for (const { rel, text } of corpus) {
      if (rel === MOTEUR) continue;
      const resout = (spec: string) => posix.normalize(posix.join(posix.dirname(rel), spec)).replace(/\.ts$/, '') === MOTEUR.replace(/\.ts$/, '');
      for (const m of text.matchAll(/import\s+\*\s+as\s+(\w+)\s+from\s+['"]([^'"]+)['"]/g)) if (resout(m[2])) fautes.push(`${rel} — import * as ${m[1]}`);
      const locaux: string[] = [];
      for (const m of text.matchAll(/(?:import|export)\s+(?:type\s+)?\{([^}]*)\}\s*from\s+['"]([^'"]+)['"]/g)) {
        if (!resout(m[2])) continue;
        for (const brut of m[1].split(',')) {
          const [nom, alias] = brut.trim().split(/\s+as\s+/);
          if (!depenses.includes(nom)) continue;
          if (m[0].startsWith('export')) fautes.push(`${rel} — ré-export de ${nom}`);
          else { locaux.push(alias ?? nom); importeurs.add(rel); }
        }
      }
      const lignes = text.split('\n');
      lignes.forEach((l, i) => {
        if (locaux.some((x) => new RegExp(`(?<![\\w.])${x}\\(`).test(l)) && !dansLaCouture(lignes, i)) fautes.push(`${rel}:${i + 1}`);
      });
    }
    expect(importeurs.size).toBeGreaterThan(0);
    expect(fautes).toEqual([]);
  });

  it('la table couvre exactement les dépenses qui passent par la couture', () => {
    expect(Object.keys(DEPENSES).sort()).toEqual(derivees().sort());
  });

  for (const [nom, depense] of Object.entries(DEPENSES)) {
    it(`${nom} : refusée en combat (rien ne change, raison au journal), passe hors combat`, () => {
      const h = heros();
      useGame.setState({ battle: null, party: [h], pendingCascade: null, pendingRoundStart: null, journal: [] });
      useGame.getState().startScene(testScene());
      useGame.getState().startCombat('enc-mutants', undefined, { noSurprise: true });
      vi.clearAllTimers();
      const avant = structuredClone(cbt(h.id));
      depense(cbt(h.id));
      expect(cbt(h.id)).toEqual(avant);
      expect(useGame.getState().journal.slice(-1)).toEqual([t('pf.xpInCombat')]);

      useGame.setState({ battle: null, party: [{ ...heros(), id: h.id }], journal: [] });
      depense(grp(h.id));
      expect(grp(h.id).xp).toBeLessThan(5000);
    });
  }
});

describe('la composition du groupe ne change pas en combat (#2312)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  it('ajout, retrait et remplacement — les actions que l’hôte joue pour une intention d’invité — sont refusés', () => {
    const id = combat();
    const avant = structuredClone(useGame.getState().party);
    const autre = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'Autre', seed: 2 });
    const s = useGame.getState();
    s.partyAddHero(autre);
    s.partyRemoveHero(id);
    s.partyReplaceHero(id, { ...autre, id });
    expect(useGame.getState().party).toEqual(avant);
    expect(useGame.getState().journal.slice(-3)).toEqual([t('pf.partyInCombat'), t('pf.partyInCombat'), t('pf.partyInCombat')]);
  });

  it('hors combat, la composition change', () => {
    const id = combat();
    useGame.setState({ battle: null });
    useGame.getState().partyRemoveHero(id);
    expect(useGame.getState().party.some((h) => h.id === id)).toBe(false);
  });
});

describe('markActed relit l’état vivant (battlePickup, #2312)', () => {
  for (const eff of [{ type: 'giveTrapping', trappingId: 'tromblon' }, { type: 'giveMoney', montant: { gold: 1 } }]) {
    it(`${eff.type} : l’approche en attente est scellée sur l’objet vivant`, () => {
      const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'A', seed: 3 });
      hero.items = hero.items ?? [];
      hero.pos = { x: 0, y: 0 };
      const scene = emptyScene(8, 8);
      scene.id = 'pickup-scene';
      scene.entities.push({ id: 'hs', kind: 'heroStart', pos: { x: 0, y: 0 } } as never);
      scene.entities.push({ id: 'corps', kind: 'prop', pos: { x: 1, y: 0 }, label: 'Cocher',
        usable: { actions: [{ id: 'fouiller', unique: true, flow: flowFromEffects([eff as never]) }] } } as never);
      const bh: Combatant = structuredClone(hero);
      bh.approachMoves = [{ from: { x: 0, y: 3 }, to: { x: 0, y: 0 } }];
      const battle = { combatants: [bh], order: [bh.id], turn: 0, round: 1, action: null, selectedSpellId: null,
        reachable: new Map(), movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null } as unknown as BattleState;
      useGame.setState({ party: [hero], scene, mode: 'battle', battle, flags: {} });
      useGame.getState().battlePickup('corps', 'fouiller:eff:0');
      const vivant = cbt(bh.id);
      expect(vivant).not.toBe(bh);
      expect(useGame.getState().battle!.acted).toBe(true);
      expect(vivant.approachMoves).toBeUndefined();
    });
  }
});
