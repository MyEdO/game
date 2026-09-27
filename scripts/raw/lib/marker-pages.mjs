// Lecture d'une extraction Marker PAGINÉE — source UNIQUE du parseur de pages `{N}----` et de la
// COUPE à la ligne d'un titre pour les découpeurs de `Source/` (#1739, Lot H du #1388). Le texte
// d'un titre et le prédicat d'ouverture vivent au feuillet PUR `lib/titres.mjs`. Deux consommateurs :
// `scripts/raw/split-wfrp5.mjs` (livre neuf) et `scripts/raw/marker-split.mjs` (ré-extraction
// alignée sur une structure ancienne) — le parseur y vivait en deux copies.
//
// Marker est lancé PAR TRANCHES (`--page_range a-b`, une sous-arborescence
// `slices/<a>-<b>/<pdf>/<pdf>.md` par run : une extraction d'un tenant est tuée faute de mémoire).
// Le séparateur `{N}----` porte l'index ABSOLU 0-based de la page quelle que soit la tranche
// (mesuré : tranche 40-79 → séparateurs {40}…{79}), donc page PDF 1-based = N + 1.
import { statSync } from 'node:fs'
import { join } from 'node:path'
import { listerDossier } from '../../guards/lib/lister.mjs'
import { readText } from '../_lib.mjs'
import { extractPages } from './pdf-extract.mjs'
import { estLigneDeTitre, ouvreSur } from './titres.mjs'

/** Séparateur de page de la sortie paginée de Marker : `{N}----` seul sur sa ligne.
 *  Mesuré sur le CRB 5e : 378/378 séparateurs portent 48 tirets — aucun cas à 4. */
const SEP_PAGE = /^\{(\d+)\}-{5,}\s*$/m

/** Les `.md` d'une arborescence de sortie Marker, dans l'ordre des pages.
 *  @param {string} chemin fichier `.md`, dossier de TRANCHES (`<a>-<b>/<pdf>/<pdf>.md`), ou dossier
 *    de sortie marker_single d'un tenant (`<pdf>/<pdf>.md`).
 *  @returns {string[]} chemins des `.md`, tranches ordonnées par borne basse. */
export function mdsDeMarker(chemin) {
  const st = statSync(chemin)
  if (!st.isDirectory()) {
    if (!chemin.endsWith('.md')) throw new Error(`MARKER : « ${chemin} » n'est pas un .md`)
    return [chemin]
  }
  // `restitutions/` (ré-extractions CIBLÉES d'une page perdue, `mdsDeRestitutions`) est frère des
  // tranches et ne matche pas `^\d+-\d+$` : il n'entre JAMAIS dans l'union des tranches.
  const tranches = listerDossier(chemin).filter((d) => /^\d+-\d+$/.test(d))
    .sort((a, b) => Number(a.split('-')[0]) - Number(b.split('-')[0]))
  if (!tranches.length) {
    const mds = mdsDeSortie(chemin)
    if (mds.length !== 1) throw new Error(`MARKER : « ${chemin} »/*/*.md → ${mds.length} fichiers .md (attendu : 1)`)
    return [mds[0]]
  }
  const out = []
  for (const tranche of tranches) {
    const dir = join(chemin, tranche)
    // Marker écrit le sous-dossier du PDF à la FIN de son run : une tranche qui n'en porte aucun
    // (seul son `marker.log` existe) n'a aucune sortie sur le disque, donc aucune page à fournir.
    if (!listerDossier(dir).some((s) => estDossier(join(dir, s)))) continue
    const mds = mdsDeSortie(dir)
    if (mds.length !== 1) throw new Error(`MARKER : tranche ${tranche} → ${mds.length} fichiers .md (attendu : 1)`)
    out.push(mds[0])
  }
  return out
}

const estDossier = (p) => { try { return statSync(p).isDirectory() } catch { return false } }

/** Les `.md` directement sous `<dir>/<sous-dossier>/` (forme de sortie marker_single), ordre total. */
function mdsDeSortie(dir) {
  const out = []
  for (const sub of listerDossier(dir)) {
    if (!estDossier(join(dir, sub))) continue
    for (const f of listerDossier(join(dir, sub))) if (f.endsWith('.md')) out.push(join(dir, sub, f))
  }
  return out
}

/** Les `.md` des RÉ-EXTRACTIONS CIBLÉES d'un dossier de tranches : `<chemin>/restitutions/<k>/…`,
 *  une sous-arborescence par page restituée (`--force_layout_block Text --page_range <k>`). On accepte les deux
 *  formes que marker_single peut laisser sous `<k>` : son sous-dossier de PDF (`<k>/<pdf>/<pdf>.md`)
 *  ou un `.md` posé directement. Ordre total (`listerDossier`).
 *  @param {string} chemin dossier de tranches @returns {string[]} `[]` si `restitutions/` n'existe pas. */
