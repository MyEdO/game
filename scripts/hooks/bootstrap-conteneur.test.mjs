// Le hook de mise en conformité d'un conteneur distant (#1803) : ce qui est MESURÉ avant d'agir, ce
// qui est posé, ce qui est rapporté quand la pose échoue — et son CÂBLAGE sur la surface Claude.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import {
  BUDGET_CONSTAT, BUDGET_TOTAL, PREREQUIS, bootstrap, estConteneurDistant, lancer, mettreEnConformite,
} from './bootstrap-conteneur.mjs'
import { HOOKS_MONO_SURFACE, NUL, SURFACE_CLAUDE, SURFACE_CODEX, aplatirHooks } from '../agents/compat-core.mjs'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const SETTINGS_CLAUDE = join(REPO, SURFACE_CLAUDE)
const HOOKS_CODEX = join(REPO, SURFACE_CODEX)

/** Faux lanceur : rend la réponse programmée pour `<exe> <premier arg>` et journalise l'appel. */
function lanceurFeint(reponses) {
  const vus = []
  const run = (exe, args) => {
    vus.push([exe, ...args].join(' '))
    return reponses[`${exe} ${args[0]}`] ?? { ok: true, valeur: '', rapport: '' }
  }
  return { run, vus }
}

const CONFORME = {
  'git rev-parse': { ok: true, valeur: 'false', rapport: 'false' },
  'git config': { ok: true, valeur: 'scripts/git-hooks', rapport: 'scripts/git-hooks' },
  'gh --version': { ok: true, valeur: 'gh version 2.45.0', rapport: 'gh version 2.45.0' },
}

test('hors conteneur distant, le hook ne mesure ni ne pose RIEN', () => {
  const { run, vus } = lanceurFeint({})
  for (const env of [{}, { CLAUDE_CODE_REMOTE: 'false' }, { CLAUDE_CODE_REMOTE: '1' }]) {
    assert.equal(estConteneurDistant(env), false)
    assert.deepEqual(bootstrap(env, REPO, run), [])
  }
  assert.deepEqual(vus, [], 'un environnement local ne doit voir passer aucune commande')
})

test('conteneur DÉJÀ conforme : silence complet, aucune pose', () => {
  const { run, vus } = lanceurFeint(CONFORME)
  assert.deepEqual(bootstrap({ CLAUDE_CODE_REMOTE: 'true' }, REPO, run), [])
  assert.deepEqual(
    vus,
    ['git rev-parse --is-shallow-repository', 'git config core.hooksPath', 'gh --version'],
    'seuls les constats se jouent',
  )
})

test('dépôt superficiel : `git fetch --unshallow` posé', () => {
  const { run, vus } = lanceurFeint({ ...CONFORME, 'git rev-parse': { ok: true, valeur: 'true', rapport: 'true' } })
  const lignes = bootstrap({ CLAUDE_CODE_REMOTE: 'true' }, REPO, run)
  assert.equal(lignes.length, 1)
  assert.match(lignes[0], /histoire git complète : posé par `git fetch --unshallow origin`\./)
  assert.ok(vus.includes('git fetch --unshallow origin'), `fetch absent de ${vus.join(' | ')}`)
})

test('core.hooksPath vide : `npm install` posé, et lui seul', () => {
  const { run, vus } = lanceurFeint({ ...CONFORME, 'git config': { ok: false, valeur: '', rapport: '' } })
  const lignes = bootstrap({ CLAUDE_CODE_REMOTE: 'true' }, REPO, run)
  assert.equal(lignes.length, 1)
  assert.match(lignes[0], /hooks git du dépôt : posé par `npm install`\./)
  assert.ok(vus.includes('npm install --no-audit --no-fund'), `npm install absent de ${vus.join(' | ')}`)
  assert.ok(!vus.some((v) => v.startsWith('apt-get') || v.startsWith('git fetch')), 'rien d’autre à poser')
})

test('gh absent : apt-get joué, la ligne NOMME le geste', () => {
  const { run, vus } = lanceurFeint({ ...CONFORME, 'gh --version': { ok: false, valeur: '', rapport: 'spawnSync gh ENOENT' } })
  const lignes = bootstrap({ CLAUDE_CODE_REMOTE: 'true' }, REPO, run)
  assert.equal(lignes.length, 1)
  assert.match(lignes[0], /exécutable gh : posé par `apt-get update puis apt-get install -y gh`\./)
  assert.ok(vus.includes('apt-get install -y -qq gh'), `apt-get absent de ${vus.join(' | ')}`)
  assert.ok(!vus.includes('npm install --no-audit --no-fund'), 'hooks vivants : pas de npm install')
})

