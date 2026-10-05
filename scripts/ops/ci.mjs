// LA CI D'UN SHA, ATTENDUE PAR UN PROCESSUS QUI SORT (#2280, V1) — le symétrique, pour la CI d'une
// branche, de la veille du train (`veillerLeTrain`, publier.mjs) : une session le lance en FOND et
// lit sa sortie quand il sort, sans aucun `sleep` ni `gh run` de sa part.
//
// `--attendre [<sha>]` attend la course `CI` du sha (défaut : le sha POUSSÉ de la branche de son
// arbre, `shasDistants`), relue toutes les `PERIODE_SONDE_MS`, et sort sur un verdict, un code par
// verdict (`CODES_DE_CI`). Une course rouge se juge sur ses jobs (`verdictDesJobs`) : sans job rouge et avec un
// job annulé, elle est annulée ; rouge, elle nomme, par job rouge (`jobsEnEchecDe`), ses lignes de test
// en échec (`echecsDuLog`). `--echecs <run>` rend la même extraction pour une course nommée.
//
// Usage : node scripts/ops/ci.mjs --attendre [<sha>] | --echecs <run>
import { fileURLToPath } from 'node:url'
import { GitIndisponible, brancheDe, depotDe, estShaComplet, shasDistants } from '../guards/lib/gitPorte.mjs'
import { coursesCi, echecsDuLog, jobsEnEchecDe, journalEnEchecDe } from '../guards/lib/coursesCi.mjs'
import { DEPOT } from '../guards/lib/ticketsGh.mjs'
import { PERIODE_SONDE_MS, attendre, phraseDesJobs, refusDeBranche, verdictDesJobs, verdictDesRuns } from './etapesDuTrain.mjs'
import { texteDeCi } from '../gates/gatesDeCi.mjs'
import { DOSSIER, PORTE, branchesDePush } from '../gates/workflowsDuDepot.mjs'
import { DELAI_DE_REPONSE_MINUTES } from './ruleset-main.mjs'
import { CODE_BORNE_DEPASSEE } from './publier.mjs'

/** L'arbre où VIT ce script : sa branche est celle dont on attend la CI. */
const RACINE = fileURLToPath(new URL('../..', import.meta.url))

/** Borne de l'attente, en minutes : le délai de réponse d'un check de la file (`DELAI_DE_REPONSE_MINUTES`). */
export const BORNE_ATTENTE_MIN = DELAI_DE_REPONSE_MINUTES

/** Borne, en minutes, au-delà de laquelle un sha sans AUCUNE course est jugé `absente` : valeur maison,
 *  une course de `push` paraît en secondes ; son absence prolongée dit un push qu'aucun filtre ne déclenche. */
export const BORNE_ABSENTE_MIN = 5

/** Code de sortie de chaque issue de l'attente ; `CODE_BORNE_DEPASSEE` est celui de la veille du train. */
export const CODES_DE_CI = Object.freeze({ verte: 0, rouge: 1, annulee: 6, absente: 7, borne: CODE_BORNE_DEPASSEE })

/** Code de sortie d'une panne (arguments, git, gh) : rien n'a été jugé. */
export const CODE_PANNE = 2

/**
 * Les options. PURE. `{ attendre: true, sha: string|null }`, `{ echecs: number }`, ou `null` (refusées).
 * @param {string[]} argv arguments APRÈS `node ci.mjs`
 */
export function optionsDe(argv) {
  const [geste, valeur, ...reste] = (argv ?? []).map(String)
  if (reste.length) return null
  if (geste === '--attendre' && (valeur === undefined || estShaComplet(valeur))) return { attendre: true, sha: valeur ?? null }
  if (geste === '--echecs' && /^[1-9]\d*$/.test(String(valeur ?? ''))) return { echecs: Number(valeur) }
  return null
}

/** L'URL d'une course. PURE. */
export const urlDeCourse = (id) => `https://github.com/${DEPOT}/actions/runs/${id}`

/**
 * L'ATTENTE de la course `CI` de `sha` : relit les courses (`lire`, une union de `coursesCi`) toutes les
 * `periodeMs`, émet une ligne par changement d'état, et rend le verdict qui la termine. PURE hors des
 * fonctions qu'on lui donne. `absente` passé `borneAbsenteMs` sans course, `borne` passé `borneMs` sans
 * verdict ; une lecture indisponible se dit, et l'attente continue.
 * @param {{sha:string, lire:() => {disponible:boolean, valeur?:object[], raison?:string}, ecrire:(ligne:string) => void,
 *          maintenant?:() => number, dormir?:(ms:number) => void, periodeMs?:number, borneMs?:number, borneAbsenteMs?:number}} p
 * @returns {{etat:'verte'|'rouge'|'annulee'|'absente'|'borne', course?:object}}
 */
