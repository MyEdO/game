// CLASSEMENT D'UN PUSH — documentaire ou produit (#1738).
//
// La CI l'exécute AVANT `npm ci`, dans le prologue de chaque job (`ACTION_PROLOGUE`) : la fermeture
// de ses imports n'atteint que `node:*` et des fichiers du dépôt, jamais un paquet (garde :
// `classerPush.test.mjs`). Elle compte l'hôte git (`gitPorte.mjs`, `TRONC`) ; `gatesSautables`
// reçoit `ECRIT_LU`/`gatesDeCi()` en PARAMÈTRE au lieu de les importer.
//
// Ce qu'un push déclenche se décide par ce que les gates LISENT (`ECRIT_LU[gate].lit`,
// `scripts/gates/toutes.mjs`, mesuré), jamais par un dossier deviné. La décision est FAIL-CLOSED
// des deux côtés : un fichier hors `DOCUMENTAIRE` rend le push PRODUIT, une gate dont `lit` est
// vide n'est jamais sautée, un diff vide est PRODUIT.
import { env, exit, stderr, stdout } from 'node:process'
import { TRONC, baseCommune, ceQuiChange, depotDe, fetchOrigin, reussi, shaDe } from '../guards/lib/gitPorte.mjs'

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
 * produit, chacun avec sa raison. Le prologue (`ACTION_PROLOGUE` : classement et `npm ci`) n'y est
 * pas : il joue toujours, puisque tout ce qui suit en dépend.
 */
export const CI_SEULEMENT_PRODUIT = {
  'npm --prefix server ci':
    'install du worker, prérequis du seul `server:typecheck` — inutile quand rien de server/ ne bouge',
}

/** Action composite du PROLOGUE de chaque job vérifiant de `ci.yml` (Node, classement, `npm ci`),
 *  relative à la racine du dépôt. */
export const ACTION_PROLOGUE = '.github/actions/prologue/action.yml'

/** `id` du step qui appelle le prologue dans chaque job : c'est par lui que les steps lisent le
 *  classement (`outputs.produit`) et l'issue du prologue ENTIER — Node, classement, `npm ci` (`outcome`). */
export const ID_PROLOGUE = 'prologue'

/** Commande EXACTE du step de classement dans `ACTION_PROLOGUE` — une seule écriture, lue par la garde. */
export const COMMANDE_CLASSER = 'node scripts/gates/classerPush.mjs >> "$GITHUB_OUTPUT"'

/** Fragment de la condition `if` que porte tout step conditionné par le classement. */
export const CONDITION_PRODUIT = `steps.${ID_PROLOGUE}.outputs.produit != 'false'`

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

/** Un sha vide ou fait de zéros : `github.event.merge_group.base_sha` hors `merge_group`. */
const shaNul = (sha) => !sha || !/[^0]/.test(sha)

/**
 * La BASE du diff : ce contre quoi on classe. Sur un commit de file (`merge_group`), `base` est
 * `github.event.merge_group.base_sha` — ce sur quoi l'entrée se pose, `main` ou l'entrée précédente.
 * Sur une branche de travail, ce qui ENTRERA dans `main` (`merge-base origin/main SHA`) — jamais
 * l'incrément du push, qu'un run annulé puis un push documentaire rendraient faux. Une lecture que
 * git ne rend pas replie en classement CONSERVATEUR ; une panne de git (`enPanne`, `depotDe`) y est
 * NOMMÉE. `refs/remotes/origin/main` manque à un clone `--single-branch` d'une branche de travail : il
 * se fetche avant le merge-base.
 * @returns {{ base: string } | { base: null, motif: string }}
 */
export function baseDuDiff({ base, sha, cwd = process.cwd() } = {}) {
  if (!shaNul(base)) return { base }
  const pannes = []
  const depot = depotDe(cwd, { enPanne: (raison) => pannes.push(raison) })
  const conservateur = (motif) => ({
    base: null,
    motif: `${motif}${pannes.length ? ` — git indisponible : ${pannes.join(' ; ')}` : ''} : conservateur`,
  })
  if (shaDe(depot, `refs/remotes/${TRONC.suivi}`) === null && !reussi(fetchOrigin(depot))) return conservateur('origin/main absent après fetch')
  const commune = baseCommune(depot, TRONC.suivi, sha)
  return commune ? { base: commune } : conservateur('merge-base origin/main en échec')
}

/** Le classement complet, du contexte de push aux motifs. Une borne du diff inconnue LÈVE
 *  (`BorneAbsente`, `ceQuiChange`). */
export function classerPush({ base, sha, cwd = process.cwd() } = {}) {
  const socle = baseDuDiff({ base, sha, cwd })
  if (socle.base === null) return { produit: true, base: null, fichiers: [], motifs: [socle.motif] }
  const fichiers = ceQuiChange(depotDe(cwd), socle.base, sha).chemins()
  return { ...classer(fichiers), base: socle.base, fichiers }
}

if (import.meta.main) {
  try {
    const sha = env.SHA || 'HEAD'
    const verdict = classerPush({ base: env.BASE, sha })
    stdout.write(`produit=${verdict.produit}\n`)
    stderr.write(
      `[classerPush] sha=${sha} base=${verdict.base ?? '(aucune)'} ` +
        `fichiers=${verdict.fichiers.length} produit=${verdict.produit}\n` +
        verdict.motifs.map((m) => `  - ${m}\n`).join(''),
    )
  } catch (erreur) {
    stderr.write(`[classerPush] erreur git non prévue : ${erreur.message}\n`)
    exit(1)
  }
}
