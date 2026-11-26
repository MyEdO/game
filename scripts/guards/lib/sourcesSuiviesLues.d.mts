import type { CorpusFile } from './sourceCorpus.mjs';
/** Les sources suivies présentes sur le disque, avec leur texte ; celles de `projets/` lues par la porte des projets. */
export function textesDesSourcesSuivies(suivies: readonly string[]): Pick<CorpusFile, 'rel' | 'text'>[];
