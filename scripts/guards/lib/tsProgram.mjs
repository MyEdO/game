import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const norm = (p) => p.replaceAll('\\', '/');
export const VIRTUAL_ROOT = path.resolve(path.sep, 'repo-virtuel');
const OPTIONS_VIRTUELLES = { target: 'es2020', module: 'esnext', moduleResolution: 'bundler', strict: true, noEmit: true, skipLibCheck: true, types: [] };

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

function ouvrir(root, fs, configurer, choisirProjet = (snapshot, plan) => snapshot.getProject(plan.openProjects[0])) {
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
    const plan = configurer(api);
    snapshot = api.updateSnapshot(plan);
    const projet = choisirProjet(snapshot, plan);
    if (!projet) throw new Error(`Programme TypeScript introuvable : ${(plan.openProjects ?? plan.openFiles).join(', ')}`);
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
    return { openProjects: [temporaire] };
  });
}

export function virtualProgram(files, options = {}) {
  const root = norm(VIRTUAL_ROOT);
  const config = `${root}/tsconfig.analyse-virtuelle.json`;
  const sources = Object.fromEntries(Object.entries(files).map(([rel, text]) => [norm(path.resolve(root, rel)), text]));
  if (Object.hasOwn(sources, config)) throw new Error(`Fichier réservé à la configuration native : ${config}`);
  const compilerOptions = { ...OPTIONS_VIRTUELLES, ...options };
  sources[config] = JSON.stringify({ compilerOptions, files: Object.keys(sources) });
  const nativePackage = require.resolve(`@typescript/typescript-${process.platform}-${process.arch}/package.json`);
  const libDir = `${norm(path.join(path.dirname(nativePackage), 'lib'))}/`;
  const dansLesLibs = name => !compilerOptions.noLib && (norm(name) === libDir.slice(0, -1) || norm(name).startsWith(libDir));
  return ouvrir(root, fichiersVirtuels(sources, dansLesLibs), () => ({ openProjects: [config] }));
}

function fichiersVirtuels(sources, dansLesLibs = () => false) {
  const { createVirtualFileSystem } = require('typescript/unstable/fs');
  const fs = createVirtualFileSystem(sources);
  const read = fs.readFile;
  const existe = fs.fileExists;
  const dossier = fs.directoryExists;
  const entrees = fs.getAccessibleEntries;
  fs.readFile = name => read(name) ?? (dansLesLibs(name) && name.endsWith('.d.ts') ? undefined : null);
  fs.fileExists = name => existe(name) || (dansLesLibs(name) && name.endsWith('.d.ts') ? undefined : false);
  fs.directoryExists = name => dossier(name) || (dansLesLibs(name) ? undefined : false);
  fs.getAccessibleEntries = name => entrees(name) ?? (dansLesLibs(name) ? undefined : { files: [], directories: [] });
  return fs;
}

export function syntaxProgram(files) {
  const root = norm(path.resolve(VIRTUAL_ROOT, '__analyse_syntaxique__')).replace(/^([A-Za-z]):/, (_, drive) => `${drive.toLowerCase()}:`);
  const config = `${root}/tsconfig.json`;
  const entree = `${root}/racine.TS`;
  const sources = Object.fromEntries(Object.entries(files).map(([rel, text]) => [norm(path.resolve(VIRTUAL_ROOT, rel)), text]));
  for (const reserve of [config, entree]) {
    const collision = Object.keys(sources).find(nom => nom.toLowerCase() === reserve.toLowerCase());
    if (collision !== undefined) throw new Error(`Fichier réservé à l’analyse syntaxique native : ${collision}`);
  }
  const references = Object.keys(sources).map(nom => {
    if (/[\r\n\u2028\u2029]/u.test(nom) || (nom.includes('"') && nom.includes("'"))) {
      throw new Error(`Chemin non représentable dans une référence syntaxique native : ${nom}`);
    }
    const guillemet = nom.includes('"') ? "'" : '"';
    return `/// <reference path=${guillemet}${nom}${guillemet} />`;
  });
  sources[entree] = references.join('\n');
  sources[config] = JSON.stringify({
    compilerOptions: { ...OPTIONS_VIRTUELLES, noLib: true, noResolve: true, allowJs: true, resolveJsonModule: true, jsx: 'preserve' },
    files: Object.keys(sources),
  });
  return ouvrir(root, fichiersVirtuels(sources), () => ({ openProjects: [config], openFiles: [entree] }),
    (snapshot, plan) => snapshot.getDefaultProjectForFile(plan.openFiles[0]));
}
