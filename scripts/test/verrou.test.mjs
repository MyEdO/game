// Le verrou `prendreVerrou` / `attendreLibre` (#1679 L1c-M7, #2279 N0, #2187, #2603) : prise, refus nommé, reprise
// d'un mort, attente bornée, et un banc de CONCURRENCE réelle où des processus distincts font, verrou
// tenu, une lecture-modification-écriture d'un compteur — une exclusion qui fuit perd des incréments.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import fsReel from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { pathToFileURL } from 'node:url'
import { attendreLibre, jetonsDuVerrou, prendreVerrou, prendreVerrouAsync, sousEcheanceAsync, verdictDuJeton } from './verrou.mjs'

const MODULE = pathToFileURL(path.join(import.meta.dirname, 'verrou.mjs')).href
const SOMMEIL = pathToFileURL(path.join(import.meta.dirname, '../guards/lib/spawnResilient.mjs')).href
const PROCESSUS = 8
const PRISES = 10
const VERROU = '/tmp/banc.verrou'
const LIBELLE = 'le banc tient déjà ce verrou'
/** L'identité INDÉTERMINÉE (`lireCreation` rend `null`) : un PID feint ne se mesure pas. */
const INDETERMINEE = { lireCreation: () => null, toleranceMs: 0 }

// `fs` factice : des fichiers par chemin ; `writeFileSync(…, { flag: 'wx' })` et `linkSync` refusent une
// cible déjà présente — la propriété d'exclusion sur laquelle repose le verrou. `boite.contenu` est le
// verrou `VERROU`. `espion.creation()` est appelé à l'instant où le verrou vient d'exister,
// `espion.lecture()` avant chaque lecture du verrou, `espion.apresLecture()` après, et
// `espion.apresLectureDe(chemin)` après la lecture de tout fichier : un tiers y entre au pire moment.
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
      espion.apresLectureDe?.(chemin)
      return lu
    },
    rmSync(chemin) {
      fichiers.delete(chemin)
    },
    mkdirSync() {},
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

test('dossier absent : la prise crée le dossier du verrou, puis le prend', () => {
  const racine = fsReel.mkdtempSync(path.join(os.tmpdir(), 'verrou-dossier-'))
  try {
    const chemin = path.join(racine, 'absent', 'sous', 'banc.verrou')
    const pris = prendreVerrou({ chemin, libelle: LIBELLE, estVivant: () => true })
    assert.equal(pris.etat, 'pris')
    assert.equal(JSON.parse(fsReel.readFileSync(chemin, 'utf8')).pid, process.pid)
    pris.liberer()
    assert.deepEqual(fsReel.readdirSync(path.dirname(chemin)), [])
  } finally {
    fsReel.rmSync(racine, { recursive: true, force: true })
  }
})

test('verrou libre : pris, le tenant s’inscrit, et `liberer` rend la place', () => {
  const fs = fsFactice()
  const pris = prendreVerrou({
    chemin: VERROU,
    libelle: LIBELLE,
    identite: INDETERMINEE, pid: 4242,
    commande: 'node scripts/test/run.mjs',
    cwd: '/arbres/.wt-42',
    fs,
    estVivant: () => true,
    maintenant: () => '2026-09-02T00:00:00.000Z',
  })
  assert.equal(pris.etat, 'pris')
  const { generation, empreinte, ...tenant } = JSON.parse(fs.boite.contenu)
  assert.match(empreinte, /^[0-9a-f]{64}$/)
  assert.match(generation, /^[0-9a-f-]{36}$/, 'la prise porte sa génération')
  assert.deepEqual(tenant, {
    pid: 4242,
    commande: 'node scripts/test/run.mjs',
    cwd: '/arbres/.wt-42',
    date: '2026-09-02T00:00:00.000Z',
  })
  pris.liberer()
  assert.equal(fs.boite.contenu, null)
  pris.liberer()
  const erreur = Object.assign(new Error('suppression refusée'), { code: 'EACCES' })
  fs.rmSync = () => { throw erreur }
  assert.throws(() => pris.liberer(), (e) => e === erreur)
})

