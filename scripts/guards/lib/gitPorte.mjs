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
// `fetchOrigin` est à part, et NOMMÉE : elle ÉCRIT des refs. Une lecture et une mutation ne
// partagent pas un hôte « fail-closed » sans que l'appelant sache laquelle il a jouée.
import { Buffer } from 'node:buffer'
import { spawnSync } from 'node:child_process'
import { statSync } from 'node:fs'
import { normaliserRacine } from '../../port-dev.mjs'
import { BACKOFFS_MS, MARQUE_REJEU, attendreSync, estEchecDeChargement, rejeux } from './spawnResilient.mjs'

/** Longueur maximale d'une `raison` : elle est DITE dans un refus de hook, une fois. */
const RAISON_MAX = 200

/** git a répondu. @param {*} valeur */
export const fait = (valeur) => ({ disponible: true, valeur })

/** L'objet demandé n'existe pas — un fait, pas une panne. */
export const absent = () => ({ disponible: true, absent: true })

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

/**
 * Première ligne SIGNIFICATIVE d'une sortie d'erreur, bornée. PURE.
 * @param {string} brut @returns {string}
 */
export function raisonCourte(brut) {
  const ligne = String(brut ?? '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find(Boolean) ?? 'raison non dite'
  return ligne.length > RAISON_MAX ? `${ligne.slice(0, RAISON_MAX - 1)}…` : ligne
}

/**
 * Ce que git écrit quand l'OBJET demandé n'existe pas. Une seule liste, ici, testée contre git RÉEL
 * (`gitPorte.test.mjs`, dépôt jetable) : une seconde liste ailleurs re-classerait le cas normal de la
 * porte de stock en panne de dépôt.
 */
export const MOTIFS_ABSENT = [
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
]

/** `true` si ce stderr dit « l'objet demandé n'existe pas ». PUR. */
export const ditAbsent = (stderr) => MOTIFS_ABSENT.some((re) => re.test(String(stderr ?? '')))

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

/** Les options git que porte TOUTE commande de l'hôte : un chemin non-ASCII s'écrit en clair dans les
 *  formes qui n'ont pas de `-z` (en-têtes d'un patch, `git help config`, `core.quotePath`). */
export const OPTIONS_DE_L_HOTE = Object.freeze(['-c', 'core.quotePath=false'])

/**
 * `git <args>` dans `cwd`, rendu en union à trois issues. `entree` : l'entrée standard du processus ;
 * `env` : son environnement.
 * @param {string[]} args
 * @param {{cwd?:string, spawn?:Function, attendre?:Function, site?:string, timeout?:number, entree?:string,
 *   env?:NodeJS.ProcessEnv, nature?:(p:string)=>'repertoire'|'fichier'|'absent'}} [opts]
 */
export function lireGit(args, opts = {}) {
  return classer(lancer('git', [...OPTIONS_DE_L_HOTE, ...args], { site: `git ${args[0] ?? ''}`, ...opts }), { cwd: opts.cwd, nature: opts.nature })
}

/** La sortie d'une lecture réussie, `null` si l'objet est absent ou si le code de sortie n'est pas 0.
 *  C'est le contrat qu'attendent les lecteurs d'image (`lirePostImage?: (chemin) => string | null`).
 *  `indisponible` n'a PAS de repli : l'appelant le traite, sinon il juge sur rien. */
export const sortieOuNull = (union) =>
  union.disponible && !union.absent && union.valeur.status === 0 ? union.valeur.stdout : null

/**
 * Le lecteur git d'une porte dans `cwd` : `(args, { entree }) → sortie`, `null` si l'objet est absent
 * ou si le code de sortie n'est pas 0 (`sortieOuNull`). Une INDISPONIBILITÉ JETTE (`GitIndisponible`) :
 * la porte qui l'appelle la nomme ou la laisse remonter, elle ne conclut pas sur rien. `env` :
 * l'environnement du processus (`lancer`).
 * @param {string} cwd @param {{ env?: NodeJS.ProcessEnv }} [opts]
 * @returns {(args: string[], opts?: { entree?: string }) => string | null}
 */
export const lecteurGit = (cwd, { env } = {}) => (args, { entree } = {}) => {
  const vu = lireGit(args, { cwd, env, entree })
  if (!vu.disponible) throw new GitIndisponible(vu.raison)
  return sortieOuNull(vu)
}

/** Marques des images qui ne sont pas des refs : l'index, l'arbre de travail des chemins suivis
 *  présents sur le disque (`git commit -a`, `git commit -h` : « commit all changed files », un suivi
 *  supprimé du disque est supprimé), et l'arbre de travail entier, non-suivis compris. */
export const INDEX = ':index'
export const SUIVI = ':suivi'
export const TRAVAIL = ':travail'

/** Les enregistrements que rend `git <args>` sous `-z`, séparés par NUL : l'UNIQUE découpe d'une
 *  sortie de git des portes. `-z` suit la sous-commande. Privée : une porte lit des chemins
 *  (`cheminsDe`) ou une forme NOMMÉE (`numstatDe`, `nameStatusDe`, `etatsDe`, `eolsDe`, `journalDe`). */
function enregistrementsDe(git, [sousCommande, ...reste]) {
  return (git([sousCommande, '-z', ...reste]) ?? '').split('\0').filter(Boolean)
}

/**
 * Les CHEMINS que rend `git <args>`, une forme où chaque enregistrement est un chemin (`ls-files`,
 * `ls-tree --name-only`, `--name-only`, `grep -l`) : tels que git les écrit, jamais cités
 * (`core.quotePath`), espace et saut de ligne compris. L'UNIQUE lecteur de chemins des portes. `git`
 * (args → sortie, `null` = rien) est le lecteur de l'appelant : git muet → `[]`.
 * @param {(args: string[]) => string | null} git @param {string[]} args @returns {string[]}
 */
export const cheminsDe = (git, args) => enregistrementsDe(git, args)

/**
 * `git <args> --numstat` en entrées `{ plus, moins, chemins }` : `chemins` porte le chemin, ou les
 * deux bouts d'un renommage (`<plus>\t<moins>\t` puis ancien, nouveau), tabulations comprises.
 * `plus`/`moins` valent `null` pour un binaire (`-`). `args` porte `--numstat`.
 * @param {(args: string[]) => string | null} git @param {string[]} args
 * @returns {{ plus: number | null, moins: number | null, chemins: string[] }[]}
 */
export function numstatDe(git, args) {
  const champs = enregistrementsDe(git, args)
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

/**
 * `git <args> --name-status` en entrées `{ statut, chemins }` : `statut` = la lettre suivie du score
 * (`R100`, `M`), `chemins` = un chemin, ou deux pour `R`/`C`. `args` porte `--name-status`.
 * @param {(args: string[]) => string | null} git @param {string[]} args
 * @returns {{ statut: string, chemins: string[] }[]}
 */
export function nameStatusDe(git, args) {
  const champs = enregistrementsDe(git, args)
  const entrees = []
  for (let i = 0; i < champs.length; i += 1) {
    const statut = champs[i]
    const n = /^[RC]/.test(statut) ? 2 : 1
    entrees.push({ statut, chemins: champs.slice(i + 1, i + 1 + n) })
    i += n
  }
  return entrees
}

/**
 * `git status --porcelain` en entrées `{ etat, chemins }` : `etat` = les deux colonnes `XY`, `chemins` =
 * le chemin, ou le nouveau puis l'ancien pour `R`/`C` (`git help status`, « Porcelain Format Version
 * 1 »). `args` porte `status` et `--porcelain`.
 * @param {(args: string[]) => string | null} git @param {string[]} args
 * @returns {{ etat: string, chemins: string[] }[]}
 */
export function etatsDe(git, args) {
  const champs = enregistrementsDe(git, args)
  const entrees = []
  for (let i = 0; i < champs.length; i += 1) {
    const etat = champs[i].slice(0, 2)
    const chemins = [champs[i].slice(3)]
    if (/[RC]/.test(etat) && champs[i + 1] !== undefined) chemins.push(champs[(i += 1)])
    entrees.push({ etat, chemins })
  }
  return entrees
}

/**
 * Les commits de `plage` (`<a>..<b>`), du plus ancien au plus récent, en `{ sha, message }` : `git log -z`
 * sépare les commits par NUL. `git` muet → `[]`.
 * @param {(args: string[]) => string | null} git @param {string} plage
 * @returns {{ sha: string, message: string }[]}
 */
export function journalDe(git, plage) {
  return enregistrementsDe(git, ['log', '--reverse', '--format=%H%x1f%B', plage]).map((e) => {
    const [sha, message = ''] = e.split('\x1f')
    return { sha, message }
  })
}

/** La première version de git dont `merge-tree --write-tree` lit `--stdin` (notes de version de git 2.40). */
const GIT_MERGE_TREE = Object.freeze([2, 40])

/** Versions déjà lues, par lecteur : une lecture de `git version` par lecteur, pas par commit. */
const versionsLues = new WeakMap()

/**
 * Refuse, par `GitIndisponible` NOMMÉE, un git qui ne sait pas `merge-tree --write-tree --stdin` : il
 * rendrait `error: unknown option`, qu'un lecteur à `null` confond avec un objet absent. Sonde de
 * VERSION, pas de capacité : `git version` répond hors de tout dépôt et sans objet, donc sa réponse
 * ne peut dire que la version.
 * @param {(args: string[]) => string | null} git
 * @throws {GitIndisponible}
 */
function exigerMergeTree(git) {
  if (!versionsLues.has(git)) versionsLues.set(git, git(['version']))
  const brut = versionsLues.get(git)
  const m = /(\d+)\.(\d+)/.exec(String(brut ?? ''))
  const exige = GIT_MERGE_TREE.join('.')
  if (!m) throw new GitIndisponible(`version de git illisible (« ${String(brut ?? '').trim()} ») : git merge-tree --write-tree --stdin exige git ${exige}`)
  const [majeure, mineure] = [Number(m[1]), Number(m[2])]
  if (majeure < GIT_MERGE_TREE[0] || (majeure === GIT_MERGE_TREE[0] && mineure < GIT_MERGE_TREE[1])) {
    throw new GitIndisponible(`git ${majeure}.${mineure} ne sait pas git merge-tree --write-tree --stdin (git ${exige} ou plus) : ce que fait un commit n'est pas lisible`)
  }
}

/**
 * La BASE du commit `sha` : l'arbre contre lequel il se lit. Son parent ; l'arbre vide pour une
 * racine ; pour une fusion, l'arbre que git aurait fusionné TOUT SEUL depuis ses deux parents, conflits
 * compris, qu'ils aient un ancêtre commun ou non (`git merge-tree --write-tree --stdin
 * --allow-unrelated-histories`, dont la sortie est `<propre>\0<arbre>\0…` et le code 0 même en
 * conflit). `merge-tree` ÉCRIT les objets de cet arbre, jamais une ref : des objets inaccessibles, que
 * `git gc` ramasse. `null` quand `git` ne rend pas la lecture qui la donne : sha inconnu
 * (`rev-list`), arbre vide non rendu (`hash-object`), fusion refusée (`merge-tree`), ou toute
 * indisponibilité qu'un lecteur à `null` rend en `null` au lieu de la lever.
 * @param {(args: string[], opts?: { entree?: string }) => string | null} git @param {string} sha
 * @returns {string | null}
 * @throws {GitIndisponible} fusion à plus de deux parents, ou fusion lue par un git plus ancien que
 *   `GIT_MERGE_TREE` : seule la base d'une fusion demande `merge-tree`.
 */
function baseDuCommit(git, sha) {
  const ligne = git(['rev-list', '--parents', '-n', '1', sha, '--'])
  if (ligne === null) return null
  const [, ...parents] = ligne.trim().split(/\s+/)
  if (parents.length === 0) return (git(['hash-object', '-t', 'tree', '--stdin'], { entree: '' }) ?? '').trim() || null
  if (parents.length === 1) return parents[0]
  if (parents.length > 2) throw new GitIndisponible(`fusion ${sha.slice(0, 9)} à ${parents.length} parents : aucune fusion automatique ne rejoue sa base`)
  exigerMergeTree(git)
  const [, arbre] = (git(['merge-tree', '--write-tree', '--allow-unrelated-histories', '-z', '--stdin'], { entree: `${parents[0]} ${parents[1]}\n` }) ?? '').split('\0')
  return arbre || null
}

/**
 * CE QUE FAIT LE COMMIT `sha` : son APPORT PROPRE, lu contre sa BASE (`baseDuCommit`). Une fusion
 * propre n'apporte rien ; une résolution ou une retouche apporte ses lignes. L'unique lecture d'un
 * commit POSÉ des portes : fichiers, diff, textes et renommages viennent tous de la même base.
 * `--no-renames` sur les chemins et le patch : un renommage y rend ses deux bouts (26be12347).
 *   - `base` : l'arbre contre lequel le commit se lit (une ref ou un arbre), `null` dans les cas de
 *     `baseDuCommit` ; tout ce qui suit est alors vide ;
 *   - `chemins(filtre)` : les chemins touchés (`--name-only`, `-z`), `filtre` = `--diff-filter=…`,
 *     `[]` si la base est `null` ;
 *   - `diff(pathspecs)` : le patch `-U0`, `''` si rien ou si la base est `null` ;
 *   - `texteDeBase(chemin)` : le texte de `chemin` dans la base, `null` s'il y est absent ou si la base
 *     est `null` ;
 *   - `renommages()` : chemin de la base ↦ chemin du commit (`-M`), vide si la base est `null`.
 * `git` (args, `{ entree }` → sortie, `null` = rien) est le lecteur de l'appelant.
 * @param {(args: string[], opts?: { entree?: string }) => string | null} git @param {string} sha
 * @throws {GitIndisponible} propagée de `baseDuCommit` (fusion seulement).
 */
export function ceQueFaitLeCommit(git, sha) {
  const base = baseDuCommit(git, sha)
  const entre = (forme, pathspecs = []) => ['diff', ...forme, base, sha, '--', ...pathspecs]
  return {
    base,
    chemins: (filtre = []) => (base ? cheminsDe(git, entre(['--name-only', '--no-renames', ...filtre])) : []),
    diff: (pathspecs = []) => (base ? git(entre(['-U0', '--no-renames'], pathspecs)) ?? '' : ''),
    texteDeBase: (chemin) => (base ? git(['show', `${base}:${chemin}`]) : null),
    renommages: () => new Map(base ? nameStatusDe(git, entre(['-M', '--diff-filter=R', '--name-status'])).map((e) => e.chemins) : []),
  }
}

/** Colonnes d'un enregistrement `git ls-files --eol` : `i/<eol>`, `w/<eol>`, `attr/<attributs>`
 *  séparés par des ESPACES (la valeur d'`attr/` en contient), puis une TABULATION et le chemin. */
const COLONNES_EOL = /^i\/(\S*)\s+w\/(\S*)\s+attr\/(.*?)\s*\t(.*)$/s

/**
 * `git <args> --eol` (`ls-files`) en entrées `{ index, travail, attr, chemin }` : les fins de ligne
 * du blob de l'index, du disque, et les attributs déclarés. `args` porte `ls-files` et `--eol`.
 * @param {(args: string[]) => string | null} git @param {string[]} args
 * @returns {{ index: string, travail: string, attr: string, chemin: string }[]}
 * @throws {Error} enregistrement qui ne suit pas la forme de `COLONNES_EOL`, nommé.
 */
export function eolsDe(git, args) {
  return enregistrementsDe(git, args).map((e) => {
    const m = COLONNES_EOL.exec(e)
    if (!m) throw new Error(`git ls-files --eol illisible : « ${e} »`)
    return { index: m[1], travail: m[2], attr: m[3], chemin: m[4] }
  })
}

/**
 * Les FICHIERS qu'une IMAGE git porte sous `dossier`, chemins POSIX complets — l'unique listeur
 * d'image des portes : `arbre` = une ref (`ls-tree -r`), `INDEX` (`ls-files --cached`, ce que le
 * commit emporte), `SUIVI` (les mêmes chemins privés de ceux que le disque a perdus, `ls-files
 * --deleted` : ce que `git commit -a` emporte) ou `TRAVAIL` (`SUIVI` plus les non-suivis non ignorés). Un listage de DISQUE commun à deux images
 * rendait un fichier SUPPRIMÉ absent de la pré-image elle-même (#1728).
 * @param {(args: string[]) => string | null} git @param {string} arbre @param {string} dossier
 * @returns {string[]}
 */
export function listerImage(git, arbre, dossier) {
  const args = arbre === INDEX || arbre === SUIVI ? ['ls-files', '--cached']
    : arbre === TRAVAIL ? ['ls-files', '--cached', '--others', '--exclude-standard']
      : ['ls-tree', '-r', '--name-only', arbre]
  const chemins = cheminsDe(git, [...args, '--', dossier])
  if (arbre !== SUIVI && arbre !== TRAVAIL) return chemins
  const perdus = new Set(cheminsDe(git, ['ls-files', '--deleted', '--', dossier]))
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

/**
 * Les FICHIERS qui portent le motif `-E` `motif` sous `pathspecs` (`git grep -l`, `cheminsDe`) —
 * l'unique lecture `git grep` des portes. `portee` : `[]` (arbre de travail suivi), `['--untracked']`,
 * `['--cached']` (index) ou `[<ref>]`, dont git préfixe alors chaque chemin. Aucun match (sortie 1) : `[]`.
 * @param {(args: string[]) => string | null} git @param {string[]} portee @param {string} motif
 * @param {readonly string[]} pathspecs @returns {string[]}
 */
export function fichiersDuGrep(git, portee, motif, pathspecs) {
  const prefixe = portee.length === 1 && !portee[0].startsWith('-') ? `${portee[0]}:` : ''
  return cheminsDe(git, ['grep', '-l', '-E', '-e', motif, ...portee, '--', ...pathspecs]).map((c) => c.slice(prefixe.length))
}

/**
 * Le texte de chaque chemin de `rels` dans l'image `arbre` (une ref ou `INDEX`), `null` s'il y est
 * absent — l'unique lecture PAR LOT des portes : un seul `git cat-file --batch`. `git` (args,
 * `{ entree }` → sortie, `null` = rien) est le lecteur de l'appelant.
 * @param {(args: string[], opts?: { entree?: string }) => string | null} git @param {string} arbre
 * @param {readonly string[]} rels @returns {Map<string, string | null>}
 * @throws {Error} sortie de `cat-file` qui ne suit pas sa forme `<objet> <type> <taille>`.
 */
export function lireEnLot(git, arbre, rels) {
  /** @type {Map<string, string | null>} */
  const textes = new Map()
  if (!rels.length) return textes
  const prefixe = arbre === INDEX ? ':' : `${arbre}:`
  const sortie = Buffer.from(git(['cat-file', '--batch'], { entree: rels.map((rel) => `${prefixe}${rel}\n`).join('') }) ?? '', 'utf8')
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
  return textes
}

/**
 * `<ancetre>` est-il un ancêtre de `<descendant>` ? Le prédicat de git répond par son code de sortie ;
 * un sha INCONNU rend `absent` (l'appelant décide : « pas dans cette histoire » pour une porte).
 * @returns {{disponible:true, valeur:boolean}|{disponible:true,absent:true}|{disponible:false,raison:string}}
 */
export function estAncetre(ancetre, descendant, opts = {}) {
  const vu = lireGit(['merge-base', '--is-ancestor', ancetre, descendant], opts)
  if (!vu.disponible || vu.absent) return vu
  return fait(vu.valeur.status === 0)
}

/**
 * `sha` est-il dans l'histoire de HEAD (HEAD compris) ? PRÉDICAT BOOLÉEN unique des portes : un sha
 * INCONNU est `false` (il n'est pas dans cette histoire), une INDISPONIBILITÉ JETTE. Deux portes s'en
 * servent — la tête de fenêtre d'une revue de palier, et le commit qu'un solde dit correcteur — et
 * elles ne peuvent pas en avoir deux définitions : la seconde dériverait de la première en silence.
 * @param {string} sha @param {{cwd?: string}} [opts] @returns {boolean}
 */
export function estDansHead(sha, { cwd = process.cwd() } = {}) {
  if (!sha) return false
  const vu = estAncetre(sha, 'HEAD', { cwd })
  if (!vu.disponible) throw new GitIndisponible(vu.raison)
  return !vu.absent && vu.valeur === true
}

/**
 * Les `n` derniers commits de `ref`, du plus récent au plus ancien.
 * @returns {{disponible:true, valeur:string[]}|{disponible:true,absent:true}|{disponible:false,raison:string}}
 */
export function commitsDe(ref, n, opts = {}) {
  const vu = lireGit(['rev-list', '-n', String(n), ref], opts)
  if (!vu.disponible || vu.absent) return vu
  if (vu.valeur.status !== 0) return absent()
  return fait(vu.valeur.stdout.split(/\r?\n/).map((l) => l.trim()).filter(Boolean))
}

/**
 * L'ARBRE PRINCIPAL du dépôt qui contient `cwd` — la racine des GESTES git d'un outil, depuis
 * n'importe quel worktree (`ops:chantier`, `ops:worktrees`, le pre-commit). Source
 * UNIQUE de cette résolution : trois copies manuscrites la re-posaient, chacune avec son repli.
 *
 * `git rev-parse --path-format=absolute --git-common-dir` rend le `.git` COMMUN — celui de l'arbre
 * principal, quel que soit le worktree d'où on demande (forme mesurée contre git réel :
 * `scripts/guards/lib/gitPorte.test.mjs:272`). Son PARENT est l'arbre principal.
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
 * `test:ops` tourne sur `ubuntu-latest`, .github/workflows/ci.yml:10,35).
 * @param {string} cwd @param {typeof lireGit} [git]
 * @returns {{disponible:true, valeur:string}|{disponible:false, raison:string}}
 */
export function arbrePrincipal(cwd, git = lireGit) {
  const vu = git(['rev-parse', '--path-format=absolute', '--git-common-dir'], { cwd, site: 'git rev-parse' })
  if (!vu.disponible) return indisponible(`arbre principal non résolu depuis ${cwd} : ${vu.raison}`)
  if (vu.absent) return indisponible(`arbre principal non résolu depuis ${cwd} : git n'y connaît pas de dépôt`)
  if (vu.valeur.status !== 0) {
    return indisponible(`arbre principal non résolu depuis ${cwd} : git rev-parse --git-common-dir rend ${vu.valeur.status}`)
  }
  const brut = String(vu.valeur.stdout).trim()
  const compare = normaliserRacine(brut)
  if (!compare) {
    return indisponible(`arbre principal non résolu depuis ${cwd} : git rev-parse --git-common-dir rend une réponse vide`)
  }
  if (!compare.endsWith('/.git')) {
    return indisponible(
      `le répertoire git de ${cwd} est hors d'un arbre (${brut}) — dépôt nu (« …/x.git »), sous-module ` +
        "ou --separate-git-dir : aucun arbre principal ne s'en déduit",
    )
  }
  const chemin = brut.replace(/\\/g, '/').replace(/\/+$/, '')
  return fait(chemin.slice(0, -'/.git'.length))
}

/** Le dépôt de ce projet, en https comme en ssh. Notion d'ORIGINE, donc hôte des lectures git : la
 *  porte au push et la préflight de publication refusent l'une comme l'autre un `origin` étranger. */
export const urlOrigineAcceptee = (url) => /github\.com[:/]cgauche\/game(?:\.git)?$/.test(String(url ?? '').trim())

/** Le TRONC de l'origine : son nom de branche, sa ref côté distant, et sa ref de suivi locale. */
export const TRONC = Object.freeze({ nom: 'main', branche: 'refs/heads/main', suivi: 'origin/main' })

/**
 * MUTATION de refs : met `refs/remotes/origin/<branche>` à jour. Une panne RÉSEAU rend
 * `indisponible` — la porte qui l'appelle dit « CI non consultable », elle ne conclut pas.
 */
export function fetchOrigin({ branche = TRONC.nom, ...opts } = {}) {
  return lireGit(['fetch', '--quiet', 'origin', branche], { site: 'git fetch', timeout: 60000, ...opts })
}
