// La lecture des courses CI de `main` : une union, un tri, un stub qui sert UNE LISTE PAR APPEL.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { CHAMPS, coursesCi, jobsRougesDe, reinitialiserStub, triees } from './coursesCi.mjs'

const dossier = () => mkdtempSync(join(tmpdir(), 'courses-ci-'))
const jeter = (d) => rmSync(d, { recursive: true, force: true })

function stub(d, contenu) {
  reinitialiserStub()
  const fichier = join(d, 'gh.json')
  writeFileSync(fichier, JSON.stringify(contenu))
  return fichier
}

test('la commande porte la branche, le workflow, la limite et TOUS les champs des consommateurs', () => {
  let vus = null
  coursesCi({
    env: {},
    limit: 300,
    spawn: (cmd, args) => { vus = { cmd, args }; return { status: 0, stdout: '[]', stderr: '' } },
  })
  assert.equal(vus.cmd, 'gh')
  assert.deepEqual(vus.args, ['run', 'list', '--branch', 'main', '--workflow', 'ci.yml', '--limit', '300', '--json', CHAMPS])
  for (const champ of ['conclusion', 'createdAt', 'databaseId', 'headSha', 'status', 'workflowName'])
    assert.ok(CHAMPS.includes(champ), `${champ} manque : un consommateur lirait \`undefined\``)
})

test('`workflow: null` lit TOUS les workflows (les faits de palier en dépendent)', () => {
  let vus = null
  coursesCi({ env: {}, workflow: null, spawn: (cmd, args) => { vus = args; return { status: 0, stdout: '[]', stderr: '' } } })
  assert.ok(!vus.includes('--workflow'))
})

test('la sortie est TRIÉE par createdAt décroissant — `courses[0]` est la plus récente', () => {
  const lu = coursesCi({
    env: {},
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
  const muet = coursesCi({ env: {}, spawn: () => ({ error: new Error('spawnSync gh ENOENT'), status: null }) })
  assert.equal(muet.disponible, false)
  assert.match(muet.raison, /ENOENT/)

  const echec = coursesCi({ env: {}, spawn: () => ({ status: 4, stdout: '', stderr: 'gh: jeton expiré' }) })
  assert.equal(echec.disponible, false)
  assert.match(echec.raison, /jeton expiré/)

  const illisible = coursesCi({ env: {}, spawn: () => ({ status: 0, stdout: '{ tronqué', stderr: '' }) })
  assert.equal(illisible.disponible, false)
})

test('stub : un TABLEAU sert la même liste à chaque appel', () => {
  const d = dossier()
  try {
    const env = { WFRP_GH_STUB: stub(d, [{ headSha: 'a', createdAt: '2026-09-05T10:00:00Z' }]) }
    assert.deepEqual(coursesCi({ env }).valeur.map((c) => c.headSha), ['a'])
    assert.deepEqual(coursesCi({ env }).valeur.map((c) => c.headSha), ['a'])
  } finally { jeter(d) }
})

test('stub : `appels` sert UNE LISTE PAR APPEL, la dernière se répète (liste périmée puis relue)', () => {
  const d = dossier()
  try {
    const env = { WFRP_GH_STUB: stub(d, { appels: [[{ headSha: 'perimee' }], [{ headSha: 'fraiche' }]] }) }
    assert.deepEqual(coursesCi({ env }).valeur.map((c) => c.headSha), ['perimee'])
    assert.deepEqual(coursesCi({ env }).valeur.map((c) => c.headSha), ['fraiche'])
    assert.deepEqual(coursesCi({ env }).valeur.map((c) => c.headSha), ['fraiche'])
  } finally { jeter(d) }
})

test('stub illisible : INDISPONIBLE (le cas hors-ligne des fixtures)', () => {
  const d = dossier()
  try {
    const lu = coursesCi({ env: { WFRP_GH_STUB: join(d, 'jamais-ecrit.json') } })
    assert.equal(lu.disponible, false)
  } finally { jeter(d) }
})

// ── `--commit` : la question que pose la porte au push (#1776) ─────────────────────────────────

test('`commit` interroge le SHA, jamais une branche — c’est ce sha-là qui entre dans main', () => {
  let vus = null
  coursesCi({
    env: {},
    commit: 'a'.repeat(40),
    spawn: (cmd, args) => { vus = args; return { status: 0, stdout: '[]', stderr: '' } },
  })
  assert.deepEqual(vus, ['run', 'list', '--commit', 'a'.repeat(40), '--workflow', 'ci.yml', '--limit', '30', '--json', CHAMPS])
  assert.ok(!vus.includes('--branch'), 'un run de branche `chantier/**` juge le MÊME sha : la branche ne discrimine rien')
})

test('`branche: null` sans `commit` n’impose aucun filtre de ref', () => {
  let vus = null
  coursesCi({ env: {}, branche: null, spawn: (cmd, args) => { vus = args; return { status: 0, stdout: '[]', stderr: '' } } })
  assert.ok(!vus.includes('--branch'))
  assert.ok(!vus.includes('--commit'))
})

test('`evenement` filtre les courses par événement (`--event`) — les commits de file (`merge_group`) portent `headBranch`', () => {
  let vus = null
  coursesCi({ env: {}, branche: null, evenement: 'merge_group', spawn: (cmd, args) => { vus = args; return { status: 0, stdout: '[]', stderr: '' } } })
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
