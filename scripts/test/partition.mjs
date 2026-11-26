// Calcul des tranches de la suite Vitest, de ses bornes de mémoire et de son diagnostic.
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import os from 'node:os'
import { NAISSANCE_ABSENTE, estPidVivantDepuis } from '../guards/lib/pid.mjs'

/** Le nom de l'atelier du lanceur `pid` né à `naissance` (ms epoch) : `<pid>-<naissance>`, la naissance écrite par le lanceur lui-même (#2603). PURE. */
export const nomDAtelier = (pid, naissance) => `${pid}-${Math.floor(naissance)}`

/**
 * Les ateliers de `noms` dont le lanceur ne vit plus : `<pid>-<naissance>` (`nomDAtelier`) jugé né à sa naissance
 * (`estPidVivantDepuis`), `<pid>` sans naissance jugé sur son existence seule (`NAISSANCE_ABSENTE`) ; ni celui du lanceur `pid`, ni un nom hors forme (#2603).
 * PURE hors de `estVivant` et `identite`.
 * @param {string[]} noms
 * @param {{ pid: number, estVivant?: (pid: number) => boolean, identite: { lireCreation: (pid: number) => number | null, toleranceMs: number } }} juge
 * @returns {string[]}
 */
export function ateliersMorts(noms, { pid, estVivant, identite }) {
  return noms.filter((nom) => {
    const vu = /^([1-9]\d*)(?:-(\d+))?$/.exec(nom)
    return vu !== null && Number(vu[1]) !== pid && !estPidVivantDepuis(Number(vu[1]), vu[2] === undefined ? NAISSANCE_ABSENTE : Number(vu[2]), identite, { estVivant })
  })
}

/** Docblock d'environnement — copie VERBATIM de la regex que Vitest 5.0.3 applique lui-même dans
 *  `detectCodeBlock` (node_modules/vitest/dist/chunks/index.DpLw24bj.js:6034). Vitest la
 *  cherche dans le fichier ENTIER (pas de borne de tête) et hors de tout parseur de commentaire :
 *  une occurrence dans une chaîne compte. La partition doit décider comme lui, sinon un fichier
 *  jsdom atterrit dans le processus node — d'où la copie plutôt qu'une variante « propre ». */
export const REGEX_ENV_DOCBLOCK = /@(?:vitest|jest)-environment\s+([\w-]+)\b/

/** Environnement d'un fichier de test, du docblock ou, à défaut, de `test.environment`. */
export function environnementDe(code, defaut = 'node') {
  return code.match(REGEX_ENV_DOCBLOCK)?.[1] || defaut
}

/** Les `elements` regroupés par `environnementDe(element)`, groupes dans l'ordre de première apparition, ordre
 *  interne conservé : Vitest ne réemploie un worker que pour un fichier suivant de même environnement
 *  (node_modules/vitest/dist/chunks/index.DpLw24bj.js:11549, #3412). PURE. */
export function grouperParEnvironnement(elements, environnementDe) {
  const groupes = new Map()
  for (const element of elements) {
    const environnement = environnementDe(element)
    groupes.set(environnement, [...(groupes.get(environnement) ?? []), element])
  }
  return [...groupes.values()].flat()
}

/** Entier > 0 posé par l'environnement, sinon la mesure système. */
function forceOuMesure(valeur, mesure) {
  const force = Number(valeur)
  return Number.isInteger(force) && force > 0 ? force : mesure()
}

/** Cœurs pris en compte pour décider du partage. La mesure système est la règle ; `WFRP_TEST_COEURS`
 *  la FORCE — seule façon de jouer le chemin PARTAGÉ (ou le chemin mono) sur une machine quelconque,
 *  et de le tenir sous test (`run-capture.test.mjs`) plutôt que à la merci du matériel du runner. */
export function coeurs(env, mesure) {
  return forceOuMesure(env.WFRP_TEST_COEURS, mesure)
}

function racineCgroupLinux() {
  return '/sys/fs/cgroup'
}

export const CONTRATS_DE_DERIVATION = [
  { fonction: racineCgroupLinux, namespace: '/sys/fs/cgroup' },
]

/** Cache de fichiers du cgroup mémoire de ce processus, en octets : `inactive_file + active_file` de
 *  son `memory.stat`. `procCgroup` est le texte de `/proc/self/cgroup`, `lire` un lecteur de
 *  fichier. Le contrôleur v1 `memory` (`/sys/fs/cgroup/memory<chemin>`, champs `total_*`) prime sur
 *  la ligne v2 `0::<chemin>` (`/sys/fs/cgroup<chemin>`) ; le champ v2 `file` n'est pas lu, il compte
 *  `shmem`. Illisible, absent ou champ manquant : 0. */
