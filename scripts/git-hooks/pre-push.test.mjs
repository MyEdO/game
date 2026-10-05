// Porte au PUSH (#1776, #2178) — fixture : un VRAI dépôt jetable et un `origin` dont l'URL est celle du
// dépôt du projet (aucun push n'est joué : le hook est appelé directement, comme git l'appelle, refs
// sur stdin).
//
// CE QUE LA PORTE EST : le MIROIR LISIBLE du ruleset `main`. Elle refuse ce que GitHub refuserait —
// tout push vers `main`, qui n'avance que par la file de fusion — et ne refuse RIEN sur une branche
// de travail, dont le push est libre et dont la CI est le juge.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DEPOT } from '../guards/lib/ticketsGh.mjs'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { instanceDeDepot, sousGitFeint } from '../guards/lib/depotGabarit.mjs'
import { REFUS_PUSH_VERS_MAIN, REF_PROTEGEE, jugerPush, refsAPousser } from './pre-push.mjs'
import { lancerGit } from '../test/gitDeBanc.mjs'

const ZERO = '0'.repeat(40)

test('#2285 famille prepush callback : origin complet', () => {
  const racine = depot()
  try {
    const stderr = 'note origin\n'.repeat(45) + 'cause origin tardive\n'
    const stdout = 'stdout origin distinct'
    assert.ok(stderr.indexOf('cause origin tardive') > 400)
    const vu = sousGitFeint([{ si: ['remote', 'get-url', 'origin'], status: 30, stdout, stderr }], () => jugerPush({ cwd: racine, stdin: '' }))
    assert.deepEqual(vu.refus, ['origin illisible, git indisponible : refus (status 30) — ' + stderr + '\n' + stdout])
  } finally { jeter(racine) }
})

test('#2285 famille prepush union : ascendance complète', () => {
  const racine = depot()
  try {
    const sha = tete(racine)
    const stderr = 'note ancêtre\n'.repeat(45) + 'cause ancêtre tardive\n'
    const stdout = 'stdout ancêtre distinct'
    assert.ok(stderr.indexOf('cause ancêtre tardive') > 400)
    const stdin = 'refs/heads/feat/x ' + sha + ' refs/heads/feat/x ' + sha + '\n'
    const vu = sousGitFeint([{ si: ['merge-base', '--is-ancestor'], status: 31, stdout, stderr }], () => jugerPush({ cwd: racine, stdin }))
    assert.deepEqual(vu.refus, ['refs/heads/feat/x → refs/heads/feat/x : ascendance illisible — refus (status 31) — ' + stderr + '\n' + stdout])
  } finally { jeter(racine) }
})

const git = (cwd) => (args) => lancerGit(args, { cwd }).trim()

/** Dépôt jetable, `origin` conforme. */
const depot = () =>
  instanceDeDepot({
    fichiers: { 'src/a.ts': 'export const a = 1\n' },
    origin: `https://github.com/${DEPOT}.git`,
    refs: { 'refs/remotes/origin/main': 'HEAD' },
  }).racine

const jeter = (racine) => rmSync(racine, { recursive: true, force: true })

const tete = (racine) => git(racine)(['rev-parse', 'HEAD'])

/** Une ligne de stdin, telle que git la sert : `<ref locale> <sha> <ref distante> <sha distant>`. */
const pousse = (racine, { refDistante = REF_PROTEGEE, sha, base = ZERO } = {}) =>
  `refs/heads/main ${sha ?? tete(racine)} ${refDistante} ${base}\n`

// ── Le refus qui MIROITE le ruleset : aucun push n'entre dans `main` ─────────────────────────────

test('un push vers `main` est REFUSÉ et NOMMÉ : main n’avance que par la file de fusion', () => {
  const racine = depot()
  try {
    const { refus } = jugerPush({ cwd: racine, stdin: pousse(racine) })
    assert.deepEqual(refus, [REFUS_PUSH_VERS_MAIN])
    assert.match(REFUS_PUSH_VERS_MAIN, /file de fusion — publier par `npm run ops:publier`/)
  } finally {
    jeter(racine)
  }
})

// ── Push LIBRE sur une branche de travail ──────────────────────────────────────────────────────

test('une branche `chantier/**` se pousse librement : la CI de la branche est le juge', () => {
  const racine = depot()
  try {
    const { refus, notes } = jugerPush({
      cwd: racine,
      stdin: pousse(racine, { refDistante: 'refs/heads/chantier/1776' }),
    })
    assert.deepEqual(refus, [], 'aucune gate locale n’est exigée d’une branche de travail')
    assert.match(notes.join('\n'), /refs\/heads\/chantier\/1776 : push libre/)
  } finally {
    jeter(racine)
  }
})

