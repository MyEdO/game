// La lecture des courses CI d'un commit ou d'un événement : une union, un tri.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { strToU8, zipSync } from 'fflate'
import {
  BORNE_LIGNES_DE_CONTEXTE, BORNE_LIGNES_D_ECHEC, coursesCi, echecsDuLog, journalDe, jobsEnEchecDe, jobsJuges, lignesDuJournal, motifDAnnulation,
  phraseDesJobs, triees, verdictDesJobs, verdictDesRuns, verdictJuge,
} from './coursesCi.mjs'

const SHA = 'a'.repeat(40)

const COURSE_REST = {
  id: 37371342026, run_attempt: 2, conclusion: 'success', created_at: '2026-10-05T20:41:52Z',
  head_branch: 'chantier/2280', head_sha: SHA, status: 'completed', name: 'CI',
}

const pageRest = (courses, total = courses.length) => ({
  status: 0, stdout: JSON.stringify({ total_count: total, workflow_runs: courses }), stderr: '',
})

test('la route REST porte le workflow et les filtres cumulés, et projette l’identité de l’essai', () => {
  const branche = 'gh-readonly-queue/main/pr-7-x'
  const lu = coursesCi({ commit: SHA, evenement: 'merge_group', spawn(cmd, args) {
    assert.deepEqual([cmd, ...args], ['gh', 'api',
      `repos/MyEdO/game/actions/workflows/ci.yml/runs?head_sha=${SHA}&event=merge_group&exclude_pull_requests=true&per_page=30&page=1`])
    return pageRest([{ ...COURSE_REST, conclusion: null, status: 'in_progress', head_branch: branche }])
  } })
  assert.deepEqual(lu, { disponible: true, valeur: [{
    databaseId: 37371342026, attempt: 2, conclusion: '', createdAt: '2026-10-05T20:41:52Z',
    headBranch: branche, headSha: SHA, status: 'in_progress', workflowName: 'CI',
  }] })
})

test('un workflow explicite : fenêtre de cinq courses pour un commit, sans filtre de branche', () => {
  const valeurs = Array.from({ length: 5 }, (_, i) => ({ ...COURSE_REST, id: i + 1, name: 'Fermetures' }))
  const lu = coursesCi({ commit: SHA, workflow: 'fermetures.yml', limit: 5, spawn(cmd, args) {
    assert.deepEqual([cmd, ...args], ['gh', 'api',
      `repos/MyEdO/game/actions/workflows/fermetures.yml/runs?head_sha=${SHA}&exclude_pull_requests=true&per_page=5&page=1`])
    return pageRest(valeurs, 1207)
  } })
  assert.deepEqual(lu.valeur.map((course) => [course.databaseId, course.workflowName]),
    valeurs.map((course) => [course.id, 'Fermetures']))
})

test('un identifiant numérique de workflow mène directement à la liste des courses', () => {
  const appels = []
  const lu = coursesCi({ commit: SHA, workflow: '289424207', spawn(cmd, args) {
    appels.push([cmd, ...args])
    return pageRest([])
  } })
  assert.deepEqual(appels, [['gh', 'api',
    `repos/MyEdO/game/actions/workflows/289424207/runs?head_sha=${SHA}&exclude_pull_requests=true&per_page=30&page=1`]])
  assert.deepEqual(lu, { disponible: true, valeur: [] })
})

const CI_ACTIVE = { id: 289424207, name: 'CI', state: 'active' }
const pageDeWorkflows = (workflows) => ({ status: 0, stdout: JSON.stringify({ workflows }), stderr: '' })

test('le workflow actif est résolu par nom sans distinction de casse sur deux pages REST', () => {
  const premiere = Array.from({ length: 100 }, (_, i) => ({ id: i + 1, name: `workflow ${i}`, state: 'active' }))
  premiere[0] = { id: 1, name: 'CI', state: 'disabled_manually' }
  const chemins = []
  const lu = coursesCi({ commit: SHA, evenement: 'push', workflow: 'cI', spawn(cmd, args) {
    assert.deepEqual([cmd, args[0]], ['gh', 'api'])
    chemins.push(args[1])
    if (chemins.length === 1) return pageDeWorkflows(premiere)
    if (chemins.length === 2) return pageDeWorkflows([CI_ACTIVE])
    return pageRest([COURSE_REST])
  } })
  assert.deepEqual(chemins, [
    'repos/MyEdO/game/actions/workflows?per_page=100&page=1',
    'repos/MyEdO/game/actions/workflows?per_page=100&page=2',
    `repos/MyEdO/game/actions/workflows/289424207/runs?head_sha=${SHA}&event=push&exclude_pull_requests=true&per_page=30&page=1`,
  ])
  assert.deepEqual(lu.valeur.map((c) => [c.databaseId, c.attempt]), [[COURSE_REST.id, 2]])
})

for (const [nom, reponse, motif] of [
  ['introuvable', pageDeWorkflows([{ ...CI_ACTIVE, state: 'disabled_manually' }]), /workflow actif « CI » introuvable/],
  ['ambigu', pageDeWorkflows([CI_ACTIVE, { ...CI_ACTIVE, id: 2, name: 'ci' }]), /nom de workflow « CI » ambigu/],
  ['refusé', { status: 1, stdout: '', stderr: 'gh: Forbidden (HTTP 403)' }, /workflows illisibles.*403/],
  ['illisible', { status: 0, stdout: '{"workflows":[null]}', stderr: '' }, /workflows hors schéma/],
]) test(`un workflow nommé ${nom} rend la liste indisponible`, () => {
  const lu = coursesCi({ commit: SHA, workflow: 'CI', spawn(cmd, args) {
    assert.deepEqual([cmd, ...args], ['gh', 'api', 'repos/MyEdO/game/actions/workflows?per_page=100&page=1'])
    return reponse
  } })
  assert.equal(lu.disponible, false)
  assert.match(lu.raison, motif)
})

test('30 courses merge_group : une seule page, même quand GitHub annonce plus de 1000 courses', () => {
  const lu = coursesCi({ evenement: 'merge_group', spawn(cmd, args) {
    assert.deepEqual([cmd, ...args], ['gh', 'api',
      'repos/MyEdO/game/actions/workflows/ci.yml/runs?event=merge_group&exclude_pull_requests=true&per_page=30&page=1'])
    return pageRest(Array.from({ length: 30 }, (_, i) => ({ ...COURSE_REST, id: i + 1 })), 1834)
  } })
  assert.equal(lu.valeur.length, 30)
})

test('fenêtre REST paginée : coupe dans l’ordre servi, puis tri décroissant stable', () => {
  const vaut = (id, jour) => ({ ...COURSE_REST, id, created_at: `2026-10-${jour}T20:00:00Z` })
  const premiere = Array.from({ length: 100 }, (_, i) => vaut(i + 1, '05'))
  const derniere = [vaut(101, '06'), vaut(102, '06'), vaut(103, '07')]
  const appels = []
  const lu = coursesCi({ evenement: 'merge_group', limit: 102, spawn(cmd, args) {
    appels.push(args.at(-1))
    return pageRest(appels.length === 1 ? premiere : derniere, 103)
  } })
  assert.deepEqual(appels.map((a) => new URLSearchParams(a.split('?')[1]).get('page')), ['1', '2'])
  assert.ok(appels.every((a) => a.includes('per_page=100')))
  assert.deepEqual(lu.valeur.map((c) => c.databaseId), [101, 102, ...premiere.map((c) => c.id)])
  assert.deepEqual(triees([{ a: 1 }, { a: 2 }]).map((c) => c.a), [1, 2], 'sans date, l’ordre servi est conservé')
})

