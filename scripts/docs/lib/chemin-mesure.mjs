// Décision « ce chemin lu est-il sous la racine MESURÉE ? » (#1721) — module partagé par les
// deux volets de l'enregistreur de lectures (thread principal `enregistreur-lectures.mjs`, thread des
// hooks `enregistreur-hooks.mjs`).
//
// NTFS est INSENSIBLE À LA CASSE : `c:\…` et `C:\…`, ou un segment dont la casse diffère de celle de
// la racine, désignent le même fichier. Une comparaison d'octets (`abs.startsWith(base + sep)`)
// rejette ces lectures-là, et `docs/.sources-lues.json` perd des sources sans que rien ne le dise.
//
// Décision « ce chemin sous la racine entre-t-il dans la mesure ? » (#1769) — même feuille : la mesure
// est celle du plan GIT. Ce que git IGNORE (un `__pycache__` posé par un script Python, `node_modules`)
// n'est ni un fichier lu, ni un dossier listé, ni une entrée de listing : un clone propre ne l'a pas.
import fs from 'node:fs'
import path from 'node:path'
import { cheminAbsent, correspondGlob, listerDossier } from '../../guards/lib/lister.mjs'
import { CACHE_FRAICHEUR } from './cache-fraicheur.mjs'

/** Ancêtre EXISTANT le plus proche d'un chemin absolu (lui-même s'il existe), ou `null` quand rien
 *  n'existe jusqu'à la racine (lecteur absent). */
export function ancetreExistant(abs, { strict = false } = {}) {
  let ancetre = abs
  while (true) {
    if (strict) {
      try { fs.statSync(ancetre); return ancetre }
      catch (e) {
        if (!cheminAbsent(e)) throw new Error(`ancêtre illisible : ${ancetre} — ${e.code ?? e.message}`, { cause: e })
      }
    } else if (fs.existsSync(ancetre)) return ancetre
    const parent = path.dirname(ancetre)
    if (parent === ancetre) return null
    ancetre = parent
  }
}

/**
 * Forme CANONIQUE d'un chemin : `fs.realpathSync.native` rend la casse telle que le disque la porte
 * et suit jonctions et noms courts 8.3. Un chemin ABSENT du disque (le fichier d'un Write de
 * création) se canonise par son ancêtre EXISTANT le plus proche, le reste recollé tel quel : la
 * jonction traversée en amont est suivie quand même (#1973). Sans `strict`, une lecture illisible
 * garde la forme lexicale ; avec `strict`, seul un ancêtre `cheminAbsent` permet la remontée.
 *
 * DIRECTION de ce que suivre une jonction change : un fichier lu SOUS la racine par une jonction qui
 * pointe HORS d'elle devient un chemin hors racine — il est compté REJETÉ, pas retenu (mesuré sur une
 * jonction réelle). L'inverse tient aussi : la racine étant canonisée, un chemin atteint par une
 * jonction qui pointe DANS la racine y rentre.
 */
export function canoniser(chemin, { strict = false } = {}) {
  const abs = path.resolve(chemin)
  let ancetre = ancetreExistant(abs, { strict })
  while (ancetre !== null) {
    try { return path.join(fs.realpathSync.native(ancetre), path.relative(ancetre, abs)) }
    catch (e) {
      if (!strict) return abs
      if (!cheminAbsent(e)) throw new Error(`canonisation physique illisible : ${ancetre} — ${e.code ?? e.message}`, { cause: e })
      const parent = path.dirname(ancetre)
      if (parent === ancetre) return abs
      ancetre = ancetreExistant(parent, { strict })
    }
  }
  return abs
}

/**
 * `canoniser` (non strict) MÉMORISÉ PAR DOSSIER (#2603) : le dossier parent se canonise une fois, la
 * feuille se cherche dans les noms mémorisés de ce dossier. Une feuille absente sous son nom exact,
 * ou qui est un lien (jonction comprise), repasse par `canoniser`. `lien` est le verdict « lien »
 * d'un `lstatSync` que l'appelant vient de faire sur la feuille (échec compris) : il remplace le
 * sien. Une mémoire vit le temps d'UNE vue ou d'UNE mesure : le disque qu'elle a lu ne s'y relit plus.
 */
