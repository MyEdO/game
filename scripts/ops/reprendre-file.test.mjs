import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { DELAI_RELANCE_MS, reprendreFile } from './reprendre-file.mjs'
import { appelGhRunner } from '../guards/lib/ticketsGh.mjs'
import { mesurerEtat, stepsDu } from '../gates/workflowsDuDepot.mjs'
import { corpsDePr } from '../guards/lib/fusionPr.mjs'
import { PLAFOND_RELANCES } from '../guards/lib/coursesCi.mjs'
import { ENTREE_2495 } from './fixtures/github-2495-file.mjs'

const capture = (nom) => JSON.parse(readFileSync(new URL(`./fixtures/github-2495-${nom}.json`, import.meta.url), 'utf8'))
const GROUPE_2495 = capture('course')

const SHA = 'a'.repeat(40)
const depot = { full_name: 'MyEdO/game' }
const PR = { number: 42, state: 'open', draft: false, title: 'corrige #2330', body: `Train de publication (\`npm run ops:publier\`), tête ${SHA}.`,
  head: { sha: SHA, ref: 'chantier/2330', repo: depot }, base: { ref: 'main', repo: depot } }
const CI = { id: 9, name: 'CI', run_attempt: 2, status: 'completed', conclusion: 'success', updated_at: '2026-10-07T10:00:00Z',
  head_sha: SHA, head_branch: PR.head.ref, repository: depot, event: 'push' }
const COMPTE = 'github-actions[bot]'
const MOTIF = 'The job was not acquired by Runner of type hosted even after multiple attempts'
const ANNOTATIONS = [{ annotation_level: 'warning', message: 'sans rapport' }, { annotation_level: 'failure', message: MOTIF }]
/** Les jobs REST d'un essai annulé par le runner (forme de la course 37365832262, #1853). */
const JOBS_ANNULES = [{ id: 501, name: 'suite 1/3', status: 'completed', conclusion: 'cancelled' }, { id: 502, name: 'docs', status: 'completed', conclusion: 'success' }]
const VIEILLE = Date.parse(CI.updated_at) + DELAI_RELANCE_MS
const event = { workflow_run: CI }
function banc({ prs = [PR], courses = [CI], relectures = [], ci = CI,
  commentaires = [], commits = [], refusPage = null, totalCommits = commits.length, identites = [], compte = COMPTE,
  coursesGroupe = capture('absence'),
  jobs = JOBS_ANNULES, totalJobs = jobs.length, annotations = ANNOTATIONS, relance = { ok: true, stdout: '' } } = {}) {
  const appels = [], poses = new Map()
  let relu = 0, identite = 0
  const appel = (args, options = {}) => {
    appels.push({ args, options })
    const chemin = args.find((a) => a.startsWith('repos/'))
    const page = Number(/[?&]page=(\d+)/.exec(chemin)?.[1] ?? 1)
    const tranche = (liste) => liste.slice((page - 1) * 100, page * 100)
    const json = (value) => ({ ok: true, stdout: JSON.stringify(value) })
    if (args.includes('graphql')) {
      const payload = JSON.parse(options.input)
      assert.ok(!payload.query.startsWith('mutation'), 'le serveur ne mute jamais GraphQL')
      return json({ data: { repository: { pullRequest: identites[Math.min(identite++, identites.length - 1)]
        ?? { id: 'PR42', headRefOid: SHA, state: 'OPEN', merged: false, mergeCommit: null, isInMergeQueue: false } }, viewer: { login: compte } } })
    }
    if (chemin === refusPage) return { ok: false, raison: 'lecture refusée' }
    assert.ok(!args.includes('PUT') && !chemin?.includes('merge-async'), 'le serveur ne demande jamais l’enfilement')
    if (chemin.includes('/comments')) {
      const numero = /issues\/(\d+)/.exec(chemin)[1]
      if (args.includes('POST')) {
        poses.set(numero, [...(poses.get(numero) ?? []), options.input]); return json({})
      }
      return json(tranche([...commentaires, ...(poses.get(numero) ?? []).map((body) => ({ body }))]))
    }
    if (chemin.includes('/commits')) return json(tranche(commits))
    if (chemin.includes('event=merge_group')) return coursesGroupe.ok === false ? coursesGroupe
      : json({ ...coursesGroupe, workflow_runs: tranche(coursesGroupe.workflow_runs) })
    if (chemin.includes('/actions/workflows/')) return json({ total_count: courses.length, workflow_runs: tranche(courses) })
    if (/\/attempts\/\d+\/jobs\?per_page=100$/.test(chemin)) return json({ total_count: totalJobs, jobs })
    if (/\/check-runs\/\d+\/annotations$/.test(chemin)) return json(annotations)
    if (chemin.endsWith('/rerun-failed-jobs') && args.includes('POST')) return relance
    if (chemin.includes('/actions/runs/')) return json(ci)
    if (/\/pulls\/42$/.test(chemin)) return json({ ...(relectures[Math.min(relu++, relectures.length - 1)] ?? prs[0]), commits: totalCommits })
    if (chemin.includes('/pulls?')) return json(tranche(prs))
    throw new Error(`appel inattendu ${args.join(' ')}`)
  }
  return { appel, appels, poses, demandes: () => appels.filter((c) => c.args.includes('PUT')),
    relances: () => appels.filter((c) => c.args.includes('POST') && c.args.some((a) => a.endsWith('/rerun-failed-jobs'))),
    jouer: (options = {}) => reprendreFile({ appel, evenement: event, veille: { serveur: 'https://github.com', depot: 'MyEdO/game', id: '88' }, ...options }) }
}

