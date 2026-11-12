/**
 * Effets mécaniques des consommables — suite comportementale sur la DONNÉE RÉELLE (#50).
 * Couvre les drogues (LDB 71), herbes/potions (LDB 72) et herbes MSRC 2, au format FLOW :
 *  - flows purement `effet` → aplatis (`flattenFlow`) et appliqués par `applyOps` (moteur pur) ;
 *  - flows à nœud `test`/`delayed` → assertions de STRUCTURE (le runtime cadence-aware est couvert
 *    par `noyau/consumable-flow.hors-store.test.ts`).
 */
import { idsDeTest } from './idsDeTest.testkit';
import { describe, it, expect } from 'vitest';
import { Combatant } from './types';
import { itemFromTrappingById } from './items';
import { applyOps } from './ops';
import { flattenFlow, type Flow, type EffectOp } from './flowCore';
import { consumableOps, consommableDe } from './consumables';
import { MINUTES_PER_DAY } from './clock';
import { testValue } from './skills';
import type { Disease } from './disease';
import { desDuTest } from './dice.testkit';
import { blessuresSurLeProfil, blessuresDeBase } from './combattantDeTest.testkit';

/** Combatant minimal suffisant pour applyOps (blessures, états, maladies). */
const makeTarget = (over: Partial<Combatant> = {}): Combatant =>
  (blessuresSurLeProfil({
    name: 'X',
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 35, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
    wounds: blessuresDeBase(20, 10),
    conditions: [],
    activeEffects: [],
    diseases: [],
    skills: [],
    talents: [],
    traits: [],
    items: [],
    weapons: [],
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    ...over,
  })) as unknown as Combatant;

/** Maladie active synthétique (phase active, durée N jours). */
const activeDisease = (id: string, durationDays: number): Disease => ({
  id: id,
  symptoms: [],
  phase: 'active',
  minutesLeft: durationDays * MINUTES_PER_DAY,
  durationMinutes: durationDays * MINUTES_PER_DAY,
});

/** Applique le Flow d'un consommable SANS nœud test (effet/si seulement) au buveur — voie moteur pur. */
function drinkPure(c: Combatant, id: string): void {
  const flow = consommableDe(itemFromTrappingById(id, idsDeTest)!)!;
  for (const leaf of flattenFlow(flow, { flags: {}, gameTime: 0, party: [c], target: view(c), caster: view(c) })) {
    applyOps(c, (leaf as EffectOp).ops, { idNeuf: idsDeTest, rng: desDuTest, caster: c, now: 0 });
  }
}
/** ActorView minimal pour les Conditions `compare`/`has` des flows de consommable. */
function view(c: Combatant) {
  return {
    id: c.id ?? 'x', woundsCurrent: c.wounds.current, woundsMax: c.wounds.max, size: 3, advantage: 0,
    camp: 'groupe' as const, groups: c.groups ?? [], talents: [], traits: [], conditions: {},
    chars: Object.fromEntries(Object.entries(c.characteristics)) as never,
  };
}

/** Branche `alors` du Flow onHit (patron Venin) d'un poison-enduit : `if[…] → test → echec`. */
type VeninThen = {
  test: { skill?: string; difficulty?: string; gate?: unknown; onlyGroups?: string[] };
  echec: { effet: { ops: { op: string; id?: string; value?: number }[] } };
};
const onHitVeninThen = (id: string): VeninThen => {
  const aug = consumableOps(consommableDe(itemFromTrappingById(id, idsDeTest)!)).find((o) => o.op === 'augmentWeapon') as
    | { op: 'augmentWeapon'; onHitEffects?: { flow: { alors: VeninThen } }[] }
    | undefined;
  return aug!.onHitEffects![0].flow.alors;
};

// ── Poisons LDB 71 (p.308) ────────────────────────────────────────────────────

describe('brise-coeur (LDB 71 l.22) — poison ingéré, Test au boire', () => {
  it("« inflige 4 États Empoisonné. Combattu avec un Test de Résistance Complexe (-10) » : test → fail → 4 pions", () => {
    const f = consommableDe(itemFromTrappingById('brise-coeur', idsDeTest)!)! as Extract<Flow, { kind: 'test' }>;
    expect(f.kind).toBe('test');
    expect(f.test.difficulty).toBe('complexe');
    expect(consumableOps(f.echec)).toEqual([{ op: 'condition', id: { id: 'empoisonne' }, value: 4 }]);
    expect(consumableOps(f.reussite)).toEqual([]);
  });
});

