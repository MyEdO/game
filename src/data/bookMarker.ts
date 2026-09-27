/**
 * MARQUE DE PROVENANCE d'un libellé d'AUTHORING — « … (EDOC) », « … (ADE II) », « … (frenchy.bzh) ».
 *
 * SOURCE UNIQUE de la définition « référence de livre dans un libellé » (`docs/charte-ui.md` : « JAMAIS
 * de référence au livre dans un texte joueur ») : la PROJECTION qui la retire et la GARDE qui la
 * détecte sont la MÊME fonction — une seconde définition (tokenisation, liste écrite à la main)
 * diverge aussitôt de la première.
 *
 * Forme reconnue : un PARENTHÉSÉ FINAL dont le contenu est un sigle du catalogue (`books.json`, champ
 * `abbr` — espaces et points compris : « ADE I », « frenchy.bzh »). Un sigle rencontré HORS de cette
 * forme n'est PAS une référence : « Lustria » et « Salzemund » sont des `abbr` qui sont aussi des noms
 * du décor, qu'un libellé joueur a le droit de porter en clair.
 */
import booksJson from './books.json';
import { memoParVersion } from './versionDataset';
import { alternationDe } from '../lib/regex';

export const bookMarkerRx = memoParVersion('books', () => new RegExp(
  `\\s*\\((?:${alternationDe((booksJson as { abbr: string }[]).map((b) => b.abbr))})\\)\\s*$`,
));

/** Le libellé PRIVÉ de sa marque de provenance (inchangé s'il n'en porte pas). */
export function stripBookMarker(label: string): string {
  return label.replace(bookMarkerRx(), '');
}

/** Le libellé porte-t-il une marque de provenance ? (= la projection le change) */
export function hasBookMarker(label: string): boolean {
  return stripBookMarker(label) !== label;
}
