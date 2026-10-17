// #2626
import { appendFileSync, openSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { DELAI_DE_REPONSE_MINUTES } from './ruleset-main.mjs'
import { PEREMPTION_MS, purgerPerimes } from '../guards/lib/purgerPerimes.mjs'
import { NAISSANCE_ABSENTE, estPidVivantDepuis } from '../guards/lib/pid.mjs'
import { GitIndisponible, refusDeGit } from '../guards/lib/gitPorte.mjs'

export const FILE_TIMEOUT_MIN = 2 * DELAI_DE_REPONSE_MINUTES

export function lancementNpm(script, platform) {
  const win32 = platform === 'win32'
  return { executable: win32 ? 'npm.cmd' : 'npm', args: ['run', script], shell: win32 }
}

/**
 * Options de la ligne de commande. PURE — grammaire propre (drapeaux booléens + une option à
 * valeur) : `separerInvocation` lit `<positionnel> [--opt val]* -- reste`, une grammaire qui n'est
 * pas la nôtre.
 * @param {string[]} argv arguments APRÈS `node publier.mjs`
 * `--veiller <run>` prend un identifiant de run (`idDeRun`), `--depuis <seq>` un entier ≥ 0, chaque clé de `valeurs`
 * un nombre > 0 ; toute autre valeur, absente comprise, est rendue inconnue, et la commande refuse AVANT de détacher
 * (#2603). `--constat` ne vaut qu'avec `--veiller`.
 * @returns {{detache:boolean, reprendre:boolean, etapes:boolean, fileTimeoutMin:number, veiller:string|null, depuis:number, constat:boolean, inconnus:string[]}}
 */
export function optionsDe(argv) {
  const args = (argv ?? []).map(String)
  const connus = new Set(['--detache', '--reprendre', '--etapes', '--constat'])
  const valeurs = { '--file-timeout-min': FILE_TIMEOUT_MIN }
  const inconnus = []
  let veiller = null
  let depuis = 0
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i]
    if (a === '--depuis') {
      const seq = args[i + 1]
      if (/^\d+$/.test(String(seq ?? ''))) depuis = Number(seq)
      else inconnus.push(`--depuis ${seq ?? ''}`.trim())
      i += 1
      continue
    }
    if (a === '--veiller') {
      const run = args[i + 1]
      if (pidDeRun(run) === null) inconnus.push(`--veiller ${run ?? ''}`.trim())
      else veiller = run
      i += 1
      continue
    }
    if (Object.hasOwn(valeurs, a)) {
      const brut = args[i + 1]
      const n = Number(brut)
      if (Number.isFinite(n) && n > 0) valeurs[a] = n
      else inconnus.push(`${a} ${brut ?? ''}`.trim())
      i += 1
      continue
    }
    if (!connus.has(a)) inconnus.push(a)
  }
  if (args.includes('--constat') && veiller === null) inconnus.push('--constat')
  return {
    detache: args.includes('--detache'),
    reprendre: args.includes('--reprendre'),
    etapes: args.includes('--etapes'),
    fileTimeoutMin: valeurs['--file-timeout-min'],
    veiller,
    depuis,
    constat: veiller !== null && args.includes('--constat'),
    inconnus,
  }
}

/** Identifiant d'un RUN du train : le pid de son processus et l'instant (ms) de son lancement, que le
 *  parent de `--detache` choisit AVANT de détacher. PURE. */
export const idDeRun = ({ pid, lancement }) => `${pid}-${lancement}`

/** Le pid et le lancement d'un identifiant de run, `null` s'il n'en est pas un. PURE. */
export function runDe(run) {
  const vu = /^([1-9]\d*)-(\d+)$/.exec(String(run ?? ''))
  return vu ? { pid: Number(vu[1]), lancement: Number(vu[2]) } : null
}

/** Le pid d'un identifiant de run, `null` s'il n'en est pas un. PURE. */
export const pidDeRun = (run) => runDe(run)?.pid ?? null

/** La variable d'environnement qui porte le lancement du parent de `--detache` à l'enfant. */
export const ENV_LANCEMENT = 'WFRP_PUBLIER_LANCEMENT'

