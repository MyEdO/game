export { parUnitesDeCode, parLibelle } from '../../../src/lib/ordre.mjs';
export type ListingType = { nature: 'directory' | 'absent' | 'other'; entrees: { nom: string; nature: 'file' | 'directory' | 'link' | 'other' }[] };
export function listerDossier(dir: string, options: { absent?: 'lever' | 'vide'; avecTypes: true }): ListingType;
export function listerDossier(dir: string, options?: { absent?: 'lever' | 'vide'; avecTypes?: false }): string[];
export function listerArbre(
  dir: string,
  options?: { filtre?: (rel: string) => boolean; descendre?: (rel: string) => boolean; absent?: 'lever' | 'vide' },
): string[];