function cacheFichiersCgroup(procCgroup, lire) {
  const v1 = procCgroup
    .split('\n')
    .map((l) => l.match(/^\d+:([^:]*):(.*)$/))
    .find((m) => m?.[1].split(',').includes('memory'))
  const v2 = procCgroup.match(/^0::(.*)$/m)
  const { racine, champs } = v1
    ? { racine: `${racineCgroupLinux()}/memory${v1[2]}`, champs: ['total_inactive_file', 'total_active_file'] }
    : v2
      ? { racine: `${racineCgroupLinux()}${v2[1]}`, champs: ['inactive_file', 'active_file'] }
      : { racine: null, champs: [] }
  if (racine === null) return 0
  let stat
  try {
    stat = lire(`${racine.replace(/\/$/, '')}/memory.stat`)
  } catch {
    return 0
  }
  const valeurs = champs.map((c) => Number(stat.match(new RegExp(`^${c} (\\d+)$`, 'm'))?.[1]))
  return valeurs.every(Number.isFinite) ? valeurs[0] + valeurs[1] : 0
}

/** Mémoire DISPONIBLE pour ce processus, en octets, de `disponible` (`process.availableMemory()`),
 *  `contrainte` (`process.constrainedMemory()`), `libre` (`os.freemem()`) et `totale`
 *  (`os.totalmem()`). Sans contrainte de cgroup (nulle, ou ≥ la mémoire totale) : `disponible`. Sous
 *  contrainte : libuv `uv_get_available_memory` rend limite − usage, et l'usage d'un cgroup compte
 *  la mémoire anonyme ET le cache de fichiers, que le noyau reprend avant tout OOM. La définition
 *  retenue est celle de `MemAvailable` : le cache de fichiers est disponible, borné par `libre`.
 *  Sonde du 2026-09-27, conteneur de la suite (cgroup v1) : limite 13 681 Mo, usage 1 719 Mo dont
 *  cache 1 630 Mo (`active_file` 1 149, `inactive_file` 480) et rss 3 Mo ; `availableMemory`
 *  11 955 Mo, `freemem` 15 332 Mo. */
export function memoireDisponibleOctets(procCgroup, lire, { disponible, contrainte, libre, totale }) {
  if (!contrainte || contrainte >= totale) return disponible
  return Math.min(libre, disponible + cacheFichiersCgroup(procCgroup, lire))
}

/** Mesure système de `memoireDisponibleOctets`, en Mo. Couvre Linux (cgroup v1/v2) et Windows
 *  (libuv `ullAvailPhys`) ; macOS non mesuré (libuv s'y rabat sur les pages libres). */
const mesureMemoireDisponibleMo = () => {
  const lire = (f) => readFileSync(f, 'utf8')
  const procCgroup = (() => {
    try {
      return lire('/proc/self/cgroup')
    } catch {
      return ''
    }
  })()
  const nombres = {
    disponible: process.availableMemory(),
    contrainte: process.constrainedMemory(),
    libre: os.freemem(),
    totale: os.totalmem(),
  }
  return memoireDisponibleOctets(procCgroup, lire, nombres) / 2 ** 20
}

/** Mémoire disponible au lancement, en Mo. Même lecture que `coeurs` : `WFRP_TEST_MEMOIRE_MO` la
 *  FORCE. */
export function memoireDisponibleMo(env, mesure = mesureMemoireDisponibleMo) {
  return forceOuMesure(env.WFRP_TEST_MEMOIRE_MO, mesure)
}

/** Borne du vieil espace V8 d'un worker de la suite, en Mo (`--max-old-space-size`, posée par
 *  `vitest.config.ts`, vérifiée par `src/tasDesWorkers.testkit.ts`). Paramètre de BANC, mesuré le
 *  2026-09-26 sur un conteneur de 4 cœurs et 15,7 Go, 3 workers (#1801) : sans borne, V8 taille le
 *  tas de chaque processus sur la machine (8 240 Mo par worker) ; à 2 048 Mo deux workers meurent
 *  (2 043 Mo vivants après compaction) ; à 3 072 Mo, suite en 339 s, pic système 11,8 Go,
 *  `worker perdu 0`. */
export const TAS_WORKER_MO = 3072

/** Délai d'un test Vitest, en ms (`testTimeout` de `vitest.config.ts`) : paramètre de
 *  BANC calé sur le test le plus lourd mesuré en CI (#1619) ; le contrat des tests ne change pas. */
