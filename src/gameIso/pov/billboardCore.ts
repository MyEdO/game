/**
 * BILLBOARDS — la BOÎTE et les hauteurs métriques de référence, partagées par la première personne et
 * le monde volumique (`backends/webgl/billboardMath.ts`, `sceneMeshes.ts`, `monte-composite`) : le quad
 * d'un personnage ou d'un prop se dimensionne par ces mètres-là, et son dessin paper-doll est tracé
 * dans la boîte locale 120×150 (pieds/base en (60,150)).
 *
 * Ce module portait aussi le MÉCANISME d'ancrage/échelle/budget du peintre SVG de première personne
 * (`footAnchor`, `keepClosest`, `bbTransform`, `buildPropBillboards`) : ce peintre est mort (#1176 P3-4
 * C5b) et le volumique dérive ses quads de la caméra three, jamais d'une projection d'écran.
 */

/** Boîte LOCALE d'un billboard (repère paper-doll ET prop : 120×150, pieds/base en (60,150)). */
export const BB_W = 120;
export const BB_H = 150;
/** Hauteur métrique d'une PERSONNE debout (m) — la boîte 150 d'un personnage. */
export const ENT_H_M = 1.8;
/** Hauteur métrique de la boîte d'un PROP (m) — même proportion prop/personnage que l'iso
 *  (échelles de boîte 0.55 prop vs 0.58 personnage). */
export const PROP_H_M = 1.7;
