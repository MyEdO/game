import '../node-requis.mjs';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Writable } from 'node:stream';
import { entreeHookNative, produireRecuSessionStart, DELAI_PREUVE_HOOK_MS } from '../ops/session-start.mjs';

/** Le credo, UN fichier pour les deux surfaces (#2726 B5). */
export function resolveCredoPath(scriptUrl = import.meta.url) {
  return join(dirname(fileURLToPath(scriptUrl)), '..', '..', '.claude', 'credo.md');
}

export async function injectProjectCredo(surface, scriptUrl = import.meta.url, output = process.stdout, { env = process.env, entree, worktree = process.cwd(), echeance = performance.now() + DELAI_PREUVE_HOOK_MS } = {}) {
  const path = resolveCredoPath(scriptUrl);
  const credo = await readFile(path, 'utf8');
  if (!credo.trim()) throw new Error(`${path}: credo vide`);
  if (output instanceof Writable) await new Promise((ok, non) => {
    output.once('error', non);
    output.write(credo, (error) => { if (error) non(error); else { output.removeListener('error', non); ok(); } });
  });
  else output.write(credo);
  await produireRecuSessionStart({ surface, entree, env, worktree, credo, echeance });
}

if (import.meta.main) {
  const echeance = performance.now() + DELAI_PREUVE_HOOK_MS;
  try { await injectProjectCredo(process.argv[2], import.meta.url, process.stdout, { entree: await entreeHookNative(), echeance }); }
  catch (error) { process.stderr.write(`${error.message}\n`); process.exitCode = 1; }
}
