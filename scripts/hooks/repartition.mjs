// RÉPARTITION des hooks d'appel d'outil (#2125) : UNE lecture du stdin (`lireStdinBorne`), UN contexte,
// les gardes du registre (`registre.mjs`) retenues par `hook_event_name` et `tool_name`, UN cumul, UNE
// sortie projetée sur la surface. Le point d'entrée, `repartiteur.mjs`, la charge après la barrière
// (`barriere-outil.mjs`, #2187) et passe par `executer`. Contrat
// d'une garde : `scripts/guards/lib/contratGarde.mjs`. Déclarations : `scripts/agents/compat-core.mjs`.
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
  NOM_NON_LITTERAL, affectationsDEnvironnement, canauxDesMessages, cibleDeLaCommande, commandeDeLecture, configsGitDeLaCommande, gitSubcommand,
  nomsDeLaCommande, optionsGitGlobales, segmentsProfonds, versCheminNatif,
} from '../guards/lib/commandeShell.mjs'

/** Surface qui lance le hook : Claude Code pose `CLAUDE_PROJECT_DIR` dans l'environnement de ses hooks,
 *  Codex ne le pose jamais. */
export const surfaceDe = (env) => (env.CLAUDE_PROJECT_DIR ? 'claude' : 'codex')

/**
 * Variables d'environnement qui changent le programme lancé, le dépôt ou la configuration sans que le
 * texte jugé le dise (#2224). Une variable qui nomme un programme auxiliaire dont la valeur est dans
 * le texte jugé reste admise (`GIT_EDITOR`, `GIT_SEQUENCE_EDITOR`, `GIT_SSH_COMMAND`, `GIT_PAGER`,
 * `GIT_EXTERNAL_DIFF`, `WFRP_TEST_COEURS=4 npm test`) : #2071. `parNom` : nom distinctif, et TOUT jeton
 * de la commande qui le nomme rend l'appel non jugeable, quelle que soit la syntaxe qui l'écrit
 * (`nomsDeLaCommande`). Sinon (`PATH`, `ENV`, `HOME`, `XDG_CONFIG_HOME`, mots de prose), seule son
 * affectation est refusée (`affectationsDEnvironnement`). `lieu` : elle désigne le dépôt opéré.
 * `canal` : celui du refus, quand ce n'est pas la même commande sans elle.
 */
export const AFFECTATIONS_NON_JUGEABLES = Object.freeze([
  {
    motif: /^(?:GIT_INDEX_FILE|GIT_INDEX_VERSION|GIT_OBJECT_DIRECTORY|GIT_ALTERNATE_OBJECT_DIRECTORIES|GIT_DIR|GIT_WORK_TREE|GIT_NAMESPACE|GIT_CEILING_DIRECTORIES|GIT_DISCOVERY_ACROSS_FILESYSTEM|GIT_COMMON_DIR|GIT_DEFAULT_HASH|GIT_DEFAULT_REF_FORMAT)$/i,
    parNom: true,
    lieu: true,
    effet: 'git prend dans l’environnement le dépôt, l’index ou l’arbre qu’il opère (`git help git`, « ENVIRONMENT VARIABLES », « The Git Repository ») : il n’opère plus le dépôt jugé',
  },
  {
    // `GIT_CONFIG_PARAMETERS` : celle que `git -c` pose pour ses sous-processus (git, `config.c`,
    // `environment.h` ; RelNotes 2.31.0).
    motif: /^GIT_CONFIG(?:_GLOBAL|_SYSTEM|_NOSYSTEM|_COUNT|_KEY_[0-9]+|_VALUE_[0-9]+|_PARAMETERS)?$/i,
    parNom: true,
    effet: 'git lit dans l’environnement une configuration absente du texte jugé, `core.hooksPath` compris (`git help config`, « ENVIRONMENT »)',
  },
  { motif: /^GIT_EXEC_PATH$/i, parNom: true, effet: 'git lance ses programmes depuis ce répertoire (`git help git`, `--exec-path`, GIT_EXEC_PATH) : le programme lancé n’est plus celui que le texte nomme' },
  { motif: /^GIT_TEMPLATE_DIR$/i, parNom: true, effet: 'git copie ce répertoire dans le `$GIT_DIR` qu’il crée ou réinitialise, crochets et `config` compris (`git help init`, TEMPLATE DIRECTORY) : les programmes lancés et la configuration lue ne sont plus ceux du texte jugé' },
  { motif: /^GIT_ATTR_SOURCE$/i, parNom: true, effet: 'git lit les gitattributes dans ce tree-ish (`git help git`, GIT_ATTR_SOURCE, --attr-source) ; ils règlent ce que `git add`/`git commit` stockent et les pilotes lancés (`gitattributes`, « Checking-out and checking-in »)' },
  { motif: /^NODE_OPTIONS$/i, parNom: true, effet: 'node précharge des modules absents du texte jugé (nodejs.org/api/cli.html, NODE_OPTIONS)' },
  { motif: /^npm_config_/i, parNom: true, effet: 'npm lit sa configuration dans l’environnement (docs.npmjs.com, `config`, « Environment Variables ») : le script lancé n’est plus celui que les gardes lisent' },
  { motif: /^BASH_ENV$/i, parNom: true, effet: 'bash exécute ce fichier avant sa commande (`man bash`, INVOCATION) : un texte absent de la commande jugée' },
  { motif: /^PATH$/i, parNom: false, effet: 'le shell cherche le programme lancé dans ces répertoires (POSIX `sh`, « Command Search and Execution ») : le programme lancé n’est plus celui que le texte nomme' },
  { motif: /^ENV$/i, parNom: false, effet: 'un shell POSIX exécute ce fichier avant sa commande (POSIX `sh`, ENV) : un texte absent de la commande jugée' },
  {
    motif: /^(?:HOME|XDG_CONFIG_HOME)$/i,
    parNom: false,
    effet: 'git lit sa configuration globale sous ce répertoire (`git help config`, FILES, `$XDG_CONFIG_HOME/git/config`, `~/.gitconfig`)',
    canal: 'la variable posée DANS le programme lancé (option `env` de `spawn`/`execFile`), jamais dans la commande',
  },
])

