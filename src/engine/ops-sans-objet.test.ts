/**
 * `opSansObjet` ≡ « `applyOps` change-t-il la fiche ? » sur la CLASSE des ops de retrait et de pose (état psychologique,
 * forme) : sur chaque fiche de
 * la matrice, une op est sans objet exactement quand l'appliquer ne change rien, et `applyOps` ne produit
 * alors rien, ni effet ni ligne ; la raison ne se dit qu'au verdict d'un geste délibéré. Un raccourcissement
 * de maladie n'allonge jamais une maladie. LDB 16, LDB 18 l.15, LDB 18 l.308-311, LDB 20, LDB 40 l.36, LDB 72 l.20,
 * ADE II 09 l.33, MSRC 04 l.184-186
 */
import { idsDeTest } from './idsDeTest.testkit';
import { describe, it, expect } from 'vitest';
import { applyOps, opSansObjet, type GameOp, type OpsCtx } from './ops';
import { createHero } from './character';
import { addCondition } from './conditions';
import { makeRNG } from './dice';
import { MINUTES_PER_DAY } from './clock';
import { ciblePsy } from './psych/ciblage';
import { opPsy } from './psych/opsPsy';
import type { Combatant, EffectSource } from './types';

const SOURCE: EffectSource = { kind: 'activite', id: 'convalescence' };
const ctx = (): OpsCtx => ({ idNeuf: idsDeTest, rng: makeRNG(1), source: SOURCE });

/** Une forme de test : son `transform` et son `endTransform`. */
const PRENDRE_LA_FORME: GameOp = { op: 'transform', tag: 'forme-de-test', ops: [{ op: 'charMod', characteristic: 'force', mod: 10 }] };
const QUITTER_LA_FORME: GameOp = { op: 'endTransform', tag: 'forme-de-test' };
/** Le re-test raté d'une Haine déjà subie (`psychBranchOps`). LDB 21 l.39 */
const RETEST_DE_HAINE = opPsy.pose('haine', { cible: ciblePsy.groupe('elfe'), active: true, fromTest: true, lastTestRound: 3 });

const maladie = (minutesLeft: number) => ({ id: 'infection-mineure', symptoms: [], phase: 'active' as const, minutesLeft, durationMinutes: 10 * MINUTES_PER_DAY });

/** Les fiches de la matrice, chacune posée par la couture de son fait (États par `addCondition`, Trait
 *  accordé par l'op `grantTrait`), le reste par les champs de fiche que la partie porte. */
const FICHES: Record<string, () => Combatant> = {
  vierge: () => createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'V', seed: 1 }),
  pecheur: () => ({ ...FICHES.vierge(), sinPoints: 2 }),
  peureux: () => ({ ...FICHES.vierge(), psychTraits: [{ type: 'peur' }] }),
  deuxHaines: () => ({ ...FICHES.vierge(), psychTraits: [{ type: 'haine', cible: ciblePsy.groupe('nain') }, { type: 'haine', cible: ciblePsy.groupe('elfe') }] }),
  haineux: () => ({ ...FICHES.vierge(), psychTraits: [{ type: 'haine' }] }),
  enPeur: () => ({ ...FICHES.vierge(), psychState: [{ type: 'peur' }] }),
  enHaine: () => ({ ...FICHES.vierge(), psychState: [{ type: 'haine', cible: ciblePsy.groupe('elfe'), active: true }] }),
  haineFinie: () => ({ ...FICHES.vierge(), psychState: [{ type: 'haine', cible: ciblePsy.groupe('elfe'), active: false }] }),
  enFrenesie: () => { const c = FICHES.vierge(); applyOps(c, [opPsy.pose('frenesie')], ctx()); return c; },
  enForme: () => { const c = FICHES.vierge(); applyOps(c, [PRENDRE_LA_FORME], ctx()); return c; },
  extenue: () => { const c = FICHES.vierge(); addCondition(c, 'extenue', 2); return c; },
  aTerreVerrouille: () => { const c = FICHES.vierge(); c.wounds = { ...c.wounds, current: 0 }; addCondition(c, 'a-terre', 1); return c; },
  aTerre: () => { const c = FICHES.vierge(); addCondition(c, 'a-terre', 1); return c; },
  traitAccorde: () => { const c = FICHES.vierge(); applyOps(c, [{ op: 'grantTrait', trait: { id: 'amphibie' } } as GameOp], ctx()); return c; },
  malade: () => ({ ...FICHES.vierge(), diseases: [maladie(5 * MINUTES_PER_DAY)] }),
  maladeAuDernierJour: () => ({ ...FICHES.vierge(), diseases: [maladie(MINUTES_PER_DAY)] }),
  maladeDepuisDesHeures: () => ({ ...FICHES.vierge(), diseases: [maladie(6 * 60)] }),
  fracture: () => ({ ...FICHES.vierge(), traumas: [{ uid: 't1', label: 'Fracture', location: 'brasG' as const, kind: 'fracture' as const }] }),
  blesse: () => { const c = FICHES.vierge(); c.wounds = { ...c.wounds, current: c.wounds.max - 3 }; return c; },
  plaieOuverte: () => ({ ...FICHES.vierge(), traumas: [{ uid: 't1', label: 'Fracture', location: 'brasG' as const, kind: 'fracture' as const, awaitingMedicalAid: true }] }),
  critiqueDeRencontre: () => ({ ...FICHES.vierge(), tookCriticalThisFight: true }),
  critiquePansee: () => ({ ...FICHES.vierge(), tookCriticalThisFight: true, woundDressed: true }),
};

