// Tests de la porte de PLAGE (`plageStock.mjs`) : par commit, filtrée par la croissance cumulée.
// Les deux premiers cas sont la sonde qui a DISCRIMINÉ les deux niveaux le 2026-09-03 — jugée en
// cumulé seul, une plage de deux commits cliquetés `+2` rougit à tort ; jugée par commit seul, une
// plage qui ajoute puis RETIRE un stock rougit à tort aussi. Lancé par `npm run test:hooks`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { refusDeLaPlage, raisonDeRefusDePlage, croissancesDeLaPlage, reclassementsDeLaPlage, SHA_NUL } from './plageStock.mjs'
import { franchisDuCommit } from './reclassementCss.mjs'
import { GitIndisponible, TRONC } from './gitPorte.mjs'
import { bilanDesStocks } from './stocksNominatifs.mjs'
import { texteDeStock } from './stockDeSites.mjs'
import { instanceDeDepot, sousGitFeint } from './depotGabarit.mjs'
import { gitDe, lancerGit } from '../../test/gitDeBanc.mjs'

const PORTEUR = 'scripts/x.test.mjs'

test('#2285 famille plage callback : indisponibilité complète', () => {
  const { racine: cwd, sha } = instanceDeDepot({ fichiers: { 'a.txt': 'a' } })
  try {
    const stderr = 'note plage\n'.repeat(45) + 'cause plage tardive\n'
    const stdout = 'stdout plage distinct'
    assert.ok(stderr.indexOf('cause plage tardive') > 400)
    const vu = sousGitFeint([{ si: ['rev-list', '--reverse'], status: 32, stdout, stderr }], () => croissancesDeLaPlage({ cwd, debut: sha, fin: sha }))
    assert.equal(vu.indisponible, 'refus (status 32) — ' + stderr + '\n' + stdout)
  } finally { rmSync(cwd, { recursive: true, force: true }) }
})

test('#2285 famille plage catch : lecteur strict complet', () => {
  const { racine: cwd, sha } = instanceDeDepot({ fichiers: { 'a.txt': 'a' } })
  try {
    const stderr = 'note strict\n'.repeat(45) + 'cause strict tardive\n'
    const stdout = 'stdout strict distinct'
    assert.ok(stderr.indexOf('cause strict tardive') > 400)
    const vu = sousGitFeint([{ si: ['rev-list', '--no-commit-header'], status: 33, stdout, stderr }], () => croissancesDeLaPlage({ cwd, debut: '0'.repeat(40), fin: sha }))
    assert.equal(vu.indisponible, 'refus (status 33) — ' + stderr + '\n' + stdout)
  } finally { rmSync(cwd, { recursive: true, force: true }) }
})

test('#2285 famille plage reclassement : Git complet et métier conservé', () => {
  const stderr = 'note classement\n'.repeat(45) + 'cause classement tardive\n'
  const stdout = 'stdout classement distinct'
  assert.ok(stderr.indexOf('cause classement tardive') > 400)
  const erreur = new GitIndisponible({ disponible: false, raison: stderr, issue: 'refus', diagnostic: { status: 34, stdout, stderr } })
  const commits = [{ sha: 'a'.repeat(40), message: '', cotes: () => { throw erreur } }]
  assert.deepEqual(reclassementsDeLaPlage({ commits }), [{ sha: 'a'.repeat(40), fusion: false, illisible: 'refus (status 34) — ' + stderr + '\n' + stdout }])
  const metier = new Error('métier conservé')
  commits[0].cotes = () => { throw metier }
  assert.deepEqual(reclassementsDeLaPlage({ commits }), [{ sha: 'a'.repeat(40), fusion: false, illisible: 'métier conservé' }])
})

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
  assert.match(raison, /commit simple : `git commit --amend` s’il est la tête ; plus bas, reconstruire la pile depuis son parent/)
  assert.doesNotMatch(raison, /FUSION|rebase -i/)
})

// ── Sur un dépôt JETABLE : la lecture git réelle, la plage et son repli ───────────────────────────

