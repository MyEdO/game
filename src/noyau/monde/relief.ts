/**
 * RELIEF — hauteur métrique des surfaces (foyer UNIQUE des seuils et conversions).
 *
 * Module PUR (zéro dépendance au rendu), au même titre que `footprint.ts` : il ne connaît que des
 * nombres (mètres, cases). Le modèle « A1 » : chaque case d'une couche porte une hauteur RÉELLE en
 * mètres (échelle RAW 2 m/case, LDB 15 l.12 — portée par `scene.metresPerTile`). La hauteur est
 * PORTEUSE (marchabilité / combat / chute), plus cosmétique.
 */

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
 * Seuil DESIGN — maison, aucune règle RAW ne le chiffre (ni LDB ni EDOC ne parlent de dénivelé de
 * case) : dénivelé maximal d'un PAS marchable entre deux cases voisines. ≤ STEP_MAX_M ⇒ on franchit
 * à pied (palier / rampe douce ~1:2 sur une case de 2 m) ; au-delà ⇒ FALAISE (on descend en chutant,
 * on monte par Escalade). Ancré sur l'idée « une marche se franchit, une dénivellation se grimpe ».
 * Un pont à 2 m se rejoint donc par 2 cases de rampe, et le malus −10 « en contrebas » (`combatFlow.ts`,
 * lu directement sur cette constante) se déclenche dès qu'une cible domine de plus de ce seuil.
 * Foyer unique de la valeur, importée telle quelle par `combatFlow.ts` (malus « en contrebas ») : c'est
 * un INVARIANT de géométrie (aucune règle ne chiffre le dénivelé de case, cf. supra — même nature que
 * le seuil de dead-ground de `lineOfSight.ts`), PAS une house-rule de JEU. Sa place n'est donc pas au registre
 * `OPTIONAL_RULES` (réservé aux règles de JEU éditables) ; source unique ICI, retoucher = un seul geste.
 */
export const STEP_MAX_M = 1.0;

/** Nature du lien vertical entre deux surfaces voisines. */
export type Grade = 'flat' | 'ramp' | 'cliff';

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

/**
 * Composante VERTICALE d'une distance de combat, exprimée en CASES : Δhauteur ÷ échelle métrique de la
 * case. RAW : 1 case = `metresPerTile` m (LDB 15 l.12, défaut 2) → un dénivelé de 4 m (un « niveau »)
 * vaut 2 cases, exact pour toute hauteur.
 */
export function verticalTiles(hA: number, hB: number, metresPerTile: number): number {
  return Math.abs(hA - hB) / metresPerTile;
}
