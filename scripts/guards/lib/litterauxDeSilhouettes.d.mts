import type { CorpusFile } from './sourceCorpus.mjs';

export const SOCLE: string;
export const RACINES: readonly string[];
export function corpusDesSilhouettes(): readonly CorpusFile[];
export function litterauxDe(texte: string, noms: readonly string[]): { ligne: number; texte: string }[];
