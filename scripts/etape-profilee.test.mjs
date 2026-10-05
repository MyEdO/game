import test from 'node:test'
import assert from 'node:assert/strict'
import { etapeProfilee } from './etape-profilee.mjs'

test('début publié avant le geste, fin et durée même en cas d’exception', () => {
  const sorties = []
  let temps = 10
  let mesure
  const options = { annoncer: (texte) => sorties.push(texte), horloge: () => temps, mesurer: (ms) => { mesure = ms } }
  assert.throws(() => etapeProfilee('installation', () => {
    assert.deepEqual(sorties, ['installation — début\n'])
    temps = 45
    throw new Error('rouge')
  }, options), /rouge/)
  assert.deepEqual(sorties, ['installation — début\n', 'installation — fin (35 ms)\n'])
  assert.equal(mesure, 35)
})
