// FERMETURE DES TICKETS SOLDÉS — jouée DEPUIS `main`, après une CI verte, jamais au commit local.
//
// Un ticket se ferme quand son correctif est PUBLIÉ, pas quand un commit existe sur une machine :
// #1685 a été fermé par 8b52f3a55 avant que ce commit n'atteigne `main`, et un commit rebasé au loin
// ou jamais poussé laisse un ticket fermé sans code (revue du 2026-09-04, écart 10).
// Aucun hook local ne ferme donc de ticket : c'est le job `fermetures` de `fermetures.yml` qui appelle ce
// script, après lecture des checks requis verts du sha poussé (`scripts/ops/checks-requis.mjs`), sur la
// plage qui part du dernier commit où ce workflow a RÉUSSI (`baseDeLaPlage`, #2155) : une course rouge,
// annulée ou jamais lancée est rattrapée par la suivante, dans la limite de son plafond de recul — le
// dépasser est DIT par un `::warning::`.
//
// Ce fichier est une FEUILLE, et c'est ce qui tient l'invariant « un seul site ferme » : il porte le
// GESTE et rien d'autre, le vocabulaire de LECTURE d'une plage fermante vivant dans
// `scripts/guards/lib/plageFermante.mjs`. Rien dans le dépôt ne l'importe — cliquet dans
// `fermer-depuis-main.test.mjs` et dans `publier.test.mjs`.
//
// Usage : node scripts/ops/fermer-depuis-main.mjs <base>..<sha>   (`npm run ops:fermer -- <plage>`)
//         node scripts/ops/fermer-depuis-main.mjs --rattraper <before>..<sha>   (CI : base reculée, puis fermée)
//         node scripts/ops/fermer-depuis-main.mjs --plage <before>..<sha>   (imprime la plage rattrapée, ne ferme rien)
// Le geste GitHub appartient à l'orchestrateur et à la CI, jamais à un agent.
import { fileURLToPath } from 'node:url'
import { coursesCi } from '../guards/lib/coursesCi.mjs'
import { depotDe, parentsDe, shaDe } from '../guards/lib/gitPorte.mjs'
import {
  WORKFLOW_FERMETURES, avertissementIntraitable, avertissementRapportee, avertissementRouvert, baseDeLaPlage,
  commitsDeLaPlage, decisionPour, fermeturesDeLaPlage, marqueDe, marqueRecente, motifDePlageIllisible,
  posteUnSolde, soldeDuCommit,
} from '../guards/lib/plageFermante.mjs'
import {
  DEPOT, appelGhRunner, cheminTicket, dernierEtatDe, lireTicket, poserCommentaire,
} from '../guards/lib/ticketsGh.mjs'

const RACINE = fileURLToPath(new URL('../..', import.meta.url))

const appelGh = appelGhRunner({ cwd: RACINE, maxBuffer: 32 * 1024 * 1024 })

/**
 * Le geste qui ferme les tickets SOLDÉS d'une plage — le solde POSTÉ, puis l'état PATCHÉ.
 * `gh issue close` est servi par GraphQL, refusé HTTP 403 aux sessions Claude Code ; ce PATCH est la
 * seule route ouverte. `poser: false` rejoue le SEUL patch, sur un ticket dont le solde est déjà au
 * fil (un PATCH raté au run précédent) : sans cela, le rejeu du job posterait un second solde
 * identique.
 *
 * `state_reason=completed` est passé EXPLICITEMENT. `PATCH /repos/{owner}/{repo}/issues/{n}` porte
 * `state` et `state_reason` en DEUX champs distincts, et la doc REST ne DÉFINIT aucune valeur de
 * `state_reason` pour un `state=closed` sans raison : s'en remettre au défaut, c'est parier sur un
 * comportement non écrit. Les 100 dernières fermetures du dépôt portent toutes `completed` (sonde
 * `gh api repos/cgauche/game/issues?state=closed --jq .[].state_reason`, 2026-09-18) — ce que posait
 * la rédaction d'avant, `gh issue close --reason completed` ; l'écrire ici rend le geste IDENTIQUE.
 * @param {{numero:string|number, corps:string, poser?:boolean, appel?:Function}} p
 * @returns {{ok:boolean, raison?:string}}
 */
