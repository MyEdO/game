// CLASSEMENT D'UN PUSH — documentaire ou produit (#1738).
//
// La CI l'exécute AVANT `npm ci` : la fermeture de ses imports n'atteint que `node:*` et des fichiers
// du dépôt, jamais un paquet (garde : `classerPush.test.mjs`). Elle compte la constante du pathspec
// des catalogues (`scripts/raw/gate-catalogues.mjs`, le seul site qui l'écrit) et l'hôte git
// (`gitPorte.mjs`, `TRONC`) ; `gatesSautables` reçoit `ECRIT_LU`/`gatesDeCi()` en PARAMÈTRE au lieu
// de les importer.
//
// Ce qu'un push déclenche se décide par ce que les gates LISENT (`ECRIT_LU[gate].lit`,
// `scripts/gates/toutes.mjs`, mesuré), jamais par un dossier deviné. La décision est FAIL-CLOSED
// des deux côtés : un fichier hors `DOCUMENTAIRE` rend le push PRODUIT, une gate dont `lit` est
// vide n'est jamais sautée, un diff vide est PRODUIT.
import { argv, env, exit, stderr, stdout } from 'node:process'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { COMMANDE_GATE_CATALOGUES } from '../raw/gate-catalogues.mjs'
import { TRONC, cheminsDe, lireGit, sortieOuNull } from '../guards/lib/gitPorte.mjs'

/**
 * Chemins NON EXÉCUTABLES, chacun avec sa raison. Un push dont TOUS les fichiers changés tombent
 * sous l'un de ces préfixes est documentaire. La liste est fail-closed : `docs/`, `.github/`,
 * `package*.json`, `scripts/`, `src/`, `Source/` n'y sont pas et rendent le push produit.
 * Un chemin qui finit par `/` désigne le dossier et tout ce qu'il contient.
 */
export const DOCUMENTAIRE = {
  '.claude/':
    'instructions, mémoire, soldes et workflows d’agent — côté SOURCE de la compat d’agents que ' +
    '`agents:check` compare (scripts/agents/compat-cli.mjs) ; aucun module de src/ ni server/src/ ' +
    'ne lit ce dossier hors test (sonde 2026-09-16 : 3 mentions, toutes en commentaire)',
  '.agents/':
    'miroir de la compat d’agents, écrit par `agents:sync` et comparé par `agents:check` — aucune ' +
    'lecture depuis src/ ni server/src/ (sonde 2026-09-16 : 0 mention)',
  '.codex/':
    'miroir Codex de la compat d’agents, même couture que `.agents/` — les 21 mentions de « .codex » ' +
    'sous src/ sont la classe CSS `.codex-…` et le champ `codexCategory`, aucune lecture de fichier',
  'AGENTS.md':
    'miroir racine de la compat d’agents — aucune lecture depuis src/ ni server/src/ (sonde : 0 mention)',
  'CLAUDE.md':
    'instructions du dépôt, miroir comparé par `agents:check` — les 40 mentions sous src/ sont des ' +
    'références de commentaire (règle citée), aucune lecture de fichier',
}

/**
 * Steps `CI_SEULEMENT` de `ci.yml` (scripts/gates/gatesDeCi.mjs) qui ne jouent QUE sur un push
 * produit, chacun avec sa raison. `npm ci` et le classement lui-même n'y sont pas : ils jouent
 * toujours, puisque tout ce qui suit en dépend.
 */
export const CI_SEULEMENT_PRODUIT = {
  "npm run gen && git diff --exit-code -- '*.generated.ts'":
    'confronte les registres générés à src/ et src/data/ — aucun chemin documentaire n’y entre',
  [COMMANDE_GATE_CATALOGUES]:
    'confronte les catalogues Atlas à Source/ et docs/raw/ — aucun chemin documentaire n’y entre',
  'npm --prefix server ci':
    'install du worker, prérequis du seul `server:typecheck` — inutile quand rien de server/ ne bouge',
}

/** Commande EXACTE du step de classement dans `ci.yml` — une seule écriture, lue par la garde. */
export const COMMANDE_CLASSER = 'node scripts/gates/classerPush.mjs >> "$GITHUB_OUTPUT"'

/** Fragment de la condition `if` que porte tout step conditionné par le classement. */
export const CONDITION_PRODUIT = "steps.classer.outputs.produit != 'false'"

/** Deux chemins CHEVAUCHENT quand l'un est préfixe de l'autre : `.claude/` et `.claude/memory/`. */
const chevauche = (a, b) => a.startsWith(b) || b.startsWith(a)

/** `true` si `fichier` tombe sous une entrée de `DOCUMENTAIRE`. */
const estDocumentaire = (fichier) =>
  Object.keys(DOCUMENTAIRE).some((p) => (p.endsWith('/') ? fichier.startsWith(p) : fichier === p))

/**
 * Classe une liste de fichiers changés. Une liste VIDE est PRODUIT : un diff qu'on n'a pas su lire
 * ne prouve rien, et le conservateur est de tout jouer.
 * @param {readonly string[]} fichiers chemins relatifs POSIX
 * @returns {{ produit: boolean, motifs: string[] }}
 */
