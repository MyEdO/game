import * as importe0_0 from '../guards/lib/dialecte.mjs'
import * as importe0_1 from 'node:fs'
import * as importe0_2 from 'node:module'
import * as importe0_3 from 'node:path'
import * as importe0_4 from 'node:url'
import * as importe0_5 from '../guards/lib/dialecte.mjs'
import * as importe0_6 from '../guards/lib/importGraph.mjs'
export const bancetapesDuTraintestmjs = (() => {
const ast = importe0_0.ast
const existsSync = importe0_1.existsSync
const readFileSync = importe0_1.readFileSync
const isBuiltin = importe0_2.isBuiltin
const resolve = importe0_3.resolve
const fileURLToPath = importe0_4.fileURLToPath
const typescript = importe0_5.typescript
const clotureDImports = importe0_6.clotureDImports
const estModule = importe0_6.estModule
const resolveImport = importe0_6.resolveImport
const RACINE = fileURLToPath(new URL('../..', import.meta.url))
const ETAPES = fileURLToPath(new URL('./etapesDuTrain.mjs', import.meta.url))
const posix = (chemin) => chemin.split('\\').join('/')
const INERTES = new Map([
  ['path', '*'],
  ['url', '*'],
  ['buffer', '*'],
  ['crypto', new Set(['createHash'])],
  ['fs', new Set(['existsSync', 'readFileSync', 'statSync', 'lstatSync', 'readdirSync', 'realpathSync'])],
])
const estInerte = (integre, nom) => {
  const inertes = INERTES.get(integre)
  return inertes === '*' || (inertes instanceof Set && inertes.has(nom))
}
const MENTIONS = new Set(['getBuiltinModule', 'binding', '_linkedBinding', 'createRequire'])
const GLOBAUX = new Set([...Object.getOwnPropertyNames(globalThis), 'globalThis'])
const AMBIANTS_INERTES = new Set([
  'undefined',          // valeur
  'Object',             // données
  'Array',              // données
  'String',             // données
  'Number',             // données
  'Boolean',            // données
  'Symbol',             // données
  'Map',                // données
  'Set',                // données
  'WeakMap',            // données
  'Date',               // horloge lue, sans entrée-sortie
  'Math',               // calcul
  'JSON',               // codage, sans entrée-sortie
  'RegExp',             // calcul
  'encodeURIComponent', // codage, sans entrée-sortie
  'decodeURIComponent', // codage, sans entrée-sortie
  'URL',                // codage, sans entrée-sortie
  'TextDecoder',        // codage, sans entrée-sortie
  'Buffer',             // codage, sans entrée-sortie
  'Error',              // erreur
  'TypeError',          // erreur
  'Promise',            // différé dans le même processus
  'setTimeout',         // différé dans le même processus
  'Atomics',            // attente dans le même processus
  'SharedArrayBuffer',  // mémoire du même processus
  'Int32Array',         // mémoire du même processus
  'console',            // écrit sur les flux déjà ouverts du processus, ne lance rien
])
const DISQUE = Object.freeze({ lire: (chemin) => readFileSync(chemin, 'utf8'), existe: existsSync })
const arbreDe = (chemin, disque = DISQUE) => {
  return ast({ rel: chemin, text: disque.lire(chemin) })
}
function estNomDePropriete(n) {
  const ts = typescript()
  const p = n.parent
  return !!p && ((ts.isPropertyAccessExpression(p) && p.name === n)
    || ((ts.isPropertyAssignment(p) || ts.isMethodDeclaration(p) || ts.isPropertyDeclaration(p) || ts.isGetAccessorDeclaration(p) || ts.isSetAccessorDeclaration(p)) && p.name === n)
    || (ts.isBindingElement(p) && p.propertyName === n))
}
const texteLitteral = (n) => {
  const ts = typescript()
  return n && (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) ? n.text : null
}
function identifiantsLies(nom) {
  const ts = typescript()
  if (ts.isIdentifier(nom)) return [nom.text]
  return nom.elements.flatMap((e) => (ts.isOmittedExpression(e) ? [] : identifiantsLies(e.name)))
}
function nomsDeclares(instructions) {
  const ts = typescript()
  return instructions.flatMap((st) => {
    if (ts.isVariableStatement(st)) return st.declarationList.declarations.flatMap((d) => identifiantsLies(d.name))
    if ((ts.isFunctionDeclaration(st) || ts.isClassDeclaration(st)) && st.name) return [st.name.text]
    if (!ts.isImportDeclaration(st) || !st.importClause) return []
    const { name, namedBindings } = st.importClause
    return [...(name ? [name.text] : []),
      ...(!namedBindings ? [] : ts.isNamespaceImport(namedBindings) ? [namedBindings.name.text] : namedBindings.elements.map((e) => e.name.text))]
  })
}
function nomsLiesPar(n) {
  const ts = typescript()
  if (ts.isSourceFile(n) || ts.isBlock(n) || ts.isModuleBlock(n)) return nomsDeclares(n.statements)
  if (ts.isCaseBlock(n)) return nomsDeclares(n.clauses.flatMap((c) => c.statements))
  if (ts.isFunctionLikeDeclaration(n)) return [...(n.parameters ?? []).flatMap((p) => identifiantsLies(p.name)),
    ...(ts.isFunctionExpression(n) && n.name ? [n.name.text] : [])]
  if (ts.isClassExpression(n) && n.name) return [n.name.text]
  if (ts.isCatchClause(n) && n.variableDeclaration) return identifiantsLies(n.variableDeclaration.name)
  if ((ts.isForStatement(n) || ts.isForInStatement(n) || ts.isForOfStatement(n)) && n.initializer && ts.isVariableDeclarationList(n.initializer))
    return n.initializer.declarations.flatMap((d) => identifiantsLies(d.name))
  return []
}
function estAmbiant(n) {
  const ts = typescript()
  if (!GLOBAUX.has(n.text) || AMBIANTS_INERTES.has(n.text)) return false
  const p = n.parent
  if (ts.isLabeledStatement(p) || ts.isBreakOrContinueStatement(p)) return false
  for (let a = p; a; a = a.parent) if (nomsLiesPar(a).includes(n.text)) return false
  return true
}
function lectureDe(chemin, disque = DISQUE) {
  const ts = typescript()
  const versModule = (spec) => (isBuiltin(spec) ? { integre: spec.replace(/^node:/, '') }
    : { abs: resolveImport(chemin, spec, disque.existe) })
  const lu = { imports: [], reexports: [], exports: new Map(), decls: [], dynamiques: [], mentions: [], ambiants: [] }
  const analyser = (st) => {
    const refs = new Set()
    const rangements = []
    let racine = false
    const racineDe = (e) => (ts.isPropertyAccessExpression(e) || ts.isElementAccessExpression(e) ? racineDe(e.expression) : e)
    const refsDe = (noeuds) => {
      const vus = new Set()
      const marcher = (n) => {
        if (ts.isIdentifier(n) && !estNomDePropriete(n)) vus.add(n.text)
        n.forEachChild(marcher)
      }
      for (const n of noeuds) marcher(n)
      return vus
    }
    const ranger = (cible, valeurs) => {
      const r = racineDe(cible)
      if (ts.isIdentifier(r)) rangements.push({ cible: r.text, refs: refsDe(valeurs) })
    }
    const visiter = (n) => {
      if (ts.isTypeNode(n)) return;
      if (ts.isBinaryExpression(n) && n.operatorToken.kind >= ts.SyntaxKind.FirstAssignment && n.operatorToken.kind <= ts.SyntaxKind.LastAssignment) ranger(n.left, [n.right])
      if (ts.isCallExpression(n) && (ts.isPropertyAccessExpression(n.expression) || ts.isElementAccessExpression(n.expression))) ranger(n.expression, n.arguments)
      if (ts.isIdentifier(n)) {
        if (MENTIONS.has(n.text)) { racine = true; lu.mentions.push(n.text) }
        if (!estNomDePropriete(n)) {
          refs.add(n.text)
          if (estAmbiant(n)) { racine = true; lu.ambiants.push(n.text) }
        }
      }
      if (ts.isElementAccessExpression(n) && MENTIONS.has(texteLitteral(n.argumentExpression) ?? '')) { racine = true; lu.mentions.push(n.getText()) }
      if (ts.isCallExpression(n) && (n.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(n.expression) && n.expression.text === 'require'))) {
        racine = true
        lu.dynamiques.push(n.getText())
      }
      n.forEachChild(visiter)
    }
    visiter(st)
    return { refs, rangements, racine }
  }
  for (const st of arbreDe(chemin, disque).statements) {
    if (ts.isImportDeclaration(st)) {
      const cible = versModule(st.moduleSpecifier.text)
      const clause = st.importClause
      if (clause?.name) lu.imports.push({ local: clause.name.text, nom: 'default', ...cible })
      const liens = clause?.namedBindings
      if (liens && ts.isNamespaceImport(liens)) lu.imports.push({ local: liens.name.text, nom: '*', ...cible })
      else if (liens) for (const e of liens.elements) lu.imports.push({ local: e.name.text, nom: (e.propertyName ?? e.name).text, ...cible })
      continue
    }
    if (ts.isExportDeclaration(st)) {
      const clause = st.exportClause
      if (st.moduleSpecifier) {
        const cible = versModule(st.moduleSpecifier.text)
        if (!clause) lu.reexports.push({ exporte: '*', nom: '*', ...cible })
        else if (ts.isNamespaceExport(clause)) lu.reexports.push({ exporte: clause.name.text, nom: '*ns', ...cible })
        else for (const e of clause.elements) lu.reexports.push({ exporte: e.name.text, nom: (e.propertyName ?? e.name).text, ...cible })
      } else if (clause && ts.isNamedExports(clause)) for (const e of clause.elements) lu.exports.set(e.name.text, (e.propertyName ?? e.name).text)
      continue
    }
    const modificateurs = (('modifiers' in st) && st.modifiers) || []
    const exporte = modificateurs.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
    const parDefaut = modificateurs.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword)
    const noms = (ts.isFunctionDeclaration(st) || ts.isClassDeclaration(st)) && st.name ? [st.name.text]
      : ts.isVariableStatement(st) ? st.declarationList.declarations.flatMap((d) => identifiantsLies(d.name))
        : ts.isExportAssignment(st) || (parDefaut && !st.name) ? ['default']
          : []
    lu.decls.push({ noms, ...analyser(st) })
    if (exporte) for (const nom of noms) lu.exports.set(parDefaut ? 'default' : nom, nom)
    if (ts.isExportAssignment(st)) lu.exports.set('default', 'default')
  }
  return lu
}
function lanceursDeLaCloture(cloture, disque = DISQUE) {
  const lectures = new Map(cloture.map((f) => [posix(f), lectureDe(f, disque)]))
  const exportsLanceurs = new Map([...lectures.keys()].map((f) => [f, new Set()]))
  const locaux = new Map([...lectures.keys()].map((f) => [f, new Set()]))
  const cibleDe = ({ abs }) => (abs ? exportsLanceurs.get(posix(abs)) : undefined)
  const lanceuse = (liaison) => {
    if (liaison.integre) return !estInerte(liaison.integre, liaison.nom)
    const cible = cibleDe(liaison)
    if (!cible) return true
    return liaison.nom === '*' || liaison.nom === '*ns' ? cible.size > 0 : cible.has(liaison.nom)
  }
  for (let change = true; change;) {
    change = false
    const ajouter = (ens, nom) => {
      if (!ens.has(nom)) {
        ens.add(nom)
        change = true
      }
    }
    for (const [f, lu] of lectures) {
      const locs = locaux.get(f)
      for (const i of lu.imports) if (lanceuse(i)) ajouter(locs, i.local)
      for (const d of lu.decls) {
        for (const { cible, refs } of d.rangements)
          if ([...refs].some((r) => locs.has(r)) && lu.decls.some((x) => x.noms.includes(cible))) ajouter(locs, cible)
        if (d.racine || [...d.refs].some((r) => locs.has(r) && !d.noms.includes(r))) for (const n of d.noms) ajouter(locs, n)
      }
      const exps = exportsLanceurs.get(f)
      for (const [exporte, local] of lu.exports) if (locs.has(local)) ajouter(exps, exporte)
      for (const r of lu.reexports) {
        if (r.nom !== '*') {
          if (lanceuse(r)) ajouter(exps, r.exporte)
          continue
        }
        const cible = cibleDe(r)
        if (r.integre ? !estInerte(r.integre, '*') : !cible) ajouter(exps, '*')
        else if (cible) for (const n of cible) if (n !== 'default') ajouter(exps, n)
      }
    }
  }
  return { lectures, exportsLanceurs, locaux }
}
const clotureDesEtapes = () =>
  [...clotureDImports([ETAPES], { racine: RACINE })].map((rel) => resolve(RACINE, rel)).filter(estModule)
return { RACINE, ETAPES, posix, INERTES, estInerte, MENTIONS, GLOBAUX, AMBIANTS_INERTES, DISQUE, arbreDe, estNomDePropriete, texteLitteral, identifiantsLies, nomsDeclares, nomsLiesPar, estAmbiant, lectureDe, lanceursDeLaCloture, clotureDesEtapes }
})()