const OPS: GameOp[] = [
  { op: 'sinMod', amount: -2 }, { op: 'sinMod', amount: 0 }, { op: 'sinMod', amount: 1 },
  { op: 'removePsychTrait' }, { op: 'removePsychTrait', psychType: { id: 'peur' } }, { op: 'removePsychTrait', psychType: { id: 'haine' } },
  { op: 'removePsychTrait', psychType: { id: 'haine' }, cible: { id: 'elfe' } }, { op: 'removePsychTrait', psychType: { id: 'haine' }, cible: { id: 'gobelin' } },
  { op: 'endPsych', type: { id: 'peur' } }, { op: 'endPsych', type: { id: 'haine' } },
  { op: 'removeCondition', id: { id: 'extenue' } }, { op: 'removeCondition', id: { id: 'a-terre' } }, { op: 'removeCondition' },
  { op: 'removeTrait', trait: { id: 'amphibie' } },
  { op: 'cureDisease' }, { op: 'reduceDiseaseDays', days: 1 }, { op: 'reduceDiseaseDays', days: 1, oncePerDisease: true }, { op: 'reduceDiseaseDays', days: 0 },
  { op: 'cureCriticalWound' },
  { op: 'heal', amount: 2 }, { op: 'aideMedicale' }, { op: 'preventInfection' },
  opPsy.pose('haine', { cible: ciblePsy.groupe('elfe') }), opPsy.pose('haine', { cible: ciblePsy.groupe('nain') }), opPsy.pose('frenesie'), opPsy.pose('peur'),
  RETEST_DE_HAINE, opPsy.pose('haine', { cible: ciblePsy.groupe('elfe'), active: false, fromTest: true }),
  PRENDRE_LA_FORME, QUITTER_LA_FORME,
];

