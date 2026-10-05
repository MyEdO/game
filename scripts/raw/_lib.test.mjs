// Test de la graphie de réf partagée (`refRe`, #434, #1825) : UNE fabrique couvre
// TOUS les livres de BOOKS, les livres de cœur compris, avec les MÊMES groupes — m[1] livre · m[2] chapitre
// (optionnel) · m[3] ligne · m[4] suffixe. La forme `LIVRE ch.NN l.X` (écrite en parallèle de
// `LIVRE NN l.X` dans le code) est vue au même titre. Lancé par `npm run test:raw`.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { listerDossier } from '../guards/lib/lister.mjs'
// Les LECTEURS de l'Atlas, importés pour leur acceptation DÉCLARÉE (`CLASSES`) — la table du
// contrat plus bas la confronte, ligne à ligne. Aucun de ces modules ne lit le disque à son
// CHARGEMENT : ce banc les monte tous, et la table ne coûte donc aucun parcours de l'Atlas réel.
import { CLASSES as CLASSES_COVERAGE } from './coverage.mjs'
import { CLASSES as CLASSES_CHECK_REFS } from './check-refs.mjs'
import { CLASSES as CLASSES_RECONCILE } from './reconcile.mjs'
import { CLASSES as CLASSES_GRAPHY, CLASSES_PROSE as CLASSES_GRAPHY_PROSE } from './citation-graphy-guard.mjs'
import { CLASSES as CLASSES_AUDIT_REFS } from './audit-refs-chapitre.mjs'
import { CLASSES as CLASSES_REANCHOR } from './reanchor.mjs'
import { CLASSES as CLASSES_COUNTS } from './check-atlas-counts.mjs'
import { CLASSES as CLASSES_IMPLEMENTE } from './build-implemente.mjs'
import { CLASSES as CLASSES_ENTITE } from './check-entity-in-chapter.mjs'
import { CLASSES as CLASSES_INDEX } from './build-atlas-index.mjs'
import { CLASSES as CLASSES_CROISSANCE } from '../migrations/lib/croissance.mjs'
import { refRe, refFolioRe, allAbbrAlternation, span, refNums, isRangeSuffix, bookOf, chapterFile, BOOKS, booksDe, cataloguesDe, classeDePage, CLASSES_DE_PAGE, coeursDe, coeurDe, coeursDuRegistre, entitesDe, estHorsRegle, horsRegleDe, livreDuDossier, livreDuSigle, livreExtraitDe, livresDeCatalogue, livresDeCoeur, motifHorsRegle, niveauDeSectionDe, niveauxDeSectionDe, pagesDeLAtlas, plagesDEntites, RAWDOC_AUTHOR_META, RAWDOC_META_GENERATED, sigleDe, siglesDeCoeur, teneurDe, teneursDe } from './_lib.mjs'
import booksData from '../../src/data/books.json' with { type: 'json' }

// Des sigles RÉELS, pris au registre par leur RÉGIME (livre de cœur) — jamais recopiés : le test dit
// le contrat de graphie, pas l'identité d'un livre. Résolveur PARTAGÉ avec les autres bancs
// (`siglesDeCoeur`, _lib.mjs) : il nomme sa cause quand le registre ne porte aucun cœur, et il les
// rend TOUS — un banc qui ne jugerait que le premier laisserait le cœur N+1 hors de sa couverture.
const SIGLES_COEUR = siglesDeCoeur()

// #1825 : `books.json` possède l'ORDRE des livres (= l'ordre du fichier, celui que le
// Compendium affiche), `_lib.mjs` n'en tient aucune liste. Le contrat se juge sur une FIXTURE —
// le FILTRE (`dir`) et l'ORDRE du registre, sans recopier le registre réel ni aucun cardinal.
// Sigles volontairement en ordre DÉCROISSANT : un tri glissé dans `booksDe` les remettrait dans
// l'autre sens, et ce test le verrait.
const REGISTRE = [
  { id: 'c', abbr: 'C', dir: 'Source/C' },
  { id: 'b', abbr: 'B' },
  { id: 'a', abbr: 'A', dir: 'Source/A' },
]

test('booksDe : seules les entrées à `dir` entrent, dans l’ORDRE DU REGISTRE (jamais retrié)', () => {
  assert.deepEqual(booksDe(REGISTRE), [['C', 'Source/C'], ['A', 'Source/A']])
})

test('booksDe : un `dir` vide ou null écarte l’entrée, comme un `dir` absent', () => {
  assert.deepEqual(booksDe([{ id: 'v', abbr: 'V', dir: '' }, { id: 'n', abbr: 'N', dir: null }]), [])
})

test('BOOKS : le registre RÉEL passé par `booksDe` — aucune liste de livres dans le script', () => {
  assert.deepEqual(BOOKS, booksDe(booksData))
  assert.ok(BOOKS.every(([abbr, dir]) => abbr && dir), 'une entrée de BOOKS sans sigle ni dossier')
})

// #1825 : le CŒUR d'un livre est une donnée du registre, lue par `abbr`.
// Sigles ET cœurs INVENTÉS : un nom de cœur réel écrit ici rendrait le banc homonyme de l'arbre,
// et ferait juger l'identité d'un corpus là où seul le régime est en cause.
const COEUR_C = 'coeur-c', COEUR_D = 'coeur-d'
const REGISTRE_COEURS = [
  { id: 'c', abbr: 'C', dir: 'Source/C', coeur: COEUR_C },
  { id: 'd', abbr: 'D', dir: 'Source/D', coeur: COEUR_D },
  { id: 's', abbr: 'S', dir: 'Source/S' },
]

