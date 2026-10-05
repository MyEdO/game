import { appendFileSync, readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DEPOT, appelGhRunner, pagesRest, poserCommentaire } from '../guards/lib/ticketsGh.mjs'
import { numerosCites } from '../guards/lib/fermetures.mjs'
import { corpsDeFusion, estPrDuTrain, fusionDe } from '../guards/lib/fusionPr.mjs'

export const BORNE_SONDES = 12
export const PERIODE_MS = 5_000
const route = (suffixe) => `repos/${DEPOT}/${suffixe}`
const shaValide = (sha) => /^[0-9a-f]{40}$/i.test(String(sha ?? ''))
const uuidValide = (uuid) => /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(String(uuid ?? ''))
export const prEligible = (pr) => pr?.state === 'open' && !pr.draft && !pr.merged_at
  && estPrDuTrain(pr.body)
  && pr.base?.ref === 'main' && pr.base?.repo?.full_name === DEPOT
  && pr.head?.repo?.full_name === DEPOT && /^chantier\/.+/.test(pr.head?.ref ?? '') && shaValide(pr.head?.sha)

function lire(chemin, appel) {
  const vu = appel(['api', chemin])
  if (!vu.ok) throw new Error(vu.raison)
  return JSON.parse(vu.stdout)
}

function coursesDe(pr, appel) {
  const chemin = route(`actions/workflows/ci.yml/runs?head_sha=${pr.head.sha}&branch=${encodeURIComponent(pr.head.ref)}&event=push`)
  const pages = pagesRest(chemin, (args) => {
    const vu = appel(args)
    if (!vu.ok) return vu
    try {
      const lu = JSON.parse(vu.stdout)
      if (!Array.isArray(lu.workflow_runs) || lu.total_count > 1000) throw new Error('courses CI non exhaustives')
      return { ok: true, stdout: JSON.stringify(lu.workflow_runs) }
    } catch (e) { return { ok: false, raison: e.message } }
  })
  if (!pages.ok) throw new Error(pages.raison)
  return pages.entrees.filter((r) => r.head_sha === pr.head.sha && r.head_branch === pr.head.ref
    && r.event === 'push' && r.repository?.full_name === DEPOT)
    .sort((a, b) => Number(b.id) - Number(a.id))[0] ?? null
}

async function reprendrePr(pr, course, { appel, attendre, borne }) {
  const actuelle = () => {
    const relue = lire(route(`pulls/${pr.number}`), appel)
    if (relue.head?.sha === pr.head.sha && relue.merged_at && shaValide(relue.merge_commit_sha))
      return { statut: 'merged', raison: `fusion confirmée ${relue.merge_commit_sha}` }
    return prEligible(relue) && relue.head.sha === pr.head.sha
  }
  let etat = actuelle()
  if (etat?.statut === 'merged') return etat
  if (!etat) return { statut: 'ignoree', raison: 'tête ou éligibilité changée' }
  const ci = lire(route(`actions/runs/${course.id}`), appel)
  if (ci.status !== 'completed' || ci.conclusion !== 'success' || ci.head_sha !== pr.head.sha
    || ci.head_branch !== pr.head.ref || ci.event !== 'push' || ci.repository?.full_name !== DEPOT)
    return { statut: 'ignoree', raison: 'CI actuelle non verte' }
  etat = actuelle()
  if (etat?.statut === 'merged') return etat
  if (!etat) return { statut: 'ignoree', raison: 'tête changée avant demande' }
  let vue = fusionDe(appel(['api', '--include', '-X', 'PUT', route(`pulls/${pr.number}/merge-async`), '--input', '-'],
    { input: corpsDeFusion(pr.head.sha) }))
  for (let sonde = 0; vue.ok && vue.statut === 'pending' && sonde < borne; sonde += 1) {
    if (vue.attendue !== pr.head.sha || !uuidValide(vue.uuid))
      return { statut: 'indeterminee', raison: 'demande pendante sans tête attendue ou UUID valide' }
    await attendre(PERIODE_MS)
    etat = actuelle()
    if (etat?.statut === 'merged') return etat
    if (!etat) return { statut: 'ignoree', raison: 'tête changée pendant suivi' }
    vue = fusionDe(appel(['api', '--include', route(`pulls/${pr.number}/merge-async/${vue.uuid}`)]))
  }
  if (!vue.ok) return { statut: 'refusee', raison: vue.raison }
  if (vue.statut === 'failed') return { statut: 'refusee', raison: vue.message }
  if (vue.statut === 'pending') return { statut: 'indeterminee', raison: `pending après ${borne} sondes` }
  return { statut: vue.statut, raison: vue.statut === 'enqueued' ? 'entrée en file confirmée' : 'fusion confirmée' }
}

