// Garde de classe « réf fausse BLANCHIE par la normalisation » (#600).
// Une réf de fiche Atlas syntaxiquement conforme (`ABBR N p.X`) ne prouve PAS que la cible est
// juste : #600 a trouvé deux talents (`empreint-d-ulgu`, `empreint-de-la-magie`) tagués `LDB 10`
// alors que leur texte vit en NADJ/EDOC — la graphie passait toutes les gardes de bornage de ligne
// (check-refs/check-code-refs/citation-graphy-guard) parce qu'elles vérifient une PLAGE de ligne,
// jamais le CONTENU. Ici : pour chaque entrée de la fiche `<coeur>/talents.md` de forme
//   ### <Nom>
//   **Source :** <ABBR> <N> ...
// on résout le fichier-chapitre (`chapterFile`, _lib.mjs) et on vérifie que `<Nom>` (normalisé :
// markdown/casse/accents dépouillés) apparaît dans le texte du chapitre cité. Absence = violation.
// Tolérances documentées : parenthèse finale du titre (« Artilleur (mise à jour AA) ») retirée avant
// comparaison — c'est une annotation d'édition, pas le nom RAW ; articles/prépositions français
// élidés OU non (« Empreint de la Magie » data vs « Empreint de Magie » EDOC 13 l.254) retirés des
// DEUX côtés avant comparaison. Réf sans chapitre NUMÉRIQUE résoluble (« AA Annexe III »,
// « ADE II ch. Les Ogres ») = hors sujet (rien à chapitrer) : périmètre de check-refs/check-code-refs.
// Cliquet NOMINATIF PAR SITE (`scripts/raw/entity-in-chapter-stock.json`, écart `ecartDuVolet` de
// `scripts/guards/lib/stock.mjs`, clé `doc :: nom :: occurrence`) : un site NEUF est une régression à corriger
// ou à déclarer, une entrée dont le site a disparu est une dette SOLDÉE à retirer. Le stock est
// ABSENT en régime nominal → tolérance ZÉRO (`readStock` traite un fichier absent comme zéro entrée).
// Re-run : node scripts/raw/check-entity-in-chapter.mjs (npm run raw:check-entity-in-chapter).
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chapterFile, allAbbrAlternation, pagesDeLAtlas, readText } from './_lib.mjs'
import { ecartDuVolet } from '../guards/lib/stock.mjs'
import { readStock } from './stockNominatif.mjs'

export const RAWDIR = 'docs/raw'
// Acceptation DÉCLARÉE à la couture : les FICHES seules. Le garde lit les entrées `### <Nom>` de la
// fiche des talents, DE CHAQUE cœur qui en porte une — la cible se RÉSOUT, elle ne s'écrit pas.
export const CLASSES = ['fiche']
export const NOM_CIBLE = 'talents.md'
/** Les cibles, RÉSOLUES À L'APPEL : un module qui lirait l'Atlas à son CHARGEMENT imposerait son cwd
 *  et sa levée à quiconque l'importe pour une seule fonction pure (`check-catalogue-complete.mjs`
 *  importe `normalizeLoose`). */
export const ciblesDeLAtlas = (rawDir = RAWDIR) =>
  pagesDeLAtlas(rawDir, { classes: CLASSES }).filter((p) => p.nom === NOM_CIBLE).map((p) => `${rawDir}/${p.relatif}`)
export const STOCK_PATH = resolve(dirname(fileURLToPath(import.meta.url)), 'entity-in-chapter-stock.json')
// Sites observés → sites du stock : le DOC de l'Atlas où l'entrée est lue (chemin depuis la racine du
// dépôt) et le NOM de l'entité. Jamais `row` : la ligne du doc dérive à chaque édition de la fiche.
export const sitesEntites = (violations) => violations.map((v) => ({ file: v.doc, ref: v.name }))

// `<ABBR> <N>` en tête de ligne Source (LDB inclus, alternation _lib.mjs partagée — jamais réécrite).
// Chapitre = premier groupe de chiffres qui suit l'abréviation (`ch.` optionnel devant) ; une réf
// sans chapitre numérique immédiat (« AA Annexe III », « ADE II ch. Les Ogres ») ne matche pas —
// hors sujet ici (rien à chapitrer), périmètre de check-refs/check-code-refs.
const SOURCE_ABBR_RE = () => new RegExp(`^(${allAbbrAlternation()})\\s+(?:ch\\.\\s*)?(\\d+)\\b`)

