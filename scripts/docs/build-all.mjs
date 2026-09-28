// scripts/docs/build-all.mjs — régénère TOUS les dérivés committés (`npm run docs:build`).
// SOURCE UNIQUE de la liste des dérivés : `GENERATORS`. Un dérivé est VÉRIFIÉ par `--check`
// (`npm run docs:check`) : chaque générateur rejoué en `--check` (`ecrireOuVerifier`,
// scripts/docs/lib/empreinte-sources.mjs), puis les vérificateurs purs `NON_GENERATOR_CHECKS` ; il est
// REJOUÉ EN ENTIER par `--check --tout` (`npm run docs:check:tout`, la commande de la CI).
// Une cible n'est pas toujours un `docs/*.md` ÉCRIT EN ENTIER : `build-implemente.mjs` injecte un
// champ dans les fiches raw — il déclare `targets: []` et se joue comme les autres ; les registres
// `*.generated.ts` sont des cibles de CODE, écrites en entier mais sans pied (`estUnDocMarkdown`).
// Ordre motivé : les registres générés passent EN TÊTE (les générateurs de docs lisent `src/`) ; les
// rapports d'Atlas LISENT les fiches docs/raw (`pagesLues` de coverage.mjs, `computeReconciliation`
// de reconcile.mjs, `scan` de reanchor.mjs), ils passent donc APRÈS build-catalogs/build-implemente
// qui les écrivent. C'est cet ordre qui autorise une source elle-même GÉNÉRÉE : une source écrite par
// un générateur PLUS TARD dans la liste serait lue périmée, et se fait refuser par nom.
//
// EMPREINTE DE SOURCES (#1679) — chaîne complète, aucun maillon écrit à la main :
//   1. chaque générateur est lancé avec `scripts/docs/lib/enregistreur-lectures.mjs` en préchargeur
//      (`NODE_OPTIONS`, donc les sous-processus node en héritent) : ce qu'il lit se MESURE ;
//   2. le set fusionné (un fichier par PID) part dans le dérivé `docs/.sources-lues.json` ;
//   3. chaque doc reçoit en pied l'empreinte de ses sources TELLES QUE LE DISQUE les portait ;
//   4. `--empreinte` recalcule la même empreinte depuis l'INDEX git et compare au pied : un doc
//      STAGÉ, régénéré depuis un arbre où une source lue n'est pas stagée, diverge (joué au commit).
// Le rendu est DÉTERMINISTE (tout est trié) : deux `docs:build` de suite rendent des octets
// identiques, `.sources-lues.json` compris. Son CHURN suit ce qu'un générateur LIT, jamais ce qu'il
// écrit — un commit ne le bouge que s'il ajoute/retire une source ou un dossier lu (fichier neuf
// sous `src/`, import de plus, fiche `docs/raw` de plus), pas parce qu'une source a changé de
// contenu (c'est le PIED du doc qui bouge, lui, à chaque régénération).
// Un générateur `runner: 'tsx'` se lance par `node --import tsx/esm` (`tsx/dist/cli.mjs` re-spawne un
// processus) ; un dumper passe par `resoudreOutilLocal` + `envIsole`, qui transmettent l'env.
//
// RENDU SOUS UNE PLATEFORME (#1801) : `--check --plateforme <nom>` rend chaque générateur sur l'hôte
// ET sous `<nom>` (sur l'hôte seul quand `<nom>` est l'hôte), par un module de `PLATEFORMES` composé
// dans `NODE_OPTIONS` comme l'enregistreur — un générateur de plus y passe sans rien déclarer ;
// `--check --tout` le fait pour chaque plateforme de `PLATEFORMES` autre que l'hôte. Les deux
// processus tournent en parallèle ; un corps qui dépend de la plateforme qui l'a rendu est rouge, et
// le rouge nomme sa plateforme. Seul le rendu de l'hôte s'écrit et se mesure (pied,
// `docs/.sources-lues.json`) : l'autre ne charge pas l'enregistreur.
import { execFileSync, spawn } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { binLocal, envIsole, resoudreOutilLocal } from '../lancer-local.mjs'
import { correspondGlob, listerArbre, listerDossier } from '../guards/lib/lister.mjs'
import { MOTIF_CATALOGUES } from '../raw/motif-catalogues.mjs'
import { SORTIES as SORTIES_DU_REGISTRE } from '../gen-registry.mjs'
import { execFileResilient, reessayerAuChargement } from '../guards/lib/spawnResilient.mjs'
import {
  avecPied, CODE_CORPS_PERIME, deltaSourcesLues, empreinteDeLIndex, empreinteDuDisque, ENV_CORPS_RENDUS, existeFichier,
  fusionnerLectures, hashBlobDisque, indexGit, lirePied, motifDeRejeu, estUnDocMarkdown,
  serialiserSourcesLues, sha1Corps,
} from './lib/empreinte-sources.mjs'
import { ignoresGit } from './lib/chemin-mesure.mjs'

/** `{ runner, script, targets, injecte }` — `runner` = 'node' | 'tsx' ; `targets` = fichiers ÉCRITS
 *  EN ENTIER (glob toléré), dont seuls les docs Markdown reçoivent un pied (`estUnDocMarkdown`, cf. la
 *  garde de taxonomie de scripts/git-hooks/merge-docs.test.mjs) ; `injecte` = fichiers
 *  dont le générateur ne réécrit QU'UN BLOC (il les relit, ils ne sont donc pas ses sources).
 *  Tout générateur sait `--check` : un de plus coûte une ligne ici, et rien d'autre.
 *  Ordre = ordre d'exécution. */
