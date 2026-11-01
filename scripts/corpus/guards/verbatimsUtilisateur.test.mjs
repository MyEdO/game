import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { verbatimsDuCorpus } from '../../guards/lib/verbatimsUtilisateur.mjs'

test('#3175 : les consignes vivantes renvoient au porteur des verbatims utilisateur datés', () => {
  const racine = fileURLToPath(new URL('../../../', import.meta.url))
  const defauts = verbatimsDuCorpus({ racine })
  assert.deepEqual(defauts, [], defauts.map(({ chemin, ligne }) => `${chemin}:${ligne}`).join('\n'))
})