test('ni commit ni événement : la question n’est pas posée', () => {
  assert.throws(() => coursesCi({ spawn: () => assert.fail('aucun processus') }), (e) => e instanceof TypeError && /un `commit` ou un `evenement`/.test(e.message))
  assert.equal(coursesCi({ commit: SHA, limit: 0, spawn: () => assert.fail('aucun processus') }).disponible, false)
})

test('une vraie réponse REST vide est un fait', () => {
  assert.deepEqual(coursesCi({ commit: SHA, spawn: () => pageRest([]) }), { disponible: true, valeur: [] })
})

for (const [nom, reponse, motif] of [
  ['inexécutable', { error: new Error('spawnSync gh ENOENT'), status: null }, /ENOENT/],
  ['refusé', { status: 4, stdout: '', stderr: 'gh: jeton expiré (HTTP 403)' }, /jeton expiré.*403/],
  ['workflow absent', { status: 1, stdout: '', stderr: 'gh: Not Found (HTTP 404)' }, /HTTP 404/],
  ['muet', { status: 1, stdout: '', stderr: '' }, /gh a rendu 1/],
  ['illisible', { status: 0, stdout: '{ tronqué', stderr: '' }, /JSON|property name/i],
  ['enveloppe erronée', { status: 0, stdout: '{"total_count":0,"message":"panne"}', stderr: '' }, /workflow_runs/],
  ['page tronquée', pageRest([COURSE_REST], 2), /1 lues pour 2 attendues/],
  ['essai absent', pageRest([{ ...COURSE_REST, run_attempt: undefined }]), /run_attempt/],
  ['identité invalide', pageRest([{ ...COURSE_REST, id: 0 }]), /id invalide/],
  ['statut absent', pageRest([{ ...COURSE_REST, status: undefined }]), /status/],
  ['date invalide', pageRest([{ ...COURSE_REST, id: 1, conclusion: 'failure' }, { ...COURSE_REST, created_at: 'zzzz' }]), /created_at invalide/],
]) test(`gh ${nom} : une indisponibilité nommée`, () => {
  const lu = coursesCi({ commit: SHA, spawn: () => reponse })
  assert.equal(lu.disponible, false)
  assert.match(lu.raison, motif)
})

test('panne réseau, total incohérent ou run répété en page deux : aucun résultat partiel', () => {
  const premiere = Array.from({ length: 100 }, (_, i) => ({ ...COURSE_REST, id: i + 1 }))
  for (const [seconde, motif] of [
    [{ status: 1, stdout: '', stderr: 'gh: réseau indisponible' }, /réseau indisponible/],
    [pageRest([COURSE_REST], 102), /total passé de 101 à 102/],
    [pageRest([{ ...COURSE_REST, id: 100, run_attempt: 3 }], 101), /identifiant de run répété/],
  ]) {
    let pages = 0
    const lu = coursesCi({ commit: SHA, limit: 101, spawn: () => ++pages === 1 ? pageRest(premiere, 101) : seconde })
    assert.equal(pages, 2)
    assert.equal(lu.disponible, false)
    assert.match(lu.raison, motif)
  }
})

test('une fenêtre au-delà du plafond REST ne rend pas une liste partielle', () => {
  const lu = coursesCi({ evenement: 'merge_group', limit: 1001, spawn: () => pageRest([], 1834) })
  assert.equal(lu.disponible, false)
  assert.match(lu.raison, /1001 attendues, plafond REST 1000/)
})

/** Les annotations d'un job annulé de la course 37365832262 (#1853), lues par `check-runs/{id}/annotations`. */
const ANNOTATIONS_D_ANNULATION = [
  { annotation_level: 'warning', message: 'avertissement sans rapport' },
  { annotation_level: 'failure', message: 'The job was not acquired by Runner of type hosted even after multiple attempts' },
]

test('`jobsEnEchecDe` rend les noms des jobs ROUGES et ANNULÉS d’une course, et le MOTIF du premier annulé, en union — jamais un rouge avalé', () => {
  const vus = []
  const jobs = [{ name: 'docs', conclusion: 'failure', databaseId: 1 }, { name: 'types', conclusion: 'success', databaseId: 2 }, { name: 'suite', conclusion: 'timed_out', databaseId: 3 }, { name: 'migrations', conclusion: 'cancelled', databaseId: 4 }]
  const lu = jobsEnEchecDe({ id: 99, spawn: (cmd, args) => {
    vus.push([cmd, ...args])
    return { status: 0, stdout: JSON.stringify(args[0] === 'api' ? ANNOTATIONS_D_ANNULATION : { jobs }), stderr: '' }
  } })
  assert.deepEqual(vus, [['gh', 'run', 'view', '99', '--json', 'jobs'], ['gh', 'api', 'repos/MyEdO/game/check-runs/4/annotations']])
  assert.deepEqual(lu, { disponible: true, valeur: { rouges: ['docs', 'suite'], annules: ['migrations'], motif: 'The job was not acquired by Runner of type hosted even after multiple attempts' } })
  const sansAnnule = jobsEnEchecDe({ id: 99, spawn: (cmd, args) => (args[0] === 'api' ? assert.fail('aucun motif sans job annulé') : { status: 0, stdout: JSON.stringify({ jobs: jobs.slice(0, 3) }), stderr: '' }) })
  assert.deepEqual(sansAnnule.valeur, { rouges: ['docs', 'suite'], annules: [], motif: null })
  const motifRefuse = jobsEnEchecDe({ id: 99, spawn: (cmd, args) => (args[0] === 'api' ? { status: 1, stdout: '', stderr: 'HTTP 403' } : { status: 0, stdout: JSON.stringify({ jobs }), stderr: '' }) })
  assert.deepEqual(motifRefuse.valeur, { rouges: ['docs', 'suite'], annules: ['migrations'], motif: 'motif illisible : HTTP 403' }, 'un motif illisible se dit, il ne rend pas les jobs illisibles')
  let vu = null
  jobsEnEchecDe({ id: 37371342026, attempt: 1, spawn: (cmd, args) => { vu = [cmd, ...args]; return { status: 0, stdout: '{"jobs":[]}', stderr: '' } } })
  assert.deepEqual(vu, ['gh', 'run', 'view', '37371342026', '--attempt', '1', '--json', 'jobs'], 'l’essai JUGÉ, jamais le dernier qu’une relance remet en vol')
  assert.equal(jobsEnEchecDe({ id: 1, spawn: () => ({ status: 4, stdout: '', stderr: 'x' }) }).disponible, false)
  assert.equal(jobsEnEchecDe({ id: 1, spawn: () => ({ status: 0, stdout: '{}', stderr: '' }) }).disponible, false)
})