for (const compte of [COMPTE, 'cgauche']) test(`#2499 serveur sous ${compte} nomme le geste local, deux crons donnent un commentaire`, async () => {
  const b = banc({ compte })
  const [r] = await b.jouer()
  assert.equal(corpsDePr(SHA), PR.body)
  assert.equal(r.statut, 'a-enfiler')
  assert.match(r.raison, /npm run ops:publier -- --detache/)
  await b.jouer()
  assert.equal(b.demandes().length, 0)
  assert.equal(b.poses.get('42').length, 1)
  assert.equal(b.poses.get('2330').length, 1)
  assert.ok(b.appels.every((c) => !c.args.includes('--paginate')))
})

const EN_FILE = { id: 'PR42', headRefOid: SHA, state: 'OPEN', merged: false, mergeCommit: null,
  isInMergeQueue: true, mergeQueueEntry: ENTREE_2495 }
const VIEILLE_FILE = Date.parse(ENTREE_2495.enqueuedAt) + DELAI_RELANCE_MS

test('#2499 captures bot : attente sans merge_group nommée sur SHA groupe, dédup stable après dix minutes supplémentaires', async () => {
  const b = banc({ identites: [EN_FILE] })
  const [r] = await b.jouer({ maintenant: () => VIEILLE_FILE })
  assert.equal(r.statut, 'anomalie')
  assert.match(r.raison, /github-actions/)
  assert.ok(r.raison.includes(ENTREE_2495.id))
  assert.ok(r.raison.includes(ENTREE_2495.enqueuedAt))
  const lecture = b.appels.find((c) => c.args.some((a) => a.includes('event=merge_group')))
  assert.ok(lecture.args.some((a) => a.includes(ENTREE_2495.headCommit.oid)))
  assert.ok(!lecture.args.some((a) => a.includes(SHA)))
  await b.jouer({ maintenant: () => VIEILLE_FILE + DELAI_RELANCE_MS })
  assert.equal(b.poses.get('42').length, 1)
  assert.equal(b.demandes().length, 0)
})

test('#2499 groupe réel cgauche exclut l’anomalie et ne reçoit pas de commentaire', async () => {
  const entree = { ...ENTREE_2495, enqueuedAt: '2026-10-07T18:08:17Z', enqueuer: { login: 'cgauche' },
    headCommit: { oid: GROUPE_2495.head_sha } }
  const b = banc({ identites: [{ ...EN_FILE, mergeQueueEntry: entree }],
    coursesGroupe: { total_count: 1, workflow_runs: [GROUPE_2495] } })
  assert.equal((await b.jouer({ maintenant: () => Date.parse(entree.enqueuedAt) + DELAI_RELANCE_MS }))[0].statut, 'enqueued')
  assert.equal(b.poses.size, 0)
})

