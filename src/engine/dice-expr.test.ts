import { describe, it, expect } from 'vitest';
import { rollExpr } from './dice';
import type { RNG } from './dice';
import { deMax, deMin } from './dice.testkit';

const maxRng: RNG = deMax; // chaque dé → son max
const minRng: RNG = deMin; // chaque dé → son min

describe('rollExpr — évalue une expression de dés', () => {
  it('1d10+15 : min 16, max 25', () => {
    expect(rollExpr('1d10+15', minRng)).toBe(16);
    expect(rollExpr('1d10+15', maxRng)).toBe(25);
  });
  it('constante seule', () => {
    expect(rollExpr('15', maxRng)).toBe(15);
  });
  it('2d10 (n explicite)', () => {
    expect(rollExpr('2d10', maxRng)).toBe(20);
    expect(rollExpr('2d10', minRng)).toBe(2);
  });
  it('d10 (n implicite = 1)', () => {
    expect(rollExpr('d10', maxRng)).toBe(10);
  });
  it('soustraction 1d6-1', () => {
    expect(rollExpr('1d6-1', minRng)).toBe(0); // 1 − 1
    expect(rollExpr('1d6-1', maxRng)).toBe(5); // 6 − 1
  });
});