describe('opSansObjet ≡ applyOps ne change rien', () => {
  const cas = OPS.flatMap((o) => Object.keys(FICHES).map((f) => [JSON.stringify(o), f, o] as const));
  it.each(cas)('%s sur %s', (_o, fiche, o) => {
    const c = FICHES[fiche]();
    const avant = JSON.stringify(c);
    const raison = opSansObjet(c, o, ctx());
    const lignes = applyOps(c, [o], ctx()).lignes;
    const change = JSON.stringify(c) !== avant;
    expect(raison == null, `sans objet = ${raison != null}, la fiche change = ${change}`).toBe(change);
    if (raison) expect(lignes.map((e) => e.texte), 'une op sans objet ne produit aucune ligne').toEqual([]);
  });

  it('chaque op de retrait ou de pose nue de la matrice est sans objet sur une fiche ET agit sur une autre', () => {
    const SANS_EFFET_POSSIBLE = new Set(['{"op":"sinMod","amount":0}', '{"op":"sinMod","amount":1}', '{"op":"reduceDiseaseDays","days":0}', '{"op":"removePsychTrait","psychType":{"id":"haine"},"cible":{"id":"gobelin"}}',
      JSON.stringify(opPsy.pose('haine', { cible: ciblePsy.groupe('nain') })), JSON.stringify(RETEST_DE_HAINE), JSON.stringify(opPsy.pose('haine', { cible: ciblePsy.groupe('elfe'), active: false, fromTest: true }))]);
    for (const o of OPS.filter((x) => !SANS_EFFET_POSSIBLE.has(JSON.stringify(x)))) {
      const etats = Object.values(FICHES).map((f) => opSansObjet(f(), o, ctx()) == null);
      expect(etats, JSON.stringify(o)).toContain(true);
      expect(etats, JSON.stringify(o)).toContain(false);
    }
  });

  it.each([[0, true], [2, false]] as const)('Gesundheit (« days: 0 », +1 jour par DR) à DR %s : sans objet = %s', (sl, sansObjet) => {
    const c = { ...FICHES.vierge(), diseases: [{ ...maladie(5 * MINUTES_PER_DAY), id: 'blessure-purulente' }] };
    const o: GameOp = { op: 'reduceDiseaseDays', days: 0, daysPerSL: { every: 1, amount: 1 }, disease: { id: 'blessure-purulente' } };
    const avant = JSON.stringify(c);
    expect(opSansObjet(c, o, { sl }) != null).toBe(sansObjet);
    applyOps(c, [o], { idNeuf: idsDeTest, rng: makeRNG(1), sl });
    expect(JSON.stringify(c) !== avant).toBe(!sansObjet);
    expect(opSansObjet(FICHES.vierge(), o, { avantLeJet: true }), 'sans la maladie, rien à juger : sans objet').not.toBeNull();
    expect(opSansObjet({ ...FICHES.vierge(), diseases: [{ ...maladie(5 * MINUTES_PER_DAY), id: 'blessure-purulente' }] }, o, { avantLeJet: true }), 'avant le Test, le DR peut raccourcir').toBeNull();
  });

  it('`endPsych` d’une affliction CIBLÉE la désactive et garde son marqueur de rencontre (LDB 21 l.9)', () => {
    const c = FICHES.enHaine();
    applyOps(c, [{ op: 'endPsych', type: { id: 'haine' } }], ctx());
    expect(c.psychState).toEqual([{ type: 'haine', cible: ciblePsy.groupe('elfe'), active: false }]);
  });

  it('`endPsych` de l’instance courante ne finit QUE l’instance du contexte ; sans elle, sans objet', () => {
    const elfes = { type: 'haine' as const, cible: ciblePsy.groupe('elfe'), active: true };
    const nains = { type: 'haine' as const, cible: ciblePsy.groupe('nain'), active: true };
    const c = { ...FICHES.vierge(), psychState: [{ ...elfes }, { ...nains }] };
    const o: GameOp = { op: 'endPsych', instance: 'courante' };
    expect(opSansObjet(c, o, ctx())).not.toBeNull();
    applyOps(c, [o], { ...ctx(), affliction: { ...nains } });
    expect(c.psychState).toEqual([elfes, { ...nains, active: false }]);
    expect(opSansObjet(c, o, { ...ctx(), affliction: nains })).not.toBeNull();
  });

  it('une pose qui porte une résolution n’est jamais sans objet ; une pose nue l’est sur l’état déjà subi (LDB 21 l.39)', () => {
    expect(opSansObjet(FICHES.enHaine(), RETEST_DE_HAINE), 'le re-test raté met à jour son Round').toBeNull();
    expect(opSansObjet(FICHES.enHaine(), opPsy.pose('haine', { cible: ciblePsy.groupe('elfe') }))).not.toBeNull();
    expect(opSansObjet(FICHES.haineFinie(), opPsy.pose('haine', { cible: ciblePsy.groupe('elfe') })), 'le marqueur inerte reprend vie').toBeNull();
    expect(opSansObjet(FICHES.enFrenesie(), opPsy.pose('frenesie'))).not.toBeNull();
  });

  it('une affliction ciblée qui entre en vigueur prend le Round de l’application, hors combat aucun (LDB 21 l.39)', () => {
    const pose = opPsy.pose('haine', { cible: ciblePsy.groupe('elfe') });
    for (const fiche of ['vierge', 'haineFinie'] as const) {
      const c = FICHES[fiche]();
      applyOps(c, [pose], { ...ctx(), round: 4 });
      expect(c.psychState, fiche).toEqual([{ type: 'haine', cible: ciblePsy.groupe('elfe'), active: true, lastTestRound: 4 }]);
    }
    const horsCombat = FICHES.vierge();
    applyOps(horsCombat, [pose], ctx());
    expect(horsCombat.psychState).toEqual([{ type: 'haine', cible: ciblePsy.groupe('elfe'), active: true }]);
  });

  it('une maladie de quelques heures ne s’allonge jamais à un jour', () => {
    const c = FICHES.maladeDepuisDesHeures();
    applyOps(c, [{ op: 'reduceDiseaseDays', days: 1, oncePerDisease: true }], ctx());
    expect(c.diseases![0].minutesLeft).toBe(6 * 60);
  });
});
