// L'ANCRE D'UN TITRE DE L'ATLAS (#1824) — le CONTRAT de la fonction est CE banc.
// Chaque cas est TIRÉ DU CORPUS (`fichier:ligne` en regard) : la règle se mesure sur les titres que
// l'Atlas porte réellement, jamais sur des titres inventés pour la commodité de la règle.
//   node --test scripts/raw/lib/ancres.test.mjs   (joué par `npm run test:raw`)
import test from 'node:test'
import assert from 'node:assert/strict'
import { ancreDeTitre, ancresDePage, idsHtmlDePage, tableDAncres, texteRenduDeTitre } from './ancres.mjs'

test('ancreDeTitre : la ponctuation PART et l’espace qu’elle laisse devient un `-` — ni fusion, ni rognage', () => {
  // docs/raw/4e/activites.md:62 — les guillemets français laissent deux `-` et une queue de `-`.
  assert.equal(ancreDeTitre('Cadre général « Entre deux aventures »'), 'cadre-général--entre-deux-aventures-')
  // docs/raw/4e/activites.md:164 · 307 — la barre oblique et le point d’exclamation partent de même.
  assert.equal(ancreDeTitre('Amélioration Elfique / Prestige Elfique'), 'amélioration-elfique--prestige-elfique')
  assert.equal(ancreDeTitre('Faites-moi une Faveur !'), 'faites-moi-une-faveur-')
  // docs/raw/4e/combat.md:154 — parenthèses et point d’une référence.
  assert.equal(
    ancreDeTitre('Conditions qui peuvent accorder la Surprise (LDB 13 l.51-59)'),
    'conditions-qui-peuvent-accorder-la-surprise-ldb-13-l51-59',
  )
})

test('ancreDeTitre : les ACCENTS restent, l’apostrophe courbe part, le `_` d’un mot reste', () => {
  // Titres de docs/raw/4e/bestiaire.md · docs/raw/00-index.md · docs/raw/4e/catalogue-creatures.md.
  assert.equal(ancreDeTitre('Écarts ou points à vérifier'), 'écarts-ou-points-à-vérifier')
  assert.equal(ancreDeTitre('⚠ Fichiers au-dessus du seuil d’outillage (512 Ko)'), '-fichiers-au-dessus-du-seuil-doutillage-512-ko')
  assert.equal(ancreDeTitre('[LDB 84] _GoBack'), 'ldb-84-_goback')
})

test('ancreDeTitre : le titre s’ancre sur son texte RENDU — gras, italique, balise, ancre de folio', () => {
  // docs/raw/4e/catalogue-carrieres.md:45 · 24 · 3387 — le `<span>` de folio précède le titre.
  assert.equal(ancreDeTitre('<span id="page-48-0" data-folio="47"></span>**Niveaux de Carrière**'), 'niveaux-de-carrière')
  assert.equal(ancreDeTitre('<span id="page-47-0" data-folio="46"></span>• CLASSES ET CARRIÈRES •'), '-classes-et-carrières-')
  assert.equal(ancreDeTitre('*« SI TU NE PEUX PAS PAYER LE PRIX, FAIS PAS LE PARI. »*'), '-si-tu-ne-peux-pas-payer-le-prix-fais-pas-le-pari-')
  // docs/raw/4e/combat.md:6175 · docs/raw/00-index.md:1 — pastille d’état et tiret cadratin.
  assert.equal(ancreDeTitre('Surprise ❌'), 'surprise-')
  assert.equal(ancreDeTitre('Atlas RAW — Index'), 'atlas-raw--index')
  assert.equal(texteRenduDeTitre('**Niveaux de Carrière** ##'), 'Niveaux de Carrière')
})

test('ancresDePage : les HOMONYMES d’une page se suffixent `-1`, `-2`, dans l’ordre du document', () => {
  // docs/raw/4e/combat.md:414 · 1054 — la casse ne distingue pas deux titres : même ancre de base.
  const page = '# Une fiche\n\n## Supériorité numérique\n\nprose\n\n### Supériorité Numérique\n'
  assert.deepEqual(ancresDePage(page), [
    { ancre: 'une-fiche', titre: 'Une fiche', niveau: 1, ligne: 1 },
    { ancre: 'supériorité-numérique', titre: 'Supériorité numérique', niveau: 2, ligne: 3 },
    { ancre: 'supériorité-numérique-1', titre: 'Supériorité Numérique', niveau: 3, ligne: 7 },
  ])
})

test('ancresDePage : un titre écrit dans un BLOC DE CODE est un exemple — il n’ancre rien', () => {
  const page = '# Vrai\n\n```md\n## Faux\n```\n\n## Vrai aussi\n'
  assert.deepEqual(ancresDePage(page).map((a) => a.ancre), ['vrai', 'vrai-aussi'])
})

test('idsHtmlDePage : le SECOND espace d’ancres — tout `id="…"` posé hors bloc de code', () => {
  // docs/raw/4e/catalogue-carrieres.md:24 — l’ancre de folio des catalogues.
  const page = '# Un titre\n\n<span id="page-3-0" data-folio="2"></span>\n\n```html\n<span id="jamais"></span>\n```\n'
  assert.deepEqual(idsHtmlDePage(page), [{ ancre: 'page-3-0', ligne: 3 }])
})

test('tableDAncres : la table d’une page est l’UNION de ses headings et de ses `id=` HTML', () => {
  const page = '# Un titre\n\n<span id="page-3-0" data-folio="2"></span>\n'
  assert.deepEqual([...tableDAncres(page)].sort(), ['page-3-0', 'un-titre'])
})
