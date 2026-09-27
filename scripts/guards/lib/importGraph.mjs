// Mécanique de graphe d'imports PARTAGÉE (extraite de `scripts/docs/build-systemes.mjs`, #298) —
// résolution d'un import relatif vers un fichier source réel + closure transitive depuis un jeu de
// modules racines, bornée à `src/`. RÉUTILISÉE par `genericDomainImport.mjs` (#329) : jamais un 2ᵉ
// parseur d'imports. Module ESM pur (node nu).

import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { typescript } from './dialecte.mjs';

// Extensions de MODULE que le dépôt écrit réellement : les libs de garde et les générateurs vivent en
// `.mjs` (109 imports relatifs de `src/**` vers `scripts/**` mesurés le 2026-09-02), donc `.mjs`/`.cjs`
// font partie de ce qu'un spécificateur relatif peut désigner ici.
const EXTS = ['.ts', '.tsx', '.mts', '.mjs', '.cjs', '.js'];

/** Un MODULE de code : un chemin qu'`EXTS` termine — le seul que lit `IMPORT_RE` en importeur. */
export const estModule = (chemin) => EXTS.some((ext) => chemin.endsWith(ext));

/** Les pathspecs git des modules de code sous `dossier` (`EXTS`). @param {string} dossier */
export const pathspecsDeModules = (dossier) => EXTS.map((ext) => `${dossier}/*${ext}`);

/** Capture les imports/réexports statiques (`from '…'`), dynamiques (`import('…')`, ex. `lazy`) et À
 *  EFFET DE BORD (`import './x'`, sans `from` — il n'en existe aucun dans la clôture aujourd'hui,
 *  mais un module ainsi tiré serait invisible de la marche, donc du mur d'ordre total #1679 L3b).
 *  Spécificateur en m[1] (statique), m[2] (dynamique) ou m[3] (effet de bord, RELATIF seulement).
 *  @type {RegExp} */
export const IMPORT_RE = /\bfrom\s+['"]([^'"]+)['"]|\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)|\bimport\s+['"](\.[^'"]+)['"]/g;

/** Le `tsconfig.json` d'un dépôt, à sa racine. */
export const CHEMIN_TSCONFIG = 'tsconfig.json';

/** Options de compilation du dépôt du répertoire courant (`CHEMIN_TSCONFIG`), converties par le
 *  compilateur lui-même : c'est d'elles (`isolatedModules`, `verbatimModuleSyntax`,
 *  `preserveValueImports`…) que dépend l'effacement d'un import. Lues au PREMIER `sourceALExecution`, comme le compilateur (`typescript()`) : la
 *  clôture sans `typesEffaces` ne charge aucun paquet npm. */
