// L'UNION À TROIS ISSUES, mesurée contre git RÉEL sur un dépôt jetable — jamais sur un double :
// c'est le CLASSEMENT des sorties de git qui doit être juste, et git seul dit ce qu'il écrit.
// Sonde d'origine (2026-09-05) : 13 cas, dont deux motifs que la première liste ne portait pas
// (`bad object`, `Invalid revision range`) et qui auraient classé « git en panne » deux absences.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { STATUS_DLL_INIT_FAILED } from './spawnResilient.mjs'
import { classer, commitsDe, estAncetre, estRepertoire, fetchOrigin, lireGit, natureDuChemin, raisonCourte, sortieOuNull } from './gitPorte.mjs'
import { instanceDeDepot } from './depotGabarit.mjs'

const ZERO = '0'.repeat(40)

/** Dépôt jetable de DEUX commits : le second AJOUTE `neuf.txt` — la pre-image de ce fichier est le
 *  cas normal de la porte de stock, et c'est un ABSENT, pas une panne. */
function depot() {
  const { racine, sha: premier } = instanceDeDepot({ fichiers: { 'a.txt': 'a\n' }, message: 'un' })
  const g = (...a) => execFileSync('git', a, { cwd: racine, encoding: 'utf8' })
  writeFileSync(join(racine, 'neuf.txt'), 'n\n')
  g('add', '-A'); g('commit', '-q', '-m', 'deux')
  return { racine, premier, second: g('rev-parse', 'HEAD').trim(), g }
}

const jeter = (racine) => rmSync(racine, { recursive: true, force: true })

// Les DEUX ENOENT du spawn (#1729) : node écrit le même « spawnSync git ENOENT » quand le binaire
// manque et quand le `cwd` demandé n'existe pas. Le second est le cas RÉEL mesuré : une porte y
// renvoyait « rejouer depuis un arbre où git répond » alors que git répondait.
test('lireGit : un cwd INEXISTANT se nomme, il ne se confond pas avec un git absent', () => {
  const jamais = join(tmpdir(), `cwd-absent-${process.pid}`)
  const vu = lireGit(['rev-parse', 'HEAD'], { cwd: jamais })
  assert.equal(vu.disponible, false)
  assert.equal(vu.raison, `cwd inexistant : ${jamais}`)

  const sansGit = classer({ error: new Error('spawnSync git ENOENT') }, { cwd: tmpdir() })
  assert.match(sansGit.raison, /git introuvable/, 'cwd répertoire → la cause restante est le binaire')
})

test('lireGit : un cwd qui EXISTE sans être un répertoire se nomme pour ce qu’il est', () => {
  const { racine } = depot()
  try {
    const fichier = join(racine, 'a.txt')
    assert.equal(natureDuChemin(fichier), 'fichier')
    assert.equal(estRepertoire(fichier), false)
    assert.equal(estRepertoire(racine), true)
    const vu = lireGit(['rev-parse', 'HEAD'], { cwd: fichier })
    assert.equal(vu.disponible, false)
    assert.equal(vu.raison, `cwd qui n'est pas un répertoire : ${fichier}`)
  } finally { jeter(racine) }
})

test('lireGit : status 0 rend un FAIT porteur de la sortie', () => {
  const { racine, second } = depot()
  try {
    const vu = lireGit(['rev-parse', 'HEAD'], { cwd: racine })
    assert.equal(vu.disponible, true)
    assert.equal(vu.absent, undefined)
    assert.equal(vu.valeur.stdout.trim(), second)
    assert.equal(sortieOuNull(vu).trim(), second)
  } finally { jeter(racine) }
})

test('lireGit : un PRÉDICAT qui rend 1 sans stderr est un FAIT porteur du code, jamais une panne', () => {
  const { racine, premier, second } = depot()
  try {
    const faux = lireGit(['merge-base', '--is-ancestor', second, premier], { cwd: racine })
    assert.equal(faux.disponible, true)
    assert.equal(faux.absent, undefined)
    assert.equal(faux.valeur.status, 1)
    // Un code ≠ 0 n'est pas une sortie exploitable pour les lecteurs d'image.
    assert.equal(sortieOuNull(faux), null)
    const quiet = lireGit(['rev-parse', '--verify', '--quiet', 'origin/main^{commit}'], { cwd: racine })
    assert.equal(quiet.disponible, true)
    assert.equal(quiet.valeur.status, 1)
  } finally { jeter(racine) }
})

test('lireGit : les cinq ABSENCES de la porte sont des ABSENTS (dépôt réel)', () => {
  const { racine, second } = depot()
  try {
    const absents = {
      'pre-image d’un fichier AJOUTÉ': ['show', `${second}^:neuf.txt`],
      'post-image d’un fichier absent': ['show', `${second}:jamais.txt`],
      'origin/main inconnu': ['rev-parse', 'origin/main'],
      'sha inconnu': ['show', '-s', '--format=%B', ZERO],
      'plage inconnue': ['diff', '-U0', `${ZERO}..${second}`],
    }
    for (const [nom, args] of Object.entries(absents)) {
      const vu = lireGit(args, { cwd: racine })
      assert.equal(vu.disponible, true, `${nom} : une absence n’est pas une panne`)
      assert.equal(vu.absent, true, nom)
      assert.equal(sortieOuNull(vu), null, `${nom} : le contrat des lecteurs d’image est \`null\``)
    }
  } finally { jeter(racine) }
})

