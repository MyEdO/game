import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { injectProjectCredo } from './inject-project-credo.mjs';

test('résout le credo depuis le script, indépendamment du cwd', async () => {
  const root = await mkdtemp(join(tmpdir(), 'credo-'));
  const scriptUrl = new URL(`file:///${join(root, 'scripts/hooks/inject-project-credo.mjs').replaceAll('\\', '/')}`);
  await mkdir(join(root, '.claude'), { recursive: true });
  await writeFile(join(root, '.claude/credo.md'), 'Credo\n');
  let value = '';
  await injectProjectCredo('codex', scriptUrl.href, { write: (chunk) => { value += chunk; } }, { env: {} });
  assert.equal(value, 'Credo\n');
});
