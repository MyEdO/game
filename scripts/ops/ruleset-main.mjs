// RULESET `main` — LA protection serveur de `main` (#1776, #2178). C'est elle, et
// rien de local, qui tient l'invariant « `main` n'est jamais rouge » : le serveur SÉRIALISE les entrées.
//
// Décision utilisateur du 2026-09-29, verbatim : « une fois qu'on veut publié, ca se bouscule beaucoup,
// en plus des gates, du rebase + CI qui potentiellement réponds que main a bougé entre le début et la
// fin et j'en passe » (#2178). Arbitrage utilisateur du 2026-09-16 : « Oui, ruleset actif ». Le mode
// `evaluate` n'existe pas sur le plan de ce dépôt (HTTP 422 « Enforcement evaluate option is not
// supported on this plan », mesuré le 2026-09-04) : les modes offerts sont `active` et `disabled`.
//
// CINQ RÈGLES (schémas `repository-rule-*` de github/rest-api-description) :
//   · `required_status_checks` — les checks des jobs VÉRIFIANTS du `ci.yml` du TRONC (`origin/main`,
//     jamais l'arbre local : un check exigé qu'aucun job de `main` ne produit bloquerait toute entrée),
//     ou de la ref `--depuis <ref>` : le `ci.yml` d'un lot qui CHANGE les checks, posé juste avant sa
//     publication — le lot les satisfait, une PR à l'ancien `ci.yml` reste bloquée jusqu'à fusionner
//     `main`, et aucune fenêtre n'exige moins de checks (#2178, design du lot 1b §4).
//     `strict_required_status_checks_policy: false` : le commit de file jugé EST celui qui entre ;
//   · `merge_queue` — la file de fusion, paramètres TOUS explicites (`PARAMETRES_DE_FILE`), posée
//     seulement quand le `ci.yml` du tronc déclenche sur `merge_group` (`refusDeFile`) ;
//   · `pull_request` — aucun push direct sur `main`, zéro approbation (`PARAMETRES_DE_PR`) ;
//   · `non_fast_forward` — `main` n'est jamais réécrite ;
//   · `deletion` — `main` ne se supprime pas.
//
// AUCUN BYPASS — mesure du 2026-09-16 à l'activation : un corps portant l'intégration GitHub Actions
// en `bypass_actors` est REFUSÉ par le serveur. `gh api -X POST repos/cgauche/game/rulesets --input
// <corps>` → HTTP 422, verbatim : « Actor GitHub Actions integration must be part of the ruleset
// source or owner organization » — le dépôt était alors PERSONNEL (`cgauche/game`) ; il appartient à
// l'organisation `MyEdO` depuis le 2026-09-29 (#2178). Le ruleset n'exonère AUCUN acteur : `main`
// n'avance que par la file. (le `git push` de `deploy.yml` pousse sur le dépôt de PROD, pas sur
// `main` : le ruleset ne le voit jamais.)
//
// Usage : `npm run ops:ruleset -- --dry-run` (imprime les corps, n'écrit rien) ou `npm run ops:ruleset`
// (crée ou met à jour le ruleset — geste de l'orchestrateur, jamais d'un agent) ; `--depuis <ref>` lit
// le `ci.yml` de `<ref>` au lieu d'`origin/main`, avec ou sans `--dry-run`.
import { execFileSync } from 'node:child_process'
import { writeFileSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import { TIMEOUT_JOB_MINUTES, contextesRequis } from '../gates/gatesDeCi.mjs'
import { declencheursDe } from '../gates/workflowsDuDepot.mjs'
import { DEPOT } from '../guards/lib/ticketsGh.mjs'
import { TRONC, depotDe, fetchOrigin, lireEnLot, reussi, shaDe } from '../guards/lib/gitPorte.mjs'

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
export const NOM = 'main'

/** Chemin de `ci.yml`, relatif à la racine du dépôt. */
const CI = '.github/workflows/ci.yml'

/** Déclencheur que la file exige du workflow qui porte ses checks requis (managing-a-merge-queue.md :
 *  « You **must** use the `merge_group` event »). */
export const DECLENCHEUR_DE_FILE = 'merge_group'

/**
 * Délai de réponse des checks d'une entrée de file, en minutes : le plafond d'un job
 * (`TIMEOUT_JOB_MINUTES`) plus autant d'attente de runner. Au-delà, la file tient le check pour échoué
 * (`check_response_timeout_minutes`).
 */
export const DELAI_DE_REPONSE_MINUTES = 2 * TIMEOUT_JOB_MINUTES

/**
 * Paramètres de la règle `merge_queue` — les sept que le schéma `repository-rule-merge-queue` exige.
 * `MERGE` : les commits de la branche entrent avec LEURS shas (#2178, design v2). `ALLGREEN` : chaque
 * commit de file passe les checks requis. `min_entries_to_merge: 1` : aucune attente de groupe.
 * `max_entries_to_build: 2` : une course de `ci.yml` = 8 jobs (run 36831681566), et le plan `free` de
 * l'organisation `MyEdO` (`gh api orgs/MyEdO --jq .plan.name`) en sert 20 à la fois (limits.md, tableau
 * « Total concurrent jobs »). Deux entrées de file = 2 × 8 = 16 jobs ; il reste 20 − 16 = 4 jobs pour
 * TOUTE course de branche : N courses de branche simultanées (N × 8) attendent dès que 16 + N × 8 > 20,
 * soit dès N = 1. L'attente se mesure `createdAt` → `startedAt` (#2178, design du lot 1b §5).
 */
export const PARAMETRES_DE_FILE = Object.freeze({
  check_response_timeout_minutes: DELAI_DE_REPONSE_MINUTES,
  grouping_strategy: 'ALLGREEN',
  max_entries_to_build: 2,
  max_entries_to_merge: 5,
  merge_method: 'MERGE',
  min_entries_to_merge: 1,
  min_entries_to_merge_wait_minutes: 0,
})

/** Paramètres de la règle `pull_request` — les cinq que le schéma `repository-rule-pull-request` exige,
 *  plus `allowed_merge_methods`, aligné sur `PARAMETRES_DE_FILE.merge_method`. */
export const PARAMETRES_DE_PR = Object.freeze({
  allowed_merge_methods: Object.freeze(['merge']),
  dismiss_stale_reviews_on_push: false,
  require_code_owner_review: false,
  require_last_push_approval: false,
  required_approving_review_count: 0,
  required_review_thread_resolution: false,
})

/** Le texte de `ci.yml` à `ref` — par défaut `origin/main` (`TRONC.suivi`), ce que `main` produit comme
 *  checks. Une ref sans `ci.yml` LÈVE : aucun corps ne se pose sur une lecture vide. */
export function ciALaRef(ref = TRONC.suivi, cwd = RACINE) {
  const texte = lireEnLot(depotDe(cwd), ref, [CI]).get(CI)
  if (texte === null) throw new Error(`${ref}:${CI} illisible — le ruleset ne peut pas nommer ses checks`)
  return texte
}

/** Le refus de poser la file, ou `null`. PUR. Sans `merge_group` au `ci.yml` lu (`ref`), aucun check
 *  requis ne se joue sur un commit de file, et la file n'entre rien
 *  (data/reusables/actions/merge-group-event-with-required-checks.md). */
export function refusDeFile(texteCi, ref = TRONC.suivi) {
  if (declencheursDe(texteCi, `${ref}:${CI}`).includes(DECLENCHEUR_DE_FILE)) return null
  return `[ruleset] REFUS : ${ref}:${CI} ne déclenche pas sur \`${DECLENCHEUR_DE_FILE}\` — publier d’abord le ci.yml qui le porte, puis relancer \`npm run ops:ruleset\``
}

/** La ref dont le `ci.yml` nomme les checks : la valeur de `--depuis`, sinon `origin/main`. `{ refus }`
 *  quand `--depuis` n'a pas de valeur. PUR. */
export function refDe(argv) {
  const i = argv.indexOf('--depuis')
  if (i === -1) return { ref: TRONC.suivi }
  const ref = argv[i + 1]
  if (!ref || ref.startsWith('-')) return { refus: '[ruleset] REFUS : `--depuis` sans ref — `--depuis <ref>`' }
  return { ref }
}

/** Le refus de lire `--depuis <ref>` LOCALE quand `origin/<ref>` existe et pointe ailleurs, ou `null`.
 *  PUR. `locale` = sha de `refs/heads/<ref>` (`null` : la ref n'est pas une branche locale) ;
 *  `distante` = sha de `refs/remotes/origin/<ref>` (`null` : aucune ref distante). */
export function refusDeRefLocale(ref, { locale, distante }) {
  if (locale === null || distante === null || locale === distante) return null
  return `[ruleset] REFUS : \`--depuis ${ref}\` lit la branche LOCALE (${locale}), qui diffère de origin/${ref} (${distante}) — pousser ou remettre la branche à origin/${ref}, puis relancer`
}

/** La requête GraphQL du compte d'entrées de la file de `main` (`MergeQueue.entries`). */
export const REQUETE_DE_FILE =
  `query($owner:String!,$name:String!){repository(owner:$owner,name:$name){mergeQueue(branch:"${NOM}"){entries(first:1){totalCount}}}}`

/** Le nombre d'entrées de la file de `main`, lu par `runner` (le canal `gh` du script). */
export function entreesDeFile(runner = gh) {
  const [owner, name] = DEPOT.split('/')
  const rendu = JSON.parse(runner(['api', 'graphql', '-f', `query=${REQUETE_DE_FILE}`, '-F', `owner=${owner}`, '-F', `name=${name}`]))
  return rendu.data.repository.mergeQueue?.entries.totalCount ?? 0
}

/** Le refus de poser les checks de `--depuis` sur une file NON VIDE, ou `null`. PUR. Une entrée déjà en
 *  file a été construite par l'ancien `ci.yml` : elle ne produit jamais les checks neufs et attend
 *  `check_response_timeout_minutes` avant d'être éjectée. */
export function refusDeFileOccupee(total) {
  if (total === 0) return null
  return `[ruleset] REFUS : la file de \`${NOM}\` porte ${total} entrée(s), construite(s) par l’ancien ci.yml — elles attendraient ${PARAMETRES_DE_FILE.check_response_timeout_minutes} min les checks de \`--depuis\` avant éjection ; vider la file, puis relancer`
}

/** Corps du ruleset. PUR. */
export function corpsDuRuleset(contextes) {
  return {
    name: NOM,
    target: 'branch',
    enforcement: 'active',
    conditions: { ref_name: { include: [TRONC.branche], exclude: [] } },
    rules: [
      {
        type: 'required_status_checks',
        parameters: {
          strict_required_status_checks_policy: false,
          required_status_checks: contextes.map((context) => ({ context })),
        },
      },
      { type: 'merge_queue', parameters: { ...PARAMETRES_DE_FILE } },
      { type: 'pull_request', parameters: { ...PARAMETRES_DE_PR, allowed_merge_methods: [...PARAMETRES_DE_PR.allowed_merge_methods] } },
      { type: 'non_fast_forward' },
      { type: 'deletion' },
    ],
  }
}

/** JAMAIS `shell: true` : `gh` est un exécutable, et les endpoints comme les corps JSON portent des
 *  caractères que `cmd.exe` interpréterait. `stdio[0] = 'ignore'` = le `< /dev/null` d'un workflow. */
const gh = (args) =>
  execFileSync('gh', args, { cwd: RACINE, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] })