describe('lotus-noir (LDB 71 l.31) — enduit arme, pas ingéré', () => {
  it("a un augmentWeapon : « utilisée pour empoisonner les lames »", () => {
    expect(consumableOps(consommableDe(itemFromTrappingById('lotus-noir', idsDeTest)!)).some((o) => o.op === 'augmentWeapon')).toBe(true);
  });
  it("onHit = Test de Résistance Complexe (-10) : « Combattu avec un Test de Résistance Complexe (-10) »", () => {
    const then = onHitVeninThen('lotus-noir');
    expect(then.test.skill).toEqual({ id: 'resistance' });
    expect(then.test.difficulty).toBe('complexe');
    expect(then.test.gate).toEqual({ kind: 'not', of: { kind: 'has', who: 'target', what: 'immunity', value: 'poison' } }); // LDB 85 l.174
  });
  it("échec du Test → 2 états Empoisonné : « subissent immédiatement 2 États Empoisonnés »", () => {
    const then = onHitVeninThen('lotus-noir');
    const condOp = then.echec.effet.ops.find((o) => o.op === 'condition');
    expect(condOp?.id).toEqual({ id: 'empoisonne' });
    expect(condOp?.value).toBe(2);
  });
});

// ── Drogues LDB 71 (#50 — les 6 sans mécanique) ──────────────────────────────

describe('bave (LDB 71 l.18)', () => {
  it("Test d'Endurance Très difficile (-30) au boire ; échec → narrative verbatim (rien d'inventé au-delà du texte)", () => {
    const f = consommableDe(itemFromTrappingById('bave', idsDeTest)!)! as Extract<Flow, { kind: 'test' }>;
    expect(f.kind).toBe('test');
    expect(f.test.characteristic).toBe('endurance');
    expect(f.test.difficulty).toBe('tresDifficile');
    expect(consumableOps(f.echec)).toEqual([{ op: 'narrative', text: 'perdu dans un fantasme très réaliste, que le MJ doit gérer. Durée : 1d10 minutes.' }]);
  });
});

describe('bonnet-de-fou (LDB 71 l.20)', () => {
  it('« +10 en Force, +4 Blessures et le Talent Frénésie » + perte 1d10 PB à la dissipation (delayed afterDuration)', () => {
    const ops = consumableOps(consommableDe(itemFromTrappingById('bonnet-de-fou', idsDeTest)!));
    expect(ops).toContainEqual({ op: 'charMod', characteristic: 'force', mod: 10 });
    expect(ops).toContainEqual({ op: 'attrMod', attr: 'wounds', mod: 4, auTotal: true }); // #3060
    expect(ops).toContainEqual({ op: 'grantTalent', talent: { id: 'frenesie' } });
    const delayed = ops.find((o) => o.op === 'delayed') as Extract<import('./ops').GameOp, { op: 'delayed' }>;
    expect(delayed.afterDuration).toBe(true);
    expect(delayed.ops).toEqual([{ op: 'wounds', amount: { dice: { n: 1, sides: 10 } }, ignoreTB: true, ignoreAP: true }]);
  });
  it('« Tous ceux qui ne sont pas des peaux-vertes » : Test de Résistance (+0) gaté exceptGroups → Infection mineure', () => {
    const f = consommableDe(itemFromTrappingById('bonnet-de-fou', idsDeTest)!)! as Extract<Flow, { kind: 'sequence' }>;
    const test = f.etapes.find((s) => s.kind === 'test') as Extract<Flow, { kind: 'test' }>;
    expect(test.test.exceptGroups).toEqual(['peau-verte']);
    expect(test.test.difficulty).toBe('intermediaire');
    expect(consumableOps(test.echec)).toEqual([{ op: 'contractDisease', disease: 'infection-mineure' }]);
  });
  it('Durée « mâché plus 2d10 minutes » → consumableDuration 2d10 min (borne basse RAW, mastication non modélisée)', () => {
    expect(itemFromTrappingById('bonnet-de-fou', idsDeTest)!.consumableDuration).toEqual({ minutes: { dice: { n: 2, sides: 10 } } });
  });
});

