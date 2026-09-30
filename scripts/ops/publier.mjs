// PUBLICATION — le TRAIN, en un processus du dépôt.
//
// INVARIANT (ticket #1736, « Design », 2026-09-14) : « La PUBLICATION est un train d'ÉTAPES FIXES,
// jouées par UN processus du dépôt, détaché du harnais, idempotent et REPRENABLE ; l'orchestrateur
// lance, lit un journal, juge le contenu — il ne joue plus aucune étape à la main. Critère
// "l'étape N+1 coûte une ligne" : ajouter une étape = une entrée dans la table `ETAPES` (nom,
// `jouer(ctx)`, `dejaFaite(ctx)`), rien d'autre. » La table vit dans `etapesDuTrain.mjs`.
//
// RÉGIME (#1776) : commit FINAL → push de la BRANCHE → la CI juge → fast-forward de `main`. Aucune
// gate ne se joue ici : `.github/workflows/ci.yml` les joue toutes sur la branche, et le ruleset
// `main` (`scripts/ops/ruleset-main.mjs`) refuse côté SERVEUR tout ce qui n'est pas un fast-forward
// d'une tête verte. NEUF étapes — preflight, derives, rebase, docs, push-branche, ci, ff-main,
// pilotage, fin :
// preflight (une saleté faite UNIQUEMENT de docs DÉRIVÉS ne refuse pas : l'étape `derives` la
// commet), derives (les docs dérivés laissés non commités par le hook `post-rewrite` d'un rebase
// MANUEL sont commis AVANT le rebase — mesuré le 2026-09-14 : `git rebase origin/main` refuse de
// DÉMARRER sur un arbre sale, « cannot rebase: You have unstaged changes »), rebase sur
// origin/main — sauté quand `origin/main` est déjà ancêtre de HEAD, REFUSÉ quand la branche porte des
// fusions hors tronc : une publication ne réécrit jamais une histoire qui contient le tronc, ne
// linéarise jamais des fusions (#1998) —, docs dérivés régénérés — la plage sans source de doc
// saute la RÉGÉNÉRATION, jamais le COMMIT —, push de la branche, attente bornée du verdict CI de la
// TÊTE, fast-forward de `main`, pilotage des tickets cités, fin. Un tronc qui a bougé pendant
// l'attente RELANCE rebase → docs → push-branche → ci (#1751), borné par le compteur `reprises`.
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
// `rebaser`, `abandonnerRebase`, `pousser`, `fetchOrigin` sous `tronc` (`gitPorte.mjs`), `npm` (un
// nom de script), `docs` (un mode de build-all), `coursesCi` (un sha), `lireTicket` et `commenter`
// (un numéro de ticket) —, jamais la poignée du dépôt ni un argv libre. Ce fichier ne porte aucun
// `gh issue close` (la fermeture appartient au job `fermetures` de la CI). D'où, pour les étapes :
// ni `git add -A`, ni un commit de l'arbre ou de l'index entier, ni `git stash`, ni `push --force`,
// ni `--force-with-lease` vers `main` (`pousser` le refuse), ni `reset --hard`, `branch -D`,
// `worktree remove --force`, `checkout` ou `restore`.
// Un rebase INTERROMPU trouvé sur disque à la préflight est NOMMÉ, jamais avorté d'office.
//
// Usage : node scripts/ops/publier.mjs [--detache] [--reprendre] [--etapes] [--ci-timeout-min <n>]
import { spawnSync, spawn } from 'node:child_process'
import { appendFileSync, closeSync, existsSync, mkdirSync, openSync, readFileSync, renameSync, statSync, writeFileSync, writeSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  GitIndisponible, TRONC, abandonnerRebase, brancheDe, ceQuiChange, cheminsEnConflit, combienDe, commitDe, depotDe, estAncetre,
  etatDeLArbre, fetchOrigin, origineDe, pousser, racineDe, rebaseEntame, rebaser, shaDe, shasDe,
} from '../guards/lib/gitPorte.mjs'
import { BORNE_RAISON, DEPOT, lireTicket, poserCommentaire } from '../guards/lib/ticketsGh.mjs'
import { coursesCi } from '../guards/lib/coursesCi.mjs'
import { refusDesCompteurs } from '../guards/lib/compteursDuDepot.mjs'
import { commitsDeLaPlage } from '../guards/lib/plageFermante.mjs'
import { GENERATORS } from '../docs/build-all.mjs'
import { PEREMPTION_MS, purgerPerimes } from '../guards/lib/purgerPerimes.mjs'
import { ETAPES } from './etapesDuTrain.mjs'

