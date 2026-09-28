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
// est donc PROPRE à la surface Claude (`scripts/agents/compat-core.mjs`, `HOOKS_MONO_SURFACE`).
//
// Chaque prérequis de la table PREREQUIS porte son propre CONSTAT (`manque`) et son BUDGET de temps :
// le hook est rejouable sans effet, un prérequis de plus s'ajoute en une entrée, et `BUDGET_TOTAL`
// est la SOURCE UNIQUE du `timeout` déclaré aux surfaces. Le hook n'échoue JAMAIS la session : ce
// qu'il n'a pas pu poser, il le NOMME sur sa sortie, qui entre au contexte de la session. Sous un Node
// que refuse la porte (`scripts/node-requis.mjs`), il sort par elle avant tout constat : un
// `SessionStart` en sortie 2 ne montre son stderr qu'à l'utilisateur, et chaque hook `PreToolUse`
// rend ce refus à la session au premier outil qu'il garde (son `matcher`) ; un outil que nul hook ne
// garde ne le déclenche pas.
import '../node-requis.mjs'
import { spawnSync } from 'node:child_process'

/** Marqueur d'un conteneur distant Claude Code (`CLAUDE_CODE_REMOTE=true`). */
export const estConteneurDistant = (env) => env.CLAUDE_CODE_REMOTE === 'true'

/** Budget d'un CONSTAT : trois commandes courtes (`git rev-parse`, `git config`, `gh --version`). */
export const BUDGET_CONSTAT = 10

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

/** Ce que le canon exige d'un arbre de travail, et comment le poser. `manque` MESURE, `poser` agit :
 *  un prérequis déjà satisfait ne fait rien. `budget` borne le temps total de `poser`, en secondes. */
export const PREREQUIS = [
  {
    nom: 'histoire git complète',
    // Le conteneur clone à une profondeur bornée (50 commits mesurés). Dix gardes de `test:hooks`
    // LISENT l'histoire — `fermetures-sans-solde`, `soldes-stock`, `stocks-nominatifs`,
    // `segments-profonds` — et refusent NOMMÉMENT un dépôt superficiel.
    manque: ({ racine, run }) =>
      run('git', ['rev-parse', '--is-shallow-repository'], { cwd: racine }).valeur === 'true',
    poser: ({ racine, run, budget }) =>
      run('git', ['fetch', '--unshallow', 'origin'], { cwd: racine, budget }),
    geste: 'git fetch --unshallow origin',
    budget: 90,
  },
  {
    nom: 'hooks git du dépôt',
    // Le script `postinstall` de `package.json` pose `core.hooksPath` et les trois pilotes de
    // fusion des docs dérivés ; sans lui, aucune garde de commit ne joue.
    manque: ({ racine, run }) =>
      run('git', ['config', 'core.hooksPath'], { cwd: racine }).valeur !== 'scripts/git-hooks',
    poser: ({ racine, run, budget }) =>
      run('npm', ['install', '--no-audit', '--no-fund'], { cwd: racine, budget }),
    geste: 'npm install',
    budget: 90,
  },
  {
    nom: 'exécutable gh',
    // Le dépôt officiel `cli.github.com` est refusé par la politique de sortie du conteneur (403 au
    // proxy) : le paquet de la distribution est la seule source atteignable.
    manque: ({ run }) => !run('gh', ['--version']).ok,
    poser: ({ run, budget }) => {
      const env = { ...process.env, DEBIAN_FRONTEND: 'noninteractive' }
      const maj = run('apt-get', ['update', '-qq'], { env, budget: Math.round(budget / 3) })
      const pose = run('apt-get', ['install', '-y', '-qq', 'gh'], { env, budget: budget - Math.round(budget / 3) })
      if (pose.ok) return pose
      return { ...pose, rapport: [maj.ok ? '' : `apt-get update : ${maj.rapport}`, pose.rapport].filter(Boolean).join(' — ') }
    },
    geste: 'apt-get update puis apt-get install -y gh',
    budget: 90,
  },
]

/** Budget de bout en bout du hook, en secondes : les constats de toute la table, plus les poses.
 *  C'est la valeur que le `timeout` déclaré aux surfaces doit couvrir — jamais un nombre recopié. */
export const BUDGET_TOTAL = PREREQUIS.reduce((somme, p) => somme + p.budget + BUDGET_CONSTAT, 0)

/**
 * Joue la table sur `contexte` et rend les lignes à écrire. Silence complet quand tout était déjà
 * en place : un conteneur conforme ne coûte pas de contexte à la session (#1728).
 */
export function mettreEnConformite(contexte, prerequis = PREREQUIS) {
  const lignes = []
  for (const p of prerequis) {
    if (!p.manque(contexte)) continue
    const vu = p.poser({ ...contexte, budget: p.budget })
    lignes.push(
      vu.ok
        ? `[conteneur] ${p.nom} : posé par \`${p.geste}\`.`
        : `[conteneur] ${p.nom} : MANQUANT, \`${p.geste}\` a échoué — ${vu.rapport}`,
    )
  }
  return lignes
}

export function bootstrap(env = process.env, racine = process.cwd(), run = lancer) {
  if (!estConteneurDistant(env)) return []
  return mettreEnConformite({ racine, run })
}

if (import.meta.main) {
  const lignes = bootstrap(process.env, process.env.CLAUDE_PROJECT_DIR || process.cwd())
  if (lignes.length) process.stdout.write(`${lignes.join('\n')}\n`)
}
