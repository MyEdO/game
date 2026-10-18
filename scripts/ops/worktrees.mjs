// INVENTAIRE DES WORKTREES — ce que git sait de chaque arbre lié, CLASSÉ, et une purge qui ne
// touche QUE ce qui ne peut rien perdre.
//
// Le danger d'un dépôt à trente worktrees n'est pas d'en garder un de trop : c'est d'en retirer un
// qui portait du travail. Le classement répond donc à UNE question par arbre — « que perdrait-on à
// le retirer ? » — et l'ordre de priorité est celui du RISQUE : principal (jamais), tenu par CE
// processus (le script y vit, ou son `cwd` en vient : il scierait sa branche), absent (déjà perdu,
// git n'a qu'à l'oublier), verrouillé (quelqu'un l'a dit), sale (des modifications non commitées),
// non inscrit peuplé (un dossier `.wt-*` que git ne nomme pas, et qui contient quelque chose),
// protégé, propre hors de `origin/main` (des commits que main n'a pas), propre et fusionné (rien à
// perdre), non inscrit vide (un dossier `.wt-*` vide que git ne nomme pas). #2603 constat 26
//
// L'outil se joue depuis N'IMPORTE QUEL worktree : les gestes prennent pour `cwd` l'arbre PRINCIPAL,
// premier bloc de `git worktree list --porcelain`.
//
// La purge n'emploie AUCUN geste forçant : `git worktree remove` sans `--force` refuse un arbre
// sale, `git branch -d` (minuscule) refuse une branche non fusionnée, `rmdir` non récursif refuse un
// dossier non vide. Ces trois refus sont la DERNIÈRE barrière — un `-f` ici ferait du classement le seul garde-fou, et un classement est
// faillible.
//
// Le verdict de fusion se lit contre `origin/main` APRÈS un `fetch` unique. S'il est indisponible,
// l'inventaire s'imprime SANS ce verdict et la purge REFUSE : on ne purge pas sur rien.
//
// Usage : `npm run ops:worktrees` (inventaire seul) ou `npm run ops:worktrees -- --purger`.
import { rmdirSync } from 'node:fs'
import { posix } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  TRONC, depotDe, elaguerWorktrees, estAncetre, etatDeLArbre, fetchOrigin, refusDeGit, retirerWorktree, reussi, supprimerBranche, worktreesDe,
} from '../guards/lib/gitPorte.mjs'
import { natureDuChemin } from '../guards/lib/natureDuChemin.mjs'
import { listerDossier } from '../guards/lib/lister.mjs'
import { mesurerProtectionWorktree } from '../guards/lib/protectionWorktree.mjs'
import { mesurerProcessusWorktrees } from '../guards/lib/processusWorktrees.mjs'
import { normaliserRacine } from '../port-dev.mjs'
import { PREFIXE_DE_CHANTIER } from './nomsDeChantier.mjs'

/** Racine de l'arbre qui porte CE script (le dépôt commun répond pour tous ses worktrees). */
export const RACINE = fileURLToPath(new URL('../..', import.meta.url))

/** Les classes, de la plus intouchable à la moins risquée. */
export const CLASSES = ['principal', 'tenu', 'absent', 'verrouillé', 'sale', 'non-inscrit+peuplé', 'protégé', 'propre+hors-main', 'propre+fusionné', 'non-inscrit+vide']

/**
 * Les arbres que CE processus TIENT, en forme comparable (`normaliserRacine`) : celui d'où vient le
 * script et celui qui contient le `cwd` du processus — le plus LONG chemin d'arbre qui préfixe ce
 * `cwd`, puisque les worktrees sont posés sous l'arbre principal. PURE.
 * @param {{worktrees: {chemin: string}[], racine?: string, cwd?: string}} params
 * @returns {Set<string>}
 */
export function arbresTenus({ worktrees = [], racine = RACINE, cwd = process.cwd() }) {
  const tenus = new Set([normaliserRacine(racine)])
  const ici = normaliserRacine(cwd)
  const porteurs = worktrees
    .map((w) => normaliserRacine(w.chemin))
    .filter((c) => ici === c || ici.startsWith(`${c}/`))
    .sort((a, b) => b.length - a.length)
  if (porteurs[0]) tenus.add(porteurs[0])
  return tenus
}

