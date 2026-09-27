// LA REVUE DE PALIER — comment elle se lit, et comment le palier se mesure.
//
// Une revue de palier est un fichier COMMITTÉ, écrit directement sous son nom d'archive
// `.claude/soldes/revue-palier-<date>-<base>-<tête>.md` : la date et les DEUX bornes de sa fenêtre
// `<base>..<tête>` NOMMENT le fichier, et son contenu les porte. Un seul objet, à un seul endroit — le
// nom se déduit du contenu (`nomDArchiveDeRevue`), et la porte au commit vérifie qu'ils se répondent.
// Les archives antérieures gardent leur nom (`nomsDArchiveAcceptes`) : la mesure lit leur FENÊTRE.
//
// Le palier se MESURE sur l'histoire : les commits dont CE QU'ILS FONT (`ceQueFaitLeCommit`) touche
// `src`/`scripts`, depuis la tête de fenêtre de la dernière revue archivée DANS HEAD. C'est une lecture
// que n'importe qui refait avec git, et qui rend la même valeur depuis n'importe quel arbre. Un compteur d'événements
// compterait ce que chaque worktree fait de son côté (20 sur ce dépôt, dont des trains qui ne
// rejoignent jamais `main`) : deux worktrees suffisent à en faire un nombre que rien ne recoupe.
import { GitIndisponible, INDEX, ceQuEmporteLIndex, ceQueFaitLeCommit, combienDe, depotDe, estAncetre, imageDeHead, lireEnLot, listerImage, shasDe } from './gitPorte.mjs'
import { parUnitesDeCode } from './lister.mjs'

/** Le dossier des revues archivées. */
const SOLDES = '.claude/soldes'

/** Le texte de chaque chemin de `chemins` dans l'image `arbre` (`lireEnLot`), `''` quand l'objet
 *  n'existe pas. Une INDISPONIBILITÉ (git absent, hors dépôt) JETTE — `mesureDuPalier` la rend en
 *  `erreur` nommée. */
const textesDe = (depot, arbre, chemins) => {
  const lus = lireEnLot(depot, arbre, chemins)
  return (chemin) => lus.get(chemin) ?? ''
}

const DATE_RE = /\d{4}-\d{2}-\d{2}/g
const FENETRE_RE = /([0-9a-f]{7,40})\.\.([0-9a-f]{7,40})/
const CHEMIN_DE_REVUE_RE = /^\.claude\/soldes\/revue-palier-.+\.md$/

/**
 * Ce qu'une revue dit d'elle-même. PUR. Chaque champ vaut `null` s'il est illisible.
 * La date est la DERNIÈRE de la 1re ligne (le titre porte souvent des numéros de tickets avant
 * elle) ; la fenêtre est la PREMIÈRE du corps.
 * @returns {{ date: string|null, base: string|null, tete: string|null }}
 */
export function fenetreDeRevue(texte) {
  const contenu = String(texte ?? '')
  const premiereLigne = contenu.split(/\r?\n/, 1)[0] ?? ''
  const dates = [...premiereLigne.matchAll(DATE_RE)].map((m) => m[0])
  const fenetre = FENETRE_RE.exec(contenu)
  return { date: dates.at(-1) ?? null, base: fenetre?.[1] ?? null, tete: fenetre?.[2] ?? null }
}

/**
 * Ce qui manque à une revue pour être NOMMABLE, en clair. PUR — liste vide = nommable.
 * @returns {string[]}
 */
export function problemesDeRevue(texte) {
  const { date, base } = fenetreDeRevue(texte)
  const problemes = []
  if (!date) problemes.push('aucune date AAAA-MM-JJ en 1re ligne — le fichier porte cette date dans son nom')
  if (!base) problemes.push('aucune fenêtre `<base>..<tête>` (shas de 7 à 40 caractères) — le fichier porte cette base dans son nom')
  return problemes
}

