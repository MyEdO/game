/**
 * Conversion px-iso → MÈTRES MONDE (dépend de `noyau/monde/relief` : `METRES_PER_LEVEL`) — seule partie de
 * la projection isométrique qui a besoin du MONDE plutôt que du seul écran. La géométrie de
 * projection elle-même (grille↔écran, centres/arêtes de tuile, tri de profondeur…) vit dans
 * `src/geometry/iso.ts` (#161 : le noyau en a besoin, ce n'est pas QUE du rendu) — ce module la
 * RÉ-IMPORTE pour ses propres besoins, il ne la redéfinit pas. Il porte aussi la hauteur de l'œil au-dessus du sol
 * d'une case (`hauteurDeLOeil`), que les regards à la première personne posent.
 */
import { METRES_PER_LEVEL } from './relief';
import { LEVEL_H, WALL_H } from '../../geometry/iso';
import { heightAt, plafondDe, type Scene } from './scene';
import { walkNeighbors, type Pt } from './path';

/** Conversion px-iso → MÈTRES MONDE (SOURCE UNIQUE, POV compris) : `LEVEL_H` px (un étage écran)
 *  ⇔ `METRES_PER_LEVEL` m. Les hauteurs px des defs d'apparence (merlons, bandes, linteaux…) passent
 *  par ici pour devenir des hauteurs MONDE consommées par les builders puis les DEUX backends. */
export const isoPxToM = (px: number): number => (px / LEVEL_H) * METRES_PER_LEVEL;
/** Hauteur MÉTRIQUE d'une cloison d'arête — `WALL_H = LEVEL_H` (cf. `geometry/iso.ts`) ⇒ elle vaut
 *  exactement `METRES_PER_LEVEL` (4 m) : un mur atteint le plafond, UNE seule échelle de hauteur dans
 *  tout le monde. Vérité partagée builder/backends/POV. */
export const WALL_H_M = isoPxToM(WALL_H);
/** Hauteur de l'œil au-dessus de la surface où se tient le groupe (mètres), debout. */
export const EYE_H = 1.7;
/** Ce que l'œil garde sous un plafond (m) : l'épaisseur du plancher du dessus (le bordé d'un pont de la caraque,
 *  0,1 m sous son sol) et le haut de la tête au-dessus de l'œil. */
export const MARGE_SOUS_PLAFOND_M = 0.3;

/** La hauteur de l'œil (m) au-dessus du sol de la case `p` : debout (`EYE_H`), abaissée sous le plafond de cette case
 *  et de chaque case où un pas la mène (`walkNeighbors`), de `MARGE_SOUS_PLAFOND_M`. L'œil qui marche vers une case
 *  basse s'abaisse donc dès la case d'avant : il n'entre jamais dans un plafond, et le sol qu'il cherche sous lui
 *  devant ses pas est celui de la case basse, jamais le plancher qui la couvre. PUR. */
export function hauteurDeLOeil(scene: Scene, p: Pt): number {
  const sol = heightAt(scene, p.x, p.y, p.z ?? 0);
  return Math.min(EYE_H, ...[p, ...walkNeighbors(scene, p)].map((q) => plafondDe(scene, q) - MARGE_SOUS_PLAFOND_M - sol));
}
/** CADENCE VERTICALE de la projection : pixels d'ÉCRAN par mètre d'élévation — l'inverse de
 *  `isoPxToM`, et la SEULE définition de cette grandeur dans le dépôt. Elle sert au backend affine
 *  (transformée de motif, épaisseurs de trait, hauteurs de brin), aux caméras du backend volumique
 *  (échelle verticale de la matrice de projection) et à la taille monde d'un billboard héroïque. */
export const ISO_PX_PER_M = LEVEL_H / METRES_PER_LEVEL;