for (const [nom, variation, attendu] of [
  ['groupe null en attente', { identites: [{ ...EN_FILE, mergeQueueEntry: { ...ENTREE_2495, headCommit: null } }] }, 'indeterminee'],
  ['groupe null en préparation', { identites: [{ ...EN_FILE, mergeQueueEntry: { ...ENTREE_2495, state: 'QUEUED', headCommit: null } }] }, 'enqueued'],
  ['entrée jeune', {}, 'enqueued'],
  ['REST refusé', { coursesGroupe: { ok: false, raison: 'HTTP 403' } }, 'indeterminee'],
  ['REST incomplet', { coursesGroupe: { total_count: 1, workflow_runs: [] } }, 'indeterminee'],
  ['entrée changée pendant REST', { identites: [EN_FILE, { ...EN_FILE, mergeQueueEntry: { ...ENTREE_2495, id: 'NOUVELLE' } }] }, 'indeterminee'],
]) test(`#2499 ${nom} : ${attendu}`, async () => {
  const b = banc({ identites: [EN_FILE], ...variation })
  assert.equal((await b.jouer({ maintenant: () => VIEILLE_FILE - (nom === 'entrée jeune' ? 1 : 0) }))[0].statut, attendu)
})

for (const [nom, changement] of [
  ['ancienne réentrée', { created_at: '2026-10-07T17:00:00Z' }],
  ['autre événement', { event: 'push' }],
  ['autre dépôt', { repository: { full_name: 'autre/game' } }],
  ['autre workflow', { name: 'Autre' }],
]) test(`#2499 course ${nom} ne masque pas l’absence`, async () => {
  const b = banc({ identites: [EN_FILE], coursesGroupe: { total_count: 1,
    workflow_runs: [{ ...GROUPE_2495, head_sha: ENTREE_2495.headCommit.oid, ...changement }] } })
  assert.equal((await b.jouer({ maintenant: () => VIEILLE_FILE }))[0].statut, 'anomalie')
})

test('#2499 workflow_run annulé garde le geste de relance', async () => {
  const b = banc({ courses: [{ ...CI, conclusion: 'cancelled', run_attempt: 1 }] })
  assert.equal((await b.jouer({ evenement: { workflow_run: { ...CI, conclusion: 'cancelled' } }, maintenant: () => VIEILLE }))[0].statut, 'relancee')
})

test('#2499 relances : dédup même essai, essai suivant nommé séparément', async () => {
  const course = { ...CI, conclusion: 'cancelled', run_attempt: 1 }
  const b = banc({ courses: [course] })
  await b.jouer({ evenement: {}, maintenant: () => VIEILLE })
  await b.jouer({ evenement: {}, maintenant: () => VIEILLE })
  assert.equal(b.poses.get('42').length, 1)
  course.run_attempt = 2
  await b.jouer({ evenement: {}, maintenant: () => VIEILLE })
  assert.equal(b.poses.get('42').length, 2)
})

test('#2499 courses groupe exhaustives sur deux pages, run réel en seconde page', async () => {
  const entree = { ...ENTREE_2495, headCommit: { oid: GROUPE_2495.head_sha } }
  const courses = [...Array.from({ length: 100 }, () => ({ ...GROUPE_2495, event: 'push' })), GROUPE_2495]
  const b = banc({ identites: [{ ...EN_FILE, mergeQueueEntry: entree }], coursesGroupe: { total_count: 101, workflow_runs: courses } })
  assert.equal((await b.jouer({ maintenant: () => VIEILLE_FILE + DELAI_RELANCE_MS }))[0].statut, 'enqueued')
  assert.ok(b.appels.some((c) => c.args.some((a) => a.includes('event=merge_group') && a.endsWith('page=2'))))
})

