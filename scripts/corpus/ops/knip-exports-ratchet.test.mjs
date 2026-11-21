import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { BASELINE, REPO } from '../../ops/knip-exports-ratchet.mjs'

test('la baseline committée est nominative, triée et portée par des fichiers présents', () => {
  const baseline = JSON.parse(readFileSync(BASELINE, 'utf8'))
  const fichiers = Object.keys(baseline)
  assert.ok(fichiers.length > 0)
  assert.deepEqual(fichiers, [...fichiers].sort(), 'baseline : fichiers non triés (diffs illisibles)')
  for (const [f, noms] of Object.entries(baseline)) {
    assert.ok(existsSync(join(REPO, f)), `${f} : chemin de baseline absent`)
    assert.ok(Array.isArray(noms) && noms.length > 0, `${f} : entrée vide`)
    assert.deepEqual(noms, [...noms].sort(), `${f} : noms non triés`)
  }
})
