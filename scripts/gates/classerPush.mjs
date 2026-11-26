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
//
// Les gates SAUTÉES d'un push (#4903 L4, `gatesSautees`) se calculent après `npm ci` (`sauteesDuPush.mjs`,
// qui lit `ECRIT_LU`) : une gate saute quand chaque fichier du diff est documentaire et qu'elle ne lit rien de
// documentaire, ou est dans un dossier de zone que ses `zones` déclarées excluent.
import { basename, join } from 'node:path'
import { env, exit, stderr, stdout } from 'node:process'
import { GitIndisponible, TRONC, baseCommune, ceQuiChange, depotDe, fetchOrigin, refusDeGit, reussi, shaDe } from '../guards/lib/gitPorte.mjs'
import { COUCHES, couvre, dossierDe, estProjet } from '../guards/lib/couches.mjs'
import { SKILLS, racinesDeMods, racinesDeModsParmi } from '../mods/racines.mjs'
import {
  COMMANDE_NAVIGATEUR_EPINGLE,
  COMMANDE_RECUPERER_MODELES,
  COMMANDE_RENDU_LOGICIEL,
  COMMANDE_VERSION_PYTHON_3D,
  COMMANDE_ZONE_DU_PUSH,
} from './gatesDeCi.mjs'

/**
 * Chemins NON EXÉCUTABLES, chacun avec sa raison. Un push dont TOUS les fichiers changés tombent
 * sous l'un de ces préfixes est documentaire. La liste est fail-closed : `docs/`, `.github/`,
 * `package*.json`, `scripts/`, `src/`, `Source/` n'y sont pas et rendent le push produit.
 * Un chemin qui finit par `/` désigne le dossier et tout ce qu'il contient. Une racine de mod
 * (scripts/mods/racines.mjs) est PRODUIT même sous `.claude/` (`classer`, option `mods`).
 */
export const DOCUMENTAIRE = {
  '.claude/':
    'documentaire pour le PRODUIT : instructions, mémoire, soldes et workflows d’agent — côté SOURCE de ' +
    'la compat d’agents que `agents:check` compare (scripts/agents/compat-cli.mjs) ; aucun module de src/ ' +
    'ni server/src/ ne lit ce dossier hors test (sonde 2026-09-16 : 3 mentions, toutes en commentaire). ' +
    'Hors les racines de mod (`.claude/skills/<x>/` qui porte `.claude-plugin/plugin.json`, #2278), du ' +
    'code exécuté par le moteur Claude Code et jugé par le mur `murs/mod-sans-regle` (garde `lint`) et par la garde ' +
    '`mods:check` : `classer` les rend PRODUIT, et ces deux gardes LISENT `.claude/skills/`, qui chevauche ce ' +
    'préfixe, donc `gatesSautables` ne les saute jamais',
  '.agents/':
    'miroir de la compat d’agents, écrit par `agents:sync` et comparé par `agents:check` — aucune ' +
    'lecture depuis src/ ni server/src/ (sonde 2026-09-16 : 0 mention)',
  '.codex/':
    'miroir Codex de la compat d’agents, même couture que `.agents/` — les 21 mentions de « .codex » ' +
    'sous src/ sont la classe CSS `.codex-…` et le champ `codexCategory`, aucune lecture de fichier',
  'AGENTS.md':
    'instructions du dépôt, lues par Codex et importées par CLAUDE.md — aucune lecture depuis src/ ni ' +
    'server/src/ (sonde : 0 mention)',
  'CLAUDE.md':
    'imports du credo et d’AGENTS.md — les mentions sous src/ sont des références de commentaire (règle ' +
    'citée), aucune lecture de fichier',
}

/**
 * Steps `CI_SEULEMENT` de `ci.yml` (scripts/gates/gatesDeCi.mjs) qui ne servent que des GATES, chacun avec sa raison et
 * les gates qu'il sert : dans un job, le step saute avec la gate qu'il y sert (`conditionDeSaut`). Le prologue
 * (`ACTION_PROLOGUE` : classement et `npm ci`) n'y est pas : il joue toujours, puisque tout ce qui suit en dépend.
 */
