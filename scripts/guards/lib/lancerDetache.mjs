// DÉTACHEMENT d'un processus node du dépôt (#1784) : le train de publication (`scripts/ops/publier.mjs`)
// et le consommateur du post-merge (`scripts/ops/synchroniser.mjs --consommer`, #2493).
import { spawn, spawnSync } from 'node:child_process'

/**
 * Un token de ligne de commande Win32 : ce que `CommandLineToArgvW` (donc `node`, donc tout
 * exécutable C) relira comme UN argument. PURE. `Start-Process -ArgumentList` JOINT ses éléments par
 * des espaces SANS les re-citer : sans ce passage, `['arg avec espace']` arrive au train en trois
 * arguments (mesuré le 2026-09-17), et un script dont le CHEMIN porte un espace n'est pas trouvé.
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
 * Le seul site de détachement d'un processus node du dépôt (#1784) : le TRAIN et le consommateur du
 * post-merge (#2493) — `spawnBorne` (scripts/gates/toutes.mjs) en détache aussi ses gates, mais sous POSIX
 * seulement (`detached: process.platform !== 'win32'`) : sous win32 elles héritent de la console de
 * l'appelant. Sous win32, `spawn({ detached: true })` pose `DETACHED_PROCESS` (libuv) : le détaché n'a
 * AUCUNE console, et chacun de ses enfants console (`git`, `gh`, `npm`, `node`) en ALLOUE une, visible au
 * premier plan ; `Start-Process -WindowStyle Hidden` n'en ouvre qu'une, la sienne, CACHÉE, dont ses
 * enfants héritent. Le pid rendu est celui du NODE détaché (`-PassThru`), jamais celui du `powershell`
 * intermédiaire, qui rend la main aussitôt et meurt sans l'emporter. Aucune redirection n'est demandée à
 * `Start-Process` : le détaché ouvre LUI-MÊME son journal (`modeDuLog` du train, `<pid>.log` du
 * consommateur), et `-RedirectStandard*` retiendrait le `powershell` jusqu'à sa fin.
 * @param {{script:string, args:string[], cwd:string, fdLog:number, envSupplementaire?:Record<string,string>,
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
  const env = { ...process.env, ...envSupplementaire }
  if (plateforme !== 'win32') {
    const enfant = detacher(node, [script, ...args], { cwd, detached: true, stdio: ['ignore', fdLog, fdLog], env })
    enfant.unref()
    return enfant.pid
  }
  const cite = (valeur) => `'${String(valeur).replace(/'/g, "''")}'`
  const liste = [script, ...args].map((a) => cite(citerArgv(a))).join(',')
  const vu = executerSync(
    'powershell.exe',
    [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      `(Start-Process -FilePath ${cite(node)} -ArgumentList ${liste} -WindowStyle Hidden -PassThru).Id`,
    ],
    { cwd, env, encoding: 'utf8', windowsHide: true },
  )
  const pid = Number(String(vu?.stdout ?? '').trim().split(/\s+/).pop())
  if (!Number.isInteger(pid) || pid <= 0) {
    throw new Error(
      `[détachement] ${script} : détachement manqué, powershell a rendu « ${String(vu?.stdout ?? '').trim()} » ${String(vu?.stderr ?? '').trim()}`,
    )
  }
  return pid
}
