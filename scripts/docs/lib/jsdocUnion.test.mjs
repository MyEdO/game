import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import * as ts from 'typescript/unstable/ast'
import { libererCache } from '../../guards/lib/fieldConsumers.mjs'
import { loadSource, findAlias, aliasDoc, readUnionMembers, indexerConstantes, readZodUnionMembers } from './jsdocUnion.mjs'
import { fileExports } from './engineExports.mjs'
import { shellZones, rowZones } from './rollShellUsage.mjs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

test('cleanup : propriétaires dédoublés, emprunt préservé, erreurs initiales et fermetures toutes observables', () => {
  for (const initiale of [new Error('analyse'), undefined, Symbol('analyse')]) {
    const fermetureA = new Error('fermeture A')
    const fermetureB = new Error('fermeture B')
    let fermeA = 0
    let fermeB = 0
    let empruntFerme = 0
    const a = { dispose() { fermeA++; throw fermetureA } }
    const b = { dispose() { fermeB++; throw fermetureB } }
    const emprunt = { dispose() { empruntFerme++ } }
    const cache = new Map([
      ['a', { sessionPropre: a }],
      ['alias-a', { sessionPropre: a }],
      ['b', { sessionPropre: b }],
      ['emprunt', { sessionPropre: null, session: emprunt }],
    ])
    let recue
    try { libererCache(cache, [initiale]) } catch (erreur) { recue = erreur }
    assert.ok(recue instanceof AggregateError)
    assert.deepEqual(recue.errors, [initiale, fermetureA, fermetureB])
    assert.equal(recue.cause, initiale)
    assert.deepEqual([fermeA, fermeB, empruntFerme, cache.size], [1, 1, 0, 0])
  }
})

test('BOM : rôles alias, membres et exports gardent leurs positions originales CRLF et Unicode', () => {
  const dossier = mkdtempSync(join(tmpdir(), 'jsdoc-native-'))
  try {
    for (const bom of ['', '\uFEFF']) {
      const chemin = join(dossier, bom ? 'bom.ts' : 'normal.ts')
      const original = bom + [
        '/** Union é😀. */',
        'export type Choix =',
        "/** Alpha é😀. */ { kind: 'a'; valeur: number } |",
        "/** Bêta é😀. */ { kind: 'b'; texte: string };",
        '/** Fonction é😀. */',
        'export function action() { return 1 }',
        "export const litteral = '\uFEFFé😀';",
      ].join('\r\n')
      writeFileSync(chemin, original)
      const { text, sf } = loadSource(chemin)
      assert.equal(text, original)
      assert.equal(sf.text, original)
      assert.equal(loadSource(chemin, sf).sf, sf)
      const alias = findAlias(sf, 'Choix', 'test', chemin)
      assert.equal(aliasDoc(text, alias, sf), 'Union é😀.')
      assert.deepEqual(readUnionMembers(sf, text, alias, 'kind', 'test'), {
        rows: [
          { name: 'a', fieldGroups: [['valeur']], role: 'Alpha é😀.' },
          { name: 'b', fieldGroups: [['texte']], role: 'Bêta é😀.' },
        ],
        rawCount: 2,
      })
      const exports = fileExports(chemin, sf)
      assert.equal(exports.find((e) => e.name === 'Choix').role, 'Union é😀.')
      assert.equal(exports.find((e) => e.name === 'action').role, 'Fonction é😀.')
      const fonction = sf.statements.find(ts.isFunctionDeclaration)
      assert.equal(original.slice(fonction.getStart(sf), fonction.getEnd()), fonction.getText(sf))
      const declaration = sf.statements.find(ts.isVariableStatement).declarationList.declarations[0]
      assert.equal(declaration.initializer.text, '\uFEFFé😀')
      assert.deepEqual(shellZones(bom + 'export function RollShell(p: { /** Z1 Titre é😀. */ titre: string }) {}', 'test'), [
        { name: 'titre', optional: false, zone: 'Z1' },
      ])
      assert.deepEqual(rowZones(bom + 'export interface RollRowProps { /** Z9 Ligne é😀. */ ligne: string }', 'test'), [
        { name: 'ligne', optional: false, zone: 'Z9' },
      ])
    }
  } finally { rmSync(dossier, { recursive: true, force: true }) }
})

