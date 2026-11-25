// Tests de la porte de PLAGE (`plageStock.mjs`) : par commit, filtrée par la croissance cumulée.
// Les deux premiers cas sont la sonde qui a DISCRIMINÉ les deux niveaux le 2026-09-03 — jugée en
// cumulé seul, une plage de deux commits cliquetés `+2` rougit à tort ; jugée par commit seul, une
// plage qui ajoute puis RETIRE un stock rougit à tort aussi. Lancé par `npm run test:hooks`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { lectureDeLaPlage, refusDeLaPlage, raisonDeRefusDePlage, croissancesDeLaPlage, reclassementsDeLaPlage, SHA_NUL } from './plageStock.mjs'
import { GitIndisponible, TRONC } from './gitPorte.mjs'
import { bilanDesStocks } from './stocksNominatifs.mjs'
import { sousGitFeint } from './depotGabarit.mjs'
import { gitDe, lancerGit, lancesDeGit, sousCommande } from '../../test/gitDeBanc.mjs'
import {
  PORTEUR,
  depotForge,
  A,
  B,
  C,
  D,
  sourceStock,
  lireEtJugerLaPlage,
  MANIFESTE,
  CONSOLE,
  COMPOSANT,
  ECRAN1,
  manifesteAvec,
  PRIMITIVE_CONSOLE,
  RECLASSE,
  importeur,
  depotCss,
  depotAFusion,
} from './plageStock.testkit.mjs'

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

test('#2302 lectureDeLaPlage : une ascendance pour un ou cinq commits, différences croissantes, le reste constant', (t) => {
  const horsDiffs = []
  for (const nombre of [1, 5]) {
    const { repo, shas } = depotJetable(Array.from({ length: nombre + 1 }, (_, i) => ({ contenu: sourceStock(Array.from({ length: i }, (_, n) => `  'src/f${n}.ts',`)), message: `commit ${i}` })))
    try {
      const { valeur, lances } = lancesDeGit(() => lectureDeLaPlage({ cwd: repo, debut: shas[0], fin: shas.at(-1) }))
      const ascendances = lances.filter((args) => sousCommande(args) === 'rev-list' && args.includes('--format=%H %T %P'))
      assert.equal(ascendances.length, 1)
      assert.equal(lances.some((args) => args.includes('-n') || args.includes('-n1') || args.some((a) => a.endsWith('^@'))), false)
      assert.deepEqual(valeur.commits.map((c) => [c.sha, c.message]), shas.slice(1).map((sha, i) => [sha, `commit ${i + 1}\n`]))
      const diffs = lances.filter((args) => sousCommande(args) === 'diff-tree').length
      assert.ok(diffs >= nombre)
      horsDiffs.push(lances.length - diffs)
      t.diagnostic(JSON.stringify({ nombre, processus: lances.length, ascendances: ascendances.length, diffs }))
    } finally { rmSync(repo, { recursive: true, force: true }) }
  }
  assert.equal(horsDiffs[1], horsDiffs[0], `processus hors diff-tree : ${horsDiffs.join(' pour 1, ')} pour 5`)
})

test('#2626 : seuls les commits nouveaux sont jugés, le cumul reste celui des états de la plage', async () => {
  const { repo, shas, git } = depotJetable([
    { contenu: sourceStock([]), message: 'socle' },
    { contenu: sourceStock([A]), message: 'ancien stock publié' },
    { contenu: sourceStock([A, B]), message: 'nouveau stock fautif' },
  ])
  try {
    git('update-ref', 'refs/remotes/origin/main', shas[0])
    const options = { cwd: repo, debut: SHA_NUL, vers: 'refs/heads/chantier/neuve', origineConfirmee: [shas[1]] }
    const ancien = await croissancesDeLaPlage({ ...options, fin: shas[1] })
    assert.equal(ancien.commits, 0)
    assert.deepEqual(ancien.refus, [])
    const { lue: lu, verdict: fautif } = await lireEtJugerLaPlage({ ...options, fin: shas[2] })
    assert.deepEqual(fautif.refus.map((r) => r.sha), [shas[2]])
    assert.deepEqual(lu.commits.map((c) => c.sha), [shas[2]])
    const ci = lectureDeLaPlage({ cwd: repo, debut: SHA_NUL, fin: shas[2], vers: 'refs/heads/chantier/neuve' })
    assert.deepEqual(lu.cumul, ci.cumul)
    assert.ok(ci.commits.some((c) => c.sha === shas[1]), 'la CI sans option explicite garde sa plage')
    assert.equal(ci.troncDesEres, TRONC.suivi)
  } finally { rmSync(repo, { recursive: true, force: true }) }
})

