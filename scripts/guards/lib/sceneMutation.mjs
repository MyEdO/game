import { ast } from './dialecte.mjs';
// Mécanique de scan du garde-fou « immutabilité de la scène du store » — toute l'architecture
// dérivée de la scène (`src/state/vision.ts`, `src/state/sceneMemo.ts` `memoByRef`) repose sur
// l'invariant : un chemin qui tient un porteur de la `Scene` du store (identifiant `scene`, alias,
// paramètre typé `Scene`, ou accès `.scene` sur un conteneur — `get().scene`, `s.scene`…) ne
// réassigne JAMAIS l'un de ses champs/tableaux EN PLACE — toute mise à jour produit une NOUVELLE
// scène par spread (`set({ scene: { ...scene, champ: nouvelleValeur } })`). Module ESM pur, AST
// réelle (compilateur TypeScript, pas un grep textuel) — consommé par
// `src/state/scene-mutation-guard.test.ts`.
import * as tsModule from 'typescript/unstable/ast';

// Liaison LOCALE de l'API du compilateur — FAIT mesuré 2026-08-23 : sous Vitest, ce module est
// transformé par vite-node et chaque `ts.x` d'un visiteur AST se relit alors sur l'objet d'import du
// runner. Le scan de `src/**` coûte 1,35 s en `node` nu ; `scene-mutation-guard.test.ts` passe de
// 7,46 s à 3,60 s à la seule liaison ci-dessous, tout le reste égal.
const ts = tsModule;

/** Méthodes de tableau qui mutent leur récepteur EN PLACE. */
export const MUTATING_ARRAY_METHODS = new Set([
  'push', 'pop', 'shift', 'unshift', 'splice', 'sort', 'reverse', 'fill', 'copyWithin',
]);

/** Déroule les enrobages transparents (parenthèses, `!`, `as …`). @returns {import('typescript/unstable/ast').Expression} */
function unwrap(expr) {
  let e = expr;
  for (;;) {
    if (ts.isParenthesizedExpression(e) || ts.isNonNullExpression(e)) { e = e.expression; continue; }
    if (ts.isAsExpression(e) || ts.isSatisfiesExpression?.(e)) { e = e.expression; continue; }
    break;
  }
  return e;
}

/** `NAME` littéral `scene`, ou un alias tracé (variable/paramètre) dans la pile de portées. */
function isSceneRootName(name, scopeStack) {
  if (name === 'scene') return true;
  for (let i = scopeStack.length - 1; i >= 0; i--) if (scopeStack[i].has(name)) return true;
  return false;
}

/**
 * Une expression EST un porteur de scène si, en descendant sa chaîne d'accès (`a.b[c].d`), on
 * croise soit (1) un accès `.scene` PORTÉ PAR N'IMPORTE QUOI — `get().scene`, `state.scene`,
 * `store.getState().scene` — l'ancre est le nom `scene`, jamais le receveur, donc `get()`/`this`/un
 * paramètre non typé n'ont pas besoin d'être eux-mêmes tracés ; soit (2) une racine identifiant qui
 * EST `scene`, ou un ALIAS tracé (déclaration `const s = scene`/`const { entities } = scene`,
 * paramètre annoté `: Scene`). @param {import('typescript/unstable/ast').Expression} expr @returns {boolean}
 */
function isSceneRooted(expr, scopeStack) {
  let e = unwrap(expr);
  for (;;) {
    if (ts.isPropertyAccessExpression(e)) {
      if (e.name.text === 'scene') return true;
      e = unwrap(e.expression);
      continue;
    }
    if (ts.isElementAccessExpression(e)) { e = unwrap(e.expression); continue; }
    break;
  }
  return ts.isIdentifier(e) && isSceneRootName(e.text, scopeStack);
}

/** Le type annoté d'un paramètre désigne-t-il `Scene` (directement ou dans une union) ?
 * @param {import('typescript/unstable/ast').TypeNode | undefined} t @returns {boolean} */
function typeMentionsScene(t) {
  if (!t) return false;
  if (ts.isTypeReferenceNode(t)) return ts.isIdentifier(t.typeName) && t.typeName.text === 'Scene';
  if (ts.isUnionTypeNode(t) || ts.isIntersectionTypeNode(t)) return t.types.some(typeMentionsScene);
  if (ts.isParenthesizedTypeNode(t)) return typeMentionsScene(t.type);
  return false;
}

