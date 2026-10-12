import test from 'node:test'

import assert from 'node:assert/strict'

import { spawnSync } from 'node:child_process'

import { fileURLToPath } from 'node:url'

test('optionalité native : générateur MapSpec conserve desc optionnel et son démarrage compilable', () => {
  const enfant = spawnSync(process.execPath, ['scripts/docs/lib/rendre-seul.mjs', 'scripts/docs/build-map-authoring.mjs'], {
    cwd: fileURLToPath(new URL('../../../', import.meta.url)), encoding: 'utf8',
  })
  assert.equal(enfant.status, 0, enfant.stderr)
  assert.match(enfant.stdout, /\| `desc\?` \| `string` \|/)
  assert.match(enfant.stdout, /Champs REQUIS de `MapSpec` : `size`, `id`, `label`\./)
  assert.match(enfant.stdout, /`startMessage\.texte`/)
  assert.match(enfant.stdout, /`startMessage\.source\?`/)
  assert.match(enfant.stdout, /`startMessage\.adapteDe\?`/)
})
