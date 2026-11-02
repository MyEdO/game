// Lecteur de chapitres du `Source/` sur le DISQUE : la seule entrée/sortie de la chaîne de découpe.
// Le parsing lui-même vient de `src/data/source/decoupe.ts` (source unique, pure) — ce module ne fait
// que résoudre `bookId → dossier → fichier de chapitre`, lire le texte (CRLF-robuste, `readText`) et
// mémoriser le chapitre parsé. Le `dir` d'un livre est relatif à la racine du dépôt (`books.json`) :
// listages et lectures s'y résolvent, d'où que le processus soit lancé (#3120).
import { basename, join } from 'node:path'
import { listerDossier } from '../guards/lib/lister.mjs'
import { livreExtraitDe, readText } from '../raw/_lib.mjs'
import { fichierDuChapitre, parseChapitre, prefixesDeChapitres } from '../../src/data/source/decoupe.ts'
import { cheminDuDepot } from './adresses.mjs'

const _cache = new Map()
const _chemins = new Map()

/** Les fichiers du dossier d'un livre extrait, ou `null` pour un livre sans dossier. */
function fichiersDuLivre(bookId) {
  const dir = livreExtraitDe(bookId)?.dir
  return dir ? { dir, fichiers: listerDossier(cheminDuDepot(dir), { absent: 'vide' }) } : null
}

/** Numéros de chapitre d'un livre, dans leur GRAPHIE de fichier, triés par ENTIER — l'index n'en est
 *  pas un (`prefixesDeChapitres`). @param {string} bookId @returns {string[]} */
export function chapitresDe(bookId) {
  return prefixesDeChapitres(fichiersDuLivre(bookId)?.fichiers ?? [])
}

/**
 * Chemin du fichier de chapitre d'un livre, ou `null` — l'adresse d'un `descRef` ramenée au disque.
 * RELATIF à la racine du dépôt, composé depuis le `dir` de `books.json` par `path.join`, donc au
 * SÉPARATEUR DE LA PLATEFORME : `Source/Warhammer v4 - Livre de base version corrigee/21 - Psychologie.md`
 * sous POSIX, le même chemin à l'antislash sous Windows. C'est la clé de l'index de dépendance du plugin
 * Vite et la forme qu'un `git show <rév>:<chemin>` attend ; une lecture la passe par `cheminDuDepot`.
 * @param {string} bookId @param {string|number} ch @returns {string|null}
 */
export function cheminChapitre(bookId, ch) {
  const key = `${bookId}|${ch}`
  if (!_chemins.has(key)) {
    const livre = fichiersDuLivre(bookId)
    const fichier = livre ? fichierDuChapitre(livre.fichiers, ch) : null
    _chemins.set(key, fichier ? join(livre.dir, fichier) : null)
  }
  return _chemins.get(key)
}

/** Nom du fichier d'un chapitre, ou `null`. @param {string} bookId @param {string|number} ch */
export function fichierChapitre(bookId, ch) {
  const chemin = cheminChapitre(bookId, ch)
  return chemin ? basename(chemin) : null
}

/**
 * Chapitre PARSÉ (avec cache), ou `null` si le livre ou le fichier n'existe pas.
 * @param {string} bookId @param {string|number} ch
 * @returns {import('../../src/data/source/decoupe.ts').ChapitreParse | null}
 */
export function lireChapitre(bookId, ch) {
  const key = `${bookId}|${ch}`
  if (_cache.has(key)) return _cache.get(key)
  const chemin = cheminChapitre(bookId, ch)
  const out = chemin ? parseChapitre(readText(cheminDuDepot(chemin))) : null
  _cache.set(key, out)
  return out
}

/**
 * Chapitres PARSÉS d'un livre, dans l'ordre des chapitres — la forme que `indexerLivre`
 * (`src/data/source/renvoi.ts`) indexe. @param {string} bookId
 * @returns {{ fichier: string, parse: import('../../src/data/source/decoupe.ts').ChapitreParse }[]}
 */
export const chapitresParses = (bookId) =>
  chapitresDe(bookId).map((ch) => ({ fichier: fichierChapitre(bookId, ch), parse: lireChapitre(bookId, ch) }))

/**
 * OUBLIE le chapitre mémorisé : un `Source/` réécrit sous un processus qui dure (serveur de dev)
 * doit être relu, sans quoi le lecteur resservirait l'ancien texte. @param {string} bookId
 * @param {string|number} ch @returns {boolean} `true` si un chapitre était mémorisé.
 */
export function oublierChapitre(bookId, ch) {
  _chemins.delete(`${bookId}|${ch}`)
  return _cache.delete(`${bookId}|${ch}`)
}