export const DELAI_DE_TEST_MS = 15_000

/** Borne de durée d’un paquet Node, commune au plan estimé et au lancement réel. */
export const PLAFOND_PAQUET_NODE_MS = 30 * 60_000

/** Empreinte d'un worker Vitest par RÉGIME de lancement, en Mo : `suite` (la suite entière), `lot` (un lot de
 *  fichiers, `test:perimetre`). Paramètres de BANC du 2026-10-08, Vitest 5.0.3, Windows 16 cœurs, mémoire de
 *  travail des processus échantillonnée (#2497) ; empreinte = somme au pic / workers. `suite` : run s4, 2 workers,
 *  389 workers recyclés, somme au pic 4 680 Mo → 2 340 (pic transitoire d'UN worker 3 974). `lot` : runs a2
 *  (71 fichiers, 2 506 / 2 = 1 253) et b3 (6 fichiers lourds, 3 301 / 2 = 1 651) ; le lot prend le pic
 *  transitoire d'UN worker de b3, 1 973, comme marge. */
export const EMPREINTES_WORKER_MO = Object.freeze({ suite: 2340, lot: 1973 })

/** Portée du régime `lot` (`EMPREINTES_WORKER_MO`), en secondes de mur estimé du lancement Vitest : la durée du plus
 *  long lot mesuré, b3, 294,4 s à 2 workers (2026-10-08, #2497, c.6060346318). Le pic d'un worker croît avec la part de
 *  travail qu'il porte ; au-delà, l'empreinte du lot n'est pas mesurée. */
export const PORTEE_LOT_S = 294.4

/** RSS d'un processus Vitest parent, en Mo, réservée par processus Vitest lancé. Paramètre de BANC : deux
 *  runs de la suite du 2026-09-26, en mono : pic du parent 1 205 Mo (`NODE_OPTIONS`) et 1 462 Mo (config),
 *  maximum retenu ; run s4 du 2026-10-08 (`EMPREINTES_WORKER_MO`) : 1 434 Mo de mémoire de travail. */
export const PARENT_MO = 1462

/** Workers en deçà desquels le lanceur REFUSE (`MEMOIRE_INSUFFISANTE`, `capacite`) plutôt que de servir au-delà
 *  de la mémoire, dès que les cœurs les permettent : sous `isolate:false`, UN worker reçoit tous les fichiers d'un
 *  environnement en une requête (node_modules/vitest/dist/chunks/index.DpLw24bj.js:11912-11920). Mesuré sur la
 *  suite le 2026-10-08 (#2497) : 5 414 Mo pour ce worker seul, 6,2 Go pour l'arbre, contre 5,65 Go à 2 workers. */
export const MINIMUM_WORKERS = 2

/** Admission d'un lancement `node --test`, en OCTETS : `disponibleOctets` mesurés, `profils` (`{ fichier, picOctets }`)
 *  dont le plus gros pic dimensionne (`fichierDimensionnant`), `parentOctets` du parent. Refus `MEMOIRE_INSUFFISANTE`
 *  seulement quand `parentOctets + pic` (`minimumOctets`) dépasse le disponible ; l'objectif `objectifOctets` (#2603)
 *  ne borne que la `concurrence`, jamais sous 1, que bornent aussi `cpus` et `nombre` (fichiers lancés). */
export function admissionNode(cpus, disponibleOctets, { profils = [], parentOctets = 0, objectifOctets = 2.5 * 2 ** 30, nombre = profils.length } = {}) {
  const dimensionnant = profils
    .filter((p) => Number.isSafeInteger(p?.picOctets) && p.picOctets > 0)
    .reduce((a, b) => !a || b.picOctets > a.picOctets ? b : a, null)
  const picOctets = dimensionnant?.picOctets ?? 0
  const budgetOctets = Math.min(disponibleOctets, objectifOctets)
  const minimumOctets = parentOctets + picOctets
  const refus = minimumOctets > disponibleOctets ? 'MEMOIRE_INSUFFISANTE' : null
  const concurrence = refus ? 0 : Math.max(1, Math.min(nombre, cpus, picOctets ? Math.floor((budgetOctets - parentOctets) / picOctets) : nombre))
  return { concurrence, budgetOctets, minimumOctets, parentOctets, picOctets, fichierDimensionnant: dimensionnant?.fichier, refus }
}

/** Capacité de Vitest : un parent et des workers bornés par les cœurs et la mémoire disponible.
 *  Sous le minimum requis par le régime et le nombre de fichiers, l’admission est refusée. */