/** L'arbre où VIT ce script — jamais `process.cwd()` : le train publie SON worktree. */
export const RACINE = fileURLToPath(new URL('../..', import.meta.url))

/** Délai par défaut, en minutes, de l'attente du verdict CI de la tête (#1776). */
export const CI_TIMEOUT_MIN = 30

// ── Purs : options, journal, plan ──────────────────────────────────────────────────────

/**
 * Options de la ligne de commande. PURE — grammaire propre (drapeaux booléens + une option à
 * valeur) : `separerInvocation` lit `<positionnel> [--opt val]* -- reste`, une grammaire qui n'est
 * pas la nôtre.
 * @param {string[]} argv arguments APRÈS `node publier.mjs`
 * @returns {{detache:boolean, reprendre:boolean, etapes:boolean, ciTimeoutMin:number, inconnus:string[]}}
 */
export function optionsDe(argv) {
  const args = (argv ?? []).map(String)
  const connus = new Set(['--detache', '--reprendre', '--etapes', '--ci-timeout-min'])
  const valeurs = { '--ci-timeout-min': CI_TIMEOUT_MIN }
  const inconnus = []
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i]
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
    ciTimeoutMin: valeurs['--ci-timeout-min'],
    inconnus,
  }
}

/** Nom de fichier de journal d'une branche : tout ce qui n'est ni mot, ni point, ni tiret fond en
 *  `_` (`chantier/1736-publier` → `chantier_1736-publier`). PURE. */
export const nomDeJournal = (branche) => String(branche ?? 'sans-branche').replace(/[^\w.-]+/g, '_')

/** Journal neuf d'une branche. PURE. */
export const journalVide = (branche) => ({ branche, base: null, tete: null, reprises: 0, etapes: {} })

/**
 * Le journal dont un run PART. PURE. Sans `--reprendre`, un run est un LOT NEUF : le journal du
 * disque ne le contamine pas. Sans cela, `reprises` survivait d'un lot à l'autre (un 2ᵉ lot
 * refuserait « origin/main a bougé DEUX fois » dès le premier mouvement) et les étapes vertes d'un
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
 * `ouvrirLog` serait invisible (pid annoncé, journal vide). Ce filet écrit la chute DANS le journal,
 * avec la ligne `PUBLICATION:` que les veilles attendent, puis sort en 1. Le script détaché étant
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
 * la trace du run précédent survit, et le log courant repart vide, donc la veille `^PUBLICATION:`
 * reste valide sans offset. Le bornage est par PÉREMPTION d'ÂGE, par la source unique
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

/** Secondes d'ATTENTE de la CI, telles que l'étape `ci` les a mesurées — le journal sépare le temps
 *  machine LOCALE du temps où l'on n'a fait qu'attendre GitHub (#1776). PURE. */
export const attenteCiSecondes = (journal) => journal?.etapes?.ci?.detail?.attenteCiSecondes ?? null

