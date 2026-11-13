/**
 * PORTE UNIQUE d'un dataset entier (`schemas/grammaire/document.ts`), sœur de `rangeesDe`
 * (`src/data/rangees.ts`) : le module JSON VIVANT que le lecteur importe (singleton ESM, la racine que
 * le seam mute EN PLACE, `overrides.ts`), jamais une copie. Son type est DÉRIVÉ du schéma que le def
 * exporte (`export const schema`, `DatasetDuDocument`) : un lecteur ne re-déclare ni la forme d'une
 * entrée ni son enveloppe. Le def se passe par son TYPE (`import type * as def from './schemas/defs/<fichier>'`).
 */
import type { z } from 'zod';

/** Le module d'un def de document : le schéma de son fichier. */
interface DefDeDocument {
  readonly schema: z.ZodType;
}

/** Le dataset du def `D`, tel que son fichier le porte. */
export type DatasetDe<D extends DefDeDocument> = z.output<D['schema']>;

/** Une ENTRÉE du dataset de `D` : l'élément de la liste (`entite`), le document lui-même ailleurs. */
export type EntreeDe<D extends DefDeDocument> = DatasetDe<D> extends readonly (infer E)[] ? E : DatasetDe<D>;

/** Le dataset VIVANT de `D` : `racine`, le module JSON de son fichier, au type de son schéma — qui
 *  valide le fichier commité (`src/data/schemas/validate.test.ts`) et toute écriture du seam
 *  (`overrides.ts`). */
export function datasetDe<D extends DefDeDocument>(racine: object): DatasetDe<D> {
  return racine as DatasetDe<D>;
}