export function capacite(cpus, memoireMo, regime, fichiers = Infinity) {
  if (!Object.hasOwn(EMPREINTES_WORKER_MO, regime))
    throw new Error(`régime de lancement inconnu : « ${regime} » — attendu ${Object.keys(EMPREINTES_WORKER_MO).join(' | ')}`)
  const empreinteMo = EMPREINTES_WORKER_MO[regime]
  const portes = Math.floor((memoireMo - PARENT_MO) / empreinteMo)
  const servis = Math.min(cpus, 1 + Math.max(0, portes))
  const minimumMo = PARENT_MO + Math.min(MINIMUM_WORKERS, maxWorkersMono(cpus), fichiers) * empreinteMo
  return {
    refus: memoireMo < minimumMo ? 'MEMOIRE_INSUFFISANTE' : null,
    minimumMo,
    cpus,
    memoireMo,
    regime,
    empreinteMo,
    servis,
    portes,
    parents: 1,
    borne: servis < cpus ? 'mémoire' : 'cœurs',
  }
}

/** La capacité servie par le lanceur sous l'environnement `env`, le régime `regime` et les `fichiers` lancés : `capacite`
 *  des cœurs (`coeurs`, mesure `os.availableParallelism`) et de la mémoire disponible (`memoireDisponibleMo`). Lue par
 *  `run.mjs` et par l'estimation du mur de `perimetre.mjs`. */
export const capaciteDuLanceur = (env, regime, fichiers) =>
  capacite(coeurs(env, () => os.availableParallelism()), memoireDisponibleMo(env), regime, fichiers)

/** Le nom d'un argument de l'argv, sans sa valeur `=…`. PURE. */
const nomDuDrapeau = (a) => a.split('=')[0]

/** Drapeau du lanceur qui nomme le régime (`EMPREINTES_WORKER_MO`), `--regime=<r>` ; jamais transmis à Vitest. */
export const DRAPEAU_REGIME = '--regime'

/** Le régime demandé par l'argv du lanceur et l'argv SANS lui : `suite` par défaut, `{ refus }` nommé pour une
 *  valeur inconnue ou une forme sans `=`. */
export function regimeDeArgv(argv) {
  const demandes = argv.filter((a) => nomDuDrapeau(a) === DRAPEAU_REGIME)
  const reste = argv.filter((a) => nomDuDrapeau(a) !== DRAPEAU_REGIME)
  const attendu = `attendu ${DRAPEAU_REGIME}=${Object.keys(EMPREINTES_WORKER_MO).join('|')}`
  if (demandes.length > 1) return { refus: `${DRAPEAU_REGIME} donné ${demandes.length} fois (${demandes.join(', ')}) — ${attendu}` }
  if (!demandes.length) return { regime: 'suite', argv: reste }
  const regime = demandes[0].slice(DRAPEAU_REGIME.length + 1)
  if (!demandes[0].includes('=') || !Object.hasOwn(EMPREINTES_WORKER_MO, regime))
    return { refus: `régime de lancement inconnu : « ${demandes[0]} » — ${attendu}` }
  return { regime, argv: reste }
}

/** Drapeaux dont la sémantique est globale à UN processus : rapport unique (`--coverage`,
 *  `--outputFile`), sortie machine que le préfixage `[node] `/`[jsdom] ` rendrait illisible
 *  (`--reporter`, `--mergeReports` — cac accepte aussi la graphie `--merge-reports`), racine ou
 *  configuration qui entrent en conflit avec celles des configs générées (`--config`/`-c`,
 *  `--root`/`-r`, `--workspace`), modes hors lancement unique (`--shard`, `--ui`, `--watch`/`-w`). */
export const DRAPEAUX_MONO = [
  '--config', '-c', '--workspace', '--coverage', '--shard', '--ui', '--watch', '-w',
  '--outputFile', '--reporter', '--mergeReports', '--merge-reports', '--root', '-r',
]

/** Sépare les arguments passés après `npm test --` : positionnels vs drapeaux. Un positionnel ne
 *  devient un FILTRE de routage que s'il est un chemin existant (`estChemin`) ; tout autre token
 *  (valeur de drapeau, motif de `-t`, nombre) ne route rien. Aucun argument n'est consommé ici :
 *  l'argv de l'appelant part intact dans l'enfant. */
export function separerArguments(argv, estChemin = () => true) {
  const filtres = []
  let mono = false
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith('-')) {
      const nom = nomDuDrapeau(a)
      if (DRAPEAUX_MONO.includes(nom)) mono = true
      // Forme séparée `--reporter json` : la valeur suit et n'est pas un positionnel.
      if (!a.includes('=') && argv[i + 1] && !argv[i + 1].startsWith('-') && VALEUR_ATTENDUE.includes(nom)) i++
    } else if (estChemin(a)) filtres.push(a)
  }
  return { filtres, mono }
}

