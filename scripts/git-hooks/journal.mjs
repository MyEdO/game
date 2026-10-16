// Journal des hooks git (#2194, #2603) : primitive PARTAGÉE des points d'entrée de `scripts/git-hooks/`.
// Une écriture en échec ne change RIEN au hook. Lecteur : `scripts/ops/journal-hooks.mjs`.
import { appendFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { performance } from 'node:perf_hooks'
import { gitDirDe } from '../hooks/barriere-outil.mjs'

/** La variable d'environnement qui porte `{ chemin, hook, pid }` du hook armé à ses sous-processus. */
export const VARIABLE_DU_JOURNAL = 'WFRP_JOURNAL_HOOKS_GIT'

/** Le journal de l'arbre `racine`, sous son git-dir ; `null` hors dépôt. @param {string} racine */
export function journalDe(racine) {
  const gitDir = gitDirDe(racine)
  return gitDir === null ? null : join(gitDir, 'hooks-git', 'journal.jsonl')
}

/** Verdict d'une exécution : 0 franchit ; un refus nommé refuse ; un code non nul sans refus est une panne. */
export const verdictDe = (code, refus) => (code === 0 ? 'franchi' : refus.length ? 'refusé' : 'panne')

/** Une ligne du journal. PURE. @param {Record<string, unknown>} entree */
const ligneDeJournal = (entree) => `${JSON.stringify(entree)}\n`

/** @param {string} chemin @param {string} ligne */
function ecrireLigne(chemin, ligne) {
  mkdirSync(dirname(chemin), { recursive: true })
  appendFileSync(chemin, ligne)
}

/** @param {(chemin: string, ligne: string) => void} ecrire @param {string} chemin @param {Record<string, unknown>} entree */
function tenter(ecrire, chemin, entree) {
  try {
    ecrire(chemin, ligneDeJournal(entree))
  } catch {
    /* journal indisponible : le hook rend son verdict inchangé */
  }
}

/**
 * L'écrivain des lignes `etape` du run `{ chemin, hook, pid }`.
 * @param {{ chemin: string, hook: string, pid: number }} run @param {(chemin: string, ligne: string) => void} ecrire
 * @returns {(etape: { nom: string, debut: string, fin: string, ms: number }) => void}
 */
const ecrivainDEtape = ({ chemin, hook, pid }, ecrire) => ({ nom, debut, fin, ms }) =>
  tenter(ecrire, chemin, { evenement: 'etape', hook, pid, nom, debut, fin, ms: Math.round(ms) })

/**
 * L'écrivain d'étape du hook armé par un processus ANCÊTRE (`VARIABLE_DU_JOURNAL`) sur l'arbre `racine` ;
 * sans elle, illisible, ou armée sur un AUTRE arbre (un banc jetable lancé sous un hook), un écrivain vide.
 * @param {string} racine @param {NodeJS.ProcessEnv} [env]
 */
export function etapeHeritee(racine, env = process.env) {
  let run
  try {
    run = JSON.parse(env[VARIABLE_DU_JOURNAL] ?? '')
  } catch {
    return () => {}
  }
  if (typeof run?.chemin !== 'string' || typeof run.hook !== 'string' || !Number.isInteger(run.pid) || run.chemin !== journalDe(racine)) return () => {}
  return ecrivainDEtape(run, ecrireLigne)
}

/**
 * Arme le journal du hook `hook` : une ligne `debut` à l'armement, datée de l'origine du processus
 * (`performance.timeOrigin`), une ligne `fin` à la SORTIE du processus, quel qu'en soit le chemin
 * (`process.exit`, fin naturelle, exception), et `VARIABLE_DU_JOURNAL` dans `env`. Rend
 * `refuser(...motifs)`, qui nomme les refus, et `etape`, l'écrivain des lignes `etape`. Hors dépôt :
 * rien n'est écrit ni posé.
 * @param {string} hook
 * @param {{ racine?: string, processus?: NodeJS.Process, env?: NodeJS.ProcessEnv, origine?: number,
 *   horloge?: () => number, ecrire?: (chemin: string, ligne: string) => void }} [io]
 * @returns {{ refuser: (...motifs: string[]) => void, etape: ReturnType<typeof etapeHeritee> }}
 */
export function journaliserLeHook(hook, {
  racine = process.cwd(),
  processus = process,
  env = process.env,
  origine = performance.timeOrigin,
  horloge = () => Date.now(),
  ecrire = ecrireLigne,
} = {}) {
  const refus = []
  const refuser = (...motifs) => { refus.push(...motifs) }
  const chemin = journalDe(racine)
  if (chemin === null) return { refuser, etape: () => {} }
  const { pid } = processus
  const debut = new Date(origine).toISOString()
  tenter(ecrire, chemin, { evenement: 'debut', hook, pid, debut })
  env[VARIABLE_DU_JOURNAL] = JSON.stringify({ chemin, hook, pid })
  processus.once('exit', (code) => {
    const fin = horloge()
    const sortie = code ?? 0
    tenter(ecrire, chemin, {
      evenement: 'fin', hook, pid, debut, fin: new Date(fin).toISOString(), ms: Math.round(fin - origine), code: sortie, verdict: verdictDe(sortie, refus), refus,
    })
  })
  return { refuser, etape: ecrivainDEtape({ chemin, hook, pid }, ecrire) }
}
