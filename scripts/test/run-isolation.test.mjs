// ISOLATION entre arbres et entre sessions (#1679 L1c), deux décisions prises avant tout
// lancement :
//   · refus d'un outillage NON LOCAL (`scripts/test/run.mjs`, `scripts/typecheck-fast.mjs`) — la
//     vérification juge le FICHIER que l'appelant va jouer, jamais une résolution de module (qui,
//     elle, remonte les arbres) ;
//   · verrou de SUITE à l'échelle de la machine (`scripts/test/run.mjs`) — une seule suite
//     complète à la fois.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { refusOutillageLocal } from '../outillage-local.mjs'
import { JETON_REENTRANCE, lireTenant, prendreVerrou, tenantVivant, verrouRequis } from './verrou.mjs'

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

// ── verrou de SUITE à l'échelle machine (#1679 L1c-M7) ────────────────────────────────────────
// `fs` factice : des fichiers par chemin ; `writeFileSync(…, { flag: 'wx' })` et `linkSync` refusent une
// cible déjà présente — la propriété d'exclusion sur laquelle repose le verrou. `boite.contenu` est le
// verrou `/tmp/wfrp-suite.lock`. `espion.creation()` est appelé à l'instant où le verrou vient d'exister,
// `espion.lecture()` avant chaque lecture du verrou, `espion.apresLecture()` après : un tiers y entre au
// pire moment.
function fsFactice(present = null, espion = {}) {
  const VERROU = '/tmp/wfrp-suite.lock'
  const fichiers = new Map(present === null ? [] : [[VERROU, present]])
  const existe = (chemin) => {
    const e = new Error(`EEXIST: ${chemin}`)
    e.code = 'EEXIST'
    return e
  }
  return {
    fichiers,
    get boite() {
      return { contenu: fichiers.get(VERROU) ?? null }
    },
    writeFileSync(chemin, texte, { flag } = {}) {
      if (flag === 'wx' && fichiers.has(chemin)) throw existe(chemin)
      const neuf = !fichiers.has(chemin)
      fichiers.set(chemin, texte)
      if (neuf && chemin === VERROU) espion.creation?.()
    },
    linkSync(source, cible) {
      if (fichiers.has(cible)) throw existe(cible)
      fichiers.set(cible, fichiers.get(source))
      if (cible === VERROU) espion.creation?.()
    },
    readFileSync(chemin) {
      if (chemin === VERROU) espion.lecture?.()
      if (!fichiers.has(chemin)) {
        const e = new Error(`ENOENT: ${chemin}`)
        e.code = 'ENOENT'
        throw e
      }
      const lu = fichiers.get(chemin)
      if (chemin === VERROU) espion.apresLecture?.()
      return lu
    },
    rmSync(chemin) {
      fichiers.delete(chemin)
    },
  }
}

test('verrou libre : pris, le tenant s’inscrit, et `liberer` rend la place', () => {
  const fs = fsFactice()
  const pris = prendreVerrou({
    chemin: '/tmp/wfrp-suite.lock',
    pid: 4242,
    commande: 'node scripts/test/run.mjs',
    cwd: '/arbres/.wt-42',
    env: {},
    fs,
    estVivant: () => true,
    maintenant: () => '2026-09-02T00:00:00.000Z',
  })
  assert.equal(pris.etat, 'pris')
  assert.deepEqual(JSON.parse(fs.boite.contenu), {
    pid: 4242,
    commande: 'node scripts/test/run.mjs',
    cwd: '/arbres/.wt-42',
    date: '2026-09-02T00:00:00.000Z',
  })
  pris.liberer()
  assert.equal(fs.boite.contenu, null)
})

test('verrou tenu par un PID VIVANT : refus qui NOMME le PID, la commande et l’arbre', () => {
  const fs = fsFactice(JSON.stringify({ pid: 1234, commande: 'node scripts/test/run.mjs', cwd: '/arbres/Game' }))
  const vus = []
  const refus = prendreVerrou({
    chemin: '/tmp/wfrp-suite.lock',
    pid: 4242,
    env: {},
    fs,
    estVivant: (p) => {
      vus.push(p)
      return true
    },
  })
  assert.equal(refus.etat, 'refus')
  assert.deepEqual(vus, [1234])
  assert.match(refus.message, /1234/)
  assert.match(refus.message, /node scripts\/test\/run\.mjs/)
  assert.match(refus.message, /\/arbres\/Game/)
  assert.match(refus.message, /WFRP_SUITE_LOCK=0/)
  // Le verrou de l'autre suite reste INTACT : le refus ne vole la place de personne.
  assert.equal(JSON.parse(fs.boite.contenu).pid, 1234)
})

