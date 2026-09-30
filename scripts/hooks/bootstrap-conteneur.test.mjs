// Le hook de mise en conformité d'un conteneur distant (#1803) : ce qui est MESURÉ avant d'agir, ce
// qui est posé, ce qui est rapporté quand la pose échoue — et son CÂBLAGE sur la surface Claude.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import {
  BUDGET_CONSTAT, BUDGET_TOTAL, GESTES_DU_CONTENEUR, PREREQUIS, bootstrap, estConteneurDistant, lancer, mettreEnConformite,
} from './bootstrap-conteneur.mjs'
import { depotDe } from '../guards/lib/gitPorte.mjs'
import { HOOKS_DE_SESSION, SURFACE_CLAUDE, SURFACE_CODEX, aplatirHooks } from '../agents/compat-core.mjs'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const SETTINGS_CLAUDE = join(REPO, SURFACE_CLAUDE)
const HOOKS_CODEX = join(REPO, SURFACE_CODEX)

/** Faux lanceur : rend la réponse programmée pour `<exe> <premier arg>` et journalise l'appel ; les
 *  gestes git (`GESTES_DU_CONTENEUR`) sont des QUESTIONS feintes, qui répondent `reponses['git superficiel']`
 *  et `reponses['git hooks']` et journalisent la question posée. */
function lanceurFeint(reponses) {
  const vus = []
  const run = (exe, args) => {
    vus.push([exe, ...args].join(' '))
    return reponses[`${exe} ${args[0]}`] ?? { ok: true, valeur: '', rapport: '' }
  }
  const gestes = {
    estSuperficiel: () => { vus.push('git estSuperficiel'); return reponses['git superficiel'] ?? null },
    dossierDesHooks: () => { vus.push('git dossierDesHooks'); return reponses['git hooks'] ?? null },
    approfondir: () => { vus.push('git approfondir'); return { disponible: true, valeur: { status: 0, stdout: '', stderr: '' } } },
  }
  return { run, gestes, vus }
}

const CONFORME = {
  'git superficiel': false,
  'git hooks': 'scripts/git-hooks',
  'gh --version': { ok: true, valeur: 'gh version 2.45.0', rapport: 'gh version 2.45.0' },
}

test('hors conteneur distant, le hook ne mesure ni ne pose RIEN', () => {
  const { run, gestes, vus } = lanceurFeint({})
  for (const env of [{}, { CLAUDE_CODE_REMOTE: 'false' }, { CLAUDE_CODE_REMOTE: '1' }]) {
    assert.equal(estConteneurDistant(env), false)
    assert.deepEqual(bootstrap(env, REPO, run, gestes), [])
  }
  assert.deepEqual(vus, [], 'un environnement local ne doit voir passer aucune commande')
})

test('conteneur DÉJÀ conforme : silence complet, aucune pose', () => {
  const { run, gestes, vus } = lanceurFeint(CONFORME)
  assert.deepEqual(bootstrap({ CLAUDE_CODE_REMOTE: 'true' }, REPO, run, gestes), [])
  assert.deepEqual(
    vus,
    ['git estSuperficiel', 'git dossierDesHooks', 'gh --version'],
    'seuls les constats se jouent',
  )
})

test('dépôt superficiel : `git fetch --unshallow` posé', () => {
  const { run, gestes, vus } = lanceurFeint({ ...CONFORME, 'git superficiel': true })
  const lignes = bootstrap({ CLAUDE_CODE_REMOTE: 'true' }, REPO, run, gestes)
  assert.equal(lignes.length, 1)
  assert.match(lignes[0], /histoire git complète : posé par `git fetch --unshallow origin`\./)
  assert.ok(vus.includes('git approfondir'), `fetch absent de ${vus.join(' | ')}`)
})

test('core.hooksPath vide : `npm install` posé, et lui seul', () => {
  const { run, gestes, vus } = lanceurFeint({ ...CONFORME, 'git hooks': null })
  const lignes = bootstrap({ CLAUDE_CODE_REMOTE: 'true' }, REPO, run, gestes)
  assert.equal(lignes.length, 1)
  assert.match(lignes[0], /hooks git du dépôt : posé par `npm install`\./)
  assert.ok(vus.includes('npm install --no-audit --no-fund'), `npm install absent de ${vus.join(' | ')}`)
  assert.ok(!vus.some((v) => v.startsWith('apt-get') || v === 'git approfondir'), 'rien d’autre à poser')
})

