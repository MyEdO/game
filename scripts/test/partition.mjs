// Logique PURE du lanceur de suite `scripts/test/run.mjs` : partition des fichiers de test par
// environnement, répartition des workers, routage des filtres. Aucun spawn ; le seul accès disque
// est la mesure système `mesureMemoireDisponibleMo`.
import { readFileSync } from 'node:fs'
import os from 'node:os'
import { relative, isAbsolute, join } from 'node:path'

/** Docblock d'environnement — copie VERBATIM de la regex que Vitest 2.1.9 applique lui-même dans
 *  `groupFilesByEnv` (node_modules/vitest/dist/chunks/resolveConfig.rBxzbVsl.js:6559). Vitest la
 *  cherche dans le fichier ENTIER (pas de borne de tête) et hors de tout parseur de commentaire :
 *  une occurrence dans une chaîne compte. La partition doit décider comme lui, sinon un fichier
 *  jsdom atterrit dans le processus node — d'où la copie plutôt qu'une variante « propre ». */
export const REGEX_ENV_DOCBLOCK = /@(?:vitest|jest)-environment\s+([\w-]+)\b/

/** Environnement d'un fichier de test, du docblock ou, à défaut, de `test.environment`. */
export function environnementDe(code, defaut = 'node') {
  return code.match(REGEX_ENV_DOCBLOCK)?.[1] || defaut
}

/** Deux seaux : `jsdom` (docblock jsdom) et `node` (tout le reste). Le seau ne décide QUE du
 *  processus qui portera le fichier — Vitest relit le docblock et honore l'environnement réel,
 *  donc un `happy-dom` embarqué côté node reste exécuté en happy-dom. */
export function partitionner(fichiers, lire, defaut = 'node') {
  const node = []
  const jsdom = []
  for (const f of fichiers) (environnementDe(lire(f), defaut) === 'jsdom' ? jsdom : node).push(f)
  return { node, jsdom }
}

/** Seuil du partage, en cœurs : sous 7 (`n − 1 < 6`), un seul processus Vitest. */
export const SEUIL_PARTAGE = 7

/** Workers par processus : 2/3 node · 1/3 jsdom sur `n − 1`, le cœur restant allant au parent.
 *  Le gain du partage est mesuré à 16 cœurs (10+5, 12+6) ; la CI GitHub publique (4 vCPU) reste
 *  sous le seuil, donc mono-processus. Le régime RÉEL de chaque run est mesuré et imprimé par la
 *  ligne `[diag] machine` du lanceur (cœurs, mémoire, mode, bornes). */
