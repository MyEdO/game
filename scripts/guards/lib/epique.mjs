// ÉPIQUE et RATTACHEMENT NATIF — credo, puce « Le poison se corrige DANS LE GESTE » (#2561). Un ticket
// naît SOUS-ISSUE native de son épique (`parent_issue_url` du schéma `issue`). Lu par le compteur du
// travail restant (`scripts/ops/stock-issues.mjs`). PUR.

/** Le label qui fait d'une issue une épique : le TITRE est de l'affichage, jamais lu. */
export const LABEL_EPIQUE = 'épique'

/** Numéro final d'une URL d'API `…/issues/<N>`. */
const NUMERO_URL_RE = /\/issues\/(\d+)\/?$/u

/** L'issue porte-t-elle le label `épique` ? Labels REST (`{name}`) ou noms nus.
 *  @param {{labels?: (string|{name?: string})[]}} issue @returns {boolean} */
export const estEpique = (issue) =>
  (issue?.labels ?? []).some((l) => (typeof l === 'string' ? l : l?.name) === LABEL_EPIQUE)

/** Numéro de l'issue parente (sous-issue native, `parent_issue_url`), `null` sans parent.
 *  @param {{parent_issue_url?: string|null}} issue @returns {number|null} */
export function parentDe(issue) {
  const m = NUMERO_URL_RE.exec(String(issue?.parent_issue_url ?? ''))
  return m ? Number(m[1]) : null
}
