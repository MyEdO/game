import { test } from 'node:test'

import assert from 'node:assert/strict'

import { createRequire } from 'node:module'

import { calculerFormats, couleurs, serialisation, grapheDeForme, FormatNonDerivable } from './gen-formats.mjs'

import { bancgenformatstestmjs } from './bancFormats.mjs'
const { parConstante } = bancgenformatstestmjs

test('canonique : deux graphes isomorphes numérotés autrement, cycles compris, sérialisent pareil', () => {
  // A = { a: string, suite?: A } ; U = A | null — le même graphe, nœuds dans deux ordres.
  const g1 = [
    { etiquette: 'U', enfants: [1, 3], libres: true },
    { etiquette: 'O{a;suite?}', enfants: [2, 0], libres: false },
    { etiquette: 'prim:string', enfants: [], libres: false },
    { etiquette: 'prim:null', enfants: [], libres: false },
  ]
  const g2 = [
    { etiquette: 'U', enfants: [1, 2], libres: true },
    { etiquette: 'prim:null', enfants: [], libres: false },
    { etiquette: 'O{a;suite?}', enfants: [3, 0], libres: false },
    { etiquette: 'prim:string', enfants: [], libres: false },
  ]
  assert.equal(serialisation(g1, couleurs(g1)), serialisation(g2, couleurs(g2)))
  const g3 = g1.map((n, i) => (i === 2 ? { ...n, etiquette: 'prim:number' } : n))
  assert.notEqual(serialisation(g1, couleurs(g1)), serialisation(g3, couleurs(g3)))
})

const formatsDe = (cas) => {
  const racines = Object.keys(cas).map((k) => ({ constante: k, module: `src/__cas_${k}.ts`, type: 'T' }))
  const recouvrement = Object.fromEntries(Object.entries(cas).map(([k, v]) => [`src/__cas_${k}.ts`, v]))
  return parConstante(calculerFormats({ racines, recouvrement }))
}

test('sensible aux familles de types : gabarit, transformation de chaîne, BigInt littéral, objet appelable', () => {
  const f = formatsDe({
    tplA: 'export type T = { id: `a-${string}` }',
    tplB: 'export type T = { id: `b-${number}` }',
    tplC: 'export type T = { id: `b-${string}` }',
    upA: 'export type T = { s: Uppercase<string> }',
    upB: 'export type T = { s: Lowercase<string> }',
    bigA: 'export type T = { n: 1n }',
    bigB: 'export type T = { n: 2n }',
    hybA: 'export type T = { f: { (): void; poids: number } }',
    hybB: 'export type T = { f: { (): void; poids: string } }',
    hybSansAppel: 'export type T = { f: { poids: number } }',
  })
  for (const [a, b] of [['tplA', 'tplB'], ['tplA', 'tplC'], ['tplB', 'tplC'], ['upA', 'upB'], ['bigA', 'bigB'], ['hybA', 'hybB'], ['hybA', 'hybSansAppel']]) {
    assert.notEqual(f[a], f[b], `${a} ≠ ${b}`)
  }
})

test('any/unknown : TOUTES les arêtes entrantes sont nommées, et le calcul échoue', () => {
  assert.throws(
    () => formatsDe({ anys: 'export type T = { a: unknown; b: unknown; c: { d: any; e: any } }' }),
    (e) => e instanceof FormatNonDerivable && e.chemins.length === 4
      && ['$.a : unknown', '$.b : unknown', '$.c.d : any', '$.c.e : any'].every((c) => e.chemins.includes(c)),
  )
})

test('un drapeau de type non traité échoue en nommant le chemin, sans retomber en objet', () => {
  const { TypeFlags } = createRequire(import.meta.url)('typescript/unstable/sync')
  const type = { id: 1, flags: TypeFlags.Index, isUnionType: () => false, isIntersectionType: () => false }
  const checker = { typeToString: () => 'keyof X', getSignaturesOfType: () => [], getPropertiesOfType: () => [], getIndexInfosOfType: () => [] }
  assert.throws(() => grapheDeForme(checker, type, null), /drapeau de type non traité \(\d+\) en \$ : keyof X/)
})
