// Fixture de dépôt git jetable, source UNIQUE du geste : un GABARIT est construit une fois par
// contenu (init + config + fichiers + commit = cinq processus git), puis chaque test en prend une
// INSTANCE par copie de fichiers. Le `.git` d'un `git init` est un dossier autonome : sa copie est
// un dépôt complet et indépendant, que l'appelant peut committer, salir et jeter.
//
// Mesure du 2026-09-07 (#1709, machine peu chargée) : 226 ms la fabrication, 26 ms la copie,
// 34 ms un `git init` nu.
// Aucun état de départ n'est simulé : c'est le même arbre, aux mêmes octets, sous le même sha.

import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { ENV_GIT_FEINT, ajouterOrigine, commitDe, depotDe, initialiserDepot, poserRef, reglerDepot, reussi, shaDe } from './gitPorte.mjs'

/** @typedef {{ fichiers?: Record<string, string>, branche?: string, origin?: string | null, message?: string, refs?: Record<string, string>, commit?: boolean }} ParamsDepot */
/** @typedef {{ racine: string, sha: string | null }} DepotForge */

/** @type {Map<string, DepotForge>} */
const GABARITS = new Map()

const jeterLesGabarits = () => {
  for (const { racine } of GABARITS.values()) rmSync(racine, { recursive: true, force: true })
  if (CONFIG_VIDE) rmSync(dirname(CONFIG_VIDE), { recursive: true, force: true })
}

process.on('exit', jeterLesGabarits)
// Un `node --test` interrompu (Ctrl-C, `taskkill`, timeout de CI) ne passe PAS par `exit` : sans ces
// deux relais, chaque gabarit construit resterait sous `os.tmpdir()`. Ils rendent la main au code de
// sortie conventionnel du signal (128 + n), et `process.exit` rejoue `exit`, donc le nettoyage.
process.once('SIGINT', () => { jeterLesGabarits(); process.exit(130) })
process.once('SIGTERM', () => { jeterLesGabarits(); process.exit(143) })

/** La configuration GLOBALE d'un dépôt forgé : un fichier vide, créé au premier besoin et jeté avec
 *  les gabarits. @type {string | null} */
let CONFIG_VIDE = null

/**
 * `process.env` PURGÉ de tout l'espace de noms de git (`GIT_*`, `git help git`, « ENVIRONMENT
 * VARIABLES » : dépôt, identité, dates, configuration) puis ISOLÉ de la configuration de
 * l'utilisateur et du système (`GIT_CONFIG_GLOBAL` vers un fichier vide, `GIT_CONFIG_NOSYSTEM`) :
 * l'environnement de TOUT processus git lancé dans un dépôt forgé, qui ne dépend ni du parent ni de
 * la machine (#1806). L'env se dérive à chaque appel du `process.env` COURANT, qui est mutable ;
 * seule la config vide est retenue.
 * @returns {NodeJS.ProcessEnv}
 */
export function envDeDepotForge() {
  if (!CONFIG_VIDE) {
    CONFIG_VIDE = join(mkdtempSync(join(tmpdir(), 'config-forge-')), 'gitconfig')
    writeFileSync(CONFIG_VIDE, '')
  }
  const env = Object.fromEntries(Object.entries(process.env).filter(([nom]) => !nom.startsWith('GIT_')))
  return { ...env, GIT_CONFIG_GLOBAL: CONFIG_VIDE, GIT_CONFIG_NOSYSTEM: '1' }
}

/**
 * L'environnement d'une UTILISATRICE dont la configuration globale est le fichier `globale` : celui
 * d'un dépôt forgé (`envDeDepotForge`), sous sa configuration. La mesure des ÉCRIVAINS : l'identité
 * qui signe est celle de sa configuration, ou aucune.
 * @param {string} globale @returns {NodeJS.ProcessEnv}
 */
export const envDeLUtilisatrice = (globale) => ({ ...envDeDepotForge(), GIT_CONFIG_GLOBAL: globale })

/**
 * `fn()` sous `envDeLUtilisatrice(globale)` posé sur `process.env`, restauré à la sortie : la mesure
 * des écrivains qui lancent git dans l'environnement du PROCESSUS (le contexte du train, la forge).
 * @template T @param {string} globale @param {() => T} fn @returns {T}
 */
export function sousLEnvDeLUtilisatrice(globale, fn) {
  const avant = { ...process.env }
  const env = envDeLUtilisatrice(globale)
  for (const nom of Object.keys(process.env)) if (!(nom in env)) delete process.env[nom]
  Object.assign(process.env, env)
  try {
    return fn()
  } finally {
    for (const nom of Object.keys(process.env)) if (!(nom in avant)) delete process.env[nom]
    Object.assign(process.env, avant)
  }
}

/**
 * L'environnement d'une git FEINTE (`ENV_GIT_FEINT`, gitPorte.mjs) : `regles` y répondent, git
 * répond au reste. À joindre à l'`env` d'un processus enfant.
 * @param {{ si: string[], status: number, stdout?: string, stderr?: string }[]} regles
 * @returns {Record<string, string>}
 */
export const envGitFeint = (regles) => ({ [ENV_GIT_FEINT]: JSON.stringify(regles) })

