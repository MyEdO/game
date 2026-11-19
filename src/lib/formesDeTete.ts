/** Les formes de la tête (#4413) : les shape keys propres à un élément de tête, qui ne sont pas des silhouettes de la
 *  base, lues par le schéma d'un preset et d'une mutation, par le manifeste d'un élément 3D (`formesDeTete`), par
 *  l'évaluateur et par la construction (`noms_formes_de_tete.py`) ; leur libellé vit sur `formeDeTeteSchema`
 *  (`src/data/schemas/grammaire/valeurs.ts`). */
export const VISAGE_INVERSE = 'visage_inverse';
export const NEZ_FORT = 'nez_fort';
export const ARCADES_MARQUEES = 'arcades_marquees';
export const JOUES_CREUSES = 'joues_creuses';
export const VISAGE_LONG = 'visage_long';

export const NOMS_DES_FORMES_DE_TETE = [VISAGE_INVERSE, NEZ_FORT, ARCADES_MARQUEES, JOUES_CREUSES, VISAGE_LONG] as const;
export type FormeDeTete = (typeof NOMS_DES_FORMES_DE_TETE)[number];

export const estFormeDeTete = (nom: string): nom is FormeDeTete => (NOMS_DES_FORMES_DE_TETE as readonly string[]).includes(nom);
