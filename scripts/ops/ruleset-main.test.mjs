// CLIQUET du ruleset `main` (node --test, sans réseau) : le corps est PUR, et les contextes de check
// se lisent DANS `ci.yml` — jamais recopiés. Le corps POSÉ lit le `ci.yml` du TRONC ; les gardes de
// forme des jobs (aucun check requis sautable, plafond par job, compteurs de la file) lisent l'arbre,
// là où la forme se change. Lancé par `npm run test:ops`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DEPOT } from '../guards/lib/ticketsGh.mjs'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import {
  DECLENCHEUR_DE_FILE, DELAI_DE_REPONSE_MINUTES, NOM, PARAMETRES_DE_FILE, PARAMETRES_DE_PR,
  corpsDuRuleset, ciDuTronc, executer, refusDeFile, refusGh,
} from './ruleset-main.mjs'
import { TIMEOUT_JOB_MINUTES, blocsDeJobs, contextesRequis, jobsCi } from '../gates/gatesDeCi.mjs'
import { declencheursDe, stepsDu } from '../gates/workflowsDuDepot.mjs'
import { gabaritDeDepot } from '../guards/lib/depotGabarit.mjs'

/** Le refus RÉEL de `gh` : execFileSync lève une erreur qui porte le corps sur `stderr`. */
const erreurGh = (stderr) => Object.assign(new Error('Command failed: gh api'), { stderr, status: 1 })

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

/** Un `ci.yml` de fixture, écrit sous os.tmpdir() : ce module LIT un fichier, on lui en donne un. */
const ciDeFixture = (texte) => {
  const fichier = join(mkdtempSync(join(tmpdir(), 'wfrp-ruleset-')), 'ci.yml')
  writeFileSync(fichier, texte)
  return fichier
}

/** `ci.yml` du tronc, INJECTÉ : `executer` ne lit ni l'arbre ni `origin/main` du poste qui teste. */
const CI_DU_TRONC = 'on:\n  push:\n  merge_group:\n    types: [checks_requested]\njobs:\n  verif:\n    runs-on: x\n  migrations:\n    runs-on: x\n'
const lireCi = () => CI_DU_TRONC
/** Le `ci.yml` d'un tronc SANS déclencheur `merge_group`. */
const CI_SANS_FILE = 'on:\n  push:\njobs:\n  verif:\n    runs-on: x\n'

test('les contextes requis de l’ARBRE sont TOUS ses jobs, dans l’ordre du fichier', () => {
  const noms = jobsCi({ cwd: RACINE })
  assert.deepEqual(contextesRequis({ cwd: RACINE }), noms)
  assert.ok(noms.length >= 2, 'moins de deux jobs : la garde ne mesure plus rien')
})

test('le corps POSÉ lit les jobs du `ci.yml` du TRONC, jamais ceux de l’arbre', () => {
  const dit = []
  executer({ argv: ['--dry-run'], runner: () => '[]', lireCi, sortie: (s) => dit.push(s) })
  const corps = JSON.parse(dit[0])
  assert.deepEqual(corps.rules[0].parameters.required_status_checks, [{ context: 'verif' }, { context: 'migrations' }],
    'un check exigé que `main` ne produit pas encore bloquerait toute entrée dans `main`')
})

test('`ciDuTronc` lit `origin/main:.github/workflows/ci.yml` par la couture git, et lève sur un tronc illisible', () => {
  const { racine: troncSansCi } = gabaritDeDepot({ fichiers: { LISEZMOI: 'x\n' }, refs: { 'refs/remotes/origin/main': 'HEAD' } })
  assert.throws(() => ciDuTronc(troncSansCi), /^Error: origin\/main:\.github\/workflows\/ci\.yml illisible/)
  assert.match(ciDuTronc(RACINE), /^jobs:\s*$/m)
})

test('un job NEUF devient un check requis sans qu’on touche au script', () => {
  const fichier = ciDeFixture('jobs:\n  verif:\n    runs-on: x\n  securite:\n    runs-on: x\n')
  assert.deepEqual(contextesRequis({ fichier }), ['verif', 'securite'])
})

