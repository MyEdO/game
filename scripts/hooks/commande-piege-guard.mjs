// Garde PreToolUse(`OUTILS_SHELL`, `scripts/guards/lib/contratGarde.mjs`) : REFUSE les commandes shell qui
// réussissent sans erreur et dont l'effet DÉPASSE ce que le geste vise. Chaque piège se reconnaît à
// un exécutable et aux paramètres qui désignent sa cible :
//
// - un LIEN posé sur un `node_modules` (#1679 L1c) : sa suppression ultérieure suit le lien et vide le
//   `node_modules` PARTAGÉ qu'il vise, et l'arbre qui emprunte les dépendances d'un autre ne prouve
//   rien de ses propres versions ;
// - `git show ... -- <sha>` (le commit APRÈS le séparateur) : git y voit un pathspec et rend le même
//   résultat pour tous les commits, sans erreur (fiche `env-git-show-ordre-commit-avant-paths`,
//   mesuré le 2026-08-26) ;
// - une mise à mort de processus PAR NOM (#2173) : elle atteint les processus de ce nom de TOUTE la
//   machine, ceux des autres sessions compris — un worktree isole des fichiers, pas des processus ;
//   `kill -1` (#2173) les atteint TOUS.
//
// Détection STRUCTURELLE (jamais un grep de sous-chaîne sur la ligne entière) : on réutilise le
// tokenizer quote-aware de `solde-ticket-guard` (`pipelinesProfonds`/`gitSubcommand`, invariant
// partagé) — une commande qui CITE le geste (`Write-Output "ln -s ../node_modules"`, un message de
// commit) n'exécute rien et ne se refuse pas.
//
// Ce que la détection par segments ne voit PAS :
// - la substitution de commande POSIX (`kill $(pgrep node)`) : le tokeniseur ne la déploie pas (#2172) ;
// - un appel en sous-expression PowerShell (`Stop-Process -InputObject (Get-Process node)`) : le
//   tokeniseur rend `(Get-Process` et `node)` comme arguments (#2172) ;
// - les expressions PowerShell (`(Get-Process node).Kill()`, `ForEach-Object { $_.Kill() }`) : une
//   méthode appelée n'est pas un exécutable de segment ;
// - le flux par variable (`$p = Get-Process node; Stop-Process $p`) : le contenu d'une variable n'est
//   connu qu'à l'exécution ;
// - la syntaxe `-Param:valeur` et l'alias `iex` : le tokeniseur ne les déplie pas (#2172) ;
// - un lanceur indirect (`Start-Process taskkill -ArgumentList "/IM node.exe"`) : le tokeniseur ne déplie
//   pas la commande qu'il lance (#2172).
import { OUTILS_SHELL, commandeDe, verdictDe } from '../guards/lib/contratGarde.mjs'
import { argumentChaine, pipelinesProfonds, gitSubcommand, valeurParametre } from './solde-ticket-guard.mjs'

/** Nom d'exécutable d'un segment : basename sans extension, en minuscules (call-operator sauté) ;
 *  `commande` = le segment à partir de lui. */
function executableDe(segment) {
  const start = segment[0] === '&' ? 1 : 0
  if (segment.length <= start) return { exe: '', args: [], commande: [] }
  const exe = segment[start].replace(/\\/g, '/').split('/').pop().replace(/\.(exe|cmd|bat)$/i, '').toLowerCase()
  return { exe, args: segment.slice(start + 1), commande: segment.slice(start) }
}

/** Paramètres COMMUNS de toute cmdlet PowerShell (about_CommonParameters). */
const PARAMS_COMMUNS = [
  'Verbose', 'Debug', 'ErrorAction', 'ErrorVariable', 'WarningAction', 'WarningVariable',
  'InformationAction', 'InformationVariable', 'OutVariable', 'OutBuffer', 'PipelineVariable',
]

/** Paramètres de `New-Item` (propres + communs) avec lesquels un préfixe pourrait être AMBIGU. */
const PARAMS_NEW_ITEM = [
  'ItemType', 'Path', 'Name', 'Value', 'Force', 'Credential', 'WhatIf', 'Confirm', 'UseTransaction',
  ...PARAMS_COMMUNS,
]

/** `mklink` est un BUILTIN de `cmd` : derrière `cmd /c`, l'exécutable du segment est `cmd`, et la
 *  commande qu'il porte (chaînée par `&`, quotée ou non) contient l'invocation. On la lit dans la
 *  commande que lit `solde-ticket-guard` (`argumentChaine` : le reste de la ligne après `/c`/`/k`). */
