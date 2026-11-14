import * as ts from 'typescript/unstable/ast'
import { readFileSync } from 'node:fs'
import { basename, dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { SymbolFlags, TypeFlags } from 'typescript/unstable/sync'
import { repoProgram } from './tsProgram.mjs'
import { listerArbre } from './lister.mjs'
import { estFichierVitest, estKitDeTest } from './fichierVitest.mjs'
import { enfantsDe } from '../../../src/data/schemas/grammaire/descente.ts'
import { SCHEMA_DEFS } from '../../../src/data/schemas/_registry.generated.ts'
import { LIENS_SCHEMA_TYPES } from './fieldConsumerTargets.mjs'
import { CLES_ENVELOPPE } from '../../../src/data/schemas/grammaire/document.ts'
import { classeDeProduit } from '../../../src/data/schemas/grammaire/produits.ts'
import { estDocumentARangees } from './documentARangees.mts'
import { creerProvenanceFs } from './provenanceFs.mjs'

const norm = p => p.replaceAll('\\', '/')
/** Les PORTES d'une table : un appel lit son champ du nœud JSON qu'il reçoit (et, par id de document, d'un
 *  fichier qui en porte plusieurs). `datasetDe` (`src/data/datasets.ts`) rend le nœud lui-même et `rangeesDe`
 *  (`src/data/rangees.ts`) son `entries`, au type dérivé du schéma ; `deDeTirageDe` (même module) lit `die`,
 *  et `deDeLaTableTiree` (`src/engine/tables.ts`) le `die` du nœud : tous deux rendent un `DeDeTable`,
 *  jamais une valeur JSON. */
const PORTES = {
  datasetDe: { module: 'src/data/datasets.ts', champ: null, rendJson: true },
  rangeesDe: { module: 'src/data/rangees.ts', champ: 'entries', rendJson: true },
  deDeTirageDe: { module: 'src/data/rangees.ts', champ: 'die' },
  deDeLaTableTiree: { module: 'src/engine/tables.ts', champ: 'die' },
}
const parts = type => type?.isUnionType() || type?.isIntersectionType() ? type.getTypes().flatMap(parts) : type ? [type] : []
const step = (checker, types, key, node) => types.flatMap(type => parts(type).flatMap(t => {
  if (key === '[]') return checker.isArrayType(t) || checker.isTupleType(t) ? checker.getTypeArguments(t) : checker.getIndexInfosOfType(t).filter(i => i.keyType.flags & TypeFlags.NumberLike).map(i => i.valueType)
  if (key === '{}') {
    const indices = checker.getIndexInfosOfType(t)
    return indices.length ? indices.map(i => i.valueType) : checker.getPropertiesOfType(t).map(p => checker.getTypeOfSymbolAtLocation(p, node))
  }
  const prop = checker.getPropertyOfType(t, key)
  return prop && !prop.declarations.some(d => d.resolve().getSourceFile().fileName.endsWith('.json')) ? [checker.getTypeOfSymbolAtLocation(prop, node)] : []
}))

const expandPath = path => path.reduce((paths, key) => paths.flatMap(p => (Array.isArray(key) ? key : [key]).map(k => [...p, k])), [[]])

export function champsDeclares(schema, visitNode = () => {}) {
  const champs = new Map()
  const visit = (node, path, seen) => {
    if (!node || seen.has(node)) return
    visitNode(node, path)
    const next = new Set(seen).add(node)
    for (const e of enfantsDe(node)) {
      if (e.segment === '{clé}') continue
      const key = e.cle ?? (e.segment === '[]' || e.segment === '{}' ? e.segment : undefined)
      const p = key === undefined ? path : [...path, key]
      if (e.cle !== undefined) champs.set(JSON.stringify(p), p)
      visit(e.noeud, p, next)
    }
  }
  visit(schema, [], new Set())
  return [...champs.values()]
}

/** La JOINTURE des chargements : chaque accès, cast, annotation ou appel de `files` relié à un dataset
 *  de `definitions`, au `TypeChecker` de `session`. `claims` : les vues TS EXPLICITES d'un chemin du
 *  dataset (`{ file, path, type, node }`) ; `reads` : les chemins lus, relevés sauf `lectures: false`
 *  (les `claims` n'en dépendent pas). Partagée par la mesure des champs de schéma et par la dérivation
 *  des cibles de catalogue (`ciblesDeCatalogue`). */
function relierChargements(root, session, { files, definitions = SCHEMA_DEFS, lectures = true }) {
  const { program, checker } = session
  const claims = [], reads = [], unresolved = new Set()
  const typedOrigins = new Map()
  const fsOrigins = new Map()
  const isReadFile = node => {
    const sf = node.getSourceFile()
    if (!fsOrigins.has(sf)) fsOrigins.set(sf, creerProvenanceFs({ sourceFile: sf, checker, ts }))
    return fsOrigins.get(sf)(node)?.operation === 'readFileSync'
  }
  const retained = new Set(files.map(f => norm(resolve(f))))
  const dataFiles = new Set(definitions.map(d => d.file))
  const calls = new Map()
  for (const file of program.getSourceFileNames()) {
    if (!retained.has(norm(resolve(file)))) continue
    const collect = node => {
      if (ts.isCallExpression(node)) {
        const name = ts.isIdentifier(node.expression) ? node.expression.text : null
        if (name) { const sites = calls.get(name) ?? []; sites.push(node); calls.set(name, sites) }
      }
      node.forEachChild(collect)
    }
    collect(program.getSourceFile(file))
  }
  // Noms sous lesquels une porte peut être appelée : le sien, et ceux que lui donnent les `import`/`export
  // { … as … }` du Program, à point fixe. Un appel sous un autre nom ne la résout pas : le symbole n'est
  // demandé qu'aux appels qui portent l'un de ces noms.
  const nomsDeLaPorte = new Set(Object.keys(PORTES))
  const renommages = program.getSourceFileNames().map(file => program.getSourceFile(file)).filter(sf => !sf.isDeclarationFile).flatMap(sf => sf.statements)
    .flatMap(n => (ts.isImportDeclaration(n) ? n.importClause?.namedBindings?.elements : ts.isExportDeclaration(n) ? n.exportClause?.elements : undefined) ?? [])
    .flatMap(e => e.propertyName ? [[e.propertyName.text, e.name.text]] : [])
  for (let taille = -1; taille !== nomsDeLaPorte.size;) {
    taille = nomsDeLaPorte.size
    for (const [de, vers] of renommages) if (nomsDeLaPorte.has(de)) nomsDeLaPorte.add(vers)
  }
  const resolvedSymbol = node => {
    const symbol = checker.getSymbolAtLocation(node)
    return symbol?.flags & SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol
  }
  const datasetAt = (file, base = root) => {
    if (!file) return undefined
    const absolute = file.startsWith('file:') ? fileURLToPath(file) : resolve(base, file)
    const name = basename(absolute)
    return dataFiles.has(name) && norm(absolute) === norm(resolve(root, 'src/data', name)) ? name : undefined
  }
  const stringOf = (node, seen = new Set(), bindings = new Map()) => {
    if (!node || seen.has(node)) return undefined
    seen = new Set(seen).add(node)
    if (ts.isStringLiteralLikeNode(node)) return node.text
    if (ts.isIdentifier(node)) {
      const symbol = checker.getSymbolAtLocation(node)
      if (bindings.has(symbol)) return bindings.get(symbol)
      const d = symbol?.declarations?.[0]?.resolve()
      if (d?.initializer) return stringOf(d.initializer, seen, bindings)
    }
    if (node.getText() === 'import.meta.url') return pathToFileURL(node.getSourceFile().fileName).href
    if (ts.isNewExpression(node) && node.expression.getText() === 'URL') {
      const value = stringOf(node.arguments?.[0], seen, bindings)
      const base = stringOf(node.arguments?.[1], seen, bindings)
      if (value !== undefined && base !== undefined) return new URL(value, base).href
    }
    if (ts.isCallExpression(node)) {
      const name = node.expression.getText().split('.').at(-1)
      const values = node.arguments.map(a => stringOf(a, seen, bindings))
      if (values.every(v => v !== undefined)) {
        if (name === 'join') return join(...values)
        if (name === 'resolve') return resolve(...values)
        if (name === 'dirname') return dirname(values[0])
        if (name === 'fileURLToPath') return fileURLToPath(values[0])
      }
    }
    return undefined
  }
  const finiteKeys = node => {
    if (!node || !ts.isIdentifier(node)) return null
    const d = checker.getSymbolAtLocation(node)?.declarations?.[0]?.resolve()
    const loop = d && ts.isVariableDeclaration(d) && ts.isVariableDeclarationList(d.parent) && ts.isForOfStatement(d.parent.parent) ? d.parent.parent : null
    if (!loop || !ts.isArrayLiteralExpression(loop.expression)) return null
    const keys = loop.expression.elements.map(e => stringOf(e))
    return keys.length && keys.every(k => k !== undefined) ? [...new Set(keys)] : null
  }
  const functionOf = expr => {
    const declaration = checker.getSymbolAtLocation(expr)?.declarations?.[0]?.resolve()
    const fn = declaration?.initializer ?? declaration
    return fn && (ts.isArrowFunction(fn) || ts.isFunctionDeclaration(fn) || ts.isFunctionExpression(fn)) ? fn : null
  }
  const porteDuDocument = call => {
    const nom = !ts.isCallExpression(call) ? null : ts.isIdentifier(call.expression) ? call.expression.text : ts.isPropertyAccessExpression(call.expression) ? call.expression.name.text : null
    const fn = nomsDeLaPorte.has(nom) && resolvedSymbol(call.expression)?.declarations?.[0]?.resolve()
    const porte = fn && ts.isFunctionDeclaration(fn) && Object.hasOwn(PORTES, fn.name?.text) ? PORTES[fn.name.text] : null
    if (!porte || norm(resolve(fn.getSourceFile().fileName)) !== norm(resolve(root, porte.module))) return null
    const racine = origin(call.arguments[0])
    if (!racine) return null
    const champs = porte.champ === null ? [] : call.arguments.length > 1 ? ['[]', porte.champ] : [porte.champ]
    return { file: racine.file, path: [...racine.path, ...champs], rendJson: porte.rendJson === true }
  }
  const originCache = new Map()
  const origin = (node, seen = new Set()) => {
    if (originCache.has(node)) return originCache.get(node)
    const result = originUncached(node, seen)
    originCache.set(node, result)
    return result
  }
  const originUncached = (node, seen = new Set()) => {
    if (!node || seen.has(node)) return null
    seen = new Set(seen).add(node)
    if (ts.isAsExpression(node) || ts.isTypeAssertion(node) || ts.isParenthesizedExpression(node) || ts.isNonNullExpression(node)) return origin(node.expression, seen)
    if (ts.isBinaryExpression(node) && [ts.SyntaxKind.QuestionQuestionToken, ts.SyntaxKind.BarBarToken].includes(node.operatorToken.kind)) {
      const left = origin(node.left, seen), right = origin(node.right, seen)
      return left && right ? JSON.stringify(left) === JSON.stringify(right) ? left : null : left ?? right
    }
    if (ts.isIdentifier(node)) {
      const d = checker.getSymbolAtLocation(node)?.declarations?.[0]?.resolve()
      if (!d) return null
      if (ts.isImportClause(d)) {
        const spec = d.parent.moduleSpecifier?.text
        const file = spec?.endsWith('.json') && datasetAt(spec, dirname(node.getSourceFile().fileName))
        return file ? { file, path: [] } : null
      }
      if (d.initializer) return origin(d.initializer, seen)
      if (ts.isVariableDeclaration(d) && ts.isVariableDeclarationList(d.parent) && ts.isForOfStatement(d.parent.parent)) {
        const o = origin(d.parent.parent.expression, seen)
        return o && { ...o, path: [...o.path, '[]'] }
      }
      if (ts.isParameterDeclaration(d) && (ts.isArrowFunction(d.parent) || ts.isFunctionExpression(d.parent))) {
        const call = d.parent.parent
        if (ts.isCallExpression(call) && ts.isPropertyAccessExpression(call.expression) && ['map', 'filter', 'find', 'forEach', 'some', 'every'].includes(call.expression.name.text) && d.parent.parameters[0] === d) {
          const o = origin(call.expression.expression, seen)
          return o && { ...o, path: [...o.path, '[]'] }
        }
      }
      if (ts.isParameterDeclaration(d)) {
        const typed = typedOrigins.get(checker.getTypeAtLocation(node).id)
        if (typed) return typed
        const fn = d.parent
        const name = fn.name ?? (ts.isVariableDeclaration(fn.parent) ? fn.parent.name : null)
        if (name && ts.isIdentifier(name)) {
          const symbol = resolvedSymbol(name)
          const index = fn.parameters.indexOf(d)
          const origins = (calls.get(name.text) ?? []).filter(c => resolvedSymbol(c.expression) === symbol).map(c => origin(c.arguments[index], seen)).filter(Boolean)
          if (origins.length && origins.every(o => JSON.stringify(o) === JSON.stringify(origins[0]))) return origins[0]
        }
      }
      if (ts.isBindingElement(d)) {
        const o = origin(d.parent.parent.initializer, seen)
        const k = d.propertyName?.text ?? d.name.text
        return o && { ...o, path: [...o.path, k] }
      }
      return null
    }
    if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
      const o = origin(node.expression, seen)
      const key = ts.isPropertyAccessExpression(node) ? node.name.text : stringOf(node.argumentExpression) ?? finiteKeys(node.argumentExpression) ?? (ts.isNumericLiteral(node.argumentExpression) ? '[]' : '{}')
      return o && { ...o, path: [...o.path, key] }
    }
    if (ts.isArrayLiteralExpression(node) && node.elements.length === 1 && ts.isSpreadElement(node.elements[0])) return origin(node.elements[0].expression, seen)
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const name = node.expression.name.text
      if (['sort', 'filter', 'slice'].includes(name)) return origin(node.expression.expression, seen)
      if (name === 'map') {
        const callback = node.arguments[0]
        if (callback && ts.isArrowFunction(callback) && ts.isIdentifier(callback.body) && callback.parameters[0]?.name.text === callback.body.text) return origin(node.expression.expression, seen)
      }
      if (name === 'parse' && node.expression.expression.getText() === 'JSON') {
        const call = node.arguments[0]
        if (call && ts.isCallExpression(call) && isReadFile(call.expression)) {
          const file = stringOf(call.arguments[0])
          const dataset = datasetAt(file)
          if (dataset) return { file: dataset, path: [] }
          unresolved.add(`${relative(root, node.getSourceFile().fileName)}:${node.getSourceFile().getLineAndCharacterOfPosition(node.pos).line + 1}`)
        }
      }
    }
    if (ts.isCallExpression(node)) {
      const porte = porteDuDocument(node)
      if (porte) return porte.rendJson ? { file: porte.file, path: porte.path } : null
      const fn = functionOf(node.expression)
      const body = fn?.body && (ts.isBlock(fn.body) ? fn.body.statements.find(ts.isReturnStatement)?.expression : fn.body)
      const bindings = new Map((fn?.parameters ?? []).map((p, i) => [checker.getSymbolAtLocation(p.name), stringOf(node.arguments[i])]))
      if (body && ts.isCallExpression(body) && body.expression.getText() === 'JSON.parse') {
        const load = body.arguments[0]
        if (load && ts.isCallExpression(load) && isReadFile(load.expression)) {
          const file = datasetAt(stringOf(load.arguments[0], new Set(), bindings))
          if (file) return { file, path: [] }
        }
      }
    }
    return null
  }
    const scan = () => {
    for (const file of program.getSourceFileNames()) {
      if (!retained.has(norm(resolve(file)))) continue
      const sf = program.getSourceFile(file)
      const visit = node => {
        if ((ts.isAsExpression(node) || ts.isTypeAssertion(node)) && node.type) {
          const o = origin(node.expression)
          if (o) claims.push({ ...o, type: checker.getTypeFromTypeNode(node.type), node })
        }
        if (ts.isVariableDeclaration(node) && node.type && node.initializer) {
          const o = origin(node.initializer)
          if (o) claims.push({ ...o, type: checker.getTypeFromTypeNode(node.type), node })
        }
        const porte = porteDuDocument(node)
        if (porte) {
          const lu = { file: porte.file, path: porte.path }
          if (porte.rendJson) claims.push({ ...lu, type: checker.getTypeAtLocation(node), node })
          reads.push(lu)
        }
        if (ts.isCallExpression(node) && node.typeArguments?.length) {
          const fn = functionOf(node.expression)
          const body = fn?.body && (ts.isBlock(fn.body) ? fn.body.statements.find(ts.isReturnStatement)?.expression : fn.body)
          if (body && ts.isAsExpression(body) && ts.isIdentifier(body.expression)) {
            const index = fn.parameters.findIndex(p => ts.isIdentifier(p.name) && p.name.text === body.expression.text)
            const o = index >= 0 && origin(node.arguments[index])
            if (o) claims.push({ ...o, type: checker.getTypeAtLocation(node), node })
          }
        }
        if (lectures && (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node))) {
          const o = origin(node)
          const write = ts.isBinaryExpression(node.parent) && node.parent.left === node && node.parent.operatorToken.kind === ts.SyntaxKind.EqualsToken || ts.isDeleteExpression(node.parent)
          if (o && !write) reads.push(o)
        }
        if (lectures && ts.isBindingElement(node) && ts.isObjectBindingPattern(node.parent)) {
          const o = origin(node.parent.parent.initializer)
          if (o) reads.push({ ...o, path: [...o.path, node.propertyName?.text ?? node.name.text] })
        }
        node.forEachChild(visit)
      }
      visit(sf)
    }
    }
    scan()
    const addOrigin = (type, o, seen = new Set()) => {
      if (!type || seen.has(type)) return
      if (checker.getPropertiesOfType(type).some(p => p.declarations.some(d => d.resolve().getSourceFile().fileName.endsWith('.json')))) return
      seen = new Set(seen).add(type)
      if (!typedOrigins.has(type.id)) typedOrigins.set(type.id, o)
      else if (JSON.stringify(typedOrigins.get(type.id)) !== JSON.stringify(o)) typedOrigins.set(type.id, null)
      if (checker.isArrayType(type) || checker.isTupleType(type)) for (const element of checker.getTypeArguments(type)) addOrigin(element, { ...o, path: [...o.path, '[]'] }, seen)
      if (type.isUnionType() || type.isIntersectionType()) for (const member of type.getTypes()) addOrigin(member, o, seen)
    }
    for (const c of claims) addOrigin(c.type, { file: c.file, path: c.path })
    originCache.clear()
    scan()
  return { claims, reads, unresolved }
}