test('lireGit : HORS dépôt, c’est INDISPONIBLE — et la raison le dit', () => {
  const hors = mkdtempSync(join(tmpdir(), 'git-hors-'))
  try {
    const vu = lireGit(['rev-parse', 'HEAD'], { cwd: hors })
    assert.equal(vu.disponible, false)
    assert.match(vu.raison, /not a git repository/i)
  } finally { jeter(hors) }
})

test('lireGit : un git ABSENT du système (ENOENT) est INDISPONIBLE, jamais un absent', () => {
  const vu = lireGit(['rev-parse', 'HEAD'], {
    spawn: () => ({ error: new Error('spawnSync git ENOENT'), status: null }),
  })
  assert.equal(vu.disponible, false)
  assert.match(vu.raison, /ENOENT/)
})

test('lireGit : un processus TUÉ par un signal est INDISPONIBLE', () => {
  const vu = lireGit(['log'], { spawn: () => ({ status: null, signal: 'SIGKILL', stdout: '', stderr: '' }) })
  assert.equal(vu.disponible, false)
  assert.match(vu.raison, /SIGKILL/)
})

test('lireGit : le processus qui n’a pas DÉMARRÉ est REJOUÉ (spawnResilient), pas classé indisponible', () => {
  let essais = 0
  const attentes = []
  const vu = lireGit(['rev-parse', 'HEAD'], {
    attendre: (ms) => attentes.push(ms),
    journal: { write: () => {} },
    spawn: () => {
      essais += 1
      return essais < 3
        ? { status: STATUS_DLL_INIT_FAILED, stdout: '', stderr: '' }
        : { status: 0, stdout: 'abc1234\n', stderr: '' }
    },
  })
  assert.equal(essais, 3)
  assert.deepEqual(attentes, [2000, 5000])
  assert.equal(vu.disponible, true)
  assert.equal(vu.valeur.stdout.trim(), 'abc1234')
})

test('estAncetre : vrai, faux, et un sha inconnu qui rend ABSENT', () => {
  const { racine, premier, second } = depot()
  try {
    assert.deepEqual(estAncetre(premier, second, { cwd: racine }), { disponible: true, valeur: true })
    assert.deepEqual(estAncetre(second, premier, { cwd: racine }), { disponible: true, valeur: false })
    assert.deepEqual(estAncetre(ZERO, 'HEAD', { cwd: racine }), { disponible: true, absent: true })
  } finally { jeter(racine) }
})

test('commitsDe : les N derniers commits, du plus récent au plus ancien ; ref inconnue = ABSENT', () => {
  const { racine, premier, second } = depot()
  try {
    assert.deepEqual(commitsDe('HEAD', 10, { cwd: racine }), { disponible: true, valeur: [second, premier] })
    assert.deepEqual(commitsDe('HEAD', 1, { cwd: racine }), { disponible: true, valeur: [second] })
    assert.deepEqual(commitsDe(ZERO, 5, { cwd: racine }), { disponible: true, absent: true })
  } finally { jeter(racine) }
})

test('fetchOrigin : une origine LOCALE réelle met `origin/main` à jour ; sans origine, INDISPONIBLE', () => {
  const amont = depot()
  const aval = mkdtempSync(join(tmpdir(), 'git-aval-'))
  try {
    execFileSync('git', ['clone', '-q', '--no-local', amont.racine, aval], { encoding: 'utf8' })
    // La ref distante est SUPPRIMÉE localement : seul un fetch réel peut la remettre.
    execFileSync('git', ['update-ref', '-d', 'refs/remotes/origin/main'], { cwd: aval })
    assert.equal(lireGit(['rev-parse', 'origin/main'], { cwd: aval }).absent, true)
    const vu = fetchOrigin({ cwd: aval })
    assert.equal(vu.disponible, true, vu.raison)
    assert.equal(sortieOuNull(lireGit(['rev-parse', 'origin/main'], { cwd: aval })).trim(), amont.second)

    const sansOrigine = lireGit(['fetch', '--quiet', 'origin', 'main'], { cwd: amont.racine })
    assert.equal(sansOrigine.disponible, false)
  } finally {
    jeter(amont.racine)
    jeter(aval)
  }
})

test('classer : la RAISON est la première ligne significative, bornée à 200 caractères', () => {
  const vu = classer({ status: 128, stdout: '', stderr: `\n\nfatal: ${'x'.repeat(400)}\nune seconde ligne` })
  assert.equal(vu.disponible, false)
  assert.equal(vu.raison.length, 200)
  assert.ok(!vu.raison.includes('une seconde ligne'))
  assert.equal(raisonCourte('   \n  premier mot  \nsuite'), 'premier mot')
})
