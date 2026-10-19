import { describe, it, expect } from 'vitest';
import { facingToward } from './dir8';

describe('facingToward (delta grille → Dir8)', () => {
  it('cardinaux, diagonaux, nul', () => {
    expect(facingToward({ x: 2, y: 2 }, { x: 2, y: 0 })).toBe('N');
    expect(facingToward({ x: 2, y: 2 }, { x: 4, y: 2 })).toBe('E');
    expect(facingToward({ x: 2, y: 2 }, { x: 2, y: 5 })).toBe('S');
    expect(facingToward({ x: 2, y: 2 }, { x: 0, y: 2 })).toBe('O');
    expect(facingToward({ x: 0, y: 0 }, { x: 3, y: 3 })).toBe('SE');
    expect(facingToward({ x: 3, y: 3 }, { x: 0, y: 0 })).toBe('NO');
    expect(facingToward({ x: 1, y: 1 }, { x: 1, y: 1 })).toBe('S'); // nul → défaut S
  });
});
