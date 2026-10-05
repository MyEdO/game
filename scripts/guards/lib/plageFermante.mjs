// CE QU'UNE PLAGE DE COMMITS FERME — le vocabulaire de LECTURE, partagé (#1813).
//
// Il vit ici, et non dans `scripts/ops/fermer-depuis-main.mjs`, pour une raison MÉCANIQUE : ce script
// porte le geste qui ferme les tickets SOLDÉS (job `fermetures` de fermetures.yml), et ce geste n'est hors de
// portée d'un tiers que tant que le script est une FEUILLE que rien n'importe (`modulesFeuilles.mjs`).
// Le train de publication lit donc son vocabulaire de plage ICI. Un cliquet d'argv littéraux ne
// suffirait pas à le dire : un appel indirect n'en laisse aucun — mesuré, un `fermerLeTicket(...)`
// glissé dans l'étape `pilotage` laisse un cliquet d'argv entièrement vert.
//
// Lecture PURE ou lecture de git : rien ici n'écrit, ni sur le disque, ni sur GitHub.
import { fileURLToPath } from 'node:url'
import { depotDe, estAncetre, journalDe, lireEnLot, shaDe } from './gitPorte.mjs'
import { numerosFermes } from './fermetures.mjs'

/** L'arbre lu par défaut : celui où VIT ce module. */
const RACINE = fileURLToPath(new URL('../../..', import.meta.url))

/** Marque d'IDEMPOTENCE posée dans le commentaire de fermeture : elle porte le sha qui a soldé. */
export const marqueDe = (sha) => `<!-- ferme-depuis-main: ${sha} -->`

/**
 * Tickets fermés par une plage de commits, chacun rattaché au DERNIER commit qui le cite (`sha`), avec
 * TOUS ses citants de la plage (`citants`, du plus ancien au plus récent). PUR.
 * Le dernier, pas le premier : une plage reculée par `baseDeLaPlage` peut porter un citant plus ancien
 * déjà fermé à la main (`ops:fermer`), puis le ticket rouvert et cité de nouveau (#2155).
 * @param {{ sha: string, message: string }[]} commits du plus ancien au plus récent
 * @returns {{ numero: string, sha: string, citants: string[] }[]}
 */
export function fermeturesDeLaPlage(commits) {
  const vus = new Map()
  for (const c of commits) {
    for (const numero of numerosFermes(c.message)) {
      const citants = vus.get(numero) ?? []
      if (!citants.includes(c.sha)) citants.push(c.sha)
      vus.set(numero, citants)
    }
  }
  return [...vus].map(([numero, citants]) => ({ numero, sha: citants.at(-1), citants }))
}

/**
 * Que faire d'un ticket, sachant son état et ses commentaires. PUR.
 * La marque du sha se lit AVANT l'état : le geste de fermeture est en DEUX temps (commentaire posé,
 * puis état patché), donc un PATCH raté laisse un ticket OUVERT qui porte DÉJÀ son solde. Juger sur
 * le seul `etat === 'open'` ferait poster un SECOND solde identique au rejeu du job.
 * `sha` est le DERNIER citant de la plage, `citants` tous ses citants (`fermeturesDeLaPlage`) : un
 * ticket FERMÉ qui porte la marque de l'un d'eux est déjà soldé par cette plage. Un ticket OUVERT se
 * juge sur M, la marque la plus récente d'un citant (`marqueRecente`), et sur `dernierEtat`, le dernier
 * événement d'état (`dernierEtatDe`) : un `reopened` POSTÉRIEUR à M dit le ticket rouvert après le solde.
 * @param {{ etat: string, commentaires: {corps:string, date:string}[], sha: string, citants?: string[],
 *   dernierEtat?: {evenement:string|null, date:string|null}|null }} p
 * @returns {'fermer'|'patcher'|'rouvert'|'rien'|'rapporter'}
 *   `fermer` = solde du dernier citant à poser PUIS état à patcher ; `patcher` = un solde de la plage
 *   déjà posé, seul l'état reste à fermer ; `rouvert` = rouvert après le solde du dernier citant, on ne
 *   le referme pas, on le DIT ; `rien` = déjà fermée par un citant de la plage (rejeu) ;
 *   `rapporter` = fermée par un AUTRE geste — on ne la referme pas, on le DIT.
 */
