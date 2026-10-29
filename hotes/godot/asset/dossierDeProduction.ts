/** LE CONTRAT DE NOMMAGE D'UN DOSSIER DE PRODUCTION (#2948, #3106) : ce que l'import lit (`importer.ts`) et ce que la
 *  construction d'une base écrit (`scripts/personnage-3d/base/production.ts`), sans dépendance pour se charger hors
 *  du graphe de l'hôte. */

/** Le seul nom fixe d'un dossier de production : son manifeste, qui nomme le reste. */
export const MANIFESTE_DE_PRODUCTION = 'manifest.json';

/** Les textes de licence d'un dossier de production, chacun portant une ligne `License:`. */
export const FICHIER_DE_LICENCE = /^LICENSE.*\.txt$/;

/** Le champ de `manifest.json` par lequel une production se déclare hors Release : sa valeur, la raison, non vide. */
export const CLE_HORS_RELEASE = 'hors_release';
