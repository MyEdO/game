// Le hook de mise en conformité d'un conteneur distant (#1803) : ce qui est MESURÉ avant d'agir, ce
// qui est posé, ce qui est rapporté quand la pose échoue — et son CÂBLAGE sur la surface Claude.
import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import {
  GESTES_DU_CONTENEUR, VERROU_DOCS, bootstrap, construireDocs, docsBuildDetache, estConteneurDistant, lancer, mettreEnConformite, sousOutillage,
} from './bootstrap-conteneur.mjs'
import { verrouOutillageDe } from './barriere-outil.mjs'
import { attendreLibre, prendreVerrou } from '../test/verrou.mjs'
import { BUDGET_TOTAL, JOURNAL_DOCS, MARGE_DE_DEMARRAGE, PREREQUIS } from './bootstrap-prerequis.mjs'
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
    approfondir: () => { vus.push('git approfondir'); return { ok: true, valeur: '', rapport: '' } },
    docsMesures: () => { vus.push('docs mesurés'); return reponses['docs mesurés'] ?? false },
    docsBuildDetache: () => { vus.push('docs:build détaché'); return reponses['docs:build'] ?? { ok: true, valeur: '4242', rapport: '' } },
    sousOutillage: (_racine, geste) => { vus.push('sous outillage'); return geste() },
  }
  return { run, gestes, vus }
}

