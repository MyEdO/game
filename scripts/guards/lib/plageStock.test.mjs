// Tests de la porte de PLAGE (`plageStock.mjs`) : par commit, filtrée par la croissance cumulée.
// Les deux premiers cas sont la sonde qui a DISCRIMINÉ les deux niveaux le 2026-09-03 — jugée en
// cumulé seul, une plage de deux commits cliquetés `+2` rougit à tort ; jugée par commit seul, une
// plage qui ajoute puis RETIRE un stock rougit à tort aussi. Lancé par `npm run test:hooks`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { refusDeLaPlage, raisonDeRefusDePlage, croissancesDeLaPlage, reclassementsDeLaPlage, SHA_NUL } from './plageStock.mjs'
import { TRONC } from './gitPorte.mjs'
import { bilanDesStocks } from './stocksNominatifs.mjs'
import { instanceDeDepot, sousGitFeint } from './depotGabarit.mjs'

const PORTEUR = 'scripts/x.test.mjs'

/** Diff `-U0` d'un ajout/retrait de lignes dans le porteur, à partir de la ligne `ligne`. */
const diffDe = (ajoutees = [], retirees = [], ligne = 1) =>
  [
    `diff --git a/${PORTEUR} b/${PORTEUR}`,
    `--- a/${PORTEUR}`,
    `+++ b/${PORTEUR}`,
    `@@ -${ligne},${retirees.length} +${ligne},${ajoutees.length} @@`,
    ...retirees.map((l) => `-${l}`),
    ...ajoutees.map((l) => `+${l}`),
  ].join('\n')

/** Lecteur d'image qui rend `null` : la porte l'a, et le REPLI de ligne juge — la voie des diffs
 *  FABRIQUÉS ci-dessous, dont aucun fichier n'existe. Sans lecteur du tout, `croissanceDesStocks`
 *  refuse nommément (un compte sans image ment). */
const REPLI = { lirePostImage: () => null }

const A = "  'src/a.ts',"
const B = "  'src/b.ts',"
const C = "  'src/c.ts',"
const D = "  'src/d.ts',"

/** Le bilan cumulé signé d'un diff `-U0` fabriqué, lu par le REPLI. */
const cumulDe = (diff) => bilanDesStocks(diff, REPLI)

test('C : deux commits CLIQUETÉS +2 chacun passent — le cumul +4 ne demande pas un cliquet +4', () => {
  const refus = refusDeLaPlage({
    commits: [
      { sha: 'aaa1111', diff: diffDe([A, B]), images: REPLI, message: 'T1\n\nCLIQUET: scripts/x.test.mjs +2 — fixtures du test neuf, motif assez long' },
      { sha: 'bbb2222', diff: diffDe([C, D]), images: REPLI, message: 'T2\n\nCLIQUET: scripts/x.test.mjs +2 — seconde fournée, motif suffisamment long aussi' },
    ],
    cumul: cumulDe(diffDe([A, B, C, D])),
  })
  assert.deepEqual(refus, [], 'le CLIQUET vit dans UN message : la plage se juge par commit')
})

test('C : un stock ajouté puis RETIRÉ dans la plage ne refuse rien — le filtre cumulé l\'écarte', () => {
  const commits = [
    { sha: 'aaa1111', diff: diffDe([A, B]), images: REPLI, message: 'ajoute' },
    { sha: 'bbb2222', diff: diffDe([], [A, B]), images: REPLI, message: 'retire' },
  ]
  assert.equal(
    refusDeLaPlage({ commits, cumul: cumulDe(diffDe([A, B])) }).length, 1,
    'sans retrait cumulé, le refus tient',
  )
  assert.deepEqual(
    refusDeLaPlage({ commits, cumul: cumulDe('') }), [],
    'croissance cumulée nulle : rien à refuser',
  )
  assert.throws(() => refusDeLaPlage({ commits }), /refusDeLaPlage : `cumul`/, 'sans cumul, aucun zéro silencieux')
})

test('C : un commit du MILIEU sans cliquet est refusé, et le refus le NOMME', () => {
  const refus = refusDeLaPlage({
    commits: [
      { sha: 'aaa1111', diff: diffDe([]), images: REPLI, message: 'socle' },
      { sha: 'bbb2222', diff: diffDe([A, B]), images: REPLI, message: 'lot sans cliquet' },
      { sha: 'ccc3333', diff: diffDe([]), images: REPLI, message: 'tête innocente' },
    ],
    cumul: cumulDe(diffDe([A, B])),
  })
  assert.deepEqual(refus.map((r) => [r.sha, r.fichier, r.net]), [['bbb2222', PORTEUR, 2]])
  const raison = raisonDeRefusDePlage(refus)
  assert.match(raison, /bbb2222/)
  assert.ok(raison.includes('scripts/x.test.mjs +2'), raison)
  assert.match(raison, /rebase -i/)
})

// ── Sur un dépôt JETABLE : la lecture git réelle, la plage et son repli ───────────────────────────

/** Dépôt jetable où chaque élément de `commits` pose une version du porteur et son message. */
function depotJetable(commits) {
  const [fondation, ...suite] = commits
  assert.ok(fondation, 'depotJetable : le premier commit FONDE le dépôt — `commits` ne peut pas être vide')
  const { racine: repo, sha } = instanceDeDepot({ fichiers: { [PORTEUR]: fondation.contenu }, message: fondation.message })
  const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
  const shas = [sha]
  for (const { contenu, message } of suite) {
    writeFileSync(join(repo, PORTEUR), contenu, 'utf8')
    git('add', '-A')
    git('commit', '-q', '--no-verify', '-m', message)
    shas.push(git('rev-parse', 'HEAD').trim())
  }
  return { repo, shas, git }
}

const sourceStock = (entrees) => `export const STOCK = [\n${entrees.join('\n')}\n]\n`

