/** Les formes de la tête (#4413) : les shape keys propres à un élément de tête, qui ne sont pas des silhouettes de la
 *  base, lues par le schéma d'un preset et d'une mutation, et par le manifeste d'un élément 3D (`formes`) ; leur libellé
 *  vit sur `formeDeTeteSchema` (`src/data/schemas/grammaire/valeurs.ts`). */
export const NOMS_DES_FORMES_DE_TETE = ['visage_inverse', 'nez_fort', 'arcades_marquees', 'joues_creuses', 'visage_long'] as const;
export type FormeDeTete = (typeof NOMS_DES_FORMES_DE_TETE)[number];

export const estFormeDeTete = (nom: string): nom is FormeDeTete => (NOMS_DES_FORMES_DE_TETE as readonly string[]).includes(nom);
