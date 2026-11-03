// Journal des transitions d'une session inscrite (#3261) : un fichier JSONL, une ligne `{"transition": …}` par
// événement, `seq` continu depuis 1 et `curseur === seq`. Codex l'écrit par son pont (`session-codex.mjs`), Claude
// par son hook `Stop` (`scripts/hooks/fin-de-tour.mjs`) ; `attendre` les lit ici tous deux.
import { appendFileSync, existsSync, readFileSync } from 'node:fs'
import { prefixeDeRefus } from '../guards/lib/categorieDeRefus.mjs'

export const ANNEXES_CLAUDE = Object.freeze({ journalClaude: 'claude.jsonl' })

/** La transition `seq` de `sessionId` : son curseur est son `seq`. PURE. */
export const transitionDe = (sessionId, seq, type, instantane) => ({ sessionId, seq, curseur: seq, type, ...instantane })

/** Les transitions du journal `journal`, `[]` s'il n'existe pas : ses seules lignes terminées par `\n`, la portion
 *  finale en cours d'écriture ignorée ; un journal d'une autre session ou discontinu est une panne. */
export function lireTransitions(journal, sessionId) {
  if (!existsSync(journal)) return []
  try {
    const transitions = readFileSync(journal, 'utf8').split('\n').slice(0, -1).filter(Boolean).map((l) => JSON.parse(l)).filter((x) => x.transition).map((x) => x.transition)
    if (transitions.some((x, i) => x.sessionId !== sessionId || x.seq !== i + 1 || x.curseur !== x.seq)) throw Error('Identité ou séquence discontinue')
    return transitions
  } catch (e) { throw new Error(`${prefixeDeRefus('panne')} Journal de session illisible : ${e.message}`, { cause: e }) }
}

/** Ajoute à `journal` la transition suivante de `sessionId` et la rend. */
export function ajouterTransition(journal, sessionId, type, instantane) {
  const t = transitionDe(sessionId, lireTransitions(journal, sessionId).length + 1, type, instantane)
  appendFileSync(journal, `${JSON.stringify({ transition: t })}\n`)
  return t
}