/** Id du ruleset `main` s'il existe, `null` sinon (l'écriture est donc IDEMPOTENTE). */
export function idExistant(runner = gh) {
  const liste = JSON.parse(runner(['api', `repos/${DEPOT}/rulesets`]))
  return liste.find((r) => r.name === NOM)?.id ?? null
}

/** Ce qu'un échec de `gh` DIT. PUR — il rend le corps de l'erreur, jamais une exception brute. */
export function refusGh(erreur) {
  const corps = [erreur?.stdout, erreur?.stderr, erreur?.message]
    .filter(Boolean)
    .map((p) => String(p))
    .join('\n')
  return `[ruleset] échec de l’appel gh : ${corps.trim()}`
}

/**
 * Le geste, avec son exécutant `gh` et sa lecture du `ci.yml` d'une ref (`lireCi`) INJECTÉS : c'est
 * ainsi que le test vérifie qu'un `--dry-run` n'émet aucun appel, sans réseau ni écriture. `PUT` est
 * la méthode documentée de `PUT /repos/{owner}/{repo}/rulesets/{ruleset_id}` (mise à jour d'un
 * ruleset de dépôt) ; la création passe par `POST /repos/{owner}/{repo}/rulesets`.
 * REND le code de sortie du processus : 0, ou 1 quand la file est refusée (`refusDeFile`, AVANT tout
 * appel, `--dry-run` compris), quand `--depuis` lit une branche locale divergente de son origine
 * (`refusDeRefLocale`, `--dry-run` compris), quand `--depuis` trouve la file de `main` occupée
 * (`refusDeFileOccupee`, hors `--dry-run`) ou quand `gh` refuse — le refus part au `journal`.
 * `shaDeRef` rend le sha d'une ref, `null` si elle n'existe pas.
 */
