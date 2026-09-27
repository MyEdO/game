// Garde d'EXCLUSIVITÉ du stockage web (#1897) : `stockageWeb(genre)` (`src/lib/stockageWeb.ts`) est
// l'UNIQUE accès au `localStorage` et au `sessionStorage` du code de production sous `src/`. Mécanique
// ICI, joué par `src/stockage-web-exclusivity-guard.test.ts` — patron
// `rollSeamExclusivity.mjs` (scanner AST en lib, test qui le joue). Module ESM pur, exécutable par
// `node` nu. Même module : l'unicité des clés de stockage (`scanClesDeStockage`).
//
// Détection par AST (`typescript`, `ts.createSourceFile`) : un site est une RÉFÉRENCE, jamais une
// occurrence textuelle — un commentaire ou une chaîne qui nomme le `localStorage` n'est pas un accès.
import { typescript, scriptKindDe } from './dialecte.mjs';

/** Noms des deux stockages web, propriétés de l'objet global. @type {readonly string[]} */
export const STOCKAGES_WEB = ['localStorage', 'sessionStorage'];

/** PRÉ-FILTRE lexical : un fichier qui ne nomme aucun stockage n'est jamais parsé. @type {RegExp} */
export const STOCKAGE_WEB_RX = /\b(?:local|session)Storage\b/;

/** Dossier scanné, POSIX relatif à la racine du dépôt. */
export const SCAN_DIRS = ['src'];

/** Le propriétaire de l'accès : seul fichier où la référence est la définition même. */
export const PROPRIETAIRE = 'src/lib/stockageWeb.ts';

/**
 * Références à un stockage web dans le CODE : identifiant nu (`localStorage.getItem`), propriété
 * d'un objet (`window.sessionStorage`, `(globalThis as X).localStorage`), accès indexé par littéral
 * (`globalThis['localStorage']`). Hors accès : le NOM d'un membre déclaré (signature de type, clé
 * d'objet littéral) et toute position de TYPE.
 * @param {string} relPath @param {string} contenu
 * @returns {{ line: number, forme: string }[]}
 */
export function scanStockageWeb(relPath, contenu) {
  if (!STOCKAGE_WEB_RX.test(contenu)) return [];
  const ts = typescript();
  const sf = ts.createSourceFile(relPath, contenu, ts.ScriptTarget.Latest, true, scriptKindDe(relPath));
  const noms = new Set(STOCKAGES_WEB);
  const out = [];
  const ligne = (n) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
  const estNomDeMembre = (n) => {
    const p = n.parent;
    return (ts.isPropertySignature(p) || ts.isPropertyDeclaration(p) || ts.isPropertyAssignment(p)
      || ts.isMethodDeclaration(p) || ts.isMethodSignature(p)) && p.name === n;
  };
  const visite = (n) => {
    if (ts.isTypeNode(n) && !ts.isExpressionWithTypeArguments(n)) return;
    if (ts.isIdentifier(n) && noms.has(n.text) && !estNomDeMembre(n)) {
      out.push({ line: ligne(n), forme: ts.isPropertyAccessExpression(n.parent) && n.parent.name === n ? `.${n.text}` : n.text });
    }
    if (ts.isElementAccessExpression(n) && ts.isStringLiteralLike(n.argumentExpression) && noms.has(n.argumentExpression.text)) {
      out.push({ line: ligne(n), forme: `['${n.argumentExpression.text}']` });
    }
    ts.forEachChild(n, visite);
  };
  visite(sf);
  return out;
}

/** Forme d'une clé de stockage du jeu : préfixe `wfrp4.` (ou `wfrp.` des outils de recette). */
export const CLE_DE_STOCKAGE_RX = /^wfrp4?\.[\w.-]+$/;

/**
 * Clés de stockage écrites en LITTÉRAL (chaîne ou gabarit sans substitution) : une clé n'a qu'un
 * propriétaire, qui l'exporte ; un second littéral de la même clé est une copie qui divergera.
 * Hors vue : une clé composée par substitution (`` `wfrp4.save.${slot}` ``).
 * @param {string} relPath @param {string} contenu
 * @returns {{ line: number, cle: string }[]}
 */
export function scanClesDeStockage(relPath, contenu) {
  if (!/wfrp4?\./.test(contenu)) return [];
  const ts = typescript();
  const sf = ts.createSourceFile(relPath, contenu, ts.ScriptTarget.Latest, true, scriptKindDe(relPath));
  const out = [];
  const visite = (n) => {
    if ((ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) && CLE_DE_STOCKAGE_RX.test(n.text)) {
      out.push({ line: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1, cle: n.text });
    }
    ts.forEachChild(n, visite);
  };
  visite(sf);
  return out;
}
