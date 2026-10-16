// Le verrou `prendreVerrou` / `attendreLibre` (#1679 L1c-M7, #2279 N0, #2187, #2603) : prise, refus nommé, reprise
// d'un mort, attente bornée, et un banc de CONCURRENCE réelle où des processus distincts font, verrou
// tenu, une lecture-modification-écriture d'un compteur — une exclusion qui fuit perd des incréments.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import fsReel from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { attendreLibre, prendreVerrou, sousEcheanceAsync } from './verrou.mjs'

const MODULE = pathToFileURL(path.join(import.meta.dirname, 'verrou.mjs')).href
const SOMMEIL = pathToFileURL(path.join(import.meta.dirname, '../guards/lib/spawnResilient.mjs')).href
const PROCESSUS = 8
const PRISES = 10
const VERROU = '/tmp/banc.verrou'
const LIBELLE = 'le banc tient déjà ce verrou'

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
    pid: 4242,
    commande: 'node scripts/test/run.mjs',
    cwd: '/arbres/.wt-42',
    fs,
    estVivant: () => true,
    maintenant: () => '2026-09-02T00:00:00.000Z',
  })
  assert.equal(pris.etat, 'pris')
  const { generation, ...tenant } = JSON.parse(fs.boite.contenu)
  assert.match(generation, /^[0-9a-f-]{36}$/, 'la prise porte sa génération')
  assert.deepEqual(tenant, {
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
  const pris = prendreVerrou({ chemin: VERROU, libelle: LIBELLE, pid: 4242, fs, estVivant: () => true })
  assert.equal(pris.etat, 'pris')
  const repris = tenu(7, 'generation-du-repreneur')
  fs.fichiers.set(VERROU, repris)
  pris.liberer()
  assert.equal(fs.boite.contenu, repris, 'le verrou du repreneur reste en place')
  assert.deepEqual([...fs.fichiers.keys()], [VERROU], 'ni temporaire ni verrou de reprise restant')

  const fs2 = fsFactice()
  const tenant = prendreVerrou({ chemin: VERROU, libelle: LIBELLE, pid: 4242, fs: fs2, estVivant: () => true })
  tenant.liberer()
  assert.equal(fs2.boite.contenu, null, 'sa propre génération est retirée')
})

test('#2603 — libération sous le verrou de REPRISE : rejouée tant qu’un vivant le tient, puis faite ; tenu sans fin, elle LÈVE', () => {
  const fs = fsFactice()
  const temps = tempsFactice()
  const pris = prendreVerrou({ chemin: VERROU, libelle: LIBELLE, pid: 4242, fs, estVivant: () => true, dormir: temps.dormir })
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
  const tenant = prendreVerrou({ chemin: VERROU, libelle: LIBELLE, pid: 4242, fs: bloque, estVivant: () => true })
  bloque.fichiers.set(REPRISE, tenu(7, 'reprise-sans-fin'))
  assert.throws(() => tenant.liberer(), /non libéré, le verrou de reprise .* reste tenu par un vivant/)
  assert.notEqual(bloque.boite.contenu, null, 'le verrou reste à son tenant')
})

test('#2603 — `liberer` PROPAGE une erreur autre qu’ENOENT ; un verrou déjà absent ne lève rien', () => {
  const fs = fsFactice()
  const pris = prendreVerrou({ chemin: VERROU, libelle: LIBELLE, pid: 4242, fs, estVivant: () => true })
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
  const pris = prendreVerrou({ chemin: VERROU, libelle: LIBELLE, pid: 4242, fs, estVivant: () => true })
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
  const pris = prendreVerrou({ chemin: VERROU, libelle: LIBELLE, pid: 4242, fs, estVivant: (pid) => pid !== 7, dormir: temps.dormir })
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
  const vu = prendreVerrou({ chemin: VERROU, libelle: LIBELLE, pid: 2, fs, estVivant: (p) => p < 998 })
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

test('#2603 — identité : le tenant porte `creation` = `performance.timeOrigin` du preneur', () => {
  const fs = fsFactice()
  const pris = prendreVerrou({ chemin: VERROU, libelle: LIBELLE, fs, estVivant: () => true, identite: identiteFeinte({}).identite })
  assert.equal(pris.etat, 'pris')
  assert.equal(JSON.parse(fs.boite.contenu).creation, performance.timeOrigin)
  assert.equal(JSON.parse(fs.boite.contenu).pid, process.pid)
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

test('#2603 — identité : aucune lecture de création d’un PID mort au sens de kill(pid, 0) ; refusée hors du PID courant', () => {
  const { identite, lectures } = identiteFeinte({ 1234: 1_000 })
  const vu = prendreVerrou({ chemin: VERROU, libelle: LIBELLE, fs: fsFactice(tenu(1234, 'g', { creation: 1_000 })), estVivant: () => false, identite })
  assert.equal(vu.etat, 'pris')
  assert.deepEqual(lectures, [])
  assert.throws(() => prendreVerrou({ chemin: VERROU, libelle: LIBELLE, pid: process.pid + 1, fs: fsFactice(), identite }), /l'identité ne se prend qu'au PID courant/)
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

// #2516
test('verrou dont le tenant porte un pid hors de l’int32 : repris comme mort, sans exception', () => {
  const fs = fsFactice(JSON.stringify({ pid: 2 ** 31, commande: 'tenant forgé' }))
  const pris = prendreVerrou({ chemin: VERROU, libelle: LIBELLE, pid: 4242, fs })
  assert.equal(pris.etat, 'pris')
  assert.equal(JSON.parse(fs.boite.contenu).pid, 4242)
})
