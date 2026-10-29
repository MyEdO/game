import { describe, it, expect } from 'vitest';
import { fireTriggers } from '../noyau/triggeredEffects';
import type { Combatant } from '../engine/types';
import { desDuTest } from '../engine/dice.testkit';
import { combattantDeTest } from '../engine/combattantDeTest.testkit';
import { blessuresDeBase } from '../engine/characteristics';

/**
 * Instable (LDB 85 l.177) — MIGRÉ en DONNÉES (trait `instable` effects onRoundEnd) : « Chaque fois qu'elle
 * met fin à un Round Engagé avec un adversaire ayant un Avantage supérieur, elle perd un nombre de PB égal
 * à la différence ; si elle a déjà atteint 0 PB elle meurt. » La valeur RELATIONNELLE (`engagedAdvantageGap`)
 * est calculée par le dispatcher sur la `battle` ; le flux est `if gap>0 → wounds {gap} ; if PB<=0 → banish`.
 */
const mk = (over: Partial<Combatant> = {}): Combatant => combattantDeTest({
  id: 'u', label: 'Zombie', kind: 'enemy',
  armour: { corps: 4 } as Combatant['armour'], // PA 4 : doit être IGNORÉ (perte directe)
  wounds: blessuresDeBase(8), engagedWith: [],
  ...over,
});

const battle = (cs: Combatant[]) => (() => ({ battle: { combatants: cs } })) as never;
const roundEnd = (get: never, c: Combatant) => fireTriggers(get, c, 'onRoundEnd', { rng: desDuTest });

describe('Instable — perte de PB = écart d’Avantage avec l’adversaire Engagé supérieur', () => {
  it('Avantage 0 vs adversaire Engagé à 2 → perd 2 PB (PA ignorée)', () => {
    const z = mk({ traits: [{ id: 'instable' }] as never, advantage: 0, engagedWith: ['h'] as never });
    const h = mk({ id: 'h', kind: 'hero', advantage: 2, engagedWith: ['u'] as never });
    roundEnd(battle([z, h]) as never, z);
    expect(z.wounds.current).toBe(6); // 8 − 2, sans déduire les 4 PA
  });
  it('Avantage ÉGAL ou supérieur → aucune perte (pas d’adversaire « supérieur »)', () => {
    const z = mk({ traits: [{ id: 'instable' }] as never, advantage: 2, engagedWith: ['h'] as never });
    const h = mk({ id: 'h', kind: 'hero', advantage: 2, engagedWith: ['u'] as never });
    roundEnd(battle([z, h]) as never, z);
    expect(z.wounds.current).toBe(8); // gap = 0
  });
  it('NON engagé → aucune perte (même si l’adversaire a plus d’Avantage)', () => {
    const z = mk({ traits: [{ id: 'instable' }] as never, advantage: 0, engagedWith: [] as never });
    const h = mk({ id: 'h', kind: 'hero', advantage: 3, engagedWith: [] as never });
    roundEnd(battle([z, h]) as never, z);
    expect(z.wounds.current).toBe(8);
  });
  it('amené à 0 PB par la poussée → « se délite » (dead) — narration unravel', () => {
    const z = mk({ traits: [{ id: 'instable' }] as never, advantage: 0, engagedWith: ['h'] as never, wounds: { current: 2, max: 8, base: 8 } as never });
    const h = mk({ id: 'h', kind: 'hero', advantage: 3, engagedWith: ['u'] as never });
    const lines = roundEnd(battle([z, h]) as never, z);
    expect(z.wounds.current).toBeLessThanOrEqual(0);
    expect(z.dead).toBe(true);
    expect(lines.join(' ')).toMatch(/délite/i);
  });
  it('créature SANS Instable → inerte (pas de perte relationnelle)', () => {
    const z = mk({ traits: [{ id: 'bestial' }] as never, advantage: 0, engagedWith: ['h'] as never });
    const h = mk({ id: 'h', kind: 'hero', advantage: 3, engagedWith: ['u'] as never });
    roundEnd(battle([z, h]) as never, z);
    expect(z.wounds.current).toBe(8);
  });
});
