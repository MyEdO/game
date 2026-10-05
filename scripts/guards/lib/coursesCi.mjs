// COURSES CI — l'unique lecture `gh run list` de ce dépôt (hors sondes), et celle des jobs d'une course.
//
// Une COURSE est une exécution de workflow. Deux QUESTIONS, une seule lecture : « les courses de tel
// COMMIT » (l'étape `file` du train, qui juge la tête de sa PR ; le closer, qui situe sa plage) et
// « les courses de tel ÉVÉNEMENT » (`merge_group` : les commits de file, dont la ref nomme la PR,
// `headBranch`). `gh run list --commit <sha>` ne dépend d'aucune branche.
//
// COÛT MESURÉ (2026-09-05, ce dépôt, médiane de trois passes) : `--limit 1` = 985 ms,
// `--limit 30` = 1 583 ms, `--limit 300` = 10 732 ms. La limite EST la fenêtre : `gh run list` n'a
// pas de fenêtre de dates.
//
// La sortie est TRIÉE par `createdAt` décroissant ICI : un consommateur qui prend `courses[0]` prend
// la plus récente sans avoir à le savoir, et deux consommateurs ne trient pas différemment.
import { spawnSync } from 'node:child_process'
import { classer, fait, indisponible } from './gitPorte.mjs'
import { parUnitesDeCode } from './lister.mjs'
import { PORTE } from '../../gates/workflowsDuDepot.mjs'

/** Champs demandés à `gh` : l'union de ce que les consommateurs lisent, une seule fois. */
export const CHAMPS = 'conclusion,createdAt,databaseId,headBranch,headSha,status,workflowName'

/** Les conclusions qui disent une course ÉCHOUÉE. `failure` n'est pas la seule : GitHub rend aussi
 *  `timed_out` (le job a dépassé sa borne) et `startup_failure` (le runner n'a pas démarré). Les
 *  omettre laissait passer une CI qui n'est PAS verte — mesuré : refus=0 sur les deux. Notion de
 *  COURSE, donc hôte des courses : la sonde de publication et `jobsRougesDe` la lisent. */
export const ROUGES = new Set(['failure', 'timed_out', 'startup_failure'])

/** `cancelled` n'est ni vert ni rouge : personne n'a jugé ce contenu. */
export const ANNULEE = 'cancelled'

/** Tri par `createdAt` décroissant ; à défaut de date, l'ordre servi est conservé. PUR. */
export function triees(courses) {
  return [...(courses ?? [])]
    .map((c, rang) => ({ c, rang }))
    .sort((a, b) => parUnitesDeCode(String(b.c.createdAt ?? ''), String(a.c.createdAt ?? '')) || a.rang - b.rang)
    .map(({ c }) => c)
}

/**
 * Les courses CI du workflow `workflow` pour un `commit` ou un `evenement` (`gh run list --event`),
 * en union à trois issues (jamais `absent` : une liste vide EST un fait).
 * @param {{cwd?:string, limit?:number, workflow?:string, commit?:string|null, evenement?:string|null, spawn?:Function}} p
 * @returns {{disponible:true, valeur:object[]}|{disponible:false, raison:string}}
 * @throws {TypeError} ni `commit` ni `evenement` : la question n'est pas posée.
 */
export function coursesCi({ cwd = process.cwd(), limit = 30, workflow = PORTE, commit = null, evenement = null, spawn = spawnSync } = {}) {
  if (!commit && !evenement) throw new TypeError('coursesCi : un `commit` ou un `evenement` est la question')
  const args = [
    'run', 'list',
    ...(commit ? ['--commit', commit] : []),
    ...(evenement ? ['--event', evenement] : []),
    '--workflow', workflow,
    '--limit', String(limit), '--json', CHAMPS,
  ]
  const vu = classer(spawn('gh', args, {
    cwd, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'], timeout: 120000,
  }))
  if (!vu.disponible) return vu
  if (vu.absent) return indisponible('gh n’a rendu aucune sortie exploitable')
  if (vu.valeur.status !== 0) return indisponible(`gh a rendu ${vu.valeur.status}`)
  try {
    const lu = JSON.parse(vu.valeur.stdout)
    return Array.isArray(lu) ? fait(triees(lu)) : indisponible('gh n’a pas rendu un tableau de courses')
  } catch (e) {
    return indisponible(e.message)
  }
}

/**
 * Les noms des jobs ROUGES (`ROUGES`) de la course `id` (`gh run view <id> --json jobs`), en union à
 * trois issues.
 * @param {{cwd?:string, id:number, spawn?:Function}} p
 * @returns {{disponible:true, valeur:string[]}|{disponible:false, raison:string}}
 */
export function jobsRougesDe({ cwd = process.cwd(), id, spawn = spawnSync }) {
  const vu = classer(spawn('gh', ['run', 'view', String(id), '--json', 'jobs'], {
    cwd, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'], timeout: 120000,
  }))
  if (!vu.disponible) return vu
  if (vu.absent) return indisponible('gh n’a rendu aucune sortie exploitable')
  if (vu.valeur.status !== 0) return indisponible(`gh a rendu ${vu.valeur.status}`)
  try {
    const jobs = JSON.parse(vu.valeur.stdout)?.jobs
    if (!Array.isArray(jobs)) return indisponible('gh n’a pas rendu de `jobs`')
    return fait(jobs.filter((j) => ROUGES.has(String(j?.conclusion ?? ''))).map((j) => String(j.name)))
  } catch (e) {
    return indisponible(e.message)
  }
}
