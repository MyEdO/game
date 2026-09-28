// OUVERTURE D'UN CHANTIER — le geste que chaque session recodait au scratchpad : poser un worktree
// lié `.wt-<nom>` sur une branche `chantier/<nom>` issue d'`origin/main`, puis l'équiper.
//
// Pourquoi un outil du dépôt et pas trois lignes de shell : les façons de se tromper sont TOUJOURS
// les mêmes, et aucune ne se voit tout de suite — partir de `HEAD` au lieu d'`origin/main` (le
// chantier naît en retard) et réutiliser un nom déjà pris (la branche existe : `git worktree add -b`
// rend un message que personne ne relit). Chaque refus est donc NOMMÉ ici, une fois, et le cas
// « cible déjà là » se distingue du cas « branche déjà là » : ce ne sont pas les mêmes gestes de sortie.
//
// La troisième — poser le worktree SOUS un worktree, que `scripts/guards/lib/arbreImbrique.mjs`
// refuse ensuite au commit — est hors de portée : la cible et tous les gestes git partent de l'arbre
// PRINCIPAL résolu par git (`arbrePrincipal`), d'où que l'outil soit lancé.
//
// Rien n'est jamais détruit : ni `--force`, ni suppression. Un `npm ci` rouge LAISSE le worktree et
// le dit — c'est un équipement qui manque, pas un chantier à défaire.
//
// Usage : `npm run ops:chantier -- <nom> [--sans-ci]`, `nom` = numéro de ticket + slug optionnel.
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ECRIT_LU } from '../gates/toutes.mjs'
import { arbrePrincipal, fetchOrigin, lireGit, natureDuChemin, sortieOuNull } from '../guards/lib/gitPorte.mjs'
import { portDev, urlDev } from '../port-dev.mjs'

/** Racine de l'arbre qui porte CE script. */
export const RACINE = fileURLToPath(new URL('../..', import.meta.url))

/** Forme d'un nom de chantier : un numéro de ticket, puis un slug optionnel en minuscules. */
export const FORME_NOM = /^\d+(-[a-z0-9]+(-[a-z0-9]+)*)?$/

/** Ce que le refus de forme AFFICHE : la règle, pas le regex. */
export const FORME_DITE = '<numéro de ticket>[-slug-en-minuscules] (ex. « 1736 », « 1732-1734-outillage »)'

/** `true` si `nom` a la forme attendue. PURE. */
export const nomValide = (nom) => typeof nom === 'string' && FORME_NOM.test(nom)

/**
 * Arguments de la ligne de commande. PURE.
 * @param {string[]} argv arguments APRÈS `node script.mjs`
 * @returns {{nom: string, sansCi: boolean}|null} `null` si aucun nom n'est donné.
 */
export function argumentsDe(argv) {
  const args = [...(argv ?? [])]
  const sansCi = args.includes('--sans-ci')
  const nom = args.filter((a) => !a.startsWith('--'))[0]
  return nom === undefined ? null : { nom, sansCi }
}

/**
 * La raison de ne PAS créer ce chantier, ou `null`. Les deux collisions se disent DISTINCTEMENT :
 * un worktree déjà posé se rejoint, une branche déjà là se reprend ou se renomme. PURE.
 * @param {{cibleExiste: boolean, brancheExiste: boolean, nom: string, cible: string}} etat
 * @returns {string|null}
 */
export function refusDeCreation({ cibleExiste, brancheExiste, nom, cible }) {
  const branche = brancheDe(nom)
  if (cibleExiste && brancheExiste) {
    return `chantier « ${nom} » déjà ouvert : le worktree ${cible} ET la branche ${branche} existent — ` +
      'travaille dedans, ou choisis un autre nom.'
  }
  if (cibleExiste) {
    return `le chemin ${cible} existe déjà (worktree posé, ou dossier resté là) — ` +
      'travaille dedans, ou retire-le à la main avant de recommencer.'
  }
  if (brancheExiste) {
    return `la branche ${branche} existe déjà — reprends-la (\`git worktree add ${cible} ${branche}\`), ` +
      'ou choisis un autre nom.'
  }
  return null
}

/** Drapeaux de silence joués sur CHAQUE `npm ci` d'équipement : ni audit, ni quête de financement. */
const FLAGS_CI = ['--no-audit', '--no-fund']