test('un ci.yml sans bloc `jobs:` LÈVE au lieu de rendre une règle vide', () => {
  assert.throws(() => jobsCi({ fichier: ciDeFixture('name: CI\non:\n  push:\n') }), /sans bloc `jobs:`/)
})

// ── Forme des jobs de `ci.yml` ───────────────────────────────────────────────────────────────────
// « A job that is skipped will report its status as "Success". It will not prevent a pull request
// from merging, even if it is a required check. » (docs GitHub, control-jobs-with-conditions.md:42) ;
// « A job depends on a failed job | The dependent job is skipped and may not block merging »
// (troubleshooting-required-status-checks.md:78).

const JOBS = blocsDeJobs({ cwd: RACINE })

test('aucun check REQUIS n’est sautable : ni `if:` ni `needs:` de niveau job', () => {
  const requis = new Set(contextesRequis({ cwd: RACINE }))
  const sautables = JOBS.filter((b) => requis.has(b.job))
    .flatMap((b) => ['if', 'needs'].filter((c) => c in b.cles).map((c) => `${b.job} porte \`${c}: ${b.cles[c]}\``))
  assert.deepEqual(sautables, [], 'un check requis SAUTÉ rend « Success » et laisse entrer un rouge')
})

test(`chaque job de ci.yml porte \`timeout-minutes: ${TIMEOUT_JOB_MINUTES}\` au niveau JOB`, () => {
  const ecarts = JOBS.filter((b) => b.cles['timeout-minutes'] !== String(TIMEOUT_JOB_MINUTES))
    .map((b) => `${b.job} : ${b.cles['timeout-minutes'] ?? '(absent)'}`)
  assert.deepEqual(ecarts, [], 'un job sans plafond tient son runner jusqu’au défaut de GitHub')
})

test('`ci.yml` de l’ARBRE déclenche sur `merge_group`, jamais sur `push` de `main` ni sur `pull_request`', () => {
  const texte = readFileSync(join(RACINE, '.github/workflows/ci.yml'), 'utf8')
  assert.equal(refusDeFile(texte), null)
  assert.ok(!declencheursDe(texte).includes('pull_request'), 'le push de la branche attache déjà ses checks à la tête de la PR')
  assert.doesNotMatch(texte, /^ {4}branches: .*\bmain\b/m, 'le sha poussé sur `main` est un commit de file déjà jugé')
})

test('un job REQUIS juge les compteurs de version sur le commit de file, par un `if:` de STEP sur `merge_group`', () => {
  const requis = new Set(contextesRequis({ cwd: RACINE }))
  const steps = JOBS.filter((b) => requis.has(b.job))
    .flatMap((b) => stepsDu(b.texte).map((s) => ({ job: b.job, ...s })))
    .filter((s) => /^\s*-?\s*run: node scripts\/ops\/compteurs-de-file\.mjs\s*$/m.test(s.bloc))
  assert.equal(steps.length, 1, 'aucun (ou plusieurs) step « compteurs-de-file » dans un job requis')
  assert.match(steps[0].si ?? '', /github\.event_name == 'merge_group'/)
  assert.match(steps[0].bloc, /SHA: \$\{\{ github\.event\.merge_group\.head_sha \}\}/)
})

test('les fermetures vivent HORS de `ci.yml` : `fermetures.yml` lit les checks requis AVANT de fermer', () => {
  assert.ok(!jobsCi({ cwd: RACINE }).includes('fermetures'), 'un job de fermeture dans ci.yml deviendrait un check requis')
  const texte = readFileSync(join(RACINE, '.github/workflows/fermetures.yml'), 'utf8')
  assert.deepEqual(declencheursDe(texte), ['push'])
  const runs = stepsDu(texte).map((s) => s.bloc)
  const iChecks = runs.findIndex((b) => b.includes('node scripts/ops/checks-requis.mjs'))
  const iFermer = runs.findIndex((b) => b.includes('node scripts/ops/fermer-depuis-main.mjs'))
  assert.ok(iChecks >= 0 && iFermer > iChecks, 'aucun ticket ne se ferme avant la lecture des checks requis')
  assert.ok(!/^\s*if:/m.test(runs[iFermer]), 'la fermeture ne joue QUE si les checks requis sont verts (succès du step précédent)')
})

