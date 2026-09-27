// Intégrité des réfs RAW du CODE — volet « la ligne citée ne porte RIEN » (#1318).
// `check-code-refs.mjs` borne déjà la ligne (hors borne du chapitre = mort) ; une réf DANS les
// bornes mais pointant une ligne VIDE reste invérifiée — c'est par là qu'est passée une règle
// inventée citée `LDB 17 l.84` (chapitre de 87 lignes, ligne 84 vide).
//
// Sous-cas GATÉ : la ou les lignes citées sont TOUTES vides ET la fenêtre ±`WINDOW` autour d'elles ne
// partage AUCUN mot signifiant (≥ `MIN_WORD_LEN` lettres) avec le contexte porteur (la ligne de code
// citante ± `WINDOW`). Le recouvrement est LEXICAL, sur le préfixe de `STEM_LEN` lettres (accents
// repliés) : « nourriture » recouvre « nourri », « colère » recouvre « colères », et un cognat FR/EN
// recouvre aussi (« critique » / « critical » → `criti`). Un mot-clé dont la forme diverge AVANT ce
// préfixe (radical distinct, synonyme, vocabulaire de code étranger) ne recouvre PAS : une dérive de
// ligne post-ré-extraction Marker n'est donc innocentée QUE si son sujet reste à ±`WINDOW` ET s'écrit
// pareil — mesure du 2026-08-16 : sans le préfixe, 161 sites gelés dont 84 avaient déjà leur sujet à
// ±6 lignes ; avec le préfixe, 108 à cette date. Le stock COURANT se lit dans
// `scripts/guards/raw-blind-refs-stock.json`, jamais ici. Soldé, le stock est un fichier ABSENT, lu
// comme zéro entrée (`lireEntreesDeSite`) : tolérance ZÉRO. Il se régénère par
// `npx tsx scripts/guards/lib/regenStock.mts scripts/guards/lib/rawRefIntegrity.mjs` ; un site différé y
// entre par `--lot <#N>`, et un solde total retire le fichier.
//
// Vocabulaire RÉUTILISÉ de `scripts/raw/_lib.mjs` (source unique) : `refRe`/`span`/
// `bookOf`/`chapterFile`/`readText`. Périmètre : les CITANTS de `src/` (`fichiersCitants`,
// `scripts/raw/lib/fichiersCitants.mjs`), la même marche que `check-code-refs.mjs`.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { fichiersCitants } from '../../raw/lib/fichiersCitants.mjs'
import {
  refRe, span, refNums, isRangeSuffix, chapterFile, bookOf, readText, alternationDuRegistre, REGISTRE_LIVRES,
  estLivreExtrait, livreExtraitDe, sigleDe,
} from '../../raw/_lib.mjs'
import { ecartDuVolet } from './stock.mjs'
import { SOUS_LOT, lireEntreesDeSite } from './stockDeSites.mjs'

// Réexport des résolveurs de `_lib.mjs`, de la primitive d'écart `ecartDuVolet` de
// `scripts/guards/lib/stock.mjs` et du lecteur de stock `lireEntreesDeSite` de
// `scripts/guards/lib/stockDeSites.mjs` dont les consommateurs TypeScript ont besoin : une seule couture
// typée (`rawRefIntegrity.d.mts`) au lieu d'un `.d.mts` par module de `scripts/raw/`.
export {
  chapterFile, readText, ecartDuVolet, lireEntreesDeSite, alternationDuRegistre, REGISTRE_LIVRES, estLivreExtrait,
  livreExtraitDe, sigleDe,
}

export const SRC_DIR = 'src'
export const EXCLUDE_SRC_PREFIX = 'src/gameIso/rig/parts/tenues/defs/' // art de couverture (cf. check-code-refs)
export const WINDOW = 2
export const MIN_WORD_LEN = 5
/** Longueur du préfixe sur lequel se juge le recouvrement (tolère pluriel/dérivé, pas le synonyme). */
export const STEM_LEN = 5

/** Fichiers de la garde elle-même : ses fixtures citent des réfs À DESSEIN (preuve de morsure). */
export const SELF_FILES = ['src/raw-ref-integrity.test.ts']

/** Exemptions AU SITE (jamais au fichier) : `{ file, row, ref, raison, date }`. Une exemption
 *  nomme la ligne EXACTE du code citant + la réf — un déplacement de site la périme (fail-closed). */
export const SITE_EXEMPTIONS = []

