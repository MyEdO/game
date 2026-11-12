// #4068 ; skill `se-coordonner-entre-comptes`. Un commentaire de coordination posé sous un login humain ne
// réveille pas le fil Claude abonné à la PR destinataire ; un commentaire du workflow le réveille. Le facteur
// relaie donc chaque commentaire de coordination par un commentaire de `github-actions[bot]` sur la ou les PR
// destinataires (`.github/workflows/facteur.yml`).
import { appendFileSync } from 'node:fs'
import { text } from 'node:stream/consumers'
import { DEPOT, appelGhRunner, pagesRest, poserCommentaire } from '../guards/lib/ticketsGh.mjs'

/** Les mots de tête d'un commentaire de coordination. Chacun commence par `**` : le pré-filtre du job de
 *  `facteur.yml` (`startsWith(github.event.comment.body, '**')`) n'en écarte aucun. */
export const MOTS = Object.freeze(['**Courrier**', '**Réponse**'])

/** Les `author_association` dont le commentaire se relaie : le dépôt est public. */
export const AUTEURS_ADMIS = Object.freeze(['OWNER', 'MEMBER', 'COLLABORATOR'])

/** Le refus qui précède toute lecture de l'API, ou `null`. PURE. */
function refusDEmblee({ comment }) {
  if (comment.user.type === 'Bot') return 'commentaire d’un Bot : aucun relais, pas de boucle'
  if (!AUTEURS_ADMIS.includes(comment.author_association))
    return `auteur ${comment.author_association} hors ${AUTEURS_ADMIS.join(', ')}`
  if (!MOTS.some((mot) => comment.body.startsWith(mot))) return `corps sans mot de tête (${MOTS.join(', ')})`
  return null
}

/** `true` si la branche `ref` est celle d'un chantier du ticket `numero` : `chantier/N` ou `chantier/N-…`. PURE. */
const brancheDuTicket = (ref, numero) => ref === `chantier/${numero}` || ref.startsWith(`chantier/${numero}-`)

/**
 * Les PR à qui relayer le commentaire `evenement` (charge utile `issue_comment`), parmi `prsOuvertes` (liste REST
 * des PR ouvertes) quand il vise un ticket. La PR de l'expéditeur est retirée : « réponse sur #N » dans la première
 * ligne. PURE.
 * @returns {{ numeros: number[], raison: string }}
 */
export function destinataires(evenement, prsOuvertes) {
  const refus = refusDEmblee(evenement)
  if (refus) return { numeros: [], raison: refus }
  const { comment, issue } = evenement
  let visees
  let lieu
  if (issue.pull_request) {
    if (issue.state !== 'open') return { numeros: [], raison: `PR #${issue.number} fermée` }
    visees = [issue.number]
    lieu = `PR #${issue.number}`
  } else {
    visees = prsOuvertes.filter((pr) => pr.head.repo?.full_name === DEPOT && brancheDuTicket(pr.head.ref, issue.number))
      .map((pr) => pr.number)
    lieu = `ticket #${issue.number}`
  }
  const premiere = comment.body.split(/\r?\n/, 1)[0]
  const retours = new Set([...premiere.matchAll(/réponse sur #(\d+)/gi)].map((m) => Number(m[1])))
  const numeros = [...new Set(visees)].filter((n) => !retours.has(n)).sort((a, b) => a - b)
  return { numeros, raison: numeros.length ? `${lieu} : ${numeros.length} destinataire(s)` : `${lieu} : aucune PR destinataire` }
}

/** Le corps du relais, sans le corps du commentaire relayé. PURE. */
export const corpsDuRelais = ({ comment, issue }) => [
  `Courrier à lire : ${comment.html_url}`,
  `Posé par ${comment.user.login} (${comment.author_association}) sur #${issue.number}.`,
  'Skill `se-coordonner-entre-comptes`.',
].join('\n')

/**
 * Pose le relais de `evenement` sur chaque destinataire. Les PR ouvertes ne se lisent que pour un commentaire de
 * ticket qui passe les refus d'emblée.
 * @param {{ evenement: object, appel: (args: string[], options?: object) => {ok:boolean, stdout?:string, raison?:string} }} p
 * @returns {{ poses: number[], refus: {numero:number, raison:string}[], raison: string }}
 */
export function distribuer({ evenement, appel }) {
  let prsOuvertes = []
  if (!refusDEmblee(evenement) && !evenement.issue.pull_request) {
    const lu = pagesRest(`repos/${DEPOT}/pulls?state=open`, appel)
    if (!lu.ok) {
      const raison = `lecture des PR ouvertes refusée : ${lu.raison}`
      return { poses: [], refus: [{ numero: evenement.issue.number, raison }], raison }
    }
    prsOuvertes = lu.entrees
  }
  const { numeros, raison } = destinataires(evenement, prsOuvertes)
  const corps = corpsDuRelais(evenement)
  const poses = []
  const refus = []
  for (const numero of numeros) {
    const vu = poserCommentaire({ depot: DEPOT, numero, corps, appel })
    if (vu.ok) poses.push(numero)
    else refus.push({ numero, raison: vu.raison })
  }
  return { poses, refus, raison }
}

/** La sortie du step `relais` de `facteur.yml` : `pose=oui` si ce run a posé un relais. PURE. #4068 */
export const sortieDuStep = ({ poses }) => (poses.length > 0 ? 'pose=oui\n' : '')

if (import.meta.main) {
  try {
    const evenement = JSON.parse(await text(process.stdin))
    const { poses, refus, raison } = distribuer({ evenement, appel: appelGhRunner({ cwd: process.cwd() }) })
    if (process.env.GITHUB_OUTPUT && sortieDuStep({ poses })) appendFileSync(process.env.GITHUB_OUTPUT, sortieDuStep({ poses }))
    if (!poses.length && !refus.length) console.log(`Aucun relais : ${raison}.`)
    for (const numero of poses) console.log(`Relais posé sur #${numero} (${raison}).`)
    for (const r of refus) console.error(`Relais refusé sur #${r.numero} : ${r.raison}`)
    if (refus.length) process.exitCode = 1
  } catch (e) { console.error(e.message); process.exitCode = 1 }
}
