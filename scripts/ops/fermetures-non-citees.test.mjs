// CLIQUET des fermetures hors commit (node --test, sans réseau) : le comparateur est joué sur des
// fixtures, et la baseline RÉELLE est confrontée à son plafond.
// Lancé par `npm run test:ops`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DEPOT } from '../guards/lib/ticketsGh.mjs'
import { readFileSync } from 'node:fs'
import {
  comparerFermetures, rapportMarkdown, reculeDe, MARGE_CITATION_JOURS, CHEMIN_BASELINE,
  FERMEUR_CANARI, TITRE_CANARI, cheminFermees, fermeesDeLaFenetre, fermetureDeLIssue, fermeesDepuis,
} from './fermetures-non-citees.mjs'

/** Plafond de la baseline : il vit ICI, jamais dans le JSON — sans lui, le chemin le plus court pour
 *  « solder » une fermeture hors commit resterait d'ajouter une ligne à la baseline, canari vert. */
const PLAFOND = 12

const BASELINE = JSON.parse(readFileSync(CHEMIN_BASELINE, 'utf8'))

const fermee = (numero, extra = {}) => ({
  numero,
  titre: `titre de #${numero}`,
  closedAt: '2026-09-03T10:00:00Z',
  closedBy: 'cgauche',
  stateReason: 'completed',
  labels: [],
  ...extra,
})

const BASE_FIXTURE = { entrees: [{ numero: 1122 }, { numero: 1411 }] }

test('fermeture CITÉE par un commit fermant : rien à signaler, et elle sort même du rapport', () => {
  const r = comparerFermetures(BASE_FIXTURE, [fermee(1700)], ['1700'], [])
  assert.deepEqual(r.rouges, [])
  assert.deepEqual(r.rapport, [])
})