/** Fichiers lancés par les `filtres` de `separerArguments` quand chacun nomme un fichier (`estFichier`) : leur
 *  compte ; sinon (aucun filtre, un dossier) `Infinity`, la suite ou un dossier entier. PURE. */
export const fichiersNommes = (filtres, estFichier) =>
  filtres.length && filtres.every(estFichier) ? filtres.length : Infinity

const VALEUR_ATTENDUE = [
  '--config', '-c', '--workspace', '--reporter', '--outputFile', '--testNamePattern', '-t',
  '--pool', '--environment', '--mode', '--shard', '--root', '-r', '--dir', '--project',
]

/** Plafond de workers que l'appelant demande dans `argv`, sous les deux graphies que cac accepte, `--maxWorkers`
 *  et `--max-workers`, jointe (`=`) ou séparée (node_modules/vitest/dist/chunks/cac.DfDGTQ9W.js:186-190, 215-217) :
 *  `{ argv, maxWorkers }`, l'argv privé de ce seul drapeau, `maxWorkers` à `null` sans demande. Une demande répétée
 *  rend `{ refus: 'MAX_WORKERS_DUPLIQUE' }`, une valeur non entière ou inférieure à 1 `{ refus: 'MAX_WORKERS_INVALIDE' }`. */
export function demandeWorkers(argv) {
  const reste = []
  let maxWorkers = null
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (!/^--max-?workers(?:=|$)/i.test(a)) { reste.push(a); continue }
    if (maxWorkers !== null) return { refus: 'MAX_WORKERS_DUPLIQUE' }
    const valeur = a.includes('=') ? a.slice(a.indexOf('=') + 1) : argv[++i]
    const n = Number(valeur)
    if (!Number.isInteger(n) || n < 1) return { refus: 'MAX_WORKERS_INVALIDE' }
    maxWorkers = n
  }
  return { argv: reste, maxWorkers }
}

/** Une entrée d'`include` est un GLOB : un chemin porteur de métacaractère ne peut pas être
 *  recopié tel quel dans la config générée sans risquer d'être perdu des deux côtés. */
export function cheminsGlobSuspects(chemins) {
  return chemins.filter((c) => /[*?[\]{}()!]/.test(c))
}

/** Plafond de workers du lancement mono-processus : `min(4, cœurs − 1)`, plancher 1 — le lanceur
 *  occupe un cœur. La CI publique à 4 vCPU a relevé 14,9 Go / 15,6 Go (96 %) de mémoire système
 *  avec 4 workers ([diag] du run 33458711078, #1619).  */
export const maxWorkersMono = (cpus) => Math.max(1, Math.min(4, cpus - 1))

/** Plafond à injecter devant l'argv de l'appelant : `maxWorkersMono(cpus)`, abaissé à la demande de l'appelant
 *  (`demandeWorkers`, qui replie les deux graphies que cac accepte, `--maxWorkers` et `--max-workers` :
 *  node_modules/vitest/dist/chunks/cac.DfDGTQ9W.js:186-190, 215-217). Une demande refusée lève. */
export function bornesWorkers(argv, cpus, demande = demandeWorkers(argv)) {
  if (demande.refus) throw new Error(demande.refus)
  return [`--maxWorkers=${Math.min(maxWorkersMono(cpus), demande.maxWorkers ?? Infinity)}`]
}

/** Environnement des processus Vitest : sortie SANS séquence ANSI. `FORCE_COLOR` est SUPPRIMÉ, pas
 *  mis à `'0'` — tinyrainbow teste la PRÉSENCE de la variable (44 séquences ANSI subsistaient avec
 *  `FORCE_COLOR=0`, mesuré 2026-08-30), et Node avertit deux fois par processus quand `NO_COLOR` et
 *  `FORCE_COLOR` cohabitent. */
export function envEnfant(env) {
  const sortie = { ...env }
  for (const cle of Object.keys(sortie)) if (/^force_color$/i.test(cle)) delete sortie[cle]
  sortie.NO_COLOR = '1'
  return sortie
}

/** Ligne de bilan du reporter Vitest (`Test Files  1 passed (1)`, `Tests  7 passed (7)`). */
export function porteBilan(ligne) {
  return /^\s*(?:Test Files|Tests)\s+\S/.test(ligne)
}

/** En-tête de la capture, écrit AVANT le lancement : le fichier n'est jamais vide, même si le run
 *  est tué (timeout, coupure). */
