import { ast } from './dialecte.mjs';
// Mécanique de scan du garde-fou « écriture du z sur `sceneEdit.ts` » (#835 FU-1/FU-3) — la racine
// mesurée du ticket est qu'une primitive d'écriture (`addTrigger`, `addRestZone`, `addEffectZone`,
// `addEnemyMember`, `pasteEntity`…) peut pousser un élément FRAIS dans une collection dont le
// modèle porte un `z` (`Trigger.rect.z`, `restZones[].rect.z`, `SceneEffectZone.z`,
// `SceneEntity.z`) SANS jamais recevoir de paramètre `z` — l'omission est alors silencieuse : rien
// ne casse à la compilation, l'élément est posé au sol (0) sans que l'auteur puisse choisir sa
// couche. Ce scanner détecte, par AST réelle (compilateur TypeScript), toute fonction EXPORTÉE de
// `sceneEdit.ts` qui pousse dans une collection z-portante sans déclarer de paramètre nommé `z`.
// Module ESM pur — consommé par `src/state/scene-edit-z-write-guard.test.ts`.
import * as ts from 'typescript/unstable/ast';

/** Collections dont l'ÉLÉMENT porte un `z` au modèle (`scene.ts`) — `roofs` (FU-2) et `architecture`
 *  (masses/façades, déjà z-obligatoires en signature) restent HORS de ce périmètre : ce garde ne
 *  couvre que les 4 surcouches d'annotation/entité concernées par #835 FU-1/FU-3. */
export const Z_BEARING_PROPS = new Set(['entities', 'triggers', 'restZones', 'effectZones']);

/** Déroule les enrobages transparents (parenthèses, `!`, `as …`) et le membre GAUCHE d'un `??`/`||`
 *  (`scene.effectZones ?? []` → `scene.effectZones`). @returns {import('typescript/unstable/ast').Expression} */
function unwrapToRoot(expr) {
  let e = expr;
  for (;;) {
    if (ts.isParenthesizedExpression(e) || ts.isNonNullExpression(e)) { e = e.expression; continue; }
    if (ts.isAsExpression(e)) { e = e.expression; continue; }
    if (
      ts.isBinaryExpression(e) &&
      (e.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken || e.operatorToken.kind === ts.SyntaxKind.BarBarToken)
    ) { e = e.left; continue; }
    break;
  }
  return e;
}

/** `expr` est-elle (après déroulage) un accès `scene.<prop>` z-portant ? @returns {string | null} */
function sceneZBearingProp(expr) {
  const e = unwrapToRoot(expr);
  if (ts.isPropertyAccessExpression(e) && ts.isIdentifier(e.expression) && e.expression.text === 'scene' && Z_BEARING_PROPS.has(e.name.text)) {
    return e.name.text;
  }
  return null;
}

function hasZParam(fnNode) {
  return (fnNode.parameters ?? []).some((p) => ('name' in p && ts.isIdentifier(p.name)) && p.name.text === 'z');
}

/** Une fonction pousse-t-elle un élément FRAIS dans une collection z-portante ? Détecté par un
 *  ARRAY LITERAL contenant un `SpreadElement` ciblant `scene.<collection z-portante>` ET au moins
 *  un élément supplémentaire (l'ajout) — motif partagé par toutes les primitives `addX`/`pasteX`.
 *  @returns {string | null} le nom de la collection touchée, ou null. */
function findZBearingPush(fnNode) {
  let hit = null;
  const visit = (node) => {
    if (hit) return;
    if (ts.isArrayLiteralExpression(node) && node.elements.length > 1) {
      for (const el of node.elements) {
        if (ts.isSpreadElement(el)) {
          const prop = sceneZBearingProp(el.expression);
          if (prop) { hit = prop; return; }
        }
      }
    }
    node.forEachChild(visit);
  };
  visit(fnNode.body ?? fnNode);
  return hit;
}

function isExported(node) {
  return (node.modifiers ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
}

/**
 * Scan AST de `sceneEdit.ts` : chaque fonction EXPORTÉE de niveau supérieur qui pousse un élément
 * frais dans `entities`/`triggers`/`restZones`/`effectZones` sans paramètre `z` déclaré.
 * @param {string} contenu
 * @returns {{ name: string, line: number, prop: string }[]}
 */
export function scanSceneEditZWrites(contenu) {
  const findings = [];
  const sf = ast({ rel: 'sceneEdit.ts', text: contenu });
  const lineOf = (pos) => sf.getLineAndCharacterOfPosition(pos).line + 1;

  for (const stmt of sf.statements) {
    if (!ts.isFunctionDeclaration(stmt) || !stmt.name || !isExported(stmt)) continue;
    const prop = findZBearingPush(stmt);
    if (prop && !hasZParam(stmt)) {
      findings.push({ name: stmt.name.text, line: lineOf(stmt.getStart(sf)), prop });
    }
  }
  return findings;
}
