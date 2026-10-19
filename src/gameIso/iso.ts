/**
 * Conversion px-iso → MÈTRES MONDE (dépend de `noyau/monde/relief` : `METRES_PER_LEVEL`) — seule partie de
 * la projection isométrique qui a besoin du MONDE plutôt que du seul écran. La géométrie de
 * projection elle-même (grille↔écran, centres/arêtes de tuile, tri de profondeur…) vit dans
 * `src/geometry/iso.ts` (#161 : `state` en a besoin, ce n'est pas QUE du rendu) — ce module la
 * RÉ-IMPORTE pour ses propres besoins, il ne la redéfinit pas.
 */
import { METRES_PER_LEVEL } from '../noyau/monde/relief';
import { LEVEL_H, WALL_H } from '../geometry/iso';

/** Conversion px-iso → MÈTRES MONDE (SOURCE UNIQUE, POV compris) : `LEVEL_H` px (un étage écran)
 *  ⇔ `METRES_PER_LEVEL` m. Les hauteurs px des defs d'apparence (merlons, bandes, linteaux…) passent
 *  par ici pour devenir des hauteurs MONDE consommées par les builders puis les DEUX backends. */
export const isoPxToM = (px: number): number => (px / LEVEL_H) * METRES_PER_LEVEL;
/** Hauteur MÉTRIQUE d'une cloison d'arête — `WALL_H = LEVEL_H` (cf. `geometry/iso.ts`) ⇒ elle vaut
 *  exactement `METRES_PER_LEVEL` (4 m) : un mur atteint le plafond, UNE seule échelle de hauteur dans
 *  tout le monde. Vérité partagée builder/backends/POV. */
export const WALL_H_M = isoPxToM(WALL_H);
/** CADENCE VERTICALE de la projection : pixels d'ÉCRAN par mètre d'élévation — l'inverse de
 *  `isoPxToM`, et la SEULE définition de cette grandeur dans le dépôt. Elle sert au backend affine
 *  (transformée de motif, épaisseurs de trait, hauteurs de brin), aux caméras du backend volumique
 *  (échelle verticale de la matrice de projection) et à la taille monde d'un billboard héroïque. */
export const ISO_PX_PER_M = LEVEL_H / METRES_PER_LEVEL;
