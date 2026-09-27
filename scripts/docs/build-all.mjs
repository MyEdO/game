// scripts/docs/build-all.mjs — régénère TOUS les docs dérivés (`npm run docs:build`).
// SOURCE UNIQUE de la liste des générateurs : `GENERATORS`. `npm run docs:check` chaîne les MÊMES
// scripts en `--check` (plus des vérificateurs purs, qui n'écrivent rien) ; la garde
// scripts/git-hooks/merge-docs.test.mjs refuse toute dérive entre les deux listes.
// Une cible n'est pas toujours un `docs/*.md` ÉCRIT EN ENTIER : `build-implemente.mjs` injecte un
// champ dans les fiches raw — il déclare `targets: []` et se joue comme les autres.
// Ordre motivé : les rapports d'Atlas LISENT les fiches docs/raw (coverage.mjs:309, reconcile.mjs:54,
// reanchor.mjs:207), ils passent donc APRÈS build-catalogs/build-implemente qui les écrivent. C'est
// cet ordre qui autorise une source elle-même GÉNÉRÉE : une source écrite par un générateur PLUS TARD
// dans la liste serait lue périmée, et se fait refuser par nom.
//
// EMPREINTE DE SOURCES (#1679 L1b) — chaîne complète, aucun maillon écrit à la main :
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
// Cinq générateurs étaient AVEUGLES à toute mesure naïve, mesuré 2026-09-02 : les trois `runner: 'tsx'`
// (`tsx/dist/cli.mjs` RE-SPAWNE un processus — ils sont lancés ici par `node --import tsx/esm`) et les
// deux qui appelaient `npx tsx <dumper>` (`build-donnees.mjs`, `build-codex-relations.mjs`, passés à
// `resoudreOutilLocal` + `envIsole`, qui transmettent l'env).
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path, { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { binLocal, envIsole, resoudreOutilLocal } from '../lancer-local.mjs'
import { correspondGlob, listerArbre, listerDossier } from '../guards/lib/lister.mjs'
import { MOTIF_CATALOGUES } from '../raw/gate-catalogues.mjs'
import { execFileResilient } from '../guards/lib/spawnResilient.mjs'
import {
  avecPied, deltaSourcesLues, empreinteDeLIndex, empreinteDuDisque, existeFichier, fusionnerLectures,
  hashBlobDisque, indexGit, lirePied, motifDeRejeu, serialiserSourcesLues, sha1Corps,
} from './lib/empreinte-sources.mjs'
import { ignoresGit } from './lib/chemin-mesure.mjs'

/** `{ runner, script, targets, injecte, check }` — `runner` = 'node' | 'tsx' ; `targets` = docs ÉCRITS
 *  EN ENTIER (glob toléré, cf. la garde de taxonomie de scripts/git-hooks/merge-docs.test.mjs), et
 *  seuls eux reçoivent le pied « sources-empreinte » ; `injecte` = fichiers dont le générateur ne
 *  réécrit QU'UN BLOC (il les relit, ils ne sont donc pas ses sources) ;
 *  `check: false` = pas de mode `--check` (le script écrit toujours) : `--check` ne le JOUE pas, mais
 *  il confronte le PIED de ses cibles à l'index (`piedsDesNonVerifiables`, #1773) — sans quoi leur
 *  péremption n'était dite que par la gate `docs:empreinte`, 7 min plus tard dans `ops:publier`.
 *  Ordre = ordre d'exécution. */
export const GENERATORS = [
  { runner: 'node', script: 'scripts/raw/build-atlas-index.mjs', targets: [], injecte: ['docs/raw/**/00-index.md'] },
  { runner: 'node', script: 'scripts/raw/build-catalogs.mjs', targets: [MOTIF_CATALOGUES], check: false },
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
  // Rapports 100 % dérivés de l'Atlas : le .md est écrit AVANT la porte de régression (reanchor.mjs
  // l.343 puis l.354+), donc `docs:build` régénère le fichier ET laisse remonter l'exit 1.
  { runner: 'node', script: 'scripts/raw/coverage.mjs', targets: ['docs/raw/coverage.md'], check: false },
  { runner: 'node', script: 'scripts/raw/reconcile.mjs', targets: ['docs/raw/reconciliation.md'], check: false },
  { runner: 'node', script: 'scripts/raw/reanchor.mjs', targets: ['docs/raw/reanchor.md'], check: false },
]

/** Étapes de `docs:check` qui ne GÉNÈRENT rien (vérificateurs purs, sans `--check`) — déclarées
 *  ici pour que la chaîne npm reste dérivable d'UNE source. */
export const NON_GENERATOR_CHECKS = [
  'scripts/docs/check-doc-refs.mjs',
  'scripts/docs/check-plans-anchors.mjs',
  'scripts/raw/check-atlas-counts.mjs',
  'scripts/data/check-progression-schemas.mjs',
]

/** Scripts que `docs:check` passe en `--check` (source unique : ceux qui SAVENT vérifier). */
export const checkedScripts = () => new Set(GENERATORS.filter((g) => g.check !== false).map((g) => g.script))

/** Chemin du dérivé qui porte les sets MESURÉS, un par générateur. */
export const SOURCES_LUES = 'docs/.sources-lues.json'

const ENREGISTREUR = pathToFileURL(fileURLToPath(new URL('lib/enregistreur-lectures.mjs', import.meta.url))).href

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
    process.exit(2)
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

function run({ runner, script }, { cwd, quiet, check, tsxEsm, lectures, ignores, cibles }) {
  const args = [
    ...(runner === 'tsx' ? ['--import', pathToFileURL(tsxEsm).href] : []),
    script,
    ...(check ? ['--check'] : []),
  ]
  const env = envIsole(process.env, binLocal(cwd))
  if (lectures) {
    env.NODE_OPTIONS = `${env.NODE_OPTIONS ?? ''} --import ${ENREGISTREUR}`.trim()
    env.WFRP_LECTURES_RACINE = cwd
    env.WFRP_LECTURES_SORTIE = path.join(lectures, 'l')
    env.WFRP_LECTURES_IGNORES = ignores
    env.WFRP_LECTURES_CIBLE = cibles.join(',')
  }
  // Rejeu si le processus n'a pas DÉMARRÉ : sous quatre lanes de gates, le loader Windows a refusé
  // d'initialiser `build-implemente.mjs` (3221225794) et `docs:check` est sorti ROUGE en 48,6 s sur
  // un arbre sain (mesuré le 2026-09-04). Tout autre code reste un vrai verdict.
  execFileResilient(process.execPath, args, {
    cwd,
    env,
    stdio: quiet ? ['ignore', 'ignore', 'pipe'] : 'inherit',
  }, { site: `build-all/${script}` })
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

/**
 * Cible → générateur qui la SIGNE. Un doc écrit en entier n'a qu'un auteur : deux pieds sur le même
 * fichier seraient contradictoires, et le second effacerait le premier. REND aussi les doublons.
 */
export function proprietairesDeCibles(cwd) {
  const par = new Map()
  const doublons = []
  for (const g of GENERATORS)
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
 * Le refus que porte le PIED d'une cible TELLE QUE L'INDEX LA PORTE, ou `null` — UNE rédaction pour
 * la classe, partagée par `--empreinte` (`verifierEmpreintes`) et par le jugement des cibles
 * `check: false` (`piedsDesNonVerifiables`). `juge` dit si un pied a pu être confronté : une cible que
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
    if (g.check === false) continue
    const entree = lues[g.script]
    if (!entree) {
      motifs.set(g.script, `jamais mesuré dans ${SOURCES_LUES}`)
      continue
    }
    const cibles = ciblesSurDisque(g.targets, cwd)
    // `targets: []` — il n'écrit qu'un BLOC d'un fichier manuscrit, qu'aucun pied ne peut signer :
    // rien n'est jugeable, donc il est toujours rejoué.
    if (!cibles.length) {
      motifs.set(g.script, 'aucune cible signée (il n’injecte qu’un bloc) : rien à juger frais')
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
 * Pieds des cibles que `--check` ne peut PAS juger en rejouant leur générateur : celles déclarées
 * `check: false` dans `GENERATORS` (leur script écrit toujours, il n'a pas de mode de vérification).
 * Le pied reste jugeable, lui, et par le MÊME calcul que `--empreinte` (`refusDuPiedAuCommit`).
 * Sans cela, l'étape docs de `ops:publier` sortait VERTE (`--check` vert) sur un `reconciliation.md`
 * périmé, et la gate `docs:empreinte` refusait 7 min plus tard (#1773) ; désormais son `--check` rouge
 * déclenche la passe COMPLÈTE, qui re-signe. REND les messages de refus, chacun NOMMANT sa cible.
 * Les cibles sont celles que la MESURE porte (`entree.cibles`, globs déjà résolus), comme `--empreinte`.
 */
export function piedsDesNonVerifiables(cwd, blobs, lues, generateurs = GENERATORS) {
  const refus = []
  for (const g of generateurs) {
    if (g.check !== false) continue
    const entree = lues[g.script]
    if (!entree) {
      refus.push(`docs:check — ${g.script} — jamais mesuré dans ${SOURCES_LUES} — npm run docs:build`)
      continue
    }
    const { empreinte, manquants } = empreinteDeLIndex(blobs, {
      fichiers: entree.fichiers,
      dossiers: new Map(entree.dossiers.map((d) => [d, []])),
    })
    if (manquants.length) {
      refus.push(`docs:check — ${g.script} — source(s) que l'index ne porte pas : ${manquants.slice(0, 3).join(', ')} — npm run docs:build`)
      continue
    }
    for (const cible of entree.cibles) {
      const verdict = refusDuPiedAuCommit(cwd, empreinte, cible)
      if (verdict.refus) refus.push(`docs:check — ${g.script} — à rejouer : ${verdict.refus}`)
    }
  }
  return refus
}

function main() {
  const quiet = process.argv.includes('--quiet')
  const check = process.argv.includes('--check')
  const tout = process.argv.includes('--tout')
  const cwd = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim()
  const seulement = (() => {
    const i = process.argv.indexOf('--only')
    return i < 0 ? null : new Set(process.argv.slice(i + 1).filter((a) => !a.startsWith('--')))
  })()
  if (process.argv.includes('--empreinte')) process.exit(verifierEmpreintes(cwd, seulement))
  // Refus d'un tsx NON LOCAL avant le premier générateur : à mi-chaîne, docs/ serait à moitié écrit.
  const tsxEsm = GENERATORS.some((g) => g.runner === 'tsx') ? tsxEsmDe(cwd) : null
  const ignores = ignoresGit(cwd)
  const { doublons } = proprietairesDeCibles(cwd)
  if (doublons.length) {
    process.stderr.write(`docs:build — ARRÊT : cible(s) déclarée(s) par DEUX générateurs, le second pied effacerait le premier :\n${doublons.map((d) => `  ${d}`).join('\n')}\n`)
    process.exit(1)
  }
  // `--check` CIBLÉ : un doc dont le pied signe déjà ces sources ET ce corps n'a rien à apprendre
  // d'une régénération — c'est la même comparaison, payée en un hash au lieu d'un générateur.
  // `--tout` la court-circuite : même verdict, coût plein (morsure de déterminisme).
  const frais = new Map()
  // L'INDEX, lu UNE fois : il sert la fraîcheur des générateurs vérifiables ET le pied de ceux qui ne
  // le sont pas.
  const blobs = check ? indexGit(cwd) : null
  if (check && !tout) {
    let surDisque
    try { surDisque = readFileSync(path.join(cwd, SOURCES_LUES), 'utf8') } catch { surDisque = null }
    const complet = motifRejeuComplet(auCommit(cwd, SOURCES_LUES), surDisque)
    if (complet) {
      console.log(`docs:check — REJEU COMPLET : ${complet}.`)
    } else {
      const mesure = fraicheurDesGenerateurs(cwd, blobs, lireSourcesLues(cwd), ignores)
      for (const [script, empreinte] of mesure.frais) frais.set(script, empreinte)
      for (const [script, motif] of mesure.motifs) console.log(`docs:check — ${script} — rejoué : ${motif}`)
    }
  }
  const racineLectures = path.join(cwd, 'node_modules', '.cache', 'lectures-docs', String(process.pid))
  rmSync(racineLectures, { recursive: true, force: true })
  // L'ensemble `ignoresGit`, calculé UNE fois, que chaque processus mesuré relit (#1769).
  const ignoresLectures = path.join(racineLectures, 'ignores.json')
  mkdirSync(racineLectures, { recursive: true })
  writeFileSync(ignoresLectures, JSON.stringify([...ignores]))
  const parGenerateur = {}
  // Les cibles des générateurs `check: false` : leur script n'est pas joué ci-dessous, leur PIED est
  // jugé ici. `--tout` ne le court-circuite pas — c'est un hash, pas une régénération.
  const piedsPerimes = check ? piedsDesNonVerifiables(cwd, blobs, lireSourcesLues(cwd)) : []
  // IMPRIMÉS TOUT DE SUITE : l'exit attend la fin de la boucle, mais un générateur rouge avant elle
  // les emporterait sans les dire, et coûterait un passage de plus pour l'apprendre.
  const dejaDits = piedsPerimes.length
  if (dejaDits) process.stderr.write(`${piedsPerimes.join('\n')}\n`)
  let sautes = 0
  // Fail-fast : un générateur rouge laisse docs/ à moitié régénéré ; enchaîner les suivants
  // fabriquerait un lot incohérent que le hook annoncerait « à committer ».
  for (const [rang, g] of GENERATORS.entries()) {
    // Pas de mode `--check` à jouer (il écrit toujours) : c'est son PIED qui le juge, déjà confronté
    // à l'index au-dessus (`piedsDesNonVerifiables`).
    if (check && g.check === false) continue
    // `--only` ne restreint QUE la vérification : un `docs:build` partiel réécrirait
    // `.sources-lues.json` avec les seuls générateurs joués, et effacerait la mesure des autres.
    if (check && seulement && !seulement.has(g.script)) continue
    if (frais.has(g.script)) {
      sautes += 1
      const corps = sha1Corps(readFileSync(path.join(cwd, ciblesSurDisque(g.targets, cwd)[0]), 'utf8'))
      console.log(
        `docs:check — ${g.script} — frais (sources ${frais.get(g.script).slice(0, 12)}, corps ${corps.slice(0, 12)}), non rejoué`,
      )
      continue
    }
    const dossier = path.join(racineLectures, String(rang))
    mkdirSync(dossier, { recursive: true })
    // Un générateur relit ce qu'il écrit (son .md en `--check`, le fichier où il injecte un champ) :
    // rien de tout cela n'est une de ses sources. Seul un `targets` — un doc écrit EN ENTIER — reçoit
    // le pied : `build-implemente` n'écrit qu'un champ des fiches docs/raw, fichiers manuscrits
    // qu'aucune empreinte ne peut signer.
    const signees = ciblesSurDisque(g.targets, cwd)
    const cibles = [...new Set([...signees, ...ciblesSurDisque(g.injecte ?? [], cwd)])].sort()
    try {
      run(g, { cwd, quiet, check, tsxEsm, lectures: dossier, ignores: ignoresLectures, cibles })
    } catch (e) {
      process.stderr.write(`docs:build — ARRÊT sur ${g.script} (code ${e.status ?? e.message}) : docs/ n'est PAS à jour.\n`)
      process.exit(1)
    }
    const lues = fusionnerLectures(dossier)
    // Un chemin lu hors racine sort de la mesure : dit ici, il cesse d'être indiscernable d'une
    // absence de lecture (un générateur dont les sources vivent derrière une jonction, par exemple).
    if (lues.cheminsRejetes > 0) {
      process.stdout.write(`docs:build — ${g.script} : ${lues.cheminsRejetes} chemin(s) lu(s) hors racine, écarté(s) de la mesure.\n`)
    }
    const aveugle = refusSourcesInsuffisantes(g.script, lues.fichiers.length, lues.cheminsRejetes)
    if (aveugle) {
      process.stderr.write(`${aveugle}
`)
      process.exit(1)
    }
    const ecritesAuMemeRangOuPlusTard = new Map(
      GENERATORS.flatMap((autre, r) => (r >= rang ? ciblesSurDisque(autre.targets, cwd).map((c) => [c, autre.script]) : [])),
    )
    for (const source of lues.fichiers) {
      const producteur = ecritesAuMemeRangOuPlusTard.get(source)
      if (producteur) {
        process.stderr.write(`docs:build — ARRÊT sur ${g.script} : lit « ${source} », que ${producteur} écrit au même rang ou plus tard — cette source serait périmée.\n`)
        process.exit(1)
      }
    }
    parGenerateur[g.script] = { cibles: signees, fichiers: lues.fichiers, dossiers: [...lues.dossiers.keys()] }
    if (check) {
      // Un doc est à jour quand son CORPS **et** son PIED le sont. `run` vient de juger le corps ;
      // le pied se juge ici contre l'empreinte des sources telles que le DISQUE les porte — le MÊME
      // calcul que la pose du pied ci-dessous. C'est le verdict que rend `--empreinte`.
      const { empreinte } = empreinteDuDisque(cwd, lues, ignores)
      for (const cible of signees) {
        const chemin = path.join(cwd, cible)
        if (!existeFichier(chemin)) continue
        const raison = verdictDuPied({ pied: lirePied(readFileSync(chemin, 'utf8')), empreinte, cible })
        if (raison) piedsPerimes.push(`docs:check — ${g.script} — ${raison} — npm run docs:build`)
      }
      continue
    }
    // Le pied se pose AVANT le générateur suivant : un doc signé plus tard serait lu SANS son pied par
    // les suivants, et leur empreinte suivrait la génération PRÉCÉDENTE — mesuré sur `coverage.mjs`,
    // qui lit les `catalogue-*.md` que `build-catalogs.mjs` signe.
    const { empreinte } = empreinteDuDisque(cwd, lues, ignores)
    const pied = { empreinte, fichiers: lues.fichiers.length, dossiers: lues.dossiers.size }
    for (const cible of signees) {
      const chemin = path.join(cwd, cible)
      if (existeFichier(chemin)) writeFileSync(chemin, avecPied(readFileSync(chemin, 'utf8'), pied))
    }
  }
  if (piedsPerimes.length) {
    const restants = piedsPerimes.slice(dejaDits)
    if (restants.length) process.stderr.write(`${restants.join('\n')}\n`)
    process.exit(1)
  }
  const nonSignees = ciblesNonSignees(cwd, parGenerateur)
  if (nonSignees.length) {
    process.stderr.write(
      `docs:build — ARRÊT : ${nonSignees.length} cible(s) SANS pied « sources-empreinte », donc jugée(s) par rien :\n${nonSignees.map((c) => `  ${c}`).join('\n')}\n`,
    )
    process.exit(1)
  }
  const mesure = check ? { ...lireSourcesLues(cwd), ...parGenerateur } : parGenerateur
  const rendu = serialiserSourcesLues(mesure)
  const cheminRendu = path.join(cwd, SOURCES_LUES)
  if (!check) {
    writeFileSync(cheminRendu, rendu)
    console.log(`${SOURCES_LUES} — ${Object.keys(parGenerateur).length} générateur(s) mesuré(s).`)
    return
  }
  let actuel
  try { actuel = readFileSync(cheminRendu, 'utf8') } catch { actuel = null }
  if (actuel !== rendu) {
    process.stderr.write(diagnosticSourcesLues(actuel, rendu, mesure))
    process.stderr.write(`docs:check — ${SOURCES_LUES} est PÉRIMÉ (les sources MESURÉES d'au moins un générateur ont changé).\n  → relancer \`npm run docs:build\` et committer le résultat.\n`)
    process.exit(1)
  }
  console.log(
    `docs:check — OK (${SOURCES_LUES} à jour, ${Object.keys(parGenerateur).length} générateur(s) rejoué(s), ${sautes} frais)`,
  )
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) main()
