// RÉPARTITEUR des hooks d'appel d'outil (#2125) : UNE lecture du stdin (`lireStdinBorne`), UN contexte,
// les gardes du registre (`registre.mjs`) retenues par `hook_event_name` et `tool_name`, UN cumul, UNE
// sortie projetée sur la surface. Le point d'entrée de la porte de fermeture
// (`solde-ticket-hook.mjs`) passe par le même `executer`. Contrat d'une garde :
// `scripts/guards/lib/contratGarde.mjs`. Déclarations : `scripts/agents/compat-core.mjs`.
import '../node-requis.mjs'
import { appendFileSync, mkdirSync } from 'node:fs'
import { dirname, isAbsolute, resolve } from 'node:path'
import { lireStdinBorne } from '../guards/lib/stdinBorne.mjs'
import {
  EDITION, SHELL, cheminVise, commandeDe, decisionCumulee, ecrituresDe, entreeDOutil, familleLeanCtx, nomLeanCtx, outilCouvert,
} from '../guards/lib/contratGarde.mjs'
import { racineNpmDe, sousRacineNpm } from '../guards/lib/racineNpm.mjs'
import { arbrePrincipal, depotDe, estRepertoire } from '../guards/lib/gitPorte.mjs'
import { canoniser, relatifSousRacine } from '../docs/lib/chemin-mesure.mjs'
import {
  affectationsDEnvironnement, cibleDeLaCommande, commandeDeLecture, configsGitDeLaCommande, drapeauxGitDeLieu,
  nomsDeLaCommande, versCheminNatif,
} from './solde-ticket-guard.mjs'

/** Surface qui lance le hook : Claude Code pose `CLAUDE_PROJECT_DIR` dans l'environnement de ses hooks,
 *  Codex ne le pose jamais. */
export const surfaceDe = (env) => (env.CLAUDE_PROJECT_DIR ? 'claude' : 'codex')

/** Date LOCALE `AAAA-MM-JJ` (pas UTC) : un solde écrit après minuit heure locale porte la date locale. */
const dateLocale = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/**
 * Variables d'environnement qui changent le programme exécuté, le dépôt ou ce qu'il lit sans que le
 * texte jugé le dise (#2224). `parNom` : nom distinctif, et TOUT jeton de la commande qui le nomme rend
 * l'appel non jugeable, quelle que soit la syntaxe qui l'écrit (`nomsDeLaCommande`). Sinon (`PATH`,
 * `ENV`, mots courants), seule son affectation est refusée (`affectationsDEnvironnement` : en tête,
 * seule, exportée, PowerShell `$env:`). Toute autre variable (`WFRP_TEST_COEURS=4 npm test`) reste admise.
 */
export const AFFECTATIONS_NON_JUGEABLES = Object.freeze([
  {
    motif: /^(?:GIT_INDEX_FILE|GIT_INDEX_VERSION|GIT_OBJECT_DIRECTORY|GIT_ALTERNATE_OBJECT_DIRECTORIES|GIT_DIR|GIT_WORK_TREE|GIT_NAMESPACE|GIT_CEILING_DIRECTORIES|GIT_DISCOVERY_ACROSS_FILESYSTEM|GIT_COMMON_DIR|GIT_DEFAULT_HASH|GIT_DEFAULT_REF_FORMAT)$/i,
    parNom: true,
    effet: 'git prend dans l’environnement le dépôt, l’index ou l’arbre qu’il opère (`git help git`, « ENVIRONMENT VARIABLES », « The Git Repository ») : il n’opère plus le dépôt jugé',
  },
  {
    // `GIT_CONFIG_PARAMETERS` : celle que `git -c` pose pour ses sous-processus (git, `config.c`,
    // `environment.h` ; RelNotes 2.31.0).
    motif: /^GIT_CONFIG(?:_GLOBAL|_SYSTEM|_NOSYSTEM|_COUNT|_KEY_[0-9]+|_VALUE_[0-9]+|_PARAMETERS)?$/i,
    parNom: true,
    effet: 'git lit dans l’environnement une configuration absente du texte jugé, `core.hooksPath` compris (`git help config`, « ENVIRONMENT »)',
  },
  { motif: /^NODE_OPTIONS$/i, parNom: true, effet: 'node précharge des modules absents du texte jugé (nodejs.org/api/cli.html, NODE_OPTIONS)' },
  { motif: /^npm_config_/i, parNom: true, effet: 'npm lit sa configuration dans l’environnement (docs.npmjs.com, `config`, « Environment Variables ») : le script lancé n’est plus celui que les gardes lisent' },
  { motif: /^BASH_ENV$/i, parNom: true, effet: 'bash exécute ce fichier avant sa commande (`man bash`, INVOCATION) : un texte absent de la commande jugée' },
  { motif: /^PATH$/i, parNom: false, effet: 'le shell cherche le programme lancé dans ces répertoires (POSIX `sh`, « Command Search and Execution ») : le programme exécuté n’est plus celui que le texte nomme' },
  { motif: /^ENV$/i, parNom: false, effet: 'un shell POSIX exécute ce fichier avant sa commande (POSIX `sh`, ENV) : un texte absent de la commande jugée' },
])