test('coeursDe : le registre rend un cœur PAR SIGLE ; une entrée sans `coeur` n’y est pas', () => {
  assert.deepEqual([...coeursDe(REGISTRE_COEURS)], [['C', COEUR_C], ['D', COEUR_D]])
})

test('coeurDe : la valeur du cœur, ou `null` pour un supplément comme pour un sigle inconnu', () => {
  const coeurs = coeursDe(REGISTRE_COEURS)
  assert.equal(coeurDe('C', coeurs), COEUR_C)
  assert.equal(coeurDe('D', coeurs), COEUR_D)
  assert.equal(coeurDe('S', coeurs), null)
  assert.equal(coeurDe('INCONNU', coeurs), null)
})

test('coeurDe : le registre RÉEL déclare des livres de cœur, et CHACUN résout au cœur du registre', () => {
  assert.ok(SIGLES_COEUR.length, 'aucun livre de `books.json` ne porte de `coeur`')
  for (const sigle of SIGLES_COEUR) assert.equal(coeurDe(sigle), coeursDe(booksData).get(sigle))
})

test('livresDeCoeur : les livres à `coeur`, dans l’ORDRE DU REGISTRE (jamais retriés)', () => {
  const inverse = [...REGISTRE_COEURS].reverse()
  assert.deepEqual(livresDeCoeur(booksDe(inverse), coeursDe(inverse)), [['D', 'Source/D'], ['C', 'Source/C']])
})

