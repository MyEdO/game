import { test } from 'node:test'
import assert from 'node:assert/strict'
import { constructionsReserveesDuCorpus, ECHAPPEUR_DE_LITTERAL } from '../../guards/lib/canonUnique.mjs'
import { corpusTypeScriptDesGardes } from '../../guards/lib/commentPoison.mjs'

const ECHAPPEUR = { ...ECHAPPEUR_DE_LITTERAL, foyer: 'scripts/guards/lib/litteralJs.mjs' }

test('ECHAPPEUR_DE_LITTERAL : aucun échappeur du guillemet simple écrit hors de `litteralJs.mjs`', () => {
  assert.deepEqual(constructionsReserveesDuCorpus(corpusTypeScriptDesGardes(), [ECHAPPEUR]), [])
})
