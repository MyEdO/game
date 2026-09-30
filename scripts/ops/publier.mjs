// PUBLICATION — le TRAIN, en un processus du dépôt.
//
// INVARIANT (ticket #1736, « Design », 2026-09-14) : « La PUBLICATION est un train d'ÉTAPES FIXES,
// jouées par UN processus du dépôt, détaché du harnais, idempotent et REPRENABLE ; l'orchestrateur
// lance, lit un journal, juge le contenu — il ne joue plus aucune étape à la main. Critère
// "l'étape N+1 coûte une ligne" : ajouter une étape = une entrée dans la table `ETAPES` (nom,
// `jouer(ctx)`, `dejaFaite(ctx)`), rien d'autre. » La table vit dans `etapesDuTrain.mjs`.
//
// RÉGIME (#2178) : commit FINAL → push de la BRANCHE → PR → course verte de la branche → demande de
// fusion REST (`merge-async`) → la FILE DE FUSION du serveur sérialise, juge le commit de file et fusionne. Aucune gate ne se joue ici :
// `.github/workflows/ci.yml` les joue toutes, et le ruleset `main` (`scripts/ops/ruleset-main.mjs`)
// n'admet rien hors de la file. HUIT étapes — preflight, derives, docs, push-branche, pr, file,
// pilotage, fin :
// preflight (une saleté faite UNIQUEMENT de docs DÉRIVÉS ne refuse pas : l'étape `derives` la
// commet ; les compteurs de version contre `origin/main` n'y sont qu'un AVERTISSEMENT), derives (les
// docs dérivés laissés non commités par un hook `post-rewrite`), docs dérivés régénérés — la plage
// sans source de doc saute la RÉGÉNÉRATION, jamais le COMMIT —, push de la branche, PR créée, attente
// bornée de la course verte de la tête, de sa demande de fusion (`sha` = la tête jugée) puis de la
// fusion par la file, pilotage des tickets
// cités, fin. Aucun client ne rebase sur un tronc mouvant : une PR ÉJECTÉE de la file pour un conflit
// ou un dérivé périmé se reprend par une FUSION d'`origin/main` dans la branche, puis docs →
// push-branche → pr → file, bornée par le compteur `ejections` (`BORNE_EJECTIONS`).
//
// CLÔTURE DES ÉTAPES, gardée contre une retouche de bonne foi — les étapes vivent dans
// `etapesDuTrain.mjs`, et le test de clôture (`etapesDuTrain.test.mjs`) refuse à ce module toute
// liaison, importée de n'importe quel module de sa clôture, qui atteint un lancement de processus
// par l'une des SOURCES de capacité de sa table : import d'un module intégré hors de ses inertes,
// import d'un paquet, import d'un module du dépôt qui l'exporte lanceuse ou n'est pas lu, import
// dynamique ou `require`, `createRequire`/`getBuiltinModule`/`binding`, accès ambiant (global lu hors
// de ses inertes), évaluation ; `import.meta` est inerte. Résidu que le test ne garde pas :
// évaluation par `.constructor`, état mutable posé par un autre module, effet au chargement d'un
// module de la clôture (#2073). Une étape passe par le contexte (`contexteDe`), qui porte des
// QUESTIONS (`questionsDuTrain`) et des gestes NOMMÉS aux arguments validés — `commitDe` (des
// FICHIERS, sous `--literal-pathspecs`),
// `fusionner`, `abandonnerFusion`, `pousser`, `fetchOrigin` sous `tronc` (`gitPorte.mjs`), `npm` (un
// nom de script), `docs` (un mode de build-all), `coursesCi` (un sha), `coursesDeFile`, `parentsDe` (un
// sha), `jobsRouges` (un id de course), `lirePr`, `ouvrirPr`, `demanderFusion` (un numéro et un sha), `lireFusion` (un
// numéro et un uuid), `lireTicket` et `commenter`
// (un numéro de ticket) —, jamais la poignée du dépôt ni un argv libre. Ce fichier ne porte aucun
// `gh issue close` (la fermeture appartient au job `fermetures` de la CI). D'où, pour les étapes :
// ni `git add -A`, ni un commit de l'arbre ou de l'index entier, ni `git stash`, ni `push --force`,
// ni aucun push vers `main` (`pousser` le refuse), ni `reset --hard`, `branch -D`,
// `worktree remove --force`, `checkout` ou `restore`.
// Un rebase INTERROMPU trouvé sur disque à la préflight est NOMMÉ, jamais avorté d'office.
//
// Usage : node scripts/ops/publier.mjs [--detache] [--reprendre] [--etapes] [--file-timeout-min <n>] [--veiller <run>]
// `--veiller <run>` suit le run nommé par `--detache` (`veillerLeTrain`), sans rien jouer.
import { spawnSync, spawn } from 'node:child_process'
import { appendFileSync, closeSync, existsSync, mkdirSync, openSync, readFileSync, renameSync, statSync, writeFileSync, writeSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  GitIndisponible, TRONC, abandonnerFusion, baseCommune, brancheDe, ceQuiChange, cheminsEnConflit, combienDe, commitDe, depotDe,
  estAncetre, etatDeLArbre, fetchOrigin, fusionner, origineDe, pousser, racineDe, rebaseEntame, shaDe,
} from '../guards/lib/gitPorte.mjs'
import { BORNE_RAISON, DEPOT, lireTicket, poserCommentaire } from '../guards/lib/ticketsGh.mjs'
import { coursesCi, jobsRougesDe } from '../guards/lib/coursesCi.mjs'
import { gatesDeCi, texteDeCi } from '../gates/gatesDeCi.mjs'
import { DOSSIER, PORTE, branchesDePush } from '../gates/workflowsDuDepot.mjs'
import { DELAI_DE_REPONSE_MINUTES } from './ruleset-main.mjs'
import { refusDesCompteurs } from '../guards/lib/compteursDuDepot.mjs'
import { commitsDeLaPlage } from '../guards/lib/plageFermante.mjs'
import { GENERATORS } from '../docs/build-all.mjs'
import { PEREMPTION_MS, purgerPerimes } from '../guards/lib/purgerPerimes.mjs'
import { BORNE_EJECTIONS, ETAPES, attendre, issueDeFusion, prDeRest } from './etapesDuTrain.mjs'

/** L'arbre où VIT ce script — jamais `process.cwd()` : le train publie SON worktree. */
export const RACINE = fileURLToPath(new URL('../..', import.meta.url))