export function mesurerChampsDeSchema(root, { definitions = SCHEMA_DEFS, programme = null, fichiers = null } = {}) {
  const files = fichiers ?? ['src', 'scripts', 'hotes'].flatMap(dir => listerArbre(join(root, dir), { filtre: rel => /\.(?:[cm]?ts|tsx|[cm]?js)$/.test(rel) && (!estFichierVitest(rel) || /-guard\./.test(rel)) && !estKitDeTest(rel) && !/(?:\/migrations\/|\/schemas\/|\/ops\/sondes\/|schemaFieldConsumers\.)/.test('/' + rel) }).map(rel => join(root, dir, rel)))
  const config = programme ? null : JSON.parse(readFileSync(join(root, 'tsconfig.json'), 'utf8'))
  const session = programme ?? repoProgram(root, () => files, { 'tsconfig.json': JSON.stringify({ ...config, compilerOptions: { ...config.compilerOptions, allowJs: true, checkJs: false } }) })
  const { program, checker } = session
  try {
    const { claims, reads, unresolved } = relierChargements(root, session, { files, definitions })
    const typeNomme = (home, name) => {
      const sf = program.getSourceFile(norm(resolve(root, home)))
      const decl = sf?.statements.find(n => (ts.isTypeAliasDeclaration(n) || ts.isInterfaceDeclaration(n)) && n.name.text === name)
      return decl && { type: checker.getTypeAtLocation(decl.name), node: decl }
    }
    const shared = new Map(LIENS_SCHEMA_TYPES.filter(t => t.schema).map(t => [t.schema, typeNomme(t.home, t.type)]).filter(([,t]) => t))
    const envelope = typeNomme('src/data/schemas/grammaire/document.ts', 'EnveloppeDocument')
    const variant = typeNomme('src/data/schemas/grammaire/valeurs.ts', 'Variant')
    const absent = [], counts = []
    for (const d of definitions) {
      const common = []
      const variants = []
      const declared = champsDeclares(d.schema, (node, path) => {
        if (shared.has(node)) common.push({ path, ...shared.get(node), existence: true })
        if (variant && classeDeProduit(node)?.fabrique === 'variantOf') {
          common.push({ path, ...variant })
          variants.push({ node, path })
        }
        if (envelope && classeDeProduit(node)?.fabrique === 'document') {
          for (const key of CLES_ENVELOPPE) {
            const types = step(checker, [envelope.type], key, envelope.node)
            if (types.length) common.push({ path: [...path, key], type: types[0], node: envelope.node, existence: true })
          }
        }
      })
      const ofFile = claims.filter(c => c.file === d.file)
      ofFile.push(...common)
      const typePaths = new Map()
      const typesAt = (claim, path) => {
        let cache = typePaths.get(claim)
        if (!cache) typePaths.set(claim, cache = new Map([['[]', [claim.type]]]))
        const key = JSON.stringify(path)
        if (!cache.has(key)) cache.set(key, [...new Set(step(checker, typesAt(claim, path.slice(0, -1)), path.at(-1), claim.node))])
        return cache.get(key)
      }
      const readPaths = new Set(reads.filter(r => r.file === d.file).flatMap(r => expandPath(r.path).map(p => JSON.stringify(p))))
      for (const v of variants) {
        const base = v.path.slice(0, -2)
        const baseClaims = ofFile.filter(c => c.path.every((key, i) => base[i] === key) && base.length >= c.path.length)
        for (const c of baseClaims) {
          const types = typesAt(c, base.slice(c.path.length))
          for (const type of types) common.push({ path: v.path, type, node: c.node })
        }
      }
      ofFile.push(...common.filter(c => !ofFile.includes(c)))
      let missing = 0
      for (const path of declared) {
        const typed = ofFile.some(c => c.path.every((key, i) => path[i] === key) && (path.length > c.path.length || c.existence && path.length === c.path.length) && typesAt(c, path.slice(c.path.length)).length > 0)
        const read = readPaths.has(JSON.stringify(path))
        if (!typed && !read) { absent.push(`${d.file}:${path.join('.').replaceAll('.[]', '[]').replaceAll('.{}', '{}')}`); missing++ }
      }
      counts.push({ file: d.file, declares: declared.length, absents: missing })
    }
    return { absents: absent.sort(), datasets: counts, chargementsNonResolus: [...unresolved].sort() }
  } finally { if (!programme) session.dispose() }
}

