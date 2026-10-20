import { describe, it, expect } from 'vitest';
import { scatter } from './scatter';
import type { RNG } from './dice';
import { desEnSuite } from './dice.testkit';

// RNG SCRIPTÉ : d10() lit `rng.int(1,10)` dans l'ordre — on force la séquence (direction d'abord, puis
// les 2d10 de distance) pour vérifier byte-pour-byte le RAW de Dispersion (LDB 14 l.144-151).
const seqRng = (seq: number[]): RNG => desEnSuite(seq);

describe('scatter — Dispersion d’une arme de jet ratée (LDB 14 l.144-151)', () => {
  it('1d10 = 9 → l’arme atterrit aux pieds du LANCEUR (l.151)', () => {
    const from = { x: 3, y: 4 };
    expect(scatter(from, { x: 12, y: 9 }, seqRng([9]), 2)).toEqual({ x: 3, y: 4 });
  });

  it('1d10 = 10 → l’arme atterrit aux pieds de la CIBLE (l.151)', () => {
    const to = { x: 12, y: 9 };
    expect(scatter({ x: 3, y: 4 }, to, seqRng([10]), 2)).toEqual({ x: 12, y: 9 });
  });

  it('1d10 ∈ 1..8 → direction du diagramme (l.146-149) depuis la cible, distance 2d10 m', () => {
    // dir=5 = Est (+1,0) ; 2d10 = 3+4 = 7 m ; demi-distance = 10 m (cheb 10 × 2 m / 2) → 7 m non plafonnés.
    // 7 m / 2 = round(3.5) = 4 tuiles → (10+4, 0).
    const land = scatter({ x: 0, y: 0 }, { x: 10, y: 0 }, seqRng([5, 3, 4]), 2);
    expect(land).toEqual({ x: 14, y: 0 });
    expect(land.x).toBeGreaterThan(10); // bien à l’Est de la cible (direction honorée)
  });

  it('plafond demi-distance (l.151) : une cible PROCHE borne la distance à la moitié', () => {
    // Cible à 2 cases (cheb 2 × 2 m = 4 m → demi-distance = 2 m). 2d10 = 9+9 = 18 m, plafonné à 2 m.
    // 2 m / 2 = 1 tuile → (2+1, 0) = (3,0). SANS plafond ce serait 18 m → 9 tuiles → (11,0).
    expect(scatter({ x: 0, y: 0 }, { x: 2, y: 0 }, seqRng([5, 9, 9]), 2)).toEqual({ x: 3, y: 0 });
  });

  it('bornage carte : une dispersion hors-grille (coords négatives) est clampée à [0, w-1]×[0, h-1]', () => {
    // dir=1 = Nord-Ouest (-1,-1) ; demi-distance = 4 m (cheb 4 × 2 / 2) ; 2d10=18 → 4 m → 2 tuiles.
    // (1-2, 1-2) = (-1,-1) → clampé à (0,0).
    expect(scatter({ x: 5, y: 5 }, { x: 1, y: 1 }, seqRng([1, 9, 9]), 2, { w: 20, h: 15 })).toEqual({ x: 0, y: 0 });
  });

  it('bornage carte : dépassement du bord opposé clampé à w-1', () => {
    // dir=5 = Est (+1,0) ; cible en bord droit (x=19) ; 2d10=18 → 9 tuiles → x=28 → clampé à w-1=19.
    expect(scatter({ x: 0, y: 0 }, { x: 19, y: 0 }, seqRng([5, 9, 9]), 2, { w: 20, h: 15 })).toEqual({ x: 19, y: 0 });
  });
});