export function fermerLeTicket({ numero, corps, poser = true, appel = appelGh }) {
  if (poser) {
    const pose = poserCommentaire({ depot: DEPOT, numero, corps, appel })
    if (!pose.ok) return { ok: false, raison: `commentaire non posé — ${pose.raison}` }
  }
  const ferme = appel([
    'api', cheminTicket(DEPOT, numero), '-X', 'PATCH', '-f', 'state=closed', '-f', 'state_reason=completed',
  ])
  return ferme.ok ? { ok: true } : { ok: false, raison: ferme.raison }
}

/** Les refus de lecture qu'aucun rejeu ne lèvera : une PR citée (`lireTicket`), un ticket inexistant
 *  (HTTP 404) ou supprimé (HTTP 410). Ils s'avertissent ; tout autre refus est TRANSITOIRE et rougit,
 *  le rejeu étant sans risque (`decisionPour` est idempotente). */
const PERMANENTS = [/est une pull request, pas un ticket/, /\(HTTP 404\)/, /\(HTTP 410\)/]

const echecPermanent = (raison) => PERMANENTS.some((motif) => motif.test(String(raison)))

/**
 * Le traitement d'UN ticket soldé : lire, décider, agir. Exporté et ses coutures injectées, parce
 * que c'est ICI que la décision PURE devient un geste — `poser: posteUnSolde(decision)` est la ligne
 * qui tient l'idempotence, et une ligne sans banc est libre de mentir (mutée en `poser: true`, elle
 * reposte le solde que `decisionPour` refuse, sans qu'aucun test bouge).
 * `sha` est le DERNIER citant de la plage, `citants` tous ses citants (`fermeturesDeLaPlage`). Le
 * dernier événement d'état (`evenements`) ne se lit que pour un ticket OUVERT qui porte la marque d'un
 * citant (`marqueRecente`) : c'est le seul cas où `decisionPour` en dépend.
 * @param {{numero:string|number, sha:string, citants?:string[], lire?:Function, fermer?:Function,
 *   solde?:Function, evenements?:Function}} p
 * @returns {{ok:boolean, dit?:string, avertissement?:string, raison?:string}}
 */
export function traiterUnTicket({
  numero, sha, citants = [sha],
  lire = (n) => lireTicket({ depot: DEPOT, numero: n, appel: appelGh }),
  fermer = fermerLeTicket,
  solde = soldeDuCommit,
  evenements = (n) => dernierEtatDe({ depot: DEPOT, numero: n, appel: appelGh }),
}) {
  const vue = lire(numero)
  if (!vue.ok) {
    if (echecPermanent(vue.raison)) return { ok: true, avertissement: avertissementIntraitable(numero, vue.raison) }
    return { ok: false, raison: `lecture impossible — ${vue.raison}` }
  }

  const etat = vue.etat.toLowerCase()
  const commentaires = vue.corps.map((corps, i) => ({ corps, date: vue.dates[i] }))
  let dernierEtat = null
  if (etat === 'open' && marqueRecente({ commentaires, sha, citants })) {
    const lu = evenements(numero)
    if (!lu.ok) return { ok: false, raison: `événements illisibles — ${lu.raison}` }
    dernierEtat = lu
  }
  const decision = decisionPour({ etat, commentaires, sha, citants, dernierEtat })
  if (decision === 'rien') return { ok: true, dit: `déjà fermée par un citant de la plage (${citants.join(', ')}) — rien à faire` }
  if (decision === 'rapporter') return { ok: true, avertissement: avertissementRapportee(numero, sha) }
  if (decision === 'rouvert') return { ok: true, avertissement: avertissementRouvert(numero, sha) }

  const emporte = solde(sha, numero)
  const corps = `${emporte ?? `Fermé par le commit ${sha}, publié sur main (aucun solde emporté).`}\n\n${marqueDe(sha)}\n`
  const vu = fermer({ numero, corps, poser: posteUnSolde(decision) })
  if (!vu.ok) return { ok: false, raison: `fermeture impossible — ${vu.raison}` }
  const dejaAuFil = decision === 'patcher' ? ' — solde DÉJÀ au fil, seul l’état restait ouvert' : ''
  return { ok: true, dit: `fermée (solde du commit ${sha}${emporte ? '' : ' — ABSENT'})${dejaAuFil}` }
}