describe('delice-de-ranald (LDB 71 l.24)', () => {
  it('+1 M, +10 F/E/Ag/CC pendant 3 h ; puis −2 M, −20 CC/E/F/Ag (delayed afterHours 3, pénalité 21 h — « Durée : 1 jour » = l\'épisode)', () => {
    const ops = consumableOps(consommableDe(itemFromTrappingById('delice-de-ranald', idsDeTest)!));
    expect(ops).toContainEqual({ op: 'moveMod', mod: 1 });
    for (const char of ['force', 'endurance', 'agilite', 'capacite-de-combat']) expect(ops).toContainEqual({ op: 'charMod', characteristic: char, mod: 10 });
    const delayed = ops.find((o) => o.op === 'delayed') as Extract<import('./ops').GameOp, { op: 'delayed' }>;
    expect(delayed.afterHours).toBe(3);
    expect(delayed.forHours).toBe(21);
    expect(delayed.ops).toContainEqual({ op: 'moveMod', mod: -2 });
    for (const char of ['capacite-de-combat', 'endurance', 'force', 'agilite']) expect(delayed.ops).toContainEqual({ op: 'charMod', characteristic: char, mod: -20 });
    expect(itemFromTrappingById('delice-de-ranald', idsDeTest)!.consumableDuration).toEqual({ hours: 3 });
  });
});

describe('fleur-de-lune (LDB 71 l.26-29)', () => {
  it('Elfes : « +30 à tous les Tests associés pour résister à la [Peste noire] » (branche if has group elfe)', () => {
    const f = consommableDe(itemFromTrappingById('fleur-de-lune', idsDeTest)!)! as Extract<Flow, { kind: 'si' }>;
    expect(f.condition).toEqual({ kind: 'has', who: 'target', what: 'group', value: 'elfe' });
    expect(consumableOps(f.alors)).toEqual([{ op: 'diseaseTestMod', diseases: ['peste-noire'], amount: 30 }]);
  });
  it('autres races : Test de FM Très difficile — raté → Inconscient (1d10+5 h) ; réussi → +20 Calme + 1 Exténué', () => {
    const f = consommableDe(itemFromTrappingById('fleur-de-lune', idsDeTest)!)! as Extract<Flow, { kind: 'si' }>;
    const test = f.sinon as Extract<Flow, { kind: 'test' }>;
    expect(test.test.characteristic).toBe('force-mentale');
    expect(test.test.difficulty).toBe('tresDifficile');
    expect(consumableOps(test.echec)).toEqual([{ op: 'condition', id: { id: 'inconscient' }, durationHours: { dice: { n: 1, sides: 10, plus: 5 } } }]);
    expect(consumableOps(test.reussite)).toEqual([
      { op: 'skillMod', skill: { id: 'calme' }, mod: 20 },
      { op: 'condition', id: { id: 'extenue' }, value: 1 },
    ]);
  });
});

describe('mystracine (LDB 71 l.33) — testMod char-qualifiés (ext. I) appliqués et LUS par testValue', () => {
  it('« +10 aux Tests d\'Endurance et de Force Mentale, mais une pénalité de -10 aux Tests d\'Agilité, d\'Initiative et d\'Intelligence »', () => {
    const c = makeTarget();
    drinkPure(c, 'mystracine');
    expect(testValue(c, { characteristic: 'endurance' })).toBe(35 + 10);
    expect(testValue(c, { characteristic: 'force-mentale' })).toBe(30 + 10);
    expect(testValue(c, { characteristic: 'agilite' })).toBe(30 - 10);
    expect(testValue(c, { characteristic: 'initiative' })).toBe(30 - 10);
    expect(testValue(c, { characteristic: 'intelligence' })).toBe(30 - 10);
    expect(testValue(c, { characteristic: 'force' })).toBe(30); // les autres caracs ne bougent pas
  });
  it('Durée « 1d10 x 10 minutes » (Formula times)', () => {
    expect(itemFromTrappingById('mystracine', idsDeTest)!.consumableDuration).toEqual({ minutes: { times: { of: { dice: { n: 1, sides: 10 } }, factor: 10 } } });
  });
});

