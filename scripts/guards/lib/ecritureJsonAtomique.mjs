// ÉCRITURE ATOMIQUE : un texte (ou une valeur JSON) écrit dans un temporaire unique exclusif, puis renommé sur sa
// cible. Un lecteur concurrent lit l'ancien texte ou le nouveau, jamais un fichier à moitié écrit.
import { mkdirSync, writeFileSync, readFileSync, rmSync, openSync, closeSync, linkSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { dirname } from 'node:path'
import { renommerResilient } from './renommageResilient.mjs'

/** Le code Node d'une lecture refusée par la violation de partage Windows d'un descripteur tiers (#2586). */
export const LECTURE_PARTAGEE_REFUSEE = 'EBUSY'

/**
 * Le texte publié sous `chemin`, ou `undefined` tant qu'il n'est pas lisible : absent (`ENOENT`) ou tenu par un tiers
 * (`LECTURE_PARTAGEE_REFUSEE`). Toute autre erreur LÈVE ; l'appelant rejoue sous sa propre échéance (#2586).
 * @param {string} chemin @returns {string | undefined}
 */
export function lireTextePublie(chemin) {
  try {
    return readFileSync(chemin, 'utf8')
  } catch (e) {
    if (e?.code === 'ENOENT' || e?.code === LECTURE_PARTAGEE_REFUSEE) return undefined
    throw e
  }
}

/** Écrit `texte` sous `chemin`, dossier créé, temporaire unique exclusif puis renommage (`renommerResilient`). */
export function ecrireTexteAtomique(chemin, texte, options = {}) {
  mkdirSync(dirname(chemin), { recursive: true })
  const tmp = `${chemin}.${randomUUID()}.tmp`
  let fd
  try {
    fd = openSync(tmp, 'wx')
    try { writeFileSync(fd, texte) }
    finally { closeSync(fd) }
    renommerResilient(tmp, chemin, options)
  } finally { if (fd !== undefined) rmSync(tmp, { force: true }) }
}

/** Écrit `valeur` en JSON indenté sous `chemin` (`ecrireTexteAtomique`). */
export function ecrireJsonAtomique(chemin, valeur, options = {}) {
  const { indentation = 2, ...renommage } = options
  return ecrireTexteAtomique(chemin, `${JSON.stringify(valeur, null, indentation)}\n`, renommage)
}

/**
 * Publie `valeur` en JSON sous `chemin` SEULEMENT s'il est absent : temporaire unique exclusif, puis lien dur
 * (`linkSync`), refusé en `EEXIST` sur une cible présente. REND `true` au seul gagnant, `false` sinon (#2586).
 * @param {string} chemin @param {unknown} valeur @returns {boolean}
 */
export function publierJsonSiAbsent(chemin, valeur) {
  mkdirSync(dirname(chemin), { recursive: true })
  const temporaire = `${chemin}.${randomUUID()}.tmp`
  let fd
  try {
    fd = openSync(temporaire, 'wx')
    try { writeFileSync(fd, `${JSON.stringify(valeur)}\n`) }
    finally { closeSync(fd) }
    try {
      linkSync(temporaire, chemin)
      return true
    } catch (e) {
      if (/** @type {any} */ (e)?.code === 'EEXIST') return false
      throw e
    }
  } finally { if (fd !== undefined) rmSync(temporaire, { force: true }) }
}
