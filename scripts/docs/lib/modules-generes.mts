// MODULES GÉNÉRÉS que lit le détecteur de la porte des comptes (#5083) : chacun au chemin que déclare `cibles-registres.mjs`, sous une clé stable
// (une sortie de `SORTIES_DES_ESPACES`, l'`arrayName` d'un registre de `REGISTRIES`). La déclaration est celle que nomme
// `ENV_DECLARATION_DES_CIBLES` — l'image que mesure la porte des comptes (`corpusDesComptes.mts`) —, sinon celle de ce dossier.
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { SchemaDef } from '../../../src/data/schemas/types';

/** Le chemin absolu de la déclaration `cibles-registres.mjs` qui place les modules générés. */
export const ENV_DECLARATION_DES_CIBLES = 'COMPTES_DECLARATION_DES_CIBLES';

const RACINE = fileURLToPath(new URL('../../..', import.meta.url));
const nommee = process.env[ENV_DECLARATION_DES_CIBLES];
const declaration: typeof import('./cibles-registres.mjs') = await import(nommee ? pathToFileURL(nommee).href : './cibles-registres.mjs');

/** Le module généré de la clé `cle`, au chemin que porte la déclaration. */
async function moduleGenere(cle: string): Promise<Record<string, unknown>> {
  const chemin = (declaration.SORTIES_DES_ESPACES as Readonly<Record<string, string>>)[cle] ?? declaration.REGISTRIES.find((r) => r.arrayName === cle)?.out;
  if (chemin === undefined) throw new Error(`module généré \`${cle}\` : aucune sortie de \`cibles-registres.mjs\` ne le déclare`);
  return import(pathToFileURL(join(RACINE, chemin)).href);
}

export const { IDS_PAR_ESPACE } = (await moduleGenere('ids')) as { IDS_PAR_ESPACE: Readonly<Record<string, readonly string[]>> };
export const { SCHEMA_DEFS } = (await moduleGenere('SCHEMA_DEFS')) as { SCHEMA_DEFS: SchemaDef[] };
export const { SCHEMA_DEFS_SCENES } = (await moduleGenere('SCHEMA_DEFS_SCENES')) as { SCHEMA_DEFS_SCENES: SchemaDef[] };