let compilerOptions = null;
const optionsDuDepot = () =>
  (compilerOptions ??= typescript().convertCompilerOptionsFromJson(
    JSON.parse(readFileSync(resolve(CHEMIN_TSCONFIG), 'utf8')).compilerOptions,
    resolve('.'),
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

/**
 * Les ALIAS de chemin que déclare le texte d'un `tsconfig.json` (`compilerOptions.paths`, forme
 * `<clé>/*` → `<cible>/*`), cibles posées sous `racine` via `baseUrl` : la même source que le
 * compilateur et que `vite.config.ts` (`resolve.alias`). `null` (fichier absent de l'arbre) = aucun.
 * @param {string | null} texte @param {string} racine @returns {{ prefixe: string, vers: string }[]}
 */
export function aliasDe(texte, racine) {
  if (texte === null) return [];
  const { compilerOptions: { baseUrl = '.', paths = {} } = {} } = JSON.parse(texte);
  const base = resolve(racine, baseUrl).split('\\').join('/');
  return Object.entries(paths)
    .filter(([cle, [cible] = []]) => cle.endsWith('/*') && cible?.endsWith('/*'))
    .map(([cle, [cible]]) => ({ prefixe: cle.slice(0, -1), vers: `${resolve(base, cible.slice(0, -1)).split('\\').join('/')}/` }));
}

/** Les alias du dépôt dont `racine` est la racine sur le DISQUE (`aliasDe` sur son `tsconfig.json`),
 *  lus une fois par racine. */
const aliasParRacine = new Map();
export const aliasDuDepot = (racine = '.') => {
  const abs = resolve(racine);
  if (!aliasParRacine.has(abs)) {
    const chemin = resolve(abs, CHEMIN_TSCONFIG);
    aliasParRacine.set(abs, aliasDe(existsSync(chemin) ? readFileSync(chemin, 'utf8') : null, abs));
  }
  return aliasParRacine.get(abs);
};

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
 * déduite d'`EXTS`, sinon repli `index.*`. Un spécificateur qui commence par un ALIAS (`alias`, `@/…`)
 * se résout sous sa cible ; un paquet npm rend `null` (hors périmètre).
 * `existe` (chemin absolu POSIX → présent ?) et `alias` disent quel ARBRE fait foi : le disque du
 * répertoire courant par défaut, la liste de fichiers et le `tsconfig.json` d'une ref pour qui juge un
 * autre arbre que l'arbre de travail (#1806).
 * @param {string} fromFile @param {string} spec @param {(abs: string) => boolean} [existe]
 * @param {readonly { prefixe: string, vers: string }[]} [alias]
 * @returns {string|null}
 */
export function resolveImport(fromFile, spec, existe = existsSync, alias = aliasDuDepot()) {
  const a = spec.startsWith('.') ? null : alias.find(({ prefixe }) => spec.startsWith(prefixe));
  if (!spec.startsWith('.') && !a) return null;
  const base = a ? `${a.vers}${spec.slice(a.prefixe.length)}` : resolve(dirname(fromFile), spec).split('\\').join('/');
  if (EXTS_EXPLICITES.some((e) => spec.endsWith(e))) {
    if (existe(base)) return base;
    const [, radical, ext] = /^(.*)(\.[^./]+)$/.exec(base);
    return (EXTS_TS_DE[ext] ?? []).map((e) => radical + e).find((f) => existe(f)) ?? null;
  }
  for (const ext of EXTS) if (existe(base + ext)) return base + ext;
  for (const ext of EXTS) if (existe(`${base}/index${ext}`)) return `${base}/index${ext}`;
  return null;
}

/**
 * Enfants d'un module : TOUS ses imports relatifs résolus, sans borne. `null` = fichier absent (hors
 * closure) ; `[]` = membre qui n'est pas un module (`estModule` : `.json`, #487) ou illisible.
 * `typesEffaces` lit le source À L'EXÉCUTION (`sourceALExecution`) : les arcs effacés n'y sont plus.
 * `dynamiques` faux écarte les `import('…')` (m[2]) : il reste les arcs que le CHARGEMENT lie.
 * @param {string} abs @param {string} rel @param {boolean} typesEffaces @param {boolean} dynamiques
 * @returns {string[]|null}
 */
function enfantsDe(abs, rel, typesEffaces, dynamiques) {
  if (!existsSync(abs)) return null;
  if (!estModule(rel)) return [];
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
 * relatifs à la racine du repo, dédupliqués, `src/`-only. `racine` = le dépôt où `fromFile` (relatif)
 * se résout, le répertoire courant par défaut : un hook s'exécute ailleurs que dans l'arbre jugé.
 * `existe` et `alias` : l'arbre contre lequel résoudre (`resolveImport`) ; par défaut les alias du
 * disque de `racine` (`aliasDuDepot`).
 * @param {string} fromFile @param {string} contenu
 * @param {{ racine?: string, existe?: (abs: string) => boolean, alias?: readonly { prefixe: string, vers: string }[] }} [options]
 * @returns {string[]}
 */
export function directImportsOf(fromFile, contenu, { racine = '.', existe, alias = aliasDuDepot(racine) } = {}) {
  const root = resolve(racine).split('\\').join('/');
  const found = new Set();
  for (const m of contenu.matchAll(IMPORT_RE)) {
    const resolved = resolveImport(resolve(root, fromFile), m[1] ?? m[2] ?? m[3], existe, alias);
    if (resolved?.startsWith(`${root}/`) && resolved.includes('/src/')) found.add(resolved.slice(root.length + 1));
  }
  return [...found];
}
