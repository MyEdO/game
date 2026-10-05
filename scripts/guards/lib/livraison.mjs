// LA LIVRAISON : ce qu'exigent les trailers de livraison (`JUGE:`, `REFUTATION:`, `JUGE-VISION:`), au
// commit (`scripts/hooks/solde-ticket-guard.mjs`) et à la PUBLICATION (`fusionsNonJugees`, gate
// `livraison:plage`, #2328 A3).
// Ticket #2328, Attendu, verbatim : « Ceux-ci restent exigés là où la livraison se juge : commit de
// solde, porte de publication. » Une fusion se COMMITE sans eux (lot 1) ; la résolution qu'elle porte
// se juge avant la publication, par un commit POSTÉRIEUR de la plage qui nomme son sha.
import { estFichierVitest } from './fichierVitest.mjs'
import { numerosCites } from './fermetures.mjs'
import { GitIndisponible, TRONC, baseCommune, ceQueFontLesCommits, grapheDe, journalDe, lireEnLot } from './gitPorte.mjs'

/** Le seuil de SUBSTANCE d'un commit : au commit, ses lignes de diff sous `src/` ; à la publication,
 *  les lignes CHANGÉES (ajoutées ou supprimées) sous `src/` de la résolution d'une fusion (#2328 A4). */
export const SUBSTANTIVE_MIN_LINES = 10

/** Les trailers de livraison : la ligne du message, le titre de la section d'un solde
 *  (`.claude/soldes/ref-<N>.md`, `<N>.md` ; un motif de `sectionDe`), et la longueur minimale de leur texte. `JUGE` n'accroche
 *  jamais `JUGE-VISION:` : le tiret casse le motif `JUGE\s*:`. */
export const TRAILERS = Object.freeze({
  JUGE: Object.freeze({ ligne: /\bJUGE\s*:\s*(.+)/i, section: 'Juge', min: 40 }),
  REFUTATION: Object.freeze({ ligne: /REFUTATION\s*:\s*(.+)/i, section: 'R[ée]futation', min: 40 }),
  'JUGE-VISION': Object.freeze({ ligne: /\bJUGE-VISION\s*:\s*(.+)/i, section: 'Juge-Vision', min: 40 }),
})

/** Fichier d'ÉCRAN : ce que l'utilisateur VOIT — un composant `.tsx` de `src/ui/**`/`src/gameIso/**`
 *  ou une feuille de `src/ui/styles/**`, hors tests. Concept unique, partagé par la preuve
 *  JUGE-VISION et la section « ## Recette visuelle » du solde.
 *  BORNÉ au rendu, à dessein : `src/ui/breakdown.ts` (calcul pur) et `src/gameIso/builders/**.ts`
 *  (géométrie pure) vivent sous ces racines sans rien AFFICHER — exiger d'eux une capture ferait de
 *  la recette visuelle une formalité qu'on remplit sans regarder. Un diff qui ne touche que des
 *  tests d'écran n'a pas davantage de capture à montrer. */
export function estFichierEcran(path) {
  const p = String(path ?? '').replace(/\\/g, '/')
  if (estFichierVitest(p)) return false
  if (/^src\/ui\/styles\/.+\.css$/.test(p)) return true
  return /^src\/(ui|gameIso)\/.+\.tsx$/.test(p)
}

/** Le corps de la section `## <titre>` de `content`, `null` sans elle ; `titre` est un motif d'expression
 *  régulière : le titre s'écrit avec ou sans accents selon la section. Sans le drapeau `m`, `$` est la
 *  fin du TEXTE : avec lui, il vaudrait fin de chaque ligne et la section s'arrêterait à la première.
 *  Le titre se reconnaît donc en tête de ligne par `(?:^|\n)`. */
export function sectionDe(content, titre) {
  const m = new RegExp(`(?:^|\\n)##\\s*${titre}\\s*\\n([\\s\\S]*?)(?=\\n##[^#]|$)`, 'i').exec(String(content ?? ''))
  return m ? m[1] : null
}

/** Le corps de la section du trailer `nom` (`TRAILERS`) dans un solde, sans ses blancs de bord, `null`
 *  sans elle : l'UNIQUE lecture d'une section de livraison, au commit (`validateJugeFile`,
 *  `validateJugeVisionFile` de scripts/hooks/solde-ticket-guard.mjs) comme à la publication. PURE. */
export const corpsDuTrailer = (contenu, nom) => sectionDe(contenu, TRAILERS[nom].section)?.trim() ?? null

/** Le plus court sha qui NOMME un commit dans un trailer. */
const SHA_COURT_MIN = 9

