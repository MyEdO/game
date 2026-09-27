// Aligneur PDF↔MD CONSERVATEUR pour combler les ancres `data-folio` manquantes (#522, #1739).
// L'extraction Marker de masse est INTERDITE (docs/raw/00-index.md l.76-81 : ~3000 réfs code
// décaleraient) — cet outil pose des ancres CIBLÉES, sans toucher un seul numéro de ligne ni un mot
// (insertion dans une ligne EXISTANTE, jamais de nouvelle ligne).
//
// Principe :
//   1. Livre → dossier `Source/<dir>/` (`livreDuSigle` de `_lib.mjs`) → PDF du livre par la couture
//      `pdfDe` (`_lib.mjs`, champ `pdf` de `books.json`), SEULE source du PDF (#1739).
//   2. Offset id↔folio PAR LIVRE : chaque ancre existante `id="page-K-0" data-folio="F"` donne
//      `offset = K - F` (K = index PDF 0-based, identique au numéro d'id Marker). Vérifié CONSTANT
//      sur TOUTES les ancres du livre (tous chapitres confondus) — s'il varie, le livre est SKIPPÉ
//      et rapporté (jamais de pose au jugé sur un livre à offset instable).
//   3. Plage de folios attendue d'un chapitre = l'en-tête `*Pages PDF N[-M]*` (l.1, pages PDF
//      humaines 1-based) convertie en folios via l'offset : `folio = (page_humaine - 1) - offset`.
//      Manquants = plage attendue − folios déjà ancrés dans le fichier.
//   4. Lecture du PDF : pdfminer SEUL (`lib/pdf-lignes.py`, un process par livre), lignes rangées
//      dans l'ordre de lecture par `lib/colonnes.mjs#lignes`.
//   5. Têtes de page (`sequencesDeTete`) : trois ordres de la page — l'ordre des COLONNES ; le
//      même, où les lignes posées au-dessus de la 1re ligne de texte courant remontent en tête, par
//      y ; l'ordre des RANGÉES (lignes dont l'emprise verticale se chevauche, de gauche à droite),
//      qui est celui d'une table. Dans chaque ordre, la fenêtre de tête puis les mêmes fenêtres
//      décalées d'une ligne (`SLIDE_MAX`).
//   6. ALIGNEMENT SÉQUENTIEL (`localiserPage`) : les pages d'un fichier se consomment dans l'ordre.
//      La page précédente ancrée dans le fichier et la fin de son texte appariée (`finDePage`), la
//      tête est la 1re ligne de contenu qui suit, si elle s'ouvre sur l'une des 1res lignes de la
//      page (`ouvreSurLaPage`) et avant l'ancre du folio supérieur.
//   7. Repli (`localiserTete`) : dans chaque ordre, la 1re fenêtre à match UNIQUE dans le fichier
//      (clé `cle` de `sonde-titres.mjs` ; `headAnchor` de `reanchor.mjs` sur `buildTightIndex`, puis
//      `compactAnchor` sur `buildCompactIndex`, index SANS espace des lettres éclatées), tombant
//      entre les ancres des folios voisins (`folioBounds`) ; trouvée au décalage s>0, elle REMONTE
//      sur les lignes `.md` dont tous les mots sont parmi les s lignes sautées (`remonter`). La tête
//      est la PLUS PETITE des lignes trouvées. Aucune : SKIP + raison, jamais de pose au jugé.
//   8. Cas qui ne passent pas par l'alignement :
//      - ancre NUE Marker `<span id="page-K-0"></span>` : COMPLÉTÉE de son `data-folio`, en place ;
//      - 1re page de la plage du chapitre : ancre en tête de la 1re ligne de contenu (un chapitre qui
//        s'ouvre en milieu de page porte le même folio que le chapitre qui la commence) ;
//      - page SANS texte (planche, intercalaire) : ancre VIDE, juste avant l'ancre de la page à texte
//        qui la suit dans le fichier, sinon en fin de la dernière ligne de contenu du fichier.
//   9. Idempotent : un folio déjà ancré dans le fichier n'est jamais retraité.
//
// Usage :
//   node scripts/raw/anchor-fill.mjs <ABBR> [--ch NN] [--offset N] [--dry|--apply]
//   --dry (défaut) : rapport seul. --apply : réécrit les .md.
//   --offset : offset K−folio fourni par
//   l'appelant (livre VIERGE, aucune ancre à dériver — cf. `folio-bootstrap.mjs`).
import { readFileSync, writeFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs'
import { listerDossier } from '../guards/lib/lister.mjs'
import { join, resolve, dirname } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import { livreDuSigle, pdfDuSigle, readText } from './_lib.mjs'
import { estSeparateur, numeroDuFichier, plageDeLigne1, stripSpans } from '../../src/data/source/decoupe.ts'
import { offsetToLine, headAnchor } from './reanchor.mjs'
import { cle } from './sonde-titres.mjs'
import { lignes } from './lib/colonnes.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const PDF_LIGNES_SCRIPT = join(HERE, 'lib', 'pdf-lignes.py')

const ANCHOR_RE = /id="page-(\d+)-0" data-folio="(-?\d+)"/g
const FOLIO_ONLY_RE = /data-folio="(-?\d+)"/g

/** Clé d'une ligne `.md` : `cle` (sonde des titres), cellules `<br>` ouvertes ; un séparateur de
 *  table n'a pas de texte. PURE. */
const cleDeLigne = (l) => (estSeparateur(stripSpans(l)) ? '' : cle(l.replace(/<br\s*\/?>/gi, ' ')))

// Index ligne/offset local (remplace reanchor.mjs#buildIndex) : buildIndex joint toujours les
// lignes par UN espace, MEME une ligne VIDE — deux lignes séparées par un saut markdown (fréquent
// juste avant/après un titre `#`) produisent alors un double-espace dans `joined`. Le candidat PDF
// (une seule ligne de mots filtrés, toujours simple-espace) échoue le match EXACT dès qu'il franchit
// une frontière de ligne vide côté `.md`. `buildTightIndex` ne pose PAS de séparateur pour une ligne
// normalisée vide — `offsetToLine` (réutilisé tel quel) reste correct : il n'a besoin que d'un
// `lineStartOffset` non-décroissant par index de ligne D'ORIGINE, pas d'un espacement fixe.
export function buildTightIndex(rawLines) {
  const lineStartOffset = []
  let joined = ''
  for (let i = 0; i < rawLines.length; i++) {
    lineStartOffset.push(joined.length)
    const n = cleDeLigne(rawLines[i])
    if (!n) continue
    if (joined && !joined.endsWith(' ')) joined += ' '
    joined += n
  }
  return { joined, lineStartOffset, count: rawLines.length }
}

// Index COMPACT (aucun espace) + ancrage par préfixe de caractères. Motif : les petites capitales
// de la maquette sortent de l'extraction PDF avec des lettres éclatées À L'INTÉRIEUR des mots
// (« 3. L ors de chaque Round », « TesT de FocalisaT ion ») ; le découpage en MOTS de `headAnchor`
// ne peut alors rien matcher, alors que le texte `.md` est intact. Espaces retirés des deux côtés,
// la coupure disparaît. Le match UNIQUE reste exigé, et l'offset retenu est celui du DÉBUT du
// préfixe — le raccourcissement caractère par caractère ne déplace donc jamais la ligne trouvée.
const COMPACT_MIN = 40
export function buildCompactIndex(rawLines) {
  const lineStartOffset = []
  let joined = ''
  for (const line of rawLines) {
    lineStartOffset.push(joined.length)
    joined += cleDeLigne(line).replace(/ /g, '')
  }
  return { joined, lineStartOffset, count: rawLines.length }
}

export function compactAnchor(joined, head, min = COMPACT_MIN) {
  const compact = head.replace(/ /g, '')
  for (let len = compact.length; len >= min; len--) {
    const needle = compact.slice(0, len)
    const occ = []
    let i = joined.indexOf(needle)
    while (i !== -1) { occ.push(i); i = joined.indexOf(needle, i + 1) }
    if (occ.length >= 1) return { occ, anchor: needle }
  }
  return { occ: [], anchor: null }
}

// ---------- offset (id PDF 0-based) - (folio imprimé), constant par livre ----------
export function resolveBookOffset(dir) {
  if (!existsSync(dir)) return { ok: false, reason: 'dossier introuvable' }
  const files = listerDossier(dir, { absent: 'vide' }).filter((f) => numeroDuFichier(f) != null)
  const offsets = new Set()
  let count = 0
  for (const file of files) {
    const text = readText(join(dir, file))
    const re = new RegExp(ANCHOR_RE)
    let m
    while ((m = re.exec(text))) {
      offsets.add(Number(m[1]) - Number(m[2]))
      count++
    }
  }
  if (count === 0) return { ok: false, reason: 'aucune ancre existante dans le livre' }
  if (offsets.size > 1) return { ok: false, reason: `offset instable : ${[...offsets].sort((a, b) => a - b).join(', ')}` }
  return { ok: true, offset: [...offsets][0], sampleCount: count }
}

// ---------- plage de folios attendue d'un chapitre (en-tête *Pages PDF N[-M]*) ----------
export function chapterFolioRange(firstLine, offset) {
  const plage = plageDeLigne1(firstLine)
  if (!plage) return null
  return { folioLo: (plage.page - 1) - offset, folioHi: (plage.pageFin - 1) - offset }
}

export function existingFolios(text) {
  const set = new Set()
  const re = new RegExp(FOLIO_ONLY_RE)
  let m
  while ((m = re.exec(text))) set.add(Number(m[1]))
  return set
}

// Ancres déjà présentes AVEC leur ligne (1-based) : Map(folio -> ligne). Un folio réancré plus bas
// dans le fichier ne remplace pas sa première occurrence — c'est la tête de page qui borne.
export function existingFolioLines(text) {
  const map = new Map()
  const lines = text.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const re = new RegExp(FOLIO_ONLY_RE)
    let m
    while ((m = re.exec(lines[i]))) { const f = Number(m[1]); if (!map.has(f)) map.set(f, i + 1) }
  }
  return map
}

