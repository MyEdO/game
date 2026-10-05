/**
 * Retours directs de partyMoneyTotal dans un sélecteur inline de useGame ; imports renommés inclus.
 * Variables locales intermédiaires et sélecteurs prédéfinis restent hors de cette construction.
 * Les agrégats convertis en scalaire, comme Council avec toBrass, sont autorisés.
 */
import * as ts from 'typescript/unstable/ast';
import { estAppelDeclare } from './canonUnique.mjs';

const BOURSE = { 'src/state/bourseFlow.ts': ['partyMoneyTotal'] };
const STORE = { 'src/state/store.ts': ['useGame'] };

const sansParentheses = (n) => {
  while (n && ts.isParenthesizedExpression(n)) n = n.expression;
  return n;
};

export const SNAPSHOT_DE_BOURSE = {
  nom: 'snapshot-de-bourse-alloue',
  indice: (texte) => texte.includes('partyMoneyTotal'),
  reconnait(n, sf, contexte) {
    if (!ts.isCallExpression(n) || !estAppelDeclare(n, sf, STORE, contexte)) return null;
    const selector = sansParentheses(n.arguments[0]);
    if (!selector || (!ts.isArrowFunction(selector) && !ts.isFunctionExpression(selector))) return null;
    const estTotal = (expression) => {
      const appel = sansParentheses(expression);
      return appel && ts.isCallExpression(appel) && !!estAppelDeclare(appel, sf, BOURSE, contexte);
    };
    if (!ts.isBlock(selector.body)) return estTotal(selector.body) ? 'partyMoneyTotal rendu directement par useGame' : null;
    let alloue = false;
    const walk = (noeud) => {
      if (ts.isReturnStatement(noeud) && estTotal(noeud.expression)) alloue = true;
      if (ts.isFunctionLikeDeclaration(noeud)) return;
      noeud.forEachChild(walk);
    };
    walk(selector.body);
    return alloue ? 'partyMoneyTotal rendu directement par useGame' : null;
  },
};
