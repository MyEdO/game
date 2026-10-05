// CHECKS REQUIS DU SHA POUSSÉ SUR `main` (#2178) — premier step du workflow
// `.github/workflows/fermetures.yml`, avant toute fermeture de ticket.
//
// `fermetures.yml` ne joue que sur `push` de `main`, où `ci.yml` ne court pas : les checks requis du
// sha poussé sont ceux de son commit de file (`merge_group`), lus par l'API
// (`GET /repos/{owner}/{repo}/commits/{ref}/check-runs`, `filter=latest`). Les contextes attendus sont
// ceux du ruleset, lus au `ci.yml` de ce sha (`contextesRequis`, scripts/gates/gatesDeCi.mjs).
//
// Usage : SHA=<sha> node scripts/ops/checks-requis.mjs — sortie 1, chaque check manquant ou non vert
// NOMMÉ : aucun ticket ne se ferme alors, et le step « Se nommer en rougissant » du workflow le signale.
import { spawnSync } from 'node:child_process'
import { env, exit, stderr, stdout } from 'node:process'
import { contextesRequis } from '../gates/gatesDeCi.mjs'
import { DEPOT } from '../guards/lib/ticketsGh.mjs'

/**
 * Les REFUS des checks requis d'un sha, `[]` quand chacun a une course TERMINÉE et `success`. PUR.
 * @param {{ checks: readonly {name:string, status?:string, conclusion?:string|null, html_url?:string}[],
 *   contextes: readonly string[], sha: string }} p
 * @returns {string[]}
 */
export function refusDesChecks({ checks, contextes, sha }) {
  const court = String(sha).slice(0, 9)
  const refus = []
  for (const contexte of contextes) {
    const vus = checks.filter((c) => c?.name === contexte)
    if (!vus.length) {
      refus.push(`check requis « ${contexte} » ABSENT sur ${court} : aucun commit de file ne l’a jugé`)
      continue
    }
    const nonVerts = vus.filter((c) => c.status !== 'completed' || c.conclusion !== 'success')
    for (const c of nonVerts)
      refus.push(`check requis « ${contexte} » ${c.status !== 'completed' ? `EN VOL (${c.status})` : `de conclusion « ${c.conclusion ?? '(vide)'} »`} sur ${court}${c.html_url ? ` — ${c.html_url}` : ''}`)
  }
  return refus
}

/** Les check-runs d'un sha, une ligne JSON par course (`gh api --paginate --jq`). */
function checksDe(sha) {
  const vu = spawnSync('gh', [
    'api', '--paginate', `repos/${DEPOT}/commits/${sha}/check-runs?filter=latest&per_page=100`,
    '--jq', '.check_runs[] | {name, status, conclusion, html_url}',
  ], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'], timeout: 120_000 })
  if (vu.error) return { raison: vu.error.message }
  if (vu.status !== 0) return { raison: `gh a rendu ${vu.status} : ${String(vu.stderr ?? '').trim()}` }
  return { checks: String(vu.stdout).split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l)) }
}

if (import.meta.main) {
  const sha = env.SHA
  if (!sha) {
    stderr.write('[checks-requis] SHA absent : le step lit `github.sha`\n')
    exit(1)
  }
  const lu = checksDe(sha)
  if (lu.raison) {
    stderr.write(`[checks-requis] check-runs de ${sha} illisibles : ${lu.raison}\n`)
    exit(1)
  }
  const contextes = contextesRequis({ cwd: process.cwd() })
  const refus = refusDesChecks({ checks: lu.checks, contextes, sha })
  if (refus.length) {
    stderr.write(`[checks-requis] REFUS — aucun ticket ne se ferme :\n${refus.map((r) => `  ${r}`).join('\n')}\n`)
    exit(1)
  }
  stdout.write(`[checks-requis] ${sha} : ${contextes.join(', ')} verts\n`)
}
