// LE CORPUS DES PROJETS DE CAMPAGNE LIVRÉS — `src/scenes/**/<x>-projet.json`, déclaré UNE fois.
//
// Gardes, tests et générateurs de docs lisent « les projets livrés » ICI, jamais dans une liste tenue à
// la main : une liste manque le projet suivant en silence. Le DESCRIPTEUR (dossier + suffixe + récursivité) est composé tel quel par les racines de
// documents de prose (`RACINES_PROSE`, `proseInline.mjs`) ; `listerProjetsLivres` en rend les chemins, dans l'ordre
// total de `lister.mjs`, et `cheminsDesProjetsLivres` les mêmes relatifs au dépôt, le corpus qu'une suite du jeu passe
// aux mesures à paquets en paramètre (`listerDocuments`, `scripts/docs/lib/structures-scan.mts`).
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { listerArbre } from './lister.mjs';

/** Racine du dépôt, déduite de l'emplacement de ce module (`scripts/guards/lib`). */
const RACINE_DEPOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

/** Le corpus, en descripteur entier : dossier (relatif à la racine du dépôt), suffixe, récursivité. */
export const PROJETS_LIVRES = Object.freeze({ dossier: 'src/scenes', suffixe: '-projet.json', recursif: true });

/** Les projets livrés AUTHORÉS à la main, par nom de fichier, chacun avec son motif : aucun générateur
 *  (`scripts/<dossier>/generate.mjs`) ne les produit, l'éditeur les écrit (`hotes/godot/servir.mjs`, `depot/`). Les
 *  autres sont les artefacts de leur générateur (`src/scenes/generateurs-byte-stables.test.ts`). */
export const PROJETS_MANUSCRITS = Object.freeze({
  'diligence-projet.json': 'authoré sans générateur (édité au studio, aucun script ne le réécrit)',
});

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
  return listerLeCorpus(PROJETS_LIVRES, racine);
}

/** Les documents du corpus `corpus` sous `racine`, RELATIFS à son dossier, séparateur `/`, triés par unités de code.
 *  Un dossier absent LÈVE. */
const listerLeCorpus = (corpus, racine) =>
  listerArbre(path.join(racine, corpus.dossier), { descendre: () => corpus.recursif, filtre: (rel) => rel.endsWith(corpus.suffixe) });

/**
 * Les documents du corpus `corpus` (descripteur entier : dossier relatif à la racine, suffixe, récursivité) en chemins
 * RELATIFS à `racine` (`src/scenes/arene/arene-projet.json`), dans l'ordre de `listerProjetsLivres`. Un dossier absent
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
