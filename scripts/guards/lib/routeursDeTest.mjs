// ROUTEURS d'un nœud `test` de Flow, DÉRIVÉS du code (#1874 DoD 3) : le registre des jets
// (`scripts/docs/build-registre-jets.mjs`) les lit ici au lieu de les recopier.
//
// Un ROUTEUR est la déclaration de NIVEAU MODULE où un nœud `test` passe la main avec ses CONSÉQUENCES.
// Trois formes, lues dans le code de production :
//  - VISITEUR : le membre `test` d'un hôte d'`executerFlow` (`src/engine/flowCore.ts`, seul marcheur) remet
//    son nœud (premier paramètre) ENTIER à une fonction — la PORTE nommée est l'appelée ; un membre qui
//    LÈVE (`throw` à son premier niveau) est un routeur à porte `(lève)` : le fail-closed d'un hôte sans voie
//    de jet ;
//  - BRANCHES : un appel reçoit les DEUX branches d'un même nœud, `X.reussite` et `X.echec` (argument direct
//    ou valeur directe d'un littéral d'objet passé en argument) — la porte est l'appelée ;
//  - INLINE : une conditionnelle choisit `X.reussite` ou `X.echec` — la porte est `(inline)`, le jet est
//    tombé dans le routeur lui-même.
// Une branche que le checker résout hors du `Flow` de la marche n'est pas celle d'un nœud `test`.
// Un site est rendu `{ file, fn, porte }`, trié et dédoublonné.
//
// ANGLES MORTS assumés : une branche lue seule (`X.reussite` puis, ailleurs, `X.echec`) ; un nœud remis entier
// hors d'un visiteur d'`executerFlow` (sa porte ne se voit que si les branches y sont remises ensemble) ; une
// fonction passée en VALEUR comme membre `test` (`test: routeur`) ; un hôte lié par un autre nom qu'un import
// nommé ou un espace de noms de `src/engine/flowCore.ts`.
import { analyserCorpus, typescript } from './dialecte.mjs';
import { contexteImports, estAppelDeclare } from './canonUnique.mjs';
import { parUnitesDeCode } from './lister.mjs';

/** La marche d'exécution d'un Flow et son module, le FOYER des marcheurs (`src/marcheurs-de-flow-guard.test.ts`). */
const MARCHE = { foyer: 'src/engine/flowCore.ts', fonction: 'executerFlow' };
const APPEL_DE_LA_MARCHE = { [MARCHE.foyer]: [MARCHE.fonction] };
const BRANCHES = new Set(['reussite', 'echec']);

/** Nom de la déclaration de NIVEAU MODULE qui contient `node`. @returns {string} */
function declarationDeModule(ts, node, sf) {
  let n = node;
  while (n.parent && n.parent !== sf) n = n.parent;
  if (ts.isFunctionDeclaration(n) && n.name) return n.name.text;
  if (ts.isVariableStatement(n)) {
    const d = n.declarationList.declarations[0];
    if (d && ts.isIdentifier(d.name)) return d.name.text;
  }
  return '(module)';
}

/** Récepteur d'un accès de branche `X.reussite` / `X.echec`, en texte ; `null` sinon, et `null` quand le checker
 *  résout la propriété HORS du type `Flow` de la marche (les libellés `{ reussite, echec }` d'un verdict). */
function recepteurDeBranche(ts, e, sf, checker) {
  if (!ts.isPropertyAccessExpression(e) || !BRANCHES.has(e.name.text)) return null;
  const declarations = checker.getSymbolAtLocation(e.name)?.declarations ?? [];
  return declarations.some((d) => !d.resolve().getSourceFile().fileName.endsWith(`/${MARCHE.foyer}`)) ? null : e.expression.getText(sf);
}

/** Les valeurs remises portent-elles les DEUX branches d'un même récepteur ? */
function remetLesDeuxBranches(ts, valeurs, sf, checker) {
  const branchesPar = new Map();
  for (const v of valeurs) {
    const r = recepteurDeBranche(ts, v, sf, checker);
    if (r) branchesPar.set(r, new Set([...(branchesPar.get(r) ?? []), v.name.text]));
  }
  return [...branchesPar.values()].some((b) => b.size === BRANCHES.size);
}

/** Les arguments d'un appel, et les valeurs directes de ses arguments littéraux d'objet. */
function valeursRemises(ts, appel) {
  return appel.arguments.flatMap((a) => ts.isObjectLiteralExpression(a)
    ? a.properties.filter(ts.isPropertyAssignment).map((p) => p.initializer)
    : [a]);
}

/** Le membre `test` d'un littéral d'hôte : `(nœud, …) => …`, `function (nœud) {…}` ou méthode. */
function membreTest(ts, hote) {
  if (!hote || !ts.isObjectLiteralExpression(hote)) return null;
  for (const p of hote.properties) {
    if (!p.name || !ts.isIdentifier(p.name) || p.name.text !== 'test') continue;
    if (ts.isMethodDeclaration(p)) return p;
    if (ts.isPropertyAssignment(p) && (ts.isArrowFunction(p.initializer) || ts.isFunctionExpression(p.initializer))) return p.initializer;
  }
  return null;
}

/**
 * Les sites de ROUTAGE d'un nœud `test` dans un corpus de production.
 * @param {{ rel: string, text: string }[]} files
 * @returns {{ file: string, fn: string, porte: string }[]}
 */
export function scanRouteursDeTest(files) {
  const ts = typescript();
  const vus = new Map();
  const pose = (file, fn, porte) => vus.set(`${file}\0${fn}\0${porte}`, { file, fn, porte });
  for (const { fichier: { rel }, sourceFile: sf, checker } of analyserCorpus(files)) {
    if (!sf) continue;
    const contexte = contexteImports(sf, checker);
    const visit = (node) => {
      if (ts.isCallExpression(node)) {
        if (remetLesDeuxBranches(ts, valeursRemises(ts, node), sf, checker)) pose(rel, declarationDeModule(ts, node, sf), node.expression.getText(sf));
        const test = estAppelDeclare(node, sf, APPEL_DE_LA_MARCHE, contexte) ? membreTest(ts, node.arguments[1]) : null;
        if (test?.body) {
          const fn = declarationDeModule(ts, node, sf);
          if (ts.isBlock(test.body) && test.body.statements.some((s) => ts.isThrowStatement(s))) pose(rel, fn, '(lève)');
          const param = test.parameters[0]?.name;
          const remis = (n) => {
            if (ts.isCallExpression(n) && n.arguments.some((a) => ts.isIdentifier(a) && a.text === param.text)) pose(rel, fn, n.expression.getText(sf));
            n.forEachChild(remis);
          };
          if (param && ts.isIdentifier(param)) remis(test.body);
        }
      }
      if (ts.isConditionalExpression(node)) {
        const [a, b] = [recepteurDeBranche(ts, node.whenTrue, sf, checker), recepteurDeBranche(ts, node.whenFalse, sf, checker)];
        if (a && a === b && node.whenTrue.name.text !== node.whenFalse.name.text) pose(rel, declarationDeModule(ts, node, sf), '(inline)');
      }
      node.forEachChild(visit);
    };
    visit(sf);
  }
  return [...vus.values()].sort((x, y) => parUnitesDeCode(x.file, y.file) || parUnitesDeCode(x.fn, y.fn) || parUnitesDeCode(x.porte, y.porte));
}
