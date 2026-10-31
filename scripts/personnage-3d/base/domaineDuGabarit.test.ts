import { describe, expect, it } from 'vitest';
import { gabarits } from '../../../src/data/index.ts';
import { facteursDeComposition } from '../../../src/noyau/apparence/composition.ts';
import { domaineDuGabarit } from './domaineDuGabarit.ts';

const CATALOGUE_DES_EXTREMES = {
  gabarits: [
    { id: 'courtaud', type: 'gabarits', label: 'Court', sl: 1, st: 1, legs: 0.6, arms: 0.5, head: 1.25 },
    { id: 'brute', type: 'gabarits', label: 'Long', sl: 1, st: 1, legs: 1.9, arms: 1.8, head: 0.9 },
  ] satisfies typeof gabarits,
  races: [
    { nom: 'Menu à grande tête', gabarit: { id: 'courtaud' as const }, gabaritOverride: { legs: 0.4, arms: 0.7, head: 2 } },
    { nom: 'Grand à petite tête', gabarit: { id: 'brute' as const }, gabaritOverride: { legs: 1.6, arms: 2.2, head: 0.5 } },
  ],
};
const trouver = (id: (typeof gabarits)[number]['id']) => CATALOGUE_DES_EXTREMES.gabarits.find((g) => g.id === id);

describe('domaine de la composition 3D (#3104)', () => {
  it('refuse un catalogue sans race en nommant le domaine', () => {
    expect(() => domaineDuGabarit({ ...CATALOGUE_DES_EXTREMES, races: [] }))
      .toThrow('domaineDuGabarit : catalogue sans race');
  });

  it('enveloppe exactement les gabarits et les races, dont les extrêmes sont nommés', () => {
    const bornes = domaineDuGabarit(CATALOGUE_DES_EXTREMES);
    expect(bornes).toEqual({ legs: { min: 0.4, max: 1.9 }, arms: { min: 0.5, max: 2.2 }, head: { min: 0.5, max: 2 } });
    const [menu, grand] = CATALOGUE_DES_EXTREMES.races;
    const [court, long] = CATALOGUE_DES_EXTREMES.gabarits;
    const facteursMenu = facteursDeComposition(undefined, menu, trouver);
    const facteursGrand = facteursDeComposition(undefined, grand, trouver);
    const facteursCourt = facteursDeComposition(court.id, grand, trouver);
    const facteursLong = facteursDeComposition(long.id, menu, trouver);
    expect(facteursMenu.legs, menu.nom).toBe(bornes.legs.min);
    expect(facteursMenu.head, menu.nom).toBe(bornes.head.max);
    expect(facteursGrand.arms, grand.nom).toBe(bornes.arms.max);
    expect(facteursGrand.head, grand.nom).toBe(bornes.head.min);
    expect(facteursCourt.arms, court.label).toBe(bornes.arms.min);
    expect(facteursLong.legs, long.label).toBe(bornes.legs.max);
  });

  it('compose chaque gabarit explicite par la couture 3D sans lui appliquer la surcharge de race', () => {
    for (const race of CATALOGUE_DES_EXTREMES.races) {
      for (const g of CATALOGUE_DES_EXTREMES.gabarits) {
        expect(facteursDeComposition(g.id, race, trouver)).toEqual({ sl: g.sl, st: g.st, legs: g.legs, arms: g.arms, head: g.head });
      }
    }
  });
});
