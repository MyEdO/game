import type { CorpusFile } from './sourceCorpus.mjs';

/** Sites `{ ligne, texte }` d'un fichier qui recompose en ligne la graphie d'une bande de table
 *  (`${e.min}–${e.max}`, `{min}–{max}`) au lieu de `fourchette` (#1595). Contrat : en-tête de
 *  `bandeEnLigne.mjs`. */
export function sitesBandeEnLigne(f: Pick<CorpusFile, 'rel' | 'text'>, sourceFile?: import('typescript/unstable/ast').SourceFile): { ligne: number; texte: string }[];