test('siglesDeCoeur : un registre SANS cœur LÈVE en nommant sa cause, jamais un tableau VIDE silencieux', () => {
  const sansCoeur = [{ id: 's', abbr: 'S', dir: 'Source/S' }]
  assert.throws(
    () => siglesDeCoeur(booksDe(sansCoeur), coeursDe(sansCoeur)),
    /books\.json` ne porte aucun livre de cœur \(champ `coeur`\)/,
  )
  assert.deepEqual(siglesDeCoeur(booksDe(REGISTRE_COEURS), coeursDe(REGISTRE_COEURS)), ['C', 'D'])
})

test('coeursDuRegistre : les cœurs déclarés, dans l’ORDRE DU FICHIER, sans doublon ; un livre sans `dir` n’en ouvre aucun', () => {
  assert.deepEqual(coeursDuRegistre(REGISTRE_ATLAS), ['alpha', 'beta'])
})

// #1825 : ce qu'on sait du LIVRE vit sur son entrée de `books.json` (`teneur`,
// `niveauDeSection`), ce qu'on sait de ses CHAPITRES dans le registre d'outillage
// `scripts/raw/chapitres.json`, qui désigne son livre par son `id` STABLE. Le code n'en tient aucune
// table. Contrat jugé sur des FIXTURES — aucun sigle réel recopié ici.
const REGISTRE_PROPRIETES = [
  { id: 'c', abbr: 'C', dir: 'Source/C', teneur: 'scenario', niveauDeSection: 4 },
  { id: 'm', abbr: 'M', dir: 'Source/M', teneur: 'mixte' },
  { id: 'r', abbr: 'R', dir: 'Source/R' },
]
const PLAGE = { book: 'r', ch: 2, catalogue: 'bestiaire', from: 'Début', to: 'Fin', title: 'Extrait' }
const CHAPITRES = {
  horsRegle: [{ book: 'm', ch: 3, motif: 'prose de campagne' }],
  // Un chapitre appartient à DEUX catalogues : deux entrées, jamais une clé qui porte une liste.
  enCatalogue: [{ book: 'c', ch: 7, catalogue: 'bestiaire' }, PLAGE, { book: 'r', ch: 1, catalogue: 'sorts' }, { book: 'r', ch: 1, catalogue: 'bestiaire' }],
}

test('teneurDe : la teneur d’un livre vient du registre — absente pour un livre de RÈGLES', () => {
  const t = teneursDe(REGISTRE_PROPRIETES)
  assert.deepEqual([...t], [['C', 'scenario'], ['M', 'mixte']])
  assert.equal(teneurDe('C', t), 'scenario')
  assert.equal(teneurDe('M', t), 'mixte')
  assert.equal(teneurDe('R', t), null)
  assert.equal(teneurDe('INCONNU', t), null)
})

test('niveauDeSectionDe : le niveau DÉCLARÉ, et 2 pour qui n’en déclare pas', () => {
  const n = niveauxDeSectionDe(REGISTRE_PROPRIETES)
  assert.equal(niveauDeSectionDe('C', n), 4)
  assert.equal(niveauDeSectionDe('M', n), 2)
  assert.equal(niveauDeSectionDe('INCONNU', n), 2)
})

test('estHorsRegle/motifHorsRegle : le MOTIF est la donnée, lu par SIGLE et par NUMÉRO (jamais par graphie)', () => {
  const h = horsRegleDe(CHAPITRES, REGISTRE_PROPRIETES)
  assert.equal(motifHorsRegle('M', 3, h), 'prose de campagne')
  assert.equal(motifHorsRegle('M', '03', h), 'prose de campagne', '« 03 » et 3 désignent le MÊME chapitre')
  assert.equal(estHorsRegle('M', 3, h), true)
  assert.equal(estHorsRegle('M', 4, h), false)
  assert.equal(estHorsRegle('C', 3, h), false, 'un livre sans chapitre hors-règle n’en porte aucun')
})

test('horsRegleDe : une entrée dont le `book` n’est AUCUN livre du registre n’entre pas — jamais une clé `undefined`', () => {
  const h = horsRegleDe({ horsRegle: [{ book: 'livre-fantome', ch: 1, motif: 'x' }] }, REGISTRE_PROPRIETES)
  assert.equal(h.size, 0)
})

test('entitesDe/plagesDEntites : les plages d’un livre par SIGLE, dans l’ORDRE DU FICHIER, bornes `{ slug, occ }` comprises', () => {
  const borne = { slug: 'premier-talent', occ: 1 }
  const e = entitesDe({ entites: [{ book: 'r', ch: 4, from: borne, motif: 'talents' }, { book: 'r', ch: 2, motif: 'sorts' }, { book: 'livre-fantome', ch: 1, motif: 'x' }] }, REGISTRE_PROPRIETES)
  assert.deepEqual(plagesDEntites('R', e), [{ ch: 4, from: borne, motif: 'talents' }, { ch: 2, motif: 'sorts' }])
  assert.deepEqual(plagesDEntites('C', e), [], 'un livre sans plage n’en porte aucune')
  assert.deepEqual([...e.keys()], ['R'], 'un `book` hors registre n’entre pas — jamais une clé `undefined`')
})

test('cataloguesDe/livresDeCatalogue : un catalogue rend ses livres dans l’ORDRE DU FICHIER, plages comprises', () => {
  const c = cataloguesDe(CHAPITRES, REGISTRE_PROPRIETES)
  assert.deepEqual(livresDeCatalogue('bestiaire', c), [
    ['C', [{ ch: 7 }]],
    ['R', [{ ch: 2, from: 'Début', to: 'Fin', title: 'Extrait' }, { ch: 1 }]],
  ])
  assert.deepEqual(livresDeCatalogue('sorts', c), [['R', [{ ch: 1 }]]])
  assert.deepEqual(livresDeCatalogue('catalogue-inconnu', c), [], 'un catalogue sans livre rend une liste vide, jamais undefined')
})

test('cataloguesDe : un MÊME chapitre dans deux catalogues entre dans les deux, chacun par SON entrée', () => {
  const c = cataloguesDe(CHAPITRES, REGISTRE_PROPRIETES)
  assert.deepEqual(livresDeCatalogue('sorts', c)[0][1], [{ ch: 1 }])
  assert.ok(livresDeCatalogue('bestiaire', c)[1][1].some((s) => s.ch === 1))
})

test('cataloguesDe : l’ORDRE des entrées du fichier est celui du rendu — aucun tri à la lecture', () => {
  const inverse = { ...CHAPITRES, enCatalogue: [...CHAPITRES.enCatalogue].reverse() }
  assert.deepEqual(livresDeCatalogue('bestiaire', cataloguesDe(inverse, REGISTRE_PROPRIETES)).map(([a]) => a), ['R', 'C'])
})

test('cataloguesDe : l’id STABLE du livre porte la relation, jamais son sigle — renommer un sigle ne casse rien', () => {
  const renomme = REGISTRE_PROPRIETES.map((b) => (b.id === 'c' ? { ...b, abbr: 'SIGLE-RENOMME' } : b))
  assert.deepEqual(livresDeCatalogue('bestiaire', cataloguesDe(CHAPITRES, renomme)).map(([a]) => a), ['SIGLE-RENOMME', 'R'])
})

test('refRe : "LDB 17 l.25" matche', () => {
  const m = [...'LDB 17 l.25'.matchAll(refRe())]
  assert.equal(m.length, 1)
  assert.equal(m[0][1], 'LDB')
  assert.equal(m[0][2], '17')
  assert.equal(m[0][3], '25')
})

test('refRe : "LDB ch.17 l.25" matche (forme ch. optionnelle)', () => {
  const m = [...'LDB ch.17 l.25'.matchAll(refRe())]
  assert.equal(m.length, 1)
  assert.equal(m[0][2], '17')
  assert.equal(m[0][3], '25')
})

test('refRe : "ch.23 l.75" SANS livre ne matche pas (le groupe livre reste obligatoire)', () => {
  const m = [...'La Difficulté de l\'Artisanat (ch.23 l.75-103)'.matchAll(refRe())]
  assert.equal(m.length, 0)
})

test('refRe : suffixe plage "l.10-25" préservé avec la forme ch.', () => {
  const m = [...'LDB ch.10 l.10-25'.matchAll(refRe())]
  assert.equal(m.length, 1)
  assert.equal(span(m[0][3], m[0][4]).join(','), '10,25')
})

test('refRe : suffixe points "l.10+17" préservé avec la forme ch.', () => {
  const m = [...'LDB ch.10 l.10+17'.matchAll(refRe())]
  assert.equal(m.length, 1)
  assert.equal(span(m[0][3], m[0][4]).join(','), '10,17')
})

// --- UNE graphie : un livre de cœur n'a pas de grammaire propre (#1825) ---
test('refRe : TOUT livre de CŒUR et un AUTRE livre rendent les MÊMES groupes', () => {
  const [o] = [...'MDG 17 l.25-30'.matchAll(refRe())]
  assert.deepEqual([o[1], o[2], o[3], o[4]], ['MDG', '17', '25', '-30'])
  for (const sigle of SIGLES_COEUR) {
    const [p] = [...`${sigle} 17 l.25-30`.matchAll(refRe())]
    assert.deepEqual([p[1], p[2], p[3], p[4]], [sigle, '17', '25', '-30'])
  }
})

test('refRe : le CHAPITRE est optionnel pour TOUS les livres, livres de cœur compris', () => {
  const [o] = [...'MSRC l.90'.matchAll(refRe())]
  assert.equal(o[2], undefined)
  assert.equal(o[3], '90')
  for (const sigle of SIGLES_COEUR) {
    const [p] = [...`${sigle} l.168`.matchAll(refRe())]
    assert.equal(p[2], undefined)
    assert.equal(p[3], '168')
  }
})

test('allAbbrAlternation : TOUS les livres de BOOKS, les livres de cœur compris — aucun exclu', () => {
  const toutes = allAbbrAlternation().split('|')
  assert.equal(toutes.length, BOOKS.length)
  for (const sigle of SIGLES_COEUR) assert.ok(toutes.includes(sigle), `le livre de cœur ${sigle} est hors alternation`)
  assert.deepEqual([...toutes].sort(), BOOKS.map(([a]) => a).sort())
})

test('refFolioRe : miroir FOLIO, mêmes groupes, livres de cœur compris', () => {
  const [o] = [...'ADE II 08 p.233'.matchAll(refFolioRe())]
  assert.deepEqual([o[1], o[2], o[3], o[4]], ['ADE II', '08', '233', ''])
  for (const sigle of SIGLES_COEUR) {
    const [p] = [...`${sigle} 48 p.255-256`.matchAll(refFolioRe())]
    assert.deepEqual([p[1], p[2], p[3], p[4]], [sigle, '48', '255', '-256'])
  }
})

// --- Forme COMPACTE `l.A/B/C` (#1318) ---
// La grammaire rend CHAQUE numéro d'une compacte : un numéro qui dépasse les bornes du chapitre
// rougit à `check-code-refs` à n'importe quelle place de la compacte, comme cité seul.
//
// SPÉCIMENS CONSTRUITS, jamais écrits en graphie canonique (patron `fixtureRef` de
// `src/raw-ref-integrity.test.ts`) : ce fichier est lui-même scanné par les gardes de réf du dépôt,
// qui ne distinguent pas une citation vivante d'un spécimen de test — une fixture littérale
// s'y lirait comme une vraie réf morte.
/** Réf de FIXTURE : `spec(s, 18, '298/315/369')` → « <s> 18 l.298/315/369 ». */
const spec = (sigle, ch, tail) => [sigle, String(ch), `l.${tail}`].join(' ')
/** Tous les numéros de ligne rendus par la grammaire pour une chaîne (miroir du parcours des gardes). */
const nums = (s) => [...s.matchAll(refRe())].flatMap((m) => refNums(m[3], m[4]))

test('refRe : forme COMPACTE à trois numéros — les TROIS sont rendus', () => {
  for (const sigle of SIGLES_COEUR) assert.deepEqual(nums(spec(sigle, 18, '298/315/369')), [298, 315, 369])
})

test('refRe : forme COMPACTE à deux numéros', () => {
  for (const sigle of SIGLES_COEUR) assert.deepEqual(nums(spec(sigle, 18, '202/213')), [202, 213])
})

test('refRe : forme COMPACTE sans chapitre (`l.298/315`) — un livre de cœur la rend comme les autres', () => {
  for (const sigle of SIGLES_COEUR) assert.deepEqual(nums(`${sigle} l.298/315`), [298, 315])
})

test('refRe : la borne HAUTE d’une compacte est celle que borne check-code-refs', () => {
  for (const sigle of SIGLES_COEUR) {
    const m = [...spec(sigle, 18, '222/999').matchAll(refRe())]
    assert.equal(m.length, 1)
    assert.equal(span(m[0][3], m[0][4]).join(','), '222,999')
  }
})

test('refRe : réf MULTI-CHAPITRES — le nombre après `/` suivi de ` l.` est un CHAPITRE, jamais une ligne', () => {
  for (const sigle of SIGLES_COEUR) assert.deepEqual(nums(`${spec(sigle, 18, '298')}/20 l.72/20 l.32-49`), [298])
})

test('isRangeSuffix : seule `-fin` est un intervalle ; `+pts` et `/compacte` sont des ancres distinctes', () => {
  assert.equal(isRangeSuffix('-25'), true)
  assert.equal(isRangeSuffix('+17'), false)
  assert.equal(isRangeSuffix('/213'), false)
  assert.equal(isRangeSuffix(''), false)
})

// ANGLES MORTS ASSERTÉS (mesurés, pas supposés) — patron de `src/raw-ref-integrity.test.ts` :
//  a) une réf MULTI-CHAPITRES ne rend QUE son premier chapitre (les chapitres suivants n'ont pas de
//     sigle de livre, la grammaire les ignore) ;
//  b) une réf ENROULÉE (coupée par un retour à la ligne au milieu de la réf) est invisible : tous
//     les scanners lisent LIGNE À LIGNE (#1318).
test('ANGLES MORTS : multi-chapitres partiel, et réf ENROULÉE sur deux lignes — non vus, dit ici', () => {
  for (const sigle of SIGLES_COEUR)
    assert.deepEqual([...`${spec(sigle, 18, '5')}/20 l.14`.matchAll(refRe())].map((m) => m[2]), ['18']) // le `20` non rendu
  assert.equal([...`LDB 09 /\n * 18 ${'l.'}382`.matchAll(refRe())].length, 0) // enroulée : rien
})

test('refRe : "AA ch.5 l.12" matche (forme ch. optionnelle)', () => {
  const m = [...'AA ch.5 l.12'.matchAll(refRe())]
  assert.equal(m.length, 1)
  assert.equal(m[0][2], '5')
  assert.equal(m[0][3], '12')
})

test('refRe : "AA 5 l.12" (sans ch.) matche', () => {
  const m = [...'AA 5 l.12'.matchAll(refRe())]
  assert.equal(m.length, 1)
  assert.equal(m[0][2], '5')
  assert.equal(m[0][3], '12')
})

test('refRe : "MDG 12 l.221" matche (#434)', () => {
  const m = [...'MDG 12 l.221'.matchAll(refRe())]
  assert.equal(m.length, 1)
  assert.equal(m[0][1], 'MDG')
  assert.equal(m[0][2], '12')
  assert.equal(m[0][3], '221')
})

test('refRe : "MDG ch.12 l.221" matche (forme ch. optionnelle)', () => {
  const m = [...'MDG ch.12 l.221'.matchAll(refRe())]
  assert.equal(m.length, 1)
  assert.equal(m[0][1], 'MDG')
  assert.equal(m[0][2], '12')
  assert.equal(m[0][3], '221')
})

test('refRe : "MSRC 14 l.5" matche comme MSRC, pas comme MSR (tri par longueur décroissante)', () => {
  const m = [...'MSRC 14 l.5'.matchAll(refRe())]
  assert.equal(m.length, 1)
  assert.equal(m[0][1], 'MSRC')
})

test('refRe : "EDOC 5 l.29" matche comme EDOC, pas comme EDO', () => {
  const m = [...'EDOC 5 l.29'.matchAll(refRe())]
  assert.equal(m.length, 1)
  assert.equal(m[0][1], 'EDOC')
})

test('refRe : "ADE II 08 l.233" matche (sigle à espace)', () => {
  const m = [...'ADE II 08 l.233'.matchAll(refRe())]
  assert.equal(m.length, 1)
  assert.equal(m[0][1], 'ADE II')
  assert.equal(m[0][2], '08')
  assert.equal(m[0][3], '233')
})

test('refRe : "ADE2 ch.8 l.65" ne matche PAS (graphie hors registre, #585)', () => {
  const m = [...'ADE2 ch.8 l.65'.matchAll(refRe())]
  assert.equal(m.length, 0)
})

test('refRe : "Midd 02 l.10" ne matche PAS (graphie hors registre)', () => {
  const m = [...'Midd 02 l.10'.matchAll(refRe())]
  assert.equal(m.length, 0)
})

test('refRe : "ch.23 l.75" SANS livre ne matche pas (second spécimen, sans sigle alentour)', () => {
  const m = [...'La Difficulté (ch.23 l.75)'.matchAll(refRe())]
  assert.equal(m.length, 0)
})

test('bookOf : "ADE2" (ancienne variante) résout à null (identité stricte, #585)', () => {
  assert.equal(bookOf('ADE2'), null)
})

test('bookOf : "ADE1" (ancienne variante) résout à null', () => {
  assert.equal(bookOf('ADE1'), null)
})

test('bookOf : "ADEII" (ancienne variante) résout à null', () => {
  assert.equal(bookOf('ADEII'), null)
})

test('bookOf : "ADEI" (ancienne variante) résout à null', () => {
  assert.equal(bookOf('ADEI'), null)
})

test('bookOf : "NADAJ" (graphie hors registre ; canon "NADJ") résout à null', () => {
  assert.equal(bookOf('NADAJ'), null)
})

test('bookOf : "Midd" (graphie hors registre ; canon "MCLB") résout à null', () => {
  assert.equal(bookOf('Midd'), null)
})

test('bookOf : "ADE II" (déjà canonique) résout par identité', () => {
  assert.equal(bookOf('ADE II'), 'ADE II')
})

test('bookOf : "MSRC" (déjà canonique) résout par identité', () => {
  assert.equal(bookOf('MSRC'), 'MSRC')
})

test('bookOf : "NADJ" (déjà canonique) résout par identité', () => {
  assert.equal(bookOf('NADJ'), 'NADJ')
})

test('bookOf : "MDG" (déjà canonique) résout par identité', () => {
  assert.equal(bookOf('MDG'), 'MDG')
})

test('bookOf : texte inconnu résout à null', () => {
  assert.equal(bookOf('Inconnu'), null)
})

test('chapterFile : résout avec la graphie canonique "ADE II"', () => {
  const cf = chapterFile(bookOf('ADE II'), '08')
  assert.notEqual(cf, null)
})

test('chapterFile : résout avec la graphie canonique "ADE I"', () => {
  const cf = chapterFile(bookOf('ADE I'), '6')
  assert.notEqual(cf, null)
})

test('chapterFile : résout avec la graphie canonique "NADJ"', () => {
  const cf = chapterFile(bookOf('NADJ'), '16')
  assert.notEqual(cf, null)
})

test('chapterFile : une ANCIENNE variante (bookOf → null) résout à null', () => {
  const cf = chapterFile(bookOf('ADE2'), '03')
  assert.equal(cf, null)
})

test('refRe : instances FRAÎCHES à chaque appel (lastIndex non partagé)', () => {
  const re1 = refRe()
  re1.exec('LDB 1 l.1')
  assert.notEqual(re1.lastIndex, 0)
  const re2 = refRe()
  assert.equal(re2.lastIndex, 0)
})

// --- #1825 : `pagesDeLAtlas`, l'ÉNUMÉRATION UNIQUE de `docs/raw/` ---
// Registre FIXTURE à sigles ET à cœurs INVENTÉS : le contrat est la PARTITION PAR CŒUR, jamais
// l'identité d'un cœur réel. Deux cœurs, pour que le contrat se juge sur N et pas sur 1.
const REGISTRE_ATLAS = [
  { id: 'p', abbr: 'P', dir: 'Source/P', coeur: 'alpha' },
  { id: 'q', abbr: 'Q', dir: 'Source/Q', coeur: 'beta' },
  { id: 'r', abbr: 'R', dir: 'Source/R' },
  { id: 's', abbr: 'S', coeur: 'gamma' },
]
// Un nom RÉEL de chaque classe méta, pris à sa SOURCE (`_lib.mjs`) et jamais recopié : ce banc dit la
// classification, pas le nom d'un rapport.
const NOM_GENEREE = [...RAWDOC_META_GENERATED][0]
const NOM_AUTEUR = [...RAWDOC_AUTHOR_META][0]

/** Un Atlas FIXTURE sur disque, puis détruit. */
function avecAtlas(pages, fn) {
  const dir = mkdtempSync(join(tmpdir(), 'pages-atlas-'))
  try {
    for (const rel of pages) {
      const coupe = rel.lastIndexOf('/')
      if (coupe >= 0) mkdirSync(join(dir, rel.slice(0, coupe)), { recursive: true })
      writeFileSync(join(dir, rel), '', 'utf8')
    }
    return fn(dir)
  } finally { rmSync(dir, { recursive: true, force: true }) }
}
// Les cinq classes, un nom de fiche porté par les DEUX cœurs, et un fichier qui n'est pas une page.
const ATLAS = [
  NOM_GENEREE,
  NOM_AUTEUR,
  'alpha/catalogue-z.md',
  'alpha/domaine.md',
  'alpha/epreuve-2000-01-01.md',
  'alpha/sources.md',
  'beta/domaine.md',
  'beta/note.txt',
]
const relatifsRetenus = (dir, classes) =>
  pagesDeLAtlas(dir, { classes, registre: REGISTRE_ATLAS }).map((p) => p.relatif)

test('classeDePage : les cinq classes se dérivent du NOM, depuis les ensembles nommés de `_lib.mjs`', () => {
  assert.equal(classeDePage(NOM_GENEREE), 'generee')
  assert.equal(classeDePage(NOM_AUTEUR), 'auteur')
  assert.equal(classeDePage('epreuve-2000-01-01.md'), 'epreuve')
  assert.equal(classeDePage('catalogue-z.md'), 'catalogue')
  assert.equal(classeDePage('domaine.md'), 'fiche')
})

test('pagesDeLAtlas : une page porte son CŒUR, son nom, son chemin RELATIF et sa classe ; une page de racine a `coeur` null', () => {
  avecAtlas(ATLAS, (dir) => {
    const pages = pagesDeLAtlas(dir, { classes: CLASSES_DE_PAGE, registre: REGISTRE_ATLAS })
    assert.deepEqual(
      pages.map((p) => [p.relatif, p.coeur, p.nom, p.classe]),
      [
        [NOM_AUTEUR, null, NOM_AUTEUR, 'auteur'],
        ['alpha/catalogue-z.md', 'alpha', 'catalogue-z.md', 'catalogue'],
        ['alpha/domaine.md', 'alpha', 'domaine.md', 'fiche'],
        ['alpha/epreuve-2000-01-01.md', 'alpha', 'epreuve-2000-01-01.md', 'epreuve'],
        ['alpha/sources.md', 'alpha', 'sources.md', 'auteur'],
        ['beta/domaine.md', 'beta', 'domaine.md', 'fiche'],
        [NOM_GENEREE, null, NOM_GENEREE, 'generee'],
      ].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)),
    )
    assert.ok(pages.every((p) => p.chemin === join(dir, p.relatif)), 'le `chemin` se lit tel quel')
    assert.ok(!pages.some((p) => p.nom.endsWith('.txt')), 'une page de l’Atlas est un `.md`')
  })
})

test('pagesDeLAtlas : DEUX cœurs portent le même nom de fiche — les deux sortent, distingués par leur RELATIF', () => {
  avecAtlas(ATLAS, (dir) => {
    const fiches = pagesDeLAtlas(dir, { classes: ['fiche'], registre: REGISTRE_ATLAS })
    assert.deepEqual(fiches.map((p) => p.relatif), ['alpha/domaine.md', 'beta/domaine.md'])
    assert.equal(new Set(fiches.map((p) => p.nom)).size, 1, 'le NOM seul collisionne : c’est le relatif qui identifie')
  })
})

// La TABLE D'ACCEPTATION : chaque lecteur de l'Atlas DÉCLARE les classes qu'il prend, et plus aucun
// ne les compose à la main. Une ligne par acceptation RÉELLEMENT distincte.
//
// Les lecteurs y sont IMPORTÉS, jamais nommés dans un libellé : une ligne dont les lecteurs ne
// seraient qu'une chaîne ne dirait rien de ce que le module déclare vraiment — le lecteur pourrait
// changer d'acceptation sans que le contrat bouge. Ici, `declarants` porte la constante `CLASSES`
// EXPORTÉE par chaque module, et le banc la confronte à la ligne. Deux modules ne déclarent rien
// parce qu'ils COMPOSENT l'acceptation d'un autre (`reanchor-split.mjs` importe celle de
// `check-refs.mjs` ; `check-catalogue-complete.mjs` passe par `pagesLues` de `coverage.mjs`) :
// c'est la déclaration de l'autre qui les tient.
const ACCEPTATIONS = [
  { classes: ['fiche', 'catalogue', 'auteur', 'epreuve'],
    declarants: { 'coverage.mjs': CLASSES_COVERAGE, 'check-refs.mjs': CLASSES_CHECK_REFS, 'reconcile.mjs': CLASSES_RECONCILE, 'build-atlas-index.mjs': CLASSES_INDEX },
    attendu: [NOM_AUTEUR, 'alpha/catalogue-z.md', 'alpha/domaine.md', 'alpha/epreuve-2000-01-01.md', 'alpha/sources.md', 'beta/domaine.md'] },
  { classes: ['fiche', 'catalogue', 'auteur'],
    declarants: { 'citation-graphy-guard.mjs': CLASSES_GRAPHY, 'audit-refs-chapitre.mjs': CLASSES_AUDIT_REFS },
    attendu: [NOM_AUTEUR, 'alpha/catalogue-z.md', 'alpha/domaine.md', 'alpha/sources.md', 'beta/domaine.md'] },
  { classes: ['fiche', 'catalogue'],
    declarants: { 'citation-graphy-guard.mjs (CLASSES_PROSE)': CLASSES_GRAPHY_PROSE, 'reanchor.mjs': CLASSES_REANCHOR },
    attendu: ['alpha/catalogue-z.md', 'alpha/domaine.md', 'beta/domaine.md'] },
  { classes: ['fiche', 'auteur'],
    declarants: { 'check-atlas-counts.mjs': CLASSES_COUNTS },
    attendu: [NOM_AUTEUR, 'alpha/domaine.md', 'alpha/sources.md', 'beta/domaine.md'] },
  { classes: ['fiche'],
    declarants: { 'build-implemente.mjs': CLASSES_IMPLEMENTE, 'croissance.mjs': CLASSES_CROISSANCE, 'check-entity-in-chapter.mjs': CLASSES_ENTITE },
    attendu: ['alpha/domaine.md', 'beta/domaine.md'] },
]

for (const { classes, declarants, attendu } of ACCEPTATIONS) {
  const nom = classes.join(' + ')
  test(`pagesDeLAtlas : acceptation DÉCLARÉE — ${nom}`, () => {
    avecAtlas(ATLAS, (dir) => assert.deepEqual(relatifsRetenus(dir, classes), attendu))
  })
  test(`acceptation DÉCLARÉE — les lecteurs de « ${nom} » l'EXPORTENT telle quelle`, () => {
    for (const [lecteur, declaree] of Object.entries(declarants))
      assert.deepEqual([...declaree].sort(), [...classes].sort(), `${lecteur} a changé d'acceptation sans que le contrat bouge`)
  })
}