const MKLINK_APRES_CMD_RE = /(?:^|[\s&;|("'])mklink(?=$|[\s"'])/i
const MKLINK_FLAG_RE = /(?:^|[\s"'])\/[jdh](?=$|[\s"'])/i

/**
 * Libellé du LIEN posé par ce segment sur un `node_modules`, ou `null`.
 * Trois graphies, une seule règle : `New-Item -ItemType Junction|SymbolicLink|HardLink` (PowerShell),
 * `mklink /J|/D|/H` (cmd, en direct ou derrière `cmd /c`), `ln -s` (POSIX) — dès qu'un des chemins
 * nomme `node_modules`.
 */
function lienNodeModules(segment) {
  const { exe, args, commande } = executableDe(segment)
  let forme
  if (exe === 'new-item' || exe === 'ni') {
    const type = valeurParametre(args, 'ItemType', PARAMS_NEW_ITEM)
    if (!/^(junction|symboliclink|hardlink)$/i.test(type)) return null
    forme = `New-Item -ItemType ${type}`
  } else if (exe === 'mklink') {
    if (!args.some((a) => /^\/[jdh]$/i.test(a))) return null
    forme = 'mklink'
  } else if (exe === 'cmd') {
    const suite = argumentChaine(commande) ?? ''
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

// ── Mise à mort de processus PAR NOM (#2173) ────────────────────────────────────────────────────
// Sources : aide Microsoft de `taskkill` (`/pid`, `/im`, `/fi`), de `Stop-Process` et `Get-Process`
// (jeux `Id`/`Name`/`InputObject`, alias `spps`, `kill`, `gps`, `ps`), de `Get-CimInstance`/`gcim`,
// `Invoke-CimMethod`/`icim`, `Get-WmiObject`/`gwmi`, `Invoke-WmiMethod`/`iwmi`, `Remove-WmiObject`/
// `rwmi` (classe `Win32_Process`, méthode `Terminate`), de `wmic` (alias `process`, verbes `delete`,
// `call terminate`), about_CommonParameters (`-WhatIf`) ; pages man `kill(1)`, `pkill(1)`,
// `killall(1)`, bash `kill` (`-n sigspec`), POSIX `kill` (pid -1).

/** Paramètres de `Stop-Process` et de `Get-Process` (propres, alias, communs) : base d'ambiguïté. */
const PARAMS_STOP_PROCESS = ['Id', 'Name', 'ProcessName', 'InputObject', 'PassThru', 'Force', 'WhatIf', 'Confirm', ...PARAMS_COMMUNS]
const PARAMS_GET_PROCESS = [
  'Id', 'PID', 'Name', 'ProcessName', 'InputObject', 'IncludeUserName', 'Module', 'FileVersionInfo', 'ComputerName',
  ...PARAMS_COMMUNS,
]
const PARAMS_GET_CIM = [
  'ClassName', 'Filter', 'Query', 'QueryDialect', 'Namespace', 'ComputerName', 'CimSession', 'InputObject', 'KeyOnly',
  'OperationTimeoutSec', 'Property', 'ResourceUri', 'Shallow', ...PARAMS_COMMUNS,
]
const PARAMS_GET_WMI = [
  'Class', 'Filter', 'Query', 'Property', 'Namespace', 'ComputerName', 'Credential', 'List', 'Recurse', 'Amended',
  'DirectRead', 'Impersonation', 'Authentication', 'Locale', 'EnableAllPrivileges', 'Authority', 'AsJob',
  'ThrottleLimit', ...PARAMS_COMMUNS,
]
/** Base d'ambiguïté de `-WhatIf`, paramètre commun des cmdlets qui modifient. */
const PARAMS_SIMULATION = ['WhatIf', 'Confirm', ...PARAMS_COMMUNS]
const PID_RE = /^-?\d+$/
/** Nom de signal (bash `kill -l`, casse libre, `SIG` facultatif) : la valeur de `kill -n`. */
const SIGNAL_RE = /^(sig)?(hup|int|quit|ill|trap|abrt|iot|emt|bus|fpe|kill|usr1|segv|usr2|pipe|alrm|term|stkflt|chld|cont|stop|tstp|ttin|ttou|urg|xcpu|xfsz|vtalrm|prof|winch|io|poll|pwr|sys|rtmin|rtmax)([+-]\d+)?$/i
/** Filtre `taskkill /FI` qui désigne UN PID ; tout autre filtre sélectionne par critère. */
const FILTRE_PID_RE = /^\s*pid\s+eq\s+\d+\s*$/i
/** Clause `wmic process where` ou filtre `-Filter` CIM/WMI qui désigne UN PID. */
const WHERE_PID_RE = /^\(?\s*processid\s*=\s*['"]?\d+['"]?\s*\)?$/i

/** `true` si le switch `nom` figure dans `args` : `valeurParametre` rend le jeton qui le SUIT, la
 *  butée ajoutée garantit qu'il existe. */
function switchPresent(args, nom, params) {
  return valeurParametre([...args, '-'], nom, params) !== ''
}

/** `true` si l'arrêt nomme sa cible : un PID, un job `%N` ou une variable en argument positionnel —
 *  `-N` n'en est un qu'après `--` (groupe de processus), avant il est le signal de `kill -9`. */
function cibleExplicite(args) {
  const sep = args.indexOf('--')
  const positionnel = (a, i) => (sep !== -1 && i > sep) || !a.startsWith('-')
  return args.some((a, i) => positionnel(a, i) && (PID_RE.test(a) || /^[%$]/.test(a)))
}

/** La famille `Stop-Process`, qui arrête par `-Name`, par `-Id` ou ce que le tube lui passe. */
const STOP_PROCESS = ['stop-process', 'spps', 'kill']
const avecTerminate = (args) => args.some((a) => /^terminate$/i.test(a))
/** Exécutables qui arrêtent les processus que le tube leur passe → `true` si CE segment arrête sans
 *  cible explicite. */
const ARRETS = new Map([
  ...STOP_PROCESS.map((e) => [e, (args) => !valeurParametre(args, 'Id', PARAMS_STOP_PROCESS) && !cibleExplicite(args)]),
  ...['invoke-cimmethod', 'icim', 'invoke-wmimethod', 'iwmi'].map((e) => [e, avecTerminate]),
  ...['remove-wmiobject', 'rwmi'].map((e) => [e, () => true]),
])

const horsPidGetProcess = (args) =>
  !valeurParametre(args, 'Id', PARAMS_GET_PROCESS) && !valeurParametre(args, 'PID', PARAMS_GET_PROCESS)
const processusWin32 = (params) => (args) =>
  args.some((a) => /win32_process/i.test(a)) && !WHERE_PID_RE.test(valeurParametre(args, 'Filter', params))
/** Exécutables qui LISTENT des processus → `true` si CE segment les choisit autrement que par PID. */
const LISTEURS = new Map([
  ...['get-process', 'gps'].map((e) => [e, horsPidGetProcess]),
  ['ps', (args) => horsPidGetProcess(args) && !args.some((a) => a === '-p' || a === '--pid')],
  ['pgrep', () => true],
  ['pidof', () => true],
  ...['get-ciminstance', 'gcim'].map((e) => [e, processusWin32(PARAMS_GET_CIM)]),
  ...['get-wmiobject', 'gwmi'].map((e) => [e, processusWin32(PARAMS_GET_WMI)]),
])

/** Nom désigné par un paramètre `-Name`/`-ProcessName`, ou `''`. Sous bash, `kill -n` prend un
 *  signal, par numéro ou par nom : cette valeur-là n'est pas un nom de processus. */
function nomDesigne(exe, args) {
  const nom = valeurParametre(args, 'Name', PARAMS_STOP_PROCESS) || valeurParametre(args, 'ProcessName', PARAMS_STOP_PROCESS)
  if (!nom || PID_RE.test(nom)) return ''
  return exe === 'kill' && SIGNAL_RE.test(nom) ? '' : nom
}

/** `true` si `pkill` ne sélectionne que par PARENT (`-P <pid>`), sans motif. */
function parParentSeul(args) {
  const i = args.findIndex((a) => a === '-P' || a === '--parent')
  if (i === -1 || args[i + 1] === undefined) return false
  return args.every((a, k) => k === i || k === i + 1 || a.startsWith('-'))
}

/** Libellé de la mise à mort PAR NOM qu'exécute ce segment seul, ou `null`. */
function arretParNom(segment) {
  const { exe, args, commande } = executableDe(segment)
  if (exe === 'pkill') return parParentSeul(args) ? null : exe
  if (exe === 'killall') return exe
  if (STOP_PROCESS.includes(exe)) {
    if (switchPresent(args, 'WhatIf', PARAMS_SIMULATION)) return null
    return nomDesigne(exe, args) ? `${commande[0]} -Name` : null
  }
  if (exe === 'taskkill') {
    const drapeaux = args.map((a) => a.replace(/^(\/+|-)/, '/').toLowerCase())
    if (drapeaux.includes('/im')) return 'taskkill /IM'
    const filtre = drapeaux.indexOf('/fi')
    return filtre !== -1 && !FILTRE_PID_RE.test(args[filtre + 1] ?? '') ? 'taskkill /FI' : null
  }
  if (exe === 'wmic') {
    const bas = args.map((a) => a.toLowerCase())
    const alias = bas.indexOf('process')
    const verbe = bas.includes('delete') || bas.some((a, i) => a === 'call' && bas[i + 1] === 'terminate')
    if (alias === -1 || !verbe) return null
    const where = bas.indexOf('where')
    const parPid = where === -1 ? PID_RE.test(args[alias + 1] ?? '') : WHERE_PID_RE.test(args[where + 1] ?? '')
    return parPid ? null : 'wmic process … delete|call terminate'
  }
  return null
}

/** Libellé du tube qui passe à un arrêt SANS cible explicite les processus qu'un listeur a choisis
 *  autrement que par PID (`Get-Process node | Stop-Process`, `pgrep x | xargs kill`,
 *  `Get-CimInstance Win32_Process … | Invoke-CimMethod -MethodName Terminate`), ou `null`. */
function arretParTube(pipeline) {
  for (let k = 1; k < pipeline.length; k++) {
    const { exe, args, commande } = executableDe(pipeline[k])
    if (!ARRETS.get(exe)?.(args) || switchPresent(args, 'WhatIf', PARAMS_SIMULATION)) continue
    const listeur = pipeline.slice(0, k).map(executableDe).find((s) => LISTEURS.get(s.exe)?.(s.args))
    if (listeur) return `${listeur.commande[0]} … | ${commande[0]}`
  }
  return null
}

/** `true` si ce `kill` vise le PID -1 : TOUS les processus que l'utilisateur peut signaler. Le PID
 *  suit un signal ou `--` ; seul, `-1` est aussi lu comme cible. */
function tueTout(segment) {
  const { exe, args } = executableDe(segment)
  return exe === 'kill' && args.some((a, i) => a === '-1' && (i > 0 || args.length === 1))
}

const ARRET_PAR_PID =
  `Arrêter SA tâche par son PID : \`taskkill //PID <pid>\`, \`kill <pid>\` ou \`Stop-Process -Id <pid>\` ; ` +
  `une tâche d'arrière-plan du harnais : \`TaskStop\`.`

/**
 * Décision du hook (PURE, testable). `null` = silence ; `{ decision: 'deny', reason }` sinon. Une
 * commande est visée si l'un de ses SEGMENTS PROFONDS (enchaînements, enrobeurs de tête, sous-shells)
 * l'exécute réellement ; le tube qui les relie est lu pour la mise à mort par nom.
 */
export function evaluate(command) {
  if (!command) return null
  const pipelines = pipelinesProfonds(command)
  for (const pipeline of pipelines) {
    if (pipeline.some(tueTout)) {
      return {
        decision: 'deny',
        reason:
          `⛔ \`kill -1\` REFUSÉ (#2173) : le PID -1 désigne TOUS les processus que l'utilisateur peut ` +
          `signaler, ceux des autres sessions compris. ${ARRET_PAR_PID}`,
      }
    }
    const parNom = arretParTube(pipeline) ?? pipeline.map(arretParNom).find(Boolean)
    if (parNom) {
      return {
        decision: 'deny',
        reason:
          `⛔ Mise à mort de processus PAR NOM REFUSÉE (${parNom}, #2173) : ce geste atteint les processus ` +
          `de ce nom sur toute la MACHINE, ceux des autres sessions compris (un worktree isole des fichiers, ` +
          `pas des processus). ${ARRET_PAR_PID}`,
      }
    }
  }
  for (const segment of pipelines.flat()) {
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

export const garde = { nom: 'commande-piege', outils: OUTILS_SHELL, evaluer: (entree) => verdictDe(evaluate(commandeDe(entree))) }