/** Dépôt jetable où chaque élément de `commits` pose une version du porteur et son message. */
function depotJetable(commits) {
  const [fondation, ...suite] = commits
  assert.ok(fondation, 'depotJetable : le premier commit FONDE le dépôt — `commits` ne peut pas être vide')
  const { racine: repo, sha } = instanceDeDepot({ fichiers: { [PORTEUR]: fondation.contenu }, message: fondation.message })
  const git = gitDe(repo)
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
    const git = gitDe(repo)
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
    const git = gitDe(repo)
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
  const git = gitDe(repo)
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
    const git = gitDe(racine)
    try {
      writeFileSync(join(racine, porteur), `// socle\n${ajout.join('\n')}\n`, 'utf8')
      git('add', '-A')
      const commande = 'git commit -m "test: sans cliquet"'
      const lectures = diffDuCommit(commande, racine)
      const auCommit = evaluateStocksQuiGrandissent({
        command: commande,
        diff: lectures.diff([porteur]),
        images: { lirePostImage: lectures.contenu, lirePreImage: lectures.avant },
      })
      const base = git('rev-parse', 'HEAD').trim()
      git('commit', '-q', '--no-verify', '-m', 'test: sans cliquet')
      const auPush = croissancesDeLaPlage({ cwd: racine, debut: base, fin: git('rev-parse', 'HEAD').trim() })
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

// #1709 D3 — sonde 3 de la revue du 2026-09-08, promue sur un dépôt RÉEL : un
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
  const git = gitDe(racine)
  const poser = (entrees) => { writeFileSync(join(racine, porteur), stock(entrees), 'utf8'); git('add', '-A') }
  const auPush = (debut) => croissancesDeLaPlage({ cwd: racine, debut, fin: git('rev-parse', 'HEAD').trim() })
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
    const base = git('rev-parse', 'HEAD').trim()
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
    git('commit', '-q', '--no-verify', '-m', 'test: un stock qui naît')
    assert.deepEqual(auPush(base).refus.map((r) => [r.fichier, r.net]), [[porteur, 13]], 'porte au push : le même compte')

    // CROISSANCE de deux entrées sur les treize, DITE par le message : les deux portes passent.
    const debut = git('rev-parse', 'HEAD').trim()
    poser(trous(15))
    const message = 'test: deux trous durs de plus\n\nCLIQUET: scripts/raw/fixture-stock.json +2 — deux chapitres non couverts par l’Atlas'
    const croissance = auCommit(`git commit -m "${message}"`)
    assert.equal(croissance.verdict, null, 'porte au commit : la croissance est DITE, elle passe')
    assert.deepEqual(
      croissanceDesStocks(croissance.diff, { lirePostImage: (f) => readFileSync(join(racine, f), 'utf8') })
        .map((c) => c.net), [2],
      'témoin de non-vacuité : la croissance vaut bien +2 — sans le cliquet, le verdict serait un refus',
    )
    git('commit', '-q', '--no-verify', '-m', message)
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
  const git = gitDe(racine)
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
      [{ sha: muet, fusion: false, ecarts: [{ module: CONSOLE, n: 3, declare: null }] }])
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
    assert.deepEqual(reclassements, [{ sha: c1, fusion: false, ecarts: [{ module: CONSOLE, n: 3, declare: null }] }])
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
      [{ sha: fusion, fusion: true, ecarts: [{ module: CONSOLE, n: 3, declare: null }] }])
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
      [{ sha: muet, fusion: false, ecarts: [{ module: CONSOLE, n: 3, declare: null }] }])
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
      if (indexer.length) lancerGit(['add', '--', ...indexer], { cwd: racine })
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
  assert.deepEqual(reclassementsDeLaPlage({ commits }), [{ sha: commits[0].sha, fusion: false, ecarts: [{ module: CONSOLE, n: null, declare: 3 }] }])
  const horsFrontiere = [{ ...commits[0], cotes: () => null }]
  assert.deepEqual(reclassementsDeLaPlage({ commits: horsFrontiere }), [{ sha: commits[0].sha, fusion: false, ecarts: [{ module: CONSOLE, n: null, declare: 3 }] }],
    'un commit qui ne touche pas la frontière et porte une ligne est refusé aussi')
  assert.deepEqual(reclassementsDeLaPlage({ commits: [{ ...horsFrontiere[0], message: 'docs' }] }), [])
})