export function executer({
  argv = [],
  runner = gh,
  lireCi = ciALaRef,
  shaDeRef = (r) => shaDe(depotDe(RACINE), r),
  sortie = (s) => process.stdout.write(s),
  journal = (s) => process.stderr.write(s),
} = {}) {
  const dryRun = argv.includes('--dry-run')
  const { ref, refus: refusDeRef } = refDe(argv)
  if (refusDeRef) {
    journal(`${refusDeRef}\n`)
    return 1
  }
  const depuis = argv.includes('--depuis')
  if (depuis) {
    const refusLocal = refusDeRefLocale(ref, { locale: shaDeRef(`refs/heads/${ref}`), distante: shaDeRef(`refs/remotes/origin/${ref}`) })
    if (refusLocal) {
      journal(`${refusLocal}\n`)
      return 1
    }
  }
  const texteCi = lireCi(ref)
  const contextes = contextesRequis({ texte: texteCi })
  const corps = corpsDuRuleset(contextes)
  sortie(`${JSON.stringify(corps, null, 2)}\n`)
  sortie(`[ruleset] checks requis posés, lus à ${ref}:${CI} : ${contextes.join(', ')}\n`)
  const refus = refusDeFile(texteCi, ref)
  if (refus) {
    journal(`${refus}\n`)
    return 1
  }
  if (dryRun) {
    if (depuis) sortie(`[ruleset] --dry-run : file de \`${NOM}\` non sondée — l’exécution réelle refuse tant qu’elle n’est pas vide\n`)
    sortie('[ruleset] --dry-run : rien n’a été écrit sur GitHub\n')
    return 0
  }
  // `gh api --input` lit un FICHIER : le corps passe par un fichier temporaire hors du dépôt, jamais
  // par stdin (que `stdio[0] = 'ignore'` ferme) ni par une ligne de commande à échapper.
  const fichier = join(tmpdir(), `wfrp-ruleset-${process.pid}.json`)
  try {
    if (depuis) {
      const refusOccupee = refusDeFileOccupee(entreesDeFile(runner))
      if (refusOccupee) {
        journal(`${refusOccupee}\n`)
        return 1
      }
    }
    const id = idExistant(runner)
    writeFileSync(fichier, JSON.stringify(corps))
    const cible = id === null ? `repos/${DEPOT}/rulesets` : `repos/${DEPOT}/rulesets/${id}`
    runner(['api', '-X', id === null ? 'POST' : 'PUT', cible, '--input', fichier])
    sortie(`[ruleset] ${NOM} ${id === null ? 'créé' : `mis à jour (id ${id})`} en mode active\n`)
    return 0
  } catch (erreur) {
    journal(`${refusGh(erreur)}\n`)
    return 1
  } finally {
    rmSync(fichier, { force: true })
  }
}

/** La ref LOCALE `origin/main` est d'abord remise au tronc distant (`fetchOrigin`), et le sha de la ref
 *  lue (`refDe`) est affiché : le corps posé nomme la révision qu'il a lue. */
if (import.meta.main) {
  const depot = depotDe(RACINE)
  const vu = fetchOrigin(depot)
  if (!reussi(vu)) {
    const raison = vu.disponible ? (vu.absent ? 'objet absent' : String(vu.valeur.stderr).trim()) : vu.raison
    process.stderr.write(`[ruleset] git fetch ${TRONC.suivi} en échec : ${raison}\n`)
    process.exit(1)
  }
  const { ref } = refDe(process.argv.slice(2))
  if (ref) process.stdout.write(`[ruleset] ${ref} lu à ${shaDe(depot, ref)}\n`)
  process.exit(executer({ argv: process.argv.slice(2) }))
}