export function mdsDeRestitutions(chemin) {
  const racine = join(chemin, 'restitutions')
  if (!estDossier(racine)) return []
  const out = []
  for (const k of listerDossier(racine)) {
    const dir = join(racine, k)
    if (!estDossier(dir)) continue
    for (const f of listerDossier(dir)) if (f.endsWith('.md')) out.push(join(dir, f))
    out.push(...mdsDeSortie(dir))
  }
  return out
}

/** Texte PAR PAGE PDF (1-based) d'une liste de `.md` paginés. Ne réécrit RIEN du texte.
 *  @param {string[]} mds
 *  @param {(chemin: string) => string} [lire] lecteur de texte — `readText` (seam CRLF-robuste) par
 *    défaut ; les tests injectent des fixtures inline.
 *  @returns {Map<number, string>} */
export function pagesDeMarker(mds, lire = readText) {
  const pages = new Map()
  for (const md of mds) {
    const segs = lire(md).split(SEP_PAGE) // [pre, num, contenu, num, contenu, …]
    if (segs[0].trim()) throw new Error(`MARKER : texte avant le premier séparateur de page (${md}) : ${segs[0].trim().slice(0, 200)}`)
    for (let i = 1; i < segs.length; i += 2) {
      const pg = Number(segs[i]) + 1
      if (pages.has(pg)) throw new Error(`MARKER : page ${pg} extraite deux fois (${md}) — tranches qui se chevauchent`)
      pages.set(pg, segs[i + 1])
    }
  }
  return pages
}

/** Pages 1..max absentes de la Map (information : planches sans texte).
 *  @param {Map<number, string>} pages @returns {number[]} */
export function pagesManquantes(pages) {
  if (!pages.size) return []
  const max = Math.max(...pages.keys())
  const out = []
  for (let pg = 1; pg <= max; pg++) if (!pages.has(pg)) out.push(pg)
  return out
}

/** Ancre de page de Marker : substrat de `anchor-fill`/`folio-bootstrap` (qui y posent `data-folio`)
 *  — elle RESTE dans le texte livré, elle ne compte donc pas comme du contenu de page. */
const ANCRE_PAGE = /<span id="page-\d+-\d+"><\/span>/g

/** Pages dont Marker n'a rendu AUCUN contenu : texte privé des ancres `<span id="page-N-0"></span>`
 *  et des blancs = chaîne VIDE (longueur 0 — aucun seuil deviné). Une page présente dans la Map mais
 *  vide est invisible pour `pagesManquantes` : c'est la classe des « pages perdues » (#1622).
 *  @param {Map<number, string>} pages @returns {number[]} trié croissant. */
export function pagesVides(pages) {
  const out = []
  for (const [pg, texte] of pages) if (!texte.replace(ANCRE_PAGE, '').trim().length) out.push(pg)
  return out.sort((a, b) => a - b)
}

/** Pages PERDUES : pages VIDES ou ABSENTES de l'extraction Marker alors que la couche texte du PDF
 *  en porte plus de `seuil` caractères (mesuré sur le CRB 5e : pages 17/19/126 rendues `'\n'` par
 *  Marker `--disable_ocr`, 1806/1461/2070 caractères lus par pypdf — planches et encadrés gatés par
 *  la mise en page). Le texte PDF se lit par la primitive `extractPages` (un seul process python,
 *  indices 0-based = page − 1) ; les tests l'INJECTENT par `extraire`, comme `lire` de `pagesDeMarker`.
 *  @param {Map<number, string>} pages @param {string} pdfPath
 *  @param {{ seuil?: number, extraire?: (pdf: string, indices: number[]) => Map<number, string|null> }} [options]
 *  @returns {{ page: number, pypdf: number }[]} trié par page. */
export function pagesPerdues(pages, pdfPath, { seuil = 200, extraire = extractPages } = {}) {
  const suspectes = [...new Set([...pagesVides(pages), ...pagesManquantes(pages)])].sort((a, b) => a - b)
  if (!suspectes.length) return []
  const textes = extraire(pdfPath, suspectes.map((pg) => pg - 1))
  const out = []
  for (const pg of suspectes) {
    const t = textes.get(pg - 1)
    const n = t ? t.length : 0
    if (n > seuil) out.push({ page: pg, pypdf: n })
  }
  return out
}

/** Commande de RÉ-EXTRACTION CIBLÉE d'une page perdue — forme UNIQUE, imprimée telle quelle par les
 *  deux découpeurs. C'est la MISE EN PAGE qui gate, pas le PDF : Marker classe la page entière en
 *  `Figure` (mesuré CRB 5e p.17 : `block_counts` = 18 `Line` + 1 `Figure`, sortie `'\n'`) et
 *  `--force_ocr` rend la même page vide (60 octets) ; `--force_layout_block Text` saute la mise en page
 *  et rend la couche texte (1852 octets pour 1806 chez pypdf), à plat — titres et paragraphes non
 *  séparés, à recoller au PDF si la page est citée.
 *  @param {string} pdfPath @param {string} racine dossier de tranches (parent de `restitutions/`)
 *  @param {number} page page PDF 1-based @returns {string} */
