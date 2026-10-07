import test from 'node:test'
import assert from 'node:assert/strict'
import { fusionDePr } from './fusionPr.mjs'

const SHA = 'a'.repeat(40)
const AUTRE = 'b'.repeat(40)
const UUID = '12345678-1234-1234-1234-123456789abc'
const PR = { id: 'PR42', headRefOid: SHA, state: 'OPEN', merged: false, mergeCommit: null, isInMergeQueue: false }
const json = (value) => ({ ok: true, stdout: JSON.stringify(value) })
const identite = (pr = PR) => json({ data: { repository: { pullRequest: pr } } })
const entree = (oid = SHA) => json({ data: { enqueuePullRequest: { mergeQueueEntry: { id: 'ENTRY', headCommit: { oid } } } } })
const http = (code, corps) => ({ ok: code < 400, raison: `HTTP ${code}`, stdout: `HTTP/2.0 ${code}\r\n\r\n${JSON.stringify(corps)}` })
const REFUS = http(400, { status: 'failed', details: { message: 'Enqueuer is not authorized to merge' } })

function banc(reponses, options = {}) {
  const appels = []
  const appel = (args, opts = {}) => {
    appels.push({ args, opts })
    assert.ok(reponses.length, `appel supplémentaire ${args.join(' ')}`)
    return reponses.shift()
  }
  return { appels, jouer: () => fusionDePr({ depot: 'MyEdO/game', numero: 42, sha: SHA, appel, ...options }) }
}

for (const uuid of [undefined, UUID]) test(`#2437 repli exact ${uuid ? 'GET' : 'PUT'} avec tête originale`, () => {
  const b = banc([identite(), REFUS, identite(), entree()], { uuid })
  assert.deepEqual(b.jouer(), { ok: true, statut: 'enqueued' })
  assert.deepEqual(b.appels[0].args, ['api', 'graphql', '--input', '-'])
  assert.deepEqual(JSON.parse(b.appels[0].opts.input).variables, { owner: 'MyEdO', name: 'game', number: 42 })
  assert.deepEqual(JSON.parse(b.appels[3].opts.input).variables, { input: { pullRequestId: 'PR42', expectedHeadOid: SHA } })
  assert.equal(b.appels[1].args.includes('PUT'), uuid === undefined)
})

test('#2437 HTTP structuré précis rattrapé sans dépendre du stderr', () => {
  const b = banc([identite(), http(403, { message: 'Enqueuer is not authorized to merge' }), identite(), entree()])
  assert.deepEqual(b.jouer(), { ok: true, statut: 'enqueued' })
})

test('#2437 file devenue présente après refus REST sans nouvelle mutation', () => {
  const b = banc([identite(), REFUS, identite({ ...PR, isInMergeQueue: true })])
  assert.deepEqual(b.jouer(), { ok: true, statut: 'enqueued' })
  assert.equal(b.appels.length, 3)
  assert.equal(b.appels.some((c) => c.args.includes('graphql') && JSON.parse(c.opts.input).query.startsWith('mutation')), false)
})

for (const relecture of [false, true]) test(`#2437 tête déplacée ${relecture ? 'entre refus et relecture' : 'avant REST'}`, () => {
  const b = banc([...(relecture ? [identite(), REFUS] : []), identite({ ...PR, headRefOid: AUTRE })])
  const vu = b.jouer()
  assert.equal(vu.ok, false)
  assert.match(vu.raison, /tête de PR changée/)
  assert.equal(b.appels.some((c) => c.args.includes('graphql') && JSON.parse(c.opts.input).query.startsWith('mutation')), false)
})

for (const uuid of [undefined, UUID]) test(`#2437 déjà en file ${uuid ? 'suivi' : 'demande'} sans REST ni mutation`, () => {
  const b = banc([identite({ ...PR, isInMergeQueue: true })], { uuid })
  assert.deepEqual(b.jouer(), { ok: true, statut: 'enqueued' })
  assert.equal(b.appels.length, 1)
})

for (const reponse of [
  http(202, { status: 'enqueued', details: {} }),
  http(409, { status: 'pending', details: { uuid: UUID, expected_head_sha: AUTRE } }),
  http(400, { status: 'failed', details: { message: 'checks refusés' } }),
  http(403, { message: 'Resource not accessible' }),
  { ok: false, raison: 'Enqueuer is not authorized to merge' },
  http(400, { status: 'failed', details: { message: 'Enqueuer is not authorized to merge ailleurs' } }),
]) test(`#2437 REST sans repli : ${reponse.stdout ?? reponse.raison}`, () => {
  const b = banc([identite(), reponse])
  const vu = b.jouer()
  assert.equal(b.appels.length, 2)
  if (vu.statut === 'pending') assert.deepEqual(vu, { ok: true, statut: 'pending', uuid: UUID, attendue: AUTRE, deja: true })
})

for (const pr of [null, {}, { ...PR, id: '' }, { ...PR, headRefOid: null }, { ...PR, merged: null },
  { ...PR, state: 'CLOSED' }, { ...PR, state: 'MERGED', merged: true, mergeCommit: null },
  { ...PR, isInMergeQueue: null }, { ...PR, state: 'MERGED', merged: false }])
  test(`#2437 identité malformée ou fermée ${JSON.stringify(pr)}`, () => {
    const b = banc([identite(pr)])
    assert.equal(b.jouer().ok, false)
    assert.equal(b.appels.length, 1)
  })

test('#2437 fusion confirmée avec commit valide et tête égale', () => {
  const b = banc([identite({ ...PR, state: 'MERGED', merged: true, mergeCommit: { oid: AUTRE } })])
  assert.deepEqual(b.jouer(), { ok: true, statut: 'merged', fusion: AUTRE })
})

for (const reponse of [
  entree(AUTRE), json({ data: { enqueuePullRequest: { mergeQueueEntry: null } } }),
  json({ data: { enqueuePullRequest: { mergeQueueEntry: { id: '', headCommit: { oid: SHA } } } } }),
  { ok: true, stdout: '' }, json({}), json({ errors: [{ message: 'head moved' }], data: { enqueuePullRequest: { mergeQueueEntry: { id: 'ENTRY', headCommit: { oid: SHA } } } } }),
  json({ errors: {}, data: {} }), { ok: false, raison: 'HTTP 403' },
]) test(`#2437 mutation refusée ou malformée ${reponse.stdout ?? reponse.raison}`, () => {
  const b = banc([identite(), REFUS, identite(), reponse])
  assert.equal(b.jouer().ok, false)
  assert.equal(b.appels.length, 4)
})

for (const reponse of [{ ok: true, stdout: '' }, json({ data: {} }), json({ errors: [{ message: 'forbidden' }], data: { repository: { pullRequest: PR } } }),
  { ok: false, raison: 'HTTP 403' }]) test(`#2437 lecture GraphQL refusée ${reponse.stdout ?? reponse.raison}`, () => {
  const b = banc([reponse])
  assert.equal(b.jouer().ok, false)
  assert.equal(b.appels.length, 1)
})
