// LA DÉCLARATION DU CORPS D'UNE BASE (#2972, #3106), `<declaration.json>` : `base`, `porteur` et les clips de marche,
// validée contre la donnée, lue par le module runner de Vite (`chargerAssets`, `charger.mjs`).
import { readFileSync } from 'node:fs'
import { chargerAssets } from '../../../hotes/godot/asset/charger.mjs'

/** Les lectures de la donnée qui jugent le porteur, chargées une fois par processus. */
let donnee
const chargerDonnee = () =>
  (donnee ??= chargerAssets([
    "export { raceAppearance, gabarits, taillesDeLaRace } from '/src/data/index.ts';",
    "export { speciesScale } from '/src/gameIso/rig/creatures/index.ts';",
  ]))

/** La déclaration du corps à `chemin`, refusée si la race ou le gabarit du porteur n'existe pas dans la donnée, ou si
 *  sa Taille ou son échelle d'art diffère de celle que la donnée donne à sa race. */
export async function lireDeclaration(chemin) {
  const declaration = JSON.parse(readFileSync(chemin, 'utf8'))
  const { porteur, clipsDeMarche } = declaration
  if (!Array.isArray(clipsDeMarche) || !clipsDeMarche.length) throw new Error(`${chemin} : clipsDeMarche, liste non vide attendue`)
  const { raceAppearance, gabarits, taillesDeLaRace, speciesScale } = await chargerDonnee()
  if (!raceAppearance.some((r) => r.id === porteur?.race)) throw new Error(`${chemin} : porteur.race ${porteur?.race} absente de raceAppearance.json`)
  if (!gabarits.some((g) => g.id === porteur.gabarit)) throw new Error(`${chemin} : porteur.gabarit ${porteur.gabarit} absent de gabarits.json`)
  const tailles = taillesDeLaRace(porteur.race)
  if (tailles.length !== 1) throw new Error(`${chemin} : porteur.taille ${porteur.taille}, Taille de la race ${porteur.race} indéterminée dans la donnée (${tailles.join(', ') || 'aucune espèce'})`)
  if (porteur.taille !== tailles[0]) throw new Error(`${chemin} : porteur.taille ${porteur.taille}, la donnée donne ${tailles[0]} à la race ${porteur.race}`)
  const echelle = speciesScale(porteur.race)
  if (porteur.echelleDArt !== echelle) throw new Error(`${chemin} : porteur.echelleDArt ${porteur.echelleDArt}, la donnée donne ${echelle} à la race ${porteur.race}`)
  return declaration
}