export const GENERATORS = [
  { runner: 'node', script: 'scripts/gen-registry.mjs', targets: SORTIES_DU_REGISTRE },
  { runner: 'node', script: 'scripts/gen-quality-ids.mjs', targets: ['src/engine/qualities/qualityId.generated.ts'] },
  { runner: 'node', script: 'scripts/raw/build-atlas-index.mjs', targets: [], injecte: ['docs/raw/**/00-index.md'] },
  { runner: 'node', script: 'scripts/raw/build-catalogs.mjs', targets: [MOTIF_CATALOGUES] },
  { runner: 'node', script: 'scripts/raw/build-implemente.mjs', targets: [], injecte: ['docs/raw/**/*.md'] },
  { runner: 'node', script: 'scripts/docs/build-primitives.mjs', targets: ['docs/primitives.md'] },
  { runner: 'node', script: 'scripts/docs/build-systemes.mjs', targets: ['docs/systemes.md'] },
  { runner: 'node', script: 'scripts/docs/build-donnees.mjs', targets: ['docs/donnees.md'] },
  { runner: 'node', script: 'scripts/docs/build-sources-vf.mjs', targets: ['docs/sources-vf.md'] },
  { runner: 'node', script: 'scripts/docs/build-effects.mjs', targets: ['docs/campagne-effects.md'] },
  { runner: 'node', script: 'scripts/docs/build-vocabulaire.mjs', targets: ['docs/vocabulaire-mecanique.md'] },
  { runner: 'node', script: 'scripts/docs/build-index-moteur.mjs', targets: ['docs/index-moteur.md'] },
  { runner: 'node', script: 'scripts/docs/build-registre-jets.mjs', targets: ['docs/registre-jets.md'] },
  { runner: 'node', script: 'scripts/docs/build-usages-jets.mjs', targets: ['docs/usages-jets.md'] },
  { runner: 'node', script: 'scripts/docs/build-entity-orphans.mjs', targets: ['docs/orphelines-donnees.md'] },
  { runner: 'node', script: 'scripts/docs/build-test-scenarios.mjs', targets: ['docs/test-scenarios.md'] },
  { runner: 'node', script: 'scripts/docs/build-reprise.mjs', targets: ['docs/reprise-apres-pause.md'] },
  { runner: 'node', script: 'scripts/docs/build-icones.mjs', targets: ['docs/ajouter-une-icone.md'] },
  { runner: 'node', script: 'scripts/docs/build-codex-relations.mjs', targets: ['docs/codex-relations.md'] },
  { runner: 'node', script: 'scripts/docs/build-map-authoring.mjs', targets: ['docs/map-authoring.md'] },
  { runner: 'node', script: 'scripts/docs/build-passifs.mjs', targets: ['docs/systeme-passifs.md'] },
  { runner: 'node', script: 'scripts/docs/build-rendu-pipeline.mjs', targets: ['docs/rendu-pipeline.md'] },
  { runner: 'node', script: 'scripts/docs/build-flux-de-jet.mjs', targets: ['docs/ajouter-un-flux-de-jet.md'] },
  { runner: 'node', script: 'scripts/docs/build-mecanique.mjs', targets: ['docs/ajouter-une-mecanique.md'] },
  { runner: 'node', script: 'scripts/docs/build-sort.mjs', targets: ['docs/ajouter-un-sort.md'] },
  { runner: 'node', script: 'scripts/docs/build-ajouter-donnee.mjs', targets: ['docs/ajouter-une-donnee.md'] },
  { runner: 'node', script: 'scripts/docs/build-regles-optionnelles.mjs', targets: ['docs/regles-optionnelles.md'] },
  { runner: 'node', script: 'scripts/docs/build-doctrines.mjs', targets: ['docs/doctrines.md'] },
  { runner: 'tsx', script: 'scripts/gen-sorts-doc.mts', targets: ['docs/sorts-implementation.md'] },
  { runner: 'tsx', script: 'scripts/docs/build-field-consumers.mts', targets: ['docs/consommateurs-de-champs.md'] },
  { runner: 'tsx', script: 'scripts/docs/build-structures.mts', targets: ['docs/structures-donnees.md'] },
  { runner: 'node', script: 'scripts/raw/coverage.mjs', targets: ['docs/raw/coverage.md'] },
  { runner: 'node', script: 'scripts/raw/reconcile.mjs', targets: ['docs/raw/reconciliation.md'] },
  { runner: 'node', script: 'scripts/raw/reanchor.mjs', targets: ['docs/raw/reanchor.md'] },
]

/** Étapes de `--check` qui ne GÉNÈRENT rien (vérificateurs purs, sans `--check`) : `build-all.mjs`
 *  les exécute lui-même, après les générateurs. */
export const NON_GENERATOR_CHECKS = [
  'scripts/docs/check-doc-refs.mjs',
  'scripts/docs/check-plans-anchors.mjs',
  'scripts/raw/check-atlas-counts.mjs',
  'scripts/data/check-progression-schemas.mjs',
]

/** Chemin du dérivé qui porte les sets MESURÉS, un par générateur. */
export const SOURCES_LUES = 'docs/.sources-lues.json'

const moduleDeLib = (nom) => pathToFileURL(fileURLToPath(new URL(`lib/${nom}`, import.meta.url))).href

const ENREGISTREUR = moduleDeLib('enregistreur-lectures.mjs')

/** Plateforme (nom de `process.platform`) → module `node --import` qui rend un générateur sous elle.
 *  L'hôte se rend sans module : `--plateforme <hôte>` est le rendu natif. */
export const PLATEFORMES = { win32: moduleDeLib('plateforme-win32.mjs') }

/**
 * Entrée ESM de `tsx` DANS CET ARBRE (`exports['./esm']`). L'exécutable `tsx` re-spawne un processus
 * node : le générateur y perdrait le préchargeur passé en argument. `resoudreOutilLocal` porte le
 * refus nommé quand l'arbre ne l'a pas installé (porte d'outillage local, #1679 L1c) — la résolution
 * ci-dessous ne peut donc rendre que le paquet de cet arbre, trouvé au premier `node_modules` remonté.
 * Le sous-chemin se résout par le SPÉCIFICATEUR (`import.meta.resolve`), pas en relisant `exports`
 * à la main : c'est la résolution que joue `node --import`, conditions d'import comprises, et elle
 * est LUE STATIQUEMENT par `knip --dependencies` — sans elle `tsx` n'a plus aucune référence de code
 * et est rapporté devDependency inutilisée (CI 33691303703, rouge après le passage de `npx tsx` à la
 * résolution par nom).
 */
function tsxEsmDe(cwd) {
  const { refus } = resoudreOutilLocal(cwd, 'tsx', 'tsx')
  if (refus) {
    console.error(refus)
    process.exit(1)
  }
  return fileURLToPath(import.meta.resolve('tsx/esm'))
}

/** Chemins visés par une liste de `targets`/`injecte` — un glob se déplie sur le disque dans la
 *  grammaire UNIQUE du dépôt (`motifDeGlob` / `correspondGlob`, `scripts/guards/lib/lister.mjs`), et
 *  dans aucune autre : ce site ne lit pas le motif lui-même, il le DONNE à lire.
 *  La marche est bornée DEUX fois, par le motif seul : à la racine, ses segments sans joker ; en
 *  PROFONDEUR, un dossier n'est descendu que si un PRÉFIXE du motif le vise encore — `docs/*.md` ne
 *  marche donc pas `docs/raw/`, et `docs/raw/**\/00-index.md` descend tout `docs/raw/`. */
