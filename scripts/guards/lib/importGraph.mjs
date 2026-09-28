// Mécanique de graphe d'imports PARTAGÉE (extraite de `scripts/docs/build-systemes.mjs`, #298) —
// résolution d'un import relatif vers un fichier source réel + closure transitive depuis un jeu de
// modules racines, bornée à `src/`. RÉUTILISÉE par `genericDomainImport.mjs` (#329) : jamais un 2ᵉ
// parseur d'imports. Module ESM pur (node nu).

import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { typescript } from './dialecte.mjs';

// Extensions de MODULE que le dépôt écrit réellement : les libs de garde et les générateurs vivent en
// `.mjs` (109 imports relatifs de `src/**` vers `scripts/**` mesurés le 2026-09-02), donc `.mjs`/`.cjs`
// font partie de ce qu'un spécificateur relatif peut désigner ici.
const EXTS = ['.ts', '.tsx', '.mts', '.mjs', '.cjs', '.js'];

/** Capture les imports/réexports statiques (`from '…'`), dynamiques (`import('…')`, ex. `lazy`) et À
 *  EFFET DE BORD (`import './x'`, sans `from` — il n'en existe aucun dans la clôture aujourd'hui,
 *  mais un module ainsi tiré serait invisible de la marche, donc du mur d'ordre total #1679 L3b).
 *  Spécificateur en m[1] (statique), m[2] (dynamique) ou m[3] (effet de bord, RELATIF seulement).
 *  @type {RegExp} */
export const IMPORT_RE = /\bfrom\s+['"]([^'"]+)['"]|\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)|\bimport\s+['"](\.[^'"]+)['"]/g;

/** Options de compilation du DÉPÔT (`tsconfig.json`), converties par le compilateur lui-même : c'est
 *  d'elles (`isolatedModules`, `verbatimModuleSyntax`, `preserveValueImports`…) que dépend l'effacement
 *  d'un import. Lues au PREMIER `sourceALExecution`, comme le compilateur (`typescript()`) : la
 *  clôture sans `typesEffaces` ne charge aucun paquet npm. */
const TSCONFIG_URL = new URL('../../../tsconfig.json', import.meta.url);
let compilerOptions = null;
const optionsDuDepot = () =>
  (compilerOptions ??= typescript().convertCompilerOptionsFromJson(
    JSON.parse(readFileSync(TSCONFIG_URL, 'utf8')).compilerOptions,
    dirname(fileURLToPath(TSCONFIG_URL)),
  ).options);

/**
 * Le source tel que la COMPILATION l'émet : `ts.transpileModule` (le compilateur DÉCLARÉ du dépôt,
 * fichier par fichier comme le bundler en `isolatedModules`) sous les options du dépôt. Tout import
 * que la compilation EFFACE en est absent — `import type`, spécifieur `type`, import dont les liaisons
 * ne servent qu'au typage, `import('…')` en position de type — et un import à EFFET DE BORD y reste.
 * Oracle, pas heuristique : c'est ce que demande un appelant qui suit un EFFET DE MODULE (une
 * configuration posée au chargement), sans quoi il conclut à une atteignabilité que le bundle ne
 * réalise pas. Un module JS n'a aucun arc de type : il est rendu tel quel.
 * @param {string} fichier chemin (son extension choisit TS ou TSX) @param {string} texte
 * @returns {string}
 */
export function sourceALExecution(fichier, texte) {
  if (!/\.[cm]?tsx?$/.test(fichier)) return texte;
  return typescript().transpileModule(texte, { fileName: fichier, compilerOptions: optionsDuDepot() }).outputText;
}

/** Extensions qu'un spécificateur peut porter LUI-MÊME (le chemin désigne alors le fichier). */
const EXTS_EXPLICITES = [...EXTS, '.json'];
/** Source TypeScript d'un spécificateur à extension JS émise : `./x.mjs` désigne `x.mts` quand
 *  `x.mjs` n'existe pas (TypeScript, `moduleResolution: "bundler"`, Handbook « Modules Reference »,
 *  extension substitution) — la forme de `src/**` vers `scripts/docs/lib/*.mts`. */
const EXTS_TS_DE = { '.js': ['.ts', '.tsx'], '.mjs': ['.mts'], '.cjs': ['.cts'] };

/**
 * Résout un spécificateur d'import RELATIF (`./foo`, `../bar`) vers un fichier source réel :
 * spécificateur portant DÉJÀ son extension (`./x.mjs`, `./data.json` — la forme des 109 imports de
 * `src/**` vers les libs de garde) ou, absent, sa source TypeScript (`EXTS_TS_DE`), sinon extension
 * déduite d'`EXTS`, sinon repli `index.*`. Les
 * paquets npm / alias non-relatifs renvoient `null` (hors périmètre — pas résolus ici).
 * @param {string} fromFile @param {string} spec @returns {string|null}
 */
export function resolveImport(fromFile, spec) {
  if (!spec.startsWith('.')) return null;
  const base = resolve(dirname(fromFile), spec);
  if (EXTS_EXPLICITES.some((e) => spec.endsWith(e))) {
    if (existsSync(base)) return base.split('\\').join('/');
    const [, radical, ext] = /^(.*)(\.[^./\\]+)$/.exec(base);
    const source = (EXTS_TS_DE[ext] ?? []).map((e) => radical + e).find((f) => existsSync(f));
    return source ? source.split('\\').join('/') : null;
  }
  for (const ext of EXTS) if (existsSync(base + ext)) return (base + ext).split('\\').join('/');
  if (existsSync(base) && existsSync(join(base, 'index.ts'))) return join(base, 'index.ts').split('\\').join('/');
  for (const ext of EXTS) if (existsSync(join(base, 'index' + ext))) return join(base, 'index' + ext).split('\\').join('/');
  return null;
}

