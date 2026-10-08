// ÉCRITURE JSON ATOMIQUE : une valeur JSON écrite dans un temporaire propre au processus, puis renommée sur sa
// cible. Un lecteur concurrent lit l'ancien texte ou le nouveau, jamais un fichier à moitié écrit. Écrivains :
// le journal du train (`scripts/ops/publier.mjs`), le cache de la vigie (`scripts/ops/vigie.mjs`), les mesures
// du périmètre de tests (`scripts/test/perimetre.mjs`), la plage due et le journal du synchroniseur du principal
// (`scripts/ops/synchroniser.mjs`).
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { renommerResilient } from './renommageResilient.mjs'

/** Écrit `valeur` en JSON indenté sous `chemin`, dossier créé, par `<chemin>.<pid>.tmp` puis renommage (`renommerResilient`). */
export function ecrireJsonAtomique(chemin, valeur) {
  mkdirSync(dirname(chemin), { recursive: true })
  const tmp = `${chemin}.${process.pid}.tmp`
  writeFileSync(tmp, `${JSON.stringify(valeur, null, 2)}\n`)
  renommerResilient(tmp, chemin)
}