// ── Corps du ruleset ─────────────────────────────────────────────────────────────────────────────

test('le ruleset est ACTIF sur main : checks requis, file de fusion, PR, non-fast-forward, suppression', () => {
  const corps = corpsDuRuleset(['verif', 'migrations'])
  assert.equal(corps.name, NOM)
  assert.equal(corps.enforcement, 'active', 'arbitrage utilisateur 2026-09-16 : « Oui, ruleset actif »')
  assert.equal(corps.target, 'branch')
  assert.deepEqual(corps.conditions.ref_name, { include: ['refs/heads/main'], exclude: [] })
  assert.deepEqual(corps.rules.map((r) => r.type), ['required_status_checks', 'merge_queue', 'pull_request', 'non_fast_forward', 'deletion'])
  assert.equal(corps.rules[0].parameters.strict_required_status_checks_policy, false,
    'le commit de file jugé est celui qui entre')
  assert.deepEqual(corps.rules[0].parameters.required_status_checks, [{ context: 'verif' }, { context: 'migrations' }])
})

test('la règle `merge_queue` porte les SEPT paramètres exigés par le schéma, méthode MERGE', () => {
  const { parameters } = corpsDuRuleset(['verif']).rules.find((r) => r.type === 'merge_queue')
  // `repository-rule-merge-queue`, github/rest-api-description, `required`.
  assert.deepEqual(Object.keys(parameters).sort(), [
    'check_response_timeout_minutes', 'grouping_strategy', 'max_entries_to_build', 'max_entries_to_merge',
    'merge_method', 'min_entries_to_merge', 'min_entries_to_merge_wait_minutes',
  ])
  assert.equal(parameters.merge_method, 'MERGE', 'les commits de la branche entrent avec LEURS shas')
  assert.equal(parameters.grouping_strategy, 'ALLGREEN')
  assert.ok(parameters.check_response_timeout_minutes > TIMEOUT_JOB_MINUTES,
    'un délai de réponse sous le plafond d’un job tiendrait pour échoué un job encore dans sa borne')
  assert.equal(parameters.check_response_timeout_minutes, DELAI_DE_REPONSE_MINUTES)
  assert.deepEqual(parameters, { ...PARAMETRES_DE_FILE })
})

test('la règle `pull_request` porte les CINQ paramètres exigés, zéro approbation, la seule méthode MERGE', () => {
  const { parameters } = corpsDuRuleset(['verif']).rules.find((r) => r.type === 'pull_request')
  // `repository-rule-pull-request`, github/rest-api-description, `required`.
  for (const cle of ['dismiss_stale_reviews_on_push', 'require_code_owner_review', 'require_last_push_approval', 'required_approving_review_count', 'required_review_thread_resolution'])
    assert.ok(cle in parameters, `paramètre exigé absent : ${cle}`)
  assert.equal(parameters.required_approving_review_count, 0)
  assert.deepEqual(parameters.allowed_merge_methods, [PARAMETRES_DE_FILE.merge_method.toLowerCase()])
  assert.deepEqual(parameters.allowed_merge_methods, [...PARAMETRES_DE_PR.allowed_merge_methods])
})

test('le corps ne porte AUCUN bypass : personne n’entre dans `main` hors de la porte', () => {
  const corps = corpsDuRuleset(['verif'])
  assert.equal('bypass_actors' in corps, false,
    'l’intégration GitHub Actions a été refusée en bypass (HTTP 422 du 2026-09-16) : '
    + 'le corps ne doit pas même porter la clé, sans quoi le serveur refuse tout le ruleset')
  assert.deepEqual(Object.keys(corps).sort(), ['conditions', 'enforcement', 'name', 'rules', 'target'])
})

