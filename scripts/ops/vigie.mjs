// LA VIGIE — la MESURE instantanée de la CI (`main` et la branche) et du train d'un arbre (#2280, V4).
//
// INVARIANT (ticket #2280) : « L'état de la CI (sur `main` et sur la branche du chantier) et celui du
// train de publication (`ops:publier`) se MESURENT une fois, à un seul endroit. »
//
// Un tick compose les lecteurs canoniques : `tetesDistantes` (les têtes de l'origine, dont `main` et la
// branche), `coursesCi` + `verdictJuge` par sha (la CI de `main` au sha d'`origin/main`, celle de la
// branche au sha POUSSÉ), `etatDuTrain` sur le journal du train. Chaque mesure DISTANTE vit dans une
// mémoire machine (`memoireMachine`) sous `<.git commun>/vigie/` (partagée entre worktrees, hors de
// `node_modules`) : les têtes dans `distants.json`, le verdict d'un sha dans `<sha>.json`, reprises tant
// qu'elles ont moins de `FRAICHEUR_MS` (un verdict `verte`, sans limite), remesurées par UN seul tick
// de la machine (#2603). La sortie `--json` est `{ ligne, transitions, etat }` : `etat`, opaque, se repasse en
// `--depuis` au tick suivant, et les `transitions` se calculent depuis lui. Une panne sort non nulle,
// son motif sur stderr.
//
// Usage : node scripts/ops/vigie.mjs --json --arbre <racine> [--depuis <etat>]
import { existsSync, readFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { GitIndisponible, TRONC, arbrePrincipal, brancheDe, depotDe, shaDe, tetesDistantes } from '../guards/lib/gitPorte.mjs'
import { coursesCi, jobsEnEchecDe, verdictJuge } from '../guards/lib/coursesCi.mjs'
import { PEREMPTION_MS, purgerPerimes } from '../guards/lib/purgerPerimes.mjs'
import { cheminsDeJournal, lireJournal } from './publicationDonnee.mjs'
import { etatDuTrain } from './publierTrain.mjs'
import { ecrireJsonAtomique } from '../guards/lib/ecritureJsonAtomique.mjs'
import { prendreVerrou } from '../test/verrou.mjs'
import { estPidVivant } from '../guards/lib/pid.mjs'

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

/** Fraîcheur d'une mesure distante gardée en mémoire machine, en millisecondes : valeur maison, #2603 constat 20. */
export const FRAICHEUR_MS = 60_000

/** Motif des fichiers de `<.git commun>/vigie/` pour la péremption : une mesure (`<sha>.json`, `distants.json`),
 *  le temporaire de `ecrireJsonAtomique` (`<cible>.<uuid>.tmp`), le verrou de `prendreVerrou` et ses restes. */
const MOTIF_DU_CACHE = /^(?:[0-9a-f]{40,64}|distants)\.json(?:\.[0-9a-f-]{36}\.tmp|\.verrou(?:\.reprise|\.\d+\.[0-9a-f-]{36})?)?$/

/** La mesure gardée sous `chemin`, `{ mesureA, valeur }` ; un fichier absent, vide ou d'une autre forme est
 *  une mémoire ABSENTE, jamais une panne. */
function memoireDe(chemin) {
  try {
    const lu = JSON.parse(readFileSync(chemin, 'utf8'))
    return Number.isFinite(lu?.mesureA) && 'valeur' in lu ? lu : null
  } catch (e) {
    if (e instanceof SyntaxError || e?.code === 'ENOENT') return null
    throw e
  }
}

/**
 * La MÉMOIRE MACHINE de `chemin` : la valeur gardée si elle a moins de `FRAICHEUR_MS` ou si `perenne(valeur)`,
 * sinon `mesurer()` sous le verrou `<chemin>.verrou` (`prendreVerrou`, un essai), écrite avec son
 * horodatage par `ecrireJsonAtomique`. Le perdant du verrou ne mesure pas : il rend la valeur gardée, même
 * périmée ; sans valeur gardée, il mesure. Un verrou d'un PID mort se reprend (`prendreVerrou`). Une
 * mesure qui LÈVE ne s'écrit pas.
 * @template T
 * @param {{chemin:string, mesurer:() => T, perenne?:(valeur:T) => boolean, horloge?:() => number, estVivant?:(pid:number) => boolean}} p
 * @returns {T}
 */
export function memoireMachine({ chemin, mesurer, perenne = () => false, horloge = Date.now, estVivant = estPidVivant }) {
  const fraiche = (lu) => lu !== null && (perenne(lu.valeur) || horloge() - lu.mesureA < FRAICHEUR_MS)
  const avant = memoireDe(chemin)
  if (fraiche(avant)) return avant.valeur
  const ecrire = () => {
    const valeur = mesurer()
    ecrireJsonAtomique(chemin, { mesureA: horloge(), valeur })
    purgerPerimes({ dossier: dirname(chemin), motif: MOTIF_DU_CACHE, ageMs: PEREMPTION_MS })
    return valeur
  }
  const prise = prendreVerrou({ chemin: `${chemin}.verrou`, libelle: `vigie, ${basename(chemin)}`, commande: 'scripts/ops/vigie.mjs', estVivant })
  if (prise.etat !== 'pris') return avant ? avant.valeur : ecrire()
  try {
    const relu = memoireDe(chemin)
    return fraiche(relu) ? relu.valeur : ecrire()
  } finally {
    prise.liberer()
  }
}

/**
 * Le verdict de CI de `sha`, en mémoire machine (`memoireMachine`) sous `<dossier>/<sha>.json`, `verte`
 * pérenne ; à la mesure, `lire(sha)` (une union de `coursesCi`) et `verdictJuge`.
 * Une course `rouge` se juge sur ses jobs (`jobs(id, attempt)`, `verdictJuge`) : sans job rouge et avec un job
 * annulé, elle est `annulee` ; des jobs illisibles la laissent `rouge`. Une lecture de courses indisponible
 * LÈVE `CiIllisible`.
 * @param {{sha:string|null, dossier:string, lire:(sha:string) => object, jobs?:(id:number, attempt:number|null) => object, horloge?:() => number, estVivant?:(pid:number) => boolean}} p
 * @returns {string|null}
 */
export function verdictDeCi({ sha, dossier, lire, jobs, horloge, estVivant }) {
  if (!sha) return null
  return memoireMachine({
    chemin: join(dossier, `${sha}.json`),
    perenne: (verdict) => verdict === 'verte',
    horloge,
    estVivant,
    mesurer: () => {
      const vues = lire(sha)
      if (!vues.disponible) throw new CiIllisible(`courses de ${sha.slice(0, 9)} illisibles : ${vues.raison}`)
      return verdictJuge(vues.valeur, sha, jobs).etat
    },
  })
}

/**
 * Les têtes de l'origine `{ <ref complète>: sha }`, en mémoire machine (`memoireMachine`) sous
 * `<dossier>/distants.json` ; à la mesure, UN `tetesDistantes`.
 * @param {{depot:object, dossier:string, horloge?:() => number, estVivant?:(pid:number) => boolean}} p
 * @returns {Record<string, string>}
 */
export function tetesDeLOrigine({ depot, dossier, horloge, estVivant }) {
  return memoireMachine({
    chemin: join(dossier, 'distants.json'),
    horloge,
    estVivant,
    mesurer: () => {
      const tetes = tetesDistantes(depot)
      if (!tetes) throw new GitIndisponible('ls-remote origin n’a rendu aucune tête')
      return Object.fromEntries(tetes)
    },
  })
}

/**
 * Le TICK : mesure l'arbre `arbre`, puis rend `{ ligne, transitions, etat }` depuis l'état `depuis`.
 * `horloge` et `estVivant` vont aux mémoires machine (`memoireMachine`).
 * @param {{arbre:string, depuis?:string|null, lire?:(sha:string) => object, jobs?:Function, horloge?:() => number, estVivant?:(pid:number) => boolean}} p
 */
export function tick({
  arbre, depuis = null, lire = (sha) => coursesCi({ cwd: arbre, commit: sha, limit: 30 }), jobs = (id, attempt) => jobsEnEchecDe({ cwd: arbre, id, attempt }),
  horloge, estVivant,
}) {
  const depot = depotDe(arbre)
  const principal = arbrePrincipal(depot)
  if (!principal.disponible) throw new GitIndisponible(principal.raison)
  const dossier = join(principal.valeur, '.git', 'vigie')
  const nom = brancheDe(depot)
  const teteVivante = shaDe(depot, 'HEAD')
  const tetes = tetesDeLOrigine({ depot, dossier, horloge, estVivant })
  const verdict = (sha) => verdictDeCi({ sha, dossier, lire, jobs, horloge, estVivant })
  const shaDeMain = tetes[TRONC.branche] ?? null
  const main = { sha: shaDeMain, verdict: verdict(shaDeMain) }
  const shaDeBranche = tetes[`refs/heads/${nom}`] ?? null
  const branche = nom && nom !== TRONC.nom ? { nom, sha: shaDeBranche, verdict: verdict(shaDeBranche) } : null
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
