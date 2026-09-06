// Tests de la porte de PLAGE (`plageStock.mjs`) : par commit, filtrée par la croissance cumulée.
// Les deux premiers cas sont la sonde qui a DISCRIMINÉ les deux niveaux le 2026-09-03 — jugée en
// cumulé seul, une plage de deux commits cliquetés `+2` rougit à tort ; jugée par commit seul, une
// plage qui ajoute puis RETIRE un stock rougit à tort aussi. Lancé par `npm run test:hooks`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { refusDeLaPlage, raisonDeRefusDePlage, croissancesDeLaPlage, SHA_NUL } from './plageStock.mjs'

const PORTEUR = 'scripts/x.test.mjs'

/** Le REGISTRE de ces fixtures : la porte ne compte que ce qui est DÉCLARÉ, et un dépôt jetable
 *  n'a pas le registre du dépôt. Une seule liaison, en forme de `liste`. */
const REGISTRE = { entrees: [{
  fichier: PORTEUR, liaison: 'STOCK', forme: 'liste', role: 'stock', cible: 0,
  raison: 'porteur de fixture de la porte de plage.',
}] }
/** Image du porteur telle que la fixture l'écrit : les entrées ajoutées vivent à partir de la ligne 2. */
const imagesDe = (entrees) => ({ registre: REGISTRE, lirePostImage: () => sourceStock(entrees), lirePreImage: () => sourceStock(entrees) })

/** Diff `-U0` d'un ajout/retrait de lignes dans le porteur, à partir de la ligne `ligne`. */
const diffDe = (ajoutees = [], retirees = [], ligne = 2) =>
  [
    `diff --git a/${PORTEUR} b/${PORTEUR}`,
    `--- a/${PORTEUR}`,
    `+++ b/${PORTEUR}`,
    `@@ -${ligne},${retirees.length} +${ligne},${ajoutees.length} @@`,
    ...retirees.map((l) => `-${l}`),
    ...ajoutees.map((l) => `+${l}`),
  ].join('\n')

const A = "  'src/a.ts',"
const B = "  'src/b.ts',"
const C = "  'src/c.ts',"
const D = "  'src/d.ts',"

test('C : deux commits CLIQUETÉS +2 chacun passent — le cumul +4 ne demande pas un cliquet +4', () => {
  const refus = refusDeLaPlage({
    commits: [
      { sha: 'aaa1111', diff: diffDe([A, B]), message: 'T1\n\nCLIQUET: scripts/x.test.mjs +2 — fixtures du test neuf, motif assez long' },
      { sha: 'bbb2222', diff: diffDe([C, D]), message: 'T2\n\nCLIQUET: scripts/x.test.mjs +2 — seconde fournée, motif suffisamment long aussi' },
    ],
    cumule: diffDe([A, B, C, D]),
    imagesCumul: { registre: REGISTRE },
  })
  assert.deepEqual(refus, [], 'le CLIQUET vit dans UN message : la plage se juge par commit')
})

test('C : un stock ajouté puis RETIRÉ dans la plage ne refuse rien — le filtre cumulé l\'écarte', () => {
  const commits = [
    { sha: 'aaa1111', diff: diffDe([A, B]), message: 'ajoute', images: imagesDe([A, B]) },
    { sha: 'bbb2222', diff: diffDe([], [A, B]), message: 'retire', images: imagesDe([A, B]) },
  ]
  const imagesCumul = imagesDe([A, B])
  assert.equal(refusDeLaPlage({ commits, cumule: diffDe([A, B]), imagesCumul }).length, 1, 'sans retrait cumulé, le refus tient')
  assert.deepEqual(refusDeLaPlage({ commits, cumule: '', imagesCumul: { registre: REGISTRE } }), [], 'croissance cumulée nulle : rien à refuser')
})

test('C : un commit du MILIEU sans cliquet est refusé, et le refus le NOMME', () => {
  const refus = refusDeLaPlage({
    commits: [
      { sha: 'aaa1111', diff: diffDe([]), message: 'socle' },
      { sha: 'bbb2222', diff: diffDe([A, B]), message: 'lot sans cliquet', images: imagesDe([A, B]) },
      { sha: 'ccc3333', diff: diffDe([]), message: 'tête innocente' },
    ],
    cumule: diffDe([A, B]),
    imagesCumul: imagesDe([A, B]),
  })
  assert.deepEqual(refus.map((r) => [r.sha, r.cle, r.net]), [['bbb2222', `${PORTEUR}#STOCK`, 2]])
  const raison = raisonDeRefusDePlage(refus)
  assert.match(raison, /bbb2222/)
  assert.match(raison, /scripts\/x\.test\.mjs#STOCK \+2/)
  assert.match(raison, /rebase -i/)
})

// ── Sur un dépôt JETABLE : la lecture git réelle, la plage et son repli ───────────────────────────

/** Dépôt jetable où chaque élément de `commits` pose une version du porteur et son message. */
function depotJetable(commits) {
  const repo = mkdtempSync(join(tmpdir(), 'plage-'))
  const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
  git('init', '-q', '-b', 'main')
  git('config', 'user.email', 'sonde@test')
  git('config', 'user.name', 'sonde')
  git('config', 'commit.gpgsign', 'false')
  mkdirSync(join(repo, 'scripts'), { recursive: true })
  const shas = []
  for (const { contenu, message } of commits) {
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
    const { refus } = croissancesDeLaPlage({ cwd: repo, avant: shas[0], apres: shas[2], registre: REGISTRE })
    assert.deepEqual(refus.map((r) => [r.sha, r.cle, r.net]), [[shas[1], `${PORTEUR}#STOCK`, 2]])
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
    assert.deepEqual(croissancesDeLaPlage({ cwd: repo, avant: shas[0], apres: shas[2], registre: REGISTRE }).refus, [])
  } finally {
    rmSync(repo, { recursive: true, force: true })
  }
})

test('C : base NULLE sans `origin/main` → HEAD seul, et la porte le DIT (jamais un silence)', () => {
  const { repo, shas } = depotJetable([
    { contenu: sourceStock([]), message: 'socle' },
    { contenu: sourceStock([A, B]), message: 'deux exemptions de plus, sans cliquet' },
    { contenu: `${sourceStock([A, B])}// tête anodine\n`, message: 'tête' },
  ])
  try {
    const { refus, notes } = croissancesDeLaPlage({ cwd: repo, avant: SHA_NUL, apres: shas[2], registre: REGISTRE })
    assert.deepEqual(refus, [], 'la tête seule ne porte aucune croissance')
    assert.equal(notes.length, 1)
    assert.match(notes[0], /plage inconnue/)
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
    const vu = croissancesDeLaPlage({ cwd: hors, avant: 'aaaaaaa', apres: 'bbbbbbb' })
    assert.match(vu.indisponible, /not a git repository/i)
    assert.equal(vu.plage, 'aaaaaaa..bbbbbbb')
    assert.deepEqual(vu.refus, [])
  } finally {
    rmSync(hors, { recursive: true, force: true })
  }
})

test('un lecteur injecté qui rend `null` (objet absent) ne lève AUCUNE indisponibilité', () => {
  const vu = croissancesDeLaPlage({ avant: 'aaaaaaa', apres: 'bbbbbbb', git: () => null })
  assert.equal(vu.indisponible, null)
  assert.match(vu.notes.join(' '), /plage `aaaaaaa\.\.bbbbbbb` illisible/)
})