export function ciblesSurDisque(cibles, cwd) {
  return cibles.flatMap((cible) => {
    if (!cible.includes('*')) return [cible]
    const segments = cible.split('/')
    const dossier = segments.slice(0, segments.findIndex((s) => s.includes('*'))).join('/')
    const sous = (rel) => (dossier ? `${dossier}/${rel}` : rel)
    const prefixes = segments.slice(0, -1).map((_, i) => segments.slice(0, i + 1).join('/'))
    return listerArbre(path.join(cwd, dossier), {
      absent: 'vide',
      descendre: (rel) => prefixes.some((p) => correspondGlob(sous(rel), p)),
    })
      .map(sous)
      .filter((p) => correspondGlob(p, cible))
  })
}

/**
 * Argv et env d'un générateur. Un seul `--import` en `NODE_OPTIONS` : l'enregistreur (rendu de l'hôte,
 * mesuré) ou la plateforme (rendu vérifié, jamais mesuré), puis `tsx/esm` (argv, joué après
 * `NODE_OPTIONS`). `plateforme` : `null` = l'hôte. `corps` : le fichier de `ENV_CORPS_RENDUS`.
 */
function commandeDe({ runner, script }, { cwd, check, tsxEsm, lectures, ignores, cibles, plateforme, corps }) {
  const args = [
    ...(runner === 'tsx' ? ['--import', pathToFileURL(tsxEsm).href] : []),
    script,
    ...(check ? ['--check'] : []),
  ]
  const env = envIsole(process.env, binLocal(cwd))
  const module = lectures ? ENREGISTREUR : plateforme ? PLATEFORMES[plateforme] : null
  if (module) env.NODE_OPTIONS = `${env.NODE_OPTIONS ?? ''} --import ${module}`.trim()
  if (plateforme) env.WFRP_PLATEFORME_RACINE = cwd
  env[ENV_CORPS_RENDUS] = corps
  if (lectures) {
    env.WFRP_LECTURES_RACINE = cwd
    env.WFRP_LECTURES_SORTIE = path.join(lectures, 'l')
    env.WFRP_LECTURES_IGNORES = ignores
    env.WFRP_LECTURES_CIBLE = cibles.join(',')
  }
  return { args, env }
}

function run(g, options) {
  const { args, env } = commandeDe(g, options)
  // Rejeu si le processus n'a pas DÉMARRÉ : sous quatre lanes de gates, le loader Windows a refusé
  // d'initialiser `build-implemente.mjs` (3221225794) et `docs:check` est sorti ROUGE en 48,6 s sur
  // un arbre sain (mesuré le 2026-09-04). Tout autre code reste un vrai verdict.
  execFileResilient(process.execPath, args, {
    cwd: options.cwd,
    env,
    ...sortiesDe(options.quiet),
  }, { site: `build-all/${g.script}` })
}

/** `run()` SANS attendre, sorties capturées : le rendu sous une autre plateforme se joue pendant le
 *  rendu principal du même générateur. REND `{ code, issue, sortie }` : `code` est le statut que lit
 *  `reessayerAuChargement`, `issue` celle que lit `natureDuRouge`. */
function lancer(g, options) {
  const { args, env } = commandeDe(g, options)
  return reessayerAuChargement(
    () =>
      new Promise((fin) => {
        const morceaux = []
        const enfant = spawn(process.execPath, args, { cwd: options.cwd, env, stdio: ['ignore', 'pipe', 'pipe'] })
        enfant.stdout.on('data', (m) => morceaux.push(m))
        enfant.stderr.on('data', (m) => morceaux.push(m))
        enfant.on('error', (e) => fin({ code: null, issue: issueDe(e), sortie: `${e.message}\n` }))
        enfant.on('close', (status, signal) =>
          fin({ code: status, issue: { status, signal, code: null }, sortie: Buffer.concat(morceaux).toString('utf8') }))
      }),
    { site: `build-all/${g.script} (${options.plateforme})` },
  )
}

/** sha1 des corps rendus qu'un rendu a déclarés périmés (`ENV_CORPS_RENDUS`), triés : un multiset. */
function corpsRendus(fichier) {
  let texte
  try { texte = readFileSync(fichier, 'utf8') } catch { texte = '' }
  return texte.split('\n').filter(Boolean).sort().join('\n')
}

/** `--quiet` capture les deux flux au lieu de les jeter : le diagnostic d'un rouge (le cliquet parle
 *  sur stdout, la primitive sur stderr) se rend par `transmettreDiagnostic`. */
const sortiesDe = (quiet) =>
  quiet ? { stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 256 * 1024 * 1024 } : { stdio: 'inherit' }

/** `--quiet` tait la sortie d'un processus VERT, jamais le diagnostic d'un rouge. */
function transmettreDiagnostic(e, quiet) {
  if (!quiet) return
  if (e.stdout) process.stdout.write(e.stdout)
  if (e.stderr) process.stderr.write(e.stderr)
}

/** Un générateur lit au MOINS son propre fichier et une source : en dessous, la mesure a échoué. */
export const SEUIL_SOURCES = 2

/**
 * Message d'ARRÊT quand le set mesuré d'un générateur est vide ou minuscule — jamais une empreinte
 * « vérifiée » sur du vide. Sans les trois mécaniques (`syncBuiltinESMExports`, `NODE_OPTIONS`,
 * `tsx/esm`), 7 générateurs rendaient 10 chemins ou moins (mesure du juge, 2026-09-02).
 */
export function refusSourcesInsuffisantes(script, nombre, cheminsRejetes = 0) {
  return nombre < SEUIL_SOURCES
    ? `docs:build — ARRÊT sur ${script} : ${nombre} source(s) mesurée(s), l'enregistreur de lectures est AVEUGLE sur ce générateur — ${cheminsRejetes} chemin(s) lu(s) hors racine, écarté(s) de la mesure.`
    : null
}

/**
 * AUTO-CONTRÔLE de fin de génération : les cibles qui existent sur disque et ne portent AUCUN pied.
 * Une cible non signée n'est jugée par rien — ni par `--empreinte`, ni par le hook. Le cas est vécu :
 * un générateur joué SEUL réécrit sa cible et effaçait la signature (d'où `ecrireDoc`, qui la garde).
 */
export function ciblesNonSignees(cwd, parGenerateur) {
  return Object.entries(parGenerateur).flatMap(([script, e]) =>
    e.cibles
      .filter((cible) => {
        const chemin = path.join(cwd, cible)
        return existeFichier(chemin) && !lirePied(readFileSync(chemin, 'utf8'))
      })
      .map((cible) => `${cible} (écrit par ${script})`),
  )
}

