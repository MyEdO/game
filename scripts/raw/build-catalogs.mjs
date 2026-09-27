// Construit les catalogues de l'Atlas (docs/raw/catalogue-*.md) en CONCATÉNANT verbatim les chapitres
// de DONNÉES de la SOURCE Marker propre (tables intactes). Chaque chapitre est cité
// `<ABBR> NN` → crédité au niveau chapitre par coverage.mjs/reconcile.mjs. #1825 : l'APPARTENANCE
// d'un chapitre à un catalogue est de la DONNÉE (`enCatalogue` de `scripts/raw/chapitres.json`, lue par
// `livresDeCatalogue`) — ne restent ici que le fichier, le titre et la fiche de règles du CATALOGUE,
// jamais une liste de livres. Une entrée de chapitre porte `ch` ; ses `from`/`to`/`title` optionnels
// n'en transcrivent qu'une PLAGE DE SOUS-SECTION (ancres `chapterFile`, cf. `_lib.mjs`) — même
// mécanisme, pour un chapitre trop large pour son catalogue.
// Contrainte : tout bloc `<!-- <ABRÉV>-INTEGRATION -->` du fichier existant reste un correctif MANUEL
// (perte connue de l'extraction Marker) — préservé tel quel
// par extractPreservedBlocks/appendPreservedBlocks, JAMAIS régénéré. Re-run après toute ré-extraction.
// `appendPreservedBlocks` recolle en FIN de fichier : #1839.
// node scripts/raw/build-catalogs.mjs [--check]   (`--check` : `ecrireOuVerifier` par catalogue)
import { existsSync } from 'node:fs'
import { listerDossier } from '../guards/lib/lister.mjs'
import { BOOKS, blockStartRe, chapterFile as chapterFileLib, livresDeCatalogue, pagesDeLAtlas, readText } from './_lib.mjs'
import { echapperRegex } from '../../src/lib/regex.ts'
import { titreDuFichier } from '../../src/data/source/decoupe.ts'
import { ecrireOuVerifier } from '../docs/lib/empreinte-sources.mjs'

export const RAWDIR = 'docs/raw'
// Acceptation DÉCLARÉE à la couture : les catalogues — l'écrivain relit OÙ vit déjà le catalogue
// qu'il réécrit, puisque le CHEMIN déclare le cœur.
export const CLASSES = ['catalogue']

/** Les catalogues de l'Atlas, ÉNUMÉRÉS UNE FOIS : l'appelant qui en résout plusieurs ne reparcourt
 *  pas l'Atlas par catalogue. */
export const cataloguesDeLAtlas = (rawDir = RAWDIR) => pagesDeLAtlas(rawDir, { classes: CLASSES })

/** Le chemin d'un catalogue de l'Atlas — le cœur vient du CHEMIN de la page existante. LÈVE en
 *  nommant la cause quand le catalogue n'existe sous aucun cœur : un défaut choisirait un cœur en
 *  silence, là où un catalogue porte des blocs de livres qui n'en déclarent AUCUN. */
export function cheminDeCatalogue(file, pages = cataloguesDeLAtlas()) {
  const page = pages.find((p) => p.nom === file)
  // Séparateurs NORMALISÉS : ce chemin est celui que nomment le journal et le rouge de `--check`,
  // le même sur toute machine.
  if (page) return page.chemin.replace(/\\/g, '/')
  throw new Error(
    `build-catalogs: le catalogue « ${file} » ne vit sous AUCUN cœur de l'Atlas — son cœur vient `
    + `de son CHEMIN : pose sa page sous <atlas>/<coeur>/ , le cœur où ce catalogue doit être lu ; `
    + `catalogues vus : ${pages.map((p) => p.relatif).join(', ') || '(aucun)'}`)
}

// Regex du marqueur : DÉRIVÉE de `allAbbrAlternation` (`_lib.mjs`) — un sigle porte des espaces,
// des minuscules, un point ; aucune classe de caractères écrite à la main ne les tient tous.
export const BLOCK_START = blockStartRe()
const blockEnd = (tag) => new RegExp(`^<!-- /${echapperRegex(tag)} -->\\s*$`)

// Extrait les blocs préservés (délimités par `<!-- X-INTEGRATION -->` … `<!-- /X-INTEGRATION -->`,
// précédés d'un séparateur `---` isolé) d'un catalogue EXISTANT. Un bloc sans marqueur de fin sur
// disque court jusqu'à l'EOF : on le ferme ici — auto-guérison au premier run.
export function extractPreservedBlocks(path) {
  if (!existsSync(path)) return []
  const lines = readText(path).split('\n')
  const blocks = []
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(BLOCK_START)
    if (!m) continue
    const tag = m[1]
    let start = i
    for (let j = i - 1; j >= Math.max(0, i - 5); j--) {
      if (lines[j].trim() === '---') { start = j; break }
    }
    const endRe = blockEnd(tag)
    let end = lines.length - 1
    let closed = false
    for (let j = i + 1; j < lines.length; j++) {
      if (endRe.test(lines[j])) { end = j; closed = true; break }
    }
    const body = lines.slice(start, end + 1)
    if (!closed) body.push(`<!-- /${tag} -->`)
    blocks.push(body.join('\n'))
    i = end
  }
  return blocks
}