/** Stock NOMINATIF des sites aveugles : `{ quoi, entrees: [{ fichier, ref, occurrence, lot, date }] }`,
 *  clé `fichier src :: réf :: occurrence` (écart `ecartDuVolet` de `scripts/guards/lib/stock.mjs`).
 *  Les deux sens échouent : un site NEUF est une régression à corriger ou à déclarer, une entrée dont
 *  le site a disparu est une dette SOLDÉE à retirer. Soldé, le stock est un fichier ABSENT, lu comme
 *  zéro entrée (`lireEntreesDeSite`) : tolérance ZÉRO. Il se régénère par
 *  `npx tsx scripts/guards/lib/regenStock.mts scripts/guards/lib/rawRefIntegrity.mjs` ; un site différé
 *  y entre par `--lot <#N>`, et un solde total retire le fichier. Une entrée se solde en lisant le
 *  `Source/` et en réancrant la réf sur la ligne qui porte VRAIMENT le passage.
 *  Les formes COMPACTES (`l.A/B/C`, `_lib.mjs`) comptent chaque ancre SÉPARÉMENT : une seule d'entre
 *  elles pointant une ligne vide suffit à rougir la réf entière. */
export const STOCK_NOM = 'raw-blind-refs-stock.json'
export const STOCK_PATH = new URL(`../${STOCK_NOM}`, import.meta.url)

/** Sites aveugles observés → sites du stock : le fichier de `src/` et la réf citée. Jamais `row` :
 *  la ligne du code citant dérive à chaque édition du fichier (c'est l'affaire des exemptions AU
 *  SITE, qui la nomment à dessein pour périmer au déplacement). */
export const sitesAveugles = (blind) => blind.map((b) => ({ file: b.file, ref: b.ref }))

/** Écart du volet : `{ neuves, perimees }`, phrases prêtes à afficher. */
export function ecartDesRefsAveugles(blind, stock) {
  // `STOCK_NOM` est hissé au module : dans une lib de garde, la porte de commit compte tout
  // objet-argument qui NOMME un fichier comme une entrée de stock nominatif.
  return ecartDuVolet({ sites: sitesAveugles(blind), stock, ou: STOCK_NOM })
}

const QUOI =
  'Réfs RAW AVEUGLES du CODE (`scripts/guards/lib/rawRefIntegrity.mjs`, #1318) : une réf ' +
  '`<ABRÉV> NN l.X` des citants de `src/**` dont la ou les lignes citées sont VIDES, et dont la fenêtre ' +
  '±`WINDOW` ne partage AUCUN mot signifiant avec le contexte du code qui cite. Une ENTRÉE par SITE, clé ' +
  '`fichier :: ref :: occurrence` (régime #1711) ; `fichier` = le fichier de `src/` qui cite, `ref` = la ' +
  'réf. Une entrée se solde en lisant le `Source/` et en réancrant la réf sur la ligne qui porte le ' +
  'passage ; le fichier se régénère par ' +
  '`npx tsx scripts/guards/lib/regenStock.mts scripts/guards/lib/rawRefIntegrity.mjs`, et un solde total ' +
  'le retire.'

/** La RÉGÉNÉRATION du stock des réfs aveugles (`RegenerationDeStock`, `stockDeSites.mjs`), sur des
 *  réfs aveugles (par défaut, celles de `src/**`). */
export const regenerations = (blind = scanBlindRefs()) => [{
  chemin: fileURLToPath(STOCK_PATH),
  politique: SOUS_LOT,
  horsCollections: QUOI,
  collections: [{ nom: 'entrees', sites: sitesAveugles(blind) }],
}]

/** Radicaux signifiants d'un texte : mots ≥ `minLen` lettres (accents repliés, minuscules), réduits
 *  à leur préfixe de `STEM_LEN` lettres — seule tolérance de forme (pluriel/dérivé), jamais un synonyme. */
export function significantWords(text, minLen = MIN_WORD_LEN) {
  const folded = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  return new Set((folded.match(/[a-z]+/g) || []).filter((w) => w.length >= minLen).map((w) => w.slice(0, STEM_LEN)))
}

/** Recouvrement lexical entre deux textes (au moins un mot signifiant commun). */
export function sharesSignificantWord(a, b, minLen = MIN_WORD_LEN) {
  const wa = significantWords(a, minLen)
  for (const w of significantWords(b, minLen)) if (wa.has(w)) return true
  return false
}

/** Fenêtre `[lo-w … hi+w]` (1-based, bornée) d'un tableau de lignes, jointe par espaces. */
export function windowText(lines, lo, hi, w = WINDOW) {
  const from = Math.max(1, lo - w)
  const to = Math.min(lines.length, hi + w)
  return lines.slice(from - 1, to).join(' ')
}

/** VERDICT PUR (aucun disque) d'une réf : `true` = à ROUGIR (lignes citées toutes vides ET aucun
 *  mot signifiant partagé entre la fenêtre du chapitre et le contexte porteur du code). */