test('verrou laissé par un PID MORT : repris, sans refus', () => {
  const fs = fsFactice(JSON.stringify({ pid: 999, commande: 'node scripts/test/run.mjs' }))
  const pris = prendreVerrou({
    chemin: '/tmp/wfrp-suite.lock',
    pid: 4242,
    env: {},
    fs,
    estVivant: () => false,
    maintenant: () => '2026-09-02T00:00:00.000Z',
  })
  assert.equal(pris.etat, 'pris')
  assert.equal(JSON.parse(fs.boite.contenu).pid, 4242)
})

test('verrou ILLISIBLE (écriture interrompue) : repris, aucun PID à interroger', () => {
  const fs = fsFactice('{pas du json')
  const pris = prendreVerrou({ chemin: '/tmp/wfrp-suite.lock', pid: 4242, env: {}, fs, estVivant: () => true })
  assert.equal(pris.etat, 'pris')
  assert.equal(JSON.parse(fs.boite.contenu).pid, 4242)
})

// ── le lanceur de GATES tient le même verrou (#1679 L3b) ───────────────────────────────
test('jeton de RÉENTRANCE : un enfant du tenant ne reprend pas le verrou, et n’est pas refusé', () => {
  const fs = fsFactice(JSON.stringify({ pid: 4242, commande: 'node scripts/gates/toutes.mjs' }))
  const enfant = prendreVerrou({
    chemin: '/tmp/wfrp-suite.lock',
    pid: 5555,
    env: { [JETON_REENTRANCE]: '4242' },
    fs,
    estVivant: () => true,
  })
  assert.equal(enfant.etat, 'reentrant')
  assert.equal(enfant.tenantPid, 4242)
  assert.equal(enfant.liberer, undefined, 'un réentrant ne rend pas un verrou qu’il n’a pas pris')
  assert.equal(JSON.parse(fs.boite.contenu).pid, 4242, 'le verrou du tenant reste intact')
})

test('un jeton ORPHELIN ne vaut RIEN : c’est le TENANT du verrou qui décide (jamais la variable)', () => {
  // Un TIERS vivant (4242) tient le verrou ; notre processus porte un jeton étranger ou périmé (9999,
  // gates tué par un signal, variable restée dans un shell). Sans confrontation au tenant RÉEL, le jeton
  // serait un second opt-out SILENCIEUX — il ferait passer une suite pendant qu'une autre tourne.
  const fs = fsFactice(JSON.stringify({ pid: 4242, commande: 'npm test', cwd: '/autre/arbre' }))
  const orphelin = prendreVerrou({
    chemin: '/tmp/wfrp-suite.lock', pid: 1, env: { [JETON_REENTRANCE]: '9999' }, fs, estVivant: () => true,
  })
  assert.equal(orphelin.etat, 'refus')
  assert.match(orphelin.message, /4242/, 'le refus nomme le tenant RÉEL, pas le jeton')
  assert.equal(JSON.parse(fs.boite.contenu).pid, 4242, 'le verrou du tiers reste intact')

  const vrai = prendreVerrou({
    chemin: '/tmp/wfrp-suite.lock', pid: 1, env: { [JETON_REENTRANCE]: '4242' }, fs, estVivant: () => true,
  })
  assert.equal(vrai.etat, 'reentrant', 'le jeton qui désigne le tenant réel, lui, réentre')
})

test('opt-out WFRP_SUITE_LOCK=0 : verrou IGNORÉ, mais l’avertissement le dit', () => {
  const fs = fsFactice(JSON.stringify({ pid: 1234 }))
  const hors = prendreVerrou({
    chemin: '/tmp/wfrp-suite.lock',
    env: { WFRP_SUITE_LOCK: '0' },
    fs,
    estVivant: () => true,
  })
  assert.equal(hors.etat, 'ignore')
  assert.match(hors.avertissement, /WFRP_SUITE_LOCK=0/)
  assert.equal(hors.liberer, undefined)
  // Aucun fichier touché : l'opt-out ne dérange pas la suite qui tient le verrou.
  assert.equal(JSON.parse(fs.boite.contenu).pid, 1234)
})

// ── lecture du tenant : le seul lecteur du JSON, partagé par la prise et par la SONDE ────────────