/**
 * Enfants d'un module : TOUS ses imports relatifs résolus, sans borne. `null` = fichier absent (hors
 * closure) ; `[]` = membre sans graphe à lire (`.json`, #487) ou illisible.
 * `typesEffaces` lit le source À L'EXÉCUTION (`sourceALExecution`) : les arcs effacés n'y sont plus.
 * `dynamiques` faux écarte les `import('…')` (m[2]) : il reste les arcs que le CHARGEMENT lie.
 * @param {string} abs @param {string} rel @param {boolean} typesEffaces @param {boolean} dynamiques
 * @returns {string[]|null}
 */
function enfantsDe(abs, rel, typesEffaces, dynamiques) {
  if (!existsSync(abs)) return null;
  if (rel.endsWith('.json')) return [];
  let text;
  try {
    text = readFileSync(abs, 'utf8');
  } catch {
    return [];
  }
  if (typesEffaces) text = sourceALExecution(abs, text);
  const enfants = [];
  for (const m of text.matchAll(IMPORT_RE)) {
    if (m[2] !== undefined && !dynamiques) continue;
    const resolved = resolveImport(abs, m[1] ?? m[2] ?? m[3]);
    if (resolved) enfants.push(resolved);
  }
  return enfants;
}

/**
 * MARCHE du graphe d'imports RELATIFS depuis un jeu de modules racines : résolution + parcours
 * transitif, sans borne. La borne est un PRÉDICAT de l'appelant (`retenir`, appliqué aux ENFANTS —
 * les racines entrent toujours) : un seul hôte, aucune branche par type d'appelant.
 * `cache` (module -> enfants résolus) est PARTAGEABLE entre plusieurs marches d'un MÊME appelant :
 * les 16 systèmes de `systemes.manifest.json` visitent 21 197 modules pour 1 859 distincts (mesuré le
 * 2026-08-23) — sans partage, chaque fichier est relu et re-résolu 11 fois. Le cache porte les
 * enfants NON filtrés : il reste valable quel que soit le prédicat. Par défaut le cache naît et
 * meurt avec l'appel : aucun état ne survit entre deux marches indépendantes.
 * `typesEffaces` marche les arcs d'EXÉCUTION seuls (cf. `sourceALExecution`) : c'est ce que demande un
 * appelant qui suit un EFFET DE MODULE plutôt qu'une dépendance de typage. Le cache porte les enfants
 * SOUS CE RÉGIME : deux marches de régimes différents ne le partagent pas.
 * `dynamiques: false` marche la clôture STATIQUE, celle qu'ESM charge et lie avant d'évaluer quoi
 * que ce soit (ECMA-262, Cyclic Module Records : `Link` avant `Evaluate`) : un `import('…')` n'y entre pas.
 * @param {string[]} roots
 * @param {{ retenir?: (abs: string) => boolean, cache?: Map<string, string[]|null>, typesEffaces?: boolean, dynamiques?: boolean }} [options]
 * @returns {Set<string>} chemins POSIX relatifs à la racine du repo
 */
export function clotureDImports(roots, { retenir, cache = new Map(), typesEffaces = false, dynamiques = true } = {}) {
  const seen = new Set();
  const cwdPosix = resolve('.').split('\\').join('/') + '/';
  const stack = [...roots.map((r) => resolve(r).split('\\').join('/'))];
  while (stack.length) {
    const abs = stack.pop();
    // Racine HORS repo (fixtures de test en tmpdir) : chemin absolu POSIX, jamais tronque a l aveugle.
    const rel = abs.startsWith(cwdPosix) ? abs.slice(cwdPosix.length) : abs;
    if (seen.has(rel)) continue;
    let enfants = cache.get(abs);
    if (enfants === undefined) {
      enfants = enfantsDe(abs, rel, typesEffaces, dynamiques);
      cache.set(abs, enfants);
    }
    if (enfants === null) continue;
    seen.add(rel);
    for (const e of enfants) if (!retenir || retenir(e)) stack.push(e);
  }
  return seen;
}

/**
 * Closure transitive des imports RELATIFS depuis un jeu de modules racines, bornée à `src/` : la
 * MARCHE ci-dessus, avec le prédicat `src/` posé ici, par l'appelant.
 * @param {string[]} roots @param {Map<string, string[]|null>} [cache]
 * @returns {Set<string>} chemins POSIX relatifs à la racine du repo
 */
export function closureOf(roots, cache = new Map()) {
  return clotureDImports(roots, { retenir: (abs) => abs.includes('/src/'), cache });
}

/**
 * Imports RELATIFS directs (non transitifs) d'un fichier — résolus vers des chemins POSIX
 * relatifs à la racine du repo, dédupliqués, `src/`-only.
 * @param {string} fromFile @param {string} contenu @returns {string[]}
 */
export function directImportsOf(fromFile, contenu) {
  const root = resolve('.').split('\\').join('/');
  const found = new Set();
  for (const m of contenu.matchAll(IMPORT_RE)) {
    const resolved = resolveImport(fromFile, m[1] ?? m[2] ?? m[3]);
    if (resolved && resolved.includes('/src/')) found.add(resolved.slice(root.length + 1));
  }
  return [...found];
}