/**
 * Première étape NON VERTE du journal — le point de reprise. Une étape verte POUR UNE AUTRE TÊTE est
 * « à faire » : sans cela, un 2ᵉ lot sur la même branche sauterait la sonde CI et le pilotage et
 * s'annoncerait vert. PURE.
 *
 * RÈGLE DE TÊTE, une seule : la comparaison porte sur la TÊTE VIVANTE (`git rev-parse HEAD` au
 * moment où l'on juge), jamais sur `journal.tete` (la tête PUBLIÉE, posée par `derives`/`rebase`), et
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

/**
 * Le MOTEUR du train : joue les étapes dans l'ordre, saute celles que `dejaFaite` déclare, arrête à
 * la première rouge, écrit le journal après CHAQUE étape. PUR hors des `jouer` qu'on lui donne —
 * testable avec des étapes factices.
 *
 * Une étape peut demander une RELANCE (`{ relancer: [<noms>] }`, cas « origin/main a bougé ») : les
 * étapes nommées repassent « à faire » et le train reprend du début. Une seule fois — le compteur
 * `reprises` du journal est la borne, et l'étape qui demande la relance la lit.
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
        // rendait « à faire » après coup. Le détail précédent est CONSERVÉ : `ci.dejaFaite` (:800) le
        // relit (`detail.etat === 'verte'`), l'écraser ferait resonder la course à chaque reprise.
        const vu = journal.etapes[etape.nom]
        const instant = new Date().toISOString()
        journal.etapes[etape.nom] = {
          etat: 'vert',
          debut: instant,
          fin: instant,
          detail: { ...(vu?.detail ?? {}), dejaFaite: true },
          tete: ctx.tete ?? null,
        }
        sauver(journal)
        journaliser(`[publier] ${etape.nom} — déjà faite\n`)
        continue
      }
      journaliser(`[publier] ${etape.nom} — début\n`)
      const debut = Date.now()
      const vu = etape.jouer(ctx, journal) ?? { ok: false, raison: 'aucun verdict rendu' }
      const secondes = (Date.now() - debut) / 1000
      journal.etapes[etape.nom] = {
        etat: vu.ok ? 'vert' : vu.indetermine ? 'indéterminée' : 'rouge',
        debut: new Date(debut).toISOString(),
        fin: new Date().toISOString(),
        detail: vu.detail ?? null,
        tete: ctx.tete ?? null,
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
    for (const nom of relance) if (noms.includes(nom)) journal.etapes[nom] = { etat: 'à faire', tete: null }
    sauver(journal)
    journaliser(`[publier] relance du train depuis ${relance[0]}\n`)
  }
  return { etat: 'rouge', etape: 'moteur', raison: 'trop de relances du train' }
}

/**
 * La lecture git que `decisionDeRebase` juge : `origin/main` ancêtre de HEAD (`estAncetre`), et
 * sinon les fusions de `origin/main..HEAD` (`shasDe`).
 * @param {import('../guards/lib/gitPorte.mjs').Depot} depot
 * @returns {{disponible:true, contenu:boolean, fusions:boolean}|{disponible:false, raison:string}}
 */
export function relationAuTronc(depot) {
  const vu = estAncetre(depot, TRONC.suivi, 'HEAD')
  if (!vu.disponible) return { disponible: false, raison: vu.raison }
  if (vu.absent) return { disponible: false, raison: 'origin/main ou HEAD introuvable' }
  if (vu.valeur) return { disponible: true, contenu: true, fusions: false }
  try {
    const fusions = shasDe(depot, [`${TRONC.suivi}..HEAD`], { fusions: true })
    if (fusions === null) return { disponible: false, raison: 'origin/main..HEAD illisible' }
    return { disponible: true, contenu: false, fusions: fusions.length > 0 }
  } catch (e) {
    if (!(e instanceof GitIndisponible)) throw e
    return { disponible: false, raison: e.raison }
  }
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
  refusDesCompteurs: () => refusDesCompteurs(depot, { tete: 'HEAD', tronc: TRONC.suivi }),
  estAncetre: (ancetre, descendant) => estAncetre(depot, ancetre, descendant),
  ceQuiChange: (avant, apres) => ceQuiChange(depot, avant, apres),
  relationAuTronc: () => relationAuTronc(depot),
  cheminsSales: () => cheminsSales(depot),
  commitsDeLaPlage: (plage) => commitsDeLaPlage(plage, depot.cwd),
})

