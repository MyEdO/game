// LES TEXTES DES SOURCES SUIVIES (#5037) : les sources que `sourcesSuivies` (`modulesFeuilles.mjs`) nomme, lues pour les
// gardes qui balaient tout le dépôt. Celles de `projets/` passent par `readCorpus` sous la passe de tous les projets
// (`porteDesProjets.mjs`) : ces gardes sont des lecteurs de projet. Une source suivie mais supprimée de l'arbre n'a aucun
// code à lire ; toute autre erreur de lecture lève.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cheminAbsent } from './lister.mjs';
import { RACINE } from './modulesFeuilles.mjs';
import { porteDeTousLesProjets } from './porteDesProjets.mjs';
import { readCorpus } from './sourceCorpus.mjs';

const SOUS_LES_PROJETS = 'projets/';

/** Le texte de `rel` hors de `projets/`, ou `null` quand il n'est plus sur le disque. @param {string} rel */
function texteHorsDesProjets(rel) {
  try {
    return readFileSync(join(RACINE, rel), 'utf8');
  } catch (erreur) {
    if (cheminAbsent(erreur)) return null;
    throw erreur;
  }
}

/**
 * Les sources `suivies` (chemins POSIX relatifs au dépôt) présentes sur le disque, avec leur texte, dans l'ordre reçu.
 * @param {readonly string[]} suivies @returns {Pick<import('./sourceCorpus.mjs').CorpusFile, 'rel' | 'text'>[]}
 */
export function textesDesSourcesSuivies(suivies) {
  const projets = suivies.some((rel) => rel.startsWith(SOUS_LES_PROJETS))
    ? new Map(readCorpus([SOUS_LES_PROJETS], { tests: true, porte: porteDeTousLesProjets }).map((f) => [f.rel, f.text]))
    : new Map();
  return suivies.flatMap((rel) => {
    const text = rel.startsWith(SOUS_LES_PROJETS) ? projets.get(rel) ?? null : texteHorsDesProjets(rel);
    return text === null ? [] : [{ rel, text }];
  });
}