function appendPreservedBlocks(content, blocks) {
  if (!blocks.length) return content
  return content.replace(/\n+$/, '\n') + '\n' + blocks.join('\n\n') + '\n'
}

// Les CATALOGUES de l'Atlas : leur identité (`id`, clé que les entrées de chapitre citent), leur fichier,
// leur titre et la fiche de règles qui les traite. Quels chapitres de quel livre y entrent est de la
// DONNÉE (`enCatalogue` de `scripts/raw/chapitres.json`) — l'ordre des blocs suit donc l'ORDRE DU REGISTRE.
export const CATALOGUES = [
  { id: 'creatures', file: 'catalogue-creatures.md', titre: 'Bestiaire — profils de créature', rules: 'bestiaire.md' },
  { id: 'sorts', file: 'catalogue-sorts.md', titre: 'Sorts — listes complètes', rules: 'magie.md' },
  { id: 'divin', file: 'catalogue-divin.md', titre: 'Religion — dieux, bénédictions & miracles', rules: 'religion.md' },
  { id: 'equipement', file: 'catalogue-equipement.md', titre: 'Équipement — objets, prix & Encombrement', rules: 'equipement.md' },
  { id: 'carrieres', file: 'catalogue-carrieres.md', titre: 'Carrières — détails par niveau', rules: 'carrieres.md' },
  { id: 'divers', file: 'catalogue-divers.md', titre: 'Règles diverses des suppléments', rules: '00-index.md' },
]
export const idsDeCatalogue = () => CATALOGUES.map((c) => c.id)

function chapterFile(abbr, nn, range) {
  const c = chapterFileLib(abbr, nn, range)
  if (!c) return null
  const title = titreDuFichier(c.file)
  const text = c.text ?? readText(c.path).trim()
  return { title, text }
}

function main() {
const check = process.argv.includes('--check')
// Fail-fast : sans extraction sur disque, `chapterFile` rend null pour TOUT chapitre et le
// catalogue s'écrirait VIDE, écrasant le committé. On refuse avant la moindre écriture.
const dirsVides = BOOKS.filter(([, dir]) => !existsSync(dir) || !listerDossier(dir).some((f) => f.endsWith('.md')))
if (dirsVides.length) {
  console.error(`build-catalogs — ${dirsVides.length} extraction(s) Source/ absente(s) ou vide(s) : aucun catalogue écrit.`)
  for (const [abbr, dir] of dirsVides) console.error(`  ${abbr} → ${dir}`)
  process.exit(1)
}
const log = []
// ÉNUMÉRATION HISSÉE : l'Atlas se parcourt UNE fois pour tous les catalogues à écrire.
const pagesCatalogues = cataloguesDeLAtlas()
for (const dom of CATALOGUES) {
  const parts = [], refs = [], missing = []
  for (const [abbr, chaps] of livresDeCatalogue(dom.id)) for (const spec of chaps) {
    const { ch: nn, from, to, title } = spec
    const c = chapterFile(abbr, nn, from ? { from, to } : undefined)
    if (!c) { missing.push(`${abbr} ${nn}`); continue }
    refs.push(`\`${abbr} ${nn}\``)
    parts.push(`\n\n## [${abbr} ${nn}] ${title ?? c.title}\n\n${c.text}`)
  }
  const header = `# Atlas RAW — Catalogue : ${dom.titre}\n\n` +
    `> **Catalogue mécanique RAW**, consolidé verbatim depuis la source **Marker** (propre, tables intactes)\n` +
    `> des livres autorisés. Système & règles : voir [\`${dom.rules}\`](${dom.rules}).\n>\n` +
    `> **Chapitres source :** ${refs.join(' · ')}.\n\n---\n`
  const path = cheminDeCatalogue(dom.file, pagesCatalogues)
  const preserved = extractPreservedBlocks(path)
  const body = appendPreservedBlocks(header + parts.join('\n') + '\n', preserved)
  ecrireOuVerifier({
    out: body,
    path,
    check,
    staleMsg: `build-catalogs — ${path} est PÉRIMÉ (chapitre source ou registre des catalogues changé).`,
    rerunMsg: '  → relancer `npm run raw:catalogs` et committer le résultat.',
  })
  log.push(`${dom.file} : ${refs.length} ch., ${Math.round(body.length / 1024)} Ko${missing.length ? ' · MANQUE ' + missing.join(', ') : ''}${preserved.length ? ` · ${preserved.length} bloc(s) préservé(s)` : ''}`)
}
console.log(log.join('\n'))
}

if (import.meta.main) main()
