/**
 * LIVRES EXTRAITS (#1389 Lot A, épique #1388) — les livres dont le texte est sur disque sous
 * `Source/`, donc les seuls qu'une adresse de prose (`descRef`) peut désigner. La liste n'est pas
 * écrite : elle est DÉRIVÉE de `books.json` par la définition unique `estLivreExtrait`
 * (`src/data/source/livre-extrait.ts`, #1739), que l'outillage ré-exporte de `scripts/raw/_lib.mjs`.
 *
 * Consommé par le verrou de RÉSOLUBILITÉ de `grammaire/prose.ts` : une adresse dans un livre sans
 * extraction est irrésoluble, et se refuse au PARSE plutôt qu'à la lecture.
 */
import booksJson from '../../books.json';
import { memoParVersion } from '../../versionDataset';
import { estLivreExtrait, type EntreeDeLivre } from '../../source/livre-extrait';

/** Ids des livres EXTRAITS du registre vivant. */
export const extraits = memoParVersion('books', (): ReadonlySet<string> => new Set(
  (booksJson as (EntreeDeLivre & { id: string })[])
    .filter(estLivreExtrait)
    .map((b) => b.id),
));

/** Ce livre a-t-il une extraction sur disque ? (`undefined` — pas de livre — n'en est pas une.) */
export function estExtrait(bookId: string | undefined): boolean {
  return bookId !== undefined && extraits().has(bookId);
}
