// Garde PreToolUse(`OUTILS_SHELL`, `scripts/guards/lib/contratGarde.mjs`) : les gestes qui SAUTENT les
// hooks git où vit la porte du commit (`scripts/git-hooks/commit-msg.mjs`). Lecture en
// SUR-APPROXIMATION, segment par segment (`segmentsProfonds`, `gitSubcommand`) :
//   - `--no-verify` (ou une abréviation que git accepte) sous toute sous-commande hors de
//     `NO_VERIFY_SANS_COMMIT_MSG` — `commit`, `merge`, `pull` (`git help commit`, `git help merge`,
//     `git help pull`), et tout alias possible ; la grappe d'options courtes qui contient `n` (`-n`,
//     `-nm`, `-anm`) sous `commit` seul (`git commit -h` : `-n, --no-verify` ; `git merge -h`,
//     `git pull -h` : « -n do not show a diffstat at the end of the merge ») ;
//   - `git config` qui ÉCRIT `core.hooksPath`, `include.path` ou `includeIf.<cond>.path` (valeur posée,
//     `--unset` compris), retire ou renomme la section `core` (source ou destination), ouvre l'éditeur
//     (`-e`, `--edit`), ou pose un `alias.*` dont la valeur porte ce saut ;
//   - `git -c core.hooksPath=…` : `canal-outil` (`configsGitDeLaCommande`, `scripts/hooks/repartition.mjs`).
// `git push --no-verify` : #2184. Filet de bonne foi par classes, le fail-closed est #2184 (évaluation
// d'ingénierie game-34, 2026-10-07).
import { OUTILS_SHELL, commandeDe, verdictDe } from '../guards/lib/contratGarde.mjs'
import { REFUS_SATURE, gitSubcommand, nouveauBudget, segmentsProfonds } from '../guards/lib/commandeShell.mjs'

/** Sous-commandes git dont `--no-verify` saute `commit-msg`. */
const SOUS_COMMANDES_VERIFIEES = new Set(['commit', 'merge', 'pull'])

/** Intégrées dont `git <c> -h` (git 2.51) documente `--no-verify` sans `commit-msg` : `push` (pre-push, #2184),
 *  `rebase` (pre-rebase), `am` (pre-applypatch, applypatch-msg), `show-ref` (vérification de réf). Les
 *  autres intégrées rejettent l'option ; une sous-commande inconnue peut être un alias. */
const NO_VERIFY_SANS_COMMIT_MSG = new Set(['push', 'rebase', 'am', 'show-ref'])

/** `true` si `jeton` (avant `=`) est l'option longue `option` ou un de ses préfixes (`git config -h`,
 *  git 2.51 ; mesuré : `--comm`, `--unset-a`, `--ren` acceptés, `--uns` ambigu). Sur-approximation : le
 *  préfixe ambigu, que git rejette, compte aussi. */
const abrege = (jeton, option) => {
  const nom = jeton.split('=')[0]
  return nom.length > 2 && nom.startsWith('--') && option.startsWith(nom)
}

/** `true` si `jeton` abrège l'une des `options` longues. */
const abregeUne = (jeton, options) => options.some((option) => abrege(jeton, option))

/** `true` si l'argument de `git <sub>` saute la vérification : `--no-verify` ou son abréviation, ou, sous
 *  `commit`, une grappe d'options courtes qui contient `n`. */
const sauteLaVerification = (sub, a) => (a.startsWith('--')
  ? abrege(a, '--no-verify')
  : sub === 'commit' && /^-[A-Za-z]*n/.test(a))

/** Le premier argument de `args` qui saute la vérification sous `sub`, ou `undefined`. */
const sautDe = (sub, args) => (NO_VERIFY_SANS_COMMIT_MSG.has(sub) ? undefined : args.find((a) => sauteLaVerification(sub, a)))

/** Sous-commandes de `git config` qui ne font que LIRE, en premier argument (`git config -h`, git 2.51). */
const SOUS_COMMANDES_DE_LECTURE = /^(?:get|list)$/
/** Options d'action de `git config` qui ne font que LIRE (`git config -h`, git 2.51). */
const OPTIONS_DE_LECTURE = /^(?:--get|--get-all|--get-regexp|--get-urlmatch|--get-colorbool|-l|--list)$/
/** Options de `git config` dont la valeur est le jeton suivant (`git config get -h`, `git config set -h`). */
const OPTIONS_A_VALEUR = (a) => a === '-f' || a === '-t'
  || (abregeUne(a, ['--file', '--blob', '--type', '--value', '--url', '--default', '--comment']) && !a.includes('='))