test('une pose qui ÉCHOUE est rapportée nommément, sans jamais échouer la session', () => {
  const { run } = lanceurFeint({
    ...CONFORME,
    'gh --version': { ok: false, valeur: '', rapport: 'spawnSync gh ENOENT' },
    'apt-get install': { ok: false, valeur: '', rapport: 'E: Unable to locate package gh' },
  })
  const lignes = bootstrap({ CLAUDE_CODE_REMOTE: 'true' }, REPO, run)
  assert.equal(lignes.length, 1)
  assert.match(lignes[0], /MANQUANT, `apt-get update puis apt-get install -y gh` a échoué — .*Unable to locate package gh/)
})

test('un prérequis n’est jamais posé sans son constat (table rejouable à vide)', () => {
  let poses = 0
  const table = [{ nom: 'x', manque: () => false, poser: () => { poses++; return { ok: true, rapport: '' } }, geste: 'x', budget: 1 }]
  assert.deepEqual(mettreEnConformite({ racine: REPO, run: () => ({ ok: true, valeur: '', rapport: '' }) }, table), [])
  assert.equal(poses, 0)
})

// #1803, réfutation du juge : `git config` et `git rev-parse` écrivent leurs avertissements sur
// stderr. Mêler les deux flux dans la valeur COMPARÉE rendait les deux constats faux — `npm install`
// à chaque démarrage d'un côté, dépôt superficiel conservé EN SILENCE de l'autre.
test('la VALEUR mesurée ne lit que stdout — un bruit sur stderr ne fausse aucun constat', () => {
  const vu = lancer(process.execPath, [
    '-e', "process.stdout.write('scripts/git-hooks\\n'); process.stderr.write('warning: bruit\\n')",
  ])
  assert.equal(vu.ok, true)
  assert.equal(vu.valeur, 'scripts/git-hooks', 'la valeur mesurée doit ignorer stderr')
  assert.match(vu.rapport, /warning: bruit/, 'le rapport d’échec, lui, garde les deux flux')

  const { run } = lanceurFeint({ ...CONFORME, 'git config': vu })
  assert.deepEqual(bootstrap({ CLAUDE_CODE_REMOTE: 'true' }, REPO, run), [], 'hooks vivants : rien à poser')
})

test('`lancer` rend ok:false sur un exécutable absent, en gardant le diagnostic', () => {
  const vu = lancer('wfrp-executable-qui-n-existe-pas', ['--version'])
  assert.equal(vu.ok, false)
  assert.equal(vu.valeur, '')
  assert.match(vu.rapport, /ENOENT/)
})

test('un rapport d’échec est BORNÉ avant d’entrer au contexte de la session', () => {
  const vu = lancer(process.execPath, ['-e', "process.stderr.write('x'.repeat(50000)); process.exit(1)"])
  assert.equal(vu.ok, false)
  assert.ok(vu.rapport.length <= 401, `rapport de ${vu.rapport.length} caractères — non borné`)
})

// #1803, réfutation du juge : un budget par commande recopié à la main ne disait rien du budget de
// bout en bout, et le `timeout` déclaré à la surface était plus court que la somme des poses.
test('BUDGET — le `timeout` déclaré couvre la table ENTIÈRE, constats compris', () => {
  assert.equal(BUDGET_TOTAL, PREREQUIS.reduce((s, p) => s + p.budget + BUDGET_CONSTAT, 0))
  const porte = aplatirHooks(JSON.parse(readFileSync(SETTINGS_CLAUDE, 'utf8')), SURFACE_CLAUDE)
    .filter((h) => h.phase === 'SessionStart' && h.script === 'bootstrap-conteneur.mjs')
  assert.equal(porte.length, 1, 'le hook de conformité du conteneur n’est pas câblé côté Claude')
  assert.ok(
    porte[0].timeout >= BUDGET_TOTAL,
    `timeout ${porte[0].timeout} s < budget de la table ${BUDGET_TOTAL} s — une pose serait tuée en vol`,
  )
})

test('CÂBLAGE — le hook est PROPRE à la surface Claude (sa garde est un marqueur Claude Code)', () => {
  assert.equal(HOOKS_MONO_SURFACE.get(`SessionStart${NUL}${NUL}bootstrap-conteneur.mjs`), SURFACE_CLAUDE)
  assert.ok(
    !readFileSync(HOOKS_CODEX, 'utf8').includes('bootstrap-conteneur'),
    '.codex/hooks.json porterait un spawn qui ne mesure rien',
  )
})

test('la table couvre les trois manques MESURÉS au conteneur du 2026-09-18', () => {
  assert.deepEqual(
    PREREQUIS.map((p) => p.geste),
    ['git fetch --unshallow origin', 'npm install', 'apt-get update puis apt-get install -y gh'],
  )
})
