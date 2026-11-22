// COURSES CI — lecture REST des courses d'un workflow, et lecture des jobs et du journal d'une course.
//
// Une COURSE est une exécution de workflow. Deux QUESTIONS, une seule lecture : « les courses de tel
// COMMIT » (l'étape `file` du train, qui juge la tête de sa PR ; le closer, qui situe sa plage) et
// « les courses de tel ÉVÉNEMENT » (`merge_group` : les commits de file, dont la ref nomme la PR,
// `headBranch`). Les deux filtres se combinent. La limite borne la fenêtre en nombre de courses.
//
// La sortie est TRIÉE par `createdAt` décroissant ICI : un consommateur qui prend `courses[0]` prend
// la plus récente sans avoir à le savoir, et deux consommateurs ne trient pas différemment.
import { spawnSync } from 'node:child_process'
import { estObjet } from '../../../src/lib/objet.mjs'
import { classer, fait, indisponible } from './gitPorte.mjs'
import { parUnitesDeCode } from './lister.mjs'
import { PORTE } from '../../gates/workflowsDuDepot.mjs'
import { DEPOT, PAR_PAGE, pagesRest } from './ticketsGh.mjs'
import { BORNE_JOURNAL, ETAPE_INCONNUE, projeterJournal } from './journauxCi.mjs'

/** Nombre maximal de courses consultables sur une liste REST GitHub Actions filtrée. */
const PLAFOND_DE_COURSES = 1000

/** Les conclusions qui disent une course ÉCHOUÉE. `failure` n'est pas la seule : GitHub rend aussi
 *  `timed_out` (le job a dépassé sa borne) et `startup_failure` (le runner n'a pas démarré). Les
 *  omettre laissait passer une CI qui n'est PAS verte — mesuré : refus=0 sur les deux. Notion de
 *  COURSE, donc hôte des courses : `verdictDesRuns` et `jobsJuges` la lisent. */
export const ROUGES = new Set(['failure', 'timed_out', 'startup_failure'])

/** `cancelled` n'est ni vert ni rouge : personne n'a jugé ce contenu. */
export const ANNULEE = 'cancelled'

/** Nom du workflow que la sonde reconnaît (`.github/workflows/ci.yml`, `name: CI`). */
export const WORKFLOW = 'CI'

/** Essais d'une course annulée au-delà desquels personne ne la relance plus (#2392). */
export const PLAFOND_RELANCES = 3

/** Tri par `createdAt` décroissant ; à défaut de date, l'ordre servi est conservé. PUR. */
export function triees(courses) {
  return [...(courses ?? [])]
    .map((c, rang) => ({ c, rang }))
    .sort((a, b) => parUnitesDeCode(String(b.c.createdAt ?? ''), String(a.c.createdAt ?? '')) || a.rang - b.rang)
    .map(({ c }) => c)
}

/** Les noms d'affichage se résolvent parmi les workflows actifs. */
function resoudreWorkflow(chemin, workflow, appel) {
  const selecteur = String(workflow ?? '')
  if (!selecteur) return { ok: false, raison: 'sélecteur de workflow vide' }
  if (/^\d+$|\.ya?ml$/i.test(selecteur)) return { ok: true, valeur: selecteur }
  const pages = pagesRest(chemin, appel, {
    lirePage(stdout) {
      const page = JSON.parse(stdout)
      if (!Array.isArray(page?.workflows)
        || page.workflows.some((w) => typeof w?.name !== 'string' || typeof w?.state !== 'string'))
        throw new Error('réponse REST de workflows hors schéma')
      return page.workflows
    },
  })
  if (!pages.ok) return { ok: false, raison: `workflows illisibles : ${pages.raison}` }
  const nom = selecteur.toLowerCase()
  const actifs = pages.entrees.filter((w) => w.state === 'active' && w.name.toLowerCase() === nom)
  if (!actifs.length) return { ok: false, raison: `workflow actif « ${selecteur} » introuvable` }
  if (actifs.length > 1) return { ok: false, raison: `nom de workflow « ${selecteur} » ambigu` }
  const { id } = actifs[0]
  if (!Number.isSafeInteger(id) || id < 1) return { ok: false, raison: `workflow « ${selecteur} » hors schéma : id invalide` }
  return { ok: true, valeur: id }
}