// Ancres NUES de l'extraction Marker — `<span id="page-K-0"></span>` SANS `data-folio` : Map(K ->
// ligne 1-based). Elles portent l'`id` que la pose écrirait : la pose les COMPLÈTE de leur
// `data-folio`, en place (#1739), jamais un second `id="page-K-0"`.
const NAKED_ANCHOR_RE = /<span id="page-(\d+)-0"\s*><\/span>/g
export function nakedAnchorLines(text) {
  const map = new Map()
  const lines = text.split('\n')
  for (let i = 0; i < lines.length; i++) {
    for (const m of lines[i].matchAll(NAKED_ANCHOR_RE)) { const k = Number(m[1]); if (!map.has(k)) map.set(k, i + 1) }
  }
  return map
}

// Intervalle de lignes admissible pour un folio manquant : la ligne du folio ancré immédiatement
// INFÉRIEUR et celle du folio ancré immédiatement SUPÉRIEUR. Sans voisin d'un côté, la borne est
// ouverte (`0` / `Infinity`) — jamais une borne inventée. `known` = Map(folio -> ligne).
export function folioBounds(known, folio) {
  let lo = 0, hi = Infinity, loFolio = null, hiFolio = null
  for (const [f, line] of known) {
    if (f < folio && (loFolio == null || f > loFolio)) { loFolio = f; lo = line }
    if (f > folio && (hiFolio == null || f < hiFolio)) { hiFolio = f; hi = line }
  }
  return { lo, hi, loFolio, hiFolio }
}

