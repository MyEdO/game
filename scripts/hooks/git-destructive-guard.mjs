// Hook PreToolUse(Bash|PowerShell|mcp__lean-ctx__ctx_shell) : l'arbre principal est PARTAGÉ entre
// sessions parallèles — une commande git destructive (qui peut effacer du WIP non commité) y exige
// une confirmation humaine explicite, comme partout où l'arbre visé n'est pas PROUVÉ ; dans un
// worktree LIÉ dont la commande (ou le canal) prouve le répertoire, les gestes qui ne touchent que
// le WIP local passent en SILENCE. Tout LIEN posé sur un `node_modules` est REFUSÉ (#1679 L1c).
// Même arbitrage pour une SUPPRESSION RÉCURSIVE (`rm -r`, `Remove-Item -Recurse`) dont la cible
// n'est pas jetable (dépendances, artefacts, scratchpad de session).
//
// Un volet ne garde pas le WIP mais la MESURE : `git show ... -- <sha>` (le commit APRÈS le
// séparateur) est REFUSÉ — git y voit un pathspec et rend le même résultat pour tous les commits,
// sans erreur (fiche `env-git-show-ordre-commit-avant-paths`, mesuré le 2026-08-26).
//
// HORS PORTÉE, dit : une suppression dont les CIBLES ne sont pas sur la ligne de commande — elles
// arrivent par l'entrée standard (`echo src/engine | xargs rm -rf`) ou d'un autre programme
// (`find . -name x -exec rm -rf {} \;`). Le garde décide sur les chemins qu'il LIT : une cible
// inconnue avant l'exécution ne se garde pas au PreToolUse (même borne que `$VAR issue create` pour
// le socle). Le cas est JOUÉ par un test de périmètre, pour que le silence reste un fait mesuré.
//
// Détection STRUCTURELLE (jamais un grep de sous-chaîne sur la ligne entière) : on réutilise le
// tokenizer quote-aware de `solde-ticket-guard` (`segmentsProfonds`/`gitSubcommand`, invariant
// partagé) — sans lui, `Write-Output "git stash"` ou un message de commit citant `git reset --hard`
// déclenchaient un `ask` sur une commande qui n'exécute rien (faux positif mesuré 2026-08-03).
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import {
  segmentsProfonds, gitSubcommand, valeurParametre, indexParametre,
  repertoireNommeParLaCommande, estWorktreeLie,
} from './solde-ticket-guard.mjs'

/** Une option courte parmi `letters` est-elle présente (isolée ou groupée : `-fd`, `-fdx`) ? */
const hasShortFlag = (args, letters) =>
  args.some((a) => /^-[a-zA-Z]+$/.test(a) && [...a.slice(1)].some((c) => letters.includes(c)))

/** `{ sub, args }` d'un `git` → `{ what, famille }`, ou `null`. Trois FAMILLES, trois portées :
 *  `arbre` ne touche que le WIP de l'arbre où la commande s'exécute ; `stash` touche une pile
 *  PARTAGÉE par tous les worktrees (mesuré : `git rev-parse --git-path refs/stash` rend le même
 *  chemin depuis l'arbre principal et depuis un worktree lié) ; `push` sort du poste. */
function destructiveReason({ sub, args }) {
  switch (sub) {
    // `git checkout -- <paths>` / `git checkout .` : écrase l'arbre de travail.
    case 'checkout':
      return args.includes('--') || args.includes('.') ? { what: 'git checkout de fichiers', famille: 'arbre' } : null
    // `--staged` seul ne touche que l'index ; sans lui, l'arbre de travail est écrasé.
    case 'restore':
      return args.includes('--staged') ? null : { what: "git restore de l'arbre de travail", famille: 'arbre' }
    case 'reset':
      return args.includes('--hard') ? { what: 'git reset --hard', famille: 'arbre' } : null
    case 'clean':
      return hasShortFlag(args, 'fdx') || args.some((a) => /^--(force|d)$/.test(a))
        ? { what: 'git clean', famille: 'arbre' } : null
    // `stash list`/`stash show` sont des LECTURES ; tout le reste déplace ou détruit du WIP.
    case 'stash':
      return args[0] === 'list' || args[0] === 'show' ? null : { what: 'git stash', famille: 'stash' }
    case 'push':
      return args.some((a) => a === '-f' || /^--force(-with-lease)?(=|$)/.test(a))
        ? { what: 'git push --force', famille: 'push' } : null
    default:
      return null
  }
}

