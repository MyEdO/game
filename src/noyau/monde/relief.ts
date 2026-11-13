/**
 * RELIEF — hauteur métrique des surfaces (foyer UNIQUE des seuils et conversions).
 *
 * Module PUR (zéro dépendance au rendu), au même titre que `footprint.ts` : il ne connaît que des
 * nombres (mètres, cases). Le modèle « A1 » : chaque case d'une couche porte une hauteur RÉELLE en
 * mètres (échelle RAW 2 m/case, LDB 15 l.12 — portée par `scene.metresPerTile`). La hauteur est
 * PORTEUSE (marchabilité / combat / chute), plus cosmétique.
 */

import type { Grade } from '../../data/materials.types';

/**
 * Référence ÉCRAN : un « niveau » de lift (= `iso.LEVEL_H` px à l'écran) représente 4 m de hauteur
 * réelle. Choix de RENDU (pas une règle) : préserve l'aspect existant — un étage `z=1` montait de
 * `LEVEL_H` ⇒ vaut 4 m. C'est le SEUL pont entre les mètres (gameplay) et les pixels (projection).
 */
export const METRES_PER_LEVEL = 4;

/**
 * Convertit une hauteur métrique en LIFT pour la projection iso, en « unités de niveau » (1.0 = un
 * `LEVEL_H` écran). `iso.tileCenter`/`tileEdge`/`diamondCorners` multiplient déjà leur 4ᵉ argument par
 * `LEVEL_H` → les appelants passent `metricToLift(hauteur)` au lieu d'un `z` entier, la projection
 * reste inchangée. PUR : ne dépend pas de `LEVEL_H` (la multiplication vit côté rendu).
 */
export const metricToLift = (metres: number): number => metres / METRES_PER_LEVEL;

/**
 * Dénivelé maximal (m) d'un PAS marchable entre deux cases voisines ; au-delà, FALAISE (chute, Escalade).
 * Seuil de « en contrebas » (`combatFlow.ts`, LDB 14 l.67). Invariant de géométrie de la grille, comme le seuil
 * d'angle mort de `lineOfSight.ts`, hors `OPTIONAL_RULES` (#151).
 */
export const STEP_MAX_M = 1.0;

/**
 * Classe le lien entre deux surfaces 4-voisines selon |Δhauteur| (mètres) :
 * `flat` (de niveau), `ramp` (dénivelé franchissable à pied), `cliff` (infranchissable horizontalement).
 * Brique pure consommée par `surfaceLink` (marchabilité), le pathfinding et le rendu (rampe vs falaise).
 */
export function gradeBetween(hA: number, hB: number): Grade {
  const d = Math.abs(hA - hB);
  if (d <= 1e-6) return 'flat';
  return d <= STEP_MAX_M ? 'ramp' : 'cliff';
}

/** Un lien `flat`/`ramp` est franchissable à pied ; un `cliff` ne l'est pas (chute/Escalade). */
export const isWalkableGrade = (g: Grade): boolean => g !== 'cliff';

/** Composante VERTICALE d'une distance de combat, en CASES : Δhauteur ÷ `metresPerTile` (LDB 15 l.12). */
export function verticalTiles(hA: number, hB: number, metresPerTile: number): number {
  return Math.abs(hA - hB) / metresPerTile;
}
