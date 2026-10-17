import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { rmSync, writeFileSync } from 'node:fs'
import { syncBuiltinESMExports } from 'node:module'
import { join, resolve } from 'node:path'
import { instanceDeDepot } from './depotGabarit.mjs'
import { photoArbre } from './photoArbre.mjs'

test('photoArbre : un chemin au nom impossible (ENAMETOOLONG, #2603) est absent', (t) => {
  const { racine } = instanceDeDepot({ fichiers: { 'garde.txt': 'commité' }, message: 'banc' })
  t.after(() => rmSync(racine, { recursive: true, force: true }))
  writeFileSync(join(racine, 'present.txt'), 'présent')
  writeFileSync(join(racine, 'impossible.txt'), 'impossible')
  const cible = resolve(racine, 'impossible.txt')
  const original = fs.lstatSync
  fs.lstatSync = (chemin, ...reste) => {
    if (resolve(String(chemin)) === cible) throw Object.assign(new Error('banc'), { code: 'ENAMETOOLONG' })
    return original(chemin, ...reste)
  }
  syncBuiltinESMExports()
  let photo
  try { photo = photoArbre(racine) } finally {
    fs.lstatSync = original
    syncBuiltinESMExports()
  }
  assert.equal(photo.erreur, null)
  const { empreintes } = JSON.parse(photo.texte)
  assert.deepEqual(Object.keys(empreintes), ['present.txt'])
})
