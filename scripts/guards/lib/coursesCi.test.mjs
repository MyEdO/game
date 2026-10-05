// La lecture des courses CI d'un commit ou d'un événement : une union, un tri.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CHAMPS, coursesCi, jobsRougesDe, triees } from './coursesCi.mjs'

const SHA = 'a'.repeat(40)

test('la commande porte le commit, le workflow, la limite et TOUS les champs des consommateurs', () => {
  let vus = null
  coursesCi({
    commit: SHA,
    limit: 300,
    spawn: (cmd, args) => { vus = { cmd, args }; return { status: 0, stdout: '[]', stderr: '' } },
  })
  assert.equal(vus.cmd, 'gh')
  assert.deepEqual(vus.args, ['run', 'list', '--commit', SHA, '--workflow', 'ci.yml', '--limit', '300', '--json', CHAMPS])
  for (const champ of ['conclusion', 'createdAt', 'databaseId', 'headSha', 'status', 'workflowName'])
    assert.ok(CHAMPS.includes(champ), `${champ} manque : un consommateur lirait \`undefined\``)
})

test('ni `commit` ni `evenement` : la question n’est pas posée, aucun `gh` n’est lancé', () => {
  assert.throws(() => coursesCi({ spawn: () => assert.fail('aucun processus') }), (e) => e instanceof TypeError && /un `commit` ou un `evenement`/.test(e.message))
})

test('la sortie est TRIÉE par createdAt décroissant — `courses[0]` est la plus récente', () => {
  const lu = coursesCi({
    commit: SHA,
    spawn: () => ({
      status: 0,
      stderr: '',
      stdout: JSON.stringify([
        { headSha: 'vieille', createdAt: '2026-08-30T09:00:00Z' },
        { headSha: 'recente', createdAt: '2026-09-05T11:00:00Z' },
      ]),
    }),
  })
  assert.deepEqual(lu.valeur.map((c) => c.headSha), ['recente', 'vieille'])
  assert.deepEqual(triees([{ a: 1 }, { a: 2 }]).map((c) => c.a), [1, 2], 'sans date, l’ordre servi est conservé')
})

test('gh muet, en échec ou illisible : INDISPONIBLE nommé, jamais une liste vide', () => {
  const muet = coursesCi({ commit: SHA, spawn: () => ({ error: new Error('spawnSync gh ENOENT'), status: null }) })
  assert.equal(muet.disponible, false)
  assert.match(muet.raison, /ENOENT/)

  const echec = coursesCi({ commit: SHA, spawn: () => ({ status: 4, stdout: '', stderr: 'gh: jeton expiré' }) })
  assert.equal(echec.disponible, false)
  assert.match(echec.raison, /jeton expiré/)

  const illisible = coursesCi({ commit: SHA, spawn: () => ({ status: 0, stdout: '{ tronqué', stderr: '' }) })
  assert.equal(illisible.disponible, false)
})

// ── `--commit` : la question que pose la porte au push (#1776) ─────────────────────────────────

test('`commit` interroge le SHA, jamais une branche — c’est ce sha-là qui entre dans main', () => {
  let vus = null
  coursesCi({
    commit: SHA,
    spawn: (cmd, args) => { vus = args; return { status: 0, stdout: '[]', stderr: '' } },
  })
  assert.deepEqual(vus, ['run', 'list', '--commit', SHA, '--workflow', 'ci.yml', '--limit', '30', '--json', CHAMPS])
  assert.ok(!vus.includes('--branch'), 'un run de branche `chantier/**` juge le MÊME sha : la branche ne discrimine rien')
})

test('`evenement` filtre les courses par événement (`--event`) — les commits de file (`merge_group`) portent `headBranch`', () => {
  let vus = null
  coursesCi({ evenement: 'merge_group', spawn: (cmd, args) => { vus = args; return { status: 0, stdout: '[]', stderr: '' } } })
  assert.deepEqual(vus, ['run', 'list', '--event', 'merge_group', '--workflow', 'ci.yml', '--limit', '30', '--json', CHAMPS])
  assert.ok(CHAMPS.split(',').includes('headBranch'), 'la ref d’entrée de file nomme la PR : sans `headBranch`, la course de file ne se rattache à rien')
})

test('`jobsRougesDe` rend les noms des jobs ROUGES d’une course, en union — jamais un rouge avalé', () => {
  let vus = null
  const jobs = [{ name: 'docs', conclusion: 'failure' }, { name: 'types', conclusion: 'success' }, { name: 'suite', conclusion: 'timed_out' }, { name: 'migrations', conclusion: 'cancelled' }]
  const lu = jobsRougesDe({ id: 99, spawn: (cmd, args) => { vus = [cmd, ...args]; return { status: 0, stdout: JSON.stringify({ jobs }), stderr: '' } } })
  assert.deepEqual(vus, ['gh', 'run', 'view', '99', '--json', 'jobs'])
  assert.deepEqual(lu, { disponible: true, valeur: ['docs', 'suite'] })
  assert.equal(jobsRougesDe({ id: 1, spawn: () => ({ status: 4, stdout: '', stderr: 'x' }) }).disponible, false)
  assert.equal(jobsRougesDe({ id: 1, spawn: () => ({ status: 0, stdout: '{}', stderr: '' }) }).disponible, false)
})
