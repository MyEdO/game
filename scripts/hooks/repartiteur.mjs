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
import { affectationsDEnvironnement, cibleDeLaCommande, versCheminNatif } from './solde-ticket-guard.mjs'

/** Surface qui lance le hook : Claude Code pose `CLAUDE_PROJECT_DIR` dans l'environnement de ses hooks,
 *  Codex ne le pose jamais. */
export const surfaceDe = (env) => (env.CLAUDE_PROJECT_DIR ? 'claude' : 'codex')

/** Date LOCALE `AAAA-MM-JJ` (pas UTC) : un solde écrit après minuit heure locale porte la date locale. */
const dateLocale = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/**
 * Variables d'environnement qui changent le programme exécuté ou ce qu'il lit sans que le texte jugé le
 * dise : leur affectation par la commande (`affectationsDEnvironnement` : en tête, seule, exportée,
 * PowerShell `$env:`) est refusée sur tout canal shell (#2224). Toute autre affectation
 * (`WFRP_TEST_COEURS=4 npm test`) reste admise.
 */
export const AFFECTATIONS_NON_JUGEABLES = Object.freeze([
  { motif: /^GIT_INDEX_FILE$/i, effet: 'git lit et écrit cet index, pas celui que la porte de commit juge (`git help git`, GIT_INDEX_FILE)' },
  { motif: /^GIT_DIR$/i, effet: 'git opère sur ce dépôt, pas sur celui du répertoire jugé (`git help git`, GIT_DIR)' },
  { motif: /^GIT_WORK_TREE$/i, effet: 'git prend cet arbre de travail, pas celui du répertoire jugé (`git help git`, GIT_WORK_TREE)' },
  { motif: /^NODE_OPTIONS$/i, effet: 'node précharge des modules absents du texte jugé (nodejs.org/api/cli.html, NODE_OPTIONS)' },
  { motif: /^npm_config_/i, effet: 'npm lit sa configuration dans l’environnement (docs.npmjs.com, `config`, « Environment Variables ») : le script lancé n’est plus celui que les gardes lisent' },
])

/** Un lieu NON JUGEABLE : la `raison`, et le `canal` à prendre à la place. */
const nonJugeable = (raison, canal) => ({ nonJugeable: { raison, canal } })

const CANAL_CWD = 'passer `cwd` ABSOLU, dans l’arbre principal (ses `.wt-*` compris)'

/**
 * Le répertoire de BASE d'un appel, ou la raison pour laquelle il n'est pas jugeable. Hors lean-ctx :
 * le `cwd` de l'entrée de hook, sinon celui du processus. Shell lean-ctx sans `command` (`job_id`,
 * `background_action`) : rien ne s'exécute, sa base est celle du hook. Avec : son `cwd`, qui doit être
 * absolu (graphie MSYS rendue native, `versCheminNatif`), exister, et tenir dans l'arbre principal
 * (`arbrePrincipal`) — absent, il vaut le dernier `cwd` passé (lean-ctx 3.10.2 : « Working dir
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
  const natif = versCheminNatif(brut, platform)
  if (!isAbsolute(natif)) return nonJugeable(`\`cwd\` relatif (${brut}) : lean-ctx le résout contre SA racine`, CANAL_CWD)
  if (!estRepertoire(natif)) return nonJugeable(`\`cwd\` inexistant (${brut})`, CANAL_CWD)
  const principal = arbrePrincipal(depotDe(hook))
  if (!principal.disponible) return nonJugeable(`\`cwd\` invérifiable (${principal.raison})`, CANAL_CWD)
  if (relatifSousRacine(canoniser(principal.valeur), natif) === null) {
    return nonJugeable(`\`cwd\` hors de l’arbre principal ${principal.valeur} (${brut}) : lean-ctx l’exécute à sa racine`, CANAL_CWD)
  }
  return { base: resolve(natif) }
}

/** Les affectations de `command` que `AFFECTATIONS_NON_JUGEABLES` refuse, chacune avec son effet. */
const affectationsRefusees = (command) =>
  affectationsDEnvironnement(command).flatMap((nom) => AFFECTATIONS_NON_JUGEABLES.filter(({ motif }) => motif.test(nom)).map(({ effet }) => `${nom} : ${effet}`))

/**
 * Le contexte d'un appel, construit UNE fois : la SEULE résolution de « où ça s'exécute ». `dir` = la
 * cible PROUVÉE par la commande (`cibleDeLaCommande`, retenue seulement si elle existe), sinon la base
 * de l'appel (`baseDeLAppel`) ; `null` quand ce n'est pas jugeable, avec `nonJugeable` = `{ raison,
 * canal }` (refusé par `canal-outil-guard.mjs`) — lieu non jugeable, ou affectation d'une variable
 * de `AFFECTATIONS_NON_JUGEABLES`. `racineNpm` = la racine npm de `dir` (`racineNpmDe`), où `npm run <x>`
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
  const refusees = sousRacineNpm(racineNpm, () => affectationsRefusees(command))
  if (refusees.length) {
    const { nonJugeable: affectation } = nonJugeable(`affectation d’environnement dans la commande — ${refusees.join(' ; ')}`, 'la même commande sans cette affectation')
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
