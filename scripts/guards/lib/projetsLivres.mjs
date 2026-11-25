// LE CORPUS DES PROJETS DE CAMPAGNE LIVRÉS — `projets/**/<x>-projet.json`, déclaré UNE fois (#4936).
//
// Gardes, tests et générateurs de docs lisent « les projets livrés » ICI, jamais dans une liste tenue à
// la main : une liste manque le projet suivant en silence. Le DESCRIPTEUR (dossier + suffixe + récursivité) est composé tel quel par les racines de
// documents de prose (`RACINES_PROSE`, `proseInline.mjs`) ; `listerProjetsLivres` en rend les chemins, dans l'ordre
// total de `lister.mjs`, et `cheminsDesProjetsLivres` les mêmes relatifs au dépôt, le corpus qu'une suite du jeu passe
// aux mesures à paquets en paramètre (`listerDocuments`, `scripts/docs/lib/structures-scan.mts`).
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { listerArbre } from './lister.mjs';

/** Racine du dépôt, déduite de l'emplacement de ce module (`scripts/guards/lib`). */
const RACINE_DEPOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

/** Le corpus, en descripteur entier : dossier (relatif à la racine du dépôt), suffixe, récursivité. */
export const PROJETS_LIVRES = Object.freeze({ dossier: 'projets', suffixe: '-projet.json', recursif: true });

/** Le projet livré `rel` (relatif au dossier du corpus, tel que `listerProjetsLivres` le rend) est-il MANUSCRIT : aucun
 *  générateur n'est son voisin (`generate.mjs` dans son dossier), l'éditeur l'écrit (`hotes/godot/servir.mjs`,
 *  `depot/`) ; sinon il est l'artefact de son générateur. */
export const estManuscrit = (rel, racine = RACINE_DEPOT) =>
  !existsSync(path.join(dossierDesProjetsLivres(racine), path.dirname(rel), 'generate.mjs'));

/** Dossier ABSOLU du corpus sous `racine` (le dépôt par défaut). */
export function dossierDesProjetsLivres(racine = RACINE_DEPOT) {
  return path.join(racine, PROJETS_LIVRES.dossier);
}

/**
 * Chemins des projets livrés, RELATIFS au dossier du corpus (`jeu-de-role/campagnes/arene/arene-projet.json`), séparateur
 * `/`, triés par unités de code. Un dossier absent LÈVE : un corpus vide ne passe jamais pour un
 * corpus propre.
 * @param {string} [racine] racine du dépôt (le dépôt par défaut).
 * @returns {string[]}
 */
export function listerProjetsLivres(racine = RACINE_DEPOT) {
  return listerLeCorpus(PROJETS_LIVRES, racine);
}

/** Les documents du corpus `corpus` sous `racine`, RELATIFS à son dossier, séparateur `/`, triés par unités de code.
 *  Un dossier absent LÈVE. */
const listerLeCorpus = (corpus, racine) =>
  listerArbre(path.join(racine, corpus.dossier), { descendre: () => corpus.recursif, filtre: (rel) => rel.endsWith(corpus.suffixe) });

/**
 * Les documents du corpus `corpus` (descripteur entier : dossier relatif à la racine, suffixe, récursivité) en chemins
 * RELATIFS à `racine` (`projets/jeu-de-role/campagnes/arene/arene-projet.json`), dans l'ordre de `listerProjetsLivres`. Un dossier absent
 * LÈVE.
 * @param {{ readonly dossier: string, readonly suffixe: string, readonly recursif: boolean }} corpus
 * @param {string} [racine] racine du dépôt (le dépôt par défaut).
 * @returns {string[]}
 */
export const cheminsDuCorpus = (corpus, racine = RACINE_DEPOT) =>
  listerLeCorpus(corpus, racine).map((rel) => `${corpus.dossier}/${rel}`);

/** Les projets livrés en chemins RELATIFS à `racine`, le corpus que les suites du jeu passent aux gardes et aux mesures
 *  (`paquetsDuCommun`, `paquetsDuCommun.mjs`, en est le défaut). */
export const cheminsDesProjetsLivres = (racine = RACINE_DEPOT) => cheminsDuCorpus(PROJETS_LIVRES, racine);