export function boundsLabel(b) {
  const lo = b.loFolio == null ? 'début de fichier' : `l.${b.lo} (folio ${b.loFolio})`
  const hi = b.hiFolio == null ? 'fin de fichier' : `l.${b.hi} (folio ${b.hiFolio})`
  return `${lo} → ${hi}`
}

// ---------- têtes de page (lignes pdfminer ordonnées par `lib/colonnes.mjs#lignes`) ----------
// Mot réel = 3 minuscules consécutives : la 1re ligne qui en porte un ouvre le texte courant.
export const HAS_LOWER_RE = /[a-zàâäéèêëïîôöùûüÿœæç]{3,}/
const FOLIO_NU_RE = /^\d{1,4}$/
const PIED_DE_PAGE = 60
// Points de conduite d'une table des matières (`Swimming ........ 157`), absents du `.md`.
const POINTILLES_RE = /\s*\.{4,}\s*/g
const SLIDE_MAX = 8
const MAX_LINES = 6
const MAX_CHARS = 400

const hauteurDe = (l) => Math.max(1, ...(l.spans ?? []).map((s) => s.taille ?? 0))
const parHauteur = (a, b) => b.y0 - a.y0 || a.x0 - b.x0

/**
 * Les ORDRES de tête d'une page (`[texte…]`), folio de pied écarté ; `[]` pour une page SANS texte.
 * (1) L'ordre des colonnes. (2) Le même, les lignes posées plus HAUT que la 1re ligne de texte
 * courant remontées en tête par y (titre d'une colonne voisine au-dessus du corps, tableau coiffé) —
 * absent s'il ne change rien. (3) L'ordre des RANGÉES : lignes triées par haut
 * décroissant, une rangée réunit les lignes dont l'emprise verticale chevauche celle de sa 1re
 * ligne, lues de gauche à droite — l'ordre d'une table. PURE.
 * @param {{ texte: string, x0: number, y0: number, spans?: { taille: number }[] }[]} lignesDeLaPage
 * @returns {string[][]}
 */