export function canoniseurParDossier() {
  const dossiers = new Map()
  const noms = new Map()
  const dossierCanonique = (dossier) => {
    let canonique = dossiers.get(dossier)
    if (canonique === undefined) dossiers.set(dossier, (canonique = canoniser(dossier)))
    return canonique
  }
  const nomsDe = (dossier) => {
    let presents = noms.get(dossier)
    if (presents === undefined) {
      try { presents = new Set(listerDossier(dossier)) } catch { presents = new Set() }
      noms.set(dossier, presents)
    }
    return presents
  }
  const estLien = (abs) => { try { return fs.lstatSync(abs).isSymbolicLink() } catch { return true } }
  const canoniques = new Map()
  const canoniserFeuille = (abs, lien) => {
    const dossier = path.dirname(abs)
    const feuille = path.basename(abs)
    if (dossier === abs || !nomsDe(dossier).has(feuille) || (lien ?? estLien(abs))) return canoniser(abs)
    return path.join(dossierCanonique(dossier), feuille)
  }
  return (chemin, lien) => {
    const abs = path.resolve(chemin)
    let canonique = canoniques.get(abs)
    if (canonique === undefined) canoniques.set(abs, (canonique = canoniserFeuille(abs, lien)))
    return canonique
  }
}

/**
 * Chemin RELATIF POSIX du chemin lu sous la racine, `''` pour la racine elle-même, ou `null` quand
 * il est HORS racine (le seul cas qui compte comme rejet). La racine est attendue déjà canonique
 * (`canoniser` une fois à l'installation) : les deux formes se comparent alors sur la même base.
 * `canoniserChemin` s'injecte pour qu'un appelant qui mesure des milliers de lectures mémorise la
 * canonisation (un `realpathSync.native` est un appel système).
 */
export function relatifSousRacine(racineCanonique, chemin, canoniserChemin = canoniser) {
  const rel = path.relative(racineCanonique, canoniserChemin(chemin))
  if (rel === '..' || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel)) return null
  return rel.split(path.sep).join('/')
}

export const EXCLUSIONS_FIXES = ['.git', 'node_modules', path.posix.dirname(CACHE_FRAICHEUR)].sort()

/** #2475 / #2477 */
export function dansLaMesure(rel, ignores, derivees = new Set(), motifsDeclares = []) {
  if (EXCLUSIONS_FIXES.some((p) => rel === p || rel.startsWith(`${p}/`))) return false
  if (motifsDeclares.some((motif) => correspondGlob(rel, motif))) return true
  if (derivees.has(rel)) return true
  const prefixe = `${rel}/`
  for (const p of derivees) if (p.startsWith(prefixe)) return true
  for (let fin = rel.length; fin > 0; fin = rel.lastIndexOf('/', fin - 1)) if (ignores.has(rel.slice(0, fin))) return false
  return true
}

export function projeterListingMesure(rel, snapshot, ignores, derivees = new Set(), propres = [], motifsDeclares = []) {
  if (!snapshot || !['directory', 'absent', 'other'].includes(snapshot.nature) || !Array.isArray(snapshot.entrees)) throw new Error('listing sans photographie typée')
  return { nature: snapshot.nature, entrees: snapshot.entrees.filter((e) => {
    const chemin = rel ? `${rel}/${e.nom}` : e.nom
    return dansLaMesure(chemin, ignores, derivees, motifsDeclares) && !(e.nature === 'file' && propres.some((motif) => correspondGlob(chemin, motif)))
  }) }
}

export const CONTRATS_DE_DERIVATION = [{ fonction: ancetreExistant, lectures: 'corpus', retour: 'corpus' }, { fonction: canoniser, lectures: 'corpus', retour: 'corpus' }]
