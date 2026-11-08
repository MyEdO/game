// GARDE « la Difficulté par défaut a UN nom » (#1874) : le défaut d'une Difficulté absente s'écrit
// `DIFFICULTE_PAR_DEFAUT` (`src/engine/types.ts`). Le littéral `'intermediaire'` posé en DÉFAUT en est une
// recopie : opérande droit d'un `??`, `||`, `??=` ou `||=`, initialiseur d'un paramètre ou d'un élément de
// déstructuration. Une Difficulté FIXÉE (`const d: Difficulty = 'intermediaire'`, propriété d'un littéral)
// n'est pas un défaut. Banc et balayage : `src/difficulte-par-defaut-guard.test.ts`.
// LIMITE : garde SYNTAXIQUE — un défaut lu d'un nom local (`const d = 'intermediaire'; x ?? d`) lui échappe.

import * as ts from 'typescript/unstable/ast';

const VALEUR = 'intermediaire';
const OPERATEURS_DE_DEFAUT = new Set([
  ts.SyntaxKind.QuestionQuestionToken,
  ts.SyntaxKind.BarBarToken,
  ts.SyntaxKind.QuestionQuestionEqualsToken,
  ts.SyntaxKind.BarBarEqualsToken,
]);

/** L'expression sans parenthèses ni assertion de type. @param {ts.Node | undefined} n */
function nue(n) {
  while (n && (ts.isParenthesizedExpression(n) || ts.isAssertionExpression(n) || ts.isSatisfiesExpression(n))) n = n.expression;
  return n;
}

/** @param {ts.Node | undefined} n @returns {boolean} */
const estLaValeur = (n) => {
  const e = nue(n);
  return !!e && (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) && e.text === VALEUR;
};

/** @type {import('./canonUnique.mjs').ConstructionGardee} */
export const DEFAUT_DE_DIFFICULTE = Object.freeze({
  nom: 'DEFAUT_DE_DIFFICULTE',
  indice: (texte) => texte.includes(VALEUR),
  /** @param {ts.Node} n @returns {string | null} */
  reconnait(n) {
    if (ts.isBinaryExpression(n) && OPERATEURS_DE_DEFAUT.has(n.operatorToken.kind) && estLaValeur(n.right))
      return `\`${ts.tokenToString(n.operatorToken.kind)} '${VALEUR}'\` : le défaut s'écrit \`DIFFICULTE_PAR_DEFAUT\` (src/engine/types.ts)`;
    if ((ts.isParameterDeclaration(n) || ts.isBindingElement(n)) && estLaValeur(n.initializer))
      return `\`= '${VALEUR}'\` en défaut : le défaut s'écrit \`DIFFICULTE_PAR_DEFAUT\` (src/engine/types.ts)`;
    return null;
  },
});