export function sequencesDeTete(lignesDeLaPage) {
  const ls = lignesDeLaPage.filter((l) => l.texte.trim() && !(l.y0 < PIED_DE_PAGE && FOLIO_NU_RE.test(l.texte.trim())))
  if (!ls.length) return []
  const i0 = ls.findIndex((l) => HAS_LOWER_RE.test(l.texte))
  const yCourant = i0 < 0 ? Infinity : ls[i0].y0
  const remonte = (l) => l.y0 > yCourant
  const remontees = [...ls.filter(remonte).sort(parHauteur), ...ls.filter((l) => !remonte(l))]
  const rangees = []
  for (const l of [...ls].sort((a, b) => b.y0 + hauteurDe(b) - (a.y0 + hauteurDe(a)) || a.x0 - b.x0)) {
    const r = rangees.at(-1)
    if (r && l.y0 + hauteurDe(l) > r.bas) r.lignes.push(l)
    else rangees.push({ bas: l.y0, lignes: [l] })
  }
  const parRangee = rangees.flatMap((r) => [...r.lignes].sort((a, b) => a.x0 - b.x0))
  const ordres = remontees.some((l, i) => l !== ls[i]) ? [ls, remontees, parRangee] : [ls, parRangee]
  return ordres.map((seq) => seq.map((l) => l.texte.trim()))
}

/** Fenêtres de tête d'un ordre : `{ slide, head, sautees }`, la tête en clé `cle`. PURE. */
export function fenetresDeTete(sequence, { maxLines = MAX_LINES, maxChars = MAX_CHARS, slideMax = SLIDE_MAX } = {}) {
  const out = []
  for (let s = 0; s <= slideMax && s < sequence.length; s++) {
    const head = cle(sequence.slice(s, s + maxLines).join(' ').replace(POINTILLES_RE, ' ')).slice(0, maxChars)
    if (head) out.push({ slide: s, head, sautees: sequence.slice(0, s) })
  }
  return out
}

/** La ligne 1-based trouvée à un décalage s>0 REMONTE sur les lignes `.md` non vides qui la
 *  précèdent (strictement après `lo`) tant que tous leurs mots figurent parmi les s lignes de tête
 *  sautées — le chiffre d'onglet, le titre que l'extraction a mis devant. PURE. */
export function remonter(lines, line, sautees, lo = 0) {
  const mots = new Set(sautees.flatMap((t) => cle(t).split(' ').filter(Boolean)))
  let out = line
  for (let i = line - 2; i >= 0 && i + 1 > lo; i--) {
    const k = cleDeLigne(lines[i])
    if (!k) continue
    if (!k.split(' ').filter(Boolean).every((m) => mots.has(m))) break
    out = i + 1
  }
  return out
}

/**
 * Dernière ligne `.md` (1-based) du texte d'une page, ou `null` : la queue de la page (ses dernières
 * lignes dans l'ordre des colonnes, et chacun de ses suffixes) cherchée à partir de la ligne `depuis`
 * (l'ancre de la page), la fin la PLUS PROCHE — la page consomme son texte dans l'ordre. Un texte que
 * deux pages voisines répètent se partage ainsi entre elles, au lieu de rendre la tête de la seconde
 * ambiguë. PURE.
 */
