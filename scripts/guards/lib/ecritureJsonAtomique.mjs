// ÉCRITURE JSON ATOMIQUE : une valeur JSON écrite dans un temporaire unique exclusif, puis renommée sur sa
// cible. Un lecteur concurrent lit l'ancien texte ou le nouveau, jamais un fichier à moitié écrit.
import { mkdirSync, writeFileSync, rmSync, openSync, closeSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { dirname } from 'node:path'
import { renommerResilient } from './renommageResilient.mjs'

/** Écrit `valeur` en JSON indenté sous `chemin`, dossier créé, temporaire unique exclusif puis renommage (`renommerResilient`). */
export function ecrireJsonAtomique(chemin, valeur) {
  mkdirSync(dirname(chemin), { recursive: true })
  const tmp = `${chemin}.${randomUUID()}.tmp`
  let fd
  try {
    fd = openSync(tmp, 'wx')
    try { writeFileSync(fd, `${JSON.stringify(valeur, null, 2)}\n`) }
    finally { closeSync(fd) }
    renommerResilient(tmp, chemin)
  } finally { if (fd !== undefined) rmSync(tmp, { force: true }) }
}
