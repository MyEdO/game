// COUPE AU CARACTÈRE (#1806, R-M2 de `docs/plans/2026-08-16-spec-hud-combat.md`) — un texte coupé
// à un nombre de caractères puis suivi d'une ellipse tranche un mot. La seule coupe d'un texte
// ellipsé est `coupeAuMot` (`src/lib/coupeAuMot.ts`). Consommateur : `src/coupe-au-caractere-guard.test.ts`.
// Module ESM pur.

import { ast, typescript } from './dialecte.mjs'

/** Méthodes qui prennent un préfixe au caractère. */
const COUPES = new Set(['slice', 'substring', 'substr'])
/** Méthodes qui gardent le préfixe pour texte : `x.slice(0, n).trimEnd()` reste une coupe. */
const BLANCS = new Set(['trim', 'trimEnd', 'trimRight'])
/** L'ellipse, typographique ou en trois points. */
const ELLIPSE = /…|\.\.\./

/**
 * Sites d'un préfixe `x.slice|substring|substr(0, n)` dont l'expression de texte qui l'emporte
 * (gabarit, concaténation, ternaire, parenthèses, `trim`) porte une ellipse littérale.
 * @param {readonly { rel: string, text: string }[]} fichiers
 * @returns {string[]} `chemin:ligne`
 */
export function coupesAuCaractere(fichiers) {
  const ts = typescript()
  const sites = []
  for (const fichier of fichiers) {
    const racine = ast(fichier)
    if (!racine) continue
    const porteEllipse = (noeud) => {
      let vu = false
      const visite = (n) => {
        if (vu) return
        if ((ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) || ts.isTemplateHead(n)
          || ts.isTemplateMiddle(n) || ts.isTemplateTail(n)) && ELLIPSE.test(n.text)) vu = true
        else ts.forEachChild(n, visite)
      }
      visite(noeud)
      return vu
    }
    const englobant = (appel) => {
      let n = appel
      for (;;) {
        const p = n.parent
        if (!p) return n
        if (ts.isPropertyAccessExpression(p) && p.expression === n && BLANCS.has(p.name.text) && ts.isCallExpression(p.parent)) { n = p.parent; continue }
        if (ts.isTemplateSpan(p)) { n = p.parent; continue }
        if (ts.isParenthesizedExpression(p) || ts.isConditionalExpression(p)
          || (ts.isBinaryExpression(p) && p.operatorToken.kind === ts.SyntaxKind.PlusToken)) { n = p; continue }
        return n
      }
    }
    const visite = (n) => {
      if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && COUPES.has(n.expression.name.text)
        && n.arguments.length === 2 && ts.isNumericLiteral(n.arguments[0]) && n.arguments[0].text === '0'
        && porteEllipse(englobant(n)))
        sites.push(`${fichier.rel}:${racine.getLineAndCharacterOfPosition(n.getStart(racine)).line + 1}`)
      ts.forEachChild(n, visite)
    }
    visite(racine)
  }
  return sites
}
