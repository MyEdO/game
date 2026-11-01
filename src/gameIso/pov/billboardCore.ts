/**
 * BILLBOARDS — la BOÎTE et les hauteurs métriques de référence du monde volumique
 * (`backends/webgl/billboardMath.ts`, `sceneMeshes.ts`) : le quad d'un prop se dimensionne par ces
 * mètres-là, et son dessin est tracé dans la boîte locale 120×150 (base en (60,150)). Le volumique
 * dérive ses quads de la caméra three, jamais d'une projection d'écran.
 */

/** Boîte LOCALE d'un billboard de prop : 120×150, base en (60,150). */
export const BB_W = 120;
export const BB_H = 150;
/** Hauteur métrique dont `billboardMath.ts:JEU_SCALE` rapporte l'échelle du moteur (m). */
export const ENT_H_M = 1.8;
/** Hauteur métrique de la boîte d'un PROP (m). */
export const PROP_H_M = 1.7;