/** L'environnement que le parent de `--detache` passe à l'enfant pour son lancement. PURE. */
export const envDeLancement = (lancement) => ({ [ENV_LANCEMENT]: String(lancement) })

/** Le lancement d'un run lu dans `env` (l'enfant de `--detache`), `maintenant()` sinon (run direct). PURE. */
export function lancementDe(env, maintenant = Date.now) {
  const brut = String(env?.[ENV_LANCEMENT] ?? '')
  return /^\d+$/.test(brut) ? Number(brut) : maintenant()
}

/** Nom de fichier de journal d'une branche : tout ce qui n'est ni mot, ni point, ni tiret fond en
 *  `_` (`chantier/1736-publier` → `chantier_1736-publier`). PURE. */
export const nomDeJournal = (branche) => String(branche ?? 'sans-branche').replace(/[^\w.-]+/g, '_')

/** Journal neuf d'une branche. PURE. */
export const journalVide = (branche) => ({ branche, base: null, tete: null, ejections: 0, etapes: {} })

/**
 * Le journal dont un run PART. PURE. Sans `--reprendre`, un run est un LOT NEUF : le journal du
 * disque ne le contamine pas. Sans cela, `ejections` survivait d'un lot à l'autre (un 2ᵉ lot
 * refuserait sa première éjection comme une seconde) et les étapes vertes d'un
 * autre contenu décoreraient son pilotage.
 * @param {{reprendre:boolean, lu:object|null, branche:string}} p `lu` = journal du disque, ou `null`
 * @returns {{journal:object, repris:boolean, vertes:number}}
 */
export function journalInitial({ reprendre, lu, branche }) {
  if (!reprendre || !lu) return { journal: journalVide(branche), repris: false, vertes: 0 }
  const vertes = Object.values(lu.etapes ?? {}).filter((e) => e?.etat === 'vert').length
  return { journal: lu, repris: true, vertes }
}

/**
 * Mode d'ouverture du LOG — il suit `journalInitial` : un run NEUF (sans `--reprendre`) est un lot
 * neuf, son log part VIDE (`'w'`) ; `--reprendre` continue le même lot, donc APPEND (`'a'`). PURE.
 * Mesuré (2026-09-14, premier train réel) : ouvert en `'a'` sans condition, un run neuf écrivait à
 * la suite du précédent, et une veille `until grep -q "^PUBLICATION:" <log>` se déclenchait aussitôt
 * sur la ligne `PUBLICATION:` du run d'avant.
 * `enfant` = le processus spawné par `--detache` : le PARENT a déjà tronqué (mode décidé ici) avant
 * de spawner, donc l'enfant ouvre TOUJOURS en append — sinon il tronquerait le log de son parent.
 * @param {{reprendre?:boolean, enfant?:boolean}} p
 * @returns {'w'|'a'}
 */
export const modeDuLog = ({ reprendre = false, enfant = false } = {}) => (reprendre || enfant ? 'a' : 'w')

/**
 * La ligne que le PARENT laisse dans le log quand il détache l'enfant. PURE.
 * Sans elle, `--detache` ne laisse aucune trace MACHINE : le pid et le log ne sont écrits que sur le
 * stdout du parent, que personne ne conserve (mesuré le 2026-09-14 :
 * `grep -c -E "tach|pid=|log=" node_modules/.cache/publication/chantier_1736-publier.log` → 0 sur
 * 446 lignes, trois trains réels). L'enfant n'y touche pas : il est né après.
 * @param {{pid: number, log: string, args: string[]}} p
 * @returns {string} ligne terminée par un saut
 */
export const ligneDeDetachement = ({ pid, log, args }) =>
  `[publier] détaché — pid=${pid} log=${log} args=${(args ?? []).join(' ')}\n`

/**
 * Le filet de l'enfant détaché (#1784). Détaché, le train n'a plus de stdio redirigé : sa console est
 * CACHÉE, donc tout ce qu'il écrit hors du journal est perdu, et un train né puis MORT avant
 * `ouvrirLog` serait invisible (pid annoncé, journal vide). Ce filet rend la chute par `sortirHorsJournal`
 * (log et trace du run `run`), puis sort sur son code. Le script détaché étant
 * `fileURLToPath(import.meta.url)`, un « module introuvable » n'est atteignable que par un défaut de
 * citation du lancement (`citerArgv`).
 * @param {{chemin:string, run:string, processus?:NodeJS.Process, ecrire?:(chemin:string, texte:string) => void}} p
 * @returns {(e:unknown) => void} le gestionnaire branché, rendu pour le test
 */
