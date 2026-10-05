// GIT DE BANC (#2155) : le lanceur UNIQUE de git des tests `node --test` de `scripts/`. Hors des
// dossiers de portes (`DOSSIERS_DES_PORTES`, `gitHorsHote.mjs`) et sans l'hôte (`gitPorte.mjs`), dont
// la garde `gitHorsHote` étend le périmètre à ces tests : aucun lanceur git n'y vit hors d'ici.
//
// UNE politique : stdin fermé, stdout et stderr CAPTURÉS, aucune nouvelle tentative. Un échec jette
// une erreur dont le MESSAGE porte la commande, le code de sortie (ou le signal), le stderr ET le
// stdout de git — `git commit` dit sa cause sur stdout, et le reporter TAP n'imprime que le message
// (#2155) ; `cause`, `status`, `signal`, `stdout`, `stderr` restent posés. L'env est
// `envDeDepotForge()` (#1806) ; un lancement qui lit l'arbre RÉEL du dépôt le dit par son nom
// (`gitDeLArbreReel`, `resultatDeLArbreReel`) : son env HÉRITÉ est ce qui le rend juste.
// Le COMPTE des lancements d'un code mesuré (`lancesDeGit`) vit ici aussi. Il voit les `spawnSync` et
// `execFileSync` de git de `node:child_process`, lus à liaison VIVE : un import nommé ou un espace de
// noms. Il ne voit ni `execSync`, ni un `spawn` asynchrone, ni une ligne de commande `shell: true`,
// ni une fonction capturée dans une constante avant le compte. Cela suffit : tout git des portes passe
// par `lancer` (`gitPorte.mjs`), qui appelle `spawnSync` à liaison vive, et la garde `gitHorsHote`
// attrape le littéral `'git'` lancé hors de l'hôte et du banc.
import { createRequire, syncBuiltinESMExports } from 'node:module'
import { execFileSync, spawnSync } from 'node:child_process'
import { ENV_GIT_FEINT, envDeDepotForge } from '../guards/lib/depotGabarit.mjs'
import { estEchecDeChargement } from '../guards/lib/spawnResilient.mjs'

/** La plus grande sortie lue par un banc : le journal complet de l'arbre réel. */
const SORTIE_MAX = 1e8