// ── Le journal en échec d'une course : EXTRAITS RÉELS de `gh run view <id> --log-failed` (2026-10-05) ──

/** Course 36344944731 (node:test, 16 `not ok`), lignes copiées telles quelles. */
const JOURNAL_NODE = [
  "build\tUNKNOWN STEP\t\uFEFF2026-09-27T19:36:03.6172510Z Current runner version: '2.337.0'",
  "build\tUNKNOWN STEP\t2026-09-27T19:36:55.3047313Z # Subtest: un nom CITÉ À PLAT que deux cœurs portent : sortie 1, UNE anomalie nommant le stock et les deux cœurs, rien d’écrit",
  "build\tUNKNOWN STEP\t2026-09-27T19:36:55.3049126Z not ok 1170 - un nom CITÉ À PLAT que deux cœurs portent : sortie 1, UNE anomalie nommant le stock et les deux cœurs, rien d’écrit",
  "build\tUNKNOWN STEP\t2026-09-27T19:36:55.3049952Z   ---",
  "build\tUNKNOWN STEP\t2026-09-27T19:36:55.3083171Z not ok 1171 - un nom que deux cœurs portent, cité PAR SON CŒUR : sortie 0, RIEN À FAIRE, rien d’écrit",
  "build\tUNKNOWN STEP\t2026-09-27T19:36:55.3109536Z not ok 1172 - MIXTE — un homonyme NON cité et un nom à UN cœur cité à plat : sortie 0, seul ce chemin prend son cœur",
  "build\tUNKNOWN STEP\t2026-09-27T19:36:55.3133592Z not ok 1173 - un stock SOLDÉ, ABSENT du disque : sortie 0, RIEN À FAIRE, le stock n’est pas recréé",
  "build\tUNKNOWN STEP\t2026-09-27T19:36:58.9353305Z not ok 1227 - 2026-09-23-1897-sorts-fan-par-le-pont.mjs (a) MIGRATION RÉELLE : l'entrée fan disparaît, l'absorbante regagne son emplacement, la créature cite l'absorbante",
  "build\tUNKNOWN STEP\t2026-09-27T19:36:58.9379087Z not ok 1228 - 2026-09-23-1897-sorts-fan-par-le-pont.mjs (b) IDEMPOTENCE : rejouée sur l'état d'arrivée, sortie 0 sans rien écrire",
  "build\tUNKNOWN STEP\t2026-09-27T19:36:58.9406357Z not ok 1229 - 2026-09-23-1897-sorts-fan-par-le-pont.mjs (c) FORME non canonique d'un fichier → sortie 1 NOMINATIVE, rien d'écrit",
  "build\tUNKNOWN STEP\t2026-09-27T19:36:58.9443263Z not ok 1230 - 2026-09-23-1897-sorts-fan-par-le-pont.mjs (d) racine NON-TABLEAU → sortie 1 NOMINATIVE, rien d'écrit",
  "build\tUNKNOWN STEP\t2026-09-27T19:36:58.9475500Z not ok 1231 - 2026-09-23-1897-sorts-fan-par-le-pont.mjs (e) cible de fusion ABSENTE du catalogue → sortie 1 NOMINATIVE, rien d'écrit",
  "build\tUNKNOWN STEP\t2026-09-27T19:36:58.9503107Z not ok 1232 - 2026-09-23-1897-sorts-fan-par-le-pont.mjs (f) cible de fusion ELLE-MÊME fusionnée → sortie 1 NOMINATIVE, rien d'écrit",
  "build\tUNKNOWN STEP\t2026-09-27T19:36:58.9550907Z not ok 1233 - 2026-09-23-1897-sorts-fan-par-le-pont.mjs (g) fusion sans CELLULE imprimée → sortie 1 NOMINATIVE, rien d'écrit",
  "build\tUNKNOWN STEP\t2026-09-27T19:36:58.9590297Z not ok 1234 - 2026-09-23-1897-sorts-fan-par-le-pont.mjs (h) cellule que le pont ne RÉSOUT pas → sortie 1 NOMINATIVE, rien d'écrit",
  "build\tUNKNOWN STEP\t2026-09-27T19:36:58.9616838Z not ok 1235 - 2026-09-23-1897-sorts-fan-par-le-pont.mjs (i) id du pont ABSENT du catalogue → sortie 1 NOMINATIVE, rien d'écrit",
  "build\tUNKNOWN STEP\t2026-09-27T19:36:58.9643297Z not ok 1236 - 2026-09-23-1897-sorts-fan-par-le-pont.mjs (j) DOUBLON non déclaré dans une liste dérivée → sortie 1 NOMINATIVE, rien d'écrit",
  "build\tUNKNOWN STEP\t2026-09-27T19:36:58.9670419Z not ok 1237 - 2026-09-23-1897-sorts-fan-par-le-pont.mjs (k) ENTRÉES NEUVES retirées : la migration rend la donnée committée À L'OCTET",
  "build\tUNKNOWN STEP\t2026-09-27T19:37:06.7119790Z not ok 1276 - les migrations DATÉES sont NO-OP sur `src/data` ENTIER aux clés renversées",
  "build\tUNKNOWN STEP\t2026-09-27T19:37:06.7125891Z   ---",
  "build\tUNKNOWN STEP\t2026-09-27T19:37:06.7126395Z   duration_ms: 8364.272559",
].join('\n')

/** Course 35986843571 (vitest). */
const JOURNAL_VITEST = [
  "build\tUNKNOWN STEP\t\uFEFF2026-09-24T10:22:35.3845169Z Current runner version: '2.337.0'",
  "build\tUNKNOWN STEP\t2026-09-24T10:34:12.8482465Z  ✓ src/noyau/absorption.test.ts (1 test) 4ms",
  "build\tUNKNOWN STEP\t2026-09-24T10:34:13.2660645Z ",
  "build\tUNKNOWN STEP\t2026-09-24T10:34:13.2975662Z ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯",
  "build\tUNKNOWN STEP\t2026-09-24T10:34:13.2976133Z ",
  "build\tUNKNOWN STEP\t2026-09-24T10:34:13.2978753Z  FAIL  src/portable-paths-guard.test.ts > garde-fou chemins portables — aucun chemin absolu de machine dans le CODE > aucune source du périmètre ne porte de chemin absolu de machine (tolérance ZÉRO)",
  "build\tUNKNOWN STEP\t2026-09-24T10:34:13.3875318Z ##[error]AssertionError: Chemin(s) absolu(s) de machine — résoudre relativement à `import.meta.url` (cf. en-tête de ce fichier) :",
  "build\tUNKNOWN STEP\t2026-09-24T10:34:13.6596428Z ##[error]Process completed with exit code 1.",
].join('\n')

/** Course 35987445870 (tsc). */
const JOURNAL_TSC = [
  "build\tUNKNOWN STEP\t\uFEFF2026-09-24T10:28:43.7355186Z Current runner version: '2.337.0'",
  "build\tUNKNOWN STEP\t2026-09-24T10:30:35.2284494Z ",
  "build\tUNKNOWN STEP\t2026-09-24T10:31:40.6274303Z ##[error]src/data/schemas/grammaire/collection-cle.ts(279,84): error TS2554: Expected 0-1 arguments, but got 2.",
  "build\tUNKNOWN STEP\t2026-09-24T10:31:40.8935227Z ##[error]Process completed with exit code 2.",
].join('\n')

