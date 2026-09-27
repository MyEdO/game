// MOBILIER DE PAGE d'un livre extrait (#1739) : le chiffre romain de l'ONGLET de chapitre et le FOLIO
// ne sont pas du texte du livre — l'extraction les a MÊLÉS au flux. Feuillet PUR : aucun accès disque
// hors de la donnée d'outillage importée ; ses consommateurs partagent UNE définition — la sonde
// (`scripts/raw/sonde-mobilier.mjs`), la réparation (`scripts/raw/reparer-mobilier.mjs`) et la famille
// `mobilier` de la garde de format (`scripts/raw/check-source-format.mjs`).
//
// Règle utilisateur, verbatim (2026-09-20) : « Il est interdit de réécrire le texte. On peut réparer
// le texte s'il est tronqué/mélangé car l'extraction n'est pas parfaite. »
//
// O, l'ensemble des chiffres d'onglet d'un fichier, se tire de la DONNÉE `onglets` de sa liste de
// découpe (`scripts/raw/decoupes/<id>.json`), jamais d'une devinette.
import characteristics from '../../../src/data/characteristics.json' with { type: 'json' }
import { cellulesDe, estSeparateur, stripSpans } from '../../../src/data/source/decoupe.ts'
import { nomsDeLaListe } from '../_lib.mjs'
import { EXEMPTIONS_MOBILIER } from '../../guards/lib/mobilierExemptions.mjs'

/** La fenêtre de pages d'un fichier `{ page, pageFin }` d'où O se tire (#1739). */
export const fenetreDe = (e) => [e.page, e.pageFin + 1]

/** Chiffres d'onglet des pages `[lo, hi]` : ceux dont l'étendue rencontre la fenêtre. PURE. */
export const chiffresDes = (onglets, [lo, hi]) =>
  new Set((onglets ?? []).filter((o) => o.pages[0] <= hi && o.pages[1] >= lo).map((o) => o.chiffre))

/** Abréviations de Caractéristique (`src/data/characteristics.json`, champ `abr`). */
export const ABREVIATIONS = new Set(characteristics.map((c) => c.abr).filter(Boolean))

/** La ligne `i` est-elle l'EN-TÊTE d'une table de PROFIL — suivie de son séparateur, et portant au
 *  moins 3 abréviations de Caractéristique ? PURE. */
export function estEnTeteDeProfil(lignes, i, abreviations = ABREVIATIONS) {
  if (!lignes[i].trim().startsWith('|') || !estSeparateur(lignes[i + 1] ?? '')) return false
  return cellulesDe(lignes[i]).filter((c) => abreviations.has(c)).length >= 3
}

/** La ligne, ses runs GRAS `**…**` blanchis À LONGUEUR ÉGALE (les positions restent celles de la
 *  ligne). PURE. */
const horsGras = (ligne) => ligne.replace(/\*\*[^*]*\*\*/g, (m) => ' '.repeat(m.length))

/**
 * Sites de mobilier d'un texte — PUR. `O` = chiffres d'onglet du fichier ; `folios` = `[lo, hi]`
 * des nombres qu'une tête de ligne peut porter comme folio.
 *  (a) une ligne réduite à un élément de O (`romain-seul`) ;
 *  (b) une tête de ligne (après ses `#`) faite de 1 à 3 nombres, TOUS de `folios` (le folio seul, la
 *      paire d'une double page) : un site par nombre, à sa position `debut` — `folio-nu` si rien ne
 *      les suit, `folio-tete` s'ils précèdent du texte ;
 *  (c) un élément de O comme MOT ISOLÉ hors gras (`mot`, avec sa position `debut`) — mot = suite
 *      sans blanc ni `|` ; les cellules d'en-tête d'une table de PROFIL sont exclues.
 * @returns {{ ligne: number, classe: 'romain-seul'|'folio-nu'|'folio-tete'|'mot', jeton: string, debut?: number, texte: string }[]}
 */
