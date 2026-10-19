// INVENTAIRE DES WORKTREES — ce que git sait de chaque arbre lié, CLASSÉ, et une purge qui ne
// touche QUE ce qui ne peut rien perdre.
//
// Le danger d'un dépôt à trente worktrees n'est pas d'en garder un de trop : c'est d'en retirer un
// qui portait du travail. Le classement répond donc à UNE question par arbre — « que perdrait-on à
// le retirer ? » — et l'ordre de priorité est celui du RISQUE : principal (jamais), tenu par CE
// processus (le script y vit, ou son `cwd` en vient : il scierait sa branche), absent (déjà perdu,
// git n'a qu'à l'oublier), verrouillé (quelqu'un l'a dit), sale (des modifications non commitées),
// non inscrit peuplé (un dossier `.wt-*` que git ne nomme pas, et qui contient quelque chose),
// protégé, à demi retiré (dossier présent, fichier `.git` parti : un `worktree remove` interrompu,
// lu par son dossier d'administration et propre hors des suivis supprimés), propre hors de
// `origin/main` (des commits que main n'a pas), propre et fusionné (rien à perdre), non inscrit vide
// (un dossier `.wt-*` vide que git ne nomme pas). #2603 constat 26
//
// L'outil se joue depuis N'IMPORTE QUEL worktree : les gestes prennent pour `cwd` l'arbre PRINCIPAL,
// premier bloc de `git worktree list --porcelain`.
//
// La purge n'emploie AUCUN geste forçant : `git worktree remove` sans `--force` refuse un arbre
// sale, `git branch -d` (minuscule) refuse une branche non fusionnée, `rmdir` non récursif refuse un
// dossier non vide. Ces trois refus sont la DERNIÈRE barrière — un `-f` ici ferait du classement le seul garde-fou, et un classement est
// faillible. Un arbre à demi retiré est relié puis restauré par `retirerWorktree`, sans forcer non plus.
// `git worktree prune` ne se cible pas : il ne se joue que si aucun inscrit qu'il désinscrirait n'y
// perd quelque chose (`pertesDeLElagage`).
//
// Chaque geste s'imprime DÈS qu'il commence et dès qu'il finit, avec sa durée : une purge coupée
// garde la trace de ce qu'elle a joué.
//
// Le verdict de fusion se lit contre `origin/main` APRÈS un `fetch` unique. S'il est indisponible,
// l'inventaire s'imprime SANS ce verdict et la purge REFUSE : on ne purge pas sur rien.
//
// Usage : `npm run ops:worktrees` (inventaire seul) ou `npm run ops:worktrees -- --purger`.
import { rmdirSync, writeSync } from 'node:fs'
import { join, posix } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  TRONC, depotDe, dossierGitCommun, elaguerWorktrees, estAncetre, etatDeLArbre, fetchOrigin, refusDeGit, retirerWorktree, reussi, supprimerBranche, worktreesDe,
} from '../guards/lib/gitPorte.mjs'
import { natureDuChemin } from '../guards/lib/natureDuChemin.mjs'
import { listerDossier } from '../guards/lib/lister.mjs'
import { depotDeLArbre, horsSuppressions, mesurerProtectionWorktree } from '../guards/lib/protectionWorktree.mjs'
import { DELAI_MESURE_PROCESSUS_MS, mesurerProcessusWorktrees } from '../guards/lib/processusWorktrees.mjs'
import { normaliserRacine } from '../port-dev.mjs'
import { PREFIXE_DE_CHANTIER } from './nomsDeChantier.mjs'

/** Racine de l'arbre qui porte CE script (le dépôt commun répond pour tous ses worktrees). */
export const RACINE = fileURLToPath(new URL('../..', import.meta.url))