/** Course 35927591728 (node:test puis vitest dans le même job) : le premier `##[error]` est GÉNÉRIQUE, le second nomme la panne. */
const JOURNAL_MIXTE = [
  "build\tUNKNOWN STEP\t\uFEFF2026-09-23T22:18:28.9346788Z Current runner version: '2.337.0'",
  "build\tUNKNOWN STEP\t2026-09-23T22:18:53.2265486Z not ok 18 - aucune gate n’acquiert un module ÉCRIVAIN sans que ÉCRIT/LU soit re-mesurée",
  "build\tUNKNOWN STEP\t2026-09-23T22:19:34.5615448Z ##[error]Process completed with exit code 1.",
  "build\tUNKNOWN STEP\t2026-09-23T22:28:48.4554815Z  FAIL  src/stock-primitive.test.ts > la primitive tient sa FRONTIÈRE : elle calcule, elle ne juge pas > aucun VERDICT : ni `expect`, ni `throw`, ni `process.exit` — le rouge appartient à la garde appelante",
  "build\tUNKNOWN STEP\t2026-09-23T22:28:48.5421849Z ##[error]AssertionError: `throw` — 126: if (debut < 0) throw new Error(`collection ${nom} introuvable dans le stock lu`);",
  "build\tUNKNOWN STEP\t2026-09-23T22:28:48.9671699Z ##[error]Process completed with exit code 1.",
].join('\n')

test('echecsDuLog : le premier `##[error]` SIGNIFIANT, jamais un « Process completed with exit code N » ; aucun s’il n’y a que du générique', () => {
  assert.deepEqual(echecsDuLog(JOURNAL_MIXTE), [{
    job: 'build',
    etape: null,
    lignes: [
      'not ok 18 - aucune gate n’acquiert un module ÉCRIVAIN sans que ÉCRIT/LU soit re-mesurée',
      'FAIL  src/stock-primitive.test.ts > la primitive tient sa FRONTIÈRE : elle calcule, elle ne juge pas > aucun VERDICT : ni `expect`, ni `throw`, ni `process.exit` — le rouge appartient à la garde appelante',
      '##[error]AssertionError: `throw` — 126: if (debut < 0) throw new Error(`collection ${nom} introuvable dans le stock lu`);',
    ],
    tues: 0,
  }])
  const generiqueSeul = JOURNAL_MIXTE.split('\n').slice(0, 3).join('\n')
  assert.deepEqual(echecsDuLog(generiqueSeul), [{ job: 'build', etape: null, lignes: ['not ok 18 - aucune gate n’acquiert un module ÉCRIVAIN sans que ÉCRIT/LU soit re-mesurée'], tues: 0 }])
})

test('echecsDuLog : les `not ok` de node:test, sans horodatage ni BOM, dédoublonnés, bornés à BORNE_LIGNES_D_ECHEC', () => {
  const [build, ...autres] = echecsDuLog(`${JOURNAL_NODE}\n${JOURNAL_NODE}`)
  assert.deepEqual(autres, [])
  assert.equal(build.job, 'build')
  assert.equal(build.lignes.length, BORNE_LIGNES_D_ECHEC)
  assert.equal(build.lignes[0], 'not ok 1170 - un nom CITÉ À PLAT que deux cœurs portent : sortie 1, UNE anomalie nommant le stock et les deux cœurs, rien d’écrit')
  assert.equal(build.tues, 16 - BORNE_LIGNES_D_ECHEC)
  assert.ok(build.lignes.every((l) => l.startsWith('not ok ')), 'ni `# Subtest`, ni `---`, ni la version du runner')
})

test('echecsDuLog : le ` FAIL  ` de vitest, puis le PREMIER `##[error]` seulement', () => {
  assert.deepEqual(echecsDuLog(JOURNAL_VITEST), [{
    job: 'build',
    etape: null,
    lignes: [
      'FAIL  src/portable-paths-guard.test.ts > garde-fou chemins portables — aucun chemin absolu de machine dans le CODE > aucune source du périmètre ne porte de chemin absolu de machine (tolérance ZÉRO)',
      '##[error]AssertionError: Chemin(s) absolu(s) de machine — résoudre relativement à `import.meta.url` (cf. en-tête de ce fichier) :',
    ],
    tues: 0,
  }])
})

test('echecsDuLog : sans ligne de test, le premier `##[error]` nomme la panne (tsc) ; un job par préfixe, dans l’ordre du journal', () => {
  const autreJob = JOURNAL_TSC.split('\n').map((l) => l.replace(/^build\t/, 'types\t')).join('\n')
  assert.deepEqual(echecsDuLog(`${JOURNAL_VITEST}\n${autreJob}`).map((e) => [e.job, e.lignes.at(-1)]), [
    ['build', '##[error]AssertionError: Chemin(s) absolu(s) de machine — résoudre relativement à `import.meta.url` (cf. en-tête de ce fichier) :'],
    ['types', '##[error]src/data/schemas/grammaire/collection-cle.ts(279,84): error TS2554: Expected 0-1 arguments, but got 2.'],
  ])
  assert.deepEqual(echecsDuLog(''), [])
})

