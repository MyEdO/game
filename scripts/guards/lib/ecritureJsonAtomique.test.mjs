// Contrat de l'ÉCRITURE JSON ATOMIQUE : la cible porte la valeur, le dossier se crée, aucun temporaire ne reste.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ecrireJsonAtomique } from './ecritureJsonAtomique.mjs'
import { listerDossier } from './lister.mjs'

test('ecrireJsonAtomique : la cible porte la valeur, son dossier se crée, aucun temporaire ne reste', (t) => {
  const racine = mkdtempSync(join(tmpdir(), 'ecriture-json-'))
  t.after(() => rmSync(racine, { recursive: true, force: true }))
  const dossier = join(racine, 'sous', 'dossier')
  ecrireJsonAtomique(join(dossier, 'a.json'), { a: 1 })
  ecrireJsonAtomique(join(dossier, 'a.json'), { a: 2, b: [3] })
  assert.deepEqual(JSON.parse(readFileSync(join(dossier, 'a.json'), 'utf8')), { a: 2, b: [3] })
  assert.deepEqual(listerDossier(dossier), ['a.json'])
})