// #193 — Genou démis (LDB/AA) : le testMod de récupération scopé `movementOnly` ne pénalise QUE les
// Tests classés « déplacement » (SkillData.movement), pas les autres Tests d'Agilité.
describe("testMod.movementOnly — portée « Tests impliquant cette jambe » (#193)", () => {
  it('pénalise un Test de déplacement (Athlétisme, movement:true) mais pas un autre Test d’Agilité (Discrétion)', () => {
    const c = makeTarget();
    c.activeEffects = [{ label: 'Genou démis (récupération)', bonus: 0, duration: { scale: 'permanent' }, testMod: -10, testModChar: 'agilite', testModMovementOnly: true }];
    expect(testValue(c, { skill: { id: 'athletisme' }, characteristic: 'agilite' })).toBe(30 - 10);
    expect(testValue(c, { skill: { id: 'discretion' }, characteristic: 'agilite' })).toBe(30); // Discrétion n'est pas classée « déplacement »
  });
});

describe('racine-de-mandragore (LDB 71 l.35)', () => {
  it('« le Mouvement est réduit de moitié » + « +20 aux Tests de Calme » + gate FM par Round (testDAgir)', () => {
    const c = makeTarget();
    drinkPure(c, 'racine-de-mandragore');
    expect(c.activeEffects!.some((e) => e.passive?.some((op) => op.op === 'moveScale' && op.num === 1 && op.den === 2))).toBe(true);
    expect(c.activeEffects!.some((e) => e.passive?.some((op) => op.op === 'skillMod' && op.skill.id === 'calme' && op.mod === 20))).toBe(true);
    expect(c.activeEffects!.some((e) => e.testDAgir?.characteristic === 'force-mentale')).toBe(true);
  });
});

// ── Herbes LDB 72 (p.309) ─────────────────────────────────────────────────────

describe('belladone (LDB 72 l.18)', () => {
  it('Test de Résistance (défaut Intermédiaire) ; raté → sommeil différé 150 min, Inconscient 1d10+4 h (États d\'horloge)', () => {
    const f = consommableDe(itemFromTrappingById('belladone', idsDeTest)!)! as Extract<Flow, { kind: 'test' }>;
    expect(f.kind).toBe('test');
    expect(f.test.skill).toEqual({ id: 'resistance' });
    const delayed = consumableOps(f.echec).find((o) => o.op === 'delayed') as Extract<import('./ops').GameOp, { op: 'delayed' }>;
    expect(delayed.afterMinutes).toBe(150); // « au bout de 2-3 heures » → milieu de fourchette (arbitrage)
    expect(delayed.ops).toEqual([{ op: 'condition', id: { id: 'inconscient' }, durationHours: { dice: { n: 1, sides: 10, plus: 4 } } }]);
  });
});

describe('cataplasme-de-guerison (LDB 72 l.20) — prévention infection', () => {
  it("pose woundDressed : « Vous ne subissez aucune Infection mineure issue d'une Blessure Critique »", () => {
    const c = makeTarget();
    drinkPure(c, 'cataplasme-de-guerison');
    expect(c.woundDressed).toBe(true);
  });
});

describe('racine-de-terre (LDB 72 l.28) — suppressSymptom + diseaseTestMod', () => {
  it('« annuler les effets de bubons » + « +10 à tous les Tests concernant la maladie » (scopé Peste noire)', () => {
    const c = makeTarget();
    drinkPure(c, 'racine-de-terre');
    expect(c.activeEffects!.some((e) => e.suppressedSource?.category === 'symptoms' && e.suppressedSource.id === 'bubons')).toBe(true);
    expect(c.activeEffects!.some((e) => e.diseaseTestMod?.amount === 10 && e.diseaseTestMod.diseases?.includes('peste-noire'))).toBe(true);
  });
});

describe('tonique-digestif (LDB 72 l.32)', () => {
  it('« +20 aux Tests pour se remettre … de la Courante galopante ou du Flux sanglant »', () => {
    const c = makeTarget();
    drinkPure(c, 'tonique-digestif');
    const fx = c.activeEffects!.find((e) => e.diseaseTestMod);
    expect(fx?.diseaseTestMod).toEqual({ diseases: ['courante-galopante', 'flux-sanglant'], amount: 20 });
  });
});

