import { describe, it, expect } from 'vitest';
import { applyExposureFailure, exposureFailureRank, type ExposureKind } from './exposure';
import { makeRNG } from './dice';
import type { Combatant } from './types';
import { combattantDeTest } from './combattantDeTest.testkit';

/** Rang d'échec d'Exposition déduit des effets déjà posés (#3517). LDB 18 l.330/334. */
const dummy = (): Combatant => combattantDeTest({ kind: 'heros' });

const posed = (c: Combatant, kind: ExposureKind): number =>
  (c.activeEffects ?? []).filter((e) => e.effectId === `exposition-${kind}`).length;

describe('exposureFailureRank — rang d’échec depuis les effets posés', () => {
  it('froid : CT/Ag/Dex au 1er échec (3 effets), le reste au 2e (7 de plus), Blessures ensuite', () => {
    expect([0, 1, 2].map((n) => exposureFailureRank(n))).toEqual([1, 1, 1]);
    expect([3, 9].map((n) => exposureFailureRank(n))).toEqual([2, 2]);
    expect([10, 11].map((n) => exposureFailureRank(n))).toEqual([3, 3]);
  });

  for (const kind of ['froid', 'chaleur'] as const) {
    it(`${kind} : enchaîner le rang rendu sur applyExposureFailure escalade 1 → 2 → 3`, () => {
      const c = dummy();
      const rangs: number[] = [];
      for (let i = 0; i < 3; i++) {
        const rang = exposureFailureRank(posed(c, kind), kind);
        rangs.push(rang);
        applyExposureFailure(c, rang, makeRNG(1), kind);
      }
      expect(rangs).toEqual([1, 2, 3]);
    });
  }
});
