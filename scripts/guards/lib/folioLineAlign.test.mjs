// Mécanique de mesure (PURE) de `folioLineAlign.mjs` (#1318 E8) : la découpe d'une citation à la
// ligne, le folio qui gouverne une ligne, la sélection des entrées citées et le verdict d'alignement,
// prouvés sur des chapitres NUS en mémoire — aucun disque. Le cliquet sur le vrai `src/data/` vit
// dans `src/data/folio-line-align.test.ts`.
// Patron des voisins de `scripts/guards/lib/` : `node:test` + `node:assert/strict`, exécutable par
// `node --test` nu.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  auditAlignment,
  citedEntries,
  folioGoverning,
  folioGoverningWhy,
  parseLineCitation,
} from './folioLineAlign.mjs'

test('parseLineCitation reconnaît les formes réelles du dépôt, et refuse le reste', () => {
  assert.deepEqual(parseLineCitation('LDB 12 l.28/32'), { abbr: 'LDB', chapter: 12, line: 28 })
  assert.deepEqual(parseLineCitation('ADE II 09 l.3'), { abbr: 'ADE II', chapter: 9, line: 3 })
  assert.deepEqual(parseLineCitation('AA 07 l.1-185'), { abbr: 'AA', chapter: 7, line: 1 })
  assert.equal(parseLineCitation('MDG 15 p.131'), null) // citation au FOLIO, pas à la ligne
  assert.equal(parseLineCitation('EDOC 12'), null) // chapitre seul
  assert.equal(parseLineCitation(42), null)
})

test('folioGoverning REPORTE le folio ouvert au chapitre précédent quand la ligne le précède', () => {
  const ch = (n) =>
    ({
      1: ['a', '<span data-folio="9"></span>', 'b'],
      2: ['déborde du folio 9', '<span data-folio="10"></span>', 'c'],
    })[n] ?? null
  assert.equal(folioGoverning(ch, 2, 1), 9) // avant la 1re ancre du ch.2 → report du ch.1
  assert.equal(folioGoverning(ch, 2, 3), 10)
})

test('folioGoverning REFUSE de trancher au-delà de la dernière ancre quand le voisin ne la CONTINUE pas', () => {
  // Le ch.1 s'arrête au folio 9, le ch.2 ouvre au folio 20 : les folios 10-19 n'ont pas d'ancre.
  const troue = (n) =>
    ({
      1: ['a', '<span data-folio="9"></span>', 'zone non bornée'],
      2: ['<span data-folio="20"></span>', 'c'],
    })[n] ?? null
  assert.deepEqual(folioGoverningWhy(troue, 1, 3), { folio: null, reason: 'queue-trouee' })
  assert.deepEqual(folioGoverningWhy(troue, 2, 1), { folio: 20, reason: 'ok' }) // bornée à gauche par sa propre ancre
})

test('folioGoverning REFUSE de trancher dans un trou INTÉRIEUR (ancre 150 puis 153 : 151/152 sans ancre)', () => {
  // Sonde du juge E8 : la version « refus en queue seulement » répondait 150 pour la ligne 5,
  // alors que le span 150→153 porte TROIS folios imprimés et que rien ne dit lequel.
  const interieur = (n) =>
    ({
      1: [
        'préambule',
        '<span data-folio="150"></span>', // l.2
        'a',
        'b',
        'la ligne citée — sur 150, 151 ou 152 ? indécidable', // l.5
        'c',
        'd',
        'e',
        'f',
        '<span data-folio="153"></span>', // l.10
        'après',
      ],
      2: ['<span data-folio="154"></span>'],
    })[n] ?? null
  assert.deepEqual(folioGoverningWhy(interieur, 1, 5), { folio: null, reason: 'span-a-trou' })
  // Le span qui ENCHAÎNE (153 → 154) reste jugeable : le refus ne mange pas les cas sains.
  assert.deepEqual(folioGoverningWhy(interieur, 1, 11), { folio: 153, reason: 'ok' })
})

test('folioGoverning tranche un span borné des deux côtés par des ancres CONTIGUËS', () => {
  const sain = (n) =>
    ({
      1: ['<span data-folio="150"></span>', 'la règle', '<span data-folio="151"></span>', 'suite'],
      2: ['<span data-folio="152"></span>'],
    })[n] ?? null
  assert.deepEqual(folioGoverningWhy(sain, 1, 2), { folio: 150, reason: 'ok' })
  assert.deepEqual(folioGoverningWhy(sain, 1, 4), { folio: 151, reason: 'ok' })
})

test('citedEntries ne retient que les entrées portant À LA FOIS `source` et une citation', () => {
  const data = [
    { id: 'avec-note', source: { book: 'livre-de-base', page: 1, note: 'LDB 12 l.28' } },
    { id: 'avec-ref', ref: 'LDB 12 l.28', source: { book: 'livre-de-base', page: 1 } },
    { id: 'sans-citation', source: { book: 'livre-de-base', page: 1 } },
    { id: 'sans-source', ref: 'LDB 12 l.28' },
  ]
  assert.deepEqual(citedEntries(data, 'fixture.json').map((e) => e.id), ['avec-note', 'avec-ref'])
})

test('MORSURE : un folio faux fait rouge, le folio mesuré fait vert (même entrée)', () => {
  const chapitre = ['# titre', '<span data-folio="150"></span>', 'la règle', '<span data-folio="151"></span>']
  const lines = (abbr, ch) => (abbr === 'LDB' && ch === 12 ? chapitre : null)
  const abbrOf = () => 'LDB'
  const entry = (page) => [
    { file: 'fixture.json', id: 'r', book: 'livre-de-base', page, cite: 'LDB 12 l.3' },
  ]
  assert.deepEqual(auditAlignment(entry(150), abbrOf, lines).violations, [])
  const rouge = auditAlignment(entry(149), abbrOf, lines).violations
  assert.equal(rouge.length, 1)
  const { key, page, folio } = rouge[0]
  assert.deepEqual({ key, page, folio }, { key: 'fixture.json#r', page: 149, folio: 150 })
})
