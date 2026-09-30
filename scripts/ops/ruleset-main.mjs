// RULESET `main` — LA protection serveur de `main` (#1776). C'est elle, et rien de local, qui tient
// l'invariant « `main` n'est jamais rouge » : la preuve est le run CI GitHub du sha lui-même.
//
// Décision utilisateur du 2026-09-16, verbatim : « Oui, ruleset actif ». Elle RE-DÉCIDE « Aucune
// protection serveur pour l'instant » [entériné 2026-09-01]. Le mode `evaluate` n'existe pas sur le
// plan de ce dépôt (HTTP 422 « Enforcement evaluate option is not supported on this plan », mesuré
// le 2026-09-04) : les modes offerts sont `active` et `disabled`, et c'est `active`.
//
// TROIS RÈGLES :
//   · `required_status_checks` — les jobs VÉRIFIANTS du `ci.yml` du TRONC (`origin/main`, jamais
//     l'arbre local : un check exigé que `main` ne produit pas encore bloquerait toute entrée ;
//     `JOBS_NON_VERIFIANTS`, scripts/gates/gatesDeCi.mjs, nomme les autres).
//     `strict_required_status_checks_policy: false` : la tête verte sur sa branche est acceptée
//     telle quelle, c'est le FAST-FORWARD qui garantit que le sha jugé est celui qui entre ;
//   · `non_fast_forward` — `main` n'est jamais réécrite ;
//   · `deletion` — `main` ne se supprime pas.
//
// AUCUN BYPASS — mesure du 2026-09-16 à l'activation : un corps portant l'intégration GitHub Actions
// en `bypass_actors` est REFUSÉ par le serveur. `gh api -X POST repos/cgauche/game/rulesets --input
// <corps>` → HTTP 422, verbatim : « Actor GitHub Actions integration must be part of the ruleset
// source or owner organization » — le dépôt était alors PERSONNEL (`cgauche/game`) ; il appartient à
// l'organisation `MyEdO` depuis le 2026-09-29 (#2178). Le ruleset n'exonère AUCUN acteur, et rien
// dans le dépôt n'en a besoin : aucun workflow ne commet sur `main`. (le `git push` de `deploy.yml`
// pousse sur le dépôt de PROD, pas sur `main` : le ruleset ne le voit jamais.)
//
// Usage : `npm run ops:ruleset -- --dry-run` (imprime le corps, n'écrit rien) ou `npm run ops:ruleset`
// (crée ou met à jour le ruleset — geste de l'orchestrateur, jamais d'un agent).
import { execFileSync } from 'node:child_process'
import { writeFileSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import { contextesRequis } from '../gates/gatesDeCi.mjs'
import { DEPOT } from '../guards/lib/ticketsGh.mjs'
import { TRONC, depotDe, fetchOrigin, lireEnLot, reussi, shaDe } from '../guards/lib/gitPorte.mjs'

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
export const NOM = 'main'

/** Chemin de `ci.yml`, relatif à la racine du dépôt. */
const CI = '.github/workflows/ci.yml'

/** Le texte de `ci.yml` à `origin/main` (`TRONC.suivi`) — ce que `main` produit comme checks. Un
 *  tronc sans `ci.yml` LÈVE : aucun corps ne se pose sur une lecture vide. */
export function ciDuTronc(cwd = RACINE) {
  const texte = lireEnLot(depotDe(cwd), TRONC.suivi, [CI]).get(CI)
  if (texte === null) throw new Error(`${TRONC.suivi}:${CI} illisible — le ruleset ne peut pas nommer ses checks`)
  return texte
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
 * Le geste, avec son exécutant `gh` et sa lecture du `ci.yml` du tronc (`lireCi`) INJECTÉS : c'est
 * ainsi que le test vérifie qu'un `--dry-run` n'émet aucun appel, sans réseau ni écriture. `PUT` est
 * la méthode documentée de `PUT /repos/{owner}/{repo}/rulesets/{ruleset_id}` (mise à jour d'un
 * ruleset de dépôt) ; la création passe par `POST /repos/{owner}/{repo}/rulesets`.
 * REND le code de sortie du processus : 0, ou 1 quand `gh` refuse — le refus part au `journal`.
 */
export function executer({
  argv = [],
  runner = gh,
  lireCi = ciDuTronc,
  sortie = (s) => process.stdout.write(s),
  journal = (s) => process.stderr.write(s),
} = {}) {
  const dryRun = argv.includes('--dry-run')
  const contextes = contextesRequis({ texte: lireCi() })
  const corps = corpsDuRuleset(contextes)
  sortie(`${JSON.stringify(corps, null, 2)}\n`)
  sortie(`[ruleset] checks requis posés : ${contextes.join(', ')}\n`)
  if (dryRun) {
    sortie('[ruleset] --dry-run : rien n’a été écrit sur GitHub\n')
    return 0
  }
  // `gh api --input` lit un FICHIER : le corps passe par un fichier temporaire hors du dépôt, jamais
  // par stdin (que `stdio[0] = 'ignore'` ferme) ni par une ligne de commande à échapper.
  const fichier = join(tmpdir(), `wfrp-ruleset-${process.pid}.json`)
  try {
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

/** La ref LOCALE `origin/main` que `ciDuTronc` lit est d'abord remise au tronc distant (`fetchOrigin`),
 *  et son sha est affiché : le corps posé nomme la révision qu'il a lue. */
if (import.meta.main) {
  const depot = depotDe(RACINE)
  const vu = fetchOrigin(depot)
  if (!reussi(vu)) {
    const raison = vu.disponible ? (vu.absent ? 'objet absent' : String(vu.valeur.stderr).trim()) : vu.raison
    process.stderr.write(`[ruleset] git fetch ${TRONC.suivi} en échec : ${raison}\n`)
    process.exit(1)
  }
  process.stdout.write(`[ruleset] ${TRONC.suivi} lu à ${shaDe(depot, TRONC.suivi)}\n`)
  process.exit(executer({ argv: process.argv.slice(2) }))
}