/** Les classes, de la plus intouchable à la moins risquée. */
export const CLASSES = ['principal', 'tenu', 'absent', 'verrouillé', 'sale', 'non-inscrit+peuplé', 'protégé', 'à-demi-retiré', 'propre+hors-main', 'propre+fusionné', 'non-inscrit+vide']

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
 * `demiRetire` : dossier présent sans fichier `.git`, que git dit `prunable`, et lu par son dossier
 * d'administration (`depotDeLArbre`) : sale ou protégé, il l'est comme les autres ; propre, il est
 * `à-demi-retiré`, et le reste du classement (fusion) dit s'il se purge.
 * @param {{principal?: boolean, sale?: boolean, fusionne?: boolean|null, verrouille?: boolean,
 *   absent?: boolean, protection?: {ok: boolean, refus: string[]}, chemin?: string, inscrit?: boolean,
 *   vide?: boolean, demiRetire?: boolean}} etat
 * @param {{tenus?: Set<string>}} [opts] ensemble NORMALISÉ des arbres tenus par ce processus
 * @returns {'principal'|'tenu'|'absent'|'verrouillé'|'à-demi-retiré'|'sale'|'non-inscrit+peuplé'|'protégé'|'propre+hors-main'|'propre+fusionné'|'non-inscrit+vide'}
 */
export function classerWorktree({ principal = false, sale = false, fusionne = null, verrouille = false, absent = false, protection, chemin = '', inscrit = true, vide = false, demiRetire = false }, { tenus } = {}) {
  if (principal) return 'principal'
  if (chemin && tenus?.has(normaliserRacine(chemin))) return 'tenu'
  if (absent) return 'absent'
  if (verrouille) return 'verrouillé'
  if (sale) return 'sale'
  if (!inscrit && !vide) return 'non-inscrit+peuplé'
  if (protection && !protection.ok) return 'protégé'
  if (!inscrit) return 'non-inscrit+vide'
  if (demiRetire) return 'à-demi-retiré'
  return fusionne === true ? 'propre+fusionné' : 'propre+hors-main'
}

/** Sha court d'un head porcelain. PURE. */
export const shaCourt = (head) => (head ? String(head).slice(0, 7) : '?')

/** Ce que la ligne d'inventaire nomme dans sa colonne « branche ». PURE. */
export const refDe = (w) => w.branche ?? (w.inscrit === false ? 'hors git' : `détaché@${shaCourt(w.head)}`)

/** LA raison — pourquoi on y touche, ou pourquoi on n'y touche pas. PURE. */
export function raisonDe(w, options) {
  const raison = raisonDeLaClasse(w, options)
  return w.demiRetire ? `à demi retiré (${w.prunable ?? 'fichier .git absent'}) — ${raison}` : raison
}

/** Un arbre est PURGEABLE propre et fusionné, ou à demi retiré et fusionné. PURE. */
export const estPurgeable = (w) => w.classe === 'propre+fusionné' || (w.classe === 'à-demi-retiré' && w.fusionne === true)

/** Une entrée ABSENTE s'élague sans perte : sa branche, ou origin/main, tient son commit. PURE. */
export const estElagable = (w) => w.classe === 'absent' && Boolean(w.branche || w.fusionne === true)

function raisonDeLaClasse(w, { details = true } = {}) {
  if (w.protection && !w.protection.ok) {
    if (details) return w.protection.refus.join(' ; ')
    const diagnostics = new Set(w.protection.indeterminees ?? [])
    return [...w.protection.refus.filter((r) => !diagnostics.has(r)), ...(diagnostics.size ? ['mesure processus indéterminée — diagnostics cités à part'] : [])].join(' ; ')
  }
  switch (w.classe) {
    case 'principal': return 'arbre principal — jamais touché'
    case 'tenu': return 'tenu par ce processus (script ou cwd) — jamais retiré depuis lui : rejouer depuis un autre worktree'
    case 'absent': return `répertoire absent (${w.prunable ?? 'disparu du disque'}) — ${estElagable(w)
      ? 'git worktree prune'
      : `commit détaché que origin/main n’a pas (${w.fusionne === null ? 'verdict de fusion indisponible' : 'hors main'}) — jamais élagué : prune le perdrait`}`
    case 'verrouillé': return `verrouillé${w.verrouillePour ? ` : ${w.verrouillePour}` : ''} — déverrouiller d'abord`
    case 'protégé': return w.protection.refus.join(' ; ')
    case 'sale': return w.illisible
      ? `arbre illisible (${w.illisible}) — jamais touché`
      : 'modifications non commitées — rien ne se retire sous elles'
    case 'non-inscrit+peuplé': return w.illisible
      ? `dossier non inscrit illisible (${w.illisible}) — jamais touché`
      : 'dossier non inscrit et NON vide — jamais touché : il porte peut-être du travail'
    case 'non-inscrit+vide': return 'dossier non inscrit et vide — purgeable (rmdir)'
    case 'à-demi-retiré': if (estPurgeable(w)) return 'purgeable : son .git recréé, ses suivis supprimés restaurés, puis retiré'
    // falls through
    case 'propre+hors-main': return w.fusionne === null
      ? 'verdict de fusion indisponible — origin/main non lu'
      : 'des commits que origin/main n’a pas — pas encore purgeable'
    default: return 'fusionné dans origin/main — purgeable'
  }
}

