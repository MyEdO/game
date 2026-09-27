// Fabriques de `ts.Program` PARTAGÉES par les gardes qui ont besoin d'un vérificateur de TYPES
// (#841 éditabilité des champs de scène, #847 champs des `GameOp`, #1620 consommateurs par champ).
// Deux fabriques, une par SOURCE des fichiers :
//   - `repoProgram` : les fichiers du dépôt, options du `tsconfig.json` racine ;
//   - `virtualProgram` : des sources EN MÉMOIRE, pour les morsures de garde.
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
 */
export function repoProgram(root, choisirRootNames) {
  const key = norm(path.resolve(root));
  const cfgPath = ts.findConfigFile(key, ts.sys.fileExists, 'tsconfig.json');
  if (!cfgPath) throw new Error(`tsconfig.json introuvable sous ${key}`);
  const cfg = ts.readConfigFile(cfgPath, ts.sys.readFile);
  const parsed = ts.parseJsonConfigFileContent(cfg.config, ts.sys, path.dirname(cfgPath));
  return ts.createProgram({
    rootNames: choisirRootNames(parsed.fileNames, key),
    options: { ...parsed.options, noEmit: true },
  });
}

/** Programme bâti sur des sources EN MÉMOIRE — support des preuves de non-vacance : on y déclare de
 *  faux modules et on mesure le verdict de la garde dessus.
 *  `files` : chemins RELATIFS (ex. `src/state/scene.ts`) → contenu. */
export function virtualProgram(files) {
  const options = {
    target: ts.ScriptTarget.ES2020,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    strict: true,
    noEmit: true,
    skipLibCheck: true,
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
