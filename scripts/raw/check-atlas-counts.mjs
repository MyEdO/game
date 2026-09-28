// Garde anti-réapparition de COMPTES manuscrits dans les pages de garde de l'Atlas RAW (#544).
// `docs/raw/00-index.md` citait 3 fois « les 15 livres » et `docs/raw/sources.md` 2 fois (nombre
// recopié à la main, dérivable de BOOKS dans _lib.mjs), et 00-index.md avait aussi porté par le
// passé des comptes d'état (✅/🟡/⬜/❌ … N) recopiés depuis les fichiers GÉNÉRÉS
// (coverage.md/reconciliation.md/reanchor.md) — un compte manuscrit ment dès le commit suivant
// (fiche mémoire game-doc-derivee-jamais-ecrite-a-la-main). Forme retenue : PAS de stamp entre
// marqueurs (un seul nombre dérivable, disproportionné pour 2 pages courtes) — le texte cesse de
// porter un chiffre (renvoi vers la table de sources.md, dérivée de BOOKS) et cette garde échoue
// si un motif de la CLASSE interdite réapparaît, dans L'UN OU L'AUTRE fichier :
//   1. `N livres` — nombre de livres recopié en dur (doit dériver de BOOKS.length, jamais écrit).
//   2. `N chapitres` — même classe, à la granularité du chapitre (#1825 lot E2) : le nombre de
//      chapitres d'un livre se compte à son extraction, il ne se recopie pas dans une page.
//   3. `<pastille-état> N` — compte d'état (✅/🟡/⬜/❌) collé à un nombre, hors formulation de
//      seuil invariant (`⬜ = 0`, qui ne mesure rien et ne devient jamais périmée).
//   4. `<pastille-état> … (N <chose>)` — le MÊME compte d'état, écrit en APPOSITION parenthésée
//      après la qualification de l'état (`✅ pilote (14 topics)`, #1825 lot E1b). La classe 3 ne
//      voit qu'un chiffre COLLÉ à la pastille : celle-ci tient l'apposition. La parenthèse FERMÉE
//      sur `<nombre> <mot>` est ce qui distingue un COMPTE d'une valeur de règle en prose
//      (`✅ Tir de zone (3 bandes RAW, …`, qui n'est pas un compte de population).
// PÉRIMÈTRE — les pages MANUSCRITES de l'Atlas, plus les SCRIPTS qui écrivent de la prose d'Atlas :
// `assemble-domain.mjs` (en-tête de chaque fiche) et `scripts/docs/build-sources-vf.mjs` (gabarit
// éditorial de `docs/sources-vf.md`) — un cardinal écrit là se recopie dans toute sortie écrite
// ensuite : la garde doit voir l'ÉCRIVAIN, pas seulement ses sorties. En sont dehors, parce qu'aucun compte n'y
// est manuscrit : les rapports ré-générés (`RAWDOC_META_GENERATED`), les catalogues ré-générés
// verbatim depuis `Source/` (`catalogue-*.md`, où un compte serait la PROSE du livre), et les
// épreuves DATÉES (`isRawEpreuve`), dont les comptes sont une mesure à une date, gelée.
// Re-run : node scripts/raw/check-atlas-counts.mjs (chaîné dans npm run docs:check).
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { BOOKS, pagesDeLAtlas, readText } from './_lib.mjs'

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
export const RAW_DIR = resolve(RACINE, 'docs/raw')
// Acceptation DÉCLARÉE à la couture : les pages MANUSCRITES — fiches et pages d'auteur. Les rapports
// générés, les catalogues ré-générés verbatim et les épreuves DATÉES n'ont aucun compte manuscrit.
export const CLASSES = ['fiche', 'auteur']
/** L'ASSEMBLEUR des fiches : il INJECTE son en-tête dans chaque fiche qu'il écrit. */
export const ASSEMBLEUR_PATH = resolve(RACINE, 'scripts/raw/assemble-domain.mjs')
/** L'ÉCRIVAIN de `docs/sources-vf.md` : même classe que l'assembleur — sa prose ÉDITORIALE décrit
 *  les livres extraits, et un cardinal de chapitres écrit là se recopie dans la page à chaque run.
 *  La page elle-même est GÉNÉRÉE : la scanner ne désignerait pas le fichier à corriger. */
export const SOURCES_VF_WRITER_PATH = resolve(RACINE, 'scripts/docs/build-sources-vf.mjs')

