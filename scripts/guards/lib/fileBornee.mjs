// FILE BORNÉE de tâches asynchrones (#2586) — module UNIQUE : tout appelant qui mène des tâches de front, `deFront` au
// plus, en dépend (`scripts/corpus/docs/plateforme-win32.test.mjs`, `scripts/ops/sondes/hote-powershell.mjs`).
// La file PORTE l'arrêt : chaque tâche reçoit son signal, qu'elle remet à son lancement (`spawnBorne`).

const erreurNommee = (code, message) => Object.assign(new Error(message), { code })

/**
 * Joue `taches` (fonctions `(signal) => promesse`), `deFront` en cours au plus, et REND leurs résultats dans leur ordre.
 * Au premier rejet, ou à l'abandon de `signal`, le signal remis aux tâches s'abandonne : aucune tâche ne se lance
 * plus, celles en vol reçoivent l'arrêt ; la file attend qu'elles soient closes, puis rejette de la première cause.
 * @template T @param {ReadonlyArray<(signal: AbortSignal) => Promise<T>>} taches
 * @param {{ deFront: number, signal?: AbortSignal }} options @returns {Promise<T[]>}
 */
export async function enFileBornee(taches, { deFront, signal } = {}) {
  if (!Number.isSafeInteger(deFront) || deFront < 1) throw erreurNommee('BORNE_INVALIDE', `deFront doit être un entier positif : ${deFront}`)
  const arret = new AbortController()
  const signalTaches = signal ? AbortSignal.any([signal, arret.signal]) : arret.signal
  const resultats = new Array(taches.length)
  let suivante = 0
  let echec = null
  const ouvrier = async () => {
    while (suivante < taches.length && !signalTaches.aborted) {
      const i = suivante++
      try {
        resultats[i] = await taches[i](signalTaches)
      } catch (e) {
        if (!echec) { echec = { cause: e }; arret.abort(e) }
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(deFront, taches.length) }, ouvrier))
  if (echec) throw echec.cause
  signal?.throwIfAborted()
  return resultats
}
