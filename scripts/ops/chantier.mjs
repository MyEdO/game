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
// Rien n'est jamais détruit : ni `--force`, ni suppression. Un équipement rouge (`npm ci`, `docs:build`)
// LAISSE le worktree et le dit — c'est un équipement qui manque, pas un chantier à défaire.
//
// Le principal se synchronise d'abord (`ouvrirChantier`, #2187).
//
// Usage : `npm run ops:chantier -- <nom> [--sans-ci]`, `nom` = numéro de ticket + slug optionnel.
import { spawnSync } from 'node:child_process'
import { etapeProfilee } from '../etape-profilee.mjs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ECRIT_LU } from '../gates/toutes.mjs'
import { GitIndisponible, TRONC, ajouterWorktree, arbrePrincipal, depotDe, fetchOrigin, natureDuChemin, reussi, shaDe } from '../guards/lib/gitPorte.mjs'
import { portDev, urlDev } from '../port-dev.mjs'
import { synchroniserPrincipal } from './synchroniser.mjs'

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

/** Les docs DÉRIVÉS, produits là où on les lit (#2203) : en DERNIER, sur un arbre équipé — les cibles de
 *  code sont déjà posées par le `postinstall` du `npm ci` racine. */
const EQUIPEMENT_DOCS = { args: ['run', 'docs:build'], ou: ' (docs dérivés)', relance: 'npm run docs:build' }

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
 * ÉQUIPEMENT d'un chantier neuf, dans l'ordre : la racine, PUIS ce que les gates exigent, PUIS les docs dérivés.
 * Trois termes, une frontière — dite ICI et nulle part ailleurs : un PRÉREQUIS est ce qu'une gate
 * déclare devoir trouver sous la racine (`prerequis` de `ECRIT_LU`, scripts/gates/toutes.mjs) ; un
 * ÉQUIPEMENT est le geste qui le pose ; l'OUTILLAGE LOCAL est ce que `resoudreOutilLocal`
 * (scripts/lancer-local.mjs) mesure à la racine, hors de cette table.
 * La liste est DÉRIVÉE d'`ECRIT_LU` : un prérequis ajouté là est posé ici sans second geste — sans
 * quoi un rejeu local (`npm run gates`) rendrait l'erreur brute de son outil sur un chantier que
 * `ops:chantier` ne sait pas équiper (mesuré le 2026-09-14 : `server:typecheck` rouge sur un
 * `server/node_modules` absent, après 881 s de gates en série).
 */
export const EQUIPEMENTS = [EQUIPEMENT_RACINE, ...equipementsDesPrerequis(ECRIT_LU), EQUIPEMENT_DOCS]

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

/** Les GESTES au dépôt de l'ouverture — ses questions et deux écrivains —, ceux de l'hôte (`gitPorte.mjs`) : injectables (mesure). */
export const GESTES_DU_CHANTIER = Object.freeze({ arbrePrincipal, shaDe, fetchOrigin, ajouterWorktree })

/**
 * Ouvre le chantier `nom` depuis `racine`. Les gestes au dépôt (`GESTES_DU_CHANTIER`) et `npm` sont
 * injectables (mesure).
 * @param {{racine?: string, nom: string, sansCi?: boolean, gestes?: typeof GESTES_DU_CHANTIER,
 *   npm?: Function}} params
 * @returns {{ok: true, cible: string, branche: string, base: string, resume: string, npmJoue: boolean}
 *   | {ok: false, refus: string, cible?: string, branche?: string}}
 */
