import test from 'node:test'
import assert from 'node:assert/strict'
import { fusionDePr, etatFileDePr } from './fusionPr.mjs'
import { ENTREE_2495, JEUNE_2495 } from '../../ops/fixtures/github-2495-file.mjs'

const SHA = 'a'.repeat(40), AUTRE = 'b'.repeat(40)
const PR = { id: 'PR42', headRefOid: SHA, state: 'OPEN', merged: false, mergeCommit: null, autoMergeRequest: null, isInMergeQueue: false }
const json = (value) => ({ ok: true, stdout: JSON.stringify(value) })
const identite = (pr = PR, viewer = { login: 'cgauche' }) => json({ data: { repository: { pullRequest: pr }, viewer } })
const ARMEE = { ...PR, autoMergeRequest: { enabledAt: '2026-10-16T10:00:00Z' } }
const FILE = { ...PR, isInMergeQueue: true, mergeQueueEntry: ENTREE_2495 }
const entree = () => json({ data: { enqueuePullRequest: { mergeQueueEntry: { id: 'ENTRY', headCommit: { oid: AUTRE } } } } })
const REFUS = { ok: false, raison: 'gh a rendu 1 : GraphQL: Auto merge is not allowed for this repository' }
const estMutation = (c) => c.args.includes('graphql') && JSON.parse(c.opts.input).query.startsWith('mutation')
function banc(reponses, options = {}) {
  const appels = [], lignes = []
  const appel = (args, opts = {}) => {
    appels.push({ args, opts })
    assert.ok(reponses.length, `appel supplémentaire ${args.join(' ')}`)
    return reponses.shift()
  }
  const p = { depot: 'MyEdO/game', numero: 42, sha: SHA, appel, maintenant: () => JEUNE_2495, journaliser: (s) => lignes.push(s), ...options }
  return { appels, lignes, jouer: () => fusionDePr(p), lire: () => etatFileDePr(p) }
}

test('#2626 arme avant CI, sans stratégie, sur la tête publiée et confirme le serveur', () => {
  const b = banc([identite(), { ok: true, stdout: '' }, identite(ARMEE)])
  assert.equal(b.jouer().statut, 'armed')
  assert.deepEqual(b.appels[1].args, ['pr', 'merge', '42', '--auto', '--repo', 'MyEdO/game', '--match-head-commit', SHA])
  assert.equal(b.appels.some(estMutation), false)
})
for (const [pr, statut] of [[ARMEE, 'armed'], [FILE, 'enqueued'], [{ ...PR, state: 'MERGED', merged: true, mergeCommit: { oid: AUTRE } }, 'merged']])
  test(`#2626 ${statut} confirmé sans réécriture`, () => {
    const b = banc([identite(pr)])
    assert.equal(b.jouer().statut, statut)
    assert.equal(b.appels.length, 1)
  })
test('#2626 refus auto journalisé puis repli enqueue lié au SHA attendu', () => {
  const b = banc([identite(), REFUS, identite(), entree(), identite(FILE)])
  assert.equal(b.jouer().statut, 'enqueued')
  assert.match(b.lignes.join(''), /auto-merge REFUSÉ.*Auto merge is not allowed.*repli enqueuePullRequest/)
  assert.deepEqual(JSON.parse(b.appels[3].opts.input).variables, { input: { pullRequestId: 'PR42', expectedHeadOid: SHA } })
  assert.equal(b.appels.filter(estMutation).length, 1)
})
for (const pr of [ARMEE, FILE]) test('#2626 après refus devenue armée/en file : aucune double mutation', () => {
  const b = banc([identite(), REFUS, identite(pr)])
  assert.ok(b.jouer().ok)
  assert.equal(b.appels.some(estMutation), false)
})
for (const apres of [false, true]) test('#2626 tête divergente : aucune mutation', () => {
  const b = banc([...(apres ? [identite(), REFUS] : []), identite({ ...PR, headRefOid: AUTRE })])
  assert.match(b.jouer().raison, /tête de PR changée/)
  assert.equal(b.appels.some(estMutation), false)
})
for (const raison of ['spawn gh ENOENT', 'spawnSync gh ETIMEDOUT', 'processus interrompu SIGTERM']) test('#2626 panne locale sans refus GitHub : aucun repli', () => {
  const b = banc([identite(), { ok: false, raison }])
  assert.equal(b.jouer().raison, raison)
  assert.equal(b.appels.length, 2)
  assert.equal(b.appels.some(estMutation), false)
})
test('#2626 accepté mais non confirmé ne tente pas de repli', () => {
  const b = banc([identite(), { ok: true, stdout: '' }, identite()])
  assert.match(b.jouer().raison, /armement non confirmé/)
  assert.equal(b.appels.some(estMutation), false)
})
for (const reponse of [json({ data: { enqueuePullRequest: { mergeQueueEntry: null } } }), json({ errors: [{ message: 'head moved' }], data: {} }), { ok: false, raison: 'HTTP 403' }, { ok: true, stdout: '' }])
  test('#2626 repli refusé/malformé conserve le compte et les raisons', () => {
    const b = banc([identite(), REFUS, identite(), reponse]), vu = b.jouer()
    assert.equal(vu.ok, false)
    assert.equal(vu.compte, 'cgauche')
    assert.match(vu.raison, /Auto merge is not allowed.*repli GraphQL/)
  })
for (const pr of [PR, { ...FILE, headRefOid: AUTRE }]) test('#2499 mutation seule ne confirme pas la file', () => {
  assert.equal(banc([identite(), REFUS, identite(), entree(), identite(pr)]).jouer().ok, false)
})
for (const pr of [null, {}, { ...PR, id: '' }, { ...PR, headRefOid: null }, { ...PR, merged: null }, { ...PR, state: 'CLOSED' }, { ...PR, state: 'MERGED', merged: true, mergeCommit: null }, { ...PR, isInMergeQueue: null }, { ...PR, state: 'MERGED', merged: false }, { ...ARMEE, autoMergeRequest: {} }])
  test('#2437 identité malformée/fermée sans geste', () => {
    const b = banc([identite(pr)])
    assert.equal(b.jouer().ok, false)
    assert.equal(b.appels.length, 1)
  })
for (const viewer of [null, {}, { login: '' }, { login: 42 }]) test('#2392 compte illisible sans geste', () => {
  const b = banc([identite(PR, viewer)])
  assert.equal(b.jouer().ok, false)
  assert.equal(b.appels.length, 1)
})
for (const reponse of [{ ok: true, stdout: '' }, json({ data: {} }), json({ errors: [{ message: 'forbidden' }], data: {} }), { ok: false, raison: 'HTTP 403' }])
  test('#2437 lecture GraphQL refusée sans geste', () => {
    const b = banc([reponse])
    assert.equal(b.jouer().ok, false)
    assert.equal(b.appels.length, 1)
  })
for (const debut of [[], [identite(), REFUS], [identite(), REFUS, identite(), entree()]]) test('#2499 entrée sans merge_group : anomalie nommée', () => {
  const b = banc([...debut, identite(FILE), json({ total_count: 0, workflow_runs: [] }), identite(FILE)], { maintenant: () => JEUNE_2495 + 10 * 60_000 })
  const vu = b.jouer()
  assert.equal(vu.ok, false)
  assert.equal(vu.entree.id, ENTREE_2495.id)
  assert.match(vu.raison, /aucun run CI merge_group/)
})
test('#2626 observation non armée reste en lecture seule', () => {
  const b = banc([identite()])
  assert.equal(b.lire().statut, undefined)
  assert.equal(b.appels.length, 1)
})
