import { describe, it, expect } from 'vitest';
import { combatDistance } from './footprint';

/**
 * GARDE-FOU « on peut taper en diagonale » (retour utilisateur : avant, les attaques diagonales
 * ne passaient pas). La distance de COMBAT est Chebyshev (cf. path.ts) : une case en diagonale est
 * AU CONTACT (distance 1) → mêlée autorisée, et comptée par le surnombre / le tir-dans-le-tas.
 */
const at = (x: number, y: number) => ({ pos: { x, y } } as any);

describe('contact diagonal (Chebyshev)', () => {
  it('diagonale adjacente = distance 1 (au contact)', () => {
    expect(combatDistance(at(5, 5), at(6, 6))).toBe(1);
    expect(combatDistance(at(5, 5), at(4, 4))).toBe(1);
    expect(combatDistance(at(5, 5), at(6, 4))).toBe(1);
  });
  it('orthogonale adjacente = 1', () => {
    expect(combatDistance(at(5, 5), at(5, 6))).toBe(1);
    expect(combatDistance(at(5, 5), at(6, 5))).toBe(1);
  });
  it('diagonale à 2 cases = 2 (hors contact de mêlée)', () => {
    expect(combatDistance(at(5, 5), at(7, 7))).toBe(2);
  });
});
