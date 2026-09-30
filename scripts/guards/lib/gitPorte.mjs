// LECTURES GIT DES PORTES — l'hôte UNIQUE de la forme d'union et des commandes git que les portes
// (pre-push, garde de solde, revue de palier, stocks de plage, faits de palier, closer) exécutent.
//
// COMBIEN D'ISSUES A UNE LECTURE GIT ? TROIS, et les confondre a deux ans de conséquences :
//   1. `{ disponible: true, valeur }`      — git a répondu ;
//   2. `{ disponible: true, absent: true }` — l'OBJET demandé n'existe pas (`git show` d'une
//      pre-image de fichier AJOUTÉ rend `128` et `fatal: path 'neuf.txt' exists on disk, but not in
//      <sha>`). C'est le cas NORMAL de la porte de stock : le classer « git en panne » refuse le
//      push d'un fichier neuf ;
//   3. `{ disponible: false, raison }`     — git, le dépôt ou le binaire manquent. Une porte qui
//      juge là-dessus juge sur rien : elle le DIT au lieu de conclure.
// Une union à deux branches ne sait pas dire « absent » ; c'est pour cela qu'elle en a trois.
// Une question les rend sous UNE forme par issue : 1. sa réponse ; 2. `null` (ou `absent`, ou
// `false` pour un prédicat) À LA PLACE de l'objet demandé ; 3. `GitIndisponible` levée, ou confiée à
// `enPanne`. La BORNE d'une question — la révision, l'arbre ou le commit SUR lequel elle se pose —
// n'est pas l'objet demandé : une borne absente LÈVE `BorneAbsente` (faute de l'appelant), sauf pour
// une question dont la signature porte `null` pour elle (`shaDe`, `shasDe`, `journalDe`, `combienDe`,
// `divergenceDe`, `baseCommune`, `estAncetre`). Une collection (`ceQuiChange`, `listerImage`,
// `lireEnLot`, `ceQueFaitLeCommit`, `fichiersDuGrep` sur une ref) n'a pas de `null` : vide, elle dirait
// « rien » d'un objet qui n'existe pas. Une borne NOMMÉE dont l'objet MANQUE n'est pas absente : le
// dépôt est corrompu, et c'est l'issue 3 (`corrompu`, #1806).
// Le DISQUE, l'hôte le lit par `natureDuChemin` (`statSync`), et par elle ses deux lectures d'ÉTAT
// GIT hors commande git — la fusion en cours (`MERGE_HEAD`, `fusionnesEnCours`, `readFileSync`) et
// le rebase entamé (`rebaseEntame`) — qui passent par `tenter` et `confier` : mêmes trois issues.
//
// `status ≠ 0` avec un stderr VIDE n'est pas un échec : c'est la réponse des PRÉDICATS de git
// (`merge-base --is-ancestor`, `rev-parse --verify --quiet`, `grep`), qui répondent par leur code de
// sortie. Ceux-là rendent un `fait` porteur du code.
//
// LE SPAWN QUI N'A PAS DÉMARRÉ (`STATUS_DLL_INIT_FAILED`) est REJOUÉ par les primitives de
// `spawnResilient.mjs` — il n'y a pas deux politiques de rejeu dans ce dépôt. `execFileResilient`
// n'est pas composable ici : il JETTE, donc il perd le `status` et le `stderr` dont l'union à trois
// issues a besoin pour distinguer 2. de 3. ; ce sont ses primitives qui sont composées.
//
// UNE QUESTION PAR LECTEUR, UN ÉCRIVAIN PAR GESTE (#1806, juge du lot #85, Q7 et H2 point 5) :
// l'appelant tient un DÉPÔT (`depotDe`) et pose une question (`shaDe`, `ceQuiChange`, `journalDe`…)
// ou joue un geste (`commitDe`, `pousser`…) ; la sous-commande, ses drapeaux et sa forme restent ici.
// Une question épingle `OPTIONS_DE_L_HOTE` ; un écrivain ne pose rien, la configuration de
// l'utilisateur (identité, signature, proxy, identifiants) fait foi.
import { Buffer } from 'node:buffer'
import { spawnSync } from 'node:child_process'
import { readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { normaliserRacine } from '../../port-dev.mjs'
import { BACKOFFS_MS, MARQUE_REJEU, attendreSync, estEchecDeChargement, rejeux } from './spawnResilient.mjs'
import { coupeAuMot } from '../../../src/lib/coupeAuMot.mjs'
import { DEPOT } from './ticketsGh.mjs'

/** Une `raison` est coupée au mot vers `RAISON_MAX` (`coupeAuMot`) : elle est DITE dans un refus de hook, une fois. */
const RAISON_MAX = 200

/** git a répondu. @param {*} valeur */
export const fait = (valeur) => ({ disponible: true, valeur })

/** L'objet demandé n'existe pas — un fait, pas une panne. */
const absent = () => ({ disponible: true, absent: true })

/** Ni git, ni le dépôt, ni le réseau : rien n'a été mesuré. */
export const indisponible = (raison) => ({ disponible: false, raison: raisonCourte(raison) })

/** L'indisponibilité, JETÉE — la seule façon pour un prédicat BOOLÉEN de ne pas répondre « non »
 *  quand il n'a rien lu. Se rattrape par son type, et l'appelant NOMME ce qu'il ne peut pas juger. */
export class GitIndisponible extends Error {
  constructor(raison) {
    super(`git indisponible : ${raison}`)
    this.name = 'GitIndisponible'
    this.raison = raison
  }
}

/** Une BORNE de question (révision, arbre, commit) qu'aucun objet du dépôt ne porte : une faute de
 *  l'appelant, NOMMÉE (en-tête, « La BORNE d'une question »). */
export class BorneAbsente extends Error {
  constructor(question, bornes) {
    super(`${question} : borne absente du dépôt — ${bornes.join(', ')}`)
    this.name = 'BorneAbsente'
    this.bornes = bornes
  }
}

/**
 * Première ligne SIGNIFICATIVE d'une sortie d'erreur, coupée au mot vers `RAISON_MAX` (`coupeAuMot`). PURE.
 * @param {string} brut @returns {string}
 */
export function raisonCourte(brut) {
  const ligne = String(brut ?? '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find(Boolean) ?? 'raison non dite'
  return coupeAuMot(ligne, RAISON_MAX)
}

/**
 * Ce que git écrit quand l'OBJET demandé n'existe pas. Une seule liste, ici, testée contre git RÉEL
 * (`gitPorte.test.mjs`, dépôt jetable) : une seconde liste ailleurs re-classerait le cas normal de la
 * porte de stock en panne de dépôt.
 */
const MOTIFS_ABSENT = [
  /does not exist/i,
  /exists on disk, but not in/i,
  /Not a valid commit name/i,
  /Not a valid object name/i,
  /bad object/i,
  /bad revision/i,
  /Invalid revision range/i,
  /unknown revision or path not in the working tree/i,
  /ambiguous argument/i,
  /no such path/i,
  /No such remote/i,
  /not a tree object/i,
  /Invalid symmetric difference expression/i,
  /unable to parse object/i,
]

/** `true` si ce stderr dit « l'objet demandé n'existe pas ». PUR. */
const ditAbsent = (stderr) => MOTIFS_ABSENT.some((re) => re.test(String(stderr ?? '')))

/**
 * Un fait qui peut manquer : sa valeur OU sa raison d'absence, jamais un silence. Enveloppe les
 * lectures qui JETTENT (fs, sous-processus de mesure) dans la même union que les lectures git.
 */
export function tenter(fn) {
  try {
    return fait(fn())
  } catch (e) {
    const sortie = [e.stdout, e.stderr].filter(Boolean).map(String).join('\n').trim()
    return { disponible: false, raison: `${e.message}${sortie ? ` — ${sortie.slice(0, 4000)}` : ''}` }
  }
}

/** Lancement avec rejeu du processus qui n'a pas démarré. `spawn`/`attendre` injectables (mesure).
 *  `env` : l'environnement du processus (`envDeDepotForge`, `depotGabarit.mjs`), celui du parent par défaut. */
function lancer(commande, args, { cwd, spawn = spawnSync, attendre = attendreSync, site = 'gitPorte', journal = process.stderr, timeout, entree, env } = {}) {
  for (let essai = 0; ; essai += 1) {
    const stdio = [entree === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe']
    const vu = spawn(commande, args, { cwd, env, encoding: 'utf8', maxBuffer: 1 << 28, stdio, timeout, input: entree })
    if (!estEchecDeChargement(vu?.status) || essai >= BACKOFFS_MS.length) return vu
    rejeux.total += 1
    journal.write(`${MARQUE_REJEU} : ${site} — ${commande} (essai ${essai + 2}/${BACKOFFS_MS.length + 1})\n`)
    attendre(BACKOFFS_MS[essai])
  }
}

/**
 * Ce qu'un chemin EST pour un `cwd` de sous-processus : `'repertoire'`, `'fichier'` (tout nœud qui
 * n'est pas un répertoire) ou `'absent'`. SOURCE UNIQUE de la question « ce chemin peut-il servir de
 * cwd ? » — les portes n'en tiennent pas une seconde définition (un `existsSync` répondait « oui »
 * pour un FICHIER, dont le spawn rend pourtant ENOENT/ENOTDIR).
 * @param {string} chemin @returns {'repertoire'|'fichier'|'absent'}
 */
export function natureDuChemin(chemin) {
  const vu = statSync(chemin, { throwIfNoEntry: false })
  if (!vu) return 'absent'
  return vu.isDirectory() ? 'repertoire' : 'fichier'
}

/** `true` si `chemin` est un RÉPERTOIRE existant — le seul chemin utilisable comme `cwd`. */
export const estRepertoire = (chemin) => natureDuChemin(chemin) === 'repertoire'

/**
 * Un SPAWN QUI N'A PAS DÉMARRÉ (`error` posé, `status` nul) : TROIS causes, que le message de node
 * confond — le `cwd` demandé est absent du disque (cible d'un `git worktree add`, que git crée
 * lui-même ; chemin porteur d'une variable non expansée), il existe sans être un répertoire, ou le
 * binaire git manque au PATH.
 *
 * LE VERDICT PART DE LA NATURE DU `cwd`, JAMAIS DU CODE D'ERREUR : un cwd-FICHIER rend
 * `spawnSync git ENOENT` sur Windows et `spawnSync git ENOTDIR` sur POSIX (mesuré sur la CI Linux,
 * run 34815975288, #1729) — classer sur `ENOENT` seul rendait le message brut sur l'un des deux.
 * « git introuvable » ne se dit donc que si le `cwd` est un RÉPERTOIRE existant : là, il ne reste que
 * le binaire. Sans cette sonde, une porte renvoie « rejouer depuis un arbre où git répond » alors que
 * git répondait, et que c'est le répertoire qui manquait.
 * @param {string} message @param {string|undefined} cwd @param {(p:string)=>'repertoire'|'fichier'|'absent'} nature
 */
function raisonDuSpawn(message, cwd, nature) {
  if (!cwd) return message
  const quoi = nature(cwd)
  if (quoi === 'absent') return `cwd inexistant : ${cwd}`
  if (quoi === 'fichier') return `cwd qui n'est pas un répertoire : ${cwd}`
  // Le cwd est un répertoire réel : le démarrage n'a pu échouer que sur l'EXÉCUTABLE. Toute autre
  // erreur de spawn (permissions, limites) garde son message, qui la nomme déjà.
  return /ENOENT|ENOTDIR/.test(message) ? `git introuvable (binaire absent du PATH) — ${message}` : message
}

/**
 * Classement d'un résultat de `spawnSync` en union à trois issues. PURE hors la SONDE du `cwd`
 * (injectable par `nature`), qui distingue les trois causes d'un spawn qui n'a pas démarré.
 * @param {{cwd?:string, nature?:(p:string)=>'repertoire'|'fichier'|'absent'}} [opts]
 * @returns {{disponible:true, valeur:{status:number, stdout:string, stderr:string}}
 *   | {disponible:true, absent:true} | {disponible:false, raison:string}}
 */
export function classer(vu, { cwd, nature = natureDuChemin } = {}) {
  if (!vu) return indisponible('aucun résultat de processus')
  if (vu.error) return indisponible(raisonDuSpawn(vu.error.message, cwd, nature))
  if (vu.signal) return indisponible(`processus tué par le signal ${vu.signal}`)
  const stderr = String(vu.stderr ?? '')
  const stdout = String(vu.stdout ?? '')
  if (vu.status === 0) return fait({ status: 0, stdout, stderr })
  if (ditAbsent(stderr)) return absent()
  if (!stderr.trim()) return fait({ status: vu.status, stdout, stderr })
  return indisponible(stderr)
}

/**
 * La configuration que la PLOMBERIE de l'hôte lit encore, épinglée sur toute commande : une liste
 * FERMÉE, un réglage par ligne. Un réglage lu par une porcelaine n'entre pas ici : le lecteur qui le
 * subit passe en plomberie, ou pose le drapeau qui prime (#1806).
 */
export const OPTIONS_DE_L_HOTE = Object.freeze([
  '-c', 'core.quotePath=false', // git help config, core.quotePath : en-têtes d'un patch `diff-tree -p` / `diff-index -p`
  '-c', 'merge.conflictStyle=merge', // git help config, merge.conflictStyle : l'arbre de `merge-tree` (baseDuCommit)
  '-c', 'i18n.logOutputEncoding=UTF-8', // git help config, i18n.logOutputEncoding : `rev-list --format` (journalDe)
])

/** @typedef {Readonly<{ cwd: string, [MARQUE_DEPOT]: true }>} Depot */

/** La marque d'une poignée `depotDe` : un `{ cwd }` écrit à la main n'est pas un `Depot`. */
const MARQUE_DEPOT = Symbol('Depot')

/** L'état de chaque DÉPÔT (`depotDe`), privé : son lanceur, et la version de git lue une fois
 *  (`exigerMergeTree`). L'appelant d'une question ne tient jamais git. */
const lanceurs = new WeakMap()

/**
 * Le DÉPÔT git de `cwd` : une poignée OPAQUE que chaque question et chaque écrivain de l'hôte prend
 * en premier paramètre ; la commande, ses drapeaux et sa forme restent à l'hôte. `env` : l'environnement
 * du processus (`envDeDepotForge`, `depotGabarit.mjs`), celui du parent par défaut ; `spawn`/`attendre` :
 * injectables (mesure) ; `enPanne(raison)` : sans lui, une INDISPONIBILITÉ JETTE (`GitIndisponible`),
 * avec lui la lecture la lui confie et rend `null`.
 * @param {string} cwd
 * @param {{ env?: NodeJS.ProcessEnv, spawn?: Function, attendre?: Function, enPanne?: (raison: string) => void }} [opts]
 * @returns {Depot}
 */
export function depotDe(cwd, { env, spawn, attendre, enPanne } = {}) {
  /** @type {Depot} */
  const depot = Object.freeze({ cwd, [MARQUE_DEPOT]: /** @type {true} */ (true) })
  lanceurs.set(depot, { cwd, env, spawn, attendre, enPanne, version: undefined })
  return depot
}

function lanceurDe(depot) {
  const lanceur = lanceurs.get(depot)
  if (!lanceur) throw new TypeError('gitPorte : un dépôt se construit par `depotDe(cwd)`')
  return lanceur
}

/** `git <args>` dans le dépôt, en union à trois issues. `options` : `OPTIONS_DE_L_HOTE` pour une
 *  lecture, `[]` pour un écrivain, qui garde la configuration de l'utilisateur. */
function interroger(depot, args, { entree, timeout, options = OPTIONS_DE_L_HOTE } = {}) {
  const { cwd, env, spawn, attendre } = lanceurDe(depot)
  return classer(lancer('git', [...options, ...args], { cwd, env, spawn, attendre, entree, timeout, site: `git ${args[0]}` }), { cwd })
}

/** La sortie d'une lecture réussie, `null` si l'objet est absent ou si le code de sortie n'est pas 0.
 *  C'est le contrat qu'attendent les lecteurs d'image (`lirePostImage?: (chemin) => string | null`).
 *  `indisponible` n'a PAS de repli : `lire` le confie à `enPanne`, ou le JETTE. */
const sortieOuNull = (union) =>
  union.disponible && !union.absent && union.valeur.status === 0 ? union.valeur.stdout : null

/** Une INDISPONIBILITÉ de lecture : confiée à `enPanne`, qui fait rendre `null`, sinon JETÉE. */
function confier(depot, raison) {
  const { enPanne } = lanceurDe(depot)
  if (!enPanne) throw new GitIndisponible(raison)
  enPanne(raison)
  return null
}

/** La sortie d'une LECTURE (`sortieOuNull`) ; une indisponibilité va à `confier`. */
function lire(depot, args, opts) {
  const vu = interroger(depot, args, opts)
  return vu.disponible ? sortieOuNull(vu) : confier(depot, vu.raison)
}

/** Une ÉCRITURE de l'hôte, en union : sans `OPTIONS_DE_L_HOTE`, la configuration de l'utilisateur
 *  (identité, signature, proxy, identifiants) fait foi. */
const ecrire = (depot, args, { timeout, entree } = {}) => interroger(depot, args, { entree, timeout, options: [] })

/** Marques des images qui ne sont pas des refs : l'index, l'arbre de travail des chemins suivis
 *  présents sur le disque (`git commit -a`, `git commit -h` : « commit all changed files », un suivi
 *  supprimé du disque est supprimé), et l'arbre de travail entier, non-suivis compris. */
export const INDEX = ':index'
export const SUIVI = ':suivi'
export const TRAVAIL = ':travail'

/** Les enregistrements que rend `git <args>` sous `-z`, séparés par NUL : l'UNIQUE découpe d'une
 *  sortie de git des portes. `-z` suit la sous-commande. `borne` (`[question, revisions, type]`,
 *  `bornesDe`) : une réponse nulle est jugée contre elle, et une borne absente LÈVE au lieu de rendre
 *  « aucun enregistrement ». */
function enregistrementsDe(depot, [sousCommande, ...reste], borne) {
  const brut = lire(depot, [sousCommande, '-z', ...reste])
  if (brut === null && borne) bornesDe(depot, ...borne)
  return (brut ?? '').split('\0').filter(Boolean)
}

/**
 * `git <args> --numstat` en entrées `{ plus, moins, chemins }` : `chemins` porte le chemin, ou les
 * deux bouts d'un renommage (`<plus>\t<moins>\t` puis ancien, nouveau), tabulations comprises.
 * `plus`/`moins` valent `null` pour un binaire (`-`).
 * @param {Depot} depot @param {string[]} args @param {Parameters<typeof bornesDe>[1]} [borne] `enregistrementsDe`
 * @returns {{ plus: number | null, moins: number | null, chemins: string[] }[]}
 */
function numstatDe(depot, args, borne) {
  const champs = enregistrementsDe(depot, args, borne)
  const entrees = []
  for (let i = 0; i < champs.length; i += 1) {
    const [plus, moins, ...reste] = champs[i].split('\t')
    const chemin = reste.join('\t')
    const chemins = chemin ? [chemin] : [champs[i + 1], champs[i + 2]]
    if (!chemin) i += 2
    const nombre = (n) => (n === '-' ? null : Number(n))
    entrees.push({ plus: nombre(plus), moins: nombre(moins), chemins })
  }
  return entrees
}

/** Le nombre de champs, type compris, qui précèdent le chemin dans un enregistrement `git status
 *  --porcelain=v2`, par type d'entrée (`git help status`, « Porcelain Format Version 2 »). */
const CHAMPS_V2 = Object.freeze({ 1: 8, 2: 9, u: 10 })

/**
 * L'ÉTAT DE L'ARBRE DE TRAVAIL en entrées `{ etat, chemins }` : `etat` = les deux colonnes `XY`
 * (index, arbre ; espace = inchangé, `??` = non suivi, `git help status`), `chemins` = le chemin, ou
 * le nouveau puis l'ancien pour une entrée de type 2. `git status` n'a pas de plomberie : le lecteur
 * pose les drapeaux qui priment sur la configuration (`status.showUntrackedFiles`, `status.renames`,
 * `diff.ignoreSubmodules`) et lit l'arbre contre un index RAFRAÎCHI, que `--no-optional-locks` ne
 * réécrit pas (#1806).
 * @param {Depot} depot
 * @returns {{ etat: string, chemins: string[] }[]}
 */
export function etatDeLArbre(depot) {
  const champs = (lire(depot, ['--no-optional-locks', 'status', '--porcelain=v2', '-z', '--untracked-files=all', '--no-renames', '--ignore-submodules=none']) ?? '')
    .split('\0').filter(Boolean)
  const entrees = []
  for (let i = 0; i < champs.length; i += 1) {
    const type = champs[i][0]
    if (type === '?') {
      entrees.push({ etat: '??', chemins: [champs[i].slice(2)] })
      continue
    }
    const n = CHAMPS_V2[type]
    if (!n) throw new Error(`git status --porcelain=v2 illisible : « ${champs[i]} »`)
    const colonnes = champs[i].split(' ')
    const chemins = [colonnes.slice(n).join(' ')]
    if (type === '2') chemins.push(champs[(i += 1)])
    entrees.push({ etat: colonnes[1].replace(/\./g, ' '), chemins })
  }
  return entrees
}

/** Les états `XY` d'un chemin NON FUSIONNÉ (`git help status`, « Short Format »). */
const ETATS_EN_CONFLIT = new Set(['DD', 'AU', 'UD', 'UA', 'DU', 'AA', 'UU'])

/** Les chemins NON FUSIONNÉS de l'arbre (`etatDeLArbre`). @param {Depot} depot @returns {string[]} */
export const cheminsEnConflit = (depot) => etatDeLArbre(depot).filter((e) => ETATS_EN_CONFLIT.has(e.etat)).map((e) => e.chemins[0])

/** Un texte qui porte un caractère de CONTRÔLE (C0 ou DEL) : il ne tient pas sur UNE ligne d'un lot
 *  `cat-file --batch`/`--batch-check`, une requête par ligne (`git help cat-file`, « BATCH OUTPUT »). */
const porteUnControle = (texte) => [...texte].some((c) => c < ' ' || c === '\x7f')

/** Une révision que l'hôte ne pose pas à git (`revisionsDe`). */
const revisionFautive = (r) => typeof r !== 'string' || !r || r.startsWith('-') || porteUnControle(r) || r.includes('@{')

/** Les RÉVISIONS d'une question ou d'un geste (`git help revisions`), et les noms qu'un geste pose en
 *  argument positionnel : ni vides, ni des drapeaux, sans caractère de contrôle (`porteUnControle`,
 *  une ligne de `cat-file --batch-check` par borne, `bornesDe`) ni `@{` (reflog, amont :
 *  `cat-file --batch-check` meurt sur un amont absent et perd les bornes suivantes du lot). */
function revisionsDe(revisions) {
  const faute = revisions.find(revisionFautive)
  if (faute !== undefined || !revisions.length) throw new Error(`plage « ${revisions.join(' ')} » : une révision n'est ni vide ni un drapeau, ni ne porte un caractère de contrôle ou \`@{\``)
  return revisions
}

/**
 * Les BORNES `revisions` d'une `question`, exigées dans le dépôt comme objets de `type` (`<rev>^{type}`,
 * `git help revisions`) par un seul `cat-file --batch-check` : une borne absente LÈVE `BorneAbsente`,
 * sauf un NOM qui se résout vers un objet manquant (`corrompu`). Une indisponibilité suit `lire`
 * (`enPanne`, ou `GitIndisponible`).
 * @param {Depot} depot @param {string} question @param {readonly string[]} revisions
 * @param {'tree' | 'commit'} type @returns {readonly string[]}
 * @throws {BorneAbsente}
 */
function bornesDe(depot, question, revisions, type) {
  revisionsDe(revisions)
  const brut = lire(depot, ['cat-file', '--batch-check'], { entree: revisions.map((r) => `${r}^{${type}}\n`).join('') })
  if (brut === null) return revisions
  const lignes = brut.split('\n')
  const absentes = revisions.filter((_, i) => !new RegExp(`^[0-9a-f]+ ${type} `).test(lignes[i] ?? ''))
  if (absentes.length && !corrompu(depot, absentes)) throw new BorneAbsente(question, absentes)
  return revisions
}

/** Les NOMS aux extrémités d'une révision (`git help revisions` : `^<r>`, `<a>..<b>`, `<a>...<b>`,
 *  `<r>^!`, `<r>^@`, `<r>^-<n>`, `<r>^{<type>}`, `<r>~<n>`, `<r>^<n>`) ; un sha complet ne nomme que
 *  lui-même, il n'en est pas. */
const nomsDe = (revision) => revision.replace(/^\^/, '').split(/\.{2,3}/)
  .map((r) => r.replace(/(?:\^\{[^}]*\}|~\d*|\^(?:\d*|[!@]|-\d*))+$/, ''))
  .filter((r) => r && !/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/.test(r))

/**
 * Une révision lue ABSENTE dont un NOM se résout (`rev-parse --verify --quiet`, sans pelage) vers un
 * objet MANQUANT, vers une étiquette dont la cible pelée MANQUE, ou vers un commit (pelé) dont l'arbre
 * MANQUE (`cat-file --batch-check` de `<sha>`, `<sha>^{}` et `<sha>^{}^{tree}`, `git help revisions`) :
 * le dépôt est CORROMPU, ce n'est pas une absence. La panne suit `confier` ; `false` sinon.
 * @param {Depot} depot @param {readonly string[]} revisions @returns {boolean}
 */
function corrompu(depot, revisions) {
  for (const nom of revisions.flatMap(nomsDe)) {
    const sha = lire(depot, ['rev-parse', '--verify', '--quiet', nom])?.trim()
    if (!sha) continue
    const lot = (lire(depot, ['cat-file', '--batch-check'], { entree: `${sha}\n${sha}^{}\n${sha}^{}^{tree}\n` }) ?? '').split('\n')
    const [objet = '', pele = '', arbre = ''] = lot
    const manque = objet.endsWith(' missing') ? sha
      : pele.endsWith(' missing') ? `${sha}^{}`
        : / commit /.test(pele) && arbre.endsWith(' missing') ? `${sha}^{}^{tree}` : null
    if (!manque) continue
    confier(depot, `dépôt corrompu : ${nom} → ${manque} manquant`)
    return true
  }
  return false
}

/** `null` pour la réponse ABSENTE d'une question sur `revisions`, après `corrompu`. @param {Depot} depot @param {readonly string[]} revisions */
const absentSaufCorrompu = (depot, revisions) => {
  corrompu(depot, revisions)
  return null
}

/** Les filtres de fusion de `shasDe` (`git help rev-list`). */
const FILTRES_DE_FUSIONS = Object.freeze({ toutes: [], seules: ['--merges'], aucune: ['--no-merges'] })

/**
 * Les SHAS des commits de la plage `revisions` (`git help revisions` : `<a>..<b>`, `^<ref>`, `<sha>^!`),
 * du plus ancien au plus récent ; `fusions` : `'seules'` (`--merges`), `'aucune'` (`--no-merges`) ;
 * `chemins` : les seuls commits qui les touchent, sous `--full-history` — sans lui, une fusion
 * TREESAME à un parent cache les commits de l'autre (`git help rev-list`, « History Simplification »).
 * `null` quand git ne rend pas la plage : une plage illisible n'est pas une plage vide.
 * @param {Depot} depot @param {readonly string[]} revisions
 * @param {{ fusions?: 'toutes' | 'seules' | 'aucune', chemins?: readonly string[] }} [opts] @returns {string[] | null}
 */
export function shasDe(depot, revisions, { fusions = 'toutes', chemins = [] } = {}) {
  const filtre = Object.hasOwn(FILTRES_DE_FUSIONS, fusions) ? FILTRES_DE_FUSIONS[fusions] : null
  if (!filtre) throw new Error(`shasDe : fusions « ${fusions} » inconnu`)
  const historique = chemins.length ? ['--full-history'] : []
  const brut = lire(depot, ['rev-list', '--reverse', ...filtre, ...historique, ...revisionsDe(revisions), '--', ...chemins])
  return brut === null ? absentSaufCorrompu(depot, revisions) : brut.split('\n').map((l) => l.trim()).filter(Boolean)
}

/**
 * Les PARENTS de `revision` (`git help revisions`, `<rev>^@`), dans leur ordre ; `null` quand git ne
 * les rend pas.
 * @param {Depot} depot @param {string} revision @returns {string[] | null}
 */
export function parentsDe(depot, revision) {
  const brut = lire(depot, ['rev-parse', `${revisionsDe([revision])[0]}^@`])
  return brut === null ? absentSaufCorrompu(depot, [revision]) : brut.split('\n').map((l) => l.trim()).filter(Boolean)
}

/**
 * Le POINT DE DÉPART de `tete` dans `tronc` : le premier commit de la chaîne des premiers parents de
 * `tete` (`git help rev-list`, `--first-parent`) contenu dans `tronc` — `tete` elle-même quand le
 * tronc la contient. `null` quand git ne le rend pas, ou quand la chaîne n'entre jamais dans le tronc.
 * @param {Depot} depot @param {string} tete @param {string} tronc @returns {string | null}
 */
export function pointDeDepart(depot, tete, tronc) {
  const [t, tr] = revisionsDe([tete, tronc])
  const brut = lire(depot, ['rev-list', '--first-parent', t, `^${tr}`, '--'])
  if (brut === null) return absentSaufCorrompu(depot, [tete, tronc])
  const propres = brut.split('\n').map((l) => l.trim()).filter(Boolean)
  return shaDe(depot, propres.length ? `${propres.at(-1)}^1` : tete)
}

/**
 * La BASE COMMUNE de `a` et `b` (`git merge-base`, le meilleur ancêtre commun), `null` s'il n'y en a
 * pas ou si git ne la rend pas.
 * @param {Depot} depot @param {string} a @param {string} b @returns {string | null}
 */
export const baseCommune = (depot, a, b) => lire(depot, ['merge-base', ...revisionsDe([a, b])])?.trim() || absentSaufCorrompu(depot, [a, b])

/** La date d'un commit par `strftime` (`git help rev-list`, `--date=format:` ; `git help
 *  for-each-ref`, `:format:`), dans le fuseau du commit : `%z` en `±hhmm` sous toute version, là où
 *  `%cI` et `:iso-strict` écrivent `Z` pour UTC depuis git 2.45 (notes de version de git 2.45.0). */
const FORMAT_DE_DATE = 'format:%Y-%m-%dT%H:%M:%S%z'

/** La date ISO 8601 stricte (`±hh:mm`) d'une date lue sous `FORMAT_DE_DATE`. PURE. */
const isoStricte = (date) => date.replace(/([+-]\d{2})(\d{2})$/, '$1:$2')

/**
 * Les commits de la plage `revisions` (`shasDe`), du plus ancien au plus récent, en `{ sha, date,
 * message }` : `date` = la date de commit ISO 8601 stricte (`isoStricte`), `depuis` = `--since` (`git help
 * rev-list`). `rev-list` est la plomberie de `log`, et `--no-commit-header` retire la ligne
 * `commit <sha>` que `--format` lui fait écrire. `null` quand git ne rend pas la plage (`shasDe`).
 * @param {Depot} depot @param {readonly string[]} revisions
 * @param {{ depuis?: string }} [opts]
 * @returns {{ sha: string, date: string, message: string }[] | null}
 */
export function journalDe(depot, revisions, { depuis } = {}) {
  const borne = depuis === undefined ? [] : [`--since=${depuis}`]
  const brut = lire(depot, ['rev-list', '--reverse', '--no-commit-header', ...borne, `--date=${FORMAT_DE_DATE}`, '--format=%H%x1f%cd%x1f%B%x00', ...revisionsDe(revisions), '--'])
  if (brut === null) return absentSaufCorrompu(depot, revisions)
  return brut
    .split('\0').map((e) => e.replace(/^\n/, '')).filter(Boolean).map((e) => {
      const [sha, date = '', ...message] = e.split('\x1f')
      return { sha, date: isoStricte(date), message: message.join('\x1f') }
    })
}

/**
 * Les BRANCHES locales (`for-each-ref refs/heads`) en `{ nom, dernierCommitISO, sha }` : `nom` sans
 * `refs/heads/`, `dernierCommitISO` = la date de commit ISO 8601 stricte de leur tête (`isoStricte`). `null` si git
 * ne les rend pas.
 * @param {Depot} depot @returns {{ nom: string, dernierCommitISO: string, sha: string }[] | null}
 */
export function branchesDe(depot) {
  const brut = lire(depot, ['for-each-ref', `--format=%(refname:short)%00%(committerdate:${FORMAT_DE_DATE})%00%(objectname)`, 'refs/heads'])
  if (brut === null) return null
  return brut.split(/\r?\n/).filter(Boolean).map((ligne) => {
    const [nom, dernierCommitISO, sha] = ligne.split('\0')
    return { nom, dernierCommitISO: isoStricte(dernierCommitISO ?? ''), sha }
  })
}

/**
 * Le NOMBRE de commits de la plage `revisions` (`rev-list --count`), `null` si git ne la rend pas.
 * @param {Depot} depot @param {readonly string[]} revisions @returns {number | null}
 */
export function combienDe(depot, revisions) {
  const brut = lire(depot, ['rev-list', '--count', ...revisionsDe(revisions), '--'])
  return brut === null ? absentSaufCorrompu(depot, revisions) : Number.parseInt(brut.trim(), 10)
}

/**
 * La DIVERGENCE de `b` contre `a` (`rev-list --left-right --count a...b`) : `retard` = les commits
 * de `a` absents de `b`, `avance` = ceux de `b` absents de `a` ; `null` si git ne la rend pas.
 * @param {Depot} depot @param {string} a @param {string} b
 * @returns {{ avance: number, retard: number } | null}
 */
export function divergenceDe(depot, a, b) {
  const brut = lire(depot, ['rev-list', '--left-right', '--count', `${revisionsDe([a, b]).join('...')}`, '--'])
  if (brut === null) return absentSaufCorrompu(depot, [a, b])
  const [retard, avance] = brut.trim().split(/\s+/).map(Number)
  return Number.isInteger(retard) && Number.isInteger(avance) ? { avance, retard } : null
}

/** La première version de git dont `merge-tree --write-tree` lit `--stdin` (notes de version de git 2.40). */
const GIT_MERGE_TREE = Object.freeze([2, 40])

/**
 * Refuse, par `GitIndisponible` NOMMÉE, un git qui ne sait pas `merge-tree --write-tree --stdin` : il
 * rendrait `error: unknown option`, qu'un lecteur à `null` confond avec un objet absent. Sonde de
 * VERSION, pas de capacité : `git version` répond hors de tout dépôt et sans objet, donc sa réponse
 * ne peut dire que la version.
 * @param {Depot} depot
 * @throws {GitIndisponible}
 */
function exigerMergeTree(depot) {
  const etat = lanceurDe(depot)
  if (etat.version === undefined) etat.version = lire(depot, ['version'])
  const brut = etat.version
  const m = /(\d+)\.(\d+)/.exec(String(brut ?? ''))
  const exige = GIT_MERGE_TREE.join('.')
  if (!m) throw new GitIndisponible(`version de git illisible (« ${String(brut ?? '').trim()} ») : git merge-tree --write-tree --stdin exige git ${exige}`)
  const [majeure, mineure] = [Number(m[1]), Number(m[2])]
  if (majeure < GIT_MERGE_TREE[0] || (majeure === GIT_MERGE_TREE[0] && mineure < GIT_MERGE_TREE[1])) {
    throw new GitIndisponible(`git ${majeure}.${mineure} ne sait pas git merge-tree --write-tree --stdin (git ${exige} ou plus) : ce que fait un commit n'est pas lisible`)
  }
}

/** L'ARBRE VIDE du dépôt (`hash-object -t tree`, son format d'objets), `null` si git ne le rend pas :
 *  la base d'une racine, et l'image de départ d'un dépôt sans premier commit.
 *  @param {Depot} depot @returns {string | null} */
export const arbreVide = (depot) => (lire(depot, ['hash-object', '-t', 'tree', '--stdin'], { entree: '' }) ?? '').trim() || null

/** L'IMAGE de HEAD : son commit, ou l'arbre vide dans un dépôt sans premier commit (`arbreVide`) ;
 *  `null` si git ne rend ni l'un ni l'autre. La pré-image d'un commit à venir se lit contre elle.
 *  @param {Depot} depot @returns {string | null} */
export const imageDeHead = (depot) => shaDe(depot, 'HEAD') ?? arbreVide(depot)

/**
 * La BASE du commit `sha` : l'arbre contre lequel il se lit. Son parent ; l'arbre vide pour une
 * racine ; pour une fusion, l'arbre que git aurait fusionné TOUT SEUL depuis ses deux parents, conflits
 * compris, qu'ils aient un ancêtre commun ou non, sans pilote ni attribut (`git --attr-source=<arbre
 * vide> merge-tree --write-tree --stdin --allow-unrelated-histories`, dont la sortie est
 * `<propre>\0<arbre>\0…` et le code 0 même en conflit : git help git, `--attr-source`). `merge-tree`
 * ÉCRIT les objets de cet arbre, jamais une ref : des objets inaccessibles, que `git gc` ramasse. `null` quand `git` ne rend pas la lecture qui la donne : sha inconnu
 * (`rev-list`), arbre vide non rendu (`hash-object`), fusion refusée (`merge-tree`), ou toute
 * indisponibilité qu'un lecteur à `null` rend en `null` au lieu de la lever.
 * @param {Depot} depot @param {string} sha
 * @returns {string | null}
 * @throws {GitIndisponible} fusion à plus de deux parents, ou fusion lue par un git plus ancien que
 *   `GIT_MERGE_TREE` : seule la base d'une fusion demande `merge-tree`. {BorneAbsente} `sha` absent.
 */
function baseDuCommit(depot, sha) {
  const ligne = lire(depot, ['rev-list', '--parents', '-n', '1', ...revisionsDe([sha]), '--'])
  if (ligne === null) {
    bornesDe(depot, 'ceQueFaitLeCommit', [sha], 'commit')
    return null
  }
  const [, ...parents] = ligne.trim().split(/\s+/)
  if (parents.length === 0) return arbreVide(depot)
  if (parents.length === 1) return parents[0]
  if (parents.length > 2) throw new GitIndisponible(`fusion ${sha.slice(0, 9)} à ${parents.length} parents : aucune fusion automatique ne rejoue sa base`)
  exigerMergeTree(depot)
  const vide = arbreVide(depot)
  if (!vide) return null
  const [, arbre] = (lire(depot, ['merge-tree', '--write-tree', '--allow-unrelated-histories', '-z', '--stdin'],
    { entree: `${parents[0]} ${parents[1]}\n`, options: [...OPTIONS_DE_L_HOTE, `--attr-source=${vide}`] }) ?? '').split('\0')
  return arbre || null
}

/** Les lettres de `--diff-filter` (`git help diff-tree`) : le filtre d'une lecture de chemins. */
const FILTRE = /^[ACDMRTUXB]*$/

/**
 * CE QUI CHANGE de l'arbre `avant` (une ref ou un arbre) à l'image `apres` : une ref (`diff-tree -r`),
 * `INDEX` (`diff-index --cached`, ce que le commit emporte) ou `SUIVI` (`diff-index`, l'arbre de
 * travail des chemins suivis). La plomberie seule : aucune configuration de diff de l'utilisateur ne
 * change ce qu'elle rend (#1806). Chemins et renommages se lisent par `--numstat`, qui juge le
 * CONTENU : un fichier de l'arbre dont seules les stats ont bougé n'y est pas.
 *   - `chemins(filtre, pathspecs)` : les chemins touchés, `--no-renames`, `filtre` = lettres de
 *     `--diff-filter` ;
 *   - `numstat(pathspecs)` : `{ plus, moins, chemins }`, un renommage (`-M`) en ses deux bouts ;
 *   - `diff(pathspecs, { renommages })` : le patch `-U0`, `--no-renames` sauf `renommages` ;
 *   - `lirePreImage(chemin)` : le texte de `chemin` dans `avant`, `null` s'il y est absent ;
 *   - `renommages(pathspecs)` : chemin d'`avant` ↦ chemin d'`apres` (`-M`).
 * @param {Depot} depot @param {string} avant
 * @param {string} apres
 * @throws {BorneAbsente} `avant` ou la ref `apres` absents du dépôt, à la construction.
 */
export function ceQuiChange(depot, avant, apres) {
  bornesDe(depot, 'ceQuiChange', apres === INDEX || apres === SUIVI ? [avant] : [avant, apres], 'tree')
  return changeEntre(depot, avant, apres)
}

/** `ceQuiChange` sur des bornes que git vient de rendre (`ceQueFaitLeCommit`, `ceQuEmporteLIndex`) :
 *  les exiger relancerait git pour rien. @param {Depot} depot @param {string} avant @param {string} apres */
function changeEntre(depot, avant, apres) {
  const [commande, ...bornes] = apres === INDEX ? ['diff-index', '--cached', avant]
    : apres === SUIVI ? ['diff-index', avant]
      : ['diff-tree', '-r', avant, apres]
  const lecture = (forme, pathspecs) => [commande, ...forme, ...bornes, '--', ...pathspecs]
  return {
    base: avant,
    chemins: (filtre = '', pathspecs = []) => {
      if (!FILTRE.test(filtre)) throw new Error(`ceQuiChange : filtre « ${filtre} » hors des lettres de --diff-filter`)
      return numstatDe(depot, lecture(['--numstat', '--no-renames', ...(filtre ? [`--diff-filter=${filtre}`] : [])], pathspecs)).map((e) => e.chemins[0])
    },
    numstat: (pathspecs = []) => numstatDe(depot, lecture(['--numstat', '-M'], pathspecs)),
    diff: (pathspecs = [], { renommages = false } = {}) => lire(depot, lecture(['-p', '-U0', renommages ? '-M' : '--no-renames'], pathspecs)) ?? '',
    lirePreImage: (chemin) => lireEnLot(depot, avant, [chemin]).get(chemin) ?? null,
    renommages: (pathspecs = []) => new Map(numstatDe(depot, lecture(['--numstat', '-M', '--diff-filter=R'], pathspecs)).map((e) => e.chemins)),
  }
}

/** Ce qui change d'une base `null` : rien. */
const RIEN = Object.freeze({
  base: null,
  chemins: () => [],
  numstat: () => [],
  diff: () => '',
  lirePreImage: () => null,
  renommages: () => new Map(),
})

/**
 * CE QUE FAIT LE COMMIT `sha` : son APPORT PROPRE, ce qui change de sa BASE (`baseDuCommit`) à lui
 * (`ceQuiChange`). Une fusion propre n'apporte rien ; une résolution ou une retouche apporte ses
 * lignes. L'unique lecture d'un commit POSÉ des portes : fichiers, diff, textes et renommages
 * viennent tous de la même base. Base `null` (les cas de `baseDuCommit`) : tout est vide.
 * @param {Depot} depot @param {string} sha
 * @throws {GitIndisponible} propagée de `baseDuCommit` (fusion seulement). {BorneAbsente} `sha` absent.
 */
export function ceQueFaitLeCommit(depot, sha) {
  const base = baseDuCommit(depot, sha)
  return base ? changeEntre(depot, base, sha) : RIEN
}

/**
 * CE QU'EMPORTE L'INDEX : ce qui change de HEAD, ou de l'arbre vide sans premier commit, à l'index
 * (`ceQuiChange`).
 * @param {Depot} depot
 */
export const ceQuEmporteLIndex = (depot) => {
  const base = imageDeHead(depot)
  return base ? changeEntre(depot, base, INDEX) : RIEN
}

/** Colonnes d'un enregistrement `git ls-files --eol` : `i/<eol>`, `w/<eol>`, `attr/<attributs>`
 *  séparés par des ESPACES (la valeur d'`attr/` en contient), puis une TABULATION et le chemin. */
const COLONNES_EOL = /^i\/(\S*)\s+w\/(\S*)\s+attr\/(.*?)\s*\t(.*)$/s

/**
 * `git ls-files --eol --cached -- <chemins>` en entrées `{ index, travail, attr, chemin }` : les fins
 * de ligne du blob de l'index, du disque, et les attributs déclarés.
 * @param {Depot} depot @param {readonly string[]} chemins
 * @returns {{ index: string, travail: string, attr: string, chemin: string }[]}
 * @throws {Error} enregistrement qui ne suit pas la forme de `COLONNES_EOL`, nommé.
 */
export function eolsDe(depot, chemins) {
  return enregistrementsDe(depot, ['ls-files', '--eol', '--cached', '--', ...chemins]).map((e) => {
    const m = COLONNES_EOL.exec(e)
    if (!m) throw new Error(`git ls-files --eol illisible : « ${e} »`)
    return { index: m[1], travail: m[2], attr: m[3], chemin: m[4] }
  })
}

/**
 * Les FICHIERS qu'une IMAGE git porte sous `dossiers` (tout l'arbre sans dossier), chemins POSIX complets — l'unique listeur
 * d'image des portes : `arbre` = une ref (`ls-tree -r`), `INDEX` (`ls-files --cached`, ce que le
 * commit emporte), `SUIVI` (les mêmes chemins privés de ceux que le disque a perdus, `ls-files
 * --deleted` : ce que `git commit -a` emporte) ou `TRAVAIL` (`SUIVI` plus les non-suivis non ignorés). Un listage de DISQUE commun à deux images
 * rendait un fichier SUPPRIMÉ absent de la pré-image elle-même (#1728).
 * @param {Depot} depot @param {string} arbre @param {...string} dossiers
 * @returns {string[]}
 * @throws {BorneAbsente} la ref `arbre` absente du dépôt.
 */
export function listerImage(depot, arbre, ...dossiers) {
  const args = arbre === INDEX || arbre === SUIVI ? ['ls-files', '--cached']
    : arbre === TRAVAIL ? ['ls-files', '--cached', '--others', '--exclude-standard']
      : ['ls-tree', '-r', '--name-only', ...revisionsDe([arbre])]
  const ref = args[0] === 'ls-tree'
  const chemins = enregistrementsDe(depot, [...args, '--', ...dossiers], ref ? ['listerImage', [arbre], 'tree'] : undefined)
  if (arbre !== SUIVI && arbre !== TRAVAIL) return chemins
  const perdus = new Set(enregistrementsDe(depot, ['ls-files', '--deleted', '--', ...dossiers]))
  return chemins.filter((c) => !perdus.has(c))
}

/**
 * Les entrées DIRECTES de `dossier` parmi des `chemins` complets (`listerImage`) — noms simples,
 * triés, dédupliqués : ce qu'attend `mesurerBudget` (`budget-contexte.mjs`).
 * @param {readonly string[]} chemins @param {string} dossier @returns {string[]}
 */
export function enfantsDirects(chemins, dossier) {
  const prefixe = `${dossier}/`
  const noms = new Set()
  for (const rel of chemins) {
    if (!rel.startsWith(prefixe)) continue
    const nom = rel.slice(prefixe.length).split('/')[0]
    if (nom) noms.add(nom)
  }
  return [...noms].sort()
}

/** Les portées d'une recherche : l'arbre de travail suivi, les non-suivis en plus, l'index. Une
 *  REF est la quatrième. */
const PORTEES = new Set(['', '--untracked', '--cached'])

/**
 * Les FICHIERS qui portent le motif `-E` `motif` sous `pathspecs` (`git grep -l`) — l'unique lecture
 * `git grep` des portes. `grep` n'a pas de plomberie : le lecteur pose les drapeaux qui priment sur la
 * configuration (`color.grep`, `grep.fullName`, #1806). `portee` : `[]` (arbre de travail suivi),
 * `['--untracked']`, `['--cached']` (index) ou `[<ref>]`, dont git préfixe alors chaque chemin. Aucun
 * match (sortie 1) : `[]`.
 * @param {Depot} depot @param {string[]} portee @param {string} motif
 * @param {readonly string[]} pathspecs @returns {string[]}
 * @throws {BorneAbsente} la ref de `portee` absente du dépôt.
 */
export function fichiersDuGrep(depot, portee, motif, pathspecs) {
  const ref = portee.length === 1 && !PORTEES.has(portee[0]) && !portee[0].startsWith('-')
  if (portee.length > 1 || (portee.length === 1 && !ref && !PORTEES.has(portee[0]))) throw new Error(`fichiersDuGrep : portée « ${portee.join(' ')} » inconnue`)
  const prefixe = ref ? `${revisionsDe(portee)[0]}:` : ''
  return enregistrementsDe(depot, ['grep', '--no-color', '--full-name', '-l', '-E', '-e', motif, ...portee, '--', ...pathspecs], ref ? ['fichiersDuGrep', portee, 'tree'] : undefined)
    .map((c) => c.slice(prefixe.length))
}

/**
 * Le texte de chaque chemin de `rels` dans l'image `arbre` (une ref ou `INDEX`), `null` s'il y est
 * absent — l'unique lecture PAR LOT des portes : un seul `git cat-file --batch`. Un `cat-file` qui ne
 * rend pas son lot est une PANNE, confiée (`confier` : `enPanne` et tout `null`, sinon `GitIndisponible`).
 * @param {Depot} depot @param {string} arbre
 * @param {readonly string[]} rels @returns {Map<string, string | null>}
 * @throws {Error} un chemin à caractère de contrôle (`porteUnControle`), avant le spawn ; sortie de
 *   `cat-file` qui ne suit pas sa forme `<objet> <type> <taille>`. {BorneAbsente} la ref `arbre`
 *   absente du dépôt.
 */
export function lireEnLot(depot, arbre, rels) {
  /** @type {Map<string, string | null>} */
  const textes = new Map()
  if (!rels.length) return textes
  const prefixe = arbre === INDEX ? ':' : `${revisionsDe([arbre])[0]}:`
  const fautifs = rels.filter((rel) => typeof rel !== 'string' || porteUnControle(rel))
  if (fautifs.length) throw new Error(`lireEnLot : un chemin tient sur une ligne du lot, sans caractère de contrôle — refusés : ${JSON.stringify(fautifs)}`)
  const vu = interroger(depot, ['cat-file', '--batch'], { entree: rels.map((rel) => `${prefixe}${rel}\n`).join('') })
  if (!vu.disponible || vu.absent || vu.valeur.status !== 0) {
    confier(depot, vu.disponible ? `\`git cat-file --batch\` sans lot (${vu.absent ? 'objet absent' : `status ${vu.valeur.status}`})` : vu.raison)
    return new Map(rels.map((rel) => [rel, null]))
  }
  const sortie = Buffer.from(vu.valeur.stdout, 'utf8')
  let p = 0
  for (const rel of rels) {
    const fin = sortie.indexOf(10, p)
    const tete = fin < 0 ? '' : sortie.subarray(p, fin).toString('utf8')
    if (tete.endsWith(' missing')) {
      textes.set(rel, null)
      p = fin + 1
      continue
    }
    const taille = Number(tete.split(' ')[2])
    if (!Number.isInteger(taille) || sortie[fin + 1 + taille] !== 10) throw new Error(`git cat-file --batch illisible à ${prefixe}${rel} : « ${tete} »`)
    textes.set(rel, sortie.subarray(fin + 1, fin + 1 + taille).toString('utf8'))
    p = fin + 2 + taille
  }
  if (arbre !== INDEX && [...textes.values()].every((t) => t === null)) bornesDe(depot, 'lireEnLot', [arbre], 'tree')
  return textes
}

/**
 * `<ancetre>` est-il un ancêtre de `<descendant>` ? Le prédicat de git répond par son code de sortie ;
 * un sha INCONNU rend `absent` (l'appelant décide : « pas dans cette histoire » pour une porte).
 * @param {Depot} depot @param {string} ancetre @param {string} descendant
 * @returns {{disponible:true, valeur:boolean}|{disponible:true,absent:true}|{disponible:false,raison:string}}
 */
export function estAncetre(depot, ancetre, descendant) {
  const vu = interroger(depot, ['merge-base', '--is-ancestor', ...revisionsDe([ancetre, descendant])])
  if (!vu.disponible) return vu
  if (vu.absent) {
    try {
      return corrompu(depot, [ancetre, descendant]) ? indisponible('dépôt corrompu') : vu
    } catch (e) {
      if (!(e instanceof GitIndisponible)) throw e
      return indisponible(e.raison)
    }
  }
  return fait(vu.valeur.status === 0)
}

/**
 * `sha` est-il dans l'histoire de HEAD (HEAD compris) ? PRÉDICAT BOOLÉEN unique des portes : un sha
 * INCONNU est `false` (il n'est pas dans cette histoire), une INDISPONIBILITÉ JETTE. Deux portes s'en
 * servent — la tête de fenêtre d'une revue de palier, et le commit qu'un solde dit correcteur — et
 * elles ne peuvent pas en avoir deux définitions : la seconde dériverait de la première en silence.
 * @param {Depot} depot @param {string} sha @returns {boolean}
 */
export function estDansHead(depot, sha) {
  if (!sha) return false
  const vu = estAncetre(depot, sha, 'HEAD')
  if (!vu.disponible) throw new GitIndisponible(vu.raison)
  return !vu.absent && vu.valeur === true
}

/**
 * L'ARBRE PRINCIPAL du dépôt — la racine des GESTES git d'un outil, depuis n'importe quel worktree
 * (`ops:chantier`, `ops:worktrees`, le pre-commit). Source UNIQUE de cette résolution : trois copies
 * manuscrites la re-posaient, chacune avec son repli.
 *
 * `git rev-parse --path-format=absolute --git-common-dir` rend le `.git` COMMUN — celui de l'arbre
 * principal, quel que soit le worktree d'où on demande (forme mesurée contre git réel :
 * `scripts/guards/lib/gitPorte.test.mjs`, « depuis un WORKTREE RÉEL »). Son PARENT est l'arbre principal.
 *
 * DEUX REFUS NOMMÉS, jamais un repli sur `cwd` : un repli ferait poser un worktree SOUS un worktree,
 * exactement le cas que les outils doivent rendre inexprimable.
 *   - réponse VIDE : git n'a rien rendu, aucun chemin à interpréter ;
 *   - chemin qui ne finit pas par `/.git` : dépôt NU, sous-module ou `--separate-git-dir` — le parent
 *     n'est alors pas un arbre. Sous `--path-format=absolute`, un dépôt nu rend son chemin ABSOLU
 *     (mesuré 2026-09-14 sur `git init --bare` : `C:/…/nu.git`), jamais `.`.
 *
 * VALEUR RENDUE : le chemin absolu, séparateurs POSIX, sans slash final — la CASSE est CONSERVÉE,
 * parce que cette valeur sert de `cwd` et de préfixe de cible. `normaliserRacine` (qui abaisse la
 * casse) ne sert ici qu'aux COMPARAISONS ; l'employer sur la valeur casserait tout chemin
 * case-sensible (mesure du 2026-09-14 : `mkdtempSync` rend 8/8 suffixes porteurs d'une majuscule, et
 * `test:ops` tourne sur `ubuntu-latest`, `runs-on` de son job de .github/workflows/ci.yml).
 * @param {Depot} depot
 * @returns {{disponible:true, valeur:string}|{disponible:false, raison:string}}
 */
export function arbrePrincipal(depot) {
  const { cwd } = depot
  const refus = (motif) => indisponible(`arbre principal non résolu : ${motif}${motif.includes(cwd) ? '' : ` (depuis ${cwd})`}`)
  const vu = interroger(depot, ['rev-parse', '--path-format=absolute', '--git-common-dir'])
  if (!vu.disponible) return refus(vu.raison)
  if (vu.absent) return refus("git n'y connaît pas de dépôt")
  if (vu.valeur.status !== 0) return refus(`git rev-parse --git-common-dir rend ${vu.valeur.status}`)
  const brut = String(vu.valeur.stdout).trim()
  const compare = normaliserRacine(brut)
  if (!compare) return refus('git rev-parse --git-common-dir rend une réponse vide')
  if (!compare.endsWith('/.git')) {
    return refus(`répertoire git hors d'un arbre — dépôt nu (« …/x.git »), sous-module ou --separate-git-dir : ${brut}`)
  }
  const chemin = brut.replace(/\\/g, '/').replace(/\/+$/, '')
  return fait(chemin.slice(0, -'/.git'.length))
}

/** Le dépôt de ce projet (`DEPOT`), en https comme en ssh, avec ou sans `.git`, casse ignorée comme
 *  GitHub l'ignore. Notion d'ORIGINE, donc hôte des lectures git : la porte au push et la préflight
 *  de publication refusent l'une comme l'autre un `origin` étranger. */
const URL_ORIGINE = new RegExp(`github\\.com[:/]${DEPOT.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')}(?:\\.git)?$`, 'i')
export const urlOrigineAcceptee = (url) => URL_ORIGINE.test(String(url ?? '').trim())

/** Le TRONC de l'origine : son nom de branche, sa ref côté distant, et sa ref de suivi locale. */
export const TRONC = Object.freeze({ nom: 'main', branche: 'refs/heads/main', suivi: 'origin/main' })

/**
 * Le SHA du commit que `ref` nomme (`rev-parse --verify --quiet <ref>^{commit}`), abrégé sous
 * `court` ; `null` si `ref` ne nomme aucun commit. Une réponse INDISPONIBLE (git 2.55 écrit sur
 * stderr pour un parent illisible, `v1~1`) passe par `corrompu` avant d'être confiée.
 * @param {Depot} depot @param {string} ref @param {{ court?: boolean }} [opts]
 * @returns {string | null}
 */
export function shaDe(depot, ref, { court = false } = {}) {
  const vu = interroger(depot, ['rev-parse', '--verify', '--quiet', ...(court ? ['--short'] : []), `${revisionsDe([ref])[0]}^{commit}`])
  if (!vu.disponible) return corrompu(depot, [ref]) ? null : confier(depot, vu.raison)
  return sortieOuNull(vu)?.trim() || absentSaufCorrompu(depot, [ref])
}

/** Ce que git répond quand le `cwd` n'est dans aucun arbre de travail (`git help rev-parse`,
 *  `--show-toplevel` ; message de `setup.c`). */
const HORS_ARBRE = /not a git repository|must be run in a work tree/i

/** La RACINE de l'arbre de travail (`rev-parse --show-toplevel`), `null` hors d'un arbre ; toute
 *  autre indisponibilité va à `confier`.
 *  @param {Depot} depot @returns {string | null} */
export function racineDe(depot) {
  const vu = interroger(depot, ['rev-parse', '--show-toplevel'])
  if (vu.disponible) return sortieOuNull(vu)?.trim() || null
  return HORS_ARBRE.test(vu.raison) ? null : confier(depot, vu.raison)
}

/** La BRANCHE de HEAD (`symbolic-ref --quiet --short HEAD`), `null` sous HEAD détaché.
 *  @param {Depot} depot @returns {string | null} */
export const brancheDe = (depot) => lire(depot, ['symbolic-ref', '--quiet', '--short', 'HEAD'])?.trim() || null

/** Le chemin de `nom` sous le répertoire git (`rev-parse --git-path`, `git help rev-parse`), relatif
 *  au `cwd` du lecteur. @param {Depot} depot @param {string} nom @returns {string | null} */
export const cheminGit = (depot, nom) => lire(depot, ['rev-parse', '--git-path', nom])?.trim() || null

/**
 * Les commits que la FUSION EN COURS fusionne dans HEAD (`MERGE_HEAD`, une ligne par commit : écrite
 * `builtin/merge.c:1044-1046`, lue `builtin/commit.c:1773-1778` par `get_merge_parent`, `commit.c:1700`,
 * git v2.43.0), vide hors fusion. Avec HEAD, ce sont les PARENTS du commit à venir. Les lignes sont
 * résolues en UN `cat-file --batch-check` (`<ligne>^{commit}`, patron de `bornesDe`), une ligne de
 * lot par ligne du fichier : une ligne fautive (`revisionFautive`, dont tout caractère de contrôle)
 * n'est jamais posée. Un fichier illisible, ou une ligne qui ne nomme aucun commit
 * (`builtin/commit.c:1778`), va à `confier` : `[]` sous `enPanne`.
 * @param {Depot} depot @returns {string[]}
 */
export function fusionnesEnCours(depot) {
  const chemin = cheminGit(depot, 'MERGE_HEAD')
  if (!chemin) return []
  const complet = resolve(depot.cwd, chemin)
  const lu = tenter(() => (natureDuChemin(complet) === 'absent' ? '' : readFileSync(complet, 'utf8')))
  if (!lu.disponible) return confier(depot, `MERGE_HEAD illisible : ${lu.raison}`) ?? []
  const lignes = lu.valeur.split('\n')
  if (lignes.at(-1) === '') lignes.pop()
  const corrompue = (ligne) => confier(depot, `dépôt corrompu : MERGE_HEAD, « ${ligne} » ne nomme aucun commit`) ?? []
  const fautive = lignes.find(revisionFautive)
  if (fautive !== undefined) return corrompue(fautive)
  if (!lignes.length) return []
  const brut = lire(depot, ['cat-file', '--batch-check'], { entree: lignes.map((l) => `${l}^{commit}\n`).join('') })
  if (brut === null) return []
  const reponses = brut.split('\n')
  const shas = []
  for (const [i, ligne] of lignes.entries()) {
    const sha = /^([0-9a-f]+) commit /.exec(reponses[i] ?? '')?.[1]
    if (!sha) return corrompue(ligne)
    shas.push(sha)
  }
  return shas
}

/** Les chemins d'état d'un REBASE ENTAMÉ sous le répertoire git (`wt-status.c`, `wt_status_check_rebase`). */
const ETATS_DE_REBASE = Object.freeze(['rebase-merge', 'rebase-apply'])

/**
 * Le REBASE ENTAMÉ du dépôt : le nom de son chemin d'état (`ETATS_DE_REBASE`) présent sous le
 * répertoire git (`cheminGit`, `natureDuChemin`), `null` hors rebase. Un chemin illisible va à
 * `confier` : `null` sous `enPanne`.
 * @param {Depot} depot @returns {'rebase-merge' | 'rebase-apply' | null}
 */
export function rebaseEntame(depot) {
  for (const nom of ETATS_DE_REBASE) {
    const chemin = cheminGit(depot, nom)
    if (!chemin) return null
    const nature = tenter(() => natureDuChemin(resolve(depot.cwd, chemin)))
    if (!nature.disponible) return confier(depot, `${nom} illisible : ${nature.raison}`)
    if (nature.valeur !== 'absent') return nom
  }
  return null
}

/** Le dépôt est-il SUPERFICIEL (`rev-parse --is-shallow-repository`) ? `null` si git ne le dit pas.
 *  @param {Depot} depot @returns {boolean | null} */
export function estSuperficiel(depot) {
  const brut = lire(depot, ['rev-parse', '--is-shallow-repository'])?.trim()
  return brut === 'true' ? true : brut === 'false' ? false : null
}

/** Le dossier des hooks que le dépôt déclare (`config --get core.hooksPath`), `null` sans réglage.
 *  @param {Depot} depot @returns {string | null} */
export const dossierDesHooks = (depot) => lire(depot, ['config', '--get', 'core.hooksPath'])?.trim() || null

/** L'URL de l'origine (`remote get-url origin`), `null` sans origine.
 *  @param {Depot} depot @returns {string | null} */
export const origineDe = (depot) => lire(depot, ['remote', 'get-url', 'origin'])?.trim() || null

/**
 * `chemin` est-il IGNORÉ (`check-ignore -q`) ? Un chemin SUIVI qu'un motif couvre ne l'est pas, sauf
 * sous `suivisCompris` (`--no-index`). Code de sortie 1, ou git muet : `false`.
 * @param {Depot} depot @param {string} chemin
 * @param {{ suivisCompris?: boolean }} [opts] @returns {boolean}
 */
export const estIgnore = (depot, chemin, { suivisCompris = false } = {}) =>
  lire(depot, ['check-ignore', '-q', ...(suivisCompris ? ['--no-index'] : []), '--', chemin]) !== null

/**
 * La valeur de l'attribut `nom` sur `chemin` (`check-attr -z`, `git help check-attr`) : la valeur
 * posée, ou `unspecified`, `set`, `unset` ; `null` si git ne répond pas.
 * @param {Depot} depot @param {string} chemin @param {string} nom @returns {string | null}
 */
export const attributDe = (depot, chemin, nom) => enregistrementsDe(depot, ['check-attr', nom, '--', chemin])[2] ?? null

/**
 * Les WORKTREES du dépôt (`worktree list --porcelain -z`, `git help worktree`), le principal en tête
 * (`principal`) : `{ chemin, head, branche, principal, nu, verrouille, verrouillePour, prunable }`,
 * `branche` sans `refs/heads/` (`null` sous HEAD détaché), `verrouillePour`/`prunable` = la raison
 * que git en donne (`prunable` vaut `'prunable'` sans raison). `null` si git ne les rend pas.
 * @param {Depot} depot
 * @returns {{ chemin: string, head: string | null, branche: string | null, principal: boolean, nu: boolean,
 *   verrouille: boolean, verrouillePour: string | null, prunable: string | null }[] | null}
 */
export function worktreesDe(depot) {
  const brut = lire(depot, ['worktree', 'list', '--porcelain', '-z'])
  if (brut === null) return null
  const blocs = []
  let bloc = null
  for (const champ of brut.split('\0')) {
    if (!champ) {
      bloc = null
      continue
    }
    const [cle, ...reste] = champ.split(' ')
    const valeur = reste.join(' ')
    if (cle === 'worktree') {
      bloc = { chemin: valeur, head: null, branche: null, principal: blocs.length === 0, nu: false, verrouille: false, verrouillePour: null, prunable: null }
      blocs.push(bloc)
    } else if (!bloc) continue
    else if (cle === 'HEAD') bloc.head = valeur
    else if (cle === 'branch') bloc.branche = valeur.replace(/^refs\/heads\//, '')
    else if (cle === 'bare') bloc.nu = true
    else if (cle === 'locked') [bloc.verrouille, bloc.verrouillePour] = [true, valeur || null]
    else if (cle === 'prunable') bloc.prunable = valeur || 'prunable'
  }
  return blocs
}

/**
 * La FUSION À TROIS de trois fichiers (`merge-file -p`, `git help merge-file`, dont le code de sortie
 * est le nombre de conflits) : le texte fusionné, marqueurs étiquetés par `labels`, au style `merge`
 * (`OPTIONS_DE_L_HOTE`), et `conflit`.
 * @param {Depot} depot @param {{ ours: string, base: string, theirs: string }} fichiers
 * @param {{ ours: string, base: string, theirs: string }} labels
 * @returns {{ texte: string, conflit: boolean }}
 * @throws {GitIndisponible} git indisponible ; {Error} code de sortie d'erreur (255 et plus).
 */
export function fusionDeTextes(depot, fichiers, labels) {
  const vu = interroger(depot, ['merge-file', '-p', '-L', labels.ours, '-L', labels.base, '-L', labels.theirs, '--', fichiers.ours, fichiers.base, fichiers.theirs])
  if (!vu.disponible) throw new GitIndisponible(vu.raison)
  if (vu.absent || vu.valeur.status >= 255) throw new Error(`git merge-file en échec (${vu.absent ? 'objet absent' : vu.valeur.status})`)
  return { texte: vu.valeur.stdout, conflit: vu.valeur.status > 0 }
}

/** Une écriture a-t-elle RÉUSSI (git a répondu, code 0) ? PUR. */
export const reussi = (union) => union.disponible && !union.absent && union.valeur.status === 0

// ÉCRIVAINS : chacun fixe sa commande et rend l'union (`interroger`) ; aucun ne pose d'option de
// l'hôte, la configuration de l'utilisateur (identité, signature, proxy, identifiants) fait foi.

/**
 * MUTATION de refs : met `refs/remotes/origin/<branche>` à jour, par une refspec explicite qu'un
 * clone `--single-branch` ne porte pas. Une panne RÉSEAU rend `indisponible` — la porte qui
 * l'appelle dit « CI non consultable », elle ne conclut pas.
 * @param {Depot} depot @param {{ branche?: string }} [opts]
 */
export const fetchOrigin = (depot, { branche = TRONC.nom } = {}) =>
  ecrire(depot, ['fetch', '--quiet', '--no-tags', 'origin', `+refs/heads/${revisionsDe([branche])[0]}:refs/remotes/origin/${branche}`], { timeout: 60000 })

/** L'histoire complète d'un clone superficiel (`fetch --unshallow origin`). @param {Depot} depot @param {{ timeout?: number }} [opts] */
export const approfondir = (depot, { timeout } = {}) => ecrire(depot, ['fetch', '--unshallow', 'origin'], { timeout })

/** Un dépôt NEUF sur `branche` (`init -q -b`). @param {Depot} depot @param {{ branche: string }} opts */
export const initialiserDepot = (depot, { branche }) => ecrire(depot, ['init', '-q', '-b', ...revisionsDe([branche])])

/** Un réglage LOCAL du dépôt (`config <cle> <valeur>`). @param {Depot} depot @param {string} cle @param {string} valeur */
export const reglerDepot = (depot, cle, valeur) => ecrire(depot, ['config', '--local', '--', ...revisionsDe([cle]), valeur])

/** L'origine du dépôt (`remote add origin`). @param {Depot} depot @param {string} url */
export const ajouterOrigine = (depot, url) => ecrire(depot, ['remote', 'add', '--', 'origin', url])

/** La ref `nom` posée sur le commit `sha` (`update-ref`). @param {Depot} depot @param {string} nom @param {string} sha */
export const poserRef = (depot, nom, sha) => ecrire(depot, ['update-ref', '--', ...revisionsDe([nom, sha])])

/**
 * Un COMMIT des FICHIERS `chemins`, stagés puis committés seuls (`add --`, `commit -- <chemins>`),
 * sous `--literal-pathspecs` (`git help git`) : un chemin est un nom de fichier, jamais un motif. Un
 * chemin vide, `.`, terminé par `/` ou qui nomme un RÉPERTOIRE — sur le disque, ou, absent du disque,
 * dans l'index (une entrée sous `<chemin>/`, `listerImage`) — est refusé avant toute écriture. `vide`
 * accepte un commit sans changement, et seul lui accepte `chemins` vide : il joue alors `commit
 * --allow-empty --only` (`git help commit`, `--only`), qui laisse l'index hors du commit. Le message
 * passe par l'entrée standard (`commit -F -`). L'union de l'étape qui échoue, ou celle du commit.
 * @param {Depot} depot @param {{ message: string, chemins: readonly string[], vide?: boolean }} p
 * @throws {Error} `chemins` absent, vide hors `vide`, ou qui ne nomme pas un fichier.
 */
export function commitDe(depot, { message, chemins, vide = false }) {
  if (!Array.isArray(chemins) || (!chemins.length && !vide)) throw new Error('commitDe : un commit porte des `chemins` explicites (vides sous `vide` seulement)')
  const { cwd } = lanceurDe(depot)
  const nomUnRepertoire = (c) => {
    const nature = natureDuChemin(join(cwd, c))
    return nature === 'repertoire' || (nature === 'absent' && listerImage(depot, INDEX, c).some((e) => e.startsWith(`${c}/`)))
  }
  const refuses = chemins.filter((c) => typeof c !== 'string' || c === '' || c === '.' || c.endsWith('/') || nomUnRepertoire(c))
  if (refuses.length) throw new Error(`commitDe : un chemin nomme un FICHIER, jamais un répertoire ni l'arbre — refusés : ${JSON.stringify(refuses)}`)
  const commit = { entree: message, timeout: 600_000 }
  if (!chemins.length) return ecrire(depot, ['commit', '-q', '--allow-empty', '--only', '-F', '-'], commit)
  const ajout = ecrire(depot, ['--literal-pathspecs', 'add', '--', ...chemins])
  if (!reussi(ajout)) return ajout
  return ecrire(depot, ['--literal-pathspecs', 'commit', '-q', ...(vide ? ['--allow-empty'] : []), '-F', '-', '--', ...chemins], commit)
}

/**
 * FUSION de `de` dans la branche courante, toujours par un commit de fusion (`merge --no-ff`), sous
 * le `message` donné (`-m`) : la porte de commit exige un `#N` que le message par défaut ne porte pas.
 * @param {Depot} depot @param {{ de: string, message: string }} p
 */
export const fusionner = (depot, { de, message }) =>
  ecrire(depot, ['merge', '--no-ff', '-m', String(message), ...revisionsDe([de])], { timeout: 600_000 })

/** La fusion entamée, abandonnée (`merge --abort`). @param {Depot} depot */
export const abandonnerFusion = (depot) => ecrire(depot, ['merge', '--abort'])

/**
 * HEAD poussé vers la branche `vers` de l'origine. `bail` = `--force-with-lease`, qui n'écrase que ce
 * que le dépôt vient de lire. Jamais vers le tronc : `main` n'avance que par la file de fusion
 * (scripts/ops/ruleset-main.mjs).
 * @param {Depot} depot @param {{ vers: string, bail?: boolean }} p
 * @throws {Error} `vers` = `TRONC`.
 */
export function pousser(depot, { vers, bail = false }) {
  if ([TRONC.nom, TRONC.branche].includes(vers)) throw new Error('`git push` vers `main` : main n’avance que par la file de fusion (`npm run ops:publier`)')
  return ecrire(depot, ['push', ...(bail ? ['--force-with-lease'] : []), 'origin', `HEAD:${revisionsDe([vers])[0]}`], { timeout: 600_000 })
}

/** Un worktree neuf en `chemin`, sur la branche NEUVE `branche` partie de `depuis` (`worktree add -b`).
 *  @param {Depot} depot @param {{ chemin: string, branche: string, depuis: string }} p */
export const ajouterWorktree = (depot, { chemin, branche, depuis }) => {
  const [nom, base] = revisionsDe([branche, depuis])
  return ecrire(depot, ['worktree', 'add', '-b', nom, '--', chemin, base])
}

/** Le worktree `chemin`, retiré sans forcer (`worktree remove`). @param {Depot} depot @param {string} chemin */
export const retirerWorktree = (depot, chemin) => ecrire(depot, ['worktree', 'remove', '--', chemin])

/** La branche `branche`, supprimée si elle est fusionnée (`branch -d`). @param {Depot} depot @param {string} branche */
export const supprimerBranche = (depot, branche) => ecrire(depot, ['branch', '-d', '--', ...revisionsDe([branche])])

/** Les worktrees disparus du disque, oubliés (`worktree prune`). @param {Depot} depot */
export const elaguerWorktrees = (depot) => ecrire(depot, ['worktree', 'prune'])
