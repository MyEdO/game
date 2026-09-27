// PUBLICATION — le TRAIN, en un processus du dépôt.
//
// INVARIANT (ticket #1736, « Design », 2026-09-14) : « La PUBLICATION est un train d'ÉTAPES FIXES,
// jouées par UN processus du dépôt, détaché du harnais, idempotent et REPRENABLE ; l'orchestrateur
// lance, lit un journal, juge le contenu — il ne joue plus aucune étape à la main. Critère
// "l'étape N+1 coûte une ligne" : ajouter une étape = une entrée dans la table `ETAPES` (nom,
// `jouer(ctx)`, `dejaFaite(ctx)`), rien d'autre. »
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
// INTERDITS, gravés — `commandeInterdite` les refuse AVANT tout spawn, et ce fichier ne porte aucun
// `gh issue close` (la fermeture appartient au job `fermetures` de la CI) :
//   · `git add -A` / `--all` / `.`      — le commit des docs stage des chemins EXPLICITES ;
//   · `git stash`                        — rien ne se met de côté ;
//   · `git push --force` / `-f` sous toute forme, et `--force-with-lease` VERS `main` ;
//   · `git reset --hard`, `git branch -D`, `git worktree remove --force` ;
//   · `git commit` sans `--` de chemins explicites ;
//   · `git checkout` / `git restore`     — le train ne restaure jamais un fichier.
// Un rebase INTERROMPU trouvé sur disque à la préflight est NOMMÉ, jamais avorté d'office.
//
// Usage : node scripts/ops/publier.mjs [--detache] [--reprendre] [--etapes] [--ci-timeout-min <n>]
import { spawnSync, spawn } from 'node:child_process'
import { appendFileSync, closeSync, existsSync, mkdirSync, openSync, readFileSync, renameSync, rmSync, statSync, writeFileSync, writeSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { estAncetre, fetchOrigin, lireGit, raisonCourte, sortieOuNull, urlOrigineAcceptee } from '../guards/lib/gitPorte.mjs'
import { ANNULEE, ROUGES, coursesCi } from '../guards/lib/coursesCi.mjs'
import { numerosCites, numerosFermes } from '../guards/lib/fermetures.mjs'
import { BORNE_RAISON, DEPOT, lireTicket, poserCommentaire } from '../guards/lib/ticketsGh.mjs'
import { refusDeSujet } from '../guards/lib/sujetDeCommit.mjs'
import { commitsDeLaPlage, marqueDe } from '../guards/lib/plageFermante.mjs'
import { GENERATORS, SOURCES_LUES } from '../docs/build-all.mjs'
import { MANAGED_ROOTS } from '../agents/compat-core.mjs'
import { sourcesMesurees, touchesDocSources } from '../git-hooks/docs-rebuild.mjs'
import { PEREMPTION_MS, purgerPerimes } from '../guards/lib/purgerPerimes.mjs'
import { resoudreOutilLocal } from '../lancer-local.mjs'
import { correspondGlob } from '../guards/lib/lister.mjs'

/** L'arbre où VIT ce script — jamais `process.cwd()` : le train publie SON worktree. */
export const RACINE = fileURLToPath(new URL('../..', import.meta.url))

/** Délai par défaut, en minutes, de l'attente du verdict CI de la tête (#1776). */
export const CI_TIMEOUT_MIN = 30

/** Période de la sonde CI, en millisecondes. */
export const PERIODE_SONDE_MS = 30_000

/** Nom du workflow que la sonde reconnaît (`.github/workflows/ci.yml`, `name: CI`). */
export const WORKFLOW = 'CI'

/** Marque d'IDEMPOTENCE du pilotage : elle porte la tête publiée. */
export const marquePublication = (sha) => `<!-- publier: ${sha} -->`

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
 * Le seul site de détachement du TRAIN (#1784) — `scripts/gates/toutes.mjs:700` en détache aussi ses
 * gates, mais sous POSIX seulement (`detached: process.platform !== 'win32'`) : sous win32 elles
 * héritent de la console de l'appelant. Sous win32, `spawn({ detached: true })` pose
 * `DETACHED_PROCESS` (libuv) : le train n'a AUCUNE console, et chacun de ses enfants console
 * (`git`, `gh`, `npm`, `node`) en ALLOUE une, visible au premier plan — mesuré le 2026-09-17 sur 15
 * commandes : 9 consoles neuves, contre 1 (celle du train, CACHÉE, dont ses enfants héritent) par
 * `Start-Process -WindowStyle Hidden`. Le pid rendu est celui du NODE du train (`-PassThru`), jamais
 * celui du `powershell` intermédiaire, qui rend la main aussitôt (mesuré : 253 ms) et meurt sans
 * emporter le train. Aucune redirection n'est demandée à `Start-Process` : le train ouvre LUI-MÊME
 * son journal (`modeDuLog`) et le passe en stdio à ses enfants, et `-RedirectStandard*` retiendrait
 * le `powershell` jusqu'à la fin du train (mesuré : 16,14 s au lieu de 253 ms).
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

// ── Purs : verdicts et mise en forme ───────────────────────────────────────────────────

/**
 * Verdict de la CI pour un sha, lu dans les courses TRIÉES (`coursesCi` trie `createdAt`
 * décroissant). PUR. Une conclusion inconnue n'est PAS verte : elle rougit, et se nomme.
 * @returns {{etat:'absente'|'en-vol'|'verte'|'rouge'|'annulee', course?:object}}
 */
export function verdictDesRuns(courses, sha, { workflow = WORKFLOW } = {}) {
  const notres = (courses ?? []).filter(
    (c) => String(c?.headSha ?? '') === String(sha) && (!c?.workflowName || String(c.workflowName) === workflow),
  )
  if (!notres.length) return { etat: 'absente' }
  const course = notres[0]
  if (String(course.status ?? 'completed') !== 'completed') return { etat: 'en-vol', course }
  const conclusion = String(course.conclusion ?? '')
  if (conclusion === ANNULEE) return { etat: 'annulee', course }
  if (conclusion === 'success') return { etat: 'verte', course }
  // `ROUGES` nomme les trois échecs connus ; toute AUTRE conclusion (`neutral`, `skipped`, une
  // valeur neuve de GitHub) n'est pas verte non plus — elle rougit, et le journal la porte.
  return { etat: 'rouge', course, inattendue: !ROUGES.has(conclusion) }
}

/**
 * Ce chemin est-il DÉRIVÉ, donc committable par l'étape `docs` ? Trois familles, toutes déclarées
 * ailleurs : les `targets`/`injecte` des `GENERATORS`, la mesure `docs/.sources-lues.json`
 * (`build-all.mjs` REFUSE si elle n'est pas dans l'index), et les sorties de `npm run agents:sync`
 * (le pre-commit joue `agents:check` à chaque commit). PURE.
 */
export function estDocDerive(chemin, generators = GENERATORS, { sourcesLues = SOURCES_LUES, racinesAgents = MANAGED_ROOTS } = {}) {
  const c = String(chemin ?? '').replace(/\\/g, '/')
  if (!c) return false
  if (c === sourcesLues) return true
  if (racinesAgents.some((r) => c === r || c.startsWith(`${r}/`))) return true
  return (generators ?? []).some((g) =>
    [...(g.targets ?? []), ...(g.injecte ?? [])].some((motif) => correspondGlob(c, motif)),
  )
}

/**
 * Partage des chemins SALES en deux tas : ce que l'étape `docs` sait committer (`estDocDerive`) et
 * le reste. PURE. Mesuré (2026-09-14, premier train réel) : après un rebase MANUEL, le hook
 * `post-rewrite` régénère les docs dérivés SANS les committer (`scripts/git-hooks/docs-rebuild.mjs`)
 * — sans ce partage, la préflight refusait le train pour une saleté que l'étape `docs` commet.
 * @param {string[]} chemins
 * @returns {{derives:string[], manuscrits:string[]}}
 */
export function partitionSales(chemins, ...reste) {
  const derives = []
  const manuscrits = []
  for (const c of chemins ?? []) (estDocDerive(c, ...reste) ? derives : manuscrits).push(c)
  return { derives, manuscrits }
}

/**
 * Options GLOBALES de git, posées AVANT le sous-commande (`git -c k=v push …`, `git -C dir add …`).
 * Les sauter est la condition pour que `commandeInterdite` lise le vrai sous-commande : sans cela,
 * `['-c','x=y','add','-A']` passait pour un sous-commande `-c` inconnu, donc AUTORISÉ. PURE.
 * @returns {string[]} les arguments à partir du sous-commande
 */
export function sansOptionsGlobales(args) {
  const a = (args ?? []).map(String)
  const aValeur = new Set(['-c', '-C', '--git-dir', '--work-tree', '--namespace', '--exec-path', '--config-env'])
  let i = 0
  while (i < a.length) {
    const x = a[i]
    if (aValeur.has(x)) {
      i += 2
      continue
    }
    if (x.startsWith('--') && x.includes('=')) {
      i += 1
      continue
    }
    if (x.startsWith('-')) {
      i += 1
      continue
    }
    break
  }
  return a.slice(i)
}

/** Refus de commande, ou `null`. PURE — la SEULE liste des gestes que le train ne fait pas. */
export function commandeInterdite(args) {
  const a = sansOptionsGlobales(args)
  const sous = a[0]
  const porte = (...formes) => a.slice(1).some((x) => formes.includes(x) || formes.some((f) => x.startsWith(`${f}=`)))
  if (sous === 'stash') return '`git stash` : le train ne met rien de côté'
  if (sous === 'checkout' || sous === 'restore') return `\`git ${sous}\` : le train ne restaure aucun fichier`
  if (sous === 'add' && porte('-A', '--all', '.')) return '`git add` global : le commit des docs stage des chemins EXPLICITES'
  // `--force-with-lease` est ACCEPTÉ sur une branche de travail, et là seulement (#1776) : le rebase
  // réécrit l'histoire de la branche à chaque tour, et le bail n'écrase que ce qu'on vient de lire.
  // `main` n'entre jamais autrement qu'en fast-forward — la règle `non_fast_forward` du ruleset l'exige.
  if (sous === 'push' && porte('--force', '-f')) return '`git push --force` : jamais, sous aucune forme'
  if (sous === 'push' && porte('--force-with-lease') && a.some((x) => /(^|:)(main|refs\/heads\/main)$/.test(String(x))))
    return '`git push --force-with-lease` vers `main` : main n’entre qu’en fast-forward'
  if (sous === 'reset' && porte('--hard')) return '`git reset --hard` : le train ne détruit aucun travail'
  if (sous === 'branch' && porte('-D')) return '`git branch -D` : le train ne supprime aucune branche'
  if (sous === 'worktree' && a[1] === 'remove' && porte('--force', '-f')) return '`git worktree remove --force` : jamais'
  if (sous === 'commit' && !a.includes('--')) return '`git commit` sans `--` de chemins explicites : le commit des docs les nomme'
  return null
}

/** Motif du commit de dérivés de l'étape `derives` — ceux que le hook `post-rewrite` a laissés. */
export const MOTIF_POST_REWRITE = 'docs dérivés laissés non commités par le hook post-rewrite d’un rebase manuel'

/** Motif du commit de dérivés de l'étape `docs` — ceux que la régénération du train vient d'écrire. */
export const MOTIF_APRES_REBASE = 'docs dérivés régénérés après rebase sur origin/main (post-rewrite)'

/** Refus commun aux deux commits de dérivés : sans `#N`, la porte de commit refuserait le message. */
export const REFUS_SANS_TICKET =
  'aucun `#N` cité par la plage : le commit `chore(docs)` n’aurait aucun ticket, et la porte de commit le refuse — cite un ticket dans un commit de la plage'

/**
 * La PLAGE dont les `#N` légitiment un commit de dérivés. PURE. Le journal la porte dès que l'étape
 * `rebase` a rendu ; AVANT elle (étape `derives`), `origin/main..HEAD` la remplace — `origin/main`
 * vient d'être fetché par la préflight.
 */
export const plageDeCitations = (journal) =>
  journal?.base && journal?.tete ? `${journal.base}..${journal.tete}` : 'origin/main..HEAD'

/**
 * Message du commit de docs dérivés. PURE — une seule forme pour les deux étapes qui commettent.
 * Le SUJET tient la règle du dépôt (`scripts/guards/lib/sujetDeCommit.mjs`, mesurée ici par
 * `refusDeSujet`, jamais par un compte recopié) ; le MOTIF va au CORPS. Quand les `refs` d'une plage
 * chargée feraient déborder le sujet, elles descendent au corps : `numerosCites` lit le message
 * ENTIER (`scripts/guards/lib/fermetures.mjs:63`), corps compris.
 */
export const messageDeDerives = (numeros, motif) => {
  const refs = numeros.map((n) => `refs #${n}`).join(' ')
  const avecRefs = `chore(docs): ${refs} — docs dérivés\n\n${motif}\n`
  if (refs && refusDeSujet(avecRefs) === null) return avecRefs
  return `chore(docs): docs dérivés\n\n${motif}\n${refs ? `\n${refs}\n` : ''}`
}

/**
 * La FIN d'une sortie de commande — là où une porte imprime son verdict. PURE : les lignes `⛔` si
 * la sortie en porte, sinon ses `max` DERNIERS caractères.
 */
export const finDeSortie = (texte, max = 400) => {
  const t = String(texte ?? '').trim()
  const refus = t.split(/\r?\n/).filter((l) => l.includes('⛔'))
  if (refus.length) return refus.join('\n').slice(-max)
  return t.slice(-max)
}

/**
 * Ce que git a IMPRIMÉ dans une union de `scripts/guards/lib/gitPorte.mjs` : la `raison` d'une
 * indisponibilité, puis `stderr`, puis `stdout` — chaque morceau retenu sur son CONTENU, jamais par
 * un repli `??` (une chaîne vide n'est pas nullish : `classer` rend `{status, stdout, stderr:''}`
 * quand git n'écrit que sur stdout, `scripts/guards/lib/gitPorte.mjs:164`). PURE.
 * @param {object} vu union git @param {number} [max] borne de `finDeSortie`
 * @returns {string} '' quand git n'a rien imprimé
 */
export const sortieDe = (vu, max = 400) =>
  finDeSortie(
    [vu?.raison, vu?.valeur?.stderr, vu?.valeur?.stdout]
      .map((t) => String(t ?? '').trim())
      .filter(Boolean)
      .join('\n'),
    max,
  )

/** Ce que DIT un échec de git, jamais vide : sa sortie, ou son code de sortie nommé. PURE. */
export const refusDeGit = (vu, max = 400) => sortieDe(vu, max) || `(status ${vu?.valeur?.status ?? '?'}) — git n'a rien imprimé`

/** Refus du train quand le tronc bouge une SECONDE fois — une seule formulation, deux sites de lecture. */
export const REFUS_DEUX_FOIS = 'origin/main a bougé DEUX fois pendant le train — relancer `npm run ops:publier`'

/**
 * Le tronc a-t-il bougé sous le train ? PURE — UNE comparaison et UNE borne, lues AVANT le push et
 * APRÈS un push refusé (origin/main peut recevoir des commits entre les deux).
 * @param {{distant:string|null, base:string|null, reprises?:number}} p
 * @returns {'inchangé'|'relancer'|'rouge-deux-fois'}
 */
export function verdictDuTronc({ distant, base, reprises = 0 }) {
  if (distant === base) return 'inchangé'
  return (reprises ?? 0) >= 1 ? 'rouge-deux-fois' : 'relancer'
}

/** Refus de l'étape `rebase` sur un train de FUSION qui ne contient pas le tronc (#1998). */
export const REFUS_TRAIN_DE_FUSION =
  'train de fusion : fusionner `origin/main` dans la branche, puis `--reprendre` — jamais un rebase qui linéarise les fusions'

/**
 * Ce que l'étape `rebase` fait de la relation d'`origin/main` à HEAD (#1998). PURE.
 * @param {{contenu:boolean, fusions:boolean}} p `contenu` = `origin/main` ancêtre de HEAD ;
 *   `fusions` = `origin/main..HEAD` porte au moins un commit de fusion.
 * @returns {'contenu'|'fusions'|'rebase'}
 */
export function decisionDeRebase({ contenu, fusions }) {
  if (contenu) return 'contenu'
  return fusions ? 'fusions' : 'rebase'
}

/**
 * La lecture git que `decisionDeRebase` juge : `origin/main` ancêtre de HEAD (`estAncetre`), et
 * sinon les fusions de `origin/main..HEAD`.
 * @param {string} racine
 * @returns {{disponible:true, contenu:boolean, fusions:boolean}|{disponible:false, raison:string}}
 */
export function relationAuTronc(racine) {
  const vu = estAncetre('origin/main', 'HEAD', { cwd: racine })
  if (!vu.disponible) return { disponible: false, raison: vu.raison }
  if (vu.absent) return { disponible: false, raison: 'origin/main ou HEAD introuvable' }
  if (vu.valeur) return { disponible: true, contenu: true, fusions: false }
  const merges = lireGit(['rev-list', '--merges', 'origin/main..HEAD'], { cwd: racine, site: 'git rev-list' })
  const sortie = sortieOuNull(merges)
  if (sortie === null) return { disponible: false, raison: merges.disponible ? 'origin/main..HEAD illisible' : merges.raison }
  return { disponible: true, contenu: false, fusions: sortie.trim() !== '' }
}

/** Première ligne d'un message de commit, bornée. PURE. */
export const titreDeCommit = (message, max = 120) => {
  const ligne = String(message ?? '').split('\n')[0].trim()
  return ligne.length > max ? `${ligne.slice(0, max - 1)}…` : ligne
}

/**
 * Corps du commentaire de pilotage d'UN ticket. PURE — la marque est TOUJOURS la dernière ligne.
 * @param {{numero:string, base:string, tete:string, commits:{sha:string,message:string}[],
 *   ci:{etat:string, course?:object, attenteCiSecondes?:number},
 *   ferme:boolean, fermeParCi?:boolean, fermeAutrement?:boolean}} p
 */
export function corpsDePilotage({ numero, base, tete, commits, ci, ferme, fermeParCi = false, fermeAutrement = false }) {
  const court = (sha) => String(sha ?? '').slice(0, 9)
  const lignes = [
    `## Publication ${court(tete)}`,
    '',
    `Plage publiée : \`${court(base)} → ${court(tete)}\` sur \`main\`.`,
    '',
    `### Commits (${commits.length})`,
    ...commits.map((c) => `- \`${court(c.sha)}\` ${titreDeCommit(c.message)}`),
    '',
    '### CI',
  ]
  const course = ci?.course
  lignes.push(
    course
      ? `- ${ci.etat} — course \`${course.databaseId}\` : https://github.com/${DEPOT}/actions/runs/${course.databaseId}`
      : `- ${ci?.etat ?? 'non lue'} — aucune course rattachée à cette tête.`,
  )
  if (typeof ci?.attenteCiSecondes === 'number')
    lignes.push(`- attente du verdict CI : ${(ci.attenteCiSecondes / 60).toFixed(1)} min (temps d’attente, pas de machine locale).`)
  lignes.push('')
  if (fermeAutrement) lignes.push(`#${numero} était déjà FERMÉ par un autre geste que cette publication.`)
  else if (fermeParCi) lignes.push(`#${numero} a été FERMÉ par la CI (job \`fermetures\`) sur cette publication.`)
  else if (ferme) lignes.push(`Ce commit FERME #${numero} : fermeture par le job \`fermetures\` de la CI.`)
  else lignes.push(`#${numero} est rattaché (\`refs\`) par cette publication, non fermé.`)
  lignes.push('', marquePublication(tete))
  return `${lignes.join('\n')}\n`
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

/** Sortie d'un `git` de LECTURE, trimée, ou `null`. */
const lu = (args, cwd) => {
  const vu = sortieOuNull(lireGit(args, { cwd, site: `git ${args[0]}` }))
  return vu === null ? null : vu.trim()
}

/** Fichier temporaire hors de l'arbre (message de commit, corps de commentaire). */
function fichierTemporaire(prefixe, contenu) {
  const chemin = join(tmpdir(), `wfrp-publier-${prefixe}-${process.pid}-${Date.now()}.txt`)
  writeFileSync(chemin, contenu)
  return chemin
}

/** Les `#N` cités par la plage de `journal` (ou `origin/main..HEAD` avant le rebase), dédupliqués. */
function numerosDeLaPlage(racine, journal) {
  return [...new Set(commitsDeLaPlage(plageDeCitations(journal), racine).flatMap((c) => numerosCites(c.message)))]
}

/**
 * COMMIT de docs DÉRIVÉS : stage des chemins EXPLICITES, message qui cite les tickets de la plage,
 * `journal.tete` avancé. UNE implémentation, deux appelants (`derives` avant le rebase, `docs`
 * après) — le geste est le même, seul le MOTIF change.
 * @param {object} ctx @param {{chemins:string[], numeros:string[], motif:string, journal:object}} p
 * @returns {{ok:boolean, raison?:string, detail?:object, dit?:string}}
 */
function commettreDerives(ctx, { chemins, numeros, motif, journal }) {
  const fichier = fichierTemporaire('msg', messageDeDerives(numeros, motif))
  try {
    const add = ctx.git(['add', '--', ...chemins])
    if (!add.disponible || add.absent || add.valeur.status !== 0) return { ok: false, raison: `\`git add\` a échoué sur ${chemins.length} chemin(s)` }
    const commit = ctx.git(['commit', '-F', fichier, '--', ...chemins])
    if (!commit.disponible || commit.absent || commit.valeur.status !== 0) {
      return { ok: false, raison: `\`git commit\` des docs a échoué : ${refusDeGit(commit)}` }
    }
  } finally {
    rmSync(fichier, { force: true })
  }
  journal.tete = ctx.tete
  return { ok: true, detail: { chemins, numeros }, dit: `${chemins.length} doc(s) dérivé(s) commis — tête ${journal.tete.slice(0, 9)}` }
}

/**
 * Le verdict d'étape que porte un tronc MESURÉ, ou `null` s'il n'a pas bougé. Seul site qui
 * incrémente `journal.reprises` : la décision, elle, est la pure `verdictDuTronc`.
 * @param {object} journal @param {string|null} distant sha lu d'`origin/main` @param {string} phrase
 * @returns {{ok:boolean, relancer?:string[], dit?:string, raison?:string}|null}
 */
function jugerLeTronc(journal, distant, phrase) {
  const verdict = verdictDuTronc({ distant, base: journal.base, reprises: journal.reprises })
  if (verdict === 'inchangé') return null
  if (verdict === 'rouge-deux-fois') return { ok: false, raison: REFUS_DEUX_FOIS }
  journal.reprises = (journal.reprises ?? 0) + 1
  return {
    ok: true,
    relancer: ['rebase', 'docs', 'push-branche', 'ci'],
    dit: `${phrase} (${distant?.slice(0, 9)}) : le train reprend au rebase`,
  }
}

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

/** Attente BLOQUANTE sans busy-loop (le train est synchrone de bout en bout). */
function attendre(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}

/**
 * Le contexte que les étapes partagent. `git` est la SEULE porte de mutation, gardée par
 * `commandeInterdite` : un geste interdit JETTE avant tout spawn. `npm` est la SEULE porte des
 * `npm run <script>` des étapes — une porte, donc une décision mesurable en test.
 */
export function contexteDe({ racine, branche, options, journaliser, fdLog }) {
  return {
    racine,
    branche,
    options,
    journaliser,
    fdLog,
    npm(script) {
      // `shell: true` : sous win32, `npm` est un `.cmd`, que `spawnSync` ne sait lancer autrement.
      const binaire = process.platform === 'win32' ? 'npm.cmd' : 'npm'
      return spawnSync(binaire, ['run', script], { cwd: racine, stdio: ['ignore', fdLog, fdLog], shell: true })
    },
    get tete() {
      return lu(['rev-parse', 'HEAD'], racine)
    },
    /**
     * Le TRONC distant, fetché puis relu — la seule porte d'`origin/main` des étapes qui doivent le
     * mesurer À CHAUD (`push`), donc le seul point d'injection en test.
     * @returns {{disponible:true, sha:string|null}|{disponible:false, raison:string}}
     */
    tronc() {
      const vu = fetchOrigin({ cwd: racine })
      if (!vu.disponible) return { disponible: false, raison: vu.raison }
      return { disponible: true, sha: lu(['rev-parse', 'origin/main'], racine) }
    },
    git(args) {
      const interdit = commandeInterdite(args)
      if (interdit) throw new Error(`GESTE INTERDIT — ${interdit}`)
      return lireGit(args, { cwd: racine, site: `git ${args[0]}`, timeout: 600_000 })
    },
  }
}

/**
 * Remet les miroirs d'agents en phase AVANT le commit des dérivés, par la porte `ctx.npm`.
 * `agents:sync` se déclenche sur un `agents:check` ROUGE, jamais sur la saleté de `CLAUDE.md` : un
 * commit de la plage qui touche `.claude/skills/**` ou `.claude/credo.md` sans resynchroniser laisse
 * `agents:check` rouge au pre-commit, et le commit des docs échouerait sans nommer la cause.
 * @param {{npm: Function, journaliser: Function}} ctx
 * @returns {{ok: true} | {ok: false, raison: string}}
 */
export function synchroniserAgents(ctx) {
  const verif = ctx.npm('agents:check')
  if (verif.status === 0) return { ok: true }
  ctx.journaliser(`[publier] docs — \`agents:check\` rendu ${verif.status} : \`npm run agents:sync\`\n`)
  const sync = ctx.npm('agents:sync')
  if (sync.status !== 0)
    return { ok: false, raison: `\`npm run agents:sync\` a rendu ${sync.status} : le pre-commit jouerait \`agents:check\` et refuserait le commit` }
  return { ok: true }
}

/** La table des ÉTAPES : nom, `jouer(ctx, journal)`, `dejaFaite(ctx, journal)`. Ajouter une étape,
 *  c'est ajouter UNE entrée ici — rien d'autre. */
export const ETAPES = [
  {
    nom: 'preflight',
    // TOUJOURS rejouée : elle EST la garde.
    dejaFaite: () => false,
    jouer(ctx) {
      const { racine } = ctx
      for (const nom of ['rebase-merge', 'rebase-apply']) {
        const chemin = lu(['rev-parse', '--git-path', nom], racine)
        if (chemin && existsSync(resolve(racine, chemin)))
          return { ok: false, raison: `rebase interrompu (${nom}) : \`git rebase --abort\` ou \`--continue\` à la main, puis \`--reprendre\`` }
      }
      if (lu(['symbolic-ref', '--quiet', 'HEAD'], racine) === null)
        return { ok: false, raison: 'HEAD DÉTACHÉ : le train publie une branche, pas un sha errant' }
      const { derives, manuscrits } = partitionSales(cheminsSales(racine))
      if (manuscrits.length)
        return {
          ok: false,
          raison:
            `arbre NON COMMITÉ (${manuscrits.length}) — on ne publie que du committé :\n` +
            `${manuscrits.map((s) => `    ${s}`).join('\n')}` +
            (derives.length ? `\n  (et ${derives.length} doc(s) dérivé(s) régénéré(s) que l’étape derives aurait commis)` : ''),
        }
      const origine = lu(['remote', 'get-url', 'origin'], racine)
      if (!urlOrigineAcceptee(origine)) return { ok: false, raison: `origin étranger au dépôt : ${origine ?? 'illisible'}` }
      const vuFetch = fetchOrigin({ cwd: racine })
      if (!vuFetch.disponible) return { ok: false, raison: `origin non consultable : ${vuFetch.raison}` }
      const outil = resoudreOutilLocal(racine, 'vitest', 'vitest')
      if (outil.refus) return { ok: false, raison: outil.refus }
      const reste = derives.length
        ? `${derives.length} doc(s) dérivé(s) régénéré(s) non commités (post-rewrite) : l’étape derives les commet`
        : 'arbre propre'
      return {
        ok: true,
        detail: { derivesSales: derives },
        dit: `${reste}, origin consultable, outillage local posé`,
      }
    },
  },
  {
    // Les docs DÉRIVÉS sales sont commis ICI, AVANT le rebase. Mesuré (2026-09-14, 2ᵉ train réel) :
    // `git rebase origin/main` REFUSE de démarrer sur un arbre sale (« cannot rebase: You have
    // unstaged changes ») — tolérer la saleté à la préflight sans la committer avant le rebase ne
    // faisait que déplacer le refus d'une étape.
    nom: 'derives',
    dejaFaite(ctx) {
      return partitionSales(cheminsSales(ctx.racine)).derives.length === 0
    },
    jouer(ctx, journal) {
      const { racine } = ctx
      const { derives, manuscrits } = partitionSales(cheminsSales(racine))
      if (manuscrits.length)
        return {
          ok: false,
          raison:
            `MANUSCRIT(S) sale(s) que la préflight venait de refuser — l’arbre a bougé depuis :\n` +
            manuscrits.map((c) => `    ${c}`).join('\n'),
        }
      if (!derives.length) return { ok: true, dit: 'aucun doc dérivé sale' }
      const numeros = numerosDeLaPlage(racine, journal)
      if (!numeros.length) return { ok: false, raison: REFUS_SANS_TICKET }
      return commettreDerives(ctx, { chemins: derives, numeros, motif: MOTIF_POST_REWRITE, journal })
    },
  },
  {
    nom: 'rebase',
    dejaFaite(ctx, journal) {
      return Boolean(journal.base) && journal.base === lu(['rev-parse', 'origin/main'], ctx.racine) && journal.tete === ctx.tete
    },
    jouer(ctx, journal) {
      const { racine } = ctx
      const teteAvant = ctx.tete
      const relation = relationAuTronc(racine)
      if (!relation.disponible) return { ok: false, raison: `relation d’origin/main à HEAD illisible : ${relation.raison}` }
      const decision = decisionDeRebase(relation)
      if (decision === 'fusions') return { ok: false, raison: REFUS_TRAIN_DE_FUSION }
      const vu = decision === 'rebase' ? ctx.git(['rebase', 'origin/main']) : null
      if (vu && (!vu.disponible || vu.absent || vu.valeur.status !== 0)) {
        const conflits = (lu(['diff', '--name-only', '--diff-filter=U'], racine) ?? '').split('\n').filter(Boolean)
        const entame = ['rebase-merge', 'rebase-apply'].some((nom) => {
          const chemin = lu(['rev-parse', '--git-path', nom], racine)
          return Boolean(chemin) && existsSync(resolve(racine, chemin))
        })
        // Un rebase qui REFUSE DE DÉMARRER (arbre sale, HEAD détaché…) n'a rien entamé : `--abort`
        // y rendrait « No rebase in progress » et masquerait la vraie raison. Mesuré (2026-09-14) :
        // tout échec était classé CONFLIT, sans un seul fichier à nommer.
        if (!conflits.length && !entame) {
          const brut = vu.disponible && !vu.absent ? `${vu.valeur.stderr ?? ''}\n${vu.valeur.stdout ?? ''}` : vu.raison
          return { ok: false, raison: `rebase sur origin/main REFUSÉ (aucun rebase entamé) : ${raisonCourte(brut)}` }
        }
        ctx.git(['rebase', '--abort'])
        return {
          ok: false,
          raison: `rebase sur origin/main en CONFLIT (abandonné)${conflits.length ? ` — fichiers :\n${conflits.map((f) => `    ${f}`).join('\n')}` : ''}`,
        }
      }
      journal.base = lu(['rev-parse', 'origin/main'], racine)
      journal.tete = ctx.tete
      journal.teteAvant = teteAvant
      const commits = lu(['rev-list', `${journal.base}..HEAD`], racine)
      if (!commits) return { ok: false, raison: `rien à publier : ${journal.base?.slice(0, 9)}..HEAD est VIDE` }
      const dit = `base ${journal.base.slice(0, 9)} → tête ${journal.tete.slice(0, 9)}`
      return {
        ok: true,
        detail: { base: journal.base, tete: journal.tete, reecrit: teteAvant !== journal.tete },
        dit: decision === 'contenu' ? `tronc déjà contenu — ${dit}` : dit,
      }
    },
  },
  {
    nom: 'docs',
    // La tête ENREGISTRÉE sur l'étape, jamais `journal.tete` — celui-ci est réécrit par l'étape
    // `rebase` du lot SUIVANT, et un `docs` vert du lot précédent serait alors sauté à tort.
    dejaFaite(ctx, journal) {
      return journal.etapes.docs?.etat === 'vert' && journal.etapes.docs.tete === ctx.tete
    },
    jouer(ctx, journal) {
      const { racine } = ctx
      const touches = (lu(['diff', '--name-only', `${journal.base}..${journal.tete}`], racine) ?? '').split('\n').filter(Boolean)
      // La saleté est lue AVANT toute décision de saut : le hook `post-rewrite` d'un rebase MANUEL a
      // pu régénérer des dérivés sans les committer, alors que la plage ne touche aucune source de
      // doc. `touchesDocSources` ne court-circuite donc que la RÉGÉNÉRATION, jamais le COMMIT —
      // sauter celui-ci laisserait l'arbre sale jusqu'aux gates, qui le refusent.
      const salesAvant = cheminsSales(racine)
      const regenerer = touchesDocSources(touches, sourcesMesurees(racine))
      if (!regenerer && !salesAvant.length) return { ok: true, dit: 'aucune source de doc dans la plage, arbre propre : docs inchangés' }
      if (regenerer) {
        const check = spawnSync(process.execPath, [join(racine, 'scripts/docs/build-all.mjs'), '--check'], {
          cwd: racine, stdio: ['ignore', ctx.fdLog, ctx.fdLog],
        })
        if (check.status !== 0) {
          ctx.journaliser('[publier] docs — `--check` non vert : passe COMPLÈTE de build-all\n')
          const passe = spawnSync(process.execPath, [join(racine, 'scripts/docs/build-all.mjs'), '--quiet'], {
            cwd: racine, stdio: ['ignore', ctx.fdLog, ctx.fdLog],
          })
          if (passe.status !== 0)
            return {
              ok: false,
              raison: `build-all a rendu ${passe.status} : docs/ possiblement incohérent — \`git checkout -- docs/\` puis corriger la cause (rien n'a été staged ni commité)`,
            }
        }
      }
      const agents = synchroniserAgents(ctx)
      if (!agents.ok) return agents
      const chemins = cheminsSales(racine)
      const { manuscrits } = partitionSales(chemins)
      if (manuscrits.length)
        return { ok: false, raison: `doc MANUSCRIT modifié par la régénération :\n${manuscrits.map((c) => `    ${c}`).join('\n')}` }
      if (!chemins.length) return { ok: true, dit: 'docs dérivés déjà à jour : rien à committer' }
      const numeros = numerosDeLaPlage(racine, journal)
      if (!numeros.length) return { ok: false, raison: REFUS_SANS_TICKET }
      return commettreDerives(ctx, { chemins, numeros, motif: MOTIF_APRES_REBASE, journal })
    },
  },
  {
    // PUSH DE LA BRANCHE : c'est lui qui DÉCLENCHE la CI, et la CI est la porte (#1776). Le rebase a
    // réécrit l'histoire de la branche, donc `--force-with-lease` : il n'écrase que ce qu'on a lu.
    nom: 'push-branche',
    dejaFaite(ctx, journal) {
      if (!journal.tete) return false
      return lu(['rev-parse', `origin/${ctx.branche}`], ctx.racine) === journal.tete
    },
    jouer(ctx, journal) {
      const vu = ctx.git(['push', '--force-with-lease', 'origin', `HEAD:refs/heads/${ctx.branche}`])
      if (!vu.disponible || vu.absent || vu.valeur.status !== 0)
        return { ok: false, raison: `push de la branche REFUSÉ :\n${refusDeGit(vu)}` }
      return { ok: true, dit: `${journal.tete.slice(0, 9)} poussé sur ${ctx.branche} — la CI de la branche juge` }
    },
  },
  {
    // ATTENTE DU VERDICT CI sur la TÊTE, lue par son COMMIT : c'est ce sha-là que le ruleset exigera
    // vert au fast-forward. Le temps passé ici est du temps d'ATTENTE, pas du temps machine local —
    // le journal les sépare (`attenteCiSecondes`).
    nom: 'ci',
    dejaFaite(ctx, journal) {
      const vue = journal.etapes.ci
      return vue?.etat === 'vert' && vue.tete === ctx.tete && vue.detail?.etat === 'verte'
    },
    jouer(ctx, journal) {
      const debut = Date.now()
      const fin = debut + ctx.options.ciTimeoutMin * 60_000
      const attendu = (v) => ({ ...v, detail: { ...(v.detail ?? {}), attenteCiSecondes: (Date.now() - debut) / 1000 } })
      let dernier = { etat: 'absente' }
      while (Date.now() < fin) {
        const vu = coursesCi({ cwd: ctx.racine, commit: journal.tete, limit: 30 })
        if (!vu.disponible) ctx.journaliser(`[publier] ci — courses non lues : ${vu.raison}\n`)
        else {
          dernier = verdictDesRuns(vu.valeur, journal.tete)
          const id = dernier.course?.databaseId
          const url = id ? `https://github.com/${DEPOT}/actions/runs/${id}` : null
          ctx.journaliser(`[publier] ci — ${dernier.etat}${url ? ` — ${url}` : ''}\n`)
          if (dernier.etat === 'verte') return attendu({ ok: true, detail: dernier, dit: `course ${id} verte` })
          if (dernier.etat === 'rouge' || dernier.etat === 'annulee')
            return attendu({
              ok: false,
              detail: dernier,
              raison:
                `course CI ${dernier.etat}${id ? ` (${id})` : ''} sur ${journal.tete.slice(0, 9)} — RIEN n'est entré `
                + `dans main. Lire le job/step rouge : ${url ?? `gh run list --commit ${journal.tete.slice(0, 12)}`}`,
            })
        }
        attendre(PERIODE_SONDE_MS)
      }
      return attendu({
        indetermine: true,
        detail: dernier,
        raison: `aucun verdict de la CI en ${ctx.options.ciTimeoutMin} min sur ${journal.tete.slice(0, 9)} — rien n'est entré dans main`,
      })
    },
  },
  {
    // FAST-FORWARD de `main` sur une tête dont la CI est VERTE. Le ruleset `main` refuse tout le
    // reste côté serveur ; ici on ne fait que le geste, et on RELANCE quand le tronc a bougé pendant
    // l'attente CI (patron #1751) — la tête rebasée devra repasser par sa propre course.
    nom: 'ff-main',
    dejaFaite(ctx, journal) {
      if (!journal.tete) return false
      const vu = estAncetre(journal.tete, 'origin/main', { cwd: ctx.racine })
      return vu.disponible && !vu.absent && vu.valeur === true
    },
    jouer(ctx, journal) {
      const avant = ctx.tronc()
      if (!avant.disponible) return { ok: false, raison: `origin non consultable avant le fast-forward : ${avant.raison}` }
      const vuAvant = jugerLeTronc(journal, avant.sha, 'origin/main a bougé pendant l’attente CI')
      if (vuAvant) return vuAvant
      const vu = ctx.git(['push', 'origin', 'HEAD:main'])
      if (!vu.disponible || vu.absent || vu.valeur.status !== 0) {
        // Le tronc se REMESURE après un refus : origin/main peut recevoir des commits entre la
        // lecture d'amont et le push, et git refuse alors en `non-fast-forward` — c'est la MÊME
        // relance, jugée par la MÊME décision, pas une panne.
        const apres = ctx.tronc()
        const vuApres = apres.disponible ? jugerLeTronc(journal, apres.sha, 'origin/main a bougé pendant le push') : null
        if (vuApres) return vuApres
        return { ok: false, raison: `fast-forward de main REFUSÉ :\n${refusDeGit(vu)}` }
      }
      return { ok: true, dit: `${journal.tete.slice(0, 9)} entré dans main en fast-forward` }
    },
  },
  {
    nom: 'pilotage',
    // Le journal SUFFIT : chaque commentaire est déjà idempotent par sa marque (relue par `gh` dans
    // `jouer`), et une étape verte pour CETTE tête a posé ou constaté les N de CETTE plage.
    dejaFaite(ctx, journal) {
      const vue = journal.etapes.pilotage
      return vue?.etat === 'vert' && vue.tete === ctx.tete
    },
    jouer(ctx, journal) {
      const { racine } = ctx
      const commits = commitsDeLaPlage(`${journal.base}..${journal.tete}`, racine)
      const numeros = [...new Set(commits.flatMap((c) => numerosCites(c.message)))]
      const fermes = new Set(commits.flatMap((c) => numerosFermes(c.message)))
      const ci = journal.etapes.ci?.detail ?? { etat: 'non lue' }
      const rates = []
      const poses = []
      for (const numero of numeros) {
        const vue = lireTicket({ depot: DEPOT, numero, appel: appelGh(racine) })
        if (!vue.ok) {
          rates.push(`#${numero} : ${vue.raison}`)
          continue
        }
        const corpsVus = vue.corps
        if (corpsVus.some((c) => c.includes(marquePublication(journal.tete)))) {
          ctx.journaliser(`[publier] pilotage — #${numero} déjà piloté\n`)
          continue
        }
        const fermeParCi = corpsVus.some((c) => commits.some((k) => c.includes(marqueDe(k.sha))))
        const corps = corpsDePilotage({
          numero,
          base: journal.base,
          tete: journal.tete,
          commits,
          ci,
          ferme: fermes.has(numero),
          fermeParCi,
          fermeAutrement: vue.etat.toLowerCase() === 'closed' && !fermeParCi,
        })
        const pose = poserCommentaire({ depot: DEPOT, numero, corps, appel: appelGh(racine) })
        if (pose.ok) poses.push(numero)
        else rates.push(`#${numero} : ${pose.raison}`)
      }
      if (rates.length) return { ok: false, detail: { poses, rates }, raison: `pilotage manqué sur ${rates.length} ticket(s) :\n${rates.map((r) => `    ${r}`).join('\n')}` }
      return { ok: true, detail: { poses, numeros }, dit: `${poses.length} commentaire(s) posé(s) sur ${numeros.length} ticket(s) cité(s)` }
    },
  },
  {
    nom: 'fin',
    dejaFaite(ctx, journal) {
      return journal.etapes.fin?.etat === 'vert' && journal.etapes.fin.tete === ctx.tete
    },
    jouer(ctx, journal) {
      journal.etat = 'vert'
      return { ok: true, dit: `publication complète de ${journal.tete?.slice(0, 9)}` }
    },
  },
]

/** Chemins que `git status --porcelain -z` rend SALES, dédupliqués (un renommage porte ses deux). */
export function cheminsSales(racine) {
  const champs = String(sortieOuNull(lireGit(['status', '--porcelain', '-z'], { cwd: racine })) ?? '').split('\0')
  const chemins = []
  for (let i = 0; i < champs.length; i += 1) {
    const champ = champs[i]
    if (!champ) continue
    const etat = champ.slice(0, 2)
    chemins.push(champ.slice(3))
    if (/[RC]/.test(etat) && champs[i + 1]) {
      i += 1
      chemins.push(champs[i])
    }
  }
  return [...new Set(chemins.filter(Boolean))]
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
  const toplevel = lu(['rev-parse', '--show-toplevel'], RACINE)
  if (!toplevel || resolve(toplevel) !== resolve(RACINE)) {
    process.stderr.write(`[publier] REFUS : ${RACINE} n'est pas la racine de son dépôt (git dit ${toplevel ?? 'rien'})\n`)
    process.exit(1)
  }
  const branche = lu(['rev-parse', '--abbrev-ref', 'HEAD'], RACINE) ?? 'HEAD'
  const chemins = cheminsDeJournal(RACINE, branche)
  mkdirSync(chemins.dossier, { recursive: true })
  const surDisque = existsSync(chemins.json) ? lireJournal(chemins.json, branche) : null

  // La TÊTE VIVANTE : la seule contre laquelle une étape verte se juge (`planDeReprise`).
  const teteVivante = lu(['rev-parse', 'HEAD'], RACINE)

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
  if (repris) {
    const reprise = planDeReprise(journal, ETAPES.map((e) => e.nom), ctx.tete)
    journaliser(`[publier] reprise : ${reprise ?? 'rien à jouer (tout est vert pour cette tête)'}\n`)
  }
  let verdict
  try {
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

const estMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (estMain) process.exit(main())
