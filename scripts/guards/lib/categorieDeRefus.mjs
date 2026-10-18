// CATÉGORIE d'un refus (#2726 B1 ; leçon 2.2 du guide de certification, « structured error responses ») :
// ce que l'appelant doit changer, et si le MÊME appel, renvoyé tel quel, peut passer. Imports : aucun.

/** Les catégories, chacune avec sa `retentable` : seul un refus transitoire passe au même appel renvoyé.
 *  `panne` étend les quatre catégories du guide à l'outillage lui-même, ni l'appel ni l'appelant. */
export const CATEGORIES_DE_REFUS = Object.freeze({
  transitoire: true,
  validation: false,
  métier: false,
  permission: false,
  panne: false,
})

/** Le préfixe `[catégorie · retentable]` d'un refus. Une catégorie inconnue lève. PURE. */
export function prefixeDeRefus(categorie) {
  if (!Object.hasOwn(CATEGORIES_DE_REFUS, categorie)) throw new Error(`catégorie de refus inconnue : ${categorie}`)
  return `[${categorie} · ${CATEGORIES_DE_REFUS[categorie] ? 'retentable' : 'non retentable'}]`
}
