// Mécanique de graphe d'imports PARTAGÉE : le
// lecteur de sites et liaisons de module (`sitesDeModule`, sur l'arbre syntaxique), la résolution d'un
// spécificateur vers un fichier source réel (`resolveImport`, `arcsDe`) et la marche transitive depuis
// un jeu de modules racines (`clotureDImports`, bornée par le prédicat de l'appelant ; `closureOf` la
// borne à `src/`). Jamais un 2ᵉ parseur d'imports. Module ESM pur (node nu).

import { readFileSync, existsSync, statSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { analyserTexte, analyserCorpus, typescript } from './dialecte.mjs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const EXTS = ['.ts', '.tsx', '.mts', '.cts', '.mjs', '.cjs', '.js'];

/** Chemin de module de code reconnu par `EXTS`. */
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
 * Sites de module, liaisons et rôles lus dans un seul parcours AST. Le source texte est parsé par
 * `analyserTexte`, avec diagnostics séparés ; un SourceFile fourni est réutilisé. Les positions
 * utilisent cet arbre explicitement, y compris sans parents. Un nom synthétique porte position:null.
 * @param {string} fichier
 * @param {string | import('typescript/unstable/ast').SourceFile} source
 */
export function sitesDeModule(fichier, source, diagnostics) {
  const ts = typescript();
  const analyse = typeof source === 'string' || diagnostics === undefined ? analyserTexte({ rel: fichier, text: typeof source === 'string' ? source : source.text }) : { sourceFile: source, diagnostics };
  const arbre = typeof source === 'string' ? analyse.sourceFile : source;
  const texte = arbre.text;
  const [faute] = analyse.diagnostics;
  if (faute) {
    const ligne = arbre.getLineAndCharacterOfPosition(faute.pos).line + 1;
    throw new Error(`sitesDeModule : ${fichier} ne se parse pas, ligne ${ligne} : ${faute.text}`);
  }
  const litteral = (n) => (n && ts.isStringLiteralLikeNode(n) ? n.text : null);
  const position = (noeud) => {
    const debut = noeud.getStart(arbre);
    return { noeud, debut, fin: noeud.getEnd(), ligne: arbre.getLineAndCharacterOfPosition(debut).line + 1 };
  };
  const nom = (noeud) => noeud ? { nom: noeud.text ?? noeud.getText(arbre), position: position(noeud) } : null;
  const synthetique = (nom) => ({ nom, position: null });
  const etoile = (noeud) => {
    let token = ts.getTokenAtPosition(arbre, noeud.getStart(arbre));
    while (token && token.getStart(arbre) < noeud.end) {
      if (token.kind === ts.SyntaxKind.AsteriskToken) return nom(token);
      token = ts.findNextToken(token, noeud, arbre);
    }
    return null;
  };
  const liaison = (forme, typeSeul, local, importe, exporte) => ({ forme, typeSeul: !!typeSeul, local, importe, exporte });
  const tetes = new Set(arbre.statements);
  const vus = [];
  const ajouter = (noeud, genre, nature, acquisition, spec, clause = false, liaisons = []) => {
    const p = position(noeud);
    vus.push({ genre, nature, acquisition, spec, clause, niveauModule: tetes.has(noeud), ...p, texte: texte.slice(p.debut, p.fin), liaisons });
  };
  const visiter = (n) => {
    if (ts.isImportDeclaration(n)) {
      const clause = n.importClause;
      const liaisons = [];
      if (clause?.name) liaisons.push(liaison('defaut', clause.isTypeOnly, nom(clause.name), synthetique('default'), null));
      const noms = clause?.namedBindings;
      if (noms && ts.isNamespaceImport(noms)) liaisons.push(liaison('espace', clause.isTypeOnly, nom(noms.name), etoile(noms), null));
      else if (noms) for (const e of noms.elements)
        liaisons.push(liaison('nommee', clause.isTypeOnly || e.isTypeOnly, nom(e.name), nom(e.propertyName ?? e.name), null));
      ajouter(n, 'import', clause?.isTypeOnly ? 'type' : 'statique', true, litteral(n.moduleSpecifier), !!clause, liaisons);
    } else if (ts.isExportDeclaration(n)) {
      const acquisition = !!n.moduleSpecifier;
      const clause = n.exportClause;
      const liaisons = [];
      if (!clause) {
        const role = etoile(n);
        liaisons.push(liaison('etoile', n.isTypeOnly, null, role, role));
      } else if (ts.isNamespaceExport(clause))
        liaisons.push(liaison('espace', n.isTypeOnly, null, etoile(clause), nom(clause.name)));
      else for (const e of clause.elements) {
        const origine = nom(e.propertyName ?? e.name);
        liaisons.push(liaison('nommee', n.isTypeOnly || e.isTypeOnly, acquisition ? null : origine, acquisition ? origine : null, nom(e.name)));
      }
      ajouter(n, 'export', n.isTypeOnly ? 'type' : 'statique', acquisition, acquisition ? litteral(n.moduleSpecifier) : null, !!clause, liaisons);
    } else if (ts.isImportEqualsDeclaration(n)) {
      const externe = ts.isExternalModuleReference(n.moduleReference);
      const importe = externe ? synthetique('*') : nom(n.moduleReference);
      const exporte = n.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) ? nom(n.name) : null;
      ajouter(n, 'importEquals', n.isTypeOnly ? 'type' : externe ? 'require' : 'statique', externe,
        externe ? litteral(n.moduleReference.expression) : null, true,
        [liaison('equals', n.isTypeOnly, nom(n.name), importe, exporte)]);
    } else if (ts.isImportTypeNode(n)) {
      const spec = ts.isLiteralTypeNode(n.argument) ? litteral(n.argument.literal) : null;
      ajouter(n, 'importType', 'type', true, spec);
    } else if (ts.isCallExpression(n)) {
      const spec = litteral(n.arguments[0]);
      if (n.expression.kind === ts.SyntaxKind.ImportKeyword) ajouter(n, 'appel', 'dynamique', true, spec);
      else if (estRequire(ts, n.expression)) ajouter(n, 'appel', 'require', true, spec);
    } else if (ts.isIdentifier(n) && n.text === 'createRequire') ajouter(n, 'fournisseur', 'require', false, null);
    n.forEachChild(visiter);
  };
  visiter(arbre);
  return vus;
}

