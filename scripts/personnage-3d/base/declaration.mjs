// LA DÉCLARATION DU CORPS D'UNE BASE (#2972, #3106), `<declaration.json>` : `base`, `porteur`, ses bornes articulaires
// (`bornesArticulaires`, #2992), la table rôle → clip (`clips`, dont `marche`, la marche plantée et mesurée), celle des rôles tenus à deux mains (`clipsDeuxMains`, #3319), les prises que le geste de chaque clip occupe (`prisesOccupees`, #3806), les clips des packs que la construction retire
// (`clipsEcartes`, #3810, absents du manifeste) et les surfaces du corps (`surfaces`, jugées avec le manifeste, `hotes/godot/asset/surfaces.ts`), validée contre la donnée,
// lue par le module runner de Vite (`chargerAssets`, `charger.mjs`).
import { readFileSync } from 'node:fs'
import { chargerAssets } from '../../../hotes/godot/asset/charger.mjs'

/** Les lectures de la donnée qui jugent le porteur, chargées une fois par processus. */
let donnee
const chargerDonnee = () =>
  (donnee ??= chargerAssets(["export { planDeBestiaire, gabarits, taillesDeLaRace } from '/src/data/index.ts';"]))

/** La part déclarée du manifeste de base (`manifeste.mjs`) : `base`, `porteur`, `bornesArticulaires`, `clips` et,
 *  déclarées, `clipsDeuxMains`, `prisesOccupees` et `surfaces`. */
export const champsDeclares = ({ base, porteur, bornesArticulaires, clips, clipsDeuxMains, prisesOccupees, surfaces }) => ({
  base, porteur, bornesArticulaires, clips, ...(clipsDeuxMains === undefined ? {} : { clipsDeuxMains }),
  ...(prisesOccupees === undefined ? {} : { prisesOccupees }), ...(surfaces === undefined ? {} : { surfaces }),
})

/** La déclaration du corps à `chemin`, jugée par `jugerDeclaration`. */
export const lireDeclaration = (chemin, lireDonnee) => jugerDeclaration(JSON.parse(readFileSync(chemin, 'utf8')), chemin, lireDonnee)

/** `declaration`, lue à `chemin`, refusée sans clip du rôle `marche` (`clips.marche`), si `clipsEcartes` n'est pas une liste
 *  de noms de clip, en écarte un qu'un rôle joue (`clips`, une table de `clipsDeuxMains`) ou que `prisesOccupees` nomme, si l'espèce du porteur n'est pas portée par
 *  le plan de bestiaire sur la base humanoïde (#2993), si son gabarit n'existe pas dans la donnée, ou si sa Taille ou son
 *  échelle d'art diffère de celle que la donnée donne à sa race (`echelle` de l'espèce au plan). `lireDonnee` rend les
 *  lectures de la donnée (`planDeBestiaire`, `gabarits`, `taillesDeLaRace`). */
export async function jugerDeclaration(declaration, chemin, lireDonnee = chargerDonnee) {
  const { porteur, clips } = declaration
  if (typeof clips?.marche !== 'string') throw new Error(`${chemin} : clips.marche, nom de clip attendu`)
  const { clipsEcartes = [], clipsDeuxMains = {}, prisesOccupees = {} } = declaration
  if (!Array.isArray(clipsEcartes) || clipsEcartes.some((nom) => typeof nom !== 'string')) throw new Error(`${chemin} : clipsEcartes, liste de noms de clip attendue`)
  const roles = [...Object.entries(clips).map(([role, nom]) => [`clips.${role}`, nom]),
    ...Object.entries(clipsDeuxMains).flatMap(([maniement, table]) => Object.entries(table).map(([role, nom]) => [`clipsDeuxMains.${maniement}.${role}`, nom]))]
  for (const nom of clipsEcartes) {
    const joue = roles.find(([, clip]) => clip === nom)
    if (joue) throw new Error(`${chemin} : clipsEcartes ${nom}, joué par le rôle ${joue[0]}`)
    if (Object.hasOwn(prisesOccupees, nom)) throw new Error(`${chemin} : clipsEcartes ${nom}, encore nommé par prisesOccupees`)
  }
  const { planDeBestiaire, gabarits, taillesDeLaRace } = await lireDonnee()
  const espece = planDeBestiaire.find((e) => e.id === porteur?.espece)
  const race = espece?.race?.id
  if (!race) throw new Error(`${chemin} : porteur.espece ${porteur?.espece}, le plan de bestiaire ne la porte pas sur la base humanoïde`)
  if (!gabarits.some((g) => g.id === porteur.gabarit)) throw new Error(`${chemin} : porteur.gabarit ${porteur.gabarit} absent de gabarits.json`)
  const tailles = taillesDeLaRace(race)
  if (tailles.length !== 1) throw new Error(`${chemin} : porteur.taille ${porteur.taille}, Taille de la race ${race} indéterminée dans la donnée (${tailles.join(', ') || 'aucune espèce'})`)
  if (porteur.taille !== tailles[0]) throw new Error(`${chemin} : porteur.taille ${porteur.taille}, la donnée donne ${tailles[0]} à la race ${race}`)
  if (porteur.echelleDArt !== espece.echelle) throw new Error(`${chemin} : porteur.echelleDArt ${porteur.echelleDArt}, la donnée donne ${espece.echelle} à l'espèce ${porteur.espece}`)
  return declaration
}
