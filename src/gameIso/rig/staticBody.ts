/**
 * CORPS STATIQUE mono-os — fondation PARTAGÉE des objets inertes rendus par le système de plans
 * (coque de navire MDG 12, engin de siège ADE II 8). Pas de squelette anatomique : une seule
 * silhouette dessinée, recoloriée par la palette à jetons, ANCRÉE BASE-AU-SOL (corrige la lévitation).
 *
 * Repère du corps (boîte 120×150) : le rendu pose le point (60, GROUND_Y) au CENTRE de la tuile
 * (`translate(-60,-150)`) — exactement comme les PIEDS d'un bipède ou d'un quadrupède (cf. `groundQuad`).
 * Donc un art dont la BASE (point de contact bas) atterrit à y=GROUND_Y REPOSE sur la case, sans flotter.
 */
import type { ResolvedBone } from './composeRig';
import { mul, rotate, translate, type Matrix } from './kinematics';
import { buildTokenMap, applyTokenMap, type Palette, type PaletteDeclaree } from './palette';

/** Ligne de SOL du repère de corps (= les 150px de l'ancrage aux pieds). Tout corps statique pose
 *  sa base ICI ⇒ pas de lévitation (le défaut historique de la coque, qui se posait à ~98). */
export const GROUND_Y = 150;

/**
 * Construit l'unique os d'un corps statique, ancré base-au-sol. `svg` est dessiné en coordonnées
 * LOCALES dont l'origine est le point de contact au sol au centre, l'objet montant en y NÉGATIF.
 *  - `baseY` : ordonnée locale du point de contact (0 si l'art est déjà dessiné base-à-l'origine ;
 *    >0 si l'origine de l'art est plus haut que sa base — ex. coque dont l'origine est la flottaison).
 *  - `tilt` (deg) : gîte/recul AUTOUR de la base — le navire roule, l'affût recule — sans décoller du sol.
 *  - `id`/`z` : identité d'os (stable pour les tests) et ordre peintre.
 * La base (0, baseY) atterrit toujours en (60, GROUND_Y) quel que soit `tilt` (pivot = contact sol).
 */
export function groundedBody(
  svg: string,
  palette: PaletteDeclaree,
  colors?: Palette,
  opts: { baseY?: number; tilt?: number; id?: string; z?: number } = {},
): ResolvedBone[] {
  const { baseY = 0, tilt = 0, id = 'corps', z = 1 } = opts;
  // p_local → translate(0,-baseY) (base à l'origine) → rotate(tilt) (autour de la base) → translate au sol.
  const matrix: Matrix = mul(mul(translate(60, GROUND_Y), rotate(tilt)), translate(0, -baseY));
  const map = buildTokenMap([palette], colors ?? {});
  return [{ id, matrix, scale: [1, 1], z, parts: [{ svg: applyTokenMap(svg, map), layer: 0 }] }];
}