/**
 * Les courses REST d'un workflow (fichier, id ou nom). `limite` sélectionne les premières courses
 * servies ; sans limite, la liste est exhaustive. Le total de l'enveloppe distingue une réponse vide d'une
 * page incomplète, et le plafond GitHub ne gêne que les lectures qui doivent l'atteindre.
 */
export function lireCoursesRest({ depot = DEPOT, workflow = PORTE, commit, evenement, branche, limite = null, appel }) {
  const filtres = new URLSearchParams()
  if (commit) filtres.set('head_sha', commit)
  if (evenement) filtres.set('event', evenement)
  if (branche) filtres.set('branch', branche)
  if (limite !== null) filtres.set('exclude_pull_requests', 'true')
  const workflows = `repos/${depot}/actions/workflows`
  const selection = resoudreWorkflow(workflows, workflow, appel)
  if (!selection.ok) return selection
  const chemin = `${workflows}/${encodeURIComponent(selection.valeur)}/runs?${filtres}`
  const taillePage = limite === null ? PAR_PAGE : Math.min(limite, PAR_PAGE)
  let total = null
  let attendues = null
  const courses = pagesRest(chemin, appel, {
    taillePage,
    assezLu: (entrees) => entrees.length >= attendues,
    lirePage(stdout) {
      const page = JSON.parse(stdout)
      if (!Number.isSafeInteger(page?.total_count) || page.total_count < 0 || !Array.isArray(page.workflow_runs))
        throw new Error('réponse REST de courses CI hors schéma (total_count ou workflow_runs)')
      if (total !== null && total !== page.total_count)
        throw new Error(`courses CI non exhaustives : total passé de ${total} à ${page.total_count}`)
      total = page.total_count
      attendues = limite === null ? total : Math.min(total, limite)
      if (attendues > PLAFOND_DE_COURSES)
        throw new Error(`courses CI non exhaustives : ${attendues} attendues, plafond REST ${PLAFOND_DE_COURSES}`)
      if (page.workflow_runs.length > taillePage || page.workflow_runs.some((course) => !estObjet(course)))
        throw new Error('réponse REST de courses CI hors schéma (page de courses)')
      return page.workflow_runs
    },
  })
  if (!courses.ok) return courses
  if (courses.entrees.length < attendues || courses.entrees.length > total)
    return { ok: false, raison: `courses CI non exhaustives : ${courses.entrees.length} lues pour ${attendues} attendues` }
  const entrees = courses.entrees.slice(0, attendues)
  const ids = entrees.map((course) => course.id)
  if (ids.some((id) => !Number.isSafeInteger(id) || id < 1))
    return { ok: false, raison: 'course CI hors schéma : id invalide' }
  if (new Set(ids).size !== ids.length)
    return { ok: false, raison: 'courses CI non exhaustives : identifiant de run répété dans la liste REST' }
  return { ok: true, entrees }
}

/** La projection d'une course identifiée par `lireCoursesRest`. PURE. */
export function projeterCourseRest(course) {
  if (!Number.isSafeInteger(course.run_attempt) || course.run_attempt < 1)
    throw new Error(`course CI ${course.id} hors schéma : run_attempt invalide`)
  if (typeof course.created_at !== 'string' || !Number.isFinite(Date.parse(course.created_at)))
    throw new Error(`course CI ${course.id} hors schéma : created_at invalide`)
  for (const champ of ['head_sha', 'status', 'name']) {
    if (typeof course[champ] !== 'string' || !course[champ])
      throw new Error(`course CI ${course.id} hors schéma : ${champ} invalide`)
  }
  for (const champ of ['head_branch', 'conclusion']) {
    if (course[champ] !== null && typeof course[champ] !== 'string')
      throw new Error(`course CI ${course.id} hors schéma : ${champ} invalide`)
  }
  return {
    databaseId: course.id, attempt: course.run_attempt, conclusion: course.conclusion ?? '',
    createdAt: course.created_at, headBranch: course.head_branch ?? '', headSha: course.head_sha,
    status: course.status, workflowName: course.name,
  }
}

