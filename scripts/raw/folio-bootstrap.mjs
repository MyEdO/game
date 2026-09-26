// Amorce l'ancrage folio d'un livre VIERGE — aucun `<span … data-folio>` (#833, cas VDM).
// `anchor-fill.mjs` DÉRIVE l'offset id↔folio des ancres déjà posées : sur un livre sans la moindre
// ancre il n'a rien à dériver. Ce script fournit l'amorce manquante :
//   1. il LIT le folio imprimé sur chaque page du PDF (pdfminer via `lib/pdf-lignes.py`, lecteur de
//      `anchor-fill.mjs`) — le folio est un nombre nu isolé en tête ou en pied de la page ;
//   2. il en déduit `offset = K − folio` (K = index de page 0-based = numéro d'id Marker) et EXIGE
//      qu'il soit constant sur toutes les pages folioées (une seule valeur, sinon abandon) ;
//   3. il délègue la pose à `runBook()` d'`anchor-fill.mjs` — même convention d'ancre
//      `<span id="page-K-0" data-folio="F"></span>`, même alignement conservateur (match unique
//      exigé, sinon skip rapporté), ancres nues Marker complétées en place ;
//   4. il régénère `00 - Index.md` en TOC à folios (`— folio N`, format des livres déjà bakés).
//
// Entrée  : <ABBR> de `books.json` (dossier `Source/…` associé) ; le PDF du livre vient de
//           `pdfDuSigle` (`_lib.mjs`, champ `pdf`), SEULE source du PDF (#1739).
// Sortie  : table des folios lus (K → folio, en runs) + rapport de pose d'`anchor-fill` ; `--apply`
//           écrit les `.md` et l'index, sinon rapport seul.
// Usage   : node scripts/raw/folio-bootstrap.mjs <ABBR> [--apply]
import { writeFileSync } from 'node:fs'
import { listerDossier } from '../guards/lib/lister.mjs'
import { join, resolve, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import { livreDuSigle, pdfDuSigle, readText } from './_lib.mjs'
import { numeroDuFichier, plageDeLigne1, titreDuFichier } from '../../src/data/source/decoupe.ts'
import { lireBoites, pagesEnLignes, runBook } from './anchor-fill.mjs'

const FOLIO_LINE_RE = /^(\d{1,4})$/
const EDGE_LINES = 4             // profondeur de recherche du folio en tête et en pied de page

// Plage de pages (K, index 0-based) réellement couverte par les chapitres du livre, lue dans
// leurs en-têtes `*Pages PDF N[-M]*`. Les pages HORS de cette plage (couverture, gardes, cartes de
// fin) ne portent pas la pagination du corps — leurs nombres nus (légendes de carte) sont du bruit.
export function corpusRange(dir) {
  let lo = Infinity
  let hi = -Infinity
  for (const file of listerDossier(dir).filter((f) => numeroDuFichier(f) != null)) {
    const plage = plageDeLigne1(readText(join(dir, file)).split('\n')[0] || '')
    if (!plage) continue
    lo = Math.min(lo, plage.page - 1)
    hi = Math.max(hi, plage.pageFin - 1)
  }
  return lo <= hi ? { lo, hi } : null
}

// Folio IMPRIMÉ d'une page : le SEUL nombre nu non nul (ligne réduite à des chiffres) de TOUTE la
// page, à condition qu'il figure dans les `EDGE_LINES` premières ou dernières lignes non vides.
// Deux nombres nus DISTINCTS sur la page (bandeau de double page, qui imprime les DEUX folios de la
// planche sur chacune de ses pages ; cellule de table `d10`) rendent la lecture ambiguë : dans ce
// cas, comme sur une planche pleine page, le retour est `null` — page non lue, jamais une valeur
// devinée. Le même nombre lu en tête ET en pied reste univoque. `0` est écarté des candidats ET de
// l'ensemble d'ambiguïté : une cellule `0` ne rend pas la page muette, une cellule `1` si.
// La lecture d'une page SANS folio imprimé qui porte un unique nombre nu à ses bords est RENDUE
// telle quelle (rien ne la distingue ici) ; c'est l'unicité de l'offset dans `resolveOffsetFromPdf`
// qui la récuse.
export function readPrintedFolio(pageText) {
  if (!pageText) return null
  const lines = pageText.split('\n').map((l) => l.trim()).filter(Boolean)
  const nus = (ls) => ls.map((l) => FOLIO_LINE_RE.exec(l)).filter(Boolean).map((m) => Number(m[1])).filter((n) => n > 0)
  const distincts = [...new Set(nus(lines))]
  if (distincts.length !== 1) return null
  const bords = new Set(nus([...lines.slice(0, EDGE_LINES), ...lines.slice(-EDGE_LINES)]))
  return bords.has(distincts[0]) ? distincts[0] : null
}

/** Texte d'une page pour `readPrintedFolio` : ses lignes pdfminer du HAUT vers le BAS de la page
 *  (y décroissant, puis x), une par ligne — la tête et le pied de page aux bords du texte. PURE. */
export function texteDePage(lignesDeLaPage) {
  return [...lignesDeLaPage].sort((a, b) => b.y0 - a.y0 || a.x0 - b.x0).map((l) => l.texte).join('\n')
}

// Offset K−folio du livre. `ok:false` si aucune page folioée, ou si l'offset n'est pas unique
// (livre à pagination composite : la pose au jugé est refusée, jamais rattrapée par une majorité).
export function resolveOffsetFromPdf(pages) {
  const reads = []
  for (const [k, text] of pages) {
    const folio = readPrintedFolio(text)
    if (folio != null) reads.push({ k, folio, offset: k - folio })
  }
  if (!reads.length) return { ok: false, reason: 'aucun folio imprimé lisible dans le PDF' }
  const byOffset = new Map()
  for (const r of reads) byOffset.set(r.offset, (byOffset.get(r.offset) ?? 0) + 1)
  const sorted = [...byOffset.entries()].sort((a, b) => b[1] - a[1])
  if (sorted.length > 1) {
    const detail = sorted.map(([o, n]) => `${o} (${n} page(s))`).join(', ')
    return { ok: false, reason: `offset K−folio non unique : ${detail}`, reads }
  }
  return { ok: true, offset: sorted[0][0], reads }
}

// Compacte une suite de lectures en runs `K a→b = folio c→d` (rapport lisible sur 200+ pages).
export function folioRuns(reads) {
  const runs = []
  for (const r of reads) {
    const last = runs[runs.length - 1]
    if (last && r.k === last.kTo + 1 && r.folio === last.folioTo + 1) { last.kTo = r.k; last.folioTo = r.folio; continue }
    runs.push({ kFrom: r.k, kTo: r.k, folioFrom: r.folio, folioTo: r.folio })
  }
  return runs
}

// TOC à folios : un chapitre → son PREMIER `data-folio` (format des livres déjà bakés, `— folio N`).
// Nom distinct de `reanchor.mjs#buildIndex` (index ligne/offset d'un texte) : même famille de
// fichiers, sens sans rapport.
export function buildFolioToc(dir, title) {
  const files = listerDossier(dir).filter((f) => numeroDuFichier(f) != null)
  const rows = []
  for (const file of files) {
    const m = /data-folio="(\d+)"/.exec(readText(join(dir, file)))
    const label = titreDuFichier(file)
    rows.push(`- [${label}](<${file}>)${m ? ` — folio ${m[1]}` : ''}`)
  }
  return `# ${title} — Index\n\n${rows.join('\n')}\n`
}

function main() {
  const args = process.argv.slice(2)
  const abbr = args.find((a) => !a.startsWith('--'))
  const apply = args.includes('--apply')
  if (!abbr) {
    console.log('Usage: node scripts/raw/folio-bootstrap.mjs <ABBR> [--apply]')
    process.exitCode = 1
    return
  }
  const dir = livreDuSigle(abbr)?.dir
  if (!dir) { console.log(`abréviation inconnue de books.json : ${abbr}`); process.exitCode = 1; return }
  let pdfPath
  try { pdfPath = pdfDuSigle(abbr) } catch (e) { console.log(e.message); process.exitCode = 1; return }

  const corpus = corpusRange(dir)
  if (!corpus) { console.log(`aucun en-tête \`*Pages PDF N[-M]*\` dans ${dir}`); process.exitCode = 1; return }
  const boites = lireBoites(livreDuSigle(abbr).id)
  const all = [...pagesEnLignes(null, boites)].map(([k, ls]) => [k, texteDePage(ls)]).sort((a, b) => a[0] - b[0])
  const present = all.filter(([k]) => k >= corpus.lo && k <= corpus.hi)
  console.log(`## ${abbr} — ${basename(pdfPath)} : ${all.length} pages, corpus K ${corpus.lo}–${corpus.hi} (${present.length} pages)`)

  const off = resolveOffsetFromPdf(present)
  if (!off.ok) { console.log(`ABANDON — ${off.reason}`); process.exitCode = 1; return }
  const unread = present.filter(([k]) => !off.reads.some((r) => r.k === k)).map(([k]) => k)
  console.log(`offset K−folio = ${off.offset} (LU sur ${off.reads.length}/${present.length} pages)`)
  console.log('folios lus :')
  for (const r of folioRuns(off.reads)) {
    console.log(`  K ${r.kFrom}${r.kTo > r.kFrom ? `–${r.kTo}` : ''} → folio ${r.folioFrom}${r.folioTo > r.folioFrom ? `–${r.folioTo}` : ''}`)
  }
  if (unread.length) console.log(`pages sans folio imprimé lisible (K) : ${unread.join(', ')}`)

  const result = runBook(abbr, { apply, offset: off.offset, boites })
  if (!result.ok) { console.log(`ABANDON — ${result.reason}`); process.exitCode = 1; return }
  let placed = 0, completed = 0, skipped = 0
  for (const c of result.chapters) {
    if (!c.range) { console.log(`- ${c.file} : pas d'en-tête \`*Pages PDF N[-M]*\``); continue }
    placed += c.placed.length; completed += c.completed.length; skipped += c.skipped.length
    const slid = c.placed.filter((p) => p.slide > 0)
    console.log(`- ${c.file} : ✅ ${c.placed.length} · 🔗 ${c.completed.length} · ⏭️ ${c.skipped.length} · déjà là ${c.alreadyCount}`)
    for (const p of slid) console.log(`    ↘️ folio ${p.folio} (l.${p.line}) — ancré sur le candidat décalé de ${p.slide} ligne(s) de tête`)
    for (const s of c.skipped) console.log(`    ❌ folio ${s.folio} — ${s.reason}`)
  }
  console.log(`**Bilan ${abbr} : ✅ ${placed} posées · 🔗 ${completed} complétées · ⏭️ ${skipped} sautées**`)

  if (apply) {
    const title = basename(dir).replace(/^Warhammer v4 - |^WH - V4 - /, '')
    writeFileSync(join(dir, '00 - Index.md'), buildFolioToc(dir, title))
    console.log(`index réécrit : ${join(dir, '00 - Index.md')}`)
  } else {
    console.log('(--dry par défaut : relancer avec --apply pour écrire)')
  }
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) main()