function signaler(pr, course, resultat, appel, veille) {
  const commits = pagesRest(route(`pulls/${pr.number}/commits`), appel)
  if (!commits.ok) throw new Error(commits.raison)
  const tickets = numerosCites([pr.title, pr.body, ...commits.entrees.map((c) => c.commit?.message ?? '')].join('\n'))
  const empreinte = createHash('sha256').update(`${resultat.statut}:${resultat.raison}`).digest('hex').slice(0, 16)
  const marque = `<!-- reprise-file:${pr.number}:${pr.head.sha}:${empreinte} -->`
  const lienCi = `https://github.com/${DEPOT}/actions/runs/${course.id}/attempts/${course.run_attempt ?? 1}`
  const lienVeille = veille.id ? `[veille ${veille.id}](${veille.serveur}/${DEPOT}/actions/runs/${veille.id})` : 'veille locale'
  const corps = `${marque}\nPR #${pr.number}, SHA \`${pr.head.sha}\`, [CI run ${course.id}/attempt ${course.run_attempt ?? 1}](${lienCi}), ${lienVeille} : **${resultat.statut}** — ${resultat.raison}.\n\n${['enqueued', 'merged'].includes(resultat.statut) ? '' : 'Reprise : `npm run ops:publier -- --detache`.'}`
  for (const numero of new Set([String(pr.number), ...tickets])) {
    const commentaires = pagesRest(route(`issues/${numero}/comments`), appel)
    if (!commentaires.ok) throw new Error(commentaires.raison)
    if (commentaires.entrees.some((c) => String(c.body ?? '').includes(marque))) continue
    const pose = poserCommentaire({ depot: DEPOT, numero, corps, appel })
    if (!pose.ok) throw new Error(`signal #${numero} refusé : ${pose.raison}`)
  }
}

export async function reprendreFile({ appel, evenement = {}, lectureSeule = false,
  veille = { serveur: process.env.GITHUB_SERVER_URL ?? 'https://github.com', depot: process.env.GITHUB_REPOSITORY ?? DEPOT, id: process.env.GITHUB_RUN_ID ?? null },
  attendre = (ms) => new Promise((resoudre) => setTimeout(resoudre, ms)), borne = BORNE_SONDES } = {}) {
  if (veille.serveur !== 'https://github.com' || veille.depot !== DEPOT || (veille.id !== null && !/^[1-9]\d*$/.test(String(veille.id))))
    throw new Error('identité du run de veille invalide')
  if (evenement.workflow_run && (evenement.workflow_run.status !== 'completed'
    || evenement.workflow_run.conclusion !== 'success' || evenement.workflow_run.name !== 'CI'
    || evenement.workflow_run.repository?.full_name !== DEPOT)) return []
  const prs = pagesRest(route('pulls?state=open&base=main'), appel)
  if (!prs.ok) throw new Error(prs.raison)
  const resultats = []
  for (const pr of prs.entrees.filter(prEligible)) {
    if (evenement.workflow_run && evenement.workflow_run.head_sha !== pr.head.sha) continue
    const course = coursesDe(pr, appel)
    if (!course || course.status !== 'completed' || course.conclusion !== 'success') continue
    const resultat = lectureSeule ? { statut: 'candidate', raison: 'lecture seule' }
      : await reprendrePr(pr, course, { appel, attendre, borne })
    const mesure = { pr: pr.number, sha: pr.head.sha, run: course.id, attempt: course.run_attempt ?? 1, ...resultat }
    resultats.push(mesure)
    if (!lectureSeule && resultat.statut !== 'ignoree') signaler(pr, course, resultat, appel, veille)
  }
  return resultats
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try {
    const evenement = process.env.GITHUB_EVENT_PATH ? JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8')) : {}
    const resultats = await reprendreFile({ appel: appelGhRunner({ cwd: process.cwd() }), evenement,
      lectureSeule: process.argv.includes('--lecture-seule') })
    const resume = resultats.map((r) => `PR #${r.pr} SHA ${r.sha} run ${r.run}/attempt ${r.attempt} : ${r.statut} — ${r.raison}`).join('\n')
    console.log(resume || 'Aucune PR de chantier à reprendre.')
    if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY,
      `${resume || 'Aucune PR de chantier à reprendre.'}\n\nReprise en cas de refus ou indétermination : \`npm run ops:publier -- --detache\`.\n`)
  } catch (e) { console.error(e.message); process.exitCode = 1 }
}