export const CI_SEULEMENT_DE_GATE = {
  'npm --prefix server ci': {
    raison: 'install du worker, prérequis de `server:typecheck` et de `godot:coop` — inutile quand ils ne jouent pas',
    gates: ['server:typecheck', 'godot:coop'],
  },
  [COMMANDE_VERSION_PYTHON_3D]: {
    raison: 'version de CPython du seul `personnage-3d:tests`, sautable avec lui',
    gates: ['personnage-3d:tests'],
  },
  [COMMANDE_RECUPERER_MODELES]: {
    raison: 'GLB épinglés du cache des modèles et textures épinglées, que le seul `personnage-3d:tests` lit dans le job `migrations`, sautables avec lui',
    gates: ['personnage-3d:tests'],
  },
  [COMMANDE_RENDU_LOGICIEL]: {
    raison: 'écran virtuel et rendu logiciel du seul `godot:rendus`, sautable avec lui',
    gates: ['godot:rendus'],
  },
  [COMMANDE_ZONE_DU_PUSH]: {
    raison: 'zone du push (`zone=`, #5037 L2) posée en environnement du seul `test`, dont la tranche s’y restreint, sautable avec lui',
    gates: ['test'],
  },
  [COMMANDE_NAVIGATEUR_EPINGLE]: {
    raison: 'navigateur épinglé du seul `roguelite:recette`, sautable avec lui',
    gates: ['roguelite:recette'],
  },
}

/** Action composite du PROLOGUE de chaque job vérifiant de `ci.yml` (Node, classement, `npm ci`),
 *  relative à la racine du dépôt. */
export const ACTION_PROLOGUE = '.github/actions/prologue/action.yml'

/** `id` du step qui appelle le prologue dans chaque job : c'est par lui que les steps lisent le
 *  classement (`outputs.produit`), les gates sautées (`outputs.sautees`) et l'issue du prologue ENTIER — Node,
 *  classement, `npm ci`, gates sautées (`outcome`). */
export const ID_PROLOGUE = 'prologue'

/** Commande EXACTE du step de classement dans `ACTION_PROLOGUE` — une seule écriture, lue par la garde. */
export const COMMANDE_CLASSER = 'node scripts/gates/classerPush.mjs >> "$GITHUB_OUTPUT"'

/** Commande EXACTE du step du prologue, après `npm ci`, qui écrit les gates sautées du push. */
export const COMMANDE_SAUTEES = 'node scripts/gates/sauteesDuPush.mjs >> "$GITHUB_OUTPUT"'

/** Fragment de la condition `if` d'un step conditionné par le classement qui n'est ni une gate ni au service d'une
 *  gate (`caches-3d`, `setup-python`, rejeu des migrations). */
export const CONDITION_PRODUIT = `steps.${ID_PROLOGUE}.outputs.produit != 'false'`

/** Fragment de la condition `if` d'un step qui saute avec la gate `nom` : `outputs.sautees` est ` <nom> <nom> … `, un
 *  output vide ou absent ne saute rien (fail-closed). */
export const conditionDeSaut = (nom) => `!contains(steps.${ID_PROLOGUE}.outputs.sautees, ' ${nom} ')`

/** Deux chemins CHEVAUCHENT quand l'un est préfixe de l'autre : `.claude/` et `.claude/memory/`. */
const chevauche = (a, b) => a.startsWith(b) || b.startsWith(a)

/** `true` si `fichier` tombe sous une entrée de `DOCUMENTAIRE` et hors des racines de mod `mods`. */
const estDocumentaire = (fichier, mods) =>
  !mods.some((racine) => fichier.startsWith(racine)) &&
  Object.keys(DOCUMENTAIRE).some((p) => (p.endsWith('/') ? fichier.startsWith(p) : fichier === p))

/**
 * Classe une liste de fichiers changés. Une liste VIDE est PRODUIT : un diff qu'on n'a pas su lire
 * ne prouve rien, et le conservateur est de tout jouer.
 * @param {readonly string[]} fichiers chemins relatifs POSIX
 * @param {{ mods?: readonly string[] }} [contexte] racines de mod (`.claude/skills/<x>/`) de l'arbre classé ;
 *   celles que nomme `fichiers` s'y ajoutent
 * @returns {{ produit: boolean, motifs: string[] }}
 */
