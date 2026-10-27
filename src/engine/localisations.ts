/** Localisations d'impact. LDB 13 l.140-145. */
export const LOCALISATIONS_DE_COUP = ['tete', 'brasG', 'brasD', 'corps', 'jambeG', 'jambeD'] as const;
/** Une Localisation de la table d'impact. */
export type HitLocation = (typeof LOCALISATIONS_DE_COUP)[number];