/** Délai par défaut, en minutes, de l'attente de la fusion par la file (#2178) : deux délais de réponse
 *  de la file (`DELAI_DE_REPONSE_MINUTES`) — les entrées qui la précèdent, puis la sienne. */
export const FILE_TIMEOUT_MIN = 2 * DELAI_DE_REPONSE_MINUTES

/** Les gates qui jugent les DÉRIVÉS commités : une course de file rouge sur leurs seuls jobs se
 *  reprend (`causeDEjection`, etapesDuTrain.mjs), la régénération les guérit. */
export const GATES_DES_DERIVES = Object.freeze(['docs:check:tout', 'docs:empreinte', 'agents:check'])

// ── Purs : options, journal, plan ──────────────────────────────────────────────────────

/**
 * Options de la ligne de commande. PURE — grammaire propre (drapeaux booléens + une option à
 * valeur) : `separerInvocation` lit `<positionnel> [--opt val]* -- reste`, une grammaire qui n'est
 * pas la nôtre.
 * @param {string[]} argv arguments APRÈS `node publier.mjs`
 * `--veiller <run>` prend un identifiant de run (`idDeRun`) ; toute autre valeur est rendue inconnue.
 * @returns {{detache:boolean, reprendre:boolean, etapes:boolean, fileTimeoutMin:number, veiller:string|null, inconnus:string[]}}
 */
export function optionsDe(argv) {
  const args = (argv ?? []).map(String)
  const connus = new Set(['--detache', '--reprendre', '--etapes', '--file-timeout-min'])
  const valeurs = { '--file-timeout-min': FILE_TIMEOUT_MIN }
  const inconnus = []
  let veiller = null
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i]
    if (a === '--veiller') {
      const run = args[i + 1]
      if (pidDeRun(run) === null) inconnus.push(`--veiller ${run ?? ''}`.trim())
      else veiller = run
      i += 1
      continue
    }
    if (Object.hasOwn(valeurs, a)) {
      const n = Number(args[i + 1])
      if (Number.isFinite(n) && n > 0) valeurs[a] = n
      i += 1
      continue
    }
    if (!connus.has(a)) inconnus.push(a)
  }
  return {
    detache: args.includes('--detache'),
    reprendre: args.includes('--reprendre'),
    etapes: args.includes('--etapes'),
    fileTimeoutMin: valeurs['--file-timeout-min'],
    veiller,
    inconnus,
  }
}

/** Identifiant d'un RUN du train : le pid de son processus et l'instant (ms) de son lancement, que le
 *  parent de `--detache` choisit AVANT de détacher. PURE. */
export const idDeRun = ({ pid, lancement }) => `${pid}-${lancement}`

