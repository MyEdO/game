// Hook SessionStart : rendre un CONTENEUR DISTANT conforme au canon du dépôt avant le premier
// geste de la session. Un conteneur cloud part d'un clone superficiel sur lequel `npm install` n'a
// jamais tourné : l'histoire est tronquée (les gardes de `test:hooks` qui la LISENT refusent),
// `core.hooksPath` est vide (les hooks `pre-commit`/`commit-msg`/`pre-push` du dépôt ne jouent pas,
// cf. `docs/reprise-apres-pause.md` § 5) et `gh` est absent, alors que le train de publication
// (`scripts/ops/publier.mjs`) et la porte au push (`scripts/git-hooks/pre-push.mjs`) lisent le
// verdict CI par lui (#1803).
//
// PÉRIMÈTRE demandé le 2026-09-18 (« Oui, spécifique au cloud ») : rien ne se pose hors d'un
// conteneur distant, où la machine porte l'environnement de son propriétaire. `CLAUDE_CODE_REMOTE`
// est le seul marqueur documenté d'un tel conteneur ; sa valeur y est la chaîne `'true'`. Ce hook
// est donc PROPRE à la surface Claude (`scripts/agents/compat-core.mjs`, `HOOKS_DE_SESSION`).
//
// Chaque prérequis de la table PREREQUIS (`bootstrap-prerequis.mjs`) porte son propre CONSTAT
// (`manque`) et son BUDGET de temps : le hook est rejouable sans effet, un prérequis de plus s'ajoute en
// une entrée, et la table est la SOURCE UNIQUE du `timeout` déclaré aux surfaces. Le hook n'échoue JAMAIS la session : ce
// qu'il n'a pas pu poser, il le NOMME sur sa sortie, qui entre au contexte de la session. Sous un Node
// que refuse la porte (`scripts/node-requis.mjs`), il sort par elle avant tout constat : un
// `SessionStart` en sortie 2 ne montre son stderr qu'à l'utilisateur, et chaque hook `PreToolUse`
// rend ce refus à la session au premier outil qu'il garde (son `matcher`) ; un outil que nul hook ne
// garde ne le déclenche pas.
import '../node-requis.mjs'
import { spawn, spawnSync } from 'node:child_process'
import { closeSync, existsSync, mkdirSync, openSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { verrouOutillageDe } from './barriere-outil.mjs'
import { attendreLibre, prendreVerrou } from '../test/verrou.mjs'
import { SOURCES_LUES } from '../docs/build-all.mjs'
import { approfondir, depotDe, dossierDesHooks, estSuperficiel, reussi } from '../guards/lib/gitPorte.mjs'
import { BUDGET_CONSTAT, JOURNAL_DOCS, PREREQUIS } from './bootstrap-prerequis.mjs'
import { entreeHookNative, produireRecuSessionStart } from '../ops/session-start.mjs'

/** Marqueur d'un conteneur distant Claude Code (`CLAUDE_CODE_REMOTE=true`). */
export const estConteneurDistant = (env) => env.CLAUDE_CODE_REMOTE === 'true'

/** Plafond d'un rapport d'échec entrant au contexte de la session. */
const PLAFOND_RAPPORT = 400

const borner = (texte) =>
  texte.length <= PLAFOND_RAPPORT ? texte : `…${texte.slice(-PLAFOND_RAPPORT)}`

/**
 * Lance une commande et rend `{ ok, valeur, rapport }`.
 *
 * `valeur` ne lit que `stdout` : un `warning:`/`hint:` de git part sur `stderr` et ferait mentir un
 * constat comparé à l'octet près. `rapport` mêle les deux flux — il ne sert qu'à NOMMER un échec, et
 * porte la sortie partielle même quand `spawnSync` rend une `error` (exécutable absent, dépassement
 * de budget), où `status` vaut `null`.
 */
export function lancer(exe, args, { budget = BUDGET_CONSTAT, ...options } = {}) {
  const vu = spawnSync(exe, args, { encoding: 'utf8', timeout: budget * 1000, ...options })
  const flux = `${vu.stdout ?? ''}${vu.stderr ?? ''}`.trim()
  return {
    ok: !vu.error && vu.status === 0,
    valeur: (vu.stdout ?? '').trim(),
    rapport: borner(vu.error ? [vu.error.message, flux].filter(Boolean).join(' — ') : flux),
  }
}

/** VERROU du `docs:build` détaché, relatif à la racine (`scripts/test/verrou.mjs`) : tenu par le
 *  constructeur détaché lui-même (`construireDocs`), le temps du build. */
export const VERROU_DOCS = 'node_modules/.cache/bootstrap-docs-build.verrou'

/** Le module de CE hook, que le constructeur détaché relance en mode `--docs-build`. */
const MODULE = fileURLToPath(import.meta.url)

/**
 * Le CONSTRUCTEUR détaché : il PREND `VERROU_DOCS` à son propre PID, puis seulement ouvre `JOURNAL_DOCS`
 * et joue `docs:build` ; un constructeur qui perd la prise sort sans toucher au journal. REND le code du
 * build, `null` sans prise. `lancer` s'injecte (mesure).
 */
export function construireDocs(racine, { lancer = spawnSync } = {}) {
  const prise = prendreVerrou({ chemin: join(racine, VERROU_DOCS), libelle: 'docs:build détaché', commande: 'bootstrap-conteneur --docs-build', cwd: racine })
  if (prise.etat !== 'pris') return null
  try {
    const fd = openSync(join(racine, JOURNAL_DOCS), 'w')
    try {
      return lancer(process.execPath, [join(racine, 'scripts', 'docs', 'build-all.mjs'), '--quiet'], { cwd: racine, stdio: ['ignore', fd, fd], windowsHide: true }).status
    } finally {
      closeSync(fd)
    }
  } finally {
    prise.liberer()
  }
}

/**
 * Lance `docs:build` DÉTACHÉ (il dépasse le budget du hook) : le constructeur (`construireDocs`), si
 * `VERROU_DOCS` est libre au premier essai ; rend la forme de `lancer`, `valeur` = son pid. Verrou tenu
 * par un vivant : rien n'est lancé, `valeur` = le pid du constructeur en cours.
 */
export function docsBuildDetache(racine) {
  const verrou = join(racine, VERROU_DOCS)
  const vu = attendreLibre({ chemin: verrou })
  if (vu.etat !== 'libre') return { ok: true, valeur: String(vu.tenant.pid), rapport: '' }
  try {
    mkdirSync(dirname(verrou), { recursive: true })
    const enfant = spawn(process.execPath, [MODULE, '--docs-build', racine], { cwd: racine, detached: true, stdio: 'ignore', windowsHide: true })
    enfant.unref()
    return { ok: true, valeur: String(enfant.pid ?? ''), rapport: '' }
  } catch (e) {
    return { ok: false, valeur: '', rapport: borner(e.message) }
  }
}

/**
 * `geste()` joué sous le verrou d'outillage de `racine` (`verrouOutillageDe`, #2187), pris au premier essai ;
 * tenu par un vivant : rien n'est joué, le refus est rendu dans la forme de `lancer`.
 */
export function sousOutillage(racine, geste) {
  const chemin = verrouOutillageDe(racine)
  if (chemin === null) return geste()
  const prise = prendreVerrou({ chemin, libelle: 'outillage de l’arbre', commande: 'bootstrap-conteneur npm install', cwd: racine })
  if (prise.etat !== 'pris') return { ok: false, valeur: '', rapport: borner(prise.message) }
  try {
    return geste()
  } finally {
    prise.liberer()
  }
}

/** Les GESTES des prérequis — ceux de l'hôte au dépôt (`gitPorte.mjs`), la mesure des docs dérivés,
 *  leur `docs:build` détaché et le verrou d'outillage : injectables (mesure). Une pose rend la forme de `lancer`. */
export const GESTES_DU_CONTENEUR = Object.freeze({
  estSuperficiel, dossierDesHooks,
  approfondir: (depot, options) => renduDeGit(approfondir(depot, options)),
  docsMesures: (racine) => existsSync(join(racine, SOURCES_LUES)),
  docsBuildDetache,
  sousOutillage,
})

/** L'union d'un écrivain de l'hôte, rendue dans la forme de `lancer`. */
export function renduDeGit(vu) {
  if (!vu.disponible) return { ok: false, valeur: '', rapport: borner(vu.raison) }
  if (vu.absent) return { ok: false, valeur: '', rapport: 'objet absent' }
  const { stdout, stderr } = vu.valeur
  return { ok: reussi(vu), valeur: stdout.trim(), rapport: borner(`${stdout}${stderr}`.trim()) }
}

/**
 * Joue la table sur `contexte` et rend les lignes à écrire. Silence complet quand tout était déjà
 * en place : un conteneur conforme ne coûte pas de contexte à la session (#1728).
 */
export function mettreEnConformite(contexte, prerequis = PREREQUIS) {
  const lignes = []
  for (const p of prerequis) {
    const pannes = contexte.pannes?.length ?? 0
    const manque = p.manque(contexte)
    if (contexte.pannes?.length > pannes) {
      lignes.push(`[conteneur] ${p.nom} : NON MESURÉ, git indisponible — ${borner(contexte.pannes.at(-1))}`)
      continue
    }
    if (!manque) continue
    const vu = p.poser({ ...contexte, budget: p.budget })
    lignes.push(
      vu.ok
        ? `[conteneur] ${p.nom} : posé par \`${p.geste}\`.`
        : `[conteneur] ${p.nom} : MANQUANT, \`${p.geste}\` a échoué — ${vu.rapport}`,
    )
  }
  return lignes
}

/** Le hook n'échoue JAMAIS la session : une panne de git s'y NOMME (`pannes`), et le prérequis qu'elle
 *  empêche de mesurer n'est pas posé. */
export function bootstrap(env = process.env, racine = process.cwd(), run = lancer, gestes = GESTES_DU_CONTENEUR) {
  if (!estConteneurDistant(env)) return []
  const pannes = []
  return mettreEnConformite({ racine, run, gestes, pannes, depot: depotDe(racine, { enPanne: (raison) => pannes.push(raison) }) })
}

export function bootstrapSessionStart({ env = process.env, racine = process.cwd(), entree, run = lancer, gestes = GESTES_DU_CONTENEUR, output = process.stdout } = {}) {
  const lignes = bootstrap(env, racine, run, gestes)
  if (lignes.length) output.write(`${lignes.join('\n')}\n`)
  produireRecuSessionStart({ surface: 'claude', entree, env, worktree: racine })
  return lignes
}

if (import.meta.main && process.argv[2] === '--docs-build') process.exitCode = construireDocs(process.argv[3]) ?? 0
else if (import.meta.main) {
  try { bootstrapSessionStart({ racine: process.env.CLAUDE_PROJECT_DIR || process.cwd(), entree: await entreeHookNative() }) }
  catch (e) { process.stderr.write(`${e.message}\n`); process.exitCode = 1 }
}