/** L'équipement de la RACINE, fixe : aucune gate ne déclare `node_modules` racine en prérequis
 *  (c'est `resoudreOutilLocal` qui le mesure), et il précède tout sous-projet. */
const EQUIPEMENT_RACINE = { args: ['ci', ...FLAGS_CI], ou: '', relance: 'npm ci' }

/**
 * Les ÉQUIPEMENTS d'un prérequis déclaré. PURE.
 * Un `pose` est une commande `npm …` : ses mots après `npm` deviennent l'`args` (plus `FLAGS_CI`),
 * `ou` se déduit de `--prefix <dossier>`, et `relance` est le `pose` VERBATIM — ce que le refus dit
 * de rejouer. Deux gates qui déclarent le MÊME `pose` ne posent qu'UNE fois, dans l'ordre
 * d'apparition. Un `pose` qui ne commence pas par `npm ` JETTE : l'équipement ne sait jouer que npm,
 * et une commande normalisée en silence poserait autre chose que ce que la gate exige.
 * @param {Record<string, {prerequis?: {chemin: string, pose: string}[]}>} ecritLu table mesurée
 * @returns {{args: string[], ou: string, relance: string}[]}
 */
export function equipementsDesPrerequis(ecritLu) {
  const parPose = new Map()
  for (const [gate, entree] of Object.entries(ecritLu ?? {})) {
    for (const prerequis of entree?.prerequis ?? []) {
      const pose = prerequis?.pose
      if (typeof pose !== 'string' || !pose.startsWith('npm ')) {
        throw new Error(
          `prérequis non posable : la gate « ${gate} » déclare \`pose: ${JSON.stringify(pose)}\`, ` +
            "qui ne commence pas par `npm ` — l'ouverture d'un chantier ne joue que npm.",
        )
      }
      const mots = pose.slice('npm '.length).trim().split(/\s+/)
      const prefixe = mots.indexOf('--prefix')
      parPose.set(pose, {
        args: [...mots, ...FLAGS_CI],
        ou: prefixe >= 0 && mots[prefixe + 1] ? ` dans ${mots[prefixe + 1]}/` : '',
        relance: pose,
      })
    }
  }
  return [...parPose.values()]
}

/**
 * ÉQUIPEMENT d'un chantier neuf, dans l'ordre : la racine, PUIS ce que les gates exigent.
 * Trois termes, une frontière — dite ICI et nulle part ailleurs : un PRÉREQUIS est ce qu'une gate
 * déclare devoir trouver sous la racine (`prerequis` de `ECRIT_LU`, scripts/gates/toutes.mjs) ; un
 * ÉQUIPEMENT est le geste qui le pose ; l'OUTILLAGE LOCAL est ce que `resoudreOutilLocal`
 * (scripts/lancer-local.mjs) mesure à la racine, hors de cette table.
 * La liste est DÉRIVÉE d'`ECRIT_LU` : un prérequis ajouté là est posé ici sans second geste — sans
 * quoi un rejeu local (`npm run gates`) rendrait l'erreur brute de son outil sur un chantier que
 * `ops:chantier` ne sait pas équiper (mesuré le 2026-09-14 : `server:typecheck` rouge sur un
 * `server/node_modules` absent, après 881 s de gates en série).
 */
export const EQUIPEMENTS = [EQUIPEMENT_RACINE, ...equipementsDesPrerequis(ECRIT_LU)]

/** Nom de branche d'un chantier. PURE. */
export const brancheDe = (nom) => `chantier/${nom}`

/** Chemin du worktree d'un chantier dans `racine`. PURE (hors `join`). */
export const cibleDe = (racine, nom) => join(racine, `.wt-${nom}`)

/**
 * Ce que l'ouverture IMPRIME en fin : les quatre faits dont la session a besoin tout de suite. PURE.
 * @param {{cible: string, branche: string, base: string, port: number, url?: string}} chantier
 */
export function resumeDeChantier({ cible, branche, base, port, url }) {
  return [
    `worktree=${cible}`,
    `branche=${branche}`,
    `base=${base}`,
    `port=${port} (${url ?? `http://localhost:${port}/`})`,
  ].join('\n')
}

/**
 * Ouvre le chantier `nom` depuis `racine`. `git`, `fetch` et `npm` sont injectables (mesure).
 * @param {{racine?: string, nom: string, sansCi?: boolean, git?: Function, fetch?: Function,
 *   npm?: Function}} params
 * @returns {{ok: true, cible: string, branche: string, base: string, resume: string, npmJoue: boolean}
 *   | {ok: false, refus: string, cible?: string, branche?: string}}
 */
