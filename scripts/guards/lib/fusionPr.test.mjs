import test from 'node:test'
import assert from 'node:assert/strict'
import { fusionDePr, refusDEnfileur } from './fusionPr.mjs'
import { REFUS_DE_FILE } from '../../ops/fixtures/github-refus-file.mjs'

const SHA = 'a'.repeat(40)
const AUTRE = 'b'.repeat(40)
const UUID = '12345678-1234-1234-1234-123456789abc'
const COMPTE = 'cgauche'
const PR = { id: 'PR42', headRefOid: SHA, state: 'OPEN', merged: false, mergeCommit: null, isInMergeQueue: false }
const json = (value) => ({ ok: true, stdout: JSON.stringify(value) })
const identite = (pr = PR, viewer = { login: COMPTE }) => json({ data: { repository: { pullRequest: pr }, viewer } })
const entree = (oid = SHA) => json({ data: { enqueuePullRequest: { mergeQueueEntry: { id: 'ENTRY', headCommit: { oid } } } } })
const http = (code, corps) => ({ ok: code < 400, raison: `HTTP ${code}`, stdout: `HTTP/2.0 ${code}\r\n\r\n${JSON.stringify(corps)}` })
const refus = (message) => http(400, { status: 'failed', details: { message } })
const REFUS = refus(REFUS_DE_FILE.prefixe)
const estMutation = (c) => c.args.includes('graphql') && JSON.parse(c.opts.input).query.startsWith('mutation')

function banc(reponses, options = {}) {
  const appels = []
  const appel = (args, opts = {}) => {
    appels.push({ args, opts })
    assert.ok(reponses.length, `appel supplémentaire ${args.join(' ')}`)
    return reponses.shift()
  }
  return { appels, jouer: () => fusionDePr({ depot: 'MyEdO/game', numero: 42, sha: SHA, appel, ...options }) }
}

for (const uuid of [undefined, UUID]) test(`#2392 repli sur le refus RÉEL (préfixé) ${uuid ? 'GET' : 'PUT'} avec tête originale, compte nommé`, () => {
  const b = banc([identite(), REFUS, identite(), entree()], { uuid })
  assert.deepEqual(b.jouer(), { ok: true, statut: 'enqueued', compte: COMPTE })
  assert.deepEqual(b.appels[0].args, ['api', 'graphql', '--input', '-'])
  assert.deepEqual(JSON.parse(b.appels[0].opts.input).variables, { owner: 'MyEdO', name: 'game', number: 42 })
  assert.match(JSON.parse(b.appels[0].opts.input).query, /viewer \{ login \}/)
  assert.deepEqual(JSON.parse(b.appels[3].opts.input).variables, { input: { pullRequestId: 'PR42', expectedHeadOid: SHA } })
  assert.equal(b.appels[1].args.includes('PUT'), uuid === undefined)
})

test('#2392 le refus CONCATÉNÉ à d’autres causes déclenche aussi le repli', () => {
  const b = banc([identite(), refus(REFUS_DE_FILE.concatene), identite(), entree()])
  assert.deepEqual(b.jouer(), { ok: true, statut: 'enqueued', compte: COMPTE })
  assert.equal(b.appels.filter(estMutation).length, 1)
})

test('#2392 HTTP structuré (`corps.message`) au refus réel rattrapé sans dépendre du stderr', () => {
  const b = banc([identite(), http(403, { message: REFUS_DE_FILE.prefixe }), identite(), entree()])
  assert.deepEqual(b.jouer(), { ok: true, statut: 'enqueued', compte: COMPTE })
})

test('#2437 file devenue présente après refus REST sans nouvelle mutation', () => {
  const b = banc([identite(), REFUS, identite({ ...PR, isInMergeQueue: true })])
  assert.deepEqual(b.jouer(), { ok: true, statut: 'enqueued', deja: true, compte: COMPTE })
  assert.equal(b.appels.length, 3)
  assert.equal(b.appels.some(estMutation), false)
})

for (const relecture of [false, true]) test(`#2437 tête déplacée ${relecture ? 'entre refus et relecture' : 'avant REST'}`, () => {
  const b = banc([...(relecture ? [identite(), REFUS] : []), identite({ ...PR, headRefOid: AUTRE })])
  const vu = b.jouer()
  assert.equal(vu.ok, false)
  assert.match(vu.raison, /tête de PR changée/)
  assert.equal(vu.compte, COMPTE)
  assert.equal(b.appels.some(estMutation), false)
})

for (const uuid of [undefined, UUID]) test(`#2392 déjà en file ${uuid ? 'suivi' : 'demande'} sans REST ni mutation, constaté sous le compte`, () => {
  const b = banc([identite({ ...PR, isInMergeQueue: true })], { uuid })
  assert.deepEqual(b.jouer(), { ok: true, statut: 'enqueued', deja: true, compte: COMPTE })
  assert.equal(b.appels.length, 1)
})

