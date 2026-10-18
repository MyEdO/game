import { test } from 'node:test'
import assert from 'node:assert/strict'
import { actualiserOccurrences, siteDeForme, siteDeSlot } from './lib/occurrencesStock.mjs'

const a = { dataset: 'fixture.json', champ: 'scene', occurrences: 2 }
const b = { dataset: 'fixture.json', champ: 'ref', occurrences: 9 }
const texte = '// #2337\r\nexport const SLOTS = [\r\n  { dataset: "fixture.json", champ: "scene", occurrences: 2, lot: "lot intact", date: "2026-10-05", motif: "motif intact" },\r\n  { dataset: "fixture.json", champ: "ref", occurrences: 9 },\r\n];\r\nexport const AUTRE = [{ occurrences: 88 }];\r\n'
const cible = (cle) => `Migrer ${cle} vers sa forme CIBLE.`
const collection = (options = {}) => ({ rel: 'fixture.mjs', nom: 'SLOTS', texte, stock: [a, b],
  observe: [{ ...a, occurrences: 1 }, { ...b, occurrences: 0 }], site: siteDeSlot, cible, ...options })

test('remplacements AST : seuls les nombres occurrences BAISSENT, plusieurs spans et zéro', () => {
  const { ecritures: [r] } = actualiserOccurrences([collection()])
  assert.equal(r.texte, texte.replace('occurrences: 2,', 'occurrences: 1,').replace('occurrences: 9 }', 'occurrences: 0 }'))
  assert.deepEqual(new Set(r.changements), new Set([siteDeSlot(a), siteDeSlot(b)]))
  const relu = actualiserOccurrences([collection({ texte: r.texte, stock: collection().observe })]).ecritures[0]
  assert.deepEqual([relu.texte, relu.changements], [r.texte, []])
})

