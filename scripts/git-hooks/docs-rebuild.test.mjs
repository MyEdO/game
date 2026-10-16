// #1773, #2329, #2475, #2603
import test from 'node:test'
import assert from 'node:assert/strict'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { spawn, spawnSync } from 'node:child_process'
import { once } from 'node:events'
import { envDeDepotForge, envGitFeint, instanceDeDepot, sousGitFeint } from '../guards/lib/depotGabarit.mjs'
import { ciblesSurDisque, CODE_DIFFERE, CODE_SOURCE_MODIFIEE, executer, genererCode, GENERATORS, mesurerEnRendu, SOURCES_LUES } from '../docs/build-all.mjs'
import { preuveValide } from '../docs/lib/fraicheur-docs.mjs'
import { lancerDetache } from '../guards/lib/lancerDetache.mjs'
import { attendreSync } from '../guards/lib/spawnResilient.mjs'
import { tableTotale } from '../../src/lib/tableTotale.ts'
import { codeDeLaPasse, lotDuPostMerge, reconstruireApresGit, touchedFiles } from './docs-rebuild.mjs'
import {
  ATTENTE_DU_TENANT, attendreLaReconstruction, cheminsDeLaReconstruction, CODE_MORT_SANS_VERDICT, demanderLaReconstruction, demandesDe, passeDesDerives, REJEUX_SUR_SOURCE_MODIFIEE,
  servirLesDemandes,
} from './reconstruction.mjs'
import { pathspecsDeRequeteGit, selectionDesGenerateurs, touchesDocSources } from './selection-des-derives.mjs'
import { couvertParPathspec } from '../guards/lib/lister.mjs'
import { gitDe, resultatDeGit } from '../test/gitDeBanc.mjs'
import { attendreLibre, prendreVerrou, tenantDe } from '../test/verrou.mjs'
import { estPidVivant } from '../guards/lib/pid.mjs'
const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

