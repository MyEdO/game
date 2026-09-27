/**
 * IDENTITÉ d'une arête de mur — (case, côté, étage) — calculée ICI et nulle part ailleurs (#1883).
 *
 * Module FEUILLE : aucune dépendance d'exécution (seuls les TYPES `WallSide` et `CellSide` viennent du
 * schéma de scène), donc importable par `data/schemas` comme par `engine`, `state` et `gameIso` sans
 * faire traverser une frontière de couche. Garde : `src/geometry/cle-arete-guard.test.ts`.
 */
import type { CellSide, WallSide } from '../data/schemas/defs-scenes/communs';

/** Clé CANONIQUE d'une arête, format `x,y,side,z`. */
export const cleArete = (x: number, y: number, side: WallSide, z: number): string => `${x},${y},${side},${z}`;

/** Arête CANONIQUE (case + côté N/E) séparant deux cases ADJACENTES en cardinal — null si non
 *  adjacentes. L'arête entre (x,y) et (x,y+1) est le `N` de (x,y+1) ; entre (x,y) et (x+1,y) le `E` de (x,y). */
export function areteEntre(ax: number, ay: number, bx: number, by: number): { x: number; y: number; side: 'N' | 'E' } | null {
  if (by === ay && bx === ax + 1) return { x: ax, y: ay, side: 'E' };
  if (by === ay && bx === ax - 1) return { x: bx, y: by, side: 'E' };
  if (bx === ax && by === ay + 1) return { x: bx, y: by, side: 'N' };
  if (bx === ax && by === ay - 1) return { x: ax, y: ay, side: 'N' };
  return null;
}

/** Forme CANONIQUE de stockage d'une arête de case (`N`/`E` seulement) : le `S` d'une case est le `N` de
 *  la case du dessous, le `O` le `E` de la case de gauche — une arête n'existe qu'une fois. */
export function areteCanonique(x: number, y: number, side: CellSide): { x: number; y: number; side: 'N' | 'E' } {
  if (side === 'S') return { x, y: y + 1, side: 'N' };
  if (side === 'O') return { x: x - 1, y, side: 'E' };
  return { x, y, side };
}
