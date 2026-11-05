import { describe, it, expect } from 'vitest';
import { formatEffetSigne, tirer, tirerSigne } from './dice';
import { aucunDe, deMax, deMin, deSelonLaPlage, desEnSuite } from './dice.testkit';

describe('tirer — la valeur d’une quantité tirée (#1652)', () => {
  it('un nombre se rend tel quel, sans aucun dé', () => {
    expect(tirer(15, aucunDe)).toBe(15);
  });
  it('un tirage roule son `DiceSpec`, `plus` compris', () => {
    expect(tirer({ dice: { n: 1, sides: 10, plus: 20 } }, deMin)).toBe(21);
    expect(tirer({ dice: { n: 1, sides: 10, plus: 20 } }, deMax)).toBe(30);
    expect(tirer({ dice: { n: 1, sides: 10, plus: -4 } }, deMin)).toBe(-3);
    expect(tirer({ dice: { n: 1, sides: 100 } }, deMax)).toBe(100);
  });
  it('un tirage NdM consomme exactement N dés à M faces', () => {
    const faces: [number, number][] = [];
    const rng = deSelonLaPlage((min, max) => { faces.push([min, max]); return max; });
    expect(tirer({ dice: { n: 2, sides: 10 } }, rng)).toBe(20);
    expect(faces).toEqual([[1, 10], [1, 10]]);
  });
});

describe('tirerSigne — un modificateur de dés signé (#1652)', () => {
  it('le signe s’applique au total tiré, `plus` compris', () => {
    expect(tirerSigne({ sign: -1, dice: { n: 3, sides: 10 } }, deMax)).toBe(-30);
    expect(tirerSigne({ sign: 1, dice: { n: 2, sides: 10, plus: 5 } }, desEnSuite([4, 6]))).toBe(15);
  });
  it('n = 0 : seule la constante compte, aucun dé ne tombe', () => {
    expect(tirerSigne({ sign: 1, dice: { n: 0, sides: 10, plus: 5 } }, aucunDe)).toBe(5);
  });
  it('s’écrit signé, la constante seule quand aucun dé ne tombe', () => {
    expect(formatEffetSigne({ sign: 1, dice: { n: 2, sides: 10 } })).toBe('+2d10');
    expect(formatEffetSigne({ sign: -1, dice: { n: 1, sides: 10 } })).toBe('−1d10');
    expect(formatEffetSigne({ sign: 1, dice: { n: 2, sides: 10, plus: 5 } })).toBe('+2d10+5');
    expect(formatEffetSigne({ sign: 1, dice: { n: 0, sides: 10, plus: 5 } })).toBe('+5');
  });
});
