import { describe, it, expect } from 'vitest';
import { formatDice, hashSeed, makeRNG, parseDice, rollDice, totalDuDe, type DiceSpec } from './dice';

describe('hashSeed', () => {
  it('est déterministe pour une même chaîne', () => {
    expect(hashSeed('ent-1')).toBe(hashSeed('ent-1'));
  });
  it('diffère pour des chaînes différentes', () => {
    expect(hashSeed('ent-1')).not.toBe(hashSeed('ent-2'));
  });
  it('renvoie un entier non signé', () => {
    const h = hashSeed('xyz');
    expect(Number.isInteger(h)).toBe(true);
    expect(h).toBeGreaterThanOrEqual(0);
  });
});

describe('DiceSpec — multiplicateur `fois` (NADJ 15 l.112)', () => {
  const taille: DiceSpec = { n: 1, sides: 10, fois: 2.5, plus: 100 };
  it('le total multiplie les dés avant le `plus`, et un dé sans `fois` est inchangé', () => {
    expect(totalDuDe(taille, 1)).toBe(102.5);
    expect(totalDuDe(taille, 10)).toBe(125);
    expect(totalDuDe({ n: 3, sides: 10, plus: 130 }, 3)).toBe(133);
  });
  it('`formatDice` et `parseDice` sont inverses, `fois` compris', () => {
    expect(formatDice(taille)).toBe('1d10×2,5+100');
    expect(parseDice('1d10×2,5+100')).toEqual(taille);
    expect(parseDice('1d10 × 2.5 + 100')).toEqual(taille);
    expect(formatDice({ n: 3, sides: 10, plus: 5 })).toBe('3d10+5');
    expect(parseDice('3d10+5')).toEqual({ n: 3, sides: 10, plus: 5 });
  });
  it('`rollDice` reste dans les bornes du dé multiplié', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const t = rollDice(taille, makeRNG(seed));
      expect(t).toBeGreaterThanOrEqual(102.5);
      expect(t).toBeLessThanOrEqual(125);
    }
  });
});