/**
 * Les courses du workflow `workflow` (fichier, id ou nom) filtrées par `commit` ou `evenement`.
 * Une liste vide est un fait. Une lecture refusée est indisponible.
 * @param {{cwd?:string, limit?:number, workflow?:string, commit?:string|null, evenement?:string|null, spawn?:Function}} p
 * @returns {{disponible:true, valeur:object[]}|{disponible:false, raison:string}}
 * @throws {TypeError} ni `commit` ni `evenement` : la question n'est pas posée.
 */
export function coursesCi({ cwd = process.cwd(), limit = 30, workflow = PORTE, commit = null, evenement = null, spawn = spawnSync } = {}) {
  if (!commit && !evenement) throw new TypeError('coursesCi : un `commit` ou un `evenement` est la question')
  if (!Number.isSafeInteger(limit) || limit < 1) return indisponible(`coursesCi : limite invalide (${limit})`)
  const lu = lireCoursesRest({ workflow, commit, evenement, limite: limit, appel(args) {
    const vu = sortieGh(spawn, args, cwd)
    return vu.disponible ? { ok: true, stdout: vu.valeur } : { ok: false, raison: vu.raison }
  } })
  if (!lu.ok) return indisponible(lu.raison)
  try {
    return fait(triees(lu.entrees.map(projeterCourseRest)))
  } catch (e) {
    return indisponible(e.message)
  }
}

/** Les noms des jobs ROUGES (`ROUGES`) et ANNULÉS (`ANNULEE`) d'une liste de jobs (forme `gh run view --json jobs`). PUR. */
export function jobsJuges(jobs) {
  const noms = (garde) => (jobs ?? []).filter((j) => garde(String(j?.conclusion ?? ''))).map((j) => String(j.name))
  return { rouges: noms((c) => ROUGES.has(c)), annules: noms((c) => c === ANNULEE) }
}

/** Le motif d'une annulation : le `message` de la première annotation `failure` d'un job
 *  (`GET repos/{depot}/check-runs/{id}/annotations`), ou `null`. PUR. */
export function motifDAnnulation(annotations) {
  const vue = (Array.isArray(annotations) ? annotations : []).find((a) => a?.annotation_level === 'failure')
  return typeof vue?.message === 'string' ? vue.message : null
}

/**
 * Les noms des jobs ROUGES et ANNULÉS de la course `id` (`gh run view <id> --json jobs`, `jobsJuges`), de
 * l'essai `attempt` s'il est nommé (`vueDeCourse`), et le `motif` du premier job annulé (`motifDAnnulation`,
 * lu seulement s'il y en a un), en union à trois issues.
 * @param {{cwd?:string, id:number, attempt?:number|null, spawn?:Function}} p
 * @returns {{disponible:true, valeur:{rouges:string[], annules:string[], motif:string|null}}|{disponible:false, raison:string}}
 */
export function jobsEnEchecDe({ cwd = process.cwd(), id, attempt = null, spawn = spawnSync }) {
  const lu = lectureGh(spawn, [...vueDeCourse(id, attempt), '--json', 'jobs'], cwd)
  if (!lu.disponible) return lu
  const jobs = lu.valeur?.jobs
  if (!Array.isArray(jobs)) return indisponible('gh n’a pas rendu de `jobs`')
  const juges = jobsJuges(jobs)
  const annule = jobs.find((j) => String(j?.conclusion ?? '') === ANNULEE)
  if (!annule) return fait({ ...juges, motif: null })
  if (!Number.isSafeInteger(annule.databaseId)) return fait({ ...juges, motif: 'motif illisible : job annulé sans `databaseId`' })
  const annotations = lectureGh(spawn, ['api', `repos/${DEPOT}/check-runs/${annule.databaseId}/annotations`], cwd)
  return fait({ ...juges, motif: annotations.disponible ? motifDAnnulation(annotations.valeur) : `motif illisible : ${annotations.raison}` })
}

