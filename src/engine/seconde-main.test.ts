// LDB 10 l.773 ; LDB 18 l.53 ; LDB 41 l.170 ; #1595 c.6229550544 ; #1667.
import { describe, it, expect, afterEach } from 'vitest';
import { lancerDeLaSecondeMain, causeDuCoupCritique } from './combat';
import { reverseRoll } from './tests';
import { makeRNG, type RNG } from './dice';
import { aucunDe } from './dice.testkit';
import { setRule, resetRule } from './policy';
import { sousLeDe } from '../data/deDeLaTable.testkit';

function rngImpose(tirages: number[], faces = 100): RNG & { tires: number } {
  const file = [...tirages];
  return {
    tires: 0,
    int(min: number, max: number) {
      expect([min, max]).toEqual([1, faces]);
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

  it('Critique sans lancer du tableau ni Localisation (navire, structure), twice faux : le d100 du Test', () => {
    const rng = rngImpose([71]);
    expect(lancerDeLaSecondeMain({ critical: true }, 34, rng, false)).toBe(71);
    expect(rng.tires).toBe(1);
  });

  it('Critique sans lancer du tableau ni Localisation, twice vrai : le meilleur de deux d100', () => {
    const premierBas = rngImpose([12, 87]);
    expect(lancerDeLaSecondeMain({ critical: true }, 34, premierBas, true)).toBe(87);
    expect(premierBas.tires).toBe(2);
    const premierHaut = rngImpose([87, 12]);
    expect(lancerDeLaSecondeMain({ critical: true }, 34, premierHaut, true)).toBe(87);
    expect(premierHaut.tires).toBe(2);
  });

  // LDB 85 l.98, l.134.
  it('Critique obtenu sur une touche sans prise ni Localisation : la Seconde main reçoit toujours le d100', () => {
    const touche = { critical: true, attackerRoll: 33, sansPrise: 'ethere' as const };
    const rng = rngImpose([71]);
    expect(lancerDeLaSecondeMain(touche, 33, rng, false)).toBe(71);
    expect(rng.tires).toBe(1);
  });
});

describe('lancerDeLaSecondeMain : le dé du tableau des Critiques de la Localisation', () => {
  afterEach(() => resetRule('combat-aa-blessures'));
  const tirages = (touche: Parameters<typeof lancerDeLaSecondeMain>[0], twice = false) =>
    Array.from({ length: 200 }, (_, g) => lancerDeLaSecondeMain(touche, 34, makeRNG(g + 1), twice));

  // LDB 10 l.773 ; LDB 18 l.53.
  it('sous un dé d10 posé sur le tableau du Corps, le Critique au Corps tire 1..10', () => {
    sousLeDe('criticalsCorps', 'd10', () => {
      const jets = tirages({ critical: true, critLocation: 'corps' });
      expect(jets.every((v) => v >= 1 && v <= 10)).toBe(true);
      expect(new Set(jets).size).toBe(10);
    });
  });

  // LDB 41 l.170.
  it('twice : le meilleur de deux dés de la table, dans les deux ordres', () => {
    sousLeDe('criticalsCorps', 'd10', () => {
      for (const ordre of [[3, 8], [8, 3]]) {
        const rng = rngImpose(ordre, 10);
        expect(lancerDeLaSecondeMain({ critical: true, critLocation: 'corps' }, 34, rng, true)).toBe(8);
        expect(rng.tires).toBe(2);
      }
    });
  });

  // LDB 18 l.53 : la Localisation relancée, pas celle de touche.
  it('la Localisation relancée porte la table : `critLocation` l’emporte sur `location`', () => {
    sousLeDe('criticalsTete', 'd10', () => {
      const jets = tirages({ critical: true, location: 'brasD', critLocation: 'tete' });
      expect(jets.every((v) => v >= 1 && v <= 10)).toBe(true);
    });
  });

  // AA 07 l.32.
  it('sous `combat-aa-blessures` = aa, le tableau AA de la Localisation', () => {
    setRule('combat-aa-blessures', 'aa');
    sousLeDe('aaCriticalsCorps', 'd10', () => {
      const jets = tirages({ critical: true, location: 'corps' });
      expect(jets.every((v) => v >= 1 && v <= 10)).toBe(true);
    });
  });
});

describe('causeDuCoupCritique', () => {
  // LDB 85 l.98 ; #1595 c.6229550544.
  it('un coup sans prise ne cause aucun Coup Critique, le Critique obtenu reste', () => {
    expect(causeDuCoupCritique({ critical: true, attackerRoll: 33, sansPrise: 'ethere' })).toBeNull();
    expect(causeDuCoupCritique({ critical: true, attackerRoll: 33 })).toBe('double');
  });
});