/**
 * Nom de fichier d'une revue : `revue-palier-<date>-<base>-<tête>.md`. PUR.
 * Le nom porte les DEUX bornes de la fenêtre : deux sessions ont archivé le même jour une revue de
 * même base (2026-09-05, base f0f9436f5, têtes 714df53da et 226a764b6) et le second fichier ne
 * pouvait pas entrer dans l'histoire — même nom, conflit AA au rebase. Sans tête lisible, la base
 * seule nomme ; sans fenêtre, la date seule : les revues écrites avant que la porte n'exige la
 * fenêtre restent nommables. `dateDeRepli` sert quand la revue elle-même n'en porte aucune ; sans
 * elle et sans date lisible, le retour est `null`.
 * @returns {string|null}
 */
export function nomDArchiveDeRevue(texte, dateDeRepli = null) {
  const { date, base, tete } = fenetreDeRevue(texte)
  const jour = date ?? dateDeRepli
  if (!jour) return null
  if (!base) return `revue-palier-${jour}.md`
  return tete ? `revue-palier-${jour}-${base}-${tete}.md` : `revue-palier-${jour}-${base}.md`
}

/**
 * Tous les noms qu'une revue peut LEGITIMEMENT porter : le nom courant, et les graphies ANTÉRIEURES
 * que l'histoire porte déjà (base seule, puis date seule). PUR. Les archives déjà committées ne se
 * renomment pas — c'est leur FENÊTRE, jamais leur nom, que la mesure du palier lit (`archivesDe`
 * relit chaque contenu). Seule une revue NEUVE est tenue au nom courant.
 * @returns {string[]}
 */
export function nomsDArchiveAcceptes(texte, dateDeRepli = null) {
  const { date, base } = fenetreDeRevue(texte)
  const jour = date ?? dateDeRepli
  if (!jour) return []
  const courant = nomDArchiveDeRevue(texte, dateDeRepli)
  const anterieurs = base ? [`revue-palier-${jour}-${base}.md`, `revue-palier-${jour}.md`] : [`revue-palier-${jour}.md`]
  return [...new Set([courant, ...anterieurs].filter(Boolean))]
}

/** Deux écritures du MÊME sha : git abrège librement (9 caractères ici, 40 là). Le préfixe décide,
 *  jamais moins de 7 caractères — la longueur d'abréviation par défaut de git. */
export function memeSha(a, b) {
  if (!a || !b) return false
  const [court, long] = a.length <= b.length ? [a, b] : [b, a]
  return court.length >= 7 && long.startsWith(court)
}

/**
 * Les revues archivées telles que HEAD les porte — jamais l'index, jamais le disque. La mesure du
 * palier porte sur l'histoire COMMITTÉE, et elle est lue par une gate qui tourne pendant que d'autres
 * gates écrivent dans l'arbre.
 * @returns {{ chemin: string, date: string|null, base: string|null, tete: string|null }[]}
 */
export function archivesDe(cwd = process.cwd()) {
  // Dépôt sans premier commit : son image est l'arbre vide (`imageDeHead`), donc aucune archive.
  const depot = depotDe(cwd)
  const head = imageDeHead(depot)
  const revues = listerImage(depot, head, SOLDES).filter((chemin) => CHEMIN_DE_REVUE_RE.test(chemin))
  const texte = textesDe(depot, head, revues)
  return revues.map((chemin) => ({ chemin, ...fenetreDeRevue(texte(chemin)) }))
}

/**
 * Les revues AJOUTÉES par le commit en cours, avec leur contenu STAGÉ : ce sont elles que la porte au
 * commit valide, et c'est le seul endroit où l'index est lu.
 * @returns {{ chemin: string, nom: string, contenu: string }[]}
 */