const typesDuChemin = (checker, claim, path) => path.reduce((types, key) => [...new Set(step(checker, types, key, claim.node))], [claim.type])
const DECLARATIONS_NOMMEES = [ts.isInterfaceDeclaration, ts.isTypeAliasDeclaration, ts.isClassDeclaration]
const siteDe = (root, node) => `${norm(relative(root, node.getSourceFile().fileName))}:${node.getSourceFile().getLineAndCharacterOfPosition(node.getStart()).line + 1}`
const parUnites = (a, b) => (a < b ? -1 : a > b ? 1 : 0)

/** La déclaration NOMMÉE du dépôt qui porte `type`, ou la raison structurelle de son absence. */
function natureDuType(root, type) {
  if (type.flags & TypeFlags.AnyOrUnknown) return { raison: `type \`${type.flags & TypeFlags.Any ? 'any' : 'unknown'}\`` }
  const decl = (type.getAliasSymbol() ?? type.getSymbol())?.declarations?.[0]?.resolve()
  if (!decl) return type.isUnionType() || type.isIntersectionType() ? { raison: `${type.isUnionType() ? 'union' : 'intersection'} anonyme`, composee: true } : { raison: 'type calculé sans déclaration' }
  if (!DECLARATIONS_NOMMEES.some(est => est(decl)) || !decl.name) return { raison: 'littéral anonyme `{…}`' }
  const home = norm(relative(root, decl.getSourceFile().fileName))
  if (home.startsWith('../') || home.includes('node_modules/')) return { raison: `type \`${decl.name.text}\` d'une bibliothèque` }
  return { decl, type: decl.name.text, home }
}