export function classer(fichiers, { mods = [] } = {}) {
  if (!fichiers || fichiers.length === 0)
    return { produit: true, motifs: ['diff vide : conservateur — rien de mesuré, tout se joue'] }
  const racines = [...mods, ...racinesDeModsParmi(fichiers)]
  const fautif = fichiers.find((f) => !estDocumentaire(f, racines))
  if (fautif)
    return {
      produit: true,
      motifs: [`${fautif} : ${racines.some((r) => fautif.startsWith(r)) ? 'racine de mod' : 'hors DOCUMENTAIRE'} (${fichiers.length} fichier(s) changé(s))`],
    }
  return { produit: false, motifs: [`${fichiers.length} fichier(s), tous sous DOCUMENTAIRE`] }
}

/** `lit` chevauche-t-il une entrée de `DOCUMENTAIRE` ? */
const litDuDocumentaire = (lit) => lit.some((chemin) => Object.keys(DOCUMENTAIRE).some((p) => chevauche(chemin, p)))

/**
 * Les gates SAUTABLES sur un push documentaire : `lit` NON VIDE et sans chevauchement avec une
 * entrée de `DOCUMENTAIRE`. Une gate sans `lit` mesuré joue toujours — la borne est fail-closed.
 * @param {{ gates: readonly {nom: string}[], ecritLu: Record<string, {lit?: readonly string[]}> }} args
 * @returns {Set<string>}
 */
export function gatesSautables({ gates, ecritLu }) {
  return new Set(gates.map(({ nom }) => nom).filter((nom) => ecritLu[nom]?.lit?.length && !litDuDocumentaire(ecritLu[nom].lit)))
}

/** Le dossier de la zone `z`, fini par `/`, s'il est hors de `src/` (`hotes/<a>/`, `projets/<p>/`) ; `null` sinon. */
export const dossierHorsDeSrc = (z) => (dossierDe(z).split('/')[0] === 'src' ? null : `${dossierDe(z)}/`)

/** Les dossiers des zones de `COUCHES` hors de `src/`. */
export const DOSSIERS_HORS_DE_SRC = Object.freeze(Object.keys(COUCHES).map(dossierHorsDeSrc).filter(Boolean))

/**
 * Les gates SAUTÉES d'un push (#4903 L4) : celles dont `lit` est NON VIDE et ne lit aucun fichier du diff. Une gate ne
 * lit pas un fichier DOCUMENTAIRE quand son `lit` ne chevauche aucune entrée de `DOCUMENTAIRE` (`gatesSautables`) ; elle
 * ne lit pas un fichier d'un dossier de zone hors de `src/` (`DOSSIERS_HORS_DE_SRC`) quand elle déclare ses `zones`
 * (`ECRIT_LU`, dont le `lit` dérive alors de `COUCHES`) et qu'aucune entrée de son `lit` ne le couvre. Une gate sans
 * `zones` lit tout dossier de zone : sa mesure n'a pas été confrontée à `COUCHES`. Un diff vide ne saute rien.
 * @param {readonly string[]} fichiers chemins relatifs POSIX
 * @param {{ gates: readonly {nom: string}[], ecritLu: Record<string, {lit?: readonly string[], zones?: readonly string[]}>, mods?: readonly string[] }} args
 * @returns {Set<string>}
 */
export function gatesSautees(fichiers, { gates, ecritLu, mods = [] }) {
  const racines = [...mods, ...racinesDeModsParmi(fichiers)]
  const sautees = new Set()
  for (const { nom } of gates) {
    const { lit = [], zones } = ecritLu[nom] ?? {}
    if (lit.length === 0 || fichiers.length === 0) continue
    const documentaireNonLu = !litDuDocumentaire(lit)
    const nonLu = (f) =>
      (documentaireNonLu && estDocumentaire(f, racines)) ||
      (zones !== undefined && DOSSIERS_HORS_DE_SRC.some((d) => f.startsWith(d)) && !lit.some((c) => couvre(c, f)))
    if (fichiers.every(nonLu)) sautees.add(nom)
  }
  return sautees
}

