import { describe, it, expect } from 'vitest';
import { emptyScene, type Scene } from '../noyau/monde/scene';
import type { Terrain } from '../data/schemas/defs-scenes/scene';
import { pathTo } from '../noyau/monde/path';

/**
 * Saut au pathfinding (LDB 15 l.76 : on saute librement de Mouvement/3 m ; au-delà, Test
 * d'Athlétisme — géré à la couche déplacement). `pathTo(..., jump)` peut FRANCHIR un gouffre de
 * cases non-marchables (« vide ») en ligne droite, en atterrissant jusqu'à `jump` cases plus loin.
 * `jump=0` (défaut) = aucun saut → strictement l'ancien comportement (non-régression).
 */
function chasm(width: number, gapCols: number[]): Scene {
  const s = emptyScene('scene-test', width, 3); // tout « herbe » (marchable)
  const t = s.layers[0].tiles as Terrain[];
  for (const gx of gapCols) for (let y = 0; y < 3; y++) t[y * width + gx] = 'vide'; // colonne-gouffre infranchissable à pied
  return s;
}
const empty = new Set<string>();

describe('path — saut par-dessus un gouffre', () => {
  it('sans saut (jump=0), un gouffre vertical est infranchissable', () => {
    expect(pathTo(chasm(5, [2]), { x: 1, y: 1 }, { x: 3, y: 1 }, { blocked: empty })).toBeNull();
  });

  it('jump=2 franchit un gouffre d’1 case (atterrit 2 cases plus loin)', () => {
    const path = pathTo(chasm(5, [2]), { x: 1, y: 1 }, { x: 3, y: 1 }, { blocked: empty, jump: 2 });
    expect(path).not.toBeNull();
    expect(path![0]).toEqual({ x: 1, y: 1 });
    expect(path![path!.length - 1]).toEqual({ x: 3, y: 1 });
    expect(path!.some((p) => p.x === 2)).toBe(false); // saute PAR-DESSUS la case 2 (jamais posé dessus)
  });

  it('un gouffre de 2 cases exige jump≥3', () => {
    expect(pathTo(chasm(6, [2, 3]), { x: 1, y: 1 }, { x: 4, y: 1 }, { blocked: empty, jump: 2 })).toBeNull();
    expect(pathTo(chasm(6, [2, 3]), { x: 1, y: 1 }, { x: 4, y: 1 }, { blocked: empty, jump: 3 })).not.toBeNull();
  });

  it('non-régression : sur terrain plein, jump>0 donne le même chemin que jump=0', () => {
    const s = emptyScene('scene-test', 5, 5);
    const a = pathTo(s, { x: 0, y: 0 }, { x: 3, y: 0 }, { blocked: empty, jump: 0 });
    const b = pathTo(s, { x: 0, y: 0 }, { x: 3, y: 0 }, { blocked: empty, jump: 3 });
    expect(b).toEqual(a); // aucun saut déclenché quand on peut marcher
  });
});