test('C : sur un dépôt réel, la plage voit le commit du MILIEU que `git show HEAD` ne voit pas', () => {
  const { repo, shas } = depotJetable([
    { contenu: sourceStock([]), message: 'socle' },
    { contenu: sourceStock([A, B]), message: 'deux exemptions de plus, sans cliquet' },
    { contenu: `${sourceStock([A, B])}// tête anodine\n`, message: 'tête' },
  ])
  try {
    const { refus } = croissancesDeLaPlage({ cwd: repo, debut: shas[0], fin: shas[2] })
    assert.deepEqual(refus.map((r) => [r.sha, r.fichier, r.net]), [[shas[1], PORTEUR, 2]])
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})

test('C : la même croissance RETIRÉE plus loin dans la plage ne refuse plus rien', () => {
  const { repo, shas } = depotJetable([
    { contenu: sourceStock([]), message: 'socle' },
    { contenu: sourceStock([A, B]), message: 'deux exemptions de plus, sans cliquet' },
    { contenu: sourceStock([]), message: 'et on les retire' },
  ])
  try {
    assert.deepEqual(croissancesDeLaPlage({ cwd: repo, debut: shas[0], fin: shas[2] }).refus, [])
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})

test('C : base NULLE sans tronc lisible → HEAD seul, et la porte le DIT (jamais un silence)', () => {
  const { repo, shas } = depotJetable([
    { contenu: sourceStock([]), message: 'socle' },
    { contenu: sourceStock([A, B]), message: 'deux exemptions de plus, sans cliquet' },
    { contenu: `${sourceStock([A, B])}// tête anodine\n`, message: 'tête' },
  ])
  try {
    const { refus, notes } = croissancesDeLaPlage({ cwd: repo, debut: SHA_NUL, fin: shas[2] })
    assert.deepEqual(refus, [], 'la tête seule ne porte aucune croissance')
    assert.deepEqual(notes, [
      `tronc \`origin/main\` illisible depuis ${shas[2].slice(0, 9)} : ses commits ne sont PAS exclus de la plage`,
      `plage inconnue : ni sha distant ni tronc — ${shas[2].slice(0, 9)} seul est jugé, sans ses parents`,
    ])
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})

// TROIS ISSUES, pas deux : `null` dit « l'objet demandé n'existe pas » (une pre-image de fichier
// AJOUTÉ, cas normal de cette porte) ; une INDISPONIBILITÉ de git est rendue à part, et l'appelant
// la NOMME. Les confondre refuse le push d'un fichier neuf, ou juge une plage jamais lue.
test('git INDISPONIBLE : `indisponible` porte la raison, et la plage est NOMMÉE', () => {
  const hors = mkdtempSync(join(tmpdir(), 'plage-hors-'))
  try {
    const vu = croissancesDeLaPlage({ cwd: hors, debut: 'aaaaaaa', fin: 'bbbbbbb' })
    assert.match(vu.indisponible, /not a git repository/i)
    assert.equal(vu.plage, 'aaaaaaa..bbbbbbb')
    assert.deepEqual(vu.refus, [])
  } finally {
    rmSync(hors, { recursive: true, force: true })
  }
})

test('une plage d’OBJETS ABSENTS dans un dépôt réel ne lève AUCUNE indisponibilité', () => {
  const { repo } = depotJetable([{ contenu: '// socle\n', message: 'socle' }])
  try {
    const vu = croissancesDeLaPlage({ cwd: repo, debut: 'aaaaaaa', fin: 'bbbbbbb' })
    assert.equal(vu.indisponible, null)
    assert.match(vu.notes.join(' '), /plage `aaaaaaa\.\.bbbbbbb` illisible/)
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})

// #1709 D1 — la classe qui a coûté TROIS runs de gates (2026-09-07) : la migration des marches
// d'arbre vers `readCorpus` (`6382c792d`, `cc71eb45c`) écrit un tableau de RACINES en ARGUMENT
// d'appel, et la plage le refusait comme « STOCK NOMINATIF qui GRANDIT ». Un argument est un
// paramètre. Le témoin de non-cécité est dans le même test : le stock RÉEL, lui, refuse toujours.
test('C : un tableau de RACINES passé en ARGUMENT ne fait grandir aucun stock, un vrai stock si', () => {
  const marche = [
    "import { readCorpus } from '../guards/lib/sourceCorpus.mjs'",
    "const SHEETS = readCorpus(['src/ui/styles'], { exts: ['.css'] })",
    "for (const { rel } of readCorpus(['src/ui'])) { void rel }",
  ].join('\n')
  const { repo, shas } = depotJetable([
    { contenu: '// socle\n', message: 'socle' },
    { contenu: `// socle\n${marche}\n`, message: 'marche migrée, SANS cliquet' },
    { contenu: `// socle\n${marche}\n${sourceStock([A, B])}`, message: 'deux exemptions, SANS cliquet' },
  ])
  try {
    assert.deepEqual(
      croissancesDeLaPlage({ cwd: repo, debut: shas[0], fin: shas[1] }).refus, [],
      'trois arguments d’appel : aucune entrée de stock',
    )
    const { refus } = croissancesDeLaPlage({ cwd: repo, debut: shas[1], fin: shas[2] })
    assert.deepEqual(
      refus.map((r) => [r.sha, r.fichier, r.net]), [[shas[2], PORTEUR, 2]],
      'le stock RÉEL reste vu — sans quoi la correction serait une cécité',
    )
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})

// #1720 — un renommage pur est un DÉPLACEMENT : chaque entrée retirée sous le chemin SOURCE
// s'apparie à son identique ajoutée sous le chemin CIBLE, et la plage rend net 0. Le témoin de
// non-cécité vit dans le même test : renommer ET ajouter une entrée vaut `+1`, sur le NOUVEAU chemin.
test('C : un `git mv` de porteur rend net 0 ; renommé PLUS une entrée reste +1', () => {
  const ancien = 'scripts/ancien.test.mjs'
  const nouveau = 'scripts/nouveau.test.mjs'
  const source = (entrees) => `export const STOCK = [\n${entrees.join('\n')}\n]\n`
  for (const [nom, ajoutees] of [['renommage pur', []], ['renommage + 1 entrée', [D]]]) {
    const { racine: repo, sha } = instanceDeDepot({ fichiers: { [ancien]: source([A, B, C]) }, message: 'socle' })
    const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
    try {
      git('mv', ancien, nouveau)
      if (ajoutees.length) writeFileSync(join(repo, nouveau), source([A, B, C, ...ajoutees]), 'utf8')
      git('add', '-A')
      git('commit', '-q', '--no-verify', '-m', 'refactor: le porteur change de nom')
      const { refus } = croissancesDeLaPlage({ cwd: repo, debut: sha, fin: git('rev-parse', 'HEAD').trim() })
      assert.deepEqual(
        refus.map((r) => [r.fichier, r.net]),
        ajoutees.length ? [[nouveau, 1]] : [],
        `${nom} : verdict de plage`,
      )
      if (ajoutees.length) assert.deepEqual(refus[0].exemples, [D.trim()], `${nom} : l'exemple est l'entrée AJOUTÉE`)
    } finally {
      rmSync(repo, { recursive: true, force: true })
    }
  }
})

test('C : un porteur SCINDÉ en deux ne grandit pas ; renommé MOINS une entrée non plus', () => {
  const ancien = 'scripts/ancien.test.mjs'
  const source = (entrees) => `export const STOCK = [\n${entrees.join('\n')}\n]\n`
  const cas = {
    'scission en deux porteurs neufs': { 'scripts/gauche.test.mjs': [A, B], 'scripts/droite.test.mjs': [C] },
    // Une DÉCROISSANCE ne se crédite nulle part : la porte ne rend que les croissances nettes, et
    // l'entrée perdue au passage n'ouvre aucun droit à en ajouter une ailleurs.
    'renommage moins une entrée': { 'scripts/nouveau.test.mjs': [A, B] },
  }
  for (const [nom, porteurs] of Object.entries(cas)) {
    const { racine: repo, sha } = instanceDeDepot({ fichiers: { [ancien]: source([A, B, C]) }, message: 'socle' })
    const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
    try {
      rmSync(join(repo, ancien))
      for (const [chemin, entrees] of Object.entries(porteurs)) writeFileSync(join(repo, chemin), source(entrees), 'utf8')
      git('add', '-A')
      git('commit', '-q', '--no-verify', '-m', 'refactor: le porteur se redistribue')
      const { refus } = croissancesDeLaPlage({ cwd: repo, debut: sha, fin: git('rev-parse', 'HEAD').trim() })
      assert.deepEqual(refus.map((r) => [r.fichier, r.net]), [], `${nom} : aucune entrée de plus`)
    } finally {
      rmSync(repo, { recursive: true, force: true })
    }
  }
})

// `--- ` n'est un EN-TÊTE que hors d'un hunk : DANS un hunk, une ligne de CONTENU retirée qui
// commence par `-- ` s'écrit `--- …` et reste un RETRAIT, qui garde son porteur comme les suivants.
// Le diff est PRODUIT PAR GIT, jamais fabriqué : la forme exacte fait le cas.
test('C : une ligne de contenu `-- …` retirée n\'est pas un en-tête de diff', async () => {
  const { croissanceDesStocks } = await import('./stocksNominatifs.mjs')
  const avant = `export const STOCK = [\n-- sentinelle\n${A}\n${B}\n]\n`
  const apres = "export const STOCK = [\n  'src/a.ts',\n]\n"
  const { racine: repo } = instanceDeDepot({ fichiers: { [PORTEUR]: avant }, message: 'socle' })
  const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
  try {
    writeFileSync(join(repo, PORTEUR), apres, 'utf8')
    git('add', '-A')
    const diff = git('diff', '--cached', '-U0', '--no-renames')
    assert.match(diff, /^-{3} sentinelle$/m, 'le diff doit bien porter la ligne retirée `--- sentinelle`')
    assert.deepEqual(
      croissanceDesStocks(diff, { lirePostImage: () => apres, lirePreImage: () => avant }),
      [], '`src/a.ts` retirée puis réécrite, `src/b.ts` retirée : aucune clé ne croît — lue comme en-tête, la sentinelle perdrait les retraits',
    )
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})

// ÉQUIVALENCE DES DEUX VOIES. Le garde de solde (au commit, images de l'arbre de travail) et la
// porte de plage (au push, images `git show <sha>:<f>`) doivent rendre le MÊME compte sur le MÊME
// contenu : c'est leur divergence APPARENTE qui a fait payer des cliquets mensongers.
test('équivalence — solde au commit et plage au push comptent la même chose', async (t) => {
  const { diffDuCommit, evaluateStocksQuiGrandissent } = await import('../../hooks/solde-ticket-guard.mjs')
  const porteur = PORTEUR
  const cas = {
    'argument d’appel': ["const S = readCorpus(['src/ui'])"],
    'stock de module': ['const S = [', "  'src/a.ts',", "  'src/b.ts',", ']'],
  }
  for (const [nom, ajout] of Object.entries(cas)) {
    const { racine } = instanceDeDepot({ fichiers: { [porteur]: '// socle\n' }, message: 'socle' })
    const gitDe = (...args) => execFileSync('git', args, { cwd: racine, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
    try {
      writeFileSync(join(racine, porteur), `// socle\n${ajout.join('\n')}\n`, 'utf8')
      gitDe('add', '-A')
      const commande = 'git commit -m "test: sans cliquet"'
      const lectures = diffDuCommit(commande, racine)
      const auCommit = evaluateStocksQuiGrandissent({
        command: commande,
        diff: lectures.diff([porteur]),
        images: { lirePostImage: lectures.contenu, lirePreImage: lectures.avant },
      })
      const base = gitDe('rev-parse', 'HEAD').trim()
      gitDe('commit', '-q', '--no-verify', '-m', 'test: sans cliquet')
      const auPush = croissancesDeLaPlage({ cwd: racine, debut: base, fin: gitDe('rev-parse', 'HEAD').trim() })
      assert.equal(auPush.indisponible, null, `${nom} : plage illisible`)
      assert.equal(
        auCommit === null, auPush.refus.length === 0,
        `${nom} : les deux voies divergent — commit ${auCommit ? 'refuse' : 'passe'}, push ${auPush.refus.length ? 'refuse' : 'passe'}`,
      )
      const attenduRefus = nom === 'stock de module'
      assert.equal(auPush.refus.length > 0, attenduRefus, `${nom} : verdict de plage`)
      if (attenduRefus) assert.equal(auPush.refus[0].net, 2, `${nom} : compte de plage`)
    } finally {
      rmSync(racine, { recursive: true, force: true })
    }
  }
  t.diagnostic('deux voies, deux cas, même verdict')
})

// #1709 D3 — sonde 3 de la revue de palier du 2026-09-08, promue sur un dépôt RÉEL : un
// `*-stock.json` qui NAÎT. Ses entrées vivent sur des propriétés (`"sites": [ … ]`) qu'aucune
// lecture par ligne ne reconnaît : seule une IMAGE les compte. Les deux portes en ont une — l'arbre
// de travail au commit, `git show <sha>:<f>` au push — et rendent le même compte ; un appelant qui
// n'en fournit aucune est REFUSÉ, jamais servi d'un zéro.
test('équivalence — un `*-stock.json` qui NAÎT, puis qui GRANDIT : même compte aux deux portes', async (t) => {
  const { croissanceDesStocks } = await import('./stocksNominatifs.mjs')
  const { diffDuCommit, evaluateStocksQuiGrandissent } = await import('../../hooks/solde-ticket-guard.mjs')
  const porteur = 'scripts/raw/fixture-stock.json'
  const trous = (n) => Array.from({ length: n }, (_, i) => [`LIV ${i + 1}`, [`src/data/x${i + 1}.json`]])
  const stock = (entrees) => [
    '{',
    '  "quoi": "fixture — un trou dur par rubrique",',
    '  "trous": {',
    entrees.map(([cle, sites]) => [
      `    "${cle}": {`,
      `      "sites": [${sites.map((s) => `"${s}"`).join(', ')}],`,
      '      "lot": "#1709 D3"',
      '    }',
    ].join('\n')).join(',\n'),
    '  }',
    '}',
    '',
  ].join('\n')

  const { racine } = instanceDeDepot({ fichiers: { 'scripts/raw/socle.md': '# socle\n' }, message: 'socle' })
  const gitDe = (...args) => execFileSync('git', args, { cwd: racine, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
  const poser = (entrees) => { writeFileSync(join(racine, porteur), stock(entrees), 'utf8'); gitDe('add', '-A') }
  const auPush = (debut) => croissancesDeLaPlage({ cwd: racine, debut, fin: gitDe('rev-parse', 'HEAD').trim() })
  const auCommit = (commande) => {
    const lectures = diffDuCommit(commande, racine)
    return {
      verdict: evaluateStocksQuiGrandissent({
        command: commande,
        diff: lectures.diff([porteur]),
        images: { lirePostImage: lectures.contenu, lirePreImage: lectures.avant },
      }),
      diff: lectures.diff([porteur]),
    }
  }
  try {
    // NAISSANCE de 13 entrées, message muet : les deux portes refusent, et le compte est le VRAI.
    const base = gitDe('rev-parse', 'HEAD').trim()
    poser(trous(13))
    const naissance = auCommit('git commit -m "test: un stock qui naît"')
    assert.match(naissance.verdict?.reason ?? '', /\+13 entrée\(s\) nette\(s\)/, 'porte au commit : le compte de la naissance')
    assert.deepEqual(
      croissanceDesStocks(naissance.diff, { lirePostImage: (f) => readFileSync(join(racine, f), 'utf8') })
        .map((c) => c.net), [13],
      'troisième lecture, image de l’arbre : le même compte que les deux portes',
    )
    assert.throws(
      () => croissanceDesStocks(naissance.diff),
      /aucun lecteur d'image post — un compte sans image ment/,
      'un appelant sans lecteur (diagnostic, sonde, revue) est REFUSÉ, jamais servi d’un zéro qui ment',
    )
    gitDe('commit', '-q', '--no-verify', '-m', 'test: un stock qui naît')
    assert.deepEqual(auPush(base).refus.map((r) => [r.fichier, r.net]), [[porteur, 13]], 'porte au push : le même compte')

    // CROISSANCE de deux entrées sur les treize, DITE par le message : les deux portes passent.
    const debut = gitDe('rev-parse', 'HEAD').trim()
    poser(trous(15))
    const message = 'test: deux trous durs de plus\n\nCLIQUET: scripts/raw/fixture-stock.json +2 — deux chapitres non couverts par l’Atlas'
    const croissance = auCommit(`git commit -m "${message}"`)
    assert.equal(croissance.verdict, null, 'porte au commit : la croissance est DITE, elle passe')
    assert.deepEqual(
      croissanceDesStocks(croissance.diff, { lirePostImage: (f) => readFileSync(join(racine, f), 'utf8') })
        .map((c) => c.net), [2],
      'témoin de non-vacuité : la croissance vaut bien +2 — sans le cliquet, le verdict serait un refus',
    )
    gitDe('commit', '-q', '--no-verify', '-m', message)
    assert.deepEqual(auPush(debut).refus, [], 'porte au push : le cliquet du message couvre la croissance')
    t.diagnostic('naissance +13, croissance +2, trois lectures concordantes')
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

// ── RECLASSEMENT CSS (#1806 D1″-D3″) : chaque commit contre sa base, aux deux voies ─────────────

const MANIFESTE = 'src/data/primitives.manifest.json'
const CONSOLE = 'src/ui/styles/console.css'
const COMPOSANT = 'src/ui/Console.tsx'
const ECRAN1 = 'src/ui/Ecran1.tsx'
const manifesteAvec = (...entrees) => `${JSON.stringify([{ id: 'a' }, ...entrees])}\n`
const PRIMITIVE_CONSOLE = { id: 'console', fichier: COMPOSANT, css: CONSOLE }
const RECLASSE = `refactor: console réutilisée\n\nRECLASSEMENT: ${CONSOLE} +3 — la console devient une primitive, refs #1806`
const importeur = (nom) => `import { Console } from './Console'\nexport const ${nom} = Console\n`

/** Dépôt jetable : la console est revendiquée au manifeste, mais UN seul écran l'importe — son
 *  module est au stock (#1806 L1). */
function depotCss() {
  const { racine, sha } = instanceDeDepot({
    fichiers: {
      [MANIFESTE]: manifesteAvec(PRIMITIVE_CONSOLE),
      [CONSOLE]: '.c { color: red; border: 0; gap: 3px }\n',
      [COMPOSANT]: 'export const Console = 1\n',
      [ECRAN1]: importeur('Ecran1'),
    },
    message: 'socle',
  })
  const git = (...args) => execFileSync('git', args, { cwd: racine, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
  const commettre = (fichiers, message) => {
    for (const [f, texte] of Object.entries(fichiers)) {
      if (texte === null) git('rm', '-q', f)
      else writeFileSync(join(racine, f), texte, 'utf8')
    }
    git('add', '-A')
    git('commit', '-q', '--no-verify', '-m', message)
    return git('rev-parse', 'HEAD').trim()
  }
  return { racine, base: sha, git, commettre }
}

test('RECLASSEMENT : un SECOND importeur fait franchir la console — refusé sans ligne, la ligne exacte passe', () => {
  const { racine, base, commettre } = depotCss()
  try {
    const muet = commettre({ 'src/ui/Ecran2.tsx': importeur('Ecran2') }, 'feat: second écran')
    assert.deepEqual(croissancesDeLaPlage({ cwd: racine, debut: base, fin: muet }).reclassements,
      [{ sha: muet, ecarts: [{ module: CONSOLE, n: 3, declare: null }] }])
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
  const d = depotCss()
  try {
    const dit = d.commettre({ 'src/ui/Ecran2.tsx': importeur('Ecran2') }, RECLASSE)
    assert.deepEqual(croissancesDeLaPlage({ cwd: d.racine, debut: d.base, fin: dit }).reclassements, [])
  } finally {
    rmSync(d.racine, { recursive: true, force: true })
  }
})

test('RECLASSEMENT (D3″) : franchie puis rendue au stock dans la plage — le PREMIER commit reste refusé, le second n’a rien à dire', () => {
  const { racine, base, commettre } = depotCss()
  try {
    const c1 = commettre({ 'src/ui/Ecran2.tsx': importeur('Ecran2') }, 'feat: second écran')
    const c2 = commettre({ 'src/ui/Ecran2.tsx': null }, 'revert: un seul écran')
    const { reclassements } = croissancesDeLaPlage({ cwd: racine, debut: base, fin: c2 })
    assert.deepEqual(reclassements, [{ sha: c1, ecarts: [{ module: CONSOLE, n: 3, declare: null }] }])
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('équivalence — RECLASSEMENT au commit et à la plage : même verdict', async () => {
  const { diffDuCommit, evaluateReclassementsCss } = await import('../../hooks/solde-ticket-guard.mjs')
  for (const message of ['feat: second écran', RECLASSE]) {
    const { racine, base, git } = depotCss()
    try {
      writeFileSync(join(racine, 'src/ui/Ecran2.tsx'), importeur('Ecran2'), 'utf8')
      git('add', '-A')
      const commande = `git commit -m "${message}"`
      const auCommit = evaluateReclassementsCss({
        command: commande,
        deplace: () => diffDuCommit(commande, racine).deplaceLaFrontiereCss(['src/ui/Ecran2.tsx']),
        cotes: diffDuCommit(commande, racine).cotesCss,
      })
      git('commit', '-q', '--no-verify', '-m', message)
      const auPush = croissancesDeLaPlage({ cwd: racine, debut: base, fin: git('rev-parse', 'HEAD').trim() })
      assert.equal(auCommit === null, auPush.reclassements.length === 0, `${message} : les deux voies divergent`)
      assert.equal(auCommit === null, message === RECLASSE, `${message} : verdict`)
      if (auCommit) assert.ok(auCommit.reason.includes(`${CONSOLE} : franchi au prix 3, aucune ligne`), auCommit.reason)
    } finally {
      rmSync(racine, { recursive: true, force: true })
    }
  }
})

test('RECLASSEMENT : le renommage PUR d’une primitive réutilisée ne fait franchir aucun module — ni au commit, ni à la plage', async () => {
  const { diffDuCommit, evaluateReclassementsCss } = await import('../../hooks/solde-ticket-guard.mjs')
  const { racine, git, commettre } = depotCss()
  try {
    const reutilisee = commettre({ 'src/ui/Ecran2.tsx': importeur('Ecran2') }, RECLASSE)
    git('mv', COMPOSANT, 'src/ui/Pupitre.tsx')
    const pupitre = (nom) => `import { Console } from './Pupitre'\nexport const ${nom} = Console\n`
    writeFileSync(join(racine, ECRAN1), pupitre('Ecran1'), 'utf8')
    writeFileSync(join(racine, 'src/ui/Ecran2.tsx'), pupitre('Ecran2'), 'utf8')
    writeFileSync(join(racine, MANIFESTE), manifesteAvec({ ...PRIMITIVE_CONSOLE, fichier: 'src/ui/Pupitre.tsx' }), 'utf8')
    git('add', '-A')
    const commande = 'git commit -m "refactor: la console devient le pupitre"'
    const commit = diffDuCommit(commande, racine)
    assert.equal(evaluateReclassementsCss({ command: commande, deplace: () => commit.deplaceLaFrontiereCss([MANIFESTE, ECRAN1]), cotes: commit.cotesCss }), null)
    git('commit', '-q', '--no-verify', '-m', 'refactor: la console devient le pupitre')
    const renomme = git('rev-parse', 'HEAD').trim()
    assert.deepEqual(croissancesDeLaPlage({ cwd: racine, debut: reutilisee, fin: renomme }).reclassements, [])
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

/** Le dépôt CSS où `chantier` fusionne `main` : `main` pose `surMain` (message `messageMain`), `chantier`
 *  pose un fichier sans rapport, puis la fusion ajoute `dansLaFusion` à ce que git a fusionné seul. */
function fusionCss({ surMain, messageMain, dansLaFusion = {} }) {
  const d = depotCss()
  d.git('checkout', '-q', '-b', 'chantier')
  const debut = d.commettre({ 'notes.txt': 'travail du chantier\n' }, 'docs: notes du chantier')
  d.git('checkout', '-q', 'main')
  d.commettre(surMain, messageMain)
  d.git('checkout', '-q', 'chantier')
  d.git('merge', '-q', '--no-ff', '--no-commit', 'main')
  const fusion = d.commettre(dansLaFusion, 'fusion de main')
  return { ...d, debut, fusion }
}

test('RECLASSEMENT d’une FUSION : ce que main a fait franchir n’est pas à elle — même quand la fusion touche le manifeste', () => {
  for (const dansLaFusion of [{}, { [MANIFESTE]: manifesteAvec(PRIMITIVE_CONSOLE, { id: 'b' }) }]) {
    const { racine, debut, fusion } = fusionCss({ surMain: { 'src/ui/Ecran2.tsx': importeur('Ecran2') }, messageMain: RECLASSE, dansLaFusion })
    try {
      assert.deepEqual(croissancesDeLaPlage({ cwd: racine, debut, fin: fusion }).reclassements, [], JSON.stringify(Object.keys(dansLaFusion)))
    } finally {
      rmSync(racine, { recursive: true, force: true })
    }
  }
})

test('RECLASSEMENT d’une FUSION « maléfique » : le franchissement qu’elle pose elle-même est refusé, et nommé', () => {
  const { racine, debut, fusion } = fusionCss({
    surMain: { 'main.txt': 'main avance\n' },
    messageMain: 'docs: main avance',
    dansLaFusion: { 'src/ui/Ecran2.tsx': importeur('Ecran2') },
  })
  try {
    assert.deepEqual(croissancesDeLaPlage({ cwd: racine, debut, fin: fusion }).reclassements,
      [{ sha: fusion, ecarts: [{ module: CONSOLE, n: 3, declare: null }] }])
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

// Un chemin non-ASCII, que la forme ligne de git CITE (`core.quotePath`) : `"src/ui/\303\211cran.tsx"`.
const ECRAN_ACCENTUE = 'src/ui/Écran.tsx'

test('RECLASSEMENT : le second importeur au chemin NON-ASCII fait franchir la console — à la plage', () => {
  const { racine, commettre } = depotCss()
  try {
    const debut = commettre({ [ECRAN_ACCENTUE]: 'export const E = 1\n' }, 'feat: écran nu')
    const muet = commettre({ [ECRAN_ACCENTUE]: importeur('E') }, 'feat: l’écran importe la console')
    assert.deepEqual(croissancesDeLaPlage({ cwd: racine, debut, fin: muet }).reclassements,
      [{ sha: muet, ecarts: [{ module: CONSOLE, n: 3, declare: null }] }])
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('RECLASSEMENT au commit : chaque FORME lit l’arbre que le commit emporte — index, pathspec, `-a` — chemin non-ASCII compris', async () => {
  const { analyzeDiffDuCommit, diffDuCommit } = await import('../../hooks/solde-ticket-guard.mjs')
  const AUTRE = 'src/ui/Autre.tsx'
  const NEUF = 'src/ui/Neuf.tsx'
  /** Console importée par PERSONNE au socle : un seul importeur emporté ne la réutilise pas, deux oui. */
  const juger = ({ ecrire, indexer = [], commande }) => {
    const { racine } = instanceDeDepot({
      fichiers: {
        [MANIFESTE]: manifesteAvec(PRIMITIVE_CONSOLE), [CONSOLE]: '.c { color: red }\n', [COMPOSANT]: 'export const Console = 1\n',
        [ECRAN_ACCENTUE]: 'export const E = 1\n', [AUTRE]: 'export const A = 1\n',
      },
      message: 'socle',
    })
    try {
      for (const f of ecrire) writeFileSync(join(racine, f), importeur(f.slice(7, -4)), 'utf8')
      if (indexer.length) execFileSync('git', ['add', '--', ...indexer], { cwd: racine, stdio: 'ignore' })
      const c = diffDuCommit(commande, racine)
      const { fichiers } = analyzeDiffDuCommit(c.numstat())
      return { fichiers: fichiers.sort(), deplace: c.deplaceLaFrontiereCss(fichiers), reutilises: [...c.cotesCss().commit.reutilises] }
    } finally {
      rmSync(racine, { recursive: true, force: true })
    }
  }
  assert.deepEqual(juger({ ecrire: [ECRAN_ACCENTUE, AUTRE], indexer: [ECRAN_ACCENTUE], commande: 'git commit -m "x"' }),
    { fichiers: [ECRAN_ACCENTUE], deplace: true, reutilises: [] }, 'index : `Autre` non indexé reste au socle')
  assert.deepEqual(juger({ ecrire: [ECRAN_ACCENTUE, AUTRE], indexer: [ECRAN_ACCENTUE, AUTRE], commande: 'git commit -m "x"' }),
    { fichiers: [AUTRE, ECRAN_ACCENTUE].sort(), deplace: true, reutilises: [COMPOSANT] }, 'index : les deux indexés')
  assert.deepEqual(juger({ ecrire: [ECRAN_ACCENTUE, AUTRE], indexer: [AUTRE], commande: `git commit -m "x" -- ${ECRAN_ACCENTUE}` }),
    { fichiers: [ECRAN_ACCENTUE], deplace: true, reutilises: [] }, 'pathspec : `Autre`, indexé mais hors pathspec, est lu à HEAD')
  assert.deepEqual(juger({ ecrire: [ECRAN_ACCENTUE, AUTRE], commande: `git commit -m "x" -- ${ECRAN_ACCENTUE} ${AUTRE}` }),
    { fichiers: [AUTRE, ECRAN_ACCENTUE].sort(), deplace: true, reutilises: [COMPOSANT] }, 'pathspec : les deux dans le pathspec, lus sur le disque')
  assert.deepEqual(juger({ ecrire: [ECRAN_ACCENTUE, NEUF], commande: 'git commit -a -m "x"' }),
    { fichiers: [ECRAN_ACCENTUE], deplace: true, reutilises: [] }, '`-a` : le non-suivi `Neuf` n’est pas emporté')
  assert.deepEqual(juger({ ecrire: [ECRAN_ACCENTUE, AUTRE], commande: 'git commit -a -m "x"' }),
    { fichiers: [AUTRE, ECRAN_ACCENTUE].sort(), deplace: true, reutilises: [COMPOSANT] }, '`-a` : les suivis modifiés, lus sur le disque')
})

test('RECLASSEMENT (D3″) : un rebase qui fait disparaître le franchissement rend la ligne INVALIDE — refus bruyant', () => {
  const vide = { manifeste: [], partagees: [], reutilises: new Set(), lire: () => null }
  const commits = [{ sha: 'c1'.padEnd(40, '0'), message: RECLASSE, cotes: () => ({ base: vide, commit: vide }) }]
  assert.deepEqual(reclassementsDeLaPlage({ commits }), [{ sha: commits[0].sha, ecarts: [{ module: CONSOLE, n: null, declare: 3 }] }])
  const horsFrontiere = [{ ...commits[0], cotes: () => null }]
  assert.deepEqual(reclassementsDeLaPlage({ commits: horsFrontiere }), [{ sha: commits[0].sha, ecarts: [{ module: CONSOLE, n: null, declare: 3 }] }],
    'un commit qui ne touche pas la frontière et porte une ligne est refusé aussi')
  assert.deepEqual(reclassementsDeLaPlage({ commits: [{ ...horsFrontiere[0], message: 'docs' }] }), [])
})

test('RECLASSEMENT : manifeste ILLISIBLE → refus NOMMÉ par son commit, jamais une levée qui emporterait les autres refus', () => {
  const { racine, sha } = instanceDeDepot({ fichiers: { 'a.txt': 'a\n' }, message: 'socle' })
  const git = (...args) => execFileSync('git', args, { cwd: racine, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
  try {
    mkdirSync(join(racine, dirname(MANIFESTE)), { recursive: true })
    writeFileSync(join(racine, MANIFESTE), '{pas du json\n', 'utf8')
    git('add', MANIFESTE)
    git('commit', '-q', '--no-verify', '-m', 'feat')
    const c1 = git('rev-parse', 'HEAD').trim()
    const lu = croissancesDeLaPlage({ cwd: racine, debut: sha, fin: c1 })
    assert.deepEqual(lu.reclassements.map((r) => [r.sha, /primitives\.manifest\.json illisible/.test(r.illisible)]), [[c1, true]])
    assert.deepEqual(lu.refus, [])
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

// #1806 D1 — le porteur au chemin NON-ASCII, lu dans les en-têtes du patch `-U0` de chaque commit et
// du cumul : aucun `-z` n'y existe, l'hôte (`gitPorte.mjs`) les rend en clair.
test('PLAGE : un stock au chemin NON-ASCII qui grandit sans CLIQUET est refusé', () => {
  const porteur = 'src/ui/Écran.test.ts'
  const { racine, sha } = instanceDeDepot({ fichiers: { [porteur]: `export const STOCK = [\n${A}\n]\n` }, message: 'socle' })
  const git = (...args) => execFileSync('git', args, { cwd: racine, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
  try {
    writeFileSync(join(racine, porteur), `export const STOCK = [\n${A}\n${B}\n]\n`, 'utf8')
    git('commit', '-q', '--no-verify', '-am', 'feat: une exemption de plus')
    const fin = git('rev-parse', 'HEAD').trim()
    assert.deepEqual(croissancesDeLaPlage({ cwd: racine, debut: sha, fin }).refus.map((r) => [r.fichier, r.net]), [[porteur, 1]])
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

// ── CLIQUET par clé (#1806 D5″) sur une plage réelle ────────────────────────────────────────────

test('CLIQUET (D5″) : le renommage PUR d’un fichier cité par un stock coûte 0 ; la même réécriture sans renommage coûte +1', () => {
  const { racine, sha } = instanceDeDepot({
    fichiers: { [PORTEUR]: `export const STOCK = [\n${A}\n${B}\n]\n`, 'src/a.ts': 'export const a = 1\n'.repeat(20) },
    message: 'socle',
  })
  const git = (...args) => execFileSync('git', args, { cwd: racine, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
  try {
    git('mv', 'src/a.ts', 'src/z.ts')
    writeFileSync(join(racine, PORTEUR), `export const STOCK = [\n  'src/z.ts',\n${B}\n]\n`, 'utf8')
    git('add', '-A')
    git('commit', '-q', '--no-verify', '-m', 'refactor: a devient z')
    const renomme = git('rev-parse', 'HEAD').trim()
    assert.deepEqual(croissancesDeLaPlage({ cwd: racine, debut: sha, fin: renomme }).refus, [])
    writeFileSync(join(racine, PORTEUR), `export const STOCK = [\n  'src/z.ts',\n  'src/y.ts',\n]\n`, 'utf8')
    git('add', '-A')
    git('commit', '-q', '--no-verify', '-m', 'refactor: b devient y, sans renommage')
    const reecrit = git('rev-parse', 'HEAD').trim()
    assert.deepEqual(croissancesDeLaPlage({ cwd: racine, debut: renomme, fin: reecrit }).refus.map((r) => [r.fichier, r.net]), [[PORTEUR, 1]])
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

// ── Les FUSIONS se lisent par ce qu'elles font (`ceQueFaitLeCommit`, contre leur base) ─────

/** Dépôt jetable dont `main` fusionne une branche `cote`. La branche fait grandir le stock sous son
 *  CLIQUET ; `retouche` (texte du porteur posé DANS la fusion, ou `null`) rend la fusion maléfique. */
function depotAFusion(retouche) {
  const { racine: repo, sha: socle } = instanceDeDepot({ fichiers: { [PORTEUR]: sourceStock([A]), 'autre.txt': 'o\n' }, message: 'socle' })
  const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
  git('checkout', '-q', '-b', 'cote')
  writeFileSync(join(repo, PORTEUR), sourceStock([A, B]), 'utf8')
  git('commit', '-q', '--no-verify', '-am', 'cote\n\nCLIQUET: scripts/x.test.mjs +1 — fixture du test neuf, motif assez long')
  git('checkout', '-q', 'main')
  writeFileSync(join(repo, 'autre.txt'), 'o\np\n', 'utf8')
  git('commit', '-q', '--no-verify', '-am', 'main')
  git('merge', '-q', '--no-ff', '--no-commit', 'cote')
  if (retouche !== null) {
    writeFileSync(join(repo, PORTEUR), retouche, 'utf8')
    git('add', PORTEUR)
  }
  git('commit', '-q', '--no-verify', '-m', 'fusion de cote')
  return { repo, socle, fusion: git('rev-parse', 'HEAD').trim() }
}

test('PLAGE : une fusion PROPRE ne rejuge pas la croissance cliquetée de la branche qu’elle amène', () => {
  const { repo, socle, fusion } = depotAFusion(null)
  try {
    const vu = croissancesDeLaPlage({ cwd: repo, debut: socle, fin: fusion })
    assert.equal(vu.commits, 3, 'la fusion est dans la plage, avec ses deux parents')
    assert.deepEqual(vu.refus, [])
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})

test('PLAGE : une fusion « maléfique » qui fait grandir un stock en fusionnant est refusée, et nommée', () => {
  const { repo, socle, fusion } = depotAFusion(sourceStock([A, B, C]))
  try {
    const { refus } = croissancesDeLaPlage({ cwd: repo, debut: socle, fin: fusion })
    assert.deepEqual(refus.map((r) => [r.sha, r.fichier, r.net]), [[fusion, PORTEUR, 1]])
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})

test('PLAGE : une fusion qui RÉÉCRIT une entrée amenée par la branche ne grandit rien — sa base est la fusion automatique', () => {
  const { repo, socle, fusion } = depotAFusion(sourceStock([A, "  'src/b.ts', // retouchée à la fusion"]))
  try {
    assert.deepEqual(croissancesDeLaPlage({ cwd: repo, debut: socle, fin: fusion }).refus, [])
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})

test('PLAGE : une FUSION lue par un git plus ancien que 2.40 rend la plage INDISPONIBLE, nommée, sans rien juger', () => {
  const { repo, socle, fusion } = depotAFusion(null)
  try {
    const vu = sousGitFeint([{ si: ['version'], status: 0, stdout: 'git version 2.39.2\n' }], () => croissancesDeLaPlage({ cwd: repo, debut: socle, fin: fusion }))
    assert.match(vu.indisponible, /git 2\.39 ne sait pas git merge-tree --write-tree --stdin/)
    assert.deepEqual([vu.refus, vu.reclassements], [[], []])
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})

// ── La plage d'un PUSH ne rejuge pas le TRONC (#1806, stocks-nominatifs.test.mjs:33-36) ────────────

const A_BIS = "  'src/a.ts', // bis"

/** Dépôt jetable : `chantier` (déjà poussée à `debut`) fusionne un `main` qui a bougé, puis porte un
 *  commit propre. `surMain` = le porteur posé par le commit du tronc ; `dansLaFusion` = le porteur
 *  posé en RÉSOLVANT (`null` : fusion propre) ; `avant` et `apres` = le porteur des commits de la
 *  branche avant et après la fusion. `refs/remotes/origin/main` = la tête du tronc. */
function depotATronc({ surMain, dansLaFusion = null, avant = null, apres = null }) {
  const { racine: repo, sha: debut } = instanceDeDepot({ fichiers: { [PORTEUR]: sourceStock([A, B, C, D]) }, message: 'socle' })
  const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
  const commettre = (contenu, message) => {
    writeFileSync(join(repo, PORTEUR), contenu, 'utf8')
    git('commit', '-q', '--no-verify', '-am', message)
    return git('rev-parse', 'HEAD').trim()
  }
  git('checkout', '-q', '-b', 'chantier')
  git('checkout', '-q', 'main')
  const duTronc = commettre(surMain, 'tronc, sans cliquet')
  git('update-ref', 'refs/remotes/origin/main', duTronc)
  git('checkout', '-q', 'chantier')
  const avantFusion = avant === null ? null : commettre(avant, 'chantier avant fusion, sans cliquet')
  git('merge', '-q', '--no-ff', '--no-commit', 'main')
  if (dansLaFusion !== null) {
    writeFileSync(join(repo, PORTEUR), dansLaFusion, 'utf8')
    git('add', PORTEUR)
  }
  git('commit', '-q', '--no-verify', '-m', 'fusion du tronc')
  const fusion = git('rev-parse', 'HEAD').trim()
  if (apres !== null) commettre(apres, 'chantier après fusion, sans cliquet')
  return { repo, debut, duTronc, avantFusion, fusion, fin: git('rev-parse', 'HEAD').trim() }
}

const CHANTIER = 'refs/heads/chantier'
const juge = (d) => croissancesDeLaPlage({ cwd: d.repo, debut: d.debut, fin: d.fin, vers: CHANTIER })
const refusDe = (vu) => vu.refus.map((r) => [r.sha, r.fichier, r.net])

test('TRONC : le commit du tronc fusionné n’est pas rejugé ; le commit propre à la branche est refusé', () => {
  const d = depotATronc({ surMain: sourceStock([A, B, C, D, "  'src/e.ts',"]), apres: sourceStock([A, B, C, D, "  'src/e.ts',", "  'src/f.ts',"]) })
  try {
    const vu = juge(d)
    assert.equal(vu.commits, 2, 'la fusion et le commit de branche : rien du tronc')
    assert.deepEqual(refusDe(vu), [[d.fin, PORTEUR, 1]])
  } finally {
    rmSync(d.repo, { recursive: true, force: true })
  }
})

test('TRONC : une fusion dont la RÉSOLUTION ajoute au stock sans sa ligne est refusée', () => {
  const d = depotATronc({ surMain: sourceStock([A, B, C, D, "  'src/e.ts',"]), dansLaFusion: sourceStock([A, B, C, D, "  'src/e.ts',", "  'src/f.ts',"]) })
  try {
    assert.deepEqual(refusDe(juge(d)), [[d.fusion, PORTEUR, 1]])
  } finally {
    rmSync(d.repo, { recursive: true, force: true })
  }
})

// Le tronc RETIRE une entrée, la branche en ajoute une sous la MÊME clé sans cliquet : le cumul
// retranche ce que le tronc a changé, la clé reste à +1 et le commit de branche est refusé.
test('TRONC : une baisse faite par le tronc ne paie pas la croissance non déclarée de la branche', () => {
  const d = depotATronc({ surMain: sourceStock([B, C, D]), avant: sourceStock([A, B, C, D, A_BIS]) })
  try {
    assert.deepEqual(refusDe(juge(d)), [[d.avantFusion, PORTEUR, 1]])
  } finally {
    rmSync(d.repo, { recursive: true, force: true })
  }
})

test('TRONC : un push VERS le tronc juge ses commits, et le dit', () => {
  const { racine: repo, sha: debut } = instanceDeDepot({ fichiers: { [PORTEUR]: sourceStock([A]) }, message: 'socle' })
  const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
  try {
    writeFileSync(join(repo, PORTEUR), sourceStock([A, B]), 'utf8')
    git('commit', '-q', '--no-verify', '-am', 'tronc, sans cliquet')
    const fin = git('rev-parse', 'HEAD').trim()
    git('update-ref', 'refs/remotes/origin/main', fin)
    const vu = croissancesDeLaPlage({ cwd: repo, debut, fin, vers: TRONC.branche })
    assert.deepEqual([vu.commits, refusDe(vu)], [1, [[fin, PORTEUR, 1]]], '`origin/main` = `fin` (la CI après fetch) n’efface rien')
    assert.deepEqual(vu.notes, ["push vers le tronc (`refs/heads/main`) : `debut` est le tronc d'avant, rien d'autre n'est exclu"])
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})

test('TRONC : un tronc ILLISIBLE est nommé, et n’exclut rien', () => {
  const d = depotATronc({ surMain: sourceStock([A, B, C, D, "  'src/e.ts',"]), apres: sourceStock([A, B, C, D, "  'src/e.ts',", "  'src/f.ts',"]) })
  try {
    execFileSync('git', ['update-ref', '-d', 'refs/remotes/origin/main'], { cwd: d.repo, stdio: 'ignore' })
    const vu = juge(d)
    assert.deepEqual(vu.notes, [`tronc \`origin/main\` illisible depuis ${d.fin.slice(0, 9)} : ses commits ne sont PAS exclus de la plage`])
    assert.equal(vu.commits, 3, 'le commit du tronc est jugé, et la note le dit')
  } finally {
    rmSync(d.repo, { recursive: true, force: true })
  }
})

// ── Le cumul est un bilan d'ÉTATS : un changement porté par deux parents compte une fois ─────────

/** Dépôt jetable dont `origin/main` reste au socle ; `poser(fichiers, message)` écrit (`null` =
 *  supprime) puis commet, et rend le sha. */
function depotDeChantier(fichiers) {
  const { racine: repo, sha: debut } = instanceDeDepot({ fichiers, message: 'socle' })
  const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
  git('update-ref', 'refs/remotes/origin/main', debut)
  git('checkout', '-q', '-b', 'chantier')
  const poser = (aPoser, message) => {
    for (const [rel, texte] of Object.entries(aPoser)) {
      if (texte === null) git('rm', '-q', rel)
      else {
        mkdirSync(dirname(join(repo, rel)), { recursive: true })
        writeFileSync(join(repo, rel), texte, 'utf8')
        git('add', rel)
      }
    }
    git('commit', '-q', '--no-verify', '--allow-empty', '-m', message)
    return git('rev-parse', 'HEAD').trim()
  }
  return { repo, debut, git, poser, plage: (fin) => croissancesDeLaPlage({ cwd: repo, debut, fin, vers: CHANTIER }) }
}

/** Branche latérale `x` partie de `debut` qui commet `aPoser`, fusionnée proprement dans `chantier`. */
function fusionLaterale(d, aPoser) {
  d.git('checkout', '-q', '-b', 'x', d.debut)
  d.poser(aPoser, 'latérale (même changement)')
  d.git('checkout', '-q', 'chantier')
  d.git('merge', '-q', '--no-ff', '--no-verify', '-m', 'fusion latérale', 'x')
}

test('CUMUL (E) : un retrait porté par les DEUX parents d’une fusion ne paie pas deux ajouts non déclarés', () => {
  const d = depotDeChantier({ [PORTEUR]: sourceStock([A, B]) })
  try {
    d.poser({ [PORTEUR]: sourceStock([B]) }, 'retire A')
    fusionLaterale(d, { [PORTEUR]: sourceStock([B]) })
    const fin = d.poser({ [PORTEUR]: sourceStock([B, A_BIS, "  'src/a.ts', // ter"]) }, 'deux sous a, sans cliquet')
    assert.deepEqual(refusDe(d.plage(fin)), [[fin, PORTEUR, 2]])
  } finally {
    rmSync(d.repo, { recursive: true, force: true })
  }
})

test('CUMUL (E2) : un ajout porté par les DEUX parents puis retiré une fois ne refuse rien', () => {
  const d = depotDeChantier({ [PORTEUR]: sourceStock([B]) })
  try {
    d.poser({ [PORTEUR]: sourceStock([A, B]) }, 'ajoute A')
    fusionLaterale(d, { [PORTEUR]: sourceStock([A, B]) })
    const fin = d.poser({ [PORTEUR]: sourceStock([B]) }, 'retire A')
    assert.deepEqual(d.plage(fin).refus, [])
  } finally {
    rmSync(d.repo, { recursive: true, force: true })
  }
})

test('CUMUL (B) : une clé renommée sur deux commits (`git mv`, puis le stock suit) ne grandit rien', () => {
  const d = depotDeChantier({ [PORTEUR]: sourceStock([A]), 'src/a.ts': 'export const a = 1\n' })
  try {
    d.git('mv', 'src/a.ts', 'src/z.ts')
    d.poser({}, 'git mv a -> z')
    const fin = d.poser({ [PORTEUR]: sourceStock(["  'src/z.ts',"]) }, 'le stock suit')
    assert.deepEqual(d.plage(fin).refus, [])
  } finally {
    rmSync(d.repo, { recursive: true, force: true })
  }
})

test('CUMUL (C) : un stock DÉPLACÉ d’un porteur à un autre sur deux commits ne grandit rien', () => {
  const P2 = 'scripts/y.test.mjs'
  const d = depotDeChantier({ [PORTEUR]: sourceStock([A, B]) })
  try {
    d.poser({ [PORTEUR]: null }, 'supprime le porteur')
    const fin = d.poser({ [P2]: sourceStock([A, B]) }, 'recrée le porteur ailleurs')
    assert.deepEqual(d.plage(fin).refus, [])
  } finally {
    rmSync(d.repo, { recursive: true, force: true })
  }
})

// ── `debut` NUL : ce que la tête apporte au tronc, quelle que soit la ref poussée ────────────────

/** Tronc local `main` en avance de deux commits sur `origin/main`, le second sans cliquet. */
function depotEnAvance() {
  const { racine: repo, sha: socle } = instanceDeDepot({ fichiers: { [PORTEUR]: sourceStock([A]) }, message: 'socle' })
  const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
  git('update-ref', 'refs/remotes/origin/main', socle)
  writeFileSync(join(repo, PORTEUR), sourceStock([A, B]), 'utf8')
  git('commit', '-q', '--no-verify', '-am', 'non poussé, sans cliquet')
  const milieu = git('rev-parse', 'HEAD').trim()
  writeFileSync(join(repo, PORTEUR), `${sourceStock([A, B])}// tête anodine\n`, 'utf8')
  git('commit', '-q', '--no-verify', '-am', 'tête')
  return { repo, git, milieu, fin: git('rev-parse', 'HEAD').trim() }
}

test('DEBUT NUL : vers le tronc (HEAD sur `main` hors CI, canari) comme en tête détachée, la plage est `fin ^origin/main`', () => {
  const d = depotEnAvance()
  try {
    for (const vers of [TRONC.branche, null]) {
      const vu = croissancesDeLaPlage({ cwd: d.repo, debut: SHA_NUL, fin: d.fin, vers })
      assert.deepEqual([vu.commits, vu.notes, refusDe(vu)], [2, [], [[d.milieu, PORTEUR, 1]]], String(vers))
    }
  } finally {
    rmSync(d.repo, { recursive: true, force: true })
  }
})

test('DEBUT NUL : une branche NEUVE juge son apport au tronc, et le cumul le compte', () => {
  const d = depotATronc({ surMain: sourceStock([A, B, C, D, "  'src/e.ts',"]), apres: sourceStock([A, B, C, D, "  'src/e.ts',", "  'src/f.ts',"]) })
  try {
    const vu = croissancesDeLaPlage({ cwd: d.repo, debut: SHA_NUL, fin: d.fin, vers: CHANTIER })
    assert.deepEqual([vu.commits, vu.notes, refusDe(vu)], [2, [], [[d.fin, PORTEUR, 1]]])
  } finally {
    rmSync(d.repo, { recursive: true, force: true })
  }
})

test('SEUL : sans aucune borne, une FUSION est jugée seule, sans le côté de son second parent', () => {
  const { repo, fusion } = depotAFusion(sourceStock([A, B, C]))
  try {
    const vu = croissancesDeLaPlage({ cwd: repo, debut: SHA_NUL, fin: fusion })
    assert.deepEqual([vu.commits, refusDe(vu)], [1, [[fusion, PORTEUR, 1]]])
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})

test('CUMUL : un `debut` sans ancêtre commun avec le tronc est NOMMÉ, et rien n’est retranché', () => {
  const { racine: repo, sha: socle } = instanceDeDepot({ fichiers: { [PORTEUR]: sourceStock([A]) }, message: 'socle' })
  const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
  try {
    git('update-ref', 'refs/remotes/origin/main', socle)
    git('checkout', '-q', '--orphan', 'orpheline')
    git('rm', '-q', '-f', PORTEUR)
    writeFileSync(join(repo, 'autre.txt'), 'o\n', 'utf8')
    git('add', 'autre.txt')
    git('commit', '-q', '--no-verify', '-m', 'racine orpheline')
    const debut = git('rev-parse', 'HEAD').trim()
    git('merge', '-q', '--no-verify', '--allow-unrelated-histories', '-m', 'rejoint le tronc', 'main')
    writeFileSync(join(repo, PORTEUR), sourceStock([A, B]), 'utf8')
    git('commit', '-q', '--no-verify', '-am', 'sans cliquet')
    const fin = git('rev-parse', 'HEAD').trim()
    const vu = croissancesDeLaPlage({ cwd: repo, debut, fin, vers: CHANTIER })
    assert.deepEqual(vu.notes, [`\`${debut.slice(0, 9)}\` sans ancêtre commun avec \`origin/main\` : le cumul ne retranche rien du tronc`])
    assert.deepEqual(refusDe(vu), [[fin, PORTEUR, 1]])
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})

test('SEUL : le cumul d’une fusion jugée seule est SON apport, pas le diff de son premier parent', () => {
  const { racine: repo } = instanceDeDepot({ fichiers: { [PORTEUR]: sourceStock([A, B]), 'autre.txt': 'o\n' }, message: 'socle' })
  const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
  try {
    git('checkout', '-q', '-b', 'cote')
    writeFileSync(join(repo, PORTEUR), sourceStock([A]), 'utf8')
    git('commit', '-q', '--no-verify', '-am', 'cote retire b')
    git('checkout', '-q', 'main')
    writeFileSync(join(repo, 'autre.txt'), 'o\np\n', 'utf8')
    git('commit', '-q', '--no-verify', '-am', 'main')
    git('merge', '-q', '--no-ff', '--no-commit', 'cote')
    writeFileSync(join(repo, PORTEUR), sourceStock([A, "  'src/b.ts', // bis"]), 'utf8')
    git('add', PORTEUR)
    git('commit', '-q', '--no-verify', '-m', 'fusion qui remet b, sans cliquet')
    const fusion = git('rev-parse', 'HEAD').trim()
    assert.deepEqual(refusDe(croissancesDeLaPlage({ cwd: repo, debut: SHA_NUL, fin: fusion })), [[fusion, PORTEUR, 1]])
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})
