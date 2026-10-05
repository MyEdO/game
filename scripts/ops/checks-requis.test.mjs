// Checks requis du sha poussé sur `main` (#2178) : `fermetures.yml` ne ferme aucun ticket tant que
// chacun n'a pas une course TERMINÉE et `success`. Sans réseau : les check-runs sont littéraux.
//   node --test scripts/ops/checks-requis.test.mjs   (chaîné dans `npm run test:ops`)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { refusDesChecks } from './checks-requis.mjs'

const SHA = 'f'.repeat(40)
const vert = (name) => ({ name, status: 'completed', conclusion: 'success' })

test('tous les checks requis VERTS : aucun refus, et un check non requis ne compte pas', () => {
  const checks = [vert('docs'), vert('types'), { name: 'autre', status: 'completed', conclusion: 'failure' }]
  assert.deepEqual(refusDesChecks({ checks, contextes: ['docs', 'types'], sha: SHA }), [])
})

test('un check requis ABSENT refuse et se nomme — le sha n’a été jugé par aucun commit de file', () => {
  assert.deepEqual(refusDesChecks({ checks: [vert('docs')], contextes: ['docs', 'suite'], sha: SHA }), [
    'check requis « suite » ABSENT sur fffffffff : aucun commit de file ne l’a jugé',
  ])
})

test('un check requis EN VOL, ROUGE, ANNULÉ ou SAUTÉ refuse — seul `success` est vert', () => {
  const checks = [
    { name: 'docs', status: 'in_progress', conclusion: null },
    { name: 'types', status: 'completed', conclusion: 'failure', html_url: 'https://x/1' },
    { name: 'suite', status: 'completed', conclusion: 'cancelled' },
    { name: 'migrations', status: 'completed', conclusion: 'skipped' },
  ]
  assert.deepEqual(refusDesChecks({ checks, contextes: ['docs', 'types', 'suite', 'migrations'], sha: SHA }), [
    'check requis « docs » EN VOL (in_progress) sur fffffffff',
    'check requis « types » de conclusion « failure » sur fffffffff — https://x/1',
    'check requis « suite » de conclusion « cancelled » sur fffffffff',
    'check requis « migrations » de conclusion « skipped » sur fffffffff',
  ])
})
