// RENOMMAGE RÉSILIENT (#2493) : un `rename` que Windows refuse pendant qu'un autre processus tient la cible
// ouverte, rejoué sous les paliers `BACKOFFS_MS`. Appelants : `ecrireJsonAtomique` (`ecritureJsonAtomique.mjs`)
// et le remplacement de l'index du principal (`scripts/ops/synchroniser.mjs`).
import { renameSync } from 'node:fs'
import { BACKOFFS_MS, attendreSync } from './spawnResilient.mjs'

/** Les codes d'un `rename` que Windows refuse pendant qu'un autre processus tient la cible ouverte. */
export const RENOMMAGE_REFUSE = Object.freeze(new Set(['EPERM', 'EACCES', 'EBUSY']))

/**
 * La `cible` REMPLACÉE par le fichier `source` (`renameSync`), rejoué sous `BACKOFFS_MS` tant que le système
 * le refuse (`RENOMMAGE_REFUSE`). REND les codes des refus essuyés ; LÈVE le dernier refus à épuisement.
 * @param {string} source @param {string} cible @param {{ attendre?: (ms: number) => void }} [opts] @returns {string[]}
 */
export function renommerResilient(source, cible, { attendre = attendreSync } = {}) {
  const refus = []
  for (;;) {
    try {
      renameSync(source, cible)
      return refus
    } catch (e) {
      const code = /** @type {any} */ (e)?.code
      if (!RENOMMAGE_REFUSE.has(code) || refus.length >= BACKOFFS_MS.length) throw e
      refus.push(code)
      attendre(BACKOFFS_MS[refus.length - 1])
    }
  }
}
