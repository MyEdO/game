// Fabriques de `ts.Program` PARTAGÉES par les gardes et générateurs qui ont besoin d'un vérificateur de
// TYPES (#841 éditabilité des champs de scène, #847 champs des `GameOp`, #1620 consommateurs par champ,
// #1806 coupe au caractère, `jsdocUnion.mjs`).
// Trois fabriques, une par SOURCE des fichiers :
//   - `repoProgram` : les fichiers du dépôt, options du `tsconfig.json` racine, modules recouverts en
//     mémoire au besoin ;
//   - `virtualProgram` : des sources EN MÉMOIRE, bibliothèque standard comprise, sans disque (un import
//     ne se résout qu'entre ces sources) ;
//   - `parsedProgram` : un arbre DÉJÀ parsé, sans lib ni import.
// Seules écritures de `create*Program` : garde `src/ts-program-fabrique-guard.test.ts`.
//
// AUCUNE RÉTENTION ICI. Ni cache ni mémo au niveau module : un Program du dépôt pèse ~1,3 Go de
// tables du checker (mesuré #1620, 1 952 fichiers de `src/`), et sous Vitest `isolate: false` un
// module reste chargé pour TOUTE la suite — le retenir ici le ferait payer à chaque fichier de test
// qui suit. Le Program vit donc dans l'appel de son consommateur ; un fichier de test qui le partage
// entre ses cas le tient par `detenteur` (`src/detenteur.testkit.ts`), libéré en `afterAll`. Il en
// va de même de toute structure d'ANALYSE (`SourceFile`, vérificateur, index d'AST) et de tout DÉRIVÉ
// du corpus (liste `map`/`flatMap`/`filter`, texte `join`, mémo sur l'identité du corpus) : ils ne
// vivent pas plus longtemps que l'appel ou le fichier de test qui les a demandés. Seuls les TEXTES du
// corpus sont retenus pour le worker (`sourceCorpus.mjs`, PRIX). Garde :
// `src/analyse-retention-guard.test.ts` ; formes tenues et angles morts : en-tête de `analyseRetenue.mjs`.
import path from 'node:path';
import ts from 'typescript';

/** Racine des programmes en mémoire (`virtualProgram`) — à passer en `root` aux audits. */
export const VIRTUAL_ROOT = path.resolve(path.sep, 'repo-virtuel');

const norm = (p) => p.replace(/\\/g, '/');

/**
 * Programme TypeScript du dépôt : options du `tsconfig.json` trouvé à `root`, racines CHOISIES par
 * l'appelant — `choisirRootNames(fileNames, root)` reçoit les fichiers du tsconfig et rend les
 * racines (chemins absolus). TypeScript tire la fermeture d'imports de ces racines : les types
 * restent complets sans compiler le dépôt entier.
 * `recouvrement` : chemins RELATIFS à `root` → contenu servi à la place du disque (aucune écriture).
 */
export function repoProgram(root, choisirRootNames, recouvrement = {}) {
  const key = norm(path.resolve(root));
  const cfgPath = ts.findConfigFile(key, ts.sys.fileExists, 'tsconfig.json');
  if (!cfgPath) throw new Error(`tsconfig.json introuvable sous ${key}`);
  const cfg = ts.readConfigFile(cfgPath, ts.sys.readFile);
  const parsed = ts.parseJsonConfigFileContent(cfg.config, ts.sys, path.dirname(cfgPath));
  const options = { ...parsed.options, noEmit: true };
  const recouverts = new Map(
    Object.entries(recouvrement).map(([rel, texte]) => [norm(path.resolve(key, rel)), texte])
  );
  const host = ts.createCompilerHost(options);
  const lireSource = host.getSourceFile.bind(host);
  host.getSourceFile = (name, langage, ...reste) => {
    const texte = recouverts.get(norm(path.resolve(name)));
    return texte === undefined ? lireSource(name, langage, ...reste) : ts.createSourceFile(name, texte, langage, true);
  };
  const lire = host.readFile.bind(host);
  host.readFile = (name) => recouverts.get(norm(path.resolve(name))) ?? lire(name);
  return ts.createProgram({ rootNames: choisirRootNames(parsed.fileNames, key), options, host });
}

/** Programme bâti sur des sources EN MÉMOIRE, bibliothèque standard comprise, sans disque (un import ne
 *  se résout qu'entre ces sources) : morsures de garde, sondes de type, texte déjà lu d'un générateur.
 *  `files` : chemins RELATIFS (ex. `src/state/scene.ts`) → contenu ; `allowJs` admet les sources JS. */
export function virtualProgram(files, { allowJs = false } = {}) {
  const options = {
    target: ts.ScriptTarget.ES2020,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    strict: true,
    noEmit: true,
    skipLibCheck: true,
    allowJs,
  };
  const libName = norm(ts.getDefaultLibFilePath(options));
  // Tout le RÉPERTOIRE de `lib` est lisible, pas le seul `lib.*.full.d.ts` : ce fichier n'est qu'une
  // coquille de `/// <reference>`. Le limiter privait le programme de `Array`, donc `T[]` ne
  // résolvait pas et AUCUN type imbriqué dans un tableau n'entrait dans le périmètre dérivé.
  const libDir = `${norm(path.dirname(ts.getDefaultLibFilePath(options)))}/`;
  const sources = new Map(
    Object.entries(files).map(([rel, text]) => [norm(path.resolve(VIRTUAL_ROOT, rel)), text])
  );
  const read = (name) =>
    sources.get(norm(name)) ?? (norm(name).startsWith(libDir) ? ts.sys.readFile(name) : undefined);
  const host = {
    getSourceFile: (name) => {
      const text = read(name);
      return text === undefined ? undefined : ts.createSourceFile(name, text, options.target, true);
    },
    getDefaultLibFileName: () => libName,
    writeFile: () => {},
    getCurrentDirectory: () => VIRTUAL_ROOT,
    getCanonicalFileName: (f) => norm(f),
    useCaseSensitiveFileNames: () => false,
    getNewLine: () => '\n',
    fileExists: (name) => read(name) !== undefined,
    readFile: read,
  };
  return ts.createProgram({ rootNames: [...sources.keys()], options, host });
}

/** Programme bâti sur UN arbre DÉJÀ parsé (`racine`, un `ts.SourceFile`), sans bibliothèque ni import :
 *  son vérificateur résout un nom du fichier en son symbole. */
export function parsedProgram(racine) {
  const options = { noLib: true, noResolve: true, allowJs: true, noEmit: true, types: [] };
  const host = {
    getSourceFile: (name) => (name === racine.fileName ? racine : undefined),
    getDefaultLibFileName: (o) => ts.getDefaultLibFileName(o),
    writeFile: () => {},
    getCurrentDirectory: () => path.sep,
    getCanonicalFileName: (f) => f,
    useCaseSensitiveFileNames: () => true,
    getNewLine: () => '\n',
    fileExists: (name) => name === racine.fileName,
    readFile: () => undefined,
  };
  return ts.createProgram({ rootNames: [racine.fileName], options, host });
}
