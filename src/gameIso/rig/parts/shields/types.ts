import type { RigHeldDef } from '../types';

/**
 * Def de BOUCLIER = base commune `RigHeldDef` (MÊME format que les armes : slug/label/target/art),
 * routé par la forme RÉSOLUE (`bouclierDeDessin`) sur l'os `bouclier` (main faible). Seule spécificité :
 * `fallback`, la silhouette de repli quand la forme résolue n'est pas un def.
 * Ajouter un bouclier = déposer un fichier `defs/` + `npm run gen` (zéro tableau en dur).
 */
export interface ShieldDef extends RigHeldDef {
  /** Silhouette de repli quand la forme résolue n'est pas un def (UN SEUL def doit porter `fallback: true`). */
  fallback?: boolean;
}
