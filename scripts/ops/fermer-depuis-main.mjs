// FERMETURE DES TICKETS SOLDÉS — jouée DEPUIS `main`, après une CI verte, jamais au commit local.
//
// Un ticket se ferme quand son correctif est PUBLIÉ, pas quand un commit existe sur une machine :
// #1685 a été fermé par 8b52f3a55 avant que ce commit n'atteigne `main`, et un commit rebasé au loin
// ou jamais poussé laisse un ticket fermé sans code (revue de palier n°3, 2026-09-04, écart 10).
// Aucun hook local ne ferme donc de ticket : c'est le job `fermetures` de `ci.yml` qui appelle ce
// script sur la plage réellement poussée, après le job `build`.
//
// Ce fichier est une FEUILLE, et c'est ce qui tient l'invariant « un seul site ferme » : il porte le
// GESTE et rien d'autre, le vocabulaire de LECTURE d'une plage fermante vivant dans
// `scripts/guards/lib/plageFermante.mjs`. Rien dans le dépôt ne l'importe — cliquet dans
// `fermer-depuis-main.test.mjs` et dans `publier.test.mjs`.
//
// Usage : node scripts/ops/fermer-depuis-main.mjs <before>..<sha>   (`npm run ops:fermer -- <plage>`)
// Le geste GitHub appartient à l'orchestrateur et à la CI, jamais à un agent.
import { fileURLToPath } from 'node:url'
import {
  avertissementRapportee, commitsDeLaPlage, decisionPour, fermeturesDeLaPlage, marqueDe,
  motifDePlageIllisible, posteUnSolde, soldeDuCommit,
} from '../guards/lib/plageFermante.mjs'
import { DEPOT, appelGhRunner, cheminTicket, lireTicket, poserCommentaire } from '../guards/lib/ticketsGh.mjs'

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

/**
 * Le traitement d'UN ticket soldé : lire, décider, agir. Exporté et ses coutures injectées, parce
 * que c'est ICI que la décision PURE devient un geste — `poser: posteUnSolde(decision)` est la ligne
 * qui tient l'idempotence, et une ligne sans banc est libre de mentir (mutée en `poser: true`, elle
 * reposte le solde que `decisionPour` refuse, sans qu'aucun test bouge).
 * @param {{numero:string|number, sha:string, lire?:Function, fermer?:Function, solde?:Function}} p
 * @returns {{ok:boolean, dit?:string, avertissement?:string, raison?:string}}
 */
export function traiterUnTicket({
  numero, sha,
  lire = (n) => lireTicket({ depot: DEPOT, numero: n, appel: appelGh }),
  fermer = fermerLeTicket,
  solde = soldeDuCommit,
}) {
  const vue = lire(numero)
  if (!vue.ok) return { ok: false, raison: `lecture impossible — ${vue.raison}` }

  const decision = decisionPour({ etat: vue.etat.toLowerCase(), commentaires: vue.corps, sha })
  if (decision === 'rien') return { ok: true, dit: `déjà fermée par ${sha} — rien à faire` }
  if (decision === 'rapporter') return { ok: true, avertissement: avertissementRapportee(numero, sha) }

  const emporte = solde(sha, numero)
  const corps = `${emporte ?? `Fermé par le commit ${sha}, publié sur main (aucun solde emporté).`}\n\n${marqueDe(sha)}\n`
  const vu = fermer({ numero, corps, poser: posteUnSolde(decision) })
  if (!vu.ok) return { ok: false, raison: `fermeture impossible — ${vu.raison}` }
  const dejaAuFil = decision === 'patcher' ? ' — solde DÉJÀ au fil, seul l’état restait ouvert' : ''
  return { ok: true, dit: `fermée (solde du commit ${sha}${emporte ? '' : ' — ABSENT'})${dejaAuFil}` }
}

function main() {
  const plage = process.argv[2]
  if (!plage || !plage.includes('..')) {
    process.stderr.write('usage : node scripts/ops/fermer-depuis-main.mjs <before>..<sha>\n')
    process.exit(2)
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
  for (const { numero, sha } of fermetures) {
    // Un ticket en échec ne doit pas emporter les suivants : chaque tour rend son verdict, la boucle
    // continue, et `rate` décide du code de sortie.
    const vu = traiterUnTicket({ numero, sha })
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