/** Course 37323572830, job `docs` : un seul `##[error]` GÉNÉRIQUE, l'étape en colonne 2 (26 dernières lignes). */
const JOURNAL_DOCS = [
  "docs\tRun npm run docs:build\t2026-10-05T14:23:41.9415640Z Sens B1 : 19 (non implémenté) — 17 sous dette déclarée, 0 sans entrée, 2 hors champ Implémente",
  "docs\tRun npm run docs:build\t2026-10-05T14:23:41.9416313Z   dette de fiche 5e/tests.md (#1873) : couvre 16 topic(s) sur 16",
  "docs\tRun npm run docs:build\t2026-10-05T14:23:41.9416993Z Sens B2 LDB (cœur 4e) : 12 → 1 chapitre(s) Atlas hors-code (11 crédité(s) par folio, 0 sous dette de fiche)",
  "docs\tRun npm run docs:build\t2026-10-05T14:23:41.9417667Z Sens B2 CRB (cœur 5e) : 47 → 0 chapitre(s) Atlas hors-code (0 crédité(s) par folio, 47 sous dette de fiche)",
  "docs\tRun npm run docs:build\t2026-10-05T14:23:41.9418290Z Cœur étranger : aucune des 23 fiche(s) ne cite le livre de cœur d'un autre cœur que le sien.",
  "docs\tRun npm run docs:build\t2026-10-05T14:23:41.9421583Z Cliquet des trous durs : 13 trou(s) dur(s), tous au stock (13 entrée(s)) — aucun neuf, aucun périmé, aucun livre de cœur.",
  "docs\tRun npm run docs:build\t2026-10-05T14:23:42.3838674Z ré-ancrage : ✅ 664 · 🔧 0 dérives (relancer --apply) · 🟡 0 · ❌ 0 · ➖ 3595 (⛔0 ⚠️0)",
  "docs\tRun npm run docs:build\t2026-10-05T14:23:42.3839517Z 664 citations vérifiées sur 4259 réfs (29 fiches)",
  "docs\tRun npm run docs:build\t2026-10-05T14:23:42.4075673Z docs/.sources-lues.json — 33 générateur(s) mesuré(s).",
  "docs\tRun npm run docs:build\t2026-10-05T14:23:44.7637056Z docs:check — 1 référence(s) morte(s) :",
  "docs\tRun npm run docs:build\t2026-10-05T14:23:44.7637941Z   scripts/guards/lib/livraison.test.mjs:126  [doc citée mais absente]  docs/x.md",
  "docs\tRun npm run docs:build\t2026-10-05T14:23:44.7865463Z docs:build — scripts/docs/check-doc-refs.mjs — sortie 1",
  "docs\tRun npm run docs:build\t2026-10-05T14:23:47.3915449Z check-atlas-counts — OK (aucun compte manuscrit dans 29 fichier(s) manuscrit(s) de l'Atlas ; 17 livres dans BOOKS)",
  "docs\tRun npm run docs:build\t2026-10-05T14:23:47.4366947Z progression : 108/108 Carrières appariées à une bande du PDF (111 bandes, livres extraits : archives-de-l-empire-1, archives-de-l-empire-2, aux-armes, livre-de-base, mer-des-griffes, middenheim, vents-de-la-magie)",
  "docs\tRun npm run docs:build\t2026-10-05T14:23:47.4368245Z   archives-de-l-empire-1 : 4",
  "docs\tRun npm run docs:build\t2026-10-05T14:23:47.4368582Z   archives-de-l-empire-2 : 3",
  "docs\tRun npm run docs:build\t2026-10-05T14:23:47.4368935Z   aux-armes : 15",
  "docs\tRun npm run docs:build\t2026-10-05T14:23:47.4369169Z   livre-de-base : 64",
  "docs\tRun npm run docs:build\t2026-10-05T14:23:47.4369359Z   mer-des-griffes : 9",
  "docs\tRun npm run docs:build\t2026-10-05T14:23:47.4369554Z   middenheim : 1",
  "docs\tRun npm run docs:build\t2026-10-05T14:23:47.4369737Z   vents-de-la-magie : 12",
  "docs\tRun npm run docs:build\t2026-10-05T14:23:47.4370550Z   BANDE HORS DONNÉE livre-de-base folio 46 (page PDF 48, y=389.5) : aucune Carrière de la donnée ne la réclame — titres de la page [\"CARRIÈRES\",\"CLASSES ET CARRIÈRES\",\"CLASSES\",\"CARRIÈRES\"]",
  "docs\tRun npm run docs:build\t2026-10-05T14:23:47.4372306Z   BANDE HORS DONNÉE vents-de-la-magie folio 188 (page PDF 192, y=753.1) : aucune Carrière de la donnée ne la réclame — titres de la page [\"FAMILIER DE COMBAT\",\"Évolution de Carrière\",\"FAMILIER DE SORTS\",\"Évolution de Carrière\"]",
  "docs\tRun npm run docs:build\t2026-10-05T14:23:47.4385039Z   BANDE HORS DONNÉE vents-de-la-magie folio 188 (page PDF 192, y=373.8) : aucune Carrière de la donnée ne la réclame — titres de la page [\"FAMILIER DE SORTS\",\"FAMILIER DE COMBAT\",\"Évolution de Carrière\",\"FAMILIER DE SORTS\",\"Évolution de Carrière\"]",
  "docs\tRun npm run docs:build\t2026-10-05T14:23:47.4386508Z progression : OK",
  "docs\tRun npm run docs:build\t2026-10-05T14:23:47.4675550Z ##[error]Process completed with exit code 1.",
].join('\n')

/** Course 37319553290, job `docs` : idem, une autre panne de `docs:build` (24 dernières lignes du job). */
const JOURNAL_DOCS_REANCRAGE = [
  "docs\tRun npm run docs:build\t2026-10-05T13:50:27.8251354Z coverage profondeur : ✅ 123 · 📖 78 · 🟡 19 · ⬜ 68 (sur 288 chapitres) · sections non-fiche : catalogue 639 · hors-règle 2443 · scénario 79 · règle 681 · 🔻enfoui 12 · folios ignorés 2",
  "docs\tRun npm run docs:build\t2026-10-05T13:50:27.8255116Z par livre : LDB ✅40·📖33·🟡0·⬜1 · CRB ✅33·📖0·🟡17·⬜67 · AA ✅9·📖4·🟡0·⬜0 · VDM ✅4·📖10·🟡0·⬜0 · ADE I ✅0·📖2·🟡0·⬜0 · ADE II ✅3·📖3·🟡0·⬜0 · MCLB ✅0·📖5·🟡0·⬜0 · ACE ✅1·📖2·🟡0·⬜0 · ZI ✅4·📖10·🟡0·⬜0 · MDG ✅8·📖2·🟡0·⬜0 · EDOC ✅4·📖0·🟡1·⬜0 · MSRC ✅3·📖4·🟡1·⬜0 · AU1 ✅1·📖0·🟡0·⬜0 · NADJ ✅6·📖0·🟡0·⬜0 · EDO ✅5·📖0·🟡0·⬜0 · MSR ✅0·📖1·🟡0·⬜0 · PDT ✅2·📖2·🟡0·⬜0",
  "docs\tRun npm run docs:build\t2026-10-05T13:50:28.9572772Z Sens A : 12 trou(s) dur(s) chapitre-livre · 11 chapitre(s)-livre à lignes non pinées · 0 réf(s) sans chapitre (hors mesure) · folios Atlas ignorés 2",
  "docs\tRun npm run docs:build\t2026-10-05T13:50:28.9574035Z   ADE I : 1 trous durs · 1 chapitres non pinés · 0 réfs sans chapitre",
  "docs\tRun npm run docs:build\t2026-10-05T13:50:28.9576976Z   ADE II : 0 trous durs · 1 chapitres non pinés · 0 réfs sans chapitre",
  "docs\tRun npm run docs:build\t2026-10-05T13:50:28.9578055Z   EDO : 1 trous durs · 2 chapitres non pinés · 0 réfs sans chapitre",
  "docs\tRun npm run docs:build\t2026-10-05T13:50:28.9579116Z   EDOC : 2 trous durs · 2 chapitres non pinés · 0 réfs sans chapitre",
  "docs\tRun npm run docs:build\t2026-10-05T13:50:28.9580048Z   MCLB : 1 trous durs · 0 chapitres non pinés · 0 réfs sans chapitre",
  "docs\tRun npm run docs:build\t2026-10-05T13:50:28.9580942Z   MDG : 2 trous durs · 1 chapitres non pinés · 0 réfs sans chapitre",
  "docs\tRun npm run docs:build\t2026-10-05T13:50:28.9581509Z   MSRC : 1 trous durs · 2 chapitres non pinés · 0 réfs sans chapitre",
  "docs\tRun npm run docs:build\t2026-10-05T13:50:28.9582063Z   NADJ : 2 trous durs · 1 chapitres non pinés · 0 réfs sans chapitre",
  "docs\tRun npm run docs:build\t2026-10-05T13:50:28.9582617Z   PDT : 2 trous durs · 0 chapitres non pinés · 0 réfs sans chapitre",
  "docs\tRun npm run docs:build\t2026-10-05T13:50:28.9583148Z   VDM : 0 trous durs · 1 chapitres non pinés · 0 réfs sans chapitre",
  "docs\tRun npm run docs:build\t2026-10-05T13:50:28.9584239Z Sens B1 : 19 (non implémenté) — 17 sous dette déclarée, 0 sans entrée, 2 hors champ Implémente",
  "docs\tRun npm run docs:build\t2026-10-05T13:50:28.9584829Z   dette de fiche 5e/tests.md (#1873) : couvre 16 topic(s) sur 16",
  "docs\tRun npm run docs:build\t2026-10-05T13:50:28.9585634Z Sens B2 LDB (cœur 4e) : 12 → 1 chapitre(s) Atlas hors-code (11 crédité(s) par folio, 0 sous dette de fiche)",
  "docs\tRun npm run docs:build\t2026-10-05T13:50:28.9586924Z Sens B2 CRB (cœur 5e) : 47 → 0 chapitre(s) Atlas hors-code (0 crédité(s) par folio, 47 sous dette de fiche)",
  "docs\tRun npm run docs:build\t2026-10-05T13:50:28.9587790Z Cœur étranger : aucune des 23 fiche(s) ne cite le livre de cœur d'un autre cœur que le sien.",
  "docs\tRun npm run docs:build\t2026-10-05T13:50:28.9591466Z Cliquet des trous durs : 13 trou(s) dur(s), tous au stock (13 entrée(s)) — aucun neuf, aucun périmé, aucun livre de cœur.",
  "docs\tRun npm run docs:build\t2026-10-05T13:50:29.5150541Z ré-ancrage : ✅ 662 · 🔧 2 dérives (relancer --apply) · 🟡 0 · ❌ 0 · ➖ 3595 (⛔0 ⚠️0)",
  "docs\tRun npm run docs:build\t2026-10-05T13:50:29.5152180Z 664 citations vérifiées sur 4259 réfs (29 fiches) — relancer avec --apply pour corriger 2 dérives",
  "docs\tRun npm run docs:build\t2026-10-05T13:50:29.5153674Z RÉGRESSION — 2 dérive(s) 🔧 non appliquée(s) : relancer --apply avant de committer.",
  "docs\tRun npm run docs:build\t2026-10-05T13:50:29.5596941Z docs:build — ARRÊT sur scripts/raw/reanchor.mjs (sortie 1) : docs/ n'est PAS à jour.",
  "docs\tRun npm run docs:build\t2026-10-05T13:50:29.5867860Z ##[error]Process completed with exit code 1.",
].join('\n')

