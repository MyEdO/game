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
import { creerProvenanceFs } from './provenanceFs.mjs'

const norm = p => p.replaceAll('\\', '/')
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

export function mesurerChampsDeSchema(root, { definitions = SCHEMA_DEFS, programme = null, fichiers = null } = {}) {
  const files = fichiers ?? ['src', 'scripts', 'hotes'].flatMap(dir => listerArbre(join(root, dir), { filtre: rel => /\.(?:[cm]?ts|tsx|[cm]?js)$/.test(rel) && (!estFichierVitest(rel) || /-guard\./.test(rel)) && !estKitDeTest(rel) && !/(?:\/migrations\/|\/schemas\/|\/ops\/sondes\/|schemaFieldConsumers\.)/.test('/' + rel) }).map(rel => join(root, dir, rel)))
  const config = programme ? null : JSON.parse(readFileSync(join(root, 'tsconfig.json'), 'utf8'))
  const session = programme ?? repoProgram(root, () => files, { 'tsconfig.json': JSON.stringify({ ...config, compilerOptions: { ...config.compilerOptions, allowJs: true, checkJs: false } }) })
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
  const expandPath = path => path.reduce((paths, key) => paths.flatMap(p => (Array.isArray(key) ? key : [key]).map(k => [...p, k])), [[]])
  const functionOf = expr => {
    const declaration = checker.getSymbolAtLocation(expr)?.declarations?.[0]?.resolve()
    const fn = declaration?.initializer ?? declaration
    return fn && (ts.isArrowFunction(fn) || ts.isFunctionDeclaration(fn) || ts.isFunctionExpression(fn)) ? fn : null
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
  try {
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
        if (ts.isCallExpression(node) && node.typeArguments?.length) {
          const fn = functionOf(node.expression)
          const body = fn?.body && (ts.isBlock(fn.body) ? fn.body.statements.find(ts.isReturnStatement)?.expression : fn.body)
          if (body && ts.isAsExpression(body) && ts.isIdentifier(body.expression)) {
            const index = fn.parameters.findIndex(p => ts.isIdentifier(p.name) && p.name.text === body.expression.text)
            const o = index >= 0 && origin(node.arguments[index])
            if (o) claims.push({ ...o, type: checker.getTypeAtLocation(node), node })
          }
        }
        if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
          const o = origin(node)
          const write = ts.isBinaryExpression(node.parent) && node.parent.left === node && node.parent.operatorToken.kind === ts.SyntaxKind.EqualsToken || ts.isDeleteExpression(node.parent)
          if (o && !write) reads.push(o)
        }
        if (ts.isBindingElement(node) && ts.isObjectBindingPattern(node.parent)) {
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
