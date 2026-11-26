/** LES COUCHES D'UN ÉLÉMENT (#2972, #3842), hors du graphe du noyau que valide `element.ts` : l'évaluateur les lit seules (#5037). */

/** Les couches, de la plus intérieure à la plus extérieure. */
export const COUCHES = ['peau', 'dessous', 'tenue', 'armure', 'manteau'] as const;
export type Couche = (typeof COUCHES)[number];
/** Le rang du corps, sous la couche la plus intérieure de `COUCHES`. */
export const RANG_DU_CORPS = -1;
