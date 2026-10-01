// Journal des hooks git (#2194) : forme de la ligne, écriture à la SORTIE du processus, et un journal
// en panne qui ne change rien au hook.
//   node --test scripts/git-hooks/journal.test.mjs
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import { join } from 'node:path'
import { CHEMIN_DU_JOURNAL, journaliserLeHook, ligneDeJournal, verdictDe } from './journal.mjs'

const lue = (ligne) => {
  assert.ok(ligne.endsWith('\n'), 'une ligne par exécution')
  assert.equal(ligne.indexOf('\n'), ligne.length - 1, 'une seule ligne')
  return JSON.parse(ligne)
}

test('forme : date ISO, hook, durée entière en ms, code, verdict, refus nommés', () => {
  const date = new Date('2026-10-01T08:00:00.000Z')
  assert.deepEqual(lue(ligneDeJournal({ hook: 'pre-commit', date, ms: 1234.6, code: 1, refus: ['a.ts:3 [pierre tombale] x'] })), {
    date: '2026-10-01T08:00:00.000Z', hook: 'pre-commit', ms: 1235, code: 1, verdict: 'refusé', refus: ['a.ts:3 [pierre tombale] x'],
  })
})

test('verdict : 0 franchit, un refus nommé refuse, un code non nul sans refus est une panne', () => {
  assert.equal(verdictDe(0, []), 'franchi')
  assert.equal(verdictDe(1, ['x']), 'refusé')
  assert.equal(verdictDe(1, []), 'panne')
})

test('la ligne s’écrit à la sortie, sous la racine, avec le code de sortie et les refus nommés', () => {
  const processus = new EventEmitter()
  const ecrites = []
  const journal = journaliserLeHook('pre-push', { racine: 'R', processus, ecrire: (chemin, ligne) => ecrites.push({ chemin, ligne }) })
  journal.refuser('push vers main REFUSÉ', 'origin hors dépôt')
  assert.deepEqual(ecrites, [], 'rien avant la sortie')
  processus.emit('exit', 1)
  assert.equal(ecrites.length, 1)
  assert.equal(ecrites[0].chemin, join('R', CHEMIN_DU_JOURNAL))
  const { hook, code, verdict, refus, ms } = lue(ecrites[0].ligne)
  assert.deepEqual({ hook, code, verdict, refus }, { hook: 'pre-push', code: 1, verdict: 'refusé', refus: ['push vers main REFUSÉ', 'origin hors dépôt'] })
  assert.ok(Number.isInteger(ms) && ms >= 0, String(ms))
})

test('journal en panne : la sortie du hook se déroule sans exception', () => {
  const processus = new EventEmitter()
  journaliserLeHook('commit-msg', { processus, ecrire: () => { throw new Error('EACCES') } })
  assert.doesNotThrow(() => processus.emit('exit', 0))
})