/** Course 37317862076, job `types` : colonne d'étape `UNKNOWN STEP`, la panne sous `##[group]Run npm run deps:unused`. */
const JOURNAL_DEPS = [
  "types\tUNKNOWN STEP\t2026-10-05T13:36:09.1947655Z # skipped 0",
  "types\tUNKNOWN STEP\t2026-10-05T13:36:09.1947876Z # todo 0",
  "types\tUNKNOWN STEP\t2026-10-05T13:36:09.1948006Z # duration_ms 2952.343793",
  "types\tUNKNOWN STEP\t2026-10-05T13:36:09.2027743Z ##[group]Run npm run deps:unused",
  "types\tUNKNOWN STEP\t2026-10-05T13:36:09.2027938Z ^[[36;1mnpm run deps:unused^[[0m",
  "types\tUNKNOWN STEP\t2026-10-05T13:36:09.2082370Z shell: /usr/bin/bash -e {0}",
  "types\tUNKNOWN STEP\t2026-10-05T13:36:09.2082537Z ##[endgroup]",
  "types\tUNKNOWN STEP\t2026-10-05T13:36:09.2728761Z ",
  "types\tUNKNOWN STEP\t2026-10-05T13:36:09.2729311Z > warhammer-v4-rpg@0.1.0 deps:unused",
  "types\tUNKNOWN STEP\t2026-10-05T13:36:09.2729853Z > knip --dependencies && npm run deps:exports",
  "types\tUNKNOWN STEP\t2026-10-05T13:36:09.2730056Z ",
  "types\tUNKNOWN STEP\t2026-10-05T13:36:12.7862530Z ",
  "types\tUNKNOWN STEP\t2026-10-05T13:36:12.7863286Z > warhammer-v4-rpg@0.1.0 deps:exports",
  "types\tUNKNOWN STEP\t2026-10-05T13:36:12.7863611Z > node scripts/ops/knip-exports-ratchet.mjs",
  "types\tUNKNOWN STEP\t2026-10-05T13:36:12.7863745Z ",
  "types\tUNKNOWN STEP\t2026-10-05T13:36:16.3735432Z EXPORT(S) MORT(S) NOUVEAU(X) — supprimer l’export, ou le consommer :",
  "types\tUNKNOWN STEP\t2026-10-05T13:36:16.3735904Z   src/data/source/dossier.ts : LIBELLES_DE_FAMILLE",
  "types\tUNKNOWN STEP\t2026-10-05T13:36:16.3882740Z ##[error]Process completed with exit code 1.",
].join('\n')

test('echecsDuLog : sans ligne reconnue, le job nomme son ÉTAPE (colonne 2) et ses BORNE_LIGNES_DE_CONTEXTE dernières lignes avant l’erreur générique', () => {
  const [docs] = echecsDuLog(JOURNAL_DOCS)
  assert.equal(docs.job, 'docs')
  assert.equal(docs.etape, 'Run npm run docs:build')
  assert.equal(docs.lignes.length, BORNE_LIGNES_DE_CONTEXTE)
  assert.ok(docs.lignes.includes('docs:check — 1 référence(s) morte(s) :'), docs.lignes.join('\n'))
  assert.ok(docs.lignes.includes('scripts/guards/lib/livraison.test.mjs:126  [doc citée mais absente]  docs/x.md'), 'la ligne qui NOMME la panne')
  assert.ok(docs.lignes.includes('docs:build — scripts/docs/check-doc-refs.mjs — sortie 1'))
  assert.equal(docs.lignes.at(-1), 'progression : OK', 'la dernière ligne avant l’erreur générique')
  assert.ok(docs.lignes.every((l) => l && !l.startsWith('##[')), 'ni ligne vide, ni directive')
  const [reancrage] = echecsDuLog(JOURNAL_DOCS_REANCRAGE)
  assert.equal(reancrage.etape, 'Run npm run docs:build')
  assert.equal(reancrage.lignes.at(-1), 'docs:build — ARRÊT sur scripts/raw/reanchor.mjs (sortie 1) : docs/ n\'est PAS à jour.')
})

