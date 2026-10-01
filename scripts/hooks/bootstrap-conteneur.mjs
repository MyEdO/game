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
import { closeSync, existsSync, linkSync, mkdirSync, openSync, readFileSync, renameSync, rmSync, statSync, writeSync } from 'node:fs'
import { uptime } from 'node:os'
import { dirname, join } from 'node:path'
import { SOURCES_LUES } from '../docs/build-all.mjs'
import { approfondir, depotDe, dossierDesHooks, estSuperficiel, reussi } from '../guards/lib/gitPorte.mjs'
import { BUDGET_CONSTAT, JOURNAL_DOCS, PREREQUIS } from './bootstrap-prerequis.mjs'

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

/** VERROU du `docs:build` détaché, relatif à la racine : créé exclusif (`wx`), il porte le pid du build. */
export const VERROU_DOCS = 'node_modules/.cache/bootstrap-docs-build.pid'

/** Délai au-delà duquel un verrou sans pid lisible est ABANDONNÉ (hook tué entre création et écriture). */
const ABANDON_VERROU_MS = 10_000

/** `pid` désigne-t-il un processus vivant ? Un refus de signal (`EPERM`) prouve qu'il existe. */
const pidVivant = (pid) => {
  try {
    process.kill(pid, 0)
    return true
  } catch (e) {
    return e.code === 'EPERM'
  }
}

/** Essais de prise du verrou : une prise perdue contre une autre session se rejoue, bornée. */
const ESSAIS_VERROU = 3

/**
 * Le pid du build qui TIENT le verrou, ou `null` s'il est périmé : absent, posé avant `demarrageMachine`
 * (epoch ms — son pid est celui d'une vie antérieure de la machine, qu'un autre processus a pu
 * reprendre), pid mort, ou illisible et abandonné.
 */
function tenantDuVerrou(verrou, demarrageMachine) {
  let mtimeMs
  let texte
  try {
    ;({ mtimeMs } = statSync(verrou))
    texte = readFileSync(verrou, 'utf8')
  } catch (e) {
    if (e.code === 'ENOENT') return null
    throw e
  }
  if (mtimeMs < demarrageMachine) return null
  const pid = Number(texte.trim())
  if (Number.isInteger(pid) && pid > 0) return pidVivant(pid) ? pid : null
  return Date.now() - mtimeMs < ABANDON_VERROU_MS ? 0 : null
}

/**
 * Écarte le verrou jugé périmé par un RENOMMAGE vers un nom propre à ce processus : de deux sessions
 * qui l'ont jugé périmé, une seule le renomme, l'autre reçoit `ENOENT`. Le fichier écarté se rejuge :
 * entre le constat et le renommage, une autre session a pu reprendre le verrou, et ce verrou VIVANT se
 * repose (`linkSync`, qui refuse d'écraser).
 */
function ecarterVerrouPerime(verrou, demarrageMachine) {
  const ecarte = `${verrou}.${process.pid}.${Date.now()}.perime`
  try {
    renameSync(verrou, ecarte)
  } catch (e) {
    if (e.code === 'ENOENT') return
    throw e
  }
  try {
    if (tenantDuVerrou(ecarte, demarrageMachine) !== null) linkSync(ecarte, verrou)
  } catch (e) {
    if (e.code !== 'EEXIST') throw e
  } finally {
    rmSync(ecarte, { force: true })
  }
}

/**
 * Lance `docs:build` DÉTACHÉ (il dépasse le budget du hook), sortie dans `JOURNAL_DOCS` ; rend la
 * forme de `lancer`, `valeur` = le pid. Deux sessions ouvertes avant la fin du build : le verrou
 * `VERROU_DOCS` tenu par un build VIVANT, il n'est ni relancé ni son journal tronqué — `valeur` est le
 * pid du build en cours. Un verrou périmé s'écarte (`ecarterVerrouPerime`), puis se reprend.
 * `demarrageMachine` (epoch ms) et `entreConstatEtEcart` (appelé entre le constat d'un verrou périmé et
 * son écart) s'injectent (mesure).
 */
export function docsBuildDetache(racine, { demarrageMachine = Date.now() - uptime() * 1000, entreConstatEtEcart = () => {} } = {}) {
  const journal = join(racine, JOURNAL_DOCS)
  const verrou = join(racine, VERROU_DOCS)
  mkdirSync(dirname(journal), { recursive: true })
  let tenu
  for (let essai = 0; tenu === undefined; essai++) {
    try {
      tenu = openSync(verrou, 'wx')
    } catch (e) {
      if (e.code !== 'EEXIST' || essai >= ESSAIS_VERROU) return { ok: false, valeur: '', rapport: borner(e.message) }
      const tenant = tenantDuVerrou(verrou, demarrageMachine)
      if (tenant !== null) return { ok: true, valeur: tenant ? String(tenant) : '', rapport: '' }
      entreConstatEtEcart()
      try {
        ecarterVerrouPerime(verrou, demarrageMachine)
      } catch (ecart) {
        return { ok: false, valeur: '', rapport: borner(ecart.message) }
      }
    }
  }
  let pid
  try {
    const fd = openSync(journal, 'w')
    try {
      const enfant = spawn(process.execPath, [join(racine, 'scripts', 'docs', 'build-all.mjs'), '--quiet'], {
        cwd: racine, detached: true, stdio: ['ignore', fd, fd], windowsHide: true,
      })
      enfant.unref()
      pid = String(enfant.pid ?? '')
      writeSync(tenu, pid)
    } finally {
      closeSync(fd)
    }
  } catch (e) {
    closeSync(tenu)
    rmSync(verrou, { force: true })
    return { ok: false, valeur: '', rapport: borner(e.message) }
  }
  closeSync(tenu)
  return { ok: true, valeur: pid, rapport: '' }
}

/** Les GESTES des prérequis — ceux de l'hôte au dépôt (`gitPorte.mjs`), la mesure des docs dérivés et
 *  leur `docs:build` détaché : injectables (mesure). Une pose rend la forme de `lancer`. */
export const GESTES_DU_CONTENEUR = Object.freeze({
  estSuperficiel, dossierDesHooks,
  approfondir: (depot, options) => renduDeGit(approfondir(depot, options)),
  docsMesures: (racine) => existsSync(join(racine, SOURCES_LUES)),
  docsBuildDetache,
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

if (import.meta.main) {
  const lignes = bootstrap(process.env, process.env.CLAUDE_PROJECT_DIR || process.cwd())
  if (lignes.length) process.stdout.write(`${lignes.join('\n')}\n`)
}
