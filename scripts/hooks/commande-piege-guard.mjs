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
// tokenizer quote-aware de `solde-ticket-guard` (`pipelinesDeJetons`/`gitSubcommand`, invariant
// partagé) — une commande qui CITE le geste (`Write-Output "ln -s ../node_modules"`, un message de
// commit) n'exécute rien et ne se refuse pas.
//
// La mise à mort par nom se lit aussi PAR ÉLÉMENT : un arrêt qui cible une variable LIÉE à une liste par
// nom (`Get-Process node | % { kill $_.Id }`, `pgrep node | while read p; do kill $p; done`,
// `$p = Get-Process node; Stop-Process $p`, `p=$(pgrep node); kill $p`), ou dont la cible est une
// substitution qui liste par nom (`kill $(pgrep node)`, `Stop-Process -Id (Get-Process bash).Id`).
//
// Ce que la détection ne LIT pas :
// - le flux par variable dont l'affectation n'est pas dans la commande (`Stop-Process $p`) : le contenu
//   d'une variable n'est connu qu'à l'exécution ;
// - un filtre écrit dans un autre langage (`kill -9 $(ps -W | awk '$4==10372 {print $1}')`) : le programme
//   `awk` n'est pas lu, son filtre par PID non plus ; la substitution passe pour une liste par nom ;
// - la syntaxe `-Param:valeur` et l'alias `iex` : le tokeniseur ne les déplie pas (#2172) ;
// - un lanceur indirect (`Start-Process taskkill -ArgumentList "/IM node.exe"`, `Invoke-Command`, `Start-Job`,
//   `. { }`, `start`, `exec`, `find -exec`) : le tokeniseur ne déplie pas la commande qu'il lance (#2172) ;
// - la commande que l'hôte PowerShell lit sur stdin (`… | pwsh -Command -`, `… | pwsh -`, `… | powershell`, #2172)
//   ou dans un script (`pwsh -File x.ps1`) : ni l'une ni l'autre n'est dans la ligne ;
// - la quote simple échappée hors quote de bash (`echo 'a'\''b' && pkill node`, #2172) ;
// - la sous-expression PowerShell `( … )` hors tête de segment (`$x = (Stop-Process -Name node)`,
//   `Write-Output (Stop-Process -Name node)`) : seul son listeur est lu, car en bash `arr=(pkill node)` est un
//   tableau qui n'exécute rien (#2172).
import { OUTILS_SHELL, commandeDe, verdictDe } from '../guards/lib/contratGarde.mjs'
import {
  REFUS_SATURE, affectationPowerShell, argumentChaine, basenameExecutable, finDuBloc, gitSubcommand, jetonNu, nouveauBudget,
  pipelinesDeJetons, soldeParentheses, valeurParametre,
} from './solde-ticket-guard.mjs'

/** Nom d'exécutable d'un segment (`basenameExecutable`, call-operator sauté) ; `commande` = le segment à
 *  partir de lui. */