/** La sortie d'un `gh <args>`, en union à trois issues. */
function sortieGh(spawn, args, cwd, { binaire = false } = {}) {
  const vu = classer(spawn('gh', args, {
    cwd, encoding: binaire ? 'buffer' : 'utf8', maxBuffer: binaire ? BORNE_JOURNAL : 32 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'], timeout: 120000,
  }))
  if (!vu.disponible) return vu
  if (vu.absent) return indisponible('gh n’a rendu aucune sortie exploitable')
  if (vu.valeur.status !== 0) return indisponible(`gh a rendu ${vu.valeur.status}`)
  return fait(vu.valeur.stdout)
}

/** La sortie JSON d'un `gh <args>`. */
function lectureGh(spawn, args, cwd) {
  const vu = sortieGh(spawn, args, cwd)
  if (!vu.disponible) return vu
  try {
    return fait(JSON.parse(vu.valeur))
  } catch (e) {
    return indisponible(e.message)
  }
}

/**
 * Verdict de la CI pour un sha, lu dans les courses TRIÉES (`coursesCi` trie `createdAt`
 * décroissant). PUR. Une conclusion inconnue n'est PAS verte : elle rougit, et se nomme.
 * @returns {{etat:'absente'|'en-vol'|'verte'|'rouge'|'annulee', course?:object}}
 */
export function verdictDesRuns(courses, sha, { workflow = WORKFLOW } = {}) {
  const notres = (courses ?? []).filter(
    (c) => String(c?.headSha ?? '') === String(sha) && (!c?.workflowName || String(c.workflowName) === workflow),
  )
  if (!notres.length) return { etat: 'absente' }
  const course = notres[0]
  if (String(course.status ?? 'completed') !== 'completed') return { etat: 'en-vol', course }
  const conclusion = String(course.conclusion ?? '')
  if (conclusion === ANNULEE) return { etat: 'annulee', course }
  if (conclusion === 'success') return { etat: 'verte', course }
  // `ROUGES` nomme les trois échecs connus ; toute AUTRE conclusion (`neutral`, `skipped`, une
  // valeur neuve de GitHub) n'est pas verte non plus — elle rougit, et le journal la porte.
  return { etat: 'rouge', course, inattendue: !ROUGES.has(conclusion) }
}

/**
 * Le verdict d'une course `rouge` ou `en-vol` (`verdictDesRuns`) jugé sur ses JOBS (`jobsEnEchecDe`). PUR.
 * Une course en vol dont un job est déjà rouge est `rouge` ; sans job rouge, elle reste en vol (#4197). Une course
 * conclue en échec dont AUCUN job n'est rouge et dont un job au moins est annulé (panne d'Actions) est
 * `annulee` : personne n'a jugé ce contenu, le geste est une relance. Sans job rouge ni annulé, elle reste
 * `rouge`, marquée `sansJobEnEchec`, pour que son lecteur le dise. Tout autre verdict passe tel quel. Le
 * verdict porte tout ce que `jobs` porte (`motif` compris).
 * @param {{etat:string, course?:object}} verdict @param {{rouges:string[], annules:string[], motif?:string|null}} jobs
 * @returns {{etat:string, course?:object, rouges:string[], annules:string[], motif?:string|null, sansJobEnEchec?:true}}
 */
