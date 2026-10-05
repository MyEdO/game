// LECTEUR NODE d'un projet de campagne LIVRÉ (`src/scenes/**/<x>-projet.json`) — sa forme SERVIE.
//
// Le disque porte la forme DÉPÔT : un nœud adressé n'y a que `descRef`. Vite matérialise son `desc`
// (`wfrp:prose-source`) ; un lecteur Node qui lit le fichier passe par ICI, qui compose le même
// `materialiser` (invariant « hors Vite = forme disque », `resoudre.mjs`). `parseProject` refuse la
// forme disque : l'appel suit donc ce lecteur, jamais un `readFileSync` nu.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { dossierDesProjetsLivres } from '../guards/lib/projetsLivres.mjs'
import { materialiser } from './resoudre.mjs'

/**
 * Document d'un projet livré, prose adressée matérialisée — l'entrée de `parseProject`.
 * @param {string} rel chemin relatif au dossier du corpus (`diligence/diligence-projet.json`), tel
 *   que `listerProjetsLivres` le rend.
 * @returns {unknown}
 */
export function lireProjetLivre(rel) {
  const fichier = path.join(dossierDesProjetsLivres(), rel)
  return materialiser(JSON.parse(readFileSync(fichier, 'utf8'))).racine
}
