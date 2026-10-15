// ÉCRIVAIN UNIQUE des dérivés d'un arbre (#2603) : les cibles de `GENERATORS` et le cache de fraîcheur
// (`CACHE_FRAICHEUR`) n'ont qu'un écrivain à la fois. Un écrivain de cibles de code hors passe PRÉEMPTE (`preempterLesDerives`) : sous le verrou de l'écrivain, il pose
// une ÉPOQUE neuve, puis écrit, ses sous-processus héritant de la tenue (`ENV_TENU`). La passe détachée écrit
// sous l'époque lue à son début (`envDeLaPasse`) : chacune de ses écritures (`sousLEpoque`) prend le verrou,
// relit l'époque et l'arbre (`operationEnCours`) ; une époque changée la REFUSE, une opération git en cours la
// préempte. Toute autre écriture prend le verrou, puis écrit.
// État : `<git-dir>/hooks-git/derives.verrou` et `<git-dir>/hooks-git/derives-epoque`.
import { randomUUID } from 'node:crypto'
import { readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { gitDirDe } from '../../hooks/barriere-outil.mjs'
import { ecrireTexteAtomique } from '../../guards/lib/ecritureJsonAtomique.mjs'
import { BACKOFFS_MS } from '../../guards/lib/spawnResilient.mjs'
import { prendreVerrou } from '../../test/verrou.mjs'

/** Variable d'env d'une passe : l'époque `attendue`. */
export const ENV_EPOQUE = 'WFRP_EPOQUE_DERIVES'

/** Variable d'env d'un écrivain qui PRÉEMPTE (`preempterLesDerives`) : l'époque qu'il a posée, héritée par ses
 *  sous-processus. */
export const ENV_TENU = 'WFRP_ECRIVAIN_TENU'

/** La marge d'`ATTENTE_DU_HOOK` au-delà des paliers de `renommerResilient` (`BACKOFFS_MS`). Valeur maison. */
export const MARGE_DU_HOOK_MS = 3_000

/** L'attente du verrou par un écrivain qui préempte : couvre une écriture de la passe sous verrou, paliers de
 *  `renommerResilient` compris. */
export const ATTENTE_DU_HOOK = Object.freeze({ echeanceMs: BACKOFFS_MS.reduce((somme, ms) => somme + ms, 0) + MARGE_DU_HOOK_MS, pasMs: 20 })

/** L'attente du verrou par une écriture de la passe : le post-hook le tient le temps de ses cibles de code
 *  et de ses `npm ci`. Valeur maison. */
export const ATTENTE_DE_LA_PASSE = Object.freeze({ echeanceMs: 10 * 60 * 1000, pasMs: 200 })

/** Les marqueurs d'une opération git en cours sous le répertoire git d'un arbre : rebase, `wt-status.c`
 *  `wt_status_get_state`, et `index.lock` (checkout, commit). */
const OPERATIONS = Object.freeze(['rebase-merge', 'rebase-apply', 'sequencer', 'MERGE_HEAD', 'CHERRY_PICK_HEAD', 'REVERT_HEAD', 'index.lock'])

/** L'opération git en cours dans l'arbre de répertoire git `gitDir`, `null` s'il est libre. Sans spawn.
 *  @param {string} gitDir @returns {string | null} */
export const operationEnCours = (gitDir) => OPERATIONS.find((nom) => statSync(join(gitDir, nom), { throwIfNoEntry: false }) !== undefined) ?? null

/** Les chemins de l'écrivain d'un arbre de répertoire git `gitDir`. @param {string} gitDir */
export const cheminsDeLEcrivain = (gitDir) => ({
  verrou: join(gitDir, 'hooks-git', 'derives.verrou'),
  epoque: join(gitDir, 'hooks-git', 'derives-epoque'),
})

/** L'époque lue, `''` si elle manque. @param {{ epoque: string }} chemins */
export function epoqueDe(chemins) {
  try {
    return readFileSync(chemins.epoque, 'utf8').trim()
  } catch {
    return ''
  }
}

/** Le verrou de l'écrivain, pris par `commande` sous `attente`. */
const prendre = (chemins, commande, attente) => prendreVerrou({ chemin: chemins.verrou, libelle: 'écrivain des dérivés de l’arbre', commande, attente })

/** Une époque neuve posée, sous le verrou tenu. REND l'époque. */
function poserEpoque(chemins) {
  const epoque = randomUUID()
  ecrireTexteAtomique(chemins.epoque, `${epoque}\n`)
  return epoque
}

/**
 * PRÉEMPTE la passe en cours : sous le verrou de l'écrivain (`attente`), pose une époque neuve et joue `geste`,
 * `ENV_TENU` posé dans `process.env` le temps du geste. REND ce que rend `geste`, ou `{ refus }` si le verrou est
 * resté tenu à l'échéance, rien n'ayant tourné.
 * @template T @param {{ verrou: string, epoque: string }} chemins @param {string} commande @param {() => T} geste
 * @returns {T | { refus: string }}
 */
export function preempterLesDerives(chemins, commande, geste, { attente = ATTENTE_DU_HOOK } = {}) {
  const prise = prendre(chemins, commande, attente)
  if (prise.etat !== 'pris') return { refus: prise.message }
  const avant = process.env[ENV_TENU]
  try {
    process.env[ENV_TENU] = poserEpoque(chemins)
    return geste()
  } finally {
    if (avant === undefined) delete process.env[ENV_TENU]
    else process.env[ENV_TENU] = avant
    prise.liberer()
  }
}

/** Vrai si un ancêtre de ce processus tient l'écrivain de `chemins` : `ENV_TENU` de `env` est l'époque du disque.
 *  @param {{ epoque: string }} chemins */
export const ecrivainTenu = (chemins, env = process.env) => Boolean(env[ENV_TENU]) && env[ENV_TENU] === epoqueDe(chemins)

/** L'env d'une passe qui écrit sous l'époque `attendue` ; ses `git` ne prennent aucun verrou optionnel
 *  (`GIT_OPTIONAL_LOCKS`, `git help git`), qu'`operationEnCours` lirait. PURE. @param {string} attendue */
export const envDeLaPasse = (attendue) => ({ [ENV_EPOQUE]: attendue, GIT_OPTIONAL_LOCKS: '0' })

/**
 * `ecrire()` en écrivain unique de l'arbre `cwd` : hors dépôt, ou sous un ancêtre qui préempte (`ecrivainTenu`),
 * `ecrire()` seul ; sinon sous le verrou (`attente`). Dans une passe (`ENV_EPOQUE` de `env`), l'époque puis l'arbre
 * sont relus : une époque changée LÈVE ; une opération git en cours (`operation`) pose une époque neuve, la passe
 * se rejouant après elle (`servirLesDemandes`), et LÈVE. LÈVE sur un verrou tenu à l'échéance, rien n'étant écrit.
 * @template T @param {() => T} ecrire @returns {T}
 */
export function sousLEpoque(ecrire, { env = process.env, cwd = process.cwd(), attente = ATTENTE_DE_LA_PASSE, operation = operationEnCours } = {}) {
  const gitDir = gitDirDe(cwd)
  if (gitDir === null) return ecrire()
  const chemins = cheminsDeLEcrivain(gitDir)
  if (ecrivainTenu(chemins, env)) return ecrire()
  const attendue = env[ENV_EPOQUE]
  const prise = prendre(chemins, `${attendue === undefined ? 'écriture' : 'passe'} des dérivés ${process.pid}`, attente)
  if (prise.etat !== 'pris') throw new Error(`écriture des dérivés refusée : ${prise.message}`)
  try {
    if (attendue !== undefined) {
      const vue = epoqueDe(chemins)
      if (vue !== attendue) throw new Error(`écriture des dérivés refusée : passe préemptée (époque ${vue || '(aucune)'}, attendue ${attendue || '(aucune)'})`)
      const enCours = operation(gitDir)
      if (enCours) {
        poserEpoque(chemins)
        throw new Error(`écriture des dérivés refusée : ${enCours} en cours, passe préemptée`)
      }
    }
    return ecrire()
  } finally {
    prise.liberer()
  }
}
