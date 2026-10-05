import { test } from 'node:test'
import assert from 'node:assert/strict'
import { actualiserOccurrences, siteDeForme, siteDeSlot } from './lib/occurrencesStock.mjs'

const a = { dataset: 'fixture.json', champ: 'scene', occurrences: 2 }
const b = { dataset: 'fixture.json', champ: 'ref', occurrences: 9 }
const texte = '// #2337\r\nexport const SLOTS = [\r\n  { dataset: "fixture.json", champ: "scene", occurrences: 2, lot: "lot intact", date: "2026-10-05", motif: "motif intact" },\r\n  { dataset: "fixture.json", champ: "ref", occurrences: 9 },\r\n];\r\nexport const AUTRE = [{ occurrences: 88 }];\r\n'
const collection = (options = {}) => ({ rel: 'fixture.mjs', nom: 'SLOTS', texte, stock: [a, b],
  observe: [{ ...a, occurrences: 11 }, { ...b, occurrences: 0 }], site: siteDeSlot, ...options })

test('remplacements AST : seuls les nombres occurrences changent, plusieurs spans et zéro', () => {
  const [r] = actualiserOccurrences([collection()])
  assert.equal(r.texte, texte.replace('occurrences: 2,', 'occurrences: 11,').replace('occurrences: 9 }', 'occurrences: 0 }'))
  assert.deepEqual(new Set(r.changements), new Set([siteDeSlot(a), siteDeSlot(b)]))
  assert.equal(actualiserOccurrences([collection({ texte: r.texte, stock: collection().observe })])[0].texte, r.texte)
  assert.deepEqual(actualiserOccurrences([collection({ texte: r.texte, stock: collection().observe })])[0].changements, [])
})

test('identités : inconnue, disparue et dupliquée refusent toute préparation', () => {
  assert.throws(() => actualiserOccurrences([collection({ observe: [...collection().observe, { ...a, champ: 'inconnu' }] })]), /inconnues.*inconnu/)
  assert.throws(() => actualiserOccurrences([collection({ observe: [a] })]), /disparues.*ref/)
  assert.throws(() => actualiserOccurrences([collection({ stock: [a, a] })]), /dupliquées/)
  assert.throws(() => actualiserOccurrences([collection({ observe: [a, a] })]), /dupliquées/)
  assert.deepEqual(actualiserOccurrences([collection({ texte: 'export const SLOTS = [];', observe: [], stock: [] })]),
    [{ rel: 'fixture.mjs', texte: 'export const SLOTS = [];', changements: [] }])
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

test('erreur du deuxième stock : aucun résultat publiable, sources intactes', () => {
  const premier = collection()
  const second = collection({ observe: [a] })
  const avant = JSON.stringify([premier, second])
  let ecrits = []
  assert.throws(() => {
    const prepares = actualiserOccurrences([premier, second])
    ecrits = prepares.map((r) => r.texte)
  }, /disparues/)
  assert.deepEqual(ecrits, [])
  assert.equal(JSON.stringify([premier, second]), avant)
})

test('formes : identité partagée et octets de pilotage préservés', () => {
  const f = { concept: 'reference', ...a, signature: 'id-nu' }
  const t = 'export const FORMES = [{ concept: "reference", dataset: "fixture.json", champ: "scene", signature: "id-nu", occurrences: 2, statut: "historique", strate: "Référence", lot: "L1", date: "date", motif: "motif" }];'
  const [r] = actualiserOccurrences([{ texte: t, rel: 'formes.mjs', nom: 'FORMES', observe: [{ ...f, occurrences: 3 }], stock: [f], site: siteDeForme }])
  assert.equal(r.texte, t.replace('occurrences: 2', 'occurrences: 3'))
  assert.deepEqual(r.changements, [siteDeForme(f)])
})
