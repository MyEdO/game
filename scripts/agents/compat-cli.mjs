import { readdir, readFile, mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SURFACE_CLAUDE, SURFACE_CODEX, buildExpectedOutputs, collectDiffs, validateHookParity, validateRolePairs } from './compat-core.mjs';

async function snapshot(root) {
  const files = new Map();
  async function visit(rel) {
    for (const entry of await readdir(join(root, rel), { withFileTypes: true }).catch(() => [])) {
      const child = join(rel, entry.name).replaceAll('\\', '/');
      if (entry.isDirectory()) await visit(child);
      else files.set(child, await readFile(join(root, child)));
    }
  }
  for (const rel of ['CLAUDE.md', 'AGENTS.md', '.claude/credo.md', '.codex/credo.md', SURFACE_CLAUDE, SURFACE_CODEX]) {
    const data = await readFile(join(root, rel)).catch(() => null);
    if (data) files.set(rel, data);
  }
  for (const rel of ['.claude/skills', '.agents/skills', '.claude/agents', '.codex/agents']) await visit(rel);
  return files;
}

function validationDiagnostics(files) {
  const claude = new Map();
  const codex = new Map();
  for (const [path, bytes] of files) {
    if (path.startsWith('.claude/agents/') && path.endsWith('.md')) claude.set(path.slice(15, -3), bytes.toString('utf8'));
    if (path.startsWith('.codex/agents/') && path.endsWith('.toml')) codex.set(path.slice(14, -5), bytes.toString('utf8'));
  }
  const settings = files.get(SURFACE_CLAUDE);
  const hooks = files.get(SURFACE_CODEX);
  const diagnostics = validateRolePairs(claude, codex);
  if (!settings || !hooks) diagnostics.push({ family: 'hook', destination: !settings ? SURFACE_CLAUDE : SURFACE_CODEX, type: 'missing', message: 'configuration absente' });
  else {
    try { diagnostics.push(...validateHookParity(JSON.parse(settings), JSON.parse(hooks))); }
    catch (error) { diagnostics.push({ family: 'hook', destination: `${SURFACE_CLAUDE}/${SURFACE_CODEX}`, type: 'parse', message: error.message }); }
  }
  return diagnostics;
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
  const actual = await takeSnapshot(root);
  const expected = buildExpectedOutputs(actual);
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
    return [...collectDiffs(buildExpectedOutputs(refreshed), refreshed), ...validationDiagnostics(refreshed)];
  }
  return diagnostics;
}

if (import.meta.main) {
  const mode = process.argv[2];
  const root = resolve(process.argv[3] ?? join(dirname(fileURLToPath(import.meta.url)), '..', '..'));
  const diagnostics = await runCompat({ root, mode });
  if (diagnostics.length) {
    process.stderr.write(`${diagnostics.map((d) => `${d.family}:${d.type}:${d.destination}: ${d.message}`).join('\n')}\n`);
    process.exitCode = 1;
  }
}
