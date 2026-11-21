import type { CorpusFile } from './sourceCorpus.mjs';

export interface MarcheurDeFlow {
  /** Chemin POSIX depuis la racine du dépôt. */
  file: string;
  /** Ligne du premier `switch` marcheur de la déclaration. */
  line: number;
  /** Déclaration de NIVEAU MODULE qui porte le `switch`. */
  fn: string;
}

export function scanMarcheursDeFlow(files: Pick<CorpusFile, 'rel' | 'text'>[]): MarcheurDeFlow[];
export function marcheurLabel(s: { file: string; fn: string }): string;
