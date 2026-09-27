/**
 * IDENTITÉ d'une arête de mur — (case, côté, étage) — calculée ICI et nulle part ailleurs (#1883).
 *
 * Module FEUILLE : aucune dépendance d'exécution (seul le TYPE `WallSide` vient du schéma de scène),
 * donc importable par `data/schemas` comme par `engine`, `state` et `gameIso` sans faire traverser une
 * frontière de couche. Garde : `src/geometry/cle-arete-guard.test.ts`.
 */
import type { WallSide } from '../data/schemas/defs-scenes/communs';
import type { CellSide } from '../state/scene';

/** LIBELLÉ d'affichage d'une arête — `(x,y,side)`, suivi de ` étage z` hors du rez-de-chaussée. Il vit
 *  ICI, à côté de l'identité qu'il donne à lire : c'est le seul module que l'état (messages de
 *  validation) et l'interface (résumés d'effet) importent tous deux sans traverser une couche. */
export const libelleArete = (e: { x: number; y: number; side: string; z?: number }): string =>
  `(${e.x},${e.y},${e.side})${e.z ? ` étage ${e.z}` : ''}`;

/** Clé CANONIQUE d'une arête, format `x,y,side,z`. */
export const cleArete = (x: number, y: number, side: WallSide, z: number): string => `${x},${y},${side},${z}`;

/** Forme CANONIQUE de stockage d'une arête de case (`N`/`E` seulement) : le `S` d'une case est le `N` de
 *  la case du dessous, le `O` le `E` de la case de gauche — une arête n'existe qu'une fois. */
export function areteCanonique(x: number, y: number, side: CellSide): { x: number; y: number; side: 'N' | 'E' } {
  if (side === 'S') return { x, y: y + 1, side: 'N' };
  if (side === 'O') return { x: x - 1, y, side: 'E' };
  return { x, y, side };
}
