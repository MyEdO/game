import '../node-requis.mjs';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Writable } from 'node:stream';
import { entreeHookNative, produireRecuSessionStart } from '../ops/session-start.mjs';

export function resolveCredoPath(surface, scriptUrl = import.meta.url) {
  if (!['claude', 'codex'].includes(surface)) throw new Error(`surface inconnue: ${surface}`);
  return join(dirname(fileURLToPath(scriptUrl)), '..', '..', `.${surface}`, 'credo.md');
}

export async function injectProjectCredo(surface, scriptUrl = import.meta.url, output = process.stdout, { env = process.env, entree, worktree = process.cwd() } = {}) {
  const path = resolveCredoPath(surface, scriptUrl);
  const credo = await readFile(path, 'utf8');
  if (!credo.trim()) throw new Error(`${path}: credo vide`);
  if (output instanceof Writable) await new Promise((ok, non) => {
    output.once('error', non);
    output.write(credo, (error) => { if (error) non(error); else { output.removeListener('error', non); ok(); } });
  });
  else output.write(credo);
  produireRecuSessionStart({ surface, entree, env, worktree, credo });
}

if (import.meta.main)
  entreeHookNative().then((entree) => injectProjectCredo(process.argv[2], import.meta.url, process.stdout, { entree })).catch((error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