export function filetDuTrainEnfant({ chemin, run, processus = process, ecrire = appendFileSync }) {
  const tomber = (e) => {
    const raison = e?.stack ?? String(e)
    processus.exit(sortirHorsJournal({ log: chemin, run, raison, dit: `[publier] ARRÊT INATTENDU hors train : ${raison}`, ecrire }))
  }
  processus.on('uncaughtException', tomber)
  processus.on('unhandledRejection', tomber)
  return tomber
}

/** Le fichier de la TRACE du run `run` dans le dossier de publication `dossier` (#2603). PURE. */
export const cheminDeTrace = (dossier, run) => join(dossier, `sortie-${run}.json`)

/** Motif des traces de `cheminDeTrace`, sur le NOM de fichier. */
const MOTIF_DE_TRACE = /^sortie-[1-9]\d*-\d+\.json$/

/**
 * La sortie d'un enfant de `--detache` dont le verdict ne va pas au journal (#2603) : la TRACE `{ run, verdict }`, une
 * ligne JSON ajoutée à `cheminDeTrace` du dossier du log, dont le run est le seul écrivain, puis `dit` et la ligne
 * `PUBLICATION:` de son verdict `rouge moteur` au `log`. La trace seule porte le verdict : elle s'écrit d'abord, puis les
 * traces de plus de `PEREMPTION_MS` partent (`purger`), puis le log ; une purge ou un log qui lève ne change pas le code
 * rendu. La veille la lit (`verdictDeTrace`) quand le journal ne porte pas son run.
 * @param {{log:string, run:string, raison:string, dit?:string, ecrire?:(chemin:string, texte:string) => void, purger?:typeof purgerPerimes}} p
 * @returns {number} le code du verdict (`codeDeVerdict`)
 */
export function sortirHorsJournal({ log, run, raison, dit = raison, ecrire = appendFileSync, purger = purgerPerimes }) {
  const { verdict, texte, code } = chuteMoteur(raison, { dit })
  ecrire(cheminDeTrace(dirname(log), run), `${JSON.stringify({ run, verdict })}\n`)
  try {
    purger({ dossier: dirname(log), motif: MOTIF_DE_TRACE, ageMs: PEREMPTION_MS })
  } catch {}
  try {
    ecrire(log, texte)
  } catch {}
  return code
}

/**
 * Le verdict que le run `run` a laissé dans sa trace (`sortirHorsJournal`), `null` sans trace à son nom. Une
 * ligne lue à moitié ne se parse pas : rien n'est conclu, le tour suivant la relit (#2603).
 * @param {string} dossier @param {string} run
 * @returns {object|null}
 */
export function verdictDeTrace(dossier, run) {
  let texte
  try {
    texte = readFileSync(cheminDeTrace(dossier, run), 'utf8')
  } catch {
    return null
  }
  for (const ligne of texte.split('\n')) {
    try {
      const vu = JSON.parse(ligne)
      if (vu?.run === run && vu.verdict) return vu.verdict
    } catch {
      /* ligne partielle (#2603) */
    }
  }
  return null
}

/** Nom de ROTATION du log d'un run précédent : `<nom>.<AAAAMMJJ-HHMMSS>.log`, horodaté en heure locale
 *  (celle que l'opérateur lit). PURE. @param {string} chemin log courant @param {Date} date */
export function nomDeRotation(chemin, date) {
  const d = (n, l = 2) => String(n).padStart(l, '0')
  const horodatage =
    `${d(date.getFullYear(), 4)}${d(date.getMonth() + 1)}${d(date.getDate())}` +
    `-${d(date.getHours())}${d(date.getMinutes())}${d(date.getSeconds())}`
  return `${String(chemin).replace(/\.log$/, '')}.${horodatage}.log`
}

/** Motif des logs de ROTATION d'un log courant — il ne matche NI `<nom>.log`, NI le `<nom>.json.<pid>.tmp`
 *  de `ecrireJsonAtomique`. PURE. @param {string} chemin log courant @returns {RegExp} sur le NOM de fichier */