/** `gh <args>`, en union simple. Jamais `shell: true`. */
function gh(args, cwd, input) {
  const vu = spawnSync('gh', args, {
    cwd, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, timeout: 120_000,
    stdio: [input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'],
    ...(input === undefined ? {} : { input }),
  })
  if (vu.error) return { ok: false, raison: vu.error.message }
  if (vu.status !== 0) return { ok: false, raison: `gh a rendu ${vu.status} : ${String(vu.stderr ?? '').trim().slice(0, BORNE_RAISON)}` }
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
 * `commit`, `rebaser`, `abandonnerRebase`, `pousser`, `tronc`. Hors git : `npm` (un NOM de script),
 * `docs` (un mode de `build-all.mjs`), `coursesCi` (un sha), `lireTicket` (un numéro), `commenter`
 * (un numéro et un corps) ; chacun valide ses arguments avant tout spawn. Donnée : `generators`
 * (`GENERATORS` de `build-all.mjs`), la table des dérivés que lit `estDocDerive`.
 */
export function contexteDe({ racine, branche, options, journaliser, fdLog }) {
  const depot = depotDuTrain(racine)
  const stdio = ['ignore', fdLog, fdLog]
  return {
    racine,
    questions: questionsDuTrain(depot),
    branche,
    options,
    journaliser,
    fdLog,
    generators: GENERATORS,
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
      if (typeof sha !== 'string' || !/^(?:[0-9a-f]{40}|[0-9a-f]{64})$/.test(sha)) throw new Error(`ctx.coursesCi : un sha COMPLET — refusé : ${JSON.stringify(sha)}`)
      return coursesCi({ cwd: racine, commit: sha, limit: 30 })
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
    rebaser: () => rebaser(depot, TRONC.suivi),
    abandonnerRebase: () => abandonnerRebase(depot),
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
    process.stderr.write(`[publier] option inconnue : ${options.inconnus.join(' ')}\n  usage : node scripts/ops/publier.mjs [--detache] [--reprendre] [--etapes] [--ci-timeout-min <n>]\n`)
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

  // La TÊTE VIVANTE : la seule contre laquelle une étape verte se juge (`planDeReprise`).
  const teteVivante = shaDe(depot, 'HEAD')

  if (options.etapes) {
    const journal = surDisque ?? journalVide(branche)
    const reprise = planDeReprise(journal, ETAPES.map((e) => e.nom), teteVivante)
    process.stdout.write(
      `publication ${branche} — journal ${chemins.json}\n` +
        `base=${journal.base ?? '—'} tete=${journal.tete ?? '—'} (publiée) · HEAD=${teteVivante ?? '—'} (vivante) reprises=${journal.reprises ?? 0}\n` +
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
    const pid = lancerDetache({
      script: fileURLToPath(import.meta.url),
      args: argsEnfant,
      cwd: RACINE,
      fdLog,
      envSupplementaire: { WFRP_PUBLIER_ENFANT: '1', WFRP_PUBLIER_LOG: chemins.log },
    })
    // Le détachement est écrit DANS le log, par le parent : c'est la seule trace machine qu'un train
    // a été lancé détaché, et sur quels arguments.
    writeSync(fdLog, ligneDeDetachement({ pid, log: chemins.log, args: argsEnfant }))
    closeSync(fdLog)
    process.stdout.write(`pid=${pid}\nlog=${chemins.log}\n`)
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
  journal.etat = verdict.etat
  sauverJournal(chemins.json, journal)
  const derniere =
    verdict.etat === 'vert'
      ? `PUBLICATION: vert ${journal.tete}`
      : verdict.etat === 'indeterminee'
        ? `PUBLICATION: indéterminée ci ${journal.tete}`
        : `PUBLICATION: rouge ${verdict.etape} — ${String(verdict.raison).split('\n')[0]}`
  journaliser(`${derniere}\n`)
  closeSync(fdLog)
  return verdict.etat === 'vert' ? 0 : verdict.etat === 'indeterminee' ? 3 : 1
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
