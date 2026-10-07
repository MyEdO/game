// ÉCRITURE JSON ATOMIQUE : une valeur JSON écrite dans un temporaire propre au processus, puis renommée sur sa
// cible. Un lecteur concurrent lit l'ancien texte ou le nouveau, jamais un fichier à moitié écrit. Écrivains :
// le journal du train (`scripts/ops/publier.mjs`), le cache de la vigie (`scripts/ops/vigie.mjs`), les mesures
// du périmètre de tests (`scripts/test/perimetre.mjs`).
import { mkdirSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

/** Écrit `valeur` en JSON indenté sous `chemin`, dossier créé, par `<chemin>.<pid>.tmp` puis renommage. */
export function ecrireJsonAtomique(chemin, valeur) {
  mkdirSync(dirname(chemin), { recursive: true })
  const tmp = `${chemin}.${process.pid}.tmp`
  writeFileSync(tmp, `${JSON.stringify(valeur, null, 2)}\n`)
  renameSync(tmp, chemin)
}
