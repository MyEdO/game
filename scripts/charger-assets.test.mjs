import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { test } from 'node:test'
import { chargerEvaluateur } from '../hotes/godot/asset/charger.mjs'

test("l'évaluateur refuse les sélecteurs inconnus avant de charger Vite", async (t) => {
  const resolus = []
  const viteFactice = 'data:text/javascript,' + encodeURIComponent('export const runnerImport = () => ({ module: {} })')
  const hooks = registerHooks({
    resolve(spec, contexte, suite) {
      if (spec !== 'vite') return suite(spec, contexte)
      resolus.push(spec)
      return { url: viteFactice, shortCircuit: true }
    },
  })
  t.after(() => hooks.deregister())

  for (const selecteur of ['temoin.ts?inertie', 'temoin.ts#inertie', 'constructor', '__proto__', 'fichier-inerte.ts']) {
    await assert.rejects(() => chargerEvaluateur(selecteur), /sélecteur d'évaluateur inconnu/, selecteur)
  }
  assert.deepEqual(resolus, [])
})
