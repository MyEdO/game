// ÉCRITURE ATOMIQUE : un texte (ou une valeur JSON) écrit dans un temporaire unique exclusif, puis renommé sur sa
// cible. Un lecteur concurrent lit l'ancien texte ou le nouveau, jamais un fichier à moitié écrit.
import { mkdirSync, writeFileSync, rmSync, openSync, closeSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { dirname } from 'node:path'
import { renommerResilient } from './renommageResilient.mjs'

/** Écrit `texte` sous `chemin`, dossier créé, temporaire unique exclusif puis renommage (`renommerResilient`). */
export function ecrireTexteAtomique(chemin, texte) {
  mkdirSync(dirname(chemin), { recursive: true })
  const tmp = `${chemin}.${randomUUID()}.tmp`
  let fd
  try {
    fd = openSync(tmp, 'wx')
    try { writeFileSync(fd, texte) }
    finally { closeSync(fd) }
    renommerResilient(tmp, chemin)
  } finally { if (fd !== undefined) rmSync(tmp, { force: true }) }
}

/** Écrit `valeur` en JSON indenté sous `chemin` (`ecrireTexteAtomique`). */
export const ecrireJsonAtomique = (chemin, valeur) => ecrireTexteAtomique(chemin, `${JSON.stringify(valeur, null, 2)}\n`)
