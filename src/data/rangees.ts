/**
 * PORTE UNIQUE des rangées d'un document à RANGÉES (`options.rangee`, `schemas/grammaire/document.ts`) :
 * la collection VIVANTE du module JSON que le lecteur importe (singleton ESM, la racine que le seam
 * mute EN PLACE, `overrides.ts`), jamais une copie. Son type est DÉRIVÉ du schéma de rangée que le def
 * exporte (`export const rangee`) : un lecteur ne re-déclare ni la forme d'une rangée ni l'enveloppe
 * du fichier. Le def se passe par son TYPE (`import type * as def from './schemas/defs/<fichier>'`).
 */
import type { z } from 'zod';
import type { DocumentARangees, FamilleDocument } from './schemas/grammaire/document';

/** Le module d'un def de document à rangées : sa famille et le schéma de sa rangée. */
interface DefARangees {
  readonly famille: FamilleDocument;
  readonly rangee: z.ZodType<{ id: string }>;
}

/** Une rangée du document du def `D`. */
export type RangeeDe<D extends DefARangees> = z.output<D['rangee']>;

/** L'adresse du document dans son fichier : rien quand le fichier EST le document (`config`), l'id du
 *  DOCUMENT quand le fichier en porte plusieurs (`entite`, `miscast.json`). */
type AdresseDuDocument<D extends DefARangees> = D['famille'] extends 'entite' ? [idDuDocument: string] : [];

/** Les rangées VIVANTES du document de `D` dans `racine`, le module JSON de son fichier — FAIL-FAST : un
 *  document absent laisserait un lecteur sur un tableau vide, sans un mot. */
export function rangeesDe<D extends DefARangees>(racine: object, ...adresse: AdresseDuDocument<D>): RangeeDe<D>[] {
  const lue = racine as DocumentARangees<RangeeDe<D>> | DocumentARangees<RangeeDe<D>>[];
  const [id] = adresse;
  const document = Array.isArray(lue) ? lue.find((d) => d.id === id) : lue;
  if (!Array.isArray(document?.entries)) {
    throw new Error(`rangeesDe : aucun document à rangées${id === undefined ? '' : ` « ${id} »`} dans la racine (ids : ${(Array.isArray(lue) ? lue : [lue]).map((d) => d.id).join(', ')}).`);
  }
  return document.entries;
}