/** Un lieu NON JUGEABLE : la `raison`, et le `canal` à prendre à la place. */
const nonJugeable = (raison, canal) => ({ nonJugeable: { raison, canal } })

const CANAL_CWD = 'passer `cwd` ABSOLU, dans l’arbre principal (ses `.wt-*` compris)'

/**
 * Le répertoire de BASE d'un appel, ou la raison pour laquelle il n'est pas jugeable. Hors lean-ctx :
 * le `cwd` de l'entrée de hook, sinon celui du processus. Shell lean-ctx sans `command` (`job_id`,
 * `background_action`) : rien ne s'exécute, sa base est celle du hook. Avec : son `cwd`, qui doit être
 * absolu, exister tel que lean-ctx le lit (sans conversion MSYS : `/c/x` y est le `c/x` du disque courant, #2224), et
 * tenir dans l'arbre principal (`arbrePrincipal`) — absent, il vaut le dernier `cwd` passé (lean-ctx 3.10.2 : « Working dir
 * (persists across calls) ») ; relatif, il se résout contre la racine de lean-ctx ; hors de cet arbre,
 * lean-ctx l'exécute à sa racine (#2224). Écriture lean-ctx : un `path` relatif se résout contre la
 * racine de lean-ctx, jamais contre celle du hook.
 */
function baseDeLAppel(entree, cwd, platform) {
  const hook = typeof entree?.cwd === 'string' && entree.cwd ? resolve(cwd, versCheminNatif(entree.cwd, platform)) : cwd
  const famille = familleLeanCtx(nomLeanCtx(entree?.tool_name))
  if (famille === EDITION) {
    const relatif = ecrituresDe(entree).map(cheminVise).find((p) => p !== undefined && !isAbsolute(versCheminNatif(p, platform)))
    if (relatif === undefined) return { base: hook }
    return nonJugeable(`\`path\` relatif (${relatif}) : lean-ctx le résout contre SA racine, pas contre celle du hook`, 'un `path` absolu')
  }
  if (famille !== SHELL || commandeDe(entree).trim() === '') return { base: hook }
  const brut = entreeDOutil(entree)?.cwd
  if (typeof brut !== 'string' || brut.trim() === '') {
    return nonJugeable('`cwd` absent : lean-ctx exécute dans le dernier `cwd` passé, qui persiste d’un appel à l’autre', CANAL_CWD)
  }
  if (!isAbsolute(brut)) return nonJugeable(`\`cwd\` relatif (${brut}) : lean-ctx le résout contre SA racine`, CANAL_CWD)
  const natif = resolve(brut)
  if (!estRepertoire(natif)) return nonJugeable(`\`cwd\` inexistant tel que lean-ctx le lit (${brut} → ${natif})`, CANAL_CWD)
  const principal = arbrePrincipal(depotDe(hook))
  if (!principal.disponible) return nonJugeable(`\`cwd\` invérifiable (${principal.raison})`, CANAL_CWD)
  if (relatifSousRacine(canoniser(principal.valeur), natif) === null) {
    return nonJugeable(`\`cwd\` hors de l’arbre principal ${principal.valeur} (${brut}) : lean-ctx l’exécute à sa racine`, CANAL_CWD)
  }
  return { base: natif }
}

/** Les entrées de `AFFECTATIONS_NON_JUGEABLES` que `nom` désigne, sous la règle `parNom` voulue. */
const entreesDe = (nom, parNom) => AFFECTATIONS_NON_JUGEABLES.filter((e) => e.parNom === parNom && e.motif.test(nom))

/** Ce que `command` nomme ou pose et qu'aucune garde ne lit, chacun avec son effet, sans doublon : les
 *  noms `parNom` qu'un jeton porte (`nomsDeLaCommande`), les affectations des autres
 *  (`affectationsDEnvironnement`), les clés de `git -c`/`--config-env` (`configsGitDeLaCommande`), les
 *  drapeaux git de lieu (`drapeauxGitDeLieu`). */
