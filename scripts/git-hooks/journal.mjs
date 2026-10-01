// Journal des hooks git (#2194) : une ligne JSON par exécution — hook, durée, verdict, refus nommés —
// pour mesurer leur rendement. Primitive PARTAGÉE des points d'entrée de `scripts/git-hooks/`.
// Le journal vit sous `node_modules/.cache/`, comme ceux du train (`scripts/ops/publier.mjs`) : une
// trace de travail, effacée par un `npm ci`. Une écriture en échec ne change RIEN au hook.
// La durée est `performance.now()` à la sortie : depuis le début du processus node du hook.
import { appendFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { performance } from 'node:perf_hooks'

/** Chemin du journal, relatif à la racine de l'arbre où git lance le hook (githooks(5) : son cwd). */
export const CHEMIN_DU_JOURNAL = join('node_modules', '.cache', 'hooks-git', 'journal.jsonl')

/** Verdict d'une exécution : 0 franchit ; un refus nommé refuse ; un code non nul sans refus est une panne. */
export const verdictDe = (code, refus) => (code === 0 ? 'franchi' : refus.length ? 'refusé' : 'panne')

/**
 * La ligne du journal. PURE.
 * @param {{ hook: string, date: Date, ms: number, code: number, refus: string[] }} p
 * @returns {string}
 */
export function ligneDeJournal({ hook, date, ms, code, refus }) {
  return `${JSON.stringify({ date: date.toISOString(), hook, ms: Math.round(ms), code, verdict: verdictDe(code, refus), refus })}\n`
}

/**
 * Arme le journal du hook `hook` : la ligne s'écrit à la SORTIE du processus, quel qu'en soit le
 * chemin (`process.exit`, fin naturelle, exception). Rend `refuser(...motifs)`, qui nomme les refus.
 * @param {string} hook
 * @param {{ racine?: string, processus?: NodeJS.Process, ecrire?: (chemin: string, ligne: string) => void }} [io]
 * @returns {{ refuser: (...motifs: string[]) => void }}
 */
export function journaliserLeHook(hook, {
  racine = process.cwd(),
  processus = process,
  ecrire = (chemin, ligne) => {
    mkdirSync(dirname(chemin), { recursive: true })
    appendFileSync(chemin, ligne)
  },
} = {}) {
  const refus = []
  processus.once('exit', (code) => {
    try {
      ecrire(join(racine, CHEMIN_DU_JOURNAL), ligneDeJournal({ hook, date: new Date(), ms: performance.now(), code: code ?? 0, refus }))
    } catch {
      /* journal indisponible : le hook rend son verdict inchangé */
    }
  })
  return { refuser: (...motifs) => { refus.push(...motifs) } }
}
