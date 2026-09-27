import '../node-requis.mjs';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export function resolveCredoPath(surface, scriptUrl = import.meta.url) {
  if (!['claude', 'codex'].includes(surface)) throw new Error(`surface inconnue: ${surface}`);
  return join(dirname(fileURLToPath(scriptUrl)), '..', '..', `.${surface}`, 'credo.md');
}

export async function injectProjectCredo(surface, scriptUrl = import.meta.url, output = process.stdout) {
  const path = resolveCredoPath(surface, scriptUrl);
  const credo = await readFile(path, 'utf8');
  if (!credo.trim()) throw new Error(`${path}: credo vide`);
  output.write(credo);
}

if (import.meta.main)
  injectProjectCredo(process.argv[2]).catch((error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