/** Nom d'exécutable d'un segment : basename sans extension, en minuscules (call-operator sauté). */
function executableDe(segment) {
  const start = segment[0] === '&' ? 1 : 0
  if (segment.length <= start) return { exe: '', args: [] }
  const exe = segment[start].replace(/\\/g, '/').split('/').pop().replace(/\.(exe|cmd|bat)$/i, '').toLowerCase()
  return { exe, args: segment.slice(start + 1) }
}

/** Paramètres de `New-Item` (propres + communs) avec lesquels un préfixe pourrait être AMBIGU. */
const PARAMS_NEW_ITEM = [
  'ItemType', 'Path', 'Name', 'Value', 'Force', 'Credential', 'WhatIf', 'Confirm', 'UseTransaction',
  'Verbose', 'Debug', 'ErrorAction', 'ErrorVariable', 'WarningAction', 'WarningVariable',
  'InformationAction', 'InformationVariable', 'OutVariable', 'OutBuffer', 'PipelineVariable',
]

/** `mklink` est un BUILTIN de `cmd` : derrière `cmd /c`, l'exécutable du segment est `cmd`, et le
 *  reste de la ligne (chaînée par `&`/`;`, quotée ou non) porte l'invocation. On la lit sur les
 *  arguments RECOLLÉS — une chaîne quotée en un seul token la porte tout entière. */
