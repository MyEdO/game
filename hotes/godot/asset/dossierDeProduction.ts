/** LE CONTRAT DE NOMMAGE D'UN DOSSIER DE PRODUCTION (#2948, #3106) : ce que l'import lit (`importer.ts`) et ce que la
 *  construction d'une base écrit (`scripts/personnage-3d/base/production.ts`), sans dépendance pour se charger hors
 *  du graphe de l'hôte. */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** Le seul nom fixe d'un dossier de production : son manifeste, qui nomme le reste. */
export const MANIFESTE_DE_PRODUCTION = 'manifest.json';

/** Les textes de licence d'un dossier de production, chacun portant une ligne `License:`. */
export const FICHIER_DE_LICENCE = /^LICENSE.*\.txt$/;

/** Le champ de `manifest.json` par lequel une production se déclare hors Release : sa valeur, la raison, non vide. */
export const CLE_HORS_RELEASE = 'hors_release';

/** La table des licences : chaque texte qu'une production déclare (en-tête d'un fichier source, page d'un pack, ligne
 *  `License:` d'un `LICENSE*.txt`), vers son identifiant SPDX (https://spdx.org/licenses/). */
export const TABLE_DES_LICENCES = fileURLToPath(new URL('./licences.json', import.meta.url));

export class TableDesLicencesInvalide extends Error {
  constructor(chemin: string, raison: string) {
    super(`table des licences invalide (${chemin}) : ${raison}`);
    this.name = 'TableDesLicencesInvalide';
  }
}

/** La table des licences de `chemin`, validée : un objet JSON de chaînes vers des chaînes. */
export function chargerLicences(chemin: string = TABLE_DES_LICENCES): ReadonlyMap<string, string> {
  let brut: unknown;
  try {
    brut = JSON.parse(readFileSync(chemin, 'utf8'));
  } catch (e) {
    throw new TableDesLicencesInvalide(chemin, e instanceof Error ? e.message : String(e));
  }
  if (!brut || typeof brut !== 'object' || Array.isArray(brut)) throw new TableDesLicencesInvalide(chemin, 'un objet attendu');
  const horsForme = Object.entries(brut).filter(([, v]) => typeof v !== 'string').map(([k]) => `« ${k} »`);
  if (horsForme.length) throw new TableDesLicencesInvalide(chemin, `identifiant non textuel pour ${horsForme.join(', ')}`);
  return new Map(Object.entries(brut as Record<string, string>));
}

const LIGNE_LICENSE = /^\s*License:\s*(.+?)\s*$/m;

/** La licence que déclare la ligne `License:` du texte de licence `texte`, ou `undefined` sans cette ligne. */
export const licenceDeclaree = (texte: string): string | undefined => LIGNE_LICENSE.exec(texte)?.[1];