function isFunctionLike(node) {
  return (
    ts.isFunctionDeclaration(node) ||
    ts.isFunctionExpression(node) ||
    ts.isArrowFunction(node) ||
    ts.isMethodDeclaration(node) ||
    ts.isConstructorDeclaration(node) ||
    ts.isGetAccessorDeclaration(node) ||
    ts.isSetAccessorDeclaration(node)
  );
}

/**
 * Scan AST d'un fichier source : chaque mutation EN PLACE d'un porteur de `Scene` tracé —
 * affectation `<porteur>.<chemin> = …`/`<porteur>.<chemin>[i] = …`, appel d'une méthode de tableau
 * mutante (`.push(...)`, `.splice(...)`, `.sort(...)`…), `Object.assign(<porteur>, …)`, ou
 * `delete <porteur>.<chemin>`.
 *
 * Portée traquée (alias/paramètres) : simplification VOLONTAIRE — les déclarations `const`/`let`
 * sont enregistrées dans la portée de la FONCTION englobante (pas bloc-scopées finement), et un
 * paramètre typé `Scene` reste tracé pour tout le corps de sa fonction. Sur ce dépôt (déclare-avant-
 * usage systématique, pas de shadowing de nom entre blocs frères d'une même fonction) ceci ne
 * produit ni faux négatif ni faux positif observé — un shadowing pathologique resterait un angle
 * mort théorique, pas un trou vécu.
 *
 * NON COUVERT, assumé : passer un porteur de scène à un helper opaque (`mute(get().scene)`) — sans
 * analyse interprocédurale (savoir ce que fait `mute` en son sein), aucun scanner AST mono-fichier
 * ne peut trancher si l'appel mute ou lit seulement. Un futur appelant de cette forme doit rester
 * repéré par revue humaine, pas par ce scanner.
 *
 * @param {string} relPath @param {string} contenu
 * @returns {{ line: number, detail: string }[]}
 */
export function scanSceneMutation(relPath, contenu, sourceFile) {
  const findings = [];
  const sf = sourceFile ?? ast({ rel: relPath, text: contenu });
  const lineOf = (pos) => sf.getLineAndCharacterOfPosition(pos).line + 1;
  const report = (node) => {
    const text = node.getText(sf).split('\n')[0].trim();
    findings.push({ line: lineOf(node.getStart(sf)), detail: text });
  };

  const registerVariableDeclaration = (node, scope, scopeStack) => {
    if (!node.initializer) return;
    if (ts.isIdentifier(node.name)) {
      if (isSceneRooted(node.initializer, scopeStack)) scope.add(node.name.text);
      return;
    }
    if (ts.isObjectBindingPattern(node.name) && isSceneRooted(node.initializer, scopeStack)) {
      for (const el of node.name.elements) {
        if (ts.isIdentifier(el.name)) scope.add(el.name.text);
      }
    }
  };

  const visit = (node, scopeStack) => {
    if (isFunctionLike(node)) {
      const scope = new Set();
      for (const p of node.parameters ?? []) {
        if (('name' in p && ts.isIdentifier(p.name)) && typeMentionsScene(p.type)) scope.add(p.name.text);
      }
      const nextStack = [...scopeStack, scope];
      node.forEachChild((child) => visit(child, nextStack));
      return;
    }

    if (ts.isVariableDeclaration(node)) {
      registerVariableDeclaration(node, scopeStack[scopeStack.length - 1], scopeStack);
    } else if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
      const left = node.left;
      if (
        (ts.isPropertyAccessExpression(left) || ts.isElementAccessExpression(left)) &&
        isSceneRooted(left, scopeStack)
      ) report(node);
    } else if (ts.isDeleteExpression(node)) {
      const target = node.expression;
      if (
        (ts.isPropertyAccessExpression(target) || ts.isElementAccessExpression(target)) &&
        isSceneRooted(target, scopeStack)
      ) report(node);
    } else if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const method = node.expression.name.text;
      const receiver = node.expression.expression;
      if (MUTATING_ARRAY_METHODS.has(method) && isSceneRooted(receiver, scopeStack)) {
        report(node);
      } else if (
        method === 'assign' &&
        ts.isIdentifier(receiver) &&
        receiver.text === 'Object' &&
        node.arguments[0] &&
        isSceneRooted(node.arguments[0], scopeStack)
      ) report(node);
    }

    node.forEachChild((child) => visit(child, scopeStack));
  };
  visit(sf, [new Set()]);
  return findings;
}