export function creerChantier({ racine = RACINE, nom, sansCi = false, gestes = GESTES_DU_CHANTIER, npm = spawnSync, annoncer, horloge }) {
  const etape = (nomEtape, geste) => etapeProfilee(`[chantier] ${nomEtape}`, geste, { annoncer, horloge })
  if (!nomValide(nom)) {
    return { ok: false, refus: `nom de chantier invalide : « ${nom} » — forme attendue : ${FORME_DITE}` }
  }
  // L'ouverture se joue depuis N'IMPORTE QUEL worktree : la cible et tous les gestes git partent de
  // l'ARBRE PRINCIPAL, résolu par git (`arbrePrincipal`) — `.wt-<nom>` ne peut se poser que là.
  const vuPrincipal = gestes.arbrePrincipal(depotDe(racine))
  if (!vuPrincipal.disponible) return { ok: false, refus: `arbre principal introuvable : ${vuPrincipal.raison}` }
  const principal = vuPrincipal.valeur

  const cible = cibleDe(principal, nom)
  const branche = brancheDe(nom)

  const depot = depotDe(principal)
  let brancheExiste
  try {
    brancheExiste = gestes.shaDe(depot, `refs/heads/${branche}`) !== null
  } catch (e) {
    if (!(e instanceof GitIndisponible)) throw e
    return { ok: false, refus: `branche illisible : ${e.raison}` }
  }
  const cibleExiste = natureDuChemin(cible) !== 'absent'

  const refus = refusDeCreation({ cibleExiste, brancheExiste, nom, cible })
  if (refus) return { ok: false, refus, cible, branche }

  const vuFetch = etape('git fetch origin', () => gestes.fetchOrigin(depot))
  if (!vuFetch.disponible) {
    return { ok: false, refus: `origin non consultable, le chantier ne peut pas partir d'origin/main : ${vuFetch.raison}` }
  }

  const vuAdd = etape('git worktree add', () => gestes.ajouterWorktree(depot, { chemin: cible, branche, depuis: TRONC.suivi }))
  if (!vuAdd.disponible) return { ok: false, refus: `git worktree add a échoué : ${vuAdd.raison}`, cible, branche }
  if (!reussi(vuAdd)) {
    return { ok: false, refus: `git worktree add a échoué (code ${vuAdd.absent ? 'objet absent' : vuAdd.valeur.status})`, cible, branche }
  }

  const base = gestes.shaDe(depotDe(principal, { enPanne: () => {} }), TRONC.suivi, { court: true }) ?? 'inconnue'
  const resume = resumeDeChantier({ cible, branche, base, port: portDev(cible), url: urlDev(cible) })

  if (sansCi) return { ok: true, cible, branche, base, resume, npmJoue: false }

  // `shell: true` MESURÉ nécessaire : `spawnSync('npm.cmd', …, { shell: false })` rend
  // `EINVAL` sous Node v22.20.0 / win32 (mesure du 2026-09-14). Aucun argument ne porte d'espace,
  // et le `cwd` ne passe pas par la ligne de commande — il n'y a donc rien à citer.
  for (const { args, ou, relance } of EQUIPEMENTS) {
    const vuNpm = etape(`${relance}${ou}`, () => npm(process.platform === 'win32' ? 'npm.cmd' : 'npm', args, {
      cwd: cible, stdio: 'inherit', shell: true,
    }))
    if (vuNpm?.error || vuNpm?.status !== 0) {
      return {
        ok: false,
        cible,
        branche,
        refus: `worktree posé, ${/\bci$/.test(relance) ? 'npm ci' : relance} rouge${ou} — relancer \`${relance}\` dans ${cible}` +
          (vuNpm?.error ? ` (${vuNpm.error.message})` : ` (code ${vuNpm?.status})`),
      }
    }
  }
  return { ok: true, cible, branche, base, resume, npmJoue: true }
}

/** Les arguments de la ligne de commande qui portent `args` (`argumentsDe`). PURE. */
export const argvDe = ({ nom, sansCi }) => [nom, ...(sansCi ? ['--sans-ci'] : [])]

/**
 * La RELANCE de l'ouverture par `npm run ops:chantier -- <args>` depuis `cwd` (#2187, verdict
 * 6026872846 point 3) : le code du principal avancé. REND son code de sortie.
 * @param {{nom: string, sansCi: boolean}} args
 */
export function relancerChantier(args, { npm = spawnSync, cwd = RACINE } = {}) {
  const vu = npm(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'ops:chantier', '--', ...argvDe(args)], { cwd, stdio: 'inherit', shell: true })
  return vu?.error ? 1 : vu?.status ?? 1
}

/**
 * L'ouverture depuis la ligne de commande : le principal SYNCHRONISÉ d'abord (`synchroniserPrincipal`,
 * #2187) ; `avance` → `relancer(args)`, dont le code est rendu ; tout autre état est annoncé tel quel, une
 * exception à part, et le chantier se crée depuis `origin/main`. Un nom invalide ne synchronise rien. REND le code de sortie.
 * @param {{nom: string, sansCi: boolean}} args
 */
export async function ouvrirChantier(args, {
  synchroniser = () => synchroniserPrincipal({ depuis: RACINE, annoncer: (texte) => process.stderr.write(`${texte}\n`) }),
  relancer = relancerChantier,
  creer = creerChantier,
  dire = (texte) => process.stderr.write(texte),
  imprimer = (texte) => process.stdout.write(texte),
} = {}) {
  if (nomValide(args.nom)) {
    let vu = null
    try {
      vu = await synchroniser()
    } catch (e) {
      dire(`[chantier] synchronisation du principal en exception : ${/** @type {any} */ (e)?.message ?? e} ; le chantier part d’origin/main\n`)
    }
    if (vu?.etat === 'avance') {
      dire(`[chantier] principal avancé (${JSON.stringify(vu)}) : relance \`npm run ops:chantier -- ${argvDe(args).join(' ')}\`\n`)
      return relancer(args)
    }
    if (vu && vu.etat !== 'a-jour') dire(`[chantier] principal : ${JSON.stringify(vu)} ; le chantier part d’origin/main\n`)
  }
  const vu = creer(args)
  if (!vu.ok) {
    dire(`[chantier] ${vu.refus}\n`)
    return 1
  }
  imprimer(`${vu.resume}\n`)
  return 0
}

async function main() {
  const args = argumentsDe(process.argv.slice(2))
  if (!args) {
    process.stderr.write(`[chantier] usage : npm run ops:chantier -- ${FORME_DITE} [--sans-ci]\n`)
    return 1
  }
  return ouvrirChantier(args)
}

if (import.meta.main) process.exitCode = await main()