/** `true` si `texte` porte un sha d'au moins `SHA_COURT_MIN` caractères qui préfixe `sha`. PURE. */
const nommeLeSha = (texte, sha) => [...String(texte).matchAll(/\b[0-9a-f]{9,40}\b/gi)].some((m) => m[0].length >= SHA_COURT_MIN && sha.startsWith(m[0].toLowerCase()))

/** `true` si le MESSAGE porte une ligne du trailer `nom` assez longue qui nomme `sha`. PURE. */
const messageNomme = (message, nom, sha) => String(message ?? '').split('\n').some((ligne) => {
  const m = TRAILERS[nom].ligne.exec(ligne)
  return !!m && m[1].trim().length >= TRAILERS[nom].min && nommeLeSha(m[1], sha)
})

/** `true` si le SOLDE porte la section du trailer `nom`, assez longue, qui nomme `sha`. PURE. */
const soldeNomme = (contenu, nom, sha) => {
  const corps = corpsDuTrailer(contenu, nom)
  return corps !== null && corps.length >= TRAILERS[nom].min && nommeLeSha(corps, sha)
}

/** Une ligne de MARQUEUR de conflit telle que `merge-tree` l'écrit (git help merge-file). */
const MARQUEUR_DE_CONFLIT = /^(?:<{7}|\|{7}|>{7})(?: |$)|^={7}$/

/** Ce qu'une fusion APPORTE d'après ses patchs `-U0` (chemin ↦ patch, `ceQueFontLesCommits`) : ses
 *  lignes changées sous `src/`, ajoutées ou supprimées contre sa fusion automatique, hors marqueurs de
 *  conflit, et si un écran en change (#2328 A4). Les lignes `+`/`-` comptent après le premier `@@`
 *  d'une section : les en-têtes `+++`/`---` n'en sont pas. PURE. */
export function apportDeLaResolution(patchs) {
  let lignesChangees = 0
  let ecran = false
  for (const [chemin, patch] of patchs) {
    if (!chemin.startsWith('src/')) continue
    let dansUnHunk = false
    let changees = 0
    for (const ligne of patch.split('\n')) {
      if (ligne.startsWith('diff --git ')) dansUnHunk = false
      else if (ligne.startsWith('@@')) dansUnHunk = true
      else if (dansUnHunk && /^[+-]/.test(ligne) && !MARQUEUR_DE_CONFLIT.test(ligne.slice(1))) changees += 1
    }
    lignesChangees += changees
    if (changees > 0 && estFichierEcran(chemin)) ecran = true
  }
  return { lignesChangees, ecran }
}

/** Les commits de `commits` (`grapheDe`) qui DESCENDENT de `sha`, lui exclu. PURE. */
function descendantsDe(commits, sha) {
  const vus = new Set([sha])
  for (let change = true; change;) {
    change = false
    for (const c of commits) if (!vus.has(c.sha) && c.parents.some((p) => vus.has(p))) { vus.add(c.sha); change = true }
  }
  vus.delete(sha)
  return vus
}

/**
 * Les FUSIONS de la plage `merge-base(base, tete)..tete` dont la résolution porte au moins
 * `SUBSTANTIVE_MIN_LINES` lignes changées sous `src/` (`apportDeLaResolution`) sans qu'un commit qui en DESCEND, dans la plage, les
 * NOMME (sha court de `SHA_COURT_MIN` caractères ou plus) dans son `JUGE:` et sa `REFUTATION:` — plus
 * `JUGE-VISION:` quand un écran en change. Un commit nomme par son message, ou par le
 * solde (`.claude/soldes/ref-<N>.md`, `<N>.md`, lus dans `tete`) d'un ticket que son message cite.
 * UNE lecture du graphe, UN lot pour l'apport des fusions (`ceQueFontLesCommits`), UN journal.
 * @param {import('./gitPorte.mjs').Depot} depot
 * @param {{ base?: string, tete?: string }} [bornes]
 * `borne` : le `merge-base` et sa date de commit — le verdict dépend de la fraîcheur de `base`, et la
 * borne le DIT (#2328 L3).
 * @returns {{ plage: string, borne: { base: string, sha: string, date: string, tete: string }, refus: { sha: string, lignesChangees: number, manque: string[] }[] }}
 * @throws {GitIndisponible} aucune base commune, plage ou journal que git ne rend pas, ou fusion
 *   illisible (`ceQueFontLesCommits`).
 */
