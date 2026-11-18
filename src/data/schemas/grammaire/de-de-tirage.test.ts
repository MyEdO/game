/**
 * Le dé de TIRAGE d'une table (`deDeTirageSchema`) est un `DiceSpec` NdM : `{ n, sides }`, entiers de 1, sans
 * multiplicateur ni ajout, jamais une expression (#1669, #4056).
 */
import { describe, expect, it } from 'vitest';
import { deDeTirageSchema } from './valeurs';

describe('deDeTirageSchema', () => {
  it('admet NdM', () => {
    for (const de of [{ n: 1, sides: 10 }, { n: 2, sides: 10 }, { n: 1, sides: 100 }]) expect(deDeTirageSchema.safeParse(de).success, JSON.stringify(de)).toBe(true);
  });

  it('refuse l’expression, zéro dé ou zéro face, le fractionnaire et la clé hors NdM', () => {
    for (const de of ['1d10', 'd100', { n: 0, sides: 10 }, { n: 1, sides: 0 }, { n: 1.5, sides: 10 }, { n: 1, sides: 10, plus: 1 }]) {
      expect(deDeTirageSchema.safeParse(de).success, JSON.stringify(de)).toBe(false);
    }
  });
});
