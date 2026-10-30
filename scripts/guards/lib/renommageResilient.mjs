// RENOMMAGE RÉSILIENT (#2493, #3138) : un `rename` que Windows refuse pendant qu'un autre processus tient la cible
// ouverte, rejoué sous les paliers `PALIERS_RENOMMAGE_MS`.
import { renameSync } from 'node:fs'
import { attendreSync } from './spawnResilient.mjs'

/** Les codes que Windows rend quand un autre processus tient le fichier ouvert : `rename` refusé, lecture refusée. */
export const FICHIER_TENU = Object.freeze(new Set(['EPERM', 'EACCES', 'EBUSY']))

/** La première attente (ms) d'un renommage refusé : un lecteur tient la cible quelques ms (#3138). Valeur maison. */
export const PREMIER_PALIER_RENOMMAGE_MS = 10

/** Le total (ms) des attentes d'un renommage refusé avant qu'il soit levé (#3138). Valeur maison. */
export const BUDGET_RENOMMAGE_MS = 7000

/** Les attentes (ms) entre deux essais d'un renommage refusé : rampe doublée depuis `premier`, dont le dernier palier
 *  solde `budget`. PURE. */
function rampeDoublee(premier, budget) {
  const paliers = []
  for (let palier = premier, reste = budget; reste > 0; palier *= 2) {
    paliers.push(Math.min(palier, reste))
    reste -= paliers.at(-1)
  }
  return Object.freeze(paliers)
}

/** Les attentes (ms) entre deux essais d'un renommage refusé, de `PREMIER_PALIER_RENOMMAGE_MS` à `BUDGET_RENOMMAGE_MS`. */
export const PALIERS_RENOMMAGE_MS = rampeDoublee(PREMIER_PALIER_RENOMMAGE_MS, BUDGET_RENOMMAGE_MS)

/**
 * La `cible` REMPLACÉE par le fichier `source` (`renameSync`), rejoué sous `paliers` tant que le système le refuse
 * (`FICHIER_TENU`). REND les codes des refus essuyés ; LÈVE le dernier refus à épuisement, le premier sous `[]`.
 * @param {string} source @param {string} cible
 * @param {{ attendre?: (ms: number) => void, paliers?: readonly number[] }} [opts] @returns {string[]}
 */
export function renommerResilient(source, cible, { attendre = attendreSync, paliers = PALIERS_RENOMMAGE_MS } = {}) {
  const refus = []
  for (;;) {
    try {
      renameSync(source, cible)
      return refus
    } catch (e) {
      const code = /** @type {any} */ (e)?.code
      if (!FICHIER_TENU.has(code) || refus.length >= paliers.length) throw e
      refus.push(code)
      attendre(paliers[refus.length - 1])
    }
  }
}
