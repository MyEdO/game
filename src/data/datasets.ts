/**
 * PORTE UNIQUE d'un dataset entier (`schemas/grammaire/document.ts`), sœur de `rangeesDe`
 * (`src/data/rangees.ts`) : le module JSON VIVANT que le lecteur importe (singleton ESM, la racine que
 * le seam mute EN PLACE, `overrides.ts`), jamais une copie. Son type est DÉRIVÉ du schéma que le def
 * exporte (`export const schema`, `DatasetDuDocument`) : un lecteur ne re-déclare ni la forme d'une
 * entrée ni son enveloppe. Le def se passe par son TYPE (`import type * as def from './schemas/defs/<fichier>'`).
 */
import type { z } from 'zod';
import type { IdsParEspace } from './schemas/_ids.generated';

/** Le module d'un def de document : le schéma de son fichier, et ce fichier. */
interface DefDeDocument {
  readonly schema: z.ZodType;
  readonly file?: string;
}

/** Le fichier de `D` quand il ouvre un espace d'ids générés (`IdsParEspace`), `never` sinon. */
type EspaceDuFichier<D extends DefDeDocument> = D extends { readonly file: infer F extends keyof IdsParEspace } ? F : never;

/** Les sous-listes générées de l'espace `F` que nomme un champ de l'entrée `E` (`garde-robe.json?kind=piece`). */
type SousListesDe<E, F extends string> = { [K in keyof E]-?: Exclude<E[K], undefined> extends string ? Extract<`${F}?${K & string}=${Exclude<E[K], undefined>}`, keyof IdsParEspace> : never }[keyof E];

/** L'id FERMÉ de l'entrée `E` de l'espace `F` : l'union GÉNÉRÉE (`IdsParEspace`), instantané au commit, des sous-listes
 *  que ses champs nomment, de l'espace entier à défaut. */
type IdFerme<E, F extends keyof IdsParEspace> = IdsParEspace[[SousListesDe<E, F>] extends [never] ? F : SousListesDe<E, F>];

/** L'entrée `E`, son `id` pris dans `I`. */
type AvecId<E, I> = { [K in keyof E]: K extends 'id' ? I : E[K] };

/** Le dataset du def `D`, tel que son fichier le porte ; une liste d'entrées y prend, cas par cas, l'id fermé de son espace
 *  (`IdFerme`). */
export type DatasetDe<D extends DefDeDocument> =
  z.output<D['schema']> extends readonly (infer E)[]
    ? ([EspaceDuFichier<D>] extends [never] ? E : E extends unknown ? AvecId<E, IdFerme<E, EspaceDuFichier<D>>> : never)[]
    : z.output<D['schema']>;

/** Une entrée écrite au régime VIVANT (le seam, `overrides.ts`, qui la valide au schéma) : son id n'est pas tenu à
 *  l'instantané du commit (`IdFerme`). */
export type EntreeVivante<E> = E extends { readonly id: string } ? Omit<E, 'id'> & { id: string } : E;

/** Une ENTRÉE du dataset de `D` : l'élément de la liste (`entite`), le document lui-même ailleurs. */
export type EntreeDe<D extends DefDeDocument> = DatasetDe<D> extends readonly (infer E)[] ? E : DatasetDe<D>;

/** Le dataset VIVANT de `D` : `racine`, le module JSON de son fichier, au type de son schéma — qui
 *  valide le fichier commité (`src/data/schemas/validate.test.ts`) et toute écriture du seam
 *  (`overrides.ts`). */
export function datasetDe<D extends DefDeDocument>(racine: object): DatasetDe<D> {
  return racine as DatasetDe<D>;
}