/**
 * La plage RATTRAPÉE d'un push : `<before>..<sha>` dont la base recule jusqu'au dernier premier parent
 * où `WORKFLOW_FERMETURES` a réussi (`baseDeLaPlage`). Un `before` nul (premier push) vaut `<sha>^`.
 * @param {string} plage `<before>..<sha>` @returns {string} `<base>..<sha>`
 */
function plageRattrapee(plage) {
  const [avant, tete] = plage.split('..')
  const depot = depotDe(RACINE)
  const parent = (sha) => parentsDe(depot, sha)?.[0] ?? null
  // `gh run list --commit` ne reconnaît qu'un sha COMPLET : la base est résolue avant toute lecture.
  const depart = /^0+$/.test(avant) ? parent(tete) : shaDe(depot, avant)
  if (!depart) throw new Error(`base de ${plage} inconnue de ce dépôt`)
  const courses = (sha) => coursesCi({ cwd: RACINE, workflow: WORKFLOW_FERMETURES, commit: sha, limit: 5 })
  const vu = baseDeLaPlage({ avant: depart, parent, courses })
  if (!vu.base) throw new Error(vu.raison)
  if (vu.message) process.stderr.write(vu.message)
  return `${vu.base}..${tete}`
}

const MODES = ['--rattraper', '--plage']

function main() {
  const mode = MODES.includes(process.argv[2]) ? process.argv[2] : null
  const demandee = process.argv[mode ? 3 : 2]
  if (!demandee || !demandee.includes('..')) {
    process.stderr.write('usage : node scripts/ops/fermer-depuis-main.mjs [--rattraper|--plage] <before>..<sha>\n')
    process.exit(2)
  }
  let plage = demandee
  try {
    if (mode) plage = plageRattrapee(demandee)
  } catch (e) {
    process.stderr.write(`[fermetures] plage rattrapée de ${demandee} illisible : ${e.message}\n`)
    process.exit(1)
  }
  if (mode === '--plage') {
    process.stdout.write(`${plage}\n`)
    return
  }
  const illisible = motifDePlageIllisible(plage)
  if (illisible) {
    process.stderr.write(`[fermetures] ${illisible}\n`)
    process.exit(1)
  }
  const fermetures = fermeturesDeLaPlage(commitsDeLaPlage(plage))
  if (fermetures.length === 0) {
    process.stdout.write(`[fermetures] ${plage} : aucun ticket cité par un commit fermant\n`)
    return
  }
  let rate = 0
  for (const { numero, sha, citants } of fermetures) {
    // Un ticket en échec ne doit pas emporter les suivants : chaque tour rend son verdict, la boucle
    // continue, et `rate` décide du code de sortie.
    const vu = traiterUnTicket({ numero, sha, citants })
    if (vu.avertissement) process.stderr.write(vu.avertissement)
    else if (vu.ok) process.stdout.write(`[fermetures] #${numero} ${vu.dit}\n`)
    else {
      process.stderr.write(`[fermetures] #${numero} : ${vu.raison}\n`)
      rate += 1
    }
  }
  if (rate) process.exit(1)
}

if (import.meta.main) main()
