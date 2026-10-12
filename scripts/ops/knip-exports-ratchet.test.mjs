import { test } from 'node:test'

import assert from 'node:assert/strict'

import { readFileSync } from 'node:fs'

import { join } from 'node:path'

import { flatten, compare, syncBaseline, REPO, HORS_GEL } from './knip-exports-ratchet.mjs'

const issue = (file, exports = [], types = []) => ({
  file,
  exports: exports.map((name) => ({ name })),
  types: types.map((name) => ({ name })),
  nsExports: [],
  nsTypes: [],
})

test('flatten : exports et types fusionnés, triés, gameIso hors gel', () => {
  const per = flatten([
    issue('src/state/a.ts', ['b', 'a'], ['T']),
    issue('src/gameIso/rig/x.ts', ['mort']),
    issue('src/ui/vide.ts', []),
  ])
  assert.deepEqual(per, { 'src/state/a.ts': ['T', 'a', 'b'] })
})

test('compare : un export mort NOUVEAU est une régression', () => {
  const { nouveaux, assainis } = compare({ 'a.ts': ['x', 'y'] }, { 'a.ts': ['x'] })
  assert.deepEqual(nouveaux, ['a.ts : y'])
  assert.deepEqual(assainis, [])
})

test('compare : un fichier NEUF entièrement mort est une régression', () => {
  const { nouveaux } = compare({ 'neuf.ts': ['z'] }, {})
  assert.deepEqual(nouveaux, ['neuf.ts : z'])
})

test('compare : une entrée assainie rend la baseline périmée', () => {
  const { nouveaux, assainis } = compare({ 'a.ts': ['x'] }, { 'a.ts': ['x', 'y'], 'b.ts': ['w'] })
  assert.deepEqual(nouveaux, [])
  assert.deepEqual(assainis, ['a.ts : y', 'b.ts : w'])
})

test('compare : stock inchangé = vert', () => {
  const { nouveaux, assainis } = compare({ 'a.ts': ['x'] }, { 'a.ts': ['x'] })
  assert.deepEqual([...nouveaux, ...assainis], [])
})

test('syncBaseline ne sait que RETIRER — jamais ajouter un export mort neuf', () => {
  const next = syncBaseline({ 'a.ts': ['x'], 'neuf.ts': ['z'] }, { 'a.ts': ['x', 'y'], 'b.ts': ['w'] })
  assert.deepEqual(next, { 'a.ts': ['x'] })
})

test('le filtre gameIso n’est PAS dans knip.json (sinon le graphe est coupé)', () => {
  const knip = JSON.parse(readFileSync(join(REPO, 'knip.json'), 'utf8'))
  const motifs = [...(knip.ignore ?? []), ...(knip.entry ?? []), ...(knip.project ?? [])]
  for (const m of motifs) assert.ok(!m.includes('gameIso'), `knip.json cite gameIso (${m}) : graphe coupé`)
  assert.deepEqual(HORS_GEL, ['src/gameIso/'], 'le hors-gel est le seul endroit où gameIso se filtre')
})
