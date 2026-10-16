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
