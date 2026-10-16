// SONDE de pid, PURE hors de `process.kill(pid, 0)` (#2516) : l'unique primitive d'existence d'un processus.

/** `pid` désigne-t-il UN processus, dans l'int32 de `process.kill` ? kill(2), #2516.
 *  @param {unknown} pid @returns {pid is number} */
export const estPidDeProcessus = (pid) => Number.isSafeInteger(pid) && /** @type {number} */ (pid) > 0 && /** @type {number} */ (pid) <= 2 ** 31 - 1

/** Ce PID tourne-t-il ? `ESRCH` = absent ; `EPERM` = il existe, hors de nos droits ; toute autre erreur remonte. kill(2), #2516.
 *  @param {unknown} pid @param {{ sonder?: (pid: number) => void }} [options] */
export function estPidVivant(pid, { sonder = (p) => process.kill(p, 0) } = {}) {
  if (!estPidDeProcessus(pid)) return false
  try {
    sonder(pid)
    return true
  } catch (e) {
    if (/** @type {any} */ (e)?.code === 'ESRCH') return false
    if (/** @type {any} */ (e)?.code === 'EPERM') return true
    throw e
  }
}

/** `estPidVivant`, puis la création mesurée confrontée à `naissance` (ms epoch) : postérieure à `naissance + toleranceMs`, pid RÉUTILISÉ ; indéterminée, vivant (#2603).
 *  @param {unknown} pid @param {number | undefined} naissance
 *  @param {{ lireCreation: (pid: number) => number | null, toleranceMs: number }} identite
 *  @param {{ estVivant?: (pid: number) => boolean }} [options] */
export function estPidVivantDepuis(pid, naissance, { lireCreation, toleranceMs }, { estVivant = estPidVivant } = {}) {
  if (!estVivant(/** @type {number} */ (pid))) return false
  if (!Number.isFinite(naissance)) return true
  const mesure = lireCreation(pid)
  return mesure === null || mesure <= /** @type {number} */ (naissance) + toleranceMs
}

/** `lireCreation`, sa mesure gardée par `cle` (le pid par défaut) pendant `pasMs` de `horloge` : la création d'un pid ne change pas tant qu'il vit, et `pasMs` borne la fenêtre d'un pid mort puis réutilisé entre deux sondes (#2603).
 *  @param {(pid: number) => number | null} lireCreation @param {{ pasMs: number, horloge: () => number }} p
 *  @returns {(pid: number, cle?: unknown) => number | null} */
export function creationMemorisee(lireCreation, { pasMs, horloge }) {
  /** @type {Map<unknown, { mesure: number | null, instant: number }>} */
  const vus = new Map()
  return (pid, cle = pid) => {
    const vu = vus.get(cle)
    if (vu && horloge() - vu.instant < pasMs) return vu.mesure
    const mesure = lireCreation(pid)
    vus.set(cle, { mesure, instant: horloge() })
    return mesure
  }
}