/** Options de `git config` qui retirent la clé nommée, sans valeur. */
const RETRAITS_DE_CLE = (a) => a === 'unset' || abregeUne(a, ['--unset', '--unset-all'])
/** Options de `git config` qui ouvrent le fichier dans l'éditeur. */
const EDITIONS = (a) => a === 'edit' || a === '-e' || abrege(a, '--edit')
/** Options de `git config` qui retirent ou renomment une section (`<ancienne> <nouvelle>` pour le renommage). */
const OPERATIONS_DE_SECTION = (a) => a === 'remove-section' || a === 'rename-section'
  || abregeUne(a, ['--remove-section', '--rename-section'])
/** Clés dont la valeur pose les hooks, directement ou par un fichier inclus (`git help config`, « Includes »). */
const CLES_DES_HOOKS = /^(?:core\.hookspath|include\.path|includeif\..+\.path)$/i

/** `true` si `git config <args>` ne fait que lire : sous-commande `get`/`list` en premier argument, ou option
 *  de lecture parmi les options de tête — git lit en valeur tout jeton qui suit le premier non-option, `--`
 *  compris (mesuré git 2.51 : `git config core.hooksPath --get` écrit `--get`). */
const litLaConfig = (args) => {
  if (SOUS_COMMANDES_DE_LECTURE.test(args[0] ?? '')) return true
  for (let i = 0; i < args.length; i++) {
    if (!args[i].startsWith('-') || args[i] === '--') return false
    if (OPTIONS_DE_LECTURE.test(args[i])) return true
    if (OPTIONS_A_VALEUR(args[i])) i++
  }
  return false
}

/** `true` si la valeur d'un alias git saute la vérification (`git help config`, `alias.*` ; le `!` d'un
 *  alias shell retiré). */
const aliasSaute = (valeur) => {
  const jetons = (valeur ?? '').replace(/^!/, '').split(/\s+/).filter(Boolean)
  return jetons.some((jeton, i) => sautDe(jeton, jetons.slice(i + 1)) !== undefined)
}

/** `true` si les arguments d'un `git config` écrivent les hooks, directement ou par un alias (`git help
 *  config` : noms de section et de clé insensibles à la casse). */
const ecritLesHooks = (args) => {
  if (litLaConfig(args)) return false
  if (args.some(EDITIONS)) return true
  return args.some((a, i) => (OPERATIONS_DE_SECTION(a) && args.slice(i + 1, i + 3).some((s) => /^core$/i.test(s)))
    || (CLES_DES_HOOKS.test(a) && (args[i + 1] !== undefined || args.some(RETRAITS_DE_CLE)))
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
    if (saut && !SOUS_COMMANDES_VERIFIEES.has(git.sub)) {
      return {
        reason:
          `⛔ \`git ${git.sub} ${saut}\` : \`${git.sub}\` n'est ni \`commit\`, \`merge\`, \`pull\`, ni une intégrée qui accepte `
          + `\`--no-verify\` sans sauter le hook \`commit-msg\` — alias possible (\`git config alias.${git.sub}\`), que git `
          + `développerait en un commit sans la porte (\`scripts/git-hooks/commit-msg.mjs\`) : rejouer sous le nom de la `
          + 'commande réelle, sans cette option.',
      }
    }
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
          '⛔ `git config` qui écrit `core.hooksPath` ou un `include` (`include.path`, `includeIf.<cond>.path`), retire '
          + 'la section `core` ou renomme une section depuis ou vers `core`, ouvre l\'éditeur ou '
          + 'pose un alias qui saute la vérification retire la porte du commit (`scripts/git-hooks/commit-msg.mjs`) : '
          + '`npm install` pose les hooks du dépôt.',
      }
    }
  }
  return null
}

export const garde = { nom: 'hooks-git-contournes', outils: OUTILS_SHELL, evaluer: (entree) => verdictDe(evaluate(commandeDe(entree))) }
