// Tests de la porte de PLAGE (`plageStock.mjs`) : par commit, filtrée par la croissance cumulée.
// Les deux premiers cas sont la sonde qui a DISCRIMINÉ les deux niveaux le 2026-09-03 — jugée en
// cumulé seul, une plage de deux commits cliquetés `+2` rougit à tort ; jugée par commit seul, une
// plage qui ajoute puis RETIRE un stock rougit à tort aussi. Lancé par `npm run test:hooks`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { PORTE_DE_PLAGE, cotesLisibles, lectureDeLaPlage, refusDeLaPlage, raisonDeRefusDePlage, croissancesDeLaPlage, reclassementsDeLaPlage, SHA_NUL } from './plageStock.mjs'
import { franchisDuCommit } from './reclassementCss.mjs'
import { GitIndisponible, TRONC, depotDe, refusDeGit } from './gitPorte.mjs'
import { bilanDesStocks } from './stocksNominatifs.mjs'
import { texteDeStock } from './stockDeSites.mjs'
import { instanceDeDepot, sousGitFeint } from './depotGabarit.mjs'
import { fermetureSurDisque, jugeDeLEre } from './porteDEre.mjs'
import { gitDe, lancerGit } from '../../test/gitDeBanc.mjs'
import { fileURLToPath } from 'node:url'

/** La racine du dépôt réel. */
const RACINE = fileURLToPath(new URL('../../../', import.meta.url))

const PORTEUR = 'scripts/x.test.mjs'

/** Un dépôt forgé dont le socle porte la porte de plage du disque : son tronc la juge par elle (#2503). */
const PORTE_SUR_DISQUE = Object.fromEntries(fermetureSurDisque(PORTE_DE_PLAGE.module))
const depotForge = (params) => instanceDeDepot({ ...params, fichiers: { ...PORTE_SUR_DISQUE, ...params.fichiers } })

test('#2285 famille plage callback : indisponibilité complète', async () => {
  const { racine: cwd, sha } = depotForge({ fichiers: { 'a.txt': 'a' } })
  try {
    const stderr = 'note plage\n'.repeat(45) + 'cause plage tardive\n'
    const stdout = 'stdout plage distinct'
    assert.ok(stderr.indexOf('cause plage tardive') > 400)
    const vu = await sousGitFeint([{ si: ['rev-list', '--reverse'], status: 32, stdout, stderr }], () => croissancesDeLaPlage({ cwd, debut: sha, fin: sha }))
    assert.equal(vu.indisponible, 'refus (status 32) — ' + stderr + '\n' + stdout)
  } finally { rmSync(cwd, { recursive: true, force: true }) }
})