export function fusionsNonJugees(depot, { base = TRONC.suivi, tete = 'HEAD' } = {}) {
  const sha = baseCommune(depot, base, tete)
  if (!sha) throw new GitIndisponible(`aucune base commune entre ${base} et ${tete} : la plage à publier n'est pas lisible`)
  const date = journalDe(depot, [`${sha}^!`])?.[0]?.date
  if (!date) throw new GitIndisponible(`date du commit ${sha.slice(0, 9)} illisible`)
  const borne = { base, sha, date, tete }
  const plage = `${sha}..${tete}`
  const commits = grapheDe(depot, [plage])
  if (!commits) throw new GitIndisponible(`plage ${plage} illisible`)
  const fusions = commits.filter((c) => c.parents.length > 1)
  if (!fusions.length) return { plage, borne, refus: [] }
  const patchs = ceQueFontLesCommits(depot, fusions).patchs()
  const aJuger = fusions
    .map((f) => ({ sha: f.sha, ...apportDeLaResolution(patchs.get(f.sha)) }))
    .filter((f) => f.lignesChangees >= SUBSTANTIVE_MIN_LINES)
  if (!aJuger.length) return { plage, borne, refus: [] }
  const journal = journalDe(depot, [plage])
  if (!journal) throw new GitIndisponible(`journal de ${plage} illisible`)
  const messages = new Map(journal.map((c) => [c.sha, c.message]))
  const soldesCites = (shas) => [...new Set([...shas].flatMap((s) => numerosCites(messages.get(s))))]
    .flatMap((n) => [`.claude/soldes/ref-${n}.md`, `.claude/soldes/${n}.md`])
  const posterieurs = new Map(aJuger.map((f) => [f.sha, descendantsDe(commits, f.sha)]))
  const chemins = [...new Set([...posterieurs.values()].flatMap(soldesCites))]
  const soldes = chemins.length ? lireEnLot(depot, tete, chemins) : new Map()
  const refus = aJuger.flatMap((f) => {
    const apres = posterieurs.get(f.sha)
    const textes = soldesCites(apres).map((c) => soldes.get(c)).filter((t) => typeof t === 'string')
    const exiges = ['JUGE', 'REFUTATION', ...(f.ecran ? ['JUGE-VISION'] : [])]
    const manque = exiges.filter((nom) => ![...apres].some((s) => messageNomme(messages.get(s), nom, f.sha)) && !textes.some((t) => soldeNomme(t, nom, f.sha)))
    return manque.length ? [{ sha: f.sha, lignesChangees: f.lignesChangees, manque }] : []
  })
  return { plage, borne, refus }
}

/** La borne d'une plage (`fusionsNonJugees`) en clair : le `merge-base` en sha court, sa date. PURE. */
const plageEnClair = ({ base, sha, date, tete }) => `${base} (base ${sha.slice(0, 9)} du ${date})..${tete}`

/** Le refus de publication des `refus` de `fusionsNonJugees`, une ligne par fusion. PURE. */
const raisonDeFusionsNonJugees = (borne, refus) =>
  `⛔ ${plageEnClair(borne)} : ${refus.length} fusion(s) dont la RÉSOLUTION porte ≥${SUBSTANTIVE_MIN_LINES} lignes changées sous src/ sans juge qui la nomme (#2328) :\n` +
  refus.map((r) => `  ${r.sha.slice(0, 9)} (${r.lignesChangees} lignes changées) : manque ${r.manque.map((m) => `\`${m}:\``).join(', ')}`).join('\n') +
  `\nGeste : un commit postérieur de la plage (ou le solde \`.claude/soldes/ref-<N>.md\` d'un ticket qu'il cite) porte ces lignes, chacune nommant le sha court (${SHA_COURT_MIN} caractères ou plus) de la fusion.`

/**
 * Le verdict de PUBLICATION (#2328 A3) de la plage `merge-base(base, tete)..tete` : `ok`, et son `texte`
 * qui nomme la borne de la plage (`plageEnClair`) — la ligne de succès, `raisonDeFusionsNonJugees`,
 * ou le refus NOMMÉ d'une lecture que git ne rend pas. Joué par la gate `livraison:plage` et le
 * préflight d'`ops:publier`, jamais au pre-push : une fusion se pousse (DoD 1).
 * @param {import('./gitPorte.mjs').Depot} depot @param {{ base?: string, tete?: string }} [bornes]
 * @returns {{ ok: boolean, texte: string }}
 */
export function verdictDePublication(depot, bornes) {
  try {
    const { borne, refus } = fusionsNonJugees(depot, bornes)
    return refus.length
      ? { ok: false, texte: raisonDeFusionsNonJugees(borne, refus) }
      : { ok: true, texte: `${plageEnClair(borne)} : toute résolution substantielle de fusion est jugée` }
  } catch (e) {
    if (!(e instanceof GitIndisponible)) throw e
    return { ok: false, texte: `⛔ lecture git indisponible : ${e.raison} — la porte de publication ne juge pas ce que git n'a pas lu.` }
  }
}
