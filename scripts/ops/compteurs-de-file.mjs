// COMPTEURS DE VERSION SUR UN COMMIT DE FILE (#2222, #2178) — le step « Compteurs de version de la
// file » du job `types` de `.github/workflows/ci.yml`, joué sur `merge_group` seulement.
//
// Précondition de `refusDesCompteurs` (scripts/guards/lib/compteursDuDepot.mjs) : sur un commit de file
// `G` (méthode MERGE, scripts/ops/ruleset-main.mjs), `tete` = `G^2`, `tronc` = `G^1`.
//
// Usage : SHA=<commit de file> node scripts/ops/compteurs-de-file.mjs — sortie 1 sur tout refus.
import { env, exit, stderr, stdout } from 'node:process'
import { GitIndisponible, depotDe, parentsDe } from '../guards/lib/gitPorte.mjs'
import { refusDesCompteurs } from '../guards/lib/compteursDuDepot.mjs'

/**
 * Les refus des compteurs de version du commit de file `sha`, `[]` sans collision. Un `sha` qui n'a
 * pas DEUX parents n'est pas un commit de file MERGE : refus NOMMÉ, jamais un jugement sur une autre
 * paire.
 * @param {import('../guards/lib/gitPorte.mjs').Depot} depot @param {string} sha
 * @returns {string[]}
 */
export function refusDuCommitDeFile(depot, sha) {
  let parents
  try {
    parents = parentsDe(depot, sha)
  } catch (e) {
    if (!(e instanceof GitIndisponible)) throw e
    return [`compteurs de version non jugés, git en panne : ${e.raison}`]
  }
  if (parents === null) return [`compteurs de version : parents de ${sha} illisibles`]
  if (parents.length !== 2)
    return [`compteurs de version : ${sha.slice(0, 9)} porte ${parents.length} parent(s), un commit de file MERGE en porte deux (G^1 = base du groupe, G^2 = tête de la PR)`]
  return refusDesCompteurs(depot, { tete: parents[1], tronc: parents[0] })
}

if (import.meta.main) {
  const sha = env.SHA
  if (!sha) {
    stderr.write('[compteurs-de-file] SHA absent : le step lit `github.event.merge_group.head_sha`\n')
    exit(1)
  }
  const refus = refusDuCommitDeFile(depotDe(process.cwd()), sha)
  if (refus.length) {
    stderr.write(`[compteurs-de-file] REFUS sur ${sha} :\n${refus.map((r) => `  ${r}`).join('\n')}\n`)
    exit(1)
  }
  stdout.write(`[compteurs-de-file] ${sha} : aucune collision de compteur de version\n`)
}