export function enteteCapture({ commande, pid, cwd, date }) {
  return [
    `# commande : ${commande}`,
    `# date : ${date.toISOString()}`,
    `# pid : ${pid}`,
    `# cwd : ${cwd}`,
    '',
    '',
  ].join('\n')
}

/** Résumé final. Un échec SANS bilan Vitest (aucune ligne `Test Files`/`Tests`) rend la cause
 *  BRUTE plutôt qu'un résumé vide ; le chemin de la capture est la dernière ligne. */
export function resumeLancement({ statut, bilan, queue, capture }) {
  const lignes = []
  if (statut !== 0 && !bilan) {
    lignes.push(`[test] ÉCHEC (code ${statut}) sans bilan Vitest — cause brute :`)
    for (const ligne of queue) lignes.push(ligne)
  }
  lignes.push(`capture : ${capture}`)
  return lignes.join('\n') + '\n'
}

// Messages de détresse de Vitest, comptés au fil de la sortie.
export const SENTINELLES = [
  ['test expiré', /Test timed out in \d+ms/],
  ['worker perdu', /worker exited unexpectedly|JS heap out of memory/i],
]

/** Tas utilisé d'un worker en fin de fichier, en Mo — fragment VERBATIM du reporter sous
 *  `logHeapUsage` (node_modules/vitest/dist/chunks/index.DpLw24bj.js:16353). */
export const TAS_UTILISE = /(\d+) MB heap used/

/** Part de `TAS_WORKER_MO` dont le bloc `[diag]` alerte. Paramètre maison. */
const SEUIL_ALERTE_TAS = 0.85

/** Compte, par libellé, les lignes portant chaque sentinelle. Une ligne peut en porter plusieurs. */
export function compterSentinelles(lignes) {
  const compte = Object.fromEntries(SENTINELLES.map(([libelle]) => [libelle, 0]))
  for (const ligne of lignes) {
    for (const [libelle, motif] of SENTINELLES) if (motif.test(ligne)) compte[libelle]++
  }
  return compte
}

/** Diagnostic de la capacité, de la pression mémoire et des sentinelles observées dans la sortie. */
export function bilanDiagnostic(
  compte,
  { capacite, memGo, memMaxGo, rssMaxMo, secondes, maxWorkers, tasMaxMo },
) {
  const { cpus, memoireMo, regime, empreinteMo, servis, portes, parents } = capacite
  const pourcent = memGo > 0 ? Math.round((memMaxGo / memGo) * 100) : 0
  const comptes = SENTINELLES.map(([libelle]) => `${libelle} ${compte[libelle] ?? 0}`).join(' · ')
  const borne = capacite.borne === 'cœurs' ? 'cœurs' : `${capacite.borne} (${servis} cœurs servis)`
  const porte = capacite.refus ? 'refus ' + capacite.refus + ' (minimum ' + capacite.minimumMo + ' Mo)'
    : `${portes} worker${portes > 1 ? 's' : ''} porté${portes > 1 ? 's' : ''}`
  const tasPourcent = tasMaxMo === null ? 0 : Math.round((tasMaxMo / TAS_WORKER_MO) * 100)
  const tas =
    tasMaxMo === null
      ? `non relevé / ${TAS_WORKER_MO} Mo`
      : `${tasMaxMo} Mo / ${TAS_WORKER_MO} Mo (${tasPourcent} %)` +
        (tasMaxMo >= SEUIL_ALERTE_TAS * TAS_WORKER_MO ? ` · ALERTE ≥ ${Math.round(SEUIL_ALERTE_TAS * 100)} %` : '')
  return [
    `[diag] machine : ${cpus} cœurs · ${memGo.toFixed(1)} Go · disponible ${(memoireMo / 2 ** 10).toFixed(1)} Go` +
      ` → régime ${regime} (${empreinteMo} Mo par worker) · ${porte} · réserve de ${parents} parent${parents > 1 ? 's' : ''} · borné par ${borne}` +
      ` · maxWorkers=${maxWorkers}`,
    `[diag] mémoire système max : ${memMaxGo.toFixed(1)} Go / ${memGo.toFixed(1)} Go (${pourcent} %)` +
      ` · rss lanceur max ${Math.round(rssMaxMo)} Mo · fenêtre ${secondes.toFixed(1)} s`,
    `[diag] sentinelles : ${comptes}`,
    `[diag] tas max d'un worker : ${tas}`,
    '',
  ].join('\n')
}