test('fermeture non citée DANS la baseline : aucun rouge, mais elle reste au rapport', () => {
  const r = comparerFermetures(BASE_FIXTURE, [fermee(1122)], [], [])
  assert.deepEqual(r.rouges, [])
  assert.equal(r.rapport.length, 1)
  assert.match(r.rapport[0], /^#1122 \[baseline\]/)
})

test('fermeture NEUVE non citée et sans solde : ROUGE NOMMÉ (numéro, titre, auteur, state_reason)', () => {
  const r = comparerFermetures(BASE_FIXTURE, [fermee(1700, { stateReason: 'completed' })], [], [])
  assert.equal(r.rouges.length, 1)
  assert.match(r.rouges[0], /FERMETURE NEUVE hors baseline/)
  assert.match(r.rouges[0], /#1700/)
  assert.match(r.rouges[0], /titre de #1700/)
  assert.match(r.rouges[0], /par cgauche/)
})

test('`not_planned` N EXEMPTE PAS : une fermeture « pas prévu » sans solde est exactement la fuite', () => {
  const r = comparerFermetures(BASE_FIXTURE, [fermee(1700, { stateReason: 'not_planned' })], [], [])
  assert.equal(r.rouges.length, 1)
  assert.match(r.rouges[0], /state_reason not_planned/)
})

test('label `duplicate` : SEUL exemptant — le survivant du doublon porte le solde', () => {
  const r = comparerFermetures(BASE_FIXTURE, [fermee(1700, { labels: ['duplicate'] })], [], [])
  assert.deepEqual(r.rouges, [])
  assert.match(r.rapport[0], /\[doublon \(exempté\)\]/)
})

// L'issue du canari se reconnaît à son TITRE, jamais à son label : les deux issues canari ouvertes
// (#1493, #1614) ont `labels: []`, donc une exemption par label serait INERTE à la première course verte.
const CANARI = { titre: `${TITRE_CANARI} — environnement ou suite cassés`, closedBy: FERMEUR_CANARI }

test('issue « Canari rouge » fermée par le CANARI (course verte) : exemptée — le rapport est dans son fil', () => {
  const r = comparerFermetures(BASE_FIXTURE, [fermee(1700, CANARI)], [], [])
  assert.deepEqual(r.rouges, [])
  assert.match(r.rapport[0], /\[canari \(exempté\)\]/)
})

test('issue « Canari rouge » SANS label est exemptée aussi : le label est une décoration', () => {
  const r = comparerFermetures(BASE_FIXTURE, [fermee(1700, { ...CANARI, labels: [] })], [], [])
  assert.deepEqual(r.rouges, [], '#1493 et #1614 n’ont AUCUN label : l’exemption doit tenir sans lui')
})

test('issue « Canari rouge » fermée par un HUMAIN : ROUGE — les deux conditions comptent', () => {
  const r = comparerFermetures(BASE_FIXTURE, [fermee(1700, { titre: CANARI.titre })], [], [])
  assert.equal(r.rouges.length, 1)
  assert.match(r.rouges[0], /FERMETURE NEUVE hors baseline/)
  assert.match(r.rouges[0], /par cgauche/)
})

test('autre issue fermée par le bot : ROUGE — le bot ne blanchit pas ce qu’il ferme par ailleurs', () => {
  const r = comparerFermetures(BASE_FIXTURE, [fermee(1700, { closedBy: FERMEUR_CANARI })], [], [])
  assert.equal(r.rouges.length, 1)
})

test('fermeture NEUVE dont le solde est SUIVI par git : aucun rouge', () => {
  const r = comparerFermetures(BASE_FIXTURE, [fermee(1700)], [], ['1700'])
  assert.deepEqual(r.rouges, [])
  assert.match(r.rapport[0], /\[solde suivi\]/)
})

test('entrée de baseline qui a depuis un SOLDE → ROUGE « entrée périmée : retire-la »', () => {
  const r = comparerFermetures(BASE_FIXTURE, [fermee(1122), fermee(1411)], [], ['1122'])
  assert.equal(r.rouges.length, 1)
  assert.match(r.rouges[0], /entrée périmée : retire-la — #1122/)
})

test('entrée de baseline qui a depuis un COMMIT FERMANT → ROUGE « entrée périmée »', () => {
  const r = comparerFermetures(BASE_FIXTURE, [fermee(1122), fermee(1411)], ['1122'], [])
  assert.equal(r.rouges.length, 1)
  assert.match(r.rouges[0], /entrée périmée : retire-la — #1122/)
})

test('entrée de baseline SORTIE de la fenêtre n’est pas périmée (aucune preuve, juste hors champ)', () => {
  const r = comparerFermetures(BASE_FIXTURE, [fermee(1411)], [], [])
  assert.deepEqual(r.rouges, [], '#1122, fermée avant la fenêtre, ne se retire pas faute d’avoir été VUE')
})

test('le rapport markdown nomme la fenêtre et rend un verdict même vide', () => {
  const md = rapportMarkdown({ depuis: '2026-08-20', rapport: [], rouges: [] })
  assert.match(md, /### Fermetures hors commit depuis le 2026-08-20/)
  assert.match(md, /aucune fermeture non citée dans la fenêtre/)
  assert.match(md, /\*\*Aucun écart à la baseline\.\*\*/)
})

test('CLIQUET : la baseline RÉELLE ne dépasse pas son plafond et chaque entrée est complète', () => {
  assert.ok(
    BASELINE.entrees.length <= PLAFOND,
    `baseline en HAUSSE : ${BASELINE.entrees.length} entrées pour un plafond de ${PLAFOND} — une fermeture hors commit se SOLDE, elle ne s’inscrit pas.`,
  )
  for (const e of BASELINE.entrees) {
    for (const champ of ['numero', 'closedAt', 'closedBy', 'stateReason', 'titre']) {
      assert.ok(String(e[champ] ?? '').trim(), `entrée #${e.numero} sans ${champ}`)
    }
    assert.match(e.closedAt, /^\d{4}-\d{2}-\d{2}T/, `entrée #${e.numero} : closedAt non ISO`)
  }
  assert.match(BASELINE.mesureLe, /^\d{4}-\d{2}-\d{2}$/)
  assert.match(BASELINE.fenetre, /^\d{4}-\d{2}-\d{2}$/)
})

test('la fenêtre des CITATIONS déborde celle des fermetures (faux rouge de bord #1385)', () => {
  assert.equal(reculeDe('2026-08-20', MARGE_CITATION_JOURS), '2026-08-13')
  assert.ok(MARGE_CITATION_JOURS >= 1, 'un commit fermant PRÉCÈDE toujours la fermeture vue par l’API')
})

// ── lecture REST de la fenêtre (#1813) ────────────────────────────────────────

test('la fenêtre se demande à la route des ISSUES du dépôt, jamais à `search/issues`', () => {
  // `search/issues` et `gh api --paginate` sont refusés HTTP 403 aux sessions agent
  // (« This GitHub API path is not available in agent sessions », mesuré 2026-09-18).
  const chemin = cheminFermees(`${DEPOT}`, '2026-09-01')
  assert.equal(chemin, `repos/${DEPOT}/issues?state=closed&since=2026-09-01T00:00:00Z`)
  assert.equal(/search\/issues|paginate/.test(chemin), false)
})

const issue = (n, extra = {}) => ({
  number: n,
  title: `titre de #${n}`,
  closed_at: '2026-09-03T10:00:00Z',
  state_reason: 'completed',
  labels: [{ name: 'bug' }],
  ...extra,
})

test('fermetureDeLIssue : les champs de la BASELINE, ni renommés ni reformés', () => {
  assert.deepEqual(fermetureDeLIssue(issue(1700)), {
    numero: 1700,
    titre: 'titre de #1700',
    closedAt: '2026-09-03T10:00:00Z',
    stateReason: 'completed',
    labels: ['bug'],
  })
  // `state_reason` nul se lit « null », comme le rendait `(.state_reason // "null")`.
  assert.equal(fermetureDeLIssue(issue(1, { state_reason: null })).stateReason, 'null')
  assert.deepEqual(fermetureDeLIssue(issue(1, { labels: [] })).labels, [])
})

test('le paramètre `since` porte sur `updated_at` : le filtre CLIENT taille la fenêtre exacte', () => {
  // `since` est donc PLUS LARGE que voulu — aucune fermeture n'est manquée, mais une issue TOUCHÉE
  // dans la fenêtre et fermée AVANT elle remonte, et n'est pas une fermeture de cette fenêtre.
  const lues = [
    issue(1700, { closed_at: '2026-09-03T10:00:00Z' }),
    issue(1600, { closed_at: '2026-08-12T23:59:59Z' }),
  ]
  assert.deepEqual(fermeesDeLaFenetre(lues, '2026-09-01').map((f) => f.numero), [1700])
  // La borne est INCLUSIVE : une fermeture à l'instant d'ouverture de la fenêtre en fait partie.
  assert.deepEqual(
    fermeesDeLaFenetre([issue(9, { closed_at: '2026-09-01T00:00:00Z' })], '2026-09-01').map((f) => f.numero),
    [9],
  )
})

test('la route des issues sert AUSSI les pull requests : elles sont ÉCARTÉES', () => {
  const lues = [issue(1700), issue(1701, { pull_request: { url: '…' } })]
  assert.deepEqual(fermeesDeLaFenetre(lues, '2026-09-01').map((f) => f.numero), [1700])
})

test('une issue sans `closed_at` ne peut pas être datée : elle sort de la fenêtre', () => {
  assert.deepEqual(fermeesDeLaFenetre([issue(1700, { closed_at: null })], '2026-09-01'), [])
})

test('fermeesDepuis : TOUT passe par la couture injectée — `closedBy` compris, sinon le banc part sur le réseau', () => {
  const vus = []
  const appel = (args) => {
    vus.push(args)
    if (args[1].startsWith(`repos/${DEPOT}/issues?`)) {
      return { ok: true, stdout: JSON.stringify([issue(1700), issue(1701, { pull_request: { url: '…' } })]) }
    }
    return { ok: true, stdout: 'cgauche\n' }
  }
  const f = fermeesDepuis('2026-09-01', appel)
  assert.deepEqual(f.map((x) => [x.numero, x.closedBy]), [[1700, 'cgauche']])
  // La liste, puis le seul ticket retenu : la pull request écartée ne coûte aucun appel.
  assert.deepEqual(vus.map((a) => a[1]), [
    `repos/${DEPOT}/issues?state=closed&since=2026-09-01T00:00:00Z&per_page=100&page=1`,
    `repos/${DEPOT}/issues/1700`,
  ])
  assert.equal(vus.length, 2, 'aucun appel n’échappe au feint : une lecture hors couture partirait sur le réseau')
})

test('fermeesDepuis : un `closedBy` illisible est NOMMÉ comme l’est un refus de liste', () => {
  const appel = (args) => (args[1].includes('?')
    ? { ok: true, stdout: JSON.stringify([issue(1700)]) }
    : { ok: false, raison: 'gh: Not Found (HTTP 404)' })
  assert.throws(() => fermeesDepuis('2026-09-01', appel), /#1700 : qui l’a fermée est illisible — gh: Not Found/)
})

test('fermeesDepuis : un refus de LISTE est nommé, et rien n’est rendu', () => {
  assert.throws(
    () => fermeesDepuis('2026-09-01', () => ({ ok: false, raison: 'HTTP 403' })),
    /lecture des issues fermées impossible — HTTP 403/,
  )
})
