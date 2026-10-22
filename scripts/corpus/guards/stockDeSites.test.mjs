import { test } from 'node:test'
import assert from 'node:assert/strict'
import { constructionsReserveesDuCorpus, ECRITURE_DE_STOCK_JSON } from '../../guards/lib/canonUnique.mjs'
import { corpusTypeScriptDesGardes } from '../../guards/lib/commentPoison.mjs'

const ECRITURE = { ...ECRITURE_DE_STOCK_JSON, foyer: 'scripts/guards/lib/stockDeSites.mjs' }

test('ECRITURE_DE_STOCK_JSON : aucune écriture du format JSON des stocks hors de `texteDeStock`', () => {
  assert.deepEqual(constructionsReserveesDuCorpus(corpusTypeScriptDesGardes(), [ECRITURE]), [])
})
