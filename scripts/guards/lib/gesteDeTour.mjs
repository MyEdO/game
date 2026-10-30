// Mécanique de scan de l'ARMEMENT UNIQUE d'un tour d'IA (#3058) : dans le module du tour d'IA, un geste différé
// (`programmer(…)`, `src/noyau/plateforme.ts`, ou `afterApproach(…)`, qui l'enveloppe, `src/noyau/combatDirector.ts`) ne
// se programme que dans les fonctions de la table que la garde déclare (`src/noyau/geste-de-tour-guard.test.ts`).
// L'appelé se reconnaît par sa LIAISON d'import (alias et espace de noms compris), par son nom nu, et par tout accès
// de propriété `.programmer` / `.afterApproach` (`plateforme().programmer(…)`) ; un différeur référencé hors position
// d'appel (`const d = programmer`) est refusé. Module ESM pur (node nu), parse par
// `dialecte.mjs`.
import { analyserTexte, typescript } from './dialecte.mjs';

/** Les exports qui DIFFÈRENT un geste, par module d'origine (suffixe du spécificateur d'import). */
const DIFFEREURS = Object.freeze({ plateforme: ['programmer'], combatDirector: ['afterApproach'] });
const NOMS = new Set(Object.values(DIFFEREURS).flat());

/** Les noms locaux liés à un différeur importé, et les espaces de noms des modules qui en exportent. */
function liaisons(ts, sourceFile) {
  const locaux = new Map();
  const espaces = new Set();
  for (const st of sourceFile.statements) {
    if (!ts.isImportDeclaration(st) || !ts.isStringLiteral(st.moduleSpecifier) || !st.importClause) continue;
    const module = st.moduleSpecifier.text.split('/').pop();
    const exports = DIFFEREURS[module];
    if (!exports) continue;
    const nb = st.importClause.namedBindings;
    if (nb && ts.isNamespaceImport(nb)) espaces.add(nb.name.text);
    if (nb && ts.isNamedImports(nb)) {
      for (const el of nb.elements) {
        const importe = (el.propertyName ?? el.name).text;
        if (exports.includes(importe)) locaux.set(el.name.text, importe);
      }
    }
  }
  return { locaux, espaces };
}

/** Le différeur qu'appelle `call` (`programmer` | `afterApproach`), sinon `null`. */
function differeur(ts, call, { locaux }) {
  const e = call.expression;
  if (ts.isIdentifier(e)) return locaux.get(e.text) ?? (NOMS.has(e.text) ? e.text : null);
  if (ts.isPropertyAccessExpression(e) && NOMS.has(e.name.text)) return e.name.text;
  return null;
}

/** La déclaration de fonction nommée la plus HAUTE qui contient `node` (une flèche imbriquée appartient à la
 *  fonction qui la porte), sinon `null`. */
function fonctionEnglobante(ts, node) {
  let nom = null;
  for (let n = node.parent; n; n = n.parent) if (ts.isFunctionDeclaration(n) && n.name) nom = n.name.text;
  return nom;
}

/** Le corps du geste différé (1er argument de `programmer`, dernier d'`afterApproach`) est-il EXACTEMENT l'appel de
 *  `nom` (`() => nom(…)` ou `() => { nom(…); }`) ? */
function corpsEstLAppel(ts, call, appele, nom) {
  const corps = appele === 'afterApproach' ? call.arguments[call.arguments.length - 1] : call.arguments[0];
  if (!corps || !(ts.isArrowFunction(corps) || ts.isFunctionExpression(corps))) return false;
  let expr = corps.body;
  if (ts.isBlock(expr)) {
    if (expr.statements.length !== 1 || !ts.isExpressionStatement(expr.statements[0])) return false;
    expr = expr.statements[0].expression;
  }
  return ts.isCallExpression(expr) && ts.isIdentifier(expr.expression) && expr.expression.text === nom;
}

/** Une RÉFÉRENCE à un différeur hors position d'appel (`const d = programmer`, `f(programmer)`) : son nom, sinon
 *  `null`. L'import qui le lie n'en est pas une. */
function referenceNue(ts, node, { locaux }) {
  const enAppel = (n) => ts.isCallExpression(n.parent) && n.parent.expression === n;
  if (ts.isPropertyAccessExpression(node) && NOMS.has(node.name.text)) return enAppel(node) ? null : node.name.text;
  if (!ts.isIdentifier(node)) return null;
  const nom = locaux.get(node.text) ?? (NOMS.has(node.text) ? node.text : null);
  if (!nom) return null;
  const p = node.parent;
  if (ts.isImportSpecifier(p) || ts.isImportClause(p) || ts.isNamespaceImport(p)) return null;
  if (ts.isPropertyAccessExpression(p) && p.name === node) return null;
  return enAppel(node) ? null : nom;
}

/**
 * Les gestes différés de `texte` hors de la table `sites` — un site admet tout différé, ou, s'il nomme `corpsAppelle`,
 * le seul différé dont le corps est exactement l'appel de cette fonction —, et toute référence nue à un différeur.
 * @param {string} rel @param {string} texte @param {ReadonlyMap<string, { corpsAppelle?: string }>} sites
 * @returns {{ line: number, fonction: string | null, appele: string }[]}
 */
export function programmerHorsDesSites(rel, texte, sites) {
  const ts = typescript();
  const { sourceFile } = analyserTexte({ rel, text: texte });
  const lie = liaisons(ts, sourceFile);
  const ligne = (n) => sourceFile.getLineAndCharacterOfPosition(n.getStart(sourceFile)).line + 1;
  const hors = [];
  const visiter = (node) => {
    const appele = ts.isCallExpression(node) ? differeur(ts, node, lie) : null;
    if (appele) {
      const fonction = fonctionEnglobante(ts, node);
      const site = fonction ? sites.get(fonction) : undefined;
      const admis = !!site && (!site.corpsAppelle || corpsEstLAppel(ts, node, appele, site.corpsAppelle));
      if (!admis) hors.push({ line: ligne(node), fonction, appele });
    }
    const nue = referenceNue(ts, node, lie);
    if (nue) hors.push({ line: ligne(node), fonction: fonctionEnglobante(ts, node), appele: `${nue} (référence)` });
    node.forEachChild(visiter);
  };
  visiter(sourceFile);
  return hors;
}
