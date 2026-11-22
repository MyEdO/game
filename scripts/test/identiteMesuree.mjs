// IDENTITÉ DE CRÉATION d'un processus de la machine (#2603) : sa date de création mesurée, et la tolérance
// de la mesure. Consommée par `estPidVivantDepuis` (`scripts/guards/lib/pid.mjs`).
import { DELAI_MESURE_PROCESSUS_MS, mesurerProcessusWorktrees, toleranceDeMesure } from '../guards/lib/processusWorktrees.mjs'

/** Borne d'une mesure de création ; son échéance vaut indéterminé. */
const BORNE_DE_MESURE_MS = 10_000

/**
 * La date de création (ms epoch) du processus `pid`, mesurée par `mesurerProcessusWorktrees` sous
 * `BORNE_DE_MESURE_MS` ; `null` si elle est INDÉTERMINÉE (échéance, erreur, processus absent).
 * @param {number} pid
 * @param {{ mesurer?: typeof mesurerProcessusWorktrees }} [injections]
 * @returns {number | null}
 */
export function creationMesuree(pid, { mesurer = mesurerProcessusWorktrees } = {}) {
  let vue
  try {
    vue = mesurer({ pids: [pid], timeout: BORNE_DE_MESURE_MS })
  } catch {
    return null
  }
  if (vue.indeterminee) return null
  const creation = Date.parse(vue.processus.find((p) => p.pid === pid)?.creation ?? '')
  return Number.isFinite(creation) ? creation : null
}

/** L'identité de création d'un processus de la machine : `creationMesuree` et sa tolérance (#2603). */
export const IDENTITE_MESUREE = Object.freeze({ lireCreation: creationMesuree, toleranceMs: toleranceDeMesure() })

/** Création et état issus de la même observation stable ; `null` si l'identité est illisible ou absente (#4614).
 * @param {number} pid
 * @param {{ mesurer?: typeof mesurerProcessusWorktrees, timeout?: number }} [options]
 * @returns {{ creation: number, etat: string | undefined } | null}
 */
export function lireIdentiteMesuree(pid, { mesurer = mesurerProcessusWorktrees, timeout = DELAI_MESURE_PROCESSUS_MS } = {}) {
  try {
    const vue = mesurer({ pids: [pid], identites: true, timeout })
    if (vue.indeterminee || vue.erreurs?.length) return null
    const processus = vue.processus.find((item) => item.pid === pid)
    if (processus?.erreurs?.length !== 0) return null
    const creation = Date.parse(processus.creation ?? '')
    return Number.isFinite(creation) ? { creation, etat: processus.etat } : null
  } catch {
    return null
  }
}
