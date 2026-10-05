// COURSES CI — l'unique lecture `gh run list` de ce dépôt (hors sondes), et celles des jobs et du
// journal en échec d'une course.
//
// Une COURSE est une exécution de workflow. Trois QUESTIONS, une seule lecture : « les courses de
// telle BRANCHE » (les faits de palier), « les courses de tel COMMIT » (l'étape `file` du train, qui
// juge la tête de sa PR) et « les courses de tel ÉVÉNEMENT » (`merge_group` : les commits de file, dont
// la ref nomme la PR, `headBranch`). `commit` prime sur `branche` : `gh run list --commit <sha>` ne
// dépend d'aucune branche.
//
// COÛT MESURÉ (2026-09-05, ce dépôt, médiane de trois passes) : `--limit 1` = 985 ms,
// `--limit 30` = 1 583 ms, `--limit 300` = 10 732 ms. La limite EST la fenêtre : `gh run list` n'a
// pas de fenêtre de dates.
//
// La sortie est TRIÉE par `createdAt` décroissant ICI : un consommateur qui prend `courses[0]` prend
// la plus récente sans avoir à le savoir, et deux consommateurs ne trient pas différemment.
//
// MESURE : `WFRP_GH_STUB=<fichier json>` fournit la réponse au lieu de `gh`. Deux formes :
//   · un TABLEAU de courses — servi à chaque appel ;
//   · `{ "appels": [ [...], [...] ] }` — une liste PAR APPEL, la dernière se répète. C'est la forme
//     qui rejoue une liste PÉRIMÉE puis sa relecture (session #1508), et les deux fenêtres 30/300.
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { TRONC, classer, fait, indisponible } from './gitPorte.mjs'
import { parUnitesDeCode } from './lister.mjs'
import { PORTE } from '../../gates/workflowsDuDepot.mjs'

/** Champs demandés à `gh` : l'union de ce que les consommateurs lisent, une seule fois. */
export const CHAMPS = 'attempt,conclusion,createdAt,databaseId,headBranch,headSha,status,workflowName'

/** Les conclusions qui disent une course ÉCHOUÉE. `failure` n'est pas la seule : GitHub rend aussi
 *  `timed_out` (le job a dépassé sa borne) et `startup_failure` (le runner n'a pas démarré). Les
 *  omettre laissait passer une CI qui n'est PAS verte — mesuré : refus=0 sur les deux. Notion de
 *  COURSE, donc hôte des courses : la sonde de publication et `jobsRougesDe` la lisent. */
export const ROUGES = new Set(['failure', 'timed_out', 'startup_failure'])

/** `cancelled` n'est ni vert ni rouge : personne n'a jugé ce contenu. */
export const ANNULEE = 'cancelled'

/** Appels déjà servis par un fichier de stub, par chemin. */
const appelsServis = new Map()

/** Remet les compteurs du stub à zéro (un test qui joue deux scénarios sur le même fichier). */
export const reinitialiserStub = () => appelsServis.clear()

/** Courses d'un stub, PUR sauf le compteur d'appels : la n-ième lecture reçoit la n-ième liste. */
function listeDuStub(chemin) {
  let lu
  try {
    lu = JSON.parse(readFileSync(chemin, 'utf8'))
  } catch (e) {
    return indisponible(e.message)
  }
  if (Array.isArray(lu)) return fait(triees(lu))
  const appels = Array.isArray(lu?.appels) ? lu.appels : null
  if (!appels || appels.length === 0) return indisponible(`stub sans courses — ni tableau ni \`appels\` : ${chemin}`)
  const rang = appelsServis.get(chemin) ?? 0
  appelsServis.set(chemin, rang + 1)
  return fait(triees(appels[Math.min(rang, appels.length - 1)]))
}

/** Tri par `createdAt` décroissant ; à défaut de date, l'ordre servi est conservé. PUR. */
export function triees(courses) {
  return [...(courses ?? [])]
    .map((c, rang) => ({ c, rang }))
    .sort((a, b) => parUnitesDeCode(String(b.c.createdAt ?? ''), String(a.c.createdAt ?? '')) || a.rang - b.rang)
    .map(({ c }) => c)
}

/**
 * Les courses CI d'une branche, d'un commit ou d'un événement (`evenement`, `gh run list --event`), en
 * union à trois issues (jamais `absent` : une liste vide EST un fait).
 * @param {{cwd?:string, env?:object, limit?:number, workflow?:string|null, branche?:string|null,
 *          commit?:string|null, evenement?:string|null, spawn?:Function}} [p]
 * @returns {{disponible:true, valeur:object[]}|{disponible:false, raison:string}}
 */
