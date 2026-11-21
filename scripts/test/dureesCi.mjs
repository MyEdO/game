// DURÉES DE LA CI (#2497, #2474) : les durées par fichier lues au JOURNAL de la dernière course `merge_group`
// réussie avec mesures (`referenceCi`), mémorisées sous `durees-ci.json` (`rapatrierDureesCi`) pour
// `scripts/test/perimetre.mjs`. Vitest : la ligne de module de son reporter par défaut, jobs `suite i/K`
// (`LIGNE_VITEST`, `PARTIE`) ; node : la ligne `[durees] node <gate> {json}` de `scripts/test/node-tests.mjs`.
import { spawnSync } from 'node:child_process'
import { coursesCi, essaiDe, lignesDuJournal } from '../guards/lib/coursesCi.mjs'
import { SUFFIXE_SUITE } from '../guards/lib/fichierVitest.mjs'
import { fait, indisponible } from '../guards/lib/gitPorte.mjs'
import { dureesValides } from './mesures.mjs'
import { estObjet } from '../../src/lib/objet.mjs'

/** Le mémo des durées de la CI, sous `dossierDesMesures` : `{ run, attempt, sha, date, vitest, node }`. */
export const DUREES_CI = 'durees-ci.json'

/** Le job d'une partie de la suite Vitest (`ci.yml`, `suite i/K`). */
const JOB_DE_SUITE = /^suite (\d+)\/(\d+)$/

/** La ligne de MODULE du reporter Vitest par défaut (`getModuleLog`, `getStateSymbol` : ✓ réussi, × ou ❯ en
 *  échec, ↓ sauté), un espace de tête : `<symbole> <fichier> (<compte>) <n>ms`, le fichier une suite (`SUFFIXE_SUITE`). */
const LIGNE_VITEST = new RegExp(String.raw`^ [✓×❯↓] (\S+${SUFFIXE_SUITE}) \([^)]*\) (\d+)ms(?: |$)`)

/** Le bilan d'une partie (`scripts/test/run.mjs`) : `[partie] i/K : N fichier(s) sur T`. */
const PARTIE = /^\[partie\] (\d+\/\d+) : (\d+) fichier\(s\)/

/** La ligne de durées d'une gate node (`scripts/test/node-tests.mjs`). */
const LIGNE_NODE = /^\[durees\] node (\S+) (\{.*\})$/

/**
 * Les durées par fichier d'un journal de tentative complet (`lignesDuJournal`). `lus` : les durées Vitest lues ;
 * `attendus` : la somme des fichiers annoncés par les `[partie]`, chacune comptée une fois ; `parties` : les `i/K`
 * lues ; `manquantes` : les `i/K` absentes, i ∈ 1..K de chaque K lu ; `illisibles` : les gates dont la ligne
 * `[durees] node` ne se lit pas. PURE.
 * @param {string} journal
 * @returns {{ vitest: Record<string, number>, node: Record<string, number>, lus: number, attendus: number, parties: string[], manquantes: string[], illisibles: string[] }}
 */
export function dureesDuJournal(journal) {
  const vitest = {}
  const node = {}
  const parties = new Map()
  const illisibles = []
  let lus = 0
  for (const { job, texte } of lignesDuJournal(journal)) {
    const partie = PARTIE.exec(texte)
    if (partie && JOB_DE_SUITE.test(job)) parties.set(partie[1], Number(partie[2]))
    const module = JOB_DE_SUITE.test(job) && LIGNE_VITEST.exec(texte)
    if (module) {
      vitest[module[1]] = Number(module[2])
      lus += 1
    }
    const gate = LIGNE_NODE.exec(texte.trim())
    if (gate) {
      let lu
      try { lu = JSON.parse(gate[2]) } catch { illisibles.push(gate[1]); continue }
      Object.assign(node, dureesValides(lu))
    }
  }
  const totaux = new Set([...parties.keys()].map((p) => Number(p.split('/')[1])))
  const manquantes = [...totaux].flatMap((k) => Array.from({ length: k }, (_, i) => `${i + 1}/${k}`).filter((p) => !parties.has(p)))
  return { vitest, node, lus, attendus: [...parties.values()].reduce((a, b) => a + b, 0), parties: [...parties.keys()].sort(), manquantes, illisibles }
}

/**
 * Le mémo `durees-ci.json` lu (`lu`), validé : sa forme `{ run, attempt, sha, date, vitest, node }`, durées
 * filtrées aux nombres finis ≥ 0 ; `{}` sur toute autre forme. PURE.
 * @returns {{ run: number, attempt: number | null, sha: string, date: string, vitest: Record<string, number>, node: Record<string, number> } | {}}
 */
