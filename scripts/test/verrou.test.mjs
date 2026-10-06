// Le verrou `prendreVerrou` / `attendreLibre` (#1679 L1c-M7, #2279 N0, #2187) : prise, refus nommé, reprise
// d'un mort, attente bornée, et un banc de CONCURRENCE réelle où des processus distincts font, verrou
// tenu, une lecture-modification-écriture d'un compteur — une exclusion qui fuit perd des incréments.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import fsReel from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { attendreLibre, prendreVerrou } from './verrou.mjs'

const MODULE = pathToFileURL(path.join(import.meta.dirname, 'verrou.mjs')).href
const SOMMEIL = pathToFileURL(path.join(import.meta.dirname, '../guards/lib/spawnResilient.mjs')).href
const PROCESSUS = 8
const PRISES = 10
const VERROU = '/tmp/banc.verrou'
const LIBELLE = 'le banc tient déjà ce verrou'

// `fs` factice : des fichiers par chemin ; `writeFileSync(…, { flag: 'wx' })` et `linkSync` refusent une
// cible déjà présente — la propriété d'exclusion sur laquelle repose le verrou. `boite.contenu` est le
// verrou `VERROU`. `espion.creation()` est appelé à l'instant où le verrou vient d'exister,
// `espion.lecture()` avant chaque lecture du verrou, `espion.apresLecture()` après : un tiers y entre au
// pire moment.
function fsFactice(present = null, espion = {}) {
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

/** Horloge et sommeil factices : `dormir(ms)` avance l'horloge, et `apres[n]` s'exécute au n-ième sommeil. */
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

test('verrou libre : pris, le tenant s’inscrit, et `liberer` rend la place', () => {
  const fs = fsFactice()
  const pris = prendreVerrou({
    chemin: VERROU,
    libelle: LIBELLE,
    pid: 4242,
    commande: 'node scripts/test/run.mjs',
    cwd: '/arbres/.wt-42',
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

test('verrou tenu par un PID VIVANT : refus qui NOMME le libellé, le PID, la commande et l’arbre', () => {
  const fs = fsFactice(JSON.stringify({ pid: 1234, commande: 'node scripts/test/run.mjs', cwd: '/arbres/Game' }))
  const vus = []
  const refus = prendreVerrou({
    chemin: VERROU,
    libelle: LIBELLE,
    pid: 4242,
    fs,
    estVivant: (p) => {
      vus.push(p)
      return true
    },
  })
  assert.equal(refus.etat, 'refus')
  assert.deepEqual(vus, [1234])
  assert.equal(refus.tenant.pid, 1234)
  assert.ok(refus.message.includes(LIBELLE))
  assert.match(refus.message, /1234/)
  assert.match(refus.message, /node scripts\/test\/run\.mjs/)
  assert.match(refus.message, /\/arbres\/Game/)
  assert.equal(JSON.parse(fs.boite.contenu).pid, 1234, 'le refus ne vole la place de personne')
})

test('verrou laissé par un PID MORT : repris, sans refus', () => {
  const fs = fsFactice(JSON.stringify({ pid: 999, commande: 'node scripts/test/run.mjs' }))
  const pris = prendreVerrou({ chemin: VERROU, libelle: LIBELLE, pid: 4242, fs, estVivant: () => false })
  assert.equal(pris.etat, 'pris')
  assert.equal(JSON.parse(fs.boite.contenu).pid, 4242)
})

test('verrou ILLISIBLE (écriture interrompue) : repris, aucun PID à interroger', () => {
  const fs = fsFactice('{pas du json')
  const pris = prendreVerrou({ chemin: VERROU, libelle: LIBELLE, pid: 4242, fs, estVivant: () => true })
  assert.equal(pris.etat, 'pris')
  assert.equal(JSON.parse(fs.boite.contenu).pid, 4242)
})

test('#2279 N0 — le verrou porte son tenant DÈS qu’il existe : un second preneur arrivé à l’instant de la création est refusé', () => {
  let second = null
  const espion = {
    creation: () => {
      espion.creation = null
      second = prendreVerrou({ chemin: VERROU, libelle: LIBELLE, pid: 2, fs, estVivant: (p) => p === 1 })
    },
  }
  const fs = fsFactice(null, espion)
  const premier = prendreVerrou({ chemin: VERROU, libelle: LIBELLE, pid: 1, fs, estVivant: (p) => p === 1 })
  assert.equal(premier.etat, 'pris')
  assert.equal(second?.etat, 'refus', 'le second a lu un verrou sans tenant et l’a repris')
  assert.equal(JSON.parse(fs.boite.contenu).pid, 1)
  assert.deepEqual([...fs.fichiers.keys()], [VERROU], 'aucun temporaire ni verrou de reprise restant')
})

test('#2279 N0 — deux repreneurs d’un verrou MORT : celui qui arrive après la reprise de l’autre ne retire pas son verrou', () => {
  let premier = null
  const espion = {
    apresLecture: () => {
      espion.apresLecture = null
      premier = prendreVerrou({ chemin: VERROU, libelle: LIBELLE, pid: 1, fs, estVivant: (p) => p !== 999 })
    },
  }
  const fs = fsFactice(JSON.stringify({ pid: 999 }), espion)
  const second = prendreVerrou({ chemin: VERROU, libelle: LIBELLE, pid: 2, fs, estVivant: (p) => p !== 999 })
  assert.equal(premier?.etat, 'pris')
  assert.equal(second.etat, 'refus')
  assert.equal(JSON.parse(fs.boite.contenu).pid, 1, 'le verrou du premier repreneur est intact')
  assert.deepEqual([...fs.fichiers.keys()], [VERROU])
})

test('#2279 N0 — un verrou absent à la relecture se retente sans rien retirer ; un verrou de reprise tenu par un MORT est retiré', () => {
  const espion = { lecture: () => { espion.lecture = null; absent.rmSync(VERROU) } }
  const absent = fsFactice(JSON.stringify({ pid: 5 }), espion)
  const vu = prendreVerrou({ chemin: VERROU, libelle: LIBELLE, pid: 1, fs: absent, estVivant: () => true })
  assert.equal(vu.etat, 'pris')
  assert.equal(JSON.parse(absent.boite.contenu).pid, 1)
  const fs = fsFactice(JSON.stringify({ pid: 999 }))
  fs.fichiers.set(`${VERROU}.reprise`, JSON.stringify({ pid: 998 }))
  const pris = prendreVerrou({ chemin: VERROU, libelle: LIBELLE, pid: 1, fs, estVivant: (p) => p < 998 })
  assert.equal(pris.etat, 'pris')
  assert.deepEqual([...fs.fichiers.keys()], [VERROU])
})

// ── attente bornée (#2187) ────────────────────────────────────────────────────────────────────

test('#2187 — prise EN ATTENTE : annonce le tenant à chaque pas, et prend dès que le tenant meurt', () => {
  const fs = fsFactice(JSON.stringify({ pid: 1234, cwd: '/arbres/Game' }))
  let vivant = true
  const temps = tempsFactice({ 2: () => { vivant = false } })
  const annonces = []
  const pris = prendreVerrou({
    chemin: VERROU, libelle: LIBELLE, pid: 4242, fs, estVivant: (p) => p !== 1234 || vivant,
    attente: { echeanceMs: 60_000, pasMs: 15_000, annoncer: (tenant) => annonces.push(tenant.pid) },
    dormir: temps.dormir, horloge: temps.horloge,
  })
  assert.equal(pris.etat, 'pris')
  assert.deepEqual(annonces, [1234, 1234], 'une annonce par pas, qui nomme le tenant')
  assert.deepEqual(temps.sommeils, [15_000, 15_000])
  assert.equal(JSON.parse(fs.boite.contenu).pid, 4242)
})

test('#2187 — prise EN ATTENTE d’un tenant qui ne meurt jamais : REFUS à l’échéance, dernier pas tronqué, aucune exception', () => {
  const fs = fsFactice(JSON.stringify({ pid: 1234 }))
  const temps = tempsFactice()
  const refus = prendreVerrou({
    chemin: VERROU, libelle: LIBELLE, pid: 4242, fs, estVivant: () => true,
    attente: { echeanceMs: 40_000, pasMs: 15_000 },
    dormir: temps.dormir, horloge: temps.horloge,
  })
  assert.equal(refus.etat, 'refus')
  assert.equal(refus.tenant.pid, 1234)
  assert.deepEqual(temps.sommeils, [15_000, 15_000, 10_000], 'l’échéance borne l’attente totale')
  assert.equal(JSON.parse(fs.boite.contenu).pid, 1234)
})

test('#2187 — attendreLibre : absent, illisible ou tenu par un MORT vaut libre, sans rien prendre ni dormir', () => {
  const temps = tempsFactice()
  const attente = { echeanceMs: 60_000, pasMs: 15_000 }
  for (const present of [null, '{pas du json', JSON.stringify({ pid: 999 })]) {
    const fs = fsFactice(present)
    const vu = attendreLibre({ chemin: VERROU, attente, fs, estVivant: () => false, dormir: temps.dormir, horloge: temps.horloge })
    assert.deepEqual(vu, { etat: 'libre' })
    assert.equal(fs.boite.contenu, present, 'attendreLibre ne prend ni ne retire rien')
  }
  assert.deepEqual(temps.sommeils, [])
})

test('#2187 — attendreLibre : attend un tenant VIVANT, l’annonce, et rend `occupe` à l’échéance ou `libre` à sa mort', () => {
  const ecrit = JSON.stringify({ pid: 1234, cwd: '/arbres/Game' })
  const occupe = tempsFactice()
  const annonces = []
  const vu = attendreLibre({
    chemin: VERROU, fs: fsFactice(ecrit), estVivant: () => true,
    attente: { echeanceMs: 30_000, pasMs: 15_000, annoncer: (tenant) => annonces.push(tenant.cwd) },
    dormir: occupe.dormir, horloge: occupe.horloge,
  })
  assert.equal(vu.etat, 'occupe')
  assert.equal(vu.tenant.pid, 1234)
  assert.deepEqual(annonces, ['/arbres/Game', '/arbres/Game'])
  assert.deepEqual(occupe.sommeils, [15_000, 15_000])

  let vivant = true
  const libere = tempsFactice({ 1: () => { vivant = false } })
  const fs = fsFactice(ecrit)
  const libre = attendreLibre({
    chemin: VERROU, fs, estVivant: () => vivant,
    attente: { echeanceMs: 60_000, pasMs: 15_000 }, dormir: libere.dormir, horloge: libere.horloge,
  })
  assert.deepEqual(libre, { etat: 'libre' })
  assert.deepEqual(libere.sommeils, [15_000])
  assert.equal(fs.boite.contenu, ecrit, 'le verrou du mort reste en place : attendreLibre ne prend rien')
})

// ── concurrence réelle (#2279 N0) ─────────────────────────────────────────────────────────────

/** Un preneur : `PRISES` sections critiques sous le verrou, au plus 20 000 tentatives ; rend ses prises. */
const preneur = (dossier) => `
const { prendreVerrou } = await import(${JSON.stringify(MODULE)})
const { attendreSync: pause } = await import(${JSON.stringify(SOMMEIL)})
const fs = await import('node:fs')
const chemin = ${JSON.stringify(path.join(dossier, 'compteur.verrou'))}
const compteur = ${JSON.stringify(path.join(dossier, 'compteur'))}
let prises = 0
for (let essai = 0; essai < 20000 && prises < ${PRISES}; essai += 1) {
  const verrou = prendreVerrou({ chemin, libelle: 'compteur' })
  if (verrou.etat !== 'pris') { pause(1); continue }
  const lu = Number(fs.readFileSync(compteur, 'utf8'))
  pause(1)
  fs.writeFileSync(compteur, String(lu + 1))
  verrou.liberer()
  prises += 1
}
process.stdout.write(String(prises))
`

test(`#2279 N0 — ${PROCESSUS} processus se disputent le verrou : aucune section critique ne se chevauche, aucun incrément perdu`, async () => {
  const dossier = fsReel.mkdtempSync(path.join(os.tmpdir(), 'verrou-conc-'))
  try {
    fsReel.writeFileSync(path.join(dossier, 'compteur'), '0')
    const prises = await Promise.all(Array.from({ length: PROCESSUS }, () => new Promise((fini) => {
      const enfant = spawn(process.execPath, ['--input-type=module', '-e', preneur(dossier)], { stdio: ['ignore', 'pipe', 'inherit'] })
      const borne = setTimeout(() => enfant.kill(), 120000)
      let sortie = ''
      enfant.stdout.on('data', (d) => { sortie += d })
      enfant.on('close', () => { clearTimeout(borne); fini(Number(sortie)) })
    })))
    assert.deepEqual(prises, Array(PROCESSUS).fill(PRISES), 'chaque preneur a fini ses prises')
    assert.equal(fsReel.readFileSync(path.join(dossier, 'compteur'), 'utf8'), String(PROCESSUS * PRISES), 'incréments perdus')
    assert.deepEqual(fsReel.readdirSync(dossier), ['compteur'], 'ni verrou, ni temporaire, ni verrou de reprise restant')
  } finally {
    fsReel.rmSync(dossier, { recursive: true, force: true })
  }
})