// ── Le geste ─────────────────────────────────────────────────────────────────────────────────────

test('`--dry-run` n’émet AUCUN appel `gh` — ni lecture, ni écriture — et rend le corps', () => {
  const appels = []
  const dit = []
  const code = executer({ argv: ['--dry-run'], runner: (args) => { appels.push(args); return '[]' }, lireCi, sortie: (s) => dit.push(s) })
  assert.equal(code, 0)
  assert.deepEqual(appels, [], 'le mode qui n’écrit rien ne doit pas non plus interroger le dépôt')
  assert.match(dit.join(''), /rien n’a été écrit sur GitHub/)
  assert.match(dit.join(''), /"enforcement": "active"/)
  assert.equal(JSON.parse(dit[0]).name, NOM)
})

test('la FILE est REFUSÉE tant que le `ci.yml` du tronc ne déclenche pas sur `merge_group` — aucun appel, `--dry-run` compris', () => {
  assert.match(refusDeFile(CI_SANS_FILE), new RegExp(`ne déclenche pas sur \`${DECLENCHEUR_DE_FILE}\``))
  assert.equal(refusDeFile(CI_DU_TRONC), null)
  for (const argv of [[], ['--dry-run']]) {
    const appels = []
    const journal = []
    const code = executer({ argv, runner: (args) => { appels.push(args); return '[]' }, lireCi: () => CI_SANS_FILE, sortie: () => {}, journal: (s) => journal.push(s) })
    assert.equal(code, 1, `argv ${JSON.stringify(argv)}`)
    assert.deepEqual(appels, [], 'aucun ruleset ne se pose sur un tronc sans `merge_group`')
    assert.match(journal.join(''), /\[ruleset\] REFUS : origin\/main:\.github\/workflows\/ci\.yml ne déclenche pas sur `merge_group`/)
  }
})

test('hors `--dry-run`, la mise à jour d’un ruleset EXISTANT passe par PUT sur son id — aucun réglage du dépôt', () => {
  const appels = []
  executer({
    argv: [],
    runner: (args) => { appels.push(args); return JSON.stringify([{ name: NOM, id: 77 }]) },
    lireCi,
    sortie: () => {},
  })
  assert.deepEqual(appels[0], ['api', `repos/${DEPOT}/rulesets`])
  assert.deepEqual(appels[1].slice(0, 4), ['api', '-X', 'PUT', `repos/${DEPOT}/rulesets/77`])
  assert.equal(appels.length, 2)
})

test('hors `--dry-run`, un ruleset ABSENT est CRÉÉ par POST sur la collection', () => {
  const appels = []
  executer({ argv: [], runner: (args) => { appels.push(args); return '[]' }, lireCi, sortie: () => {} })
  assert.deepEqual(appels[1].slice(0, 4), ['api', '-X', 'POST', `repos/${DEPOT}/rulesets`])
})

test('un échec `gh` rend exit 1 en portant son corps — jamais avalé, jamais une stack Node', () => {
  const dit = []
  const code = executer({
    argv: [],
    runner: () => { throw erreurGh('gh: Not Found (HTTP 404)') },
    lireCi,
    sortie: () => {},
    journal: (s) => dit.push(s),
  })
  assert.equal(code, 1)
  assert.match(dit.join(''), /Not Found \(HTTP 404\)/)
  assert.ok(!/at .*ruleset-main/.test(dit.join('')), 'un refus attendu ne se rend pas en stack Node')
})

test('le corps de l’erreur est lu OÙ QU’IL SOIT (stdout, stderr, message)', () => {
  assert.match(refusGh(erreurGh('boum')), /boum/)
  assert.match(refusGh({ stdout: 'boum' }), /boum/)
  assert.match(refusGh(new Error('boum')), /boum/)
})

test('un geste qui ABOUTIT rend 0', () => {
  assert.equal(executer({ argv: [], runner: () => '[]', lireCi, sortie: () => {} }), 0)
  assert.equal(executer({ argv: ['--dry-run'], runner: () => '[]', lireCi, sortie: () => {} }), 0)
})
