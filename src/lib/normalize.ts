import { replier } from './ordre.mjs';

/**
 * Normalisation d'un nom pour comparaison robuste : le repli de `replier` (`src/lib/ordre.mjs` —
 * marques, casse, ligatures), espaces de bord ôtés.
 */
export const norm = (s: string): string => replier(s).trim();

/** Slug sûr pour un nom de fichier (accents retirés, espaces → tirets). */
export function fileSlug(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .toLowerCase() || 'sans-nom';
}
