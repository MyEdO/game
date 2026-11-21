import type { CorpusFile } from './sourceCorpus.mjs';

export function apisRetirees(declaration: string): string[];
export function usagesRetirees(fichiers: readonly Pick<CorpusFile, 'rel' | 'text'>[], noms: readonly string[]): string[];