export function attendreLaCi({
  sha, lire, ecrire, maintenant = Date.now, dormir = attendre,
  periodeMs = PERIODE_SONDE_MS, borneMs = BORNE_ATTENTE_MIN * 60_000, borneAbsenteMs = BORNE_ABSENTE_MIN * 60_000,
}) {
  const debut = maintenant()
  let dit = null
  for (;;) {
    const vues = lire()
    const verdict = vues.disponible ? verdictDesRuns(vues.valeur, sha) : null
    const ligne = verdict
      ? `[ci] ${sha.slice(0, 9)} ${verdict.etat}${verdict.course ? ` — ${urlDeCourse(verdict.course.databaseId)} (essai ${verdict.course.attempt ?? 1})` : ''}`
      : `[ci] ${sha.slice(0, 9)} courses illisibles : ${vues.raison}`
    if (ligne !== dit) ecrire(ligne)
    dit = ligne
    if (verdict && ['verte', 'rouge', 'annulee'].includes(verdict.etat)) return verdict
    const ecoule = maintenant() - debut
    if (verdict?.etat === 'absente' && ecoule >= borneAbsenteMs) return { etat: 'absente' }
    if (ecoule >= borneMs) return { etat: 'borne' }
    dormir(Math.max(0, Math.min(periodeMs, borneMs - ecoule)))
  }
}

/**
 * Les lignes qui NOMMENT un rouge : par job rouge, son étape fautive et ses lignes d'échec (`echecsDuLog`) ;
 * un job rouge que le journal en échec ne porte pas se dit tel. PURE.
 * @param {{jobs:string[], echecs:{job:string, etape:string|null, lignes:string[], tues:number}[]}} p
 * @returns {string[]}
 */
export function lignesDuRouge({ jobs, echecs }) {
  return jobs.flatMap((job) => {
    const vu = echecs.find((e) => e.job === job)
    if (!vu) return [`  ${job} : absent du journal en échec (\`gh run view --log-failed\`)`]
    return [
      `  ${job}${vu.etape ? ` — ${vu.etape}` : ''} :`,
      ...vu.lignes.map((l) => `    ${l}`),
      ...(vu.tues ? [`    (+${vu.tues} autres tests en échec)`] : []),
    ]
  })
}

/**
 * Les jobs en échec de la course `id` (`jobsEnEchecDe`) et leurs `lignes` : par job rouge, ses lignes
 * d'échec (`journalEnEchecDe`, `lignesDuRouge`, lu seulement s'il y a un job rouge) ; par job annulé, son nom ;
 * sans l'un ni l'autre, la phrase qui le dit (`phraseDesJobs`). En union.
 * @param {{cwd:string, id:number, attempt?:number|null, spawn?:Function}} p `attempt` : l'essai jugé, sinon le
 *   dernier ; `spawn` va aux deux lectures `gh`
 * @returns {{disponible:true, valeur:{rouges:string[], annules:string[], lignes:string[]}}|{disponible:false, raison:string}}
 */
export function echecsDeLaCourse({ cwd, id, attempt = null, spawn }) {
  const jobs = jobsEnEchecDe({ cwd, id, attempt, spawn })
  if (!jobs.disponible) return jobs
  const { rouges, annules } = jobs.valeur
  let rougesNommes = []
  if (rouges.length) {
    const journal = journalEnEchecDe({ cwd, id, attempt, spawn })
    if (!journal.disponible) return journal
    rougesNommes = lignesDuRouge({ jobs: rouges, echecs: echecsDuLog(journal.valeur) })
  }
  const lignes = [...rougesNommes, ...annules.map((job) => `  ${job} : annulé`)]
  return { disponible: true, valeur: { rouges, annules, lignes: lignes.length ? lignes : [`  ${phraseDesJobs({ ...jobs.valeur, sansJobEnEchec: true })}`] } }
}

/** La ligne finale `CI:` d'un verdict. PURE. */
export function ligneDeCi(verdict, sha) {
  const url = verdict.course ? ` ${urlDeCourse(verdict.course.databaseId)}` : ''
  if (verdict.etat === 'absente') return `CI: absente ${sha} — aucune course en ${BORNE_ABSENTE_MIN} min`
  if (verdict.etat === 'borne') return `CI: borne de ${BORNE_ATTENTE_MIN} min dépassée sans verdict pour ${sha}`
  if (verdict.etat === 'annulee') return `CI: annulee ${sha}${url} — personne n’a jugé ce contenu : relancer la course`
  return `CI: ${verdict.etat} ${sha}${url}`
}