test('#2285 callback docs : refus complet et commit ordinaire silencieux', () => {
  const { racine } = instanceDeDepot({ fichiers: { 'package-lock.json': '{}\n' } })
  try {
    assert.equal(statSync(join(racine, 'package-lock.json')).isFile(), true)
    const stderr = 'note parents\n'.repeat(45) + 'cause parents tardive\n'
    const stdout = 'stdout parents distinct'
    assert.ok(stderr.indexOf('cause parents tardive') > 400)
    assert.ok(stderr.endsWith('\n'))
    const annonces = []
    let npm = 0
    let code = 0
    let demandes = 0
    const options = {
      cwd: racine, hook: 'post-commit', generateurs: [],
      annoncer: (texte) => annonces.push(texte),
      npm: () => { npm++; return { status: 1 } },
      code: () => { code++; assert.fail('code interdit') },
      demander: () => { demandes++; assert.fail('demande interdite') },
    }
    const resultat = sousGitFeint([
      { si: ['rev-parse', 'HEAD^@'], status: 29, stdout, stderr },
      { si: ['rev-parse', '--verify', '--quiet', 'HEAD'], status: 1, stdout: '', stderr: '' },
      { si: ['HEAD^{commit}'], status: 0, stdout: 'a'.repeat(40) },
      { si: ['reflog', 'exists', 'HEAD'], status: 1, stdout: '', stderr: '' },
      { si: [], status: 97, stderr: 'GARDE callback docs : lecture interdite\n' },
    ], () => reconstruireApresGit(options))
    assert.deepEqual(resultat, { code: 1, seq: null })
    assert.equal(npm, 1)
    assert.equal(code, 0)
    assert.equal(demandes, 0)
    const lectures = annonces.filter((texte) => texte.startsWith('[post-commit] lecture Git indisponible : '))
    assert.deepEqual(lectures, ['[post-commit] lecture Git indisponible : refus (status 29) — ' + stderr + '\n' + stdout + '\n'])
    assert.equal(annonces.some((texte) => texte.includes('GARDE callback docs')), false)
    annonces.length = 0
    npm = 0
    const ordinaire = sousGitFeint([
      { si: ['rev-parse', 'HEAD^@'], status: 0, stdout: 'b'.repeat(40) + '\n' },
      { si: [], status: 97, stderr: 'GARDE callback docs : lecture interdite\n' },
    ], () => reconstruireApresGit(options))
    assert.deepEqual(ordinaire, { code: 0, seq: null })
    assert.equal(npm, 0)
    assert.equal(code, 0)
    assert.equal(demandes, 0)
    assert.deepEqual(annonces, [])
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})
/** Une mesure FORGÉE : un fichier lu, un dossier LISTÉ, une cible signée. */
const MESURE = {
  'g/a.mjs': { cibles: ['docs/a.md'], fichiers: ['src/ui/Prose.tsx', 'notes/lue.md'], dossiers: ['.github/workflows'] },
}

test('une SOURCE LUE, une CIBLE signée, un dossier LISTÉ : les trois font régénérer', () => {
  assert.equal(touchesDocSources(['src/ui/Prose.tsx'], MESURE), true)
  assert.equal(touchesDocSources(['docs/a.md'], MESURE), true)
  // Un fichier neuf sous un dossier LISTÉ : c'est le listing hashé qui bouge.
  assert.equal(touchesDocSources(['.github/workflows/neuf.yml'], MESURE), true)
  // Graphie Windows comprise (le hook reçoit ce que git rend).
  assert.equal(touchesDocSources(['src\\ui\\Prose.tsx'], MESURE), true)
})

test('un FRÈRE simplement voisin d’une source lue ne fait pas régénérer ; la source elle-même, si', () => {
  assert.equal(touchesDocSources(['notes/voisine.md'], MESURE), false)
  assert.equal(touchesDocSources(['public/x.svg'], MESURE), false)
  assert.equal(touchesDocSources(['README.md'], { 'g/a.mjs': { cibles: [], fichiers: ['package.json'], dossiers: [] } }), false)
  assert.equal(touchesDocSources(['package.json'], { 'g/a.mjs': { cibles: [], fichiers: ['package.json'], dossiers: [] } }), true)
})

// #2603
test('un chemin SONDÉ absent, puis ajouté, fait régénérer ; un descendant d’un dossier sondé aussi', () => {
  const mesure = { 'g/a.mjs': { cibles: [], fichiers: ['notes/lue.md'], dossiers: [], sondes: [
    { chemin: 'notes/peut-etre.md', type: 'exists', existe: false, nature: null },
    { chemin: 'cache', type: 'stat', existe: false, nature: null, code: 'ENOENT' },
  ] } }
  assert.equal(touchesDocSources(['notes/peut-etre.md'], mesure), true)
  assert.equal(touchesDocSources(['cache/neuf/x.json'], mesure), true)
  assert.equal(touchesDocSources(['notes/autre.md'], mesure), false)
})

// #2603
test('un chemin couvert par le pathspec d’une requête `git` mesurée fait régénérer ; `rev-parse --show-toplevel` seul, non', () => {
  const avecGit = (...git) => ({ 'g/a.mjs': { cibles: [], fichiers: [], dossiers: [], git } })
  const lsFiles = avecGit({ args: ['ls-files', '.claude/memory/user-*.md'], cwd: '' })
  assert.equal(touchesDocSources(['.claude/memory/user-neuve.md'], lsFiles), true)
  assert.equal(touchesDocSources(['.claude/memory/feedback-x.md'], lsFiles), false)
  const log = avecGit({ args: ['log', '--diff-filter=A', '--format=%as', '-1', '--', 'x/fiche.md'], cwd: 'notes' })
  assert.equal(touchesDocSources(['notes/x/fiche.md'], log), true)
  assert.equal(touchesDocSources(['notes/x/voisine.md'], log), false)
  assert.equal(touchesDocSources(['README.md'], avecGit({ args: ['rev-parse', '--show-toplevel'], cwd: '' })), false)
  assert.equal(touchesDocSources(['README.md'], avecGit({ args: ['status', '--short'], cwd: '' })), true, 'sans pathspec, la requête dépend de tout l’arbre')
  assert.equal(touchesDocSources(['README.md'], avecGit({ args: ['ls-files', '-x', 'a', 'b'], cwd: '' })), true, 'une option à valeur rend la portée illisible')
})

// #2603
test('pathspecsDeRequeteGit : après `--`, sinon les non-options de `ls-files`, relatifs au cwd ; `null` quand la portée est illisible', () => {
  assert.deepEqual(pathspecsDeRequeteGit({ args: ['rev-parse', '--show-toplevel'], cwd: '' }), [])
  assert.deepEqual(pathspecsDeRequeteGit({ args: ['ls-files', '-z', 'a/*.md', 'b'], cwd: 'sous' }), ['sous/a/*.md', 'sous/b'])
  assert.deepEqual(pathspecsDeRequeteGit({ args: ['log', '-1', '--', '.'], cwd: '' }), [''])
  assert.equal(pathspecsDeRequeteGit({ args: ['log', '-1'], cwd: '' }), null)
  assert.equal(pathspecsDeRequeteGit({ args: ['ls-files', ':(glob)a/**'], cwd: '' }), null)
  for (const [args, lot] of [
    [['ls-files', '--others', '--exclude-standard', 'notes'], 'notes/.gitignore'],
    [['ls-files', '--exclude-from=.gitignore', '--ignored', '--others', 'notes'], '.gitignore'],
    [['check-ignore', '--', 'notes/a.md'], '.gitignore'],
    [['check-attr', 'diff', '--', 'notes/a.md'], '.gitattributes'],
    [['log', '--follow', '--format=%H', '--', 'notes/a.md'], 'notes/ancien.md'],
    [['log', '-M', '--diff-filter=A', '--', 'notes/a.md'], 'notes/ancien.md'],
  ]) {
    assert.equal(pathspecsDeRequeteGit({ args, cwd: '' }), null, `${args.join(' ')} : sa sortie dépend d’un fichier hors pathspec`)
    assert.equal(touchesDocSources([lot], { 'g/a.mjs': { cibles: [], fichiers: [], dossiers: [], git: [{ args, cwd: '' }] } }), true, lot)
  }
  assert.equal(couvertParPathspec('a/b/c.md', 'a/*.md'), true, 'le `*` de Git franchit `/`')
  assert.equal(couvertParPathspec('ab/c.md', 'a'), false)
})

test('FAIL-CLOSED : lot inconnu ou mesure illisible → on régénère ; lot vide → silence', () => {
  assert.equal(touchesDocSources(null, MESURE), true, 'sans ORIG_HEAD, le lot est inconnu')
  assert.equal(touchesDocSources(['README.md'], null), true, 'sans mesure, rien n’est jugeable')
  assert.equal(touchesDocSources(null, null), true)
  assert.equal(touchesDocSources([], MESURE), false)
})

test('un fichier dans un dossier NEUF sous un dossier LISTÉ fait régénérer : tout ANCÊTRE compte (#2193)', () => {
  const mesure = { 'g/a.mjs': { cibles: [], fichiers: ['scripts/a.mjs', 'scripts/b.mjs'], dossiers: ['src'] } }
  assert.equal(touchesDocSources(['src/nouveau-dossier/x.ts'], mesure), true)
  assert.equal(touchesDocSources(['src/nouveau/plus/bas/x.ts'], mesure), true)
})

/** Une mesure FORGÉE à deux générateurs : `g/m.mjs` (le périmètre restreint) et `g/p.mjs` (hors). */
const MESURE_DEUX = {
  'g/m.mjs': { cibles: [], fichiers: ['src/m.ts', 'scripts/m.mjs'], dossiers: ['data'] },
  'g/p.mjs': { cibles: [], fichiers: ['notes/p.md', 'scripts/p.mjs'], dossiers: ['.github/workflows'] },
}

test('`seulement` restreint la mesure aux entrées de ses générateurs : une source d’un AUTRE ne fait pas régénérer', () => {
  assert.equal(touchesDocSources(['notes/p.md'], MESURE_DEUX), true)
  assert.equal(touchesDocSources(['notes/p.md'], MESURE_DEUX, { seulement: ['g/m.mjs'] }), false)
  assert.equal(touchesDocSources(['.github/workflows/ci.yml'], MESURE_DEUX, { seulement: ['g/m.mjs'] }), false)
  assert.equal(touchesDocSources(['src/m.ts'], MESURE_DEUX, { seulement: ['g/m.mjs'] }), true)
  assert.equal(touchesDocSources(['data/neuf.json'], MESURE_DEUX, { seulement: ['g/m.mjs'] }), true)
})

test('`seulement` : un membre SANS entrée dans la mesure fait régénérer (fermé par défaut)', () => {
  assert.equal(touchesDocSources(['public/x.svg'], MESURE_DEUX, { seulement: ['g/m.mjs', 'g/absent.mjs'] }), true)
})

test('`seulement` : un chemin hors de toute source du périmètre ne fait pas régénérer', () => {
  assert.equal(touchesDocSources(['public/x.svg'], MESURE_DEUX, { seulement: ['g/m.mjs'] }), false)
})

/** Les générateurs dont le rendu lit chaque classe jugée ci-dessous — mémoire, workflows, fiches de
 *  l'Atlas et `scripts/raw/`, `src/`, tsconfig —, les moins coûteux à mesurer. */
const MESURES = [
  'scripts/docs/build-doctrines.mjs', 'scripts/docs/build-reprise.mjs', 'scripts/raw/build-atlas-index.mjs',
  'scripts/docs/build-usages-jets.mjs', 'scripts/docs/build-donnees.mjs',
]

test('les classes que la liste de préfixes d’avant #1773 RATAIT sont vues sur la mesure RENDUE par les générateurs', () => {
  const rendues = mesurerEnRendu(MESURES, { cwd: RACINE })
  const mesure = tableTotale(MESURES, (script) => rendues.get(script).entree)
  for (const [script, { fichiers }] of Object.entries(mesure)) assert.ok(fichiers.length > 1, `${script} : mesure aveugle`)
  // `.claude/memory/user-*.md` alimente `docs/doctrines.md` : une fiche NEUVE compte (pathspec de
  // `git ls-files`), et `.github/workflows` est un dossier mesuré — deux classes hors des préfixes.
  assert.equal(touchesDocSources(['.claude/memory/user-x.md'], mesure), true)
  assert.equal(touchesDocSources(['.github/workflows/ci.yml'], mesure), true)
  assert.equal(touchesDocSources(['tsconfig.json'], mesure), true)
  // Ce qu'aucun générateur ne lit ne périme aucun dérivé, quel que soit son dossier.
  assert.equal(touchesDocSources(['README.md'], mesure), false)
  assert.equal(touchesDocSources(['public/galeries.html'], mesure), false)
  // Et les classes que la liste voyait déjà restent vues.
  assert.equal(touchesDocSources(['src/ui/Prose.tsx'], mesure), true)
  assert.equal(touchesDocSources(['scripts\\raw\\_lib.mjs'], mesure), true)
  assert.equal(touchesDocSources(['docs/raw/4e/combat.md'], mesure), true)
})

// #2603
test('frontière d’outillage : un module importé par un générateur entre dans sa mesure, sélection partielle ; un module préchargé périme tout', () => {
  const scripts = ['scripts/gen-formats.mjs', 'scripts/raw/build-catalogs.mjs']
  const generateurs = GENERATORS.filter((g) => scripts.includes(g.script))
  const rendues = mesurerEnRendu(scripts, { cwd: RACINE })
  const mesure = tableTotale(scripts, (script) => rendues.get(script).entree)
  assert.deepEqual(scripts.filter((script) => mesure[script].fichiers.includes('scripts/guards/lib/gitPorte.mjs')), ['scripts/raw/build-catalogs.mjs'])
  const lecteurs = selectionDesGenerateurs({ lot: ['scripts/guards/lib/gitPorte.mjs'], mesure, cwd: RACINE, generateurs })
  assert.deepEqual([lecteurs.complete, lecteurs.raison], [false, 'sources mesurées et préalables'])
  assert.ok(lecteurs.scripts.includes('scripts/raw/build-catalogs.mjs'), lecteurs.scripts.join(', '))
  assert.deepEqual(selectionDesGenerateurs({ lot: ['src/lib/ordre.mjs'], mesure, cwd: RACINE, generateurs }),
    { scripts, complete: true, raison: 'graphe ou outil de mesure modifié' })
})

test('FAIL-CLOSED : git INDISPONIBLE sur la lecture du lot, le lot est INCONNU (`null`, on régénère), jamais vide', () => {
  const { racine } = instanceDeDepot({ fichiers: { 'a.txt': 'a\n' } })
  const g = gitDe(racine)
  writeFileSync(join(racine, 'b.txt'), 'b\n'); g('add', 'b.txt'); g('commit', '-q', '-m', 'b')
  g('update-ref', 'ORIG_HEAD', 'HEAD~1')
  try {
    assert.deepEqual(touchedFiles(racine), ['b.txt'], 'témoin : git répond, le lot se lit')
    assert.equal(sousGitFeint([{ si: ['diff-tree'], status: 128, stderr: 'fatal: panne simulée\n' }], () => touchedFiles(racine)), null)
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

// #2327
test('post-merge pendant `merge --no-commit` : le lot est ce qu’emporte l’index, conflits et lockfile compris ; hors fusion, ORIG_HEAD..HEAD', () => {
  const { racine } = instanceDeDepot({ fichiers: {
    'commun.txt': 'base\n', 'notes/a.txt': 'a\n', 'docs/a.md': 'a\n', 'package-lock.json': '{}\n',
  } })
  const git = gitDe(racine, { net: true })
  const commit = (fichiers, message) => {
    for (const [f, contenu] of Object.entries(fichiers)) writeFileSync(join(racine, f), contenu)
    git('add', ...Object.keys(fichiers))
    git('commit', '-q', '-m', message)
  }
  const generateurs = [{ script: 'g/a.mjs', targets: ['docs/a.md'] }]
  const mesure = { 'g/a.mjs': { fichiers: ['notes/a.txt'], dossiers: [], cibles: ['docs/a.md'] } }
  try {
    git('switch', '-q', '-c', 'cote')
    commit({ 'commun.txt': 'cote\n', 'notes/a.txt': 'cote\n' }, 'cote')
    git('switch', '-q', '-c', 'lock', 'main')
    commit({ 'package-lock.json': '{"lock":true}\n' }, 'lock')
    git('switch', '-q', 'main')
    commit({ 'commun.txt': 'main\n' }, 'main')
    const avant = git('rev-parse', 'HEAD')
    const fusion = resultatDeGit(['merge', '--no-commit', '--no-ff', 'cote'], { cwd: racine })
    assert.equal(fusion.status, 1, `${fusion.stdout}${fusion.stderr}`)
    assert.deepEqual(touchedFiles(racine), [], 'ORIG_HEAD..HEAD est vide pendant la fusion')
    const lot = lotDuPostMerge(racine)
    assert.deepEqual(lot, ['commun.txt', 'notes/a.txt'], 'témoin : la source mesurée et le chemin en conflit')
    assert.deepEqual(selectionDesGenerateurs({ lot, mesure, cwd: racine, generateurs }), { scripts: ['g/a.mjs'], complete: false, raison: 'sources mesurées et préalables' })
    assert.equal(sousGitFeint([{ si: ['diff-index'], status: 128, stderr: 'fatal: panne simulée\n' }], () => lotDuPostMerge(racine)), null, 'panne git : lot inconnu')
    git('merge', '--abort')
    assert.equal(resultatDeGit(['merge', '--no-commit', '--no-ff', 'lock'], { cwd: racine }).status, 0)
    const npm = []
    const rendu = reconstruireApresGit({ cwd: racine, hook: 'post-merge', generateurs, annoncer: () => {},
      npm: (_cmd, args) => { npm.push(args.join(' ')); return { status: 0 } }, code: () => 0, demander: () => 1 })
    assert.deepEqual(rendu, { code: 0, seq: 1 })
    assert.deepEqual(npm, ['ci --no-audit --no-fund'], 'le lockfile apporté par la fusion en cours relance npm ci')
    git('commit', '-q', '-m', 'fusion lock')
    assert.deepEqual(lotDuPostMerge(racine), ['package-lock.json'], 'contre-témoin : hors fusion, ORIG_HEAD..HEAD')
    assert.deepEqual(lotDuPostMerge(racine), touchedFiles(racine))
    writeFileSync(join(racine, '.git', 'MERGE_HEAD'), `${git('rev-parse', 'lock')}\n`)
    assert.deepEqual(lotDuPostMerge(racine), ['package-lock.json'], 'contre-témoin : MERGE_HEAD que git garde pendant le hook d’une fusion commitée')
    assert.equal(git('rev-parse', 'ORIG_HEAD'), avant)
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

// #2327
test('post-merge après `merge --squash` (argument 1) : le lot est ce qu’emporte l’index ; argument 0 : ORIG_HEAD..HEAD', () => {
  const { racine } = instanceDeDepot({ fichiers: { 'notes/a.txt': 'a\n', 'docs/a.md': 'a\n', 'package-lock.json': '{}\n' } })
  const git = gitDe(racine, { net: true })
  const commit = (fichiers, message) => {
    for (const [f, contenu] of Object.entries(fichiers)) writeFileSync(join(racine, f), contenu)
    git('add', ...Object.keys(fichiers))
    git('commit', '-q', '-m', message)
  }
  const generateurs = [{ script: 'g/a.mjs', targets: ['docs/a.md'] }]
  const mesure = { 'g/a.mjs': { fichiers: ['notes/a.txt'], dossiers: [], cibles: ['docs/a.md'] } }
  const npm = []
  const posterieur = (avant) => reconstruireApresGit({ cwd: racine, hook: 'post-merge', avant, generateurs, annoncer: () => {},
    npm: (_cmd, args) => { npm.push(args.join(' ')); return { status: 0 } }, code: () => 0, demander: () => 1 }).code
  try {
    git('switch', '-q', '-c', 'cote')
    commit({ 'notes/a.txt': 'cote\n', 'package-lock.json': '{"cote":true}\n' }, 'cote')
    git('switch', '-q', '-c', 'normale', 'main')
    commit({ 'notes/b.txt': 'b\n' }, 'normale')
    git('switch', '-q', 'main')
    git('merge', '-q', '--squash', 'cote')
    assert.deepEqual(touchedFiles(racine), [], 'ORIG_HEAD..HEAD est vide après un squash')
    const lot = lotDuPostMerge(racine, { squash: true })
    assert.deepEqual(lot, ['notes/a.txt', 'package-lock.json'], 'témoin : l’apport du squash')
    assert.deepEqual(selectionDesGenerateurs({ lot: ['notes/a.txt'], mesure, cwd: racine, generateurs }).scripts, ['g/a.mjs'])
    assert.equal(posterieur('1'), 0)
    assert.deepEqual(npm, ['ci --no-audit --no-fund'], 'témoin : le lockfile du squash relance npm ci')
    git('commit', '-q', '-m', 'squash')
    npm.length = 0
    git('merge', '-q', '--no-ff', '-m', 'fusion', 'normale')
    assert.deepEqual(lotDuPostMerge(racine, { squash: false }), ['notes/b.txt'], 'contre-témoin : argument 0, ORIG_HEAD..HEAD')
    assert.equal(posterieur('0'), 0)
    assert.deepEqual(npm, [], 'contre-témoin : le lockfile de l’index d’avant ne compte plus')
    assert.deepEqual(lotDuPostMerge(racine, { squash: true }), [], 'l’index d’une fusion commitée n’emporte rien')
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('CÂBLAGE : chaque post-hook lance UN processus, docs-rebuild.mjs, avec son NOM ; post-checkout ses deux HEAD, post-merge son drapeau squash', () => {
  const lire = (hook) => readFileSync(join(RACINE, 'scripts', 'git-hooks', hook), 'utf8')
  assert.match(lire('post-checkout'), /docs-rebuild\.mjs" post-checkout "\$1" "\$2"/)
  assert.match(lire('post-merge'), /^exec "\$\{npm_node_execpath:-node\}" "\$\(dirname "\$0"\)\/docs-rebuild\.mjs" post-merge "\$1"$/m, 'post-merge rend le code de docs-rebuild tel quel')
  for (const hook of ['post-commit', 'post-merge', 'post-rewrite', 'post-checkout']) {
    const lancements = lire(hook).split('\n').filter((ligne) => !ligne.startsWith('#') && ligne.includes('npm_node_execpath'))
    assert.equal(lancements.length, 1, `${hook} : ${lancements.join(' | ')}`)
    assert.match(lancements[0], new RegExp(`/docs-rebuild\\.mjs" ${hook}( |$)`), hook)
  }
})
test('sélection mesurée ferme la chaîne de lecteurs et de préalables, sans doc frère général', () => {
  const doc = (nom) => ['docs', `${nom}.md`].join('/')
  const { racine } = instanceDeDepot({ fichiers: { [doc('a')]: 'a', [doc('b')]: 'b', [doc('c')]: 'c', 'src/code.gen.ts': 'code' } })
  const generateurs = [
    { script: 'g/code.mjs', targets: ['src/code.gen.ts'] },
    { script: 'g/a.mjs', targets: [doc('a')] },
    { script: 'g/b.mjs', targets: [doc('b')] },
    { script: 'g/c.mjs', targets: [doc('c')] },
  ]
  const mesure = {
    'g/code.mjs': { fichiers: ['data/code.json'], dossiers: [], cibles: [] },
    'g/a.mjs': { fichiers: ['notes/a.txt'], dossiers: ['notes'], cibles: [doc('a')] },
    'g/b.mjs': { fichiers: [doc('a'), 'lus/b.txt'], dossiers: [], cibles: [doc('b')] },
    'g/c.mjs': { fichiers: ['ailleurs/c.txt'], dossiers: [], cibles: [doc('c')] },
  }
  const selection = (lot, m = mesure) => selectionDesGenerateurs({ lot, mesure: m, cwd: racine, generateurs })
  try {
    assert.deepEqual(selection(['notes/a.txt']).scripts, ['g/a.mjs', 'g/b.mjs'])
    assert.deepEqual(selection(['notes/neuf/plus/bas.txt']).scripts, ['g/a.mjs', 'g/b.mjs'])
    assert.deepEqual(selection([doc('a')]).scripts, ['g/a.mjs', 'g/b.mjs'])
    assert.deepEqual(selection(['public/independent.svg']).scripts, [])
    const mixte = [{ ...generateurs[1], targets: [], injecte: [doc('a')] }, ...generateurs.filter((g) => g.script !== 'g/a.mjs')]
    assert.deepEqual(selection(['lus/b.txt']).scripts, ['g/b.mjs'], 'un lecteur retenu ne tire pas son producteur aux sources intactes')
    assert.deepEqual(selectionDesGenerateurs({ lot: ['notes/a.txt'], mesure, cwd: racine, generateurs: mixte }).scripts, ['g/a.mjs', 'g/b.mjs'],
      'un mixte retenu seul ne tire pas les générateurs de code')
    assert.deepEqual(selectionDesGenerateurs({ lot: ['data/code.json'], mesure, cwd: racine, generateurs: mixte }).scripts, ['g/a.mjs', 'g/code.mjs', 'g/b.mjs'],
      'témoin : un générateur de code retenu tire les mixtes (#2193)')
    assert.equal(selection(null).complete, true)
    assert.equal(selection(['notes/a.txt'], { 'g/a.mjs': mesure['g/a.mjs'] }).complete, true)
    assert.equal(selection(['scripts/docs/lib/enregistreur-lectures.mjs']).complete, true)
    rmSync(join(racine, doc('c')))
    assert.equal(selection(['notes/a.txt']).complete, true)
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('post-commit réel : fusion automatique unique, conflit résolu, amend lock/message et reflog inconnu', () => {
  const module = pathToFileURL(join(RACINE, 'scripts/git-hooks/docs-rebuild.mjs')).href
  const miroirs = pathToFileURL(join(RACINE, 'scripts/git-hooks/miroirs-d-agents.mjs')).href
  for (const conflit of [false, true]) {
    const { racine } = instanceDeDepot({ fichiers: {
      '.gitignore': 'hooks-fixture/\nnode_modules/\n', 'commun.txt': 'base\n', 'main.txt': 'base\n', 'package-lock.json': '{}\n',
    } })
    const git = gitDe(racine, { net: true })
    const journal = join(racine, '.git', 'journal-fixture')
    const lire = () => readFileSync(journal, 'utf8').trim().split('\n').filter(Boolean)
    const vider = () => writeFileSync(journal, '')
    const ecrireCommit = (fichier, contenu, message) => {
      writeFileSync(join(racine, fichier), contenu)
      git('add', fichier)
      git('commit', '-q', '-m', message)
    }
    const amender = (message) => {
      const vu = resultatDeGit(['commit', '--amend', '-m', message], { cwd: racine, env: { ...envDeDepotForge(), GIT_TRACE: '1' } })
      assert.equal(vu.status, 0, `${vu.stdout}${vu.stderr}`)
      assert.match(vu.stderr, /post-rewrite.*amend/)
      console.log(JSON.stringify({ banc2329: 'amend-trace', message, trace: vu.stderr.split('\n').filter((l) => /post-commit|post-rewrite/.test(l)) }))
    }
    try {
      git('switch', '-c', 'cote')
      ecrireCommit('commun.txt', 'cote\n', 'cote')
      ecrireCommit('package-lock.json', '{"cote":true}\n', 'lock cote')
      git('switch', 'main')
      ecrireCommit(conflit ? 'commun.txt' : 'main.txt', 'main\n', 'main')
      const ancien = git('rev-parse', 'HEAD')
      mkdirSync(join(racine, 'hooks-fixture'))
      for (const hook of ['post-merge', 'post-commit', 'post-rewrite']) writeFileSync(join(racine, 'hooks-fixture', hook), readFileSync(join(RACINE, 'scripts/git-hooks', hook)), { mode: 0o755 })
      const harnais = join(racine, 'hooks-fixture', 'docs-rebuild.mjs')
      writeFileSync(harnais, [
        `import { reconstruireApresGit } from ${JSON.stringify(module)}`,
        `import { jouerLesMiroirs } from ${JSON.stringify(miroirs)}`,
        "import { appendFileSync, readFileSync } from 'node:fs'",
        `const journal = ${JSON.stringify(journal)}`,
        "const hook = process.argv[2]",
        "appendFileSync(journal, hook + '\\n')",
        "await jouerLesMiroirs(hook)",
        `process.exitCode = reconstruireApresGit({cwd:${JSON.stringify(racine)}, hook, generateurs: [],`,
        "npm: (_cmd,args) => { appendFileSync(journal, 'npm:' + args.join(' ') + '\\n'); let status=0; try {status=Number(readFileSync('.git/npm-status','utf8'))} catch {} return {status} },",
        "code: () => { appendFileSync(journal,'code\\n'); return 0 }, demander: () => { appendFileSync(journal,'demande\\n'); return 1 } }).code",
      ].join('\n'))
      git('config', 'core.hooksPath', 'hooks-fixture')
      vider()
      const merge = resultatDeGit(['merge', '--no-ff', 'cote', '-m', 'fusion'], { cwd: racine })
      assert.equal(merge.status, conflit ? 1 : 0, `${merge.stdout}${merge.stderr}`)
      assert.deepEqual(merge.stderr.split(/\r?\n/).filter((l) => l && (!l.startsWith('[post-') || /NON produit|édité à la main/.test(l))), [], 'toute ligne de stderr est celle d’un post-hook, et aucune n’est un échec des miroirs')
      if (conflit) {
        assert.deepEqual(lire(), [])
        ecrireCommit('commun.txt', 'resolu\n', 'fusion manuelle')
      }
      assert.deepEqual(lire(), [conflit ? 'post-commit' : 'post-merge', 'npm:ci --no-audit --no-fund'])
      assert.deepEqual(touchedFiles(racine, { de: ancien, a: git('rev-parse', 'HEAD') }).includes('package-lock.json'), true)
      vider()
      const arbre = git('rev-parse', 'HEAD^{tree}')
      amender('message seul')
      assert.equal(git('rev-parse', 'HEAD^{tree}'), arbre)
      assert.deepEqual(lire(), ['post-commit'])
      vider()
      writeFileSync(join(racine, 'package-lock.json'), '{"amend":true}\n')
      git('add', 'package-lock.json')
      amender('lock amende')
      assert.deepEqual(lire(), ['post-commit', 'npm:ci --no-audit --no-fund'])
      for (const panne of ['absent', 'reflog', 'parents']) {
        vider()
        writeFileSync(join(racine, '.git', 'npm-status'), '1')
        if (panne === 'absent') rmSync(join(racine, '.git', 'logs', 'HEAD'))
        const vu = spawnSync(process.execPath, [harnais, 'post-commit'], {
          cwd: racine, encoding: 'utf8', env: { ...process.env, ...(panne !== 'absent' ? envGitFeint([{ si: panne === 'reflog' ? ['reflog'] : ['rev-parse', 'HEAD^@'], status: 128, stderr: `fatal: panne ${panne}` }]) : {}) },
        })
        assert.equal(vu.status, 1, vu.stderr)
        assert.match(vu.stderr, /plage Git inconnue/)
        assert.match(vu.stderr, /fusion effectuée, équipement incomplet.*npm ci/)
        if (panne !== 'absent') assert.match(vu.stderr, new RegExp(`lecture Git indisponible.*panne ${panne}`))
        assert.deepEqual(lire(), ['post-commit', 'npm:ci --no-audit --no-fund'])
      }
      vider()
      ecrireCommit('package-lock.json', '{"ordinaire":true}\n', 'commit ordinaire lock')
      assert.deepEqual(lire(), ['post-commit'])
      console.log(JSON.stringify({ banc2329: 'post-commit-hooks-reels', conflit, ancien, nouveau: git('rev-parse', 'HEAD'), ordinaireSansEquipement: lire() }))
    } finally { rmSync(racine, { recursive: true, force: true }) }
  }
})
function fusionReelle(fichiersAvant, fichiersApres) {
  const { racine } = instanceDeDepot({ fichiers: { '.gitignore': 'node_modules/\n', ...fichiersAvant } })
  const git = gitDe(racine)
  const origine = git('rev-parse', 'HEAD').trim()
  for (const [nom, contenu] of Object.entries(fichiersApres)) {
    mkdirSync(join(racine, nom, '..'), { recursive: true })
    writeFileSync(join(racine, nom), contenu)
  }
  git('add', ...Object.keys(fichiersApres))
  git('commit', '-q', '-m', 'main change')
  const nouveau = git('rev-parse', 'HEAD').trim()
  git('update-ref', 'refs/heads/main-modifie', nouveau)
  git('update-ref', 'HEAD', origine)
  for (const [nom, contenu] of Object.entries(fichiersAvant)) writeFileSync(join(racine, nom), contenu)
  git('read-tree', origine)
  git('merge', '--ff-only', 'main-modifie')
  return { racine, lot: touchedFiles(racine) }
}

test('fusion Git réelle : lockfile modifié → npm ci réel rouge nommé, aucune génération', () => {
  const paquet = JSON.stringify({ name: 'banc2329', version: '1.0.0', private: true, dependencies: { introuvable: 'file:./absent' } })
  const lock = JSON.stringify({ name: 'banc2329', version: '1.0.0', lockfileVersion: 3, packages: { '': { name: 'banc2329', version: '1.0.0' } } })
  const { racine, lot } = fusionReelle({ 'package.json': paquet, 'package-lock.json': lock }, { 'package-lock.json': `${lock}\n` })
  let generations = 0
  const sorties = []
  try {
    assert.deepEqual(lot, ['package-lock.json'])
    const vu = reconstruireApresGit({ cwd: racine, hook: 'post-merge', annoncer: (texte) => sorties.push(texte),
      code: () => { generations++; return 0 }, demander: () => { generations++; return 1 },
      npm: (cmd, args, opts) => {
        assert.match(sorties.at(-1), /npm ci — début/)
        return spawnSync(cmd, args, { ...opts, stdio: 'pipe', encoding: 'utf8' })
      },
    })
    assert.deepEqual(vu, { code: 1, seq: null })
    assert.equal(generations, 0)
    assert.match(sorties.join(''), /équipement incomplet : relancer `npm ci`/)
    assert.match(sorties.join(''), /npm ci — fin \(\d+ ms\)/)
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

/** Les modules qu'un point d'entrée d'outil charge avant ses gardes : la barrière, le verrou, la porte. */
const CHAINE_DE_LA_BARRIERE = ['scripts/hooks/repartiteur.mjs', 'scripts/hooks/barriere-outil.mjs', 'scripts/test/verrou.mjs', 'scripts/guards/lib/pid.mjs', 'scripts/guards/lib/spawnResilient.mjs', 'scripts/node-requis.mjs']

test('#2187 matrice 16 : `package-lock` changé — un hook d’outil lancé pendant le `npm ci` sort en 2, jamais en 1', () => {
  const lock = JSON.stringify({ name: 'banc2187', version: '1.0.0', lockfileVersion: 3, packages: { '': { name: 'banc2187', version: '1.0.0' } } })
  const { racine, lot } = fusionReelle({ 'package-lock.json': lock }, { 'package-lock.json': `${lock}\n` })
  for (const module of CHAINE_DE_LA_BARRIERE) {
    mkdirSync(dirname(join(racine, module)), { recursive: true })
    copyFileSync(join(RACINE, module), join(racine, module))
  }
  const hookDOutil = () => spawnSync(process.execPath, [join(racine, 'scripts', 'hooks', 'repartiteur.mjs')], {
    cwd: racine, encoding: 'utf8', timeout: 30_000,
    input: JSON.stringify({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'ls' } }),
  })
  const pendant = []
  try {
    assert.deepEqual(lot, ['package-lock.json'])
    const vu = reconstruireApresGit({ cwd: racine, hook: 'post-merge', annoncer: () => {}, code: () => 0, demander: () => 1,
      npm: () => {
        pendant.push(hookDOutil())
        return { status: 0 }
      },
    })
    assert.deepEqual(vu, { code: 0, seq: 1 })
    assert.equal(pendant.length, 1, 'un seul npm ci')
    assert.equal(pendant[0].status, 2, pendant[0].stderr)
    assert.match(pendant[0].stderr, /outillage de .* en mise à jour : verrou .*outillage\.verrou tenu par le PID \d+ \(docs-rebuild post-merge\)/)
    const apres = hookDOutil()
    assert.equal(apres.status, 2, `node_modules absent, verrou libre : ${apres.stderr}`)
    assert.match(apres.stderr, /chargement des gardes impossible/)
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('fusion server seule : `npm ci` server, cibles de CODE, puis la demande ; lot sans lockfile : code puis demande ; code rouge : aucune demande', () => {
  for (const server of [true, false]) {
    const avant = server ? { 'server/package-lock.json': '{}', 'package-lock.json': '{}' } : { 'a.txt': 'a' }
    const apres = server ? { 'server/package-lock.json': '{}\n' } : { 'a.txt': 'b' }
    const { racine } = fusionReelle(avant, apres)
    const gestes = []
    const options = { cwd: racine, hook: 'post-merge', annoncer: () => {},
      npm: (_cmd, args) => { gestes.push(args.join(' ')); return { status: 0 } },
      demander: () => { gestes.push('demande'); return 7 },
    }
    try {
      assert.deepEqual(reconstruireApresGit({ ...options, code: () => { gestes.push('code'); return 0 } }), { code: 0, seq: 7 })
      assert.deepEqual(gestes, server ? ['--prefix server ci --no-audit --no-fund', 'code', 'demande'] : ['code', 'demande'])
      gestes.length = 0
      assert.deepEqual(reconstruireApresGit({ ...options, code: () => { gestes.push('code'); return 1 } }), { code: 1, seq: null })
      assert.deepEqual(gestes, server ? ['--prefix server ci --no-audit --no-fund', 'code'] : ['code'])
    } finally {
      rmSync(racine, { recursive: true, force: true })
    }
  }
})

test('#2603 — le hook DEMANDE la passe sans la jouer : demande inscrite, un détaché `--servir` lancé, attestation laissée périmée', () => {
  const { racine } = fusionReelle({ 'a.txt': 'a' }, { 'a.txt': 'b' })
  const lances = []
  const sorties = []
  try {
    const vu = reconstruireApresGit({ cwd: racine, hook: 'post-merge', annoncer: (texte) => sorties.push(texte), code: () => 0,
      npm: () => assert.fail('aucun lockfile au lot'),
      demander: (cwd) => demanderLaReconstruction(cwd, { detacher: (opts) => { lances.push(opts); return 4242 } }),
    })
    assert.deepEqual(vu, { code: 0, seq: 1 })
    assert.deepEqual(lances, [{ script: join(RACINE, 'scripts', 'git-hooks', 'reconstruction.mjs'), args: ['--servir'], cwd: racine, fdLog: 'ignore' }])
    assert.equal(demandesDe(racine), 1)
    assert.match(sorties.join(''), /reconstruction en fond, demande 1/)
    assert.equal(preuveValide(racine, { generateurs: GENERATORS, ciblesSurDisque, sourcesLues: SOURCES_LUES }).ok, false)
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('racine installée : postinstall suffit pour le code ; ORIG_HEAD inconnu et lockfile retiré sont annoncés', () => {
  const { racine } = fusionReelle({ 'package-lock.json': '{}' }, { 'package-lock.json': '{}\n' })
  const sorties = []
  let code = 0
  const demander = () => assert.fail('aucune demande')
  try {
    assert.deepEqual(reconstruireApresGit({ cwd: racine, hook: 'post-merge', generateurs: [], annoncer: (texte) => sorties.push(texte),
      npm: () => ({ status: 0 }), code: () => { code++; return 0 }, demander,
    }), { code: 0, seq: null })
    assert.equal(code, 0)
    const git = gitDe(racine)
    git('update-ref', '-d', 'ORIG_HEAD')
    assert.deepEqual(reconstruireApresGit({ cwd: racine, hook: 'post-merge', annoncer: (texte) => sorties.push(texte), npm: () => ({ status: 1 }), code: () => { code++; return 0 }, demander }), { code: 1, seq: null })
    assert.match(sorties.join(''), /plage Git inconnue/)
    git('update-ref', 'ORIG_HEAD', 'HEAD~1')
    rmSync(join(racine, 'package-lock.json'))
    assert.deepEqual(reconstruireApresGit({ cwd: racine, hook: 'post-merge', annoncer: (texte) => sorties.push(texte), code: () => { code++; return 0 }, demander }), { code: 1, seq: null })
    assert.match(sorties.join(''), /lockfile package-lock.json absent/)
    assert.equal(code, 0)
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('checkout neuf : ancien SHA nul et cache absent seuls dispensent de répéter l’équipement', () => {
  const { racine } = instanceDeDepot({ fichiers: { 'package-lock.json': '{}' } })
  const sorties = []
  const gestes = []
  const options = { cwd: racine, hook: 'post-checkout', apres: 'a'.repeat(40), annoncer: (texte) => sorties.push(texte),
    npm: () => { gestes.push('npm'); return { status: 1 } }, code: () => { gestes.push('code'); return 0 }, demander: () => { gestes.push('demande'); return 1 },
  }
  try {
    assert.deepEqual(reconstruireApresGit({ ...options, avant: '0'.repeat(40) }), { code: 0, seq: null })
    assert.deepEqual(gestes, [])
    assert.match(sorties.join(''), /worktree neuf.*npm ci.*npm --prefix server ci.*docs:build/)
    for (const avant of ['inconnu', 'b'.repeat(40)]) {
      gestes.length = 0
      assert.deepEqual(reconstruireApresGit({ ...options, avant }), { code: 1, seq: null })
      assert.deepEqual(gestes, ['npm'])
    }
    mkdirSync(join(racine, 'docs'))
    writeFileSync(join(racine, 'docs/.sources-lues.json'), '{}')
    gestes.length = 0
    assert.deepEqual(reconstruireApresGit({ ...options, avant: '0'.repeat(40) }), { code: 1, seq: null })
    assert.deepEqual(gestes, ['npm'])
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

/** La demande d'un hook SANS détaché : le banc sert lui-même la passe (`servirAvec`). */
const demanderSansDetache = (cwd) => demanderLaReconstruction(cwd, { detacher: () => process.pid })

/** Les demandes de `racine` servies dans ce processus, la passe jugée sur `generateurs` et construite par
 *  `construire` ; ce qu'elle écrit au journal part aussi dans `annonces`. REND le nombre de passes. */
const servirAvec = (racine, { generateurs, construire, annonces = [] }) => servirLesDemandes({
  racine,
  passe: (p) => passeDesDerives({ ...p, generateurs, construire, ecrire: (texte) => { annonces.push(texte); p.ecrire(texte) } }),
})

test('checkout existant sans mesure : la passe servie génère et atteste, la suivante est silencieuse', () => {
  const primitive = pathToFileURL(join(RACINE, 'scripts/docs/lib/ecriture-derives.mjs')).href
  const cible = ['docs', 'checkout.md'].join('/')
  const generateurs = [{ runner: 'node', script: 'g/checkout.mjs', targets: [cible] }]
  const { racine } = instanceDeDepot({ fichiers: {
    '.gitignore': 'docs/\n.wt-checkout/\n',
    'source.txt': 'source réelle',
    'g/checkout.mjs': `import { readFileSync } from 'node:fs'\nimport { ecrireOuVerifier } from ${JSON.stringify(primitive)}\necrireOuVerifier({out: readFileSync('source.txt', 'utf8'), path: ${JSON.stringify(cible)}, check: process.argv.includes('--check'), staleMsg: 'périmé', rerunMsg: 'relancer'})\n`,
  } })
  const git = gitDe(racine)
  const worktree = join(racine, '.wt-checkout')
  const head = git('rev-parse', 'HEAD').trim()
  git('worktree', 'add', '-q', '-b', 'chantier/checkout', worktree, 'HEAD')
  mkdirSync(join(worktree, 'docs'))
  const appels = []
  const construire = (cwd) => {
    appels.push(cwd)
    return executer({ cwd, argv: ['--quiet', '--perimes'], generateurs, verificateurs: [] })
  }
  const options = { cwd: worktree, hook: 'post-checkout', avant: head, apres: head, generateurs,
    annoncer: () => {}, npm: () => assert.fail('aucun équipement'), code: () => assert.fail('aucune cible de code'), demander: demanderSansDetache,
  }
  try {
    assert.deepEqual(reconstruireApresGit(options), { code: 0, seq: 1 })
    assert.deepEqual(appels, [], 'le hook ne joue pas la passe')
    assert.equal(servirAvec(worktree, { generateurs, construire }), 1)
    assert.deepEqual(appels, [worktree])
    assert.equal(readFileSync(join(worktree, cible), 'utf8'), 'source réelle')
    assert.equal(preuveValide(worktree, { generateurs, ciblesSurDisque, sourcesLues: SOURCES_LUES }).ok, true)
    assert.deepEqual(reconstruireApresGit(options), { code: 0, seq: 2 })
    assert.equal(servirAvec(worktree, { generateurs, construire }), 1)
    assert.equal(appels.length, 1)
    assert.deepEqual(attendreLaReconstruction(worktree, 2, { echeanceMs: 0 }).code, 0)
  } finally { rmSync(racine, { recursive: true, force: true }) }
})

test('profil du hook après fusion : chaîne réelle 2/4 générateurs en fond, CODE synchrone si et seulement si la sélection le contient', () => {
  const primitive = pathToFileURL(join(RACINE, 'scripts/docs/lib/ecriture-derives.mjs')).href
  const module = pathToFileURL(join(RACINE, 'scripts/docs/build-all.mjs')).href
  const doc = (nom) => ['docs', `${nom}.md`].join('/')
  const noms = ['code', 'a', 'b', 'c']
  const cible = (nom) => nom === 'code' ? 'src/code.gen.ts' : doc(nom)
  const generateurs = noms.map((nom) => ({ runner: 'node', script: `g/${nom}.mjs`, targets: [cible(nom)] }))
  const source = (nom) => nom === 'b' ? doc('a') : nom === 'a' ? 'scripts/docs/lib/source-a.txt' : `notes/${nom}/source.txt`
  const generateur = (nom) => [
    "import { appendFileSync, readFileSync } from 'node:fs'",
    `import { ecrireOuVerifier } from ${JSON.stringify(primitive)}`,
    `const texte = readFileSync(${JSON.stringify(source(nom))}, 'utf8') + readFileSync('commun.txt', 'utf8')`,
    nom === 'code' ? "const resultat = texte + readFileSync('node_modules/dependency-value.txt', 'utf8')" :
      nom === 'c' ? "const resultat = texte + readFileSync('src/code.gen.ts', 'utf8')" : 'const resultat = texte',
    nom === 'code' ? "appendFileSync('node_modules/code-journal.txt', process.argv.includes('--check') ? 'verification\\n' : 'ecriture\\n')" : '',
    `ecrireOuVerifier({ out: resultat, path: ${JSON.stringify(cible(nom))}, check: process.argv.includes('--check'), staleMsg: 'périmé', rerunMsg: 'relancer' })`,
  ].join('\n')
  const { racine } = instanceDeDepot({ fichiers: {
    '.gitignore': 'node_modules/\n', 'commun.txt': 'commun',
    'scripts/docs/lib/source-a.txt': 'a', 'notes/c/source.txt': 'c', 'notes/code/source.txt': 'code',
    ...Object.fromEntries(noms.map((nom) => [`g/${nom}.mjs`, generateur(nom)])),
  } })
  const git = gitDe(racine)
  mkdirSync(join(racine, 'docs'))
  mkdirSync(join(racine, 'src'))
  mkdirSync(join(racine, 'node_modules'))
  writeFileSync(join(racine, 'node_modules/dependency-value.txt'), 'DEPENDANCE1')
  const harnais = join(racine, 'node_modules/banc2329.mjs')
  writeFileSync(harnais, `import { executer } from ${JSON.stringify(module)}\nprocess.exitCode = await executer({ cwd: ${JSON.stringify(racine)}, argv: ['--quiet', ...process.argv.slice(2)], generateurs: ${JSON.stringify(generateurs)}, verificateurs: [] })\n`)
  const jouer = (args = []) => {
    const debut = performance.now()
    const vu = spawnSync(process.execPath, [harnais, ...args], { cwd: racine, encoding: 'utf8' })
    assert.equal(vu.status, 0, `${vu.stdout}${vu.stderr}`)
    return { ms: Math.round(performance.now() - debut), compte: (vu.stderr.match(/— début/g) ?? []).length }
  }
  const hook = (nom, injections) => reconstruireApresGit({ cwd: racine, hook: nom, generateurs, annoncer: () => {}, demander: demanderSansDetache, ...injections })
  const servir = (construire, annonces = []) => servirAvec(racine, { generateurs, construire, annonces })
  const codeDuBanc = (cwd) => genererCode({ cwd, generateurs, quiet: true })
  try {
    const complet = jouer()
    git('add', 'docs', 'notes', 'scripts', 'g', 'src', 'commun.txt', '.gitignore')
    git('commit', '-q', '-m', 'mesure initiale')
    const origine = git('rev-parse', 'HEAD').trim()
    writeFileSync(join(racine, source('a')), 'a modifié')
    git('add', source('a'))
    git('commit', '-q', '-m', 'main modifie source a')
    git('update-ref', 'refs/heads/main-modifie', 'HEAD')
    git('update-ref', 'HEAD', origine)
    writeFileSync(join(racine, source('a')), 'a')
    git('read-tree', origine)
    git('merge', '--no-ff', '-m', 'fusion lib docs', 'main-modifie')
    const independant = readFileSync(join(racine, doc('c')), 'utf8')
    const codeAvant = statSync(join(racine, cible('code'))).mtimeMs
    const journal = readFileSync(join(racine, 'node_modules/code-journal.txt'), 'utf8')
    const annonces = []
    let partiel
    assert.equal(hook('post-merge', { code: () => assert.fail('aucune source de code au lot') }).code, 0)
    assert.equal(servir(() => { partiel = jouer(['--perimes']); return 0 }, annonces), 1)
    assert.deepEqual([complet.compte, partiel.compte], [4, 2])
    assert.equal(statSync(join(racine, cible('code'))).mtimeMs, codeAvant)
    assert.equal(readFileSync(join(racine, 'node_modules/code-journal.txt'), 'utf8'), journal)
    assert.equal(readFileSync(join(racine, doc('c')), 'utf8'), independant)
    assert.match(readFileSync(join(racine, doc('b')), 'utf8'), /a modifié/)
    assert.match(annonces.join(''), /attestation périmée.*g\/a\.mjs.*sources différentes/)
    assert.equal(hook('post-commit', { code: () => assert.fail('fusion déjà attestée') }).code, 0)
    servir(() => assert.fail('fusion déjà attestée'))
    for (const nonPertinent of [false, true]) {
      git('update-ref', 'ORIG_HEAD', 'HEAD')
      if (nonPertinent) {
        mkdirSync(join(racine, 'public'))
        writeFileSync(join(racine, 'public/independant.svg'), '<svg/>')
        git('add', 'public/independant.svg')
        git('commit', '-q', '-m', 'source non pertinente')
      }
      const gestes = []
      assert.equal(hook('post-merge', { npm: () => { gestes.push('npm') }, code: () => { gestes.push('code') } }).code, 0)
      assert.deepEqual(gestes, [])
      servir(() => assert.fail('source non pertinente'))
    }
    git('update-ref', 'ORIG_HEAD', 'HEAD')
    assert.equal(hook('post-commit', { npm: () => assert.fail('équipement ordinaire'), code: () => assert.fail('commit ordinaire') }).code, 0)
    servir(() => assert.fail('attestation ordinaire fraîche'))
    writeFileSync(join(racine, source('c')), 'c hors lot')
    let horsLot
    assert.equal(hook('post-commit', { npm: () => assert.fail('équipement ordinaire périmé'), code: () => assert.fail('source hors lot') }).code, 0)
    servir(() => { horsLot = jouer(['--perimes']); return 0 })
    assert.equal(horsLot.compte, 1)
    assert.match(readFileSync(join(racine, doc('c')), 'utf8'), /c hors lot/)
    writeFileSync(join(racine, 'notes/code/source.txt'), 'code modifié')
    git('add', 'notes/code/source.txt')
    git('commit', '-q', '-m', 'source code')
    git('update-ref', 'ORIG_HEAD', 'HEAD~1')
    const ordre = []
    assert.equal(hook('post-merge', { code: (cwd) => { ordre.push('code'); return codeDuBanc(cwd) } }).code, 0)
    assert.match(readFileSync(join(racine, cible('code')), 'utf8'), /code modifié/, 'le hook rend la main la cible de CODE écrite')
    assert.match(readFileSync(join(racine, 'node_modules/code-journal.txt'), 'utf8'), new RegExp(`^${journal}ecriture\n`))
    servir(() => { ordre.push('passe'); jouer(['--perimes']); return 0 })
    assert.deepEqual(ordre, ['code', 'passe'])
    writeFileSync(join(racine, 'package-lock.json'), '{}')
    git('add', 'package-lock.json')
    git('commit', '-q', '-m', 'lockfile toolchain')
    git('update-ref', 'ORIG_HEAD', 'HEAD~1')
    const annoncesLock = []
    assert.equal(hook('post-merge', {
      npm: () => {
        writeFileSync(join(racine, 'node_modules/dependency-value.txt'), 'DEPENDANCE2')
        return { status: codeDuBanc(racine) }
      },
      code: () => { throw new Error('postinstall ne doit pas être doublé') },
    }).code, 0)
    servir(() => { jouer(['--perimes']); return 0 }, annoncesLock)
    assert.match(readFileSync(join(racine, doc('c')), 'utf8'), /DEPENDANCE2/)
    assert.match(annoncesLock.join(''), /attestation périmée/)
    git('update-ref', 'ORIG_HEAD', 'HEAD')
    rmSync(join(racine, cible('code')))
    assert.equal(hook('post-merge', { code: codeDuBanc }).code, 0)
    assert.match(readFileSync(join(racine, cible('code')), 'utf8'), /code modifié/, 'cible absente : la sélection est complète, le CODE est synchrone')
    servir(() => { jouer(['--perimes']); return 0 })
    console.log(JSON.stringify({ banc2329: 'hook-fusion-source', avant: complet, apres: partiel, sorties: annonces }))
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

/** Un dépôt jetable, sa reconstruction vierge. */
const depotDeReconstruction = () => instanceDeDepot({ fichiers: { 'a.txt': 'a\n' } }).racine

/** L'état de la reconstruction de `racine`, lu sur disque. */
const etatDe = (racine) => JSON.parse(readFileSync(cheminsDeLaReconstruction(racine).etat, 'utf8'))

/** L'attente de tenant des bancs qui injectent `dormir` : une prise attend au plus 1 s, au lieu de l'échéance de `ATTENTE_DU_TENANT`. */
const ATTENTE_DU_TENANT_DU_BANC = Object.freeze({ ...ATTENTE_DU_TENANT, echeanceMs: 1_000, pasMs: 10 })

/** L'identité d'un pid factice : né à l'epoch, donc jamais postérieur à sa `date` d'inscription. */
const IDENTITE_DU_BANC = Object.freeze({ lireCreation: () => 0, toleranceMs: 0 })

// #2603
test('(b) coalescence : 3 demandes pendant une passe donnent 2 passes, et `soldees === demandes`', () => {
  const racine = depotDeReconstruction()
  let lances = 0
  const demander = () => demanderLaReconstruction(racine, { detacher: () => { lances++; return process.pid } })
  const cibles = []
  try {
    demander()
    const passes = servirLesDemandes({ racine, passe: () => {
      cibles.push(demandesDe(racine))
      if (cibles.length === 1) for (let i = 0; i < 3; i++) demander()
      return 0
    } })
    assert.equal(passes, 2)
    assert.deepEqual(cibles, [1, 4])
    const etat = etatDe(racine)
    assert.deepEqual([etat.demandes, etat.soldees, etat.dernier.seq, etat.dernier.code], [4, 4, 4, 0])
    assert.equal(lances, 4, 'chaque demande lance un détaché')
    assert.deepEqual(etat.lances, [], 'le servant se retire de `lances` en sortant')
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

// #2603
test('F2 : une passe en `CODE_SOURCE_MODIFIEE` puis 0 se solde à 0, en deux passes', () => {
  const racine = depotDeReconstruction()
  const codes = [CODE_SOURCE_MODIFIEE, 0]
  try {
    demanderLaReconstruction(racine, { detacher: () => process.pid })
    assert.equal(servirLesDemandes({ racine, passe: () => codes.shift() }), 2)
    const etat = etatDe(racine)
    assert.deepEqual([etat.demandes, etat.soldees, etat.dernier.seq, etat.dernier.code], [1, 1, 1, 0])
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

// #2603
test('F2 : une source modifiée à chaque passe se solde, à la borne, de `CODE_SOURCE_MODIFIEE`', () => {
  const racine = depotDeReconstruction()
  try {
    demanderLaReconstruction(racine, { detacher: () => process.pid })
    assert.equal(servirLesDemandes({ racine, passe: () => CODE_SOURCE_MODIFIEE }), REJEUX_SUR_SOURCE_MODIFIEE + 1)
    const etat = etatDe(racine)
    assert.deepEqual([etat.demandes, etat.soldees, etat.dernier.seq, etat.dernier.code], [1, 1, 1, CODE_SOURCE_MODIFIEE])
    assert.notEqual(CODE_SOURCE_MODIFIEE, CODE_DIFFERE)
    assert.notEqual(CODE_SOURCE_MODIFIEE, 1)
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

// #2603
test('(c) réveil : une demande faite pendant qu’un tenant vit encore lance quand même un détaché, qui la sert après lui', async () => {
  const racine = depotDeReconstruction()
  const chemins = cheminsDeLaReconstruction(racine)
  mkdirSync(chemins.logs, { recursive: true })
  const pris = join(racine, '.git', 'tenant-pris')
  const liberer = join(racine, '.git', 'tenant-libere')
  const verrou = pathToFileURL(join(RACINE, 'scripts/test/verrou.mjs')).href
  const tenant = spawn(process.execPath, ['--input-type=module', '-e', [
    `import { prendreVerrou } from ${JSON.stringify(verrou)}`,
    "import { existsSync, writeFileSync } from 'node:fs'",
    `const prise = prendreVerrou({ chemin: ${JSON.stringify(chemins.verrou)}, libelle: 'tenant du banc', commande: 'banc', cwd: ${JSON.stringify(racine)} })`,
    `writeFileSync(${JSON.stringify(pris)}, prise.etat)`,
    'const fin = Date.now() + 30_000',
    `while (!existsSync(${JSON.stringify(liberer)}) && Date.now() < fin) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 20)`,
    'prise.liberer()',
  ].join('\n')], { stdio: 'ignore' })
  const sortie = once(tenant, 'exit')
  try {
    const fin = Date.now() + 30_000
    while (!existsSync(pris) && Date.now() < fin) attendreSync(20)
    assert.equal(readFileSync(pris, 'utf8'), 'pris')
    const lances = []
    assert.equal(demanderLaReconstruction(racine, { detacher: (opts) => { lances.push(opts.args); return process.pid } }), 1)
    assert.deepEqual(lances, [['--servir']], 'un tenant vivant ne dispense pas de lancer')
    writeFileSync(liberer, '')
    assert.equal(servirLesDemandes({ racine, passe: () => 0 }), 1)
    assert.deepEqual([etatDe(racine).demandes, etatDe(racine).soldees], [1, 1])
  } finally {
    writeFileSync(liberer, '')
    await sortie
    rmSync(racine, { recursive: true, force: true })
  }
})

// #2603
test('(e) fenêtre de lancement : le hook a rendu la main, le détaché n’a pas encore pris son verrou — l’attente le voit EN COURS', () => {
  const racine = depotDeReconstruction()
  const vivants = new Set([4242])
  const estVivant = (pid) => vivants.has(pid)
  try {
    assert.equal(demanderLaReconstruction(racine, { detacher: () => 4242 }), 1)
    assert.deepEqual(attendreLaReconstruction(racine, 1, { echeanceMs: 50, pasMs: 10, estVivant, identite: IDENTITE_DU_BANC }), { etat: 'en-cours' })
    assert.equal(servirLesDemandes({ racine, passe: () => 0, estVivant, identite: IDENTITE_DU_BANC }), 1)
    const passe = attendreLaReconstruction(racine, 1, { echeanceMs: 0, estVivant, identite: IDENTITE_DU_BANC })
    assert.deepEqual([passe.etat, passe.seq, passe.code], ['soldee', 1, 0])
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

// #2603
test('(f) mort sans verdict : ni tenant ni lancé vivant, demande non soldée — code nommé, journal du dernier lancé', () => {
  const racine = depotDeReconstruction()
  try {
    demanderLaReconstruction(racine, { detacher: () => 4243 })
    const vu = attendreLaReconstruction(racine, 1, { echeanceMs: 500, pasMs: 10, estVivant: () => false })
    assert.deepEqual(vu, { etat: 'mort', code: CODE_MORT_SANS_VERDICT, log: join(cheminsDeLaReconstruction(racine).logs, '4243.log') })
    assert.equal(codeDeLaPasse(vu), CODE_MORT_SANS_VERDICT)
    assert.equal(codeDeLaPasse({ etat: 'en-cours' }), CODE_DIFFERE)
    assert.equal(codeDeLaPasse({ etat: 'soldee', code: 3 }), 3)
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

// #2603
test('pid réutilisé : un lancé vivant né APRÈS sa `date` d’inscription est mort — verdict immédiat, sous la tolérance en cours, mesure indéterminée vivante', () => {
  const racine = depotDeReconstruction()
  const sommeils = []
  const horloge = () => Date.parse('2026-10-16T10:00:00.000Z')
  try {
    demanderLaReconstruction(racine, { detacher: () => 4246, horloge })
    const date = Date.parse(etatDe(racine).lances[0].date)
    const attendre = (lireCreation) => attendreLaReconstruction(racine, 1, {
      echeanceMs: 60_000, pasMs: 10, dormir: () => sommeils.push('dormi'), estVivant: (pid) => pid === 4246,
      identite: { lireCreation, toleranceMs: 1_000 },
    })
    assert.deepEqual(attendre(() => date + 1_001), { etat: 'mort', code: CODE_MORT_SANS_VERDICT, log: join(cheminsDeLaReconstruction(racine).logs, '4246.log') })
    assert.deepEqual(sommeils, [], 'verdict immédiat, sans attendre l’échéance')
    let tours = 0
    const enCours = (lireCreation) => attendreLaReconstruction(racine, 1, {
      echeanceMs: 30, pasMs: 10, horloge: () => tours * 10, dormir: () => { tours += 1 }, estVivant: (pid) => pid === 4246,
      identite: { lireCreation, toleranceMs: 1_000 },
    })
    assert.deepEqual(enCours(() => date + 1_000), { etat: 'en-cours' })
    tours = 0
    assert.deepEqual(enCours(() => null), { etat: 'en-cours' })
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

// #2603
test('pid réutilisé : un verrou de reconstruction tenu par un pid vivant né après sa `creation` est libre — verdict mort ; sous la tolérance, en cours', () => {
  const racine = depotDeReconstruction()
  const chemins = cheminsDeLaReconstruction(racine)
  try {
    demanderLaReconstruction(racine, { detacher: () => 4249 })
    writeFileSync(chemins.verrou, JSON.stringify({ pid: 4250, creation: 1_000_000, date: new Date().toISOString() }))
    const attendre = (creation) => attendreLaReconstruction(racine, 1, {
      echeanceMs: 0, estVivant: (pid) => pid === 4250, identite: { lireCreation: () => creation, toleranceMs: 1_000 },
    })
    assert.equal(attendre(1_001_001).etat, 'mort')
    assert.equal(attendre(1_001_000).etat, 'en-cours')
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

// #2603
test('pid réutilisé : le servant retire de `lances` le lancé vivant né après sa `date`, garde celui sous la tolérance', () => {
  const racine = depotDeReconstruction()
  try {
    demanderLaReconstruction(racine, { detacher: () => 4247 })
    demanderLaReconstruction(racine, { detacher: () => 4248 })
    const naissances = Object.fromEntries(etatDe(racine).lances.map((l) => [l.pid, Date.parse(l.date)]))
    const creations = { 4247: naissances[4247] + 501, 4248: naissances[4248] + 500 }
    servirLesDemandes({
      racine, passe: () => 0, estVivant: (pid) => pid === process.pid || pid in creations,
      identite: { lireCreation: (pid) => creations[pid] ?? null, toleranceMs: 500 },
    })
    assert.deepEqual(etatDe(racine).lances.map((l) => l.pid), [4248])
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

// #2603
test('P1 : un second détaché meurt pendant que le premier attend l’opération — verrou libre, attente en cours, demande soldée après sous l’identité', () => {
  const racine = depotDeReconstruction()
  const chemins = cheminsDeLaReconstruction(racine)
  const vivants = new Set([process.pid])
  const estVivant = (pid) => vivants.has(pid)
  const pendant = []
  let tours = 0
  try {
    demanderLaReconstruction(racine, { detacher: () => process.pid })
    const passes = servirLesDemandes({
      racine, estVivant, identite: IDENTITE_DU_BANC, operation: () => (tours < 3 ? 'MERGE_HEAD' : null), attenteArbre: { echeanceMs: 60_000, pasMs: 10 },
      attenteTenant: ATTENTE_DU_TENANT_DU_BANC,
      passe: () => {
        assert.ok(Number.isFinite(tenantDe(chemins.verrou)?.creation), 'la reprise porte l’identité mesurée')
        return 0
      },
      dormir: () => {
        tours += 1
        if (tours === 1) {
          vivants.add(4244)
          demanderLaReconstruction(racine, { detacher: () => 4244 })
        }
        if (tours === 2) vivants.delete(4244)
        pendant.push([attendreLibre({ chemin: chemins.verrou }).etat, attendreLaReconstruction(racine, 2, { echeanceMs: 0, estVivant, identite: IDENTITE_DU_BANC }).etat])
      },
    })
    assert.equal(passes, 1)
    assert.deepEqual(pendant, [['libre', 'en-cours'], ['libre', 'en-cours'], ['libre', 'en-cours']])
    const vu = attendreLaReconstruction(racine, 2, { echeanceMs: 0, estVivant, identite: IDENTITE_DU_BANC })
    assert.deepEqual([vu.etat, vu.seq, vu.code], ['soldee', 2, 0])
    assert.deepEqual(etatDe(racine).lances, [])
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

// #2603
test('P2 : un pid fantôme de `lances` ne prend jamais le verrou — aucune famine, la demande est soldée après l’opération', () => {
  const racine = depotDeReconstruction()
  const vivants = new Set([process.pid, 4245])
  const estVivant = (pid) => vivants.has(pid)
  let tours = 0
  try {
    demanderLaReconstruction(racine, { detacher: () => 4245 })
    demanderLaReconstruction(racine, { detacher: () => process.pid })
    const passes = servirLesDemandes({
      racine, estVivant, identite: IDENTITE_DU_BANC, operation: () => (tours < 2 ? 'MERGE_HEAD' : null), attenteArbre: { echeanceMs: 60_000, pasMs: 10 },
      attenteTenant: ATTENTE_DU_TENANT_DU_BANC,
      passe: () => 0, dormir: () => { tours += 1 },
    })
    assert.equal(passes, 1)
    const vu = attendreLaReconstruction(racine, 2, { echeanceMs: 0, estVivant, identite: IDENTITE_DU_BANC })
    assert.deepEqual([vu.etat, vu.seq, vu.code], ['soldee', 2, 0])
    assert.deepEqual(etatDe(racine).lances.map((l) => l.pid), [4245], 'le servant s’est retiré ; le fantôme, vu vivant, reste inscrit')
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

// #2603
test('l’opération finie pendant la reprise du verrou : relue après la reprise, la demande arrivée entre-temps est servie par une passe', async () => {
  const racine = depotDeReconstruction()
  const chemins = cheminsDeLaReconstruction(racine)
  const tenant = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 30_000)'], { stdio: 'ignore' })
  const sortie = once(tenant, 'exit')
  let operation = 'MERGE_HEAD'
  let tiers = null
  let libere = false
  let echeance = Infinity
  const vuesALaPasse = []
  try {
    demanderLaReconstruction(racine, { detacher: () => process.pid })
    const passes = servirLesDemandes({
      racine, attenteArbre: { echeanceMs: 300, pasMs: 20 }, attenteTenant: ATTENTE_DU_TENANT_DU_BANC,
      operation: () => operation,
      passe: () => { vuesALaPasse.push(operation); return 0 },
      dormir: (ms) => {
        if (echeance === Infinity) echeance = Date.now() + 300
        tiers ??= prendreVerrou({ chemin: chemins.verrou, libelle: 'tenant tiers', commande: 'tenant tiers', pid: /** @type {number} */ (tenant.pid) })
        if (!libere && Date.now() > echeance + 50) {
          operation = null
          demanderLaReconstruction(racine, { detacher: () => process.pid })
          tiers.liberer()
          libere = true
        }
        attendreSync(ms)
      },
    })
    assert.equal(tiers?.etat, 'pris', 'le tenant tiers a pris le verrou rendu pendant l’attente')
    assert.ok(libere, 'l’opération a fini pendant la reprise')
    assert.equal(passes, 1)
    assert.deepEqual(vuesALaPasse, [null])
    const etat = etatDe(racine)
    assert.deepEqual([etat.demandes, etat.soldees, etat.dernier.seq, etat.dernier.code], [2, 2, 2, 0])
    assert.doesNotMatch(readFileSync(join(chemins.logs, `${process.pid}.log`), 'utf8'), /toujours en cours/)
  } finally {
    if (tiers?.etat === 'pris' && !libere) tiers.liberer()
    tenant.kill()
    await sortie
    rmSync(racine, { recursive: true, force: true, maxRetries: 20, retryDelay: 100 })
  }
})

// #2603
test('l’opération encore en cours à l’échéance de l’attente : la demande se solde de `CODE_DIFFERE` sans passe, verrou libre', () => {
  const racine = depotDeReconstruction()
  const chemins = cheminsDeLaReconstruction(racine)
  let tours = 0
  let passes = 0
  try {
    demanderLaReconstruction(racine, { detacher: () => process.pid })
    servirLesDemandes({
      racine, operation: () => 'MERGE_HEAD', attenteArbre: { echeanceMs: 200, pasMs: 20 }, attenteTenant: ATTENTE_DU_TENANT_DU_BANC,
      passe: () => { passes += 1; return 0 },
      dormir: (ms) => {
        tours += 1
        if (tours > 500) throw new Error('attente sans fin : l’échéance n’est jamais vue')
        attendreSync(ms)
      },
    })
    assert.equal(passes, 0, 'aucune passe jouée sous l’opération')
    const etat = etatDe(racine)
    assert.deepEqual([etat.demandes, etat.soldees, etat.dernier.seq, etat.dernier.code], [1, 1, 1, CODE_DIFFERE])
    assert.deepEqual(etat.lances, [])
    assert.equal(attendreLibre({ chemin: chemins.verrou }).etat, 'libre')
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

/** Un détaché RÉEL de la reconstruction de `racine`, sous une échéance d'arbre de 120 s. */
const detacheDuBanc = (racine) => spawn(process.execPath, ['--input-type=module', '-e', [
  `import { servirLesDemandes } from ${JSON.stringify(pathToFileURL(join(RACINE, 'scripts/git-hooks/reconstruction.mjs')).href)}`,
  'servirLesDemandes({ racine: process.cwd(), attenteArbre: { echeanceMs: 120_000, pasMs: 50 }, passe: () => 0 })',
].join('\n')], { cwd: racine, stdio: 'ignore' })

// #2603
test('(g) deux détachés sous `MERGE_HEAD` : le second prend le verrou sans attendre l’échéance du premier ; le premier tué, le survivant solde après l’opération', async () => {
  const racine = depotDeReconstruction()
  const chemins = cheminsDeLaReconstruction(racine)
  const mergeHead = join(racine, '.git', 'MERGE_HEAD')
  /** @type {{ enfant: import('node:child_process').ChildProcess, sortie: Promise<unknown> }[]} */
  const detaches = []
  const demander = () => demanderLaReconstruction(racine, { detacher: () => {
    const enfant = detacheDuBanc(racine)
    detaches.push({ enfant, sortie: once(enfant, 'exit') })
    return /** @type {number} */ (enfant.pid)
  } })
  const journalDe = (pid) => {
    const log = join(chemins.logs, `${pid}.log`)
    return existsSync(log) ? readFileSync(log, 'utf8') : ''
  }
  const RENDU = /MERGE_HEAD en cours : verrou de l’arbre rendu pendant l’attente/
  const attendreLeRendu = (pid) => {
    const fin = Date.now() + 30_000
    while (!RENDU.test(journalDe(pid)) && Date.now() < fin) attendreSync(50)
    return journalDe(pid)
  }
  try {
    writeFileSync(mergeHead, `${'0'.repeat(40)}\n`)
    demander()
    const [premier] = detaches
    assert.match(attendreLeRendu(premier.enfant.pid), RENDU)
    demander()
    const [, second] = detaches
    assert.match(attendreLeRendu(second.enfant.pid), RENDU, 'le second a pris le verrou pendant l’attente du premier')
    assert.equal(attendreLibre({ chemin: chemins.verrou }).etat, 'libre', 'personne ne tient le verrou pendant l’opération')
    assert.deepEqual(etatDe(racine).lances.map((l) => l.pid), [premier.enfant.pid, second.enfant.pid])
    premier.enfant.kill()
    await premier.sortie
    rmSync(mergeHead)
    const vu = attendreLaReconstruction(racine, 2, { echeanceMs: 60_000, pasMs: 50 })
    assert.deepEqual([vu.etat, vu.seq, vu.code], ['soldee', 2, 0])
    await second.sortie
    assert.equal(second.enfant.exitCode, 0)
    assert.deepEqual(etatDe(racine).lances, [])
  } finally {
    for (const { enfant, sortie } of detaches) {
      if (enfant.exitCode === null && enfant.signalCode === null) enfant.kill()
      await sortie
    }
    rmSync(racine, { recursive: true, force: true, maxRetries: 40, retryDelay: 250 })
  }
})

// #2603
test('(i) le détaché de la reconstruction naît sans `GIT_INDEX_FILE` ni jeton de verrou, sur les deux plateformes', () => {
  const racine = depotDeReconstruction()
  const avant = { GIT_INDEX_FILE: process.env.GIT_INDEX_FILE, WFRP_VERROU_BANC: process.env.WFRP_VERROU_BANC }
  process.env.GIT_INDEX_FILE = '.git/index'
  process.env.WFRP_VERROU_BANC = 'jeton'
  try {
    for (const plateforme of ['linux', 'win32']) {
      const envs = []
      demanderLaReconstruction(racine, { detacher: (opts) => lancerDetache({ ...opts, plateforme,
        detacher: (_node, _argv, options) => { envs.push(options.env); return { pid: 4244, unref: () => {} } },
        executerSync: (_cmd, _args, options) => { envs.push(options.env); return { stdout: '4244\n', stderr: '' } },
      }) })
      assert.equal(envs.length, 1, plateforme)
      assert.deepEqual(['GIT_INDEX_FILE' in envs[0], 'WFRP_VERROU_BANC' in envs[0], envs[0].PATH === process.env.PATH], [false, false, true], plateforme)
    }
  } finally {
    for (const [cle, valeur] of Object.entries(avant)) {
      if (valeur === undefined) delete process.env[cle]
      else process.env[cle] = valeur
    }
    rmSync(racine, { recursive: true, force: true })
  }
})

/** Les détachés `pids` attendus jusqu'à leur fin, bornée : REND ceux encore vivants à l'échéance. */
function attendreLesDetaches(pids) {
  const vivants = () => pids.filter((pid) => estPidVivant(pid))
  const fin = Date.now() + 60_000
  while (vivants().length && Date.now() < fin) attendreSync(100)
  return vivants()
}

/** Un `build-all` FACTICE : `--code` rend 0 ; `--perimes` pose `.git/perimes-entame` puis attend `.git/debloquer`. */
const BUILD_ALL_FACTICE = [
  "import { existsSync, writeFileSync } from 'node:fs'",
  "if (process.argv.includes('--perimes')) {",
  "  writeFileSync('.git/perimes-entame', '')",
  '  const fin = Date.now() + 60_000',
  "  while (!existsSync('.git/debloquer') && Date.now() < fin) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50)",
  '}',
].join('\n')

// #2603
test('(a) CÂBLAGE réel : le VRAI post-commit rend la main pendant que la passe détachée attend ; elle se solde après', () => {
  const { racine } = instanceDeDepot({ fichiers: { 'a.txt': 'a\n', 'scripts/docs/build-all.mjs': BUILD_ALL_FACTICE } })
  const git = gitDe(racine)
  const debloquer = join(racine, '.git', 'debloquer')
  let rouge = null
  let residu = null
  try {
    git('config', 'core.hooksPath', join(RACINE, 'scripts', 'git-hooks'))
    writeFileSync(join(racine, 'a.txt'), 'b\n')
    git('add', 'a.txt')
    const debut = performance.now()
    const vu = resultatDeGit(['commit', '--no-verify', '-q', '-m', 'b'], { cwd: racine })
    const ms = Math.round(performance.now() - debut)
    assert.equal(vu.status, 0, `${vu.error ?? ''}${vu.stdout}${vu.stderr}`)
    assert.ok(ms < 30_000, `le post-commit rend la main sans attendre la passe : ${ms} ms`)
    assert.match(`${vu.stdout}${vu.stderr}`, /^reconstruction seq=1$/m)
    assert.equal(existsSync(debloquer), false)
    assert.deepEqual(attendreLaReconstruction(racine, 1, { echeanceMs: 0 }), { etat: 'en-cours' })
    writeFileSync(debloquer, '')
    const passe = attendreLaReconstruction(racine, 1, { echeanceMs: 120_000, pasMs: 100 })
    assert.deepEqual([passe.etat, passe.seq, passe.code], ['soldee', 1, 0], JSON.stringify(passe))
    assert.equal(existsSync(join(racine, '.git', 'perimes-entame')), true, 'la passe a joué `build-all --perimes` de l’arbre')
    console.log(JSON.stringify({ banc2603: 'post-commit-reel', ms }))
  } catch (e) {
    rouge = e
  } finally {
    writeFileSync(debloquer, '')
    const { logs } = cheminsDeLaReconstruction(racine)
    const vivants = attendreLesDetaches(existsSync(logs) ? readdirSync(logs).map((f) => Number.parseInt(f, 10)) : [])
    try {
      assert.deepEqual(vivants, [])
      rmSync(racine, { recursive: true, force: true, maxRetries: 40, retryDelay: 250 })
    } catch (e) {
      residu = e
    }
  }
  if (rouge ?? residu) throw rouge ?? residu
})

// #2603
test('(d) rebase de 3 picks : 3 post-commit et un post-rewrite demandent, aucune passe pendant le rebase, une passe après', () => {
  const { racine } = instanceDeDepot({ fichiers: { '.gitignore': 'hooks-fixture/\n', 'a.txt': 'a\n' } })
  const git = gitDe(racine)
  const journal = join(racine, '.git', 'journal-fixture')
  const lire = () => readFileSync(journal, 'utf8').trim().split('\n').filter(Boolean)
  const url = (rel) => JSON.stringify(pathToFileURL(join(RACINE, rel)).href)
  const serveur = join(racine, 'hooks-fixture', 'serveur.mjs')
  try {
    git('switch', '-q', '-c', 'cote')
    for (const i of [1, 2, 3]) {
      writeFileSync(join(racine, `f${i}.txt`), `${i}\n`)
      git('add', `f${i}.txt`)
      git('commit', '-q', '-m', `pick ${i}`)
    }
    git('switch', '-q', 'main')
    writeFileSync(join(racine, 'b.txt'), 'b\n')
    git('add', 'b.txt')
    git('commit', '-q', '-m', 'b')
    git('switch', '-q', 'cote')
    mkdirSync(join(racine, 'hooks-fixture'))
    for (const hook of ['post-commit', 'post-rewrite']) writeFileSync(join(racine, 'hooks-fixture', hook), readFileSync(join(RACINE, 'scripts/git-hooks', hook)), { mode: 0o755 })
    writeFileSync(join(racine, 'hooks-fixture', 'docs-rebuild.mjs'), [
      `import { reconstruireApresGit } from ${url('scripts/git-hooks/docs-rebuild.mjs')}`,
      `import { demanderLaReconstruction } from ${url('scripts/git-hooks/reconstruction.mjs')}`,
      `import { lancerDetache } from ${url('scripts/guards/lib/lancerDetache.mjs')}`,
      "import { appendFileSync } from 'node:fs'",
      `appendFileSync(${JSON.stringify(journal)}, 'hook ' + process.argv[2] + '\\n')`,
      `process.exitCode = reconstruireApresGit({ cwd: ${JSON.stringify(racine)}, hook: process.argv[2], generateurs: [{ script: 'g/a.mjs', targets: ['docs/a.md'] }],`,
      "  annoncer: () => {}, npm: () => ({ status: 1 }), code: () => 1,",
      `  demander: (cwd) => demanderLaReconstruction(cwd, { script: ${JSON.stringify(serveur)}, detacher: (opts) => {`,
      '    const pid = lancerDetache(opts)',
      `    appendFileSync(${JSON.stringify(journal)}, 'lance ' + pid + '\\n')`,
      '    return pid',
      '  } }) }).code',
    ].join('\n'))
    writeFileSync(serveur, [
      `import { servirLesDemandes } from ${url('scripts/git-hooks/reconstruction.mjs')}`,
      `import { operationEnCours } from ${url('scripts/docs/lib/ecrivain-derives.mjs')}`,
      `import { gitDirDe } from ${url('scripts/hooks/barriere-outil.mjs')}`,
      "import { appendFileSync } from 'node:fs'",
      'const racine = process.cwd()',
      'servirLesDemandes({ racine, attenteArbre: { echeanceMs: 60_000, pasMs: 50 }, passe: () => {',
      `  appendFileSync(${JSON.stringify(journal)}, 'passe ' + (operationEnCours(gitDirDe(racine)) ?? 'libre') + '\\n')`,
      '  return 0',
      '} })',
    ].join('\n'))
    git('config', 'core.hooksPath', 'hooks-fixture')
    const vu = resultatDeGit(['rebase', '-x', 'node -e "setTimeout(() => {}, 1000)"', 'main'], { cwd: racine })
    assert.equal(vu.status, 0, `${vu.stdout}${vu.stderr}`)
    const demandes = demandesDe(racine)
    assert.equal(demandes, 4)
    const passe = attendreLaReconstruction(racine, demandes, { echeanceMs: 120_000, pasMs: 100 })
    assert.deepEqual([passe.etat, passe.seq, passe.code], ['soldee', 4, 0])
    const lu = lire()
    assert.deepEqual(lu.filter((l) => l.startsWith('hook ')), ['hook post-commit', 'hook post-commit', 'hook post-commit', 'hook post-rewrite'])
    const passes = lu.filter((l) => l.startsWith('passe '))
    assert.ok(passes.length >= 1, lu.join(' | '))
    assert.deepEqual(passes.filter((l) => l !== 'passe libre'), [], lu.join(' | '))
  } finally {
    const lances = existsSync(journal) ? lire().filter((l) => l.startsWith('lance ')).map((l) => Number(l.slice('lance '.length))) : []
    assert.deepEqual(attendreLesDetaches(lances), [])
    rmSync(racine, { recursive: true, force: true, maxRetries: 40, retryDelay: 250 })
  }
})
