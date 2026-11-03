import { describe, it, expect } from 'vitest';
import { reachable } from './path';
import type { Scene } from './scene';

// Scène minimale : grille w×h en 'herbe', murs ('mur', non walkable) aux clés données.
function scene(w: number, h: number, walls: string[] = []): Scene {
  const tiles = new Array(w * h).fill('herbe');
  for (const k of walls) {
    const [x, y] = k.split(',').map(Number);
    tiles[y * w + x] = 'mur';
  }
  return {
    id: 's', label: 's', dimensions: { w, h }, ambiance: 'exterieur',
    layers: [{ z: 0, tiles }], entities: [], dialogues: [], triggers: [], encounters: [], flags: {},
  } as unknown as Scene;
}

describe('reachable — l’empreinte doit RENTRER le long du trajet (LDB 15 l.12)', () => {
  it('un 1×1 franchit un goulet d’1 tuile ; un 2×2 non', () => {
    // grille 6×3 ; murs en (2,0) et (2,2) → seul (2,1) est libre dans la colonne 2 (goulet d’1 tuile)
    const s = scene(6, 3, ['2,0', '2,2']);
    const blocked = new Set<string>();
    const r1 = reachable(s, { x: 0, y: 1 }, 8, { blocked, foot: 1 });
    expect(r1.has('4,1')).toBe(true); // le 1×1 traverse le goulet
    const r2 = reachable(s, { x: 0, y: 0 }, 8, { blocked, foot: 2 });
    expect(r2.has('3,0')).toBe(false); // le 2×2 ne peut pas : son empreinte touche un mur en colonne 2
    expect(r2.has('0,1')).toBe(true); // mais il bouge librement du côté gauche (empreinte 0..1 × 1..2 OK)
  });

  it('un 2×2 se déplace librement en terrain ouvert (empreinte toujours valide)', () => {
    const s = scene(8, 8);
    const r = reachable(s, { x: 0, y: 0 }, 5, { blocked: new Set(), foot: 2 });
    expect(r.has('2,2')).toBe(true); // 4 pas orthogonaux, empreinte 2..3 × 2..3 tient
    expect(r.has('6,0')).toBe(false); // ancre (6,0) ⇒ occupe x=6..7 OK mais 6 pas > portée 5
  });

  it('un 2×2 ne peut pas s’ancrer au bord (son empreinte sortirait de la carte)', () => {
    const s = scene(4, 4);
    const r = reachable(s, { x: 0, y: 0 }, 6, { blocked: new Set(), foot: 2 });
    expect(r.has('3,0')).toBe(false); // ancre (3,0) ⇒ occupe x=3..4, or x=4 est hors-carte (= mur)
    expect(r.has('2,2')).toBe(true); // ancre (2,2) ⇒ occupe 2..3 × 2..3, tient
  });
});