/** Les processus que la mesure n'a pas su lire, une fois pour tout l'inventaire (dédupliqués). PURE. */
export const indetermineesDe = (entrees) => [...new Set(entrees.flatMap((w) => w.protection?.indeterminees ?? []))]

/** Une ligne d'inventaire : `<classe>\t<chemin>\t<branche|détaché@sha>\t<raison>`. PURE. */
export const ligneDInventaire = (w) => [w.classe, w.chemin, refDe(w), raisonDe(w, { details: false })].join('\t')

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
export const GESTES_DE_L_INVENTAIRE = Object.freeze({ worktreesDe, fetchOrigin, etatDeLArbre, estAncetre, dossierGitCommun })

/** Les GESTES au dépôt de la purge — ses écrivains et les questions de `pertesDeLElagage` —, ceux de l'hôte : injectables (mesure). */
export const GESTES_DE_LA_PURGE = Object.freeze({ retirerWorktree, supprimerBranche, elaguerWorktrees, retirerDossierVide: rmdirSync, worktreesDe, estAncetre })

/**
 * Ce que `git worktree prune` PERDRAIT, relu à l'instant du geste : il désinscrit TOUT inscrit
 * `prunable` non verrouillé, sans cible (`git help worktree`, « prune »). Un dossier encore présent
 * (à demi retiré) perdrait son inscription ; un commit détaché que `origin/main` n'a pas, la seule
 * référence qui le tient. Vide : le geste ne perd rien.
 * @param {object} depot @param {{gestes?: typeof GESTES_DE_LA_PURGE, nature?: Function}} [params]
 * @returns {string[]}
 */