export const liaisonsDe = (fichier, source, diagnostics) => sitesDeModule(fichier, source, diagnostics)
  .flatMap(({ liaisons, ...site }) => liaisons.map((liaison) => ({ ...site, ...liaison })));

export const chargementsDe = (fichier, source, diagnostics) => sitesDeModule(fichier, source, diagnostics)
  .filter(({ acquisition, genre }) => acquisition || genre === 'fournisseur');

export const specificateursDe = (fichier, source, diagnostics) => sitesDeModule(fichier, source, diagnostics)
  .filter(({ acquisition, spec }) => acquisition && spec !== null)
  .map(({ spec, nature, ligne, debut, fin, texte }) => ({ spec, nature, ligne, debut, fin, texte }));

/** Le `tsconfig.json` d'un dépôt, à sa racine. */
export const CHEMIN_TSCONFIG = 'tsconfig.json';

export function sourceALExecution(fichier, texte, { racine = '.' } = {}) {
  if (!/\.[cm]?tsx?$/.test(fichier)) return texte;
  const { transformSync } = require('rolldown/utils');
  const config = resolve(racine, CHEMIN_TSCONFIG);
  const resultat = transformSync(resolve(racine, fichier), texte, { tsconfig: existsSync(config) ? config : false });
  if (resultat.errors.length) throw new Error(`sourceALExecution : ${fichier} : ${resultat.errors.map(e => e.message).join('; ')}`);
  return resultat.code;
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
export function arcsDe(abs, texte, { existe = fichierExiste, alias = aliasDuDepot(), diagnostics } = {}) {
  const arcs = [];
  for (const site of specificateursDe(abs, texte, diagnostics)) {
    const cible = resolveImport(abs, site.spec, existe, alias);
    if (cible) arcs.push({ ...site, cible });
  }
  return arcs;
}

/** Natures qu'écarte `dynamiques: false` : ce que le chargement ne lie pas avant d'évaluer. */
const NON_LIEES = new Set(['dynamique', 'require']);

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
  let frontiere = roots.map(r => ({ abs: resolve(base, r).split(sep).join('/') }));
  while (frontiere.length) {
    const suivants = [];
    const aLire = [];
    const ajoutes = new Set();
    for (const { abs, importeur, spec } of frontiere) {
      relatif(abs, importeur, spec);
      if (seen.has(relatif(abs)) || cache.has(abs) || ajoutes.has(abs)) continue;
      ajoutes.add(abs);
      if (!existsSync(abs)) { cache.set(abs, null); continue; }
      if (!estModule(abs)) { cache.set(abs, []); continue; }
      let text;
      try { text = readFileSync(abs, 'utf8'); }
      catch { cache.set(abs, []); continue; }
      if (typesEffaces) text = sourceALExecution(abs, text, { racine: base });
      aLire.push({ rel: abs, text });
    }
    for (const { fichier, sourceFile, diagnostics } of analyserCorpus(aLire))
      cache.set(fichier.rel, arcsDe(fichier.rel, sourceFile, { alias, diagnostics }));
    for (const { abs, importeur, spec } of frontiere) {
      const rel = relatif(abs, importeur, spec);
      if (seen.has(rel)) continue;
      const enfants = cache.get(abs);
      if (enfants === null) continue;
      seen.add(rel);
      for (const e of enfants)
        if ((dynamiques || !NON_LIEES.has(e.nature)) && (!retenir || retenir(e.cible)))
          suivants.push({ abs: e.cible, importeur: rel, spec: e.spec });
    }
    frontiere = suivants;
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