export function verdictDesJobs(verdict, jobs) {
  if (verdict.etat === 'en-vol') return jobs.rouges.length ? { ...verdict, ...jobs, etat: 'rouge' } : verdict
  if (verdict.etat !== 'rouge' || jobs.rouges.length) return { ...verdict, ...jobs }
  return jobs.annules.length ? { ...verdict, ...jobs, etat: 'annulee' } : { ...verdict, ...jobs, sansJobEnEchec: true }
}

/** Ce que disent les jobs d'un verdict jugé (`verdictDesJobs`), en une phrase. PUR. */
export function phraseDesJobs({ rouges = [], annules = [], motif = null, sansJobEnEchec }) {
  if (sansJobEnEchec) return 'aucun job rouge ni annulé dans la course'
  return [
    rouges.length ? `jobs rouges : ${rouges.join(', ')}` : '',
    annules.length ? `jobs annulés : ${annules.join(', ')}` : '',
    motif ? `motif : ${motif}` : '',
  ].filter(Boolean).join(' ; ')
}

/**
 * Le verdict JUGÉ d'un sha : `verdictDesRuns`, puis, sur une course `rouge` ou `en-vol`, ses jobs (`lireJobs(id, attempt)`,
 * une union de la forme de `jobsEnEchecDe`) par `verdictDesJobs`. Des jobs illisibles laissent une course `rouge`
 * marquée `jobsIllisibles` (leur raison), et une course en vol en vol. PUR hors de `lireJobs`.
 * @param {object[]} courses @param {string} sha @param {(id:number, attempt:number|null) => object} lireJobs
 */
