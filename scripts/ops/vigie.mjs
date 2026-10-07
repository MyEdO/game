// LA VIGIE — la MESURE instantanée de la CI (`main` et la branche) et du train d'un arbre (#2280, V4).
//
// INVARIANT (ticket #2280) : « L'état de la CI (sur `main` et sur la branche du chantier) et celui du
// train de publication (`ops:publier`) se MESURENT une fois, à un seul endroit. »
//
// Un tick compose les lecteurs canoniques : `shasDistants` (UN `ls-remote` pour `main` et la branche),
// `coursesCi` + `verdictDesRuns` par sha (la CI de `main` au sha d'`origin/main`, celle de la branche au
// sha POUSSÉ), `etatDuTrain` sur le journal du train. Un verdict `verte` est gardé
// sous `<.git commun>/vigie/` (partagé entre worktrees, hors de `node_modules`) ; tout autre verdict se
// relit. La sortie `--json` est `{ ligne, transitions, etat }` : `etat`, opaque, se repasse en
// `--depuis` au tick suivant, et les `transitions` se calculent depuis lui. Une panne sort non nulle,
// son motif sur stderr.
//
// Usage : node scripts/ops/vigie.mjs --json --arbre <racine> [--depuis <etat>]
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { GitIndisponible, TRONC, arbrePrincipal, brancheDe, depotDe, shaDe, shasDistants } from '../guards/lib/gitPorte.mjs'
import { coursesCi, jobsEnEchecDe } from '../guards/lib/coursesCi.mjs'
import { PEREMPTION_MS, purgerPerimes } from '../guards/lib/purgerPerimes.mjs'
import { verdictDesJobs, verdictDesRuns } from './etapesDuTrain.mjs'
import { cheminsDeJournal, etatDuTrain, lireJournal } from './publier.mjs'
import { ecrireJsonAtomique } from '../guards/lib/ecritureJsonAtomique.mjs'

/** Symbole de chaque verdict de CI dans la ligne ; `null` (rien de poussé) se lit `—`. */
export const SYMBOLES_DE_CI = Object.freeze({ verte: '✓', rouge: '✗', annulee: '⊘', 'en-vol': '…', absente: '∅' })

/** Les verdicts de CI qui TERMINENT une course : seuls ils font une transition. */
const VERDICTS_FINAUX = Object.freeze(['verte', 'rouge', 'annulee'])

/** Les états du train qui font une transition ; au PREMIER tick, seuls `rouge` et `mort`. */
const ETATS_DU_TRAIN_SIGNALES = Object.freeze(['vert', 'rouge', 'indéterminée', 'mort'])

/** Ce qui se signale au premier tick, sans `--depuis` : un rouge, un train mort. */
const SIGNALES_D_EMBLEE = Object.freeze(['rouge', 'mort'])

/**
 * Les options. PURE. `null` si refusées : `--json` et `--arbre <racine>` sont exigés.
 * @param {string[]} argv @returns {{arbre:string, depuis:string|null}|null}
 */
export function optionsDe(argv) {
  const args = (argv ?? []).map(String)
  let arbre = null
  let depuis = null
  let json = false
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i]
    if (a === '--json') json = true
    else if ((a === '--arbre' || a === '--depuis') && args[i + 1] !== undefined && !args[i + 1].startsWith('--')) {
      if (a === '--arbre') arbre = args[i + 1]
      else depuis = args[i + 1]
      i += 1
    } else return null
  }
  return json && arbre ? { arbre, depuis } : null
}

/** L'ÉTAT minimal d'un tick (`{main:{sha,verdict}, branche:{nom,sha,verdict}|null, train:{run,seq,etat}}`), encodé (base64url d'un JSON) : la valeur opaque du `--depuis` suivant. PURE. */
export const encoder = (etat) => Buffer.from(JSON.stringify(etat), 'utf8').toString('base64url')

/** L'état d'un `--depuis`, `null` s'il est absent ou illisible (le tick est alors un PREMIER tick). PURE. */
export function decoder(texte) {
  if (!texte) return null
  try {
    const etat = JSON.parse(Buffer.from(String(texte), 'base64url').toString('utf8'))
    return etat && typeof etat === 'object' && etat.main && etat.train ? etat : null
  } catch {
    return null
  }
}

/** La phrase d'un verdict de CI terminé. PURE. */
const phraseDeCi = (nom, { sha, verdict }) =>
  `CI ${nom} ${{ verte: 'verte', rouge: 'ROUGE', annulee: 'annulée' }[verdict]} (${String(sha).slice(0, 9)})`

