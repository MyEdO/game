// COUPE AU CARACTÈRE (#1806, R-M2 de `docs/plans/2026-08-16-spec-hud-combat.md`) — un texte coupé
// à un nombre de caractères puis suivi d'une ellipse tranche un mot. La seule coupe d'un texte
// ellipsé est `coupeAuMot` (`src/lib/coupeAuMot.mjs`), FOYER de cette garde (`sAppliqueA`).
// Consommateur : `src/coupe-au-caractere-guard.test.ts`. Module ESM pur.
//
// PORTÉE, par l'arbre syntaxique d'un seul fichier et sans flux de données : l'expression de texte qui
// emporte la coupe (gabarit, concaténation, ternaire, parenthèses, `trim*`, `padEnd`, `concat`, le
// `join` d'un tableau de caractères), le nœud JSX qui suit l'expression de la coupe (les textes JSX
// faits de seuls blancs et les expressions JSX vides `{/* … */}` sautés), une constante `const`
// littérale nommée à la place de l'ellipse, et une coupe liée à une `const` puis ellipsée sous ce nom.
// Un nom se résout par son SYMBOLE (vérificateur de TypeScript sur le seul fichier) :
// un homonyme d'une autre portée n'est pas lui. HORS PORTÉE : une coupe passée en argument, rendue par
// une fonction, liée à un `let` ou un `var`, ou ellipsée dans un autre fichier ; une constante importée.

import { analyserCorpus, typescript } from './dialecte.mjs'
import { sAppliqueA } from './sourceCorpus.mjs'
import { virtualProgram, libererSessions } from './tsProgram.mjs'

/** Méthodes qui prennent un préfixe au caractère. */
const COUPES = new Set(['slice', 'substring', 'substr'])
/** Méthodes d'une chaîne qui gardent le préfixe pour texte : `x.slice(0, n).trimEnd()` reste une coupe. */
const SUITES_DE_TEXTE = new Set(['trim', 'trimEnd', 'trimRight', 'padEnd', 'concat'])
/** L'ellipse, typographique ou en trois points. */
const ELLIPSE = /…|\.\.\./
/** La coupe elle-même. */
const DECLARATION = { foyer: 'src/lib/coupeAuMot.mjs' }

/**
 * Sites d'un préfixe `x.slice|substring|substr(0, n)` dont l'expression de texte qui l'emporte porte
 * une ellipse (voir PORTÉE, en-tête).
 * @param {readonly { rel: string, text: string }[]} fichiers
 * @returns {string[]} `chemin:ligne`
 */
