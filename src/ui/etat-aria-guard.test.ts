/**
 * GARDE — un ÉTAT (ouvert, pressé, sélectionné, courant, coché, désactivé) se lit sur son attribut ARIA,
 * jamais sur une classe qui le DOUBLE : la condition d'une classe égale à l'expression d'un
 * `aria-(expanded|pressed|selected|current|checked|disabled)` du même élément ou d'un DESCENDANT de son
 * sous-arbre JSX. La règle CSS vise l'attribut (`[aria-…]`, `:has([aria-…])`, qui vaut à toute profondeur). Grammaire des
 * états ferrés : `base.css` ; garde voisine `choix-retenu-guard.test.ts` (verdict du juge B15b, D4, #1920).
 *
 * FORME : structurelle (parseur TypeScript), sur le corpus de `readCorpus(['src/ui'])` (`.tsx`). Une
 * condition se compare NORMALISÉE : parenthèses, double négation et `Boolean(…)` ôtés, blancs retirés.
 * Sous-arbre : tout élément JSX atteint depuis les enfants, à toute profondeur (une expression
 * `{c && <b/>}` ou un `.map` sont transparents).
 *
 * STOCK : sites présents, keyés `fichier | attribut | classe` ; il ne fait que décroître.
 */
import { describe, it, expect } from 'vitest';
import ts from 'typescript';
import { readCorpus } from '../../scripts/guards/lib/sourceCorpus.mjs';

const ETATS_ARIA = new Set(['aria-expanded', 'aria-pressed', 'aria-selected', 'aria-current', 'aria-checked', 'aria-disabled']);

/** Condition normalisée : parenthèses, `!!x` et `Boolean(x)` ôtés, blancs retirés. */
function normaliser(n: ts.Expression, sf: ts.SourceFile): string {
  for (;;) {
    if (ts.isParenthesizedExpression(n)) { n = n.expression; continue; }
    if (ts.isPrefixUnaryExpression(n) && n.operator === ts.SyntaxKind.ExclamationToken
      && ts.isPrefixUnaryExpression(n.operand) && n.operand.operator === ts.SyntaxKind.ExclamationToken) { n = n.operand.operand; continue; }
    if (ts.isCallExpression(n) && n.expression.getText(sf) === 'Boolean' && n.arguments.length === 1) { n = n.arguments[0]; continue; }
    return n.getText(sf).replace(/\s+/g, '');
  }
}

/** Jetons de classe écrits en LITTÉRAL dans un sous-arbre (chaîne, gabarit). */
function jetons(n: ts.Node): Set<string> {
  const out = new Set<string>();
  const walk = (c: ts.Node): void => {
    if (ts.isStringLiteral(c) || ts.isNoSubstitutionTemplateLiteral(c) || ts.isTemplateHead(c) || ts.isTemplateMiddle(c) || ts.isTemplateTail(c)) {
      for (const j of c.text.split(/\s+/)) if (j) out.add(j);
    }
    ts.forEachChild(c, walk);
  };
  walk(n);
  return out;
}

/** Classe conditionnée : ce qu'une branche écrit et que l'autre n'écrit pas. */
const difference = (a: Set<string>, b: Set<string>) => [...a].filter((j) => !b.has(j)).concat([...b].filter((j) => !a.has(j))).join(' ');

type Element = ts.JsxElement | ts.JsxSelfClosingElement;
const attributsDe = (el: Element): ts.JsxAttributes => (ts.isJsxElement(el) ? el.openingElement.attributes : el.attributes);

/** Éléments JSX du SOUS-ARBRE de `el`, à toute profondeur. */
function descendants(el: Element): Element[] {
  if (!ts.isJsxElement(el)) return [];
  const out: Element[] = [];
  const walk = (n: ts.Node): void => {
    if (ts.isJsxSelfClosingElement(n)) { out.push(n); return; }
    if (ts.isJsxElement(n)) { out.push(n); n.children.forEach(walk); return; }
    if (ts.isJsxFragment(n)) { n.children.forEach(walk); return; }
    ts.forEachChild(n, walk);
  };
  el.children.forEach(walk);
  return out;
}

/** États ARIA posés par un élément : expression normalisée → attribut. */
function etatsDe(el: Element, sf: ts.SourceFile): Map<string, string> {
  const out = new Map<string, string>();
  for (const p of attributsDe(el).properties) {
    if (ts.isJsxAttribute(p) && ETATS_ARIA.has(p.name.getText(sf)) && p.initializer && ts.isJsxExpression(p.initializer) && p.initializer.expression) {
      out.set(normaliser(p.initializer.expression, sf), p.name.getText(sf));
    }
  }
  return out;
}

