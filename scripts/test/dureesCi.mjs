// DURÉES DE LA CI (#2497, #2474) : les durées par fichier lues au JOURNAL de la dernière course `merge_group`
// réussie (`referenceCi`, `journalDe`), mémorisées sous `durees-ci.json` (`rapatrierDureesCi`) pour
// `scripts/test/perimetre.mjs`. Vitest : la ligne de module de son reporter par défaut, jobs `suite i/K`
// (`LIGNE_VITEST`, `PARTIE`) ; node : la ligne `[durees] node <gate> {json}` de `scripts/test/node-tests.mjs`.
import { spawnSync } from 'node:child_process'
import { coursesCi, journalDe, lignesDuJournal } from '../guards/lib/coursesCi.mjs'
import { fait, indisponible } from '../guards/lib/gitPorte.mjs'

/** Le mémo des durées de la CI, sous `dossierDesMesures` : `{ run, attempt, sha, date, vitest, node }`. */
export const DUREES_CI = 'durees-ci.json'

/** Le job d'une partie de la suite Vitest (`ci.yml`, `suite i/K`). */
const JOB_DE_SUITE = /^suite \d+\/\d+$/

/** La ligne de MODULE du reporter Vitest par défaut (`getModuleLog`, `getStateSymbol` : ✓ réussi, × ou ❯ en
 *  échec, ↓ sauté), un espace de tête : `<symbole> <fichier> (<compte>) <n>ms`. */
const LIGNE_VITEST = /^ [✓×❯↓] (\S+\.(?:test|spec)\.\w+) \([^)]*\) (\d+)ms(?: |$)/

/** Le bilan d'une partie (`scripts/test/run.mjs`) : `[partie] i/K : N fichier(s) sur T`. */
const PARTIE = /^\[partie\] (\d+\/\d+) : (\d+) fichier\(s\)/

/** La ligne de durées d'une gate node (`scripts/test/node-tests.mjs`). */
const LIGNE_NODE = /^\[durees\] node (\S+) (\{.*\})$/

/** Les entrées `{ [fichier]: ms }` d'un objet dont la valeur est un nombre fini ≥ 0. PURE. */
export const dureesValides = (lu) => lu !== null && typeof lu === 'object' && !Array.isArray(lu)
  ? Object.fromEntries(Object.entries(lu).filter(([, ms]) => Number.isFinite(ms) && ms >= 0))
  : {}

/**
 * Les durées par fichier d'un journal `gh run view <id> --log` (`lignesDuJournal`). `lus` : les durées Vitest lues ;
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
  if (lu === null || typeof lu !== 'object' || Array.isArray(lu)) return {}
  const { run, attempt, sha, date, vitest, node } = lu
  if (!Number.isSafeInteger(run) || !(attempt === null || Number.isSafeInteger(attempt)) || typeof sha !== 'string' || typeof date !== 'string') return {}
  return { run, attempt, sha, date, vitest: dureesValides(vitest), node: dureesValides(node) }
}

/**
 * La course de RÉFÉRENCE : la course `merge_group` RÉUSSIE la plus récente (`coursesCi`, triées), en union.
 * @param {{ cwd?: string, spawn?: Function }} p
 * @returns {{ disponible: true, valeur: object } | { disponible: false, raison: string }}
 */
export function referenceCi({ cwd = process.cwd(), spawn = spawnSync } = {}) {
  const courses = coursesCi({ cwd, evenement: 'merge_group', spawn })
  if (!courses.disponible) return courses
  const reussie = courses.valeur.find((c) => c.status === 'completed' && c.conclusion === 'success')
  return reussie ? fait(reussie) : indisponible(`aucune course merge_group réussie parmi les ${courses.valeur.length} dernières`)
}

/**
 * RAPATRIE les durées de la course de référence (`referenceCi`) dans le mémo `DUREES_CI` de `mesures`
 * (`remplacer`, sans fusion). La course déjà mémorisée n'est pas relue (`deja`) ; un journal INCOMPLET — sans
 * `[partie]`, une partie manquante, une ligne `[durees] node` illisible, aucune durée Vitest ou moins que les
 * attendues — est REFUSÉ (`refus`), mémo inchangé ; gh, réseau ou écriture
 * indisponibles : `{ disponible: false, raison }`, mémo inchangé.
 * @param {{ mesures: { lire: Function, remplacer: Function }, cwd?: string, spawn?: Function }} p
 * @returns {{ disponible: true, valeur: { etat: 'deja' | 'rapatrie', memo: object } | { etat: 'refus', raison: string } } | { disponible: false, raison: string }}
 */
export function rapatrierDureesCi({ mesures, cwd = process.cwd(), spawn = spawnSync }) {
  const reference = referenceCi({ cwd, spawn })
  if (!reference.disponible) return reference
  const { databaseId: run, attempt = null, headSha: sha, createdAt: date } = reference.valeur
  const actuel = mesures.lire(DUREES_CI, memoCiDe)
  if (actuel.run === run && actuel.attempt === attempt) return fait({ etat: 'deja', memo: actuel })
  const journal = journalDe({ cwd, id: run, attempt, echecsSeuls: false, spawn })
  if (!journal.disponible) return journal
  const { vitest, node, lus, attendus, parties, manquantes, illisibles } = dureesDuJournal(journal.valeur)
  if (!parties.length) return fait({ etat: 'refus', raison: `course ${run} : aucune ligne [partie] au journal` })
  if (manquantes.length) return fait({ etat: 'refus', raison: `course ${run} : partie(s) absente(s) du journal : ${manquantes.join(', ')}` })
  if (illisibles.length) return fait({ etat: 'refus', raison: `course ${run} : ligne [durees] node illisible : ${illisibles.join(', ')}` })
  if (!lus) return fait({ etat: 'refus', raison: `course ${run} : aucune durée Vitest au journal` })
  if (lus < attendus) return fait({ etat: 'refus', raison: `course ${run} : ${lus} durée(s) Vitest lue(s) pour ${attendus} fichier(s) annoncé(s)` })
  const memo = { run, attempt, sha, date, vitest, node }
  try {
    mesures.remplacer(DUREES_CI, memo)
  } catch (erreur) {
    return indisponible(`mémo ${DUREES_CI} non écrit — ${erreur instanceof Error ? erreur.message : String(erreur)}`)
  }
  return fait({ etat: 'rapatrie', memo })
}