test('acceptation DÉCLARÉE : AUCUN lecteur de `scripts/raw` n’échappe à la table du contrat', () => {
  // Le contrat ne vaut que s'il est TOTAL : un lecteur neuf qui exporte sa propre acceptation sans
  // entrer ici passerait au vert par ABSENCE. La population vient du disque, jamais d'une liste.
  const ICI = dirname(fileURLToPath(import.meta.url))
  const declares = new Set(ACCEPTATIONS.flatMap((a) => Object.keys(a.declarants)).map((k) => k.split(' ')[0]))
  const exporteurs = listerDossier(ICI)
    .filter((f) => f.endsWith('.mjs') && !f.endsWith('.test.mjs'))
    .filter((f) => /^export const CLASSES\b/m.test(readFileSync(join(ICI, f), 'utf8')))
  assert.deepEqual(exporteurs.filter((f) => !declares.has(f)), [])
})

test('pagesDeLAtlas : l’épreuve DATÉE reste vue par l’acceptation qui la déclare (piège #1825)', () => {
  avecAtlas(ATLAS, (dir) => {
    assert.deepEqual(relatifsRetenus(dir, ['epreuve']), ['alpha/epreuve-2000-01-01.md'])
  })
})

test('pagesDeLAtlas : une page de RÈGLES posée à la racine LÈVE — aucun cœur n’est implicite', () => {
  for (const orpheline of ['domaine.md', 'catalogue-z.md', 'epreuve-2000-01-01.md']) {
    avecAtlas([orpheline], (dir) => {
      assert.throws(
        () => pagesDeLAtlas(dir, { classes: CLASSES_DE_PAGE, registre: REGISTRE_ATLAS }),
        /posée à la RACINE de l'Atlas/,
        `« ${orpheline} » à la racine devrait lever`,
      )
    })
  }
})