test('verrou tenu par un PID VIVANT : refus qui NOMME le libellé, le PID, la commande et l’arbre', () => {
  const fs = fsFactice(JSON.stringify({ pid: 1234, commande: 'node scripts/test/run.mjs', cwd: '/arbres/Game' }))
  const vus = []
  const refus = prendreVerrou({
    chemin: VERROU,
    libelle: LIBELLE,
    identite: INDETERMINEE, pid: 4242,
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
  const pris = prendreVerrou({ chemin: VERROU, libelle: LIBELLE, identite: INDETERMINEE, pid: 4242, fs, estVivant: () => false })
  assert.equal(pris.etat, 'pris')
  assert.equal(JSON.parse(fs.boite.contenu).pid, 4242)
})

test('verrou ILLISIBLE (écriture interrompue) : repris, aucun PID à interroger', () => {
  const fs = fsFactice('{pas du json')
  const pris = prendreVerrou({ chemin: VERROU, libelle: LIBELLE, identite: INDETERMINEE, pid: 4242, fs, estVivant: () => true })
  assert.equal(pris.etat, 'pris')
  assert.equal(JSON.parse(fs.boite.contenu).pid, 4242)
})

test('#2279 N0 — le verrou porte son tenant DÈS qu’il existe : un second preneur arrivé à l’instant de la création est refusé', () => {
  let second = null
  const espion = {
    creation: () => {
      espion.creation = null
      second = prendreVerrou({ chemin: VERROU, libelle: LIBELLE, identite: INDETERMINEE, pid: 2, fs, estVivant: (p) => p === 1 })
    },
  }
  const fs = fsFactice(null, espion)
  const premier = prendreVerrou({ chemin: VERROU, libelle: LIBELLE, identite: INDETERMINEE, pid: 1, fs, estVivant: (p) => p === 1 })
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
      premier = prendreVerrou({ chemin: VERROU, libelle: LIBELLE, identite: INDETERMINEE, pid: 1, fs, estVivant: (p) => p !== 999 })
    },
  }
  const fs = fsFactice(JSON.stringify({ pid: 999 }), espion)
  const second = prendreVerrou({ chemin: VERROU, libelle: LIBELLE, identite: INDETERMINEE, pid: 2, fs, estVivant: (p) => p !== 999 })
  assert.equal(premier?.etat, 'pris')
  assert.equal(second.etat, 'refus')
  assert.equal(JSON.parse(fs.boite.contenu).pid, 1, 'le verrou du premier repreneur est intact')
  assert.deepEqual([...fs.fichiers.keys()], [VERROU])
})

test('#2279 N0 — un verrou absent à la relecture se retente sans rien retirer ; un verrou de reprise tenu par un MORT est retiré', () => {
  const espion = { lecture: () => { espion.lecture = null; absent.rmSync(VERROU) } }
  const absent = fsFactice(JSON.stringify({ pid: 5 }), espion)
  const vu = prendreVerrou({ chemin: VERROU, libelle: LIBELLE, identite: INDETERMINEE, pid: 1, fs: absent, estVivant: () => true })
  assert.equal(vu.etat, 'pris')
  assert.equal(JSON.parse(absent.boite.contenu).pid, 1)
  const fs = fsFactice(JSON.stringify({ pid: 999 }))
  fs.fichiers.set(`${VERROU}.reprise`, JSON.stringify({ pid: 998 }))
  const pris = prendreVerrou({ chemin: VERROU, libelle: LIBELLE, identite: INDETERMINEE, pid: 1, fs, estVivant: (p) => p < 998 })
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
    chemin: VERROU, libelle: LIBELLE, identite: INDETERMINEE, pid: 4242, fs, estVivant: (p) => p !== 1234 || vivant,
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
    chemin: VERROU, libelle: LIBELLE, identite: INDETERMINEE, pid: 4242, fs, estVivant: () => true,
    attente: { echeanceMs: 40_000, pasMs: 15_000 },
    dormir: temps.dormir, horloge: temps.horloge,
  })
  assert.equal(refus.etat, 'refus')
  assert.equal(refus.tenant.pid, 1234)
  assert.deepEqual(temps.sommeils, [15_000, 15_000, 10_000], 'l’échéance borne l’attente totale')
  assert.equal(JSON.parse(fs.boite.contenu).pid, 1234)
})

