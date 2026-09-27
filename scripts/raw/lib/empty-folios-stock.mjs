// Générateur des DEUX stocks triés des ancres SANS CONTENU (#1457 lot A1, mis à la forme nominative
// #1727 T2) — `scripts/raw/empty-folios-perdues-stock.json` et `…-benignes-stock.json`.
// Le détecteur (`check-folio-continuity.mjs#scanAllEmptyFolios`) dit QUELLES pages n'ont aucun
// contenu dans le `.md` ; il ne peut pas dire si la page en avait. Le TRI est fait ICI, au PDF du
// livre (`pdfDuSigle` de `_lib.mjs`, pypdf via `lib/pdf-extract.py`, offset K = folio + offset du livre) :
//   - la page PDF porte du texte utile  → PERDUE (la vérité citable manque au corpus) ;
//   - la page PDF n'en porte pas        → BÉNIGNE (pleine page d'illustration, page blanche).
// Le tri est donc STRUCTUREL (mesuré), jamais une liste d'exceptions à la main.
// Le PDF n'est lu QU'ICI, et AUCUN PDF n'est suivi par le dépôt (`git ls-files "*.pdf"` = 0) :
// l'observé de la CLASSE n'est donc PAS rejouable en CI. `pdfChars` est une mesure TRANSPORTÉE,
// gravée dans l'entrée comme preuve au dossier ; la garde CI consomme les JSON commités et ne
// vérifie cette mesure que contre `SEUIL_UTILE` (aucune dépendance python).
// DEUX fichiers, et pas deux rubriques d'un seul : un reclassement `perdues → bénignes` est alors
// `-1` chez l'un et `+1` chez l'autre, donc une CROISSANCE NETTE que `croissanceDesStocks`
// (`guards/lib/stocksNominatifs.mjs`) voit et qui exige un `CLIQUET:` au message. Dans UN seul
// fichier, le même geste est net 0 — invisible aux deux portes (sonde du 2026-09-14 : `[]` à un
// fichier, `net 1` à deux).
// Re-run : node scripts/raw/lib/empty-folios-stock.mjs [--seuil N] [--dry]
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { BOOKS, pdfDuSigle } from '../_lib.mjs'
import { EMPTY_BENIGNES_PATH, EMPTY_PERDUES_PATH, SEUIL_UTILE, entreesDAncresVides, scanEmptyFoliosInBook } from '../check-folio-continuity.mjs'
import { resolveBookOffset, HAS_LOWER_RE } from '../anchor-fill.mjs'
import { extractPages } from './pdf-extract.mjs'
import { parUnitesDeCode } from '../../guards/lib/lister.mjs'
import { texteDeStock } from '../stockNominatif.mjs'

// Caractères utiles d'une page PDF : lignes portant un MOT réel (3 minuscules consécutives —
// critère de `anchor-fill.mjs`, qui écarte titre courant, numéro de folio et codes de chapitre),
// espaces retirés.
export function caracteresUtiles(pageText) {
  if (!pageText) return 0
  return pageText
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => HAS_LOWER_RE.test(l))
    .join('')
    .replace(/\s+/g, '')
    .length
}

/** Mesure un livre : `{ abbr, ok, reason?, mesures:[{ ...candidat, pdfChars }] }`. */
export function mesurerLivre(abbr, dir, { extract = extractPages } = {}) {
  const candidats = scanEmptyFoliosInBook(abbr, dir)
  if (!candidats.length) return { abbr, ok: true, mesures: [] }
  const off = resolveBookOffset(dir)
  if (!off.ok) return { abbr, ok: false, reason: off.reason, mesures: [] }
  let pdfPath
  try { pdfPath = pdfDuSigle(abbr) } catch (e) { return { abbr, ok: false, reason: e.message, mesures: [] } }
  const pages = extract(pdfPath, [...new Set(candidats.map((c) => c.folio + off.offset))])
  const mesures = candidats.map((c) => ({ ...c, pdfChars: caracteresUtiles(pages.get(c.folio + off.offset)) }))
  return { abbr, ok: true, offset: off.offset, mesures }
}

/** Trie des mesures en `{ perdues, benignes }` (entrées nominatives `{ fichier, ref, occurrence }` de
 *  `entreesDAncresVides`, augmentées du `pdfChars` TRANSPORTÉ ; ligne exclue : elle dérive).
 *  L'occurrence se calcule sur TOUTES les mesures, avant le tri : elle nomme le site, pas la classe. */
