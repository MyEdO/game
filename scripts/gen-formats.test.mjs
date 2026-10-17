// `gen-formats.mjs` (#2404) : le format d'une donnée persistée est STABLE (entre processus, entre ordres
// de chargement, indépendant des ids internes), SENSIBLE (un champ optionnel ajouté, un type de champ
// changé le changent) et TOTAL (any/unknown et drapeau non traité échouent, chemin nommé).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { RACINES, calculerFormats, defsDeSequence, couleurs, serialisation, grapheDeForme, FormatNonDerivable } from './gen-formats.mjs'
import { readCorpus } from './guards/lib/sourceCorpus.mjs'

const RACINE = fileURLToPath(new URL('..', import.meta.url))
const parConstante = (formats) => Object.fromEntries(formats.map((e) => [e.constante, e.format]))
const BASE = parConstante(calculerFormats())

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

test('stable entre deux processus', () => {
  const r = spawnSync(process.execPath, ['--input-type=module', '-e',
    "import { calculerFormats } from './scripts/gen-formats.mjs'; process.stdout.write(JSON.stringify(calculerFormats()))"], { cwd: RACINE, encoding: 'utf8' })
  assert.equal(r.status, 0, r.stderr)
  assert.deepEqual(parConstante(JSON.parse(r.stdout)), BASE)
})

test('stable entre deux racines de programme qui chargent les fichiers dans des ordres différents', () => {
  const autreOrdre = calculerFormats({
    racines: [...RACINES].reverse(),
    avant: ['src/state/traceLayer.ts', 'src/ui/creator/draft.ts', 'src/engine/types.ts', 'src/state/store.ts'],
  })
  assert.deepEqual(parConstante(autreOrdre), BASE)
})

test('sensible : un champ optionnel ajouté, un type de champ changé', () => {
  const types = readFileSync(new URL('../src/engine/types.ts', import.meta.url), 'utf8')
  assert.ok(types.includes('export interface Combatant {'))
  const avecChamp = parConstante(calculerFormats({
    recouvrement: { 'src/engine/types.ts': types.replace('export interface Combatant {', 'export interface Combatant {\n  zzNouveau?: number;') },
  }))
  for (const c of ['FORMAT_SAVE', 'FORMAT_ROSTER', 'FORMAT_EXPORT_HEROS']) assert.notEqual(avecChamp[c], BASE[c], c)
  assert.equal(avecChamp.FORMAT_CALQUE, BASE.FORMAT_CALQUE)

  const calque = readFileSync(new URL('../src/state/traceLayer.ts', import.meta.url), 'utf8')
  assert.ok(calque.includes('  opacity: number;'))
  const autreType = parConstante(calculerFormats({ recouvrement: { 'src/state/traceLayer.ts': calque.replace('  opacity: number;', '  opacity: string;') } }))
  assert.notEqual(autreType.FORMAT_CALQUE, BASE.FORMAT_CALQUE)
  assert.equal(autreType.FORMAT_SAVE, BASE.FORMAT_SAVE)
})

/** Le format de chaque cas `nom → source du type T`, chacun dans son module virtuel. */
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

test('FORMAT_SAVE couvre CHAQUE famille de séquence de production : les `def` vus par le générateur sont les ids des `registerSequence(` de src hors tests', () => {
  const corpus = readCorpus(['src'])
  const constantes = new Map(corpus.flatMap((f) => [...f.text.matchAll(/export const (\w+) = '([^']+)'/g)].map((m) => [m[1], m[2]])))
  const ids = corpus.flatMap((f) => [...f.text.matchAll(/registerSequence\(\s*(?:'([^']+)'|(\w+))/g)]
    .map((m) => m[1] ?? constantes.get(m[2]) ?? `${f.rel} : ${m[2]} non résolu`))
  assert.ok(ids.length > 0, 'aucun site `registerSequence(` lu : la garde ne mesurerait rien')
  assert.deepEqual(defsDeSequence(), [...new Set(ids)].sort())
})
