// Découpe une extraction Marker PAGINÉE (séparateurs `{N}----`, N = page 0-indexée) en chapitres
// `NN - Titre.md`, alignés sur la structure des ANCIENS .md (mêmes noms de fichier + page de début).
// Frontières : TITRE-d'abord (on trouve l'en-tête de chapitre dans le markdown Marker au/après sa page
// de début) avec REPLI sur l'offset de page → gère les chapitres qui partagent une page.
// NOMMAGE : un titre d'ancien fichier qui est un nom de SIGNET Word (`_gjdgxs`, `Sans titre`) ne se
// recopie pas — le fichier de sortie prend le TITRE IMPRIMÉ (texte de l'en-tete Marker qui a
// matché) ; sans en-tête matché pour ce chapitre, le script ÉCHOUE en le nommant.
// Déballe aussi le HTML `<sup>` de Marker (`lib/marker-pages.mjs`, CONSIGNE de `deballerSup`).
// CONTRAT du parseur partagé : la lib LÈVE sur du texte avant le premier séparateur de page et sur
// une page extraite deux fois (l'ancien parseur local ignorait le premier et concaténait le second) ;
// et une page VIDE chez Marker mais PLEINE chez pypdf (page perdue) arrête le découpage.
// Usage : node scripts/raw/marker-split.mjs <id du livre> "<marker-paginé.md | dossier de tranches>" "<out-dir>"
// Les anciens `.md` sont ceux du `dir` du livre (`src/data/books.json`).
import { writeFileSync, mkdirSync } from 'node:fs'
import { listerDossier } from '../guards/lib/lister.mjs'
import { join } from 'node:path'
import { copieMarkerDe, livreExtraitDe, pdfRequisDe, readText } from './_lib.mjs'
import { graphieDuFichier, ligne1DePlage, numeroDuFichier, titreDuFichier } from '../../src/data/schemas/source/decoupe.ts'
import { mdsDeMarker, mdsDeRestitutions, pagesDeMarker, verifierExtraction, commandeRestitution } from './lib/marker-pages.mjs'
import { deballerSup } from './lib/titres.mjs'
import { nomAscii } from '../source/nom-ascii.mjs'
import { exigerRacineAtlas } from './lib/entree-atlas.mjs'

if (import.meta.main) exigerRacineAtlas()

const [idLivre, markerMd, outDirArg] = process.argv.slice(2)
if (!idLivre || !markerMd || !outDirArg) { console.error('args: <id du livre> <marker.md | dossier de tranches> <out-dir>'); process.exit(1) }
const livre = livreExtraitDe(idLivre)
if (!livre) { console.error(`LIVRE INCONNU AU REGISTRE : ${idLivre}`); process.exit(1) }
const bookDir = livre.dir
// Le PDF, référence des VÉRIFICATIONS d'extraction (couche texte pypdf des pages vides), vient du
// registre SEUL (`pdfRequisDe`, #1739) — jamais de vérification muette.
let pdfPath
try { pdfPath = pdfRequisDe(idLivre) } catch (e) { console.error(e.message); process.exit(1) }
// Tout nom ÉCRIT sous `Source/` passe par `nomAscii` (#1699) : un chemin non ASCII ne naît pas ici.
const outDir = nomAscii(outDirArg)

