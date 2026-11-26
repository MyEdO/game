/**
 * LIVRES EXTRAITS (#1389 Lot A, épique #1388) — les livres dont le texte est sur disque sous
 * `Source/`, donc les seuls qu'une adresse de prose (`descRef`) peut désigner. La liste n'est pas
 * écrite : elle est DÉRIVÉE du registre `books.json` du catalogue jugé par la définition unique `estLivreExtrait`
 * (`src/data/schemas/source/livre-extrait.ts`, #1739), que l'outillage ré-exporte de `scripts/raw/_lib.mjs`.
 *
 * Consommé par le verrou de RÉSOLUBILITÉ de `grammaire/prose.ts` : une adresse dans un livre sans
 * extraction est irrésoluble, et se refuse au PARSE plutôt qu'à la lecture.
 */
import { entreeDe, type Catalogue } from '../catalogue/catalogue';
import { estLivreExtrait } from '../source/livre-extrait';

/** Ce livre de `cat` a-t-il une extraction sur disque ? (`undefined` — pas de livre — n'en est pas une.) */
export function estExtrait(bookId: string | undefined, cat: Catalogue): boolean {
  return estLivreExtrait(entreeDe('books', bookId, cat));
}