test('une branche `feat/**` se pousse librement aussi', () => {
  const racine = depot()
  try {
    const { refus } = jugerPush({ cwd: racine, stdin: pousse(racine, { refDistante: 'refs/heads/feat/x' }) })
    assert.deepEqual(refus, [])
  } finally {
    jeter(racine)
  }
})

// ── Fast-forward : jugé sur toute ref EXISTANTE, sauf les branches de chantier ────────────

/** Dépôt à DEUX commits : `HEAD~1` poussé sur un distant à `HEAD` est un non fast-forward. */
function depotDeuxCommits() {
  const racine = depot()
  writeFileSync(join(racine, 'src', 'b.ts'), 'export const b = 2\n')
  git(racine)(['add', 'src/b.ts'])
  git(racine)(['commit', '-m', 'second'])
  return racine
}

test('fast-forward vers une branche `chantier/**` : libre', () => {
  const racine = depotDeuxCommits()
  try {
    const base = git(racine)(['rev-parse', 'HEAD~1'])
    const stdin = pousse(racine, { refDistante: 'refs/heads/chantier/1776', base })
    const { refus } = jugerPush({ cwd: racine, stdin })
    assert.deepEqual(refus, [])
  } finally {
    jeter(racine)
  }
})

test('NON fast-forward vers une branche `chantier/**` : libre — un seul écrivain', () => {
  const racine = depotDeuxCommits()
  try {
    const stdin = pousse(racine, {
      refDistante: 'refs/heads/chantier/1776',
      sha: git(racine)(['rev-parse', 'HEAD~1']),
      base: tete(racine),
    })
    const { refus, notes } = jugerPush({ cwd: racine, stdin })
    assert.deepEqual(refus, [])
    assert.match(notes.join('\n'), /branche de chantier — fast-forward non jugé/)
  } finally {
    jeter(racine)
  }
})

test('NON fast-forward vers `main` : refusé — miroir de `non_fast_forward` du ruleset', () => {
  const racine = depotDeuxCommits()
  try {
    const sha = git(racine)(['rev-parse', 'HEAD~1'])
    const stdin = pousse(racine, { sha, base: tete(racine) })
    const { refus } = jugerPush({ cwd: racine, stdin })
    assert.match(refus.join('\n'), /push non fast-forward vers refs\/heads\/main/)
  } finally {
    jeter(racine)
  }
})

test('NON fast-forward vers `feat/x` : refusé aussi — seule `chantier/**` est exemptée', () => {
  const racine = depotDeuxCommits()
  try {
    const stdin = pousse(racine, {
      refDistante: 'refs/heads/feat/x',
      sha: git(racine)(['rev-parse', 'HEAD~1']),
      base: tete(racine),
    })
    const { refus } = jugerPush({ cwd: racine, stdin })
    assert.match(refus.join('\n'), /push non fast-forward vers refs\/heads\/feat\/x/)
  } finally {
    jeter(racine)
  }
})

test('une ref distante NEUVE n’écrase aucune histoire : fast-forward non jugé', () => {
  const racine = depotDeuxCommits()
  try {
    const stdin = pousse(racine, { refDistante: 'refs/heads/feat/neuve', base: ZERO })
    const { refus, notes } = jugerPush({ cwd: racine, stdin })
    assert.deepEqual(refus, [])
    assert.match(notes.join('\n'), /n’existe pas encore côté distant/)
  } finally {
    jeter(racine)
  }
})

// ── Origine ────────────────────────────────────────────────────────────────────────────────────

test('un origin ÉTRANGER est refusé, et le refus le cite', () => {
  const racine = instanceDeDepot({
    fichiers: { 'src/a.ts': 'export const a = 1\n' },
    origin: 'https://github.com/quelquun/autre.git',
  }).racine
  try {
    const { refus } = jugerPush({ cwd: racine, stdin: pousse(racine) })
    assert.match(refus.join('\n'), /origin = « https:\/\/github\.com\/quelquun\/autre\.git »/)
    assert.ok(refus.join('\n').includes(`github.com/${DEPOT}`))
  } finally {
    jeter(racine)
  }
})

// ── Stocks nominatifs de la PLAGE (revue de palier n°2) ────────────────────────────────────────