/**
 * `fn()` sous une git FEINTE (`envGitFeint(regles)`) posée sur `process.env`, retirée à la sortie :
 * la panne de git d'une lecture faite dans CE processus. `fn` est SYNCHRONE : une promesse rendue
 * LÈVE, la feinte serait retirée avant ses lectures.
 * @template T @param {Parameters<typeof envGitFeint>[0]} regles @param {() => T} fn @returns {T}
 */
export function sousGitFeint(regles, fn) {
  Object.assign(process.env, envGitFeint(regles))
  try {
    const vu = fn()
    if (typeof vu?.then === 'function') throw new TypeError('sousGitFeint : `fn` rend une promesse — la feinte serait retirée en vol')
    return vu
  } finally {
    delete process.env[ENV_GIT_FEINT]
  }
}

/** L'écriture `geste` a réussi (`reussi`) : la fixture ne se construit pas sur une écriture refusée. */
const exiger = (union, geste, cwd) => {
  if (!reussi(union)) throw new Error(`${geste} refusé dans ${cwd} : ${union.disponible ? union.valeur?.stderr ?? 'objet absent' : union.raison}`)
}

/** Le SHA que `ref` nomme dans le dépôt forgé : la fixture ne se construit pas sur une ref absente. */
const shaExige = (depot, ref) => {
  const sha = shaDe(depot, ref)
  if (!sha) throw new Error(`${ref} absent de ${depot.cwd}`)
  return sha
}

/** Clé de contenu : deux appels aux mêmes paramètres décrivent le même arbre, donc le même gabarit. */
function cle({ fichiers, branche, origin, message, refs, commit }) {
  const trie = (o) => Object.keys(o).sort().map((k) => [k, o[k]])
  return JSON.stringify([trie(fichiers), branche, origin, message, trie(refs), commit])
}

function ecrire(racine, rel, texte) {
  mkdirSync(join(racine, dirname(rel)), { recursive: true })
  writeFileSync(join(racine, rel), texte, 'utf8')
}

/**
 * Gabarit partagé pour un contenu donné : construit au premier appel, rendu tel quel ensuite.
 * L'identité de l'auteur, `commit.gpgsign` à faux et un `core.hooksPath` RELATIF pointant hors de
 * tout hook (résolu dans le dépôt jugé, jamais dans le gabarit) rendent la fixture indépendante de
 * la machine hôte. Une construction qui échoue ne laisse aucun dossier derrière elle.
 * @param {ParamsDepot} params `fichiers` = `{ 'chemin/relatif': 'contenu' }` ; `refs` = `{ 'refs/…': 'HEAD' }` ;
 *   `commit: false` = un dépôt initialisé dont les fichiers restent HORS index et sans HEAD (`sha` = `null`).
 * @returns {DepotForge} racine du gabarit (à NE PAS muter — prendre une `instanceDeDepot`) et sha de son commit.
 */
export function gabaritDeDepot({ fichiers = {}, branche = 'main', origin = null, message = 'fondation', refs = {}, commit = true } = {}) {
  if (!commit && Object.keys(refs).length > 0) {
    throw new Error(`gabaritDeDepot : une ref se pose sur un commit — \`refs\` (${Object.keys(refs).join(', ')}) exige \`commit: true\``)
  }
  const k = cle({ fichiers, branche, origin, message, refs, commit })
  const memo = GABARITS.get(k)
  if (memo) return memo

  const racine = mkdtempSync(join(tmpdir(), 'gabarit-'))
  let sha = null
  try {
    const depot = depotDe(racine, { env: envDeDepotForge() })
    exiger(initialiserDepot(depot, { branche }), `git init -b ${branche}`, racine)
    // RELATIF : git résout `core.hooksPath` contre le dépôt qui l'exécute, donc dans l'INSTANCE.
    // Un chemin absolu y ferait pointer chaque instance vers le gabarit — effacé à la sortie.
    const reglages = { 'user.email': 'mesure@example.invalid', 'user.name': 'mesure', 'commit.gpgsign': 'false', 'core.hooksPath': 'hooks-absents' }
    for (const [cle, valeur] of Object.entries(reglages)) exiger(reglerDepot(depot, cle, valeur), `git config ${cle}`, racine)
    for (const [rel, texte] of Object.entries(fichiers)) ecrire(racine, rel, texte)
    if (commit) {
      exiger(commitDe(depot, { message, chemins: Object.keys(fichiers), vide: true }), 'git commit', racine)
      sha = shaExige(depot, 'HEAD')
    }
    if (origin) exiger(ajouterOrigine(depot, origin), 'git remote add origin', racine)
    for (const [nom, cible] of Object.entries(refs)) exiger(poserRef(depot, nom, shaExige(depot, cible)), `git update-ref ${nom}`, racine)
  } catch (e) {
    rmSync(racine, { recursive: true, force: true })
    throw e
  }

  const forge = { racine, sha }
  GABARITS.set(k, forge)
  return forge
}

/**
 * Instance indépendante du gabarit de ce contenu : un dépôt complet, à l'appelant de le jeter
 * (`rmSync(racine, { recursive: true, force: true })` en `finally`).
 * @param {ParamsDepot} params mêmes paramètres que {@link gabaritDeDepot}.
 * @returns {DepotForge} racine de l'instance et sha de son commit de fondation.
 */
export function instanceDeDepot(params = {}) {
  const gabarit = gabaritDeDepot(params)
  const racine = mkdtempSync(join(tmpdir(), 'depot-'))
  cpSync(gabarit.racine, racine, { recursive: true })
  return { racine, sha: gabarit.sha }
}