test('RECLASSEMENT : manifeste ILLISIBLE → refus NOMMÉ par son commit, jamais une levée qui emporterait les autres refus', () => {
  const { racine, sha } = instanceDeDepot({ fichiers: { 'a.txt': 'a\n' }, message: 'socle' })
  const git = gitDe(racine)
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
  const git = gitDe(racine)
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
  const git = gitDe(racine)
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

// ── Les FUSIONS se lisent par ce qu'elles font contre CHACUN de leurs parents (#2223) ─────────────

/** Dépôt jetable dont `main` fusionne une branche `cote`. La branche fait grandir le stock sous son
 *  CLIQUET ; `retouche` (texte du porteur posé DANS la fusion, ou `null`) rend la fusion maléfique. */
function depotAFusion(retouche) {
  const { racine: repo, sha: socle } = instanceDeDepot({ fichiers: { [PORTEUR]: sourceStock([A]), 'autre.txt': 'o\n' }, message: 'socle' })
  const git = gitDe(repo)
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

test('PLAGE : une fusion qui RÉÉCRIT une entrée amenée par la branche ne grandit rien — sa base est la fusion automatique, en entrées', () => {
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
  const git = gitDe(repo)
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
  const git = gitDe(repo)
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
    lancerGit(['update-ref', '-d', 'refs/remotes/origin/main'], { cwd: d.repo })
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
  const git = gitDe(repo)
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
  const git = gitDe(repo)
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
  const git = gitDe(repo)
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
  const git = gitDe(repo)
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

// ── #2223 : la croissance se compte en ENTRÉES identifiées, une fusion jamais contre un texte à marqueurs ──

/** Un stock de sites JSON (`FORMAT_JSON`) de quatre champs par entrée. */
const STOCK_JSON = 'scripts/raw/x-stock.json'
const site = (fichier, ref, valeur) => ({ fichier, ref, occurrence: 1, pdfChars: valeur })
const stockJson = (entrees) => texteDeStock('test', entrees)
const SITES = [site('src/a.ts', 'r1', 1), site('src/b.ts', 'r2', 2), site('src/c.ts', 'r3', 3), site('src/b.ts', 'r4', 4)]

test('#2223 ENTRÉES : réécrire une entrée sans changer son fichier ne fait rien naître — champ d’un site, extension ajoutée dans une paire de Map', () => {
  const REGISTRE = 'scripts/guards/lib/x.mjs'
  const paire = (valeur) => `export const TYPES = new Map([['BoneId', '${valeur}']])\n`
  const d = depotDeChantier({ [STOCK_JSON]: stockJson(SITES), [REGISTRE]: paire('src/os/bones') })
  try {
    const fin = d.poser({
      [STOCK_JSON]: stockJson([SITES[0], site('src/b.ts', 'r2', 99), SITES[2], SITES[3]]),
      [REGISTRE]: paire('src/os/bones.ts'),
    }, 'réécrit deux valeurs')
    assert.deepEqual(refusDe(d.plage(fin)), [])
  } finally {
    rmSync(d.repo, { recursive: true, force: true })
  }
})

test('#2223 ENTRÉES : ajouter une entrée la compte +1 (contrat positif), réordonnancement compris', () => {
  const d = depotDeChantier({ [STOCK_JSON]: stockJson(SITES) })
  try {
    const fin = d.poser({ [STOCK_JSON]: stockJson([SITES[3], site('src/d.ts', 'r5', 5), ...SITES.slice(0, 3)]) }, 'ajoute d')
    assert.deepEqual(refusDe(d.plage(fin)), [[fin, STOCK_JSON, 1]])
  } finally {
    rmSync(d.repo, { recursive: true, force: true })
  }
})

test('#2223 FUSION : un conflit résolu sur le manifeste se lit contre les parents — aucun « illisible »', () => {
  const MANIFESTE = 'src/data/primitives.manifest.json'
  const manifeste = (x) => `${JSON.stringify([{ id: 'a', x }], null, 2)}\n`
  const d = depotDeChantier({ [MANIFESTE]: manifeste(0) })
  try {
    d.poser({ [MANIFESTE]: manifeste(1) }, 'chantier touche le manifeste')
    d.git('checkout', '-q', '-b', 'x', d.debut)
    d.poser({ [MANIFESTE]: manifeste(2) }, 'x touche la même ligne')
    d.git('checkout', '-q', 'chantier')
    assert.throws(() => d.git('merge', '-q', '--no-ff', '--no-verify', 'x'), 'témoin : la fusion est EN CONFLIT')
    writeFileSync(join(d.repo, MANIFESTE), manifeste(3), 'utf8')
    d.git('add', MANIFESTE)
    d.git('commit', '-q', '--no-verify', '-m', 'fusion résolue')
    const fin = d.git('rev-parse', 'HEAD').trim()
    const vu = d.plage(fin)
    assert.deepEqual([vu.indisponible, vu.reclassements, vu.refus], [null, [], []])
  } finally {
    rmSync(d.repo, { recursive: true, force: true })
  }
})

test('#2223 RECLASSEMENT d’une FUSION à trois voies : les DEUX côtés franchissent la console, la fusion n’ajoute rien — aucune ligne exigée', () => {
  const d = depotCss()
  try {
    d.git('checkout', '-q', '-b', 'chantier')
    d.commettre({ 'src/ui/Ecran2.tsx': importeur('Ecran2') }, RECLASSE)
    d.git('checkout', '-q', 'main')
    d.commettre({ 'src/ui/Ecran3.tsx': importeur('Ecran3') }, RECLASSE)
    d.git('checkout', '-q', 'chantier')
    d.git('merge', '-q', '--no-ff', '--no-commit', 'main')
    const fusion = d.commettre({ [MANIFESTE]: manifesteAvec(PRIMITIVE_CONSOLE, { id: 'b' }) }, 'fusion de main, manifeste retouché')
    assert.deepEqual(croissancesDeLaPlage({ cwd: d.racine, debut: d.base, fin: fusion }).reclassements, [])
  } finally {
    rmSync(d.racine, { recursive: true, force: true })
  }
})

test('#2223 RECLASSEMENT d’une FUSION à trois voies : une exemption RESSUSCITÉE (base exemptée, `^1` libère, `^2` garde, fusion exempte) est franchie, payée contre `^1`', () => {
  const Q = 'src/ui/styles/ecran-q.css'
  const cote = (exempte) => ({
    manifeste: [{ id: 'sans-css' }, ...(exempte ? [{ id: Q, fichier: `${Q}.tsx`, css: Q }] : [])],
    partagees: [], reutilises: new Set(exempte ? [`${Q}.tsx`] : []), lire: (f) => (f === Q ? '.e { color: red; border: 0; font-size: 3px; gap: 3px }' : null),
  })
  const [libre, exempte] = [cote(false), cote(true)]
  assert.deepEqual(franchisDuCommit({ base: exempte, commit: exempte, parents: [libre, exempte] }).map((f) => [f.module, f.n]), [[Q, 4]])
  assert.deepEqual(franchisDuCommit({ base: exempte, commit: exempte, parents: [exempte, exempte] }), [], 'témoin : gardée des deux côtés, rien n’est franchi')
  assert.deepEqual(franchisDuCommit({ base: libre, commit: exempte, parents: [libre, exempte] }), [], 'témoin : `^2` l’exempte seul, la fusion automatique aussi')
})

test('#2223 FUSION : un porteur SUPPRIMÉ par le tronc, enrichi par le chantier, gardé par la résolution — ses entrées ressuscitées sont refusées', () => {
  const d = depotDeChantier({ [PORTEUR]: sourceStock([A, B, C]) })
  try {
    d.poser({ [PORTEUR]: sourceStock([A, B, C, D]) }, `ajoute d\n\nCLIQUET: ${PORTEUR} +1 — le chantier ajoute une entrée, refs #2223`)
    d.git('checkout', '-q', '-b', 'tronc', d.debut)
    const supprime = d.poser({ [PORTEUR]: null }, 'le tronc supprime le porteur')
    d.git('update-ref', 'refs/remotes/origin/main', supprime)
    d.git('checkout', '-q', 'chantier')
    assert.throws(() => d.git('merge', '-q', '--no-ff', '--no-verify', 'tronc'), 'témoin : modify/delete EN CONFLIT')
    d.git('add', PORTEUR)
    d.git('commit', '-q', '--no-verify', '-m', 'fusion qui garde le porteur')
    const fin = d.git('rev-parse', 'HEAD').trim()
    assert.deepEqual(refusDe(d.plage(fin)), [[fin, PORTEUR, 3]])
  } finally {
    rmSync(d.repo, { recursive: true, force: true })
  }
})

// ── #2223 : la porte publiée sur les scénarios CONSTRUITS des juges (issuecomment-5933197112) ─────────

const MOTIF_LONG = 'motif assez long pour la porte'
const cliquet = (fichier, n) => `\n\nCLIQUET: ${fichier} +${n} — ${MOTIF_LONG}`
const ent = (f, c = '') => `  '${f}',${c ? ` // ${c}` : ''}`
const SIX = ['src/k1.ts', 'src/k2.ts', 'src/k3.ts', 'src/k4.ts', 'src/k5.ts', 'src/k6.ts'].map((f) => ent(f))
const corpsDe = (s) => `${Array.from({ length: 30 }, (_, i) => `export const v${i} = '${s}${i}'`).join('\n')}\n`

/** `depotDeChantier` d'un porteur de six entrées ; `fusionner(...cotes)` laisse la fusion EN COURS,
 *  conflit compris, et `poser` la conclut. */
function depotConstruit(fichiers = {}) {
  const d = depotDeChantier({ [PORTEUR]: sourceStock(SIX), ...fichiers })
  const fusionner = (...cotes) => {
    try {
      d.git('merge', '-q', '--no-ff', '--no-verify', '--no-commit', ...cotes)
    } catch {
      // conflit : la résolution est posée par `poser`
    }
  }
  return { ...d, fusionner, juger: (debut, fin, vers = CHANTIER) => refusDe(croissancesDeLaPlage({ cwd: d.repo, debut, fin, vers })) }
}

/** Les scénarios des juges : chacun construit son histoire et rend `[debut, fin, attendu, vers?]`. */
const CONSTRUITS = {
  'F1 porteur renommé après une croissance déclarée': (d) => {
    d.poser({ [PORTEUR]: sourceStock([...SIX, ent('src/neuf.ts')]) }, `ajoute neuf${cliquet(PORTEUR, 1)}`)
    d.git('mv', PORTEUR, 'scripts/y.test.mjs')
    return [d.debut, d.poser({}, 'renomme le porteur'), () => []]
  },
  'F2 main renomme le porteur, la branche y ajoute une entrée déclarée ; plage de file': (d) => {
    d.poser({ [PORTEUR]: sourceStock([...SIX, ent('src/neuf.ts')]) }, `ajoute neuf${cliquet(PORTEUR, 1)}`)
    d.git('checkout', '-q', '-b', 'tronc', d.debut)
    d.git('mv', PORTEUR, 'scripts/y.test.mjs')
    const t = d.poser({}, 'tronc : renomme le porteur')
    d.git('checkout', '-q', 'chantier')
    d.fusionner('tronc')
    d.poser({}, 'fusion de main')
    d.git('checkout', '-q', 'tronc')
    d.fusionner('chantier')
    return [t, d.poser({}, 'Merge pull request'), () => []]
  },
  'F3 fichier nommé renommé avec son entrée, puis réécrit': (d) => {
    const debut = d.poser({ [PORTEUR]: sourceStock([...SIX, ent('src/a.ts')]) }, `entrée a${cliquet(PORTEUR, 1)}`)
    d.git('mv', 'src/a.ts', 'src/b.ts')
    d.poser({ [PORTEUR]: sourceStock([...SIX, ent('src/b.ts')]) }, 'renomme a -> b, entrée suivie')
    return [debut, d.poser({ 'src/b.ts': corpsDe('zz') }, 'réécrit b'), () => []]
  },
  'R1 les deux côtés retirent k1': (d) => {
    d.poser({ [PORTEUR]: sourceStock(SIX.slice(1)) }, 'chantier retire k1')
    d.git('checkout', '-q', '-b', 'cote', d.debut)
    d.poser({ [PORTEUR]: sourceStock(SIX.slice(1)) }, 'cote retire k1')
    d.git('checkout', '-q', 'chantier')
    d.fusionner('cote')
    return [d.debut, d.poser({}, 'fusion'), () => []]
  },
  'N1 fusion propre : chaque côté ajoute une entrée distincte de même clé, déclarée': (d) => {
    d.poser({ [PORTEUR]: sourceStock([ent('src/k1.ts:10'), ...SIX]) }, `chantier +k1:10${cliquet(PORTEUR, 1)}`)
    d.git('checkout', '-q', '-b', 'cote', d.debut)
    d.poser({ [PORTEUR]: sourceStock([...SIX, ent('src/k1.ts:20')]) }, `cote +k1:20${cliquet(PORTEUR, 1)}`)
    d.git('checkout', '-q', 'chantier')
    d.fusionner('cote')
    return [d.debut, d.poser({}, 'fusion propre'), () => []]
  },
  'N4b porteur créé des deux côtés (add/add), même clé, union': (d) => {
    const R = 'scripts/r.test.mjs'
    d.poser({ [R]: sourceStock([ent('src/a.ts:1')]) }, `chantier crée r${cliquet(R, 1)}`)
    d.git('checkout', '-q', '-b', 'cote', d.debut)
    d.poser({ [R]: sourceStock([ent('src/a.ts:2')]) }, `cote crée r${cliquet(R, 1)}`)
    d.git('checkout', '-q', 'chantier')
    d.fusionner('cote')
    return [d.debut, d.poser({ [R]: sourceStock([ent('src/a.ts:1'), ent('src/a.ts:2')]) }, 'fusion add/add, union'), () => []]
  },
  'M1 croissance déclarée puis retirée, fusion muette': (d) => {
    d.poser({ [PORTEUR]: sourceStock([...SIX, ent('src/e.ts')]) }, `ajoute e${cliquet(PORTEUR, 1)}`)
    d.poser({ [PORTEUR]: sourceStock(SIX) }, 'retire e')
    d.git('checkout', '-q', '-b', 'cote', d.debut)
    d.poser({}, 'côté vide')
    d.git('checkout', '-q', 'chantier')
    d.fusionner('cote')
    const fin = d.poser({ [PORTEUR]: sourceStock([...SIX, ent('src/muette.ts')]) }, 'fusion qui ajoute muette')
    return [d.debut, fin, () => [[fin, PORTEUR, 1]]]
  },
  'M2 retrait puis remise déclarée, fusion muette sous la même clé': (d) => {
    d.poser({ [PORTEUR]: sourceStock(SIX.slice(1)) }, 'retire k1')
    d.poser({ [PORTEUR]: sourceStock(SIX) }, `remet k1${cliquet(PORTEUR, 1)}`)
    d.git('checkout', '-q', '-b', 'cote', d.debut)
    d.poser({}, 'côté vide')
    d.git('checkout', '-q', 'chantier')
    d.fusionner('cote')
    const fin = d.poser({ [PORTEUR]: sourceStock([...SIX, ent('src/k1.ts', 'bis')]) }, 'fusion qui ajoute k1 bis')
    return [d.debut, fin, () => [[fin, PORTEUR, 1]]]
  },
  'M3 ligne tampon sur un commit qui ne grandit pas, fusion muette +3': (d) => {
    d.poser({}, `commit vide${cliquet(PORTEUR, 3)}`)
    d.git('checkout', '-q', '-b', 'cote', d.debut)
    d.poser({}, 'côté vide')
    d.git('checkout', '-q', 'chantier')
    d.fusionner('cote')
    const fin = d.poser({ [PORTEUR]: sourceStock([...SIX, ent('src/m1.ts'), ent('src/m2.ts'), ent('src/m3.ts')]) }, 'fusion +3 muette')
    return [d.debut, fin, () => [[fin, PORTEUR, 3]]]
  },
  'R2 ajout double déclaré, fusion muette sous la même clé': (d) => {
    d.poser({ [PORTEUR]: sourceStock([...SIX, ent('src/z.ts')]) }, `chantier +z${cliquet(PORTEUR, 1)}`)
    d.git('checkout', '-q', '-b', 'cote', d.debut)
    d.poser({ [PORTEUR]: sourceStock([...SIX, ent('src/z.ts')]) }, `cote +z${cliquet(PORTEUR, 1)}`)
    d.git('checkout', '-q', 'chantier')
    d.fusionner('cote')
    const fin = d.poser({ [PORTEUR]: sourceStock([...SIX, ent('src/z.ts'), ent('src/z.ts:2')]) }, 'fusion + z:2 muette')
    return [d.debut, fin, () => [[fin, PORTEUR, 1]]]
  },
  'N2c main retire k2, la fusion de main reprend le porteur de la branche ; plage de file': (d) => {
    d.poser({}, 'chantier : travail')
    d.git('checkout', '-q', '-b', 'tronc', d.debut)
    const t = d.poser({ [PORTEUR]: sourceStock(SIX.filter((l) => !l.includes('k2'))) }, 'main retire k2')
    d.git('checkout', '-q', 'chantier')
    d.fusionner('tronc')
    const fusion = d.poser({ [PORTEUR]: sourceStock(SIX) }, 'fusion de main : porteur pris à la branche')
    d.git('checkout', '-q', 'tronc')
    d.fusionner('chantier')
    return [t, d.poser({}, 'Merge pull request'), () => [[fusion, PORTEUR, 1]], 'refs/heads/tronc']
  },
  'N2 main retire k2, la résolution reprend la branche ; cumul nul': (d) => {
    d.poser({}, 'chantier : travail')
    d.git('checkout', '-q', '-b', 'cote', d.debut)
    d.poser({ [PORTEUR]: sourceStock(SIX.filter((l) => !l.includes('k2'))) }, 'main retire k2')
    d.git('checkout', '-q', 'chantier')
    d.fusionner('cote')
    return [d.debut, d.poser({ [PORTEUR]: sourceStock(SIX) }, 'fusion : porteur pris à la branche'), () => []]
  },
  'N2b main retire k2, fusion ours ; cumul nul': (d) => {
    d.poser({}, 'chantier : travail')
    d.git('checkout', '-q', '-b', 'cote', d.debut)
    d.poser({ [PORTEUR]: sourceStock(SIX.filter((l) => !l.includes('k2'))) }, 'main retire k2')
    d.git('checkout', '-q', 'chantier')
    d.git('merge', '-q', '--no-ff', '--no-verify', '-s', 'ours', '-m', 'fusion ours', 'cote')
    return [d.debut, d.git('rev-parse', 'HEAD').trim(), () => []]
  },
  'N3 la fusion renomme le fichier nommé et suit son entrée': (d) => {
    const debut = d.poser({ 'src/k1.ts': corpsDe('a') }, 'k1 existe')
    d.poser({}, 'chantier : travail')
    d.git('checkout', '-q', '-b', 'cote', debut)
    d.poser({}, 'côté')
    d.git('checkout', '-q', 'chantier')
    d.fusionner('cote')
    d.git('mv', 'src/k1.ts', 'src/kk.ts')
    return [debut, d.poser({ [PORTEUR]: sourceStock(SIX.map((l) => l.replace('k1.ts', 'kk.ts'))) }, 'fusion qui renomme'), () => []]
  },
  'N4 porteur créé des deux côtés (add/add), clés distinctes, union': (d) => {
    const R = 'scripts/r.test.mjs'
    d.poser({ [R]: sourceStock([ent('src/a.ts')]) }, `chantier crée r${cliquet(R, 1)}`)
    d.git('checkout', '-q', '-b', 'cote', d.debut)
    d.poser({ [R]: sourceStock([ent('src/b.ts')]) }, `cote crée r${cliquet(R, 1)}`)
    d.git('checkout', '-q', 'chantier')
    d.fusionner('cote')
    return [d.debut, d.poser({ [R]: sourceStock([ent('src/a.ts'), ent('src/b.ts')]) }, 'fusion add/add, union'), () => []]
  },
  'N5 multiplicités différentes, retouche de k3 ; fusion propre': (d) => {
    d.poser({ [PORTEUR]: sourceStock([...SIX, ent('src/k1.ts:9')]) }, `chantier +k1:9${cliquet(PORTEUR, 1)}`)
    d.git('checkout', '-q', '-b', 'cote', d.debut)
    d.poser({ [PORTEUR]: sourceStock(SIX.map((l) => l.replace('k3.ts', 'k3.ts:1'))) }, 'cote retouche k3')
    d.git('checkout', '-q', 'chantier')
    d.fusionner('cote')
    return [d.debut, d.poser({}, 'fusion propre'), () => []]
  },
  'N3b main renomme k1 -> kk, la branche ajoute k1:5, la résolution la suit en kk': (d) => {
    const ren = (l) => l.replace('k1.ts', 'kk.ts')
    const debut = d.poser({ 'src/k1.ts': corpsDe('a') }, 'k1 existe')
    d.poser({ [PORTEUR]: sourceStock([...SIX, ent('src/k1.ts:5')]) }, `chantier +k1:5${cliquet(PORTEUR, 1)}`)
    d.git('checkout', '-q', '-b', 'cote', debut)
    d.git('mv', 'src/k1.ts', 'src/kk.ts')
    d.poser({ [PORTEUR]: sourceStock(SIX.map(ren)) }, 'main renomme k1 -> kk')
    d.git('checkout', '-q', 'chantier')
    d.fusionner('cote')
    const fin = d.poser({ [PORTEUR]: sourceStock([...SIX.map(ren), ent('src/kk.ts:5')]) }, 'fusion : entrée suivie en kk')
    return [debut, fin, () => [[fin, PORTEUR, 1]]]
  },
  'N7 chantier retire k1, cote ajoute k1:7 déclaré, la fusion garde k1 et k1:7': (d) => {
    d.poser({ [PORTEUR]: sourceStock(SIX.slice(1)) }, 'chantier retire k1')
    d.git('checkout', '-q', '-b', 'cote', d.debut)
    d.poser({ [PORTEUR]: sourceStock([...SIX, ent('src/k1.ts:7')]) }, `cote +k1:7${cliquet(PORTEUR, 1)}`)
    d.git('checkout', '-q', 'chantier')
    d.fusionner('cote')
    const fin = d.poser({ [PORTEUR]: sourceStock([...SIX, ent('src/k1.ts:7')]) }, 'fusion : k1 ressuscité')
    return [d.debut, fin, () => [[fin, PORTEUR, 1]]]
  },
}

for (const [nom, construire] of Object.entries(CONSTRUITS)) {
  test(`#2223 CONSTRUIT ${nom}`, () => {
    const d = depotConstruit({ 'src/a.ts': corpsDe('a') })
    try {
      const [debut, fin, attendu, vers] = construire(d)
      assert.deepEqual(d.juger(debut, fin, vers), attendu())
    } finally {
      rmSync(d.repo, { recursive: true, force: true })
    }
  })
}

for (const muette of [false, true]) {
  test(`#2223 CONSTRUIT N6${muette ? 'b' : ''} : octopus résolu, trois parents et indisponibilité nommée`, () => {
    const d = depotConstruit()
    try {
      for (const [branche, cle] of [['o1', 'src/o1.ts'], ['o2', 'src/o2.ts']]) {
        d.git('checkout', '-q', '-b', branche, d.debut)
        d.poser({ [PORTEUR]: sourceStock([...SIX, ent(cle)]) }, `${branche}${cliquet(PORTEUR, 1)}`)
      }
      d.git('checkout', '-q', 'chantier')
      d.poser(muette ? {} : { [PORTEUR]: sourceStock([ent('src/o0.ts'), ...SIX]) }, `o0${muette ? '' : cliquet(PORTEUR, 1)}`)
      assert.throws(() => d.git('merge', '-q', '--no-ff', '--no-verify', '--no-commit', 'o1', 'o2'))
      const entrees = muette ? [...SIX, ent('src/o1.ts'), ent('src/o2.ts'), ent('src/o9.ts')]
        : [ent('src/o0.ts'), ...SIX, ent('src/o1.ts'), ent('src/o2.ts')]
      const fin = d.poser({ [PORTEUR]: sourceStock(entrees) }, 'conclusion après échec octopus')
      const parents = d.git('show', '-s', '--format=%P', fin).trim().split(' ')
      assert.equal(parents.length, 3)
      const vu = d.plage(fin)
      assert.match(vu.indisponible, /3 parents/)
      assert.deepEqual([vu.refus, vu.reclassements], [[], []])
    } finally {
      rmSync(d.repo, { recursive: true, force: true })
    }
  })
}

// ── #2223 : le hook de commit juge une fusion EN COURS sur son apport, comme la plage ──────────────

const commandeDeFusion = (lignes = '') => `git commit -m "chore(merge): refs #2223 — fusion de main${lignes}"`
const auHook = async (repo, command) => {
  const { garde } = await import('../../hooks/solde-ticket-guard.mjs')
  return garde.evaluer({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command } }, { dir: repo, cibleIgnoree: null, today: '2026-10-01', pannes: [] })
}

for (const option of ['-i', '--include', '-a']) {
  test(`#2223 HOOK image emportée ${option} : fusion, index hors pathspec et disque inclus`, async () => {
    const autre = 'scripts/autre.test.mjs'
    const inclus = 'scripts/inclus.test.mjs'
    const d = depotConstruit({ [autre]: sourceStock(SIX), [inclus]: sourceStock(SIX) })
    try {
      d.git('checkout', '-q', '-b', 'tronc', d.debut)
      d.poser({ [PORTEUR]: sourceStock([...SIX, ent('src/tronc.ts')]) }, `tronc +1${cliquet(PORTEUR, 1)}`)
      d.git('checkout', '-q', 'chantier')
      d.poser({}, 'chantier')
      d.fusionner('tronc')
      writeFileSync(join(d.repo, autre), sourceStock([...SIX, ent('src/index.ts')]), 'utf8')
      d.git('add', autre)
      writeFileSync(join(d.repo, autre), sourceStock(SIX), 'utf8')
      writeFileSync(join(d.repo, PORTEUR), sourceStock([...SIX, ent('src/tronc.ts'), ent('src/muette.ts')]), 'utf8')
      d.git('add', PORTEUR)
      writeFileSync(join(d.repo, inclus), sourceStock([...SIX, ent('src/disque.ts')]), 'utf8')
      const lignes = cliquet(PORTEUR, 1) + cliquet(inclus, 1) + (option === '-a' ? '' : cliquet(autre, 1))
      const commande = (texte) => `${commandeDeFusion(texte)} ${option}${option === '-a' ? '' : ` -- ${PORTEUR} ${inclus}`}`
      const resultat = await auHook(d.repo, commande(lignes))
      assert.notEqual(resultat?.decision, 'deny', JSON.stringify(resultat))
      const refus = await auHook(d.repo, commande(''))
      assert.equal(refus?.decision, 'deny')
      assert.ok(refus.raison.includes(`${PORTEUR} : +1 entrée`))
      assert.ok(refus.raison.includes(`${inclus} : +1 entrée`))
      if (option !== '-a') assert.ok(refus.raison.includes(`${autre} : +1 entrée`))
      const { diffDuCommit } = await import('../../hooks/solde-ticket-guard.mjs')
      const lu = diffDuCommit(commande(lignes), d.repo)
      assert.equal(lu.contenu(autre), sourceStock(option === '-a' ? SIX : [...SIX, ent('src/index.ts')]))
      assert.equal(lu.contenu(inclus), sourceStock([...SIX, ent('src/disque.ts')]))
      assert.ok(lu.fusion())
    } finally {
      rmSync(d.repo, { recursive: true, force: true })
    }
  })
}

test('#2223 HOOK sous MERGE_HEAD : main ajoute +1 déclaré, la conclusion une entrée muette — seule l’entrée de la fusion se déclare, `+1`', async () => {
  const d = depotConstruit()
  try {
    d.git('checkout', '-q', '-b', 'tronc', d.debut)
    d.poser({ [PORTEUR]: sourceStock([...SIX, ent('src/tronc.ts')]) }, `tronc +1${cliquet(PORTEUR, 1)}`)
    d.git('checkout', '-q', 'chantier')
    d.poser({}, 'chantier')
    d.fusionner('tronc')
    writeFileSync(join(d.repo, PORTEUR), sourceStock([...SIX, ent('src/tronc.ts'), ent('src/muette.ts')]), 'utf8')
    d.git('add', PORTEUR)
    assert.equal(await auHook(d.repo, commandeDeFusion(cliquet(PORTEUR, 1))), null, 'la ligne exacte de l’apport passe')
    for (const lignes of ['', cliquet(PORTEUR, 2)]) {
      const refus = await auHook(d.repo, commandeDeFusion(lignes))
      assert.equal(refus?.decision, 'deny', JSON.stringify(lignes))
      assert.ok(refus.raison.includes(`${PORTEUR} : +1 entrée(s) nette(s)`))
    }
    const fin = d.poser({}, `fusion de main${cliquet(PORTEUR, 1)}`)
    assert.deepEqual(d.juger(d.debut, fin), [], 'la plage rend le même verdict sur la fusion posée')
  } finally {
    rmSync(d.repo, { recursive: true, force: true })
  }
})

test('#2223 HOOK sous MERGE_HEAD : un franchissement CSS amené par main n’est pas à la fusion — aucune ligne `RECLASSEMENT:` exigée', async () => {
  const d = depotCss()
  try {
    d.git('checkout', '-q', '-b', 'chantier')
    d.commettre({ 'notes.txt': 'travail du chantier\n' }, 'docs: notes du chantier')
    d.git('checkout', '-q', 'main')
    d.commettre({ 'src/ui/Ecran2.tsx': importeur('Ecran2') }, RECLASSE)
    d.git('checkout', '-q', 'chantier')
    d.git('merge', '-q', '--no-ff', '--no-commit', 'main')
    assert.equal(await auHook(d.racine, commandeDeFusion()), null)
  } finally {
    rmSync(d.racine, { recursive: true, force: true })
  }
})

test('#2223 HOOK sous MERGE_HEAD : le franchissement CSS que la conclusion pose elle-même est refusé, et nommé', async () => {
  const d = depotCss()
  try {
    d.git('checkout', '-q', '-b', 'chantier')
    d.commettre({ 'notes.txt': 'travail du chantier\n' }, 'docs: notes du chantier')
    d.git('checkout', '-q', 'main')
    d.commettre({ 'main.txt': 'main avance\n' }, 'docs: main avance')
    d.git('checkout', '-q', 'chantier')
    d.git('merge', '-q', '--no-ff', '--no-commit', 'main')
    writeFileSync(join(d.racine, 'src/ui/Ecran2.tsx'), importeur('Ecran2'), 'utf8')
    d.git('add', 'src/ui/Ecran2.tsx')
    const refus = await auHook(d.racine, commandeDeFusion())
    assert.equal(refus?.decision, 'deny')
    assert.match(refus.raison, /RECLASSEMENT CSS : src\/ui\/styles\/console\.css : franchi au prix 3, aucune ligne/)
  } finally {
    rmSync(d.racine, { recursive: true, force: true })
  }
})

test('#2223 REFUS d’une plage : le geste suit la sorte du commit fautif — fusion ou commit simple, jamais `rebase -i`', () => {
  const { repo, socle, fusion } = depotAFusion(sourceStock([A, B, C]))
  try {
    const { refus } = croissancesDeLaPlage({ cwd: repo, debut: socle, fin: fusion })
    assert.deepEqual(refus.map((r) => [r.sha, r.fusion]), [[fusion, true]])
    const raison = raisonDeRefusDePlage(refus)
    assert.ok(raison.includes(`(fusion) ${PORTEUR} +1`))
    assert.match(raison, /FUSION : `git commit --amend` de la fusion si elle est la tête ; sinon refaire la fusion/)
    assert.doesNotMatch(raison, /commit simple|rebase -i/)
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})
