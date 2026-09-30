// Un catalogue de l'Atlas est un PUR RENDU des chapitres qu'il concatène (#2203) : `rendre()` ne lit
// aucun catalogue existant, donc aucun texte manuscrit ne peut y survivre à la régénération.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { syncBuiltinESMExports } from 'node:module'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { CATALOGUES, rendre } from './build-catalogs.mjs'

/** Les chemins que `fn` passe à `fs.readFileSync`, résolus. */
function lecturesDe(fn) {
  const lues = new Set()
  const readFileSync = fs.readFileSync
  fs.readFileSync = (chemin, ...reste) => {
    if (typeof chemin === 'string' || chemin instanceof URL) lues.add(resolve(chemin instanceof URL ? fileURLToPath(chemin) : chemin))
    return readFileSync(chemin, ...reste)
  }
  syncBuiltinESMExports()
  try {
    fn()
  } finally {
    fs.readFileSync = readFileSync
    syncBuiltinESMExports()
  }
  return lues
}

test('rendre() : chaque catalogue de CATALOGUES rendu, sans lire aucun catalogue', () => {
  let rendus
  const lues = lecturesDe(() => { rendus = rendre() })
  assert.ok(lues.size > 0, 'aucune lecture mesurée — l’espion ne voit rien')
  assert.equal(rendus.size, CATALOGUES.length)
  assert.deepEqual([...rendus.keys()].filter((c) => lues.has(resolve(c))), [])
})
