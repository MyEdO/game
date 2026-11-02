import { prefixeDeRefus, CATEGORIES_DE_REFUS } from '../guards/lib/categorieDeRefus.mjs'
import { FICHIER_TENU } from '../guards/lib/renommageResilient.mjs'

const sommeil = (ms) => new Promise((r) => setTimeout(r, ms))

/** Le refus porté par `erreur` : catégorie lue à son préfixe, `transitoire` pour une erreur fs d'un fichier tenu
 *  (`FICHIER_TENU`), `panne` sinon ; `retentable` de cette catégorie, raison sans préfixe. Seul juge du « retentable » du
 *  cycle de session (#3150). PURE. */
export function refusSession(erreur) {
  const message = erreur instanceof Error ? erreur.message : String(erreur)
  const categorie = Object.keys(CATEGORIES_DE_REFUS).find((c) => message.startsWith(prefixeDeRefus(c))) ?? (FICHIER_TENU.has(erreur?.code) ? 'transitoire' : 'panne')
  const prefixe = prefixeDeRefus(categorie)
  return { prefixe, categorie, retentable: CATEGORIES_DE_REFUS[categorie], raison: message.startsWith(prefixe) ? message.slice(prefixe.length).trim() : message, ...(erreur?.reprise ? { reprise: erreur.reprise } : {}) }
}

/** Le délai (ms) par défaut de `fermer` avant `ACK TIMEOUT`. Valeur maison. */
export const DELAI_FERMETURE_MS = 30_000
/** La fenêtre (ms) d'une réservation (`reserveJusqua`). Valeur maison. */
export const FENETRE_RESERVATION_MS = 60_000
/** Le plafond (ms) d'attente du verrou du registre (`sousVerrou`). Valeur maison. */
export const PLAFOND_VERROU_REGISTRE_MS = 15_000

/** La borne de rejeu d'un refus retentable, par site du cycle de session (#3150) : `supervision` couvre quatre plafonds du
 *  verrou du registre. */
export const BORNES_DE_REJEU = Object.freeze({ supervision: 4 * PLAFOND_VERROU_REGISTRE_MS, arret: DELAI_FERMETURE_MS, demarrage: FENETRE_RESERVATION_MS })

/** Le résultat de `geste`, rejoué tous les `pasMs` tant qu'il lève un refus `retentable` (`refusSession`) et que la série
 *  de refus ne dépasse pas `borneMs` (#3150). Un refus non retentable, ou retentable au-delà de la borne, est relevé tel quel. */
export async function rejouer(geste, { borneMs, horloge = Date.now, dormir = sommeil, pasMs = 250 }) {
  let serie = null
  do {
    try { return await geste() }
    catch (e) {
      if (!refusSession(e).retentable) throw e
      serie ??= horloge()
      if (horloge() - serie > borneMs) throw e
      await dormir(pasMs)
    }
  } while (true)
}