test('echecsDuLog : colonne `UNKNOWN STEP` — l’étape est le dernier `##[group]Run …`, le contexte part de son ouverture', () => {
  const [types] = echecsDuLog(JOURNAL_DEPS)
  assert.equal(types.etape, 'Run npm run deps:unused')
  assert.deepEqual(types.lignes.slice(-2), ['EXPORT(S) MORT(S) NOUVEAU(X) — supprimer l’export, ou le consommer :', 'src/data/source/dossier.ts : LIBELLES_DE_FAMILLE'])
  assert.ok(!types.lignes.some((l) => l.startsWith('# ')), 'rien de l’étape précédente (le résumé TAP)')
})

const archiveTsc = Buffer.from(zipSync({ '0_build.txt': strToU8(JOURNAL_TSC.replaceAll('build\tUNKNOWN STEP\t', '')) }))
const jobTsc = { name: 'build', conclusion: 'failure', steps: [{ name: 'Compiler', number: 1, conclusion: 'failure' }] }

test('journalDe : le dernier essai est épinglé aux jobs et à l’archive, en union', () => {
  const appels = []
  const lu = journalDe({ id: 7, echecsSeuls: true, spawn: (cmd, args, options) => {
    appels.push([cmd, ...args])
    const chemin = args[1]
    if (chemin.endsWith('/runs/7')) return { status: 0, stdout: '{"id":7,"run_attempt":2}', stderr: '' }
    if (args[0] === 'run') return { status: 0, stdout: JSON.stringify({ status: 'completed', jobs: [jobTsc] }), stderr: '' }
    assert.equal(options.encoding, 'buffer')
    return { status: 0, stdout: archiveTsc, stderr: '' }
  } })
  assert.deepEqual(appels, [
    ['gh', 'api', 'repos/MyEdO/game/actions/runs/7'],
    ['gh', 'run', 'view', '7', '--attempt', '2', '--json', 'jobs,startedAt,status'],
    ['gh', 'api', 'repos/MyEdO/game/actions/runs/7/attempts/2/logs'],
  ])
  assert.deepEqual(lu, { disponible: true, valeur: JOURNAL_TSC })
})

test('journalDe : une relance explicite, un refus HTTP nommé et une archive invalide', () => {
  const lire = (echecsSeuls, resultat, jobs = [jobTsc]) => journalDe({ id: 7, attempt: 1, echecsSeuls, spawn: (cmd, args) => {
    if (args[0] === 'run') return { status: 0, stdout: JSON.stringify({ status: 'completed', jobs }), stderr: '' }
    assert.deepEqual(args, ['api', 'repos/MyEdO/game/actions/runs/7/attempts/1/logs'])
    return resultat
  } })
  assert.deepEqual(lire(false, { status: 0, stdout: archiveTsc, stderr: '' }), { disponible: true, valeur: JOURNAL_TSC })
  const refus = lire(false, { status: 1, stderr: 'jeton expiré HTTP 403 https://example.com/archive?signature=masquee' })
  assert.match(refus.raison, /HTTP 403 .*archive\?\[masqué\]/)
  assert.doesNotMatch(refus.raison, /signature=/)
  assert.match(lire(false, { status: 0, stdout: Buffer.from(''), stderr: '' }).raison, /essai 1.*archive ZIP illisible/)
  assert.deepEqual(lire(true, undefined, [{ ...jobTsc, conclusion: 'cancelled' }]), { disponible: true, valeur: '' })
  assert.throws(() => journalDe({ id: 7, spawn: () => assert.fail('aucun appel sans question') }), TypeError)
})

test('journalDe : le filtre des jobs et étapes retrouve les conclusions des journaux en échec de gh', () => {
  const lire = (conclusion) => {
    const job = { ...jobTsc, conclusion, steps: [{ ...jobTsc.steps[0], conclusion }] }
    const archive = Buffer.from(zipSync({ '0_build.txt': strToU8('regroupé'), 'build/1_compiler.txt': strToU8('étape attribuée') }))
    let appelsArchive = 0
    const lu = journalDe({ id: 7, attempt: 1, echecsSeuls: true, spawn: (cmd, args) => {
      if (args[0] === 'run') return { status: 0, stdout: JSON.stringify({ status: 'completed', jobs: [job] }), stderr: '' }
      appelsArchive++
      return { status: 0, stdout: archive, stderr: '' }
    } })
    assert.equal(lu.disponible, true, lu.raison)
    return [lu.valeur, appelsArchive]
  }
  for (const conclusion of ['action_required', 'failure', 'startup_failure', 'timed_out'])
    assert.deepEqual(lire(conclusion), ['build\tCompiler\tétape attribuée', 1], conclusion)
  for (const conclusion of ['cancelled', 'neutral', 'skipped', 'stale', 'success'])
    assert.deepEqual(lire(conclusion), ['', 0], conclusion)
  assert.deepEqual(jobsJuges([{ name: 'build', conclusion: 'action_required' }]), { rouges: [], annules: [] })
})

test('lignesDuJournal : job, étape et texte sans horodatage ni BOM ; une ligne sans trois colonnes est écartée', () => {
  assert.deepEqual(lignesDuJournal(`${JOURNAL_NODE.split('\n').slice(0, 2).join('\n')}\nligne nue`), [
    { job: 'build', etape: 'UNKNOWN STEP', texte: "Current runner version: '2.337.0'" },
    { job: 'build', etape: 'UNKNOWN STEP', texte: '# Subtest: un nom CITÉ À PLAT que deux cœurs portent : sortie 1, UNE anomalie nommant le stock et les deux cœurs, rien d’écrit' },
  ])
})

// ── Verdicts : `verdictDesRuns`, `verdictDesJobs`, `verdictJuge` ───────────────────────────────

const course = (o) => ({ headSha: 'aaa', status: 'completed', workflowName: 'CI', databaseId: 1, createdAt: '2026-09-14T00:00:00Z', ...o })

test('verdictDesRuns : absente, en vol, verte, rouges, annulée', () => {
  assert.equal(verdictDesRuns([], 'aaa').etat, 'absente')
  assert.equal(verdictDesRuns([course({ status: 'in_progress' })], 'aaa').etat, 'en-vol')
  assert.equal(verdictDesRuns([course({ conclusion: 'success' })], 'aaa').etat, 'verte')
  assert.equal(verdictDesRuns([course({ conclusion: 'failure' })], 'aaa').etat, 'rouge')
  assert.equal(verdictDesRuns([course({ conclusion: 'timed_out' })], 'aaa').etat, 'rouge')
  assert.equal(verdictDesRuns([course({ conclusion: 'startup_failure' })], 'aaa').etat, 'rouge')
  assert.equal(verdictDesRuns([course({ conclusion: 'cancelled' })], 'aaa').etat, 'annulee')
})

test('verdictDesRuns : un sha ABSENT de la liste, et une course d’un AUTRE workflow, ne disent rien', () => {
  assert.equal(verdictDesRuns([course({ conclusion: 'success' })], 'bbb').etat, 'absente')
  assert.equal(verdictDesRuns([course({ conclusion: 'success', workflowName: 'Déploiement prod' })], 'aaa').etat, 'absente')
})

