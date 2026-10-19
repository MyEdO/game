// FILE BORNÉE de tâches asynchrones (#2586) — module UNIQUE pour tout appelant qui mène des tâches de front.
// La file n'arrête rien elle-même : chaque tâche reçoit son signal et le REMET à ce qu'elle lance ; une tâche qui
// l'ignore tient la file jusqu'à sa propre fin.

const erreurNommee = (code, message) => Object.assign(new Error(message), { code })

/**
 * Joue `taches` (fonctions `(signal) => promesse`), `deFront` en cours au plus, et REND leurs résultats dans leur ordre.
 * Au premier rejet qu'elle reçoit, ou à l'abandon de `signal`, le signal remis aux tâches s'abandonne : aucune tâche ne
 * se lance plus, celles en vol reçoivent l'arrêt ; la file attend qu'elles soient closes, puis rejette de la cause du
 * PREMIER de ces deux événements qu'elle reçoit : l'événement `abort` de `signal`, émis dans l'appel même à `abort()`
 * (sa raison), ou le rejet d'une tâche, reçu quand l'`await` de la file sur cette tâche reprend, des microtâches après
 * que la tâche a rejeté (son erreur). Un abandon et un rejet du même tour se départagent à cet ordre de réception,
 * dans un sens comme dans l'autre ; toute cause reçue après la première est ignorée. Un `signal` déjà abandonné
 * rejette de sa raison sans rien lancer.
 * @template T @param {ReadonlyArray<(signal: AbortSignal) => Promise<T>>} taches
 * @param {{ deFront: number, signal?: AbortSignal }} options @returns {Promise<T[]>}
 */
export async function enFileBornee(taches, { deFront, signal } = {}) {
  if (!Number.isSafeInteger(deFront) || deFront < 1) throw erreurNommee('BORNE_INVALIDE', `deFront doit être un entier positif : ${deFront}`)
  signal?.throwIfAborted()
  const arret = new AbortController()
  const signalTaches = signal ? AbortSignal.any([signal, arret.signal]) : arret.signal
  const resultats = new Array(taches.length)
  let suivante = 0
  let echec = null
  const echouer = (cause) => { if (!echec) { echec = { cause }; arret.abort(cause) } }
  const abandon = () => echouer(signal.reason)
  signal?.addEventListener('abort', abandon, { once: true })
  const ouvrier = async () => {
    while (suivante < taches.length && !signalTaches.aborted) {
      const i = suivante++
      try {
        resultats[i] = await taches[i](signalTaches)
      } catch (e) { echouer(e) }
    }
  }
  try {
    await Promise.all(Array.from({ length: Math.min(deFront, taches.length) }, ouvrier))
  } finally { signal?.removeEventListener('abort', abandon) }
  if (echec) throw echec.cause
  return resultats
}