export function decisionPour({ etat, commentaires, sha, citants = [sha], dernierEtat = null }) {
  const porte = (s) => commentaires.some((c) => c.corps.includes(marqueDe(s)))
  if (etat !== 'open') return [...citants, sha].some(porte) ? 'rien' : 'rapporter'
  const m = marqueRecente({ commentaires, sha, citants })
  if (!m) return 'fermer'
  const rouvertApres = dernierEtat?.evenement === 'reopened' && Date.parse(dernierEtat.date) > Date.parse(m.date)
  if (!rouvertApres) return 'patcher'
  return porte(sha) ? 'rouvert' : 'fermer'
}

/**
 * La marque la plus RÉCENTE, par date de commentaire, d'un citant de la plage ; `null` sans aucune. PUR.
 * @param {{ commentaires: {corps:string, date:string}[], sha: string, citants?: string[] }} p
 * @returns {{ sha: string, date: string }|null}
 */
export function marqueRecente({ commentaires, sha, citants = [sha] }) {
  let vue = null
  for (const c of commentaires) {
    for (const s of new Set([...citants, sha])) {
      if (c.corps.includes(marqueDe(s)) && (!vue || Date.parse(c.date) >= Date.parse(vue.date))) vue = { sha: s, date: c.date }
    }
  }
  return vue
}

/** Cette décision POSTE-t-elle un solde ? L'invariant se lit ici, une fois : la marque du dernier
 *  citant déjà au fil ⇒ aucun POST, quel que soit l'état du ticket (`decisionPour`). */
export const posteUnSolde = (decision) => decision === 'fermer'

/**
 * Une issue déjà fermée par un AUTRE geste s'AVERTIT, elle ne rougit pas : le commit a fait son
 * travail, et rougir le job `fermetures` sur `main` pour cela ferait passer pour cassée une
 * publication saine. `::warning::` est la forme que GitHub Actions remonte à l'annotation de la course.
 * L'échec reste réservé aux défauts réels : API en erreur, ticket inexistant, plage illisible.
 */
export const avertissementRapportee = (numero, sha) =>
  `::warning::[fermetures] #${numero} déjà FERMÉE par un autre geste que ${sha} — non refermée, à vérifier\n`

/** Un ticket ROUVERT après la pose du solde n'est jamais refermé par un rejeu : il s'AVERTIT. */
export const avertissementRouvert = (numero, sha) =>
  `::warning::[fermetures] #${numero} ROUVERT alors qu'il porte déjà le solde de ${sha} — non refermé, à vérifier\n`

/** Un échec PERMANENT (PR citée, ticket inexistant) s'AVERTIT : un rejeu de la plage le reproduirait
 *  à l'identique, et rougir ferait reculer la base de chaque push suivant jusque sous ce commit. */
export const avertissementIntraitable = (numero, raison) =>
  `::warning::[fermetures] #${numero} intraitable — ${raison} ; non fermé, à vérifier\n`

/** Le workflow qui ferme : une course CONCLUE `success` sur un commit dit la plage de ce push jugée. */
export const WORKFLOW_FERMETURES = 'fermetures.yml'

/** La seule conclusion qui dit une plage JUGÉE. Rouge, annulée ou absente : personne n'a fermé. */
const CONCLUSION_JUGEE = 'success'

/** Plafond des candidats à la base, ANTI-EMBALLEMENT : une lecture `gh` par candidat. */
const PLAFOND_RECUL = 50