const MKLINK_APRES_CMD_RE = /(?:^|[\s&;|("'])mklink(?=$|[\s"'])/i
const MKLINK_FLAG_RE = /(?:^|[\s"'])\/[jdh](?=$|[\s"'])/i

/**
 * Libellé du LIEN posé par ce segment sur un `node_modules`, ou `null`.
 * Trois graphies, une seule règle : `New-Item -ItemType Junction|SymbolicLink|HardLink` (PowerShell),
 * `mklink /J|/D|/H` (cmd, en direct ou derrière `cmd /c`), `ln -s` (POSIX) — dès qu'un des chemins
 * nomme `node_modules`.
 */
function lienNodeModules(segment) {
  const { exe, args } = executableDe(segment)
  let forme
  if (exe === 'new-item' || exe === 'ni') {
    const type = valeurParametre(args, 'ItemType', PARAMS_NEW_ITEM)
    if (!/^(junction|symboliclink|hardlink)$/i.test(type)) return null
    forme = `New-Item -ItemType ${type}`
  } else if (exe === 'mklink') {
    if (!args.some((a) => /^\/[jdh]$/i.test(a))) return null
    forme = 'mklink'
  } else if (exe === 'cmd') {
    const suite = args.join(' ')
    if (!MKLINK_APRES_CMD_RE.test(suite) || !MKLINK_FLAG_RE.test(suite)) return null
    forme = 'cmd /c mklink'
  } else if (exe === 'ln') {
    if (!args.some((a) => /^-[a-zA-Z]*s/.test(a))) return null
    forme = 'ln -s'
  } else {
    return null
  }
  return args.some((a) => /node_modules/i.test(a)) ? forme : null
}

/** Cibles qu'une suppression récursive peut emporter sans arbitrage : dépendances et artefacts
 *  reconstructibles, et le scratchpad de session (hors dépôt, jetable par nature). */
const CIBLES_JETABLES = [/(^|[\\/])node_modules([\\/]|$)/i, /(^|[\\/])\.cache([\\/]|$)/i,
  /(^|[\\/])dist([\\/]|$)/i, /public[\\/]qc([\\/]|$)/i, /[\\/]Temp[\\/]claude[\\/]/i]

/** Paramètres de `Remove-Item` (propres + communs) avec lesquels un préfixe pourrait être AMBIGU. */
const PARAMS_REMOVE_ITEM = [
  'Path', 'LiteralPath', 'Filter', 'Include', 'Exclude', 'Recurse', 'Force', 'Credential', 'Stream',
  'WhatIf', 'Confirm', 'UseTransaction', 'Verbose', 'Debug', 'ErrorAction', 'ErrorVariable',
  'WarningAction', 'WarningVariable', 'InformationAction', 'InformationVariable', 'OutVariable',
  'OutBuffer', 'PipelineVariable',
]

/** Paramètres de `Remove-Item` qui prennent une VALEUR (les autres sont des switches). */
const PARAMS_VALEUR_REMOVE_ITEM = [
  'Path', 'LiteralPath', 'Filter', 'Include', 'Exclude', 'Stream', 'Credential', 'ErrorAction',
  'ErrorVariable', 'WarningAction', 'WarningVariable', 'InformationAction', 'InformationVariable',
  'OutVariable', 'OutBuffer', 'PipelineVariable',
]

/** Ce token est-il un paramètre à valeur (préfixe non ambigu accepté, comme l'hôte) ? */
const prendValeur = (token) => PARAMS_VALEUR_REMOVE_ITEM.some((n) => indexParametre([token], n, PARAMS_REMOVE_ITEM) === 0)

/** Cibles d'une SUPPRESSION RÉCURSIVE portée par ce segment (`[]` s'il n'en est pas une). Deux
 *  graphies, une seule règle : `rm -r|-rf` (POSIX) et `Remove-Item -Recurse` (PowerShell). */
function ciblesSuppressionRecursive(segment) {
  const { exe, args } = executableDe(segment)
  if (exe === 'rm') {
    const recursif = hasShortFlag(args, 'rR') || args.includes('--recursive')
    return recursif ? args.filter((a) => !a.startsWith('-')) : []
  }
  if (exe === 'remove-item' || exe === 'ri' || exe === 'rd' || exe === 'rmdir') {
    if (indexParametre(args, 'Recurse', PARAMS_REMOVE_ITEM) === -1) return []
    const nommees = ['Path', 'LiteralPath'].map((p) => valeurParametre(args, p, PARAMS_REMOVE_ITEM)).filter(Boolean)
    // Un paramètre SWITCH (`-Force`, `-Recurse`) ne consomme pas le token suivant : sans cette
    // distinction, la cible d'un `Remove-Item -Recurse -Force src/x` passait pour la valeur de -Force.
    const positionnelles = args.filter((a, i) => !a.startsWith('-') && !prendValeur(args[i - 1] ?? ''))
    return [...new Set([...nommees, ...positionnelles])]
  }
  return []
}

/** Le SHA passé APRÈS le séparateur `--` d'un `git show`, ou `null`. Tout ce qui suit `--` est un
 *  PATHSPEC : le commit y devient un filtre de chemin, et la commande rend silencieusement le même
 *  résultat pour tous les commits (piège mesuré 2026-08-26, fiche
 *  `env-git-show-ordre-commit-avant-paths`). */
function shaApresSeparateur({ sub, args }) {
  if (sub !== 'show') return null
  const sep = args.indexOf('--')
  if (sep === -1) return null
  return args.slice(sep + 1).find((a) => /^[0-9a-f]{7,40}$/i.test(a)) ?? null
}

/**
 * Répertoire où la commande s'exécute, quand il est PROUVÉ : nommé par la commande elle-même
 * (`git -C <chemin>`, ou un changement de répertoire — `cd`, et ses graphies PowerShell
 * `Set-Location`/`sl`/`chdir`/`pushd`, #1729) ou transmis par le canal (`tool_input.cwd`, que seul
 * `ctx_shell` fournit). `null` sinon — le cwd PERSISTANT du canal Bash n'est observable par aucun
 * hook, et une permission accordée sur un arbre deviné vaudrait pour l'arbre principal.
 *
 * Les graphies PowerShell ÉLARGISSENT la surface de permission de cette porte autant que celle de
 * l'autre : un `Set-Location <worktree lié>; git reset --hard` passe désormais en silence comme son
 * équivalent `cd`, et un `Set-Location <arbre principal>` reste arbitré. C'est la MEME règle lue
 * dans la MEME source (`repertoireNommeParLaCommande`), pas une tolérance de plus.
 */
export function repertoireProuve(command, cwd = null) {
  const nomme = repertoireNommeParLaCommande(command, cwd ?? process.cwd())
  if (nomme) return nomme
  return cwd ? resolve(cwd) : null
}

/**
 * Décision du hook (PURE hors la lecture du `.git` de l'arbre visé, testable). `null` = silence ;
 * `{ decision, reason }` sinon — `ask` pour un git destructif et pour une suppression récursive hors
 * cibles jetables (l'humain arbitre), `deny` pour un lien sur `node_modules` et pour un `git show`
 * dont le commit est passé APRÈS `--` (il rend un résultat FAUX sans le dire). Une commande est
 * visée si l'un de ses SEGMENTS PROFONDS (enchaînements, enrobeurs de tête, sous-shells) l'exécute
 * réellement.
 *
 * WORKTREE À RÉPERTOIRE PROUVÉ (question utilisateur 2026-09-03 : « Pour les git destructif, on
 * devrait pouvoir les faire sur les worktree, tu ne pense pas ? ») : `checkout`/`restore`/`reset`/
 * `clean` ne touchent que le WIP de LEUR arbre — index privé, arbre de travail privé, et
 * `git clean -fdx` retire le point de reparse d'une jonction `node_modules` sans suivre la jonction
 * (les trois mesurés en dépôt jetable) — donc SILENCE quand l'arbre visé est PROUVÉ et qu'il est
 * POSITIVEMENT un worktree lié (`estWorktreeLie` : son `.git` est un FICHIER). « Pas l'arbre
 * principal » ne suffit pas : un chemin qui ne mène à aucun dépôt répondait pareil, et
 * `git -C ./.wt-inexistant reset --hard` passait en silence (mesuré 2026-09-04). Sans preuve de
 * répertoire, `ask` inchangé, et le message dit le geste. `stash` reste `ask` PARTOUT : sa pile est
 * partagée par tous les worktrees.
 */
export function evaluate(command, { cwd = null } = {}) {
  if (!command) return null
  const vise = repertoireProuve(command, cwd)
  const worktreeLie = vise !== null && estWorktreeLie(vise)
  for (const segment of segmentsProfonds(command)) {
    const lien = lienNodeModules(segment)
    if (lien) {
      return {
        decision: 'deny',
        reason:
          `⛔ Lien sur un node_modules REFUSÉ (${lien}, #1679 L1c) : supprimer le lien plus tard strippe ` +
          `le node_modules PARTAGÉ qu'il vise (Remove-Item/rm suivent la jonction et vident la cible), ` +
          `et un arbre qui emprunte les dépendances d'un autre ne prouve rien de ses propres versions. ` +
          `Poser un "npm ci" PROPRE dans l'arbre.`,
      }
    }
    const cibles = ciblesSuppressionRecursive(segment)
    const aArbitrer = cibles.filter((c) => !CIBLES_JETABLES.some((re) => re.test(c)))
    if (aArbitrer.length > 0) {
      return {
        decision: 'ask',
        reason:
          `⚠ Suppression RÉCURSIVE dans un arbre partagé : ${aArbitrer.join(', ')}. Une cible qui n'est ` +
          `ni node_modules, ni .cache, ni dist, ni public/qc, ni le scratchpad de session peut porter ` +
          `du WIP vivant (le tien ou celui d'une autre session) — et un joker y emporte ce qui n'était ` +
          `pas visé. Vérifier le contenu (git status, ls) avant de confirmer.`,
      }
    }
    const git = gitSubcommand(segment)
    if (!git) continue
    const sha = shaApresSeparateur(git)
    if (sha) {
      return {
        decision: 'deny',
        reason:
          `⛔ \`git show\` avec le commit (${sha}) APRÈS le séparateur \`--\` : tout ce qui suit \`--\` est ` +
          `un PATHSPEC — la commande ne lit pas ce commit et rend SILENCIEUSEMENT le même résultat pour ` +
          `tous (mesuré 2026-08-26 : 9 commits, 9 sorties identiques). Écrire ` +
          `\`git show <commit> -- <paths>\`.`,
      }
    }
    const destructif = destructiveReason(git)
    if (!destructif) continue
    const { what, famille } = destructif
    if (famille === 'arbre' && worktreeLie) continue
    const geste =
      famille === 'arbre' && vise === null
        ? ` Si le geste vise un WORKTREE, préfixe \`git -C <worktree>\` ou \`cd <worktree> &&\` : le hook ` +
          `verra l'arbre et se taira.`
        : ''
    const pile = famille === 'stash'
      ? ` La pile de stash est PARTAGÉE par tous les worktrees (mesuré) : ce geste-là n'est jamais local.`
      : ''
    return {
      decision: 'ask',
      reason:
        `⚠ Arbre PARTAGÉ multi-sessions : commande git DESTRUCTIVE détectée (${what}). Les fichiers ` +
        `visés peuvent porter le WIP vivant d'une AUTRE session (near-miss documenté : #126 a failli ` +
        `écraser le travail de la session parallèle par mauvaise attribution du diff). Vérifie ` +
        `l'attribution (git log, contenu) avant de confirmer.${pile}${geste}`,
    }
  }
  return null
}

// ── Driver stdin (n'exécute QUE lancé en direct, jamais à l'import du module de test) ─────────────
const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  let raw = ''
  process.stdin.setEncoding('utf8')
  for await (const chunk of process.stdin) raw += chunk
  let command = ''
  // `tool_input.cwd` : le canal `ctx_shell` transmet le répertoire où la commande s'exécute. C'est
  // la seule PREUVE de répertoire dont un hook dispose quand la commande n'en nomme aucun.
  let cwd = null
  try {
    const toolInput = JSON.parse(raw)?.tool_input
    command = String(toolInput?.command ?? '')
    if (typeof toolInput?.cwd === 'string' && toolInput.cwd) cwd = resolve(process.cwd(), toolInput.cwd)
  } catch { /* stdin illisible → silence */ }
  const decision = evaluate(command, { cwd })
  if (decision) {
    console.log(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: decision.decision ?? 'ask',
        permissionDecisionReason: decision.reason,
      },
    }))
  }
  process.exit(0)
}