test('pagesDeLAtlas : un sous-dossier qui n’est pas un cœur du registre LÈVE, en nommant les cœurs connus', () => {
  avecAtlas(['gamma/domaine.md'], (dir) => {
    assert.throws(
      () => pagesDeLAtlas(dir, { classes: CLASSES_DE_PAGE, registre: REGISTRE_ATLAS }),
      /gamma » n'est pas un cœur du registre des livres[\s\S]*alpha, beta/,
      'un cœur déclaré sur un livre SANS extraction n’ouvre aucun dossier',
    )
  })
})

test('pagesDeLAtlas : l’Atlas est PLAT à un niveau — un dossier sous un cœur LÈVE', () => {
  avecAtlas(['alpha/sous/domaine.md'], (dir) => {
    assert.throws(
      () => pagesDeLAtlas(dir, { classes: CLASSES_DE_PAGE, registre: REGISTRE_ATLAS }),
      /n'est pas un cœur du registre des livres/,
    )
  })
})

test('pagesDeLAtlas : une acceptation NON DÉCLARÉE ou INCONNUE LÈVE — aucun défaut de périmètre n’est offert', () => {
  avecAtlas(ATLAS, (dir) => {
    assert.throws(() => pagesDeLAtlas(dir, { registre: REGISTRE_ATLAS }), /`classes` non déclaré/)
    assert.throws(() => pagesDeLAtlas(dir, { classes: [], registre: REGISTRE_ATLAS }), /`classes` non déclaré/)
    assert.throws(
      () => pagesDeLAtlas(dir, { classes: ['fiche', 'rapport'], registre: REGISTRE_ATLAS }),
      /classe\(s\) de page inconnue\(s\) « rapport »/,
    )
  })
})

