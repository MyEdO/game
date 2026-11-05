// GARDE « vocabulaire unique des silhouettes » (#3104) : un identifiant de silhouette ne s'écrit en
// littéral qu'au SOCLE, `hotes/godot/asset/silhouettes.ts`. La construction Python le lit par
// `noms_silhouettes.py` (opération `silhouettes` de `gabarit.mjs`), l'évaluateur et l'hôte par import.
// Banc et balayage : `hotes/godot/asset/litteraux-de-silhouettes-guard.hors-store.test.ts`.
// LIMITE : garde LEXICALE — un identifiant recomposé (`'carrure_' + sens`) lui échappe.

import { basename } from 'node:path';
import { estFichierVitest } from './fichierVitest.mjs';
import { readCorpus } from './sourceCorpus.mjs';

/** Le SOCLE : le seul fichier où les identifiants s'écrivent. */
export const SOCLE = 'hotes/godot/asset/silhouettes.ts';

/** Les racines balayées : producteurs et consommateurs du vocabulaire. */
export const RACINES = Object.freeze(['scripts/personnage-3d', 'hotes/godot']);

const EXTENSIONS = ['.py', '.ts', '.mts', '.mjs', '.js', '.gd'];

/** Le corpus balayé : le code des `RACINES`, testkits compris (un kit qui écrit un identifiant le redéclare
 *  comme le code), hors instruments Vitest (`estFichierVitest`), hors `test_*.py` et hors `SOCLE`. */
export const corpusDesSilhouettes = () =>
  readCorpus([...RACINES], { exts: EXTENSIONS, tests: true })
    .filter((f) => f.rel !== SOCLE && !estFichierVitest(f.rel) && !basename(f.rel).startsWith('test_'));

/** Les littéraux de `noms` (entre guillemets simples ou doubles) écrits dans `texte` : `[{ ligne, texte }]`,
 *  un par littéral, dans l'ordre du texte. PURE.
 *  @param {string} texte @param {readonly string[]} noms @returns {{ ligne: number, texte: string }[]} */
export function litterauxDe(texte, noms) {
  const motif = new RegExp(`(['"])(?:${noms.join('|')})\\1`, 'g');
  const lignes = texte.split('\n');
  return lignes.flatMap((ligne, i) => [...ligne.matchAll(motif)].map((m) => ({ ligne: i + 1, texte: m[0] })));
}
