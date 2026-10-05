// La lecture des courses CI de `main` : une union, un tri, un stub qui sert UNE LISTE PAR APPEL.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { BORNE_LIGNES_DE_CONTEXTE, BORNE_LIGNES_D_ECHEC, CHAMPS, coursesCi, echecsDuLog, journalEnEchecDe, jobsEnEchecDe, reinitialiserStub, triees } from './coursesCi.mjs'

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
  for (const champ of ['attempt', 'conclusion', 'createdAt', 'databaseId', 'headSha', 'status', 'workflowName'])
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

test('`jobsEnEchecDe` rend les noms des jobs ROUGES et ANNULÉS d’une course, en union — jamais un rouge avalé', () => {
  let vus = null
  const jobs = [{ name: 'docs', conclusion: 'failure' }, { name: 'types', conclusion: 'success' }, { name: 'suite', conclusion: 'timed_out' }, { name: 'migrations', conclusion: 'cancelled' }]
  const lu = jobsEnEchecDe({ id: 99, spawn: (cmd, args) => { vus = [cmd, ...args]; return { status: 0, stdout: JSON.stringify({ jobs }), stderr: '' } } })
  assert.deepEqual(vus, ['gh', 'run', 'view', '99', '--json', 'jobs'])
  assert.deepEqual(lu, { disponible: true, valeur: { rouges: ['docs', 'suite'], annules: ['migrations'] } })
  jobsEnEchecDe({ id: 37371342026, attempt: 1, spawn: (cmd, args) => { vus = [cmd, ...args]; return { status: 0, stdout: '{"jobs":[]}', stderr: '' } } })
  assert.deepEqual(vus, ['gh', 'run', 'view', '37371342026', '--attempt', '1', '--json', 'jobs'], 'l’essai JUGÉ, jamais le dernier qu’une relance remet en vol')
  journalEnEchecDe({ id: 7, attempt: 2, spawn: (cmd, args) => { vus = [cmd, ...args]; return { status: 0, stdout: '', stderr: '' } } })
  assert.deepEqual(vus, ['gh', 'run', 'view', '7', '--attempt', '2', '--log-failed'])
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
  "build\tUNKNOWN STEP\t2026-09-24T10:34:12.8482465Z  ✓ src/ui/FxChip.test.tsx (1 test) 4ms",
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

test('journalEnEchecDe : `gh run view <id> --log-failed`, en union — jamais un journal vide pour une panne', () => {
  let vus = null
  const lu = journalEnEchecDe({ id: 7, spawn: (cmd, args) => { vus = [cmd, ...args]; return { status: 0, stdout: JOURNAL_TSC, stderr: '' } } })
  assert.deepEqual(vus, ['gh', 'run', 'view', '7', '--log-failed'])
  assert.deepEqual(lu, { disponible: true, valeur: JOURNAL_TSC })
  assert.equal(journalEnEchecDe({ id: 7, spawn: () => ({ status: 1, stdout: '', stderr: 'run 7 introuvable' }) }).disponible, false)
})