export function coursesCi({
  cwd = process.cwd(), env = process.env, limit = 30, workflow = PORTE,
  branche = TRONC.nom, commit = null, evenement = null, spawn = spawnSync,
} = {}) {
  if (env.WFRP_GH_STUB) return listeDuStub(env.WFRP_GH_STUB)
  const args = [
    'run', 'list',
    ...(commit ? ['--commit', commit] : branche ? ['--branch', branche] : []),
    ...(evenement ? ['--event', evenement] : []),
    ...(workflow ? ['--workflow', workflow] : []),
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
 * trois issues. `WFRP_GH_STUB` n'y répond pas : un test injecte `spawn`.
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

/** Lignes de test en échec retenues par job (`echecsDuLog`) : valeur maison, assez pour nommer la
 *  panne sans recopier une suite entière. */
export const BORNE_LIGNES_D_ECHEC = 12

/** L'horodatage que GitHub préfixe à chaque ligne de journal, BOM de début de job compris. */
const HORODATAGE = /^\uFEFF?\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z ?/

/** Une ligne de TEST en échec : `not ok <n> - <nom>` (TAP de node:test, sous-tests indentés compris),
 *  ` FAIL  <fichier> > <test>` (vitest). */
const TEST_EN_ECHEC = /^(?:\s*not ok \d+ - | FAIL {2})/

/** Une annotation d'erreur d'Actions, rendue `##[error]` au journal. */
const ERREUR = /^##\[error\]/

/** Une annotation d'erreur GÉNÉRIQUE : le code de sortie d'une étape, qui ne nomme aucune panne. */
const ERREUR_GENERIQUE = /^##\[error\]Process completed with exit code \d+\.?$/

/**
 * Les ÉCHECS d'un journal `gh run view <id> --log-failed` (une ligne = `<job>\t<étape>\t<horodatage> <texte>`),
 * par job dans l'ordre du journal : ses lignes de test en échec, dédoublonnées et bornées à `borne`, puis
 * sa PREMIÈRE ligne `##[error]` qui n'est pas GÉNÉRIQUE (`ERREUR_GENERIQUE`), aucune s'il n'y en a pas ;
 * `tues` compte les lignes de test au-delà de la borne. PUR.
 * @param {string} journal @param {{borne?: number}} [opts]
 * @returns {{job: string, lignes: string[], tues: number}[]}
 */
export function echecsDuLog(journal, { borne = BORNE_LIGNES_D_ECHEC } = {}) {
  const parJob = new Map()
  for (const brute of String(journal ?? '').split(/\r?\n/)) {
    const [job, , ...reste] = brute.split('\t')
    if (!reste.length) continue
    const ligne = reste.join('\t').replace(HORODATAGE, '')
    if (!parJob.has(job)) parJob.set(job, { tests: [], erreur: null })
    const vu = parJob.get(job)
    if (TEST_EN_ECHEC.test(ligne)) {
      const test = ligne.trim()
      if (!vu.tests.includes(test)) vu.tests.push(test)
    } else if (vu.erreur === null && ERREUR.test(ligne) && !ERREUR_GENERIQUE.test(ligne.trim())) vu.erreur = ligne.trim()
  }
  return [...parJob].map(([job, { tests, erreur }]) => ({
    job,
    lignes: [...tests.slice(0, borne), ...(erreur ? [erreur] : [])],
    tues: Math.max(0, tests.length - borne),
  }))
}

/**
 * Le journal des jobs en ÉCHEC de la course `id` (`gh run view <id> --log-failed`), en union à trois
 * issues. `WFRP_GH_STUB` n'y répond pas : un test injecte `spawn`.
 * @param {{cwd?:string, id:number, spawn?:Function}} p
 * @returns {{disponible:true, valeur:string}|{disponible:false, raison:string}}
 */
export function journalEnEchecDe({ cwd = process.cwd(), id, spawn = spawnSync }) {
  const vu = classer(spawn('gh', ['run', 'view', String(id), '--log-failed'], {
    cwd, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'], timeout: 120000,
  }))
  if (!vu.disponible) return vu
  if (vu.absent) return indisponible('gh n’a rendu aucune sortie exploitable')
  if (vu.valeur.status !== 0) return indisponible(`gh a rendu ${vu.valeur.status}`)
  return fait(String(vu.valeur.stdout))
}