test('verdictDesRuns : une conclusion INCONNUE n’est pas verte, et se dit inattendue', () => {
  const vu = verdictDesRuns([course({ conclusion: 'neutral' })], 'aaa')
  assert.equal(vu.etat, 'rouge')
  assert.equal(vu.inattendue, true)
})

test('verdictDesRuns : la PREMIÈRE course de la liste triée gouverne', () => {
  const vu = verdictDesRuns([course({ conclusion: 'success', databaseId: 2 }), course({ conclusion: 'failure', databaseId: 1 })], 'aaa')
  assert.equal(vu.etat, 'verte')
  assert.equal(vu.course.databaseId, 2)
})

test('verdictDesJobs : une course en ÉCHEC sans job rouge et avec un job ANNULÉ est `annulee` (course 37371342026) ; sans l’un ni l’autre, rouge MARQUÉE', () => {
  const rouge = { etat: 'rouge', course: { databaseId: 37371342026 } }
  assert.deepEqual(verdictDesJobs(rouge, { rouges: [], annules: ['docs-tests', 'docs', 'suite 1/3'] }), { ...rouge, etat: 'annulee', rouges: [], annules: ['docs-tests', 'docs', 'suite 1/3'] })
  assert.deepEqual(verdictDesJobs(rouge, { rouges: ['suite'], annules: ['docs'] }).etat, 'rouge', 'un job rouge garde la course rouge')
  const muette = verdictDesJobs(rouge, { rouges: [], annules: [] })
  assert.deepEqual([muette.etat, muette.sansJobEnEchec], ['rouge', true])
  assert.equal(phraseDesJobs(muette), 'aucun job rouge ni annulé dans la course')
  assert.equal(phraseDesJobs(verdictDesJobs(rouge, { rouges: ['suite'], annules: ['docs'] })), 'jobs rouges : suite ; jobs annulés : docs')
  for (const etat of ['verte', 'annulee', 'en-vol', 'absente']) assert.equal(verdictDesJobs({ etat }, { rouges: [], annules: ['x'] }).etat, etat, etat)
})

test('verdictDesJobs : le MOTIF d’une annulation est porté par le verdict, et sa phrase le dit', () => {
  const motif = ANNOTATIONS_D_ANNULATION[1].message
  const annulee = verdictDesJobs({ etat: 'rouge', course: { databaseId: 37365832262 } }, { rouges: [], annules: ['suite 2/3'], motif })
  assert.deepEqual([annulee.etat, annulee.motif], ['annulee', motif])
  assert.equal(phraseDesJobs(annulee), `jobs annulés : suite 2/3 ; motif : ${motif}`)
  assert.equal(phraseDesJobs({ etat: 'annulee' }), '', 'une course annulée par sa conclusion, jobs non lus, ne dit aucun job')
})

test('jobsJuges : les jobs ROUGES (`failure`, `timed_out`, `startup_failure`) et ANNULÉS d’une liste, la forme REST comme celle de `gh`', () => {
  const jobs = [
    { name: 'docs', conclusion: 'failure' }, { name: 'types', conclusion: 'success' }, { name: 'suite', conclusion: 'timed_out' },
    { name: 'deps', conclusion: 'startup_failure' }, { name: 'migrations', conclusion: 'cancelled' }, { name: 'en vol', conclusion: null },
  ]
  assert.deepEqual(jobsJuges(jobs), { rouges: ['docs', 'suite', 'deps'], annules: ['migrations'] })
  assert.deepEqual(jobsJuges(undefined), { rouges: [], annules: [] })
})

test('motifDAnnulation : le message de la PREMIÈRE annotation `failure`, sinon `null`', () => {
  assert.equal(motifDAnnulation(ANNOTATIONS_D_ANNULATION), 'The job was not acquired by Runner of type hosted even after multiple attempts')
  assert.equal(motifDAnnulation([ANNOTATIONS_D_ANNULATION[0]]), null)
  assert.equal(motifDAnnulation([]), null)
  assert.equal(motifDAnnulation({ message: 'pas une liste' }), null)
})

test('verdictJuge #4197 : une course EN VOL se juge sur ses jobs déjà conclus, sur son ESSAI : un job rouge la dit rouge ; sans job rouge, annulés compris, ou jobs illisibles, elle reste en vol', () => {
  const lus = []
  const lire = (valeur) => (id, attempt) => { lus.push([id, attempt]); return valeur }
  const enVol = course({ status: 'in_progress', conclusion: null, databaseId: 43444480744, attempt: 1 })
  const rouge = verdictJuge([enVol], 'aaa', lire({ disponible: true, valeur: { rouges: ['suite 2/3'], annules: [], motif: null } }))
  assert.deepEqual([rouge.etat, rouge.rouges, rouge.course.databaseId], ['rouge', ['suite 2/3'], 43444480744])
  assert.equal(phraseDesJobs(rouge), 'jobs rouges : suite 2/3')
  assert.deepEqual(lus, [[43444480744, 1]])
  for (const jobs of [{ disponible: true, valeur: { rouges: [], annules: [], motif: null } }, { disponible: true, valeur: { rouges: [], annules: ['docs'], motif: 'm' } }, { disponible: false, raison: 'gh a rendu 1' }]) {
    const vu = verdictJuge([enVol], 'aaa', lire(jobs))
    assert.deepEqual(vu, { etat: 'en-vol', course: enVol }, JSON.stringify(jobs))
  }
})

test('verdictJuge : les jobs ne se lisent que sur une course ROUGE ou en vol, sur son ESSAI ; illisibles, une course rouge reste rouge et le dit', () => {
  const lus = []
  const lire = (valeur) => (id, attempt) => { lus.push([id, attempt]); return valeur }
  for (const conclusion of ['success', 'cancelled']) {
    assert.equal(verdictJuge([course({ conclusion })], 'aaa', lire(null)).etat, conclusion === 'success' ? 'verte' : 'annulee')
  }
  assert.equal(verdictJuge([], 'aaa', lire(null)).etat, 'absente')
  assert.deepEqual(lus, [], 'aucune lecture de jobs sur une course verte, annulée ou absente')
  const annulee = verdictJuge([course({ conclusion: 'failure', databaseId: 37365832262, attempt: 2 })], 'aaa',
    lire({ disponible: true, valeur: { rouges: [], annules: ['suite 2/3'], motif: 'm' } }))
  assert.deepEqual([annulee.etat, annulee.annules, annulee.motif], ['annulee', ['suite 2/3'], 'm'])
  assert.deepEqual(lus, [[37365832262, 2]])
  const rouge = verdictJuge([course({ conclusion: 'failure' })], 'aaa', lire({ disponible: true, valeur: { rouges: ['suite'], annules: [], motif: null } }))
  assert.deepEqual([rouge.etat, rouge.rouges], ['rouge', ['suite']])
  assert.deepEqual(lus.at(-1), [1, null], 'sans essai nommé, `null`')
  const illisible = verdictJuge([course({ conclusion: 'failure' })], 'aaa', lire({ disponible: false, raison: 'gh a rendu 1' }))
  assert.deepEqual([illisible.etat, illisible.jobsIllisibles], ['rouge', 'gh a rendu 1'])
})
