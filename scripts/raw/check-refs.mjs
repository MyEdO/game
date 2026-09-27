// Garde de cohérence des lignes citées par l'Atlas RAW (#454, défaut C).
// Pour chaque réf `<ABRÉV> NN l.X[-Y|+n…]` de docs/raw/*.md, résout le fichier-chapitre
// (`chapterFile`, _lib.mjs) et vérifie que la borne haute de la plage ne dépasse pas le nombre
// de lignes du fichier. Un livre/chapitre INTROUVABLE n'est pas le sujet ici (Sens A de
// reconcile.mjs) — seul un chapitre TROUVÉ dont la ligne est HORS BORNE est une réf morte.
// Cliquet NOMINATIF PAR SITE (`scripts/raw/dead-refs-stock.json`, écart `ecartDuVolet` de
// `scripts/guards/lib/stock.mjs`, clé `fiche :: réf citée :: occurrence`) : un site NEUF est une régression à
// corriger ou à déclarer, une entrée dont le site a disparu est une dette SOLDÉE à retirer. Le stock
// est ABSENT en régime nominal → tolérance ZÉRO (`readStock` traite un fichier absent comme zéro
// entrée). S'il renaît, il se recrée à sa mesure MINIMALE, chaque entrée portant son lot et sa date.
// Re-run : node scripts/raw/check-refs.mjs
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { refRe, span, chapterFile, bookOf, pagesDeLAtlas, readText } from './_lib.mjs'
import { ecartDuVolet } from '../guards/lib/stock.mjs'
import { readStock } from './stockNominatif.mjs'

export const RAWDIR = 'docs/raw'
// Acceptation DÉCLARÉE à la couture : tout sauf les rapports générés — une réf morte est une réf
// morte, qu'elle soit lue dans une fiche, un catalogue, une page d'auteur ou une épreuve datée.
export const CLASSES = ['fiche', 'catalogue', 'auteur', 'epreuve']
export const STOCK_PATH = join(dirname(fileURLToPath(import.meta.url)), 'dead-refs-stock.json')
// Sites morts observés → sites du stock : la FICHE où la réf est lue (chemin depuis la racine du
// dépôt, c'est lui que la porte de plage reconnaît) et la réf citée, borne HAUTE comprise.
export const sitesMorts = (dead, rawDir = RAWDIR) => dead.map((d) => ({ file: `${rawDir}/${d.doc}`, ref: `${d.ref} l.${d.hi}` }))

// Réfs `<ABRÉV> NN l.X…` d'une ligne, tous livres — génère `{ abbr, nn, hi }` (borne haute de la
// plage dépliée par `span`). Graphie UNIQUE `refRe` (_lib.mjs).
function* refsInLine(ln) {
  const re = refRe()
  let m
  while ((m = re.exec(ln))) {
    const nn = m[2]
    if (nn == null) continue // pas de chapitre → hors sujet (réf de livre entier, pas de fichier à borner)
    const abbr = bookOf(m[1].replace(/\s+/g, ' ').trim())
    const [, hi] = span(m[3], m[4])
    yield { abbr, nn, hi }
  }
}

const lineCountCache = new Map()
function lineCount(path) {
  if (!lineCountCache.has(path)) lineCountCache.set(path, readText(path).split('\n').length)
  return lineCountCache.get(path)
}

/** Parcourt `rawDir` (docs/raw par défaut) et retourne les réfs mortes : `{ doc, row, ref, hi, chapterLines, file }`. */
export function scanDeadRefs(rawDir = RAWDIR, classes = CLASSES) {
  const dead = []
  for (const { relatif: doc, chemin } of pagesDeLAtlas(rawDir, { classes })) {
    const lines = readText(chemin).split('\n')
    lines.forEach((ln, i) => {
      for (const { abbr, nn, hi } of refsInLine(ln)) {
        const cf = chapterFile(abbr, nn)
        if (!cf) continue // livre/chapitre introuvable : hors sujet (Sens A de reconcile.mjs)
        const chapterLines = lineCount(cf.path)
        if (hi > chapterLines) dead.push({ doc, row: i + 1, ref: `${abbr} ${Number(nn)}`, hi, chapterLines, file: cf.file })
      }
    })
  }
  return dead
}

function main() {
  const dead = scanDeadRefs()
  const { neuves, perimees } = ecartDuVolet({
    sites: sitesMorts(dead), stock: readStock(STOCK_PATH), ou: 'dead-refs-stock.json',
  })

  console.log(`refs mortes (ligne hors borne du chapitre résolu) : ${dead.length} site(s)`)

  if (neuves.length) {
    console.log('RÉGRESSION — site(s) de réf morte hors du stock :')
    for (const o of neuves) console.log(`  ${o}`)
  }
  if (perimees.length) {
    console.log('Entrée(s) SOLDÉE(s) (réfs réparées) :')
    for (const s of perimees) console.log(`  ${s}`)
  }
  if (!neuves.length && !perimees.length) {
    console.log('OK — cliquet aligné, aucune régression.')
    return
  }
  console.log('Détail (fichier:ligne — réf morte, le chapitre a N lignes) :')
  for (const d of dead) console.log(`docs/raw/${d.doc}:${d.row} — ${d.ref} l.${d.hi} (${d.file} a ${d.chapterLines} lignes)`)
  process.exitCode = 1
}

if (import.meta.main) main()