test('#2705 : une HAUSSE refuse TOUT, la baisse du même run comprise, en nommant le site et sa cible', () => {
  const texteSonde = `export const SLOTS_SANS_DECLARATION = [
  { dataset: "a.json", champ: "x", occurrences: 3, lot: "L", date: "2026-01-01" },
  { dataset: "b.json", champ: "y", occurrences: 9, lot: "L", date: "2026-01-01" },
];\n`
  const stock = [
    { dataset: 'a.json', champ: 'x', occurrences: 3, lot: 'L', date: '2026-01-01' },
    { dataset: 'b.json', champ: 'y', occurrences: 9, lot: 'L', date: '2026-01-01' },
  ]
  const observe = [{ dataset: 'a.json', champ: 'x', occurrences: 5 }, { dataset: 'b.json', champ: 'y', occurrences: 7 }]
  const r = actualiserOccurrences([{ texte: texteSonde, rel: 'scratch/slots.mjs', nom: 'SLOTS_SANS_DECLARATION', observe, stock, site: siteDeSlot, cible }])
  assert.deepEqual(Object.keys(r), ['refus'], 'aucune écriture n’est préparée')
  assert.match(r.refus, /^REFUS : scratch\/slots\.mjs : SLOTS_SANS_DECLARATION porte 1 entrée/)
  assert.match(r.refus, /a\.json \| x — nombre 5 > 3 en stock/)
  assert.match(r.refus, /Cet outil ne peut qu'écrire un stock PLUS PETIT\./)
  assert.match(r.refus, /a\.json \| x — HAUSSE 5 > 3 : la dette GRANDIT\. Migrer a\.json \| x vers sa forme CIBLE\. Aucune écriture ne relève ce nombre\./)
  assert.doesNotMatch(r.refus, /b\.json/, 'la baisse n’est pas un refus')
  assert.match(r.refus, /Rien n’est écrit\.$/)
  const seule = actualiserOccurrences([{ texte: texteSonde, rel: 'scratch/slots.mjs', nom: 'SLOTS_SANS_DECLARATION', observe: [observe[1], { ...observe[0], occurrences: 3 }], stock, site: siteDeSlot, cible }])
  assert.equal(seule.ecritures[0].texte, texteSonde.replace('occurrences: 9', 'occurrences: 7'), 'une baisse seule s’écrit')
})

test('#2705 : le refus est ATOMIQUE sur plusieurs collections — la hausse de la seconde bloque la baisse de la première', () => {
  const second = collection({ rel: 'autre.mjs', observe: [{ ...a, occurrences: 4 }, b] })
  const r = actualiserOccurrences([collection(), second])
  assert.deepEqual(Object.keys(r), ['refus'])
  assert.match(r.refus, /autre\.mjs : SLOTS/)
})

test('deux collections d’un MÊME fichier s’écrivent sur un seul texte', () => {
  const double = `${texte}export const SLOTS_BIS = [\r\n  { dataset: "fixture.json", champ: "scene", occurrences: 5 },\r\n];\r\n`
  const bis = { rel: 'fixture.mjs', nom: 'SLOTS_BIS', texte: double, stock: [{ ...a, occurrences: 5 }], observe: [{ ...a, occurrences: 4 }], site: siteDeSlot, cible }
  const { ecritures } = actualiserOccurrences([collection({ texte: double }), bis])
  assert.equal(ecritures.length, 1)
  assert.equal(ecritures[0].texte, double.replace('occurrences: 2,', 'occurrences: 1,').replace('occurrences: 9 }', 'occurrences: 0 }').replace('occurrences: 5 }', 'occurrences: 4 }'))
  assert.equal(ecritures[0].changements.length, 3)
})

test('identités : inconnue, disparue et dupliquée refusent toute préparation', () => {
  assert.throws(() => actualiserOccurrences([collection({ observe: [...collection().observe, { ...a, champ: 'inconnu' }] })]), /inconnues.*inconnu/)
  assert.throws(() => actualiserOccurrences([collection({ observe: [a] })]), /disparues.*ref/)
  assert.throws(() => actualiserOccurrences([collection({ stock: [a, a] })]), /dupliquées/)
  assert.throws(() => actualiserOccurrences([collection({ observe: [a, a] })]), /dupliquées/)
  assert.deepEqual(actualiserOccurrences([collection({ texte: 'export const SLOTS = [];', observe: [], stock: [] })]),
    { ecritures: [{ rel: 'fixture.mjs', texte: 'export const SLOTS = [];', changements: [] }] })
})

test('AST : propriétés ambiguës, expressions et formes non reconnues refusées', () => {
  for (const mauvais of [
    texte.replace('occurrences: 2,', 'occurrences: 2, occurrences: 3,'),
    texte.replace('occurrences: 2,', 'occurrences: 1 + 1,'),
    texte.replace('occurrences: 2,', 'occurrences: -2,'),
    texte.replace('occurrences: 2,', 'occurrences: 2.5,'),
    texte.replace('champ: "scene",', '["champ"]: "scene",'),
    texte.replace('export const SLOTS = [', 'export const SLOTS = fabrique(['),
    texte.replace('export const SLOTS', 'export let SLOTS'),
    texte.replace('champ: "scene",', '...autre,'),
    texte + '\nexport const SLOTS = [];',
  ]) assert.throws(() => actualiserOccurrences([collection({ texte: mauvais })]))
  assert.throws(() => actualiserOccurrences([collection({ observe: [{ ...a, occurrences: -1 }, b] })]), /entières littérales/)
})

test('AST syntaxiquement invalide : refus explicite avant toute préparation', () => {
  const invalide = texte.replace('occurrences: 9 },', 'occurrences: 9 ,')
  assert.throws(() => actualiserOccurrences([collection({ texte: invalide })]), /SLOTS : AST invalide/)
})

test('erreur du deuxième stock : aucun résultat publiable, sources intactes', () => {
  const premier = collection()
  const second = collection({ observe: [a] })
  const avant = JSON.stringify([premier, second])
  let ecrits = []
  assert.throws(() => {
    const prepares = actualiserOccurrences([premier, second])
    ecrits = prepares.ecritures.map((r) => r.texte)
  }, /disparues/)
  assert.deepEqual(ecrits, [])
  assert.equal(JSON.stringify([premier, second]), avant)
})

test('formes : identité partagée et octets de pilotage préservés', () => {
  const f = { concept: 'reference', ...a, signature: 'id-nu' }
  const t = 'export const FORMES = [{ concept: "reference", dataset: "fixture.json", champ: "scene", signature: "id-nu", occurrences: 2, statut: "historique", strate: "Référence", lot: "L1", date: "date", motif: "motif" }];'
  const { ecritures: [r] } = actualiserOccurrences([{ texte: t, rel: 'formes.mjs', nom: 'FORMES', observe: [{ ...f, occurrences: 1 }], stock: [f], site: siteDeForme, cible }])
  assert.equal(r.texte, t.replace('occurrences: 2', 'occurrences: 1'))
  assert.deepEqual(r.changements, [siteDeForme(f)])
})
