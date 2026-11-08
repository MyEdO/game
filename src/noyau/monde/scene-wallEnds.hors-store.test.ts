/**
 * Extrémités d'arête d'un segment de mur (`wallEnds`, `scene.ts`) : contrat déclaré, coins de GRILLE (±0.5) pour les
 * arêtes N et E et pour les deux diagonales `\` et `/` de la case — source unique des extrémités (iso, POV, pont).
 */
import { describe, it, expect } from 'vitest';
import { wallEnds } from './scene';

describe('wallEnds — coins de grille', () => {
  const x = 3, y = 2;
  it('arêtes cardinales : le bord nord et le bord est de la case', () => {
    expect(wallEnds({ x, y, side: 'N' })).toEqual([{ x: 2.5, y: 1.5 }, { x: 3.5, y: 1.5 }]);
    expect(wallEnds({ x, y, side: 'E' })).toEqual([{ x: 3.5, y: 1.5 }, { x: 3.5, y: 2.5 }]);
  });

  it('diagonales : `\\` du coin nord-ouest au coin sud-est, `/` du coin nord-est au coin sud-ouest', () => {
    expect(wallEnds({ x, y, side: '\\' })).toEqual([{ x: 2.5, y: 1.5 }, { x: 3.5, y: 2.5 }]);
    expect(wallEnds({ x, y, side: '/' })).toEqual([{ x: 3.5, y: 1.5 }, { x: 2.5, y: 2.5 }]);
  });
});
