import { specificateursDe } from './importGraph.mjs';

/** Fragments de SOURCE d'import interdits (le couplage naval redevient inexprimable). @type {string[]} */
export const FORBIDDEN_SOURCES = ['shipCrew', 'shipManeuver', 'crewMorale', 'crew-roles'];

/**
 * Capture les acquisitions littérales, valeur OU type, dont la
 * SOURCE contient un fragment naval interdit. Un `import type` compte : le but est zéro dépendance de
 * domaine, structurelle comprise.
 * @param {string} fichier @param {string} contenu @returns {{ line: number, source: string }[]}
 */
export function scanBatchNavalQuarantine(fichier, contenu) {
  return specificateursDe(fichier, contenu)
    .filter(({ spec }) => FORBIDDEN_SOURCES.some((fragment) => spec.includes(fragment)))
    .map(({ ligne, spec }) => ({ line: ligne, source: spec }));
}