/** La phrase d'un état du train. PURE. */
function phraseDuTrain({ etat, etape }) {
  if (etat === 'vert') return 'train arrivé : publié'
  if (etat === 'rouge') return `train ROUGE à ${etape ?? '?'}`
  if (etat === 'indéterminée') return `train indéterminé à ${etape ?? '?'}`
  return `train MORT à ${etape ?? '?'} sans verdict`
}

/**
 * Les TRANSITIONS de `avant` à `apres`, une phrase chacune. PURE. Une CI se signale quand elle ATTEINT un
 * verdict final (`VERDICTS_FINAUX`) qu'`avant` ne portait pas pour ce sha ; le train, quand il atteint
 * un état de `ETATS_DU_TRAIN_SIGNALES` qu'`avant` ne portait pas pour ce run. Sans `avant` (premier tick),
 * seuls un rouge et un train mort se signalent (`SIGNALES_D_EMBLEE`).
 * @param {object|null} avant l'état décodé du `--depuis` @param {object} apres la mesure du tick
 * @returns {string[]}
 */
export function transitionsDe(avant, apres) {
  const ci = (cle, nom) => {
    const a = avant?.[cle]
    const b = apres[cle]
    if (!b?.sha || !VERDICTS_FINAUX.includes(b.verdict)) return []
    const neuf = avant ? a?.sha !== b.sha || a?.verdict !== b.verdict : SIGNALES_D_EMBLEE.includes(b.verdict)
    return neuf ? [phraseDeCi(nom, b)] : []
  }
  const train = (() => {
    const a = avant?.train
    const b = apres.train
    if (!ETATS_DU_TRAIN_SIGNALES.includes(b.etat)) return []
    const neuf = avant ? a?.run !== b.run || a?.etat !== b.etat : SIGNALES_D_EMBLEE.includes(b.etat)
    return neuf ? [phraseDuTrain(b)] : []
  })()
  return [...ci('main', TRONC.nom), ...ci('branche', apres.branche?.nom ?? 'branche'), ...train]
}

/** La STATUS LINE d'un état. PURE. */
export function ligneDe(etat) {
  const symbole = (vu) => (vu?.sha ? SYMBOLES_DE_CI[vu.verdict] ?? '?' : '—')
  const morceaux = [`CI ${TRONC.nom} ${symbole(etat.main)}`]
  if (etat.branche) morceaux.push(`${etat.branche.nom} ${symbole(etat.branche)}`)
  const { train } = etat
  const position = train.etape ? ` ${train.etape} ${train.rang}/${train.total}` : ''
  const mot = { aucun: '—', 'en-vol': position.trim() || 'en vol', vert: 'arrivé ✓', rouge: `✗${position}`, 'indéterminée': `?${position}`, mort: `mort${position}`, 'périmé': 'périmé' }[train.etat]
  morceaux.push(`train : ${mot ?? train.etat}`)
  return morceaux.join(' · ')
}

/** Une mesure de CI qui n'a pas eu lieu (`gh` indisponible) : la vigie ne juge pas sur rien. */
export class CiIllisible extends Error {}

/** Le fichier de cache d'un sha. */
const fichierDuCache = (dossier, sha) => join(dossier, `${sha}.json`)

/** Motif des fichiers du cache, pour la péremption : le verdict d'un sha, et le temporaire de `ecrireJsonAtomique`
 *  qu'un tick tué entre l'écriture et le renommage laisse derrière lui. */
const MOTIF_DU_CACHE = /^[0-9a-f]{40,64}\.json(?:\.\d+\.tmp)?$/

/** Le CACHE porte-t-il `verte` pour ce chemin ? Un fichier absent, vide ou illisible est un cache ABSENT,
 *  jamais une panne : le verdict se relit. */
function verteAuCache(chemin) {
  try {
    return JSON.parse(readFileSync(chemin, 'utf8'))?.verdict === 'verte'
  } catch (e) {
    if (e instanceof SyntaxError || e?.code === 'ENOENT') return false
    throw e
  }
}

/**
 * Le verdict de CI de `sha` : lu au CACHE s'il y est `verte` (`verteAuCache`), sinon par `lire(sha)` (une
 * union de `coursesCi`) et `verdictDesRuns` ; un `verte` neuf s'écrit au cache par l'écriture ATOMIQUE
 * `ecrireJsonAtomique`, que huit sessions partagent sans lire un fichier à moitié écrit. Le cache ne garde
 * que le verdict : un sha vu `verte` n'appelle plus `gh`.
 * Une course `rouge` se juge sur ses jobs (`jobs(id)`, `verdictDesJobs`) : sans job rouge et avec un job
 * annulé, elle est `annulee` ; des jobs illisibles la laissent `rouge`. Une lecture de courses indisponible
 * LÈVE `CiIllisible`.
 * @param {{sha:string|null, dossier:string, lire:(sha:string) => object, jobs:(id:number, attempt:number|null) => object}} p
 * @returns {string|null}
 */
