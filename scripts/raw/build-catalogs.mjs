// Construit les catalogues de l'Atlas (docs/raw/<coeur>/catalogue-*.md) en CONCATÉNANT verbatim les chapitres
// de DONNÉES de la SOURCE Marker propre (tables intactes). Chaque chapitre est cité
// `<ABBR> NN` → crédité au niveau chapitre par coverage.mjs/reconcile.mjs. #1825 : l'APPARTENANCE
// d'un chapitre à un catalogue est de la DONNÉE (`enCatalogue` de `scripts/raw/chapitres.json`, lue par
// `livresDeCatalogue`) — ne restent ici que le fichier, le cœur, le titre et la fiche de règles du CATALOGUE,
// jamais une liste de livres. Une entrée de chapitre porte `ch` ; ses `from`/`to`/`title` optionnels
// n'en transcrivent qu'une PLAGE DE SOUS-SECTION (ancres `chapterFile`, cf. `_lib.mjs`) — même
// mécanisme, pour un chapitre trop large pour son catalogue.
// Re-run après toute ré-extraction.
// node scripts/raw/build-catalogs.mjs [--check]   (`--check` : `ecrireOuVerifier` par catalogue)
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { listerDossier } from '../guards/lib/lister.mjs'
import { BOOKS, chapterFile as chapterFileLib, coeursDuRegistre, livresDeCatalogue, pagesDeLAtlas, readText } from './_lib.mjs'
import { titreDuFichier } from '../../src/data/source/decoupe.ts'
import { ecrireOuVerifier } from '../docs/lib/ecriture-derives.mjs'

export const RAWDIR = 'docs/raw'

/** Le chemin d'un catalogue de l'Atlas, sous son cœur DÉCLARÉ (`coeur` de `CATALOGUES`). LÈVE en
 *  nommant la cause quand ce cœur n'est pas un cœur du registre des livres : un défaut choisirait un
 *  cœur en silence, là où un catalogue porte des blocs de livres qui n'en déclarent AUCUN. */
export function cheminDeCatalogue({ file, coeur }, coeurs = coeursDuRegistre()) {
  if (coeurs.includes(coeur)) return `${RAWDIR}/${coeur}/${file}`
  throw new Error(
    `build-catalogs: le catalogue « ${file} » déclare le cœur « ${coeur} », absent du registre des livres `
    + `(src/data/books.json) ; cœurs du registre : ${coeurs.join(', ') || '(aucun)'}`)
}

// Les CATALOGUES de l'Atlas : leur identité (`id`, clé que les entrées de chapitre citent), leur fichier,
// leur cœur, leur titre et la fiche de règles qui les traite. Quels chapitres de quel livre y entrent
// est de la DONNÉE (`enCatalogue` de `scripts/raw/chapitres.json`) — l'ordre des blocs suit donc l'ORDRE DU REGISTRE.
export const CATALOGUES = [
  { id: 'creatures', file: 'catalogue-creatures.md', coeur: '4e', titre: 'Bestiaire — profils de créature', rules: 'bestiaire.md' },
  { id: 'sorts', file: 'catalogue-sorts.md', coeur: '4e', titre: 'Sorts — listes complètes', rules: 'magie.md' },
  { id: 'divin', file: 'catalogue-divin.md', coeur: '4e', titre: 'Religion — dieux, bénédictions & miracles', rules: 'religion.md' },
  { id: 'equipement', file: 'catalogue-equipement.md', coeur: '4e', titre: 'Équipement — objets, prix & Encombrement', rules: 'equipement.md' },
  { id: 'carrieres', file: 'catalogue-carrieres.md', coeur: '4e', titre: 'Carrières — détails par niveau', rules: 'carrieres.md' },
  { id: 'divers', file: 'catalogue-divers.md', coeur: '4e', titre: 'Règles diverses des suppléments', rules: '00-index.md' },
]
export const idsDeCatalogue = () => CATALOGUES.map((c) => c.id)