test('#2499 garde mécanique serveur : lecteur seul, aucun enfileur ni demande PUT', () => {
  const source = readFileSync(new URL('./reprendre-file.mjs', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /\bfusionDePr\b|enqueuePullRequest|merge-async|['"]PUT['"]/)
  assert.match(source, /etatFileDePr\(\{/)
})

test('rouge ignoré (un job rouge), même si ancien run vert', async () => {
  const b = banc({ courses: [CI, { ...CI, id: 10, conclusion: 'failure' }], jobs: [...JOBS_ANNULES, { id: 503, name: 'types', conclusion: 'failure' }] })
  assert.deepEqual(await b.jouer({ maintenant: () => VIEILLE }), [])
  assert.equal(b.demandes().length, 0)
  assert.equal(b.relances().length, 0)
  assert.deepEqual(await b.jouer({ evenement: { workflow_run: { ...CI, conclusion: 'failure' } } }), [])
})

const ANNULEE = { ...CI, id: 10, run_attempt: 1, conclusion: 'failure' }

for (const [nom, course, jobs, dit] of [
  ['jobs mixtes `success`/`cancelled`', ANNULEE, JOBS_ANNULES, `jobs annulés : suite 1/3 ; motif : ${MOTIF}`],
  ['tous les jobs `cancelled`', ANNULEE, JOBS_ANNULES.map((j) => ({ ...j, conclusion: 'cancelled' })), `jobs annulés : suite 1/3, docs ; motif : ${MOTIF}`],
  ['conclusion `cancelled`', { ...ANNULEE, conclusion: 'cancelled' }, JOBS_ANNULES, 'conclusion cancelled'],
]) test(`#2392 course de branche ANNULÉE (${nom}), vieille de ${DELAI_RELANCE_MS / 60_000} min : UNE relance des jobs en échec, signalée sans geste`, async () => {
  const b = banc({ courses: [CI, course], jobs })
  const [r] = await b.jouer({ evenement: {}, maintenant: () => VIEILLE })
  assert.deepEqual([r.statut, r.raison, r.run], ['relancee', `course annulée — ${dit} ; relance 2/${PLAFOND_RELANCES}`, 10])
  assert.deepEqual(b.relances().map((c) => c.args), [['api', '-X', 'POST', 'repos/MyEdO/game/actions/runs/10/rerun-failed-jobs']])
  assert.equal(b.demandes().length, 0)
  assert.match(b.poses.get('42')[0], /\*\*relancee\*\*/)
  assert.doesNotMatch(b.poses.get('42')[0], /Reprise :/)
})

test(`#2392 course de branche ANNULÉE depuis moins de ${DELAI_RELANCE_MS / 60_000} min : rien, ni relance ni signal`, async () => {
  const b = banc({ courses: [ANNULEE] })
  assert.deepEqual(await b.jouer({ evenement: {}, maintenant: () => VIEILLE - 1 }), [])
  assert.equal(b.relances().length, 0)
  assert.equal(b.poses.size, 0)
})

test(`#2392 course de branche ANNULÉE à son ${PLAFOND_RELANCES}ᵉ essai : plafond signalé avec le geste humain, aucune relance`, async () => {
  const b = banc({ courses: [{ ...ANNULEE, run_attempt: PLAFOND_RELANCES }] })
  const [r] = await b.jouer({ evenement: {}, maintenant: () => VIEILLE })
  assert.deepEqual([r.statut, r.raison], ['plafond', `course annulée — jobs annulés : suite 1/3 ; motif : ${MOTIF} ; essai ${PLAFOND_RELANCES}/${PLAFOND_RELANCES}, plafond de relances atteint : \`gh run rerun 10 --failed\``])
  assert.equal(b.relances().length, 0)
  assert.ok(b.poses.get('42')[0].endsWith('Reprise : `gh run rerun 10 --failed`.'))
})

test('#2392 jobs d’essai NON exhaustifs : la course reste rouge, ignorée, jamais relancée', async () => {
  const b = banc({ courses: [ANNULEE], totalJobs: JOBS_ANNULES.length + 1 })
  assert.deepEqual(await b.jouer({ evenement: {}, maintenant: () => VIEILLE }), [])
  assert.equal(b.relances().length, 0)
})

for (const [nom, pr] of [
  ['draft', { ...PR, draft: true }],
  ['PR manuelle de chantier', { ...PR, body: 'PR créée à la main' }],
  ['base autre', { ...PR, base: { ...PR.base, ref: 'other' } }],
  ['fork', { ...PR, head: { ...PR.head, repo: { full_name: 'autre/game' } } }],
  ['hors chantier', { ...PR, head: { ...PR.head, ref: 'feat/2330' } }],
  ['tête divergente', { ...PR, head: { ...PR.head, sha: 'b'.repeat(40) } }],
]) test(`${nom} ignorée`, async () => {
  const b = banc({ prs: [pr] })
  assert.deepEqual(await b.jouer(), [])
  assert.equal(b.demandes().length, 0)
  assert.equal(b.poses.size, 0)
})

test('réconciliation PR ouverte après CI et lecture seule sans mutation', async () => {
  const b = banc()
  assert.equal((await b.jouer({ evenement: {} }))[0].statut, 'a-enfiler')
  const c = banc()
  assert.equal((await c.jouer({ evenement: {}, lectureSeule: true }))[0].statut, 'a-enfiler')
  assert.equal(c.demandes().length, 0)
  assert.equal(c.poses.size, 0)
})

test('tickets des commits cités et pagination commentaires exhaustive', async () => {
  const b = banc({ commentaires: Array.from({ length: 100 }, () => ({ body: 'autre' })),
    commits: [{ commit: { message: 'refs #2329' } }] })
  await b.jouer()
  assert.ok(b.poses.has('2329'))
  assert.ok(b.appels.some((c) => c.args.some((a) => a.includes('/comments?per_page=100&page=2'))))
})

for (const [nom, options, motif] of [
  ['total 251', { totalCommits: 251 }, /plafond REST de 250/],
  ['total inconnu', { totalCommits: null }, /total de commits inconnu/],
  ['total incohérent', { totalCommits: 2 }, /liste de commits incohérente/],
  ['panne de collecte', { refusPage: 'repos/MyEdO/game/pulls/42/commits?per_page=100&page=1' }, /lecture refusée/],
]) test(`${nom} : refus visible PR et ticket connu, aucun ticket inféré des commits`, async () => {
  const b = banc({ commits: [{ commit: { message: 'corrige #999' } }], ...options })
  const [r] = await b.jouer()
  assert.equal(r.collecte, 'refusee')
  assert.deepEqual([...b.poses.keys()], ['42', '2330'])
  assert.match(b.poses.get('42')[0], motif)
  assert.match(b.poses.get('42')[0], /npm run ops:publier -- --detache/)
  assert.match(r.raison, /collecte des tickets des commits refusée/)
})

test('lecture commentaires refusée ne double pas un signal inconnu', async () => {
  const b = banc({ refusPage: 'repos/MyEdO/game/issues/42/comments?per_page=100&page=1' })
  await assert.rejects(b.jouer(), /lecture refusée/)
  assert.equal(b.poses.size, 0)
})

test('pagination PR et CI exhaustive : candidate et run vert en deuxième page', async () => {
  const b = banc({ prs: [...Array.from({ length: 100 }, () => ({ ...PR, draft: true })), PR],
    courses: [...Array.from({ length: 100 }, (_, i) => ({ ...CI, id: i, conclusion: 'failure' })), { ...CI, id: 999 }] })
  assert.equal((await b.jouer())[0].run, 999)
  assert.ok(b.appels.some((c) => c.args.some((a) => a.includes('pulls?') && a.endsWith('page=2'))))
  assert.ok(b.appels.some((c) => c.args.some((a) => a.includes('/runs?') && a.endsWith('page=2'))))
})

test('plafond API CI refusé, jamais interprété comme liste exhaustive', async () => {
  const b = banc({ courses: Array.from({ length: 1001 }, () => CI) })
  await assert.rejects(b.jouer(), /courses CI non exhaustives/)
  assert.equal(b.demandes().length, 0)
})

test('dédup retrouve sa marque après 100 commentaires', async () => {
  const b = banc({ commentaires: Array.from({ length: 100 }, () => ({ body: 'autre' })) })
  await b.jouer(); await b.jouer()
  assert.equal(b.poses.get('42').length, 1)
  assert.equal(b.poses.get('2330').length, 1)
})

test('tête neuve avant demande jamais fusionnée', async () => {
  const neuve = { ...PR, head: { ...PR.head, sha: 'b'.repeat(40) } }
  const b = banc({ relectures: [PR, neuve] })
  assert.equal((await b.jouer())[0].statut, 'ignoree')
  assert.equal(b.demandes().length, 0)
})

test('course retardée ou rerun non vert relu ne demande aucune fusion', async () => {
  const b = banc({ ci: { ...CI, status: 'in_progress', conclusion: null } })
  assert.equal((await b.jouer())[0].statut, 'ignoree')
  assert.equal(b.demandes().length, 0)
})

test('CLI réel rouge sans API : résumé externe, écriture fermée à l’import', () => {
  const dossier = mkdtempSync(join(tmpdir(), 'reprise-file-cli-'))
  try {
    const evenement = join(dossier, 'event.json')
    const resume = join(dossier, 'summary.md')
    writeFileSync(evenement, JSON.stringify({ workflow_run: { ...CI, name: 'Autre' } }))
    const env = { ...process.env, GH_CONFIG_DIR: dossier, GH_TOKEN: '', GITHUB_TOKEN: '',
      GITHUB_EVENT_PATH: evenement, GITHUB_STEP_SUMMARY: resume,
      GITHUB_SERVER_URL: 'https://github.com', GITHUB_REPOSITORY: 'MyEdO/game', GITHUB_RUN_ID: '88' }
    const script = fileURLToPath(new URL('./reprendre-file.mjs', import.meta.url))
    const importer = spawnSync(process.execPath, ['--input-type=module', '--eval', `await import(${JSON.stringify(new URL('./reprendre-file.mjs', import.meta.url).href)})`],
      { env, encoding: 'utf8', timeout: 10_000 })
    assert.equal(importer.status, 0, importer.stderr)
    assert.throws(() => readFileSync(resume, 'utf8'), { code: 'ENOENT' })
    const cli = spawnSync(process.execPath, [script], { env, encoding: 'utf8', timeout: 10_000 })
    assert.equal(cli.status, 0, cli.stderr)
    assert.equal(cli.stderr, '')
    assert.match(cli.stdout, /Aucune PR de chantier à reprendre\./)
    assert.match(readFileSync(resume, 'utf8'), /Aucune PR de chantier à reprendre\./)
  } finally { rmSync(dossier, { recursive: true, force: true }) }
})

test('signature historique du train persiste après nouvelle tête de publication', async () => {
  const b = banc({ prs: [{ ...PR, body: `Train de publication (\`npm run ops:publier\`), tête ${'d'.repeat(40)}.` }] })
  assert.equal((await b.jouer())[0].statut, 'a-enfiler')
})

test('identité étrangère de veille refusée avant toute mutation', async () => {
  const b = banc()
  await assert.rejects(b.jouer({ veille: { serveur: 'https://autre.example', depot: 'MyEdO/game', id: '88' } }), /identité/)
  assert.equal(b.appels.length, 0)
})

test('appelGhRunner conserve corps HTTP sur erreur sans masquer ok:false', () => {
  const appel = appelGhRunner({ cwd: '.', executer: () => {
    throw Object.assign(new Error('gh refus'), { stderr: 'HTTP 409', stdout: 'HTTP/2.0 409\r\n\r\n{"status":"pending","details":{}}' })
  } })
  const vu = appel(['api', '--include'])
  assert.equal(vu.ok, false)
  assert.match(vu.stdout, /pending/)
})

function verifierCheckoutMain(yaml) {
  const checkouts = stepsDu(yaml).filter((s) => /^\s*- uses: actions\/checkout@/m.test(s.bloc))
  assert.equal(checkouts.length, 1)
  assert.match(checkouts[0].bloc, /^\s*ref: main\s*$/m)
}

test('garde positive reprise serveur : main seul, bornes, signal, pas de code PR', () => {
  const yaml = readFileSync(new URL('../../.github/workflows/reprise-file.yml', import.meta.url), 'utf8')
  assert.deepEqual(mesurerEtat('reprise-file.yml', yaml).autosignale, true)
  assert.match(yaml, /workflow_run:\n {4}workflows: \[CI\]\n {4}types: \[completed\]/)
  assert.match(yaml, /cron: '\*\/10 \* \* \* \*'/)
  verifierCheckoutMain(yaml)
  assert.match(yaml, /contents: read/)
  assert.match(yaml, /actions: write/)
  assert.match(yaml, /cancel-in-progress: false/)
  assert.match(yaml, /run: node scripts\/ops\/reprendre-file.mjs/)
  assert.doesNotMatch(yaml, /head_sha|head_branch|pull_request_target|download-artifact|github\.event.*\}\}.*run:/)
})

test('un second checkout même vers main fait refuser la garde', () => {
  const yaml = readFileSync(new URL('../../.github/workflows/reprise-file.yml', import.meta.url), 'utf8')
  const mute = yaml.replace('    steps:', '    steps:\n      - uses: actions/checkout@v4\n        with:\n          ref: main')
  assert.throws(() => verifierCheckoutMain(mute))
})