export function verdictDeCi({ sha, dossier, lire, jobs }) {
  if (!sha) return null
  const chemin = fichierDuCache(dossier, sha)
  if (verteAuCache(chemin)) return 'verte'
  const vues = lire(sha)
  if (!vues.disponible) throw new CiIllisible(`courses de ${sha.slice(0, 9)} illisibles : ${vues.raison}`)
  const lu = verdictDesRuns(vues.valeur, sha)
  const lusJobs = lu.etat === 'rouge' ? jobs(lu.course.databaseId, lu.course.attempt ?? null) : null
  const vu = lusJobs?.disponible ? verdictDesJobs(lu, lusJobs.valeur) : lu
  if (vu.etat === 'verte') {
    ecrireJsonAtomique(chemin, { verdict: 'verte' })
    purgerPerimes({ dossier, motif: MOTIF_DU_CACHE, ageMs: PEREMPTION_MS })
  }
  return vu.etat
}

/**
 * Le TICK : mesure l'arbre `arbre`, puis rend `{ ligne, transitions, etat }` depuis l'état `depuis`.
 * @param {{arbre:string, depuis?:string|null, lire?:(sha:string) => object}} p
 */
export function tick({
  arbre, depuis = null, lire = (sha) => coursesCi({ cwd: arbre, commit: sha, limit: 30 }), jobs = (id, attempt) => jobsEnEchecDe({ cwd: arbre, id, attempt }),
}) {
  const depot = depotDe(arbre)
  const principal = arbrePrincipal(depot)
  if (!principal.disponible) throw new GitIndisponible(principal.raison)
  const dossier = join(principal.valeur, '.git', 'vigie')
  const nom = brancheDe(depot)
  const teteVivante = shaDe(depot, 'HEAD')
  const refs = [TRONC.branche, ...(nom && nom !== TRONC.nom ? [`refs/heads/${nom}`] : [])]
  const distants = shasDistants(depot, refs)
  if (!distants) throw new GitIndisponible(`ls-remote origin n’a rien rendu pour ${refs.join(', ')}`)
  const main = { sha: distants.get(TRONC.branche), verdict: verdictDeCi({ sha: distants.get(TRONC.branche), dossier, lire, jobs }) }
  const branche = refs[1] ? { nom, sha: distants.get(refs[1]), verdict: verdictDeCi({ sha: distants.get(refs[1]), dossier, lire, jobs }) } : null
  const { json } = cheminsDeJournal(arbre, nom ?? 'HEAD')
  const train = etatDuTrain(existsSync(json) ? lireJournal(json, nom) : null, { teteVivante })
  const vu = { main, branche, train }
  return {
    ligne: ligneDe(vu),
    transitions: transitionsDe(decoder(depuis), vu),
    etat: encoder({ main, branche, train: { run: train.run, seq: train.seq, etat: train.etat } }),
  }
}

/**
 * La ligne de commande : le `tick` des options de `argv` en UN objet JSON sur `sortie`, ou le motif de la
 * panne sur `erreur` et un code non nul. `lire` et `jobs` vont au `tick` (les lectures réelles par défaut).
 * @param {{argv:string[], sortie?:(texte:string) => void, erreur?:(texte:string) => void, lire?:Function, jobs?:Function}} p
 * @returns {number}
 */
export function executer({ argv, sortie = (texte) => process.stdout.write(texte), erreur = (texte) => process.stderr.write(texte), lire, jobs }) {
  const options = optionsDe(argv)
  if (!options) {
    erreur('[vigie] usage : node scripts/ops/vigie.mjs --json --arbre <racine> [--depuis <etat>]\n')
    return 1
  }
  try {
    sortie(`${JSON.stringify(tick({ ...options, ...(lire ? { lire } : {}), ...(jobs ? { jobs } : {}) }))}\n`)
    return 0
  } catch (e) {
    if (!(e instanceof GitIndisponible || e instanceof CiIllisible)) throw e
    erreur(`[vigie] ${e.message}\n`)
    return 1
  }
}

if (import.meta.main) process.exit(executer({ argv: process.argv.slice(2) }))