export function motifDeRotation(chemin) {
  const nom = String(chemin).split(/[\\/]/).pop().replace(/\.log$/, '')
  return new RegExp(`^${nom.replace(/[.+^${}()|[\]\\*?]/g, '\\$&')}\\.\\d{8}-\\d{6}\\.log$`)
}

/**
 * ROTATION du log : un log NON VIDE est renommé (`nomDeRotation`) avant qu'un run neuf ne reparte —
 * la trace du run précédent survit, et le log courant repart vide. Le bornage est par PÉREMPTION d'ÂGE, par la source unique
 * `purgerPerimes` — aucune constante de compte ici. Ce n'est PAS une archive :
 * `node_modules/.cache/` est effacé par le `npm ci` d'`ops:chantier` — le log est une trace de
 * travail, la PREUVE d'une publication est sa sortie collée au ticket.
 * @param {string} chemin log courant @param {Date} date
 * @returns {string|null} le chemin du log tourné, `null` si rien n'a été tourné
 */
export function rotationnerLog(chemin, date = new Date()) {
  let tourne = null
  try {
    if (statSync(chemin).size > 0) {
      tourne = nomDeRotation(chemin, date)
      renameSync(chemin, tourne)
    }
  } catch {
    /* log absent, ou tenu par un autre processus : le run neuf repart vide de toute façon */
    tourne = null
  }
  purgerPerimes({ dossier: join(chemin, '..'), motif: motifDeRotation(chemin), ageMs: PEREMPTION_MS })
  return tourne
}

/**
 * Ouvre le log dans le mode décidé par `modeDuLog`. Le fd rendu est TOUJOURS en `'a'` : en mode
 * détaché, le MÊME fichier porte deux écrivains (le fd hérité comme stdout/stderr de l'enfant, et
 * le fd que l'enfant ouvre pour `journaliser`) — deux fds à offset propre se piétineraient, deux
 * fds en append jamais. Le `'w'` se joue donc par une ROTATION puis une TRONCATURE explicite, une
 * seule fois.
 * @param {string} chemin @param {'w'|'a'} mode
 */
export function ouvrirLog(chemin, mode) {
  if (mode === 'w') {
    rotationnerLog(chemin)
    writeFileSync(chemin, '')
  }
  return openSync(chemin, 'a')
}


/** Code de sortie d'un verdict indéterminé (la file n'a pas fusionné dans sa borne). */
export const CODE_INDETERMINEE = 3

/** Code de sortie d'un ARRÊT MOTEUR : verdict `rouge moteur`, ou train mort sans verdict au journal. */
export const CODE_ARRET_MOTEUR = 4

/** Code de sortie de la veille quand sa borne (`borneDeVeilleMin`) passe sans verdict. */
export const CODE_BORNE_DEPASSEE = 5

/**
 * L'en-tête du run qui PART sur `journal` : son identifiant, son pid et sa `naissance` `{ pid, creation }` (#2603), sa borne de file, son compteur de
 * transitions `seq` à 0 ; le verdict d'un run précédent (journal repris) s'efface. Le journal ainsi estampillé est sauvé AVANT la première
 * étape : c'est lui qui dit à la veille que le run courant a démarré. MUTE `journal`, le rend.
 * @param {object} journal @param {{run:string, pid:number, creation:number, fileTimeoutMin:number}} p
 */
export function entameDuRun(journal, { run, pid, creation, fileTimeoutMin }) {
  return Object.assign(journal, { run, pid, naissance: { pid, creation }, fileTimeoutMin, seq: 0, verdict: null })
}

/** La `creation` que le pid `pid` a inscrite de lui-même à l'entame de `journal` ; `NAISSANCE_ABSENTE` sans `naissance` (journal d'avant #2603) ou si elle date un autre pid. PURE. */
export const naissanceDuPid = (journal, pid) => (journal?.naissance && journal.naissance.pid === pid ? journal.naissance.creation : NAISSANCE_ABSENTE)