export function verdictJuge(courses, sha, lireJobs) {
  const lu = verdictDesRuns(courses, sha)
  if (lu.etat !== 'rouge' && lu.etat !== 'en-vol') return lu
  const jobs = lireJobs(lu.course.databaseId, lu.course.attempt ?? null)
  if (jobs.disponible) return verdictDesJobs(lu, jobs.valeur)
  return lu.etat === 'rouge' ? { ...lu, jobsIllisibles: jobs.raison } : lu
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

/**
 * Les lignes d'un journal de tentative (une ligne = `<job>\t<étape>\t<horodatage> <texte>`),
 * horodatage retiré (`HORODATAGE`) ; une ligne sans ces trois colonnes est écartée. PUR.
 * @param {string} journal @returns {{job: string, etape: string, texte: string}[]}
 */
export function lignesDuJournal(journal) {
  const lignes = []
  for (const brute of String(journal ?? '').split(/\r?\n/)) {
    const [job, etape, ...reste] = brute.split('\t')
    if (reste.length) lignes.push({ job, etape, texte: reste.join('\t').replace(HORODATAGE, '') })
  }
  return lignes
}

/**
 * Les ÉCHECS d'un journal de tentative filtré (une ligne = `<job>\t<étape>\t<horodatage> <texte>`),
 * par job dans l'ordre du journal. `etape` : l'étape fautive, celle de la PREMIÈRE erreur du job — sa
 * colonne d'étape, ou, quand le projecteur l'écrit `UNKNOWN STEP`, le dernier `##[group]Run …` ouvert avant elle.
 * `lignes` : ses lignes de test en échec, dédoublonnées et bornées à `borne`, puis sa PREMIÈRE ligne
 * `##[error]` qui n'est pas GÉNÉRIQUE (`ERREUR_GENERIQUE`) ; À DÉFAUT de toute ligne reconnue, les
 * `contexte` dernières lignes non vides (hors directives) de son étape avant la première erreur. `tues` compte les
 * lignes de test au-delà de la borne. PUR.
 * @param {string} journal @param {{borne?: number, contexte?: number}} [opts]
 * @returns {{job: string, etape: string|null, lignes: string[], tues: number}[]}
 */
export function echecsDuLog(journal, { borne = BORNE_LIGNES_D_ECHEC, contexte = BORNE_LIGNES_DE_CONTEXTE } = {}) {
  const parJob = new Map()
  for (const { job, etape: colonne, texte } of lignesDuJournal(journal)) {
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

const cheminDeCourse = (id) => `repos/${DEPOT}/actions/runs/${id}`
const identifiantPositif = (id) => Number.isSafeInteger(id) && id > 0

/** Conclusions de `IsFailureState` pour le journal filtré de GitHub CLI. */
const CONCLUSIONS_DU_JOURNAL_D_ECHEC = new Set(['action_required', 'failure', 'startup_failure', 'timed_out'])
const estEchecDuJournal = (conclusion) => CONCLUSIONS_DU_JOURNAL_D_ECHEC.has(conclusion)

/** Épingle le dernier essai avant les lectures qui doivent décrire la même exécution. */
export function derniereTentativeDe({ cwd = process.cwd(), id, spawn = spawnSync }) {
  if (!identifiantPositif(id)) return indisponible('identifiant de course invalide')
  const run = lectureGh(spawn, ['api', cheminDeCourse(id)], cwd)
  if (!run.disponible) return run
  if (run.valeur?.id !== id || !identifiantPositif(run.valeur?.run_attempt))
    return indisponible(`course ${id} : identité ou tentative REST illisible`)
  return fait(run.valeur.run_attempt)
}

/**
 * Le journal REST de la course `id` et de l'essai `attempt`, ou du dernier essai épinglé.
 * En mode `echecsSeuls`, projette les étapes en échec ou le journal du job rouge.
 * @param {{cwd?:string, id:number, attempt?:number|null, echecsSeuls:boolean, spawn?:Function}} p
 * @returns {{disponible:true, valeur:string}|{disponible:false, raison:string}}
 * @throws {TypeError} `echecsSeuls` n'est pas un booléen : la question n'est pas posée.
 */
export function journalDe({ echecsSeuls, ...parametres }) {
  if (typeof echecsSeuls !== 'boolean') throw new TypeError('journalDe : `echecsSeuls` est la question')
  const essai = essaiDe(parametres)
  return essai.disponible ? essai.valeur.journal({ echecsSeuls }) : essai
}

/** Les jobs d'un essai terminé et son journal à la demande, épinglés au même essai. */
export function essaiDe({ cwd = process.cwd(), id, attempt = null, spawn = spawnSync }) {
  if (!identifiantPositif(id)) return indisponible('identifiant de course invalide')
  const essai = attempt === null ? derniereTentativeDe({ cwd, id, spawn }) : fait(attempt)
  if (!essai.disponible) return essai
  if (!identifiantPositif(essai.valeur)) return indisponible(`course ${id} : tentative invalide`)

  const libelle = `course ${id}, essai ${essai.valeur}`
  const vue = lectureGh(spawn, [...vueDeCourse(id, essai.valeur), '--json', 'jobs,startedAt,status'], cwd)
  if (!vue.disponible) return vue
  const { jobs, startedAt, status } = vue.valeur ?? {}
  if (status !== 'completed' || !Array.isArray(jobs))
    return indisponible(`${libelle} : jobs illisibles ou tentative non terminée`)

  function journal({ echecsSeuls }) {
    if (echecsSeuls && !jobs.some((job) => estEchecDuJournal(job?.conclusion))) return fait('')

    const chemin = `${cheminDeCourse(id)}/attempts/${essai.valeur}/logs`
    const archive = sortieGh(spawn, ['api', chemin], cwd, { binaire: true })
    if (!archive.disponible) {
      const raison = archive.raison.replace(/(https?:\/\/[^\s"'?]+)\?[^\s"']+/g, '$1?[masqué]')
      return indisponible(raison, { issue: archive.issue })
    }
    try {
      const debutEssai = essai.valeur > 1 ? Date.parse(startedAt) : NaN
      return fait(projeterJournal(archive.valeur, jobs, { echecsSeuls, estRouge: estEchecDuJournal, debutEssai }))
    } catch (e) {
      return indisponible(`${libelle} : journal illisible — ${e.message}`)
    }
  }
  return fait({ jobs, journal })
}