export function classer(fichiers) {
  if (!fichiers || fichiers.length === 0)
    return { produit: true, motifs: ['diff vide : conservateur — rien de mesuré, tout se joue'] }
  const fautif = fichiers.find((f) => !estDocumentaire(f))
  if (fautif)
    return {
      produit: true,
      motifs: [`${fautif} : hors DOCUMENTAIRE (${fichiers.length} fichier(s) changé(s))`],
    }
  return { produit: false, motifs: [`${fichiers.length} fichier(s), tous sous DOCUMENTAIRE`] }
}

/**
 * Les gates SAUTABLES sur un push documentaire : `lit` NON VIDE et sans chevauchement avec une
 * entrée de `DOCUMENTAIRE`. Une gate sans `lit` mesuré joue toujours — la borne est fail-closed.
 * @param {{ gates: readonly {nom: string}[], ecritLu: Record<string, {lit?: readonly string[]}> }} args
 * @returns {Set<string>}
 */
export function gatesSautables({ gates, ecritLu }) {
  const sautables = new Set()
  for (const { nom } of gates) {
    const lit = ecritLu[nom]?.lit
    if (!lit || lit.length === 0) continue
    if (lit.some((chemin) => Object.keys(DOCUMENTAIRE).some((p) => chevauche(chemin, p)))) continue
    sautables.add(nom)
  }
  return sautables
}

/** `git <args>` par l'hôte : la sortie, ou une LEVÉE nommée (objet absent, code non nul, git
 *  indisponible) que chaque appelant ci-dessous replie en classement conservateur. */
const sortieDe = (args, cwd) => {
  const vu = lireGit(args, { cwd })
  const sortie = sortieOuNull(vu)
  if (sortie === null) throw new Error(`git ${args.join(' ')} : ${vu.disponible ? 'en échec' : vu.raison}`)
  return sortie
}
const git = (args, cwd) => sortieDe(args, cwd).trim()

/** Un sha nul ou fait de zéros : `github.event.before` d'un premier push (même lecture que ci.yml). */
const shaNul = (sha) => !sha || !/[^0]/.test(sha)

/** `refs/remotes/origin/main` est-il présent localement ? Un clone `--single-branch` d'une branche
 *  de travail ne l'a pas : le merge-base n'aurait alors aucune base. */
const troncConnu = (cwd) => {
  try {
    git(['rev-parse', '--verify', '--quiet', `refs/remotes/${TRONC.suivi}`], cwd)
    return true
  } catch {
    return false
  }
}

/**
 * La BASE du diff : ce contre quoi on classe. Sur `main`, l'incrément poussé (`BEFORE`, replié sur
 * `SHA^`). Ailleurs, ce qui ENTRERA dans `main` (`merge-base origin/main SHA`) — jamais l'incrément
 * du push, qu'un run annulé puis un push documentaire rendraient faux. `ref` est `github.ref` : une
 * REF git (`refs/pull/N/merge` compris), jamais un nom de branche.
 * @returns {{ base: string } | { base: null, motif: string }}
 */
export function baseDuDiff({ ref, before, sha, cwd = process.cwd() } = {}) {
  if (ref === TRONC.branche) {
    if (!shaNul(before)) return { base: before }
    try {
      return { base: git(['rev-parse', `${sha}^`], cwd) }
    } catch {
      return { base: null, motif: `main sans parent lisible pour ${sha} : conservateur` }
    }
  }
  if (!troncConnu(cwd)) {
    try {
      git(['fetch', '--no-tags', 'origin', `${TRONC.nom}:refs/remotes/${TRONC.suivi}`], cwd)
    } catch {
      return { base: null, motif: 'origin/main absent après fetch : conservateur' }
    }
  }
  try {
    return { base: git(['merge-base', TRONC.suivi, sha], cwd) }
  } catch {
    return { base: null, motif: 'merge-base origin/main en échec : conservateur' }
  }
}

/** Le classement complet, du contexte de push aux motifs. */
export function classerPush({ ref, before, sha, cwd = process.cwd() } = {}) {
  const socle = baseDuDiff({ ref, before, sha, cwd })
  if (socle.base === null) return { produit: true, base: null, fichiers: [], motifs: [socle.motif] }
  const fichiers = cheminsDe((args) => sortieDe(args, cwd), ['diff', '--name-only', '--no-renames', socle.base, sha])
  return { ...classer(fichiers), base: socle.base, fichiers }
}

if (argv[1] && resolve(argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  try {
    const sha = env.SHA || 'HEAD'
    const verdict = classerPush({ ref: env.REF, before: env.BEFORE, sha })
    stdout.write(`produit=${verdict.produit}\n`)
    stderr.write(
      `[classerPush] ref=${env.REF ?? '(absent)'} base=${verdict.base ?? '(aucune)'} ` +
        `fichiers=${verdict.fichiers.length} produit=${verdict.produit}\n` +
        verdict.motifs.map((m) => `  - ${m}\n`).join(''),
    )
  } catch (erreur) {
    stderr.write(`[classerPush] erreur git non prévue : ${erreur.message}\n`)
    exit(1)
  }
}