test('lireTenant : le contenu du verrou, ou `null` quand il est illisible ou sans PID', () => {
  const tenant = { pid: 1234, commande: 'npm test', cwd: '/arbres/Game', date: '2026-09-14T10:00:00.000Z' }
  assert.deepEqual(lireTenant(fsFactice(JSON.stringify(tenant)), '/tmp/wfrp-suite.lock'), tenant)
  assert.equal(lireTenant(fsFactice('{pas du json'), '/tmp/wfrp-suite.lock'), null)
  assert.equal(lireTenant(fsFactice(JSON.stringify({ commande: 'npm test' })), '/tmp/wfrp-suite.lock'), null)
  assert.equal(lireTenant(fsFactice(), '/tmp/wfrp-suite.lock'), null)
})

test('tenantVivant : le tenant s’il VIT — un verrou de PID mort ne tient personne', () => {
  const ecrit = JSON.stringify({ pid: 1234, cwd: '/arbres/Game', date: '2026-09-14T10:00:00.000Z' })
  const vivant = tenantVivant({ chemin: '/tmp/wfrp-suite.lock', fs: fsFactice(ecrit), estVivant: () => true })
  assert.equal(vivant.pid, 1234)
  assert.equal(vivant.cwd, '/arbres/Game')
  assert.equal(tenantVivant({ chemin: '/tmp/wfrp-suite.lock', fs: fsFactice(ecrit), estVivant: () => false }), null)
  assert.equal(tenantVivant({ chemin: '/tmp/wfrp-suite.lock', fs: fsFactice(), estVivant: () => true }), null)
})

test('#2279 N0 — le verrou porte son tenant DÈS qu’il existe : un second preneur arrivé à l’instant de la création est refusé', () => {
  let second = null
  const espion = {
    creation: () => {
      espion.creation = null
      second = prendreVerrou({ chemin: '/tmp/wfrp-suite.lock', pid: 2, env: {}, fs, estVivant: (p) => p === 1 })
    },
  }
  const fs = fsFactice(null, espion)
  const premier = prendreVerrou({ chemin: '/tmp/wfrp-suite.lock', pid: 1, env: {}, fs, estVivant: (p) => p === 1 })
  assert.equal(premier.etat, 'pris')
  assert.equal(second?.etat, 'refus', 'le second a lu un verrou sans tenant et l’a repris')
  assert.equal(JSON.parse(fs.boite.contenu).pid, 1)
  assert.deepEqual([...fs.fichiers.keys()], ['/tmp/wfrp-suite.lock'], 'aucun temporaire ni verrou de reprise restant')
})

test('#2279 N0 — deux repreneurs d’un verrou MORT : celui qui arrive après la reprise de l’autre ne retire pas son verrou', () => {
  let premier = null
  const espion = {
    apresLecture: () => {
      espion.apresLecture = null
      premier = prendreVerrou({ chemin: '/tmp/wfrp-suite.lock', pid: 1, env: {}, fs, estVivant: (p) => p !== 999 })
    },
  }
  const fs = fsFactice(JSON.stringify({ pid: 999 }), espion)
  const second = prendreVerrou({ chemin: '/tmp/wfrp-suite.lock', pid: 2, env: {}, fs, estVivant: (p) => p !== 999 })
  assert.equal(premier?.etat, 'pris')
  assert.equal(second.etat, 'refus')
  assert.equal(JSON.parse(fs.boite.contenu).pid, 1, 'le verrou du premier repreneur est intact')
  assert.deepEqual([...fs.fichiers.keys()], ['/tmp/wfrp-suite.lock'])
})

test('#2279 N0 — un verrou absent à la relecture se retente sans rien retirer ; un verrou de reprise tenu par un MORT est retiré', () => {
  const espion = { lecture: () => { espion.lecture = null; absent.rmSync('/tmp/wfrp-suite.lock') } }
  const absent = fsFactice(JSON.stringify({ pid: 5 }), espion)
  const vu = prendreVerrou({ chemin: '/tmp/wfrp-suite.lock', pid: 1, env: {}, fs: absent, estVivant: () => true })
  assert.equal(vu.etat, 'pris')
  assert.equal(JSON.parse(absent.boite.contenu).pid, 1)
  const fs = fsFactice(JSON.stringify({ pid: 999 }))
  fs.fichiers.set('/tmp/wfrp-suite.lock.reprise', JSON.stringify({ pid: 998 }))
  const pris = prendreVerrou({ chemin: '/tmp/wfrp-suite.lock', pid: 1, env: {}, fs, estVivant: (p) => p < 998 })
  assert.equal(pris.etat, 'pris')
  assert.deepEqual([...fs.fichiers.keys()], ['/tmp/wfrp-suite.lock'])
})
