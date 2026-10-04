import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const norm = (p) => p.replaceAll('\\', '/');
export const VIRTUAL_ROOT = path.resolve(path.sep, 'repo-virtuel');

export function libererSessions(sessions, erreursInitiales = []) {
  const possedees = new Set(Array.from(sessions));
  const erreurs = [...erreursInitiales];
  for (const session of possedees) {
    try { session.dispose(); }
    catch (erreur) { erreurs.push(erreur); }
  }
  if (erreurs.length === 1) throw erreurs[0];
  if (erreurs.length > 1) throw new AggregateError(erreurs, 'Échecs de libération des sessions natives', { cause: erreurs[0] });
}

function ouvrir(root, fs, configurer) {
  const { API } = require('typescript/unstable/sync');
  let api = new API({ cwd: root, fs });
  let snapshot;
  const dispose = () => {
    if (!api) return;
    const courant = api;
    const capture = snapshot;
    api = undefined;
    snapshot = undefined;
    libererSessions([
      { dispose: () => capture?.dispose() },
      { dispose: () => courant.clearSourceFileCache() },
      { dispose: () => courant.close() },
    ]);
  };
  try {
    const config = configurer(api);
    snapshot = api.updateSnapshot({ openProjects: [config] });
    const projet = snapshot.getProject(config);
    if (!projet) throw new Error(`Programme TypeScript introuvable : ${config}`);
    return { program: projet.program, checker: projet.checker, dispose };
  } catch (error) { libererSessions([{ dispose }], [error]); }
}

export function repoProgram(root, choisirRootNames, recouvrement = {}) {
  const key = norm(path.resolve(root));
  const config = `${key}/tsconfig.json`;
  const temporaire = `${key}/tsconfig.analyse-virtuelle.json`;
  const files = new Map(Object.entries(recouvrement).map(([rel, text]) => [norm(path.resolve(key, rel)), text]));
  const fs = {
    readFile: name => files.get(norm(name)),
    fileExists: name => files.has(norm(name)) ? true : undefined,
  };
  return ouvrir(key, fs, api => {
    const parsed = api.parseConfigFile(config);
    files.set(temporaire, JSON.stringify({ extends: './tsconfig.json', compilerOptions: { noEmit: true }, files: choisirRootNames(parsed.fileNames, key), include: [], references: [] }));
    return temporaire;
  });
}

export function virtualProgram(files, options = {}) {
  const root = norm(VIRTUAL_ROOT);
  const config = `${root}/tsconfig.analyse-virtuelle.json`;
  const sources = Object.fromEntries(Object.entries(files).map(([rel, text]) => [norm(path.resolve(root, rel)), text]));
  if (Object.hasOwn(sources, config)) throw new Error(`Fichier réservé à la configuration native : ${config}`);
  const compilerOptions = { target: 'es2020', module: 'esnext', moduleResolution: 'bundler', strict: true, noEmit: true, skipLibCheck: true, types: [], ...options };
  sources[config] = JSON.stringify({ compilerOptions, files: Object.keys(sources) });
  const { createVirtualFileSystem } = require('typescript/unstable/fs');
  const fs = createVirtualFileSystem(sources);
  const read = fs.readFile;
  const nativePackage = require.resolve(`@typescript/typescript-${process.platform}-${process.arch}/package.json`);
  const libDir = `${norm(path.join(path.dirname(nativePackage), 'lib'))}/`;
  const dansLesLibs = name => !compilerOptions.noLib && (norm(name) === libDir.slice(0, -1) || norm(name).startsWith(libDir));
  const existe = fs.fileExists;
  const dossier = fs.directoryExists;
  const entrees = fs.getAccessibleEntries;
  fs.readFile = name => read(name) ?? (dansLesLibs(name) && name.endsWith('.d.ts') ? undefined : null);
  fs.fileExists = name => existe(name) || (dansLesLibs(name) && name.endsWith('.d.ts') ? undefined : false);
  fs.directoryExists = name => dossier(name) || (dansLesLibs(name) ? undefined : false);
  fs.getAccessibleEntries = name => entrees(name) ?? (dansLesLibs(name) ? undefined : { files: [], directories: [] });
  return ouvrir(root, fs, () => config);
}