for (const [reponse, attendu] of [
  [http(202, { status: 'enqueued', details: {} }), { ok: true, statut: 'enqueued', compte: COMPTE }],
  [http(409, { status: 'pending', details: { uuid: UUID, expected_head_sha: AUTRE } }), { ok: true, statut: 'pending', uuid: UUID, attendue: AUTRE, deja: true, compte: COMPTE }],
  [refus('checks refusés'), { ok: true, statut: 'failed', message: 'checks refusés', compte: COMPTE }],
  [http(403, { message: 'Resource not accessible' }), { ok: false, raison: 'HTTP 403 : Resource not accessible', compte: COMPTE }],
  [{ ok: false, raison: 'spawn gh ENOENT' }, { ok: false, raison: 'spawn gh ENOENT', compte: COMPTE }],
]) test(`#2392 REST sans repli, compte porté : ${reponse.stdout ?? reponse.raison}`, () => {
  const b = banc([identite(), reponse])
  assert.deepEqual(b.jouer(), attendu)
  assert.equal(b.appels.length, 2)
})

for (const pr of [null, {}, { ...PR, id: '' }, { ...PR, headRefOid: null }, { ...PR, merged: null },
  { ...PR, state: 'CLOSED' }, { ...PR, state: 'MERGED', merged: true, mergeCommit: null },
  { ...PR, isInMergeQueue: null }, { ...PR, state: 'MERGED', merged: false }])
  test(`#2437 identité malformée ou fermée ${JSON.stringify(pr)}`, () => {
    const b = banc([identite(pr)])
    assert.equal(b.jouer().ok, false)
    assert.equal(b.appels.length, 1)
  })

for (const reponse of [json({ data: { repository: { pullRequest: PR } } }), ...[null, {}, { login: '' }, { login: 42 }].map((viewer) => identite(PR, viewer))])
  test(`#2392 compte (viewer) illisible : identité refusée ${reponse.stdout}`, () => {
    const b = banc([reponse])
    assert.deepEqual(b.jouer(), { ok: false, raison: 'GraphQL compte (`viewer.login`) hors schéma' })
    assert.equal(b.appels.length, 1)
  })

test('#2437 fusion confirmée avec commit valide et tête égale', () => {
  const b = banc([identite({ ...PR, state: 'MERGED', merged: true, mergeCommit: { oid: AUTRE } })])
  assert.deepEqual(b.jouer(), { ok: true, statut: 'merged', fusion: AUTRE, compte: COMPTE })
})

test('#2392 refusDEnfileur : UNE ligne, le compte refusé, le message de GitHub, le bouton de la PR', () => {
  assert.equal(refusDEnfileur({ depot: 'MyEdO/game', numero: 42, compte: COMPTE, message: REFUS_DE_FILE.prefixe }),
    `mise en file REFUSÉE au compte « cgauche » : ${REFUS_DE_FILE.prefixe} — geste humain : bouton « Merge when ready » de https://github.com/MyEdO/game/pull/42`)
})

for (const [reponse, raison] of [
  [entree(AUTRE), 'GraphQL entrée de file absente ou tête différente'],
  [json({ data: { enqueuePullRequest: { mergeQueueEntry: null } } }), 'GraphQL entrée de file absente ou tête différente'],
  [json({ data: { enqueuePullRequest: { mergeQueueEntry: { id: '', headCommit: { oid: SHA } } } } }), 'GraphQL entrée de file absente ou tête différente'],
  [{ ok: true, stdout: '' }, 'GraphQL illisible : Unexpected end of JSON input'],
  [json({}), 'GraphQL sans données'],
  [json({ errors: [{ message: 'head moved' }], data: { enqueuePullRequest: { mergeQueueEntry: { id: 'ENTRY', headCommit: { oid: SHA } } } } }), 'GraphQL erreurs : [{"message":"head moved"}]'],
  [json({ errors: {}, data: {} }), 'GraphQL erreurs : {}'],
  [{ ok: false, raison: 'HTTP 403\nrefus du jeton' }, 'HTTP 403 refus du jeton'],
]) test(`#2392 mutation refusée ou malformée : refus d’enfileur NOMMÉ, raison GraphQL jointe ${reponse.stdout ?? reponse.raison}`, () => {
  const b = banc([identite(), REFUS, identite(), reponse])
  assert.deepEqual(b.jouer(), {
    ok: false,
    compte: COMPTE,
    raison: `${refusDEnfileur({ depot: 'MyEdO/game', numero: 42, compte: COMPTE, message: REFUS_DE_FILE.prefixe })} (repli GraphQL : ${raison})`,
  })
  assert.equal(b.appels.length, 4)
})

test('#2392 relecture GraphQL refusée pendant le repli : refus d’enfileur NOMMÉ, sur une ligne', () => {
  const b = banc([identite(), refus(REFUS_DE_FILE.concatene), { ok: false, raison: 'HTTP 502' }])
  const vu = b.jouer()
  assert.equal(vu.raison, `${refusDEnfileur({ depot: 'MyEdO/game', numero: 42, compte: COMPTE, message: REFUS_DE_FILE.concatene })} (repli GraphQL : HTTP 502)`)
  assert.equal(vu.raison.includes('\n'), false)
})

for (const reponse of [{ ok: true, stdout: '' }, json({ data: {} }), json({ errors: [{ message: 'forbidden' }], data: { repository: { pullRequest: PR } } }),
  { ok: false, raison: 'HTTP 403' }]) test(`#2437 lecture GraphQL refusée ${reponse.stdout ?? reponse.raison}`, () => {
  const b = banc([reponse])
  assert.equal(b.jouer().ok, false)
  assert.equal(b.appels.length, 1)
})
