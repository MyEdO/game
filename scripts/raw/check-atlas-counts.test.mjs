// Test de la garde `check-atlas-counts` (node --test) : détecte un nombre de livres, un nombre de
// chapitres ou un compte d'état recopiés en dur, reste silencieuse sur le seuil invariant, et couvre
// TOUTES les pages manuscrites de l'Atlas plus l'assembleur des fiches. Lancé par `npm run test:raw`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pagesDeLAtlas, readText } from './_lib.mjs'
import { parseFiche, referenceImplementation } from './build-implemente.mjs'
import { scanForbiddenCounts, CLASSES, RAW_DIR, cheminsBalayes, ASSEMBLEUR_PATH, SOURCES_VF_WRITER_PATH } from './check-atlas-counts.mjs'

test('scanForbiddenCounts : "N livres" recopié en dur → détecté', () => {
  const v = scanForbiddenCounts('depuis les 15 livres autorisés\n')
  assert.equal(v.length, 1)
  assert.equal(v[0].line, 1)
  assert.equal(v[0].excerpt, '15 livres')
})

test('scanForbiddenCounts : compte d\'état "✅ 150" recopié en dur → détecté', () => {
  const v = scanForbiddenCounts('état courant : ✅ 150 · 🟡 4 · ⬜ 0\n')
  assert.equal(v.length, 3)
  assert.deepEqual(v.map((x) => x.excerpt), ['✅ 150', '🟡 4', '⬜ 0'])
})

test('scanForbiddenCounts : seuil invariant "⬜ = 0" → silencieux (pas un compte courant)', () => {
  assert.deepEqual(scanForbiddenCounts('**Seuil : ⬜ = 0.**\n'), [])
})

test('scanForbiddenCounts : renvoi sans chiffre vers la table de sources.md → silencieux', () => {
  assert.deepEqual(scanForbiddenCounts('depuis les livres autorisés (voir sources.md)\n'), [])
})

test('scanForbiddenCounts : numéro de chapitre isolé (pas de pastille d\'état ni "livres") → silencieux', () => {
  assert.deepEqual(scanForbiddenCounts('Traumatisme & Blessures critiques | traumatisme.md | ⏳ | 18\n'), [])
})

test('scanForbiddenCounts : ligne + extrait corrects pour une violation en milieu de fichier', () => {
  const text = 'ligne 1\nligne 2\ndepuis les 15 livres\nligne 4\n'
  const v = scanForbiddenCounts(text)
  assert.equal(v.length, 1)
  assert.equal(v[0].line, 3)
})

test('scanForbiddenCounts : "## Les 15 livres" (titre de section, patron sources.md) → détecté', () => {
  const v = scanForbiddenCounts('## Les 15 livres\n')
  assert.equal(v.length, 1)
  assert.equal(v[0].excerpt, '15 livres')
})

test('scanForbiddenCounts : "N chapitres" recopié en dur → détecté', () => {
  const v = scanForbiddenCounts('| Cœur des règles (85 chapitres) |\n')
  assert.equal(v.length, 1)
  assert.equal(v[0].excerpt, '85 chapitres')
})

test('scanForbiddenCounts : "les chapitres" sans chiffre → silencieux', () => {
  assert.deepEqual(scanForbiddenCounts('tous les chapitres du livre sont couverts\n'), [])
})

test('scanForbiddenCounts : compte d\'état en APPOSITION parenthésée → détecté (#1825 E1b)', () => {
  const v = scanForbiddenCounts('| Combat | combat.md | ✅ pilote (14 topics) | 13, 14 |\n')
  assert.equal(v.length, 1)
  assert.equal(v[0].excerpt, '✅ pilote (14 topics)')
  assert.equal(scanForbiddenCounts('| 🟡 brouillon (12 fiches) |\n').length, 1)
})

test('scanForbiddenCounts : pastille suivie d\'une PROSE à chiffre (valeur de règle) → silencieux', () => {
  // Les fiches de domaine ouvrent leurs puces par une pastille ; le chiffre qui suit y est une
  // VALEUR DE RÈGLE, jamais un compte de population (lignes réelles de `combat-naval.md`).
  assert.deepEqual(scanForbiddenCounts('**État du code.** ✅ Tir de zone (3 bandes RAW, corrige l\'ancien)\n'), [])
  assert.deepEqual(scanForbiddenCounts('**État du code.** ✅ **Seuil de succès** (l.13) câblé\n'), [])
  assert.deepEqual(scanForbiddenCounts('**État du code.** ✅ **(1)(2)(3)(4-Dégâts)(5)** après refonte\n'), [])
})

test('scanForbiddenCounts : un prompt qui vise une FOURCHETTE de topics n\'est pas un compte', () => {
  // `atlas-domain.workflow.js` écrit « Vise 8 a 18 topics » : une consigne de cadrage, sans pastille
  // ni parenthèse fermée — rien à périmer, aucune population décrite.
  assert.deepEqual(scanForbiddenCounts('Vise 8 a 18 topics. Renvoie { topics }.\n'), [])
})

test('acceptation DÉCLARÉE : les pages MANUSCRITES seules — rapports générés, catalogues et épreuves DATÉES hors périmètre', () => {
  assert.deepEqual([...CLASSES].sort(), ['auteur', 'fiche'])
  const hors = pagesDeLAtlas(RAW_DIR, { classes: ['catalogue', 'generee', 'epreuve'] })
  assert.ok(hors.length, 'l’Atlas réel porte bien des pages hors périmètre — sinon le contrat est vert à vide')
  const balayes = cheminsBalayes()
  for (const p of hors) assert.ok(!balayes.includes(p.chemin), `${p.relatif} ne doit pas être balayée`)
})

test('`cheminsBalayes` couvre TOUTE page manuscrite de l’Atlas et les ÉCRIVAINS de prose d’Atlas', () => {
  const balayes = cheminsBalayes()
  for (const p of pagesDeLAtlas(RAW_DIR, { classes: CLASSES }))
    assert.ok(balayes.includes(p.chemin), `page manuscrite non balayée : ${p.relatif}`)
  for (const attendu of [ASSEMBLEUR_PATH, SOURCES_VF_WRITER_PATH]) assert.ok(balayes.includes(attendu), attendu)
  assert.ok(balayes.length > 3, `périmètre trop maigre : ${balayes.length} fichier(s)`)
})

test('arbre réel — les états des topics restent dans leur cible pure', () => {
  const erreurs = []
  for (const p of pagesDeLAtlas(RAW_DIR, { classes: ['fiche', 'auteur'] })) {
    const texte = readText(p.chemin)
    const lignes = texte.split('\n')
    for (const f of parseFiche(p.relatif, texte).fields)
      if (lignes.slice(f.headerIdx, f.endIdx).join('\n') !== referenceImplementation(p.relatif, f.topic)) erreurs.push(`${p.relatif}:${f.headerIdx + 1}`)
    if (p.nom === '00-index.md' && /<!-- [A-Z-]+:(?:DEBUT|FIN) -->/.test(texte)) erreurs.push(p.relatif)
  }
  assert.deepEqual(erreurs, [])
})

test('arbre réel — aucun compte manuscrit interdit dans le périmètre balayé (non-régression #544, #1825)', () => {
  const trouves = cheminsBalayes().flatMap((p) => scanForbiddenCounts(readText(p)).map((v) => `${p}:${v.line} « ${v.excerpt} »`))
  assert.deepEqual(trouves, [])
})
