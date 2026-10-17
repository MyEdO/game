import { test } from 'node:test'

import assert from 'node:assert/strict'

import { fileURLToPath } from 'node:url'

import { ventilationDeGit } from '../../guards/lib/cssImages.mjs'

import { banccssCouchestestmjs } from '../../guards/lib/bancCssCouches.mjs'
const { six, invariants, volet } = banccssCouchestestmjs

const RACINE = fileURLToPath(new URL('../../..', import.meta.url))

const ATTENDU = {
  '41aa406d5': [[19, 0, 0, 19, 3, 227], [0, 0, 0, 0, 0, 77]],
  'd25652e73': [[21, 0, 0, 21, 0, 450], [3, 0, 0, 3, 0, 133]],
  'c251f46af': [[352, 0, 158, 194, 111, 0], [122, 0, 48, 74, 38, 0]],
}

for (const [sha, [identite, espacement]] of Object.entries(ATTENDU)) {
  test(`D6″ commit cible ${sha}, lu dans l'histoire : aucun franchissement, la ventilation signée`, () => {
    const v = ventilationDeGit({ cwd: RACINE, base: `${sha}^`, tete: sha })
    assert.deepEqual(v.franchis.filter((f) => f.n > 0), [])
    assert.deepEqual(six(v.identite), volet(identite))
    assert.deepEqual(six(v.espacement), volet(espacement))
    invariants('identité', v.identite)
    invariants('espacement', v.espacement)
  })
}