/** Classes conditionnées d'un `className` : `c ? a : b`, `c && a`. */
function classesConditionnees(init: ts.Expression, sf: ts.SourceFile): { condition: string; classe: string }[] {
  const out: { condition: string; classe: string }[] = [];
  const walk = (c: ts.Node): void => {
    if (ts.isConditionalExpression(c)) out.push({ condition: normaliser(c.condition, sf), classe: difference(jetons(c.whenTrue), jetons(c.whenFalse)) });
    if (ts.isBinaryExpression(c) && c.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) out.push({ condition: normaliser(c.left, sf), classe: [...jetons(c.right)].join(' ') });
    ts.forEachChild(c, walk);
  };
  walk(init);
  return out;
}

/** Classes qui doublent un état ARIA, keyées `fichier | attribut | classe`. */
export function classesQuiDoublentAria(src: string, file: string): string[] {
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const out: string[] = [];
  const walk = (n: ts.Node): void => {
    if (ts.isJsxElement(n) || ts.isJsxSelfClosingElement(n)) {
      const cls = attributsDe(n).properties.find((p): p is ts.JsxAttribute => ts.isJsxAttribute(p) && p.name.getText(sf) === 'className');
      if (cls?.initializer && ts.isJsxExpression(cls.initializer) && cls.initializer.expression) {
        const etats = [n, ...descendants(n)].map((e) => etatsDe(e, sf));
        for (const { condition, classe } of classesConditionnees(cls.initializer.expression, sf)) {
          const attribut = etats.find((m) => m.has(condition))?.get(condition);
          if (attribut) out.push(`${file} | ${attribut} | ${classe}`);
        }
      }
    }
    ts.forEachChild(n, walk);
  };
  walk(sf);
  return out;
}

const compter = (cles: string[]) => cles.reduce<Record<string, number>>((m, k) => ({ ...m, [k]: (m[k] ?? 0) + 1 }), {});

/** Stock des sites présents (cure : lot S0 #1806). */
const STOCK: Record<string, number> = {
  'src/ui/CareerPath.tsx | aria-checked | sel': 1,
  'src/ui/CityHubScreen.tsx | aria-selected | active': 1,
  'src/ui/PartyDock.tsx | aria-expanded | on': 1,
  'src/ui/Tabs.tsx | aria-selected | active': 1,
  'src/ui/creator/CelestialWheel.tsx | aria-checked | sel': 1,
  'src/ui/creator/CharacterCreator.tsx | aria-checked | sel': 1,
  'src/ui/creator/CharacterCreator.tsx | aria-checked | selected': 2,
  'src/ui/editor/Palette.tsx | aria-pressed | active': 1,
  'src/ui/editor/TraceLayerPanel.tsx | aria-expanded | trace-layer-panel-collapsed': 1,
  'src/ui/editor/WorldMapPlacePanel.tsx | aria-pressed | active': 1,
};

describe('état ARIA — jamais doublé par une classe', () => {
  it('le détecteur mord sur le même élément et sur tout son sous-arbre, et se tait hors de lui', () => {
    const fautif = [
      'const a = <button className={`btn${open ? \' open\' : \'\'}`} aria-expanded={open} />;',
      'const b = <div className={`x${(open) ? \' on\' : \'\'}`}><button aria-expanded={!!open} /></div>;',
      'const c = <div className={`x ${sel && \'sel\'}`}>{ok && <span role="radio" aria-checked={Boolean(sel)} />}</div>;',
      'const d = <li className={k === v ? \'item sel\' : \'item\'} aria-selected={k === v} />;',
      'const e = <div className={`x${open ? \' on\' : \'\'}`}><p>{ok && <span><button aria-pressed={open} /></span>}</p></div>;',
    ].join('\n');
    expect(classesQuiDoublentAria(fautif, 'f.tsx')).toEqual([
      'f.tsx | aria-expanded | open', 'f.tsx | aria-expanded | on', 'f.tsx | aria-checked | sel', 'f.tsx | aria-selected | sel',
      'f.tsx | aria-pressed | on',
    ]);
    const sain = [
      'const a = <button className="btn" aria-expanded={open} />;',
      'const b = <div className={`x${busy ? \' on\' : \'\'}`}><button aria-expanded={open} /></div>;',
      'const c = <><div className={`x${open ? \' on\' : \'\'}`} /><button aria-expanded={open} /></>;',
      'const d = <div className="x"><p className={open ? \'on\' : \'\'} /><button aria-expanded={open} /></div>;',
    ].join('\n');
    expect(classesQuiDoublentAria(sain, 'f.tsx')).toEqual([]);
  });

  it('`src/ui` : les classes qui doublent un état ARIA ne sont que celles du stock', () => {
    const sites = readCorpus(['src/ui']).filter((f) => f.rel.endsWith('.tsx')).flatMap((f) => classesQuiDoublentAria(f.text, f.rel));
    expect(compter(sites)).toEqual(STOCK);
  });
});
