import { describe, it, expect } from 'vitest';
import { bleedDeathRoll } from './conditions';
import type { Combatant } from './types';
import { deFixe } from './dice.testkit';

const fixed = deFixe;
function mk(stacks: number): Combatant {
  return { name: 'X', conditions: stacks ? [{ id: 'hemorragique', value: stacks }] : [] } as unknown as Combatant;
}

describe('bleedDeathRoll — mort par Hémorragique (LDB 16 l.105)', () => {
  it('aucun Hémorragique → pas de jet, pas de mort', () => {
    expect(bleedDeathRoll(mk(0), fixed(5))).toEqual({ died: false, log: [] });
  });

  it('DOUBLE → coagulation (retire 1 pion), pas de mort (le double prime)', () => {
    const c = mk(3);
    const r = bleedDeathRoll(c, fixed(22)); // 22 = double, et ≤ 30 → coagule au lieu de tuer
    expect(r.died).toBe(false);
    expect(c.conditions.find((x) => x.id === 'hemorragique')!.value).toBe(2);
  });

  it('jet non-double ≤ 10×pions → mort', () => {
    expect(bleedDeathRoll(mk(3), fixed(15)).died).toBe(true); // 15 ≤ 30 (3 pions)
    expect(bleedDeathRoll(mk(1), fixed(5)).died).toBe(true); // 5 ≤ 10 (1 pion)
  });

  it('jet non-double > 10×pions → survit', () => {
    expect(bleedDeathRoll(mk(3), fixed(50)).died).toBe(false); // 50 > 30
    expect(bleedDeathRoll(mk(1), fixed(45)).died).toBe(false); // 45 > 10
  });
});