const CONFORME = {
  'git superficiel': false,
  'git hooks': 'scripts/git-hooks',
  'docs mesurés': true,
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
    ['git estSuperficiel', 'git dossierDesHooks', 'docs mesurés', 'gh --version'],
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

// #2203 : les docs purs ne sont pas commités ; un conteneur neuf les produit sans bloquer la session.
test('docs dérivés absents : `docs:build` part DÉTACHÉ, la ligne NOMME son journal, et lui seul', () => {
  const { run, gestes, vus } = lanceurFeint({ ...CONFORME, 'docs mesurés': false })
  const lignes = bootstrap({ CLAUDE_CODE_REMOTE: 'true' }, REPO, run, gestes)
  assert.deepEqual(lignes, ['[conteneur] docs dérivés : posé par `npm run docs:build, détaché (journal node_modules/.cache/bootstrap-docs-build.log)`.'])
  assert.ok(vus.includes('docs:build détaché'), vus.join(' | '))
  assert.ok(!vus.some((v) => v.startsWith('npm') || v.startsWith('apt-get')), 'rien d’autre à poser')
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
/** Les gestes git RÉELS du conteneur ; les docs dérivés, eux, sont MESURÉS présents — jamais la mesure
 *  de l'arbre qui joue le test, jamais un `docs:build` détaché lancé par le banc. */
const GESTES_GIT_REELS = {
  ...GESTES_DU_CONTENEUR,
  docsMesures: () => true,
  docsBuildDetache: () => assert.fail('docs:build détaché lancé par le banc'),
}

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
  assert.deepEqual(mettreEnConformite({ racine: REPO, run, gestes: GESTES_GIT_REELS, pannes: [], depot }), [], 'hooks vivants : rien à poser')
})

for (const [nom, stderr] of [
  ['newline', 'fatal: dépôt illisible\n'],
  ['cause tardive', `${'note de refus\n'.repeat(50)}fatal: cause tardive\n`],
]) test(`une PANNE de git se NOMME, et le prérequis qu’elle empêche de mesurer n’est pas posé — ${nom}`, () => {
  const pannes = []
  const depot = depotDe(REPO, { spawn: () => ({ status: 128, stdout: '', stderr }), enPanne: (r) => pannes.push(r) })
  const run = (exe) => (exe === 'gh' ? { ok: true, valeur: 'gh version 2.45.0', rapport: '' } : assert.fail(`${exe} lancé`))
  const rapports = mettreEnConformite({ racine: REPO, run, gestes: GESTES_GIT_REELS, pannes, depot })
  assert.deepEqual(pannes, [stderr, stderr])
  const prefixes = ['[conteneur] histoire git complète : NON MESURÉ, git indisponible — ', '[conteneur] hooks git du dépôt : NON MESURÉ, git indisponible — ']
  assert.equal(rapports.length, prefixes.length)
  for (const [i, prefixe] of prefixes.entries()) {
    assert.ok(rapports[i].startsWith(prefixe))
    const diagnosticPresente = rapports[i].slice(prefixe.length)
    if (nom === 'newline') assert.equal(diagnosticPresente, stderr)
    else {
      assert.ok(diagnosticPresente.startsWith('…'))
      assert.ok(diagnosticPresente.length <= 401)
      assert.ok(diagnosticPresente.endsWith('fatal: cause tardive\n'))
      assert.ok(diagnosticPresente.includes('note de refus\n'))
    }
  }
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

test('BUDGET — le `timeout` déclaré couvre la table ENTIÈRE, constats et démarrage du hook compris', () => {
  const porte = aplatirHooks(JSON.parse(readFileSync(SETTINGS_CLAUDE, 'utf8')), SURFACE_CLAUDE)
    .filter((h) => h.phase === 'SessionStart' && h.script === 'bootstrap-conteneur.mjs')
  assert.equal(porte.length, 1, 'le hook de conformité du conteneur n’est pas câblé côté Claude')
  assert.ok(
    porte[0].timeout >= BUDGET_TOTAL + MARGE_DE_DEMARRAGE,
    `timeout ${porte[0].timeout} s < budget de la table ${BUDGET_TOTAL} s + démarrage ${MARGE_DE_DEMARRAGE} s — une pose serait tuée en vol`,
  )
})

test('CÂBLAGE — le hook est PROPRE à la surface Claude (sa garde est un marqueur Claude Code)', () => {
  assert.deepEqual(HOOKS_DE_SESSION.find((h) => h.phase === 'SessionStart' && h.script === 'bootstrap-conteneur.mjs')?.surfaces, [SURFACE_CLAUDE])
  assert.ok(
    !readFileSync(HOOKS_CODEX, 'utf8').includes('bootstrap-conteneur'),
    '.codex/hooks.json porterait un spawn qui ne mesure rien',
  )
})

test('la table couvre les trois manques MESURÉS au conteneur du 2026-09-18, plus les docs dérivés (#2203)', () => {
  assert.deepEqual(
    PREREQUIS.map((p) => p.geste),
    ['git fetch --unshallow origin', 'npm install', 'npm run docs:build, détaché (journal node_modules/.cache/bootstrap-docs-build.log)', 'apt-get update puis apt-get install -y gh'],
  )
})

/** Racine jetable dont `scripts/docs/build-all.mjs` est un FAUX build : il journalise `debut`, puis vit
 *  2 s, le temps que le banc le juge en cours. */
function racineDeBuild() {
  const racine = mkdtempSync(join(tmpdir(), 'docs-detache-'))
  mkdirSync(join(racine, 'scripts', 'docs'), { recursive: true })
  writeFileSync(join(racine, 'scripts', 'docs', 'build-all.mjs'), "process.stdout.write('debut\\n')\nsetTimeout(() => {}, 2000)\n")
  return racine
}

const attendre = async (condition, quoi) => {
  for (let i = 0; i < 300; i++) {
    if (condition()) return
    await new Promise((r) => setTimeout(r, 100))
  }
  assert.fail(`${quoi} : non atteint en 30 s`)
}

/** Le tenant du verrou des docs de `racine`, `null` s'il est libre. */
const tenantDocs = (racine) => {
  const vu = attendreLibre({ chemin: join(racine, VERROU_DOCS) })
  return vu.etat === 'libre' ? null : vu.tenant
}

/** Un pid MORT : celui d'un processus node sorti. */
const pidMort = () => spawnSync(process.execPath, ['-e', '']).pid

test('docs:build détaché : le constructeur TIENT le verrou à son PID ; un build vivant n’est ni relancé ni son journal tronqué ; fini, le verrou est libre et un build neuf repart', async () => {
  const racine = racineDeBuild()
  try {
    const premier = docsBuildDetache(racine)
    assert.equal(premier.ok, true, premier.rapport)
    const journal = join(racine, JOURNAL_DOCS)
    await attendre(() => existsSync(journal) && readFileSync(journal, 'utf8').includes('debut'), 'le build journalise')
    assert.equal(String(tenantDocs(racine)?.pid), premier.valeur, 'le constructeur détaché tient le verrou à SON pid')
    assert.deepEqual(docsBuildDetache(racine), { ok: true, valeur: premier.valeur, rapport: '' }, 'le build en cours est rendu, jamais relancé')
    assert.match(readFileSync(journal, 'utf8'), /debut/, 'le journal du build en cours n’est pas tronqué')
    await attendre(() => tenantDocs(racine) === null, 'le constructeur libère le verrou en fin de build')
    const neuf = docsBuildDetache(racine)
    assert.equal(neuf.ok, true, neuf.rapport)
    assert.notEqual(neuf.valeur, premier.valeur)
    await attendre(() => tenantDocs(racine) === null, 'le second constructeur finit')
  } finally {
    await rm(racine, { recursive: true, force: true, maxRetries: 20, retryDelay: 100 })
  }
})

test('docs:build détaché : un constructeur qui PERD la prise sort sans toucher au journal ni lancer le build', () => {
  const racine = racineDeBuild()
  try {
    const journal = join(racine, JOURNAL_DOCS)
    mkdirSync(dirname(journal), { recursive: true })
    writeFileSync(journal, 'journal du build en cours\n')
    const prise = prendreVerrou({ chemin: join(racine, VERROU_DOCS), libelle: 'banc' })
    try {
      assert.equal(construireDocs(racine, { lancer: () => assert.fail('build lancé par un perdant') }), null)
    } finally {
      prise.liberer()
    }
    assert.equal(readFileSync(journal, 'utf8'), 'journal du build en cours\n')
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('docs:build détaché : un verrou laissé par un PID MORT ne retient rien ; le gagnant le reprend, joue le build, puis le libère', () => {
  const racine = racineDeBuild()
  try {
    mkdirSync(dirname(join(racine, VERROU_DOCS)), { recursive: true })
    writeFileSync(join(racine, VERROU_DOCS), JSON.stringify({ pid: pidMort(), commande: 'mort' }))
    assert.equal(tenantDocs(racine), null)
    const lances = []
    assert.equal(construireDocs(racine, { lancer: () => { lances.push(String(tenantDocs(racine)?.pid)); return { status: 0 } } }), 0)
    assert.deepEqual(lances, [String(process.pid)], 'le build joue sous le verrou repris, au PID du constructeur')
    assert.equal(tenantDocs(racine), null)
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('npm install sous le verrou d’OUTILLAGE (#2187) : tenu par un vivant → rien n’est joué, le refus est rapporté ; libre → joué sous le verrou, puis libéré', () => {
  const racine = mkdtempSync(join(tmpdir(), 'outillage-'))
  mkdirSync(join(racine, '.git'))
  const chemin = /** @type {string} */ (verrouOutillageDe(racine))
  try {
    writeFileSync(chemin, JSON.stringify({ pid: process.pid, commande: 'npm ci' }))
    const refus = sousOutillage(racine, () => assert.fail('joué sous un verrou tenu'))
    assert.equal(refus.ok, false)
    assert.match(refus.rapport, /tenu par le PID \d+/)
    rmSync(chemin)
    const tenus = []
    assert.deepEqual(sousOutillage(racine, () => { tenus.push(attendreLibre({ chemin }).etat); return { ok: true, valeur: '', rapport: '' } }), { ok: true, valeur: '', rapport: '' })
    assert.deepEqual(tenus, ['occupe'])
    assert.equal(existsSync(chemin), false)
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})