test('#2187 — sousEcheanceAsync : rejoue l’essai sous l’échéance au sommeil attendu, annonce chaque refus, rend le dernier essai', async () => {
  const temps = tempsFactice()
  const annonces = []
  const essais = [{ etat: 'tenu', tenant: { pid: 7 } }, { etat: 'tenu', tenant: { pid: 7 } }, { etat: 'pris' }]
  const vu = await sousEcheanceAsync({
    attente: { echeanceMs: 60_000, pasMs: 15_000, annoncer: (tenant) => annonces.push(tenant.pid) },
    horloge: temps.horloge, essai: () => essais.shift(), abouti: (e) => e.etat === 'pris',
    dormir: async (ms) => temps.dormir(ms),
  })
  assert.deepEqual(vu, { etat: 'pris' })
  assert.deepEqual(annonces, [7, 7])
  assert.deepEqual(temps.sommeils, [15_000, 15_000])
  const echu = await sousEcheanceAsync({
    attente: { echeanceMs: 40_000, pasMs: 15_000 }, horloge: temps.horloge, essai: () => ({ etat: 'tenu' }),
    abouti: (e) => e.etat === 'pris', dormir: async (ms) => temps.dormir(ms),
  })
  assert.deepEqual(echu, { etat: 'tenu' })
  assert.deepEqual(temps.sommeils.slice(2), [15_000, 15_000, 10_000], 'l’échéance borne l’attente totale')
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

// ── génération, libération comparée, identité (#2603) ─────────────────────────────────────────

const REPRISE = `${VERROU}.reprise`

/** Le texte d'un verrou tenu par `pid`, à la génération `generation`. */
const tenu = (pid, generation, autres = {}) => JSON.stringify({ pid, generation, ...autres })

test('#2603 — libération COMPARÉE : `liberer` retire le verrou de SA génération, jamais celui d’un repreneur', () => {
  const fs = fsFactice()
  const pris = prendreVerrou({ chemin: VERROU, libelle: LIBELLE, identite: INDETERMINEE, pid: 4242, fs, estVivant: () => true })
  assert.equal(pris.etat, 'pris')
  const repris = tenu(7, 'generation-du-repreneur')
  fs.fichiers.set(VERROU, repris)
  pris.liberer()
  assert.equal(fs.boite.contenu, repris, 'le verrou du repreneur reste en place')
  assert.deepEqual([...fs.fichiers.keys()], [VERROU], 'ni temporaire ni verrou de reprise restant')

  const fs2 = fsFactice()
  const tenant = prendreVerrou({ chemin: VERROU, libelle: LIBELLE, identite: INDETERMINEE, pid: 4242, fs: fs2, estVivant: () => true })
  tenant.liberer()
  assert.equal(fs2.boite.contenu, null, 'sa propre génération est retirée')
})

test('#2603 — libération sous le verrou de REPRISE : rejouée tant qu’un vivant le tient, puis faite ; tenu sans fin, elle LÈVE', () => {
  const fs = fsFactice()
  const temps = tempsFactice()
  const pris = prendreVerrou({ chemin: VERROU, libelle: LIBELLE, identite: INDETERMINEE, pid: 4242, fs, estVivant: () => true, dormir: temps.dormir })
  fs.fichiers.set(REPRISE, tenu(7, 'reprise-en-cours'))
  const linkSync = fs.linkSync
  let essais = 0
  fs.linkSync = (source, cible) => {
    if (cible === REPRISE && ++essais === 3) fs.fichiers.delete(REPRISE)
    return linkSync(source, cible)
  }
  pris.liberer()
  assert.equal(essais, 3, 'deux essais refusés, le troisième prend la reprise')
  assert.deepEqual(temps.sommeils, [25, 25], 'chaque rejeu dort par le `dormir` de la prise')
  assert.equal(fs.boite.contenu, null)
  assert.deepEqual([...fs.fichiers.keys()], [])

  const bloque = fsFactice()
  const tenant = prendreVerrou({ chemin: VERROU, libelle: LIBELLE, identite: INDETERMINEE, pid: 4242, fs: bloque, estVivant: () => true })
  bloque.fichiers.set(REPRISE, tenu(7, 'reprise-sans-fin'))
  assert.throws(() => tenant.liberer(), /non libéré, le verrou de reprise .* reste tenu par un vivant/)
  assert.notEqual(bloque.boite.contenu, null, 'le verrou reste à son tenant')
})

test('#2603 — `liberer` PROPAGE une erreur autre qu’ENOENT ; un verrou déjà absent ne lève rien', () => {
  const fs = fsFactice()
  const pris = prendreVerrou({ chemin: VERROU, libelle: LIBELLE, identite: INDETERMINEE, pid: 4242, fs, estVivant: () => true })
  const readFileSync = fs.readFileSync
  fs.readFileSync = (chemin, ...reste) => {
    if (chemin !== VERROU) return readFileSync(chemin, ...reste)
    const e = new Error(`EACCES: ${chemin}`)
    e.code = 'EACCES'
    throw e
  }
  assert.throws(() => pris.liberer(), { code: 'EACCES' })
  fs.readFileSync = readFileSync
  fs.fichiers.delete(VERROU)
  pris.liberer()
  assert.deepEqual([...fs.fichiers.keys()], [])
})

test('#2603 — `liberer` d’un verrou dont le DOSSIER a disparu : ENOENT à l’écriture du temporaire vaut verrou absent, rien ne lève', () => {
  const fs = fsFactice()
  const pris = prendreVerrou({ chemin: VERROU, libelle: LIBELLE, identite: INDETERMINEE, pid: 4242, fs, estVivant: () => true })
  fs.fichiers.clear()
  const refuser = (code) => (chemin) => {
    const e = new Error(`${code}: ${chemin}`)
    e.code = code
    throw e
  }
  fs.writeFileSync = refuser('ENOENT')
  pris.liberer()
  assert.deepEqual([...fs.fichiers.keys()], [])
  fs.writeFileSync = refuser('EACCES')
  assert.throws(() => pris.liberer(), { code: 'EACCES' })
})

test('#2603 — `liberer` face à un verrou de REPRISE tenu par un MORT : il est retiré, le verrou libéré, rien ne lève', () => {
  const fs = fsFactice()
  const temps = tempsFactice()
  const pris = prendreVerrou({ chemin: VERROU, libelle: LIBELLE, identite: INDETERMINEE, pid: 4242, fs, estVivant: (pid) => pid !== 7, dormir: temps.dormir })
  fs.fichiers.set(REPRISE, tenu(7, 'reprise-morte'))
  pris.liberer()
  assert.equal(fs.boite.contenu, null)
  assert.deepEqual([...fs.fichiers.keys()], [], 'reprise morte retirée, ni temporaire ni verrou restant')
  assert.deepEqual(temps.sommeils, [25], 'un pas, puis la reprise prise')
})

test('#2603 — TOCTOU de la reprise : un verrou de reprise MORT remplacé entre sa lecture et son retrait n’est pas retiré', () => {
  const vivantNeuf = tenu(1, 'reprise-vivante')
  const espion = {
    apresLectureDe: (chemin) => {
      if (chemin !== REPRISE) return
      espion.apresLectureDe = null
      fs.fichiers.set(REPRISE, vivantNeuf)
    },
  }
  const fs = fsFactice(tenu(999, 'mort'), espion)
  fs.fichiers.set(REPRISE, tenu(998, 'reprise-morte'))
  const vu = prendreVerrou({ chemin: VERROU, libelle: LIBELLE, identite: INDETERMINEE, pid: 2, fs, estVivant: (p) => p < 998 })
  assert.equal(vu.etat, 'refus', 'la reprise vivante bloque la reprise du mort')
  assert.equal(fs.fichiers.get(REPRISE), vivantNeuf, 'la reprise du vivant reste en place')
})

/** Une identité feinte : `lireCreation` rend `mesures[pid]` (absent : `null`), et compte ses lectures. */
function identiteFeinte(mesures, { toleranceMs = 0, pasMs = 10_000 } = {}) {
  const lectures = []
  return {
    lectures,
    identite: { toleranceMs, pasMs, lireCreation: (pid) => { lectures.push(pid); return mesures[pid] ?? null } },
  }
}

test('#2603 — identité : la prise écrit `creation` = `performance.timeOrigin` au PID courant, la mesure de l’`identite` à un PID tiers, rien d’indéterminé', () => {
  const fs = fsFactice()
  const { identite, lectures } = identiteFeinte({ 4242: 7_000 })
  const pris = prendreVerrou({ chemin: VERROU, libelle: LIBELLE, fs, estVivant: () => true, identite })
  assert.equal(pris.etat, 'pris')
  assert.equal(JSON.parse(fs.boite.contenu).creation, performance.timeOrigin)
  assert.equal(JSON.parse(fs.boite.contenu).pid, process.pid)
  assert.deepEqual(lectures, [], 'le PID courant ne se mesure pas')
  const tiers = fsFactice()
  assert.equal(prendreVerrou({ chemin: VERROU, libelle: LIBELLE, pid: 4242, fs: tiers, estVivant: () => true, identite }).etat, 'pris')
  assert.equal(JSON.parse(tiers.boite.contenu).creation, 7_000)
  assert.deepEqual(lectures, [4242])
  const indetermine = fsFactice()
  assert.equal(prendreVerrou({ chemin: VERROU, libelle: LIBELLE, pid: 4343, fs: indetermine, estVivant: () => true, identite }).etat, 'pris')
  assert.equal(Object.hasOwn(JSON.parse(indetermine.boite.contenu), 'creation'), false)
})

test('#2493 #2603 — `borneMs` et `orphelins` : le juge `consignant`, sous l’identité ; réutilisé = `PID mort`, trop vieux = `âge > borne`, consignés et repris', () => {
  const horloge = () => Date.parse('2026-10-17T12:00:00.000Z')
  const { identite } = identiteFeinte({ 1234: 5_000 })
  const cas = [
    [tenu(1234, 'g', { creation: 1_000, date: '2026-10-17T11:59:59.000Z' }), 'pris', 'PID mort'],
    [tenu(1234, 'g', { creation: 5_000, date: '2026-10-17T11:00:00.000Z' }), 'pris', 'âge > borne'],
    [tenu(1234, 'g', { creation: 5_000, date: '2026-10-17T11:59:59.000Z' }), 'refus', null],
  ]
  for (const [texte, attendu, preuve] of cas) {
    const orphelins = new Map()
    const vu = prendreVerrou({ chemin: VERROU, libelle: LIBELLE, fs: fsFactice(texte), estVivant: () => true, identite, horloge, borneMs: 60_000, orphelins })
    assert.equal(vu.etat, attendu, texte)
    assert.deepEqual([...orphelins.values()].map((o) => [o.verrou, o.pid, o.preuve]), preuve ? [[VERROU, 1234, preuve]] : [], texte)
  }
  const sansBorne = new Map()
  const ancien = tenu(1234, 'g', { creation: 5_000, date: '2026-10-17T00:00:00.000Z' })
  assert.equal(prendreVerrou({ chemin: VERROU, libelle: LIBELLE, fs: fsFactice(ancien), estVivant: () => true, identite, horloge, orphelins: sansBorne }).etat, 'refus')
  assert.equal(sansBorne.size, 0, 'sans `borneMs`, l’âge ne retire personne')
})

test('#2603 — juge PAR DÉFAUT (`IDENTITE_MESUREE`), sur le disque : PID réutilisé (création mesurée postérieure à la naissance) = mort ; même naissance = vivant', () => {
  const racine = fsReel.mkdtempSync(path.join(os.tmpdir(), 'verrou-identite-'))
  try {
    const chemin = path.join(racine, 'banc.verrou')
    const poser = (creation) => fsReel.writeFileSync(chemin, JSON.stringify({ pid: process.pid, generation: 'g', creation }))
    poser(performance.timeOrigin)
    assert.equal(attendreLibre({ chemin }).etat, 'occupe', 'même naissance : vivant')
    assert.equal(prendreVerrou({ chemin, libelle: LIBELLE }).etat, 'refus')
    poser(performance.timeOrigin - 3_600_000)
    assert.equal(attendreLibre({ chemin }).etat, 'libre', 'né une heure avant ce processus : PID réutilisé')
    const repris = prendreVerrou({ chemin, libelle: LIBELLE })
    assert.equal(repris.etat, 'pris')
    repris.liberer()
  } finally {
    fsReel.rmSync(racine, { recursive: true, force: true })
  }
})

test('#2603 — attendreLibre juge sous l’identité : PID réutilisé = libre, même création = occupé, sans `creation` = son existence seule', () => {
  for (const [texte, mesure, attendu] of [
    [tenu(1234, 'g', { creation: 1_000 }), 5_000, 'libre'],
    [tenu(1234, 'g', { creation: 1_000 }), 1_000, 'occupe'],
    [tenu(1234, 'g'), 5_000, 'occupe'],
  ]) {
    const { identite } = identiteFeinte({ 1234: mesure })
    assert.equal(attendreLibre({ chemin: VERROU, fs: fsFactice(texte), estVivant: () => true, identite }).etat, attendu, `${texte} mesuré ${mesure}`)
  }
})

test('#2603 — identité : PID RÉUTILISÉ (création mesurée postérieure) = mort, repris ; même création = vivant ; indéterminée = vivant', () => {
  const ancien = tenu(1234, 'g', { creation: 1_000 })
  for (const [mesure, attendu] of [[5_000, 'pris'], [1_000, 'refus'], [999, 'refus'], [null, 'refus']]) {
    const fs = fsFactice(ancien)
    const { identite, lectures } = identiteFeinte({ 1234: mesure })
    const vu = prendreVerrou({ chemin: VERROU, libelle: LIBELLE, fs, estVivant: () => true, identite })
    assert.equal(vu.etat, attendu, `création mesurée ${mesure}`)
    assert.deepEqual(lectures, [1234])
  }
  const tolere = identiteFeinte({ 1234: 2_400 }, { toleranceMs: 1_500 })
  assert.equal(prendreVerrou({ chemin: VERROU, libelle: LIBELLE, fs: fsFactice(ancien), estVivant: () => true, identite: tolere.identite }).etat, 'refus', 'dans la tolérance')
})

test('#2603 — identité : un tenant pris sans identité (sans `creation`) est jugé sur son existence seule (`NAISSANCE_ABSENTE`), sans lecture', () => {
  for (const [vivant, attendu] of [[true, 'refus'], [false, 'pris']]) {
    const { identite, lectures } = identiteFeinte({ 1234: 9_999_999 })
    const vu = prendreVerrou({ chemin: VERROU, libelle: LIBELLE, fs: fsFactice(tenu(1234, 'g')), estVivant: () => vivant, identite })
    assert.equal(vu.etat, attendu, `kill(pid, 0) ${vivant}`)
    assert.deepEqual(lectures, [])
  }
})

test('#2603 — identité : aucune lecture de création d’un PID mort au sens de kill(pid, 0)', () => {
  const { identite, lectures } = identiteFeinte({ 1234: 1_000 })
  const vu = prendreVerrou({ chemin: VERROU, libelle: LIBELLE, fs: fsFactice(tenu(1234, 'g', { creation: 1_000 })), estVivant: () => false, identite })
  assert.equal(vu.etat, 'pris')
  assert.deepEqual(lectures, [])
})

test('#2603 — identité : création lue une fois par texte de verrou distinct, puis tous les `pasMs` de l’identité', () => {
  const fs = fsFactice(tenu(1234, 'g', { creation: 1_000 }))
  const temps = tempsFactice({ 6: () => fs.fichiers.set(VERROU, tenu(1234, 'h', { creation: 1_000 })) })
  const { identite, lectures } = identiteFeinte({ 1234: 1_000 }, { pasMs: 10_000 })
  const vu = prendreVerrou({
    chemin: VERROU, libelle: LIBELLE, fs, estVivant: () => true, identite,
    attente: { echeanceMs: 40_000, pasMs: 5_000 }, dormir: temps.dormir, horloge: temps.horloge,
  })
  assert.equal(vu.etat, 'refus')
  assert.deepEqual(temps.sommeils, Array(8).fill(5_000))
  assert.equal(lectures.length, 5, 't = 0, 10, 20 s (premier texte) ; 30 s (texte neuf) ; 40 s')
})

test('#2603 — échéance PAR TENANT : elle repart de zéro quand la génération du tenant change', () => {
  const attente = { echeanceMs: 30_000, pasMs: 10_000, parTenant: true }
  const fixe = fsFactice(tenu(1234, 'g1'))
  const sansRelais = tempsFactice()
  prendreVerrou({ chemin: VERROU, libelle: LIBELLE, fs: fixe, estVivant: () => true, attente, dormir: sansRelais.dormir, horloge: sansRelais.horloge })
  assert.deepEqual(sansRelais.sommeils, [10_000, 10_000, 10_000])

  const fs = fsFactice(tenu(1234, 'g1'))
  const relais = tempsFactice({ 2: () => fs.fichiers.set(VERROU, tenu(5678, 'g2')) })
  const vu = prendreVerrou({ chemin: VERROU, libelle: LIBELLE, fs, estVivant: () => true, attente, dormir: relais.dormir, horloge: relais.horloge })
  assert.equal(vu.etat, 'refus')
  assert.equal(vu.tenant.pid, 5678)
  assert.deepEqual(relais.sommeils, [10_000, 10_000, 10_000, 10_000, 10_000], '20 s au premier tenant, puis 30 s au second')
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
  const verrou = prendreVerrou({ chemin, libelle: 'compteur', identite: { lireCreation: () => null, toleranceMs: 0 } })
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

// #2516
test('verrou dont le tenant porte un pid hors de l’int32 : repris comme mort, sans exception', () => {
  const fs = fsFactice(JSON.stringify({ pid: 2 ** 31, commande: 'tenant forgé' }))
  const pris = prendreVerrou({ chemin: VERROU, libelle: LIBELLE, identite: INDETERMINEE, pid: 4242, fs })
  assert.equal(pris.etat, 'pris')
  assert.equal(JSON.parse(fs.boite.contenu).pid, 4242)
})

test('emprunt : fragment explicite retransmis parent/enfant/petit-enfant, empreinte seule et libération sans retrait owner', () => {
  const fs = fsFactice()
  const options = { chemin: VERROU, libelle: LIBELLE, fs, estVivant: () => true, identite: identiteFeinte({}).identite }
  const avant = { ...process.env }
  const owner = prendreVerrou(options)
  const secret = JSON.parse(Object.values(owner.env)[0]).secret
  assert.ok(!fs.boite.contenu.includes(secret))
  const enfant = prendreVerrou({ ...options, env: owner.env })
  const petit = prendreVerrou({ ...options, env: enfant.env })
  assert.equal(enfant.emprunte, true)
  assert.deepEqual(petit.env, owner.env)
  enfant.liberer()
  petit.liberer()
  assert.ok(fs.boite.contenu)
  assert.ok(Object.keys(process.env).length === Object.keys(avant).length && Object.entries(avant).every(([cle, valeur]) => process.env[cle] === valeur))
  owner.liberer()
  assert.equal(fs.boite.contenu, null)
})

test('emprunt : faux secret, instance, génération, JSON et doublon refusent sans attente ni repli, en NOMMANT la raison', () => {
  const fs = fsFactice()
  const options = { chemin: VERROU, libelle: LIBELLE, fs, estVivant: () => true, identite: identiteFeinte({}).identite }
  const owner = prendreVerrou(options)
  const [cle, texte] = Object.entries(owner.env)[0]
  for (const [alteration, raison] of [[{ secret: 'faux' }, 'SECRET'], [{ instance: 'autre' }, 'INSTANCE'], [{ generation: 'autre' }, 'GENERATION']]) {
    const env = { [cle]: JSON.stringify({ ...JSON.parse(texte), ...alteration }) }
    const refuse = prendreVerrou({ ...options, env, attente: { echeanceMs: 1000, pasMs: 1 }, dormir: () => assert.fail('ne doit pas attendre') })
    assert.equal(refuse.etat, 'refus')
    assert.equal(refuse.message, `[verrou] ${LIBELLE} : jeton d'emprunt invalide (${raison})`)
    assert.ok(!refuse.message.includes(JSON.parse(texte).secret))
  }
  const illisible = prendreVerrou({ ...options, env: { [cle]: '{' } })
  assert.deepEqual([illisible.etat, illisible.message, illisible.cause instanceof SyntaxError], ['refus', `[verrou] ${LIBELLE} : jeton d'emprunt invalide (JSON)`, true])
  assert.equal(prendreVerrou({ ...options, env: { [cle]: texte, [cle.toLowerCase()]: texte } }).message, `[verrou] ${LIBELLE} : jeton d'emprunt invalide (DOUBLON)`)
  owner.liberer()
})

test('jetonsDuVerrou : les jetons du SEUL verrou nommé, clé comparée sans casse', () => {
  const fs = fsFactice()
  const owner = prendreVerrou({ chemin: VERROU, libelle: LIBELLE, fs, estVivant: () => true, identite: identiteFeinte({}).identite })
  const [cle, texte] = Object.entries(owner.env)[0]
  const autre = Object.keys(prendreVerrou({ chemin: `${VERROU}.autre`, libelle: LIBELLE, fs, estVivant: () => true }).env)[0]
  assert.deepEqual(jetonsDuVerrou({ [cle.toLowerCase()]: texte, [autre]: 'x', HORS_VERROU: 'p' }, VERROU), [[cle.toLowerCase(), texte]])
  assert.deepEqual(jetonsDuVerrou({ HORS_VERROU: 'p' }, VERROU), [])
  owner.liberer()
})

test('verdictDuJeton : chaque raison nommée, `cause` pour le JSON illisible', () => {
  const instance = 'instance-du-banc'
  const valide = { version: 1, instance, generation: 'g', secret: 's' }
  const tenant = { pid: 1, generation: 'g', empreinte: createHash('sha256').update('s').digest('hex') }
  const verdict = (jeton, p = {}) => verdictDuJeton(Array.isArray(jeton) ? jeton : [['CLE', typeof jeton === 'string' ? jeton : JSON.stringify(jeton)]], { instance, tenant, vivant: () => true, ...p })
  assert.deepEqual(verdict(valide), { ok: true })
  assert.deepEqual(verdict([['A', JSON.stringify(valide)], ['a', JSON.stringify(valide)]]), { raison: 'DOUBLON' })
  assert.deepEqual(verdict([]), { raison: 'DOUBLON' })
  const json = verdict('{')
  assert.deepEqual([json.raison, json.cause instanceof SyntaxError], ['JSON', true])
  for (const jeton of [null, 5, '[]', { ...valide, autre: 1 }, { version: 1, instance, generation: 'g' }]) assert.deepEqual(verdict(jeton), { raison: 'CLES' }, JSON.stringify(jeton))
  assert.deepEqual(verdict({ ...valide, version: 2 }), { raison: 'VERSION' })
  assert.deepEqual(verdict({ ...valide, instance: 'autre' }), { raison: 'INSTANCE' })
  assert.deepEqual(verdict({ ...valide, generation: 'autre' }), { raison: 'GENERATION' })
  assert.deepEqual(verdict(valide, { tenant: null }), { raison: 'GENERATION' })
  assert.deepEqual(verdict({ ...valide, secret: 'faux' }), { raison: 'SECRET' })
  assert.deepEqual(verdict({ ...valide, secret: 5 }), { raison: 'SECRET' })
  assert.deepEqual(verdict(valide, { vivant: () => false }), { raison: 'MORT' })
})

test('emprunt : propriétaire mort ou PID réutilisé refusé, identité indéterminée conservée', () => {
  const fs = fsFactice()
  const identite = { lireCreation: () => null, toleranceMs: 0, pasMs: 1 }
  const options = { chemin: VERROU, libelle: LIBELLE, fs, identite, estVivant: () => true }
  const owner = prendreVerrou(options)
  assert.equal(prendreVerrou({ ...options, env: owner.env }).emprunte, true)
  const mort = `[verrou] ${LIBELLE} : jeton d'emprunt invalide (MORT)`
  assert.equal(prendreVerrou({ ...options, env: owner.env, estVivant: () => false }).message, mort)
  assert.equal(prendreVerrou({ ...options, env: owner.env, identite: { ...identite, lireCreation: () => performance.timeOrigin + 1000 } }).message, mort)
  owner.liberer()
})

test('annulation async pendant attente ou retour de prise : aucun tenant acquis restant', async () => {
  const fs = fsFactice()
  const options = { chemin: VERROU, libelle: LIBELLE, fs, estVivant: () => true, identite: identiteFeinte({}).identite }
  const owner = prendreVerrou(options)
  const attente = new AbortController()
  const annulee = await prendreVerrouAsync({ ...options, signal: attente.signal, attente: { echeanceMs: 1000, pasMs: 1 },
    dormir: async () => { attente.abort() } })
  assert.equal(annulee.etat, 'refus')
  assert.match(annulee.message, /annulée/)
  assert.ok(fs.boite.contenu)
  owner.liberer()
  const retour = new AbortController()
  const prise = prendreVerrouAsync({ ...options, signal: retour.signal })
  retour.abort()
  assert.equal((await prise).etat, 'refus')
  assert.equal(fs.boite.contenu, null)
})

test('#2586 — l’attente async se réveille à la libération du verrou dans le processus, pas au pas suivant', async () => {
  const fs = fsFactice()
  const options = { chemin: VERROU, libelle: LIBELLE, fs, estVivant: () => true, identite: INDETERMINEE }
  const tenant = prendreVerrou(options)
  let liberation
  setTimeout(() => { liberation = performance.now(); tenant.liberer() }, 200)
  const prise = await prendreVerrouAsync({ ...options, attente: { echeanceMs: 60_000, pasMs: 10_000 } })
  const retard = performance.now() - liberation
  assert.equal(prise.etat, 'pris')
  assert.ok(retard < 100, `réveil ${retard.toFixed(0)} ms après la libération`)
  prise.liberer()
})