function executableDe(segment) {
  const start = segment[0] === '&' ? 1 : 0
  if (segment.length <= start) return { exe: '', args: [], commande: [] }
  return { exe: basenameExecutable(segment[start]), args: segment.slice(start + 1), commande: segment.slice(start) }
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
// Sources : aide Microsoft de `taskkill` (`/pid`, `/im`, `/fi`), de `tasklist` (`/fi`), de `Stop-Process` et
// `Get-Process` (jeux `Id`/`Name`/`InputObject`, alias `spps`, `kill`, `gps`, `ps`), de `Get-CimInstance`/`gcim`,
// `Invoke-CimMethod`/`icim`, `Remove-CimInstance`/`rcim` (`-Query` WQL), `Get-WmiObject`/`gwmi`,
// `Invoke-WmiMethod`/`iwmi`, `Remove-WmiObject`/`rwmi` (classe `Win32_Process`, méthode `Terminate`), de `wmic` (alias
// `process`, expression de chemin `path`, verbe de schéma `class`, verbes `delete`, `call terminate` ; `wmic` est
// absent de Windows 11 26200, la lecture vient de l'aide), de `ForEach-Object` (`-MemberName`, alias `%` et
// `foreach`), about_Foreach, about_Automatic_Variables (`$_`, `$PSItem`), about_CommonParameters (`-WhatIf`) ;
// pages man `kill(1)`, `pkill(1)` (procps-ng `pgrep.c`), `killall(1)` (psmisc `killall.c`), bash `kill`
// (`-n sigspec`), `read`, `for`, POSIX `kill` (pid -1) ; README de `fkill-cli` 9.0.0 (registre npm).

/** Paramètres de `Stop-Process` et de `Get-Process` (propres, alias, communs) : base d'ambiguïté. */
const PARAMS_STOP_PROCESS = ['Id', 'Name', 'ProcessName', 'InputObject', 'PassThru', 'Force', 'WhatIf', 'Confirm', ...PARAMS_COMMUNS]
const PARAMS_GET_PROCESS = [
  'Id', 'PID', 'Name', 'ProcessName', 'InputObject', 'IncludeUserName', 'Module', 'FileVersionInfo', 'ComputerName',
  ...PARAMS_COMMUNS,
]
/** Paramètres de `Get-CimInstance`, `Invoke-CimMethod` et `Remove-CimInstance` (propres, communs). */
const PARAMS_CIM = [
  'ClassName', 'Filter', 'Query', 'QueryDialect', 'Namespace', 'ComputerName', 'CimSession', 'InputObject', 'KeyOnly',
  'OperationTimeoutSec', 'Property', 'ResourceUri', 'Shallow', 'CimClass', 'MethodName', 'Arguments', 'WhatIf', 'Confirm',
  ...PARAMS_COMMUNS,
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
/** Expression de chemin `wmic path` qui désigne `Win32_Process` : préfixe d'espace de noms facultatif
 *  (`\\hôte\root\cimv2:`), classe en casse libre, clé facultative (`.Handle=<n>`). */
const CHEMIN_WIN32_PROCESS_RE = /^(?:[^:]*:)?win32_process(?:\.(.*))?$/i
/** Clé d'une expression de chemin `Win32_Process` qui désigne UN PID. */
const CLE_HANDLE_RE = /^handle\s*=\s*['"]?\d+['"]?$/i
/** Sélection qui désigne UN PID : clause `wmic process where`, filtre `-Filter` ou clause WHERE d'un `-Query`
 *  CIM/WMI (`ProcessId = <n>`), filtre `Where-Object` (`$_.Id -eq <n>`, `Id -eq <n>`, `ProcessId -eq <n>`). */
const SELECTION_PAR_PID_RE = /^\(?\s*(?:\$(?:_|PSItem)\.)?(?:process)?id\s*(?:=|-eq)\s*['"]?\d+['"]?\s*\)?$/i

/** Drapeaux `taskkill`/`tasklist` normalisés : `/x`, `//x` et `-x` → `/x`, en minuscules. */
const drapeauxWindows = (args) => args.map((a) => a.replace(/^(\/+|-)/, '/').toLowerCase())
/** Valeurs des occurrences du drapeau `nom` (`/pid`, `/fi`) : le jeton qui suit chacune. */
const valeursDrapeau = (args, nom) => drapeauxWindows(args).flatMap((d, i) => (d === nom ? [args[i + 1] ?? ''] : []))
/** `true` si ce `taskkill` ne vise que des PID LITTÉRAUX (`/PID <n>`, ou un `/FI "PID eq <n>"` : les filtres
 *  se cumulent), sans `/IM`. */
function taskkillParPid(args) {
  const pids = valeursDrapeau(args, '/pid')
  const filtres = valeursDrapeau(args, '/fi')
  if (drapeauxWindows(args).includes('/im')) return false
  return filtres.some((f) => FILTRE_PID_RE.test(f)) || (pids.length > 0 && pids.every((p) => PID_RE.test(p)))
}

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

/** `fkill-cli` (son exécutable `fkill`, et le paquet lancé par `npx`). */
const FKILL = ['fkill', 'fkill-cli']
/** La famille `Stop-Process`, qui arrête par `-Name`, par `-Id` ou ce que le tube lui passe. */
const STOP_PROCESS = ['stop-process', 'spps', 'kill']
const avecTerminate = (args) => args.some((a) => /^terminate$/i.test(a))
/** Arrêts qui appellent une MÉTHODE : ils n'arrêtent que sous `Terminate`. */
const ARRETS_PAR_METHODE = ['invoke-cimmethod', 'icim', 'invoke-wmimethod', 'iwmi']
/** Exécutables qui ARRÊTENT des processus. */
const ARRETS = [...STOP_PROCESS, ...ARRETS_PAR_METHODE, 'remove-wmiobject', 'rwmi', 'remove-ciminstance', 'rcim', 'taskkill', ...FKILL]
/** Arrêts CIM qui portent leur PROPRE sélection (`-Query`) : jugés seuls, comme un listeur. */
const ARRETS_CIM = ['invoke-cimmethod', 'icim', 'remove-ciminstance', 'rcim']

/** `true` si `exe` arrête des processus sous ces `args` : une méthode n'arrête que sous `Terminate`, et
 *  `-WhatIf` n'arrête rien. */
function estArret(exe, args) {
  if (!ARRETS.includes(exe) || switchPresent(args, 'WhatIf', PARAMS_SIMULATION)) return false
  return !ARRETS_PAR_METHODE.includes(exe) || avecTerminate(args)
}

/** `true` si cet arrêt n'a pas de cible explicite : il arrête ce que le tube lui passe. */
function sansCible(exe, args) {
  if (STOP_PROCESS.includes(exe)) return !valeurParametre(args, 'Id', PARAMS_STOP_PROCESS) && !cibleExplicite(args)
  if (exe === 'taskkill') return !taskkillParPid(args)
  if (FKILL.includes(exe)) return !cibleExplicite(args)
  return true
}

const horsPidGetProcess = (args) =>
  !valeurParametre(args, 'Id', PARAMS_GET_PROCESS) && !valeurParametre(args, 'PID', PARAMS_GET_PROCESS)
/** La sélection CIM/WMI : la valeur de `-Filter`, ou la clause WHERE de la requête WQL `-Query`. */
const selectionWql = (args, params) =>
  (valeurParametre(args, 'Filter', params) || (/\bwhere\s+(.*)$/is.exec(valeurParametre(args, 'Query', params))?.[1] ?? '')).trim()
const processusWin32 = (params) => (args) =>
  args.some((a) => /win32_process/i.test(a)) && !SELECTION_PAR_PID_RE.test(selectionWql(args, params))
/** Exécutables qui LISTENT des processus → `true` si CE segment les choisit autrement que par PID. */
const LISTEURS = new Map([
  ...['get-process', 'gps'].map((e) => [e, horsPidGetProcess]),
  ['ps', (args) => horsPidGetProcess(args) && !args.some((a) => a === '-p' || a === '--pid')],
  ['pgrep', () => true],
  ['pidof', () => true],
  ['tasklist', (args) => !valeursDrapeau(args, '/fi').some((f) => FILTRE_PID_RE.test(f))],
  ...['get-ciminstance', 'gcim'].map((e) => [e, processusWin32(PARAMS_CIM)]),
  ...['get-wmiobject', 'gwmi'].map((e) => [e, processusWin32(PARAMS_GET_WMI)]),
])

/** La commande du segment (textes) qui LISTE des processus autrement que par PID, ou `null`. */
function listeurDuSegment(segment) {
  const { exe, args, commande } = executableDe(segment)
  return LISTEURS.get(exe)?.(args) ? commande[0] : null
}

/** Nom désigné par un paramètre `-Name`/`-ProcessName`, ou `''`. Sous bash, `kill -n` prend un
 *  signal, par numéro ou par nom : cette valeur-là n'est pas un nom de processus. */
function nomDesigne(exe, args) {
  const nom = valeurParametre(args, 'Name', PARAMS_STOP_PROCESS) || valeurParametre(args, 'ProcessName', PARAMS_STOP_PROCESS)
  if (!nom || PID_RE.test(nom)) return ''
  return exe === 'kill' && SIGNAL_RE.test(nom) ? '' : nom
}

/** Valeur attachée d'un drapeau parent `pkill` (`-P`, `-P1`, `--parent`, `--parent=1`), ou `null`. */
const parentAttache = (a) => {
  const m = /^(?:-P(.*)|--parent(?:=(.*))?)$/.exec(a)
  return m && (m[1] ?? m[2] ?? '')
}

/** `true` si `pkill` ne sélectionne que par PARENT (`-P <pid>`), sans motif. Le PID 1 n'en est pas
 *  un : ses enfants sont tous les orphelins et démons de la machine. */
function parParentSeul(args) {
  const i = args.findIndex((a) => parentAttache(a) !== null)
  if (i === -1) return false
  const attache = parentAttache(args[i])
  const valeur = attache || args[i + 1]
  if (valeur === undefined || valeur.split(',').includes('1')) return false
  const jetons = attache ? 1 : 2
  return args.every((a, k) => (k >= i && k < i + jetons) || a.startsWith('-'))
}

/** Options sous lesquelles `pkill` (procps-ng, `pgrep.c:1323-1325`, `:1198-1200`) et `killall` (psmisc,
 *  `killall.c:949`, `:1006-1010`, `:972-974`, `:1033-1052`) rendent une aide, une version ou la liste des
 *  signaux, sans rien tuer. */
const INFORMATIONS = new Map([
  ['pkill', ['-h', '--help', '-V', '--version']],
  ['killall', ['-h', '--help', '-V', '--version', '-l', '--list']],
])
const informationSeule = (exe, args) => args.length > 0 && args.every((a) => INFORMATIONS.get(exe).includes(a))

/** `true` si `fkill` vise un NOM : une cible qui n'est ni un PID littéral ni un `:port`. Sans cible, c'est
 *  l'interface interactive ; `-t`/`--force-timeout` prend une valeur. */
function fkillParNom(args) {
  const cibles = []
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '-t' || args[i] === '--force-timeout') i += 1
    else if (!args[i].startsWith('-')) cibles.push(args[i])
  }
  return cibles.some((c) => !PID_RE.test(c) && !/^:\d+$/.test(c))
}

/** Libellé d'un `wmic` qui supprime ou termine des `Win32_Process` choisis autrement que par PID, ou
 *  `null`. La classe se nomme par l'alias `process` ou par une expression de chemin (`path`), derrière les
 *  commutateurs globaux (`/node:`, `/namespace:`). */
function wmicParSelection(args) {
  const bas = args.map((a) => a.toLowerCase())
  const t = bas.findIndex((a) => !a.startsWith('/'))
  const chemin = bas[t] === 'path' ? CHEMIN_WIN32_PROCESS_RE.exec(args[t + 1] ?? '') : null
  if (t === -1 || (bas[t] !== 'process' && !chemin)) return null
  if (!bas.includes('delete') && !bas.some((a, i) => a === 'call' && bas[i + 1] === 'terminate')) return null
  const where = bas.indexOf('where')
  const fin = bas.findIndex((a, i) => i > where && (a === 'delete' || a === 'call'))
  const parPid = where !== -1
    ? SELECTION_PAR_PID_RE.test(args.slice(where + 1, fin).join(' '))
    : chemin ? CLE_HANDLE_RE.test(chemin[1] ?? '') : PID_RE.test(args[t + 1] ?? '')
  if (parPid) return null
  return chemin ? 'wmic path win32_process … delete|call terminate' : 'wmic process … delete|call terminate'
}

/** Libellé de la mise à mort PAR NOM qu'exécute ce segment seul, ou `null`. */
function arretParNom(segment) {
  const { exe, args, commande } = executableDe(segment)
  if (INFORMATIONS.has(exe) && informationSeule(exe, args)) return null
  if (exe === 'pkill') return parParentSeul(args) ? null : exe
  if (exe === 'killall') return exe
  if (FKILL.includes(exe)) return fkillParNom(args) ? commande[0] : null
  if (STOP_PROCESS.includes(exe)) return estArret(exe, args) && nomDesigne(exe, args) ? `${commande[0]} -Name` : null
  if (ARRETS_CIM.includes(exe)) return estArret(exe, args) && processusWin32(PARAMS_CIM)(args) ? `${commande[0]} Win32_Process` : null
  if (exe === 'taskkill') {
    if (drapeauxWindows(args).includes('/im')) return 'taskkill /IM'
    const filtres = valeursDrapeau(args, '/fi')
    return filtres.length > 0 && !filtres.some((f) => FILTRE_PID_RE.test(f)) ? 'taskkill /FI' : null
  }
  if (exe === 'wmic') return wmicParSelection(args)
  return null
}

// ── Liaisons : la mise à mort par élément d'une liste par nom (#2173) ───────────────────────────
// UNE lecture avant de la commande (`pipelinesDeJetons`) : corps de bloc et porteurs y sont déjà dépliés,
// chaque segment connaît le bloc qui le contient (`bloc`) et son tube (`tube`). Une variable est LIÉE quand
// sa valeur vient d'un listeur par nom (`LISTEURS`) ou d'une autre variable liée ; une réaffectation la
// délie. `$_` (`$PSItem`) est liée par la boucle du tube qui contient le segment, et se délie à la fermeture
// de son bloc ; `$x = …`, la variable d'un `foreach` ou d'un `for` persistent après le leur ; celle d'un
// `while read` se délie au `done`. Un jeton sous quote simple ne cite rien.

/** Paramètres de `ForEach-Object` (propres, communs) : base d'ambiguïté de `-MemberName`. */
const PARAMS_FOREACH_OBJECT = [
  'MemberName', 'ArgumentList', 'Begin', 'Process', 'End', 'RemainingScripts', 'InputObject', 'Parallel',
  'ThrottleLimit', 'TimeoutSeconds', 'AsJob', 'UseNewRunspace', 'WhatIf', 'Confirm', ...PARAMS_COMMUNS,
]
/** Têtes qui appellent une méthode de chaque élément (`-MemberName`). */
const APPELS_DE_MEMBRE = ['foreach-object', '%', 'foreach']
/** Têtes qui filtrent le tube. */
const FILTRES_DU_TUBE = ['where-object', 'where', '?']
/** Têtes qui lient `$_` à chaque élément du tube. */
const BOUCLES_DU_TUBE = [...APPELS_DE_MEMBRE, ...FILTRES_DU_TUBE]
const METHODE_ARRET_RE = /^(kill|terminate)$/i
/** Options de `read` qui prennent une valeur (bash `read`). */
const OPTIONS_READ_A_VALEUR = ['-a', '-d', '-i', '-n', '-N', '-p', '-t', '-u']
const VARIABLE_RE = /\$(?:\{(\w+)\}|(\w+))/g
const MEMBRE_ARRET_RE = /\$(?:\{(\w+)\}|(\w+))\.(?:Kill|Terminate)\s*\(/gi
const PIPELINE_RE = /^(_|psitem)$/i
/** `$_`, `$PSItem` ou `${_}` dans un texte. */
const DOLLAR_RE = /\$(?:_|PSItem|\{_\}|\{PSItem\})(?!\w)/i

const textesDe = (jetons) => jetons.map((j) => j.text)

/** Le listeur par nom des pipelines qu'une substitution exécute (`deplies` de `pipelinesDeJetons`), ou `null`. */
const listeurDesPipelines = (pipelines) => pipelines.flat().map((s) => listeurDuSegment(textesDe(s.jetons))).find(Boolean) ?? null

/** Le listeur par nom de la sous-expression `( … )` qu'ouvre `textes[0]` : ses mots jusqu'à la parenthèse
 *  qui la ferme, ou `null`. */
function listeurDuGroupe(textes) {
  const mots = []
  let solde = 0
  for (const [k, texte] of textes.entries()) {
    const mot = k === 0 ? texte.slice(1) : texte
    solde += soldeParentheses(texte)
    if (solde > 0) { mots.push(mot); continue }
    mots.push(mot.slice(0, mot.lastIndexOf(')')))
    break
  }
  return listeurDuSegment(mots.filter(Boolean))
}

/** En-tête `foreach ($v in <expression>) {` d'un segment relu : `{ variable, expression, textes }`
 *  (`expression` = ses jetons, `textes` = leurs textes, la parenthèse fermante de l'en-tête retirée), ou `null`. */
function enteteForeach(relus) {
  const variable = /^\(\$(\w+)$/.exec(relus[1]?.text ?? '')?.[1]
  const ouvre = relus.findIndex((j) => j.text === '{' && jetonNu(j))
  if (relus[0]?.text.toLowerCase() !== 'foreach' || !variable || !/^in$/i.test(relus[2]?.text ?? '') || ouvre === -1) return null
  const expression = relus.slice(3, ouvre)
  const textes = textesDe(expression)
  if (textes.length > 0) textes[textes.length - 1] = textes.at(-1).replace(/\)$/, '')
  return { variable, expression, textes }
}

/** Le filtre PID d'un `Where-Object`/`?` (bloc ou forme simplifiée) : `true` s'il ne laisse passer qu'un PID. */
function filtreParPid(relus) {
  if (!FILTRES_DU_TUBE.includes(basenameExecutable(relus[0]?.text))) return false
  const ouvre = relus.findIndex((j) => j.text === '{' && jetonNu(j))
  const filtre = ouvre === -1 ? relus.slice(1) : relus.slice(ouvre + 1, finDuBloc(relus, ouvre))
  return SELECTION_PAR_PID_RE.test(textesDe(filtre).join(' '))
}

/** Libellé d'un geste qui atteint la variable `nom` par sa `liaison`. */
const libelle = (nom, liaison, geste) => (PIPELINE_RE.test(nom) ? `${liaison} { ${geste} }` : `${liaison} → ${geste}`)

/** Libellé de la mise à mort PAR ÉLÉMENT que la commande exécute, ou `null` : il nomme le listeur, l'arrêt
 *  et la variable. `P` = les pipelines de `pipelinesDeJetons`. */
function arretParElement(P) {
  const lies = new Map()
  const lectures = []
  const relus = (s) => s.relus
  const sourcesDe = new Map()
  /** Pour chaque segment d'un tube, la source par nom de ce que le tube lui passe, ou `null`. */
  const sources = (tube) => {
    if (sourcesDe.has(tube)) return sourcesDe.get(tube)
    const parSegment = []
    let source = null
    sourcesDe.set(tube, parSegment)
    for (const s of tube) {
      parSegment.push(source)
      if (s.ouvreDesBlocs) {
        if (filtreParPid(relus(s))) source = null
        continue
      }
      const textes = textesDe(relus(s))
      if (textes.length === 0) continue
      const listeur = listeurDuSegment(textes)
      const citee = /^\$/.test(textes[0]) ? variableCitee(relus(s)[0], s) : null
      if (listeur) source = `${listeur} …`
      else if (citee) source = libelle(citee.nom, citee.liaison, `$${citee.nom}`)
      else if (filtreParPid(relus(s))) source = null
    }
    return parSegment
  }
  /** Liaison de `$_` dans le segment `s` : la boucle du tube qui le contient, ou `null`. */
  const tubeDuBloc = new Map()
  const liaisonDuTube = (s) => {
    const h = s.bloc
    if (!h) return null
    if (!tubeDuBloc.has(h)) {
      const k = h.tube.indexOf(h)
      const tete = relus(h)[0].text
      const exe = basenameExecutable(tete)
      const boucle = BOUCLES_DU_TUBE.includes(exe) && (k > 0 || exe !== 'foreach')
      const source = boucle && k > 0 ? sources(h.tube)[k] : null
      tubeDuBloc.set(h, exe === 'switch' || boucle ? source && `${source} | ${tete}` : liaisonDuTube(h))
    }
    return tubeDuBloc.get(h)
  }
  const entetes = new Map()
  const enteteDe = (h) => {
    if (!entetes.has(h)) entetes.set(h, enteteForeach(relus(h)))
    return entetes.get(h)
  }
  /** Liaison de la variable `nom` dans le segment `s` : l'en-tête d'un `foreach` qui le contient, sinon
   *  la liaison courante. */
  const liaisonDe = (nom, s) => {
    if (PIPELINE_RE.test(nom)) return liaisonDuTube(s)
    for (let h = s.bloc; h; h = h.bloc) {
      const entete = enteteDe(h)
      if (entete?.variable.toLowerCase() === nom.toLowerCase()) return liaisonForeach(entete, h)
    }
    return lies.get(nom.toLowerCase()) ?? null
  }
  /** La première variable liée que cite ce jeton : `{ nom, liaison }`, ou `null`. */
  const variableCitee = (jeton, s) => {
    if (!jeton || jeton.quote === 'simple') return null
    for (const m of jeton.text.matchAll(VARIABLE_RE)) {
      const nom = m[1] ?? m[2]
      const liaison = liaisonDe(nom, s)
      if (liaison) return { nom, liaison }
    }
    return null
  }
  /** Le listeur par nom d'une valeur (jetons du segment `s`, `textes` = leurs textes) : celui des pipelines
   *  que sa substitution exécute, de sa sous-expression `( … )`, ou de la commande qu'elle est. */
  const listeurDeValeur = (valeur, s, textes = textesDe(valeur)) => {
    const deplie = valeur[0] && s.deplies.get(valeur[0])
    if (deplie) return listeurDesPipelines(deplie)
    return /^\(/.test(textes[0] ?? '') ? listeurDuGroupe(textes) : listeurDuSegment(textes)
  }
  /** La source par nom d'une valeur (jetons) : son listeur, ou la liaison d'une variable qu'elle cite. */
  const sourceDe = (valeur, s, textes) => {
    const listeur = listeurDeValeur(valeur, s, textes)
    if (listeur) return `${listeur} …`
    const citee = valeur.map((j) => variableCitee(j, s)).find(Boolean)
    return citee ? citee.liaison : null
  }
  const liaisonForeach = (entete, h) => {
    const source = sourceDe(entete.expression, h, entete.textes)
    return source && `foreach ($${entete.variable} in ${source})`
  }
  const lier = (nom, liaison) => (liaison ? lies.set(nom.toLowerCase(), liaison) : lies.delete(nom.toLowerCase()))
  const ordre = P.flat()
  /** Le `done` qui suit le segment `s` (la fin de sa boucle), ou `undefined`. */
  const doneSuivant = (s) => ordre.slice(ordre.indexOf(s) + 1).find((t) => executableDe(textesDe(relus(t))).exe === 'done')
  /** L'entrée du segment `s` redirigée depuis une substitution de processus qui liste par nom (`< <(pgrep node)`),
   *  libellée pour la tête `tete`, ou `null`. */
  const entreeRedirigee = (s, tete) => {
    const jetons = s ? relus(s) : []
    const i = jetons.findIndex((j, k) => k > 0 && j.text === '<' && jetonNu(j) && s.deplies.has(jetons[k + 1]))
    const listeur = i === -1 ? null : listeurDesPipelines(s.deplies.get(jetons[i + 1]))
    return listeur && `${tete} < <(${listeur} …) → read`
  }

  for (const pipeline of P) {
    for (const s of pipeline) {
      const jetons = relus(s)
      const k = s.tube.indexOf(s)
      // Un segment qui ouvre des blocs se lit dans leurs corps ; l'en-tête d'un `foreach` y lie sa variable.
      if (s.ouvreDesBlocs) {
        const entete = k === 0 ? enteteDe(s) : null
        if (entete) lier(entete.variable, liaisonForeach(entete, s))
        continue
      }
      // Les variables shell que le segment pose (`p=$(pgrep node)`, `export p=…`) : la valeur se lit décitée.
      for (const { nom, valeur, jeton } of s.valeurs) {
        const deplie = s.deplies.get(jeton)
        const listeur = deplie ? listeurDesPipelines(deplie) : null
        const source = listeur ? `${listeur} …` : (variableCitee({ text: valeur }, s)?.liaison ?? null)
        lier(nom, source && `${nom}=$(${source})`)
      }
      const textes = textesDe(jetons)
      if (textes.length === 0) continue
      const { exe, args, commande } = executableDe(textes)
      if (exe === 'done') for (const nom of lectures.splice(0)) lies.delete(nom.toLowerCase())
      const affectation = k === 0 ? affectationPowerShell(jetons) : null
      if (affectation && !PIPELINE_RE.test(affectation.nom)) {
        const source = sourceDe(affectation.valeur, s)
        lier(affectation.nom, source && `$${affectation.nom} = ${source}`)
      }
      if (k === 0 && exe === 'for' && textes[2] === 'in') {
        const source = sourceDe(jetons.slice(3), s)
        lier(textes[1], source && `for ${textes[1]} in $(${source})`)
      }
      const source = k === 0 ? null : sources(s.tube)[k]
      if (exe === 'read' && k === s.tube.length - 1) {
        const entree = source ? `${source} | while read` : entreeRedirigee(s, 'read') ?? entreeRedirigee(doneSuivant(s), 'done')
        const fin = args.findIndex((a) => /^\d*[<>]/.test(a))
        for (const [i, nom] of args.slice(0, fin === -1 ? args.length : fin).entries()) {
          if (nom.startsWith('-') || OPTIONS_READ_A_VALEUR.includes(args[i - 1])) continue
          lier(nom, entree && `${entree} ${nom}`)
          lectures.push(nom)
        }
      }
      for (const j of jetons) {
        if (j.quote === 'simple') continue
        for (const m of j.text.matchAll(MEMBRE_ARRET_RE)) {
          const nom = m[1] ?? m[2]
          const liaison = liaisonDe(nom, s)
          if (liaison) return libelle(nom, liaison, j.text)
        }
      }
      if (source && /^\.(?:kill|terminate)\(/i.test(textes[0])) return `(${source})${textes[0]}`
      if (source && APPELS_DE_MEMBRE.includes(exe)) {
        const membre = valeurParametre(args, 'MemberName', PARAMS_FOREACH_OBJECT) || (args[0] && !args[0].startsWith('-') && args[0] !== '{' ? args[0] : '')
        if (METHODE_ARRET_RE.test(membre)) return `${source} | ${commande[0]} ${membre}`
      }
      if (!estArret(exe, args)) continue
      if (source && sansCible(exe, args)) return `${source} | ${commande[0]}`
      const bloc = jetons.findIndex((j) => j.text === '{' && jetonNu(j))
      if (source && bloc !== -1 && jetons.slice(bloc + 1).some((j) => j.quote !== 'simple' && DOLLAR_RE.test(j.text))) {
        return `${source} | ${commande[0]} {$_}`
      }
      for (let i = 1; i < jetons.length; i++) {
        const citee = variableCitee(jetons[i], s)
        if (citee) return libelle(citee.nom, citee.liaison, `${commande[0]} $${citee.nom}`)
        const deplie = s.deplies.get(jetons[i])
        const groupe = !deplie && jetonNu(jetons[i]) && /^\(/.test(jetons[i].text)
        const listeur = deplie ? listeurDesPipelines(deplie) : groupe ? listeurDuGroupe(textesDe(jetons.slice(i))) : null
        if (listeur) return `${commande[0]} … (${listeur} …)`
      }
    }
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

/** Refus d'une mise à mort par nom, `libelle` = la graphie vue. */
const refusParNom = (graphieVue) => ({
  decision: 'deny',
  reason:
    `⛔ Mise à mort de processus PAR NOM REFUSÉE (${graphieVue}, #2173) : ce geste atteint les processus ` +
    `de ce nom sur toute la MACHINE, ceux des autres sessions compris (un worktree isole des fichiers, ` +
    `pas des processus). ${ARRET_PAR_PID}`,
})

/**
 * Décision du hook (PURE, testable). `null` = silence ; `{ decision: 'deny', reason }` sinon. Une
 * commande est visée si l'un de ses SEGMENTS PROFONDS (enchaînements, enrobeurs de tête, sous-shells,
 * corps de bloc) l'exécute réellement ; le tube et les liaisons sont lus pour la mise à mort par nom.
 */
export function evaluate(command) {
  if (!command) return null
  const budget = nouveauBudget()
  const P = pipelinesDeJetons(command, 0, { budget })
  if (budget.sature) return REFUS_SATURE
  // Un segment qui ouvre des blocs n'est ni un arrêt ni un lien : il se lit dans leurs corps.
  const pipelines = P.map((p) => p.filter((s) => !s.ouvreDesBlocs).map((s) => textesDe(s.jetons)).filter((t) => t.length > 0))
  for (const pipeline of pipelines) {
    if (pipeline.some(tueTout)) {
      return {
        decision: 'deny',
        reason:
          `⛔ \`kill -1\` REFUSÉ (#2173) : le PID -1 désigne TOUS les processus que l'utilisateur peut ` +
          `signaler, ceux des autres sessions compris. ${ARRET_PAR_PID}`,
      }
    }
    const parNom = pipeline.map(arretParNom).find(Boolean)
    if (parNom) return refusParNom(parNom)
  }
  const parElement = arretParElement(P)
  if (parElement) return refusParNom(parElement)
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
