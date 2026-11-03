// Hook Stop (#3261) : la fin de tour d'une session Claude inscrite par `ops:session` devient une transition `inactif`
// de son journal (`scripts/ops/session-transitions.mjs`), que `attendre` rend. Hors session inscrite, rien n'est lu
// ni chargé au-delà de la porte de version ; un reçu SessionStart qui ne concorde pas est une autre session de
// l'environnement.
// Doc hooks : Stop ; jamais le code 2 (porte sous `DRAPEAU_REFUS_NON_BLOQUANT`, `scripts/node-requis.mjs`).
import '../node-requis.mjs'
import { dirname, join } from 'node:path'

/** La transition écrite pour la fin de tour, `null` si ce processus n'est pas la session inscrite de `env`. */
export async function finDeTour({ env = process.env, stdin } = {}) {
  if (!env.WFRP_SESSION_START) return null
  const { contexteDeSession, recuConcordant, entreeHookNative } = await import('../ops/session-start.mjs')
  const { ajouterTransition, ANNEXES_CLAUDE } = await import('../ops/session-transitions.mjs')
  const contexte = contexteDeSession(env)
  const native = JSON.parse(await entreeHookNative(env, stdin))
  if (native?.hook_event_name !== 'Stop' || typeof native.session_id !== 'string' || !native.session_id || !recuConcordant(contexte, native.session_id)) return null
  const journal = join(dirname(contexte.chemin), `${contexte.sessionId}.${ANNEXES_CLAUDE.journalClaude}`)
  const transcript = typeof native.transcript_path === 'string' && native.transcript_path ? { transcript: native.transcript_path } : {}
  return ajouterTransition(journal, contexte.sessionId, 'inactif', { etat: 'inactif', ...transcript })
}

if (import.meta.main) {
  try { await finDeTour() }
  catch (e) { process.stderr.write(`[fin-de-tour] ${e.message}\n`); process.exitCode = 1 }
}
