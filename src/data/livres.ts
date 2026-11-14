/**
 * LE REGISTRE DES LIVRES (`books.json`), lu UNE fois, à la couche la plus basse qui le lit : le verrou de
 * résolubilité des adresses de prose (`schemas/grammaire/livres-extraits.ts`) comme les lecteurs de `src/data/index.ts`.
 */
import booksJson from './books.json';
import { datasetDe } from './datasets';
import type * as booksDef from './schemas/defs/books';

/** Le registre VIVANT des livres, au type de son schéma. */
export const books = datasetDe<typeof booksDef>(booksJson);
