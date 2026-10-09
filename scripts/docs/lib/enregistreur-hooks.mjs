// Volet « thread des hooks » de l'enregistreur de lectures (#1679 L1b) — hooks de personnalisation
// de modules (`module.register`), enregistrés par `enregistreur-lectures.mjs`.
//
// RAISON MESURÉE : un générateur `runner: 'tsx'` ne lit presque rien lui-même — ses sources sont les
// modules `.ts` qu'il importe, et tsx les charge dans le THREAD DES HOOKS, où l'enveloppe de `fs`
// posée par `--import` (thread principal) ne va pas. Mesure 2026-09-02 : `gen-sorts-doc.mts` rend
// 0 source par l'enveloppe seule, alors qu'il dépend de tout `src/data`. Le hook `load` voit l'URL
// de chaque module chargé, tsx compris (tsx délègue la lecture par `nextLoad`).
//
// Ce thread lit aussi des fichiers qui ne sont PAS des modules : `tsconfig.json`, lu par
// `get-tsconfig` pour le compte de tsx. `fs` y est donc enveloppé À SON TOUR, depuis `initialize`
// (sonde 2026-09-03 sur les quatre générateurs qui chargent du TypeScript par tsx : le thread des
// hooks lit `tsconfig.json` par `readFileSync` et les modules par `openSync`, ces derniers déjà vus
// par `load` — l'enveloppe ajoute donc exactement `tsconfig.json`). Sans elle, le dérivé mesuré sous
// Windows et celui mesuré sous Linux divergent d'un chemin par générateur (CI ubuntu 33791873905).
//
// Chaque chemin retenu est APPENDU (le thread des hooks n'a pas d'événement de sortie fiable) dans
// `<sortie>.<pid>.hooks.jsonl` ; `fusionnerLectures` réunit ce fichier et ceux du thread principal.
import fs from 'node:fs'
import path from 'node:path'
import { syncBuiltinESMExports } from 'node:module'
import { fileURLToPath } from 'node:url'
import { canoniser, dansLaMesure, relatifSousRacine } from './chemin-mesure.mjs'
import { installer } from './enregistreur-lectures.mjs'
import { correspondGlob } from '../../guards/lib/lister.mjs'

let racine = null
let sortie = null
let ignores = new Set()
let cibles = new Set()
let ciblesDerivees = new Set()
let motifsPropres = []
let motifsDeclares = []
const vus = new Set()

const brut = {
  appendFileSync: fs.appendFileSync,
  lstatSync: fs.lstatSync,
}

/** `openSync` sert aussi à écrire : seul le mode lecture (`r`, `rs`, `O_RDONLY`) est une source. */
const estLecture = (drapeaux) =>
  drapeaux === undefined || drapeaux === null || drapeaux === 0 || /^rs?\+?$/.test(String(drapeaux))

export function initialize(donnees) {
  racine = canoniser(donnees.racine)
  sortie = donnees.sortie
  ignores = new Set(donnees.ignores)
  cibles = new Set(donnees.cibles ?? [])
  ciblesDerivees = new Set(donnees.ciblesDerivees ?? [])
  motifsPropres = donnees.motifsPropres ?? []
  motifsDeclares = donnees.motifsDeclares ?? []
  installer({ racine: donnees.racine, ignores, cibles: [...cibles], motifsPropres, motifsDeclares, ciblesDerivees: [...ciblesDerivees],
    observer: (mesure) => brut.appendFileSync(`${sortie}.${process.pid}.hooks-mesures.jsonl`, `${JSON.stringify(mesure)}\n`) })
  const lire = fs.readFileSync
  const ouvrir = fs.openSync
  const lireAsync = fs.promises.readFile
  fs.readFileSync = function (p, ...a) { const r = lire.call(this, p, ...a); noterChemin(p); return r }
  fs.openSync = function (p, d, ...a) { const r = ouvrir.call(this, p, d, ...a); if (estLecture(d)) noterChemin(p); return r }
  fs.promises.readFile = function (p, ...a) { return lireAsync.call(this, p, ...a).then((r) => { noterChemin(p); return r }) }
  syncBuiltinESMExports()
}

// Un module BUILTIN (`node:child_process`) ou virtuel (`data:`) n'a pas de chemin sur le disque :
// seule une URL `file:` désigne une source.
export async function resolve(specificateur, contexte, suivant) {
  const resolu = await suivant(specificateur, contexte)
  if (resolu.url.startsWith('file:')) noterChemin(new URL(resolu.url))
  return resolu
}

export async function load(url, contexte, suivant) {
  if (url.startsWith('file:')) noterChemin(new URL(url))
  return suivant(url, contexte)
}

/** Chemin (ou URL `file:`) lu par ce thread — appendu une fois, s'il est sous la racine mesurée. */
function noterChemin(cible) {
  try {
    if (!racine || !sortie) return
    const chemin =
      typeof cible === 'string' ? cible
      : Buffer.isBuffer(cible) ? cible.toString('utf8')
      : cible instanceof URL && cible.protocol === 'file:' ? fileURLToPath(cible)
      : null
    if (!chemin) return
    const rel = relatifSousRacine(racine, chemin)
    if (!rel || !dansLaMesure(rel, ignores, ciblesDerivees, motifsDeclares) || vus.has(rel)) return
    if (cibles.has(rel) || motifsPropres.some((motif) => correspondGlob(rel, motif))) {
      try { if (brut.lstatSync(path.join(racine, rel)).isFile()) return }
      catch (e) { if (['ENOENT', 'ENOTDIR'].includes(e.code)) return; throw e }
    }
    vus.add(rel)
    brut.appendFileSync(`${sortie}.${process.pid}.hooks.jsonl`, `${rel}\n`)
  } catch { /* une lecture non enregistrable ne casse jamais le générateur */ }
}