export function creerChantier({ racine = RACINE, nom, sansCi = false, git = lireGit, fetch = fetchOrigin, npm = spawnSync }) {
  if (!nomValide(nom)) {
    return { ok: false, refus: `nom de chantier invalide : « ${nom} » — forme attendue : ${FORME_DITE}` }
  }
  // L'ouverture se joue depuis N'IMPORTE QUEL worktree : la cible et tous les gestes git partent de
  // l'ARBRE PRINCIPAL, résolu par git (`arbrePrincipal`) — `.wt-<nom>` ne peut se poser que là.
  const vuPrincipal = arbrePrincipal(racine)
  if (!vuPrincipal.disponible) return { ok: false, refus: `arbre principal introuvable : ${vuPrincipal.raison}` }
  const principal = vuPrincipal.valeur

  const cible = cibleDe(principal, nom)
  const branche = brancheDe(nom)

  const vuBranche = git(['rev-parse', '--verify', '--quiet', `refs/heads/${branche}`], { cwd: principal, site: 'git rev-parse' })
  if (!vuBranche.disponible) return { ok: false, refus: `branche illisible : ${vuBranche.raison}` }
  const brancheExiste = !vuBranche.absent && vuBranche.valeur.status === 0
  const cibleExiste = natureDuChemin(cible) !== 'absent'

  const refus = refusDeCreation({ cibleExiste, brancheExiste, nom, cible })
  if (refus) return { ok: false, refus, cible, branche }

  const vuFetch = fetch({ cwd: principal })
  if (!vuFetch.disponible) {
    return { ok: false, refus: `origin non consultable, le chantier ne peut pas partir d'origin/main : ${vuFetch.raison}` }
  }

  const vuAdd = git(['worktree', 'add', '-b', branche, cible, 'origin/main'], { cwd: principal, site: 'git worktree add' })
  if (!vuAdd.disponible) return { ok: false, refus: `git worktree add a échoué : ${vuAdd.raison}`, cible, branche }
  if (vuAdd.absent || vuAdd.valeur.status !== 0) {
    return { ok: false, refus: `git worktree add a échoué (code ${vuAdd.absent ? 'objet absent' : vuAdd.valeur.status})`, cible, branche }
  }

  const base = (sortieOuNull(git(['rev-parse', '--short', 'origin/main'], { cwd: principal, site: 'git rev-parse' })) ?? '').trim() || 'inconnue'
  const resume = resumeDeChantier({ cible, branche, base, port: portDev(cible), url: urlDev(cible) })

  if (sansCi) return { ok: true, cible, branche, base, resume, npmJoue: false }

  // `shell: true` MESURÉ nécessaire : `spawnSync('npm.cmd', …, { shell: false })` rend
  // `EINVAL` sous Node v22.20.0 / win32 (mesure du 2026-09-14). Aucun argument ne porte d'espace,
  // et le `cwd` ne passe pas par la ligne de commande — il n'y a donc rien à citer.
  for (const { args, ou, relance } of EQUIPEMENTS) {
    const vuNpm = npm(process.platform === 'win32' ? 'npm.cmd' : 'npm', args, {
      cwd: cible, stdio: 'inherit', shell: true,
    })
    if (vuNpm?.error || vuNpm?.status !== 0) {
      return {
        ok: false,
        cible,
        branche,
        refus: `worktree posé, npm ci rouge${ou} — relancer \`${relance}\` dans ${cible}` +
          (vuNpm?.error ? ` (${vuNpm.error.message})` : ` (code ${vuNpm?.status})`),
      }
    }
  }
  return { ok: true, cible, branche, base, resume, npmJoue: true }
}

function main() {
  const args = argumentsDe(process.argv.slice(2))
  if (!args) {
    process.stderr.write(`[chantier] usage : npm run ops:chantier -- ${FORME_DITE} [--sans-ci]\n`)
    process.exit(1)
  }
  const vu = creerChantier(args)
  if (!vu.ok) {
    process.stderr.write(`[chantier] ${vu.refus}\n`)
    process.exit(1)
  }
  process.stdout.write(`${vu.resume}\n`)
}

if (import.meta.main) main()
