// DÉTACHEMENT d'un processus node du dépôt (#1784, #2493, #2603). Tout détaché tourne en BelowNormal
// (`./abaisser-priorite.mjs`, #2603) et n'hérite d'aucun jeton de verrou (`PREFIXE_JETON_VERROU`) ni de l'index d'un hook (`GIT_INDEX_FILE`, #2603).
import { spawn, spawnSync } from 'node:child_process'
import { isAbsolute } from 'node:path'
import { PREFIXE_JETON_VERROU } from '../../test/verrou.mjs'
import { estPidDeProcessus } from './pid.mjs'

/** Le préchargement qui abaisse la priorité du détaché (`node --import`). */
export const ABAISSER_PRIORITE = Object.freeze(['--import', new URL('./abaisser-priorite.mjs', import.meta.url).href])

/**
 * Un token de ligne de commande Win32 : ce que `CommandLineToArgvW` (donc `node`, donc tout
 * exécutable C) relira comme UN argument. PURE.
 * https://learn.microsoft.com/cpp/c-language/parsing-c-command-line-arguments
 * Règle Win32 : le token est entouré de guillemets doubles ; les backslashes qui PRÉCÈDENT un
 * guillemet — ou la fin du token — se doublent ; le guillemet interne s'échappe en `\\"`.
 * @param {string} valeur
 * @returns {string} token cité
 */
export function citerArgv(valeur) {
  const texte = String(valeur)
  let token = '"'
  let backslashes = 0
  for (const caractere of texte) {
    if (caractere === '\\') {
      backslashes += 1
      continue
    }
    if (caractere === '"') {
      token += '\\'.repeat(backslashes * 2 + 1) + '"'
      backslashes = 0
      continue
    }
    token += '\\'.repeat(backslashes) + caractere
    backslashes = 0
  }
  return `${token}${'\\'.repeat(backslashes * 2)}"`
}

/**
 * Le seul site de détachement d'un processus node du dépôt (#1784, #2493, #2603). Sous win32,
 * `spawn({ detached: true })` pose `DETACHED_PROCESS` (libuv) : le détaché n'a AUCUNE console, et chacun
 * de ses enfants console (`git`, `gh`, `npm`, `node`) en ALLOUE une, visible au premier plan ;
 * #2528
 * @param {{script:string, args:string[], cwd:string, fdLog:number|'ignore', envSupplementaire?:Record<string,string>,
 *          plateforme?:string, node?:string, detacher?:Function, executerSync?:Function}} p
 * @returns {number|undefined} pid du processus NODE détaché
 */
export function lancerDetache({
  script,
  args,
  cwd,
  fdLog,
  envSupplementaire = {},
  plateforme = process.platform,
  node = process.execPath,
  detacher = spawn,
  executerSync = spawnSync,
}) {
  const autorisee = ([cle]) => !cle.toUpperCase().startsWith(PREFIXE_JETON_VERROU) && cle.toUpperCase() !== 'GIT_INDEX_FILE'
  const env = Object.fromEntries(Object.entries({ ...process.env, ...envSupplementaire }).filter(autorisee))
  const argv = [...ABAISSER_PRIORITE, script, ...args]
  if (plateforme !== 'win32') {
    const enfant = detacher(node, argv, { cwd, detached: true, stdio: ['ignore', fdLog, fdLog], env })
    enfant.unref()
    return enfant.pid
  }
  if (!isAbsolute(cwd) || !isAbsolute(node)) throw new Error('[détachement] EVALIDATION : cwd et node absolus requis')
  const commande = [node, ...argv].map(citerArgv).join(' ')
  // https://learn.microsoft.com/windows/win32/procthread/job-objects
  const broker = "$ErrorActionPreference='Stop'; [Console]::InputEncoding=[Text.Encoding]::UTF8; [Console]::OutputEncoding=[Text.Encoding]::UTF8; $d=[Console]::In.ReadToEnd() | ConvertFrom-Json; $s=New-CimInstance -ClassName Win32_ProcessStartup -ClientOnly -Property @{CreateFlags=[uint32]0x01000410; ShowWindow=[uint16]0; EnvironmentVariables=[string[]]$d.environment}; $r=Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{CommandLine=[string]$d.commande; CurrentDirectory=[string]$d.cwd; ProcessStartupInformation=$s}; @{ReturnValue=$r.ReturnValue; ProcessId=$r.ProcessId} | ConvertTo-Json -Compress"
  const indetermine = () => new Error('[détachement] EINDETERMINE : ' + script + ' ; un train peut déjà vivre, ne pas relancer sans enquête')
  let vu
  try {
    vu = executerSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', broker], {
      cwd, env: Object.fromEntries(Object.entries(process.env).filter(autorisee)), encoding: 'utf8', windowsHide: true, timeout: 10000,
      input: JSON.stringify({ commande, cwd, environment: Object.entries(env).map(([cle, valeur]) => cle + '=' + valeur) }),
    })
  } catch { throw indetermine() }
  if (vu?.error || vu?.signal || vu?.status !== 0) throw indetermine()
  let resultat
  try { resultat = JSON.parse(String(vu.stdout ?? '')) } catch { throw indetermine() }
  if (!resultat || typeof resultat !== 'object' || !Number.isInteger(resultat.ReturnValue) || resultat.ReturnValue < 0) throw indetermine()
  if (resultat.ReturnValue !== 0) {
    const code = resultat.ReturnValue
    const raison = code === 2 || code === 3 ? 'EPERMISSION' : code === 21 ? 'EVALIDATION' : 'EREFUS'
    throw new Error('[détachement] ' + raison + ' : WMI ReturnValue=' + code + ', refus non retentable')
  }
  if (!estPidDeProcessus(resultat.ProcessId)) throw indetermine()
  return resultat.ProcessId
}
