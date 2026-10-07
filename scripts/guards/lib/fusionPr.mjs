const SIGNATURE_PR = 'Train de publication (`npm run ops:publier`), tête '
export const corpsDePr = (tete) => `${SIGNATURE_PR}${tete}.`
export function estPrDuTrain(corps) {
  const tete = String(corps ?? '').slice(SIGNATURE_PR.length, -1)
  return /^[0-9a-f]{40}$/i.test(tete) && corps === corpsDePr(tete)
}

export function issueDeFusion({ code, corps }) {
  const statut = corps?.status
  const details = corps?.details ?? {}
  const message = String(details.message ?? '')
  if (![200, 202, 400, 409].includes(code)) return { ok: false, raison: `HTTP ${code}${message || corps?.message ? ` : ${message || corps.message}` : ''}` }
  if (statut === 'pending' && typeof details.uuid === 'string' && details.uuid)
    return { ok: true, statut, uuid: details.uuid, attendue: details.expected_head_sha ?? null, deja: code === 409 }
  if (statut === 'merged') return { ok: true, statut, fusion: details.sha ?? null }
  if (statut === 'enqueued') return { ok: true, statut }
  if (statut === 'failed') return { ok: true, statut, message: message || `HTTP ${code}` }
  return { ok: false, raison: `HTTP ${code} hors schéma : ${JSON.stringify(corps).slice(0, 200)}` }
}


export function reponseHttp(sortie) {
  const texte = String(sortie ?? '')
  const etat = /^HTTP\/[\d.]+ (\d{3})/.exec(texte)
  if (!etat) return { ok: false, raison: `réponse sans ligne d’état HTTP : ${JSON.stringify(texte.slice(0, 120))}` }
  const vide = /\r?\n\r?\n/.exec(texte)
  const brut = vide ? texte.slice(vide.index + vide[0].length).trim() : ''
  try {
    return { ok: true, code: Number(etat[1]), corps: brut ? JSON.parse(brut) : null }
  } catch (e) {
    return { ok: false, raison: `HTTP ${etat[1]}, corps illisible : ${e.message}` }
  }
}

export const corpsDeFusion = (sha) => JSON.stringify({ sha, merge_action: 'default' })

export function fusionDe(vu) {
  if (!vu.ok && vu.stdout === undefined) return vu
  const lu = reponseHttp(vu.stdout)
  if (!lu.ok) return { ok: false, raison: vu.ok ? lu.raison : `${vu.raison} — ${lu.raison}` }
  return issueDeFusion(lu)
}

const REFUS_ENQUEUER = 'Enqueuer is not authorized to merge'

/** Le refus d'enfileur nommé : le compte refusé, le message de GitHub et le geste humain, sur UNE ligne (#2392). PUR. */
export const refusDEnfileur = ({ depot, numero, compte, message }) =>
  `mise en file REFUSÉE au compte « ${compte} » : ${message} — geste humain : bouton « Merge when ready » de https://github.com/${depot}/pull/${numero}`

const surUneLigne = (texte) => String(texte ?? '').replace(/\s*[\r\n]+\s*/g, ' ').trim()
const shaValide = (sha) => typeof sha === 'string' && /^[0-9a-f]{40}$/i.test(sha)

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
    query: 'query IdentiteDeFusion($owner: String!, $name: String!, $number: Int!) { repository(owner: $owner, name: $name) { pullRequest(number: $number) { id headRefOid state merged mergeCommit { oid } isInMergeQueue } } viewer { login } }',
    variables: { owner, name, number: Number(numero) },
  }) }))
  if (!lu.ok) return lu
  const pr = lu.data.repository?.pullRequest
  const compte = lu.data.viewer?.login
  if (typeof compte !== 'string' || !compte.trim()) return { ok: false, raison: 'GraphQL compte (`viewer.login`) hors schéma' }
  if (!pr || typeof pr.id !== 'string' || !pr.id.trim() || !shaValide(pr.headRefOid)
    || !['OPEN', 'CLOSED', 'MERGED'].includes(pr.state) || typeof pr.merged !== 'boolean'
    || typeof pr.isInMergeQueue !== 'boolean' || pr.merged !== (pr.state === 'MERGED'))
    return { ok: false, raison: 'GraphQL identité de PR hors schéma' }
  if (pr.headRefOid !== sha) return { ok: false, raison: `tête de PR changée : ${pr.headRefOid}, pas la tête publiée ${sha}`, compte }
  if (pr.merged) return shaValide(pr.mergeCommit?.oid)
    ? { ok: true, statut: 'merged', fusion: pr.mergeCommit.oid, compte }
    : { ok: false, raison: 'GraphQL PR fusionnée sans commit valide', compte }
  if (pr.state !== 'OPEN') return { ok: false, raison: 'GraphQL PR fermée sans fusion', compte }
  return pr.isInMergeQueue ? { ok: true, statut: 'enqueued', deja: true, compte } : { ok: true, id: pr.id, compte }
}

export function fusionDePr({ depot, numero, sha, uuid, appel }) {
  if (typeof depot !== 'string' || !/^[\w.-]+\/[\w.-]+$/.test(depot)
    || !/^[1-9]\d*$/.test(String(numero)) || !Number.isSafeInteger(Number(numero)) || !shaValide(sha)
    || (uuid !== undefined && (typeof uuid !== 'string' || !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(uuid))))
    return { ok: false, raison: 'demande de fusion : identité, tête ou UUID invalide' }
  const identite = identiteDePr({ depot, numero, sha, appel })
  if (!identite.ok || identite.statut) return identite
  const { compte } = identite
  const vu = uuid === undefined
    ? appel(['api', '--include', '-X', 'PUT', `repos/${depot}/pulls/${numero}/merge-async`, '--input', '-'], { input: corpsDeFusion(sha) })
    : appel(['api', '--include', `repos/${depot}/pulls/${numero}/merge-async/${uuid}`])
  const fusion = fusionDe(vu)
  const http = reponseHttp(vu.stdout)
  const message = fusion.statut === 'failed' ? fusion.message
    : !fusion.ok && http.ok && http.code >= 400 ? String(http.corps?.message ?? '') : ''
  if (!message.includes(REFUS_ENQUEUER)) return { ...fusion, compte }
  const refuse = (raison) => ({ ok: false, compte,
    raison: `${refusDEnfileur({ depot, numero, compte, message: surUneLigne(message) })} (repli GraphQL : ${surUneLigne(raison)})` })
  const relue = identiteDePr({ depot, numero, sha, appel })
  if (!relue.ok) return refuse(relue.raison)
  if (relue.statut) return relue
  const lu = graphqlDe(appel(['api', 'graphql', '--input', '-'], { input: JSON.stringify({
    query: 'mutation EnfilerFusion($input: EnqueuePullRequestInput!) { enqueuePullRequest(input: $input) { mergeQueueEntry { id headCommit { oid } } } }',
    variables: { input: { pullRequestId: relue.id, expectedHeadOid: sha } },
  }) }))
  if (!lu.ok) return refuse(lu.raison)
  const entree = lu.data.enqueuePullRequest?.mergeQueueEntry
  if (!entree || typeof entree.id !== 'string' || !entree.id.trim() || entree.headCommit?.oid !== sha)
    return refuse('GraphQL entrée de file absente ou tête différente')
  return { ok: true, statut: 'enqueued', compte }
}