test('cleanup zod : une erreur de lecture après résolution sémantique reste observable', () => {
  const dossier = mkdtempSync(join(tmpdir(), 'zod-native-'))
  try {
    const chemin = join(dossier, 'schemas.ts')
    writeFileSync(chemin, [
      'export const origine = z.object({ valeur: z.string() });',
      'const FAMILLE = { mauvais: origine };',
      'export const mauvais = FAMILLE.mauvais;',
      "export const choix = z.discriminatedUnion('kind', [mauvais]);",
    ].join('\n'))
    const index = indexerConstantes([chemin])
    assert.throws(() => readZodUnionMembers(index, 'choix', 'kind', 'test'), {
      message: "test — membre « mauvais » sans « kind: z.literal('…') »",
    })
  } finally { rmSync(dossier, { recursive: true, force: true }) }
})

test('optionalité native : membres de union requis, optionnels et union avec undefined', () => {
  const dossier = mkdtempSync(join(tmpdir(), 'union-optional-native-'))
  try {
    const chemin = join(dossier, 'optional.ts')
    const original = "export type Choix = { kind: 'a'; requis: string; union: string | undefined; optionnel?: number; readonly lecture?: boolean } | { kind: 'b' }; export class Classe { certain!: string }"
    writeFileSync(chemin, original)
    const { sf, text } = loadSource(chemin)
    const alias = findAlias(sf, 'Choix', 'test', chemin)
    const membre = alias.type.types[0].members.find((p) => p.name.text === 'optionnel')
    assert.equal(membre.postfixToken.kind, ts.SyntaxKind.QuestionToken)
    assert.equal(sf.statements.find(ts.isClassDeclaration).members[0].postfixToken.kind, ts.SyntaxKind.ExclamationToken)
    assert.deepEqual(readUnionMembers(sf, text, alias, 'kind', 'test').rows[0].fieldGroups, [
      ['requis', 'union', 'optionnel?', 'lecture?'],
    ])
  } finally { rmSync(dossier, { recursive: true, force: true }) }
})

test('optionalité native : zones shell et row distinguent propriété optionnelle et type undefined', () => {
  const membres = '/** Z1 Requis. */ requis: string; /** Z2 Union. */ union: string | undefined; /** Z3 Optionnel. */ optionnel?: number; /** Z4 Lecture. */ readonly lecture?: boolean'
  const attendu = [
    { name: 'requis', optional: false, zone: 'Z1' },
    { name: 'union', optional: false, zone: 'Z2' },
    { name: 'optionnel', optional: true, zone: 'Z3' },
    { name: 'lecture', optional: true, zone: 'Z4' },
  ]
  assert.deepEqual(shellZones(`export function RollShell(p: { ${membres} }) {}`, 'test'), attendu)
  assert.deepEqual(rowZones(`export interface RollRowProps { ${membres} }`, 'test'), attendu)
})

test('optionalité native : générateur MapSpec conserve desc optionnel et son démarrage compilable', () => {
  const enfant = spawnSync(process.execPath, ['--input-type=module', '-e', "import { rendre } from './scripts/docs/build-map-authoring.mjs'; console.log(rendre().get('docs/map-authoring.md'))"], {
    cwd: fileURLToPath(new URL('../../../', import.meta.url)), encoding: 'utf8',
  })
  assert.equal(enfant.status, 0, enfant.stderr)
  assert.match(enfant.stdout, /\| `desc\?` \| `string` \|/)
  assert.match(enfant.stdout, /Champs REQUIS de `MapSpec` : `size`, `id`, `label`\./)
})
