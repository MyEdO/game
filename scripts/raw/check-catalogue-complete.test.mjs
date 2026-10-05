// Test de `check-catalogue-complete.mjs` (#604, fragilité identifiée par un juge ciblé) : `catalogueBlocksOf`
// (découpe pure des blocs `## [ABBR NN]` d'un catalogue) et `scanIncompleteChapters` (recoupement
// section↔bloc, tolérance zéro) sont PURS (sauf accès disque via `chapterFile`, comme `classify` dans
// coverage.mjs). Lancé par `npm run test:raw`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { catalogueBlocksOf, scanIncompleteChapters } from './check-catalogue-complete.mjs'
import { sectionsOf, cleanTitle, catalogChaptersOf, pagesLues } from './coverage.mjs'
import { chapterFile, niveauDeSectionDe, readText } from './_lib.mjs'
import { normalizeLoose } from './check-entity-in-chapter.mjs'

test('catalogueBlocksOf : un bloc `## [ABBR NN]` collecte tous ses headings jusqu\'au PROCHAIN bloc, jamais au-delà', () => {
  const docs = [{
    file: 'catalogue-x.md',
    classe: 'catalogue',
    text: [
      '## [AA 3] Un chapitre',
      '### Premier talent',
      'texte.',
      '### Second talent',
      'texte.',
      '## [AA 4] Un autre chapitre',
      '### Ne doit PAS être collecté dans AA 3',
    ].join('\n'),
  }]
  const blocks = catalogueBlocksOf(docs)
  const aa3 = blocks.get('AA 3')
  assert.ok(aa3.some((h) => h.includes('premier talent')))
  assert.ok(aa3.some((h) => h.includes('second talent')))
  assert.ok(!aa3.some((h) => h.includes('ne doit pas')))
})

test('catalogueBlocksOf : les headings sont NORMALISÉS (markdown/casse/accents dépouillés), même nettoyage des deux côtés', () => {
  const docs = [{
    file: 'catalogue-x.md',
    classe: 'catalogue',
    text: ['## [LDB 9] Compétences', '### **Empreint de la Magie**'].join('\n'),
  }]
  const blocks = catalogueBlocksOf(docs)
  assert.ok(blocks.get('LDB 9').includes('empreint de la magie'))
})

test('scanIncompleteChapters : chapitre crédité SANS bloc résolu → TOUTES ses sections sont des violations (aucune preuve structurelle du 📖)', () => {
  const catalogCh = new Set(['AA 9']) // AA 9 = LE COMBAT MONTÉ, chapitre réel du disque
  const blocks = new Map() // aucun bloc trouvé pour AA 9
  const violations = scanIncompleteChapters(catalogCh, blocks)
  assert.ok(violations.length > 0, 'un chapitre crédité sans bloc catalogue résolu doit tout signaler comme violation')
  assert.ok(violations.every((v) => v.ab === 'AA' && v.nn === 9))
})

test('scanIncompleteChapters : chapitre crédité ET transcrit EN ENTIER (fixture avec tous les titres réels) → 0 violation', () => {
  const catalogCh = new Set(['NADJ 16']) // JEUX DE TAVERNE, disque réel — H3 adaptatif (#604)
  const info = chapterFile('NADJ', '16')
  const text = readText(info.path)
  const sections = sectionsOf(text, niveauDeSectionDe('NADJ')).filter((s) => !s.isIntro)
  // Reconstruit un bloc catalogue COMPLET à partir des vrais titres de section du chapitre (preuve
  // positive : la garde ne signale rien quand la transcription est réellement intégrale).
  const blocks = new Map([['NADJ 16', sections.map((s) => normalizeLoose(cleanTitle(s.title)))]])
  const violations = scanIncompleteChapters(catalogCh, blocks)
  assert.deepEqual(violations, [])
})

test('scanIncompleteChapters : chapitre crédité mais UNE section absente du bloc catalogue → détectée (fragilité du juge ciblé)', () => {
  const catalogCh = new Set(['NADJ 16'])
  const info = chapterFile('NADJ', '16')
  const text = readText(info.path)
  const sections = sectionsOf(text, niveauDeSectionDe('NADJ')).filter((s) => !s.isIntro)
  assert.ok(sections.length > 1, 'fixture invalide : le chapitre réel doit porter au moins 2 sections')
  // Omet délibérément la DERNIÈRE section (transcription partielle du catalogue — le scénario du ticket).
  const partial = sections.slice(0, -1).map((s) => normalizeLoose(cleanTitle(s.title)))
  const blocks = new Map([['NADJ 16', partial]])
  const violations = scanIncompleteChapters(catalogCh, blocks)
  assert.equal(violations.length, 1)
  assert.equal(violations[0].title, sections[sections.length - 1].title)
})

test('#604 stock réel (Disque RÉEL, tolérance zéro) : 0 violation sur les chapitres réellement crédités', () => {
  // Les pages JUGÉES viennent de la couture de la garde (`pagesLues`) — jamais un listing recopié
  // ici : un banc qui compose son propre périmètre mesure autre chose que la garde.
  const docs = pagesLues()
  const catalogCh = catalogChaptersOf(docs)
  const blocks = catalogueBlocksOf(docs)
  const violations = scanIncompleteChapters(catalogCh, blocks)
  assert.deepEqual(violations, [], `stock mesuré : ${violations.length} violation(s) — attendu 0 (tolérance zéro, pas de baseline)`)
  assert.ok(catalogCh.size > 100, 'sanity check : le stock de chapitres catalogués doit rester substantiel')
})
