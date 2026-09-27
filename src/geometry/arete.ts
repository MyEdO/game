/**
 * IDENTITÉ d'une arête de mur — (case, côté, étage) — calculée ICI et nulle part ailleurs (#1883).
 *
 * Module FEUILLE : aucune dépendance d'exécution (seul le TYPE `WallSide` vient du schéma de scène),
 * donc importable par `data/schemas` comme par `engine`, `state` et `gameIso` sans faire traverser une
 * frontière de couche. Garde : `src/geometry/cle-arete-guard.test.ts`.
 */
import type { WallSide } from '../data/schemas/defs-scenes/communs';

/** Clé CANONIQUE d'une arête, format `x,y,side,z`. */
export const cleArete = (x: number, y: number, side: WallSide, z: number): string => `${x},${y},${side},${z}`;