/** Le dérivé committé (`{}` quand le dépôt n'en porte pas : `docs:build` l'écrit). */
function lireSourcesLues(cwd) {
  try { return JSON.parse(readFileSync(path.join(cwd, SOURCES_LUES), 'utf8')) } catch { return {} }
}

/** Nombre de chemins imprimés par sens dans le diagnostic de fraîcheur. */
const CHEMINS_IMPRIMES = 12

const listeCourte = (chemins, signe) => [
  ...chemins.slice(0, CHEMINS_IMPRIMES).map((c) => `      ${signe} ${c}`),
  ...(chemins.length > CHEMINS_IMPRIMES ? [`      … et ${chemins.length - CHEMINS_IMPRIMES} autres`] : []),
]

/** Premier octet où deux textes divergent, ou `-1` s'ils sont identiques octet pour octet. */
function premierOctetDivergent(a, b) {
  const x = Buffer.from(a, 'utf8')
  const y = Buffer.from(b, 'utf8')
  const n = Math.min(x.length, y.length)
  for (let i = 0; i < n; i++) if (x[i] !== y[i]) return i
  return x.length === y.length ? -1 : n
}

/**
 * Ce qui a bougé entre le dérivé COMMITTÉ et la mesure, NOMMÉ. Un rouge de fraîcheur muet ne se
 * diagnostique pas depuis l'autre OS : la CI ubuntu du run 33717131460 rougissait sur un arbre vert
 * sous Windows sans dire quel générateur ni quels chemins. Le cas « aucun delta » est le second
 * verdict utile : la divergence porte alors sur la SÉRIALISATION seule (fin de ligne, ordre), pas sur
 * le contenu mesuré.
 */
function diagnosticSourcesLues(actuel, rendu, mesure) {
  if (actuel === null) return `  ${SOURCES_LUES} est ABSENT ou illisible sur le disque : rien à comparer.\n`
  let avant
  try { avant = JSON.parse(actuel) } catch (e) {
    return `  ${SOURCES_LUES} n'est pas du JSON valide (${e.message}) : rien à comparer.\n`
  }
  const deltas = deltaSourcesLues(avant, mesure)
  if (deltas.length) {
    return deltas
      .flatMap((d) => [
        `  ${d.generateur} ${d.champ} : +${d.ajoutes.length} / -${d.retires.length}`,
        ...listeCourte(d.ajoutes, '+'),
        ...listeCourte(d.retires, '-'),
      ])
      .join('\n') + '\n'
  }
  const i = premierOctetDivergent(actuel, rendu)
  const ctx = (t) => JSON.stringify(Buffer.from(t, 'utf8').subarray(i, i + 20).toString('utf8'))
  return `  différence de SÉRIALISATION seule : ${Buffer.byteLength(actuel)} / ${Buffer.byteLength(rendu)} octets, première divergence à l'octet ${i} : ${ctx(actuel)} vs ${ctx(rendu)}\n`
}

/** Les cibles SIGNÉES d'un générateur : celles de ses `targets` qui sont des docs Markdown. */
export const ciblesSignees = (g, cwd) => ciblesSurDisque(g.targets.filter(estUnDocMarkdown), cwd)

/**
 * Cible → générateur qui l'ÉCRIT. Un fichier écrit en entier n'a qu'un auteur : deux pieds sur le même
 * doc seraient contradictoires, et le second effacerait le premier. REND aussi les doublons.
 */
export function proprietairesDeCibles(cwd, generateurs = GENERATORS) {
  const par = new Map()
  const doublons = []
  for (const g of generateurs)
    for (const cible of ciblesSurDisque(g.targets, cwd)) {
      if (par.has(cible)) doublons.push(`${cible} : déclarée par ${par.get(cible)} ET ${g.script}`)
      else par.set(cible, g.script)
    }
  return { par, doublons }
}

/** Contenu d'un chemin DANS L'INDEX (`git show :<chemin>`), ou `null` si le commit ne le porte pas. */
function auCommit(cwd, chemin) {
  try { return execFileSync('git', ['show', `:${chemin}`], { cwd, encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'pipe'] }) } catch { return null }
}

/** Remède UNIQUE d'un pied qui ne décrit pas l'index : le doc se régénère, il ne se retouche pas. */
const REMEDE_DU_PIED = '      → régénérer (npm run docs:build) et stager le doc, ou stager les sources qu’il décrit'

/**
 * Le refus que porte le PIED d'une cible TELLE QUE L'INDEX LA PORTE, ou `null` — la rédaction de
 * `--empreinte` (`verifierEmpreintes`). `juge` dit si un pied a pu être confronté : une cible que
 * l'index ne porte pas (première génération) n'a rien à mentir. `cause` est appelée SEULEMENT quand
 * ce sont les sources qui ont bougé : nommer la cause coûte un hash du disque par source lue.
 */
export function refusDuPiedAuCommit(cwd, empreinte, cible, cause = null) {
  const texte = auCommit(cwd, cible)
  if (texte === null) return { juge: false, refus: null }
  const motif = motifDeRejeu(texte, empreinte)
  if (!motif) return { juge: true, refus: null }
  if (!motif.startsWith('sources ')) return { juge: true, refus: `${cible} : ${motif}\n${REMEDE_DU_PIED}` }
  const detail = cause ? `\n      source(s) qui diffèrent de l'index : ${cause()}` : ''
  return {
    juge: true,
    refus: `${cible} : doc régénéré depuis un arbre ≠ index (${motif})${detail}\n${REMEDE_DU_PIED}`,
  }
}

/** Sources du générateur dont le DISQUE et l'INDEX divergent — la cause à nommer, jamais un sha1 nu. */
function sourcesDivergentes(cwd, blobs, fichiers) {
  const divergentes = []
  for (const chemin of fichiers) {
    let disque
    try { disque = hashBlobDisque(path.join(cwd, chemin)) } catch { disque = null }
    if (disque !== blobs.get(chemin)) divergentes.push(chemin)
  }
  return divergentes
}

/**
 * `--empreinte [--only <script>…]` : SANS rien régénérer, recalcule depuis l'INDEX l'empreinte des
 * sources de chaque générateur et la compare au pied du doc TEL QUE L'INDEX LE PORTE. Les deux côtés
 * sortent du commit en fabrication, et de rien d'autre. REND le code de sortie.
 * Sans `--only`, tout doc que l'index porte est jugé (la CI, sur un arbre où index = HEAD) ; avec,
 * le hook ne fait juger que les docs STAGÉS. Aucun doc à juger = 0 : il n'y a rien à mentir.
 */
