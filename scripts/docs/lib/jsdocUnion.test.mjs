import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import * as ts from 'typescript/unstable/ast'
import { libererCache } from '../../guards/lib/fieldConsumers.mjs'
import { loadSource, findAlias, aliasDoc, readUnionMembers, indexerConstantes, readZodUnionMembers, noyauZod, estOptionnel } from './jsdocUnion.mjs'
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
  const enfant = spawnSync(process.execPath, ['scripts/docs/lib/rendre-seul.mjs', 'scripts/docs/build-map-authoring.mjs'], {
    cwd: fileURLToPath(new URL('../../../', import.meta.url)), encoding: 'utf8',
  })
  assert.equal(enfant.status, 0, enfant.stderr)
  assert.match(enfant.stdout, /\| `desc\?` \| `string` \|/)
  assert.match(enfant.stdout, /Champs REQUIS de `MapSpec` : `size`, `id`, `label`\./)
})

test('décorateurs canoniques : formes, champs, optionalité et JSDoc préservés par imports nommés, renommés et namespace imbriqués', () => {
  const racine = fileURLToPath(new URL('../../../', import.meta.url))
  mkdirSync(join(racine, 'tmp'), { recursive: true })
  const dossier = mkdtempSync(join(racine, 'tmp', 'jsdoc-decorateurs-'))
  try {
    const chemin = join(dossier, 'schemas.ts')
    const imports = [
      "import { nommerChamps, nommerNoeud as nommer } from '../../src/data/schemas/grammaire/meta.ts';",
      "import * as meta from '../../src/data/schemas/grammaire/meta.ts';",
    ].join('\n')
    const forme = "z.strictObject({ kind: z.literal('journal'), /** Texte réel. */ texte: CHAMP, requis: z.number() })"
    const variantes = [
      forme.replace('CHAMP', 'z.string().optional()'),
      `nommerChamps(${forme.replace('CHAMP', "nommer(z.string().optional(), { label: 'Texte' })")}, z.strictObject({ faux: z.number() }))`,
      `meta.nommerNoeud(nommerChamps((${forme.replace('CHAMP', "meta.nommerNoeud(nommer(z.string().optional(), {}), {})")}), {}), {}).superRefine(() => {})`,
    ]
    for (const variante of variantes) {
      writeFileSync(chemin, `${imports}\n/** Journal réel. */\nexport const journal = ${variante};\nconst FAMILLE = { journal };\nexport const delegue = FAMILLE.journal;\nexport const choix = nommerChamps(z.discriminatedUnion('kind', [delegue]), {});`)
      const index = indexerConstantes([chemin])
      assert.deepEqual(readZodUnionMembers(index, 'choix', 'kind', 'test'), {
        rows: [{ name: 'journal', fieldGroups: [['texte?', 'requis']], role: 'Journal réel.' }], rawCount: 1,
      })
      const entree = index.get('journal')
      const objet = noyauZod(entree.decl.initializer, entree)
      assert.deepEqual(objet.arguments[0].properties.map(p => p.name.text), ['kind', 'texte', 'requis'])
      const texte = objet.arguments[0].properties[1]
      assert.equal(estOptionnel(texte.initializer, entree), true)
      assert.match(texte.getFullText(), /Texte réel\./)
    }
  } finally { rmSync(dossier, { recursive: true, force: true }) }
})

test('décorateurs : homonyme local, import étranger et masque de portée restent opaques', () => {
  const racine = fileURLToPath(new URL('../../../', import.meta.url))
  mkdirSync(join(racine, 'tmp'), { recursive: true })
  const dossier = mkdtempSync(join(racine, 'tmp', 'jsdoc-opaque-'))
  try {
    const chemin = join(dossier, 'schemas.ts')
    writeFileSync(join(dossier, 'etranger.ts'), 'export function nommerChamps(x) { return x }')
    writeFileSync(chemin, [
      "import { nommerChamps as canon } from '../../src/data/schemas/grammaire/meta.ts';",
      "import { nommerChamps as etranger } from './etranger.ts';",
      'function nommerChamps(x) { return x }',
      'export const local = nommerChamps(z.object({ vrai: z.string() }), z.object({ faux: z.string() }));',
      'export const autre = etranger(z.object({ vrai: z.string() }), {});',
      'export const masque = (() => { const canon = x => x; return canon(z.object({ vrai: z.string() }), {}) });',
    ].join('\n'))
    const index = indexerConstantes([chemin])
    for (const nom of ['local', 'autre']) {
      const entree = index.get(nom)
      assert.equal(noyauZod(entree.decl.initializer, entree) === entree.decl.initializer, true, nom)
    }
    const entree = index.get('masque')
    const retour = entree.decl.initializer.expression.body.statements.find(ts.isReturnStatement).expression
    assert.equal(noyauZod(retour, entree) === retour, true, 'masque')
  } finally { rmSync(dossier, { recursive: true, force: true }) }
})

test('preuve des décorateurs : coordonnées identiques dans un autre fichier ou texte restent opaques', () => {
  const racine = fileURLToPath(new URL('../../../', import.meta.url))
  mkdirSync(join(racine, 'tmp'), { recursive: true })
  const dossier = mkdtempSync(join(racine, 'tmp', 'jsdoc-identite-'))
  try {
    const chemin = join(dossier, 'original.ts')
    const autre = join(dossier, 'autre.ts')
    const texte = "import { nommerChamps } from '../../src/data/schemas/grammaire/meta.ts';\nexport const schema = nommerChamps(z.object({ x: z.string() }), { x: { label: 'Texte' } });"
    writeFileSync(chemin, texte)
    const entree = indexerConstantes([chemin]).get('schema')
    assert.equal(noyauZod(entree.decl.initializer, entree).expression.name.text, 'object')
    writeFileSync(autre, texte)
    const autreSf = loadSource(autre).sf
    const autreAppel = autreSf.statements.find(ts.isVariableStatement).declarationList.declarations[0].initializer
    assert.equal(autreAppel.pos, entree.decl.initializer.pos)
    assert.equal(autreAppel.end, entree.decl.initializer.end)
    assert.equal(noyauZod(autreAppel, entree) === autreAppel, true, 'autre fichier')
    writeFileSync(chemin, texte.replace('Texte', 'Autre'))
    const texteSf = loadSource(chemin).sf
    const texteAppel = texteSf.statements.find(ts.isVariableStatement).declarationList.declarations[0].initializer
    assert.equal(texteAppel.pos, entree.decl.initializer.pos)
    assert.equal(texteAppel.end, entree.decl.initializer.end)
    assert.equal(noyauZod(texteAppel, entree) === texteAppel, true, 'autre texte')
  } finally { rmSync(dossier, { recursive: true, force: true }) }
})
