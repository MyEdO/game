// Porte des hooks post-merge / post-rewrite et de l'étape docs de `ops:publier` : « ce lot peut-il
// avoir périmé un doc dérivé ? ». La réponse se DÉRIVE de la mesure, donc elle se teste sur une
// mesure FORGÉE (volet pur) puis sur celle que RENDENT les générateurs de l'arbre (volet classes, #1773).
//   node --test scripts/git-hooks/docs-rebuild.test.mjs
import test from 'node:test'
import assert from 'node:assert/strict'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { envDeDepotForge, envGitFeint, instanceDeDepot, sousGitFeint } from '../guards/lib/depotGabarit.mjs'
import { genererCode, mesurerEnRendu } from '../docs/build-all.mjs'
import { tableTotale } from '../../src/lib/tableTotale.ts'
import { planDuCheckout, reconstruireApresGit, selectionDesGenerateurs, touchedFiles, touchesDocSources } from './docs-rebuild.mjs'
import { gitDe, resultatDeGit } from '../test/gitDeBanc.mjs'

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

test('#2285 callback docs : refus complet et commit ordinaire silencieux', () => {
  assert.equal(statSync(join(RACINE, 'package-lock.json')).isFile(), true)
  const stderr = 'note parents\n'.repeat(45) + 'cause parents tardive\n'
  const stdout = 'stdout parents distinct'
  assert.ok(stderr.indexOf('cause parents tardive') > 400)
  assert.ok(stderr.endsWith('\n'))
  const annonces = []
  let npm = 0
  let code = 0
  let docs = 0
  const options = {
    cwd: RACINE, hook: 'post-commit', generateurs: [],
    annoncer: (texte) => annonces.push(texte),
    npm: () => { npm++; return { status: 1 } },
    code: () => { code++; assert.fail('code interdit') },
    docs: () => { docs++; assert.fail('docs interdits') },
  }
  const resultat = sousGitFeint([
    { si: ['rev-parse', 'HEAD^@'], status: 29, stdout, stderr },
    { si: ['rev-parse', '--verify', '--quiet', 'HEAD'], status: 1, stdout: '', stderr: '' },
    { si: ['HEAD^{commit}'], status: 0, stdout: 'a'.repeat(40) },
    { si: ['reflog', 'exists', 'HEAD'], status: 1, stdout: '', stderr: '' },
    { si: [], status: 97, stderr: 'GARDE callback docs : lecture interdite\n' },
  ], () => reconstruireApresGit(options))
  assert.equal(resultat, 1)
  assert.equal(npm, 1)
  assert.equal(code, 0)
  assert.equal(docs, 0)
  const lectures = annonces.filter((texte) => texte.startsWith('[post-commit] lecture Git indisponible : '))
  assert.deepEqual(lectures, ['[post-commit] lecture Git indisponible : refus (status 29) — ' + stderr + '\n' + stdout + '\n'])
  assert.equal(annonces.some((texte) => texte.includes('GARDE callback docs')), false)
  annonces.length = 0
  npm = 0
  const ordinaire = sousGitFeint([
    { si: ['rev-parse', 'HEAD^@'], status: 0, stdout: 'b'.repeat(40) + '\n' },
    { si: [], status: 97, stderr: 'GARDE callback docs : lecture interdite\n' },
  ], () => reconstruireApresGit(options))
  assert.equal(ordinaire, 0)
  assert.equal(npm, 0)
  assert.equal(code, 0)
  assert.equal(docs, 0)
  assert.deepEqual(annonces, [])
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

test('le FRÈRE d’une source lue fait régénérer ; un chemin sans parent mesuré, non', () => {
  // `notes/lue.md` est mesurée : une voisine AJOUTÉE dans le même dossier alimente le même doc, et
  // aucun générateur qui énumère sans lister ne le dirait autrement.
  assert.equal(touchesDocSources(['notes/voisine.md'], MESURE), true)
  assert.equal(touchesDocSources(['public/x.svg'], MESURE), false)
  // À la RACINE, le voisinage ne prouve rien : un fichier de racine n'est lu que s'il est mesuré.
  assert.equal(touchesDocSources(['README.md'], { 'g/a.mjs': { cibles: [], fichiers: ['package.json'], dossiers: [] } }), false)
  assert.equal(touchesDocSources(['package.json'], { 'g/a.mjs': { cibles: [], fichiers: ['package.json'], dossiers: [] } }), true)
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
  // `.claude/memory/user-*.md` alimente `docs/doctrines.md` : une fiche NEUVE compte (frère d'une
  // source lue), et `.github/workflows` est un dossier mesuré — deux classes hors des préfixes.
  assert.equal(touchesDocSources(['.claude/memory/user-x.md'], mesure), true)
  assert.equal(touchesDocSources(['.github/workflows/ci.yml'], mesure), true)
  assert.equal(touchesDocSources(['tsconfig.json'], mesure), true)
  // Ce qu'aucun générateur ne lit ne périme aucun dérivé, quel que soit son dossier.
  assert.equal(touchesDocSources(['README.md'], mesure), false)
  assert.equal(touchesDocSources(['public/galeries.html'], mesure), false)
  // Et les classes que la liste voyait déjà restent vues.
  assert.equal(touchesDocSources(['src/ui/Prose.tsx'], mesure), true)
  assert.equal(touchesDocSources(['scripts\\raw\\build-implemente.mjs'], mesure), true)
  assert.equal(touchesDocSources(['docs/raw/4e/combat.md'], mesure), true)
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

// post-checkout (#2203) : un changement de branche régénère les docs purs dont une source a bougé ;
// un worktree NEUF (aucune mesure) ne bloque jamais sur un `docs:build` complet, il dit la commande.
test('post-checkout : HEAD immobile → rien ; sans mesure → consigne ; sinon la sélection de post-merge', () => {
  const a = 'a'.repeat(40)
  const b = 'b'.repeat(40)
  assert.equal(planDuCheckout({ avant: a, apres: a, mesure: MESURE, lot: ['src/ui/Prose.tsx'] }), 'rien')
  assert.equal(planDuCheckout({ avant: a, apres: b, mesure: null, lot: null }), 'consigne')
  assert.equal(planDuCheckout({ avant: a, apres: b, mesure: MESURE, lot: ['src/ui/Prose.tsx'] }), 'regenerer')
  assert.equal(planDuCheckout({ avant: a, apres: b, mesure: MESURE, lot: ['README.md'] }), 'rien')
  assert.equal(planDuCheckout({ avant: a, apres: b, mesure: MESURE, lot: null }), 'regenerer', 'lot inconnu : on régénère')
})

test('CÂBLAGE : chaque post-hook passe son NOM à docs-rebuild.mjs, post-checkout aussi ses deux HEAD', () => {
  const lire = (hook) => readFileSync(join(RACINE, 'scripts', 'git-hooks', hook), 'utf8')
  assert.match(lire('post-checkout'), /docs-rebuild\.mjs" post-checkout "\$1" "\$2"/)
  for (const hook of ['post-merge', 'post-rewrite']) assert.match(lire(hook), new RegExp(`docs-rebuild\\.mjs" ${hook} `), hook)
  assert.match(lire('post-commit'), /docs-rebuild\.mjs" post-commit /)
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
    'g/b.mjs': { fichiers: [doc('a')], dossiers: [], cibles: [doc('b')] },
    'g/c.mjs': { fichiers: ['ailleurs/c.txt'], dossiers: [], cibles: [doc('c')] },
  }
  const selection = (lot, m = mesure) => selectionDesGenerateurs({ lot, mesure: m, cwd: racine, generateurs })
  try {
    assert.deepEqual(selection(['notes/a.txt']).scripts, ['g/a.mjs', 'g/b.mjs'])
    assert.deepEqual(selection(['notes/neuf/plus/bas.txt']).scripts, ['g/a.mjs', 'g/b.mjs'])
    assert.deepEqual(selection([doc('a')]).scripts, ['g/a.mjs', 'g/b.mjs'])
    assert.deepEqual(selection(['public/independent.svg']).scripts, [])
    const mixte = [{ ...generateurs[1], targets: [], injecte: [doc('a')] }, ...generateurs.filter((g) => g.script !== 'g/a.mjs')]
    assert.ok(selectionDesGenerateurs({ lot: ['notes/a.txt'], mesure, cwd: racine, generateurs: mixte }).scripts.includes('g/code.mjs'))
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
        "import { appendFileSync, readFileSync } from 'node:fs'",
        `const journal = ${JSON.stringify(journal)}`,
        "const hook = process.argv[2]",
        "appendFileSync(journal, hook + '\\n')",
        `process.exitCode = reconstruireApresGit({cwd:${JSON.stringify(racine)}, hook, generateurs: [],`,
        "npm: (_cmd,args) => { appendFileSync(journal, 'npm:' + args.join(' ') + '\\n'); let status=0; try {status=Number(readFileSync('.git/npm-status','utf8'))} catch {} return {status} },",
        "code: () => { appendFileSync(journal,'code\\n'); return 0 }, docs: () => {appendFileSync(journal,'docs\\n')} })",
      ].join('\n'))
      git('config', 'core.hooksPath', 'hooks-fixture')
      vider()
      const merge = resultatDeGit(['merge', '--no-ff', 'cote', '-m', 'fusion'], { cwd: racine })
      assert.equal(merge.status, conflit ? 1 : 0, `${merge.stdout}${merge.stderr}`)
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
      code: () => { generations++; return 0 }, docs: () => { generations++ },
      npm: (cmd, args, opts) => {
        assert.match(sorties.at(-1), /npm ci — début/)
        return spawnSync(cmd, args, { ...opts, stdio: 'pipe', encoding: 'utf8' })
      },
    })
    assert.equal(vu, 1)
    assert.equal(generations, 0)
    assert.match(sorties.join(''), /équipement incomplet : relancer `npm ci`/)
    assert.match(sorties.join(''), /npm ci — fin \(\d+ ms\)/)
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('fusion server seule : installer avant code ; lot sans lockfile : aucun npm ; code rouge arrête docs', () => {
  for (const server of [true, false]) {
    const avant = server ? { 'server/package-lock.json': '{}', 'package-lock.json': '{}' } : { 'a.txt': 'a' }
    const apres = server ? { 'server/package-lock.json': '{}\n' } : { 'a.txt': 'b' }
    const { racine } = fusionReelle(avant, apres)
    const gestes = []
    try {
      const vu = reconstruireApresGit({ cwd: racine, hook: 'post-merge', annoncer: () => {},
        npm: (_cmd, args) => { gestes.push(args.join(' ')); return { status: 0 } },
        code: () => { gestes.push('code'); return 1 }, docs: () => { gestes.push('docs') },
      })
      assert.equal(vu, 1)
      assert.deepEqual(gestes, server ? ['--prefix server ci --no-audit --no-fund', 'code'] : ['code'])
    } finally {
      rmSync(racine, { recursive: true, force: true })
    }
  }
})

test('racine installée : postinstall suffit pour le code ; ORIG_HEAD inconnu et lockfile retiré sont annoncés', () => {
  const { racine } = fusionReelle({ 'package-lock.json': '{}' }, { 'package-lock.json': '{}\n' })
  const sorties = []
  let code = 0
  let docs = 0
  try {
    assert.equal(reconstruireApresGit({ cwd: racine, hook: 'post-merge', generateurs: [], annoncer: (texte) => sorties.push(texte),
      npm: () => ({ status: 0 }), code: () => { code++; return 0 }, docs: () => { docs++ },
    }), 0)
    assert.deepEqual([code, docs], [0, 0])
    const git = gitDe(racine)
    git('update-ref', '-d', 'ORIG_HEAD')
    assert.equal(reconstruireApresGit({ cwd: racine, hook: 'post-merge', annoncer: (texte) => sorties.push(texte), npm: () => ({ status: 1 }), code: () => { code++; return 0 } }), 1)
    assert.match(sorties.join(''), /plage Git inconnue/)
    git('update-ref', 'ORIG_HEAD', 'HEAD~1')
    rmSync(join(racine, 'package-lock.json'))
    assert.equal(reconstruireApresGit({ cwd: racine, hook: 'post-merge', annoncer: (texte) => sorties.push(texte), code: () => { code++; return 0 } }), 1)
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
    npm: () => { gestes.push('npm'); return { status: 1 } }, code: () => { gestes.push('code'); return 0 }, docs: () => { gestes.push('docs') },
  }
  try {
    assert.equal(reconstruireApresGit({ ...options, avant: '0'.repeat(40) }), 0)
    assert.deepEqual(gestes, [])
    assert.match(sorties.join(''), /worktree neuf.*npm ci.*npm --prefix server ci.*docs:build/)
    for (const avant of ['inconnu', 'b'.repeat(40)]) {
      gestes.length = 0
      assert.equal(reconstruireApresGit({ ...options, avant }), 1)
      assert.deepEqual(gestes, ['npm'])
    }
    mkdirSync(join(racine, 'docs'))
    writeFileSync(join(racine, 'docs/.sources-lues.json'), '{}')
    gestes.length = 0
    assert.equal(reconstruireApresGit({ ...options, avant: '0'.repeat(40) }), 1)
    assert.deepEqual(gestes, ['npm'])
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('profil du hook après fusion : chaîne réelle 2/4 générateurs, CODE indépendant intact', () => {
  const primitive = pathToFileURL(join(RACINE, 'scripts/docs/lib/ecriture-derives.mjs')).href
  const module = pathToFileURL(join(RACINE, 'scripts/docs/build-all.mjs')).href
  const doc = (nom) => ['docs', `${nom}.md`].join('/')
  const noms = ['code', 'a', 'b', 'c']
  const cible = (nom) => nom === 'code' ? 'src/code.gen.ts' : doc(nom)
  const generateurs = noms.map((nom) => ({ runner: 'node', script: `g/${nom}.mjs`, targets: [cible(nom)] }))
  const source = (nom) => nom === 'b' ? doc('a') : `notes/${nom}/source.txt`
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
    'notes/a/source.txt': 'a', 'notes/c/source.txt': 'c', 'notes/code/source.txt': 'code',
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
  try {
    const complet = jouer()
    git('add', 'docs', 'notes', 'g', 'src', 'commun.txt', '.gitignore')
    git('commit', '-q', '-m', 'mesure initiale')
    const origine = git('rev-parse', 'HEAD').trim()
    writeFileSync(join(racine, 'notes/a/source.txt'), 'a modifié')
    git('add', 'notes/a/source.txt')
    git('commit', '-q', '-m', 'main modifie source a')
    git('update-ref', 'refs/heads/main-modifie', 'HEAD')
    git('update-ref', 'HEAD', origine)
    writeFileSync(join(racine, 'notes/a/source.txt'), 'a')
    git('read-tree', origine)
    git('merge', '--ff-only', 'main-modifie')
    const independant = readFileSync(join(racine, doc('c')), 'utf8')
    const codeAvant = statSync(join(racine, cible('code'))).mtimeMs
    const journal = readFileSync(join(racine, 'node_modules/code-journal.txt'), 'utf8')
    const annonces = []
    let partiel
    const vu = reconstruireApresGit({ cwd: racine, hook: 'post-merge', generateurs, annoncer: (texte) => annonces.push(texte),
      docs: (_cmd, args) => { partiel = jouer(args.slice(1)) },
    })
    assert.equal(vu, 0)
    assert.deepEqual([complet.compte, partiel.compte], [4, 2])
    assert.equal(statSync(join(racine, cible('code'))).mtimeMs, codeAvant)
    assert.equal(readFileSync(join(racine, 'node_modules/code-journal.txt'), 'utf8'), journal)
    assert.equal(readFileSync(join(racine, doc('c')), 'utf8'), independant)
    assert.match(readFileSync(join(racine, doc('b')), 'utf8'), /a modifié/)
    assert.match(annonces.join(''), /sélection \(2\/4\)/)
    for (const nonPertinent of [false, true]) {
      git('update-ref', 'ORIG_HEAD', 'HEAD')
      if (nonPertinent) {
        mkdirSync(join(racine, 'public'))
        writeFileSync(join(racine, 'public/independant.svg'), '<svg/>')
        git('add', 'public/independant.svg')
        git('commit', '-q', '-m', 'source non pertinente')
      }
      const gestes = []
      assert.equal(reconstruireApresGit({ cwd: racine, hook: 'post-merge', generateurs,
        annoncer: () => {}, npm: () => { gestes.push('npm') }, code: () => { gestes.push('code') }, docs: () => { gestes.push('docs') },
      }), 0)
      assert.deepEqual(gestes, [])
    }
    writeFileSync(join(racine, 'notes/code/source.txt'), 'code modifié')
    git('add', 'notes/code/source.txt')
    git('commit', '-q', '-m', 'source code')
    git('update-ref', 'ORIG_HEAD', 'HEAD~1')
    const ordre = []
    assert.equal(reconstruireApresGit({ cwd: racine, hook: 'post-merge', generateurs, annoncer: () => {},
      docs: (_cmd, args) => {
        ordre.push(readFileSync(join(racine, 'node_modules/code-journal.txt'), 'utf8'))
        jouer(args.slice(1))
      },
    }), 0)
    assert.match(ordre[0], /ecriture\necriture\n$/)
    assert.match(readFileSync(join(racine, cible('code')), 'utf8'), /code modifié/)
    writeFileSync(join(racine, 'package-lock.json'), '{}')
    git('add', 'package-lock.json')
    git('commit', '-q', '-m', 'lockfile toolchain')
    git('update-ref', 'ORIG_HEAD', 'HEAD~1')
    const annoncesLock = []
    assert.equal(reconstruireApresGit({ cwd: racine, hook: 'post-merge', generateurs, annoncer: (texte) => annoncesLock.push(texte),
      npm: () => {
        writeFileSync(join(racine, 'node_modules/dependency-value.txt'), 'DEPENDANCE2')
        return { status: genererCode({ cwd: racine, generateurs, quiet: true }) }
      },
      code: () => { throw new Error('postinstall ne doit pas être doublé') },
      docs: (_cmd, args) => { jouer(args.slice(1)) },
    }), 0)
    assert.match(readFileSync(join(racine, doc('c')), 'utf8'), /DEPENDANCE2/)
    assert.match(annoncesLock.join(''), /génération complète.*toolchain modifiée/)
    git('update-ref', 'ORIG_HEAD', 'HEAD')
    rmSync(join(racine, cible('code')))
    assert.equal(reconstruireApresGit({ cwd: racine, hook: 'post-merge', generateurs, annoncer: () => {}, docs: (_cmd, args) => { jouer(args.slice(1)) } }), 0)
    assert.match(readFileSync(join(racine, cible('code')), 'utf8'), /code modifié/)
    console.log(JSON.stringify({ banc2329: 'hook-fusion-source', avant: complet, apres: partiel, sorties: annonces }))
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})