const lieuxPosesParLaCommande = (command) => [...new Set([
  ...configsGitDeLaCommande(command).map((cle) => 'git -c ' + cle + ' : git lit une configuration absente du texte jugé, jumelle de GIT_CONFIG_PARAMETERS (`git help git`, -c, --config-env)'),
  ...nomsDeLaCommande(command).flatMap((nom) => entreesDe(nom, true).map(({ effet }) => `${nom} nommé : ${effet}`)),
  ...affectationsDEnvironnement(command).flatMap((nom) => entreesDe(nom, false).map(({ effet }) => `${nom} : ${effet}`)),
  ...drapeauxGitDeLieu(command).map((drapeau) => `git ${drapeau} : git opère ce dépôt ou cet arbre, pas celui du répertoire jugé (\`git help git\`, ${drapeau})`),
])]

/** Les variables qui remplacent une clé de `git -c` (`git help git`, GIT_EDITOR, GIT_SEQUENCE_EDITOR),
 *  hors de `AFFECTATIONS_NON_JUGEABLES`. */
const REMPLACANTS_DE_CONFIG = Object.freeze({ 'core.editor': 'GIT_EDITOR=true', 'sequence.editor': 'GIT_SEQUENCE_EDITOR=true' })

/** Le canal d'une commande refusée par `lieuxPosesParLaCommande` : `ctx_search` quand elle ne fait que
 *  LIRE (`commandeDeLecture`), sinon la même commande sans ce qui la rend non jugeable, chaque clé de
 *  `git -c` avec son remplaçant (`REMPLACANTS_DE_CONFIG`). */
function canalDesLieuxPoses(command) {
  if (commandeDeLecture(command)) return '`ctx_search` pour chercher ce nom (une recherche qui le nomme n’est pas jugeable en shell)'
  const configs = [...new Set(configsGitDeLaCommande(command))].map((cle) => (REMPLACANTS_DE_CONFIG[cle]
    ? '`-c ' + cle + '` : `' + REMPLACANTS_DE_CONFIG[cle] + '` en tête de la commande'
    : '`-c ' + cle + '` : la même commande sans `-c` ; une configuration durable passe par `git config`'))
  return ['la même commande sans ce nom, cette affectation ni ce drapeau (`cd` ou `git -C` vers le dépôt visé)', ...configs].join(' ; ')
}

/**
 * Le contexte d'un appel, construit UNE fois : la SEULE résolution de « où ça s'exécute ». `dir` = la
 * cible PROUVÉE par la commande (`cibleDeLaCommande`, retenue seulement si elle existe), sinon la base
 * de l'appel (`baseDeLAppel`) ; `null` quand ce n'est pas jugeable, avec `nonJugeable` = `{ raison,
 * canal }` (refusé par `canal-outil-guard.mjs`) — lieu non jugeable, ou ce que la commande pose
 * (`lieuxPosesParLaCommande`). `racineNpm` = la racine npm de `dir` (`racineNpmDe`), où `npm run <x>`
 * se résout. `cibleIgnoree` = ce que la commande nommait sans que ce soit un répertoire réel ;
 * `pannes` = pannes de lecture git de l'appel.
 */
export function construireContexte(entree, { env = process.env, cwd = process.cwd(), maintenant = new Date(), platform = process.platform } = {}) {
  const commun = { today: dateLocale(maintenant), pannes: [], env }
  const lieu = baseDeLAppel(entree, cwd, platform)
  if (lieu.nonJugeable) return { ...commun, dir: null, racineNpm: null, cibleIgnoree: null, nonJugeable: lieu.nonJugeable }
  const command = commandeDe(entree)
  const cible = cibleDeLaCommande(command, lieu.base, platform)
  const dir = cible.dir ?? lieu.base
  const racineNpm = racineNpmDe(dir)
  const refusees = sousRacineNpm(racineNpm, () => lieuxPosesParLaCommande(command))
  if (refusees.length) {
    const { nonJugeable: affectation } = nonJugeable(`environnement ou dépôt posé par la commande — ${refusees.join(' ; ')}`, canalDesLieuxPoses(command))
    return { ...commun, dir: null, racineNpm: null, cibleIgnoree: cible.ignore, nonJugeable: affectation }
  }
  return { ...commun, dir, racineNpm, cibleIgnoree: cible.ignore, nonJugeable: null }
}