/**
 * La BASE de la plage fermante d'un push sur `main` (#2155). PUR : les lectures sont injectées.
 * La base part de `avant` (`github.event.before`) et se CONFIRME par une course de
 * `WORKFLOW_FERMETURES` conclue `CONCLUSION_JUGEE` sur CE commit ; sinon elle recule d'un PREMIER
 * parent (`git help rev-list`, `--first-parent`) et recommence. Un commit intermédiaire d'un lot de
 * file n'a aucune course : il est passé.
 * Repli sur `avant`, toujours DIT par un `::warning::` : histoire épuisée ou plafond atteint. Une
 * lecture indisponible n'a PAS de repli : elle rend `base: null` et sa `raison`, la course rougit et la
 * suivante rattrape (le transitoire rougit, comme en R2).
 * @param {{ avant: string, parent: (sha: string) => string|null,
 *   courses: (sha: string) => ({disponible:true, valeur:{conclusion?:string}[]}|{disponible:false, raison:string}),
 *   plafond?: number }} p
 * @returns {{ base: string, message: string|null } | { base: null, raison: string }} `message` :
 *   annotation GitHub à écrire, ou `null`
 */
export function baseDeLaPlage({ avant, parent, courses, plafond = PLAFOND_RECUL }) {
  const repli = (motif) => ({
    base: avant,
    message: `::warning::[fermetures] ${motif} — base repliée sur event.before ${avant} : une plage sautée plus ancienne n'est PAS rattrapée\n`,
  })
  let candidat = avant
  for (let rang = 0; rang < plafond; rang += 1) {
    const lu = courses(candidat)
    if (!lu.disponible) return { base: null, raison: `courses de ${WORKFLOW_FERMETURES} illisibles sur ${candidat} (${lu.raison})` }
    if (lu.valeur.some((c) => c?.conclusion === CONCLUSION_JUGEE)) {
      if (rang === 0) return { base: candidat, message: null }
      return {
        base: candidat,
        message: `::notice::[fermetures] ${avant} sans course ${WORKFLOW_FERMETURES} réussie : base reculée de ${rang} commit(s) jusqu'à ${candidat}, la plage sautée est rattrapée\n`,
      }
    }
    candidat = parent(candidat)
    if (!candidat) return repli(`histoire épuisée après ${rang + 1} candidat(s), aucune course ${WORKFLOW_FERMETURES} réussie`)
  }
  return repli(`plafond de ${plafond} candidats atteint, aucune course ${WORKFLOW_FERMETURES} réussie`)
}

/**
 * La base d'une plage est-elle un ANCÊTRE de sa tête (`estAncetre`) ? Le job qui l'appelle dit CE QUI
 * s'est passé : git indisponible, borne (base ou tête) inconnue du dépôt, nommée par `shaDe`, ou base
 * hors de l'histoire de la tête.
 * `cwd` : le dépôt LU — en test, un dépôt jetable de `os.tmpdir()`, jamais l'arbre partagé.
 * @returns {string|null} le motif de refus, ou `null` si la plage est lisible
 */
export function motifDePlageIllisible(plage, cwd = RACINE) {
  const [base, tete] = plage.split('..')
  const depot = depotDe(cwd)
  const vu = estAncetre(depot, base, tete)
  if (!vu.disponible) return `ascendance de ${plage} indisponible : ${vu.raison} — aucune fermeture n'est jugée`
  if (vu.absent) {
    const inconnues = [['base', base], ['tête', tete]].filter(([, rev]) => shaDe(depot, rev) === null).map(([borne, rev]) => `${borne} ${rev}`)
    const nommees = inconnues.length ? inconnues.join(' et ') : `une borne de ${plage}`
    const s = inconnues.length > 1 ? 's' : ''
    return `${nommees} inconnue${s} de ce dépôt (non fetchée${s}, ou dépôt corrompu) — aucune fermeture n'est jugée`
  }
  if (vu.valeur !== true)
    return `base ${base} inatteignable depuis ${tete} : push non fast-forward sur main, interdit par le pre-push`
  return null
}

/** Commits d'une plage `<a>..<b>`, du plus ancien au plus récent. */
export function commitsDeLaPlage(plage, cwd = RACINE) {
  const journal = journalDe(depotDe(cwd), [plage])
  if (journal === null) throw new Error(`plage ${plage} illisible dans ${cwd}`)
  return journal
}

/** Solde tel que le COMMIT l'emporte (jamais le disque du runner) ; `null` s'il n'y est pas. */
export function soldeDuCommit(sha, numero, cwd = RACINE) {
  const chemin = `.claude/soldes/${numero}.md`
  return lireEnLot(depotDe(cwd), sha, [chemin]).get(chemin) ?? null
}