/** Drapeaux de Vitest qui RESTREIGNENT ce qui est joué : sous l'un d'eux, un vert ne dit rien de la
 *  suite entière. `--bail` n'en est pas : il ARRÊTE au premier rouge, donc un run VERT sous `--bail`
 *  a tout joué. */
export const DRAPEAUX_RESTRICTIFS = [
  '--changed',
  '-t',
  '--testNamePattern',
  '--shard',
  '--project',
  '--dir',
  '--related',
  '--exclude',
]

/** Variable d'environnement qui demande UNE partie de la suite, `i/K` — posée par le job matrice
 *  `suite` de `.github/workflows/ci.yml`. */
export const VARIABLE_PARTIE = 'WFRP_TEST_PARTIE'

/** La variable de la ZONE du push (#5037 L2, `zoneDuDiff`) : sous une partie, la tranche se prend dans la sélection de
 *  la zone (`selectionDeLaZone`, scripts/test/selectionDeZone.mjs) ; absente ou vide, dans la suite entière. */
export const VARIABLE_ZONE = 'WFRP_TEST_ZONE'

/** Partie demandée : `null` quand la variable est ABSENTE, `{ i, k }` pour `i/K` avec 1 ≤ i ≤ K, sinon
 *  `{ refus }` nommé. Une valeur vide est MAL FORMÉE, jamais absente. */
export function partieDe(valeur) {
  if (valeur === undefined) return null
  const m = /^([1-9]\d*)\/([1-9]\d*)$/.exec(valeur)
  if (m && Number(m[1]) <= Number(m[2])) return { i: Number(m[1]), k: Number(m[2]) }
  return { refus: `${VARIABLE_PARTIE} mal formée : « ${valeur} » — attendu i/K, deux entiers avec 1 ≤ i ≤ K` }
}

/** Refus de jouer une partie sous ces arguments, ou `null`. Une partie est COMPLÈTE sur sa tranche :
 *  aucun filtre de fichier ni drapeau restrictif (`DRAPEAUX_RESTRICTIFS`), aucun régime (`DRAPEAU_REGIME`) —
 *  elle joue la suite —, et aucun drapeau global à un seul processus (`DRAPEAUX_MONO`), dont la config ou la
 *  racine contrediraient celle de la tranche. */
export function refusDePartie({ filtres, argv }) {
  if (filtres.length)
    return `${VARIABLE_PARTIE} combinée à un filtre de fichier (${filtres.join(', ')}) : une partie se joue sur sa tranche ENTIÈRE`
  const restrictif = argv.find((a) => DRAPEAUX_RESTRICTIFS.includes(nomDuDrapeau(a)))
  if (restrictif) return `${VARIABLE_PARTIE} combinée au drapeau restrictif ${restrictif} : une partie se joue sur sa tranche ENTIÈRE`
  const regime = argv.find((a) => nomDuDrapeau(a) === DRAPEAU_REGIME)
  if (regime) return `${VARIABLE_PARTIE} combinée à ${regime} : une partie joue la suite, sous le régime \`suite\``
  const global = argv.find((a) => a.startsWith('-') && DRAPEAUX_MONO.includes(nomDuDrapeau(a)))
  if (global) return `${VARIABLE_PARTIE} combinée au drapeau ${global}, global à un seul processus Vitest : la tranche porte sa propre config`
  return null
}

/** Partie (1..K) d'un fichier de test : empreinte SHA-1 de son chemin relatif POSIX, modulo K. Elle ne
 *  dépend que de CE chemin : un fichier ajouté n'en déplace aucun autre, quand une tranche contiguë de
 *  la liste triée déplacerait ses frontières. */
export function partieDuFichier(chemin, k) {
  return (createHash('sha1').update(chemin).digest().readUInt32BE(0) % k) + 1
}

const parUniteDeCode = (a, b) => (a < b ? -1 : a > b ? 1 : 0)

/** Empreinte d'une liste de chemins TRIÉE : 12 hex de son SHA-1. */
const empreinteDe = (chemins) => createHash('sha1').update(chemins.join('\n')).digest('hex').slice(0, 12)

/** Tête de la suite : chemin → durée en ms des fichiers mesurés à 30 s ou plus, lignes de module du reporter Vitest
 *  des jobs `suite 1/3`..`suite 3/3` de la course `merge_group` 45743546851 (2026-11-26, #5106). Paramètre de
 *  BANC (#5037) : les 37 fichiers portent 2 315 s des 3 717 s de la suite ; sous la tête précédente, la partie 3 en tenait 1 501 s
 *  contre 1 049 et 1 166, sous celle-ci 1 243 contre 1 211 et 1 263. Committée, jamais rapatriée au moment de trancher : les K jobs tranchent la même partition.
 *  Une durée périmée ne coûte que de l'équilibre ; elle se relève au mémo `durees-ci.json` (`rapatrierDureesCi`). */