export function revuesNeuves(cwd = process.cwd()) {
  const depot = depotDe(cwd)
  const ajoutees = ceQuEmporteLIndex(depot).chemins('A', [SOLDES]).filter((chemin) => CHEMIN_DE_REVUE_RE.test(chemin))
  const texte = textesDe(depot, INDEX, ajoutees)
  return ajoutees.map((chemin) => ({ chemin, nom: chemin.split('/').pop(), contenu: texte(chemin) }))
}

/**
 * La dernière revue de HEAD qui JUGE son histoire : celle dont la tête de fenêtre est un ancêtre de
 * HEAD, et dont il reste le moins de commits jusqu'à HEAD. C'est la FENÊTRE qui décide, jamais le nom
 * du fichier — `.claude/soldes/revue-palier-82e95be10.md` porte dans son NOM un sha orphelin (la
 * version pré-rebase de `112c814b6`), et sa FENÊTRE `7692b631c..2c11fdd9a` est bien dans l'histoire :
 * c'est cette revue-là qui fait référence.
 * Une ASCENDANCE INDISPONIBLE (git muet) n'est pas « orpheline » : elle a son propre état, et
 * l'appelant la nomme au lieu de conclure que la revue ne juge rien.
 * @returns {{ etat:'trouvee', chemin:string, date:string|null, base:string|null, tete:string, reste:number }
 *   | { etat:'aucune-archive' } | { etat:'toutes-orphelines', chemins:string[] }
 *   | { etat:'ascendance-indisponible', raison:string }}
 */
export function derniereRevueArchivee(cwd = process.cwd()) {
  const archivees = archivesDe(cwd)
  if (archivees.length === 0) return { etat: 'aucune-archive' }
  const depot = depotDe(cwd)
  const jugeantes = []
  for (const r of archivees) {
    if (!r.tete) continue
    const vu = estAncetre(depot, r.tete, 'HEAD')
    if (!vu.disponible) return { etat: 'ascendance-indisponible', raison: vu.raison }
    if (vu.absent || vu.valeur !== true) continue
    jugeantes.push({ ...r, reste: combienDe(depot, [`${r.tete}..HEAD`]) ?? Number.NaN })
  }
  jugeantes.sort((a, b) => a.reste - b.reste || parUnitesDeCode(a.chemin, b.chemin))
  if (jugeantes.length === 0) return { etat: 'toutes-orphelines', chemins: archivees.map((r) => r.chemin) }
  return { etat: 'trouvee', ...jugeantes[0] }
}

/** L'ascendance de `sha` vis-à-vis de HEAD, en union à trois issues : la tête de fenêtre d'une revue
 *  neuve est un commit que ce dépôt porte, sinon la revue juge une histoire qui n'existe pas ici. Un
 *  sha INCONNU rend `absent` — l'appelant en fait « pas dans cette histoire ». Le PRÉDICAT booléen
 *  correspondant est `estDansHead` (`gitPorte.mjs`), partagé avec le garde de solde. */
export const ascendanceDansHead = (sha, cwd = process.cwd()) =>
  sha ? estAncetre(depotDe(cwd), sha, 'HEAD') : { disponible: true, absent: true }

/** Les dossiers qui font la SUBSTANCE d'un commit : le moteur et l'outillage. Source unique du
 *  critère — la mesure du palier (`shasDeSubstance`) et la porte du ticket au commit
 *  (`evaluatePorteDuTicket`, scripts/hooks/solde-ticket-guard.mjs) lisent la MÊME liste, sinon deux
 *  définitions de « substance » cohabitent et un commit passe l'une sans passer l'autre. */
export const DOSSIERS_DE_SUBSTANCE = ['src', 'scripts']

/** Ce chemin est-il de SUBSTANCE ? PUR — le pendant par-chemin de `DOSSIERS_DE_SUBSTANCE`, pour qui
 *  tient déjà la liste des fichiers (le contenu qu'un commit EMPORTE) plutôt qu'un pathspec git. */
export function estCheminDeSubstance(chemin) {
  const p = String(chemin ?? '').replace(/\\/g, '/')
  return DOSSIERS_DE_SUBSTANCE.some((d) => p === d || p.startsWith(`${d}/`))
}

