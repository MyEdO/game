import { analyserCorpus, typescript } from './dialecte.mjs'

export const OPERATIONS_FS = {
  writeFileSync: { chemins: [0], detecteeParGateHistorique: true },
  writeFile: { chemins: [0], detecteeParGateHistorique: true },
  createWriteStream: { chemins: [0], detecteeParGateHistorique: true },
  appendFileSync: { chemins: [0], detecteeParGateHistorique: true },
  appendFile: { chemins: [0], detecteeParGateHistorique: true },
  mkdirSync: { chemins: [0], detecteeParGateHistorique: true },
  mkdir: { chemins: [0], detecteeParGateHistorique: true },
  rmSync: { chemins: [0], detecteeParGateHistorique: true },
  rm: { chemins: [0], detecteeParGateHistorique: false },
  rmdirSync: { chemins: [0], detecteeParGateHistorique: true },
  rmdir: { chemins: [0], detecteeParGateHistorique: false },
  unlinkSync: { chemins: [0], detecteeParGateHistorique: true },
  unlink: { chemins: [0], detecteeParGateHistorique: false },
  renameSync: { chemins: [0, 1], detecteeParGateHistorique: true },
  rename: { chemins: [0, 1], detecteeParGateHistorique: true },
  cpSync: { chemins: [1], detecteeParGateHistorique: true },
  cp: { chemins: [1], detecteeParGateHistorique: false },
  copyFileSync: { chemins: [1], detecteeParGateHistorique: true },
  copyFile: { chemins: [1], detecteeParGateHistorique: false },
  truncateSync: { chemins: [0], detecteeParGateHistorique: true },
  truncate: { chemins: [0], detecteeParGateHistorique: false },
  linkSync: { chemins: [1], detecteeParGateHistorique: false },
  link: { chemins: [1], detecteeParGateHistorique: false },
  symlinkSync: { chemins: [1], detecteeParGateHistorique: false },
  symlink: { chemins: [1], detecteeParGateHistorique: false },
}

export function ciblesDEcritureJS(texte) {
  const ts = typescript()
  const sorties = []
  for (const { sourceFile, diagnostics, checker } of analyserCorpus([{ rel: 'inline.mjs', text: texte }])) {
    if (diagnostics.length || !sourceFile) return []
    const symbole = (n) => checker.getSymbolAtLocation(n)
    const mutables = new Set()
    const mutationsDePropriete = new Set()
    const parcours = (n, fn) => { fn(n); n.forEachChild((c) => parcours(c, fn)) }
    parcours(sourceFile, (n) => {
      if (ts.isBinaryExpression(n) && n.operatorToken.kind >= ts.SyntaxKind.FirstAssignment && n.operatorToken.kind <= ts.SyntaxKind.LastAssignment) {
        let cible = n.left
        while (ts.isPropertyAccessExpression(cible) || ts.isElementAccessExpression(cible)) cible = cible.expression
        if (ts.isIdentifier(cible)) {
          mutables.add(symbole(cible))
          if (cible !== n.left) mutationsDePropriete.add(symbole(cible))
        }
      }
      if ((ts.isPostfixUnaryExpression(n) || ts.isPrefixUnaryExpression(n)) && ts.isIdentifier(n.operand)) mutables.add(symbole(n.operand))
    })
    const invaliderOrigine = (s, vus = new Set()) => {
      if (!s || vus.has(s)) return
      vus.add(s)
      mutables.add(s)
      let d = s.declarations?.[0]?.resolve()
      if (d && ts.isBindingElement(d)) d = d.parent.parent
      if (!d || !ts.isVariableDeclaration(d)) return
      let origine = d.initializer
      while (origine && (ts.isPropertyAccessExpression(origine) || ts.isElementAccessExpression(origine))) origine = origine.expression
      if (origine && ts.isIdentifier(origine)) invaliderOrigine(symbole(origine), vus)
    }
    for (const s of mutationsDePropriete) invaliderOrigine(s)
    const litteral = (n) => n && (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) ? n.text : null
    const fsSource = (n) => ['fs', 'node:fs', 'fs/promises', 'node:fs/promises'].includes(litteral(n))
    const provenance = (n, vus = new Set()) => {
      if (!n) return null
      if (ts.isParenthesizedExpression(n)) return provenance(n.expression, vus)
      if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'require' && !symbole(n.expression)?.declarations?.some(d => !d.resolve().getSourceFile().isDeclarationFile) && fsSource(n.arguments[0])) return { fs: true }
      if (ts.isPropertyAccessExpression(n)) {
        const base = provenance(n.expression, vus)
        if (base?.fs) return n.name.text === 'promises' ? base : { operation: n.name.text }
        return null
      }
      if (ts.isElementAccessExpression(n) && provenance(n.expression, vus)?.fs) {
        const operation = litteral(n.argumentExpression)
        return operation === 'promises' ? { fs: true } : { operation }
      }
      if (!ts.isIdentifier(n)) return null
      const s = symbole(n)
      if (!s || vus.has(s) || mutables.has(s)) return null
      const suite = new Set([...vus, s])
      const d = s.declarations?.[0]?.resolve()
      if (!d) return null
      if (ts.isVariableDeclaration(d)) return provenance(d.initializer, suite)
      if (ts.isBindingElement(d)) {
        const declaration = d.parent.parent
        const operation = (d.propertyName ?? d.name).text
        return ts.isVariableDeclaration(declaration) && provenance(declaration.initializer, suite)?.fs ? operation === 'promises' ? { fs: true } : { operation } : null
      }
      if (ts.isNamespaceImport(d) || ts.isImportClause(d) || ts.isImportSpecifier(d)) {
        let p = d
        while (p && !ts.isImportDeclaration(p)) p = p.parent
        if (!p || !fsSource(p.moduleSpecifier)) return null
        const operation = ts.isImportSpecifier(d) ? (d.propertyName ?? d.name).text : null
        return operation && operation !== 'promises' ? { operation } : { fs: true }
      }
      return null
    }
    parcours(sourceFile, (n) => {
      if (!ts.isCallExpression(n)) return
      const operation = provenance(n.expression)?.operation
      for (const indice of Object.hasOwn(OPERATIONS_FS, operation) ? OPERATIONS_FS[operation].chemins : []) {
        const chemin = litteral(n.arguments[indice])
        sorties.push({ chemin, inconnue: chemin === null, operation })
      }
    })
  }
  return sorties
}