/** Un PORTEUR de stock nominatif (`scripts/guards/lib/**.mjs`), tel que `stocksNominatifs` le lit. */
const PORTEUR_DE_STOCK = 'scripts/guards/lib/exemptions.mjs'
const sourceStock = (entrees) => `export const STOCK = [\n${entrees.join('\n')}\n]\n`

test('un STOCK nominatif qui grandit dans la plage sans `CLIQUET:` au commit est refusé', () => {
  const racine = depot()
  try {
    const commettre = (contenu, message) => {
      mkdirSync(join(racine, 'scripts', 'guards', 'lib'), { recursive: true })
      writeFileSync(join(racine, PORTEUR_DE_STOCK), contenu)
      git(racine)(['add', '--', PORTEUR_DE_STOCK])
      git(racine)(['commit', '-m', message])
      return tete(racine)
    }
    const base = commettre(sourceStock([]), 'chore: socle du stock')
    commettre(sourceStock(["  'src/a.ts',", "  'src/b.ts',"]), 'chore: deux entrées de plus, sans le dire')
    const { refus } = jugerPush({
      cwd: racine,
      stdin: pousse(racine, { refDistante: 'refs/heads/chantier/x', base }),
    })
    // La porte vaut pour TOUTE ref : un stock qui grandit en silence n'est pas moins faux sur une
    // branche de travail, et la CI de cette branche ne le mesure pas commit par commit.
    assert.ok(refus.length, 'un stock qui grandit en silence dans la plage doit refuser, branche comprise')
    assert.match(refus.join('\n'), new RegExp(PORTEUR_DE_STOCK.replace(/[/.]/g, '\\$&')))
  } finally {
    jeter(racine)
  }
})

test('un module qui FRANCHIT la frontière sans `RECLASSEMENT:` au commit est refusé (#1806 D2″)', () => {
  const racine = depot()
  try {
    const manifeste = 'src/data/primitives.manifest.json'
    const ecrire = (rel, texte) => {
      mkdirSync(join(racine, dirname(rel)), { recursive: true })
      writeFileSync(join(racine, rel), texte)
    }
    const commettre = (message) => {
      git(racine)(['add', '-A'])
      git(racine)(['commit', '-m', message])
      return tete(racine)
    }
    ecrire('src/ui/styles/console.css', '.c { color: red }\n')
    ecrire('src/ui/Console.tsx', 'export const Console = 1\n')
    ecrire('src/ui/Ecran1.tsx', "import { Console } from './Console'\nexport const E1 = Console\n")
    ecrire(manifeste, JSON.stringify([{ id: 'console', fichier: 'src/ui/Console.tsx', css: 'src/ui/styles/console.css' }]))
    const base = commettre('chore: socle')
    ecrire('src/ui/Ecran2.tsx', "import { Console } from './Console'\nexport const E2 = Console\n")
    commettre('feat: second écran')
    const { refus } = jugerPush({
      cwd: racine,
      stdin: pousse(racine, { refDistante: 'refs/heads/chantier/x', base }),
    })
    assert.match(refus.join('\n'), /RECLASSEMENT CSS : [0-9a-f]{9} src\/ui\/styles\/console\.css : franchi au prix 1, aucune ligne/)
  } finally {
    jeter(racine)
  }
})

// ── Forme de stdin ─────────────────────────────────────────────────────────────────────────────

test('une SUPPRESSION de branche (sha local nul) n’est pas une ref à juger', () => {
  assert.deepEqual(refsAPousser(`(delete) ${ZERO} refs/heads/vieille ${'a'.repeat(40)}\n`), [])
})

test('deux refs sur stdin donnent deux refs jugées', () => {
  const lignes =
    `refs/heads/main ${'a'.repeat(40)} refs/heads/main ${ZERO}\n` +
    `refs/heads/x ${'b'.repeat(40)} refs/heads/x ${ZERO}\n`
  assert.deepEqual(refsAPousser(lignes).map((r) => r.refDistante), ['refs/heads/main', 'refs/heads/x'])
})

test('git INDISPONIBLE (hors dépôt) : un refus NOMMÉ qui porte la raison de git, jamais « origin absent »', () => {
  const hors = mkdtempSync(join(tmpdir(), 'pre-push-hors-'))
  try {
    const { refus } = jugerPush({ cwd: hors, stdin: '' })
    assert.equal(refus.length, 1)
    assert.match(refus[0], /^origin illisible, git indisponible : .*not a git repository/i)
  } finally {
    rmSync(hors, { recursive: true, force: true })
  }
})
