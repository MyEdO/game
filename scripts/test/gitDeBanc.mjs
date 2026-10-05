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
import { execFileSync, spawnSync } from 'node:child_process'
import { envDeDepotForge } from '../guards/lib/depotGabarit.mjs'

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
