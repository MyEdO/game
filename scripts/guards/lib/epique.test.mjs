// Tests de `epique.mjs` : le label `épique` et le parent natif (`parent_issue_url`).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { estEpique, parentDe } from './epique.mjs'

test('estEpique : le label, jamais le titre', () => {
  assert.equal(estEpique({ labels: [{ name: 'épique' }] }), true)
  assert.equal(estEpique({ labels: ['sev:mineur', 'épique'] }), true)
  assert.equal(estEpique({ title: 'Épique : refonte', labels: [{ name: 'sev:mineur' }] }), false)
  assert.equal(estEpique({}), false)
})

test('parentDe : numéro tiré de `parent_issue_url`, null sans parent', () => {
  assert.equal(parentDe({ parent_issue_url: 'https://api.github.com/repos/MyEdO/game/issues/2189' }), 2189)
  assert.equal(parentDe({ parent_issue_url: null }), null)
  assert.equal(parentDe({}), null)
  assert.equal(parentDe({ body: 'Épique : #2561' }), null, 'le corps ne rattache pas')
})
