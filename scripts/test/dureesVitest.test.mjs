// Banc du reporter des durées Vitest (#2400) : la somme des phases de `diagnostic()` de chaque module.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { dureesDesModules } from './dureesVitest.mjs'

const module = (moduleId, phases) => ({ moduleId, diagnostic: () => phases })

test('dureesVitest : environnement + préparation + collecte + setup + exécution, par chemin absolu', () => {
  assert.deepEqual(dureesDesModules([
    module('/r/a.test.ts', { environmentSetupDuration: 1, prepareDuration: 20, collectDuration: 300, setupDuration: 4000, duration: 50000, heap: 9 }),
    module('/r/b.test.ts', { environmentSetupDuration: 0, prepareDuration: 0, collectDuration: 0, setupDuration: 0, duration: 7 }),
  ]), { '/r/a.test.ts': 54321, '/r/b.test.ts': 7 })
})
