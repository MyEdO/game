import { readFileSync, statSync } from 'node:fs'
import { resolve, isAbsolute } from 'node:path'
import { analyserTexte, typescript } from './dialecte.mjs'
import { canoniser, relatifSousRacine } from '../../docs/lib/chemin-mesure.mjs'
import { depotDe, estIgnore } from './gitPorte.mjs'
import { estSuiteVitest } from './fichierVitest.mjs'

export function contexteSonde({ dir, racineNpm } = {}) {
  const racine = canoniser(racineNpm ?? dir ?? process.cwd())
  return {
    dir: dir ?? racine, racine,
    lire: chemin => readFileSync(chemin, 'utf8'),
    fichier: chemin => statSync(chemin).isFile(),
    autorise: chemin => {
      const rel = relatifSousRacine(racine, chemin)
      return rel === null || estIgnore(depotDe(racine), rel)
    },
  }
}

export function estSondeVitest(jetons, contexte) {
  if (!contexte) return false
  const args = jetons.map(j => j.text)
  const i = args.indexOf('vitest')
  if (i < 0 || args[i + 1] !== 'run') return false
  const suite = jetons.slice(i + 2)
  if (suite.length !== 2 || !['--config', '-c'].includes(suite[0].text) || suite.some(j => j.substitutions?.length) || /[$%`*?[\]]/.test(suite[1].text)) return false
  if (contexte.repertoireChange && !isAbsolute(suite[1].text)) return false
  try {
    const config = resolve(contexte.dir, suite[1].text)
    if (!contexte.autorise(config)) return false
    const { sourceFile, diagnostics } = analyserTexte({ rel: config, text: contexte.lire(config) })
    if (diagnostics.length) return false
    const ts = typescript()
    const enleverParentheses = n => ts.isParenthesizedExpression(n) ? enleverParentheses(n.expression) : n
    const objet = n => {
      n = enleverParentheses(n)
      if (!ts.isObjectLiteralExpression(n)) return null
      const props = new Map()
      for (const p of n.properties) {
        if (!ts.isPropertyAssignment(p) || !(ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)) || props.has(p.name.text)) return null
        props.set(p.name.text, p.initializer)
      }
      return props
    }
    const constantes = new Map()
    const texteStatique = n => {
      n = enleverParentheses(n)
      if (ts.isStringLiteral(n)) return n.text
      if (ts.isIdentifier(n)) return constantes.get(n.text)
      if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.PlusToken) {
        const gauche = texteStatique(n.left), droite = texteStatique(n.right)
        if (gauche !== undefined && droite !== undefined) return gauche + droite
      }
      return undefined
    }
    let definition, exporte
    for (const s of sourceFile.statements) {
      if (ts.isImportDeclaration(s) && s.moduleSpecifier.text === 'vitest/config' && !definition) {
        const bindings = s.importClause?.namedBindings
        if (!bindings || !ts.isNamedImports(bindings) || bindings.elements.length !== 1) return false
        const e = bindings.elements[0]
        if ((e.propertyName?.text ?? e.name.text) !== 'defineConfig') return false
        definition = e.name.text
      } else if (ts.isVariableStatement(s) && !s.modifiers?.length && (s.declarationList.flags & ts.NodeFlags.Const)) {
        for (const declaration of s.declarationList.declarations) {
          if (!ts.isIdentifier(declaration.name) || constantes.has(declaration.name.text) || !declaration.initializer) return false
          const texte = texteStatique(declaration.initializer)
          if (texte === undefined) return false
          constantes.set(declaration.name.text, texte)
        }
      } else if (ts.isExportAssignment(s) && !s.isExportEquals && !exporte) exporte = enleverParentheses(s.expression)
      else return false
    }
    if (!exporte) return false
    if (ts.isCallExpression(exporte)) {
      if (!definition || !ts.isIdentifier(exporte.expression) || exporte.expression.text !== definition || exporte.arguments.length !== 1) return false
      exporte = exporte.arguments[0]
    }
    const configObjet = objet(exporte)
    if (!configObjet || [...configObjet.keys()].some(k => !['root', 'test'].includes(k))) return false
    const test = objet(configObjet.get('test'))
    if (!test || [...test.keys()].some(k => !['include', 'setupFiles', 'environment', 'globals', 'maxWorkers', 'minWorkers', 'fileParallelism'].includes(k))) return false
    for (const [nom, valeur] of test) {
      if (nom === 'setupFiles') {
        if (!ts.isArrayLiteralExpression(valeur) || valeur.elements.some(e => texteStatique(e) === undefined)) return false
      } else if (nom !== 'include' && !(ts.isStringLiteral(valeur) || ts.isNumericLiteral(valeur) || valeur.kind === ts.SyntaxKind.TrueKeyword || valeur.kind === ts.SyntaxKind.FalseKeyword)) return false
    }
    const include = test.get('include')
    if (!include || !ts.isArrayLiteralExpression(include) || include.elements.length !== 1) return false
    const cible = texteStatique(include.elements[0])
    if (cible === undefined) return false
    if (/[*?[\]{}()]/.test(cible) || !estSuiteVitest(cible)) return false
    const root = configObjet.get('root')
    const racine = root && texteStatique(root)
    if (!isAbsolute(cible) && root && racine === undefined) return false
    if (contexte.repertoireChange && !isAbsolute(cible) && (!racine || !isAbsolute(racine))) return false
    if (root && !ts.isStringLiteral(root) && !ts.isIdentifier(root)) return false
    return contexte.fichier(isAbsolute(cible) ? cible : resolve(root ? resolve(contexte.dir, racine) : contexte.dir, cible))
  } catch { return false }
}