/** Les fichiers balayés, dans l'ordre de l'Atlas puis les ÉCRIVAINS de prose de l'Atlas — résolus À
 *  L'APPEL : un module qui parcourrait l'Atlas à son CHARGEMENT imposerait son cwd et sa levée à
 *  quiconque l'importe pour une seule fonction pure (`scanForbiddenCounts`). */
export const cheminsBalayes = (rawDir = RAW_DIR) =>
  [...pagesDeLAtlas(rawDir, { classes: CLASSES }).map((p) => p.chemin), ASSEMBLEUR_PATH, SOURCES_VF_WRITER_PATH]

// Nombre de livres écrit en dur devant « livres » (ex. « 15 livres », « depuis les 14 livres »).
const BOOK_COUNT_RE = /\b(\d+)\s+livres\b/gi
// Même classe, à la granularité du chapitre (ex. « Cœur des règles (85 chapitres) »).
const CHAPTER_COUNT_RE = /\b(\d+)\s+chapitres\b/gi
// Pastille d'état (✅/🟡/⬜/❌) directement suivie d'un chiffre — un COMPTE, pas un seuil invariant
// (`⬜ = 0` ne matche pas : le `=` s'intercale entre la pastille et le chiffre).
const STATE_COUNT_RE = /[✅🟡⬜❌]\s+\d+\b/gu
// Même compte d'état, en APPOSITION parenthésée après la qualification de l'état. Trois conditions
// le distinguent d'une valeur de règle : la pastille, la MEME cellule de table ou phrase (ni `|` ni
// fin de ligne entre les deux) et la parenthèse REFERMÉE juste après `<nombre> <mot>`.
const STATE_POPULATION_RE = /[✅🟡⬜❌][^|\n]{0,40}?\(\s*\d+\s+\p{L}+\s*\)/gu

/** Balaie `text` (PUR, aucun accès fichier) → liste de violations `{ line, excerpt, reason }`. */
export function scanForbiddenCounts(text) {
  const violations = []
  const lines = text.split('\n')
  lines.forEach((line, i) => {
    for (const m of line.matchAll(BOOK_COUNT_RE)) {
      violations.push({ line: i + 1, excerpt: m[0], reason: `nombre de livres recopié en dur (dérive de BOOKS.length = ${BOOKS.length} dans _lib.mjs, jamais écrit ici)` })
    }
    for (const m of line.matchAll(CHAPTER_COUNT_RE)) {
      violations.push({ line: i + 1, excerpt: m[0], reason: 'nombre de chapitres recopié en dur — il se compte à l\'extraction (`coverage.md`, GÉNÉRÉ), jamais dans une page manuscrite ni dans un script qui en écrit une' })
    }
    for (const m of line.matchAll(STATE_POPULATION_RE)) {
      violations.push({ line: i + 1, excerpt: m[0], reason: 'compte d\'état manuscrit en apposition (✅/🟡/⬜/❌ … (N …)) — même dette que le compte collé à la pastille : les comptes courants vivent dans coverage.md/reconciliation.md/reanchor.md (GÉNÉRÉS)' })
    }
    for (const m of line.matchAll(STATE_COUNT_RE)) {
      violations.push({ line: i + 1, excerpt: m[0], reason: 'compte d\'état manuscrit (✅/🟡/⬜/❌ + N) — les comptes courants vivent dans coverage.md/reconciliation.md/reanchor.md (GÉNÉRÉS), jamais dans les pages de garde de l\'Atlas' })
    }
  })
  return violations
}

function main() {
  const balayes = cheminsBalayes()
  let all = []
  for (const path of balayes) {
    const text = readText(path)
    const rel = path.slice(RACINE.length + 1).replace(/\\/g, '/')
    all = all.concat(scanForbiddenCounts(text).map((v) => ({ ...v, rel })))
  }
  if (all.length) {
    console.error(`check-atlas-counts — ${all.length} compte(s) manuscrit(s) interdit(s) :`)
    for (const v of all) console.error(`  ${v.rel}:${v.line} « ${v.excerpt} » — ${v.reason}`)
    process.exitCode = 1
    return
  }
  console.log(`check-atlas-counts — OK (aucun compte manuscrit dans ${balayes.length} fichier(s) manuscrit(s) de l'Atlas ; ${BOOKS.length} livres dans BOOKS)`)
}

if (import.meta.main) main()