function verifierEmpreintes(cwd, seulement) {
  const lues = lireSourcesLues(cwd)
  const tous = Object.keys(lues)
  if (!tous.length) {
    console.error(`docs:empreinte — ${SOURCES_LUES} absent ou vide : aucune source n'est mesurée (npm run docs:build).`)
    return 1
  }
  const scripts = tous.filter((s) => !seulement || seulement.has(s))
  if (!scripts.length) {
    console.log('docs:empreinte — aucun doc stagé à confronter à l\'index.')
    return 0
  }
  // FAIL-CLOSED : `docs/.sources-lues.json` DIT quelles sources chaque doc a lues. Sans lui dans
  // l'index, aucun pied n'est vérifiable — et un 0 rendu ici serait un vert qui ne mesure rien.
  if (auCommit(cwd, SOURCES_LUES) === null) {
    process.stderr.write(
      `docs:empreinte — REFUS : ${SOURCES_LUES} n'est pas dans l'index. C'est lui qui porte les sources ` +
        'mesurées de chaque générateur : sans lui, aucun pied ne peut être confronté.\n' +
        `  → npm run docs:build, puis stager ${SOURCES_LUES} avec les docs.\n`,
    )
    return 1
  }
  const blobs = indexGit(cwd)
  const refus = []
  let docsJuges = 0
  for (const script of scripts) {
    const entree = lues[script]
    const { empreinte, manquants } = empreinteDeLIndex(blobs, {
      fichiers: entree.fichiers,
      dossiers: new Map(entree.dossiers.map((d) => [d, []])),
    })
    for (const chemin of manquants)
      refus.push(`${script} : source non suivie « ${chemin} » — l'index ne la porte pas, elle ne peut pas être vérifiée`)
    // La CAUSE coûte un hash du disque par source lue : elle ne se calcule que si le pied est refusé.
    const cause = () => {
      const divergentes = sourcesDivergentes(cwd, blobs, entree.fichiers)
      return divergentes.length
        ? divergentes.join(', ')
        : "aucune sur ce disque — le pied vient d'un autre arbre, ou un dossier lu a changé de listing"
    }
    for (const cible of entree.cibles) {
      const verdict = refusDuPiedAuCommit(cwd, empreinte, cible, cause)
      if (verdict.juge) docsJuges += 1
      if (verdict.refus) refus.push(verdict.refus)
    }
  }
  if (refus.length) {
    process.stderr.write(`docs:empreinte — REFUS (${refus.length}) :\n${refus.map((r) => `  ${r}`).join('\n')}\n`)
    return 1
  }
  console.log(
    docsJuges
      ? `docs:empreinte — OK (${scripts.length} générateur(s), ${docsJuges} doc(s) confrontés à l'index)`
      : 'docs:empreinte — aucun doc stagé à confronter à l\'index.',
  )
  return 0
}

/**
 * Pourquoi `--check` doit tout REJOUER, ou `null` si la mesure de référence est utilisable. La
 * fraîcheur d'un doc se juge contre `docs/.sources-lues.json` : si ce dérivé n'est pas au commit,
 * ou si le disque en porte un autre que l'index, la référence elle-même est en doute — FAIL-CLOSED,
 * on rejoue tout et on le dit, jamais un « frais » prononcé sur une mesure incertaine.
 */
export function motifRejeuComplet(auCommitTexte, surDisqueTexte) {
  if (auCommitTexte === null)
    return `${SOURCES_LUES} n'est pas dans l'index : aucune fraîcheur n'est jugeable sans lui`
  if (auCommitTexte !== surDisqueTexte)
    return `${SOURCES_LUES} du disque diffère de celui de l'index : la mesure de référence a bougé`
  return null
}

/**
 * Verdict du PIED d'une cible que `--check` vient de rejouer avec un corps identique : `null` si le
 * pied signe bien `empreinte`, sinon la raison NOMMÉE. Un corps inchangé ne dit rien des sources —
 * un commentaire ajouté à une source lue ne bouge aucun doc, mais périme tous leurs pieds.
 * REND la raison sans préfixe ni remède : l'appelant nomme le générateur et la commande.
 */
export function verdictDuPied({ pied, empreinte, cible }) {
  if (!pied) return `pied ABSENT sur ${cible} : sources ${empreinte.slice(0, 12)} non signées, corps identique`
  if (pied.empreinte !== empreinte)
    return `pied PÉRIMÉ sur ${cible} : sources ${pied.empreinte.slice(0, 12)} ≠ ${empreinte.slice(0, 12)}, corps identique`
  return null
}

/**
 * Générateurs que `--check` peut SAUTER, et pourquoi les autres sont rejoués. Un générateur est
 * FRAIS quand TOUTES ses cibles portent un pied qui signe les mêmes sources ET leur propre corps.
 * L'empreinte des sources est exigée ÉGALE DES DEUX CÔTÉS — le DISQUE (ce que le générateur relirait)
 * et l'INDEX (ce que le commit embarque) : le disque seul laisserait passer une source stagée sans
 * régénération, l'index seul laisserait passer une source modifiée et non stagée.
 * REND `{ frais: Map<script, empreinte>, motifs: Map<script, raison> }`.
 */
export function fraicheurDesGenerateurs(cwd, blobs, lues, ignores, generateurs = GENERATORS) {
  const frais = new Map()
  const motifs = new Map()
  for (const g of generateurs) {
    const entree = lues[g.script]
    if (!entree) {
      motifs.set(g.script, `jamais mesuré dans ${SOURCES_LUES}`)
      continue
    }
    const cibles = ciblesSignees(g, cwd)
    // Aucune cible signée — il n'injecte qu'un BLOC d'un fichier manuscrit, ou n'écrit que du CODE :
    // aucun pied ne le signe, rien n'est jugeable, donc il est toujours rejoué.
    if (!cibles.length) {
      motifs.set(g.script, 'aucune cible signée (bloc injecté ou cible de code) : rien à juger frais')
      continue
    }
    const dossiers = new Map(entree.dossiers.map((d) => [d, listerDossier(path.join(cwd, d), { absent: 'vide' })]))
    const surIndex = empreinteDeLIndex(blobs, {
      fichiers: entree.fichiers,
      dossiers: new Map(entree.dossiers.map((d) => [d, []])),
    })
    if (surIndex.manquants.length) {
      motifs.set(g.script, `source(s) que l'index ne porte pas : ${surIndex.manquants.slice(0, 3).join(', ')}`)
      continue
    }
    let surDisque
    try {
      surDisque = empreinteDuDisque(cwd, { fichiers: entree.fichiers, dossiers }, ignores).empreinte
    } catch (e) {
      motifs.set(g.script, `source illisible sur le disque : ${e.message}`)
      continue
    }
    if (surDisque !== surIndex.empreinte) {
      motifs.set(g.script, `sources du disque ${surDisque.slice(0, 12)} ≠ index ${surIndex.empreinte.slice(0, 12)}`)
      continue
    }
    let motif = null
    for (const cible of cibles) {
      let texte
      try {
        texte = readFileSync(path.join(cwd, cible), 'utf8')
      } catch {
        motif = `${cible} : absent du disque`
        break
      }
      const m = motifDeRejeu(texte, surIndex.empreinte)
      if (m) {
        motif = `${cible} : ${m}`
        break
      }
    }
    if (motif) motifs.set(g.script, motif)
    else frais.set(g.script, surIndex.empreinte)
  }
  return { frais, motifs }
}

