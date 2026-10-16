import test from 'node:test'
import assert from 'node:assert/strict'
import { etapeProfilee } from './etape-profilee.mjs'

test('début publié avant le geste, fin et mesure datée même en cas d’exception', () => {
  const sorties = []
  let temps = 10
  let jour = Date.parse('2026-10-12T07:00:00.000Z')
  let mesure
  const options = { annoncer: (texte) => sorties.push(texte), horloge: () => temps, date: () => new Date(jour), mesurer: (vu) => { mesure = vu } }
  assert.throws(() => etapeProfilee('installation', () => {
    assert.deepEqual(sorties, ['installation — début\n'])
    temps = 45
    jour += 35
    throw new Error('rouge')
  }, options), /rouge/)
  assert.deepEqual(sorties, ['installation — début\n', 'installation — fin (35 ms)\n'])
  assert.deepEqual(mesure, { nom: 'installation', debut: '2026-10-12T07:00:00.000Z', fin: '2026-10-12T07:00:00.035Z', ms: 35 })
})