/** Normalise pour le match de PRÉSENCE (tolérant, pas le match exact de citation) : dépouille le
 *  markdown (emphase/code), les accents (NFD → suppression des diacritiques) et la casse. */
export function normalizeLoose(s) {
  return s
    .replace(/[*_`]/g, '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

// Tolère les articles/prépositions français élidés OU non entre la version data et le verbatim RAW
// (cas #600 : « Empreint de la Magie » (talents.json) vs « Empreint de Magie » (EDOC 13 l.254)) —
// mots-outils retirés des DEUX côtés de la comparaison, jamais du texte affiché.
const STOPWORDS_RE = /\b(de|du|des|le|la|les|un|une)\b/g
const CONTRACTED_STOPWORDS_RE = /\b[dl]'/g
export function stripArticles(s) {
  return s.replace(CONTRACTED_STOPWORDS_RE, '').replace(STOPWORDS_RE, ' ').replace(/\s+/g, ' ').trim()
}

/** Titre de talent → nom comparable : retire une parenthèse finale d'annotation d'édition
 *  (« Artilleur (mise à jour AA) » → « Artilleur »). */
export function entityNameFromHeader(header) {
  return header.replace(/\s*\([^)]*\)\s*$/, '').trim()
}

const chapterTextCache = new Map()
function chapterTextOf(cf) {
  if (!chapterTextCache.has(cf.path)) chapterTextCache.set(cf.path, stripArticles(normalizeLoose(readText(cf.path))))
  return chapterTextCache.get(cf.path)
}

/** Parcourt un doc Atlas (cible RÉSOLUE par `ciblesDeLAtlas`, jamais écrite) et retourne les entrées `### <Nom>` /
 *  `**Source :** <ABBR> <N>…` dont `<Nom>` (normalisé) est ABSENT du texte du chapitre cité —
 *  `{ doc, row, name, ref, chapterFile }`. Réf sans chapitre numérique résoluble = ignorée. */
export function scanMissingEntities(docPath) {
  const lines = readText(docPath).split('\n')
  const abbrRe = SOURCE_ABBR_RE()
  const violations = []
  for (let i = 0; i < lines.length; i++) {
    const h = /^#{2,6}\s+(.+?)\s*$/.exec(lines[i])
    if (!h) continue
    // La ligne Source suit le titre à quelques lignes près (blockquotes/notes intercalées tolérées).
    let sourceLine = null
    for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
      const s = /^\*\*Source\s*:\*\*\s*(.+?)\s*$/.exec(lines[j])
      if (s) { sourceLine = s[1]; break }
      if (/^#{2,6}\s+/.test(lines[j])) break // prochain titre atteint sans Source : pas une entrée
    }
    if (sourceLine == null) continue
    const m = abbrRe.exec(sourceLine)
    abbrRe.lastIndex = 0
    if (!m) continue // pas de chapitre numérique résoluble : hors sujet
    const [, abbr, nn] = m
    const cf = chapterFile(abbr, nn)
    if (!cf) continue // chapitre introuvable : périmètre de check-refs/check-code-refs, pas ici
    const name = entityNameFromHeader(h[1])
    if (!name) continue
    const needle = stripArticles(normalizeLoose(name))
    if (!needle || !chapterTextOf(cf).includes(needle)) {
      violations.push({ doc: docPath, row: i + 1, name, ref: `${abbr} ${Number(nn)}`, chapterFile: cf.file })
    }
  }
  return violations
}

export function scanAll(targets = ciblesDeLAtlas()) {
  return targets.flatMap((t) => scanMissingEntities(t))
}

function main() {
  const cibles = ciblesDeLAtlas()
  const violations = scanAll(cibles)
  const { neuves, perimees } = ecartDuVolet({
    sites: sitesEntites(violations), stock: readStock(STOCK_PATH), ou: 'entity-in-chapter-stock.json',
  })

  console.log(`check-entity-in-chapter : ${violations.length} entrée(s) dont le nom est ABSENT du chapitre cité, sur ${cibles.join(', ')}`)

  if (neuves.length) {
    console.log('RÉGRESSION — entrée(s) à réf fausse hors du stock :')
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
  console.log('Détail (fichier:ligne — nom, réf citée, chapitre résolu) :')
  for (const v of violations) console.log(`${v.doc}:${v.row} — "${v.name}" cite ${v.ref} (${v.chapterFile}), nom absent`)
  process.exitCode = 1
}

if (import.meta.main) main()