export const TETE_DE_LA_SUITE = Object.freeze({
  'src/data/field-consumers.test.ts': 201_278,
  'hotes/godot/asset/evaluer.cli.hors-store.test.ts': 154_311,
  'src/eslint-ordre-total-et-purete.test.ts': 147_414,
  'src/analyse-retention-guard.test.ts': 126_015,
  'src/scene-field-editability-guard.test.ts': 90_609,
  'src/purete-hote-lint.test.ts': 85_379,
  'src/narratif-field-editability-guard.test.ts': 78_457,
  'src/compendium-field-editability-guard-5.test.ts': 76_952,
  'src/compendium-field-editability-guard-14.test.ts': 74_207,
  'src/carte-field-editability-guard.test.ts': 70_787,
  'src/compendium-field-editability-guard-3.test.ts': 68_689,
  'src/compendium-field-editability-guard-13.test.ts': 60_628,
  'src/compendium-field-editability-guard-2.test.ts': 59_561,
  'src/compendium-field-editability-guard-6.test.ts': 58_421,
  'src/compendium-field-editability-guard-12.test.ts': 57_167,
  'hotes/godot/asset/tenue.hors-store.test.ts': 56_612,
  'hotes/godot/pont/compendium.hors-store.test.ts': 56_050,
  'src/noyau/built-brand-lint.test.ts': 50_013,
  'src/compendium-field-editability-guard-1.test.ts': 49_280,
  'src/noyau/navire-flow.hors-store.test.ts': 48_304,
  'src/compendium-field-editability-guard-10.test.ts': 46_481,
  'src/data/atelierDuCodex.test.ts': 43_621,
  'src/point-d-entree-guard.test.ts': 41_002,
  'src/data/seam-ecriture-guard.test.ts': 40_483,
  'src/compendium-field-editability-guard-11.test.ts': 40_426,
  'hotes/godot/construire.hors-store.test.ts': 40_064,
  'src/coupe-au-caractere-guard.test.ts': 39_490,
  'src/data/structures-contrat.test.ts': 39_200,
  'scripts/personnage-3d/base/sources.test.ts': 38_488,
  'src/noyau/transitionDuJeu.test.ts': 37_977,
  'src/compendium-field-editability-guard-7.test.ts': 37_475,
  'src/noyau/blessures-transition.hors-store.test.ts': 36_230,
  'hotes/texte/exploration.hors-store.test.ts': 35_137,
  'projets/roguelite/src/jeu/creation5e.test.ts': 34_127,
  'src/noyau/roll-seam-exclusivity-guard.test.ts': 33_002,
  'hotes/godot/vivant.hors-store.test.ts': 31_090,
  'hotes/godot/pont/editeur.hors-store.test.ts': 30_761,
})

/** Partie (1..K) de chaque fichier de `tete` (chemin → durée en ms) PRÉSENT dans `chemins` : du plus lourd au plus
 *  léger (égalité : ordre par unité de code), chacun vers la partie la moins chargée (égalité : le plus petit
 *  indice). Ne dépend que de `tete` et de la présence de ses clés. PURE. */
function partiesDeLaTete(chemins, k, tete) {
  const presents = new Set(chemins)
  const lourds = Object.entries(tete).filter(([c]) => presents.has(c)).sort(([a, x], [b, y]) => y - x || parUniteDeCode(a, b))
  const charges = Array(k).fill(0)
  const parties = new Map()
  for (const [chemin, ms] of lourds) {
    const j = charges.indexOf(Math.min(...charges))
    parties.set(chemin, j + 1)
    charges[j] += ms
  }
  return parties
}

/** Tranche de la partie `{ i, k }` : les fichiers de la tête `tete` que `partiesDeLaTete` donne à `i`, puis les
 *  autres chemins relatifs POSIX dont `partieDuFichier` vaut `i`, triés par unité de code, l'empreinte de cette
 *  tranche, et celle de la liste ENTIÈRE (`empreinteListe`), commune aux K parties d'une même énumération. */
export function trancher(chemins, { i, k }, tete = TETE_DE_LA_SUITE) {
  const parties = partiesDeLaTete(chemins, k, tete)
  const fichiers = chemins.filter((c) => (parties.get(c) ?? partieDuFichier(c, k)) === i).sort(parUniteDeCode)
  return { fichiers, empreinte: empreinteDe(fichiers), empreinteListe: empreinteDe([...chemins].sort(parUniteDeCode)) }
}