test('#2626 : un ajout puis retrait neufs ne refuse rien après un commit publié anodin', async () => {
  const { repo, shas, git } = depotJetable([
    { contenu: sourceStock([]), message: 'socle' },
    { contenu: `${sourceStock([])}// publié anodin\n`, message: 'publié anodin' },
    { contenu: sourceStock([A]), message: 'ajout neuf' },
    { contenu: sourceStock([]), message: 'retrait neuf' },
  ])
  try {
    git('update-ref', 'refs/remotes/origin/main', shas[0])
    const options = { cwd: repo, debut: SHA_NUL, fin: shas[3], vers: 'refs/heads/chantier/neuve' }
    const { lue: lu, verdict } = await lireEtJugerLaPlage({ ...options, origineConfirmee: [shas[1]] })
    assert.deepEqual(lu.commits.map((c) => c.sha), shas.slice(2))
    assert.deepEqual(lu.cumul, lectureDeLaPlage(options).cumul)
    assert.ok(lu.cumul.every(({ parCle }) => [...parCle.values()].every((n) => n === 0)))
    assert.deepEqual(verdict.refus, [])
  } finally { rmSync(repo, { recursive: true, force: true }) }
})

test('#2626 : les exclusions d’origin passent par l’entrée, la ligne de commande ne croît pas avec leur nombre', () => {
  const { repo, shas, git } = depotJetable([
    { contenu: sourceStock([]), message: 'socle' },
    { contenu: sourceStock([A]), message: 'publié' },
    { contenu: sourceStock([A, B]), message: 'neuf' },
  ])
  try {
    git('update-ref', 'refs/remotes/origin/main', shas[0])
    const options = { cwd: repo, debut: SHA_NUL, fin: shas[2], vers: 'refs/heads/chantier/neuve' }
    const [une, milliers] = [1, 4000].map((n) => lancesDeGit(() => lectureDeLaPlage({ ...options, origineConfirmee: Array(n).fill(shas[1]) })))
    const longueur = ({ lances }) => Math.max(...lances.map((args) => args.join(' ').length))
    assert.deepEqual(milliers.valeur.commits.map((c) => c.sha), [shas[2]])
    assert.deepEqual(milliers.valeur.commits.map((c) => c.sha), une.valeur.commits.map((c) => c.sha))
    assert.equal(longueur(milliers), longueur(une))
  } finally { rmSync(repo, { recursive: true, force: true }) }
})

for (const tronc of ['absent', 'disjoint']) test(`#2626 sans borne : A publié, B fautif, C anodin, tronc ${tronc}`, async () => {
  const { repo, shas, git } = depotJetable([
    { contenu: sourceStock([A]), message: 'A publié' },
    { contenu: sourceStock([A, B]), message: 'B non publié sans cliquet' },
    { contenu: `${sourceStock([A, B])}// C anodin\n`, message: 'C anodin' },
  ])
  try {
    if (tronc === 'disjoint') {
      const arbre = git('rev-parse', `${shas[0]}^{tree}`).trim()
      const autre = git('commit-tree', arbre, '-m', 'tronc disjoint').trim()
      git('update-ref', 'refs/remotes/origin/main', autre)
    }
    const options = { cwd: repo, debut: SHA_NUL, fin: shas[2], origineConfirmee: [shas[0]] }
    const { lue: lu, verdict: vu } = await lireEtJugerLaPlage(options)
    assert.deepEqual(lu.commits.map((c) => c.sha), shas.slice(1))
    assert.equal(lu.commits.some((c) => c.sha === shas[0]), false)
    assert.deepEqual(refusDeLaPlage(lu).map((r) => [r.sha, r.net]), [[shas[1], 1]])
    assert.deepEqual(vu.refus.map((r) => [r.sha, r.net]), [[shas[1], 1]])
  } finally { rmSync(repo, { recursive: true, force: true }) }
})

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

test('C : base NULLE sans tronc lisible, toute l’ascendance est jugée et le milieu fautif est refusé', async () => {
  const { repo, shas } = depotJetable([
    { contenu: sourceStock([]), message: 'socle' },
    { contenu: sourceStock([A, B]), message: 'deux exemptions de plus, sans cliquet' },
    { contenu: `${sourceStock([A, B])}// tête anodine\n`, message: 'tête' },
  ])
  try {
    const { refus, notes } = await croissancesDeLaPlage({ cwd: repo, debut: SHA_NUL, fin: shas[2] })
    assert.deepEqual(refus.filter((r) => r.fichier === PORTEUR).map((r) => [r.sha, r.net]), [[shas[1], 2]])
    assert.ok(refus.filter((r) => r.fichier !== PORTEUR).every((r) => r.sha === shas[0]))
    assert.deepEqual(notes, [
      `tronc \`origin/main\` illisible depuis ${shas[2].slice(0, 9)} : ses commits ne sont PAS exclus de la plage`,
      `${shas.map((s) => s.slice(0, 9)).join(', ')} sans ère (tronc \`origin/main\` illisible) : jugé(s) par la porte actuelle`,
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
