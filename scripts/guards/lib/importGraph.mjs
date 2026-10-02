// Mécanique de graphe d'imports PARTAGÉE : le
// LECTEUR d'imports du dépôt (`specificateursDe`, sur l'arbre syntaxique), la résolution d'un
// spécificateur vers un fichier source réel (`resolveImport`, `arcsDe`) et la marche transitive depuis
// un jeu de modules racines (`clotureDImports`, bornée par le prédicat de l'appelant ; `closureOf` la
// borne à `src/`). Jamais un 2ᵉ parseur d'imports. Module ESM pur (node nu).

import { readFileSync, existsSync, statSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { ast, typescript } from './dialecte.mjs';

// Extensions de MODULE que le dépôt écrit réellement : les libs de garde et les générateurs vivent en
// `.mjs` (109 imports relatifs de `src/**` vers `scripts/**` mesurés le 2026-09-02), donc `.mjs`/`.cjs`
// font partie de ce qu'un spécificateur relatif peut désigner ici.
const EXTS = ['.ts', '.tsx', '.mts', '.mjs', '.cjs', '.js'];

/** Un MODULE de code : un chemin qu'`EXTS` termine — le seul que lit `specificateursDe` en importeur. */
export const estModule = (chemin) => EXTS.some((ext) => chemin.endsWith(ext));

/** Les pathspecs git des modules de code sous `dossier` (`EXTS`). @param {string} dossier */
export const pathspecsDeModules = (dossier) => EXTS.map((ext) => `${dossier}/*${ext}`);

/** `require('…')`, `module.require('…')` ou `createRequire(…)('…')` : l'appelé d'une acquisition
 *  CommonJS. */
const estRequire = (ts, appele) =>
  (ts.isIdentifier(appele) && appele.text === 'require') ||
  (ts.isPropertyAccessExpression(appele) && ts.isIdentifier(appele.expression) &&
    appele.expression.text === 'module' && appele.name.text === 'require') ||
  (ts.isCallExpression(appele) && ts.isIdentifier(appele.expression) && appele.expression.text === 'createRequire');

/**
 * Les spécificateurs qu'un module ÉCRIT, lus sur son arbre syntaxique (`dialecte.mjs`, `ast`) — le
 * SEUL lecteur d'imports du dépôt : une chaîne, un gabarit, un commentaire, une regex littérale ou du
 * JSX ne sont pas des nœuds d'import. `nature` : `statique` (`import`/`export … from`, effet de bord
 * compris), `type` (`import type`, `export type`, `import type x = require('…')`, `import('…')` en
 * position de type), `dynamique` (`import('…')`), `require` (`require('…')`, `module.require('…')`,
 * `createRequire(…)('…')`, `import x = require('…')`). Seul un spécificateur LITTÉRAL se lit.
 * `declare module '…'` et `/// <reference …>` ne sont pas des acquisitions : ils ne sont pas suivis.
 * Un texte qui ne se parse pas LÈVE : une lecture partielle tairait les imports qui suivent l'erreur.
 * @param {string} fichier chemin (son extension choisit le dialecte) @param {string} texte
 * @returns {{ spec: string, nature: 'statique' | 'dynamique' | 'type' | 'require', ligne: number, debut: number, fin: number, texte: string }[]}
 */
export function specificateursDe(fichier, texte) {
  const ts = typescript();
  const litteral = (n) => (n && ts.isStringLiteralLike(n) ? n.text : null);
  const vus = [];
  const ajouter = (n, spec, nature) => {
    const debut = n.getStart(arbre);
    const fin = n.getEnd();
    vus.push({ spec, nature, ligne: arbre.getLineAndCharacterOfPosition(debut).line + 1, debut, fin, texte: texte.slice(debut, fin) });
  };
  const visiter = (n) => {
    if (ts.isImportDeclaration(n) || ts.isExportDeclaration(n)) {
      const spec = litteral(n.moduleSpecifier);
      const typeSeul = ts.isImportDeclaration(n) ? n.importClause?.isTypeOnly : n.isTypeOnly;
      if (spec !== null) ajouter(n, spec, typeSeul ? 'type' : 'statique');
    } else if (ts.isImportEqualsDeclaration(n) && ts.isExternalModuleReference(n.moduleReference)) {
      const spec = litteral(n.moduleReference.expression);
      if (spec !== null) ajouter(n, spec, n.isTypeOnly ? 'type' : 'require');
    } else if (ts.isImportTypeNode(n)) {
      const spec = ts.isLiteralTypeNode(n.argument) ? litteral(n.argument.literal) : null;
      if (spec !== null) ajouter(n, spec, 'type');
    } else if (ts.isCallExpression(n)) {
      const spec = litteral(n.arguments[0]);
      if (spec !== null && n.expression.kind === ts.SyntaxKind.ImportKeyword) ajouter(n, spec, 'dynamique');
      else if (spec !== null && estRequire(ts, n.expression)) ajouter(n, spec, 'require');
    }
    ts.forEachChild(n, visiter);
  };
  const arbre = ast({ rel: fichier, text: texte });
  const [faute] = arbre.parseDiagnostics ?? [];
  if (faute) {
    const ligne = arbre.getLineAndCharacterOfPosition(faute.start).line + 1;
    throw new Error(`specificateursDe : ${fichier} ne se parse pas, ligne ${ligne} : ${ts.flattenDiagnosticMessageText(faute.messageText, ' ')}`);
  }
  visiter(arbre);
  return vus;
}

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

/** Source TypeScript d'un spécificateur à extension JS émise : `./x.mjs` désigne `x.mts` quand
 *  `x.mjs` n'existe pas (TypeScript, `moduleResolution: "bundler"`, Handbook « Modules Reference »,
 *  extension substitution) — la forme de `src/**` vers `scripts/docs/lib/*.mts`. */
const EXTS_TS_DE = { '.js': ['.ts', '.tsx'], '.mjs': ['.mts'], '.cjs': ['.cts'] };
const fichierExiste = (chemin) => {
  try {
    return statSync(chemin).isFile();
  } catch {
    return false;
  }
};

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
export function resolveImport(fromFile, spec, existe = fichierExiste, alias = aliasDuDepot()) {
  const a = spec.startsWith('.') ? null : alias.find(({ prefixe }) => spec.startsWith(prefixe));
  if (!spec.startsWith('.') && !a) return null;
  const base = a ? `${a.vers}${spec.slice(a.prefixe.length)}` : resolve(dirname(fromFile), spec).split('\\').join('/');
  if (/\.[^./]+$/.test(spec)) {
    if (existe(base)) return base;
    const [, radical, ext] = /^(.*)(\.[^./]+)$/.exec(base);
    const source = (EXTS_TS_DE[ext] ?? []).map((e) => radical + e).find((f) => existe(f));
    if (source) return source;
  }
  for (const ext of EXTS) if (existe(base + ext)) return base + ext;
  for (const ext of EXTS) if (existe(`${base}/index${ext}`)) return `${base}/index${ext}`;
  return null;
}

/** @typedef {{ spec: string, nature: 'statique' | 'dynamique' | 'type' | 'require', ligne: number, debut: number, fin: number, texte: string, cible: string }} Arc */

/**
 * Les ARCS d'un module : ses spécificateurs (`specificateursDe`) résolus (`resolveImport`) contre
 * l'arbre que disent `existe` et `alias` (le disque et les alias du répertoire courant par défaut). Un
 * spécificateur qui ne se résout pas (paquet npm, fichier absent) ne fait pas d'arc.
 * @param {string} abs chemin absolu du module @param {string} texte
 * @param {{ existe?: (abs: string) => boolean, alias?: readonly { prefixe: string, vers: string }[] }} [options]
 * @returns {Arc[]}
 */
export function arcsDe(abs, texte, { existe = fichierExiste, alias = aliasDuDepot() } = {}) {
  const arcs = [];
  for (const site of specificateursDe(abs, texte)) {
    const cible = resolveImport(abs, site.spec, existe, alias);
    if (cible) arcs.push({ ...site, cible });
  }
  return arcs;
}

/** Natures qu'écarte `dynamiques: false` : ce que le chargement ne lie pas avant d'évaluer. */
const NON_LIEES = new Set(['dynamique', 'require']);

/**
 * Enfants d'un module : TOUS ses arcs (`arcsDe`), sans borne ni filtre. `null` = fichier absent (hors
 * closure) ; `[]` = membre qui n'est pas un module (`estModule` : `.json`, #487) ou illisible.
 * `typesEffaces` lit le source À L'EXÉCUTION (`sourceALExecution`) : les arcs effacés n'y sont plus.
 * @param {string} abs @param {readonly { prefixe: string, vers: string }[]} alias
 * @param {boolean} typesEffaces
 * @returns {Arc[]|null}
 */
function enfantsDe(abs, alias, typesEffaces) {
  if (!existsSync(abs)) return null;
  if (!estModule(abs)) return [];
  let text;
  try {
    text = readFileSync(abs, 'utf8');
  } catch {
    return [];
  }
  if (typesEffaces) text = sourceALExecution(abs, text);
  return arcsDe(abs, text, { alias });
}

/** Le régime sous lequel chaque cache de marche a été rempli : `typesEffaces` et la racine dont les
 *  alias résolvent. Un cache n'est valable que sous son régime. */
const regimeDesCaches = new WeakMap();

/**
 * MARCHE du graphe d'imports RELATIFS depuis un jeu de modules racines : résolution + parcours
 * transitif, sans borne. La borne est un PRÉDICAT de l'appelant (`retenir`, appliqué aux ENFANTS —
 * les racines entrent toujours) : un seul hôte, aucune branche par type d'appelant.
 * `racine` : le dépôt dont la marche rend les membres, en chemins POSIX RELATIFS à elle (le répertoire
 * courant par défaut) ; ses racines relatives s'y résolvent, ses alias (`aliasDuDepot`) y sont lus. Un
 * membre HORS de `racine` lève une erreur qui nomme son importeur et son spécificateur.
 * `cache` (module absolu -> enfants résolus) est PARTAGEABLE entre plusieurs marches d'un MÊME appelant :
 * les 16 systèmes de `systemes.manifest.json` visitent 21 197 modules pour 1 859 distincts (mesuré le
 * 2026-08-23) — sans partage, chaque fichier est relu et re-résolu 11 fois. Le cache porte les
 * arcs NON filtrés (`Arc`, nature comprise) : il reste valable quels que soient le prédicat et
 * `dynamiques`, filtrés pendant la marche. Par défaut le cache naît et meurt avec l'appel : aucun état
 * ne survit entre deux marches indépendantes.
 * `typesEffaces` marche les arcs d'EXÉCUTION seuls (cf. `sourceALExecution`) : c'est ce que demande un
 * appelant qui suit un EFFET DE MODULE plutôt qu'une dépendance de typage. Le cache porte les arcs
 * SOUS CE RÉGIME et sous les alias de `racine` : réutilisé sous un autre, il LÈVE.
 * `dynamiques: false` marche la clôture STATIQUE, celle qu'ESM charge et lie avant d'évaluer quoi
 * que ce soit (ECMA-262, Cyclic Module Records : `Link` avant `Evaluate`) : ni `import('…')` ni
 * `require` n'y entrent.
 * @param {string[]} roots
 * @param {{ racine?: string, retenir?: (abs: string) => boolean, cache?: Map<string, Arc[]|null>, typesEffaces?: boolean, dynamiques?: boolean }} [options]
 * @returns {Set<string>} chemins POSIX relatifs à `racine`
 */
export function clotureDImports(roots, { racine = '.', retenir, cache = new Map(), typesEffaces = false, dynamiques = true } = {}) {
  const base = resolve(racine);
  const alias = aliasDuDepot(base);
  const regime = `${typesEffaces ? 'typesEffaces' : 'typage'}, racine ${base}`;
  const deja = regimeDesCaches.get(cache);
  if (deja === undefined) regimeDesCaches.set(cache, regime);
  else if (deja !== regime) throw new Error(`clotureDImports : cache rempli sous le régime « ${deja} », réutilisé sous « ${regime} »`);
  const relatif = (abs, importeur, spec) => {
    const rel = relative(base, abs);
    if (rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel))
      throw new Error(importeur
        ? `clotureDImports : ${importeur} importe « ${spec} », hors de la racine ${base}`
        : `clotureDImports : la racine de marche ${abs} est hors de la racine ${base}`);
    return rel.split(sep).join('/');
  };
  const seen = new Set();
  const stack = roots.map((r) => ({ abs: resolve(base, r).split(sep).join('/') }));
  while (stack.length) {
    const { abs, importeur, spec } = stack.pop();
    const rel = relatif(abs, importeur, spec);
    if (seen.has(rel)) continue;
    let enfants = cache.get(abs);
    if (enfants === undefined) {
      enfants = enfantsDe(abs, alias, typesEffaces);
      cache.set(abs, enfants);
    }
    if (enfants === null) continue;
    seen.add(rel);
    for (const e of enfants)
      if ((dynamiques || !NON_LIEES.has(e.nature)) && (!retenir || retenir(e.cible))) stack.push({ abs: e.cible, importeur: rel, spec: e.spec });
  }
  return seen;
}

/**
 * Closure transitive des imports RELATIFS depuis un jeu de modules racines, bornée à `src/` : la
 * MARCHE ci-dessus, avec le prédicat `src/` posé ici, par l'appelant.
 * @param {string[]} roots
 * @param {{ racine?: string, cache?: Map<string, Arc[]|null> }} [options]
 * @returns {Set<string>} chemins POSIX relatifs à `racine`
 */
export function closureOf(roots, { racine, cache } = {}) {
  return clotureDImports(roots, { racine, retenir: (abs) => abs.includes('/src/'), cache });
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
  for (const { cible } of arcsDe(resolve(root, fromFile), contenu, { existe, alias })) {
    if (cible.startsWith(`${root}/`) && cible.includes('/src/')) found.add(cible.slice(root.length + 1));
  }
  return [...found];
}