/** Le pid d'un identifiant de run, `null` s'il n'en est pas un. PURE. */
export function pidDeRun(run) {
  const vu = /^([1-9]\d*)-(\d+)$/.exec(String(run ?? ''))
  return vu ? Number(vu[1]) : null
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
 * Un token de ligne de commande Win32 : ce que `CommandLineToArgvW` (donc `node`, donc tout
 * exécutable C) relira comme UN argument. PURE. `Start-Process -ArgumentList` JOINT ses éléments par
 * des espaces SANS les re-citer : sans ce passage, `['arg avec espace']` arrive au train en trois
 * arguments (mesuré le 2026-09-17), et un script dont le CHEMIN porte un espace n'est pas trouvé.
 * Règle Win32 : le token est entouré de guillemets doubles ; les backslashes qui PRÉCÈDENT un
 * guillemet — ou la fin du token — se doublent ; le guillemet interne s'échappe en `\\"`.
 * @param {string} valeur
 * @returns {string} token cité
 */
export function citerArgv(valeur) {
  const texte = String(valeur)
  let token = '"'
  let backslashes = 0
  for (const caractere of texte) {
    if (caractere === '\\') {
      backslashes += 1
      continue
    }
    if (caractere === '"') {
      token += '\\'.repeat(backslashes * 2 + 1) + '"'
      backslashes = 0
      continue
    }
    token += '\\'.repeat(backslashes) + caractere
    backslashes = 0
  }
  return `${token}${'\\'.repeat(backslashes * 2)}"`
}

/**
 * Le seul site de détachement du TRAIN (#1784) — `spawnBorne` (scripts/gates/toutes.mjs) en détache aussi ses
 * gates, mais sous POSIX seulement (`detached: process.platform !== 'win32'`) : sous win32 elles
 * héritent de la console de l'appelant. Sous win32, `spawn({ detached: true })` pose
 * `DETACHED_PROCESS` (libuv) : le train n'a AUCUNE console, et chacun de ses enfants console
 * (`git`, `gh`, `npm`, `node`) en ALLOUE une, visible au premier plan ; `Start-Process -WindowStyle
 * Hidden` n'en ouvre qu'une, celle du train, CACHÉE, dont ses enfants héritent. Le pid rendu est
 * celui du NODE du train (`-PassThru`), jamais celui du `powershell` intermédiaire, qui rend la main
 * aussitôt et meurt sans emporter le train. Aucune redirection n'est demandée à `Start-Process` : le
 * train ouvre LUI-MÊME son journal (`modeDuLog`) et le passe en stdio à ses enfants, et
 * `-RedirectStandard*` retiendrait le `powershell` jusqu'à la fin du train.
 * @param {{script:string, args:string[], cwd:string, fdLog:number, envSupplementaire?:Record<string,string>,
 *          plateforme?:string, node?:string, detacher?:Function, executerSync?:Function}} p
 * @returns {number|undefined} pid du processus NODE du train
 */
export function lancerDetache({
  script,
  args,
  cwd,
  fdLog,
  envSupplementaire = {},
  plateforme = process.platform,
  node = process.execPath,
  detacher = spawn,
  executerSync = spawnSync,
}) {
  const env = { ...process.env, ...envSupplementaire }
  if (plateforme !== 'win32') {
    const enfant = detacher(node, [script, ...args], { cwd, detached: true, stdio: ['ignore', fdLog, fdLog], env })
    enfant.unref()
    return enfant.pid
  }
  const cite = (valeur) => `'${String(valeur).replace(/'/g, "''")}'`
  const liste = [script, ...args].map((a) => cite(citerArgv(a))).join(',')
  const vu = executerSync(
    'powershell.exe',
    [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      `(Start-Process -FilePath ${cite(node)} -ArgumentList ${liste} -WindowStyle Hidden -PassThru).Id`,
    ],
    { cwd, env, encoding: 'utf8', windowsHide: true },
  )
  const pid = Number(String(vu?.stdout ?? '').trim().split(/\s+/).pop())
  if (!Number.isInteger(pid) || pid <= 0) {
    throw new Error(
      `[publier] détachement manqué : powershell a rendu « ${String(vu?.stdout ?? '').trim()} » ${String(vu?.stderr ?? '').trim()}`,
    )
  }
  return pid
}

/**
 * Le filet de l'enfant détaché (#1784). Détaché, le train n'a plus de stdio redirigé : sa console est
 * CACHÉE, donc tout ce qu'il écrit hors du journal est perdu, et un train né puis MORT avant
 * `ouvrirLog` serait invisible (pid annoncé, journal vide). Ce filet écrit la chute DANS le log, avec
 * sa ligne `PUBLICATION:`, puis sort en 1 ; la veille (`veillerLeTrain`) constate la mort du pid. Le script détaché étant
 * `fileURLToPath(import.meta.url)`, un « module introuvable » n'est atteignable que par un défaut de
 * citation du lancement (`citerArgv`).
 * @param {{chemin:string, processus?:NodeJS.Process, ecrire?:Function}} p
 * @returns {(e:unknown) => void} le gestionnaire branché, rendu pour le test
 */
export function filetDuTrainEnfant({ chemin, processus = process, ecrire = appendFileSync }) {
  const tomber = (e) => {
    const trace = e?.stack ?? String(e)
    ecrire(chemin, `[publier] ARRÊT INATTENDU hors train : ${trace}\nPUBLICATION: rouge moteur — ${trace.split('\n')[0]}\n`)
    processus.exit(1)
  }
  processus.on('uncaughtException', tomber)
  processus.on('unhandledRejection', tomber)
  return tomber
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
 *  de `sauverJournal`. PURE. @param {string} chemin log courant @returns {RegExp} sur le NOM de fichier */
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
function ouvrirLog(chemin, mode) {
  if (mode === 'w') {
    rotationnerLog(chemin)
    writeFileSync(chemin, '')
  }
  return openSync(chemin, 'a')
}

/**
 * Première étape NON VERTE du journal — le point de reprise. Une étape verte POUR UNE AUTRE TÊTE est
 * « à faire » : sans cela, un 2ᵉ lot sur la même branche sauterait l'attente de la file et le pilotage et
 * s'annoncerait vert. PURE.
 *
 * RÈGLE DE TÊTE, une seule : la comparaison porte sur la TÊTE VIVANTE (`git rev-parse HEAD` au
 * moment où l'on juge), jamais sur `journal.tete` (la tête PUBLIÉE, posée par `preflight`/`derives`), et
 * une étape SANS estampille est « à faire ». Sans cela, une étape estampillée `null` (`preflight` et
 * `derives` d'un journal d'avant cette règle) restait verte pour TOUTE tête, à jamais.
 * @param {{etapes?:object}} journal @param {string[]} noms ordre de `ETAPES`
 * @param {string|null} teteVivante `HEAD` mesuré maintenant
 * @returns {string|null} `null` = tout est vert pour cette tête
 */
export function planDeReprise(journal, noms, teteVivante) {
  const etapes = journal?.etapes ?? {}
  for (const nom of noms) {
    const vue = etapes[nom]
    if (!vue || vue.etat !== 'vert') return nom
    if (vue.tete == null || vue.tete !== teteVivante) return nom
  }
  return null
}

/** État affiché d'une étape au journal (`--etapes`), sous la MÊME règle de tête que `planDeReprise`. PURE. */
export const etatDeLEtape = (journal, nom, teteVivante) => {
  const vue = journal?.etapes?.[nom]
  if (!vue) return 'à faire'
  if (vue.etat === 'vert' && (vue.tete == null || vue.tete !== teteVivante)) return 'à faire (verte pour une autre tête)'
  return vue.etat
}

// ── Purs : le run courant et sa veille (#2227) ────────────────────────────────────────────────

/** Code de sortie d'un verdict indéterminé (la file n'a pas fusionné dans sa borne). */
export const CODE_INDETERMINEE = 3

/** Code de sortie d'un ARRÊT MOTEUR : verdict `rouge moteur`, ou train mort sans verdict au journal. */
export const CODE_ARRET_MOTEUR = 4

/** Code de sortie de la veille quand sa borne (`borneDeVeilleMin`) passe sans verdict. */
export const CODE_BORNE_DEPASSEE = 5

/**
 * L'en-tête du run qui PART sur `journal` : son identifiant, son pid, sa borne de file ; le verdict d'un
 * run précédent (journal repris) s'efface. Le journal ainsi estampillé est sauvé AVANT la première
 * étape : c'est lui qui dit à la veille que le run courant a démarré. MUTE `journal`, le rend.
 * @param {object} journal @param {{run:string, pid:number, fileTimeoutMin:number}} p
 */
export function entameDuRun(journal, { run, pid, fileTimeoutMin }) {
  return Object.assign(journal, { run, pid, fileTimeoutMin, verdict: null })
}

/** La ligne `PUBLICATION:` d'un verdict — la dernière du log du train, et celle de sa veille. PURE. */
export function ligneDePublication(verdict, tete) {
  if (verdict.etat === 'vert') return `PUBLICATION: vert ${tete}`
  if (verdict.etat === 'indeterminee') return `PUBLICATION: indéterminée file ${tete}`
  return `PUBLICATION: rouge ${verdict.etape} — ${String(verdict.raison).split('\n')[0]}`
}

/** Code de sortie d'un verdict, pour le train comme pour sa veille. PURE. */
export function codeDeVerdict(verdict) {
  if (verdict.etat === 'vert') return 0
  if (verdict.etat === 'indeterminee') return CODE_INDETERMINEE
  return verdict.etape === 'moteur' ? CODE_ARRET_MOTEUR : 1
}

/**
 * Borne de la veille, en minutes, DÉRIVÉE de celle du train : l'étape `file` se joue au plus
 * `BORNE_EJECTIONS + 1` fois, chacune bornée par `fileTimeoutMin`, et les étapes locales reçoivent une
 * borne de file de plus. PURE.
 */
export const borneDeVeilleMin = (fileTimeoutMin) => (BORNE_EJECTIONS + 2) * fileTimeoutMin

/** La commande de veille d'un run, que `--detache` imprime : `node` direct (aucun en-tête `npm` dans la
 *  sortie suivie), chemin en `/`, lisible de Git Bash comme de PowerShell. PURE. */
export const commandeDeVeille = ({ script, run }) => `node "${String(script).replace(/\\/g, '/')}" --veiller ${run}`

/** Un `dit` en UNE ligne : la veille émet une ligne par transition. PURE. */
const enUneLigne = (texte) => String(texte).split('\n').map((l) => l.trim()).filter(Boolean).join(' · ')

/**
 * Les TRANSITIONS du run `run` absentes de `emis`, dans l'ordre de `noms`, et son verdict.
 * Une étape ne compte que si le run courant l'a écrite (`run`) ; sa clé est son état et son début, donc
 * une étape en vol relue à chaque sondage ne se répète pas, et une étape rejouée après une relance
 * s'émet à nouveau. PURE hors de `emis` (Map nom → clé émise), qu'elle complète.
 * @param {object|null} journal @param {string} run @param {Map<string,string>} emis @param {string[]} noms
 * @returns {{courant:boolean, lignes:string[], verdict:object|null}}
 */
export function transitionsDuRun(journal, run, emis, noms) {
  if (!journal || journal.run !== run) return { courant: false, lignes: [], verdict: null }
  const lignes = []
  for (const nom of noms) {
    const vue = journal.etapes?.[nom]
    if (!vue || vue.run !== run) continue
    const cle = `${vue.etat}@${vue.debut ?? ''}`
    if (emis.get(nom) === cle) continue
    emis.set(nom, cle)
    lignes.push(`${nom} — ${vue.etat}${vue.dit ? ` — ${enUneLigne(vue.dit)}` : ''}`)
  }
  return { courant: true, lignes, verdict: journal.verdict ?? null }
}

/**
 * Le MOTEUR du train : joue les étapes dans l'ordre, saute celles que `dejaFaite` déclare, arrête à
 * la première rouge, écrit le journal à l'ENTRÉE de chaque étape jouée (`en-vol`) et après son verdict ;
 * chaque étape y porte le `run` qui l'a écrite et son `dit` (le `dit` d'un vert, la `raison` sinon). PUR hors des `jouer` qu'on lui donne —
 * testable avec des étapes factices.
 *
 * Une étape peut demander une RELANCE (`{ relancer: [<noms>] }`, cas « PR éjectée de la file ») : les
 * étapes nommées repassent « à faire » et le train reprend du début. Le compteur `ejections` du
 * journal est la borne, et l'étape qui demande la relance la lit.
 * @returns {{etat:'vert'|'rouge'|'indeterminee', etape?:string, raison?:string}}
 */
export function jouerLeTrain(ctx, etapes, journal, { sauver = () => {}, journaliser = () => {} } = {}) {
  const noms = etapes.map((e) => e.nom)
  for (let tour = 0; tour <= etapes.length; tour += 1) {
    let relance = null
    for (const etape of etapes) {
      if (etape.dejaFaite(ctx, journal)) {
        // Une étape déjà faite s'ENREGISTRE, estampillée comme une étape jouée : sans cela, le journal
        // d'un run repris ne portait AUCUNE trace machine des étapes constatées, et `--etapes` les
        // rendait « à faire » après coup. Le détail précédent est CONSERVÉ : `file.dejaFaite` le
        // relit (`detail.fusion`), l'écraser referait attendre la file à chaque reprise.
        // Une étape DÉJÀ verte garde le `run` qui l'a rendue verte : aucune transition, la veille
        // (`transitionsDuRun`) se tait ; toute autre devient un fait du run courant.
        const vu = journal.etapes[etape.nom]
        const instant = new Date().toISOString()
        journal.etapes[etape.nom] = {
          etat: 'vert',
          debut: instant,
          fin: instant,
          detail: { ...(vu?.detail ?? {}), dejaFaite: true },
          tete: ctx.tete ?? null,
          run: vu?.etat === 'vert' ? (vu.run ?? null) : (journal.run ?? null),
          dit: 'déjà faite',
        }
        sauver(journal)
        journaliser(`[publier] ${etape.nom} — déjà faite\n`)
        continue
      }
      journaliser(`[publier] ${etape.nom} — début\n`)
      const debut = Date.now()
      journal.etapes[etape.nom] = {
        etat: 'en-vol',
        debut: new Date(debut).toISOString(),
        detail: journal.etapes[etape.nom]?.detail ?? null,
        tete: ctx.tete ?? null,
        run: journal.run ?? null,
      }
      sauver(journal)
      const vu = etape.jouer(ctx, journal) ?? { ok: false, raison: 'aucun verdict rendu' }
      const secondes = (Date.now() - debut) / 1000
      journal.etapes[etape.nom] = {
        etat: vu.ok ? 'vert' : vu.indetermine ? 'indéterminée' : 'rouge',
        debut: new Date(debut).toISOString(),
        fin: new Date().toISOString(),
        detail: vu.detail ?? null,
        tete: ctx.tete ?? null,
        run: journal.run ?? null,
        dit: (vu.ok ? vu.dit : vu.raison) ?? null,
      }
      sauver(journal)
      if (vu.ok) {
        journaliser(`[publier] ${etape.nom} — vert (${secondes.toFixed(1)} s)${vu.dit ? ` : ${vu.dit}` : ''}\n`)
        if (vu.relancer) {
          relance = vu.relancer
          break
        }
        continue
      }
      if (vu.indetermine) {
        journaliser(`[publier] ${etape.nom} — INDÉTERMINÉE : ${vu.raison}\n`)
        return { etat: 'indeterminee', etape: etape.nom, raison: vu.raison }
      }
      journaliser(`[publier] ${etape.nom} — ROUGE : ${vu.raison}\n`)
      return { etat: 'rouge', etape: etape.nom, raison: vu.raison }
    }
    if (!relance) return { etat: 'vert' }
    for (const nom of relance) if (noms.includes(nom)) journal.etapes[nom] = { etat: 'à faire', tete: null, run: journal.run ?? null, dit: `relance depuis ${relance[0]}` }
    sauver(journal)
    journaliser(`[publier] relance du train depuis ${relance[0]}\n`)
  }
  return { etat: 'rouge', etape: 'moteur', raison: 'trop de relances du train' }
}

// ── Impur : le train réel ──────────────────────────────────────────────────────────────

/** Chemins du journal et du log d'une branche. */
export const cheminsDeJournal = (racine, branche) => {
  const dossier = join(racine, 'node_modules', '.cache', 'publication')
  const nom = nomDeJournal(branche)
  return { dossier, json: join(dossier, `${nom}.json`), log: join(dossier, `${nom}.log`) }
}

/** Écriture ATOMIQUE du journal (temporaire + renommage). */
export function sauverJournal(chemin, journal) {
  mkdirSync(join(chemin, '..'), { recursive: true })
  const tmp = `${chemin}.${process.pid}.tmp`
  writeFileSync(tmp, `${JSON.stringify(journal, null, 2)}\n`)
  renameSync(tmp, chemin)
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

/** Période de relecture du journal par la veille, en millisecondes (un fichier local). */
export const PERIODE_DE_VEILLE_MS = 5_000

/** Le processus `pid` vit-il ? `kill(pid, 0)` ne signale rien : il sonde (EPERM = vivant, hors de nos droits). */
function vivant(pid) {
  try {
    process.kill(pid, 0)
    return true
  } catch (e) {
    return e?.code === 'EPERM'
  }
}

/**
 * La VEILLE d'un run (`--veiller <run>`) : relit le JOURNAL toutes les `periodeMs`, émet une ligne par
 * transition du run courant (`transitionsDuRun`), puis sa ligne `PUBLICATION:` et sort sur son code
 * (`codeDeVerdict`). Tant que le journal porte un autre run (course d'ouverture : le run d'avant), elle
 * se tait. Le train `pidDeRun(run)` mort sans verdict au journal — relu une fois après le constat —
 * sort en `CODE_ARRET_MOTEUR` ; la borne (`borneDeVeilleMin` de la borne de file du run, ou de
 * `fileTimeoutMin` tant qu'il n'a rien écrit) passée sans verdict sort en `CODE_BORNE_DEPASSEE`.
 * @param {{run:string, fileTimeoutMin:number, lire:() => object|null, ecrire:(ligne:string) => void,
 *          noms?:string[], log?:string, vivant?:(pid:number) => boolean, maintenant?:() => number,
 *          dormir?:(ms:number) => void, periodeMs?:number}} p
 * @returns {number} code de sortie
 */
export function veillerLeTrain({
  run,
  fileTimeoutMin,
  lire,
  ecrire,
  noms = ETAPES.map((e) => e.nom),
  log = '',
  vivant: estVivant = vivant,
  maintenant = Date.now,
  dormir = attendre,
  periodeMs = PERIODE_DE_VEILLE_MS,
}) {
  const pid = pidDeRun(run)
  const debut = maintenant()
  const emis = new Map()
  let borneMin = fileTimeoutMin
  let mortConstatee = false
  for (;;) {
    const journal = lire()
    const vu = transitionsDuRun(journal, run, emis, noms)
    for (const ligne of vu.lignes) ecrire(ligne)
    if (vu.courant && Number.isFinite(journal.fileTimeoutMin)) borneMin = journal.fileTimeoutMin
    if (vu.verdict) {
      ecrire(ligneDePublication(vu.verdict, journal.tete))
      return codeDeVerdict(vu.verdict)
    }
    if (!estVivant(pid)) {
      if (mortConstatee) {
        ecrire(ligneDePublication({ etat: 'rouge', etape: 'moteur', raison: `train ${pid} mort sans verdict au journal${log ? ` — ${log}` : ''}` }))
        return CODE_ARRET_MOTEUR
      }
      mortConstatee = true
      continue
    }
    const borneMs = borneDeVeilleMin(borneMin) * 60_000
    if (maintenant() - debut >= borneMs) {
      ecrire(`[veille] borne de ${borneDeVeilleMin(borneMin)} min dépassée sans verdict du run ${run} — \`npm run ops:publier -- --etapes\``)
      return CODE_BORNE_DEPASSEE
    }
    dormir(periodeMs)
  }
}

/** Le dépôt du train dans `racine` : une panne de lecture y LÈVE `GitIndisponible`, et le train
 *  s'arrête ROUGE en la nommant (`main`) — lue `null`, elle passait pour un arbre propre ou pour
 *  l'absence d'un rebase entamé. */
const depotDuTrain = (racine) => depotDe(racine)

/** Chemins que l'état de l'arbre (`etatDeLArbre`) rend SALES, dédupliqués. @param {import('../guards/lib/gitPorte.mjs').Depot} depot */
const cheminsSales = (depot) => [...new Set(etatDeLArbre(depot).flatMap((e) => e.chemins).filter(Boolean))]

/**
 * Les QUESTIONS git des étapes, posées au dépôt `depot` : le contexte les porte à la place de la
 * poignée, qui ouvrirait tout écrivain de l'hôte.
 * @param {import('../guards/lib/gitPorte.mjs').Depot} depot
 */
export const questionsDuTrain = (depot) => Object.freeze({
  shaDe: (ref) => shaDe(depot, ref),
  brancheDe: () => brancheDe(depot),
  origineDe: () => origineDe(depot),
  rebaseEntame: () => rebaseEntame(depot),
  cheminsEnConflit: () => cheminsEnConflit(depot),
  combienDe: (revisions) => combienDe(depot, revisions),
  estAncetre: (ancetre, descendant) => estAncetre(depot, ancetre, descendant),
  refusDesCompteurs: () => refusDesCompteurs(depot, { tete: 'HEAD', tronc: TRONC.suivi }),
  baseAuTronc: () => baseCommune(depot, TRONC.suivi, 'HEAD'),
  ceQuiChange: (avant, apres) => ceQuiChange(depot, avant, apres),
  cheminsSales: () => cheminsSales(depot),
  commitsDeLaPlage: (plage) => commitsDeLaPlage(plage, depot.cwd),
})

/** `gh <args>`, en union simple. Jamais `shell: true`. Un refus garde `stdout` : sous `--include`, un 4xx
 *  y porte son état et son corps (`reponseHttp`). */
function gh(args, cwd, input) {
  const vu = spawnSync('gh', args, {
    cwd, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, timeout: 120_000,
    stdio: [input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'],
    ...(input === undefined ? {} : { input }),
  })
  if (vu.error) return { ok: false, raison: vu.error.message }
  if (vu.status !== 0) return { ok: false, raison: `gh a rendu ${vu.status} : ${String(vu.stderr ?? '').trim().slice(0, BORNE_RAISON)}`, stdout: String(vu.stdout ?? '') }
  return { ok: true, stdout: String(vu.stdout ?? '') }
}

/** La couture `appel(args, { input }) => { ok, stdout, raison }` que `scripts/guards/lib/ticketsGh.mjs`
 *  attend, adossée au `gh` du train — le seul enrobeur qui borne son spawn en TEMPS. */
const appelGh = (racine) => (args, { input } = {}) => gh(args, racine, input)

/** Les modes de `scripts/docs/build-all.mjs` que l'étape `docs` joue. */
const MODES_DES_DOCS = Object.freeze(['--check', '--quiet'])

/**
 * `npm run <script>` sous `platform` : l'exécutable, son argv et `shell`. PURE. `npm` est un `.cmd`
 * sous win32 (nodejs.org/api/child_process.html, « Spawning .bat and .cmd files on Windows »).
 * @param {string} script @param {NodeJS.Platform} platform
 */
export function lancementNpm(script, platform) {
  const win32 = platform === 'win32'
  return { executable: win32 ? 'npm.cmd' : 'npm', args: ['run', script], shell: win32 }
}

/** Un sha COMPLET, sinon levée. */
function shaComplet(geste, sha) {
  if (typeof sha === 'string' && /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/.test(sha)) return sha
  throw new Error(`ctx.${geste} : un sha COMPLET — refusé : ${JSON.stringify(sha)}`)
}

/** Les jobs de `ci.yml` qui portent une gate des dérivés (`GATES_DES_DERIVES`). */
const jobsDesDerives = (racine) =>
  Object.freeze([...new Set(gatesDeCi({ cwd: racine }).filter((g) => GATES_DES_DERIVES.includes(g.nom)).map((g) => g.job))])

/**
 * Les PR de `branche`, réduites (`prDeRest`), récentes d'abord, en union `{ ok, prs }` / `{ ok:false,
 * raison }`. REST seul (#1804) : `GET /repos/{owner}/{repo}/pulls?head=`, puis `GET …/pulls/{n}` de
 * l'OUVERTE, seule lecture qui rend `mergeable_state`.
 */
function lirePr(racine, branche) {
  const proprietaire = DEPOT.split('/')[0]
  const vu = gh(['api', `repos/${DEPOT}/pulls?head=${encodeURIComponent(`${proprietaire}:${branche}`)}&state=all&per_page=10`], racine)
  if (!vu.ok) return vu
  try {
    const liste = JSON.parse(vu.stdout)
    if (!Array.isArray(liste)) return { ok: false, raison: 'réponse REST sans tableau de PR' }
    const ouverte = liste.find((pr) => pr?.state === 'open')
    if (!ouverte) return { ok: true, prs: liste.map(prDeRest) }
    const une = gh(['api', `repos/${DEPOT}/pulls/${ouverte.number}`], racine)
    if (!une.ok) return une
    const detail = JSON.parse(une.stdout)
    return { ok: true, prs: liste.map((pr) => prDeRest(pr.number === detail.number ? detail : pr)) }
  } catch (e) {
    return { ok: false, raison: e.message }
  }
}

/**
 * Une sortie de `gh api --include` : le code de la ligne d'état, puis le corps JSON après la ligne vide.
 * PURE. `gh` rend un code non nul sur un 4xx, mais écrit l'état et le corps sur stdout (mesuré
 * 2026-09-30 : `gh api -i` sur un 404 → `HTTP/2.0 404 Not Found`, en-têtes CRLF, corps JSON, exit 1).
 * @returns {{ok:true, code:number, corps:any}|{ok:false, raison:string}}
 */
export function reponseHttp(sortie) {
  const texte = String(sortie ?? '')
  const etat = /^HTTP\/[\d.]+ (\d{3})/.exec(texte)
  if (!etat) return { ok: false, raison: `réponse sans ligne d’état HTTP : ${JSON.stringify(texte.slice(0, 120))}` }
  const vide = /\r?\n\r?\n/.exec(texte)
  const brut = vide ? texte.slice(vide.index + vide[0].length).trim() : ''
  try {
    return { ok: true, code: Number(etat[1]), corps: brut ? JSON.parse(brut) : null }
  } catch (e) {
    return { ok: false, raison: `HTTP ${etat[1]}, corps illisible : ${e.message}` }
  }
}

/** Le corps de `PUT …/pulls/{n}/merge-async` : `sha` = la tête jugée (« SHA that pull request head
 *  must match to allow merge »), `merge_action: default`. Aucun `merge_method` (« Only supported for
 *  direct merges ») : la file suit sa règle, scripts/ops/ruleset-main.mjs. PURE. */
export const corpsDeFusion = (sha) => JSON.stringify({ sha, merge_action: 'default' })

/** Un appel `gh api --include` de la demande de fusion, réduit par `issueDeFusion` : un 4xx porte un
 *  corps que l'étape lit. PURE. */
export function fusionDe(vu) {
  if (!vu.ok && vu.stdout === undefined) return vu
  const lu = reponseHttp(vu.stdout)
  if (!lu.ok) return { ok: false, raison: vu.ok ? lu.raison : `${vu.raison} — ${lu.raison}` }
  return issueDeFusion(lu)
}

/** Un uuid de demande de fusion, sinon levée. */
function uuidDe(uuid) {
  if (typeof uuid === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuid)) return uuid
  throw new Error(`ctx.lireFusion : un UUID de demande — refusé : ${JSON.stringify(uuid)}`)
}

/** Le numéro d'un ticket, sinon levée. */
function numeroDeTicket(geste, numero) {
  if ((typeof numero === 'string' || Number.isSafeInteger(numero)) && /^[1-9]\d*$/.test(String(numero))) return numero
  throw new Error(`ctx.${geste} : un NUMÉRO de ticket — refusé : ${JSON.stringify(numero)}`)
}

/**
 * Le contexte que les étapes partagent (`etapesDuTrain.mjs`) : le test de clôture
 * (`etapesDuTrain.test.mjs`) refuse au module des étapes toute liaison qui atteint un lancement de
 * processus, contre une retouche de bonne foi (résidu : #2073) : chaque processus d'une étape passe
 * par un geste d'ici. Écrivains nommés de l'hôte :
 * `commit`, `fusionner` (un message), `abandonnerFusion`, `pousser`, `tronc`. Hors git : `npm` (un NOM
 * de script), `docs` (un mode de `build-all.mjs`), `coursesCi` (un sha), `coursesDeFile`, `parentsDe`
 * (un sha), `jobsRouges` (un id de course), `lirePr`, `ouvrirPr` (un titre et un corps), `demanderFusion` (un numéro de PR et
 * un sha), `lireFusion` (un numéro de PR et un uuid), `lireTicket` (un numéro), `commenter` (un numéro et un corps) ; chacun valide ses arguments avant tout spawn.
 * Données : `generators` (`GENERATORS` de `build-all.mjs`), la table des dérivés que lit
 * `estDocDerive` ; `jobsDesDerives`, les jobs de `ci.yml` qui portent `GATES_DES_DERIVES` ; `filtresDePush`, les
 * filtres `push.branches` de `ci.yml` (`branchesDePush`).
 */
export function contexteDe({ racine, branche, options, journaliser, fdLog }) {
  const depot = depotDuTrain(racine)
  const stdio = ['ignore', fdLog, fdLog]
  const parentsVus = new Map()
  return {
    racine,
    questions: questionsDuTrain(depot),
    branche,
    options,
    journaliser,
    fdLog,
    generators: GENERATORS,
    get jobsDesDerives() {
      return jobsDesDerives(racine)
    },
    get filtresDePush() {
      return branchesDePush(texteDeCi({ cwd: racine }), `${DOSSIER}/${PORTE}`)
    },
    npm(script) {
      if (typeof script !== 'string' || !/^[\w:.-]+$/.test(script)) throw new Error(`ctx.npm : un NOM de script \`npm run\`, jamais une commande — refusé : ${JSON.stringify(script)}`)
      const { executable, args, shell } = lancementNpm(script, process.platform)
      return spawnSync(executable, args, { cwd: racine, stdio, shell })
    },
    docs(mode) {
      if (!MODES_DES_DOCS.includes(mode)) throw new Error(`ctx.docs : mode de build-all inconnu — ${JSON.stringify(mode)}`)
      const vu = spawnSync(process.execPath, [join(racine, 'scripts/docs/build-all.mjs'), mode], {
        cwd: racine, stdio: ['ignore', fdLog, 'pipe'], encoding: 'utf8', maxBuffer: 256 * 1024 * 1024,
      })
      if (vu.stderr) writeSync(fdLog, vu.stderr)
      return vu
    },
    coursesCi(sha) {
      return coursesCi({ cwd: racine, commit: shaComplet('coursesCi', sha), limit: 30 })
    },
    coursesDeFile: () => coursesCi({ cwd: racine, branche: null, evenement: 'merge_group', limit: 30 }),
    /** Les parents d'un commit (`GET /repos/{owner}/{repo}/commits/{ref}`), mémorisés : un commit ne
     *  change jamais de parents. */
    parentsDe(sha) {
      const cle = shaComplet('parentsDe', sha)
      if (parentsVus.has(cle)) return parentsVus.get(cle)
      const vu = gh(['api', `repos/${DEPOT}/commits/${cle}`, '--jq', '[.parents[].sha]'], racine)
      if (!vu.ok) return vu
      try {
        const parents = JSON.parse(vu.stdout)
        if (!Array.isArray(parents)) return { ok: false, raison: 'réponse REST sans tableau de parents' }
        const lu = { ok: true, parents }
        parentsVus.set(cle, lu)
        return lu
      } catch (e) {
        return { ok: false, raison: e.message }
      }
    },
    jobsRouges(id) {
      if (!Number.isSafeInteger(id) || id <= 0) throw new Error(`ctx.jobsRouges : un id de course — refusé : ${JSON.stringify(id)}`)
      return jobsRougesDe({ cwd: racine, id })
    },
    lirePr: () => lirePr(racine, branche),
    ouvrirPr({ titre, corps }) {
      if (typeof titre !== 'string' || !titre.trim() || typeof corps !== 'string') throw new Error(`ctx.ouvrirPr : un TITRE et un corps — refusé : ${JSON.stringify({ titre, corps })}`)
      return gh(['api', '-X', 'POST', `repos/${DEPOT}/pulls`, '-f', `title=${titre}`, '-f', `head=${branche}`, '-f', `base=${TRONC.nom}`, '-f', `body=${corps}`], racine)
    },
    demanderFusion({ numero, sha } = {}) {
      numeroDeTicket('demanderFusion', numero)
      const corps = corpsDeFusion(shaComplet('demanderFusion', sha))
      return fusionDe(gh(['api', '--include', '-X', 'PUT', `repos/${DEPOT}/pulls/${numero}/merge-async`, '--input', '-'], racine, corps))
    },
    lireFusion({ numero, uuid } = {}) {
      numeroDeTicket('lireFusion', numero)
      return fusionDe(gh(['api', '--include', `repos/${DEPOT}/pulls/${numero}/merge-async/${uuidDe(uuid)}`], racine))
    },
    lireTicket: (numero) => lireTicket({ depot: DEPOT, numero: numeroDeTicket('lireTicket', numero), appel: appelGh(racine) }),
    commenter(numero, corps) {
      numeroDeTicket('commenter', numero)
      if (typeof corps !== 'string' || !corps.trim()) throw new Error(`ctx.commenter : un CORPS de commentaire — refusé : ${JSON.stringify(corps)}`)
      return poserCommentaire({ depot: DEPOT, numero, corps, appel: appelGh(racine) })
    },
    get tete() {
      return shaDe(depot, 'HEAD')
    },
    /**
     * Le TRONC distant, fetché puis relu — la seule porte d'`origin/main` des étapes qui doivent le
     * mesurer À CHAUD (`push`), donc le seul point d'injection en test.
     * @returns {{disponible:true, sha:string|null}|{disponible:false, raison:string}}
     */
    tronc() {
      const vu = fetchOrigin(depot)
      if (!vu.disponible) return { disponible: false, raison: vu.raison }
      return { disponible: true, sha: shaDe(depot, TRONC.suivi) }
    },
    commit: ({ message, chemins }) => commitDe(depot, { message, chemins }),
    fusionner({ message }) {
      if (typeof message !== 'string' || !message.trim()) throw new Error(`ctx.fusionner : un MESSAGE — refusé : ${JSON.stringify(message)}`)
      return fusionner(depot, { de: TRONC.suivi, message })
    },
    abandonnerFusion: () => abandonnerFusion(depot),
    pousser: ({ vers, bail }) => pousser(depot, { vers, bail }),
  }
}


function main() {
  // L'enfant détaché tend son filet AVANT tout geste faillible : son journal est sa seule voix.
  if (process.env.WFRP_PUBLIER_ENFANT === '1' && process.env.WFRP_PUBLIER_LOG) {
    filetDuTrainEnfant({ chemin: process.env.WFRP_PUBLIER_LOG })
  }
  const options = optionsDe(process.argv.slice(2))
  if (options.inconnus.length) {
    process.stderr.write(`[publier] option inconnue : ${options.inconnus.join(' ')}\n  usage : node scripts/ops/publier.mjs [--detache] [--reprendre] [--etapes] [--file-timeout-min <n>] [--veiller <run>]\n`)
    process.exit(1)
  }
  const depot = depotDuTrain(RACINE)
  const toplevel = racineDe(depot)
  if (!toplevel || resolve(toplevel) !== resolve(RACINE)) {
    process.stderr.write(`[publier] REFUS : ${RACINE} n'est pas la racine de son dépôt (git dit ${toplevel ?? 'rien'})\n`)
    process.exit(1)
  }
  const branche = brancheDe(depot) ?? 'HEAD'
  const chemins = cheminsDeJournal(RACINE, branche)
  mkdirSync(chemins.dossier, { recursive: true })
  const surDisque = existsSync(chemins.json) ? lireJournal(chemins.json, branche) : null

  if (options.veiller) {
    return veillerLeTrain({
      run: options.veiller,
      fileTimeoutMin: options.fileTimeoutMin,
      lire: () => lireJournal(chemins.json, branche),
      ecrire: (ligne) => process.stdout.write(`${ligne}\n`),
      log: chemins.log,
    })
  }

  // La TÊTE VIVANTE : la seule contre laquelle une étape verte se juge (`planDeReprise`).
  const teteVivante = shaDe(depot, 'HEAD')

  if (options.etapes) {
    const journal = surDisque ?? journalVide(branche)
    const reprise = planDeReprise(journal, ETAPES.map((e) => e.nom), teteVivante)
    process.stdout.write(
      `publication ${branche} — journal ${chemins.json}\n` +
        `base=${journal.base ?? '—'} tete=${journal.tete ?? '—'} (publiée) · HEAD=${teteVivante ?? '—'} (vivante) ejections=${journal.ejections ?? 0} run=${journal.run ?? '—'}\n` +
        ETAPES.map((e) => `  ${e.nom.padEnd(10)} ${etatDeLEtape(journal, e.nom, teteVivante)}`).join('\n') +
        `\nreprise : ${reprise ?? 'rien à jouer (tout est vert pour cette tête)'}\n`,
    )
    return 0
  }

  if (options.detache) {
    // Le PARENT décide du mode (et tronque le cas échéant) AVANT de détacher : l'enfant ouvre
    // TOUJOURS le sien en append.
    const fdLog = ouvrirLog(chemins.log, modeDuLog({ reprendre: options.reprendre }))
    const argsEnfant = process.argv.slice(2).filter((a) => a !== '--detache')
    const lancement = Date.now()
    const script = fileURLToPath(import.meta.url)
    const pid = lancerDetache({
      script,
      args: argsEnfant,
      cwd: RACINE,
      fdLog,
      envSupplementaire: { WFRP_PUBLIER_ENFANT: '1', WFRP_PUBLIER_LOG: chemins.log, WFRP_PUBLIER_LANCEMENT: String(lancement) },
    })
    // Le détachement est écrit DANS le log, par le parent : c'est la seule trace machine qu'un train
    // a été lancé détaché, et sur quels arguments.
    writeSync(fdLog, ligneDeDetachement({ pid, log: chemins.log, args: argsEnfant }))
    closeSync(fdLog)
    process.stdout.write(`pid=${pid}\nlog=${chemins.log}\nveille=${commandeDeVeille({ script, run: idDeRun({ pid, lancement }) })}\n`)
    return 0
  }

  const enfant = process.env.WFRP_PUBLIER_ENFANT === '1'
  const fdLog = ouvrirLog(chemins.log, modeDuLog({ reprendre: options.reprendre, enfant }))
  const journaliser = (texte) => {
    writeSync(fdLog, texte)
    if (!enfant) process.stderr.write(texte)
  }
  const ctx = contexteDe({ racine: RACINE, branche, options, journaliser, fdLog })
  const { journal, repris, vertes } = journalInitial({ reprendre: options.reprendre, lu: surDisque, branche })
  const lancement = Number(process.env.WFRP_PUBLIER_LANCEMENT) || Date.now()
  entameDuRun(journal, { run: idDeRun({ pid: process.pid, lancement }), pid: process.pid, fileTimeoutMin: options.fileTimeoutMin })
  sauverJournal(chemins.json, journal)
  journaliser(`[publier] ${new Date().toISOString()} — branche ${branche}${options.reprendre ? ' (--reprendre)' : ''}\n`)
  journaliser(`[publier] ${repris ? `journal repris (${vertes} étape(s) verte(s))` : 'journal neuf'}\n`)
  let verdict
  try {
    if (repris) {
      const reprise = planDeReprise(journal, ETAPES.map((e) => e.nom), ctx.tete)
      journaliser(`[publier] reprise : ${reprise ?? 'rien à jouer (tout est vert pour cette tête)'}\n`)
    }
    verdict = jouerLeTrain(ctx, ETAPES, journal, { sauver: (j) => sauverJournal(chemins.json, j), journaliser })
  } catch (e) {
    verdict = { etat: 'rouge', etape: 'moteur', raison: `ARRÊT INATTENDU : ${e?.stack ?? e}` }
  }
  journal.verdict = verdict
  sauverJournal(chemins.json, journal)
  journaliser(`${ligneDePublication(verdict, journal.tete)}\n`)
  closeSync(fdLog)
  return codeDeVerdict(verdict)
}

/**
 * `main`, dont une panne de git AVANT le train (racine, branche, tête vivante) sort en ligne finale
 * NOMMÉE — au log de l'enfant détaché, sur stderr sinon —, jamais en pile brute.
 * @returns {number}
 */
function mainNomme() {
  try {
    return main()
  } catch (e) {
    if (!(e instanceof GitIndisponible)) throw e
    const ligne = `PUBLICATION: rouge lecture — git indisponible : ${e.raison}\n`
    if (process.env.WFRP_PUBLIER_ENFANT === '1' && process.env.WFRP_PUBLIER_LOG) appendFileSync(process.env.WFRP_PUBLIER_LOG, ligne)
    else process.stderr.write(ligne)
    return 1
  }
}

if (import.meta.main) process.exit(mainNomme())
