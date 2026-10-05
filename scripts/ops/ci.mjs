// LA CI D'UN SHA, ATTENDUE PAR UN PROCESSUS QUI SORT (#2280, V1) — le symétrique, pour la CI d'une
// branche, de la veille du train (`veillerLeTrain`, publier.mjs) : une session le lance en FOND et
// lit sa sortie quand il sort, sans aucun `sleep` ni `gh run` de sa part.
//
// `--attendre [<sha>]` attend la course `CI` du sha (défaut : le sha POUSSÉ de la branche de son
// arbre, `shasDistants`), relue toutes les `PERIODE_SONDE_MS`, et sort sur un verdict, un code par
// verdict (`CODES_DE_CI`). Une course ROUGE nomme, par job rouge (`jobsRougesDe`), ses lignes de test
// en échec (`echecsDuLog`). `--echecs <run>` rend la même extraction pour une course nommée.
//
// Usage : node scripts/ops/ci.mjs --attendre [<sha>] | --echecs <run>
import { fileURLToPath } from 'node:url'
import { GitIndisponible, brancheDe, depotDe, estShaComplet, shasDistants } from '../guards/lib/gitPorte.mjs'
import { coursesCi, echecsDuLog, jobsRougesDe, journalEnEchecDe } from '../guards/lib/coursesCi.mjs'
import { DEPOT } from '../guards/lib/ticketsGh.mjs'
import { PERIODE_SONDE_MS, attendre, refusDeBranche, verdictDesRuns } from './etapesDuTrain.mjs'
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
 * Les échecs de la course `id`, lus (`jobsRougesDe`, `journalEnEchecDe`) et nommés (`lignesDuRouge`), en
 * union.
 * @param {{cwd:string, id:number, spawn?:Function}} p `spawn` va aux deux lectures `gh`
 * @returns {{disponible:true, valeur:string[]}|{disponible:false, raison:string}}
 */
export function echecsDeLaCourse({ cwd, id, spawn }) {
  const jobs = jobsRougesDe({ cwd, id, spawn })
  if (!jobs.disponible) return jobs
  const journal = journalEnEchecDe({ cwd, id, spawn })
  if (!journal.disponible) return journal
  return { disponible: true, valeur: lignesDuRouge({ jobs: jobs.valeur, echecs: echecsDuLog(journal.valeur) }) }
}

/** La ligne finale `CI:` d'un verdict. PURE. */
export function ligneDeCi(verdict, sha) {
  const url = verdict.course ? ` ${urlDeCourse(verdict.course.databaseId)}` : ''
  if (verdict.etat === 'absente') return `CI: absente ${sha} — aucune course en ${BORNE_ABSENTE_MIN} min`
  if (verdict.etat === 'borne') return `CI: borne de ${BORNE_ATTENTE_MIN} min dépassée sans verdict pour ${sha}`
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

function main() {
  const options = optionsDe(process.argv.slice(2))
  const ecrire = (ligne) => process.stdout.write(`${ligne}\n`)
  const panne = (motif) => {
    process.stderr.write(`[ci] ${motif}\n`)
    return CODE_PANNE
  }
  if (!options) return panne('usage : node scripts/ops/ci.mjs --attendre [<sha complet>] | --echecs <run>')
  if (options.echecs) {
    const vu = echecsDeLaCourse({ cwd: RACINE, id: options.echecs })
    if (!vu.disponible) return panne(`course ${options.echecs} illisible : ${vu.raison}`)
    ecrire(`échecs de ${urlDeCourse(options.echecs)}`)
    vu.valeur.forEach(ecrire)
    return 0
  }
  let sha = options.sha
  if (!sha) {
    const pousse = shaPousse({ depot: depotDe(RACINE), filtres: branchesDePush(texteDeCi({ cwd: RACINE }), `${DOSSIER}/${PORTE}`) })
    if (pousse.refus) return panne(pousse.refus)
    sha = pousse.sha
  }
  const verdict = attendreLaCi({ sha, lire: () => coursesCi({ cwd: RACINE, commit: sha, limit: 30 }), ecrire })
  ecrire(ligneDeCi(verdict, sha))
  if (verdict.etat === 'rouge') {
    const vu = echecsDeLaCourse({ cwd: RACINE, id: verdict.course.databaseId })
    if (vu.disponible) vu.valeur.forEach(ecrire)
    else ecrire(`  échecs illisibles : ${vu.raison} — \`node scripts/ops/ci.mjs --echecs ${verdict.course.databaseId}\``)
  }
  return CODES_DE_CI[verdict.etat]
}

/** `main`, dont TOUTE exception sort en `CODE_PANNE` nommée sur stderr : jamais en 1, le code du rouge. */
function mainNomme() {
  try {
    return main()
  } catch (e) {
    process.stderr.write(e instanceof GitIndisponible ? `[ci] git indisponible : ${e.raison}\n` : `[ci] ARRÊT INATTENDU : ${e?.stack ?? e}\n`)
    return CODE_PANNE
  }
}

if (import.meta.main) process.exit(mainNomme())