export function memoCiDe(lu) {
  if (!estObjet(lu)) return {}
  const { run, attempt, sha, date, vitest, node } = lu
  if (!Number.isSafeInteger(run) || !(attempt === null || Number.isSafeInteger(attempt)) || typeof sha !== 'string' || typeof date !== 'string') return {}
  return { run, attempt, sha, date, vitest: dureesValides(vitest), node: dureesValides(node) }
}

/**
 * Une course documentaire a toutes les tranches de sa matrice, chacune avec son étape `Run npm test`
 * explicitement sautée. Une métadonnée incomplète demande la lecture du journal.
 */
function suitesToutesSautees(jobs) {
  const tranches = new Set()
  let total
  for (const job of jobs) {
    const partie = JOB_DE_SUITE.exec(job?.name)
    if (!partie) continue
    const numero = Number(partie[1])
    const denominateur = Number(partie[2])
    total ??= denominateur
    if (denominateur !== total || !Number.isSafeInteger(total) || !Number.isSafeInteger(numero)
      || numero < 1 || numero > total || tranches.has(numero)) return false
    const etapes = Array.isArray(job.steps) ? job.steps.filter((etape) => etape?.name === 'Run npm test') : []
    if (etapes.length !== 1 || etapes[0].conclusion !== 'skipped') return false
    tranches.add(numero)
  }
  return tranches.size === total
}

function memoDuJournal(journal, { run, attempt, sha, date }) {
  const { vitest, node, lus, attendus, parties, manquantes, illisibles } = dureesDuJournal(journal)
  if (!parties.length) return fait({ etat: 'refus', raison: `course ${run} : aucune ligne [partie] au journal` })
  if (manquantes.length) return fait({ etat: 'refus', raison: `course ${run} : partie(s) absente(s) du journal : ${manquantes.join(', ')}` })
  if (illisibles.length) return fait({ etat: 'refus', raison: `course ${run} : ligne [durees] node illisible : ${illisibles.join(', ')}` })
  if (!lus) return fait({ etat: 'refus', raison: `course ${run} : aucune durée Vitest au journal` })
  if (lus < attendus) return fait({ etat: 'refus', raison: `course ${run} : ${lus} durée(s) Vitest lue(s) pour ${attendus} fichier(s) annoncé(s)` })
  return fait({ etat: 'aRapatrier', memo: { run, attempt, sha, date, vitest, node } })
}

/** La référence parmi les courses `merge_group` réussies récentes, dans l'ordre donné par `coursesCi`. */
function referenceCi({ mesures, cwd, spawn }) {
  const courses = coursesCi({ cwd, evenement: 'merge_group', spawn })
  if (!courses.disponible) return courses
  const reussies = courses.valeur.filter((c) => c.status === 'completed' && c.conclusion === 'success')
  if (!reussies.length) return indisponible(`aucune course merge_group réussie parmi les ${courses.valeur.length} dernières`)

  const actuel = mesures.lire(DUREES_CI, memoCiDe)
  for (const { databaseId: run, attempt, headSha: sha, createdAt: date } of reussies) {
    if (actuel.run === run && actuel.attempt === attempt) return fait({ etat: 'deja', memo: actuel })
    const essai = essaiDe({ cwd, id: run, attempt, spawn })
    if (!essai.disponible) return essai
    if (suitesToutesSautees(essai.valeur.jobs)) continue

    const journal = essai.valeur.journal({ echecsSeuls: false })
    return journal.disponible ? memoDuJournal(journal.valeur, { run, attempt, sha, date }) : journal
  }
  return fait({ etat: 'refus', raison: `aucune référence CI mesurée parmi les ${reussies.length} courses merge_group réussies : tranches Vitest toutes explicitement sautées` })
}

/**
 * Rapatrie le journal complet de la référence dans le mémo `DUREES_CI`.
 * Les courses aux tranches explicitement sautées sont franchies sans télécharger leur journal.
 * Un journal incomplet, un accès indisponible ou une erreur d'écriture préserve le dernier mémo.
 * @param {{ mesures: { lire: Function, remplacer: Function }, cwd?: string, spawn?: Function }} p
 * @returns {{ disponible: true, valeur: { etat: 'deja' | 'rapatrie', memo: object } | { etat: 'refus', raison: string } } | { disponible: false, raison: string }}
 */
export function rapatrierDureesCi({ mesures, cwd = process.cwd(), spawn = spawnSync }) {
  const reference = referenceCi({ mesures, cwd, spawn })
  if (!reference.disponible || reference.valeur.etat !== 'aRapatrier') return reference
  const { memo } = reference.valeur
  try {
    mesures.remplacer(DUREES_CI, memo)
  } catch (erreur) {
    return indisponible(`mémo ${DUREES_CI} non écrit — ${erreur instanceof Error ? erreur.message : String(erreur)}`)
  }
  return fait({ etat: 'rapatrie', memo })
}