/**
 * Classe d'un worktree — l'ORDRE est celui du risque, et il est total : une combinaison ne peut pas
 * rendre deux classes. Un verdict de fusion INCONNU (`fusionne` nul) est traité comme « hors de
 * main » : la purge ne s'ouvre que sur un OUI mesuré. PURE.
 *
 * `tenu` vient juste après `principal` : un arbre que le processus courant occupe ne se retire pas
 * depuis lui-même — git refuse (`EPERM` sur le `.git` ouvert) ou réussit à moitié (worktree
 * désenregistré, dossier resté). `mesurerProtectionWorktree` mesure les autres processus.
 * `inscrit: false` : un dossier `.wt-*` que `git worktree list` ne nomme pas (#2603 constat 26).
 * @param {{principal?: boolean, sale?: boolean, fusionne?: boolean|null, verrouille?: boolean,
 *   absent?: boolean, protection?: {ok: boolean, refus: string[]}, chemin?: string, inscrit?: boolean,
 *   vide?: boolean}} etat
 * @param {{tenus?: Set<string>}} [opts] ensemble NORMALISÉ des arbres tenus par ce processus
 * @returns {'principal'|'tenu'|'absent'|'verrouillé'|'sale'|'non-inscrit+peuplé'|'protégé'|'propre+hors-main'|'propre+fusionné'|'non-inscrit+vide'}
 */
export function classerWorktree({ principal = false, sale = false, fusionne = null, verrouille = false, absent = false, protection, chemin = '', inscrit = true, vide = false }, { tenus } = {}) {
  if (principal) return 'principal'
  if (chemin && tenus?.has(normaliserRacine(chemin))) return 'tenu'
  if (absent) return 'absent'
  if (verrouille) return 'verrouillé'
  if (sale) return 'sale'
  if (!inscrit && !vide) return 'non-inscrit+peuplé'
  if (protection && !protection.ok) return 'protégé'
  if (!inscrit) return 'non-inscrit+vide'
  return fusionne === true ? 'propre+fusionné' : 'propre+hors-main'
}

/** Sha court d'un head porcelain. PURE. */
export const shaCourt = (head) => (head ? String(head).slice(0, 7) : '?')

/** Ce que la ligne d'inventaire nomme dans sa colonne « branche ». PURE. */
export const refDe = (w) => w.branche ?? (w.inscrit === false ? 'hors git' : `détaché@${shaCourt(w.head)}`)

/** LA raison — pourquoi on y touche, ou pourquoi on n'y touche pas. PURE. */
export function raisonDe(w) {
  if (w.protection && !w.protection.ok) return w.protection.refus.join(' ; ')
  switch (w.classe) {
    case 'principal': return 'arbre principal — jamais touché'
    case 'tenu': return 'tenu par ce processus (script ou cwd) — jamais retiré depuis lui : rejouer depuis un autre worktree'
    case 'absent': return `répertoire absent (${w.prunable ?? 'disparu du disque'}) — git worktree prune`
    case 'verrouillé': return `verrouillé${w.verrouillePour ? ` : ${w.verrouillePour}` : ''} — déverrouiller d'abord`
    case 'protégé': return w.protection.refus.join(' ; ')
    case 'sale': return 'modifications non commitées — rien ne se retire sous elles'
    case 'non-inscrit+peuplé': return w.illisible
      ? `dossier non inscrit illisible (${w.illisible}) — jamais touché`
      : 'dossier non inscrit et NON vide — jamais touché : il porte peut-être du travail'
    case 'non-inscrit+vide': return 'dossier non inscrit et vide — purgeable (rmdir)'
    case 'propre+hors-main': return w.fusionne === null
      ? 'verdict de fusion indisponible — origin/main non lu'
      : 'des commits que origin/main n’a pas — pas encore purgeable'
    default: return 'fusionné dans origin/main — purgeable'
  }
}

/** Les processus que la mesure n'a pas su lire, une fois pour tout l'inventaire (dédupliqués). PURE. */
export const indetermineesDe = (entrees) => [...new Set(entrees.flatMap((w) => w.protection?.indeterminees ?? []))]

