// RÉPARTITEUR des hooks d'appel d'outil (#2125) : UNE lecture du stdin (`lireStdinBorne`), UN contexte,
// les gardes du registre (`registre.mjs`) retenues par `hook_event_name` et `tool_name`, UN cumul, UNE
// sortie projetée sur la surface. Le point d'entrée de la porte de fermeture
// (`solde-ticket-hook.mjs`) passe par le même `executer`. Contrat d'une garde :
// `scripts/guards/lib/contratGarde.mjs`. Déclarations : `scripts/agents/compat-core.mjs`.
import '../node-requis.mjs'
import { appendFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { lireStdinBorne } from '../guards/lib/stdinBorne.mjs'
import { decisionCumulee } from '../guards/lib/contratGarde.mjs'
import { sousRacineNpm } from '../guards/lib/racineNpm.mjs'
import { cibleDeLaCommande } from './solde-ticket-guard.mjs'

/** Surface qui lance le hook : Claude Code pose `CLAUDE_PROJECT_DIR` dans l'environnement de ses hooks,
 *  Codex ne le pose jamais. */
export const surfaceDe = (env) => (env.CLAUDE_PROJECT_DIR ? 'claude' : 'codex')

/** Date LOCALE `AAAA-MM-JJ` (pas UTC) : un solde écrit après minuit heure locale porte la date locale. */
const dateLocale = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/**
 * Le contexte d'un appel, construit UNE fois. `dir` = le répertoire où la commande s'exécute : la
 * cible PROUVÉE par la commande (`cibleDeLaCommande`, retenue seulement si elle existe), sinon le
 * `cwd` du canal `ctx_shell`, sinon le répertoire du processus. `cibleIgnoree` = ce que la commande
 * nommait sans que ce soit un répertoire réel ; `pannes` = pannes de lecture git de l'appel.
 */
export function construireContexte(entree, { env = process.env, cwd = process.cwd(), maintenant = new Date() } = {}) {
  const outil = entree?.tool_input
  const base = typeof outil?.cwd === 'string' && outil.cwd ? resolve(cwd, outil.cwd) : cwd
  const cible = cibleDeLaCommande(String(outil?.command ?? ''), base)
  return { dir: cible.dir ?? base, cibleIgnoree: cible.ignore, today: dateLocale(maintenant), pannes: [], env }
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
      rendus = [await sousRacineNpm(contexte.dir, () => garde.evaluer(entree, contexte))].flat().filter(Boolean)
    } catch (e) {
      rendus = [{ contexte: `garde ${garde.nom} en panne : ${e?.message ?? e}` }]
    }
    verdicts.push(...rendus.map((v) => ({ ...v, garde: garde.nom })))
    if (rendus.some((v) => v.decision === 'deny')) break
  }
  return verdicts
}

/** Le cumul des verdicts : la décision (`decisionCumulee`), les contextes concaténés, les traces
 *  demandées. Un refus porte toujours une raison. */
export function cumuler(verdicts) {
  const decision = decisionCumulee(verdicts.filter((v) => v.decision).map((v) => ({
    reason: String(v.raison ?? '').trim() || `refus de la garde ${v.garde}, sans raison donnée`,
  })))
  const contextes = verdicts.filter((v) => v.contexte).map((v) => v.contexte)
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
  const gardes = (registre[evenement] ?? []).filter((g) => g.outils.includes(entree?.tool_name))
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
