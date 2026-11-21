// GARDE : L'ATLAS S'ÉNUMÈRE EN UN SEUL SITE (#1825) — `npm run test:raw`.
//
// L'invariant : une page de l'Atlas appartient à UN cœur, et son CHEMIN le dit. Il ne tient que si
// UN module sait parcourir `docs/raw/` — `pagesDeLAtlas` (`scripts/raw/_lib.mjs`), qui REFUSE une
// page de règles posée à la racine et un sous-dossier qui n'est pas un cœur du registre. Un lecteur
// qui liste le dossier lui-même retrouve l'ancien monde À PLAT : il ne voit plus aucune fiche (elles
// vivent d'un cran plus bas) et rend un VERT À VIDE, ou il descend l'arbre sans rien vérifier. Les
// deux formes se referment ici.
//
// CE QUE LA GARDE MESURE, et ce qu'elle ne peut pas : un appel de LISTING dont la même expression
// nomme la racine de l'Atlas. Elle lit le TEXTE, pas l'AST — une racine passée par une variable
// venue d'un autre fichier lui échappe ; c'est le prix d'une garde sans clôture d'imports, et le
// mur de `scripts/guards/lib/lister.test.mjs` (volet c) tient déjà, lui, le fait qu'aucun module
// n'appelle `readdirSync` hors du lecteur à ordre total.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { estModule } from '../guards/lib/importGraph.mjs'
import { listerArbre } from '../guards/lib/lister.mjs'

const ROOT = fileURLToPath(new URL('../..', import.meta.url))
/** Le module de la COUTURE : le seul site autorisé à parcourir l'Atlas. */
const COUTURE = 'scripts/raw/_lib.mjs'
/** Ce banc-ci ÉNONCE le motif ; il ne liste rien. */
const SOI = 'scripts/raw/couture-unique.test.mjs'
const RACINES = ['scripts', 'src']
/** Un appel de LISTING (les deux du lecteur à ordre total, et les formes brutes de Node) dont
 *  l'expression nomme la racine de l'Atlas — deux lignes de fenêtre, un argument pouvant passer à
 *  la ligne. */
const LISTING = /\b(?:listerDossier|listerArbre|readdirSync|readdir|globSync)\s*\(/
/** La racine de l'Atlas ÉCRITE en toutes lettres. */
const ATLAS_LITTERAL = /['"`]docs\/raw\/?['"`]|['"`]docs['"`]\s*,\s*['"`]raw['"`]/
/** La racine de l'Atlas NOMMÉE : le lot a créé l'idiome `const RAWDIR = 'docs/raw'`, et
 *  `listerDossier(RAWDIR)` ne porte alors plus aucun littéral. Un nom que le MÊME fichier lie à la
 *  racine (la liaison peut passer par `join(…)`, `resolve(…)`) compte donc pour le littéral. */
const LIAISON = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*[^\n;]*(?:['"`]docs\/raw\/?['"`]|['"`]docs['"`]\s*,\s*['"`]raw['"`])/g
/** Un nom qui DIT l'Atlas, d'où qu'il vienne : importé d'un autre lecteur (`reanchor-split.mjs`
 *  importe `RAWDIR` de `check-refs.mjs`), sa liaison n'est pas dans le fichier qui l'emploie. */
const NOM_ATLAS = /\b(?:RAWDIR|RAW_DIR)\b/

/** L'expression désigne-t-elle l'Atlas, littéralement ou par un nom que `fichier` y lie ? */
const viseLAtlas = (expr, nomsLies) =>
  ATLAS_LITTERAL.test(expr) || NOM_ATLAS.test(expr) || nomsLies.some((n) => new RegExp(`\\b${n}\\b`).test(expr))

test('aucun module ne PARCOURT `docs/raw` hors de la couture', () => {
  const sites = []
  for (const racine of RACINES) {
    for (const rel of listerArbre(join(ROOT, racine), { filtre: estModule })) {
      const chemin = `${racine}/${rel}`
      if (chemin === COUTURE || chemin === SOI) continue
      const texte = readFileSync(join(ROOT, chemin), 'utf8')
      const nomsLies = [...texte.matchAll(LIAISON)].map((m) => m[1])
      const lignes = texte.split(/\r?\n/)
      lignes.forEach((ligne, i) => {
        const fenetre = `${ligne}\n${lignes[i + 1] ?? ''}`
        if (LISTING.test(ligne) && viseLAtlas(fenetre, nomsLies)) sites.push(`${chemin}:${i + 1}: ${ligne.trim().slice(0, 120)}`)
      })
    }
  }
  assert.deepEqual(
    sites,
    [],
    'l’Atlas ne se parcourt que par `pagesDeLAtlas` (scripts/raw/_lib.mjs), qui DÉCLARE les classes '
      + `acceptées et refuse une page hors cœur :\n  ${sites.join('\n  ')}`,
  )
})

/** Le verdict de la garde sur un FICHIER forgé, entier — liaisons comprises. */
function verdictSur(source) {
  const nomsLies = [...source.matchAll(LIAISON)].map((m) => m[1])
  const lignes = source.split('\n')
  return lignes.some((ligne, i) => LISTING.test(ligne) && viseLAtlas(`${ligne}\n${lignes[i + 1] ?? ''}`, nomsLies))
}

test('la garde n’est pas AVEUGLE : elle voit le motif qu’elle interdit, littéral ou NOMMÉ', () => {
  const mordus = [
    "listerDossier(join(ROOT, 'docs/raw'))",
    "readdirSync(join(ROOT, 'docs', 'raw'))",
    // L'idiome né du lot : la racine passe par un nom, sur UNE ligne…
    "const RAWDIR = 'docs/raw'\nlisterDossier(RAWDIR)",
    // …et sur DEUX, l'argument passant à la ligne.
    "const RACINE_ATLAS = join(ICI, 'docs/raw')\nconst pages = listerArbre(\n  RACINE_ATLAS,\n)",
    // Le nom VENU D'AILLEURS : aucune liaison dans ce fichier-ci.
    "import { RAWDIR } from './check-refs.mjs'\nlisterDossier(RAWDIR)",
  ]
  for (const source of mordus) assert.equal(verdictSur(source), true, source)

  const epargnes = [
    "listerDossier(join(ROOT, 'docs'))",
    "pagesDeLAtlas(join(ROOT, 'docs/raw'), { classes: ['fiche'] })",
    // Un nom lié AILLEURS qu'à l'Atlas ne se confond pas avec lui.
    "const DOCS = 'docs'\nlisterDossier(DOCS)",
    // La couture est nommée, pas appelée en listing : la mention seule ne mord pas.
    "// l'Atlas se parcourt par pagesDeLAtlas('docs/raw')",
  ]
  for (const source of epargnes) assert.equal(verdictSur(source), false, source)
})