// ── Herbes MSRC 2 ───────────────────────────────────────────────────────────

describe('gesundheit (MSRC 04 l.184-186) — Test de Résistance Accessible (+20) puis −1 jour PAR DR obtenu (#458)', () => {
  it('Test de Résistance Accessible (+20) — pas d\'effet inconditionnel (défaut #46 corrigé)', () => {
    const f = consommableDe(itemFromTrappingById('gesundheit', idsDeTest)!)! as Extract<Flow, { kind: 'test' }>;
    expect(f.kind).toBe('test');
    expect(f.test.skill).toEqual({ id: 'resistance' });
    expect(f.test.difficulty).toBe('accessible');
  });
  it('succès → reduceDiseaseDays SCOPÉ blessure-purulente, échelle daysPerSL 1/DR — jamais fixe', () => {
    const f = consommableDe(itemFromTrappingById('gesundheit', idsDeTest)!)! as Extract<Flow, { kind: 'test' }>;
    expect(consumableOps(f.reussite)).toEqual([
      { op: 'reduceDiseaseDays', days: 0, daysPerSL: { every: 1, amount: 1 }, disease: 'blessure-purulente' },
    ]);
  });
  it('échec → aucune réduction (le Test n\'a pas été réussi)', () => {
    const f = consommableDe(itemFromTrappingById('gesundheit', idsDeTest)!)! as Extract<Flow, { kind: 'test' }>;
    expect(consumableOps(f.echec)).toEqual([]);
  });
});

describe('racine-des-tombes (MSRC 04 l.221-229) — enduit anti-mort-vivant + cataplasme', () => {
  it("a un augmentWeapon : « Étalée sur une arme, la sève est nocive pour les Mort-vivants »", () => {
    expect(consumableOps(consommableDe(itemFromTrappingById('racine-des-tombes', idsDeTest)!)).some((o) => o.op === 'augmentWeapon')).toBe(true);
  });
  it("onHit = Test de Résistance Complexe (-10) gaté Mort-vivant", () => {
    const then = onHitVeninThen('racine-des-tombes');
    expect(then.test.skill).toEqual({ id: 'resistance' });
    expect(then.test.difficulty).toBe('complexe');
    expect(then.test.onlyGroups).toContain('mort-vivant');
  });
  it('cataplasme : « bonus de +20 à tous les Tests » pour résister à la Blessure Purulente, pendant la journée', () => {
    const ops = consumableOps(consommableDe(itemFromTrappingById('racine-des-tombes', idsDeTest)!));
    expect(ops).toContainEqual({ op: 'diseaseTestMod', diseases: ['blessure-purulente'], amount: 20 });
    expect(itemFromTrappingById('racine-des-tombes', idsDeTest)!.consumableDuration).toEqual({ days: 1 });
  });
});

describe('rouille-mouchetee (MSRC 04 l.239-241) — « Chaque dose réduit la durée de la maladie de 1d10 jours » + bonus continu (#458)', () => {
  it('réduit la Vérole du Tanneur de 1 à 10 jours (dé tiré à l\'application), jamais une autre maladie', () => {
    const other = activeDisease('peste-noire', 15);
    const target = activeDisease('verole-du-tanneur', 15);
    const c = makeTarget({ diseases: [other, target] as Combatant['diseases'] });
    drinkPure(c, 'rouille-mouchetee');
    expect(other.minutesLeft).toBe(15 * MINUTES_PER_DAY);
    const reducedDays = 15 - target.minutesLeft / MINUTES_PER_DAY;
    expect(reducedDays).toBeGreaterThanOrEqual(1);
    expect(reducedDays).toBeLessThanOrEqual(10);
  });
  it('« bonus de +10 à tous les Tests en lien avec la maladie » tant que la dose quotidienne est maintenue', () => {
    const ops = consumableOps(consommableDe(itemFromTrappingById('rouille-mouchetee', idsDeTest)!));
    expect(ops).toContainEqual({ op: 'diseaseTestMod', diseases: ['verole-du-tanneur'], amount: 10 });
    expect(itemFromTrappingById('rouille-mouchetee', idsDeTest)!.consumableDuration).toEqual({ days: 1 });
  });
});
