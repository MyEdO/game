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

