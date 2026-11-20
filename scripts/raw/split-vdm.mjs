// Découpe l'extraction Marker de « Les Vents de Magie » (livre NOUVEAU, sans structure ancienne à aligner)
// en 15 chapitres NN - Titre.md = les en-têtes majeurs du SOMMAIRE (chiffres romains I à XV). Conserve
// `*Pages PDF X*` en tête, retire les séparateurs de page `{N}----`. Usage : node scripts/raw/split-vdm.mjs
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { readText, sortieMarkerDe } from './_lib.mjs'
import { mdsDeMarker } from './lib/marker-pages.mjs'
import { nomAscii } from '../source/nom-ascii.mjs'
import { graphieDeChapitre, largeurDeChapitre, ligne1DePlage, plageEnTexte } from '../../src/data/source/decoupe.ts'
import { exigerRacineAtlas } from './lib/entree-atlas.mjs'

if (import.meta.main) exigerRacineAtlas()

/** Id du livre que ce découpeur sert (`src/data/books.json`). */
const LIVRE = 'vents-de-la-magie'
// Sortie Marker d'un tenant (`<sortie>/<pdf>/<pdf>.md`), lue par `mdsDeMarker`.
let SRC
try { [SRC] = mdsDeMarker(sortieMarkerDe(LIVRE)) } catch (e) { console.error(e.message); process.exit(1) }
// Tout nom ÉCRIT sous `Source/` passe par `nomAscii` (#1699) : un chemin non ASCII ne naît pas ici.
const OUT = nomAscii('Source/Warhammer v4 - Les Vents de Magie')

const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[*_`#]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()

// [titre de fichier, clé normalisée que l'en-tête de chapitre doit préfixer]
// Les ouvertures de chapitre portent les pastilles décoratives `• •` (parfois éclatées dans le titre) ;
// `norm` les réduit à des espaces → la clé matche le texte nu.
const CHAPTERS = [
  ['Contes de sorcellerie', 'contes de sorcellerie'],
  ["Révisions des règles d'incantation", 'revisions et nouvelles regles d incantation'],
  ['Travaux arcaniques', 'travaux arcaniques'],
  ['Hysh — Domaine de la Lumière', 'hysh'],
  ['Chamon — Domaine du Métal', 'chamon'],
  ['Ghyran — Domaine de la Vie', 'ghyran'],
  ['Azyr — Domaine des Cieux', 'azyr'],
  ['Ulgu — Domaine des Ombres', 'ulgu'],
  ['Shyish — Domaine de la Mort', 'shyish'],
  ['Aqshy — Domaine du Feu', 'aqshy'],
  ['Ghur — Domaine de la Bête', 'ghur'],
  ['Artefacts magiques', 'artefacts magiques'],
  ['Créatures magiques', 'creatures magiques'],
  ["Les Vents à l'œuvre", 'les vents a l'],
  ['Némésis et aventures magiques', 'nemesis et aventures magiques'],
]

const lines = readText(SRC).split('\n')
const PAGE_RE = /^\{(\d+)\}-{4,}/

// 1. ligne de chaque chapitre (en-tête `#…` préfixant la clé), recherche SÉQUENTIELLE (gère les doublons)
const startIdx = []
let cur = 0
for (const [title, key] of CHAPTERS) {
  let found = -1
  for (let i = cur; i < lines.length; i++) {
    if (/^#{1,6}\s/.test(lines[i]) && norm(lines[i]).startsWith(key)) { found = i; break }
  }
  if (found < 0) { console.error('CHAPITRE INTROUVABLE:', title); process.exit(1) }
  startIdx.push(found); cur = found + 1
}

// 2. page PDF d'une ligne = (dernier {N} <= ligne) + 1
const pageAt = (idx) => { let pg = 1; for (let i = 0; i <= idx && i < lines.length; i++) { const m = lines[i].match(PAGE_RE); if (m) pg = Number(m[1]) + 1 } return pg }

mkdirSync(OUT, { recursive: true })
// LARGEUR du dossier, arrêtée AVANT le premier fichier : tous les préfixes d'un livre la partagent.
const LARGEUR = largeurDeChapitre(CHAPTERS.length)
const idxRows = []
for (let c = 0; c < CHAPTERS.length; c++) {
  const [title] = CHAPTERS[c]
  const from = startIdx[c], to = c + 1 < CHAPTERS.length ? startIdx[c + 1] : lines.length
  const startPage = pageAt(from)
  let endPage = startPage
  for (let i = from; i < to; i++) { const m = lines[i].match(PAGE_RE); if (m) endPage = Number(m[1]) + 1 }
  const body = lines.slice(from, to).filter((l) => !PAGE_RE.test(l)).join('\n').trim()
  const span = plageEnTexte(startPage, endPage)
  const nn = graphieDeChapitre(c + 1, LARGEUR)
  const nom = nomAscii(`${nn} - ${title}.md`)
  writeFileSync(join(OUT, nom), `${ligne1DePlage(startPage, endPage)}\n\n${body}\n`)
  idxRows.push(`- [${nom.replace(/\.md$/, '')}](<${nom}>) — p.${span}`)
  console.log(`${nn} - ${title}  (p.${span}, ${to - from} lignes)`)
}
writeFileSync(join(OUT, '00 - Index.md'), `# Les Vents de Magie — Index\n\n${idxRows.join('\n')}\n`)
console.log(`\n${CHAPTERS.length} chapitres + index écrits dans ${OUT}`)
