// COURSES CI — l'unique lecture `gh run list` de ce dépôt (hors sondes), et celles des jobs et du
// journal en échec d'une course.
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
export const CHAMPS = 'attempt,conclusion,createdAt,databaseId,headBranch,headSha,status,workflowName'

/** Les conclusions qui disent une course ÉCHOUÉE. `failure` n'est pas la seule : GitHub rend aussi
 *  `timed_out` (le job a dépassé sa borne) et `startup_failure` (le runner n'a pas démarré). Les
 *  omettre laissait passer une CI qui n'est PAS verte — mesuré : refus=0 sur les deux. Notion de
 *  COURSE, donc hôte des courses : la sonde de publication et `jobsEnEchecDe` la lisent. */
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
 * Les noms des jobs ROUGES (`ROUGES`) et ANNULÉS (`ANNULEE`) de la course `id` (`gh run view <id> --json
 * jobs`), de l'essai `attempt` s'il est nommé (`vueDeCourse`), en union à trois issues.
 * @param {{cwd?:string, id:number, attempt?:number|null, spawn?:Function}} p
 * @returns {{disponible:true, valeur:{rouges:string[], annules:string[]}}|{disponible:false, raison:string}}
 */
export function jobsEnEchecDe({ cwd = process.cwd(), id, attempt = null, spawn = spawnSync }) {
  const vu = classer(spawn('gh', [...vueDeCourse(id, attempt), '--json', 'jobs'], {
    cwd, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'], timeout: 120000,
  }))
  if (!vu.disponible) return vu
  if (vu.absent) return indisponible('gh n’a rendu aucune sortie exploitable')
  if (vu.valeur.status !== 0) return indisponible(`gh a rendu ${vu.valeur.status}`)
  try {
    const jobs = JSON.parse(vu.valeur.stdout)?.jobs
    if (!Array.isArray(jobs)) return indisponible('gh n’a pas rendu de `jobs`')
    const noms = (garde) => jobs.filter((j) => garde(String(j?.conclusion ?? ''))).map((j) => String(j.name))
    return fait({ rouges: noms((c) => ROUGES.has(c)), annules: noms((c) => c === ANNULEE) })
  } catch (e) {
    return indisponible(e.message)
  }
}

/** L'argv `gh run view <id>` d'une course, sur l'ESSAI `attempt` quand il est nommé : sans lui, `gh` lit le
 *  dernier essai, qu'une relance a pu remettre en vol (mesuré sur 37371342026 le 2026-10-05). PUR. */
const vueDeCourse = (id, attempt) => ['run', 'view', String(id), ...(attempt ? ['--attempt', String(attempt)] : [])]

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

/** Lignes de CONTEXTE retenues pour un job sans ligne reconnue (`echecsDuLog`) : valeur maison. Mesure du
 *  2026-10-05 : la ligne qui nomme la panne de `docs:build` (course 37323572830) est la 16ᵉ ligne non vide
 *  avant son erreur générique. */
export const BORNE_LIGNES_DE_CONTEXTE = 20

/** L'ouverture du groupe d'une ÉTAPE `run` d'Actions (`##[group]Run <commande>`) : son nom. */
const ETAPE_DU_GROUPE = /^##\[group\](Run .*)$/

/** Une directive d'Actions (`##[group]`, `##[endgroup]`, `##[error]`…) : jamais une ligne de contexte. */
const DIRECTIVE = /^##\[/

/** La colonne ÉTAPE d'un journal que GitHub n'a pas su attribuer. */
const ETAPE_INCONNUE = 'UNKNOWN STEP'

/**
 * Les ÉCHECS d'un journal `gh run view <id> --log-failed` (une ligne = `<job>\t<étape>\t<horodatage> <texte>`),
 * par job dans l'ordre du journal. `etape` : l'étape fautive, celle de la PREMIÈRE erreur du job — sa
 * colonne d'étape, ou, quand GitHub l'écrit `UNKNOWN STEP`, le dernier `##[group]Run …` ouvert avant elle.
 * `lignes` : ses lignes de test en échec, dédoublonnées et bornées à `borne`, puis sa PREMIÈRE ligne
 * `##[error]` qui n'est pas GÉNÉRIQUE (`ERREUR_GENERIQUE`) ; À DÉFAUT de toute ligne reconnue, les
 * `contexte` dernières lignes non vides (hors directives) de son étape avant la première erreur. `tues` compte les
 * lignes de test au-delà de la borne. PUR.
 * @param {string} journal @param {{borne?: number, contexte?: number}} [opts]
 * @returns {{job: string, etape: string|null, lignes: string[], tues: number}[]}
 */
export function echecsDuLog(journal, { borne = BORNE_LIGNES_D_ECHEC, contexte = BORNE_LIGNES_DE_CONTEXTE } = {}) {
  const parJob = new Map()
  for (const brute of String(journal ?? '').split(/\r?\n/)) {
    const [job, colonne, ...reste] = brute.split('\t')
    if (!reste.length) continue
    const texte = reste.join('\t').replace(HORODATAGE, '')
    const ligne = texte.trim()
    if (!parJob.has(job)) parJob.set(job, { tests: [], erreur: null, groupe: null, etape: null, fenetre: [], fige: null })
    const vu = parJob.get(job)
    const groupe = ETAPE_DU_GROUPE.exec(ligne)
    if (groupe && vu.fige === null) {
      vu.groupe = groupe[1]
      vu.fenetre = []
    }
    if (TEST_EN_ECHEC.test(texte)) {
      if (!vu.tests.includes(ligne)) vu.tests.push(ligne)
    } else if (ERREUR.test(ligne)) {
      if (vu.fige === null) {
        vu.fige = vu.fenetre
        vu.etape = colonne && colonne !== ETAPE_INCONNUE ? colonne : vu.groupe
      }
      if (vu.erreur === null && !ERREUR_GENERIQUE.test(ligne)) vu.erreur = ligne
    } else if (ligne && !DIRECTIVE.test(ligne) && vu.fige === null) {
      vu.fenetre = [...vu.fenetre, ligne].slice(-contexte)
    }
  }
  return [...parJob].map(([job, { tests, erreur, etape, fenetre, fige }]) => {
    const reconnues = [...tests.slice(0, borne), ...(erreur ? [erreur] : [])]
    return { job, etape, lignes: reconnues.length ? reconnues : (fige ?? fenetre), tues: Math.max(0, tests.length - borne) }
  })
}

/**
 * Le journal des jobs en ÉCHEC de la course `id` (`gh run view <id> --log-failed`), de l'essai `attempt` s'il
 * est nommé, en union à trois issues.
 * @param {{cwd?:string, id:number, attempt?:number|null, spawn?:Function}} p
 * @returns {{disponible:true, valeur:string}|{disponible:false, raison:string}}
 */
export function journalEnEchecDe({ cwd = process.cwd(), id, attempt = null, spawn = spawnSync }) {
  const vu = classer(spawn('gh', [...vueDeCourse(id, attempt), '--log-failed'], {
    cwd, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'], timeout: 120000,
  }))
  if (!vu.disponible) return vu
  if (vu.absent) return indisponible('gh n’a rendu aucune sortie exploitable')
  if (vu.valeur.status !== 0) return indisponible(`gh a rendu ${vu.valeur.status}`)
  return fait(String(vu.valeur.stdout))
}
