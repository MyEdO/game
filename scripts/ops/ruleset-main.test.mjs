// CLIQUET du ruleset `main` (node --test, sans réseau) : le corps est PUR, et les contextes de check
// se lisent DANS `ci.yml` — jamais recopiés. Le corps POSÉ lit le `ci.yml` du TRONC ; les gardes de
// forme des jobs (aucun check requis sautable, `fermetures` après tous, plafond par job) lisent
// l'arbre, là où la forme se change. Lancé par `npm run test:ops`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import {
  corpsDuRuleset, ciDuTronc, NOM, executer, refusGh,
} from './ruleset-main.mjs'
import {
  JOBS_NON_VERIFIANTS, TIMEOUT_JOB_MINUTES, blocsDeJobs, contextesRequis, jobsCi,
} from '../gates/gatesDeCi.mjs'
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
const CI_DU_TRONC = 'jobs:\n  verif:\n    runs-on: x\n  fermetures:\n    runs-on: x\n'
const lireCi = () => CI_DU_TRONC

test('les contextes requis de l’ARBRE sont ses jobs vérifiants, dans l’ordre du fichier', () => {
  const noms = jobsCi({ cwd: RACINE })
  assert.ok(noms.includes('fermetures'), `jobs lus : ${noms.join(', ')}`)
  assert.deepEqual(contextesRequis({ cwd: RACINE }), noms.filter((j) => !(j in JOBS_NON_VERIFIANTS)))
  assert.ok(contextesRequis({ cwd: RACINE }).length >= 2, 'moins de deux jobs vérifiants : la garde ne mesure plus rien')
})

test('le corps POSÉ lit les jobs du `ci.yml` du TRONC, jamais ceux de l’arbre', () => {
  const dit = []
  executer({ argv: ['--dry-run'], runner: () => '[]', lireCi, sortie: (s) => dit.push(s) })
  const corps = JSON.parse(dit[0])
  assert.deepEqual(corps.rules[0].parameters.required_status_checks, [{ context: 'verif' }],
    'un check exigé que `main` ne produit pas encore bloquerait toute entrée dans `main`')
})

test('`ciDuTronc` lit `origin/main:.github/workflows/ci.yml` par la couture git, et lève sur un tronc illisible', () => {
  const { racine: troncSansCi } = gabaritDeDepot({ fichiers: { LISEZMOI: 'x\n' }, refs: { 'refs/remotes/origin/main': 'HEAD' } })
  assert.throws(() => ciDuTronc(troncSansCi), /^Error: origin\/main:\.github\/workflows\/ci\.yml illisible/)
  assert.match(ciDuTronc(RACINE), /^jobs:\s*$/m)
})

