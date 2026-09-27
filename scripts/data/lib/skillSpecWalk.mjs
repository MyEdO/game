/**
 * Marche PARTAGÉE des `skills[].spec` / `talents[].spec` d'une entrée de catalogue (créature, niveau
 * de Carrière, espèce) et bornage du périmètre « livre EXTRAIT dans `Source/` » (#1342 L2-a).
 *
 * UNE implémentation, TROIS consommateurs de la marche : les migrations `scripts/migrations/
 * 2026-08-23-specs-livres-autorises.mjs` (l.177) et `scripts/migrations/
 * 2026-08-23-specs-frenchy-vers-catalogue.mjs` (l.237), et la garde `src/data/refs-migrated.test.ts`.
 * Une marche dupliquée entre le geste et sa garde, c'est une garde qui mesure autre chose que le geste.
 *
 * Module ESM chargé par Node nu — typé par `skillSpecWalk.d.mts`. Son seul import hors `node:` est la
 * maison du NUMÉRO DE CHAPITRE (`src/data/source/decoupe.ts`), module PUR à syntaxe effaçable que le
 * dépôt charge déjà tel quel sous Node nu comme sous vitest.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { estNomDExtraction, numeroDuFichier } from '../../../src/data/source/decoupe.ts';
import { sourceDirOf } from '../../raw/_lib.mjs';

/** Casse/accents neutralisés — comparaison de LIBELLÉS uniquement. */
export function norm(s) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}

/** Sentinelle « (Au choix) » : un emplacement de spéc, pas une spéc. */
export function isSentinel(s) {
  return norm(s) === 'au choix';
}

/**
 * Le tableau `of` d'un `{ pick, of }` PROLONGE son porteur : ses branches sont des références du
 * MÊME champ (`skills`). Toute autre clé-tableau ouvre un nouveau porteur, tout autre objet le ferme.
 */
const porteurDe = (k, v, arrKey) => (Array.isArray(v) ? (k === 'of' ? arrKey : k) : null);

/**
 * Visite tout nœud `{ id, spec?, choix? }` vivant sous un tableau `arrName` de `entry` (branches d'un
 * `{ pick, of }` comprises). `visit(node)` reçoit le nœud MUTABLE. `arrName` PARAMÈTRE le porteur :
 * `skills` (défaut) ou `talents` — même marche, même vocabulaire de nœud (#1457 B1).
 */
export function walkSkillRefs(entry, visit, arrName = 'skills') {
  const walk = (node, arrKey) => {
    if (Array.isArray(node)) return node.forEach((x) => walk(x, arrKey));
    if (!node || typeof node !== 'object') return;
    if (arrKey === arrName && typeof node.id === 'string') visit(node);
    for (const [k, v] of Object.entries(node)) walk(v, porteurDe(k, v, arrKey));
  };
  walk(entry, null);
}

/** Le tableau `skills` PORTEUR d'un nœud donné, pour un retrait par `splice` (jamais `delete`). */
export function skillArraysOf(entry) {
  const out = [];
  const walk = (node, arrKey) => {
    if (Array.isArray(node)) {
      if (arrKey === 'skills') out.push(node);
      return node.forEach((x) => walk(x, arrKey));
    }
    if (!node || typeof node !== 'object') return;
    for (const [k, v] of Object.entries(node)) walk(v, porteurDe(k, v, arrKey));
  };
  walk(entry, null);
  return out;
}

/** Un chapitre d'extraction est un `NN - ….md` à la racine du dossier du livre. */
function aDesChapitres(dir) {
  try { return readdirSync(dir).some((f) => numeroDuFichier(f) != null); } catch { return false; }
}

/**
 * Ids des livres dont l'extraction EXISTE SUR DISQUE (`books.json#dir` pointant un dossier qui
 * porte des chapitres), mesuré sous `root`. Le `dir` seul ne suffit pas : un clone sans `Source/`
 * rendrait le périmètre vide en silence — d'où `nonExtraits`, la contre-mesure du même passage.
 */
export function extractedBooks(books, root) {
  const extraits = new Set();
  const dirManquant = [];
  for (const b of books) {
    const dir = sourceDirOf(b);
    if (!dir) continue;
    const abs = join(root, dir);
    if (existsSync(abs) && aDesChapitres(abs)) extraits.add(b.id);
    else dirManquant.push(b.id);
  }
  return { extraits, dirManquant };
}

/** Mots-outils français, comptés sur un échantillon de chapitres : mesure du 2026-08-23 sur les 90
 *  dossiers de `Source/` — 10,5 à 21,0 pour les 20 extractions FR, 0,0 pour les 70 VO. */
const FR_MOTS_OUTILS = /\b(les|des|une|dans|vous|est|sont|avec|pour|qui)\b/gi;
const FR_SEUIL = 5;

/** Densité de mots-outils FR pour 1000 caractères, sur les 3 premiers fichiers d'extraction d'un
 *  dossier — index COMPRIS : la langue se lit sur ce que le dossier porte, et la FENÊTRE de trois
 *  fichiers est l'oracle (l'écarter décalerait l'échantillon d'un rang, cf. le dossier VO
 *  `Enemy Within Campaign Volume 5`, dont le 4ᵉ fichier est un `03 - Introduction.fr.md`). */
function densiteFR(dir) {
  const ech = readdirSync(dir)
    .filter(estNomDExtraction)
    .sort()
    .slice(0, 3)
    .map((f) => readFileSync(join(dir, f), 'utf8').slice(0, 20000))
    .join('\n');
  return (ech.match(FR_MOTS_OUTILS) ?? []).length / Math.max(1, ech.length / 1000);
}

/** Dossiers d'extraction FR présents sous `Source/`, reconnus au CONTENU (le nom ne dit pas la
 *  langue : `Warhammer - Habitants & Creatures  du Vieux-Monde (Discord) PDF` est FR sans porter
 *  aucun préfixe du dépôt). */
export function frenchSourceDirs(root) {
  try {
    return readdirSync(join(root, 'Source'), { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => `Source/${e.name}`)
      .filter((d) => aDesChapitres(join(root, d)) && densiteFR(join(root, d)) >= FR_SEUIL)
      .sort();
  } catch { return []; }
}