/**
 * Options globales de git qui changent le dépôt, l'arbre ou le programme lancé (`git help git`), jumelles
 * de variables de `AFFECTATIONS_NON_JUGEABLES`. `valeurAccolee` : seule la forme `--x=<v>` est un
 * réglage (`--exec-path` seul imprime et sort). `lieu` : elle désigne le dépôt opéré.
 */
export const OPTIONS_GIT_NON_JUGEABLES = Object.freeze([
  { option: '--git-dir', lieu: true, effet: 'git opère ce dépôt, pas celui du répertoire jugé (`git help git`, --git-dir, GIT_DIR)' },
  { option: '--work-tree', lieu: true, effet: 'git prend cet arbre, pas celui du répertoire jugé (`git help git`, --work-tree, GIT_WORK_TREE)' },
  { option: '--namespace', lieu: true, effet: 'git opère cet espace de références (`git help git`, --namespace, GIT_NAMESPACE)' },
  { option: '--bare', lieu: true, effet: 'git opère le répertoire courant comme dépôt nu (`git help git`, --bare : « If GIT_DIR environment is not set, it is set to the current working directory »)' },
  { option: '--attr-source', effet: 'git lit les gitattributes dans ce tree-ish (`git help git`, --attr-source, GIT_ATTR_SOURCE)' },
  { option: '--exec-path', valeurAccolee: true, effet: 'git lance ses programmes depuis ce répertoire (`git help git`, --exec-path, GIT_EXEC_PATH)' },
])

/** Un lieu NON JUGEABLE : la `raison`, et le `canal` à prendre à la place. */
const nonJugeable = (raison, canal) => ({ nonJugeable: { raison, canal } })

const CANAL_CWD = 'passer `cwd` ABSOLU, dans l’arbre principal (ses `.wt-*` compris)'

/**
 * Le répertoire de BASE d'un appel, ou la raison pour laquelle il n'est pas jugeable. Hors lean-ctx :
 * le `cwd` de l'entrée de hook, sinon celui du processus. Shell lean-ctx sans `command` (`job_id`,
 * `background_action`) : rien ne s'exécute, sa base est celle du hook. Avec : son `cwd`, qui doit être
 * absolu, exister tel que lean-ctx le lit (sans conversion MSYS : `/c/x` y est le `c/x` du disque courant, #2224), et
 * tenir dans l'arbre principal (`arbrePrincipal`) — absent, il vaut le dernier `cwd` passé (lean-ctx `LEAN_CTX_VERSION` : « Working dir
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

/** L'option de `OPTIONS_GIT_NON_JUGEABLES` que le jeton `t` règle, ou `undefined`. */
const optionDe = (t) => OPTIONS_GIT_NON_JUGEABLES.find(({ option, valeurAccolee }) => t.startsWith(`${option}=`) || (!valeurAccolee && t === option))

const CANAL_LIEU = 'la même commande sans elle (`cd` ou `git -C` vers le dépôt visé)'
const CANAL_SANS = 'la même commande sans elle'
const CANAL_NON_LITTERAL = 'un nom de variable littéral'
const CANAL_CONFIG = 'la même commande sans `-c` ; une configuration durable passe par `git config`'
/** Variable jumelle de chaque clé de `git -c` qui règle l'éditeur (`git help var`, GIT_EDITOR,
 *  GIT_SEQUENCE_EDITOR). */
