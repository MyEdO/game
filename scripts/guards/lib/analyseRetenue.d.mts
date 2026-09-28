/** Fabriques de base : `repoProgram`, `virtualProgram`, les `create*Program`, `createLanguageService`,
 *  `createSourceFile`. */
export const FABRIQUES_D_ANALYSE: readonly string[];

/** Sources de CORPUS (`readCorpus`) : leur rendu est l'exception documentée, un dérivé ne l'est pas. */
export const SOURCES_DE_CORPUS: readonly string[];

/** Une liaison de portée de COLLECTION (module, rappel de `describe`, IIFE qui l'initialise) qui retient
 *  une structure d'analyse ou un dérivé de corpus (définition : en-tête de `analyseRetenue.mjs`). */
export interface RetentionDAnalyse {
  rel: string;
  line: number;
  liaison: string;
  forme: string;
}

/** Fabriques et sources de corpus EXPORTÉES du corpus scanné. */
export interface ExporteesDuCorpus {
  fabriques: Set<string>;
  corpus: Set<string>;
}

/** Fabriques et sources de corpus EXPORTÉES, par point fixe à travers les imports. */
export function fabriquesDuCorpus(fichiers: readonly { rel: string; text: string }[]): ExporteesDuCorpus;

/** Rétentions d'analyse du fichier `rel`. */
export function retentionsDAnalyse(rel: string, texte: string, exporteesDuCorpus?: ExporteesDuCorpus): RetentionDAnalyse[];
