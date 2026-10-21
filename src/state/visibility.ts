/**
 * POLITIQUE DE VISIBILITÉ — qui est vu, mémorisé ou inconnu. Module FEUILLE (aucun import d'exécution ;
 * `Visibility` : `src/data/ambiance.types.ts`) : c'est la seule loi partagée par TOUS les rendus, et
 * chacun l'APPLIQUE à sa manière (teinte de sommet three,
 * filtre CSS de l'iso, facteur de lumière d'ambiance du POV). Séparer les deux est ce qui permet à un
 * renderer de changer sa matière sans toucher à la loi, et à la loi de valoir pour les trois.
 *
 * Clé de case : `"x,y,z"` (celle de l'ancrage d'un `SceneEl` et des ensembles `visible`/`explored`).
 */

import type { Visibility } from '../data/ambiance.types';

/** État d'une case : le champ de vision COURANT prime sur la mémoire ; sans l'un ni l'autre, inconnue. */
export function visibilityOf(cellKey: string, visible: ReadonlySet<string>, explored: ReadonlySet<string>): Visibility {
  if (visible.has(cellKey)) return 'visible';
  return explored.has(cellKey) ? 'explored' : 'unknown';
}
