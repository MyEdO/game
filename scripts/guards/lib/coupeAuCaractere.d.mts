import type { CorpusFile } from './sourceCorpus.mjs';

export function coupesAuCaractere(fichiers: readonly Pick<CorpusFile, 'rel' | 'text'>[]): string[];