function chapterFile(abbr, nn, range) {
  const c = chapterFileLib(abbr, nn, range)
  if (!c) return null
  const title = titreDuFichier(c.file)
  const text = c.text ?? readText(c.path).trim()
  return { title, text }
}

/** Les extractions Source/ absentes ou vides : sans elles, `chapterFile` rend null pour TOUT
 *  chapitre et chaque catalogue se rendrait VIDE. */
const extractionsVides = () => BOOKS.filter(([, dir]) => !existsSync(dir) || !listerDossier(dir).some((f) => f.endsWith('.md')))

/**
 * Chaque catalogue rendu, avec sa ligne de journal. LÈVE sur une extraction Source/ absente, avant
 * le moindre rendu.
 */
function rendu() {
  const dirsVides = extractionsVides()
  if (dirsVides.length)
    throw new Error([
      `build-catalogs — ${dirsVides.length} extraction(s) Source/ absente(s) ou vide(s) : aucun catalogue écrit.`,
      ...dirsVides.map(([abbr, dir]) => `  ${abbr} → ${dir}`),
    ].join('\n'))
  return CATALOGUES.map((dom) => {
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
    const path = cheminDeCatalogue(dom)
    const body = header + parts.join('\n') + '\n'
    const log = `${dom.file} : ${refs.length} ch., ${Math.round(body.length / 1024)} Ko${missing.length ? ' · MANQUE ' + missing.join(', ') : ''}`
    return { path, body, log }
  })
}

/** Contrat `rendre()` de `GENERATORS` (scripts/docs/build-all.mjs) : chaque catalogue → son texte, sans écrire. */
export function rendre() {
  return new Map(rendu().map(({ path, body }) => [path, body]))
}

/** Les catalogues rendus, keyés par chemin RELATIF à l'Atlas (`<coeur>/catalogue-*.md`) : la source
 *  de catalogues par défaut de `pagesDeLAtlasRendues`. */
export const cataloguesRendus = () => new Map([...rendre()].map(([chemin, texte]) => [chemin.slice(RAWDIR.length + 1), texte]))

/**
 * Les pages de l'Atlas `rawDir` que `options.classes` accepte, chacune avec son `texte` : les pages
 * au disque (`pagesDeLAtlas`), sauf les catalogues, pris à la source `catalogues` (fonction qui rend
 * chemin relatif à l'Atlas → texte), jamais au disque.
 */
export function pagesDeLAtlasRendues(rawDir, options, catalogues = cataloguesRendus) {
  const autres = options.classes.filter((c) => c !== 'catalogue')
  const pages = (autres.length ? pagesDeLAtlas(rawDir, { ...options, classes: autres }) : [])
    .map((p) => ({ ...p, texte: readText(p.chemin) }))
  if (autres.length === options.classes.length) return pages
  for (const [relatif, texte] of catalogues()) {
    const coupe = relatif.lastIndexOf('/')
    pages.push({ coeur: relatif.slice(0, coupe), nom: relatif.slice(coupe + 1), relatif, chemin: join(rawDir, relatif), classe: 'catalogue', texte })
  }
  return pages.sort((a, b) => (a.relatif < b.relatif ? -1 : a.relatif > b.relatif ? 1 : 0))
}

function main() {
  const check = process.argv.includes('--check')
  let catalogues
  try {
    catalogues = rendu()
  } catch (e) {
    console.error(String(e?.message ?? e))
    process.exit(1)
  }
  for (const { path, body } of catalogues)
    ecrireOuVerifier({
      out: body,
      path,
      check,
      staleMsg: `build-catalogs — ${path} est PÉRIMÉ (chapitre source ou registre des catalogues changé).`,
      rerunMsg: '  → relancer `npm run raw:catalogs` (dérivé jamais commité, #2203).',
    })
  console.log(catalogues.map((c) => c.log).join('\n'))
}

if (import.meta.main) main()