test('un job NON VÉRIFIANT est écarté des checks requis, nommément et avec sa raison', () => {
  const fichier = ciDeFixture('jobs:\n  verif:\n    runs-on: x\n  fermetures:\n    runs-on: x\n')
  assert.deepEqual(jobsCi({ fichier }), ['verif', 'fermetures'])
  assert.deepEqual(contextesRequis({ fichier }), ['verif'])
  assert.deepEqual(contextesRequis({ texte: CI_DU_TRONC }), ['verif'])
  assert.match(JOBS_NON_VERIFIANTS.fermetures, /APRÈS la publication/)
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

/** Les jobs d'une clé `needs:` de niveau job — scalaire (`needs: a`) ou liste en ligne (`[a, b]`). */
const jobsRequisPar = (valeur) =>
  String(valeur ?? '').replace(/^\[|\]$/g, '').split(',').map((j) => j.trim()).filter(Boolean)

test('aucun check REQUIS n’est sautable : ni `if:` ni `needs:` de niveau job', () => {
  const requis = new Set(contextesRequis({ cwd: RACINE }))
  const sautables = JOBS.filter((b) => requis.has(b.job))
    .flatMap((b) => ['if', 'needs'].filter((c) => c in b.cles).map((c) => `${b.job} porte \`${c}: ${b.cles[c]}\``))
  assert.deepEqual(sautables, [], 'un check requis SAUTÉ rend « Success » et laisse entrer un rouge')
})

test('`fermetures` attend TOUS les jobs vérifiants, et eux seuls', () => {
  const fermetures = JOBS.find((b) => b.job === 'fermetures')
  assert.ok(fermetures, 'ci.yml sans job `fermetures`')
  assert.deepEqual(jobsRequisPar(fermetures.cles.needs), contextesRequis({ cwd: RACINE }),
    'un job vérifiant absent de `needs:` laisserait fermer un ticket sur sa course rouge')
})

test(`chaque job de ci.yml porte \`timeout-minutes: ${TIMEOUT_JOB_MINUTES}\` au niveau JOB`, () => {
  const ecarts = JOBS.filter((b) => b.cles['timeout-minutes'] !== String(TIMEOUT_JOB_MINUTES))
    .map((b) => `${b.job} : ${b.cles['timeout-minutes'] ?? '(absent)'}`)
  assert.deepEqual(ecarts, [], 'un job sans plafond tient son runner jusqu’au défaut de GitHub')
})

test('le ruleset est ACTIF sur main : checks requis, non-fast-forward, suppression', () => {
  const corps = corpsDuRuleset(['verif', 'migrations'])
  assert.equal(corps.name, NOM)
  assert.equal(corps.enforcement, 'active', 'décision utilisateur 2026-09-16 : « Oui, ruleset actif »')
  assert.equal(corps.target, 'branch')
  assert.deepEqual(corps.conditions.ref_name, { include: ['refs/heads/main'], exclude: [] })
  assert.deepEqual(corps.rules.map((r) => r.type), ['required_status_checks', 'non_fast_forward', 'deletion'])
  assert.equal(corps.rules[0].parameters.strict_required_status_checks_policy, false,
    'la tête verte sur sa branche entre telle quelle : c’est le fast-forward qui garantit l’inclusion')
  assert.deepEqual(corps.rules[0].parameters.required_status_checks, [{ context: 'verif' }, { context: 'migrations' }])
})

test('le corps ne porte AUCUN bypass : personne n’entre dans `main` hors de la porte', () => {
  const corps = corpsDuRuleset(['verif'])
  assert.equal('bypass_actors' in corps, false,
    'l’intégration GitHub Actions a été refusée en bypass (HTTP 422 du 2026-09-16) : '
    + 'le corps ne doit pas même porter la clé, sans quoi le serveur refuse tout le ruleset')
  assert.deepEqual(Object.keys(corps).sort(), ['conditions', 'enforcement', 'name', 'rules', 'target'])
})

test('`--dry-run` n’émet AUCUN appel `gh` — ni lecture, ni écriture', () => {
  const appels = []
  const dit = []
  executer({ argv: ['--dry-run'], runner: (args) => { appels.push(args); return '[]' }, lireCi, sortie: (s) => dit.push(s) })
  assert.deepEqual(appels, [], 'le mode qui n’écrit rien ne doit pas non plus interroger le dépôt')
  assert.match(dit.join(''), /rien n’a été écrit sur GitHub/)
  assert.match(dit.join(''), /"enforcement": "active"/)
})

test('hors `--dry-run`, la mise à jour d’un ruleset EXISTANT passe par PUT sur son id', () => {
  const appels = []
  executer({
    argv: [],
    runner: (args) => { appels.push(args); return JSON.stringify([{ name: NOM, id: 77 }]) },
    lireCi,
    sortie: () => {},
  })
  assert.deepEqual(appels[0], ['api', 'repos/cgauche/game/rulesets'])
  assert.deepEqual(appels[1].slice(0, 4), ['api', '-X', 'PUT', 'repos/cgauche/game/rulesets/77'])
})

test('hors `--dry-run`, un ruleset ABSENT est CRÉÉ par POST sur la collection', () => {
  const appels = []
  executer({ argv: [], runner: (args) => { appels.push(args); return '[]' }, lireCi, sortie: () => {} })
  assert.deepEqual(appels[1].slice(0, 4), ['api', '-X', 'POST', 'repos/cgauche/game/rulesets'])
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