test('gh absent : apt-get joué, la ligne NOMME le geste', () => {
  const { run, gestes, vus } = lanceurFeint({ ...CONFORME, 'gh --version': { ok: false, valeur: '', rapport: 'spawnSync gh ENOENT' } })
  const lignes = bootstrap({ CLAUDE_CODE_REMOTE: 'true' }, REPO, run, gestes)
  assert.equal(lignes.length, 1)
  assert.match(lignes[0], /exécutable gh : posé par `apt-get update puis apt-get install -y gh`\./)
  assert.ok(vus.includes('apt-get install -y -qq gh'), `apt-get absent de ${vus.join(' | ')}`)
  assert.ok(!vus.includes('npm install --no-audit --no-fund'), 'hooks vivants : pas de npm install')
})

test('une pose qui ÉCHOUE est rapportée nommément, sans jamais échouer la session', () => {
  const { run, gestes } = lanceurFeint({
    ...CONFORME,
    'gh --version': { ok: false, valeur: '', rapport: 'spawnSync gh ENOENT' },
    'apt-get install': { ok: false, valeur: '', rapport: 'E: Unable to locate package gh' },
  })
  const lignes = bootstrap({ CLAUDE_CODE_REMOTE: 'true' }, REPO, run, gestes)
  assert.equal(lignes.length, 1)
  assert.match(lignes[0], /MANQUANT, `apt-get update puis apt-get install -y gh` a échoué — .*Unable to locate package gh/)
})

test('un prérequis n’est jamais posé sans son constat (table rejouable à vide)', () => {
  let poses = 0
  const table = [{ nom: 'x', manque: () => false, poser: () => { poses++; return { ok: true, rapport: '' } }, geste: 'x', budget: 1 }]
  assert.deepEqual(mettreEnConformite({ racine: REPO, run: () => ({ ok: true, valeur: '', rapport: '' }) }, table), [])
  assert.equal(poses, 0)
})

// #1803, réfutation du juge : un outil écrit ses avertissements sur stderr. Mêler les deux flux dans
// la valeur COMPARÉE rendait les constats faux — `npm install` à chaque démarrage d'un côté, dépôt
// superficiel conservé EN SILENCE de l'autre. Les constats git sont des questions de l'hôte
// (`gitPorte.mjs`), qui ne lisent que stdout.
test('la VALEUR mesurée ne lit que stdout — un bruit sur stderr ne fausse aucun constat', () => {
  const vu = lancer(process.execPath, [
    '-e', "process.stdout.write('scripts/git-hooks\\n'); process.stderr.write('warning: bruit\\n')",
  ])
  assert.equal(vu.ok, true)
  assert.equal(vu.valeur, 'scripts/git-hooks', 'la valeur mesurée doit ignorer stderr')
  assert.match(vu.rapport, /warning: bruit/, 'le rapport d’échec, lui, garde les deux flux')

  const reponses = { 'rev-parse': 'false\n', config: 'scripts/git-hooks\n' }
  const depot = depotDe(REPO, { spawn: (_git, args) => ({ status: 0, stdout: reponses[args.find((a) => a in reponses)], stderr: 'warning: bruit\n' }) })
  const run = (exe) => (exe === 'gh' ? { ok: true, valeur: 'gh version 2.45.0', rapport: '' } : assert.fail(`${exe} lancé`))
  assert.deepEqual(mettreEnConformite({ racine: REPO, run, gestes: GESTES_DU_CONTENEUR, pannes: [], depot }), [], 'hooks vivants : rien à poser')
})

test('une PANNE de git se NOMME, et le prérequis qu’elle empêche de mesurer n’est pas posé', () => {
  const pannes = []
  const depot = depotDe(REPO, { spawn: () => ({ status: 128, stdout: '', stderr: 'fatal: dépôt illisible\n' }), enPanne: (r) => pannes.push(r) })
  const run = (exe) => (exe === 'gh' ? { ok: true, valeur: 'gh version 2.45.0', rapport: '' } : assert.fail(`${exe} lancé`))
  assert.deepEqual(mettreEnConformite({ racine: REPO, run, gestes: GESTES_DU_CONTENEUR, pannes, depot }), [
    '[conteneur] histoire git complète : NON MESURÉ, git indisponible — fatal: dépôt illisible',
    '[conteneur] hooks git du dépôt : NON MESURÉ, git indisponible — fatal: dépôt illisible',
  ])
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
  assert.deepEqual(HOOKS_DE_SESSION.find((h) => h.phase === 'SessionStart' && h.script === 'bootstrap-conteneur.mjs')?.surfaces, [SURFACE_CLAUDE])
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
