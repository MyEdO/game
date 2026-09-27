import type { SourceFile } from 'typescript';

export interface Finding {
  line: number;
  detail: string;
}

/** Fichier de corpus, tel que rendu par `readCorpus` (`sourceCorpus.mjs`). */
export interface ScannedFile {
  rel: string;
  text: string;
}

export const SCHEMAS_DU_CANON: string[];
export function scanUnionRecopies(
  file: ScannedFile,
  canons: { nom: string; membres: readonly string[] }[],
  arbres?: Map<object, SourceFile>,
): Finding[];
export function scanChebyshevFormula(file: ScannedFile, arbres?: Map<object, SourceFile>): Finding[];