export function trier(mesures, seuil = SEUIL_UTILE) {
  const entrees = entreesDAncresVides(mesures)
    .map(({ fichier, ref, occurrence }, i) => ({ fichier, ref, occurrence, pdfChars: mesures[i].pdfChars }))
  return {
    perdues: entrees.filter((e) => e.pdfChars > seuil),
    benignes: entrees.filter((e) => e.pdfChars <= seuil),
  }
}

/** Ce que chaque stock DIT de lui-même (champ `quoi` de la forme `stockNominatif.mjs` — un JSON ne
 *  porte pas de commentaire, et une dette qui ne dit pas ce qu'elle est ne se solde pas). */
export const QUOI = {
  perdues: "Ancres sans contenu dont la page PORTE du texte au PDF : la vérité citable manque au corpus. Une ENTRÉE par folio perdu (`<ABBR NN> folio <F>`), sous le chapitre extrait qui le porte. `pdfChars` = les caractères utiles mesurés au PDF par scripts/raw/lib/empty-folios-stock.mjs, une fois : AUCUN PDF n'est suivi par le dépôt, l'observé de la classe n'est donc PAS rejouable en CI — la garde ne confronte cette mesure qu'au seuil SEUIL_UTILE du code. Une entrée se solde en restituant la page au `.md` (l'ancre cesse alors d'être vide, et scripts/raw/check-folio-continuity.mjs réclame le retrait). Passer une entrée d'ici vers empty-folios-benignes-stock.json est une CROISSANCE nette de l'autre fichier : elle se déclare par `CLIQUET:` au message.",
  benignes: "Ancres sans contenu dont la page ne porte PAS de texte au PDF (pleine page d'illustration, page blanche) : rien ne manque au corpus. Une ENTRÉE par folio (`<ABBR NN> folio <F>`), sous le chapitre extrait qui le porte. Même contrat de mesure et même remise que empty-folios-perdues-stock.json, dont ce fichier est le pendant : un folio classé ici alors que son `pdfChars` dépasse le seuil est refusé par `malClassees`.",
}

/** Les DEUX stocks triés, chemin → texte. ÉCRITURE en une seule définition : le générateur au PDF et
 *  tout transport de la donnée passent par ici, donc rendent le même octet. */
export function stocksEnTexte(mesures, seuil = SEUIL_UTILE) {
  const { perdues, benignes } = trier(mesures, seuil)
  return new Map([
    [EMPTY_PERDUES_PATH, texteDeStock(QUOI.perdues, perdues)],
    [EMPTY_BENIGNES_PATH, texteDeStock(QUOI.benignes, benignes)],
  ])
}

function main() {
  const args = process.argv.slice(2)
  const seuilIdx = args.indexOf('--seuil')
  const seuil = seuilIdx >= 0 ? Number(args[seuilIdx + 1]) : SEUIL_UTILE
  const dry = args.includes('--dry')

  const toutes = []
  for (const [abbr, dir] of BOOKS) {
    const r = mesurerLivre(abbr, dir)
    if (!r.ok) { console.log(`## ${abbr} — NON TRIABLE (${r.reason}) : ${scanEmptyFoliosInBook(abbr, dir).length} candidat(s)`); continue }
    toutes.push(...r.mesures)
  }
  toutes.sort((a, b) => parUnitesDeCode(a.ref, b.ref) || a.folio - b.folio)
  const { perdues, benignes } = trier(toutes, seuil)

  console.log(`candidats mesurés : ${toutes.length} — PERDUES ${perdues.length} · bénignes ${benignes.length} (seuil ${seuil} caractères utiles au PDF)`)
  console.log('distribution (caractères utiles au PDF, trié) :')
  console.log(`  ${toutes.map((m) => m.pdfChars).sort((a, b) => a - b).join(' ')}`)
  for (const m of toutes) {
    console.log(`${m.pdfChars > seuil ? 'PERDUE ' : 'bénigne'} ${m.ref} (${m.file}) folio ${m.folio} l.${m.line} — ${m.pdfChars} car.`)
  }
  if (dry) { console.log('(--dry : rien écrit)'); return }
  for (const [chemin, texte] of stocksEnTexte(toutes, seuil)) {
    writeFileSync(chemin, texte, 'utf8')
    console.log(`écrit : ${chemin}`)
  }
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) main()