export function commandeRestitution(pdfPath, racine, page) {
  const k = page - 1
  return `marker_single "${pdfPath}" --output_format markdown --config_json scripts/raw/marker-paginate.json`
    + ` --disable_ocr --disable_image_extraction --force_layout_block Text --page_range ${k} --output_dir "${racine}/restitutions/${k}"`
}

/** Fusionne des pages RESTITUÉES dans une extraction de base. Une restitution ne remplace qu'un TROU :
 *  page absente ou VIDE (au sens de `pagesVides`). Une page de base PLEINE fait LEVER, nommée — une
 *  ré-extraction OCR ne se substitue jamais à une page que `--disable_ocr` a rendue fidèlement.
 *  @param {Map<number, string>} pages @param {Map<number, string>} restitutions
 *  @returns {Map<number, string>} nouvelle Map (l'entrée n'est pas mutée), pages croissantes. */
export function restituerPages(pages, restitutions) {
  const vides = new Set(pagesVides(pages))
  const out = new Map(pages)
  for (const [pg, texte] of restitutions) {
    if (out.has(pg) && !vides.has(pg)) throw new Error(`MARKER : page ${pg} déjà pleine, restitution refusée`)
    out.set(pg, texte)
  }
  return new Map([...out].sort((a, b) => a[0] - b[0]))
}

/** VÉRIFICATIONS d'une extraction — bloc PARTAGÉ par les deux découpeurs (même vigilance pour un
 *  parseur unique) : fusionne les restitutions, puis rend les pages manquantes et les pages perdues.
 *  L'AFFICHAGE et le code de sortie restent au consommateur.
 *  @param {Map<number, string>} pages @param {{ pdfPath: string, restitutions?: Map<number, string>,
 *    seuil?: number, extraire?: (pdf: string, indices: number[]) => Map<number, string|null> }} options
 *  @returns {{ pages: Map<number, string>, manquantes: number[], perdues: {page: number, pypdf: number}[] }}
 *    `pages` = la Map FUSIONNÉE (les restitutions y sont déjà posées : l'appelant découpe celle-là). */
export function verifierExtraction(pages, { pdfPath, restitutions, seuil, extraire } = {}) {
  const fusion = restitutions && restitutions.size ? restituerPages(pages, restitutions) : pages
  return {
    pages: fusion,
    manquantes: pagesManquantes(fusion),
    perdues: pagesPerdues(fusion, pdfPath, { ...(seuil == null ? {} : { seuil }), ...(extraire ? { extraire } : {}) }),
  }
}


/**
 * COUPE un flux de lignes aux lignes de ses titres d'OUVERTURE, en SÉQUENCE : chaque entrée se
 * cherche APRÈS la coupe précédente, jamais dans tout le flux. C'est ce qui tient les HOMONYMES
 * (CRB 5e : `SKILLS` ×52 et `ARMOUR` ×45 sont les étiquettes du gabarit de profil du Bestiaire ;
 * `POISONS` ouvre DEUX fichiers) — mesuré sur les 120 titres du CRB : dans l'ordre du flux, le
 * PREMIER homonyme rencontré après la coupe précédente est toujours le bon.
 *
 * Une entrée SANS titre (`ouverture` absente) coupe à son `depuis` : un fichier peut n'avoir aucun
 * titre imprimé (couverture, feuille de personnage). Une entrée dont le titre est INTROUVABLE dans
 * sa fenêtre est NOMMÉE et n'ouvre aucun fichier — aucune coupe n'est devinée à sa place.
 *
 * @param {string[]} lignes flux entier, déjà découpé en lignes
 * @param {{ cle: string, ouverture?: string | null, depuis?: number, avant?: number }[]} entrees
 *   `depuis`/`avant` bornent la fenêtre de recherche (bornes de la PAGE déclarée, pour un flux
 *   paginé) ; absentes, la recherche court jusqu'à la fin du flux.
 * @returns {{ coupes: { cle: string, ouverture: string | null, ligne: number }[],
 *   introuvables: { cle: string, ouverture: string, depuis: number, avant: number }[] }}
 */
export function couperAuxTitres(lignes, entrees) {
  const titres = []
  for (let i = 0; i < lignes.length; i++) if (estLigneDeTitre(lignes[i])) titres.push(i)
  const coupes = []
  const introuvables = []
  let curseur = 0
  for (const e of entrees) {
    const depuis = Math.max(curseur, e.depuis ?? 0)
    const avant = Math.min(lignes.length, e.avant ?? lignes.length)
    if (e.ouverture == null) {
      coupes.push({ cle: e.cle, ouverture: null, ligne: depuis })
      curseur = depuis
      continue
    }
    const hit = titres.find((i) => i >= depuis && i < avant && ouvreSur(lignes[i], e.ouverture))
    if (hit == null) {
      introuvables.push({ cle: e.cle, ouverture: e.ouverture, depuis, avant })
      continue
    }
    coupes.push({ cle: e.cle, ouverture: e.ouverture, ligne: hit })
    curseur = hit + 1
  }
  return { coupes, introuvables }
}
