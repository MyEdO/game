import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CODE_SOURCE_MODIFIEE, codeEnfant } from './codesDeSortie.mjs'

test('une source modifiée au cours de la génération rend le statut 79 (#2603)', () => {
  assert.equal(CODE_SOURCE_MODIFIEE, 79)
})

test('codeEnfant : signal et code absent valent échec, le code rendu sinon (#2586)', () => {
  assert.equal(codeEnfant(0, null), 0)
  assert.equal(codeEnfant(1, null), 1)
  assert.equal(codeEnfant(3, null), 3)
  assert.equal(codeEnfant(null, 'SIGTERM'), 1)
  assert.equal(codeEnfant(0, 'SIGTERM'), 1)
  assert.equal(codeEnfant(null, null), 1)
})
