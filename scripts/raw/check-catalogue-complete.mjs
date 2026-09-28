// Garde de complétude CATALOGUE↔CHAPITRE (#604, fragilité identifiée par un juge ciblé après la refonte
// de la mesure de couverture).
// `classifyHole` (coverage.mjs) marque une section 'catalogue' — et `classify` marque un chapitre `📖` —
// dès que le CHAPITRE est crédité par un `catalogue-*.md` (`cat`, `catalogChaptersOf`), SANS vérifier
// que le TITRE de la section figure vraiment dans le bloc `## [ABBR NN]` correspondant. La fiabilité du
// mark repose ENTIÈREMENT sur la convention « un catalogue transcrit le chapitre EN ENTIER » — mesuré
// vraie aujourd'hui (0 violation sur 112 chapitres/865 sections, 2026-07-19), mais rien ne l'attrapait si
// un futur catalogue transcrivait un chapitre MIXTE partiellement (ex. juste le statblock d'une
// créature) tout en citant `ABBR NN` : les sections de règles omises resteraient marquées `📖` à tort.
// Ici : verrou STRUCTUREL de cette convention — pour chaque chapitre crédité, chaque section
// (`sectionsOf` au niveau adaptatif du livre, #604) doit avoir son titre (normalisé comme
// `check-entity-in-chapter.mjs` : markdown/casse/accents dépouillés, `normalizeLoose`) présent parmi
// les headings du bloc catalogue. Absence = violation : le `📖` mentirait. Tolérance ZÉRO — pas de
// baseline (à la différence de `check-entity-in-chapter`, dont le stock historique justifiait un
// cliquet) : toute régression future doit échouer immédiatement, jamais se glisser sous un seuil.
// Re-run : node scripts/raw/check-catalogue-complete.mjs (npm run raw:check-catalogue-complete).
import { sectionsOf, catalogChaptersOf, cleanTitle, pagesLues, RAWDIR } from './coverage.mjs'
import { chapterFile, niveauDeSectionDe, readText } from './_lib.mjs'
import { normalizeLoose } from './check-entity-in-chapter.mjs'
// `## [ABBR NN] Titre` — patron STRUCTUREL des blocs catalogue (vérifié #604 : coïncide exactement,
// chapitre pour chapitre, avec `catalogChaptersOf` — 112/112 des deux côtés sur le stock mesuré).
const BLOCK_RE = /^## \[([^\]]+)\]/

/** Découpe TOUS les `catalogue-*.md` de `docs` en blocs `Map("ABBR NN" -> string[])` — un bloc par
 *  heading `## [ABBR NN]`, jusqu'au PROCHAIN bloc (dans le MÊME fichier) ou EOF. `headings` = tous les
 *  titres `#{2,6}` du bloc (le heading de bloc lui-même compris), normalisés (`cleanTitle` +
 *  `normalizeLoose` — même nettoyage des deux côtés de la comparaison, jamais une resaisie). PURE. */
export function catalogueBlocksOf(docs) {
  const blocks = new Map()
  for (const d of docs) {
    if (d.classe !== 'catalogue') continue
    const lines = d.text.split('\n')
    const starts = []
    lines.forEach((l, i) => {
      const m = BLOCK_RE.exec(l)
      if (m) starts.push({ line: i, key: m[1].trim() })
    })
    for (let k = 0; k < starts.length; k++) {
      const lo = starts[k].line
      const hi = k + 1 < starts.length ? starts[k + 1].line : lines.length
      const headings = []
      for (let i = lo; i < hi; i++) {
        const m = /^#{2,6}\s*(.*)$/.exec(lines[i])
        if (m) headings.push(normalizeLoose(cleanTitle(m[1])))
      }
      blocks.set(starts[k].key, (blocks.get(starts[k].key) || []).concat(headings))
    }
  }
  return blocks
}

function splitKey(key) {
  const m = /^(.+) (\d+)$/.exec(key)
  return m ? [m[1], m[2]] : [null, null]
}

/** Pour chaque chapitre crédité (`catalogCh`), chaque section NON-intro dont le titre normalisé est
 *  ABSENT des headings de son bloc catalogue (`blocks`) → violation `{ ab, nn, title, lo, hi }`. Un
 *  chapitre crédité SANS bloc structurel résolu (`blocks` ne le connaît pas) est LUI-MÊME une violation
 *  (toutes SES sections) — la convention qui justifie `📖` n'a alors aucune preuve structurelle du tout.
 *  Accès disque via `chapterFile`/`readText` (comme `classify` dans coverage.mjs) — pas autrement pur. */
export function scanIncompleteChapters(catalogCh, blocks) {
  const violations = []
  for (const key of catalogCh) {
    const [ab, nn] = splitKey(key)
    if (!ab) continue
    const info = chapterFile(ab, nn)
    if (!info) continue
    const text = readText(info.path)
    // Exclut les sections `enfoui` (titre de chapitre VOISIN bavé par l'extraction, #454/H1 orné) :
    // ce n'est pas du contenu du chapitre crédité, un catalogue n'a pas à le transcrire (miroir du
    // `.filter(!enfoui)` de `classify` dans coverage.mjs — même artefact, même exclusion).
    const sections = sectionsOf(text, niveauDeSectionDe(ab)).filter((s) => !s.isIntro && !s.enfoui)
    const headings = blocks.get(key) || []
    for (const s of sections) {
      const needle = normalizeLoose(cleanTitle(s.title))
      if (!needle) continue
      if (!headings.includes(needle)) {
        violations.push({ ab, nn: Number(nn), title: s.title, lo: s.lo, hi: s.hi - 1 })
      }
    }
  }
  return violations
}

function main(rawDir = RAWDIR) {
  const docs = pagesLues(rawDir)
  const catalogCh = catalogChaptersOf(docs)
  const blocks = catalogueBlocksOf(docs)
  const violations = scanIncompleteChapters(catalogCh, blocks)

  console.log(`check-catalogue-complete : ${violations.length} section(s) de chapitre(s) catalogué(s) ABSENTE(s) de leur bloc \`catalogue-*.md\`, sur ${catalogCh.size} chapitre(s) crédités`)
  if (violations.length) {
    console.log('Le mark 📖 MENT sur ces chapitres (transcription partielle, pas entière) :')
    for (const v of violations) console.log(`  ${v.ab} ${v.nn} l.${v.lo}-${v.hi} « ${v.title} » — absente du bloc catalogue`)
    process.exitCode = 1
    return
  }
  console.log('OK — chaque chapitre crédité par un catalogue y est transcrit EN ENTIER (tolérance zéro, aucune baseline).')
}

if (import.meta.main) main()