/**
 * L'issue d'un générateur rouge, lue sur l'erreur de `execFileResilient` : `status` (code de
 * sortie, `null` pour un processus tué), `signal`, et `code` (errno : `ENOENT` = jamais démarré,
 * `ENOBUFS` = sortie coupée au-delà de `maxBuffer`). PUR.
 */
export const issueDe = (e) => ({
  status: typeof e?.status === 'number' ? e.status : null,
  signal: e?.signal ?? null,
  code: typeof e?.code === 'string' ? e.code : null,
})

/**
 * La nature d'un rouge de générateur, lue sur son issue (`issueDe`). La convention d'un dérivé ne
 * produit que trois codes : 1 (rouge), `CODE_CORPS_PERIME` (corps périmé), et les deux ensemble.
 * Le bit du corps périmé ne se LIT que sur ces deux derniers : tout autre code (les codes réservés
 * de Node, 6, 7, 13…) est une « sortie N ». Un processus tué se nomme par son signal, une erreur de
 * lancement par son errno. PUR.
 */
export function natureDuRouge({ status = null, signal = null, code = null }) {
  if (code) return signal ? `${code} (tué par ${signal})` : code
  if (signal) return `tué par ${signal}`
  if (status === CODE_CORPS_PERIME) return 'corps périmé'
  if (status === (1 | CODE_CORPS_PERIME)) return 'corps périmé + sortie 1'
  if (typeof status === 'number') return `sortie ${status}`
  return 'sans code de sortie'
}

/** En-tête du bilan des rouges de `--check`, suivi d'un rouge par ligne indentée. */
export const ENTETE_ROUGES = 'docs:check — ROUGE'

/** Les rouges NOMMÉS par le dernier bilan `ENTETE_ROUGES` d'une sortie de `--check`. PUR. */
export function rougesNommes(sortie) {
  const lignes = String(sortie ?? '').split(/\r?\n/)
  const debut = lignes.findLastIndex((l) => l.startsWith(`${ENTETE_ROUGES} (`))
  if (debut < 0) return []
  const suite = lignes.slice(debut + 1)
  const fin = suite.findIndex((l) => !l.startsWith('  '))
  return (fin < 0 ? suite : suite.slice(0, fin)).map((l) => l.trim())
}

/** Un rouge de générateur que `docs:build` guérit : son SEUL grief est un corps périmé. PUR. */
export const guerissable = (issue) => !issue.code && !issue.signal && issue.status === CODE_CORPS_PERIME

/** Valeur d'un drapeau à arguments : ceux qui le suivent, jusqu'au drapeau suivant ; `null` s'il est absent. */
function argumentsDe(argv, drapeau) {
  const i = argv.indexOf(drapeau)
  if (i < 0) return null
  const fin = argv.findIndex((a, j) => j > i && a.startsWith('--'))
  return argv.slice(i + 1, fin < 0 ? argv.length : fin)
}

/**
 * `docs:build` (écriture), `--check` (vérification) ou `--empreinte`. REND (promesse) le code de sortie.
 * En écriture, le premier rouge ARRÊTE : un générateur rouge laisse docs/ à moitié régénéré, et
 * enchaîner les suivants fabriquerait un lot incohérent que le hook annoncerait « à committer ».
 * En `--check`, rien n'est écrit : chaque générateur et chaque vérificateur rend son verdict, et tous
 * les rouges sont nommés à la fin. Le code de sortie dit si `docs:build` les guérit :
 * `CODE_CORPS_PERIME` quand CHAQUE rouge est un corps, un pied ou `.sources-lues.json` périmé, 1 dès
 * qu'un rouge ne se régénère pas (cliquet, vérificateur, refus, corps périmé qu'aucun corps déclaré
 * ne prouve ou que l'hôte et une plateforme ne déclarent pas pareil) — c'est ce que lit `publier.mjs`.
 */