const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[*_`#]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()

// 1. chapitres depuis les anciens .md : nom de fichier + page de début (marqueur « Page PDF X »)
const chapters = listerDossier(bookDir)
  .filter((f) => numeroDuFichier(f) != null)
  .map((f) => {
    const nn = graphieDuFichier(f)
    const title = titreDuFichier(f)
    const m = readText(join(bookDir, f)).match(/[Pp]ages?\s+PDF\s+(\d+)/)
    return { nn, title, file: f, start: m ? Number(m[1]) : null, ntitle: norm(title) }
  })
  .filter((c) => c.start != null)
  .sort((a, b) => a.start - b.start || Number(a.nn) - Number(b.nn))

// 2. markdown Marker → pages par la lib partagée (parseur UNIQUE, aussi consommé par
// `split-wfrp5.mjs`) : un `.md` d'un tenant OU un dossier de tranches `--page_range`.
let pageText, verif
try {
  pageText = pagesDeMarker(mdsDeMarker(markerMd))
  // MÊME vigilance que `split-wfrp5.mjs` (bloc partagé `verifierExtraction`) : restitutions ciblées
  // fusionnées, pages manquantes averties, pages perdues refusées.
  const restitutions = pagesDeMarker(mdsDeRestitutions(markerMd))
  verif = verifierExtraction(pageText, { pdfPath, restitutions })
  pageText = verif.pages
} catch (e) { console.error(e.message); process.exit(1) }
for (const pg of verif.manquantes) console.warn(`page ${pg} absente de l'extraction (page sans texte ?)`)
if (verif.perdues.length) {
  console.error(`PAGES PERDUES : ${verif.perdues.length} page(s) vide(s) chez Marker alors que le PDF en porte du texte — ré-extraire CHACUNE avant de découper :`)
  // Marker lit la COPIE DE TRAVAIL (`copieMarkerDe`, posée par la CLI de la couture).
  const pourMarker = copieMarkerDe(idLivre)
  console.error(`  (copie de travail : node scripts/raw/pdf-de.mjs --copie-marker ${idLivre})`)
  for (const { page, pypdf } of verif.perdues) {
    console.error(`  page ${page} (pypdf : ${pypdf} caractères)`)
    console.error(`    ${commandeRestitution(pourMarker, markerMd, page)}`)
  }
  process.exit(1)
}
const orderedPages = [...pageText.keys()].sort((a, b) => a - b)
const lastPage = orderedPages[orderedPages.length - 1] || 0
let concat = ''; const pageOff = new Map()
for (const pg of orderedPages) { pageOff.set(pg, concat.length); concat += pageText.get(pg) }
if (chapters.length && chapters[chapters.length - 1].start > lastPage) {
  console.error(`DERNIER CHAPITRE HORS EXTRACTION : ${chapters[chapters.length - 1].file} ouvre p.${chapters[chapters.length - 1].start} (${lastPage} pages extraites)`)
  process.exit(1)
}
const offsetOfPage = (p) => { // offset du début de la 1re page ≥ p
  for (const pg of orderedPages) if (pg >= p) return pageOff.get(pg)
  return concat.length
}

// 3. tous les en-têtes du markdown Marker (offset + texte normalisé)
const heads = []
{ const re = /^#{1,6}\s+(.*\S)\s*$/gm; let m; while ((m = re.exec(concat))) heads.push({ off: m.index, h: norm(m[1]), texte: m[1] }) }

// 4. offset de chaque chapitre : 1er en-tête (au/après sa page) qui matche son titre ; sinon repli page
for (const c of chapters) {
  const from = offsetOfPage(c.start) - 200 // petite marge (titre parfois en bas de page précédente)
  let best = null
  for (const hd of heads) {
    if (hd.off < from) continue
    if (hd.h === c.ntitle || (c.ntitle.length > 4 && (hd.h.includes(c.ntitle) || c.ntitle.includes(hd.h)))) { best = hd; break }
  }
  c.offset = best ? best.off : offsetOfPage(c.start)
  c.matched = best != null
  c.headTexte = best ? best.texte : null
}

// 4bis. nom de sortie : le titre de l'ancien fichier, SAUF quand c'est un nom de signet Word — le
// fichier prend alors le titre IMPRIMÉ de l'en-tête Marker qui a matché (jamais « Sans titre »).
const estSignet = (t) => /^_/.test(t) || /^Sans titre$/i.test(t)
// Les pastilles `•` des titres imprimés (`# • **RULES** •`) partent AVEC les étoiles : sinon le nom
// de fichier porte U+2022 et `nomAscii` lève en désignant sa table fermée.
const titreImprime = (s) => s.replace(/<[^>]*>/g, '').replace(/[#*`•]/g, '').replace(/\s+/g, ' ').trim()
for (const c of chapters) {
  if (!estSignet(c.title)) { c.outFile = c.file; continue }
  const imprime = c.headTexte ? titreImprime(c.headTexte) : ''
  if (!imprime) {
    console.error(`CHAPITRE ${c.nn} : titre de signet Word « ${c.title} » et AUCUN en-tête Marker matché — nommage impossible`)
    process.exit(1)
  }
  c.outFile = `${c.nn} - ${imprime}.md`
  console.log(`nommage : ${c.file} → ${c.outFile} (titre imprimé)`)
}

// 5. fin de page (pour le marqueur) par ordre de page de début
for (let i = 0; i < chapters.length; i++) chapters[i].endPage = i + 1 < chapters.length ? chapters[i + 1].start - 1 : lastPage

// 6. découpe par offset croissant (gère même-page : chaque titre a son offset)
const byOff = [...chapters].sort((a, b) => a.offset - b.offset)
mkdirSync(outDir, { recursive: true })
const empties = []
for (let i = 0; i < byOff.length; i++) {
  const c = byOff[i], next = byOff[i + 1]
  let body = deballerSup(concat.slice(c.offset, next ? next.offset : undefined).trim())
  if (body.replace(/[#*\s]/g, '').length < 80) { // vide réel (artefact ou chapitre même-page absorbé par le voisin)
    empties.push(c.nn)
    body = `# ${titreDuFichier(c.outFile)}\n\n*(Page ${c.start} partagée avec un chapitre voisin — le contenu de cette section figure dans le chapitre adjacent de l'extraction Marker.)*`
  }
  writeFileSync(join(outDir, nomAscii(c.outFile)), `${ligne1DePlage(c.start, Math.max(c.start, c.endPage))}\n\n${body}\n`)
}
const miss = chapters.filter((c) => !c.matched).map((c) => c.nn)
console.log(`${byOff.length} chapitres écrits dans ${outDir}`)
console.log(`repli-page (titre non trouvé) : ${miss.length} → ${miss.join(', ')}`)
console.log(`stubs vides (même-page/artefact) : ${empties.length} → ${empties.join(', ')}`)
