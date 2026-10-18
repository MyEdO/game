import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { ventilationDeGit } from '../../guards/lib/cssImages.mjs'
import { six, invariants, volet } from '../../test/lib/bancCssCouches.mjs'

const RACINE = fileURLToPath(new URL('../../..', import.meta.url))

/** Les chiffres signés du juge (commentaire #1806 5803399612, 2026-09-23) ; RETOURNÉ mesuré sur le
 *  stock ÉCRIT au parent, que la règle de réutilisation (L1) rend en partie au stock. */
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
