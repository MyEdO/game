/**
 * `opSansObjet` ≡ « `applyOps` change-t-il la fiche ? » sur la CLASSE des ops de retrait : sur chaque fiche de
 * la matrice, une op est sans objet exactement quand l'appliquer ne change rien, et `applyOps` ne produit
 * alors rien, ni effet ni ligne ; la raison ne se dit qu'au verdict d'un geste délibéré. Un raccourcissement
 * de maladie n'allonge jamais une maladie. LDB 16, LDB 18 l.15, LDB 20, LDB 40 l.36, ADE II 09 l.33,
 * MSRC 04 l.184-186
 */
import { describe, it, expect } from 'vitest';
import { applyOps, opSansObjet, type GameOp, type OpsCtx } from './ops';
import { createHero } from './character';
import { addCondition } from './conditions';
import { makeRNG } from './dice';
import { MINUTES_PER_DAY } from './clock';
import { ciblePsy } from './psych/ciblage';
import type { Combatant, EffectSource } from './types';

const SOURCE: EffectSource = { kind: 'activity', id: 'convalescence' };
const ctx = (): OpsCtx => ({ rng: makeRNG(1), source: SOURCE });

const maladie = (minutesLeft: number) => ({ id: 'infection-mineure', symptoms: [], phase: 'active' as const, minutesLeft, durationMinutes: 10 * MINUTES_PER_DAY });

/** Les fiches de la matrice, chacune posée par la couture de son fait (États par `addCondition`, Trait
 *  accordé par l'op `grantTrait`), le reste par les champs de fiche que la partie porte. */
const FICHES: Record<string, () => Combatant> = {
  vierge: () => createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'V', seed: 1 }),
  pecheur: () => ({ ...FICHES.vierge(), sinPoints: 2 }),
  peureux: () => ({ ...FICHES.vierge(), psychTraits: [{ type: 'peur' }] }),
  deuxHaines: () => ({ ...FICHES.vierge(), psychTraits: [{ type: 'haine', cible: ciblePsy.groupe('nain') }, { type: 'haine', cible: ciblePsy.groupe('elfe') }] }),
  haineux: () => ({ ...FICHES.vierge(), psychTraits: [{ type: 'haine' }] }),
  enPeur: () => ({ ...FICHES.vierge(), psychState: [{ type: 'peur' }] }),
  extenue: () => { const c = FICHES.vierge(); addCondition(c, 'extenue', 2); return c; },
  aTerreVerrouille: () => { const c = FICHES.vierge(); c.wounds = { ...c.wounds, current: 0 }; addCondition(c, 'a-terre', 1); return c; },
  aTerre: () => { const c = FICHES.vierge(); addCondition(c, 'a-terre', 1); return c; },
  traitAccorde: () => { const c = FICHES.vierge(); applyOps(c, [{ op: 'grantTrait', trait: { id: 'amphibie' } } as GameOp], ctx()); return c; },
  malade: () => ({ ...FICHES.vierge(), diseases: [maladie(5 * MINUTES_PER_DAY)] }),
  maladeAuDernierJour: () => ({ ...FICHES.vierge(), diseases: [maladie(MINUTES_PER_DAY)] }),
  maladeDepuisDesHeures: () => ({ ...FICHES.vierge(), diseases: [maladie(6 * 60)] }),
  fracture: () => ({ ...FICHES.vierge(), traumas: [{ label: 'Fracture', location: 'brasG' as const, kind: 'fracture' as const }] }),
};

const OPS: GameOp[] = [
  { op: 'sinMod', amount: -2 }, { op: 'sinMod', amount: 0 }, { op: 'sinMod', amount: 1 },
  { op: 'removePsychTrait' }, { op: 'removePsychTrait', psychType: { id: 'peur' } }, { op: 'removePsychTrait', psychType: { id: 'haine' } },
  { op: 'removePsychTrait', psychType: { id: 'haine' }, cible: { id: 'elfe' } }, { op: 'removePsychTrait', psychType: { id: 'haine' }, cible: { id: 'gobelin' } },
  { op: 'endPsych', type: { id: 'peur' } },
  { op: 'removeCondition', id: 'extenue' }, { op: 'removeCondition', id: 'a-terre' }, { op: 'removeCondition' },
  { op: 'removeTrait', trait: { id: 'amphibie' } },
  { op: 'cureDisease' }, { op: 'reduceDiseaseDays', days: 1 }, { op: 'reduceDiseaseDays', days: 1, oncePerDisease: true }, { op: 'reduceDiseaseDays', days: 0 },
  { op: 'cureCriticalWound' },
];

describe('opSansObjet ≡ applyOps ne change rien', () => {
  const cas = OPS.flatMap((o) => Object.keys(FICHES).map((f) => [JSON.stringify(o), f, o] as const));
  it.each(cas)('%s sur %s', (_o, fiche, o) => {
    const c = FICHES[fiche]();
    const avant = JSON.stringify(c);
    const raison = opSansObjet(c, o, ctx());
    const lignes = applyOps(c, [o], ctx());
    const change = JSON.stringify(c) !== avant;
    expect(raison == null, `sans objet = ${raison != null}, la fiche change = ${change}`).toBe(change);
    if (raison) expect(lignes, 'une op sans objet ne produit aucune ligne').toEqual([]);
  });

  it('chaque op de retrait de la matrice est sans objet sur une fiche ET agit sur une autre', () => {
    const SANS_EFFET_POSSIBLE = new Set(['{"op":"sinMod","amount":0}', '{"op":"sinMod","amount":1}', '{"op":"reduceDiseaseDays","days":0}', '{"op":"removePsychTrait","psychType":{"id":"haine"},"cible":{"id":"gobelin"}}']);
    for (const o of OPS.filter((x) => !SANS_EFFET_POSSIBLE.has(JSON.stringify(x)))) {
      const etats = Object.values(FICHES).map((f) => opSansObjet(f(), o, ctx()) == null);
      expect(etats, JSON.stringify(o)).toContain(true);
      expect(etats, JSON.stringify(o)).toContain(false);
    }
  });

  it.each([[0, true], [2, false]] as const)('Gesundheit (« days: 0 », +1 jour par DR) à DR %s : sans objet = %s', (sl, sansObjet) => {
    const c = { ...FICHES.vierge(), diseases: [{ ...maladie(5 * MINUTES_PER_DAY), id: 'blessure-purulente' }] };
    const o: GameOp = { op: 'reduceDiseaseDays', days: 0, daysPerSL: { every: 1, amount: 1 }, disease: 'blessure-purulente' };
    const avant = JSON.stringify(c);
    expect(opSansObjet(c, o, { sl }) != null).toBe(sansObjet);
    applyOps(c, [o], { rng: makeRNG(1), sl });
    expect(JSON.stringify(c) !== avant).toBe(!sansObjet);
    expect(opSansObjet(FICHES.vierge(), o, { avantLeJet: true }), 'sans la maladie, rien à juger : sans objet').not.toBeNull();
    expect(opSansObjet({ ...FICHES.vierge(), diseases: [{ ...maladie(5 * MINUTES_PER_DAY), id: 'blessure-purulente' }] }, o, { avantLeJet: true }), 'avant le Test, le DR peut raccourcir').toBeNull();
  });

  it('une maladie de quelques heures ne s’allonge jamais à un jour', () => {
    const c = FICHES.maladeDepuisDesHeures();
    applyOps(c, [{ op: 'reduceDiseaseDays', days: 1, oncePerDisease: true }], ctx());
    expect(c.diseases![0].minutesLeft).toBe(6 * 60);
  });
});
