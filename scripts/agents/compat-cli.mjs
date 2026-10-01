import { readdir, readFile, mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { clotureDImports } from '../guards/lib/importGraph.mjs';
import { ENTREES_OUTIL, SURFACE_CLAUDE, SURFACE_CODEX, buildExpectedOutputs, collectDiffs, validateRolePairs } from './compat-core.mjs';

const CE_MODULE = fileURLToPath(import.meta.url);
const RACINE_DU_DEPOT = join(dirname(CE_MODULE), '..', '..');
const posix = (chemin) => chemin.replaceAll('\\', '/');
/** Ce module et le dossier des registres (`chargerRegistres`), relatifs à la racine du dépôt. */
const MODULE_REL = posix(relative(RACINE_DU_DEPOT, CE_MODULE));
const DOSSIER_DES_REGISTRES = posix(relative(RACINE_DU_DEPOT, join(dirname(CE_MODULE), '..', 'hooks')));

/** Ce que `snapshot` lit : des fichiers, et des dossiers parcourus en entier. */
export const FICHIERS_LUS = ['CLAUDE.md', 'AGENTS.md', '.claude/credo.md', '.codex/credo.md', SURFACE_CLAUDE, SURFACE_CODEX];
export const DOSSIERS_LUS = ['.claude/skills', '.agents/skills', '.claude/agents', '.codex/agents'];

/**
 * Le prédicat « ce chemin peut changer le verdict de `check` » sous `racine` : ce que `snapshot` lit,
 * la clôture d'imports de ce module et des registres que `chargerRegistres` importe, et
 * `package.json`, qui déclare la commande `agents:check`.
 * @param {string} racine @returns {(rel: string) => boolean}
 */
export function sourceDuCheck(racine) {
  const racines = [MODULE_REL, ...ENTREES_OUTIL.map(({ module }) => `${DOSSIER_DES_REGISTRES}/${module}`)].map((rel) => join(racine, rel));
  const code = [...clotureDImports(racines)].map((membre) => posix(relative(racine, resolve(membre))));
  const fichiers = new Set([...FICHIERS_LUS, ...code, 'package.json']);
  return (rel) => {
    const chemin = posix(rel);
    return fichiers.has(chemin) || DOSSIERS_LUS.some((dossier) => chemin.startsWith(`${dossier}/`));
  };
}

/** Les registres des points d'entrée (`ENTREES_OUTIL`), lus dans les modules de `scripts/hooks/`. */
export async function chargerRegistres(dossierHooks = join(RACINE_DU_DEPOT, DOSSIER_DES_REGISTRES)) {
  return new Map(await Promise.all(ENTREES_OUTIL.map(async ({ script, module, exporte }) =>
    [script, (await import(pathToFileURL(join(dossierHooks, module)).href))[exporte]])));
}

async function snapshot(root) {
  const files = new Map();
  async function visit(rel) {
    for (const entry of await readdir(join(root, rel), { withFileTypes: true }).catch(() => [])) {
      const child = join(rel, entry.name).replaceAll('\\', '/');
      if (entry.isDirectory()) await visit(child);
      else files.set(child, await readFile(join(root, child)));
    }
  }
  for (const rel of FICHIERS_LUS) {
    const data = await readFile(join(root, rel)).catch(() => null);
    if (data) files.set(rel, data);
  }
  for (const rel of DOSSIERS_LUS) await visit(rel);
  return files;
}

function validationDiagnostics(files) {
  const claude = new Map();
  const codex = new Map();
  for (const [path, bytes] of files) {
    if (path.startsWith('.claude/agents/') && path.endsWith('.md')) claude.set(path.slice(15, -3), bytes.toString('utf8'));
    if (path.startsWith('.codex/agents/') && path.endsWith('.toml')) codex.set(path.slice(14, -5), bytes.toString('utf8'));
  }
  return validateRolePairs(claude, codex);
}

const sleep = (milliseconds) => new Promise((resolveSleep) => setTimeout(resolveSleep, milliseconds));

export async function atomicWrite(root, rel, data, io = {}) {
  const operations = { mkdir, writeFile, rename, rm, randomUUID, sleep, ...io };
  const destination = join(root, rel);
  const temporary = `${destination}.agents-sync-${operations.randomUUID()}`;
  await operations.mkdir(dirname(destination), { recursive: true });
  await operations.writeFile(temporary, data);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await operations.rename(temporary, destination);
      return;
    } catch (error) {
      if (!['EPERM', 'EBUSY'].includes(error.code) || attempt === 2) {
        await operations.rm(temporary, { force: true });
        throw error;
      }
      await operations.sleep(10 * (attempt + 1));
    }
  }
}

export async function runCompat({ root, mode }, dependencies = {}) {
  if (!['sync', 'check'].includes(mode)) throw new Error(`mode invalide: ${mode}`);
  const takeSnapshot = dependencies.snapshot ?? snapshot;
  const writeAtomically = dependencies.atomicWrite ?? atomicWrite;
  const remove = dependencies.rm ?? rm;
  const registres = dependencies.registres ?? await chargerRegistres();
  const actual = await takeSnapshot(root);
  const expected = buildExpectedOutputs(actual, registres);
  const diagnostics = [...collectDiffs(expected, actual), ...validationDiagnostics(actual)];
  if (mode === 'sync') {
    const unsafe = diagnostics.filter((item) => item.safe === false || item.type.startsWith('unsafe-'));
    if (unsafe.length) return diagnostics;
    for (const item of diagnostics.filter((entry) => entry.safe)) {
      const data = expected.files.get(item.destination);
      if (data) await writeAtomically(root, item.destination, data);
      else if (item.type === 'orphan') await remove(join(root, item.destination), { force: true });
    }
    const refreshed = await takeSnapshot(root);
    return [...collectDiffs(buildExpectedOutputs(refreshed, registres), refreshed), ...validationDiagnostics(refreshed)];
  }
  return diagnostics;
}

if (import.meta.main) {
  const mode = process.argv[2];
  const root = resolve(process.argv[3] ?? RACINE_DU_DEPOT);
  const diagnostics = await runCompat({ root, mode });
  if (diagnostics.length) {
    process.stderr.write(`${diagnostics.map((d) => `${d.family}:${d.type}:${d.destination}: ${d.message}`).join('\n')}\n`);
    process.exitCode = 1;
  }
}
