import { estShaComplet } from './gitPorte.mjs'
import { pagesRest } from './ticketsGh.mjs'

const SIGNATURE_PR = 'Train de publication (`npm run ops:publier`), tête '
export const corpsDePr = (tete) => `${SIGNATURE_PR}${tete}.`
export function estPrDuTrain(corps) {
  const tete = String(corps ?? '').slice(SIGNATURE_PR.length, -1)
  return estShaComplet(tete) && corps === corpsDePr(tete)
}


/** Le refus d'enfileur nommé : le compte refusé, le message de GitHub et le geste humain, sur UNE ligne (#2392). PUR. */
export const refusDEnfileur = ({ depot, numero, compte, message }) =>
  `mise en file REFUSÉE au compte « ${compte} » : ${message} — geste humain : bouton « Merge when ready » de https://github.com/${depot}/pull/${numero}`

const surUneLigne = (texte) => String(texte ?? '').replace(/\s*[\r\n]+\s*/g, ' ').trim()

function graphqlDe(vu) {
  if (!vu.ok) return { ok: false, raison: vu.raison ?? 'GraphQL refusé' }
  try {
    const lu = JSON.parse(vu.stdout)
    if (!lu || typeof lu !== 'object' || (lu.errors !== undefined && (!Array.isArray(lu.errors) || lu.errors.length)))
      return { ok: false, raison: `GraphQL erreurs : ${JSON.stringify(lu?.errors)}` }
    if (!lu.data || typeof lu.data !== 'object') return { ok: false, raison: 'GraphQL sans données' }
    return { ok: true, data: lu.data }
  } catch (e) { return { ok: false, raison: `GraphQL illisible : ${e.message}` } }
}

function identiteDePr({ depot, numero, sha, appel }) {
  const [owner, name] = depot.split('/')
  const lu = graphqlDe(appel(['api', 'graphql', '--input', '-'], { input: JSON.stringify({
    query: 'query IdentiteDeFusion($owner: String!, $name: String!, $number: Int!) { repository(owner: $owner, name: $name) { pullRequest(number: $number) { id headRefOid state merged mergeCommit { oid } autoMergeRequest { enabledAt } isInMergeQueue mergeQueueEntry { id state enqueuedAt enqueuer { login } headCommit { oid } } } } viewer { login } }',
    variables: { owner, name, number: Number(numero) },
  }) }))
  if (!lu.ok) return lu
  const pr = lu.data.repository?.pullRequest
  const compte = lu.data.viewer?.login
  if (typeof compte !== 'string' || !compte.trim()) return { ok: false, raison: 'GraphQL compte (`viewer.login`) hors schéma' }
  if (!pr || typeof pr.id !== 'string' || !pr.id.trim() || !estShaComplet(pr.headRefOid)
    || !['OPEN', 'CLOSED', 'MERGED'].includes(pr.state) || typeof pr.merged !== 'boolean'
    || typeof pr.isInMergeQueue !== 'boolean' || pr.merged !== (pr.state === 'MERGED'))
    return { ok: false, raison: 'GraphQL identité de PR hors schéma' }
  if (pr.headRefOid !== sha) return { ok: false, raison: `tête de PR changée : ${pr.headRefOid}, pas la tête publiée ${sha}`, compte }
  if (pr.merged) return estShaComplet(pr.mergeCommit?.oid)
    ? { ok: true, statut: 'merged', fusion: pr.mergeCommit.oid, compte }
    : { ok: false, raison: 'GraphQL PR fusionnée sans commit valide', compte }
  if (pr.state !== 'OPEN') return { ok: false, raison: 'GraphQL PR fermée sans fusion', compte }
  if (!pr.isInMergeQueue) {
    if (pr.autoMergeRequest != null && !Number.isFinite(Date.parse(pr.autoMergeRequest.enabledAt)))
      return { ok: false, raison: 'GraphQL auto-merge hors schéma', compte }
    return { ok: true, id: pr.id, compte, ...(pr.autoMergeRequest ? { statut: 'armed', deja: true } : {}) }
  }
  const entree = pr.mergeQueueEntry
  if (!entree || typeof entree.id !== 'string' || !entree.id.trim()
    || typeof entree.state !== 'string' || !entree.state.trim() || !Number.isFinite(Date.parse(entree.enqueuedAt))
    || typeof entree.enqueuer?.login !== 'string' || !entree.enqueuer.login.trim()
    || (entree.headCommit !== null && !estShaComplet(entree.headCommit?.oid)))
    return { ok: false, compte, raison: 'GraphQL entrée de file hors schéma' }
  return { ok: true, statut: 'enqueued', deja: true, compte, entree }
}

export const DELAI_FILE_MS = 10 * 60_000