/**
 * Les commits de SUBSTANCE de la plage `revisions` (`shasDe`), du plus ancien au plus récent : ceux dont CE QU'ILS
 * FONT (`ceQueFaitLeCommit`, contre leur base) touche un chemin de substance (`estCheminDeSubstance`).
 * Une fusion propre n'en est pas ; une fusion qui apporte une ligne sous `src`/`scripts` en est.
 * Une plage que git ne rend pas n'en a aucun. `limite` : la lecture s'arrête au `limite`-ième
 * commit de substance trouvé.
 * @param {import('./gitPorte.mjs').Depot} depot @param {readonly string[]} revisions
 * @param {{ limite?: number }} [options]
 * @returns {string[]}
 * @throws {GitIndisponible} propagée de `ceQueFaitLeCommit`.
 */
export function shasDeSubstance(depot, revisions, { limite = Infinity } = {}) {
  const vus = []
  for (const sha of shasDe(depot, revisions) ?? []) {
    if (vus.length >= limite) break
    if (ceQueFaitLeCommit(depot, sha).chemins().some(estCheminDeSubstance)) vus.push(sha)
  }
  return vus
}

/**
 * Ce que le contrôle de palier a besoin de savoir, mesuré. `compte` = les commits de substance depuis
 * `tete` (`shasDeSubstance`), plus le commit en cours si ce qu'il EMPORTE (`emportes`, la liste que
 * lit la porte du ticket) est de substance ; le compte s'arrête à `seuil`. `erreur` = le palier est
 * INMESURABLE et le dit, avec `tete`/`chemin` de la dernière revue quand elle est connue ; `compte: 0`
 * sans référence = HEAD ne porte AUCUNE revue archivée, donc le palier n'a pas d'origine à partir de
 * laquelle compter — ce qui n'est pas un défaut de l'arbre jugé.
 * @param {string} [cwd] @param {{ emportes?: string[], seuil?: number }} [options]
 * @returns {{ compte:number, tete:string|null, chemin:string|null, erreur?:string }}
 */
export function mesureDuPalier(cwd = process.cwd(), { emportes = [], seuil = Infinity } = {}) {
  let derniere
  try {
    derniere = derniereRevueArchivee(cwd)
  } catch (err) {
    return { compte: 0, tete: null, chemin: null, erreur: `histoire illisible depuis ${cwd} — ${err.message}` }
  }
  if (derniere.etat === 'aucune-archive') return { compte: 0, tete: null, chemin: null }
  if (derniere.etat === 'ascendance-indisponible') {
    return {
      compte: 0,
      tete: null,
      chemin: null,
      erreur: `ascendance indisponible : ${derniere.raison} — le palier ne se mesure pas sans git`,
    }
  }
  if (derniere.etat === 'toutes-orphelines') {
    return {
      compte: 0,
      tete: null,
      chemin: null,
      erreur:
        `aucune des ${derniere.chemins.length} revues archivées ne juge l'histoire de HEAD — leur tête de `
        + `fenêtre n'en est pas un ancêtre (${derniere.chemins.join(', ')}) : le palier ne peut pas se mesurer, `
        + 'et une revue dont la tête de fenêtre est ORPHELINE (rebase) se ré-écrit sur sa fenêtre réelle',
    }
  }
  const { tete, chemin } = derniere
  const enCours = emportes.some(estCheminDeSubstance) ? 1 : 0
  try {
    const publies = shasDeSubstance(depotDe(cwd), [`${tete}..HEAD`], { limite: Math.max(0, seuil - enCours) }).length
    return { compte: publies + enCours, tete, chemin }
  } catch (err) {
    if (!(err instanceof GitIndisponible)) throw err
    return { compte: 0, tete, chemin, erreur: `ce que font les commits depuis ${tete} est illisible : ${err.raison}` }
  }
}
