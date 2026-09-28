// RULESET `main` — LA protection serveur de `main` (#1776). C'est elle, et rien de local, qui tient
// l'invariant « `main` n'est jamais rouge » : la preuve est le run CI GitHub du sha lui-même.
//
// Décision utilisateur du 2026-09-16, verbatim : « Oui, ruleset actif ». Elle RE-DÉCIDE « Aucune
// protection serveur pour l'instant » [entériné 2026-09-01]. Le mode `evaluate` n'existe pas sur le
// plan de ce dépôt (HTTP 422 « Enforcement evaluate option is not supported on this plan », mesuré
// le 2026-09-04) : les modes offerts sont `active` et `disabled`, et c'est `active`.
//
// TROIS RÈGLES :
//   · `required_status_checks` — les jobs VÉRIFIANTS de `ci.yml` (`JOBS_NON_VERIFIANTS` nomme les
//     autres). `strict_required_status_checks_policy: false` : la tête verte sur sa branche est
//     acceptée telle quelle, c'est le FAST-FORWARD qui garantit que le sha jugé est celui qui entre ;
//   · `non_fast_forward` — `main` n'est jamais réécrite ;
//   · `deletion` — `main` ne se supprime pas.
//
// AUCUN BYPASS — mesure du 2026-09-16 à l'activation : un corps portant l'intégration GitHub Actions
// en `bypass_actors` est REFUSÉ par le serveur. `gh api -X POST repos/cgauche/game/rulesets --input
// <corps>` → HTTP 422, verbatim : « Actor GitHub Actions integration must be part of the ruleset
// source or owner organization ». Sur un dépôt PERSONNEL, cette intégration n'est pas un acteur
// exonérable. Le ruleset n'exonère donc AUCUN acteur, et rien dans le dépôt n'en a besoin : aucun
// workflow ne commet sur `main`. (le `git push` de `deploy.yml` pousse sur le dépôt de PROD, pas sur `main` : le
// ruleset ne le voit jamais.)
//
// Usage : `npm run ops:ruleset -- --dry-run` (imprime le corps, n'écrit rien) ou `npm run ops:ruleset`
// (crée ou met à jour le ruleset — geste de l'orchestrateur, jamais d'un agent).
import { execFileSync } from 'node:child_process'
import { writeFileSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import { jobsCi } from '../gates/gatesDeCi.mjs'
import { DEPOT } from '../guards/lib/ticketsGh.mjs'

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
export const NOM = 'main'

/**
 * Jobs de `ci.yml` qui ne VÉRIFIENT pas le contenu poussé, chacun avec sa raison : ils ne peuvent pas
 * être un check requis. Nominatif — un job neuf devient un check requis tant qu'il n'est pas nommé ici.
 */
export const JOBS_NON_VERIFIANTS = {
  fermetures:
    'joue APRÈS la publication (il ferme les tickets soldés par les commits poussés) — exiger sa ' +
    'réussite avant de laisser entrer le push serait circulaire',
}

/** Contextes de check requis = les jobs VÉRIFIANTS de `ci.yml`. */
export function contextesRequis({ cwd = RACINE, fichier } = {}) {
  return jobsCi({ cwd, fichier }).filter((j) => !(j in JOBS_NON_VERIFIANTS))
}

/** Corps du ruleset. PUR. */
export function corpsDuRuleset(contextes) {
  return {
    name: NOM,
    target: 'branch',
    enforcement: 'active',
    conditions: { ref_name: { include: ['refs/heads/main'], exclude: [] } },
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
 * Le geste, avec son exécutant `gh` INJECTÉ : c'est ainsi que le test vérifie qu'un `--dry-run`
 * n'émet aucun appel, sans réseau ni écriture. `PUT` est la méthode documentée de
 * `PUT /repos/{owner}/{repo}/rulesets/{ruleset_id}` (mise à jour d'un ruleset de dépôt) ; la
 * création passe par `POST /repos/{owner}/{repo}/rulesets`.
 * REND le code de sortie du processus : 0, ou 1 quand `gh` refuse — le refus part au `journal`.
 */
export function executer({
  argv = [],
  runner = gh,
  sortie = (s) => process.stdout.write(s),
  journal = (s) => process.stderr.write(s),
} = {}) {
  const dryRun = argv.includes('--dry-run')
  const corps = corpsDuRuleset(contextesRequis({ cwd: RACINE }))
  sortie(`${JSON.stringify(corps, null, 2)}\n`)
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

if (import.meta.main)
  process.exit(executer({ argv: process.argv.slice(2) }))
