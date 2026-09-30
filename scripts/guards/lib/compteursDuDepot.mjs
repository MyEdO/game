// L'ASSEMBLAGE git de la collision des compteurs de version (#2222) : tête, tronc et point de départ lus,
// commits et fusions de la branche mesurés. Le jugement est PUR (`compteursDeVersion.mjs`).
import { BorneAbsente, GitIndisponible, lireEnLot, parentsDe, pointDeDepart, shasDe } from './gitPorte.mjs'
import { COMPTEURS, CompteurIllisible, FICHIERS_DES_COMPTEURS, collisionDuCompteur, messageDeCollision, monteeParLaBranche, valeurDuCompteur } from './compteursDeVersion.mjs'

/** Un fait git que le jugement exige et que git ne rend pas : le refus le NOMME. */
class FaitIllisible extends Error {}

/** `vu`, ou `FaitIllisible` qui nomme la `question` quand git ne l'a pas rendu. */
const exiger = (vu, question) => {
  if (vu === null) throw new FaitIllisible(`compteurs de version : ${question} illisible`)
  return vu
}

/**
 * Les REFUS des compteurs de version que `tete` publierait sur `tronc`, `[]` sans collision. Chaque
 * refus est NOMMÉ : collision (`messageDeCollision`), compteur illisible (`CompteurIllisible`), fait git
 * illisible, borne absente (`BorneAbsente`), panne de git (`GitIndisponible`).
 *
 * Préconditions : `tronc` fetché ; `tete` = la tête de la BRANCHE, dont la chaîne `--first-parent` est
 * la branche (`pointDeDepart`) — jamais un commit de file de fusion, où le tronc est premier parent : le
 * départ y est le tronc, sa montée invisible. File de fusion (#2178), commit de groupe `G` : `tete` =
 * `G^2` (tête de la PR), `tronc` = `G^1` (base du groupe), jamais `origin/main` — contre lui, deux PR
 * en vol qui montent la même valeur passent chacune.
 * Angle mort : un rebase manuel qui absorbe une montée IDENTIQUE du tronc (`git help rebase`) ne laisse
 * aucun commit qui change la valeur ; le train juge AVANT son propre rebase (étape `rebase`,
 * `scripts/ops/etapesDuTrain.mjs`).
 * Faux positifs assumés :
 * - `git merge --squash` du tronc, ou le cherry-pick de sa montée : un commit non-fusion de la branche
 *   qui change la valeur, indiscernable d'une montée propre ; fusionner le tronc.
 * - une branche qui monte puis redescend à la valeur de départ : sa montée reste dans ses commits ;
 *   réécrire son historique.
 * @param {import('./gitPorte.mjs').Depot} depot @param {{ tete: string, tronc: string }} revisions
 * @returns {string[]}
 */
export function refusDesCompteurs(depot, { tete, tronc }) {
  try {
    const depart = exiger(pointDeDepart(depot, tete, tronc), `point de départ de ${tete} dans ${tronc}`)
    const lus = new Map()
    const lire = (revision) => {
      if (!lus.has(revision)) lus.set(revision, lireEnLot(depot, revision, FICHIERS_DES_COMPTEURS))
      return lus.get(revision)
    }
    const plage = `${tronc}..${tete}`
    const fusions = exiger(shasDe(depot, [plage], { fusions: 'seules' }), `fusions de ${plage}`)
      .map((sha) => ({ sha, parents: exiger(parentsDe(depot, sha), `parents de ${sha.slice(0, 9)}`) }))
    const refus = []
    for (const compteur of COMPTEURS) {
      try {
        const valeur = (revision) => valeurDuCompteur(lire(revision).get(compteur.fichier), compteur, revision)
        const propres = exiger(shasDe(depot, [plage], { fusions: 'aucune', chemins: [compteur.fichier] }), `commits de ${plage} sur ${compteur.fichier}`)
        const montee = monteeParLaBranche({
          propres: propres.map((sha) => ({ avant: valeur(`${sha}^1`), apres: valeur(sha) })),
          fusions: fusions.map(({ sha, parents }) => ({ valeur: valeur(sha), parents: parents.map(valeur) })),
        })
        const collision = collisionDuCompteur(compteur, { publiee: valeur(tete), tronc: valeur(tronc), depart: valeur(depart), montee })
        if (collision) refus.push(messageDeCollision(collision))
      } catch (e) {
        if (!(e instanceof CompteurIllisible)) throw e
        refus.push(e.message)
      }
    }
    return refus
  } catch (e) {
    if (e instanceof FaitIllisible) return [e.message]
    if (e instanceof BorneAbsente) return [`compteurs de version non jugés : ${e.message}`]
    if (!(e instanceof GitIndisponible)) throw e
    return [`compteurs de version non jugés, git en panne : ${e.raison}`]
  }
}