/** @param {string | undefined} input */
const stdioDe = (input) => /** @type {const} */ ([input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'])

/** @typedef {{ env?: NodeJS.ProcessEnv, input?: string, net?: boolean }} OptionsDeBanc */

/**
 * La sortie de `git <args>` dans `cwd` ; un échec JETTE, sa cause entière dans le message.
 * @param {string[]} args @param {{ cwd?: string } & OptionsDeBanc} [options] @returns {string}
 */
export function lancerGit(args, { cwd, env = envDeDepotForge(), input, net = false } = {}) {
  let sortie
  try {
    sortie = execFileSync('git', args, { cwd, env, input, encoding: 'utf8', maxBuffer: SORTIE_MAX, stdio: stdioDe(input) })
  } catch (e) {
    throw echecDeGit(args, cwd, e)
  }
  return net ? sortie.trim() : sortie
}

/**
 * L'échec de `git <args>` en une erreur dont le message dit tout : commande, cwd, code de sortie ou
 * signal, stderr, stdout (#2155).
 * @param {string[]} args @param {string | undefined} cwd @param {any} e @returns {Error}
 */
function echecDeGit(args, cwd, e) {
  const issue = e.status != null ? `code ${e.status}` : e.signal ? `signal ${e.signal}` : e.code ? `${e.code} : ${e.message}` : e.message
  const flux = (nom, texte) => `${nom} : ${String(texte ?? '').trim() || '(vide)'}`
  const message = [`git ${args.join(' ')} en échec (cwd ${cwd ?? process.cwd()}) — ${issue}`, flux('stderr', e.stderr), flux('stdout', e.stdout)].join('\n')
  return Object.assign(new Error(message, { cause: e }), { status: e.status, signal: e.signal, stdout: e.stdout, stderr: e.stderr })
}

/**
 * `(...args) => lancerGit(args, …)` lié à `cwd` ; `net` rend la sortie sans ses blancs de bord.
 * @param {string | undefined} cwd @param {OptionsDeBanc} [options] @returns {(...args: string[]) => string}
 */
export const gitDe = (cwd, options = {}) => (...args) => lancerGit(args, { ...options, cwd })

/**
 * `gitDe` sous l'env HÉRITÉ du processus : la lecture de l'arbre réel du dépôt.
 * @param {string | undefined} cwd @param {Omit<OptionsDeBanc, 'env'>} [options] @returns {(...args: string[]) => string}
 */
export const gitDeLArbreReel = (cwd, options = {}) => gitDe(cwd, { ...options, env: process.env })

/**
 * Le résultat COMPLET (`status`, `stdout`, `stderr`) de `git <args>`, sans jeter : pour le site qui
 * juge le code de sortie ou le stderr.
 * @param {string[]} args @param {{ cwd?: string, env?: NodeJS.ProcessEnv, input?: string }} [options]
 */
export const resultatDeGit = (args, { cwd, env = envDeDepotForge(), input } = {}) =>
  spawnSync('git', args, { cwd, env, input, encoding: 'utf8', maxBuffer: SORTIE_MAX, stdio: stdioDe(input) })

/**
 * `resultatDeGit` sous l'env HÉRITÉ du processus : le site dont le code de sortie, lu dans l'arbre
 * réel, est le SUJET.
 * @param {string[]} args @param {{ cwd?: string, input?: string }} [options]
 */
export const resultatDeLArbreReel = (args, options = {}) => resultatDeGit(args, { ...options, env: process.env })

/** L'exécutable `git`, nu ou par son chemin. */
const EST_GIT = /(?:^|[\\/])git(?:\.exe)?$/i

/**
 * Les lancements de git de `fn()`, comptés au PROCESSUS : chaque `spawnSync` ou `execFileSync` de git
 * lancé pendant `fn`, qu'il passe par un `spawn` injecté (`depotDe`) ou par un `depotDe(cwd)` interne,
 * que la mesure ne voit pas autrement. Les liaisons ESM de `node:child_process` suivent le remplacement
 * (`syncBuiltinESMExports`), restauré à la sortie. Un lancement qui n'a pas démarré
 * (`estEchecDeChargement`), que l'hôte rejoue, n'y est pas. Sous une git FEINTE (`ENV_GIT_FEINT`),
 * qui répond sans processus, le compte serait vide sans rien mesurer : il LÈVE.
 * @template T @param {() => T} fn @returns {{ valeur: T, lances: string[][] }}
 */
export function lancesDeGit(fn) {
  if (process.env[ENV_GIT_FEINT]) throw new Error(`lancesDeGit : ${ENV_GIT_FEINT} répond sans processus — le compte ne mesurerait rien`)
  const cp = createRequire(import.meta.url)('node:child_process')
  const origines = { spawnSync: cp.spawnSync, execFileSync: cp.execFileSync }
  /** @type {string[][]} */
  const lances = []
  cp.spawnSync = function (commande, args, options) {
    const vu = origines.spawnSync.call(this, commande, args, options)
    if (EST_GIT.test(String(commande)) && !estEchecDeChargement(vu?.status)) lances.push([...(args ?? [])])
    return vu
  }
  cp.execFileSync = function (commande, args, options) {
    if (EST_GIT.test(String(commande))) lances.push([...(Array.isArray(args) ? args : [])])
    return origines.execFileSync.call(this, commande, args, options)
  }
  syncBuiltinESMExports()
  try {
    return { valeur: fn(), lances }
  } finally {
    Object.assign(cp, origines)
    syncBuiltinESMExports()
  }
}

/** La sous-commande git d'une liste d'arguments lancée (après `-c <réglage>` et `--<option>`).
 *  @param {readonly string[]} args @returns {string | null} */
export function sousCommande(args) {
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '-c') { i += 1; continue }
    if (!args[i].startsWith('-')) return args[i]
  }
  return null
}
