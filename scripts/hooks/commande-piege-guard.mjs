// Hook PreToolUse(Bash|PowerShell|mcp__lean-ctx__ctx_shell) : REFUSE deux commandes shell qui
// réussissent sans erreur et laissent un PIÈGE derrière elles.
//
// - Un LIEN posé sur un `node_modules` (#1679 L1c) : sa suppression ultérieure suit le lien et vide le
//   `node_modules` PARTAGÉ qu'il vise, et l'arbre qui emprunte les dépendances d'un autre ne prouve
//   rien de ses propres versions.
// - `git show ... -- <sha>` (le commit APRÈS le séparateur) : git y voit un pathspec et rend le même
//   résultat pour tous les commits, sans erreur (fiche `env-git-show-ordre-commit-avant-paths`,
//   mesuré le 2026-08-26).
//
// Détection STRUCTURELLE (jamais un grep de sous-chaîne sur la ligne entière) : on réutilise le
// tokenizer quote-aware de `solde-ticket-guard` (`segmentsProfonds`/`gitSubcommand`, invariant
// partagé) — une commande qui CITE le geste (`Write-Output "ln -s ../node_modules"`, un message de
// commit) n'exécute rien et ne se refuse pas.
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { segmentsProfonds, gitSubcommand, valeurParametre } from './solde-ticket-guard.mjs'

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
 * Décision du hook (PURE, testable). `null` = silence ; `{ decision: 'deny', reason }` sinon. Une
 * commande est visée si l'un de ses SEGMENTS PROFONDS (enchaînements, enrobeurs de tête, sous-shells)
 * l'exécute réellement.
 */
export function evaluate(command) {
  if (!command) return null
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
  try { command = String(JSON.parse(raw)?.tool_input?.command ?? '') } catch { /* stdin illisible → silence */ }
  const decision = evaluate(command)
  if (decision) {
    console.log(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: decision.decision,
        permissionDecisionReason: decision.reason,
      },
    }))
  }
  process.exit(0)
}