export function finDePage(lines, lignesDeLaPage, depuis, index = { tight: buildTightIndex(lines), compact: buildCompactIndex(lines) }) {
  const [colonnes] = sequencesDeTete(lignesDeLaPage)
  if (!colonnes) return null
  const queue = cle(colonnes.slice(-3).join(' ').replace(POINTILLES_RE, ' '))
  for (const [ix, compact, min] of [[index.tight, false, 24], [index.compact, true, COMPACT_MIN]]) {
    const texte = compact ? queue.replace(/ /g, '') : queue
    const debut = ix.lineStartOffset[Math.max(0, depuis - 1)] ?? 0
    const coupes = compact ? [...texte].map((_, i) => i) : [0, ...[...texte.matchAll(/ /g)].map((m) => m.index + 1)]
    const fins = coupes.map((c) => texte.slice(c)).filter((a) => a.length >= min)
      .map((a) => { const at = ix.joined.indexOf(a, debut); return at < 0 ? Infinity : at + a.length - 1 })
    const fin = Math.min(...fins)
    if (fin !== Infinity) return offsetToLine(fin, ix.lineStartOffset)
  }
  return null
}

const OUVERTURE_MIN = 6

/** La ligne `.md` `line` (1-based) s'ouvre-t-elle sur les 1res lignes de la page ? Sous l'un de
 *  ses ordres, à partir de l'une de ses `SLIDE_MAX + 1` premières lignes, les lignes consécutives
 *  jointes jusqu'à `OUVERTURE_MIN` caractères : leur clé `cle`, mots ENTIERS, en tête du texte `.md`
 *  qui commence à `line`. PURE. */
function ouvreSurLaPage(line, sequences, index) {
  const ix = index.tight
  const debut = ix.lineStartOffset[line - 1] + (ix.joined[ix.lineStartOffset[line - 1]] === ' ' ? 1 : 0)
  const ouvre = (seq, s) => {
    let k = ''
    for (let i = s; i < seq.length && k.replace(/ /g, '').length < OUVERTURE_MIN; i++) k = cle(`${k} ${seq[i].replace(POINTILLES_RE, ' ')}`)
    const suite = ix.joined[debut + k.length]
    return k.replace(/ /g, '').length >= OUVERTURE_MIN && ix.joined.startsWith(k, debut) && (suite === undefined || suite === ' ')
  }
  return sequences.some((seq) => seq.slice(0, SLIDE_MAX + 1).some((_, s) => ouvre(seq, s)))
}

/**
 * Ligne `.md` (1-based) où s'ouvre la page `folio` : ALIGNEMENT SÉQUENTIEL — les pages d'un fichier
 * se consomment dans l'ordre. La page précédente ancrée dans le fichier, sa fin (`finDePage`)
 * appariée : la 1re ligne de contenu qui la suit, si son texte est sur la page (`ouvreSurLaPage`)
 * et avant l'ancre du folio supérieur. Sinon, la PLUS PETITE ligne trouvée parmi les ordres de tête
 * (`localiserTete`). `{ line, slide }`, ou `{ reason }`. PURE.
 */
export function localiserPage(lines, sequences, known, folio, pagePrecedente, index) {
  const bornes = folioBounds(known, folio)
  const fin = known.has(folio - 1) && pagePrecedente ? finDePage(lines, pagePrecedente, known.get(folio - 1), index) : null
  if (fin != null) {
    let i = fin
    while (i < lines.length && !cleDeLigne(lines[i])) i++
    if (i < lines.length && i + 1 <= bornes.hi && ouvreSurLaPage(i + 1, sequences, index)) return { line: i + 1, slide: 0 }
  }
  return localiserTete(lines, sequences, bornes, index)
}

/**
 * Ligne `.md` (1-based) où s'ouvre une page, sans page précédente appariée : dans chaque ordre, la
 * 1re fenêtre de tête à match UNIQUE dans le fichier tombant dans les bornes ; la plus petite des
 * lignes trouvées. `{ line, slide }`, ou `{ reason }`. PURE.
 */
