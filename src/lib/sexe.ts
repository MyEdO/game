/** Les sexes d'une apparence (ordre stable), lus par le schéma de l'apparence et les modèles 3D (silhouettes et matériaux
 *  par sexe d'une base) ; leur libellé vit sur `sexeSchema` (`src/data/schemas/grammaire/valeurs.ts`). */
export const SEXES = ['M', 'F'] as const;
export type Sexe = (typeof SEXES)[number];
