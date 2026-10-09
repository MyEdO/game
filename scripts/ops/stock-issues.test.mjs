// Banc du compteur du travail restant (node --test, sans réseau) : chaque comparateur est joué sur
// des entrées REST en fixture. Lancé par `npm run test:ops`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  balanceParVague, croissanceNette, emisesSansEpique, jugerStock, ticketsDeLaListe,
} from './stock-issues.mjs'

const MAINTENANT = Date.parse('2026-10-09T12:00:00Z')
const ilYa = (jours) => new Date(MAINTENANT - jours * 24 * 60 * 60 * 1000).toISOString()

/** Entrée REST minimale de `repos/<o>/<r>/issues?state=all`. */
const issue = (number, { ouvert = true, creee = 30, fermee = null, labels = [], body = '', parent = null, bot = false, pr = false } = {}) => ({
  number,
  state: ouvert ? 'open' : 'closed',
  created_at: ilYa(creee),
  closed_at: fermee === null ? null : ilYa(fermee),
  labels: labels.map((name) => ({ name })),
  body,
  parent_issue_url: parent === null ? null : `https://api.github.com/repos/MyEdO/game/issues/${parent}`,
  user: { type: bot ? 'Bot' : 'User' },
  ...(pr ? { pull_request: { url: 'x' } } : {}),
})

const tickets = (...entrees) => ticketsDeLaListe(entrees)

test('ticketsDeLaListe écarte les pull requests', () => {
  assert.deepEqual(tickets(issue(1), issue(2, { pr: true })).map((t) => t.numero), [1])
})

test('travail restant = issues ouvertes, épiques comprises', () => {
  const t = tickets(issue(1, { labels: ['épique'] }), issue(3, { parent: 1 }), issue(4, { ouvert: false, fermee: 2 }))
  assert.match(jugerStock(t, MAINTENANT).mesures.join('\n'), /travail restant : 2 issue\(s\) ouverte\(s\)/)
})

test('croissance nette sur 7 j glissants : ROUGE si créées > fermées', () => {
  const t = tickets(issue(1, { creee: 1 }), issue(2, { creee: 2 }), issue(3, { ouvert: false, creee: 20, fermee: 3 }), issue(4, { creee: 8 }))
  assert.deepEqual(croissanceNette(t, MAINTENANT), { creees: 2, fermees: 1, net: 1 })
  assert.match(jugerStock(t, MAINTENANT).rouges.join('\n'), /croissance nette 7 j positive \(\+1\)/)
  const equilibre = tickets(issue(1, { creee: 1 }), issue(3, { ouvert: false, creee: 20, fermee: 3 }))
  assert.doesNotMatch(jugerStock(equilibre, MAINTENANT).rouges.join('\n'), /croissance/)
})

test('émises sans épique : créées dans la fenêtre sans parent natif, bots COMPRIS, stock ancien et épiques exclus', () => {
  const t = tickets(
    issue(5, { creee: 1 }),
    issue(6, { creee: 2, body: 'Épique : #1' }),
    issue(7, { creee: 3, bot: true }),
    issue(8, { creee: 4, ouvert: false, fermee: 1 }),
    issue(1, { creee: 1, labels: ['épique'] }),
    issue(2, { creee: 1, parent: 1 }),
    issue(3, { creee: 30 }),
    issue(4, { creee: 40, bot: true }),
  )
  assert.deepEqual(emisesSansEpique(t, MAINTENANT), { total: 4, bots: 1 })
  const ligne = jugerStock(t, MAINTENANT).mesures.find((m) => m.startsWith('émises sans épique'))
  assert.equal(ligne, 'émises sans épique 7 j : 4 (dont 1 de bots)', 'le COMPTE seul, jamais la liste des numéros')
  assert.doesNotMatch(jugerStock(t, MAINTENANT).rouges.join('\n'), /émises/, 'une mesure, jamais un ROUGE')
})

test('balance par vague : ROUGE si les enfants fermés d\'une épique sont moins que ses enfants créés', () => {
  const t = tickets(
    issue(1, { labels: ['épique'] }),
    issue(2, { labels: ['épique'] }),
    issue(3, { labels: ['épique'] }),
    issue(10, { creee: 1, parent: 1 }),
    issue(11, { creee: 2, parent: 1 }),
    issue(12, { ouvert: false, creee: 30, fermee: 1, parent: 1 }),
    issue(20, { creee: 1, parent: 2 }),
    issue(21, { ouvert: false, creee: 30, fermee: 2, parent: 2 }),
    issue(30, { creee: 30, parent: 3 }),
  )
  assert.deepEqual(balanceParVague(t, MAINTENANT), [
    { epique: 1, creees: 2, fermees: 1, rouge: true },
    { epique: 2, creees: 1, fermees: 1, rouge: false },
  ])
  const { rouges } = jugerStock(t, MAINTENANT)
  assert.ok(rouges.some((r) => /vague de l'épique #1 : 1 enfant\(s\) fermé\(s\) < 2 créé\(s\)/.test(r)))
  assert.ok(!rouges.some((r) => /épique #2/.test(r)))
})

test("balance par vague : la CHAÎNE de parents remonte à l'épique (épique → sous-issue → ticket)", () => {
  const t = tickets(
    issue(1, { labels: ['épique'] }),
    issue(2, { parent: 1 }),
    issue(3, { creee: 1, parent: 2 }),
    issue(4, { creee: 2, parent: 2 }),
    issue(5, { ouvert: false, creee: 40, fermee: 1, parent: 2 }),
  )
  assert.deepEqual(balanceParVague(t, MAINTENANT), [{ epique: 1, creees: 2, fermees: 1, rouge: true }])
  const cycle = tickets(issue(7, { labels: ['épique'], parent: 8, creee: 1 }), issue(8, { parent: 7, creee: 1 }))
  assert.deepEqual(balanceParVague(cycle, MAINTENANT), [{ epique: 7, creees: 1, fermees: 0, rouge: true }], 'un cycle termine')
})
