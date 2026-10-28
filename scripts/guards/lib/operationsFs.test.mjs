import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs, { mkdtempSync, rmSync } from 'node:fs'
import { once } from 'node:events'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { OPERATIONS_FS, SANS_ECRITURE_FS } from './operationsFs.mjs'
import { ciblesDEcritureJS } from './ecrituresFichiers.mjs'
import { installer } from './intercepterEcritures.mjs'
import { listerDossier } from './lister.mjs'

// #3013
test('chaque fonction de `fs` et de `fs.promises` est une opération d’écriture ou déclarée sans écriture', () => {
  const oubliees = []
  for (const [nom, hote] of [['fs', fs], ['fs.promises', fs.promises]]) {
    for (const cle of Object.keys(hote)) {
      if (typeof hote[cle] !== 'function' || Object.hasOwn(OPERATIONS_FS, cle)) continue
      if (!SANS_ECRITURE_FS.has(cle.replace(/Sync$/, ''))) oubliees.push(`${nom}.${cle}`)
    }
  }
  assert.deepEqual(oubliees, [])
})

test('la détection statique lit la cible d’un constructeur et celle portée en option', () => {
  const texte = [
    "import fs, { WriteStream } from 'node:fs'",
    "const dest = 'non-plie.log'",
    "new fs.Utf8Stream({ dest: 'journal.log', sync: true })",
    'new fs.Utf8Stream({ dest })',
    'new fs.Utf8Stream({ fd: 1 })',
    'new fs.Utf8Stream(calcul())',
    "new WriteStream('flux.txt')",
  ].join('\n')
  assert.deepEqual(ciblesDEcritureJS([{ texte }])[0], [
    { chemin: 'journal.log', inconnue: false, operation: 'Utf8Stream' },
    { chemin: null, inconnue: true, operation: 'Utf8Stream' },
    { chemin: null, inconnue: true, operation: 'Utf8Stream' },
    { chemin: 'flux.txt', inconnue: false, operation: 'WriteStream' },
  ])
})

test('l’interception refuse sous la racine les opérations neuves de la table, constructeurs compris', async () => {
  const racine = mkdtempSync(join(tmpdir(), 'operations-fs-racine-'))
  const dehors = mkdtempSync(join(tmpdir(), 'operations-fs-dehors-'))
  const signales = []
  let permis, restes
  const desinstaller = installer({ racine, signaler: (message) => signales.push(message) })
  try {
    const refuse = (geste) => assert.throws(geste, /REFUS écriture dans l'arbre/)
    if (typeof fs.mkdtempDisposableSync === 'function') refuse(() => fs.mkdtempDisposableSync(join(racine, 'jetable-')))
    if (typeof fs.Utf8Stream === 'function') refuse(() => new fs.Utf8Stream({ dest: join(racine, 'journal.log'), sync: true }))
    refuse(() => new fs.WriteStream(join(racine, 'flux.txt')))
    permis = fs.createWriteStream(join(dehors, 'permis.txt'))
    assert.ok(permis instanceof fs.WriteStream)
  } finally {
    desinstaller()
    if (permis) await once(permis.end(), 'close')
    restes = listerDossier(racine)
    rmSync(dehors, { recursive: true, force: true })
    rmSync(racine, { recursive: true, force: true })
  }
  assert.deepEqual(restes, [])
  assert.ok(signales.length > 0)
})