const VARIABLES_D_EDITEUR = new Map([['core.editor', 'GIT_EDITOR'], ['sequence.editor', 'GIT_SEQUENCE_EDITOR']])

const citeBash = (v) => (/^[\w./:@%+=,-]+$/.test(v) ? v : `'${v.replace(/'/g, `'\\''`)}'`)
const citePowerShell = (v) => `'${v.replace(/'/g, "''")}'`

// `git help var`, GIT_EDITOR, GIT_SEQUENCE_EDITOR ; `git help git`, --config-env.
function canalDeLEditeur(command, config, editeurs, outil) {
  const propres = editeurs.filter((e) => e.appel === config.appel)
  const valeurs = new Map(propres.map((e) => [VARIABLES_D_EDITEUR.get(e.cle), e]))
  const git = gitSubcommand(config.appel.segment)
  const amende = git?.sub === 'commit' && git.args.includes('--amend')
  const appelUnique = segmentsProfonds(command).filter((s) => gitSubcommand(s) !== null).length === 1
  const brut = config.appel.jetons.map((j) => j.raw ?? citeBash(j.text)).join(' ')
  const prefixe = appelUnique && (command.trim() === brut || amende) ? '' : `pour l’appel \`${brut}\` : `
  if (amende && [...valeurs.values()].every((e) => e.cle === 'core.editor' && !e.variable && e.valeur === 'true')) return `${prefixe}\`--no-edit\` à la place de \`-c\``
  const affectations = (cite, reference, forme) => [...valeurs].map(([nom, e]) => forme(nom, e.variable ? reference(e.valeur) : cite(e.valeur)))
  const sansC = config.appel.jetons.filter((_, k) => !propres.some((e) => k >= e.debut && k < e.fin)).map((j) => j.raw ?? citeBash(j.text)).join(' ')
  const bash = `\`${affectations(citeBash, (v) => `"\${${v}}"`, (n, v) => `${n}=${v}`).join(' ')} ${sansC}\``
  const noms = [...valeurs.keys()]
  const sauvegarde = `$avant = @(${noms.map((n) => `$env:${n}`).join(', ')})`
  const restaure = noms.map((n, k) => `$env:${n}=$avant[${k}]`).join('; ')
  const powerShell = `\`& { ${sauvegarde}; try { ${affectations(citePowerShell, (v) => `\${env:${v}}`, (n, v) => `$env:${n}=${v}`).join('; ')}; ${sansC} } finally { ${restaure} } }\``
  const famille = familleLeanCtx(nomLeanCtx(outil))
  if (famille === SHELL) return `${prefixe}l’outil Bash : ${bash}, ou PowerShell : ${powerShell}`
  return prefixe + (outil === 'PowerShell' ? powerShell : bash)
}

/** `true` si le jeton règle `--template` de `git init`/`git clone`, sous tout préfixe que git accepte
 *  (mesuré git 2.51 : `--t=` pour `init`, `--te=` pour `clone`). */
const estOptionTemplate = (t) => {
  const nom = t.split('=')[0]
  return nom.length >= 3 && '--template'.startsWith(nom)
}

/** Les sous-commandes `init`/`clone` de la commande qui portent `--template` (`estOptionTemplate`),
 *  jumelle de `GIT_TEMPLATE_DIR` (`git help init`, TEMPLATE DIRECTORY). */
const templatesDeLaCommande = (command) => segmentsProfonds(command).map(gitSubcommand)
  .filter((git) => (git?.sub === 'init' || git?.sub === 'clone') && git.args.some(estOptionTemplate)).map((git) => git.sub)

/**
 * Ce que `command` nomme ou pose et qu'aucune garde ne lit, en `{ raison, canal }` : les noms `parNom`
 * qu'un jeton porte (`nomsDeLaCommande` ; ceux qui ne vivent QUE dans un texte, le canal de son
 * porteur, `canauxDesMessages`), les affectations des autres et les noms non littéraux
 * (`affectationsDEnvironnement`), les clés de `git -c`/`--config-env` (`configsGitDeLaCommande`), les
 * options de `OPTIONS_GIT_NON_JUGEABLES` et `--template` (`templatesDeLaCommande`).
 */