test('#2285 famille plage catch : lecteur strict complet', async () => {
  const { racine: cwd, sha } = depotForge({ fichiers: { 'a.txt': 'a' } })
  try {
    const stderr = 'note strict\n'.repeat(45) + 'cause strict tardive\n'
    const stdout = 'stdout strict distinct'
    assert.ok(stderr.indexOf('cause strict tardive') > 400)
    const vu = await sousGitFeint([{ si: ['rev-list', '--no-commit-header'], status: 33, stdout, stderr }], () => croissancesDeLaPlage({ cwd, debut: '0'.repeat(40), fin: sha }))
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

test('#1735 : une migration prouvée quitte le commit et le cumul, une dette neuve reste refusée', () => {
  const ancien = 'src/ancien.test.ts';
  const nouveau = 'src/nouveau.test.ts';
  const stock = (fichier, extra = '') => `const PREUVES = [
    { fichier: '${fichier}', it: 'titre conservé' },
    ${extra}
  ];`;
  const pre = stock(ancien);
  for (const neuf of [false, true]) {
    const post = stock(nouveau, neuf ? "{ fichier: 'src/neuf.test.ts', it: 'dette neuve' }," : '');
    const images = {
      lirePreImage: p => p === PORTEUR ? pre : p === ancien ? "it('titre conservé', () => {});" : null,
      lirePostImage: p => p === PORTEUR ? post : p === nouveau ? "it('titre conservé', () => {});" : null,
    };
    const diff = diffDe(post.split('\n'), pre.split('\n'));
    const cumul = bilanDesStocks(diff, images);
    const refus = refusDeLaPlage({ commits: [{ sha: 'migration', message: '', diff, images }], cumul });
    assert.deepEqual(refus.map(r => [r.fichier, r.net]), neuf ? [[PORTEUR, 1]] : []);
  }
});
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
  const { racine: repo, sha } = depotForge({ fichiers: { [PORTEUR]: fondation.contenu }, message: fondation.message })
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

test('C : sur un dépôt réel, la plage voit le commit du MILIEU que `git show HEAD` ne voit pas', async () => {
  const { repo, shas } = depotJetable([
    { contenu: sourceStock([]), message: 'socle' },
    { contenu: sourceStock([A, B]), message: 'deux exemptions de plus, sans cliquet' },
    { contenu: `${sourceStock([A, B])}// tête anodine\n`, message: 'tête' },
  ])
  try {
    const { refus } = await croissancesDeLaPlage({ cwd: repo, debut: shas[0], fin: shas[2] })
    assert.deepEqual(refus.map((r) => [r.sha, r.fichier, r.net]), [[shas[1], PORTEUR, 2]])
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})

test('C : la même croissance RETIRÉE plus loin dans la plage ne refuse plus rien', async () => {
  const { repo, shas } = depotJetable([
    { contenu: sourceStock([]), message: 'socle' },
    { contenu: sourceStock([A, B]), message: 'deux exemptions de plus, sans cliquet' },
    { contenu: sourceStock([]), message: 'et on les retire' },
  ])
  try {
    assert.deepEqual((await croissancesDeLaPlage({ cwd: repo, debut: shas[0], fin: shas[2] })).refus, [])
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})

test('C : base NULLE sans tronc lisible → HEAD seul, et la porte le DIT (jamais un silence)', async () => {
  const { repo, shas } = depotJetable([
    { contenu: sourceStock([]), message: 'socle' },
    { contenu: sourceStock([A, B]), message: 'deux exemptions de plus, sans cliquet' },
    { contenu: `${sourceStock([A, B])}// tête anodine\n`, message: 'tête' },
  ])
  try {
    const { refus, notes } = await croissancesDeLaPlage({ cwd: repo, debut: SHA_NUL, fin: shas[2] })
    assert.deepEqual(refus, [], 'la tête seule ne porte aucune croissance')
    assert.deepEqual(notes, [
      `tronc \`origin/main\` illisible depuis ${shas[2].slice(0, 9)} : ses commits ne sont PAS exclus de la plage`,
      `plage inconnue : ni sha distant ni tronc — ${shas[2].slice(0, 9)} seul est jugé, sans ses parents`,
      `${shas[2].slice(0, 9)} sans ère (tronc \`origin/main\` illisible) : jugé(s) par la porte actuelle`,
    ])
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})

// TROIS ISSUES, pas deux : `null` dit « l'objet demandé n'existe pas » (une pre-image de fichier
// AJOUTÉ, cas normal de cette porte) ; une INDISPONIBILITÉ de git est rendue à part, et l'appelant
// la NOMME. Les confondre refuse le push d'un fichier neuf, ou juge une plage jamais lue.
test('git INDISPONIBLE : `indisponible` porte la raison, et la plage est NOMMÉE', async () => {
  const hors = mkdtempSync(join(tmpdir(), 'plage-hors-'))
  try {
    const vu = await croissancesDeLaPlage({ cwd: hors, debut: 'aaaaaaa', fin: 'bbbbbbb' })
    assert.match(vu.indisponible, /not a git repository/i)
    assert.equal(vu.plage, 'aaaaaaa..bbbbbbb')
    assert.deepEqual(vu.refus, [])
  } finally {
    rmSync(hors, { recursive: true, force: true })
  }
})

test('une plage d’OBJETS ABSENTS dans un dépôt réel ne lève AUCUNE indisponibilité', async () => {
  const { repo } = depotJetable([{ contenu: '// socle\n', message: 'socle' }])
  try {
    const vu = await croissancesDeLaPlage({ cwd: repo, debut: 'aaaaaaa', fin: 'bbbbbbb' })
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
test('C : un tableau de RACINES passé en ARGUMENT ne fait grandir aucun stock, un vrai stock si', async () => {
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
      (await croissancesDeLaPlage({ cwd: repo, debut: shas[0], fin: shas[1] })).refus, [],
      'trois arguments d’appel : aucune entrée de stock',
    )
    const { refus } = await croissancesDeLaPlage({ cwd: repo, debut: shas[1], fin: shas[2] })
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
test('C : un `git mv` de porteur rend net 0 ; renommé PLUS une entrée reste +1', async () => {
  const ancien = 'scripts/ancien.test.mjs'
  const nouveau = 'scripts/nouveau.test.mjs'
  const source = (entrees) => `export const STOCK = [\n${entrees.join('\n')}\n]\n`
  for (const [nom, ajoutees] of [['renommage pur', []], ['renommage + 1 entrée', [D]]]) {
    const { racine: repo, sha } = depotForge({ fichiers: { [ancien]: source([A, B, C]) }, message: 'socle' })
    const git = gitDe(repo)
    try {
      git('mv', ancien, nouveau)
      if (ajoutees.length) writeFileSync(join(repo, nouveau), source([A, B, C, ...ajoutees]), 'utf8')
      git('add', '-A')
      git('commit', '-q', '--no-verify', '-m', 'refactor: le porteur change de nom')
      const { refus } = await croissancesDeLaPlage({ cwd: repo, debut: sha, fin: git('rev-parse', 'HEAD').trim() })
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

test('C : un porteur SCINDÉ en deux ne grandit pas ; renommé MOINS une entrée non plus', async () => {
  const ancien = 'scripts/ancien.test.mjs'
  const source = (entrees) => `export const STOCK = [\n${entrees.join('\n')}\n]\n`
  const cas = {
    'scission en deux porteurs neufs': { 'scripts/gauche.test.mjs': [A, B], 'scripts/droite.test.mjs': [C] },
    // Une DÉCROISSANCE ne se crédite nulle part : la porte ne rend que les croissances nettes, et
    // l'entrée perdue au passage n'ouvre aucun droit à en ajouter une ailleurs.
    'renommage moins une entrée': { 'scripts/nouveau.test.mjs': [A, B] },
  }
  for (const [nom, porteurs] of Object.entries(cas)) {
    const { racine: repo, sha } = depotForge({ fichiers: { [ancien]: source([A, B, C]) }, message: 'socle' })
    const git = gitDe(repo)
    try {
      rmSync(join(repo, ancien))
      for (const [chemin, entrees] of Object.entries(porteurs)) writeFileSync(join(repo, chemin), source(entrees), 'utf8')
      git('add', '-A')
      git('commit', '-q', '--no-verify', '-m', 'refactor: le porteur se redistribue')
      const { refus } = await croissancesDeLaPlage({ cwd: repo, debut: sha, fin: git('rev-parse', 'HEAD').trim() })
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
  const { racine: repo } = depotForge({ fichiers: { [PORTEUR]: avant }, message: 'socle' })
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

// ÉQUIVALENCE DES DEUX VOIES. La porte du commit (`commit-msg`, images de l'index) et la
// porte de plage (au push, images `git show <sha>:<f>`) doivent rendre le MÊME compte sur le MÊME
// contenu : c'est leur divergence APPARENTE qui a fait payer des cliquets mensongers.
test('équivalence — solde au commit et plage au push comptent la même chose', async (t) => {
  const { diffDuCommit, evaluateStocksQuiGrandissent } = await import('../../git-hooks/porte-du-commit.mjs')
  const porteur = PORTEUR
  const cas = {
    'argument d’appel': ["const S = readCorpus(['src/ui'])"],
    'stock de module': ['const S = [', "  'src/a.ts',", "  'src/b.ts',", ']'],
  }
  for (const [nom, ajout] of Object.entries(cas)) {
    const { racine } = depotForge({ fichiers: { [porteur]: '// socle\n' }, message: 'socle' })
    const git = gitDe(racine)
    try {
      writeFileSync(join(racine, porteur), `// socle\n${ajout.join('\n')}\n`, 'utf8')
      git('add', '-A')
      const lectures = diffDuCommit(racine)
      const auCommit = evaluateStocksQuiGrandissent({
        message: 'test: sans cliquet',
        diff: lectures.diff([porteur]),
        images: { ...lectures.images([porteur]), renommages: lectures.renommages() },
      })
      const base = git('rev-parse', 'HEAD').trim()
      git('commit', '-q', '--no-verify', '-m', 'test: sans cliquet')
      const auPush = await croissancesDeLaPlage({ cwd: racine, debut: base, fin: git('rev-parse', 'HEAD').trim() })
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
// lecture par ligne ne reconnaît : seule une IMAGE les compte. Les deux portes en ont une — l'index
// au commit, `git show <sha>:<f>` au push — et rendent le même compte ; un appelant qui
// n'en fournit aucune est REFUSÉ, jamais servi d'un zéro.
test('équivalence — un `*-stock.json` qui NAÎT, GRANDIT, puis se DÉPLACE : même compte aux deux portes', async (t) => {
  const { croissanceDesStocks } = await import('./stocksNominatifs.mjs')
  const { diffDuCommit, evaluateStocksQuiGrandissent } = await import('../../git-hooks/porte-du-commit.mjs')
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

  const { racine } = depotForge({ fichiers: { 'scripts/raw/socle.md': '# socle\n' }, message: 'socle' })
  const git = gitDe(racine)
  const poser = (entrees) => { writeFileSync(join(racine, porteur), stock(entrees), 'utf8'); git('add', '-A') }
  const auPush = (debut) => croissancesDeLaPlage({ cwd: racine, debut, fin: git('rev-parse', 'HEAD').trim() })
  const auCommit = (message) => {
    const lectures = diffDuCommit(racine)
    return {
      verdict: evaluateStocksQuiGrandissent({
        message,
        diff: lectures.diff([porteur]),
        images: { ...lectures.images([porteur]), renommages: lectures.renommages() },
      }),
      diff: lectures.diff([porteur]),
    }
  }
  try {
    // NAISSANCE de 13 entrées, message muet : les deux portes refusent, et le compte est le VRAI.
    const base = git('rev-parse', 'HEAD').trim()
    poser(trous(13))
    const naissance = auCommit('test: un stock qui naît')
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
    assert.deepEqual((await auPush(base)).refus.map((r) => [r.fichier, r.net]), [[porteur, 13]], 'porte au push : le même compte')

    // CROISSANCE de deux entrées sur les treize, DITE par le message : les deux portes passent.
    const debut = git('rev-parse', 'HEAD').trim()
    poser(trous(15))
    const message = 'test: deux trous durs de plus\n\nCLIQUET: scripts/raw/fixture-stock.json +2 — deux chapitres non couverts par l’Atlas'
    const croissance = auCommit(message)
    assert.equal(croissance.verdict, null, 'porte au commit : la croissance est DITE, elle passe')
    assert.deepEqual(
      croissanceDesStocks(croissance.diff, { lirePostImage: (f) => readFileSync(join(racine, f), 'utf8') })
        .map((c) => c.net), [2],
      'témoin de non-vacuité : la croissance vaut bien +2 — sans le cliquet, le verdict serait un refus',
    )
    git('commit', '-q', '--no-verify', '-m', message)
    assert.deepEqual((await auPush(debut)).refus, [], 'porte au push : le cliquet du message couvre la croissance')

    // DÉPLACEMENT d'une entrée, message muet : le compte vient de la PRÉ-IMAGE lue (sans elle, la
    // lecture par ligne voit une entrée qui naît et ne voit pas celle qui part).
    const avantDeplacement = git('rev-parse', 'HEAD').trim()
    const quinze = trous(15)
    poser([...quinze.slice(1), quinze[0]])
    assert.equal(auCommit('test: une entrée déplacée').verdict, null, 'porte au commit : un déplacement ne fait rien naître')
    git('commit', '-q', '--no-verify', '-m', 'test: une entrée déplacée')
    assert.deepEqual((await auPush(avantDeplacement)).refus, [], 'porte au push : le même compte')
    t.diagnostic('naissance +13, croissance +2, déplacement 0, trois lectures concordantes')
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
  const { racine, sha } = depotForge({
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

test('RECLASSEMENT : un SECOND importeur fait franchir la console — refusé sans ligne, la ligne exacte passe', async () => {
  const { racine, base, commettre } = depotCss()
  try {
    const muet = commettre({ 'src/ui/Ecran2.tsx': importeur('Ecran2') }, 'feat: second écran')
    assert.deepEqual((await croissancesDeLaPlage({ cwd: racine, debut: base, fin: muet })).reclassements,
      [{ sha: muet, fusion: false, ecarts: [{ module: CONSOLE, n: 3, declare: null }], ere: null }])
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
  const d = depotCss()
  try {
    const dit = d.commettre({ 'src/ui/Ecran2.tsx': importeur('Ecran2') }, RECLASSE)
    assert.deepEqual((await croissancesDeLaPlage({ cwd: d.racine, debut: d.base, fin: dit })).reclassements, [])
  } finally {
    rmSync(d.racine, { recursive: true, force: true })
  }
})

test('RECLASSEMENT (D3″) : franchie puis rendue au stock dans la plage — le PREMIER commit reste refusé, le second n’a rien à dire', async () => {
  const { racine, base, commettre } = depotCss()
  try {
    const c1 = commettre({ 'src/ui/Ecran2.tsx': importeur('Ecran2') }, 'feat: second écran')
    const c2 = commettre({ 'src/ui/Ecran2.tsx': null }, 'revert: un seul écran')
    const { reclassements } = await croissancesDeLaPlage({ cwd: racine, debut: base, fin: c2 })
    assert.deepEqual(reclassements, [{ sha: c1, fusion: false, ecarts: [{ module: CONSOLE, n: 3, declare: null }], ere: null }])
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('équivalence — RECLASSEMENT au commit et à la plage : même verdict', async () => {
  const { diffDuCommit, evaluateReclassementsCss } = await import('../../git-hooks/porte-du-commit.mjs')
  for (const message of ['feat: second écran', RECLASSE]) {
    const { racine, base, git } = depotCss()
    try {
      writeFileSync(join(racine, 'src/ui/Ecran2.tsx'), importeur('Ecran2'), 'utf8')
      git('add', '-A')
      const commit = diffDuCommit(racine)
      const auCommit = evaluateReclassementsCss({
        message,
        deplace: () => commit.deplaceLaFrontiereCss(['src/ui/Ecran2.tsx']),
        cotes: commit.cotesCss,
      })
      git('commit', '-q', '--no-verify', '-m', message)
      const auPush = await croissancesDeLaPlage({ cwd: racine, debut: base, fin: git('rev-parse', 'HEAD').trim() })
      assert.equal(auCommit === null, auPush.reclassements.length === 0, `${message} : les deux voies divergent`)
      assert.equal(auCommit === null, message === RECLASSE, `${message} : verdict`)
      if (auCommit) assert.ok(auCommit.reason.includes(`${CONSOLE} : franchi au prix 3, aucune ligne`), auCommit.reason)
    } finally {
      rmSync(racine, { recursive: true, force: true })
    }
  }
})

test('RECLASSEMENT : le renommage PUR d’une primitive réutilisée ne fait franchir aucun module — ni au commit, ni à la plage', async () => {
  const { diffDuCommit, evaluateReclassementsCss } = await import('../../git-hooks/porte-du-commit.mjs')
  const { racine, git, commettre } = depotCss()
  try {
    const reutilisee = commettre({ 'src/ui/Ecran2.tsx': importeur('Ecran2') }, RECLASSE)
    git('mv', COMPOSANT, 'src/ui/Pupitre.tsx')
    const pupitre = (nom) => `import { Console } from './Pupitre'\nexport const ${nom} = Console\n`
    writeFileSync(join(racine, ECRAN1), pupitre('Ecran1'), 'utf8')
    writeFileSync(join(racine, 'src/ui/Ecran2.tsx'), pupitre('Ecran2'), 'utf8')
    writeFileSync(join(racine, MANIFESTE), manifesteAvec({ ...PRIMITIVE_CONSOLE, fichier: 'src/ui/Pupitre.tsx' }), 'utf8')
    git('add', '-A')
    const commit = diffDuCommit(racine)
    assert.equal(evaluateReclassementsCss({ message: 'refactor: la console devient le pupitre', deplace: () => commit.deplaceLaFrontiereCss([MANIFESTE, ECRAN1]), cotes: commit.cotesCss }), null)
    git('commit', '-q', '--no-verify', '-m', 'refactor: la console devient le pupitre')
    const renomme = git('rev-parse', 'HEAD').trim()
    assert.deepEqual((await croissancesDeLaPlage({ cwd: racine, debut: reutilisee, fin: renomme })).reclassements, [])
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

test('RECLASSEMENT d’une FUSION : ce que main a fait franchir n’est pas à elle — même quand la fusion touche le manifeste', async () => {
  for (const dansLaFusion of [{}, { [MANIFESTE]: manifesteAvec(PRIMITIVE_CONSOLE, { id: 'b' }) }]) {
    const { racine, debut, fusion } = fusionCss({ surMain: { 'src/ui/Ecran2.tsx': importeur('Ecran2') }, messageMain: RECLASSE, dansLaFusion })
    try {
      assert.deepEqual((await croissancesDeLaPlage({ cwd: racine, debut, fin: fusion })).reclassements, [], JSON.stringify(Object.keys(dansLaFusion)))
    } finally {
      rmSync(racine, { recursive: true, force: true })
    }
  }
})

test('RECLASSEMENT d’une FUSION « maléfique » : le franchissement qu’elle pose elle-même est refusé, et nommé', async () => {
  const { racine, debut, fusion } = fusionCss({
    surMain: { 'main.txt': 'main avance\n' },
    messageMain: 'docs: main avance',
    dansLaFusion: { 'src/ui/Ecran2.tsx': importeur('Ecran2') },
  })
  try {
    assert.deepEqual((await croissancesDeLaPlage({ cwd: racine, debut, fin: fusion })).reclassements,
      [{ sha: fusion, fusion: true, ecarts: [{ module: CONSOLE, n: 3, declare: null }], ere: null }])
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

// Un chemin non-ASCII, que la forme ligne de git CITE (`core.quotePath`) : `"src/ui/\303\211cran.tsx"`.
const ECRAN_ACCENTUE = 'src/ui/Écran.tsx'

test('RECLASSEMENT : le second importeur au chemin NON-ASCII fait franchir la console — à la plage', async () => {
  const { racine, commettre } = depotCss()
  try {
    const debut = commettre({ [ECRAN_ACCENTUE]: 'export const E = 1\n' }, 'feat: écran nu')
    const muet = commettre({ [ECRAN_ACCENTUE]: importeur('E') }, 'feat: l’écran importe la console')
    assert.deepEqual((await croissancesDeLaPlage({ cwd: racine, debut, fin: muet })).reclassements,
      [{ sha: muet, fusion: false, ecarts: [{ module: CONSOLE, n: 3, declare: null }], ere: null }])
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

test('RECLASSEMENT au commit : la porte lit l’INDEX que git emporte — chemin non-ASCII compris', async () => {
  const { analyzeDiffDuCommit, diffDuCommit } = await import('../../git-hooks/porte-du-commit.mjs')
  const AUTRE = 'src/ui/Autre.tsx'
  /** Console importée par PERSONNE au socle : un seul importeur emporté ne la réutilise pas, deux oui. */
  const juger = ({ ecrire, indexer }) => {
    const { racine } = depotForge({
      fichiers: {
        [MANIFESTE]: manifesteAvec(PRIMITIVE_CONSOLE), [CONSOLE]: '.c { color: red }\n', [COMPOSANT]: 'export const Console = 1\n',
        [ECRAN_ACCENTUE]: 'export const E = 1\n', [AUTRE]: 'export const A = 1\n',
      },
      message: 'socle',
    })
    try {
      for (const f of ecrire) writeFileSync(join(racine, f), importeur(f.slice(7, -4)), 'utf8')
      lancerGit(['add', '--', ...indexer], { cwd: racine })
      const c = diffDuCommit(racine)
      const { fichiers } = analyzeDiffDuCommit(c.numstat())
      return { fichiers: fichiers.sort(), deplace: c.deplaceLaFrontiereCss(fichiers), reutilises: [...c.cotesCss().commit.reutilises] }
    } finally {
      rmSync(racine, { recursive: true, force: true })
    }
  }
  assert.deepEqual(juger({ ecrire: [ECRAN_ACCENTUE, AUTRE], indexer: [ECRAN_ACCENTUE] }),
    { fichiers: [ECRAN_ACCENTUE], deplace: true, reutilises: [] }, 'index : `Autre` non indexé reste au socle')
  assert.deepEqual(juger({ ecrire: [ECRAN_ACCENTUE, AUTRE], indexer: [ECRAN_ACCENTUE, AUTRE] }),
    { fichiers: [AUTRE, ECRAN_ACCENTUE].sort(), deplace: true, reutilises: [COMPOSANT] }, 'index : les deux indexés')
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

test('RECLASSEMENT : manifeste ILLISIBLE → refus NOMMÉ par son commit, jamais une levée qui emporterait les autres refus', async () => {
  const { racine, sha } = depotForge({ fichiers: { 'a.txt': 'a\n' }, message: 'socle' })
  const git = gitDe(racine)
  try {
    mkdirSync(join(racine, dirname(MANIFESTE)), { recursive: true })
    writeFileSync(join(racine, MANIFESTE), '{pas du json\n', 'utf8')
    git('add', MANIFESTE)
    git('commit', '-q', '--no-verify', '-m', 'feat')
    const c1 = git('rev-parse', 'HEAD').trim()
    const lu = await croissancesDeLaPlage({ cwd: racine, debut: sha, fin: c1 })
    assert.deepEqual(lu.reclassements.map((r) => [r.sha, /primitives\.manifest\.json illisible/.test(r.illisible)]), [[c1, true]])
    assert.deepEqual(lu.refus, [])
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

// #1806 D1 — le porteur au chemin NON-ASCII, lu dans les en-têtes du patch `-U0` de chaque commit et
// du cumul : aucun `-z` n'y existe, l'hôte (`gitPorte.mjs`) les rend en clair.
test('PLAGE : un stock au chemin NON-ASCII qui grandit sans CLIQUET est refusé', async () => {
  const porteur = 'src/ui/Écran.test.ts'
  const { racine, sha } = depotForge({ fichiers: { [porteur]: `export const STOCK = [\n${A}\n]\n` }, message: 'socle' })
  const git = gitDe(racine)
  try {
    writeFileSync(join(racine, porteur), `export const STOCK = [\n${A}\n${B}\n]\n`, 'utf8')
    git('commit', '-q', '--no-verify', '-am', 'feat: une exemption de plus')
    const fin = git('rev-parse', 'HEAD').trim()
    assert.deepEqual((await croissancesDeLaPlage({ cwd: racine, debut: sha, fin })).refus.map((r) => [r.fichier, r.net]), [[porteur, 1]])
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

// #2472

test('CLIQUET : renommer ou remplacer une entrée coûte zéro ; ajouter une entrée coûte +1', async () => {
  const { racine, sha } = depotForge({
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
    assert.deepEqual((await croissancesDeLaPlage({ cwd: racine, debut: sha, fin: renomme })).refus, [])
    writeFileSync(join(racine, PORTEUR), `export const STOCK = [\n  'src/z.ts',\n  'src/y.ts',\n]\n`, 'utf8')
    git('add', '-A')
    git('commit', '-q', '--no-verify', '-m', 'refactor: b devient y, sans renommage')
    const reecrit = git('rev-parse', 'HEAD').trim()
    assert.deepEqual((await croissancesDeLaPlage({ cwd: racine, debut: renomme, fin: reecrit })).refus, [])
    writeFileSync(join(racine, PORTEUR), `export const STOCK = [\n  'src/z.ts',\n  'src/y.ts',\n${C}\n]\n`, 'utf8')
    git('add', '-A')
    git('commit', '-q', '--no-verify', '-m', 'feat: une entrée de plus')
    assert.deepEqual((await croissancesDeLaPlage({ cwd: racine, debut: reecrit, fin: git('rev-parse', 'HEAD').trim() })).refus.map((r) => [r.fichier, r.net]), [[PORTEUR, 1]])
  } finally {
    rmSync(racine, { recursive: true, force: true })
  }
})

// ── Les FUSIONS se lisent par ce qu'elles font contre CHACUN de leurs parents (#2223) ─────────────

/** Dépôt jetable dont `main` fusionne une branche `cote`. La branche fait grandir le stock sous son
 *  CLIQUET ; `retouche` (texte du porteur posé DANS la fusion, ou `null`) rend la fusion maléfique. */
function depotAFusion(retouche) {
  const { racine: repo, sha: socle } = depotForge({ fichiers: { [PORTEUR]: sourceStock([A]), 'autre.txt': 'o\n' }, message: 'socle' })
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

test('PLAGE : une fusion PROPRE ne rejuge pas la croissance cliquetée de la branche qu’elle amène', async () => {
  const { repo, socle, fusion } = depotAFusion(null)
  try {
    const vu = await croissancesDeLaPlage({ cwd: repo, debut: socle, fin: fusion })
    assert.equal(vu.commits, 3, 'la fusion est dans la plage, avec ses deux parents')
    assert.deepEqual(vu.refus, [])
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})

test('PLAGE : une fusion « maléfique » qui fait grandir un stock en fusionnant est refusée, et nommée', async () => {
  const { repo, socle, fusion } = depotAFusion(sourceStock([A, B, C]))
  try {
    const { refus } = await croissancesDeLaPlage({ cwd: repo, debut: socle, fin: fusion })
    assert.deepEqual(refus.map((r) => [r.sha, r.fichier, r.net]), [[fusion, PORTEUR, 1]])
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})

test('PLAGE : une fusion qui RÉÉCRIT une entrée amenée par la branche ne grandit rien — sa base est la fusion automatique, en entrées', async () => {
  const { repo, socle, fusion } = depotAFusion(sourceStock([A, "  'src/b.ts', // retouchée à la fusion"]))
  try {
    assert.deepEqual((await croissancesDeLaPlage({ cwd: repo, debut: socle, fin: fusion })).refus, [])
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})

test('PLAGE : une FUSION lue par un git plus ancien que 2.40 rend la plage INDISPONIBLE, nommée, sans rien juger', async () => {
  const { repo, socle, fusion } = depotAFusion(null)
  try {
    const vu = await sousGitFeint([{ si: ['version'], status: 0, stdout: 'git version 2.39.2\n' }], () => croissancesDeLaPlage({ cwd: repo, debut: socle, fin: fusion }))
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
  const { racine: repo, sha: debut } = depotForge({ fichiers: { [PORTEUR]: sourceStock([A, B, C, D]) }, message: 'socle' })
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

test('TRONC : le commit du tronc fusionné n’est pas rejugé ; le commit propre à la branche est refusé', async () => {
  const d = depotATronc({ surMain: sourceStock([A, B, C, D, "  'src/e.ts',"]), apres: sourceStock([A, B, C, D, "  'src/e.ts',", "  'src/f.ts',"]) })
  try {
    const vu = await juge(d)
    assert.equal(vu.commits, 2, 'la fusion et le commit de branche : rien du tronc')
    assert.deepEqual(refusDe(vu), [[d.fin, PORTEUR, 1]])
  } finally {
    rmSync(d.repo, { recursive: true, force: true })
  }
})

test('TRONC : une fusion dont la RÉSOLUTION ajoute au stock sans sa ligne est refusée', async () => {
  const d = depotATronc({ surMain: sourceStock([A, B, C, D, "  'src/e.ts',"]), dansLaFusion: sourceStock([A, B, C, D, "  'src/e.ts',", "  'src/f.ts',"]) })
  try {
    assert.deepEqual(refusDe(await juge(d)), [[d.fusion, PORTEUR, 1]])
  } finally {
    rmSync(d.repo, { recursive: true, force: true })
  }
})

// Le tronc RETIRE une entrée, la branche en ajoute une sous la MÊME clé sans cliquet : le cumul
// retranche ce que le tronc a changé, la clé reste à +1 et le commit de branche est refusé.
test('TRONC : une baisse faite par le tronc ne paie pas la croissance non déclarée de la branche', async () => {
  const d = depotATronc({ surMain: sourceStock([B, C, D]), avant: sourceStock([A, B, C, D, A_BIS]) })
  try {
    assert.deepEqual(refusDe(await juge(d)), [[d.avantFusion, PORTEUR, 1]])
  } finally {
    rmSync(d.repo, { recursive: true, force: true })
  }
})

test('TRONC : un push VERS le tronc juge ses commits, et le dit', async () => {
  const { racine: repo, sha: debut } = depotForge({ fichiers: { [PORTEUR]: sourceStock([A]) }, message: 'socle' })
  const git = gitDe(repo)
  try {
    writeFileSync(join(repo, PORTEUR), sourceStock([A, B]), 'utf8')
    git('commit', '-q', '--no-verify', '-am', 'tronc, sans cliquet')
    const fin = git('rev-parse', 'HEAD').trim()
    git('update-ref', 'refs/remotes/origin/main', fin)
    const vu = await croissancesDeLaPlage({ cwd: repo, debut, fin, vers: TRONC.branche })
    assert.deepEqual([vu.commits, refusDe(vu)], [1, [[fin, PORTEUR, 1]]], '`origin/main` = `fin` (la CI après fetch) n’efface rien')
    assert.deepEqual(vu.notes, ["push vers le tronc (`refs/heads/main`) : `debut` est le tronc d'avant, rien d'autre n'est exclu"])
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})

test('TRONC : un tronc ILLISIBLE est nommé, et n’exclut rien', async () => {
  const d = depotATronc({ surMain: sourceStock([A, B, C, D, "  'src/e.ts',"]), apres: sourceStock([A, B, C, D, "  'src/e.ts',", "  'src/f.ts',"]) })
  try {
    lancerGit(['update-ref', '-d', 'refs/remotes/origin/main'], { cwd: d.repo })
    const vu = await juge(d)
    assert.deepEqual(vu.notes, [
      `tronc \`origin/main\` illisible depuis ${d.fin.slice(0, 9)} : ses commits ne sont PAS exclus de la plage`,
      `${[d.duTronc, d.fusion, d.fin].map((s) => s.slice(0, 9)).join(', ')} sans ère (tronc \`origin/main\` illisible) : jugé(s) par la porte actuelle`,
    ])
    assert.equal(vu.commits, 3, 'le commit du tronc est jugé, et la note le dit')
  } finally {
    rmSync(d.repo, { recursive: true, force: true })
  }
})

// ── Le cumul est un bilan d'ÉTATS : un changement porté par deux parents compte une fois ─────────

/** Dépôt jetable dont `origin/main` reste au socle ; `poser(fichiers, message)` écrit (`null` =
 *  supprime) puis commet, et rend le sha. */
function depotDeChantier(fichiers) {
  const { racine: repo, sha: debut } = depotForge({ fichiers, message: 'socle' })
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

test('CUMUL (E) : un retrait porté par les DEUX parents d’une fusion ne paie pas deux ajouts non déclarés', async () => {
  const d = depotDeChantier({ [PORTEUR]: sourceStock([A, B]) })
  try {
    d.poser({ [PORTEUR]: sourceStock([B]) }, 'retire A')
    fusionLaterale(d, { [PORTEUR]: sourceStock([B]) })
    const fin = d.poser({ [PORTEUR]: sourceStock([B, A_BIS, "  'src/a.ts', // ter"]) }, 'deux sous a, sans cliquet')
    assert.deepEqual(refusDe(await d.plage(fin)), [[fin, PORTEUR, 2]])
  } finally {
    rmSync(d.repo, { recursive: true, force: true })
  }
})

test('CUMUL (E2) : un ajout porté par les DEUX parents puis retiré une fois ne refuse rien', async () => {
  const d = depotDeChantier({ [PORTEUR]: sourceStock([B]) })
  try {
    d.poser({ [PORTEUR]: sourceStock([A, B]) }, 'ajoute A')
    fusionLaterale(d, { [PORTEUR]: sourceStock([A, B]) })
    const fin = d.poser({ [PORTEUR]: sourceStock([B]) }, 'retire A')
    assert.deepEqual((await d.plage(fin)).refus, [])
  } finally {
    rmSync(d.repo, { recursive: true, force: true })
  }
})

test('CUMUL (B) : une clé renommée sur deux commits (`git mv`, puis le stock suit) ne grandit rien', async () => {
  const d = depotDeChantier({ [PORTEUR]: sourceStock([A]), 'src/a.ts': 'export const a = 1\n' })
  try {
    d.git('mv', 'src/a.ts', 'src/z.ts')
    d.poser({}, 'git mv a -> z')
    const fin = d.poser({ [PORTEUR]: sourceStock(["  'src/z.ts',"]) }, 'le stock suit')
    assert.deepEqual((await d.plage(fin)).refus, [])
  } finally {
    rmSync(d.repo, { recursive: true, force: true })
  }
})

test('CUMUL (C) : un stock DÉPLACÉ d’un porteur à un autre sur deux commits ne grandit rien', async () => {
  const P2 = 'scripts/y.test.mjs'
  const d = depotDeChantier({ [PORTEUR]: sourceStock([A, B]) })
  try {
    d.poser({ [PORTEUR]: null }, 'supprime le porteur')
    const fin = d.poser({ [P2]: sourceStock([A, B]) }, 'recrée le porteur ailleurs')
    assert.deepEqual((await d.plage(fin)).refus, [])
  } finally {
    rmSync(d.repo, { recursive: true, force: true })
  }
})

// ── `debut` NUL : ce que la tête apporte au tronc, quelle que soit la ref poussée ────────────────

/** Tronc local `main` en avance de deux commits sur `origin/main`, le second sans cliquet. */
function depotEnAvance() {
  const { racine: repo, sha: socle } = depotForge({ fichiers: { [PORTEUR]: sourceStock([A]) }, message: 'socle' })
  const git = gitDe(repo)
  git('update-ref', 'refs/remotes/origin/main', socle)
  writeFileSync(join(repo, PORTEUR), sourceStock([A, B]), 'utf8')
  git('commit', '-q', '--no-verify', '-am', 'non poussé, sans cliquet')
  const milieu = git('rev-parse', 'HEAD').trim()
  writeFileSync(join(repo, PORTEUR), `${sourceStock([A, B])}// tête anodine\n`, 'utf8')
  git('commit', '-q', '--no-verify', '-am', 'tête')
  return { repo, git, milieu, fin: git('rev-parse', 'HEAD').trim() }
}

test('DEBUT NUL : vers le tronc (HEAD sur `main` hors CI, canari) comme en tête détachée, la plage est `fin ^origin/main`', async () => {
  const d = depotEnAvance()
  try {
    for (const vers of [TRONC.branche, null]) {
      const vu = await croissancesDeLaPlage({ cwd: d.repo, debut: SHA_NUL, fin: d.fin, vers })
      assert.deepEqual([vu.commits, vu.notes, refusDe(vu)], [2, [], [[d.milieu, PORTEUR, 1]]], String(vers))
    }
  } finally {
    rmSync(d.repo, { recursive: true, force: true })
  }
})

test('DEBUT NUL : une branche NEUVE juge son apport au tronc, et le cumul le compte', async () => {
  const d = depotATronc({ surMain: sourceStock([A, B, C, D, "  'src/e.ts',"]), apres: sourceStock([A, B, C, D, "  'src/e.ts',", "  'src/f.ts',"]) })
  try {
    const vu = await croissancesDeLaPlage({ cwd: d.repo, debut: SHA_NUL, fin: d.fin, vers: CHANTIER })
    assert.deepEqual([vu.commits, vu.notes, refusDe(vu)], [2, [], [[d.fin, PORTEUR, 1]]])
  } finally {
    rmSync(d.repo, { recursive: true, force: true })
  }
})

test('SEUL : sans aucune borne, une FUSION est jugée seule, sans le côté de son second parent', async () => {
  const { repo, fusion } = depotAFusion(sourceStock([A, B, C]))
  try {
    const vu = await croissancesDeLaPlage({ cwd: repo, debut: SHA_NUL, fin: fusion })
    assert.deepEqual([vu.commits, refusDe(vu)], [1, [[fusion, PORTEUR, 1]]])
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})

test('CUMUL : un `debut` sans ancêtre commun avec le tronc est NOMMÉ, et rien n’est retranché', async () => {
  const { racine: repo, sha: socle } = depotForge({ fichiers: { [PORTEUR]: sourceStock([A]) }, message: 'socle' })
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
    const vu = await croissancesDeLaPlage({ cwd: repo, debut, fin, vers: CHANTIER })
    assert.deepEqual(vu.notes, [`\`${debut.slice(0, 9)}\` sans ancêtre commun avec \`origin/main\` : le cumul ne retranche rien du tronc`])
    assert.deepEqual(refusDe(vu), [[fin, PORTEUR, 1]])
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})

test('SEUL : le cumul d’une fusion jugée seule est SON apport, pas le diff de son premier parent', async () => {
  const { racine: repo } = depotForge({ fichiers: { [PORTEUR]: sourceStock([A, B]), 'autre.txt': 'o\n' }, message: 'socle' })
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
    assert.deepEqual(refusDe(await croissancesDeLaPlage({ cwd: repo, debut: SHA_NUL, fin: fusion })), [[fusion, PORTEUR, 1]])
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

test('#2223 ENTRÉES : réécrire une entrée sans changer son fichier ne fait rien naître — champ d’un site, extension ajoutée dans une paire de Map', async () => {
  const REGISTRE = 'scripts/guards/lib/x.mjs'
  const paire = (valeur) => `export const TYPES = new Map([['BoneId', '${valeur}']])\n`
  const d = depotDeChantier({ [STOCK_JSON]: stockJson(SITES), [REGISTRE]: paire('src/os/bones') })
  try {
    const fin = d.poser({
      [STOCK_JSON]: stockJson([SITES[0], site('src/b.ts', 'r2', 99), SITES[2], SITES[3]]),
      [REGISTRE]: paire('src/os/bones.ts'),
    }, 'réécrit deux valeurs')
    assert.deepEqual(refusDe(await d.plage(fin)), [])
  } finally {
    rmSync(d.repo, { recursive: true, force: true })
  }
})

test('#2223 ENTRÉES : ajouter une entrée la compte +1 (contrat positif), réordonnancement compris', async () => {
  const d = depotDeChantier({ [STOCK_JSON]: stockJson(SITES) })
  try {
    const fin = d.poser({ [STOCK_JSON]: stockJson([SITES[3], site('src/d.ts', 'r5', 5), ...SITES.slice(0, 3)]) }, 'ajoute d')
    assert.deepEqual(refusDe(await d.plage(fin)), [[fin, STOCK_JSON, 1]])
  } finally {
    rmSync(d.repo, { recursive: true, force: true })
  }
})

test('#2223 FUSION : un conflit résolu sur le manifeste se lit contre les parents — aucun « illisible »', async () => {
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
    const vu = await d.plage(fin)
    assert.deepEqual([vu.indisponible, vu.reclassements, vu.refus], [null, [], []])
  } finally {
    rmSync(d.repo, { recursive: true, force: true })
  }
})

test('#2223 RECLASSEMENT d’une FUSION à trois voies : les DEUX côtés franchissent la console, la fusion n’ajoute rien — aucune ligne exigée', async () => {
  const d = depotCss()
  try {
    d.git('checkout', '-q', '-b', 'chantier')
    d.commettre({ 'src/ui/Ecran2.tsx': importeur('Ecran2') }, RECLASSE)
    d.git('checkout', '-q', 'main')
    d.commettre({ 'src/ui/Ecran3.tsx': importeur('Ecran3') }, RECLASSE)
    d.git('checkout', '-q', 'chantier')
    d.git('merge', '-q', '--no-ff', '--no-commit', 'main')
    const fusion = d.commettre({ [MANIFESTE]: manifesteAvec(PRIMITIVE_CONSOLE, { id: 'b' }) }, 'fusion de main, manifeste retouché')
    assert.deepEqual((await croissancesDeLaPlage({ cwd: d.racine, debut: d.base, fin: fusion })).reclassements, [])
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

test('#2223 FUSION : un porteur SUPPRIMÉ par le tronc, enrichi par le chantier, gardé par la résolution — ses entrées ressuscitées sont refusées', async () => {
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
    assert.deepEqual(refusDe(await d.plage(fin)), [[fin, PORTEUR, 3]])
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
  return { ...d, fusionner, juger: async (debut, fin, vers = CHANTIER) => refusDe(await croissancesDeLaPlage({ cwd: d.repo, debut, fin, vers })) }
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
    return [debut, fin, () => []]
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
  test(`#2223 CONSTRUIT ${nom}`, async () => {
    const d = depotConstruit({ 'src/a.ts': corpsDe('a') })
    try {
      const [debut, fin, attendu, vers] = construire(d)
      assert.deepEqual(await d.juger(debut, fin, vers), attendu())
    } finally {
      rmSync(d.repo, { recursive: true, force: true })
    }
  })
}

for (const muette of [false, true]) {
  test(`#2223 CONSTRUIT N6${muette ? 'b' : ''} : octopus résolu, trois parents et indisponibilité nommée`, async () => {
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
      const vu = await d.plage(fin)
      assert.match(vu.indisponible, /3 parents/)
      assert.deepEqual([vu.refus, vu.reclassements], [[], []])
    } finally {
      rmSync(d.repo, { recursive: true, force: true })
    }
  })
}

// ── #2223 : le hook de commit juge une fusion EN COURS sur son apport, comme la plage ──────────────

const messageDeFusion = (lignes = '') => `chore(merge): refs #2223 — fusion de main${lignes}`
/** Le verdict de la porte du commit (`jugerLeCommit`) sur l'index de `repo`, sous le message `message`. */
const auHook = async (repo, message) => {
  const { jugerLeCommit } = await import('../../git-hooks/porte-du-commit.mjs')
  return jugerLeCommit({ message, dir: repo, today: '2026-10-01' })
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
    const { diffDuCommit } = await import('../../git-hooks/porte-du-commit.mjs')
    assert.ok(diffDuCommit(d.repo).fusion(), 'l’index sous MERGE_HEAD est lu comme une fusion')
    assert.equal(await auHook(d.repo, messageDeFusion(cliquet(PORTEUR, 1))), null, 'la ligne exacte de l’apport passe')
    for (const lignes of ['', cliquet(PORTEUR, 2)]) {
      const refus = await auHook(d.repo, messageDeFusion(lignes))
      assert.ok(refus?.reason.includes(`${PORTEUR} : +1 entrée(s) nette(s)`), JSON.stringify([lignes, refus]))
    }
    const fin = d.poser({}, `fusion de main${cliquet(PORTEUR, 1)}`)
    assert.deepEqual(await d.juger(d.debut, fin), [], 'la plage rend le même verdict sur la fusion posée')
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
    assert.equal(await auHook(d.racine, messageDeFusion()), null)
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
    const refus = await auHook(d.racine, messageDeFusion())
    assert.match(refus?.reason ?? '', /RECLASSEMENT CSS : src\/ui\/styles\/console\.css : franchi au prix 3, aucune ligne/)
  } finally {
    rmSync(d.racine, { recursive: true, force: true })
  }
})

test('#2223 REFUS d’une plage : le geste suit la sorte du commit fautif — fusion ou commit simple, jamais `rebase -i`', async () => {
  const { repo, socle, fusion } = depotAFusion(sourceStock([A, B, C]))
  try {
    const { refus } = await croissancesDeLaPlage({ cwd: repo, debut: socle, fin: fusion })
    assert.deepEqual(refus.map((r) => [r.sha, r.fusion]), [[fusion, true]])
    const raison = raisonDeRefusDePlage(refus)
    assert.ok(raison.includes(`(fusion) ${PORTEUR} +1`))
    assert.match(raison, /FUSION : `git commit --amend` de la fusion si elle est la tête ; sinon refaire la fusion/)
    assert.doesNotMatch(raison, /commit simple|rebase -i/)
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})

// ── #2503 : chaque commit jugé par la porte de son ÈRE (`merge-base` avec le tronc) ───────────────
// Les portes forgées tiennent le CONTRAT d'entrée (`commits`, `cumul`) en quelques lignes : `porteurs`
// comptés sur les lignes de leur `diff`, au NET ou en AJOUTÉES, refusés hors d'un CLIQUET exact.

const X = 'x.txt'
const Y = 'y.txt'

/** Le stock que fait naître la sonde de VIE de la porte de plage (`vieDeLaPorte`) : toute porte forgée le compte. */
const VIE_DE_LA_PLAGE = `${['scripts', 'guards', 'vie-stock'].join('/')}.json`

/** Le texte d'une porte de plage forgée. */
const porteForgee = ({ porteurs, net }) => [
  "import './stocksNominatifs.mjs'",
  `const PORTEURS = ${JSON.stringify([...porteurs, VIE_DE_LA_PLAGE])}`,
  'export function refusDeLaPlage({ commits }) {',
  '  const refus = []',
  "  for (const { sha, message = '', diff = '' } of commits) {",
  '    for (const fichier of PORTEURS) {',
  "      const bloc = diff.split(/^diff --git /m).find((b) => b.startsWith(`a/${fichier} `))",
  '      if (!bloc) continue',
  "      const lignes = bloc.split('\\n')",
  "      const ajoutees = lignes.filter((l) => l.startsWith('+') && !l.startsWith('+++')).length",
  "      const retirees = lignes.filter((l) => l.startsWith('-') && !l.startsWith('---')).length",
  `      const n = ${net ? 'ajoutees - retirees' : 'ajoutees'}`,
  "      const lu = new RegExp(`^CLIQUET: ${fichier} \\\\+(\\\\d+)`, 'm').exec(message)",
  '      const declare = lu ? Number(lu[1]) : null',
  '      if (n > 0 && declare !== n) refus.push({ sha, fusion: false, fichier, net: n, declare, exemples: [] })',
  '    }',
  '  }',
  '  return refus',
  '}',
  'export const reclassementsDeLaPlage = () => []',
  '',
].join('\n')

const MODULE_PORTE = PORTE_DE_PLAGE.module
const STOCKS_VIVANTS = 'scripts/guards/lib/stocksNominatifs.mjs'
/** La lib que sonde la VIE d'une porte forgée : une entrée sur toute image. */
const VIE = "export const entreesNominatives = () => [{ ligne: 1, nomme: 1, cle: 'vie' }]\n"
const PORTE_V1 = porteForgee({ porteurs: [Y], net: false })
const PORTE_V2 = porteForgee({ porteurs: [Y, X], net: true })

/** Dépôt jetable dont le socle porte `porte` ; `poser(fichiers, message)` commet sur la branche
 *  courante et rend le sha ; `tronc(sha)` pose `origin/main`. */
function depotDEres(porte, autres = {}) {
  const { racine: repo, sha: socle } = instanceDeDepot({
    fichiers: { [MODULE_PORTE]: porte, [STOCKS_VIVANTS]: VIE, [X]: 'x0\n', [Y]: 'y0\ny1\n', ...autres },
    message: 'socle',
  })
  const git = gitDe(repo)
  git('update-ref', 'refs/remotes/origin/main', socle)
  const poser = (aPoser, message) => {
    for (const [rel, texte] of Object.entries(aPoser)) {
      mkdirSync(dirname(join(repo, rel)), { recursive: true })
      writeFileSync(join(repo, rel), texte, 'utf8')
      git('add', rel)
    }
    git('commit', '-q', '--no-verify', '-m', message)
    return git('rev-parse', 'HEAD').trim()
  }
  const tronc = (sha) => git('update-ref', 'refs/remotes/origin/main', sha)
  const plage = async (fin) => croissancesDeLaPlage({ cwd: repo, debut: SHA_NUL, fin, vers: CHANTIER })
  return { repo, socle, git, poser, tronc, plage }
}

test('#2503 ÈRE, compte qui MONTE : un commit né sous T0 garde sa porte quand T1 compte son porteur ; après la fusion de T1, la croissance muette est refusée', async () => {
  const d = depotDEres(PORTE_V1)
  try {
    d.git('checkout', '-q', '-b', 'chantier')
    const avant = d.poser({ [X]: 'x0\nx1\n' }, 'x grandit sous T0, muet')
    d.git('checkout', '-q', 'main')
    const t1 = d.poser({ [MODULE_PORTE]: PORTE_V2 }, 'T1 : la porte compte x')
    d.tronc(t1)
    d.git('checkout', '-q', 'chantier')
    const vu = await d.plage(avant)
    assert.deepEqual(vu.refus, [], 'jugé par la porte de son ère T0')
    assert.deepEqual(vu.eres.map((e) => [e.ere, e.commits, e.note]), [[d.socle, [avant], null]])
    d.git('merge', '-q', '--no-ff', '-m', 'fusion de T1', 'main')
    const apres = d.poser({ [X]: 'x0\nx1\nx2\n' }, 'x grandit sous T1, muet')
    const refus = (await d.plage(apres)).refus
    assert.deepEqual(refus.map((r) => [r.sha, r.fichier, r.net, r.ere]), [[apres, X, 1, t1]])
    assert.match(raisonDeRefusDePlage(refus), new RegExp(`${apres.slice(0, 9)} jugé par la porte de son ère ${t1.slice(0, 9)}, ${X} \\+1`))
  } finally {
    rmSync(d.repo, { recursive: true, force: true })
  }
})

test('#2503 ÈRE, compte qui BAISSE : l’annonce au compte d’ajoutées passe dans l’ère T0, la même est refusée dans l’ère T1', async () => {
  const d = depotDEres(PORTE_V1)
  try {
    const message = `y : une retirée, trois ajoutées\n\nCLIQUET: ${Y} +3 — compte de la porte de l’ère, en ajoutées`
    d.git('checkout', '-q', '-b', 'chantier')
    const sousT0 = d.poser({ [Y]: 'y0\na\nb\nc\n' }, message)
    assert.deepEqual((await d.plage(sousT0)).refus, [])
    d.git('checkout', '-q', 'main')
    const t1 = d.poser({ [MODULE_PORTE]: PORTE_V2 }, 'T1 : la porte compte au net')
    d.tronc(t1)
    d.git('checkout', '-q', '-b', 'chantier-t1')
    const sousT1 = d.poser({ [Y]: 'y0\na\nb\nc\n' }, message)
    const vu = await croissancesDeLaPlage({ cwd: d.repo, debut: SHA_NUL, fin: sousT1, vers: 'refs/heads/chantier-t1' })
    assert.deepEqual(vu.refus.map((r) => [r.sha, r.fichier, r.net, r.declare, r.ere]), [[sousT1, Y, 2, 3, t1]])
  } finally {
    rmSync(d.repo, { recursive: true, force: true })
  }
})

test('#2503 ÈRE : une branche qui AFFAIBLIT la porte (c1), grossit en silence (c2) puis la RESTAURE (c3) voit c2 refusé', async () => {
  const d = depotDEres(PORTE_V2)
  try {
    d.git('checkout', '-q', '-b', 'chantier')
    d.poser({ [MODULE_PORTE]: porteForgee({ porteurs: [], net: true }) }, 'c1 : la porte ne compte plus rien')
    const c2 = d.poser({ [X]: 'x0\nx1\n' }, 'c2 : x grandit, muet')
    const c3 = d.poser({ [MODULE_PORTE]: PORTE_V2 }, 'c3 : la porte restaurée')
    const vu = await d.plage(c3)
    assert.deepEqual(vu.refus.map((r) => [r.sha, r.fichier, r.net, r.ere]), [[c2, X, 1, d.socle]])
  } finally {
    rmSync(d.repo, { recursive: true, force: true })
  }
})

test('#2503 ÈRE, file puis tronc : la PR qui change la porte rend le même verdict dans la file (`HEAD ^base`) et sur le push du tronc (`before..after`)', async () => {
  const d = depotDEres(PORTE_V1)
  try {
    d.git('checkout', '-q', '-b', 'chantier')
    d.poser({ [MODULE_PORTE]: PORTE_V2 }, 'b1 : la porte compte au net')
    const b2 = d.poser({ [Y]: 'y0\na\nb\n' }, `b2 : y, une retirée, deux ajoutées\n\nCLIQUET: ${Y} +1 — le net, faux sous T0`)
    d.git('checkout', '-q', 'main')
    d.git('merge', '-q', '--no-ff', '-m', 'M : la file fusionne la PR', 'chantier')
    const m = d.git('rev-parse', 'HEAD').trim()
    const file = await croissancesDeLaPlage({ cwd: d.repo, debut: SHA_NUL, fin: m, vers: 'refs/heads/gh-readonly-queue/main/pr-1' })
    d.tronc(m)
    const tronc = await croissancesDeLaPlage({ cwd: d.repo, debut: d.socle, fin: m, vers: TRONC.branche })
    const verdict = (vu) => vu.refus.map((r) => [r.sha, r.fichier, r.net, r.declare, r.ere])
    assert.deepEqual(verdict(file), [[b2, Y, 2, 1, d.socle]], 'b2 jugé par la porte de T0, en ajoutées')
    assert.deepEqual(verdict(tronc), verdict(file))
  } finally {
    rmSync(d.repo, { recursive: true, force: true })
  }
})

test('#2503 ÈRE non chargeable : la porte actuelle juge, et la note le dit', async () => {
  for (const [cas, autres, raison] of [
    ['vie négative', { [STOCKS_VIVANTS]: 'export const entreesNominatives = () => []\n' }, 'sonde de vie négative'],
    ['porte muette', { [MODULE_PORTE]: "import './stocksNominatifs.mjs'\nexport const refusDeLaPlage = () => []\nexport const reclassementsDeLaPlage = () => []\n" }, 'sonde de vie négative'],
    ['export absent', { [MODULE_PORTE]: "import './stocksNominatifs.mjs'\nexport const refusDeLaPlage = () => []\n" }, 'export(s) absent(s) de `scripts/guards/lib/plageStock.mjs` : reclassementsDeLaPlage'],
    ['module qui ne se parse pas', { [MODULE_PORTE]: "import './stocksNominatifs.mjs'\nexport const refusDeLaPlage = (\n" }, 'arbre illisible .sitesDeModule : .* ne se parse pas'],
  ]) {
    const d = depotDEres(PORTE_V2, autres)
    try {
      d.git('checkout', '-q', '-b', 'chantier')
      const muet = d.poser({ [PORTEUR]: sourceStock([A]) }, 'un stock réel naît, muet')
      const vu = await d.plage(muet)
      assert.deepEqual(vu.refus.map((r) => [r.sha, r.fichier, r.net, r.ere]), [[muet, PORTEUR, 1, d.socle]], cas)
      assert.equal(vu.notes.length, 1, cas)
      assert.match(vu.notes[0], new RegExp(`^${d.socle.slice(0, 9)} non chargeable : .*(${raison.replace(/[`()]/g, '.')})`), cas)
      assert.deepEqual(vu.eres.map((e) => e.note), vu.notes, cas)
    } finally {
      rmSync(d.repo, { recursive: true, force: true })
    }
  }
})

test('#2503 ÈRE SANS la porte : la porte actuelle juge, un stock qui naît muet est refusé, et la note le dit', async () => {
  const { racine: repo, sha: socle } = instanceDeDepot({ fichiers: { 'a.txt': 'a\n' }, message: 'socle' })
  try {
    const git = gitDe(repo)
    git('update-ref', 'refs/remotes/origin/main', socle)
    git('checkout', '-q', '-b', 'chantier')
    mkdirSync(dirname(join(repo, PORTEUR)), { recursive: true })
    writeFileSync(join(repo, PORTEUR), sourceStock([A]), 'utf8')
    git('add', PORTEUR)
    git('commit', '-q', '--no-verify', '-m', 'un stock naît, muet, sur une base sans la porte')
    const muet = git('rev-parse', 'HEAD').trim()
    const vu = await croissancesDeLaPlage({ cwd: repo, debut: SHA_NUL, fin: muet, vers: CHANTIER })
    assert.deepEqual(vu.refus.map((r) => [r.sha, r.fichier, r.net, r.ere]), [[muet, PORTEUR, 1, socle]])
    assert.deepEqual(vu.notes, [`${socle.slice(0, 9)} sans la porte \`${MODULE_PORTE}\` : jugé(s) par la porte actuelle`])
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})

test('#2503 ÈRE SANS la porte, données réelles : `a9b7edf17` poussé sur le tronc `da3acf95c^` rend les refus de la porte actuelle', async () => {
  const sha = (ref) => gitDe(RACINE)('rev-parse', ref).trim()
  const plage = { cwd: RACINE, debut: sha('da3acf95c^'), fin: sha('a9b7edf17'), vers: TRONC.branche }
  const actuelle = refusDeLaPlage(lectureDeLaPlage(plage)).map((r) => [r.sha, r.fichier, r.net, r.declare])
  assert.ok(actuelle.length, 'témoin : la porte actuelle refuse cette plage')
  const vu = await croissancesDeLaPlage(plage)
  assert.deepEqual(vu.refus.map((r) => [r.sha, r.fichier, r.net, r.declare]), actuelle)
  assert.ok(vu.notes.some((n) => n.includes(`sans la porte \`${MODULE_PORTE}\``)), vu.notes.join('\n'))
})

test('#2503 GitIndisponible entre modules : une lecture en panne sous le juge d’une ère CHARGÉE rend un refus `illisible` au texte de `refusDeGit`', async () => {
  const { racine: repo, sha: socle } = depotForge({
    fichiers: { [MODULE_PORTE]: `${PORTE_SUR_DISQUE[MODULE_PORTE]}\n// ère forgée : une autre instance du module\n` },
    message: 'socle',
  })
  try {
    const { juge, note, source } = await jugeDeLEre(depotDe(repo), socle, PORTE_DE_PLAGE)
    assert.deepEqual([note, source], [null, 'arbre'])
    const panne = new GitIndisponible({ disponible: false, raison: 'cause de la panne\n', issue: 'refus', diagnostic: { status: 35, stdout: 'sortie', stderr: 'cause de la panne\n' } })
    const commits = [{ sha: socle, message: '', cotes: cotesLisibles(() => { throw panne }) }]
    assert.deepEqual(juge.reclassementsDeLaPlage({ commits }), [{ sha: socle, fusion: false, illisible: refusDeGit(panne) }])
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})