export function isBlindRef(chapterLines, lo, hi, contextText, w = WINDOW, minLen = MIN_WORD_LEN) {
  if (lo < 1 || hi > chapterLines.length) return false // hors borne = domaine de check-code-refs
  for (let i = lo; i <= hi; i++) if (chapterLines[i - 1].trim() !== '') return false
  return !sharesSignificantWord(windowText(chapterLines, lo, hi, w), contextText, minLen)
}

/** Ancres JUGEABLES d'une réf : une PLAGE `-fin` reste UN intervalle `[lo,hi]` ; les autres formes
 *  (`+pts`, compacte `/n…`) sont des ancres DISTINCTES — chacune se juge seule, sinon `l.202/213`
 *  se lirait 202→213 et sa ligne 213 VIDE resterait invisible (#1318, défaut D5). */
function* anchorsOf(line, suffix) {
  if (isRangeSuffix(suffix)) { yield span(line, suffix); return }
  for (const n of refNums(line, suffix)) yield [n, n]
}

/** Réfs `<ABRÉV> NN l.X[-Y|+n…|/n…]` d'une ligne — `{ abbr, nn, lo, hi, ref }` (miroir de check-code-refs). */
export function* refsInLine(ln) {
  const re = refRe()
  let m
  while ((m = re.exec(ln))) {
    const nn = m[2]
    if (nn == null) continue
    const abbr = bookOf(m[1].replace(/\s+/g, ' ').trim())
    if (!abbr) continue
    for (const [lo, hi] of anchorsOf(m[3], m[4])) {
      yield { abbr, nn, lo, hi, ref: `${abbr} ${Number(nn)} l.${m[3]}${m[4]}` }
    }
  }
}

export const isExcludedSrc = (rel) => rel.startsWith(EXCLUDE_SRC_PREFIX) || SELF_FILES.includes(rel)

const _chapterLines = new Map() // path -> string[] (une lecture par chapitre)
function chapterLinesOf(path) {
  if (!_chapterLines.has(path)) _chapterLines.set(path, readText(path).split('\n'))
  return _chapterLines.get(path)
}

const isExempt = (hit) => SITE_EXEMPTIONS.some((e) => e.file === hit.file && e.row === hit.row && e.ref === hit.ref)

/** Scanne `srcDir` et retourne les réfs AVEUGLES : `{ file, row, ref, abbr, nn, lo, hi }`. */
export function scanBlindRefs(srcDir = SRC_DIR) {
  const blind = []
  for (const f of fichiersCitants(srcDir)) {
    const rel = f.split('\\').join('/')
    if (isExcludedSrc(rel)) continue
    const src = readFileSync(f, 'utf8').split('\n')
    src.forEach((ln, i) => {
      for (const { abbr, nn, lo, hi, ref } of refsInLine(ln)) {
        const cf = chapterFile(abbr, nn)
        if (!cf) continue // chapitre introuvable = domaine de check-code-refs
        const context = windowText(src, i + 1, i + 1)
        if (!isBlindRef(chapterLinesOf(cf.path), lo, hi, context)) continue
        const hit = { file: rel, row: i + 1, ref, abbr, nn, lo, hi }
        if (!isExempt(hit)) blind.push(hit)
      }
    })
  }
  return blind
}

/** File d'AUDIT (non gatée) : réfs pointant une ligne vide, groupées par réf, comptées par sites. */
export function scanEmptyLineRefs(srcDir = SRC_DIR) {
  const byRef = new Map()
  for (const f of fichiersCitants(srcDir)) {
    const rel = f.split('\\').join('/')
    if (isExcludedSrc(rel)) continue
    const src = readFileSync(f, 'utf8').split('\n')
    src.forEach((ln, i) => {
      for (const { abbr, nn, lo, hi, ref } of refsInLine(ln)) {
        const cf = chapterFile(abbr, nn)
        if (!cf) continue
        const lines = chapterLinesOf(cf.path)
        if (lo < 1 || hi > lines.length) continue
        let allEmpty = true
        for (let k = lo; k <= hi && allEmpty; k++) if (lines[k - 1].trim() !== '') allEmpty = false
        if (!allEmpty) continue
        const context = windowText(src, i + 1, i + 1)
        const overlap = sharesSignificantWord(windowText(lines, lo, hi), context)
        const cur = byRef.get(ref) || { ref, sites: 0, blind: 0, files: new Set() }
        cur.sites += 1
        if (!overlap) cur.blind += 1
        cur.files.add(`${rel}:${i + 1}`)
        byRef.set(ref, cur)
      }
    })
  }
  return [...byRef.values()].sort((a, b) => b.blind - a.blind || b.sites - a.sites)
}
