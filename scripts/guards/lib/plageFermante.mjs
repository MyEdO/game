// CE QU'UNE PLAGE DE COMMITS FERME — le vocabulaire de LECTURE, partagé (#1813).
//
// Il vit ici, et non dans `scripts/ops/fermer-depuis-main.mjs`, pour une raison MÉCANIQUE : ce script
// porte le geste qui ferme les tickets SOLDÉS (job `fermetures` de ci.yml), et ce geste n'est hors de
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
 * Tickets fermés par une plage de commits, chacun rattaché au PREMIER commit qui le cite. PUR.
 * @param {{ sha: string, message: string }[]} commits du plus ancien au plus récent
 * @returns {{ numero: string, sha: string }[]}
 */
export function fermeturesDeLaPlage(commits) {
  const vus = new Map()
  for (const c of commits) {
    for (const numero of numerosFermes(c.message)) {
      if (!vus.has(numero)) vus.set(numero, c.sha)
    }
  }
  return [...vus].map(([numero, sha]) => ({ numero, sha }))
}

/**
 * Que faire d'un ticket, sachant son état et ses commentaires. PUR.
 * La marque du sha se lit AVANT l'état : le geste de fermeture est en DEUX temps (commentaire posé,
 * puis état patché), donc un PATCH raté laisse un ticket OUVERT qui porte DÉJÀ son solde. Juger sur
 * le seul `etat === 'open'` ferait poster un SECOND solde identique au rejeu du job.
 * @returns {'fermer'|'patcher'|'rien'|'rapporter'}
 *   `fermer` = commentaire à poser PUIS état à patcher ; `patcher` = solde déjà posé, seul l'état
 *   reste à fermer ; `rien` = déjà fermée PAR CE SHA (rejeu) ; `rapporter` = fermée par un AUTRE
 *   geste — on ne la referme pas, on le DIT.
 */
export function decisionPour({ etat, commentaires, sha }) {
  const soldeDeja = commentaires.some((c) => String(c).includes(marqueDe(sha)))
  if (etat === 'open') return soldeDeja ? 'patcher' : 'fermer'
  return soldeDeja ? 'rien' : 'rapporter'
}

/** Cette décision POSTE-t-elle un solde ? L'invariant se lit ici, une fois : la marque du sha déjà
 *  au fil ⇒ aucun POST, quel que soit l'état du ticket. */
export const posteUnSolde = (decision) => decision === 'fermer'

/**
 * Une issue déjà fermée par un AUTRE geste s'AVERTIT, elle ne rougit pas : le commit a fait son
 * travail, et rougir le job `fermetures` sur `main` pour cela ferait passer pour cassée une
 * publication saine. `::warning::` est la forme que GitHub Actions remonte à l'annotation de la course.
 * L'échec reste réservé aux défauts réels : API en erreur, ticket inexistant, plage illisible.
 */
export const avertissementRapportee = (numero, sha) =>
  `::warning::[fermetures] #${numero} déjà FERMÉE par un autre geste que ${sha} — non refermée, à vérifier\n`

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