export function localiserTete(lines, sequences, bounds, index = { tight: buildTightIndex(lines), compact: buildCompactIndex(lines) }) {
  const echecs = { ambiguous: 0, outOfBounds: null }
  const premier = (sequence) => {
    for (const f of fenetresDeTete(sequence)) {
      for (const [ix, compact] of [[index.tight, false], [index.compact, true]]) {
        const hit = compact ? compactAnchor(ix.joined, f.head) : headAnchor(ix.joined, f.head)
        if (hit.occ.length > 1) { echecs.ambiguous = Math.max(echecs.ambiguous, hit.occ.length); continue }
        if (hit.occ.length !== 1) continue
        const found = offsetToLine(hit.occ[0], ix.lineStartOffset)
        if (found < bounds.lo || found > bounds.hi) { echecs.outOfBounds = echecs.outOfBounds ?? found; continue }
        return { line: f.slide > 0 ? remonter(lines, found, f.sautees, bounds.lo) : found, slide: f.slide }
      }
    }
    return null
  }
  const trouvees = sequences.map(premier).filter(Boolean)
  if (trouvees.length) return trouvees.reduce((a, b) => (b.line < a.line ? b : a))
  if (echecs.outOfBounds != null) return { reason: `hors bornes (l.${echecs.outOfBounds} hors ${boundsLabel(bounds)})` }
  if (echecs.ambiguous) return { reason: `ambigu (${echecs.ambiguous} candidats)` }
  return { reason: 'aucune occurrence' }
}

// ---------- lecture pdfminer (un seul process python par livre) ----------
/** Map(K -> lignes ordonnées) des pages d'un livre : le JSON de `lib/pdf-lignes.py` (`boites`
 *  fourni, sinon lu au PDF). */
export function pagesEnLignes(id, boites = null) {
  const brut = boites ?? lireBoites(id)
  return new Map(brut.map((p) => [p.page - 1, lignes(p.boites)]))
}

