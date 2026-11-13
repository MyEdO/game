/**
 * PORTE UNIQUE des rangées d'un document à RANGÉES (`options.rangee`, `schemas/grammaire/document.ts`), et de
 * son dé de tirage (`options.deDeTirage`) :
 * la collection VIVANTE du module JSON que le lecteur importe (singleton ESM, la racine que le seam
 * mute EN PLACE, `overrides.ts`), jamais une copie. Son type est DÉRIVÉ du schéma que le def exporte
 * (`export const schema`, `DatasetDuDocument`) : un lecteur ne re-déclare ni la forme d'une rangée ni l'enveloppe
 * du fichier. Le def se passe par son TYPE (`import type * as def from './schemas/defs/<fichier>'`).
 */
import type { z } from 'zod';
import type { DocumentARangees, FamilleDocument } from './schemas/grammaire/document';
import { deDeLaTableTiree, type DeDeTable } from '../engine/tables';

/** Le module d'un def de document à rangées : sa famille, le schéma de sa rangée et celui de son fichier. */
interface DefARangees {
  readonly famille: FamilleDocument;
  readonly rangee: z.ZodType<object>;
  readonly schema: z.ZodType;
}

/** Un document du fichier du def `D`. */
type DocumentDuFichier<D extends DefARangees> = z.output<D['schema']> extends readonly (infer E)[] ? E : z.output<D['schema']>;

/** Une rangée du document du def `D`, telle que son schéma la garantit (charge par discriminant comprise). */
export type RangeeDe<D extends DefARangees> = DocumentDuFichier<D> extends { readonly entries: readonly (infer R)[] } ? R : never;

/** L'adresse du document dans son fichier : rien quand le fichier EST le document (`config`), l'id du
 *  DOCUMENT quand le fichier en porte plusieurs (`entite`, `miscast.json`). */
type AdresseDuDocument<D extends DefARangees> = D['famille'] extends 'entite' ? [idDuDocument: string] : [];

/** Le document de `D` dans `racine`, le module JSON de son fichier — FAIL-FAST : un document absent
 *  laisserait un lecteur sur un tableau vide, sans un mot. */
function documentDe<D extends DefARangees>(racine: object, adresse: AdresseDuDocument<D>): DocumentARangees<RangeeDe<D>> & { die?: string } {
  const lue = racine as DocumentARangees<RangeeDe<D>> | DocumentARangees<RangeeDe<D>>[];
  const [id] = adresse;
  const document = Array.isArray(lue) ? lue.find((d) => d.id === id) : lue;
  if (!Array.isArray(document?.entries)) {
    throw new Error(`rangeesDe : aucun document à rangées${id === undefined ? '' : ` « ${id} »`} dans la racine (ids : ${(Array.isArray(lue) ? lue : [lue]).map((d) => d.id).join(', ')}).`);
  }
  return document;
}

/** Les rangées VIVANTES du document de `D` dans `racine`. */
export function rangeesDe<D extends DefARangees>(racine: object, ...adresse: AdresseDuDocument<D>): RangeeDe<D>[] {
  return documentDe<D>(racine, adresse).entries;
}

/** Le DÉ DE TIRAGE du document de `D` dans `racine` (`options.deDeTirage`) : son `die` VIVANT, lu à
 *  l'appel — FAIL-FAST sur un document qui n'en porte pas. */
export function deDeTirageDe<D extends DefARangees>(racine: object, ...adresse: AdresseDuDocument<D>): DeDeTable {
  const document = documentDe<D>(racine, adresse);
  const { die } = document;
  if (die === undefined) throw new Error(`deDeTirageDe : le document « ${document.id} » ne porte aucun dé de tirage (\`die\`).`);
  return deDeLaTableTiree({ die, id: document.id });
}
