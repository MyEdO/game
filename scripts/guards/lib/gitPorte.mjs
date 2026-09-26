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

/** Lancement avec rejeu du processus qui n'a pas démarré. `spawn`/`attendre` injectables (mesure). */
function lancer(commande, args, { cwd, spawn = spawnSync, attendre = attendreSync, site = 'gitPorte', journal = process.stderr, timeout } = {}) {
  for (let essai = 0; ; essai += 1) {
    const vu = spawn(commande, args, { cwd, encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'pipe'], timeout })
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
 * `git <args>` dans `cwd`, rendu en union à trois issues.
 * @param {string[]} args
 * @param {{cwd?:string, spawn?:Function, attendre?:Function, site?:string, timeout?:number,
 *   nature?:(p:string)=>'repertoire'|'fichier'|'absent'}} [opts]
 */
export function lireGit(args, opts = {}) {
  return classer(lancer('git', args, { site: `git ${args[0] ?? ''}`, ...opts }), { cwd: opts.cwd, nature: opts.nature })
}

/** La sortie d'une lecture réussie, `null` si l'objet est absent ou si le code de sortie n'est pas 0.
 *  C'est le contrat qu'attendent les lecteurs d'image (`lirePostImage?: (chemin) => string | null`).
 *  `indisponible` n'a PAS de repli : l'appelant le traite, sinon il juge sur rien. */
export const sortieOuNull = (union) =>
  union.disponible && !union.absent && union.valeur.status === 0 ? union.valeur.stdout : null

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
 * `scripts/guards/lib/gitPorte.test.mjs:266`). Son PARENT est l'arbre principal.
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

/**
 * MUTATION de refs : met `refs/remotes/origin/<branche>` à jour. Une panne RÉSEAU rend
 * `indisponible` — la porte qui l'appelle dit « CI non consultable », elle ne conclut pas.
 */
export function fetchOrigin({ branche = 'main', ...opts } = {}) {
  return lireGit(['fetch', '--quiet', 'origin', branche], { site: 'git fetch', timeout: 60000, ...opts })
}