/** Le JSON de `lib/pdf-lignes.py` d'un livre (`books.json#id`) : `[{ page, boites }]`, toutes pages. */
export function lireBoites(id) {
  const dir = mkdtempSync(join(tmpdir(), 'anchor-fill-'))
  try {
    const sortie = join(dir, 'boites.json')
    execFileSync('python', [PDF_LIGNES_SCRIPT, id, sortie], { stdio: ['ignore', 'ignore', 'inherit'] })
    return JSON.parse(readFileSync(sortie, 'utf8'))
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

// ---------- traitement d'un chapitre (pur sur les données déjà en mémoire — pageOf injectable) ----------
// `pageOf(K)` = lignes pdfminer ordonnées de la page K (`pagesEnLignes`), `undefined`/`null` hors PDF.
// Retourne { file, range, missing, placed:[{folio,line,slide}], completed:[{folio,line}],
// skipped:[{folio,reason}], alreadyCount, edits } ; `edits` = Map(lineIdx0based -> [edit,...]) à
// appliquer côté disque par l'appelant (`applyEdits`, jamais ici).
export function planChapter(file, text, offset, pageOf) {
  const lines = text.split('\n')
  const range = chapterFolioRange(lines[0] || '', offset)
  const vide = { file, range, missing: [], placed: [], completed: [], skipped: [], alreadyCount: 0, edits: new Map() }
  if (!range) return vide
  const already = existingFolios(text)
  const nues = nakedAnchorLines(text)
  const known = existingFolioLines(text)
  const plan = { ...vide, edits: new Map() }
  const edit = (idx0, e) => { if (!plan.edits.has(idx0)) plan.edits.set(idx0, []); plan.edits.get(idx0).push(e) }
  for (let f = range.folioLo; f <= range.folioHi; f++) {
    if (already.has(f)) continue
    const K = f + offset
    if (!nues.has(K)) { plan.missing.push(f); continue }
    const line = nues.get(K)
    edit(line - 1, { kind: 'complete', folio: f, K, span: `<span id="page-${K}-0" data-folio="${f}"></span>` })
    plan.completed.push({ folio: f, line })
    known.set(f, line)
  }
  plan.alreadyCount = (range.folioHi - range.folioLo + 1) - plan.missing.length
  if (!plan.missing.length) return plan
  const index = { tight: buildTightIndex(lines), compact: buildCompactIndex(lines) }
  const sansTexte = []
  const poser = (folio, line, slide) => {
    const K = folio + offset
    edit(line - 1, { kind: 'tete', folio, K, span: `<span id="page-${K}-0" data-folio="${folio}"></span>` })
    plan.placed.push({ folio, line, slide })
    known.set(folio, line)
  }
  for (const folio of plan.missing) {
    const page = pageOf(folio + offset)
    if (page === undefined || page === null) { plan.skipped.push({ folio, reason: 'page hors PDF ou introuvable' }); continue }
    const sequences = sequencesDeTete(page)
    if (!sequences.length) { sansTexte.push(folio); continue }
    if (folio === range.folioLo) {
      const premiere = lines.findIndex((l, i) => i > 0 && l.trim())
      if (premiere < 0) { plan.skipped.push({ folio, reason: 'chapitre sans ligne de contenu' }); continue }
      poser(folio, premiere + 1, 0)
      continue
    }
    const r = localiserPage(lines, sequences, known, folio, pageOf(folio - 1 + offset), index)
    if (r.reason && !page.some((l) => HAS_LOWER_RE.test(l.texte))) { sansTexte.push(folio); continue }
    if (r.reason) { plan.skipped.push({ folio, reason: r.reason }); continue }
    poser(folio, r.line, r.slide)
  }
  // Page SANS texte (aucune ligne, ou aucun mot réel ni tête retrouvée : planche, intercalaire) :
  // ancre vide juste avant l'ancre de la 1re page à texte qui la suit dans le fichier, toutes les
  // pages intermédiaires étant elles aussi sans texte ; sans page qui la suive dans le fichier, en
  // fin de sa dernière ligne de contenu.
  const vides = new Set(sansTexte)
  const derniere = lines.findLastIndex((l, i) => i > 0 && l.trim())
  for (const folio of sansTexte) {
    let suivante = folio + 1
    while (vides.has(suivante)) suivante++
    const K = folio + offset
    const span = `<span id="page-${K}-0" data-folio="${folio}"></span>`
    if (known.has(suivante)) {
      edit(known.get(suivante) - 1, { kind: 'avant', folio, K, avantK: suivante + offset, span })
      plan.placed.push({ folio, line: known.get(suivante), slide: 0, sansTexte: true })
    } else if (derniere > 0) {
      edit(derniere, { kind: 'fin', folio, K, span })
      plan.placed.push({ folio, line: derniere + 1, slide: 0, sansTexte: true })
    } else plan.skipped.push({ folio, reason: 'page sans texte dans un chapitre sans ligne de contenu' })
  }
  plan.placed.sort((a, b) => a.folio - b.folio)
  return plan
}

// Marque de bloc Markdown d'une ligne (titre, citation, puce, item numéroté) : l'ancre se pose APRÈS
// elle, en tête du texte qu'elle ouvre — posée avant, la ligne cesserait d'être ce bloc.
const MARQUE_DE_BLOC_RE = /^(?:#{1,6}\s+|>\s*|[-*+]\s+|\d+[.)]\s+)/

/** Applique les `edits` de `planChapter` : complétions en place, têtes en tête du texte de la ligne
 *  (après sa marque de bloc, ordre croissant de folio), pages sans texte juste avant l'ancre de la
 *  page qui les suit, ou en fin de la dernière ligne de contenu. PURE. */
export function applyEdits(text, edits) {
  const lines = text.split('\n')
  for (const [idx0, arr] of edits) {
    let l = lines[idx0]
    for (const e of arr.filter((x) => x.kind === 'complete')) l = l.replace(new RegExp(`<span id="page-${e.K}-0"\\s*></span>`), e.span)
    const marque = MARQUE_DE_BLOC_RE.exec(l)?.[0] ?? ''
    l = marque + arr.filter((x) => x.kind === 'tete').sort((a, b) => a.folio - b.folio).map((e) => e.span).join('') + l.slice(marque.length)
    for (const e of arr.filter((x) => x.kind === 'avant').sort((a, b) => a.folio - b.folio)) {
      const cible = `<span id="page-${e.avantK}-0"`
      l = l.replace(cible, e.span + cible)
    }
    l += arr.filter((x) => x.kind === 'fin').sort((a, b) => a.folio - b.folio).map((e) => e.span).join('')
    lines[idx0] = l
  }
  return lines.join('\n')
}

// ---------- pilote un livre ----------
// `offset` : amorce d'un livre VIERGE (aucune ancre → `resolveBookOffset` n'a rien à dériver) ;
// l'appelant fournit alors l'offset qu'il a LU au pied/en-tête des pages du PDF
// (`folio-bootstrap.mjs`). Absent → offset dérivé des ancres existantes, comme d'habitude.
// `boites` : le JSON de `lib/pdf-lignes.py` déjà produit (sinon lu au PDF).
export function runBook(abbr, { chapter = null, apply = false, dir: dirOverride, offset: offsetOverride = null, boites = null } = {}) {
  const livre = livreDuSigle(abbr)
  const dir = dirOverride ?? livre?.dir
  if (!dir || !livre) return { abbr, ok: false, reason: `sigle sans livre extrait au registre : ${abbr}` }
  const off = offsetOverride == null ? resolveBookOffset(dir) : { ok: true, offset: offsetOverride }
  if (!off.ok) return { abbr, ok: false, reason: off.reason }
  let pdfPath
  try { pdfPath = pdfDuSigle(abbr) } catch (e) { return { abbr, ok: false, reason: e.message } }
  if (!existsSync(dir)) return { abbr, ok: false, reason: 'dossier introuvable' }
  let files = listerDossier(dir, { absent: 'vide' }).filter((f) => numeroDuFichier(f) != null)
  if (chapter != null) files = files.filter((f) => numeroDuFichier(f) === Number(chapter))
  const pages = pagesEnLignes(livre.id, boites)
  const chapters = []
  for (const file of files) {
    const text = readText(join(dir, file))
    const plan = planChapter(file, text, off.offset, (K) => pages.get(K))
    chapters.push(plan)
    if (apply && plan.edits.size) writeFileSync(join(dir, file), applyEdits(text, plan.edits))
  }
  return { abbr, ok: true, offset: off.offset, dir, pdfPath, chapters }
}

// ---------- rapport ----------
function report(result) {
  const out = []
  if (!result.ok) { out.push(`## ${result.abbr} — SKIPPÉ (${result.reason})`); return out.join('\n') }
  out.push(`## ${result.abbr} (offset ${result.offset})`)
  let totalPlaced = 0, totalCompleted = 0, totalSkipped = 0, totalAlready = 0
  for (const c of result.chapters) {
    if (c.range == null) { out.push(`- ${c.file} : pas d'en-tête \`*Pages PDF N[-M]*\` — ignoré`); continue }
    totalPlaced += c.placed.length; totalCompleted += c.completed.length; totalSkipped += c.skipped.length; totalAlready += c.alreadyCount
    if (!c.missing.length && !c.completed.length) { continue }
    out.push(`- ${c.file} : ✅ ${c.placed.length} posée(s) · 🔗 ${c.completed.length} complétée(s) · ⏭️ ${c.skipped.length} sautée(s) · déjà là ${c.alreadyCount}`)
    for (const s of c.skipped) out.push(`    ❌ folio ${s.folio} — ${s.reason}`)
  }
  out.push(`**Bilan ${result.abbr} : ✅ ${totalPlaced} posées · 🔗 ${totalCompleted} complétées · ⏭️ ${totalSkipped} sautées · déjà là ${totalAlready}**`)
  return out.join('\n')
}

function main() {
  const args = process.argv.slice(2)
  const abbr = args.find((a) => !a.startsWith('--'))
  const chIdx = args.indexOf('--ch')
  const chapter = chIdx >= 0 ? args[chIdx + 1] : null
  const offIdx = args.indexOf('--offset')
  const apply = args.includes('--apply')
  if (!abbr) {
    console.log('Usage: node scripts/raw/anchor-fill.mjs <ABBR> [--ch NN] [--offset N] [--dry|--apply]')
    process.exitCode = 1
    return
  }
  const offset = offIdx >= 0 ? Number(args[offIdx + 1]) : null
  if (offIdx >= 0 && !Number.isInteger(offset)) {
    console.log(`--offset attend un entier, reçu : ${args[offIdx + 1]}`)
    process.exitCode = 1
    return
  }
  const result = runBook(abbr, { chapter, apply, offset })
  console.log(report(result))
  if (!apply) console.log('(--dry : relancer avec --apply pour écrire)')
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) main()
