import { replier } from './ordre.mjs';

/**
 * Normalisation d'un nom pour comparaison robuste : le repli de `replier` (`src/lib/ordre.mjs` —
 * marques, casse, ligatures), espaces de bord ôtés.
 */
export const norm = (s: string): string => replier(s).trim();