export function coupesAuCaractere(fichiers) {
  const ts = typescript()
  const sites = []
  for (const { fichier, sourceFile } of analyserCorpus(fichiers.filter((f) => sAppliqueA(f, DECLARATION)))) {
    if (!sourceFile) continue
    const porteCoupe = (n) => (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)
      && COUPES.has(n.expression.name.text) && n.arguments.length === 2
      && ts.isNumericLiteral(n.arguments[0]) && n.arguments[0].text === '0') || n.forEachChild(porteCoupe)
    if (!porteCoupe(sourceFile)) continue
    const session = virtualProgram({ [fichier.rel]: fichier.text }, { noLib: true, noResolve: true, allowJs: true, types: [] })
    const erreurs = []
    try {
      const racine = session.program.getSourceFileNames().map((file) => session.program.getSourceFile(file)).find((sf) => !sf.isDeclarationFile)
      if (!racine) continue
      /** Le symbole d'un nom du fichier. */
      const symbole = (id) => session.checker.getSymbolAtLocation(id)
      /** La déclaration `const` que désigne le nom `id`. */
      const constanteDe = (id) => {
        const decl = symbole(id)?.valueDeclaration?.resolve()
        return decl && ts.isVariableDeclaration(decl) && (decl.parent.flags & ts.NodeFlags.Const) ? decl : undefined
      }
      const litteralEllipse = (n) => !!n && (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) && ELLIPSE.test(n.text)

      const texteEllipse = (n) =>
        ((ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) || ts.isTemplateHead(n)
          || ts.isTemplateMiddle(n) || ts.isTemplateTail(n) || ts.isJsxText(n)) && ELLIPSE.test(n.text))
        || (ts.isIdentifier(n) && litteralEllipse(constanteDe(n)?.initializer))
      const porteEllipse = (noeud) => {
        let vu = false
        const visite = (n) => {
          if (vu) return
          if (texteEllipse(n)) vu = true
          else n.forEachChild(visite)
        }
        visite(noeud)
        return vu
      }
      /** Tableau de CARACTÈRES : `[...s]` ou `Array.from(s)`. */
      const tableauDeCaracteres = (n) =>
        (ts.isArrayLiteralExpression(n) && n.elements.length === 1 && ts.isSpreadElement(n.elements[0]))
        || (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && n.expression.name.text === 'from'
          && ts.isIdentifier(n.expression.expression) && n.expression.expression.text === 'Array' && n.arguments.length === 1)
      /** L'expression de texte qui emporte `depart` ; `caracteres` : `depart` est un tableau de caractères. */
      const englobant = (depart, caracteres) => {
        let n = depart
        for (;;) {
          const p = n.parent
          if (!p) return n
          if (ts.isPropertyAccessExpression(p) && p.expression === n && ts.isCallExpression(p.parent)
            && (SUITES_DE_TEXTE.has(p.name.text) || (caracteres && p.name.text === 'join'))) { n = p.parent; continue }
          if (ts.isTemplateSpan(p)) { n = p.parent; continue }
          if (ts.isParenthesizedExpression(p) || ts.isConditionalExpression(p)
            || (ts.isBinaryExpression(p) && p.operatorToken.kind === ts.SyntaxKind.PlusToken)) { n = p; continue }
          return n
        }
      }
      /** `{coupe}…` : le nœud JSX qui SUIT l'expression de la coupe, blancs et expressions vides sautés, porte l'ellipse. */
      const suiviEnJsx = (n) => {
        const expr = n.parent
        if (!expr || !ts.isJsxExpression(expr) || !expr.parent
          || !(ts.isJsxElement(expr.parent) || ts.isJsxFragment(expr.parent))) return false
        const freres = [...expr.parent.children]
        const suivant = freres.slice(freres.indexOf(expr) + 1)
          .find((f) => !(ts.isJsxText(f) && f.containsOnlyTriviaWhiteSpaces) && !(ts.isJsxExpression(f) && !f.expression))
        return !!suivant && porteEllipse(suivant)
      }
      const ellipse = (depart, caracteres) => {
        const e = englobant(depart, caracteres)
        return porteEllipse(e) || suiviEnJsx(e)
      }
      /** Coupe liée à une `const`, puis ellipsée sous ce nom (même symbole). */
      const ellipseeParSonNom = (e) => {
        const decl = e.parent
        if (!decl || !ts.isVariableDeclaration(decl) || decl.initializer !== e || !ts.isIdentifier(decl.name)
          || !(decl.parent.flags & ts.NodeFlags.Const)) return false
        let vu = false
        const visite = (n) => {
          if (vu) return
          if (ts.isIdentifier(n) && n !== decl.name && n.text === decl.name.text && constanteDe(n) === decl && ellipse(n, false)) vu = true
          else n.forEachChild(visite)
        }
        visite(racine)
        return vu
      }
      const visite = (n) => {
        if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && COUPES.has(n.expression.name.text)
          && n.arguments.length === 2 && ts.isNumericLiteral(n.arguments[0]) && n.arguments[0].text === '0') {
          const caracteres = tableauDeCaracteres(n.expression.expression)
          if (ellipse(n, caracteres) || ellipseeParSonNom(englobant(n, caracteres)))
            sites.push(`${fichier.rel}:${racine.getLineAndCharacterOfPosition(n.getStart(racine)).line + 1}`)
        }
        n.forEachChild(visite)
      }
      visite(racine)
    } catch (erreur) { erreurs.push(erreur) }
    finally { libererSessions([session], erreurs) }
  }
  return sites
}
