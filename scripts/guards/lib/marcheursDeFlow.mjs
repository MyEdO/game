// Mécanique de scan du CLIQUET des marcheurs de Flow sous `src/state` (#1874, ticket § Lot B : posé
// avec C0 à 4, cible 1). Le verdict et le PLAFOND vivent dans le test (`src/marcheurs-de-flow-guard.test.ts`).
//
// EMPREINTE d'un MARCHEUR : un `switch (<x>.kind)` dont la clause `case 'seq'` DESCEND la séquence
// (pile ou récursion) au lieu de RENDRE un verdict. Un marcheur exécute ses nœuds ; un prédicat
// (`flowHasChoiceSeulement`, `state/triggeredEffects.ts`) les lit et rend — sa clause `seq` commence par
// `return`. Le site rendu est la déclaration de NIVEAU MODULE qui porte le `switch` : `runPureFlowLines`
// marche par une fermeture `walk` interne, c'est lui le marcheur.
//
// ANGLES MORTS assumés (faux négatifs préférés au bruit — doctrine des gardes du dépôt) :
//  - un marcheur qui descend la séquence par `if (f.kind === 'seq')`, sans `switch` ;
//  - une clause `case 'seq'` dont le PREMIER énoncé est un `return` qui marche quand même
//    (`return f.steps.forEach(…)`) ;
//  - un `switch` porté par une méthode de classe ou un littéral d'objet hors déclaration de module.
import tsModule from 'typescript';
import { parUnitesDeCode } from './lister.mjs';

const ts = tsModule;

/** La clause `case 'seq'` DESCEND-elle la séquence (premier énoncé ≠ `return`) ? @returns {boolean} */
function clauseSeqDescend(clause) {
  if (!ts.isCaseClause(clause) || !ts.isStringLiteral(clause.expression) || clause.expression.text !== 'seq') return false;
  let premier = clause.statements[0];
  while (premier && ts.isBlock(premier)) premier = premier.statements[0];
  return !!premier && !ts.isReturnStatement(premier);
}

/** Nom de la déclaration de NIVEAU MODULE qui contient `node`. @returns {string} */
function declarationDeModule(node, sf) {
  let n = node;
  while (n.parent && n.parent !== sf) n = n.parent;
  if (ts.isFunctionDeclaration(n) && n.name) return n.name.text;
  if (ts.isVariableStatement(n)) {
    const d = n.declarationList.declarations[0];
    if (d && ts.isIdentifier(d.name)) return d.name.text;
  }
  return '(module)';
}

/**
 * Les MARCHEURS de Flow d'un corpus : un site par déclaration de module qui porte au moins un
 * `switch (<x>.kind)` à clause `seq` descendante. Rendu TRIÉ (fichier, nom).
 * @param {{ rel: string, text: string }[]} files corpus `src/state/**` (hors tests)
 * @returns {{ file: string, line: number, fn: string }[]}
 */
export function scanMarcheursDeFlow(files) {
  const out = [];
  for (const { rel, text } of files) {
    const sf = ts.createSourceFile(rel, text, ts.ScriptTarget.Latest, true);
    const vus = new Set();
    const visit = (node) => {
      if (ts.isSwitchStatement(node) && ts.isPropertyAccessExpression(node.expression)
        && node.expression.name.text === 'kind' && node.caseBlock.clauses.some(clauseSeqDescend)) {
        const fn = declarationDeModule(node, sf);
        if (!vus.has(fn)) {
          vus.add(fn);
          out.push({ file: rel, line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1, fn });
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }
  out.sort((a, b) => parUnitesDeCode(a.file, b.file) || parUnitesDeCode(a.fn, b.fn));
  return out;
}

/** Forme NOMINATIVE d'un marcheur : `fichier [fn]` — sans ligne, qui bouge à chaque édition voisine.
 *  @param {{ file: string, fn: string }} s @returns {string} */
export function marcheurLabel(s) {
  return `${s.file} [${s.fn}]`;
}