export async function executer({
  cwd,
  argv = process.argv,
  generateurs = GENERATORS,
  verificateurs = NON_GENERATOR_CHECKS,
}) {
  const quiet = argv.includes('--quiet')
  const check = argv.includes('--check')
  const tout = argv.includes('--tout')
  const only = argumentsDe(argv, '--only')
  const seulement = only && new Set(only)
  if (argv.includes('--empreinte')) return verifierEmpreintes(cwd, seulement)
  const hote = process.platform
  const plateformes = argumentsDe(argv, '--plateforme')
  if (plateformes && (plateformes.length !== 1 || (plateformes[0] !== hote && !PLATEFORMES[plateformes[0]]))) {
    process.stderr.write(`docs:build — --plateforme « ${plateformes.join(' ')} » : attend UNE plateforme parmi ${[...new Set([hote, ...Object.keys(PLATEFORMES)])].join(', ')}.\n`)
    return 1
  }
  const demandee = plateformes?.[0] ?? null
  // Le rendu de l'HÔTE est le seul écrit et le seul mesuré. Les plateformes rendues EN PLUS, en
  // parallèle, sont vérifiées : `--plateforme <nom>`, ou toutes celles de `PLATEFORMES` sous `--tout`.
  const enPlus = (demandee !== null ? [demandee] : check && tout ? Object.keys(PLATEFORMES) : []).filter((p) => p !== hote)
  if (enPlus.length && !check) {
    process.stderr.write(`docs:build — --plateforme ${demandee} : un rendu sous une autre plateforme se VÉRIFIE (--check), docs/ porte le rendu de l'hôte.\n`)
    return 1
  }
  if (demandee !== null || (check && tout)) {
    console.log(
      enPlus.length
        ? `docs:check — chaque générateur rendu sur l'hôte (${hote}) et sous ${enPlus.join(', ')}.`
        : `docs:check — hôte ${hote} : son rendu natif EST le rendu sous ${demandee ?? Object.keys(PLATEFORMES).join(', ')}, aucune autre plateforme à rendre.`,
    )
  }
  // Refus d'un tsx NON LOCAL avant le premier générateur : à mi-chaîne, docs/ serait à moitié écrit.
  const tsxEsm = generateurs.some((g) => g.runner === 'tsx') ? tsxEsmDe(cwd) : null
  const ignores = ignoresGit(cwd)
  const { doublons } = proprietairesDeCibles(cwd, generateurs)
  if (doublons.length) {
    process.stderr.write(`docs:build — ARRÊT : cible(s) déclarée(s) par DEUX générateurs, le second pied effacerait le premier :\n${doublons.map((d) => `  ${d}`).join('\n')}\n`)
    return 1
  }
  // Cibles DÉPLIÉES une fois : écrites en entier, signées (celles qui portent un pied), injectées.
  const cibles = new Map(generateurs.map((g) => [g.script, {
    ecrites: ciblesSurDisque(g.targets, cwd),
    signees: ciblesSignees(g, cwd),
    injectees: ciblesSurDisque(g.injecte ?? [], cwd),
  }]))
  // `--check` CIBLÉ : la fraîcheur saute un générateur dont chaque cible porte un pied qui signe ces
  // sources ET ce corps — il n'est pas rejoué, son cliquet non plus (`reconcile.mjs`, `reanchor.mjs`).
  // Pour le cliquet, c'est équivalent : il ne lit que des fichiers que l'enregistreur de lectures
  // MESURE (son stock, les fiches docs/raw, Source/), et des sources inchangées rendent le même
  // verdict. Pour le corps, c'est un raccourci AVEUGLE à la plateforme qui l'a rendu : un corps rendu
  // ailleurs puis re-signé y passe pour frais. `--tout` et `--plateforme` (l'hôte compris) rejouent
  // donc chaque générateur, et la CI joue `--tout` (#1801).
  const frais = new Map()
  const blobs = check ? indexGit(cwd) : null
  if (check && !tout && demandee === null) {
    let surDisque
    try { surDisque = readFileSync(path.join(cwd, SOURCES_LUES), 'utf8') } catch { surDisque = null }
    const complet = motifRejeuComplet(auCommit(cwd, SOURCES_LUES), surDisque)
    if (complet) {
      console.log(`docs:check — REJEU COMPLET : ${complet}.`)
    } else {
      const mesure = fraicheurDesGenerateurs(cwd, blobs, lireSourcesLues(cwd), ignores, generateurs)
      for (const [script, empreinte] of mesure.frais) frais.set(script, empreinte)
      for (const [script, motif] of mesure.motifs) console.log(`docs:check — ${script} — rejoué : ${motif}`)
    }
  }
  const racineLectures = path.join(cwd, 'node_modules', '.cache', 'lectures-docs', String(process.pid))
  rmSync(racineLectures, { recursive: true, force: true })
  // Le cache de lectures et de corps de ce run se purge à chaque sortie d'`executer`.
  try {
    // L'ensemble `ignoresGit`, calculé UNE fois, que chaque processus mesuré relit (#1769).
    const ignoresLectures = path.join(racineLectures, 'ignores.json')
    mkdirSync(racineLectures, { recursive: true })
    writeFileSync(ignoresLectures, JSON.stringify([...ignores]))
    const parGenerateur = {}
    // Verdicts de `--check`, TOUS collectés : un générateur rouge ne masque pas les suivants.
    const rouges = []
    // Par générateur : pourquoi `docs:build` ne guérirait PAS son corps périmé ; `null` s'il le guérit.
    const nonGueri = new Map()
    // Chaque refus dit s'il se GUÉRIT en régénérant (`docs:build`) : c'est le code de sortie.
    const refus = []
    const refuser = (message, { guerit = false } = {}) => {
      process.stderr.write(`${message}\n`)
      refus.push({ message, guerit })
    }
    let sautes = 0
    for (const [rang, g] of generateurs.entries()) {
      // `--only` ne restreint QUE la vérification : un `docs:build` partiel réécrirait
      // `.sources-lues.json` avec les seuls générateurs joués, et effacerait la mesure des autres.
      if (check && seulement && !seulement.has(g.script)) continue
      const { ecrites, signees, injectees } = cibles.get(g.script)
      if (frais.has(g.script)) {
        sautes += 1
        const corps = sha1Corps(readFileSync(path.join(cwd, signees[0]), 'utf8'))
        console.log(
          `docs:check — ${g.script} — frais (sources ${frais.get(g.script).slice(0, 12)}, corps ${corps.slice(0, 12)}), non rejoué`,
        )
        continue
      }
      const dossier = path.join(racineLectures, String(rang))
      mkdirSync(dossier, { recursive: true })
      const corpsDe = (plateforme) => path.join(dossier, `corps-rendus.${plateforme ?? 'hote'}`)
      const autres = enPlus.map((plateforme) => ({
        plateforme,
        rendu: lancer(g, { cwd, check, tsxEsm, plateforme, corps: corpsDe(plateforme) }),
      }))
      let rougePrincipal = false
      // Un générateur relit ce qu'il écrit (sa cible en `--check`, le fichier où il injecte un champ) :
      // rien de tout cela n'est une de ses sources. Seule une cible SIGNÉE — un doc écrit EN ENTIER —
      // reçoit le pied : `build-implemente` n'écrit qu'un champ des fiches docs/raw, fichiers manuscrits
      // qu'aucune empreinte ne peut signer, et un registre `*.generated.ts` est du code.
      try {
        run(g, {
          cwd, quiet, check, tsxEsm, lectures: dossier, ignores: ignoresLectures,
          cibles: [...new Set([...ecrites, ...injectees])].sort(), corps: corpsDe(null),
        })
      } catch (e) {
        transmettreDiagnostic(e, quiet)
        const issue = issueDe(e)
        if (!check) {
          process.stderr.write(`docs:build — ARRÊT sur ${g.script} (${natureDuRouge(issue)}) : docs/ n'est PAS à jour.\n`)
          return 1
        }
        rouges.push({ script: g.script, issue, plateforme: null })
        rougePrincipal = true
      }
      for (const { plateforme, rendu } of autres) {
        const { issue, sortie } = await rendu
        if (issue.status === 0) continue
        process.stderr.write(`docs:check — ${g.script} — rendu sous ${plateforme} :\n${sortie}`)
        rouges.push({ script: g.script, issue, plateforme })
      }
      const perimesHote = corpsRendus(corpsDe(null))
      const divergente = enPlus.find((plateforme) => corpsRendus(corpsDe(plateforme)) !== perimesHote)
      nonGueri.set(
        g.script,
        divergente
          ? `l'hôte et ${divergente} ne déclarent pas les mêmes corps périmés`
          : perimesHote === '' ? 'aucun corps déclaré périmé (`declarerCorpsPerime`)' : null,
      )
      if (rougePrincipal) continue
      const lues = fusionnerLectures(dossier)
      // Un chemin lu hors racine sort de la mesure : dit ici, il cesse d'être indiscernable d'une
      // absence de lecture (un générateur dont les sources vivent derrière une jonction, par exemple).
      if (lues.cheminsRejetes > 0) {
        process.stdout.write(`docs:build — ${g.script} : ${lues.cheminsRejetes} chemin(s) lu(s) hors racine, écarté(s) de la mesure.\n`)
      }
      const aveugle = refusSourcesInsuffisantes(g.script, lues.fichiers.length, lues.cheminsRejetes)
      if (aveugle) {
        if (!check) {
          process.stderr.write(`${aveugle}\n`)
          return 1
        }
        refuser(aveugle)
        continue
      }
      const ecritesAuMemeRangOuPlusTard = new Map(
        generateurs.flatMap((autre, r) => (r >= rang ? cibles.get(autre.script).ecrites.map((c) => [c, autre.script]) : [])),
      )
      const lectureTardive = lues.fichiers.find((source) => ecritesAuMemeRangOuPlusTard.has(source))
      if (lectureTardive) {
        const message = `docs:build — ARRÊT sur ${g.script} : lit « ${lectureTardive} », que ${ecritesAuMemeRangOuPlusTard.get(lectureTardive)} écrit au même rang ou plus tard — cette source serait périmée.`
        if (!check) {
          process.stderr.write(`${message}\n`)
          return 1
        }
        refuser(message)
        continue
      }
      parGenerateur[g.script] = { cibles: signees, fichiers: lues.fichiers, dossiers: [...lues.dossiers.keys()] }
      const { empreinte } = empreinteDuDisque(cwd, lues, ignores)
      if (check) {
        // Un doc est à jour quand son CORPS **et** son PIED le sont. `run` vient de juger le corps ;
        // le pied se juge ici contre l'empreinte des sources telles que le DISQUE les porte — le MÊME
        // calcul que la pose du pied ci-dessous. C'est le verdict que rend `--empreinte`.
        for (const cible of signees) {
          const chemin = path.join(cwd, cible)
          if (!existeFichier(chemin)) continue
          const raison = verdictDuPied({ pied: lirePied(readFileSync(chemin, 'utf8')), empreinte, cible })
          if (raison) refuser(`docs:check — ${g.script} — ${raison} — npm run docs:build`, { guerit: true })
        }
        continue
      }
      // Le pied se pose AVANT le générateur suivant : un doc signé plus tard serait lu SANS son pied par
      // les suivants, et leur empreinte suivrait la génération PRÉCÉDENTE — mesuré sur `coverage.mjs`,
      // qui lit les `catalogue-*.md` que `build-catalogs.mjs` signe.
      const pied = { empreinte, fichiers: lues.fichiers.length, dossiers: lues.dossiers.size }
      for (const cible of signees) {
        const chemin = path.join(cwd, cible)
        if (existeFichier(chemin)) writeFileSync(chemin, avecPied(readFileSync(chemin, 'utf8'), pied))
      }
    }
    if (!check) {
      const nonSignees = ciblesNonSignees(cwd, parGenerateur)
      if (nonSignees.length) {
        process.stderr.write(
          `docs:build — ARRÊT : ${nonSignees.length} cible(s) SANS pied « sources-empreinte », donc jugée(s) par rien :\n${nonSignees.map((c) => `  ${c}`).join('\n')}\n`,
        )
        return 1
      }
      writeFileSync(path.join(cwd, SOURCES_LUES), serialiserSourcesLues(parGenerateur))
      console.log(`${SOURCES_LUES} — ${Object.keys(parGenerateur).length} générateur(s) mesuré(s).`)
      return 0
    }
    // Les vérificateurs purs : ils n'écrivent rien, leur code de sortie est leur verdict.
    const verificateursJoues = verificateurs.filter((script) => !seulement || seulement.has(script))
    for (const script of verificateursJoues) {
      try {
        execFileResilient(process.execPath, [script], {
          cwd,
          env: envIsole(process.env, binLocal(cwd)),
          ...sortiesDe(quiet),
        }, { site: `build-all/${script}` })
      } catch (e) {
        transmettreDiagnostic(e, quiet)
        refuser(`docs:check — ${script} — ${natureDuRouge(issueDe(e))}`)
      }
    }
    const mesure = { ...lireSourcesLues(cwd), ...parGenerateur }
    const rendu = serialiserSourcesLues(mesure)
    let actuel
    try { actuel = readFileSync(path.join(cwd, SOURCES_LUES), 'utf8') } catch { actuel = null }
    if (actuel !== rendu) {
      process.stderr.write(diagnosticSourcesLues(actuel, rendu, mesure))
      refuser(`docs:check — ${SOURCES_LUES} est PÉRIMÉ (les sources MESURÉES d'au moins un générateur ont changé) — npm run docs:build`, { guerit: true })
    }
    // `docs:build` écrit le rendu de l'HÔTE : un corps périmé, rendu sur l'hôte ou sous une autre
    // plateforme, n'y guérit que si l'hôte l'a DÉCLARÉ (`declarerCorpsPerime`) et que chaque plateforme
    // déclare les MÊMES corps périmés que lui. Une sortie 2 sans corps déclaré ne prouve rien.
    for (const { script, issue, plateforme } of rouges) {
      const raison = guerissable(issue) ? nonGueri.get(script) : null
      refus.push({
        message: `docs:check — ${script}${plateforme ? ` — rendu sous ${plateforme}` : ''} — ${natureDuRouge(issue)}${raison ? ` : ${raison}, \`docs:build\` ne le guérit pas` : ''}`,
        guerit: guerissable(issue) && !raison,
      })
    }
    if (refus.length) {
      process.stderr.write(`${ENTETE_ROUGES} (${refus.length}) :\n${refus.map((r) => `  ${r.message}`).join('\n')}\n`)
      return refus.every((r) => r.guerit) ? CODE_CORPS_PERIME : 1
    }
    console.log(
      `docs:check — OK (${SOURCES_LUES} à jour, ${Object.keys(parGenerateur).length} générateur(s) rejoué(s) sous ${[hote, ...enPlus].join(' + ')}, ${sautes} frais, ${verificateursJoues.length} vérificateur(s))`,
    )
    return 0
  } finally {
    rmSync(racineLectures, { recursive: true, force: true })
  }
}

async function main() {
  const cwd = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim()
  process.exitCode = await executer({ cwd })
}

if (import.meta.main) main()
