// Lecteur de chapitres du `Source/` sur le DISQUE : la seule entrée/sortie de la chaîne de découpe.
// Le parsing lui-même vient de `src/data/source/decoupe.ts` (source unique, pure) — ce module ne fait
// que résoudre `bookId → dossier → fichier de chapitre`, lire le texte (CRLF-robuste, `readText`) et
// mémoriser le chapitre parsé.
import { listerDossier } from '../guards/lib/lister.mjs'
import { chapterFile, livreExtraitDe, readText, sigleDe } from '../raw/_lib.mjs'
import { parseChapitre, prefixesDeChapitres } from '../../src/data/source/decoupe.ts'

const _cache = new Map()

/** Numéros de chapitre d'un livre, dans leur GRAPHIE de fichier, triés par ENTIER — l'index n'en est
 *  pas un (`prefixesDeChapitres`). @param {string} bookId @returns {string[]} */
export function chapitresDe(bookId) {
  const dir = livreExtraitDe(bookId)?.dir
  if (!dir) return []
  return prefixesDeChapitres(listerDossier(dir, { absent: 'vide' }))
}

/** Nom du fichier d'un chapitre, ou `null`. @param {string} bookId @param {string|number} ch */
export function fichierChapitre(bookId, ch) {
  const abbr = sigleDe(bookId)
  return (abbr ? chapterFile(abbr, ch) : null)?.file ?? null
}

/**
 * Chapitre PARSÉ (avec cache), ou `null` si le livre ou le fichier n'existe pas.
 * @param {string} bookId @param {string|number} ch
 * @returns {import('../../src/data/source/decoupe.ts').ChapitreParse | null}
 */
export function lireChapitre(bookId, ch) {
  const key = `${bookId}|${ch}`
  if (_cache.has(key)) return _cache.get(key)
  const abbr = sigleDe(bookId)
  const res = abbr ? chapterFile(abbr, ch) : null
  const out = res ? parseChapitre(readText(res.path)) : null
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
  return _cache.delete(`${bookId}|${ch}`)
}