export function sitesDeMobilier(texte, { O, folios, abreviations = ABREVIATIONS }) {
  const out = []
  const lignes = texte.split('\n')
  lignes.forEach((l, i) => {
    const t = l.trim()
    const site = { ligne: i + 1, texte: l }
    if (O.has(t)) { out.push({ ...site, classe: 'romain-seul', jeton: t }); return }
    const tete = /^(\s*(?:#{1,6} +)?)((?:\d{1,3} +){0,2}\d{1,3})(?=\s|$)/.exec(l)
    const seul = tete && !l.slice(tete[0].length).trim()
    if (tete) {
      const nombres = [...tete[2].matchAll(/\d+/g)]
      if (nombres.every((n) => +n[0] >= folios[0] && +n[0] <= folios[1])) {
        for (const n of nombres) out.push({ ...site, classe: seul ? 'folio-nu' : 'folio-tete', jeton: n[0], debut: tete[1].length + n.index })
      }
      if (seul) return
    }
    if (estEnTeteDeProfil(lignes, i, abreviations)) return
    for (const m of horsGras(l).matchAll(/[^\s|]+/g)) {
      if (O.has(m[0])) out.push({ ...site, classe: 'mot', jeton: m[0], debut: m.index })
    }
  })
  return out
}

/** Sites d'UN fichier de la liste de découpe, O tiré de `onglets` sur sa fenêtre ; ses folios, de
 *  `page - 1` (folio de gauche de la double page où il s'ouvre) à `pageFin + 1`. PURE. */
export const sitesDuFichier = (texte, entree, onglets) =>
  sitesDeMobilier(texte, { O: chiffresDes(onglets, fenetreDe(entree)), folios: [entree.page - 1, entree.pageFin + 1] })

/** L'exemption d'une LIGNE : celle du même fichier dont le motif tient au texte (ancres de page
 *  ôtées), ou `null`. PURE. */
export const exemptionDe = (texte, fichier, exemptions) =>
  exemptions.find((e) => e.fichier === fichier && e.motif.test(stripSpans(texte))) ?? null

/**
 * Pose les exemptions sur les sites d'UN fichier — PUR. Une exemption couvre, sur sa ligne, ses
 * `jetons` premiers sites dans l'ordre de la ligne, et PAS UN DE PLUS : un chiffre d'onglet ajouté à
 * une ligne exemptée reste un site.
 */
export function exempter(sites, fichier, exemptions) {
  const vus = new Map()
  return sites.map((s) => {
    const e = exemptionDe(s.texte, fichier, exemptions)
    const n = (vus.get(s.ligne) ?? 0) + 1
    vus.set(s.ligne, n)
    return { ...s, exemption: e && n <= e.jetons ? e : null }
  })
}

/**
 * Sites de mobilier d'un DOSSIER de livre, fichier par fichier dans l'ordre de sa liste de découpe,
 * chacun avec son `fichier` POSIX, son `nnn` (préfixe du nom) et son exemption éventuelle — PUR :
 * `texteDe(nom)` rend le texte d'un fichier. `[]` pour un livre sans onglet (`onglets` null).
 * @param {string} dir chemin POSIX du dossier @param {(nom: string) => string} texteDe
 * @param {{ page: number, pageFin: number }[]} liste @param {object[] | null} onglets
 */
export function mobilierDuDossier(dir, texteDe, liste, onglets, { exemptions = EXEMPTIONS_MOBILIER } = {}) {
  if (onglets == null) return []
  return nomsDeLaListe(liste).flatMap((nom, i) => {
    const fichier = `${dir}/${nom}`
    const sites = sitesDuFichier(texteDe(nom), liste[i], onglets).map((s) => ({ ...s, fichier, nnn: nom.slice(0, nom.indexOf(' ')) }))
    return exempter(sites, fichier, exemptions)
  })
}

/** Les exemptions qui ne couvrent pas EXACTEMENT leurs `jetons` sites : `{ exemption, couverts }`. PURE. */
export const exemptionsFausses = (sites, exemptions = EXEMPTIONS_MOBILIER) =>
  exemptions
    .map((e) => ({ exemption: e, couverts: sites.filter((s) => s.exemption === e).length }))
    .filter(({ exemption, couverts }) => couverts !== exemption.jetons)

/** La ligne est-elle une ligne de TABLE ? PURE. */
export const estLigneDeTable = (ligne) => ligne.trim().startsWith('|')

/**
 * La ligne, le jeton `[debut, debut + jeton.length)` retiré — PUR. Seules les espaces se
 * normalisent, et au seul point de coupe : dans une cellule de table, le jeton devient autant
 * d'espaces (la cellule reste, les colonnes aussi) ; ailleurs, les blancs qui le bordent se
 * réduisent à UNE espace entre deux textes, à RIEN en bord de ligne.
 */
export function sansJeton(ligne, debut, jeton) {
  if (ligne.slice(debut, debut + jeton.length) !== jeton) throw new Error(`mobilier : « ${jeton} » absent à ${debut} de « ${ligne} »`)
  if (estLigneDeTable(ligne)) return ligne.slice(0, debut) + ' '.repeat(jeton.length) + ligne.slice(debut + jeton.length)
  const gauche = ligne.slice(0, debut).replace(/[ \t]+$/, '')
  const droite = ligne.slice(debut + jeton.length).replace(/^[ \t]+/, '')
  return gauche && droite ? `${gauche} ${droite}` : gauche + droite
}