/**
 * Le sha POUSSÉ de la branche du dépôt, ou le refus nommé : HEAD détaché, branche qu'aucun filtre
 * `push.branches` de `ci.yml` ne déclenche (`refusDeBranche`, `filtres` = `branchesDePush`), origine
 * illisible, branche non poussée.
 * @param {{depot: import('../guards/lib/gitPorte.mjs').Depot, filtres: string[]|null}} p
 * @returns {{sha: string}|{refus: string}}
 */
export function shaPousse({ depot, filtres }) {
  const branche = brancheDe(depot)
  if (!branche) return { refus: `${depot.cwd} : HEAD détaché, aucune branche dont attendre la CI — nommer le sha` }
  const horsCi = refusDeBranche(branche, filtres)
  if (horsCi) return { refus: horsCi }
  const ref = `refs/heads/${branche}`
  const distants = shasDistants(depot, [ref])
  if (!distants) return { refus: `origine illisible : \`git ls-remote origin ${ref}\` n’a pas répondu` }
  const sha = distants.get(ref)
  return sha ? { sha } : { refus: `${branche} n’est pas poussée sur origin — rien à attendre` }
}

/**
 * Le geste entier de la ligne de commande, ses lectures injectables : `lire(sha)` (les courses du sha),
 * `echecs({id, attempt})` (`echecsDeLaCourse`), `pousse()` (`shaPousse` de l'arbre). Rend le code de sortie.
 * @param {{argv:string[], ecrire:(ligne:string) => void, panne:(motif:string) => number, lire:Function, echecs:Function, pousse:Function}} p
 * @returns {number}
 */
function principal({ argv, ecrire, panne, lire, echecs, pousse }) {
  const options = optionsDe(argv)
  if (!options) return panne('usage : node scripts/ops/ci.mjs --attendre [<sha complet>] | --echecs <run>')
  if (options.echecs) {
    const vu = echecs({ id: options.echecs })
    if (!vu.disponible) return panne(`course ${options.echecs} illisible : ${vu.raison}`)
    ecrire(`échecs de ${urlDeCourse(options.echecs)}`)
    vu.valeur.lignes.forEach(ecrire)
    return 0
  }
  let sha = options.sha
  if (!sha) {
    const vu = pousse()
    if (vu.refus) return panne(vu.refus)
    sha = vu.sha
  }
  const verdict = attendreLaCi({ sha, lire: () => lire(sha), ecrire })
  if (verdict.etat !== 'rouge') {
    ecrire(ligneDeCi(verdict, sha))
    return CODES_DE_CI[verdict.etat]
  }
  const vu = echecs({ id: verdict.course.databaseId, attempt: verdict.course.attempt ?? null })
  if (!vu.disponible) {
    ecrire(ligneDeCi(verdict, sha))
    ecrire(`  jobs illisibles : ${vu.raison} — \`node scripts/ops/ci.mjs --echecs ${verdict.course.databaseId}\``)
    return CODES_DE_CI.rouge
  }
  const juge = verdictDesJobs(verdict, vu.valeur)
  ecrire(ligneDeCi(juge, sha))
  vu.valeur.lignes.forEach(ecrire)
  return CODES_DE_CI[juge.etat]
}

/**
 * `principal` sur les lectures RÉELLES de `RACINE` (les injectées pour la mesure), dont TOUTE exception
 * sort en `CODE_PANNE` nommée par `erreur` : jamais en 1, le code du rouge.
 * @param {{argv:string[], sortie?:(texte:string) => void, erreur?:(texte:string) => void, lire?:Function, echecs?:Function, pousse?:Function}} p
 * @returns {number}
 */
export function executer({
  argv,
  sortie = (texte) => process.stdout.write(texte),
  erreur = (texte) => process.stderr.write(texte),
  lire = (sha) => coursesCi({ cwd: RACINE, commit: sha, limit: 30 }),
  echecs = (p) => echecsDeLaCourse({ cwd: RACINE, ...p }),
  pousse = () => shaPousse({ depot: depotDe(RACINE), filtres: branchesDePush(texteDeCi({ cwd: RACINE }), `${DOSSIER}/${PORTE}`) }),
}) {
  const panne = (motif) => {
    erreur(`[ci] ${motif}\n`)
    return CODE_PANNE
  }
  try {
    return principal({ argv, ecrire: (ligne) => sortie(`${ligne}\n`), panne, lire, echecs, pousse })
  } catch (e) {
    return panne(e instanceof GitIndisponible ? `git indisponible : ${e.raison}` : `ARRÊT INATTENDU : ${e?.stack ?? e}`)
  }
}

if (import.meta.main) process.exit(executer({ argv: process.argv.slice(2) }))