/** Les alias qui ADOPTENT une entrée dérivée (`type X = EntreeDe<typeof def>`, `DatasetDe` ou `RangeeDe`), par fichier
 *  de donnée du def (`export const file`) et par GENRE d'entrée (`RangeeDe` : la rangée ; sinon : le document) : le nom
 *  sous lequel le dépôt lit cette entrée. Deux alias du même genre : le premier en (module, position), quel que soit
 *  l'ordre du corpus. */
function aliasAdoptants(root, program, files) {
  const adoptants = new Map()
  for (const f of files) {
    const sf = program.getSourceFile(f)
    if (!sf) continue
    const defs = new Map(sf.statements.filter(ts.isImportDeclaration).flatMap(i => {
      const ns = i.importClause?.namedBindings
      return ns && ts.isNamespaceImport(ns) ? [[ns.name.text, resolve(dirname(sf.fileName), `${i.moduleSpecifier.text}.ts`)]] : []
    }))
    for (const n of sf.statements) {
      if (!ts.isTypeAliasDeclaration(n)) continue
      // Une entrée VIVANTE (`EntreeVivante<EntreeDe<…>>`, `src/data/datasets.ts`) adopte l'entrée qu'elle rouvre.
      const vivante = ts.isTypeReferenceNode(n.type) && n.type.typeName.getText() === 'EntreeVivante' ? n.type.typeArguments?.[0] : n.type
      if (!vivante || !ts.isTypeReferenceNode(vivante) || !['EntreeDe', 'DatasetDe', 'RangeeDe'].includes(vivante.typeName.getText())) continue
      const arg = vivante.typeArguments?.[0]
      const module = arg && ts.isTypeQueryNode(arg) ? defs.get(arg.exprName.getText()) : undefined
      const file = module && /^export const file = '([^']+)';$/m.exec(program.getSourceFile(module)?.text ?? '')?.[1]
      if (!file) continue
      const cle = `${file}#${vivante.typeName.getText() === 'RangeeDe' ? 'rangee' : 'entree'}`
      const candidat = { decl: n, type: n.name.text, home: norm(relative(root, sf.fileName)) }
      const tenant = adoptants.get(cle)
      if (!tenant || parUnites(candidat.home, tenant.home) < 0 || (candidat.home === tenant.home && n.getStart() < tenant.decl.getStart())) adoptants.set(cle, candidat)
    }
  }
  return adoptants
}