export function etatFileDePr({ depot, numero, sha, appel, maintenant = Date.now }) {
  const identite = identiteDePr({ depot, numero, sha, appel })
  if (!identite.ok || identite.statut !== 'enqueued') return identite
  const { entree, compte } = identite
  if (entree.state !== 'AWAITING_CHECKS' || maintenant() - Date.parse(entree.enqueuedAt) < DELAI_FILE_MS) return identite
  const indetermine = (raison) => ({ ok: false, compte, entree, raison: `entrée ${entree.id} : ${raison}` })
  if (!estShaComplet(entree.headCommit?.oid)) return indetermine('tête de groupe indéterminée')
  let total = null
  const courses = pagesRest(`repos/${depot}/actions/workflows/ci.yml/runs?head_sha=${entree.headCommit.oid}&event=merge_group`, (args) => {
    const vu = appel(args)
    if (!vu.ok) return vu
    try {
      const lu = JSON.parse(vu.stdout)
      if (!Number.isSafeInteger(lu.total_count) || lu.total_count < 0 || lu.total_count > 1000
        || !Array.isArray(lu.workflow_runs) || (total !== null && total !== lu.total_count)) throw new Error('courses de groupe non exhaustives')
      total = lu.total_count
      return { ok: true, stdout: JSON.stringify(lu.workflow_runs) }
    } catch (e) { return { ok: false, raison: e.message } }
  })
  if (!courses.ok) return indetermine(`lecture des courses refusée : ${courses.raison}`)
  if (courses.entrees.length !== total) return indetermine('courses de groupe non exhaustives')
  if (courses.entrees.some((r) => r.head_sha === entree.headCommit.oid && r.event === 'merge_group'
    && r.name === 'CI' && r.repository?.full_name === depot && Date.parse(r.created_at) >= Date.parse(entree.enqueuedAt))) return identite
  const relue = identiteDePr({ depot, numero, sha, appel })
  if (!relue.ok) return indetermine(`relecture refusée : ${relue.raison}`)
  if (relue.statut !== 'enqueued' || ['id', 'state', 'enqueuedAt'].some((cle) => relue.entree[cle] !== entree[cle])
    || relue.entree.headCommit?.oid !== entree.headCommit.oid || relue.entree.enqueuer.login !== entree.enqueuer.login)
    return indetermine('entrée changée pendant lecture des courses')
  return { ok: true, statut: 'anomalie', compte, entree,
    raison: `PR #${numero}, entrée ${entree.id} AWAITING_CHECKS, compte « ${entree.enqueuer.login} », entrée le ${entree.enqueuedAt} : aucun run CI merge_group pour le groupe ${entree.headCommit.oid} ; geste humain : retirer cette entrée de la file GitHub, puis npm run ops:publier -- --detache` }
}

export function fusionDePr({ depot, numero, sha, appel, maintenant = Date.now, journaliser = () => {} }) {
  if (typeof depot !== 'string' || !/^[\w.-]+\/[\w.-]+$/.test(depot)
    || !/^[1-9]\d*$/.test(String(numero)) || !Number.isSafeInteger(Number(numero)) || !estShaComplet(sha))
    return { ok: false, raison: 'demande de fusion : identité ou tête invalide' }
  const lireFile = () => {
    const vue = etatFileDePr({ depot, numero, sha, appel, maintenant })
    return vue.statut === 'anomalie' ? { ok: false, raison: vue.raison, compte: vue.compte, entree: vue.entree } : vue
  }
  const identite = lireFile()
  if (!identite.ok || identite.statut) return identite
  const { compte } = identite
  const vu = appel(['pr', 'merge', String(numero), '--auto', '--repo', depot, '--match-head-commit', sha])
  if (vu.ok) {
    const confirmation = lireFile()
    return confirmation.ok && !confirmation.statut
      ? { ok: false, compte, raison: 'auto-merge accepté mais armement non confirmé' } : confirmation
  }
  const message = surUneLigne(vu.raison || vu.stderr || vu.stdout || 'gh pr merge --auto refusé')
  if (!/^gh a rendu [1-9]\d* :/.test(message)) return { ok: false, compte, raison: message }
  journaliser(`[publier] auto-merge REFUSÉ sous le compte « ${compte} » : ${message} — repli enqueuePullRequest\n`)
  const refuse = (raison) => ({ ok: false, compte,
    raison: `${refusDEnfileur({ depot, numero, compte, message: surUneLigne(message) })} (repli GraphQL : ${surUneLigne(raison)})` })
  const relue = lireFile()
  if (!relue.ok && relue.entree) return relue
  if (!relue.ok) return refuse(relue.raison)
  if (relue.statut) return relue
  const lu = graphqlDe(appel(['api', 'graphql', '--input', '-'], { input: JSON.stringify({
    query: 'mutation EnfilerFusion($input: EnqueuePullRequestInput!) { enqueuePullRequest(input: $input) { mergeQueueEntry { id headCommit { oid } } } }',
    variables: { input: { pullRequestId: relue.id, expectedHeadOid: sha } },
  }) }))
  if (!lu.ok) return refuse(lu.raison)
  const entree = lu.data.enqueuePullRequest?.mergeQueueEntry
  if (!entree || typeof entree.id !== 'string' || !entree.id.trim()
    || (entree.headCommit !== null && !estShaComplet(entree.headCommit?.oid)))
    return refuse('GraphQL entrée de file absente ou invalide')
  const confirmation = lireFile()
  if (!confirmation.ok && confirmation.entree) return confirmation
  if (!confirmation.ok) return refuse(confirmation.raison)
  if (!confirmation.statut) return refuse('GraphQL mise en file non confirmée')
  return confirmation
}