test('pagesDeLAtlas : un Atlas ABSENT lève par défaut, et rend vide quand l’appelant le DÉCLARE', () => {
  const fantome = join(tmpdir(), `pages-atlas-absent-${process.pid}`)
  assert.throws(() => pagesDeLAtlas(fantome, { classes: ['fiche'], registre: REGISTRE_ATLAS }))
  assert.deepEqual(pagesDeLAtlas(fantome, { classes: ['fiche'], registre: REGISTRE_ATLAS, absent: 'vide' }), [])
})

test('livreExtraitDe : un livre se résout par son id STABLE, et seulement s’il est EXTRAIT', () => {
  const registre = [...REGISTRE_PROPRIETES, { id: 'sans-dossier', abbr: 'S' }]
  assert.equal(livreExtraitDe('m', registre)?.dir, 'Source/M')
  assert.equal(livreExtraitDe('M', registre), null, 'le sigle n’est pas l’id')
  assert.equal(livreExtraitDe('sans-dossier', registre), null, 'un livre sans `dir` n’est pas extrait')
  assert.equal(livreExtraitDe('inconnu', registre), null)
})

test('livreDuSigle : un livre se résout par son SIGLE, sur le MÊME prédicat d’extraction que livreExtraitDe', () => {
  const registre = [...REGISTRE_PROPRIETES, { id: 'sans-dossier', abbr: 'S' }, { id: 'sans-sigle', dir: 'Source/X' }]
  assert.equal(livreDuSigle('M', registre)?.id, 'm')
  assert.equal(livreDuSigle('m', registre), null, 'l’id n’est pas le sigle')
  assert.equal(livreDuSigle('S', registre), null, 'un livre sans `dir` n’est pas extrait')
  assert.equal(livreExtraitDe('sans-sigle', registre), null, 'un livre sans sigle n’est pas extrait non plus')
  assert.equal(livreDuSigle('Z', registre), null)
})

test('livreDuDossier : un livre EXTRAIT par son dossier, séparateurs et barre finale indifférents', () => {
  const registre = [{ id: 'a', abbr: 'A', dir: 'Source/Livre A' }, { id: 'sans-sigle', dir: 'Source/Livre B' }]
  assert.equal(livreDuDossier('Source/Livre A', registre)?.id, 'a')
  assert.equal(livreDuDossier('Source\\Livre A\\', registre)?.id, 'a')
  assert.equal(livreDuDossier('Source/Livre B', registre), null, 'un livre sans sigle n’est pas extrait')
  assert.equal(livreDuDossier('Source/Autre', registre), null)
})

test('sigleDe : le sigle d’un livre EXTRAIT par son id — `null` hors du prédicat d’extraction', () => {
  const registre = [...REGISTRE_PROPRIETES, { id: 'sans-dossier', abbr: 'S' }, { id: 'sans-sigle', dir: 'Source/X' }]
  assert.equal(sigleDe('m', registre), 'M')
  assert.equal(sigleDe('M', registre), null, 'le sigle n’est pas l’id')
  assert.equal(sigleDe('sans-dossier', registre), null, 'un livre sans `dir` n’est pas extrait')
  assert.equal(sigleDe('inconnu', registre), null)
})