/**
 * Les CIBLES de catalogue du rapport des consommateurs par champ, DÉRIVÉES de la jointure : pour chaque
 * def, le type que ses chargements donnent EXPLICITEMENT à son ENTRÉE (élément du tableau racine, valeur
 * d'un enregistrement racine, rangée d'un document à rangées, sinon la racine), domicilié au module qui le déclare, avec les clés de
 * l'entrée au schéma (`champsDeclares`, sceau `document()` descendu). Un type atteint par plusieurs defs
 * est UNE cible, à l'union de leurs clés. Un def dont aucun chargement ne nomme l'entrée SORT avec la
 * raison mesurée. Ordre total : cibles par `(home, position)`, sorties par `file`.
 */
export function ciblesDeCatalogue(root, session, files, definitions = SCHEMA_DEFS) {
  const { checker } = session
  const { claims } = relierChargements(root, session, { files, definitions, lectures: false })
  const adoptants = aliasAdoptants(root, session.program, files)
  const cibles = new Map(), sorties = []
  for (const d of [...definitions].sort((a, b) => parUnites(a.file, b.file))) {
    // L'ENTRÉE d'un document à rangées est sa rangée (`documentARangees.mts`, #3012).
    const aRangees = estDocumentARangees(d.schema, d.famille)
    const entree = aRangees ? ['entries', '[]'] : []
    const declares = champsDeclares(d.schema).filter(p => entree.every((k, i) => p[i] === k))
    while (declares.length && ['[]', '{}'].includes(declares[0][entree.length]) && declares.every(p => p[entree.length] === declares[0][entree.length])) entree.push(declares[0][entree.length])
    const cles = declares.filter(p => p.length === entree.length + 1).map(p => p.at(-1))
    const duDataset = claims.filter(c => c.file === d.file)
    const vues = duDataset.filter(c => c.path.length <= entree.length && c.path.every((k, i) => entree[i] === k))
    // Une entrée DÉRIVÉE n'a pas de déclaration propre — instanciation d'alias générique (`DatasetDuDocument`), ou
    // union des cas d'une charge par discriminant : elle se nomme par l'alias du dépôt qui l'adopte.
    const derivee = n => n.decl ? n.decl.typeParameters?.length > 0 : n.composee
    const adoptee = n => !derivee(n) ? n : adoptants.get(`${d.file}#${aRangees ? 'rangee' : 'entree'}`) ?? (n.decl ? { raison: 'type dérivé sans alias qui l’adopte (`EntreeDe`/`DatasetDe`/`RangeeDe`)' } : n)
    const natures = vues.flatMap(c => typesDuChemin(checker, c, entree.slice(c.path.length)).map(t => ({ ...adoptee(natureDuType(root, t)), site: siteDe(root, c.node) })))
    for (const n of natures.filter(n => n.decl)) {
      const cle = `${n.home}#${n.type}`
      const cible = cibles.get(cle) ?? { type: n.type, home: n.home, position: n.decl.getStart(), cles: [], files: [] }
      cible.cles = [...new Set([...cible.cles, ...cles])]
      if (!cible.files.includes(d.file)) cible.files.push(d.file)
      cibles.set(cle, cible)
    }
    if (natures.some(n => n.decl)) continue
    const raisons = natures.length
      ? natures.map(n => `${n.raison} au chargement ${n.site}`)
      : duDataset.length
        ? [`aucune vue typée de l'entrée — vues de sous-chemins seulement : ${[...new Set(duDataset.map(c => `\`${c.path.join('.').replaceAll('.[]', '[]')}\` (${siteDe(root, c.node)})`))].sort(parUnites).join(', ')}`]
        : ['aucun chargement typé (cast, annotation ou porte `datasetDe`/`rangeesDe`)']
    sorties.push({ file: d.file, raison: [...new Set(raisons)].sort(parUnites).join(' ; ') })
  }
  return {
    cibles: [...cibles.values()].sort((a, b) => parUnites(a.home, b.home) || a.position - b.position).map(({ type, home, cles, files }) => ({ type, home, cles, files })),
    sorties,
  }
}