export function repartitionWorkers(n) {
  if (n < SEUIL_PARTAGE) return { split: false, node: n, jsdom: 0 }
  const node = Math.max(1, Math.round((2 / 3) * (n - 1)))
  return { split: true, node, jsdom: Math.max(1, n - 1 - node) }
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

/** Cache de fichiers du cgroup mémoire de ce processus, en octets : `inactive_file + active_file` de
 *  son `memory.stat`. `procCgroup` est le texte de `/proc/self/cgroup`, `lire` un lecteur de
 *  fichier. Le contrôleur v1 `memory` (`/sys/fs/cgroup/memory<chemin>`, champs `total_*`) prime sur
 *  la ligne v2 `0::<chemin>` (`/sys/fs/cgroup<chemin>`) ; le champ v2 `file` n'est pas lu, il compte
 *  `shmem`. Illisible, absent ou champ manquant : 0. */
export function cacheFichiersCgroup(procCgroup, lire) {
  const lignes = procCgroup.split('\n').map((l) => l.match(/^(\d+):([^:]*):(.*)$/)).filter(Boolean)
  const v1 = lignes.find(([, , controleurs]) => controleurs.split(',').includes('memory'))
  const v2 = lignes.find(([, id, controleurs]) => id === '0' && controleurs === '')
  const [racine, champs] = v1
    ? [`/sys/fs/cgroup/memory${v1[3]}`, ['total_inactive_file', 'total_active_file']]
    : v2
      ? [`/sys/fs/cgroup${v2[3]}`, ['inactive_file', 'active_file']]
      : [null, []]
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
export const mesureMemoireDisponibleMo = () => {
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
 *  `vite.config.ts`, vérifiée par `src/tasDesWorkers.testkit.ts`). Paramètre de BANC, mesuré le
 *  2026-09-26 sur un conteneur de 4 cœurs et 15,7 Go, 3 workers (#1801) : sans borne, V8 taille le
 *  tas de chaque processus sur la machine (8 240 Mo par worker) ; à 2 048 Mo deux workers meurent
 *  (2 043 Mo vivants après compaction) ; à 3 072 Mo, suite en 339 s, pic système 11,8 Go,
 *  `worker perdu 0`. */
export const TAS_WORKER_MO = 3072

/** Empreinte RSS d'un worker sous `TAS_WORKER_MO`, en Mo. Paramètre de BANC : maximum de deux
 *  runs de la suite du 2026-09-26 sur le conteneur de `TAS_WORKER_MO` (3 workers, borne 3 072 Mo,
 *  RSS échantillonnée toutes les 3 s), somme des RSS des workers à l'échantillon du pic de la somme,
 *  divisée par 3 : run par `NODE_OPTIONS` 10 794 Mo → 3 598 ; run par la config 10 298 Mo → 3 433.
 *  Pic transitoire d'UN worker : 5 413 Mo et 4 909 Mo. */
export const EMPREINTE_WORKER_MO = 3598

/** RSS d'un processus Vitest parent, en Mo, réservée par processus Vitest lancé. Paramètre de BANC,
 *  mêmes deux runs, en mono seulement : pic du parent 1 205 Mo (`NODE_OPTIONS`) et 1 462 Mo
 *  (config), maximum retenu. */
export const PARENT_MO = 1462

/** Capacité servie par le lanceur : cœurs mesurés bornés par les workers que la mémoire disponible
 *  porte, plus le cœur du parent (même convention que `repartitionWorkers`/`maxWorkersMono`).
 *  Calculée avec un parent ; si ce résultat partage, recalculée avec deux (node et jsdom) — elle
 *  peut alors retomber sous le seuil, en mono, qui n'a qu'un parent. `portes` est le compte AVANT
 *  plancher ; sous un worker, le lanceur en sert un quand même et `borne` vaut `'plancher'`. */
export function capacite(cpus, memoireMo) {
  const avec = (parents) => {
    const portes = Math.floor((memoireMo - parents * PARENT_MO) / EMPREINTE_WORKER_MO)
    return { portes, servis: Math.min(cpus, 1 + Math.max(1, portes)) }
  }
  const mono = avec(1)
  const { portes, servis } = repartitionWorkers(mono.servis).split ? avec(2) : mono
  return {
    cpus,
    memoireMo,
    servis,
    portes,
    parents: repartitionWorkers(servis).split ? 2 : 1,
    borne: portes < 1 ? 'plancher' : servis < cpus ? 'mémoire' : 'cœurs',
  }
}

/** Filtrage positionnel de Vitest — reproduction de `filterFiles`
 *  (node_modules/vitest/dist/chunks/cli-api.DqsSTaIi.js:10044) : chemins relatifs à la racine,
 *  comparaison insensible à la casse, filtres passés en `/` sous Windows. */
export function filtrerFichiers(fichiers, filtres, racine, plateforme = process.platform) {
  if (!filtres.length) return fichiers
  const fs = plateforme === 'win32' ? filtres.map((f) => f.replace(/\\/g, '/')) : filtres
  return fichiers.filter((t) => {
    const cible = relative(racine, t).toLocaleLowerCase()
    return fs.some((f) => {
      if (isAbsolute(f) && t.startsWith(f)) return true
      const rel = f.endsWith('/') ? join(relative(racine, f), '/') : relative(racine, f)
      return cible.includes(f.toLocaleLowerCase()) || cible.includes(rel.toLocaleLowerCase())
    })
  })
}

/** Côtés à lancer pour ces filtres : un filtre qui ne désigne que des fichiers jsdom ne rend que
 *  `jsdom`. Aucun filtre → les deux. Aucun fichier touché → `node` seul, donc un côté unique : le
 *  lanceur retombe sur le lancement mono-processus, qui rend le verdict de Vitest sur ce filtre. */
export function cotesRequis(filtres, partition, racine, plateforme = process.platform) {
  if (!filtres.length) return ['node', 'jsdom']
  const cotes = ['node', 'jsdom'].filter(
    (c) => filtrerFichiers(partition[c], filtres, racine, plateforme).length > 0,
  )
  return cotes.length ? cotes : ['node']
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
 *  l'argv de l'appelant part intact dans l'enfant (cf. `argumentsEnfant`). */
export function separerArguments(argv, estChemin = () => true) {
  const filtres = []
  let mono = false
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith('-')) {
      const nom = a.split('=')[0]
      if (DRAPEAUX_MONO.includes(nom)) mono = true
      // Forme séparée `--reporter json` : la valeur suit et n'est pas un positionnel.
      if (!a.includes('=') && argv[i + 1] && !argv[i + 1].startsWith('-') && VALEUR_ATTENDUE.includes(nom)) i++
    } else if (estChemin(a)) filtres.push(a)
  }
  return { filtres, mono }
}

const VALEUR_ATTENDUE = [
  '--config', '-c', '--workspace', '--reporter', '--outputFile', '--testNamePattern', '-t',
  '--pool', '--environment', '--mode', '--shard', '--root', '-r', '--dir', '--project',
]

/** Ligne de commande d'un enfant : les drapeaux du partage, puis l'argv de l'appelant TEL QUEL —
 *  rien n'est reconstruit, donc aucun argument n'est perdu, dupliqué ni déplacé. */
export function argumentsEnfant(vitest, config, workers, argv) {
  return [
    vitest,
    'run',
    '--config',
    config,
    '--maxWorkers',
    String(workers),
    // `--maxWorkers` sans `--minWorkers` découvre 0 fichier (mesuré 2026-08-23).
    '--minWorkers',
    '1',
    // Un filtre qui ne touche qu'un côté laisse l'autre sans fichier : ce n'est pas un échec.
    '--passWithNoTests',
    ...argv,
  ]
}

/** Verdict d'un processus enfant : un enfant tué par signal, ou clos sans code, ne réussit pas. */
export function codeEnfant(code, signal) {
  return signal ? 1 : (code ?? 1)
}

/** Verdict du lanceur : les deux côtés doivent réussir. */
export function codeAgrege(codes) {
  return codes.every((c) => c === 0) ? 0 : 1
}

/** Une entrée d'`include` est un GLOB : un chemin porteur de métacaractère ne peut pas être
 *  recopié tel quel dans la config générée sans risquer d'être perdu des deux côtés. */
export function cheminsGlobSuspects(chemins) {
  return chemins.filter((c) => /[*?[\]{}()!]/.test(c))
}

/** Plafond de workers du lancement mono-processus : `min(4, cœurs − 1)`, plancher 1 — le lanceur
 *  occupe un cœur. La CI publique à 4 vCPU a relevé 14,9 Go / 15,6 Go (96 %) de mémoire système
 *  avec 4 workers ([diag] du run 33458711078, #1619). Le lancement partagé a ses propres bornes
 *  (`argumentsEnfant`). */
export const maxWorkersMono = (cpus) => Math.max(1, Math.min(4, cpus - 1))

/** Bornes à injecter devant l'argv de l'appelant : rien si l'appelant borne DÉJÀ lui-même — un
 *  `--minWorkers` en double fait sortir cac en 148 ms (« Expected a single value », mesuré
 *  2026-08-30). Les deux graphies acceptées par cac (`--minWorkers`, `--min-workers`) comptent. */
export function bornesWorkers(argv, cpus) {
  const nom = (a) => a.split('=')[0].toLowerCase().replace(/-/g, '')
  const borne = argv.some((a) => a.startsWith('-') && ['minworkers', 'maxworkers'].includes(nom(a)))
  return borne ? [] : ['--minWorkers=1', `--maxWorkers=${maxWorkersMono(cpus)}`]
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

/** Motifs de DÉTRESSE du run, comptés au fil de la sortie. Chaque regex est un fragment VERBATIM du
 *  message émetteur : react/cjs/react.development.js:2620 (act chevauchants),
 *  react-dom/cjs/react-dom.development.js:27628 (act hors act) et :29371 (unmount pendant rendu),
 *  @vitest/runner/dist/index.js:72 (test expiré), tinypool/dist/index.js:118 (worker perdu — le
 *  message porte une capitale, d'où le drapeau `i`). Un message d'amont qui change fait tomber le
 *  test d'échantillons de `run.test.mjs`, jamais le compteur en silence. */
export const SENTINELLES = [
  ['act hors act', /inside a test was not wrapped in act/],
  ['act chevauchants', /overlapping act\(\) calls/],
  ['unmount pendant rendu', /synchronously unmount a root while React was already rendering/],
  ['React coincé', /Should not already be working/],
  ['test expiré', /Test timed out in \d+ms/],
  ['worker perdu', /worker exited unexpectedly|JS heap out of memory/i],
]

/** Tas utilisé d'un worker en fin de fichier, en Mo — fragment VERBATIM du reporter sous
 *  `logHeapUsage` (node_modules/vitest/dist/chunks/index.DsZFoqi9.js:3452). */
export const TAS_UTILISE = /(\d+) MB heap used/

/** Part de `TAS_WORKER_MO` dont le bloc `[diag]` alerte. Paramètre maison. */
export const SEUIL_ALERTE_TAS = 0.85

/** Compte, par libellé, les lignes portant chaque sentinelle. Une ligne peut en porter plusieurs. */
export function compterSentinelles(lignes) {
  const compte = Object.fromEntries(SENTINELLES.map(([libelle]) => [libelle, 0]))
  for (const ligne of lignes) {
    for (const [libelle, motif] of SENTINELLES) if (motif.test(ligne)) compte[libelle]++
  }
  return compte
}

/** Bloc `[diag]` du run : machine (ce que le lanceur a RÉELLEMENT servi, et ce qui l'a borné), pic
 *  de mémoire relevé au fil du run, comptes de sentinelles, pic de tas d'un worker. `capacite`,
 *  `partage` et `maxWorkers` sont FOURNIS et non déduits des cœurs : un drapeau global à un seul
 *  processus (`--coverage`) impose le mono même à 16 cœurs. `tasMaxMo` vaut `null` sans aucune ligne
 *  de tas. */
export function bilanDiagnostic(
  compte,
  { capacite, memGo, memMaxGo, rssMaxMo, secondes, partage, maxWorkers, tasMaxMo },
) {
  const { cpus, memoireMo, servis, portes, parents } = capacite
  const reserve = parents * PARENT_MO + EMPREINTE_WORKER_MO
  const pourcent = memGo > 0 ? Math.round((memMaxGo / memGo) * 100) : 0
  const comptes = SENTINELLES.map(([libelle]) => `${libelle} ${compte[libelle] ?? 0}`).join(' · ')
  const borne = capacite.borne === 'cœurs' ? 'cœurs' : `${capacite.borne} (${servis} cœurs servis)`
  const porte =
    capacite.borne === 'plancher'
      ? `mémoire insuffisante pour un worker (${Math.round(memoireMo)} Mo < ${reserve} Mo)`
      : `${portes} worker${portes > 1 ? 's' : ''} porté${portes > 1 ? 's' : ''}`
  const tasPourcent = tasMaxMo === null ? 0 : Math.round((tasMaxMo / TAS_WORKER_MO) * 100)
  const tas =
    tasMaxMo === null
      ? `non relevé / ${TAS_WORKER_MO} Mo`
      : `${tasMaxMo} Mo / ${TAS_WORKER_MO} Mo (${tasPourcent} %)` +
        (tasMaxMo >= SEUIL_ALERTE_TAS * TAS_WORKER_MO ? ` · ALERTE ≥ ${Math.round(SEUIL_ALERTE_TAS * 100)} %` : '')
  return [
    `[diag] machine : ${cpus} cœurs · ${memGo.toFixed(1)} Go · disponible ${(memoireMo / 2 ** 10).toFixed(1)} Go` +
      ` → ${porte} · réserve de ${parents} parent${parents > 1 ? 's' : ''} · borné par ${borne}` +
      ` · ${partage ? 'partagé' : 'mono'} (seuil ${SEUIL_PARTAGE}) · maxWorkers=${maxWorkers}`,
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

/** Une suite est COMPLÈTE quand aucun fichier ne la filtre et qu'aucun drapeau ne la restreint. */
export const suiteComplete = (filtres, argv) =>
  filtres.length === 0 && !argv.some((a) => DRAPEAUX_RESTRICTIFS.includes(a.split('=')[0]))
