// LECTURE DISQUE des stocks nominatifs de `scripts/raw` (#1711), dont la forme est
// `{ quoi, entrees: [{ famille?, fichier, ref, occurrence, lot, date }] }` — celle de
// `reconciliation-stock.json`.
// Tout le RAISONNEMENT vit dans `guards/lib/stock.mjs`, une seule définition pour TOUT stock
// nominatif du dépôt (JSON de `scripts/raw` comme `.mjs` de garde) : la FORME d'entrée
// (`cleDeSite`, `sitesEnEntrees`), le calcul d'écart (`ecartsDeStock`) et le REMÈDE
// (`ecartDuVolet`). Ici, rien que le fichier — et le PLAFOND nulle part, il vit dans le test de
// chaque garde.
// Consommateurs : `check-code-refs.mjs` (dead-code-refs, empty-line-code-refs),
// `citation-graphy-guard.mjs` (graphy), `reanchor.mjs` (reanchor-low), `check-refs.mjs` (dead-refs).
import { readFileSync } from 'node:fs'
import { parUnitesDeCode } from '../guards/lib/lister.mjs'
import { naissanceDu } from '../guards/lib/stock.mjs'

/** Contenu JSON d'un fichier de stock, ou `{}` s'il est ABSENT (mode ZÉRO-TOLÉRANCE : rien de toléré,
 *  l'écart fait le reste). Lecteur partagé : `reconcile.mjs` en tire ses `trous`. */
export function lireStockJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch (err) {
    if (err.code === 'ENOENT') return {}
    throw err
  }
}

/** Les comptes « à la naissance » du `quoi` du fichier de stock EN PLACE (`naissanceDu`), ou `null`. */
export const naissanceEnPlace = (path, familles) => naissanceDu(lireStockJson(path).quoi, familles)

/** Les ENTRÉES d'un fichier de stock (fichier absent, ou stock vide : aucune entrée). */
export function readStock(path) {
  return lireStockJson(path).entrees ?? []
}

/** Le TEXTE d'un fichier de stock — seule ÉCRITURE du dépôt pour la forme `{ quoi, entrees }`, en
 *  regard de `lireStockJson` : tout régénérateur rend le même octet. */
export const texteDeStock = (quoi, entrees) => `${JSON.stringify({ quoi, entrees }, null, 2)}\n`

/**
 * ORDRE CANONIQUE des `entrees` d'un fichier de stock : leur propre CLÉ (famille, fichier, réf,
 * occurrence), par unités de code. Il ne doit RIEN à l'ordre du balayage : deux corpus parcourus
 * dans deux ordres rendent le MÊME fichier, donc un registre réordonné (`src/data/books.json`,
 * #1825) ne réécrit aucun artefact commité.
 * IL VIT ICI, avec `texteDeStock` : l'ordre de RENDU appartient au module qui possède la FORME du
 * fichier, pas à la primitive de calcul `guards/lib/stock.mjs`, qui n'importe rien (#1475).
 * POSÉ AU RENDU, jamais dans `sitesEnEntrees` : l'occurrence y est l'ordinal du BALAYAGE, et
 * `check-folio-continuity.mjs#entreesDAncresVides` apparie encore site et mesure PAR POSITION (le
 * `line`, et le `pdfChars` de `lib/empty-folios-stock.mjs` qui en dérive) — trier là déplacerait des
 * VALEURS, pas des lignes.
 * @param {{ famille?: string, fichier?: string, ref?: string, occurrence?: number }} a
 * @param {{ famille?: string, fichier?: string, ref?: string, occurrence?: number }} b
 */
export const parCleDeSite = (a, b) =>
  parUnitesDeCode(a.famille ?? '', b.famille ?? '')
  || parUnitesDeCode(a.fichier ?? '', b.fichier ?? '')
  || parUnitesDeCode(a.ref ?? '', b.ref ?? '')
  || (a.occurrence ?? 0) - (b.occurrence ?? 0)

