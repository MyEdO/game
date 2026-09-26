/**
 * Prix de la nuit de repos (`restFlow.restCost`, LDB 66 l.12-16) VS le catalogue `trappings.json`
 * (`chambre-commune-nuit`/`chambre-privee-nuit`/`repas-auberge`, tarifs de SERVICE — cf.
 * `src/state/merchants/service-trappings.test.ts`). Convergence #343 : `restCost` RÉSOUT désormais ces
 * ids au catalogue (`PRICE_BRASS` dérivé de `findTrappingById`, restFlow.ts) — SOURCE UNIQUE partagée
 * avec le hub de ville (`restServicePrice`). Ce test verrouille l'égalité pour qu'une dérive du tarif
 * RAW dans le catalogue reste répercutée partout (et casse la CI si un chemin la contournait).
 */
import { describe, it, expect } from 'vitest';
import { restCost, type PendingRest } from './restFlow';
import { findTrappingById } from '../data';
import { toBrass, priceToMoney } from '../engine/money';
import type { Combatant } from '../engine/types';

const hero = (id: string): Combatant => ({ id, name: id, items: [], wounds: { current: 10, max: 10 }, conditions: [] } as unknown as Combatant);

const basePending = (perHero: PendingRest['perHero']): PendingRest =>
  ({ places: { auberge: true }, quality: 'normale', days: 1, perHero, phase: 'setup' }) as PendingRest;

describe('restCost (restFlow) résout les MÊMES prix que le catalogue trappings (LDB 66 l.12-16)', () => {
  it('chambre commune/nuit : restCost == price du trapping "chambre-commune-nuit"', () => {
    const h = hero('a');
    const cost = restCost(basePending({ a: { lodging: 'commune', food: 'rien' } }), [h]);
    expect(toBrass(cost)).toBe(toBrass(priceToMoney(findTrappingById('chambre-commune-nuit')!.price)));
  });

  it('chambre privée/nuit (2 convives) : restCost == price du trapping "chambre-privee-nuit"', () => {
    const a = hero('a'); const b = hero('b');
    const cost = restCost(basePending({ a: { lodging: 'privee', food: 'rien' }, b: { lodging: 'privee', food: 'rien' } }), [a, b]);
    expect(toBrass(cost)).toBe(toBrass(priceToMoney(findTrappingById('chambre-privee-nuit')!.price)));
  });

  it('repas, auberge : restCost == price du trapping "repas-auberge"', () => {
    const h = hero('a');
    const cost = restCost(basePending({ a: { lodging: 'dehors', food: 'repas' } }), [h]);
    expect(toBrass(cost)).toBe(toBrass(priceToMoney(findTrappingById('repas-auberge')!.price)));
  });
});