/**
 * Les verdicts des `gardes`, dans l'ordre, chacun étiqueté de sa garde. Une garde qui LÈVE rend un
 * contexte qui la nomme, jamais un refus ; un `deny` court-circuite les suivantes.
 */
export async function evaluerGardes(gardes, entree, contexte) {
  const verdicts = []
  for (const garde of gardes) {
    let rendus
    try {
      rendus = [await sousRacineNpm(contexte.racineNpm, () => garde.evaluer(entree, contexte))].flat().filter(Boolean)
    } catch (e) {
      rendus = [{ contexte: `garde ${garde.nom} en panne : ${e?.message ?? e}` }]
    }
    verdicts.push(...rendus.map((v) => ({ ...v, garde: garde.nom })))
    if (rendus.some((v) => v.decision === 'deny')) break
  }
  return verdicts
}

/** Les contextes des verdicts, sans répéter un contexte ENTIER qu'une même garde a déjà rendu (un lot
 *  `ops` qui vise deux fois le même fichier). */
function contextesDe(verdicts) {
  const vus = new Set()
  return verdicts.filter((v) => v.contexte).filter((v) => {
    const cle = `${v.garde}\u0000${v.contexte}`
    return !vus.has(cle) && vus.add(cle)
  }).map((v) => v.contexte)
}

/** Le cumul des verdicts : la décision (`decisionCumulee`), les contextes concaténés (`contextesDe`),
 *  les traces demandées. Un refus porte toujours une raison. */
export function cumuler(verdicts) {
  const decision = decisionCumulee(verdicts.filter((v) => v.decision).map((v) => ({
    reason: String(v.raison ?? '').trim() || `refus de la garde ${v.garde}, sans raison donnée`,
  })))
  const contextes = contextesDe(verdicts)
  return { decision, contexte: contextes.length ? contextes.join('\n\n') : null, traces: verdicts.filter((v) => v.trace).map((v) => v.trace) }
}

/** La sortie JSON du hook pour `surface`, `null` s'il n'y a rien à dire. */
export function projeter({ decision, contexte }, evenement, surface) {
  if (!decision && !contexte) return null
  const specifique = { hookEventName: evenement }
  if (decision) Object.assign(specifique, { permissionDecision: decision.decision, permissionDecisionReason: decision.reason })
  if (contexte) specifique.additionalContext = contexte
  // Codex rejette `suppressOutput` en PreToolUse comme en PostToolUse.
  return surface === 'claude' ? { suppressOutput: true, hookSpecificOutput: specifique } : { hookSpecificOutput: specifique }
}

/**
 * Le rendu d'un appel pour le texte `brut` du stdin : la sortie projetée et les traces à écrire.
 * Stdin illisible, ou aucune garde pour l'événement et l'outil : rien.
 * @param {Record<string, Array<{ nom: string, outils: string[], evaluer: Function }>>} registre
 */
export async function repartir(registre, brut, { env = process.env, cwd = process.cwd() } = {}) {
  let entree
  try {
    entree = JSON.parse(brut)
  } catch {
    return { sortie: null, traces: [] }
  }
  const evenement = entree?.hook_event_name
  const gardes = (registre[evenement] ?? []).filter((g) => outilCouvert(g.outils, entree?.tool_name))
  if (gardes.length === 0) return { sortie: null, traces: [] }
  let cumul
  try {
    cumul = cumuler(await evaluerGardes(gardes, entree, construireContexte(entree, { env, cwd })))
  } catch (e) {
    cumul = { decision: null, contexte: `répartiteur en panne : ${e?.message ?? e}`, traces: [] }
  }
  return { sortie: projeter(cumul, evenement, surfaceDe(env)), traces: cumul.traces }
}

/** Le point d'entrée : lit, répartit, ajoute les traces, écrit la sortie, sort en 0. */
export async function executer(registre) {
  const rendu = await repartir(registre, await lireStdinBorne())
  for (const { fichier, ligne } of rendu.traces) {
    try {
      mkdirSync(dirname(fichier), { recursive: true })
      appendFileSync(fichier, ligne)
    } catch {
      /* journal indisponible : la trace stderr ci-dessous reste */
    }
    process.stderr.write(`[trace] ${fichier} : ${ligne}`)
  }
  if (rendu.sortie) process.stdout.write(`${JSON.stringify(rendu.sortie)}\n`, () => process.exit(0))
  else process.exit(0)
}

if (import.meta.main) {
  const { REGISTRE } = await import('./registre.mjs')
  await executer(REGISTRE)
}
