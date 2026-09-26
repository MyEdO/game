// Garde de cohérence des lignes citées par le CODE (suite #434/#487, prévention).
// `check-refs.mjs` borne les réfs des DOCS (docs/raw) ; rien ne couvrait celles du CODE — vécu :
// `LDB 60 l.92` cité dans un chapitre de 62 lignes. Ici : pour chaque réf `<ABRÉV> NN l.X[-Y|+n…]`
// de `src/**` (.ts/.tsx/.json, hors node_modules, hors `src/gameIso/rig/parts/tenues/defs/` — même
// périmètre que le générateur `build-implemente`), résout le fichier-chapitre (`chapterFile`, _lib.mjs)
// et signale la réf dont la borne haute dépasse le nombre de lignes du chapitre, OU dont le chapitre
// est introuvable. Regex de réfs RÉUTILISÉE (`refRe`/`span`/`bookOf`) — jamais réécrite.
// Cliquet NOMINATIF (`scripts/raw/dead-code-refs-stock.json`, écart calculé par `ecartDuVolet` de
// `scripts/guards/lib/stock.mjs`, forme de `reconciliation-stock.json`) : une ENTRÉE par site, et les deux
// sens échouent — un site NEUF est une régression à corriger ou à déclarer, une entrée dont le site
// a disparu est une dette SOLDÉE à retirer. Un nombre relevé dans un fichier de compte est net 0 à la
// porte de plage ; une entrée ajoutée est une croissance qui se déclare (`stocksNominatifs.mjs`).
// DEUXIÈME contrôle, même parcours (#1457 G1) : la ligne citée doit être NON VIDE. Une réf dans les
// bornes peut pointer sur du blanc après une ré-extraction / une restitution de folio (vécu : le folio
// 88 de LDB 08 a décalé la fin du chapitre de +44 lignes, 7 réfs committées tombées sur du vide ou sur
// un autre paragraphe). Stock PROPRE (`scripts/raw/empty-line-code-refs-stock.json`, même écart) pour
// que l'un des deux contrôles ne dilue pas la tolérance de l'autre.
// Les deux stocks sont soldés (#583, #1898) : leurs fichiers sont ABSENTS en régime nominal → tolérance
// ZÉRO (tout site échoue nominativement, `readStock` traite un fichier absent comme zéro entrée). Si un
// résidu IRRÉDUCTIBLE réapparaît, son stock se recrée à sa mesure MINIMALE, chaque entrée portant son
// lot et sa date — jamais un cliquet tacite qui masque une future régression.
// Re-run : node scripts/raw/check-code-refs.mjs (npm run raw:check-code-refs).
import { readFileSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { refRe, span, chapterFile, bookOf, readText } from './_lib.mjs'
import { ecartDuVolet } from '../guards/lib/stock.mjs'
import { readStock } from './stockNominatif.mjs'
import { fichiersCitants } from './lib/fichiersCitants.mjs'

export const SRC_DIR = 'src'
export const EXCLUDE_SRC_PREFIX = 'src/gameIso/rig/parts/tenues/defs/' // art de couverture, pas une règle (cf. build-implemente)
export const STOCK_PATH = join(dirname(fileURLToPath(import.meta.url)), 'dead-code-refs-stock.json')
export const EMPTY_LINE_STOCK_PATH = join(dirname(fileURLToPath(import.meta.url)), 'empty-line-code-refs-stock.json')

// Réfs `<ABRÉV> NN l.X…` d'une ligne, tous livres — `{ abbr, nn, lo, hi }` (plage dépliée par
// `span`). Réfs de livre entier (sans numéro de chapitre) = hors sujet (aucun fichier à borner).
// Miroir de `refsInLine` de check-refs.mjs, même graphie unique `refRe` (_lib.mjs).
function* refsInLine(ln) {
  const re = refRe()
  let m
  while ((m = re.exec(ln))) {
    const nn = m[2]
    if (nn == null) continue
    const abbr = bookOf(m[1].replace(/\s+/g, ' ').trim())
    if (!abbr) continue
    const [lo, hi] = span(m[3], m[4])
    yield { abbr, nn, lo, hi }
  }
}

const chapterTextCache = new Map()
function chapterLinesOf(path) {
  if (!chapterTextCache.has(path)) chapterTextCache.set(path, readText(path).split('\n'))
  return chapterTextCache.get(path)
}
function lineCount(path) {
  return chapterLinesOf(path).length
}

export const isExcludedSrc = (rel) => rel.startsWith(EXCLUDE_SRC_PREFIX)

/** Parcourt `srcDir` (src/ par défaut) et retourne les réfs mortes du code :
 *  `{ file, row, ref, abbr, nn, hi, kind, chapterLines?, chapterFile? }`.
 *  `kind` ∈ `out-of-bounds` (chapitre résolu, ligne hors borne) | `chapter-not-found` (chapitre absent). */
export function scanDeadCodeRefs(srcDir = SRC_DIR) {
  const dead = []
  for (const f of fichiersCitants(srcDir)) {
    const rel = f.split('\\').join('/')
    if (isExcludedSrc(rel)) continue
    const lines = readFileSync(f, 'utf8').split('\n')
    lines.forEach((ln, i) => {
      for (const { abbr, nn, hi } of refsInLine(ln)) {
        const cf = chapterFile(abbr, nn)
        const ref = `${abbr} ${Number(nn)} l.${hi}`
        if (!cf) {
          dead.push({ file: rel, row: i + 1, ref, abbr, nn, hi, kind: 'chapter-not-found' })
          continue
        }
        const chapterLines = lineCount(cf.path)
        if (hi > chapterLines) {
          dead.push({ file: rel, row: i + 1, ref, abbr, nn, hi, kind: 'out-of-bounds', chapterLines, chapterFile: cf.file })
        }
      }
    })
  }
  return dead
}

/** Parcourt `srcDir` et retourne les réfs dont la ligne (ou TOUTE la plage) citée est VIDE dans le
 *  chapitre résolu : `{ file, row, ref, abbr, nn, lo, hi, chapterFile }`. Une réf dans les bornes qui
 *  tombe sur du blanc ne cite RIEN — symptôme d'une dérive de lignes (ré-extraction, restitution de
 *  folio). Les réfs hors borne / à chapitre introuvable sont l'affaire de `scanDeadCodeRefs`. */
export function scanEmptyLineCodeRefs(srcDir = SRC_DIR) {
  const vides = []
  for (const f of fichiersCitants(srcDir)) {
    const rel = f.split('\\').join('/')
    if (isExcludedSrc(rel)) continue
    const lines = readFileSync(f, 'utf8').split('\n')
    lines.forEach((ln, i) => {
      for (const { abbr, nn, lo, hi } of refsInLine(ln)) {
        const cf = chapterFile(abbr, nn)
        if (!cf) continue
        const chap = chapterLinesOf(cf.path)
        if (hi > chap.length) continue
        let toutesVides = true
        for (let n = lo; n <= hi && toutesVides; n++) if ((chap[n - 1] ?? '').trim() !== '') toutesVides = false
        if (!toutesVides) continue
        const ref = `${abbr} ${Number(nn)} l.${lo === hi ? lo : `${lo}-${hi}`}`
        vides.push({ file: rel, row: i + 1, ref, abbr, nn, lo, hi, chapterFile: cf.file })
      }
    })
  }
  return vides
}

function main() {
  const dead = scanDeadCodeRefs()
  const { neuves, perimees } = ecartDuVolet({
    sites: dead, stock: readStock(STOCK_PATH), ou: 'dead-code-refs-stock.json',
  })

  console.log(`réfs de code mortes (ligne hors borne du chapitre, ou chapitre introuvable) : ${dead.length} site(s)`)

  if (neuves.length) {
    console.log('RÉGRESSION — site(s) de réf morte hors du stock :')
    for (const o of neuves) console.log(`  ${o}`)
  }
  if (perimees.length) {
    console.log('Entrée(s) SOLDÉE(s) (réfs réparées) :')
    for (const s of perimees) console.log(`  ${s}`)
  }
  if (neuves.length || perimees.length) {
    console.log('Détail (fichier:ligne — réf, cause) :')
    for (const d of dead) {
      const cause = d.kind === 'out-of-bounds' ? `${d.chapterFile} a ${d.chapterLines} lignes` : 'chapitre introuvable'
      console.log(`${d.file}:${d.row} — ${d.ref} (${cause})`)
    }
    process.exitCode = 1
  }

  const vides = scanEmptyLineCodeRefs()
  const { neuves: neuvesV, perimees: perimeesV } = ecartDuVolet({
    sites: vides, stock: readStock(EMPTY_LINE_STOCK_PATH), ou: 'empty-line-code-refs-stock.json',
  })

  console.log(`réfs de code sur ligne VIDE (dans les bornes, mais la ligne citée est blanche) : ${vides.length} site(s)`)
  if (neuvesV.length) {
    console.log('RÉGRESSION — site(s) de réf sur ligne vide hors du stock :')
    for (const o of neuvesV) console.log(`  ${o}`)
  }
  if (perimeesV.length) {
    console.log('Entrée(s) SOLDÉE(s) (réfs repointées) :')
    for (const s of perimeesV) console.log(`  ${s}`)
  }
  if (neuvesV.length || perimeesV.length) {
    console.log('Détail (fichier:ligne — réf, chapitre) :')
    for (const v of vides) console.log(`${v.file}:${v.row} — ${v.ref} (${v.chapterFile} : ligne(s) blanche(s))`)
    process.exitCode = 1
  }

  if (!neuves.length && !perimees.length && !neuvesV.length && !perimeesV.length) console.log('OK — cliquets alignés, aucune régression.')
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) main()