/** Une ligne d'inventaire : `<classe>\t<chemin>\t<branche|détaché@sha>\t<raison>`. PURE. */
export const ligneDInventaire = (w) => [w.classe, w.chemin, refDe(w), raisonDe(w)].join('\t')

/** Compte par classe, dans l'ordre de `CLASSES`, classes vides omises. PURE. */
export function comptesParClasse(worktrees) {
  const comptes = {}
  for (const classe of CLASSES) {
    const n = worktrees.filter((w) => w.classe === classe).length
    if (n) comptes[classe] = n
  }
  return comptes
}

/** Les GESTES au dépôt de l'inventaire — ses questions et `fetchOrigin` —, ceux de l'hôte (`gitPorte.mjs`) : injectables (mesure). */
export const GESTES_DE_L_INVENTAIRE = Object.freeze({ worktreesDe, fetchOrigin, etatDeLArbre, estAncetre })

/** Les GESTES au dépôt de la purge — ses écrivains —, ceux de l'hôte : injectables (mesure). */
export const GESTES_DE_LA_PURGE = Object.freeze({ retirerWorktree, supprimerBranche, elaguerWorktrees, retirerDossierVide: rmdirSync })

/** `listerDossier`, qui rend `[]` sur un chemin absent. */
const listerOuRien = (chemin) => listerDossier(chemin, { absent: 'vide' })

/**
 * Les dossiers `<principal>/.wt-*` qu'aucun worktree inscrit ne couvre, CLASSÉS (#2603 constat 26).
 * `lister` lit le disque (injectable) : TOUTE entrée compte, les cachées comprises ; un dossier dont la
 * lecture échoue n'est pas vide ; un chemin absent (ENOENT) ne porte rien.
 * @param {{principal: string, inscrits: {chemin: string}[], tenus?: Set<string>, lister?: Function,
 *   nature?: Function}} params
 * @returns {{chemin: string, branche: null, head: null, inscrit: false, vide: boolean,
 *   illisible?: string, classe: string}[]}
 */
export function dossiersNonInscrits({ principal, inscrits, tenus, lister = listerOuRien, nature = natureDuChemin }) {
  const connus = new Set(inscrits.map((w) => normaliserRacine(w.chemin)))
  return lister(principal)
    .filter((nom) => nom.startsWith(PREFIXE_DE_CHANTIER))
    .map((nom) => posix.join(principal, nom))
    .filter((chemin) => !connus.has(normaliserRacine(chemin)) && nature(chemin) === 'repertoire')
    .map((chemin) => {
      let vide = false
      let illisible
      try { vide = lister(chemin).length === 0 } catch (e) { illisible = e.code ?? e.message }
      const etat = { chemin, branche: null, head: null, inscrit: false, vide, ...(illisible ? { illisible } : {}) }
      return { ...etat, classe: classerWorktree(etat, { tenus }) }
    })
}

/**
 * Inventaire classé des worktrees du dépôt qui contient `racine`. L'outil se joue depuis N'IMPORTE
 * QUEL worktree : `racine` ne sert qu'à INTERROGER git, et tous les gestes suivants prennent pour
 * `cwd` l'ARBRE PRINCIPAL — le premier worktree que rend `worktreesDe`, déjà absolu, donc aucun
 * second `rev-parse` ici. Les gestes au dépôt et la sonde de disque sont injectables (mesure).
 *
 * `sansFetch` : l'appelant a déjà fetché (ou refuse de fetcher) — aucun `fetchOrigin` ici, et
 * `fusionLue` vaut `true` même si `origin/main` manque : le verdict est lu sur les refs PRÉSENTES,
 * et un worktree sans verdict porte sa raison « origin/main non lu ». Seul `ops:worktrees` lit
 * `fusionLue` (garde de `--purger`), et il ne passe jamais `sansFetch`.
 * @param {{racine?: string, cwd?: string, gestes?: typeof GESTES_DE_L_INVENTAIRE, nature?: Function,
 *   sansFetch?: boolean}} [params]
 *
 * `nonInscrits` porte les dossiers `.wt-*` que git ne nomme pas (`dossiersNonInscrits`, sonde de
 * disque `lister`) ; `worktrees` reste ce que git nomme.
 * @returns {{ok: true, worktrees: object[], nonInscrits: object[], fusionLue: boolean, principal: string,
 *   tenus: Set<string>} | {ok: false, refus: string}}
 */
