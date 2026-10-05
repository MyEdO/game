// LE CORPUS DES PROJETS DE CAMPAGNE LIVRÉS — `src/scenes/**/<x>-projet.json`, déclaré UNE fois.
//
// Gardes, tests et générateurs de docs lisent « les projets livrés » ICI, jamais dans une liste tenue à
// la main : une liste manque le projet suivant en silence. Le DESCRIPTEUR (dossier + suffixe + récursivité) est composé tel quel par les racines de
// documents (`RACINES_PROSE`, `RACINES` du scan de structures) ; `listerProjetsLivres` en rend les
// chemins, dans l'ordre total de `lister.mjs`.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { listerArbre } from './lister.mjs';

/** Racine du dépôt, déduite de l'emplacement de ce module (`scripts/guards/lib`). */
const RACINE_DEPOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

/** Le corpus, en descripteur entier : dossier (relatif à la racine du dépôt), suffixe, récursivité. */
export const PROJETS_LIVRES = Object.freeze({ dossier: 'src/scenes', suffixe: '-projet.json', recursif: true });

/** Dossier ABSOLU du corpus sous `racine` (le dépôt par défaut). */
export function dossierDesProjetsLivres(racine = RACINE_DEPOT) {
  return path.join(racine, PROJETS_LIVRES.dossier);
}

/**
 * Chemins des projets livrés, RELATIFS au dossier du corpus (`arene/arene-projet.json`), séparateur
 * `/`, triés par unités de code. Un dossier absent LÈVE : un corpus vide ne passe jamais pour un
 * corpus propre.
 * @param {string} [racine] racine du dépôt (le dépôt par défaut).
 * @returns {string[]}
 */
export function listerProjetsLivres(racine = RACINE_DEPOT) {
  return listerArbre(dossierDesProjetsLivres(racine), {
    descendre: () => PROJETS_LIVRES.recursif,
    filtre: (rel) => rel.endsWith(PROJETS_LIVRES.suffixe),
  });
}
