// Porte au PUSH (#1776) — fixture : un VRAI dépôt jetable et un `origin` dont l'URL est celle du
// dépôt du projet (aucun push n'est joué : le hook est appelé directement, comme git l'appelle, refs
// sur stdin). Les courses CI sont fournies par `WFRP_GH_STUB=<fichier json>` (`coursesCi.mjs`).
//
// CE QUE LA PORTE EST : le MIROIR LISIBLE du ruleset `main`. Elle refuse ce que GitHub refuserait —
// un sha sans run VERT entrant dans `main` — et ne refuse RIEN sur une branche de travail, dont le
// push est libre et dont la CI est le juge.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DEPOT } from '../guards/lib/ticketsGh.mjs'
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { instanceDeDepot } from '../guards/lib/depotGabarit.mjs'
import { REF_PROTEGEE, jugerPush, refsAPousser, verdictDuSha } from './pre-push.mjs'
import { reinitialiserStub } from '../guards/lib/coursesCi.mjs'

const ZERO = '0'.repeat(40)

const git = (cwd) => (args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim()

/** Dépôt jetable, `origin` conforme. */
const depot = () =>
  instanceDeDepot({
    fichiers: { 'src/a.ts': 'export const a = 1\n' },
    origin: `https://github.com/${DEPOT}.git`,
    refs: { 'refs/remotes/origin/main': 'HEAD' },
  }).racine

const jeter = (racine) => rmSync(racine, { recursive: true, force: true })

const tete = (racine) => git(racine)(['rev-parse', 'HEAD'])

/** Réponse posée sur disque, rendue en variable d'environnement de mesure. */
function stubCi(racine, contenu) {
  reinitialiserStub()
  const fichier = join(racine, 'gh.json')
  writeFileSync(fichier, JSON.stringify(contenu))
  return { WFRP_GH_STUB: fichier }
}

const course = (sha, plus = {}) => ({
  conclusion: 'success',
  status: 'completed',
  databaseId: 1,
  headSha: sha,
  createdAt: '2026-09-05T10:00:00Z',
  ...plus,
})

/** Une ligne de stdin, telle que git la sert : `<ref locale> <sha> <ref distante> <sha distant>`. */
const pousse = (racine, { refDistante = REF_PROTEGEE, sha, base = ZERO } = {}) =>
  `refs/heads/main ${sha ?? tete(racine)} ${refDistante} ${base}\n`

// ── Le refus qui MIROITE le ruleset : le sha entrant dans `main` porte un run vert ─────────────

test('un sha porté par un run CI VERT entre dans main, et la note le dit', () => {
  const racine = depot()
  try {
    const sha = tete(racine)
    const { refus, notes } = jugerPush({ cwd: racine, stdin: pousse(racine), env: stubCi(racine, [course(sha)]) })
    assert.deepEqual(refus, [])
    assert.match(notes.join('\n'), new RegExp(`run CI VERT sur ${sha.slice(0, 9)}`))
  } finally {
    jeter(racine)
  }
})

test('AUCUN run sur le sha : refus qui nomme la branche chantier et la commande pour voir', () => {
  const racine = depot()
  try {
    const { refus } = jugerPush({ cwd: racine, stdin: pousse(racine), env: stubCi(racine, []) })
    assert.match(refus.join('\n'), /aucun run CI sur [0-9a-f]{9} : ce contenu n’a pas été jugé/)
    assert.match(refus.join('\n'), /branche `chantier\/\*\*`/)
    assert.match(refus.join('\n'), /gh run list --commit [0-9a-f]{12}/)
  } finally {
    jeter(racine)
  }
})

test('un run EN VOL n’est pas un vert : le refus dit d’attendre', () => {
  const racine = depot()
  try {
    const env = stubCi(racine, [course(tete(racine), { status: 'in_progress', conclusion: null, databaseId: 42 })])
    const { refus } = jugerPush({ cwd: racine, stdin: pousse(racine), env })
    assert.match(refus.join('\n'), /run CI EN VOL sur [0-9a-f]{9} \(course 42\) : aucun verdict encore — attendre/)
  } finally {
    jeter(racine)
  }
})

test('un run ROUGE refuse en nommant sa conclusion et sa course', () => {
  const racine = depot()
  try {
    const env = stubCi(racine, [course(tete(racine), { conclusion: 'failure', databaseId: 33691303703 })])
    const { refus } = jugerPush({ cwd: racine, stdin: pousse(racine), env })
    assert.match(refus.join('\n'), /run CI en ÉCHEC \(failure\) sur [0-9a-f]{9} — course 33691303703/)
  } finally {
    jeter(racine)
  }
})

test('une conclusion INCONNUE de ce dépôt n’est pas verte : elle refuse en se nommant', () => {
  const vu = verdictDuSha({ courses: [course('a'.repeat(40), { conclusion: 'neutral' })], sha: 'a'.repeat(40) })
  assert.match(vu.refus.join('\n'), /conclusion « neutral », qui n’est pas un vert/)
})

test('`timed_out` et `startup_failure` sont des rouges, comme `failure`', () => {
  for (const conclusion of ['timed_out', 'startup_failure']) {
    const vu = verdictDuSha({ courses: [course('b'.repeat(40), { conclusion })], sha: 'b'.repeat(40) })
    assert.match(vu.refus.join('\n'), new RegExp(`run CI en ÉCHEC \\(${conclusion}\\)`))
  }
})

test('courses NON CONSULTABLES : le refus dit la raison, jamais un vert par défaut', () => {
  const vu = verdictDuSha({ courses: [], sha: 'c'.repeat(40), disponible: false, raison: 'gh a rendu 4' })
  assert.match(vu.refus.join('\n'), /CI du sha poussé non consultable : gh a rendu 4/)
})

test('une course d’un AUTRE sha ne vaut pas pour celui-ci', () => {
  const vu = verdictDuSha({ courses: [course('d'.repeat(40))], sha: 'e'.repeat(40) })
  assert.match(vu.refus.join('\n'), /aucun run CI sur eeeeeeeee/)
})

// ── Push LIBRE sur une branche de travail ──────────────────────────────────────────────────────

test('une branche `chantier/**` se pousse SANS run CI : la CI de la branche est le juge', () => {
  const racine = depot()
  try {
    const { refus, notes } = jugerPush({
      cwd: racine,
      stdin: pousse(racine, { refDistante: 'refs/heads/chantier/1776' }),
      env: stubCi(racine, []),
    })
    assert.deepEqual(refus, [], 'aucune gate locale n’est exigée d’une branche de travail')
    assert.match(notes.join('\n'), /refs\/heads\/chantier\/1776 : push libre/)
  } finally {
    jeter(racine)
  }
})

test('une branche de travail se pousse même quand `main` est rouge : le travail n’est pas gelé', () => {
  const racine = depot()
  try {
    const env = stubCi(racine, [course(tete(racine), { conclusion: 'failure' })])
    const { refus } = jugerPush({ cwd: racine, stdin: pousse(racine, { refDistante: 'refs/heads/feat/x' }), env })
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
    const { refus } = jugerPush({ cwd: racine, stdin, env: stubCi(racine, []) })
    assert.deepEqual(refus, [])
  } finally {
    jeter(racine)
  }
})

test('NON fast-forward vers une branche `chantier/**` : libre — le train la rebase', () => {
  const racine = depotDeuxCommits()
  try {
    const stdin = pousse(racine, {
      refDistante: 'refs/heads/chantier/1776',
      sha: git(racine)(['rev-parse', 'HEAD~1']),
      base: tete(racine),
    })
    const { refus, notes } = jugerPush({ cwd: racine, stdin, env: stubCi(racine, []) })
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
    const { refus } = jugerPush({ cwd: racine, stdin, env: stubCi(racine, [course(sha)]) })
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
    const { refus } = jugerPush({ cwd: racine, stdin, env: stubCi(racine, []) })
    assert.match(refus.join('\n'), /push non fast-forward vers refs\/heads\/feat\/x/)
  } finally {
    jeter(racine)
  }
})

test('une ref distante NEUVE n’écrase aucune histoire : fast-forward non jugé', () => {
  const racine = depotDeuxCommits()
  try {
    const stdin = pousse(racine, { refDistante: 'refs/heads/feat/neuve', base: ZERO })
    const { refus, notes } = jugerPush({ cwd: racine, stdin, env: stubCi(racine, []) })
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
    const { refus } = jugerPush({ cwd: racine, stdin: pousse(racine), env: stubCi(racine, [course(tete(racine))]) })
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
      env: stubCi(racine, []),
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
      env: stubCi(racine, []),
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
