// L'ASSEMBLAGE git de la collision des compteurs de version (#2222) : tête, tronc et point de départ lus,
// auteur de la ligne du compteur. Le jugement est PUR (`compteursDeVersion.mjs`) ; l'étape `rebase` du
// train (`scripts/ops/publier.mjs`) et la file de fusion (#2178) appellent `refusDesCompteurs`.
import { BorneAbsente, GitIndisponible, auteurDeLigne, estAncetre, lireEnLot, pointDeDepart } from './gitPorte.mjs'
import { COMPTEURS, CompteurIllisible, FICHIERS_DES_COMPTEURS, collisionDuCompteur, lectureDuCompteur, messageDeCollision } from './compteursDeVersion.mjs'

/** Un fait git que le jugement exige et que git ne rend pas : le refus le NOMME. */
class FaitIllisible extends Error {}

/**
 * L'auteur de la ligne `ligne` de `fichier` à `tete` est-il HORS de `tronc` ?
 * @param {import('./gitPorte.mjs').Depot} depot @returns {boolean} @throws {FaitIllisible}
 */
function ecriteParLaBranche(depot, { fichier, symbole }, tete, ligne, tronc) {
  const auteur = auteurDeLigne(depot, tete, fichier, ligne)
  if (!auteur) throw new FaitIllisible(`\`${symbole}\` : auteur de ${fichier}:${ligne} à ${tete} illisible (git blame)`)
  const vu = estAncetre(depot, auteur, tronc)
  if (!vu.disponible) throw new GitIndisponible(vu.raison)
  if (vu.absent) throw new FaitIllisible(`\`${symbole}\` : ${auteur.slice(0, 9)} ou ${tronc} introuvable`)
  return !vu.valeur
}

/**
 * Les REFUS des compteurs de version que `tete` publierait sur `tronc`, `[]` sans collision. Chaque
 * refus est NOMMÉ : collision (`messageDeCollision`), compteur illisible (`CompteurIllisible`), fait git
 * illisible, panne de git (`GitIndisponible`).
 * @param {import('./gitPorte.mjs').Depot} depot @param {{ tete: string, tronc: string }} revisions
 * @returns {string[]}
 */
export function refusDesCompteurs(depot, { tete, tronc }) {
  try {
    const depart = pointDeDepart(depot, tete, tronc)
    if (!depart) return [`compteurs de version : aucun point de départ de ${tete} dans ${tronc}`]
    const lire = (revision) => lireEnLot(depot, revision, FICHIERS_DES_COMPTEURS)
    const [aLaTete, auTronc, auDepart] = [lire(tete), lire(tronc), lire(depart)]
    const refus = []
    for (const compteur of COMPTEURS) {
      try {
        const publiee = lectureDuCompteur(aLaTete.get(compteur.fichier), compteur, tete)
        const collision = collisionDuCompteur(compteur, {
          publiee: publiee.valeur,
          tronc: lectureDuCompteur(auTronc.get(compteur.fichier), compteur, tronc).valeur,
          depart: lectureDuCompteur(auDepart.get(compteur.fichier), compteur, depart.slice(0, 9)).valeur,
          ecriteParLaBranche: ecriteParLaBranche(depot, compteur, tete, publiee.ligne, tronc),
        })
        if (collision) refus.push(messageDeCollision(collision))
      } catch (e) {
        if (!(e instanceof CompteurIllisible || e instanceof FaitIllisible)) throw e
        refus.push(e.message)
      }
    }
    return refus
  } catch (e) {
    if (e instanceof BorneAbsente) return [`compteurs de version non jugés : ${e.message}`]
    if (!(e instanceof GitIndisponible)) throw e
    return [`compteurs de version non jugés, git en panne : ${e.raison}`]
  }
}