/** Les projets de `COUCHES` (`estProjet`), chacun avec son dossier fini par `/`. */
const DOSSIERS_DES_PROJETS = Object.freeze(Object.keys(COUCHES).filter(estProjet).map((z) => [z, `${dossierDe(z)}/`]))

/**
 * La ZONE d'un push (#5037 L2) : le projet dont le dossier contient CHAQUE fichier changé, `null` pour un diff vide,
 * un fichier hors des projets ou un diff à cheval sur deux projets. `scripts/test/run.mjs` restreint sa tranche à la zone
 * de `zoneDuPush` (`selectionDeLaZone`, scripts/test/selectionDeZone.mjs). PURE.
 * @param {readonly string[]} fichiers chemins relatifs POSIX
 * @returns {string | null}
 */
export function zoneDuDiff(fichiers) {
  const zone = fichiers.length ? DOSSIERS_DES_PROJETS.find(([, dossier]) => fichiers[0].startsWith(dossier)) : undefined
  return zone && fichiers.every((f) => f.startsWith(zone[1])) ? zone[0] : null
}

/** Le nom de la gate de la suite Vitest (`nomDeGate('npm test')`), la seule que la zone du push restreint. */
export const GATE_DE_LA_SUITE = 'test'

/**
 * La ZONE du push pour la suite (#5037 L2) : `zoneDuDiff` des seuls fichiers que la gate `GATE_DE_LA_SUITE` LIT — un
 * fichier qu'elle ne lit pas est celui sur lequel, seul, elle saute (`gatesSautees`, mesure `ECRIT_LU`), comme le solde
 * `.claude/soldes/<N>.md` d'une PR de projet. PURE.
 * @param {readonly string[]} fichiers chemins relatifs POSIX
 * @param {{ ecritLu: Record<string, {lit?: readonly string[], zones?: readonly string[]}>, mods?: readonly string[] }} args
 * @returns {string | null}
 */
export function zoneDuPush(fichiers, { ecritLu, mods = [] }) {
  const gates = [{ nom: GATE_DE_LA_SUITE }]
  return zoneDuDiff(fichiers.filter((f) => !gatesSautees([f], { gates, ecritLu, mods }).has(GATE_DE_LA_SUITE)))
}

/** Un sha vide ou fait de zéros : `github.event.merge_group.base_sha` hors `merge_group`. */
export const shaNul = (sha) => !sha || !/[^0]/.test(sha)

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
  const depot = depotDe(cwd, { enPanne: (_raison, vu) => pannes.push(refusDeGit(vu)) })
  const conservateur = (motif) => ({
    base: null,
    motif: `${motif}${pannes.length ? ` — git indisponible : ${pannes.join(' ; ')}` : ''} : conservateur`,
  })
  if (shaDe(depot, `refs/remotes/${TRONC.suivi}`) === null) {
    const vu = fetchOrigin(depot)
    if (!reussi(vu)) {
      pannes.push(refusDeGit(vu))
      return conservateur('origin/main absent après fetch')
    }
  }
  const commune = baseCommune(depot, TRONC.suivi, sha)
  return commune ? { base: commune } : conservateur('merge-base origin/main en échec')
}

/** Le classement complet, du contexte de push aux motifs. Une borne du diff inconnue LÈVE
 *  (`BorneAbsente`, `ceQuiChange`). */
export function classerPush({ base, sha, cwd = process.cwd() } = {}) {
  const socle = baseDuDiff({ base, sha, cwd })
  if (socle.base === null) return { produit: true, base: null, fichiers: [], mods: [], motifs: [socle.motif] }
  const fichiers = ceQuiChange(depotDe(cwd), socle.base, sha).chemins()
  const mods = racinesDeMods(join(cwd, ...SKILLS.split('/'))).map((racine) => `${SKILLS}${basename(racine)}/`)
  return { ...classer(fichiers, { mods }), base: socle.base, fichiers, mods }
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
    stderr.write(`[classerPush] erreur git non prévue : ${erreur instanceof GitIndisponible ? refusDeGit(erreur) : erreur.message}\n`)
    exit(1)
  }
}