function lieuxPosesParLaCommande(command, outil) {
  const horsMessages = new Set(nomsDeLaCommande(command, { horsMessages: true }))
  const messages = canauxDesMessages(command)
  const affectations = affectationsDEnvironnement(command)
  const configs = configsGitDeLaCommande(command)
  const editeurs = configs.filter(({ cle }) => VARIABLES_D_EDITEUR.has(cle))
  const canalDuNom = (nom, lieu) => (horsMessages.has(nom) || !messages.has(nom)
    ? (lieu ? CANAL_LIEU : CANAL_SANS)
    : [...messages.get(nom)].join(' ; '))
  return [
    ...configs.map((config) => ({
      raison: `git -c ${config.cle} : git lit une configuration absente du texte jugé, jumelle de GIT_CONFIG_PARAMETERS (\`git help git\`, -c, --config-env)`,
      canal: VARIABLES_D_EDITEUR.has(config.cle) ? canalDeLEditeur(command, config, editeurs, outil) : CANAL_CONFIG,
    })),
    ...nomsDeLaCommande(command).flatMap((nom) => entreesDe(nom, true).map(({ effet, lieu }) => ({
      raison: `${nom} nommé : ${effet}`, canal: canalDuNom(nom, lieu),
    }))),
    ...affectations.filter((nom) => nom === NOM_NON_LITTERAL).map(() => ({
      raison: 'écriture d’une variable d’environnement au nom calculé : la garde ne sait pas laquelle', canal: CANAL_NON_LITTERAL,
    })),
    ...affectations.flatMap((nom) => entreesDe(nom, false).map(({ effet, canal }) => ({ raison: `${nom} : ${effet}`, canal: canal ?? CANAL_SANS }))),
    ...optionsGitGlobales(command).map(optionDe).filter(Boolean).map(({ option, effet, lieu }) => ({
      raison: `git ${option} : ${effet}`, canal: lieu ? CANAL_LIEU : CANAL_SANS,
    })),
    ...templatesDeLaCommande(command).map((sub) => ({
      raison: `git ${sub} --template : ${AFFECTATIONS_NON_JUGEABLES.find((e) => e.motif.test('GIT_TEMPLATE_DIR')).effet}`, canal: CANAL_SANS,
    })),
  ]
}

/** Le refus d'une commande dont `lieuxPosesParLaCommande` rend des `poses` : raisons et canaux sans
 *  doublon ; `ctx_search` seul quand la commande ne fait que LIRE (`commandeDeLecture`). */
function refusDesLieuxPoses(command, poses) {
  const raison = `environnement ou dépôt posé par la commande — ${[...new Set(poses.map((p) => p.raison))].join(' ; ')}`
  const canal = commandeDeLecture(command)
    ? '`ctx_search` pour chercher ce nom (une recherche qui le nomme n’est pas jugeable en shell)'
    : [...new Set(poses.map((p) => p.canal))].join(' ; ')
  return nonJugeable(raison, canal).nonJugeable
}

/**
 * Le contexte d'un appel, construit UNE fois : la SEULE résolution de « où ça s'exécute ». `dir` = la
 * cible PROUVÉE par la commande (`cibleDeLaCommande`, retenue seulement si elle existe), sinon la base
 * de l'appel. Le champ `baseDeLAppel` porte le cwd initial calculé par la fonction homonyme, avant
 * les changements de répertoire des segments ; `null` si cette base est non jugeable. `dir` vaut
 * `null` quand ce n'est pas jugeable, avec `nonJugeable` = `{ raison,
 * canal }` (refusé par `canal-outil-guard.mjs`) — lieu non jugeable, ou ce que la commande pose
 * (`lieuxPosesParLaCommande`). `racineNpm` = la racine npm de `dir` (`racineNpmDe`), où `npm run <x>`
 * se résout. `cibleIgnoree` = ce que la commande nommait sans que ce soit un répertoire réel.
 */
export function construireContexte(entree, { env = process.env, cwd = process.cwd(), platform = process.platform } = {}) {
  const commun = { env }
  const lieu = baseDeLAppel(entree, cwd, platform)
  if (lieu.nonJugeable) return { ...commun, baseDeLAppel: null, dir: null, racineNpm: null, cibleIgnoree: null, nonJugeable: lieu.nonJugeable }
  const command = commandeDe(entree)
  const cible = cibleDeLaCommande(command, lieu.base, platform)
  const dir = cible.dir ?? lieu.base
  const racineNpm = racineNpmDe(dir)
  const poses = sousRacineNpm(racineNpm, () => lieuxPosesParLaCommande(command, entree?.tool_name))
  if (poses.length) return { ...commun, baseDeLAppel: lieu.base, dir: null, racineNpm: null, cibleIgnoree: cible.ignore, nonJugeable: refusDesLieuxPoses(command, poses) }
  return { ...commun, baseDeLAppel: lieu.base, dir, racineNpm, cibleIgnoree: cible.ignore, nonJugeable: null }
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