/** Le run SANS VERDICT de `journal` vit-il ? Son `pid`, jugé né à sa `naissanceDuPid` (`estPidVivantDepuis`, #2603). PURE hors de `identite` et `estVivant`.
 *  @param {object|null} journal @param {{ lireCreation: (pid: number) => number | null, toleranceMs: number }} identite
 *  @param {{ estVivant?: (pid: number) => boolean }} [options] */
export const runEnVol = (journal, identite, options) =>
  !journal?.verdict && estPidVivantDepuis(journal?.pid, naissanceDuPid(journal, journal?.pid), identite, options)

/** La ligne `PUBLICATION:` d'un verdict — la dernière du log du train, et celle de sa veille. PURE. */
export function ligneDePublication(verdict, tete) {
  if (verdict.etat === 'vert') return `PUBLICATION: vert ${tete}`
  if (verdict.etat === 'indeterminee') return `PUBLICATION: indéterminée file ${tete}`
  return `PUBLICATION: rouge ${verdict.etape} — ${String(verdict.raison).split('\n')[0]}`
}

/** Le refus d'une ligne de commande aux options `inconnus` (`optionsDe`), usage compris. PURE. */
export const refusDOptions = (inconnus) =>
  `[publier] option inconnue : ${inconnus.join(' ')}\n  usage : node scripts/ops/publier.mjs [--detache] [--reprendre] [--etapes] [--file-timeout-min <n>] [--veiller <run> [--depuis <seq>] [--constat]]`

/** La raison d'une erreur `e` : le refus nommé d'une panne git (`refusDeGit`), son message sinon. PURE. */
export const raisonDeLErreur = (e) => (e instanceof GitIndisponible ? refusDeGit(e) : String(e?.message ?? e))

/**
 * La CHUTE `rouge moteur` de `raison` : son verdict, son texte (`dit`, puis sa ligne `PUBLICATION:` à la tête `tete`) et
 * son code (`codeDeVerdict`). L'appelant n'en garde que son écriture (log, stderr, journal). PURE.
 * @param {string} raison @param {{dit?:string, tete?:string|null}} [p]
 * @returns {{verdict:{etat:'rouge', etape:'moteur', raison:string}, texte:string, code:number}}
 */
export function chuteMoteur(raison, { dit = raison, tete } = {}) {
  const verdict = { etat: 'rouge', etape: 'moteur', raison }
  return { verdict, texte: `${dit}\n${ligneDePublication(verdict, tete)}\n`, code: codeDeVerdict(verdict) }
}

/** Code de sortie d'un verdict, pour le train comme pour sa veille. PURE. */
export function codeDeVerdict(verdict) {
  if (verdict.etat === 'vert') return 0
  if (verdict.etat === 'indeterminee') return CODE_INDETERMINEE
  return verdict.etape === 'moteur' ? CODE_ARRET_MOTEUR : 1
}


/**
 * La commande de veille d'un run, que `--detache` imprime : `node` direct (aucun en-tête `npm` dans la
 * sortie suivie), chemin en `/`, lisible de Git Bash comme de PowerShell. COMPOSITE (#2493) : la veille,
 * puis `--constat` après sa sortie quelle qu'elle soit (`;` en bash comme en PowerShell) ; le code est celui
 * du constat, un code de verdict. `depuis` : le dernier `#seq` lu, pour la ré-armer. PURE.
 * @param {{script:string, run:string, depuis?:number}} p
 */
export function commandeDeVeille({ script, run, depuis }) {
  const node = `node "${String(script).replace(/\\/g, '/')}" --veiller ${run}`
  return `${node}${depuis === undefined ? '' : ` --depuis ${depuis}`}; ${node} --constat`
}


/** Chemins du journal et du log d'une branche. */
export const cheminsDeJournal = (racine, branche) => {
  const dossier = join(racine, 'node_modules', '.cache', 'publication')
  const nom = nomDeJournal(branche)
  return { dossier, json: join(dossier, `${nom}.json`), log: join(dossier, `${nom}.log`) }
}


/** Journal lu sur disque, ou neuf. */
export function lireJournal(chemin, branche) {
  try {
    const lu = JSON.parse(readFileSync(chemin, 'utf8'))
    return { ...journalVide(branche), ...lu, etapes: lu.etapes ?? {} }
  } catch {
    return journalVide(branche)
  }
}

