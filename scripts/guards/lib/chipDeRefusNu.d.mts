/** Sites `{ ligne, texte }` d'un `.tsx` dont un élément compose `chip` et `tone-danger` dans son
 *  `className` (#2404). Contrat : en-tête de `chipDeRefusNu.mjs`. */
export function sitesChipDeRefusNu(f: { rel: string; text: string }, sourceFile?: import('typescript/unstable/ast').SourceFile): { ligne: number; texte: string }[];
