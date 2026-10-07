// Garde PreToolUse(`OUTILS_SHELL`, `scripts/guards/lib/contratGarde.mjs`) : les gestes qui SAUTENT les
// hooks git où vit la porte du commit (`scripts/git-hooks/commit-msg.mjs`). Lecture en
// SUR-APPROXIMATION, segment par segment (`segmentsProfonds`, `gitSubcommand`) :
//   - `commit`/`merge`/`pull` qui portent `--no-verify` (ou une abréviation que git accepte) — `git help
//     commit`, `git help merge`, `git help pull` ; la grappe d'options courtes qui contient `n` (`-n`,
//     `-nm`, `-anm`) sous `commit` seul (`git commit -h` : `-n, --no-verify` ; `git merge -h`,
//     `git pull -h` : « -n do not show a diffstat at the end of the merge ») ;
//   - `git config` qui ÉCRIT `core.hooksPath` (valeur posée, `--unset` compris), retire ou renomme la
//     section `core`, ouvre l'éditeur (`-e`, `--edit`), ou pose un `alias.*` dont la valeur porte ce saut ;
//   - `git -c core.hooksPath=…` : `canal-outil` (`configsGitDeLaCommande`, `scripts/hooks/repartition.mjs`).
// `git push --no-verify` : #2184.
import { OUTILS_SHELL, commandeDe, verdictDe } from '../guards/lib/contratGarde.mjs'
import { REFUS_SATURE, gitSubcommand, nouveauBudget, segmentsProfonds } from '../guards/lib/commandeShell.mjs'

/** Sous-commandes git dont `--no-verify` saute `commit-msg`. */
const SOUS_COMMANDES_VERIFIEES = new Set(['commit', 'merge', 'pull'])

/** `true` si l'argument de `git <sub>` saute la vérification : `--no-verify` ou son abréviation non
 *  ambiguë (`--no-veri`), ou, sous `commit`, une grappe d'options courtes qui contient `n`. */
const sauteLaVerification = (sub, a) => (a.startsWith('--')
  ? a.length >= '--no-veri'.length && '--no-verify'.startsWith(a.split('=')[0])
  : sub === 'commit' && /^-[A-Za-z]*n/.test(a))

/** Le premier argument de `args` qui saute la vérification sous une sous-commande vérifiée, ou `undefined`. */
const sautDe = (sub, args) => (SOUS_COMMANDES_VERIFIEES.has(sub) ? args.find((a) => sauteLaVerification(sub, a)) : undefined)

/** Options de `git config` qui ne font que LIRE. */
const LECTURES_DE_CONFIG = /^(?:get|get-all|get-regexp|get-urlmatch|list|--get|--get-all|--get-regexp|--get-urlmatch|-l|--list)$/
/** Options de `git config` qui retirent la clé nommée, sans valeur. */
const RETRAITS_DE_CLE = /^(?:unset|--unset|--unset-all)$/
/** Options de `git config` qui ouvrent le fichier dans l'éditeur. */
const EDITIONS = /^(?:edit|-e|--edit)$/
/** Options de `git config` qui retirent ou renomment une section. */
const OPERATIONS_DE_SECTION = /^(?:remove-section|rename-section|--remove-section|--rename-section)$/

/** `true` si la valeur d'un alias git saute la vérification (`git help config`, `alias.*` ; le `!` d'un
 *  alias shell retiré). */
const aliasSaute = (valeur) => {
  const jetons = (valeur ?? '').replace(/^!/, '').split(/\s+/).filter(Boolean)
  return jetons.some((jeton, i) => sautDe(jeton, jetons.slice(i + 1)) !== undefined)
}

/** `true` si les arguments d'un `git config` écrivent les hooks, directement ou par un alias (`git help
 *  config` : noms de section et de clé insensibles à la casse). */
const ecritLesHooks = (args) => {
  if (args.some((a) => LECTURES_DE_CONFIG.test(a))) return false
  if (args.some((a) => EDITIONS.test(a))) return true
  return args.some((a, i) => (OPERATIONS_DE_SECTION.test(a) && /^core$/i.test(args[i + 1] ?? ''))
    || (/^core\.hookspath$/i.test(a) && (args[i + 1] !== undefined || args.some((b) => RETRAITS_DE_CLE.test(b))))
    || (/^alias\./i.test(a) && aliasSaute(args[i + 1])))
}

/**
 * Le refus d'une commande qui saute les hooks git, ou `null`.
 * @param {string} command
 * @returns {{ reason: string } | null}
 */
export function evaluate(command) {
  if (!command) return null
  const budget = nouveauBudget()
  const segments = segmentsProfonds(command, 0, { budget })
  if (budget.sature) return REFUS_SATURE
  for (const segment of segments) {
    const git = gitSubcommand(segment)
    if (!git) continue
    const saut = sautDe(git.sub, git.args)
    if (saut) {
      return {
        reason:
          `⛔ \`git ${git.sub} ${saut}\` saute le hook \`commit-msg\`, où la porte du commit juge le message et `
          + `l'index (\`scripts/git-hooks/commit-msg.mjs\`) : rejouer sans cette option (\`git commit -n\` compris, `
          + `même groupé). \`git push --no-verify\` reste à #2184.`,
      }
    }
    if (git.sub === 'config' && ecritLesHooks(git.args)) {
      return {
        reason:
          '⛔ `git config` qui écrit `core.hooksPath`, retire ou renomme la section `core`, ouvre l\'éditeur ou '
          + 'pose un alias qui saute la vérification retire la porte du commit (`scripts/git-hooks/commit-msg.mjs`) : '
          + '`npm install` pose les hooks du dépôt.',
      }
    }
  }
  return null
}

export const garde = { nom: 'hooks-git-contournes', outils: OUTILS_SHELL, evaluer: (entree) => verdictDe(evaluate(commandeDe(entree))) }
