// LDB 10 l.773 ; LDB 41 l.170 ; #1595 c.6229550544.
import { describe, it, expect } from 'vitest';
import { lancerDeLaSecondeMain, reverseRoll, causeDuCoupCritique } from './combat';
import type { RNG } from './dice';
import { aucunDe } from './dice.testkit';

function rngImpose(tirages: number[]): RNG & { tires: number } {
  const file = [...tirages];
  return {
    tires: 0,
    int(min: number, max: number) {
      expect([min, max]).toEqual([1, 100]);
      const v = file.shift();
      if (v === undefined) throw new Error('RNG épuisé');
      this.tires++;
      return v;
    },
  };
}

const rngInterdit = aucunDe;

describe('lancerDeLaSecondeMain', () => {
  it('sans Critique : le lancer inversé, sans tirage', () => {
    expect(lancerDeLaSecondeMain({ critical: false }, 34, rngInterdit, false)).toBe(43);
    expect(reverseRoll(34)).toBe(43);
  });

  it('sans Critique, un lancer du tableau présent ne compte pas', () => {
    expect(lancerDeLaSecondeMain({ critical: false, lancerDuTableau: 56 }, 34, rngInterdit, false)).toBe(43);
  });

  it('Critique avec lancer du tableau : ce lancer, sans tirage', () => {
    expect(lancerDeLaSecondeMain({ critical: true, lancerDuTableau: 56 }, 34, rngInterdit, true)).toBe(56);
  });

  it('Critique sans lancer du tableau, twice faux : un d100 tiré', () => {
    const rng = rngImpose([71]);
    expect(lancerDeLaSecondeMain({ critical: true }, 34, rng, false)).toBe(71);
    expect(rng.tires).toBe(1);
  });

  it('Critique sans lancer du tableau, twice vrai : le meilleur de deux d100', () => {
    const premierBas = rngImpose([12, 87]);
    expect(lancerDeLaSecondeMain({ critical: true }, 34, premierBas, true)).toBe(87);
    expect(premierBas.tires).toBe(2);
    const premierHaut = rngImpose([87, 12]);
    expect(lancerDeLaSecondeMain({ critical: true }, 34, premierHaut, true)).toBe(87);
    expect(premierHaut.tires).toBe(2);
  });

  // LDB 85 l.98, l.134.
  it('Critique obtenu sur une touche sans prise : la Seconde main reçoit toujours le d100', () => {
    const touche = { critical: true, attackerRoll: 33, sansPrise: 'ethere' as const };
    const rng = rngImpose([71]);
    expect(lancerDeLaSecondeMain(touche, 33, rng, false)).toBe(71);
    expect(rng.tires).toBe(1);
  });
});

describe('causeDuCoupCritique', () => {
  // LDB 85 l.98 ; #1595 c.6229550544.
  it('un coup sans prise ne cause aucun Coup Critique, le Critique obtenu reste', () => {
    expect(causeDuCoupCritique({ critical: true, attackerRoll: 33, sansPrise: 'ethere' })).toBeNull();
    expect(causeDuCoupCritique({ critical: true, attackerRoll: 33 })).toBe('double');
  });
});