export function inventaire({
  racine = RACINE, cwd = process.cwd(), gestes = GESTES_DE_L_INVENTAIRE, nature = natureDuChemin, lister = listerOuRien, sansFetch = false, mesurer = mesurerProtectionWorktree, processus = mesurerProcessusWorktrees,
} = {}) {
  let bruts
  try {
    bruts = gestes.worktreesDe(depotDe(racine))
  } catch (e) {
    return { ok: false, refus: `git worktree list illisible : ${e.raison ?? e.message}` }
  }
  const principal = bruts?.[0]?.chemin
  if (!principal) return { ok: false, refus: 'git worktree list n’a rien rendu' }
  const tenus = arbresTenus({ worktrees: bruts, racine, cwd })

  const depot = depotDe(principal)
  const fusionLue = sansFetch || gestes.fetchOrigin(depot).disponible === true

  let snapshot
  try { snapshot = processus() } catch (e) { snapshot = { processus: [], erreurs: [e.message] } }
  const worktrees = bruts.map((w) => {
    if (w.principal) return { ...w, absent: false, sale: false, fusionne: null, classe: 'principal' }
    const absent = nature(w.chemin) !== 'repertoire'
    // Un arbre ILLISIBLE n'est pas propre : il ne se purge pas.
    let illisible = false
    const sale = !absent && (gestes.etatDeLArbre(depotDe(w.chemin, { enPanne: () => { illisible = true } })).length > 0 || illisible)
    let fusionne = null
    if (fusionLue && !absent && w.head) {
      const vu = gestes.estAncetre(depot, w.head, TRONC.suivi)
      fusionne = vu.disponible && !vu.absent ? vu.valeur === true : null
    }
    const protection = absent ? undefined : mesurer(w.chemin, { snapshot })
    const enrichi = { ...w, absent, sale, fusionne, protection }
    return { ...enrichi, classe: classerWorktree({ ...enrichi, principal: false }, { tenus }) }
  })

  let nonInscrits
  try {
    nonInscrits = dossiersNonInscrits({ principal, inscrits: bruts, tenus, lister, nature })
  } catch (e) {
    return { ok: false, refus: `arbre principal illisible : ${e.code ?? e.message}` }
  }

  return { ok: true, worktrees, nonInscrits, fusionLue, principal, tenus, portee: snapshot.portee }
}

/**
 * Retire les worktrees `propre+fusionné` et les dossiers `non-inscrit+vide`, et EUX SEULS — tous les
 * gestes joués depuis l'ARBRE PRINCIPAL (`principal`). Aucun geste forçant : les refus de git
 * (`remove` sans `--force`, `branch -d`) et de `rmdir` non récursif sont la dernière barrière.
 *
 * RE-MESURE : après les gestes, TOUT chemin tenté est re-sondé (`nature`), que son `remove` ait été
 * vert ou rouge. Un dossier ENCORE PRÉSENT est un geste `ÉCHEC` de plus, qui dit la main à mettre —
 * sans quoi la sortie annonce un retrait qui n'a pas eu lieu (cas mesuré : EPERM sur un arbre tenu ;
 * et un `remove` VERT peut laisser le dossier, un fichier restant tenu par un autre processus).
 * @param {{principal?: string, worktrees: object[], gestes?: typeof GESTES_DE_LA_PURGE, nature?: Function}} params
 * @returns {{chemin: string, geste: string, ok: boolean, detail: string}[]}
 */
