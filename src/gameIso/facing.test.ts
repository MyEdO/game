import { describe, it, expect } from 'vitest';
import { facingView, screenDir, project } from './facing';
import type { Dir8 } from '../geometry/dir8';

describe('facingView', () => {
  it('vers le bas → front, vers le haut → back', () => {
    expect(facingView(0, 10).view).toBe('front');
    expect(facingView(0, -10).view).toBe('back');
  });
  it('latéral net → profile', () => {
    expect(facingView(10, 0).view).toBe('profile');
    expect(facingView(10, 1).view).toBe('profile'); // ax > 1.5*ay
  });
  it('miroir = regarde à gauche (dx < 0)', () => {
    expect(facingView(-10, 5).mirror).toBe(true);
    expect(facingView(10, 5).mirror).toBe(false);
  });
  it('diagonale basse → front, haute → back', () => {
    expect(facingView(5, 10).view).toBe('front');
    expect(facingView(5, -10).view).toBe('back');
  });
});

describe('screenDir', () => {
  it('delta écran iso (screenX ∝ x−y, screenY ∝ x+y)', () => {
    expect(screenDir({ x: 0, y: 0 }, { x: 1, y: 0 })).toEqual({ dx: 1, dy: 1 });
    expect(screenDir({ x: 0, y: 0 }, { x: 0, y: 1 })).toEqual({ dx: -1, dy: 1 });
  });

  it('tourne les extrémités selon dims.rot', () => {
    // sans dims = comportement actuel (rot 0)
    expect(screenDir({ x: 0, y: 0 }, { x: 1, y: 0 })).toEqual({ dx: 1, dy: 1 });
    // rot 1 sur grille 3×3 : (0,0)->(0,2), (1,0)->(0,1) → dx=1, dy=-1
    expect(screenDir({ x: 0, y: 0 }, { x: 1, y: 0 }, { w: 3, h: 3, rot: 1 })).toEqual({ dx: 1, dy: -1 });
  });
});

describe('project (8 dirs × 4 rotations = 32 cas)', () => {
  // [rot0, rot1, rot2, rot3]. Vérité géométrique : cardinaux monde → diagonales écran (front/back) ;
  // diagonaux monde → cardinales écran (profile pour E/O-écran, front/back pour N/S-écran).
  const EXP: Record<Dir8, Array<{ view: string; mirror: boolean }>> = {
    E:  [{ view: 'front', mirror: false }, { view: 'back', mirror: false }, { view: 'back', mirror: true }, { view: 'front', mirror: true }],
    O:  [{ view: 'back', mirror: true }, { view: 'front', mirror: true }, { view: 'front', mirror: false }, { view: 'back', mirror: false }],
    N:  [{ view: 'back', mirror: false }, { view: 'back', mirror: true }, { view: 'front', mirror: true }, { view: 'front', mirror: false }],
    S:  [{ view: 'front', mirror: true }, { view: 'front', mirror: false }, { view: 'back', mirror: false }, { view: 'back', mirror: true }],
    NE: [{ view: 'profile', mirror: false }, { view: 'back', mirror: false }, { view: 'profile', mirror: true }, { view: 'front', mirror: false }],
    SE: [{ view: 'front', mirror: false }, { view: 'profile', mirror: false }, { view: 'back', mirror: false }, { view: 'profile', mirror: true }],
    SO: [{ view: 'profile', mirror: true }, { view: 'front', mirror: false }, { view: 'profile', mirror: false }, { view: 'back', mirror: false }],
    NO: [{ view: 'back', mirror: false }, { view: 'profile', mirror: true }, { view: 'front', mirror: false }, { view: 'profile', mirror: false }],
  };
  const DIRS: Dir8[] = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
  for (const d of DIRS) {
    for (let rot = 0; rot < 4; rot++) {
      it(`${d} @rot${rot}`, () => {
        expect(project(d, rot as 0 | 1 | 2 | 3)).toEqual(EXP[d][rot]);
      });
    }
  }
});
