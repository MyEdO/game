// ISOLATION entre arbres et entre sessions (#1679 L1c), deux décisions prises avant tout
// lancement :
//   · refus d'un outillage NON LOCAL (`scripts/test/run.mjs`, `scripts/typecheck-fast.mjs`) — la
//     vérification juge le FICHIER que l'appelant va jouer, jamais une résolution de module (qui,
//     elle, remonte les arbres) ;
//   · runs qui exigent le verrou de SUITE de `scripts/test/run.mjs` (`verrouDeSuite.mjs`) —
//     une seule suite complète à la fois.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { refusOutillageLocal } from '../outillage-local.mjs'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { VERROU_SUITE, attenteDeSuite, prendreVerrouDeSuite, verrouRequis } from './verrouDeSuite.mjs'

test('entrée absente de l’arbre : refus qui NOMME l’arbre, l’outil et la cause', () => {
  const refus = refusOutillageLocal('/arbres/.wt-42', 'vitest', '/arbres/.wt-42/node_modules/vitest/vitest.mjs', () => false)
  assert.ok(refus, 'une entrée absente doit être refusée')
  assert.match(refus, /vitest/)
  assert.match(refus, /\/arbres\/\.wt-42/)
  assert.match(refus, /AUTRE arbre/)
})

test('entrée présente : aucun refus, et la présence se juge sur CE fichier', () => {
  const entree = '/arbres/.wt-42/node_modules/typescript/bin/tsc'
  const vus = []
  const refus = refusOutillageLocal('/arbres/.wt-42', 'tsc', entree, (p) => {
    vus.push(p)
    return true
  })
  assert.equal(refus, null)
  assert.deepEqual(vus, [entree])
})

test('une entrée présente AILLEURS ne vaut pas présence dans l’arbre', () => {
  const entree = '/arbres/.wt-42/node_modules/vitest/vitest.mjs'
  const refus = refusOutillageLocal('/arbres/.wt-42', 'vitest', entree, (p) => p !== entree)
  assert.ok(refus, 'seul le fichier attendu compte')
})

// ── quels runs prennent le verrou ───────────────────────────────────────────────
const FICHIERS = new Set(['src/engine/x.test.ts', 'src/ui/y.test.tsx'])
const estFichier = (t) => FICHIERS.has(t)

test('run SANS filtre : verrou REQUIS', () => {
  assert.equal(verrouRequis([], estFichier), true)
})

test('filtre-DOSSIER : verrou REQUIS — `npm test src` énumère la suite entière', () => {
  assert.equal(verrouRequis(['src'], estFichier), true)
  assert.equal(verrouRequis(['.'], estFichier), true)
  assert.equal(verrouRequis(['src/engine'], estFichier), true)
})

test('filtres-FICHIERS : verrou LIBRE, même à plusieurs', () => {
  assert.equal(verrouRequis(['src/engine/x.test.ts'], estFichier), false)
  assert.equal(verrouRequis(['src/engine/x.test.ts', 'src/ui/y.test.tsx'], estFichier), false)
})

test('un seul filtre-DOSSIER parmi des fichiers suffit à exiger le verrou', () => {
  assert.equal(verrouRequis(['src/engine/x.test.ts', 'src'], estFichier), true)
})

// ── la prise du verrou de suite par `run.mjs` (#2187) ─────────────────────────────────────────
// Sur le disque réel, sous un `mkdtempSync` : un tenant FACTICE (`estVivant` injecté), une horloge et un
// sommeil factices — l'attente se mesure sans attendre.

/** Un dossier jetable portant un verrou tenu par le PID 1234 ; `verrou` = `VERROU_SUITE` à ce chemin. */
function verrouTenu() {
  const dossier = mkdtempSync(join(tmpdir(), 'verrou-suite-'))
  const chemin = join(dossier, 'suite.lock')
  writeFileSync(chemin, JSON.stringify({ pid: 1234, cwd: '/arbres/Game' }))
  return { dossier, chemin, verrou: { ...VERROU_SUITE, chemin } }
}

function tempsFactice(apres = {}) {
  const t = { ms: 0, sommeils: [] }
  t.horloge = () => t.ms
  t.dormir = (ms) => {
    t.sommeils.push(ms)
    t.ms += ms
    apres[t.sommeils.length]?.()
  }
  return t
}

test('#2187 — run.mjs ATTEND la suite d’un autre arbre : annonce le tenant à chaque pas, prend à sa mort', () => {
  const { dossier, chemin, verrou } = verrouTenu()
  try {
    let vivant = true
    const temps = tempsFactice({ 2: () => { vivant = false } })
    const annonces = []
    const pris = prendreVerrouDeSuite({
      env: {}, verrou, commande: 'npm test', cwd: '/arbres/.wt-1',
      annoncer: (tenant) => annonces.push(attenteDeSuite(tenant)),
      estVivant: (p) => p !== 1234 || vivant, dormir: temps.dormir, horloge: temps.horloge,
    })
    assert.equal(pris.etat, 'pris')
    assert.equal(annonces.length, 2)
    assert.match(annonces[0], /PID 1234, \/arbres\/Game/)
    assert.deepEqual(temps.sommeils, [VERROU_SUITE.attente.pasMs, VERROU_SUITE.attente.pasMs])
    assert.equal(JSON.parse(readFileSync(chemin, 'utf8')).cwd, '/arbres/.wt-1')
    pris.liberer()
    assert.equal(existsSync(chemin), false)
  } finally {
    rmSync(dossier, { recursive: true, force: true })
  }
})

test('#2187 — run.mjs : à l’échéance, REFUS qui nomme le tenant et l’opt-out ; opt-out et run filtré ne prennent rien', () => {
  const { dossier, chemin, verrou } = verrouTenu()
  try {
    const temps = tempsFactice()
    const court = { ...verrou, attente: { pasMs: 10, echeanceMs: 25 } }
    const refus = prendreVerrouDeSuite({ env: {}, verrou: court, estVivant: () => true, dormir: temps.dormir, horloge: temps.horloge })
    assert.equal(refus.etat, 'refus')
    assert.match(refus.message, /1234/)
    assert.match(refus.message, /WFRP_SUITE_LOCK=0/)
    assert.deepEqual(temps.sommeils, [10, 10, 5])

    const horsVerrou = prendreVerrouDeSuite({ env: { WFRP_SUITE_LOCK: '0' }, verrou: court, estVivant: () => true })
    assert.equal(horsVerrou.etat, 'ignore')
    assert.match(horsVerrou.avertissement, /ne prend pas le verrou de suite \(WFRP_SUITE_LOCK=0\)/)
    assert.deepEqual(prendreVerrouDeSuite({ requis: false, env: {}, verrou: court }), { etat: 'ignore' })
    assert.equal(JSON.parse(readFileSync(chemin, 'utf8')).pid, 1234, 'le verrou du tenant reste intact')
  } finally {
    rmSync(dossier, { recursive: true, force: true })
  }
})