export function pertesDeLElagage(depot, { gestes = GESTES_DE_LA_PURGE, nature = natureDuChemin } = {}) {
  let inscrits
  try { inscrits = gestes.worktreesDe(depot) } catch (e) { return [`git worktree list illisible : ${e.raison ?? e.message}`] }
  if (!inscrits) return ['git worktree list illisible']
  return inscrits.filter((w) => w.prunable && !w.verrouille).flatMap((w) => {
    if (nature(w.chemin) !== 'absent') return [`${w.chemin} : dossier présent`]
    if (w.branche) return []
    const vu = w.head ? gestes.estAncetre(depot, w.head, TRONC.suivi) : { disponible: false }
    return vu.disponible && !vu.absent && vu.valeur === true ? [] : [`${w.chemin} : détaché@${shaCourt(w.head)} que origin/main n’a pas`]
  })
}

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
  try { snapshot = processus({ timeout: DELAI_MESURE_PROCESSUS_MS }) } catch (e) { snapshot = { processus: [], erreurs: [e] } }
  let commun
  const communDuDepot = () => {
    if (commun === undefined) {
      const lu = gestes.dossierGitCommun(depot)
      commun = lu.disponible ? lu.valeur : null
    }
    return commun ?? undefined
  }
  const worktrees = bruts.map((w) => {
    if (w.principal) return { ...w, absent: false, sale: false, fusionne: null, classe: 'principal' }
    const absent = nature(w.chemin) !== 'repertoire'
    // Sans son `.git`, git répondrait pour le dépôt PARENT : l'arbre se lit par son dossier
    // d'administration (`depotDeLArbre`), s'il est à demi retiré — que git le dise `prunable` ; sinon
    // il reste illisible.
    const sansGit = !absent && nature(join(w.chemin, '.git')) === 'absent'
    const demiRetire = sansGit && Boolean(w.prunable)
    // Un arbre ILLISIBLE n'est pas propre : il ne se purge pas.
    let illisible = sansGit && !demiRetire ? 'fichier .git absent, que git ne dit pas prunable' : null
    let sale = Boolean(illisible)
    if (!absent && !illisible) {
      try {
        const etat = gestes.etatDeLArbre(depotDeLArbre(w.chemin, sansGit ? communDuDepot() : undefined, { enPanne: () => { illisible = 'git en panne sur son dossier' } }))
        sale = (demiRetire ? horsSuppressions(etat) : etat).length > 0 || Boolean(illisible)
      } catch (e) {
        illisible = e.message
        sale = true
      }
    }
    let fusionne = null
    if (fusionLue && w.head) {
      const vu = gestes.estAncetre(depot, w.head, TRONC.suivi)
      fusionne = vu.disponible && !vu.absent ? vu.valeur === true : null
    }
    const protection = absent ? undefined : mesurer(w.chemin, { snapshot, ...(sansGit && communDuDepot() ? { commun: communDuDepot() } : {}) })
    const enrichi = { ...w, absent, demiRetire, sale, fusionne, protection, ...(illisible ? { illisible } : {}) }
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
 *
 * `signaler(g)` reçoit chaque geste DEUX fois : à son début (`ok: null`), puis joué, avec sa durée.
 * @param {{principal?: string, worktrees: object[], gestes?: typeof GESTES_DE_LA_PURGE, nature?: Function,
 *   signaler?: (g: {chemin: string, geste: string, ok: boolean|null, detail?: string, dureeMs?: number}) => void}} params
 * @returns {{chemin: string, geste: string, ok: boolean, detail: string, dureeMs: number}[]}
 */
export function purger({ principal = RACINE, worktrees, gestes = GESTES_DE_LA_PURGE, nature = natureDuChemin, signaler = () => {} }) {
  const depot = depotDe(principal)
  const joues = []
  const jouer = (chemin, geste, faire) => {
    signaler({ chemin, geste, ok: null })
    const debut = performance.now()
    const { ok, detail } = faire()
    const joue = { chemin, geste, ok, detail, dureeMs: Math.round(performance.now() - debut) }
    joues.push(joue)
    signaler(joue)
    return ok
  }
  const rendu = (vu) => ({
    ok: reussi(vu),
    detail: reussi(vu) ? `code ${vu.valeur.status}${vu.valeur.stderr.trim() ? ` — ${vu.valeur.stderr.trim()}` : ''}` : refusDeGit(vu),
  })
  const tentes = []

  for (const w of worktrees.filter(estPurgeable)) {
    const geste = `${w.demiRetire ? 'relier .git, checkout-index, ' : ''}git worktree remove ${w.chemin}`
    const removeOk = jouer(w.chemin, geste, () => rendu(gestes.retirerWorktree(depot, w.chemin)))
    tentes.push({ chemin: w.chemin, branche: w.branche, ok: removeOk })
    if (!removeOk || nature(w.chemin) !== 'absent' || !w.branche) continue
    jouer(w.chemin, `git branch -d ${w.branche}`, () => rendu(gestes.supprimerBranche(depot, w.branche)))
  }
  // Un `remove` vert efface lui-même l'inscription : seuls un `remove` rouge au dossier parti, ou une
  // entrée absente élagable sans perte, justifient la taille — jamais un `absent` qu'elle perdrait.
  if (tentes.every((t) => nature(t.chemin) === 'absent') && (tentes.some((t) => !t.ok) || worktrees.some(estElagable))) {
    jouer(principal, 'git worktree prune', () => {
      const pertes = pertesDeLElagage(depot, { gestes, nature })
      return pertes.length ? { ok: false, detail: `non joué, il désinscrirait en perdant : ${pertes.join(' ; ')}` } : rendu(gestes.elaguerWorktrees(depot))
    })
  }
  for (const t of tentes.filter((x) => nature(x.chemin) !== 'absent')) {
    jouer(t.chemin, `re-mesure ${t.chemin}`, () => ({
      ok: false,
      detail: t.ok
        ? `dossier présent, désinscrit de git : ${t.chemin}, branche ${t.branche ?? 'détachée'} conservée — l'inventaire suivant le classe non-inscrit+vide ou non-inscrit+peuplé`
        : `dossier présent : ${t.chemin}, branche ${t.branche ?? 'détachée'} conservée`,
    }))
  }
  for (const d of worktrees.filter((x) => x.classe === 'non-inscrit+vide')) {
    jouer(d.chemin, `rmdir ${d.chemin}`, () => {
      try {
        gestes.retirerDossierVide(d.chemin)
        return { ok: true, detail: 'dossier vide retiré' }
      } catch (e) { return { ok: false, detail: `${e.code ?? 'erreur'} — ${e.message}` } }
    })
  }
  return joues
}

/** La ligne d'un geste signalé par `purger` : `en cours` à son début, puis son verdict et sa durée. PURE. */
export const ligneDeGeste = (g) => (g.ok === null
  ? `en cours\t${g.geste}\n`
  : `${g.ok ? 'ok' : 'ÉCHEC'}\t${g.geste}\t${g.dureeMs} ms\t${g.detail}\n`)

/**
 * L'inventaire imprimé, puis la purge sous `--purger`. Rend le code de sortie.
 * `dire` et `crier` écrivent en SYNCHRONE : la purge ne rend jamais la main à la boucle d'événements,
 * et un arrêt en cours perdrait les écritures en attente.
 */
export function main({
  argv = process.argv.slice(2),
  racine = RACINE,
  inventorier = inventaire,
  purge = purger,
  dire = (texte) => writeSync(1, texte),
  crier = (texte) => writeSync(2, texte),
} = {}) {
  const veutPurger = argv.includes('--purger')
  const vu = inventorier({ racine })
  if (!vu.ok) {
    crier(`[worktrees] ${vu.refus}\n`)
    return 1
  }
  const entrees = [...vu.worktrees, ...vu.nonInscrits]
  const indeterminees = indetermineesDe(entrees)
  if (indeterminees.length) dire(`mesure processus indéterminée — ${indeterminees.length} diagnostics de refus des arbres concernés :\n${indeterminees.map((i) => `  ${i}\n`).join('')}\n`)
  const horsMesure = [...new Set(entrees.flatMap((w) => w.protection?.horsMesure ?? []))]
  if (horsMesure.length) dire(`processus sans preuve de lien, hors mesure — ${horsMesure.length} diagnostics :\n${horsMesure.map((i) => `  ${i}\n`).join('')}\n`)
  for (const w of entrees) dire(`${ligneDInventaire(w)}\n`)
  if (vu.portee) dire(vu.portee + '\n')
  const comptes = comptesParClasse(entrees)
  dire(`\n${Object.entries(comptes).map(([c, n]) => `${c}=${n}`).join(' ')}\n`)
  if (!vu.fusionLue) dire('origin/main non lu (fetch indisponible) : aucun verdict de fusion\n')

  if (!veutPurger) return 0
  if (!vu.fusionLue) {
    crier('[worktrees] --purger refusé : origin/main n’a pas été lu, on ne purge pas sur rien.\n')
    return 1
  }
  const joues = purge({ principal: vu.principal, worktrees: entrees, signaler: (g) => dire(ligneDeGeste(g)) })
  if (!joues.length) dire('rien à purger : aucun worktree propre+fusionné ou à demi retiré et fusionné, aucun dossier non-inscrit+vide\n')
  return joues.some((g) => !g.ok) ? 1 : 0
}

if (import.meta.main) process.exit(main())
