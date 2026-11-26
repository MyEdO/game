// LES GATES SAUTÉES D'UN PUSH (#4903 L4) — le step du prologue qui suit `npm ci` (`COMMANDE_SAUTEES`,
// `ACTION_PROLOGUE`). Il lit `ECRIT_LU` (scripts/gates/toutes.mjs), dont la fermeture d'imports atteint des paquets :
// d'où sa place après l'installation, et hors du classement (`classerPush.mjs`), qui la précède. Il écrit
// `sautees= <nom> <nom> … ` : chaque step qui saute avec une gate teste `conditionDeSaut` ; un diff illisible ne
// saute rien. Il écrit aussi `zone=<projet>` (`zoneDuPush`, #5037 L2), vide hors d'un diff d'un seul projet. Le diff
// est celui du dépôt du `cwd` ; les gates, celles du `ci.yml` de ce dépôt-ci.
import { env, exit, stderr, stdout } from 'node:process'
import { fileURLToPath } from 'node:url'
import { GitIndisponible, refusDeGit } from '../guards/lib/gitPorte.mjs'
import { classerPush, gatesSautees, zoneDuPush } from './classerPush.mjs'
import { gatesDeCi } from './gatesDeCi.mjs'
import { ECRIT_LU } from './toutes.mjs'

try {
  const { fichiers, mods } = classerPush({ base: env.BASE, sha: env.SHA || 'HEAD' })
  const sautees = [...gatesSautees(fichiers, { gates: gatesDeCi({ cwd: fileURLToPath(new URL('../../', import.meta.url)) }), ecritLu: ECRIT_LU, mods })]
  const zone = zoneDuPush(fichiers, { ecritLu: ECRIT_LU, mods }) ?? ''
  stdout.write(`sautees= ${sautees.join(' ')} \nzone=${zone}\n`)
  stderr.write(`[sauteesDuPush] fichiers=${fichiers.length} zone=${zone || '(aucune)'} sautées=${sautees.length}${sautees.map((n) => `\n  - ${n}`).join('')}\n`)
} catch (erreur) {
  stderr.write(`[sauteesDuPush] erreur git non prévue : ${erreur instanceof GitIndisponible ? refusDeGit(erreur) : erreur.message}\n`)
  exit(1)
}