export function purger({ principal = RACINE, worktrees, gestes = GESTES_DE_LA_PURGE, nature = natureDuChemin }) {
  const depot = depotDe(principal)
  const joues = []
  const rendu = (vu) => (reussi(vu)
    ? `code ${vu.valeur.status}${vu.valeur.stderr.trim() ? ` — ${vu.valeur.stderr.trim()}` : ''}`
    : refusDeGit(vu))
  const tentes = []

  for (const w of worktrees.filter((x) => x.classe === 'propre+fusionné')) {
    const vuRemove = gestes.retirerWorktree(depot, w.chemin)
    const removeOk = reussi(vuRemove)
    tentes.push({ chemin: w.chemin, branche: w.branche, ok: removeOk })
    joues.push({ chemin: w.chemin, geste: `git worktree remove ${w.chemin}`, ok: removeOk, detail: rendu(vuRemove) })
    if (!removeOk || nature(w.chemin) !== 'absent' || !w.branche) continue
    const vuBranche = gestes.supprimerBranche(depot, w.branche)
    joues.push({ chemin: w.chemin, geste: `git branch -d ${w.branche}`, ok: reussi(vuBranche), detail: rendu(vuBranche) })
  }
  // Un worktree `absent` (dossier disparu, `prunable`) suffit à justifier la taille : sans cela,
  // l'inventaire le répéterait à chaque passage tant qu'aucun retrait n'a lieu par ailleurs.
  if (tentes.every((t) => nature(t.chemin) === 'absent') && (joues.length || worktrees.some((w) => w.classe === 'absent'))) {
    const vuPrune = gestes.elaguerWorktrees(depot)
    joues.push({ chemin: principal, geste: 'git worktree prune', ok: reussi(vuPrune), detail: rendu(vuPrune) })
  }
  for (const t of tentes.filter((x) => nature(x.chemin) !== 'absent')) {
    joues.push({
      chemin: t.chemin,
      geste: `re-mesure ${t.chemin}`,
      ok: false,
      detail: t.ok
        ? `dossier présent, désinscrit de git : ${t.chemin}, branche ${t.branche ?? 'détachée'} conservée — l'inventaire suivant le classe non-inscrit+vide ou non-inscrit+peuplé`
        : `dossier présent : ${t.chemin}, branche ${t.branche ?? 'détachée'} conservée`,
    })
  }
  for (const d of worktrees.filter((x) => x.classe === 'non-inscrit+vide')) {
    try {
      gestes.retirerDossierVide(d.chemin)
      joues.push({ chemin: d.chemin, geste: `rmdir ${d.chemin}`, ok: true, detail: 'dossier vide retiré' })
    } catch (e) {
      joues.push({ chemin: d.chemin, geste: `rmdir ${d.chemin}`, ok: false, detail: `${e.code ?? 'erreur'} — ${e.message}` })
    }
  }
  return joues
}

function main() {
  const veutPurger = process.argv.slice(2).includes('--purger')
  const vu = inventaire({ racine: RACINE })
  if (!vu.ok) {
    process.stderr.write(`[worktrees] ${vu.refus}\n`)
    process.exit(1)
  }
  const entrees = [...vu.worktrees, ...vu.nonInscrits]
  const indeterminees = indetermineesDe(entrees)
  if (indeterminees.length) process.stdout.write(`mesure processus indéterminée — ${indeterminees.length} diagnostics de refus des arbres concernés :\n${indeterminees.map((i) => `  ${i}\n`).join('')}\n`)
  const horsMesure = [...new Set(entrees.flatMap((w) => w.protection?.horsMesure ?? []))]
  if (horsMesure.length) process.stdout.write(`processus sans preuve de lien, hors mesure — ${horsMesure.length} diagnostics :\n${horsMesure.map((i) => `  ${i}\n`).join('')}\n`)
  for (const w of entrees) process.stdout.write(`${ligneDInventaire(w)}\n`)
  if (vu.portee) process.stdout.write(vu.portee + '\n')
  const comptes = comptesParClasse(entrees)
  process.stdout.write(`\n${Object.entries(comptes).map(([c, n]) => `${c}=${n}`).join(' ')}\n`)
  if (!vu.fusionLue) process.stdout.write('origin/main non lu (fetch indisponible) : aucun verdict de fusion\n')

  if (!veutPurger) return
  if (!vu.fusionLue) {
    process.stderr.write('[worktrees] --purger refusé : origin/main n’a pas été lu, on ne purge pas sur rien.\n')
    process.exit(1)
  }
  const joues = purger({ principal: vu.principal, worktrees: entrees })
  if (!joues.length) process.stdout.write('rien à purger : aucun worktree propre+fusionné, aucun dossier non-inscrit+vide\n')
  for (const g of joues) process.stdout.write(`${g.ok ? 'ok' : 'ÉCHEC'}\t${g.geste}\t${g.detail}\n`)
  if (joues.some((g) => !g.ok)) process.exit(1)
}

if (import.meta.main) main()
