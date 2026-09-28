/**
 * GARDE — un ÉTAT de bouton (choix retenu, divulgation ouverte) se marque par son attribut, jamais par
 * le ton primaire. Grammaire des états ferrés : `base.css` (`.btn[aria-pressed='true']`,
 * `.btn[aria-haspopup][aria-expanded='true']`), chevron de divulgation : `components.css` ; lecteur :
 * `focusTarget` (`Modal.tsx`), qui prend un `.btn-primary`
 * pour l'option OFFERTE — un choix posé peint en primaire y vole le focus initial (verdict du juge
 * B11, D1, #1920).
 *
 * FORME : structurelle (parseur TypeScript), patron de `console-no-title-only.test.ts`, sur le corpus
 * de `readCorpus(['src/ui'])` (tous les `.tsx`/`.ts` hors tests). Trois formes rougissent :
 *   - l'attribut JSX `className` dont un conditionnel écrit `btn-primary` sous une AUTRE condition
 *     que le ton transmis (`primary`, `x.primary`) — booléen ou égalité, l'attribut ne l'excuse pas ;
 *   - l'attribut JSX `primary={…}` dont l'expression compare (`===`, `!==`, `==`, `!=`), sur un
 *     élément sans `ariaPressed` ;
 *   - la propriété `primary: …` d'un littéral d'option dont l'expression compare, sans `selected`.
 *
 * ANGLE MORT DÉCLARÉ (formes `primary`) : un booléen transmis (`primary={!inProgress}`) est une mise en
 * avant, que rien ne distingue syntaxiquement d'un état peint en primaire (juge B12, Q2).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { readCorpus } from '../../scripts/guards/lib/sourceCorpus.mjs';

const EGALITE = new Set([
  ts.SyntaxKind.EqualsEqualsEqualsToken,
  ts.SyntaxKind.ExclamationEqualsEqualsToken,
  ts.SyntaxKind.EqualsEqualsToken,
  ts.SyntaxKind.ExclamationEqualsToken,
]);

function contientEgalite(n: ts.Node): boolean {
  if (ts.isBinaryExpression(n) && EGALITE.has(n.operatorToken.kind)) return true;
  return ts.forEachChild(n, contientEgalite) ?? false;
}

/** Le TON transmis : `primary`, ou `x.primary`, parenthèses ôtées. */
function estLeTon(n: ts.Expression): boolean {
  while (ts.isParenthesizedExpression(n)) n = n.expression;
  return (ts.isIdentifier(n) && n.text === 'primary')
    || (ts.isPropertyAccessExpression(n) && n.name.text === 'primary');
}

/** Un conditionnel (`c ? 'btn-primary' : ''`, `c && 'btn-primary'`) dont une branche écrit
 *  `btn-primary` et dont la condition n'est pas le ton transmis. */
function primaireParEtat(n: ts.Node, sf: ts.SourceFile): boolean {
  if (ts.isConditionalExpression(n) && !estLeTon(n.condition)
    && (n.whenTrue.getText(sf).includes('btn-primary') || n.whenFalse.getText(sf).includes('btn-primary'))) return true;
  if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken
    && !estLeTon(n.left) && n.right.getText(sf).includes('btn-primary')) return true;
  return ts.forEachChild(n, (c) => primaireParEtat(c, sf) || undefined) ?? false;
}

const attr = (el: ts.JsxAttributes, nom: string) =>
  el.properties.find((p): p is ts.JsxAttribute => ts.isJsxAttribute(p) && ts.isIdentifier(p.name) && p.name.text === nom);

/** Sites fautifs d'un fichier, en `fichier:ligne — texte`. */
export function choixPeintsEnPrimaire(src: string, file: string): string[] {
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const out: string[] = [];
  const site = (n: ts.Node) =>
    `${file}:${sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1} — ${n.getText(sf).replace(/\s+/g, ' ').slice(0, 100)}`;
  const walk = (n: ts.Node): void => {
    if (ts.isJsxAttributes(n)) {
      const cls = attr(n, 'className');
      if (cls?.initializer && primaireParEtat(cls.initializer, sf)) out.push(site(cls));
      const primary = attr(n, 'primary');
      if (primary?.initializer && contientEgalite(primary.initializer) && !attr(n, 'ariaPressed')) out.push(site(primary));
    }
    if (ts.isObjectLiteralExpression(n)) {
      const nom = (p: ts.ObjectLiteralElementLike) => (p.name && ts.isIdentifier(p.name) ? p.name.text : undefined);
      const primary = n.properties.find((p): p is ts.PropertyAssignment => ts.isPropertyAssignment(p) && nom(p) === 'primary');
      if (primary && contientEgalite(primary.initializer) && !n.properties.some((p) => nom(p) === 'selected')) out.push(site(primary));
    }
    ts.forEachChild(n, walk);
  };
  walk(sf);
  return out;
}

describe('état de bouton — son attribut, jamais le ton primaire', () => {
  it('le détecteur mord sur les trois formes, et se tait sur le ton transmis et sur la marque', () => {
    const fautif = [
      'const a = <button className={`btn ${x === k ? \'btn-primary\' : \'\'}`} aria-pressed={x === k} />;',
      'const b = <GatedAction primary={pane === key} />;',
      'const c = [{ key: k, primary: v === k }];',
      'const d = <button className={`btn small${open ? \' btn-primary\' : \'\'}`} aria-expanded={open} />;',
      'const e = <button className={`btn ${(dragOver && \'btn-primary\') || \'\'}`} />;',
    ].join('\n');
    expect(choixPeintsEnPrimaire(fautif, 'f.tsx').map((s) => s.split(' — ')[0])).toEqual(['f.tsx:1', 'f.tsx:2', 'f.tsx:3', 'f.tsx:4', 'f.tsx:5']);
    const marque = [
      'const a = <button className="btn" aria-pressed={x === k} />;',
      'const b = <GatedAction primary={false} ariaPressed={pane === key} />;',
      'const c = [{ key: k, selected: v === k }];',
      'const d = <GatedAction primary={!inProgress} />;',
      'const e = <button className={`btn ${primary ? \'btn-primary\' : \'\'}`} />;',
      'const f = <button className={`btn ${(a.primary) ? \'btn-primary\' : \'btn-ghost\'}`} />;',
    ].join('\n');
    expect(choixPeintsEnPrimaire(marque, 'f.tsx')).toEqual([]);
  });

  it('aucun site de `src/ui` ne peint un état de bouton en primaire', () => {
    const fautes = readCorpus(['src/ui']).flatMap((f) => choixPeintsEnPrimaire(f.text, f.rel));
    expect(fautes).toEqual([]);
  });
});

/** Expression sans ses parenthèses. */
const nue = (e: ts.Expression): ts.Expression => { while (ts.isParenthesizedExpression(e)) e = e.expression; return e; };

/** Valeur de l'attribut `nom` d'un élément JSX : posé tel quel, ou porté par un attribut ÉTALÉ dont
 *  l'objet est littéral (`{...{ 'aria-expanded': o }}`) ou une constante littérale du fichier.
 *  `true` = présent sans expression (`aria-haspopup="dialog"`, attribut nu). */
function valeurAttr(attrs: ts.JsxAttributes, nom: string, sf: ts.SourceFile): ts.Expression | true | undefined {
  const direct = attr(attrs, nom);
  if (direct) return direct.initializer && ts.isJsxExpression(direct.initializer) && direct.initializer.expression ? direct.initializer.expression : true;
  for (const p of attrs.properties) {
    if (!ts.isJsxSpreadAttribute(p)) continue;
    let obj = nue(p.expression);
    if (ts.isIdentifier(obj)) {
      const id = obj.text;
      let decl: ts.Expression | undefined;
      const chercher = (n: ts.Node): void => {
        if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === id && n.initializer) decl = nue(n.initializer);
        else ts.forEachChild(n, chercher);
      };
      chercher(sf);
      if (decl) obj = decl;
    }
    if (!ts.isObjectLiteralExpression(obj)) continue;
    const prop = obj.properties.find((q): q is ts.PropertyAssignment =>
      ts.isPropertyAssignment(q) && (ts.isStringLiteral(q.name) || ts.isIdentifier(q.name)) && q.name.text === nom);
    if (prop) return prop.initializer;
  }
  return undefined;
}

const EST_RIEN = (e: ts.Expression) => e.kind === ts.SyntaxKind.NullKeyword || (ts.isIdentifier(e) && e.text === 'undefined') || e.kind === ts.SyntaxKind.FalseKeyword
  || (ts.isStringLiteralLike(e) && e.text === '');

/** Condition sans ce qui ne change pas sa vérité : parenthèses, `!`, `!!`, `Boolean(…)`. */
function condNue(e: ts.Expression): ts.Expression {
  e = nue(e);
  if (ts.isPrefixUnaryExpression(e) && e.operator === ts.SyntaxKind.ExclamationToken) return condNue(e.operand);
  if (ts.isCallExpression(e) && ts.isIdentifier(e.expression) && e.expression.text === 'Boolean' && e.arguments.length === 1) return condNue(e.arguments[0]);
  return e;
}

/** Divulgations (`aria-expanded` sans `aria-haspopup`) qui ÉCRIVENT leur état, en `fichier:ligne`.
 *  La CLÉ est l'expression d'`aria-expanded`, normalisée (`c ? 'true' : 'false'` → `c` ; `!`, `!!`,
 *  `Boolean(…)` ôtés). Mord :
 *   - dans les enfants, tout conditionnel (`?:`, `&&`, `||`) qui dépend de la clé ;
 *   - chez les FRÈRES qui suivent, à toute profondeur, un `?:` ou un `&&` qui dépend de la clé et dont
 *     une branche (le membre droit pour `&&`) est un littéral texte non vide, un gabarit ou un
 *     identifiant déclaré dans le fichier avec un initialiseur texte ou gabarit, ou lié par un
 *     `import` : une branche JSX, un paramètre, une prop déstructurée ou un identifiant non résolu est
 *     la région déployée, le CONTENU de la divulgation (`{o && <Détail />}`, `{o && children}`), jamais
 *     un marqueur ;
 *   - sur la divulgation elle-même, tout attribut qui dépend de la clé, ou dont l'expression EST la clé
 *     (`data-open={o}`), hors `aria-*` d'état (`aria-controls`…) et gestionnaires `on…` ;
 *     `aria-label`, `aria-description` et `title` (nom et description) : WAI-ARIA APG, « Button
 *     Pattern ».
 *  L'état canonique est le chevron de `components.css`, qui lit l'attribut.
 *
 *  ANGLES MORTS DÉCLARÉS : (juge B17d, Q4, forme L) un frère `{o ? <A /> : <B />}` aux deux branches
 *  JSX peut être un couple résumé/détail légitime ; rien ne le distingue syntaxiquement d'un marqueur.
 *  (juge B17f, G6) la résolution d'un identifiant est par NOM dans le fichier, sans portée : un nom
 *  déclaré texte dans une fonction et JSX dans une autre compte pour un marqueur partout. */
export function divulgationsQuiEcriventLeurEtat(src: string, file: string): string[] {
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const out: string[] = [];
  const texte = (e: ts.Expression) => e.getText(sf).replace(/\s+/g, '');
  const cleDe = (etat: ts.Expression) => {
    const c = nue(etat);
    return texte(condNue(ts.isConditionalExpression(c) ? c.condition : c));
  };
  const dependDe = (cle: string) => (cond: ts.Expression): boolean => texte(condNue(cond)) === cle;
  const dependDans = (n: ts.Node, depend: (c: ts.Expression) => boolean): boolean => {
    if (ts.isConditionalExpression(n) && depend(n.condition)) return true;
    if (ts.isBinaryExpression(n) && (n.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken || n.operatorToken.kind === ts.SyntaxKind.BarBarToken)
      && depend(n.left)) return true;
    return ts.forEachChild(n, (c) => dependDans(c, depend) || undefined) ?? false;
  };
  const designeUnTexte = (id: ts.Identifier): boolean => {
    let texteOuImport = false;
    const chercher = (n: ts.Node): void => {
      if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === id.text && n.initializer
        && (ts.isStringLiteralLike(nue(n.initializer)) || ts.isTemplateExpression(nue(n.initializer)))) texteOuImport = true;
      else if ((ts.isImportSpecifier(n) || ts.isImportClause(n) || ts.isNamespaceImport(n)) && n.name?.text === id.text) texteOuImport = true;
      else ts.forEachChild(n, chercher);
    };
    chercher(sf);
    return texteOuImport;
  };
  const estMarqueur = (b: ts.Expression): boolean => {
    const e = nue(b);
    if (EST_RIEN(e)) return false;
    return ts.isStringLiteralLike(e) || ts.isTemplateExpression(e) || (ts.isIdentifier(e) && designeUnTexte(e));
  };
  const marqueurDans = (n: ts.Node, depend: (c: ts.Expression) => boolean): boolean => {
    if (ts.isConditionalExpression(n) && depend(n.condition) && (estMarqueur(n.whenTrue) || estMarqueur(n.whenFalse))) return true;
    if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken && depend(n.left) && estMarqueur(n.right)) return true;
    return ts.forEachChild(n, (c) => marqueurDans(c, depend) || undefined) ?? false;
  };
  const walk = (n: ts.Node): void => {
    const ouvrant = ts.isJsxElement(n) ? n.openingElement : ts.isJsxSelfClosingElement(n) ? n : undefined;
    const etat = ouvrant && valeurAttr(ouvrant.attributes, 'aria-expanded', sf);
    if (ouvrant && etat && etat !== true && !valeurAttr(ouvrant.attributes, 'aria-haspopup', sf)) {
      const depend = dependDe(cleDe(etat));
      const enfants = ts.isJsxElement(n) && n.children.some((c) => dependDans(c, depend));
      const attributs = ouvrant.attributes.properties.some((p) => ts.isJsxAttribute(p) && !/^(aria-(?!label$|description$)|on[A-Z])/.test(p.name.getText(sf))
        && !!p.initializer && (dependDans(p.initializer, depend) || (ts.isJsxExpression(p.initializer) && !!p.initializer.expression && depend(p.initializer.expression))));
      const parent = n.parent;
      const freres = (ts.isJsxElement(parent) || ts.isJsxFragment(parent)) ? parent.children.slice(parent.children.indexOf(n as ts.JsxChild) + 1) : [];
      const marqueurFrere = freres.some((f) => marqueurDans(f, depend));
      if (enfants || attributs || marqueurFrere) out.push(`${file}:${sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1}`);
    }
    ts.forEachChild(n, walk);
  };
  walk(sf);
  return out;
}

/** Règles d'une feuille (commentaires ôtés, `@media` traversé) : sélecteurs normalisés et corps. */
const reglesDe = (css: string) => [...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)]
  .map((m) => ({ selecteurs: m[1].split(/,(?![^()]*\))/).map((sel) => sel.trim().replace(/\s+/g, ' ')), corps: m[2] }));

/** Règles d'une feuille d'ÉCRAN qui posent un `content` sous un sélecteur `aria-expanded`, en
 *  `fichier — sélecteur` : un glyphe d'état écrit hors de la règle canonique (`components.css`). */
export function feuillesQuiEcriventLEtat(css: string, file: string): string[] {
  if (file === 'src/ui/styles/components.css') return [];
  return reglesDe(css)
    .filter((r) => /(^|[;\s])content\s*:/.test(r.corps))
    .flatMap((r) => r.selecteurs.filter((sel) => sel.includes('aria-expanded')).map((sel) => `${file} — ${sel}`));
}

describe('divulgation — son état est le chevron canonique, quelle que soit la matière du contrôle', () => {
  const regles = reglesDe(readFileSync('src/ui/styles/components.css', 'utf8'));

  it('le chevron vise l’ATTRIBUT seul (`aria-expanded` sans `aria-haspopup`), jamais une classe', () => {
    const glyphe = regles.filter((r) => /content:\s*'▾'/.test(r.corps));
    expect(glyphe.length, 'une seule règle pose le glyphe').toBe(1);
    expect(/content:\s*'▾'\s*\/\s*''/.test(glyphe[0].corps), 'glyphe à texte alternatif vide : hors du nom accessible').toBe(true);
    expect(glyphe[0].selecteurs.filter((sel) => sel.includes('aria-expanded'))).toEqual(['[aria-expanded]:not([aria-haspopup])::after']);
    const tournes = regles.filter((r) => /rotate\(180deg\)/.test(r.corps)).flatMap((r) => r.selecteurs.filter((sel) => sel.includes('aria-expanded')));
    expect(tournes, 'déplié, le chevron tourne').toEqual(["[aria-expanded='true']:not([aria-haspopup])::after"]);
  });

  const formes: [string, string, string][] = [
    ['A glyphe par constante', "const G = '▸'; const a = <button aria-expanded={o}>{o ? OUVERT : G} Nom</button>;", 'const a = <button aria-expanded={o}>Nom</button>;'],
    ['B glyphe + / −', "const a = <button aria-expanded={o}>{o ? '−' : '+'} Nom</button>;", "const a = <button aria-expanded={o}>+ Nom</button>;"],
    ['C glyphe ▶ ▽, négation', "const a = <button aria-expanded={o}>{!o ? '▶' : '▽'} Nom</button>;", "const a = <button aria-expanded={o}>{n ? '▶' : '▽'} Nom</button>;"],
    ['D attribut étalé', "const a = <button {...{ 'aria-expanded': o }}>{o ? '▾' : '▸'} Nom</button>;", "const a = <button {...{ 'aria-expanded': o, 'aria-haspopup': 'menu' }}>{o ? '▾' : '▸'} Nom</button>;"],
    ['D’ attribut étalé par constante', "const p = { 'aria-expanded': x === k }; const a = <button {...p}>{x === k && '▾'}</button>;", "const p = { 'aria-expanded': x === k }; const a = <button {...p}>Nom</button>;"],
    ['E auto-fermant, marqueur frère (verdict B17c)', "const a = <><button aria-expanded={o} /><span>{o ? '▾' : '▸'}</span></>;", 'const a = <><button aria-expanded={o} />{o && <Detail />}{o ? <Detail /> : null}</>;'],
    ['F donnée d’état voisine (tendance ▲)', "const a = <button aria-expanded={o}>Allonge <b>{o ? 'Longue ▲' : ''}</b></button>;", "const a = <button aria-expanded={o}>Allonge <b>Longue ▲</b></button>;"],
    ['G référence', "const a = <button aria-expanded={o}><span>{o ? '▾' : '▸'}</span> Nom</button>;", "const a = <button aria-haspopup=\"listbox\" aria-expanded={o}><span>{o ? '▾' : '▸'}</span> Nom</button>;"],
    ['H aria-expanded en ternaire chaîne', "const a = <button aria-expanded={o ? 'true' : 'false'}>{o ? '▾' : '▸'} Nom</button>;", "const a = <button aria-expanded={o ? 'true' : 'false'}>Nom</button>;"],
    ['I aria-expanded={!!o}', "const a = <button aria-expanded={!!o}>{Boolean(o) ? '▾' : '▸'} Nom</button>;", 'const a = <button aria-expanded={!!o}>Nom</button>;'],
    ['J frère {o && glyphe}', "const a = <><button aria-expanded={o}>Nom</button>{o && '▾'}</>;", 'const a = <><button aria-expanded={o}>Nom</button>{o && <Detail />}</>;'],
    ['K frère {o ? glyphe : null}', "const a = <><button aria-expanded={o}>Nom</button>{o ? '▲' : null}</>;", 'const a = <><button aria-expanded={o}>Nom</button>{o ? <Detail /> : null}</>;'],
    ['M classe d’état sur la divulgation', "const a = <button aria-expanded={o} className={o ? 'ouvert' : ''}>Nom</button>;", "const a = <button aria-expanded={o} className=\"btn\" aria-controls={o ? 'r' : undefined} onClick={() => f(o ? null : k)}>Nom</button>;"],
    ['M’ style d’état sur la divulgation', "const a = <button aria-expanded={o} style={{ opacity: o ? 1 : 0.5 }}>Nom</button>;", 'const a = <button aria-expanded={o} style={{ opacity: 1 }}>Nom</button>;'],
    ['M″ title d’état sur la divulgation', "const a = <button aria-expanded={o} title={o ? 'Replier' : 'Déplier'}>Nom</button>;", 'const a = <button aria-expanded={o} title="Groupe">Nom</button>;'],
    ['M‴ aria-label d’état sur la divulgation', "const a = <button aria-expanded={o} aria-label={o ? 'Replier' : 'Déplier'}>▸</button>;", 'const a = <button aria-expanded={o} aria-label="Groupe">▸</button>;'],
    ['M⁗ aria-description d’état sur la divulgation', "const a = <button aria-expanded={o} aria-description={o ? 'ouvert' : 'fermé'}>Nom</button>;", 'const a = <button aria-expanded={o} aria-description="4 membres">Nom</button>;'],
    ['O attribut dont l’expression EST la clé', 'const a = <button aria-expanded={o} data-open={o}>Nom</button>;', 'const a = <button aria-expanded={o} data-id={k}>Nom</button>;'],
    ['N frère glyphe dans un span', "const a = <><button aria-expanded={o}>Nom</button><span>{o ? '▾' : '▸'}</span></>;", "const d = <Detail />; const a = <><button aria-expanded={o}>Nom</button><div>{o ? d : ''}</div></>;"],
    ['Q frère constante importée ; propre : la prop `children`', "import { CHEVRON } from './c'; const a = <><button aria-expanded={o}>Nom</button>{o && CHEVRON}</>;", 'function X({ children, o }) { return <><button aria-expanded={o}>Nom</button>{o && children}</>; }'],
    ['P frère gabarit ; propre : la région déployée', "const a = <><button aria-expanded={o}>Nom</button>{o && `▾`}</>;", 'const a = <><button aria-expanded={o}>Nom</button>{o && <Detail />}</>;'],
  ];
  for (const [forme, fautif, propre] of formes) {
    it(`détecteur, forme ${forme} : le fautif mord, le propre se tait`, () => {
      expect(divulgationsQuiEcriventLeurEtat(fautif, 'f.tsx'), fautif).toEqual(['f.tsx:1']);
      expect(divulgationsQuiEcriventLeurEtat(propre, 'f.tsx'), propre).toEqual([]);
    });
  }

  it('détecteur de feuille : un `content` sous `aria-expanded` hors de `components.css` mord, `@media` compris', () => {
    const fautive = ".x[aria-expanded]::before { content: '▸'; }\n@media (max-width: 560px) { .y[aria-expanded='true']::after { color: red; content: '▴'; } }";
    expect(feuillesQuiEcriventLEtat(fautive, 'src/ui/styles/x.css')).toEqual([
      "src/ui/styles/x.css — .x[aria-expanded]::before",
      "src/ui/styles/x.css — .y[aria-expanded='true']::after",
    ]);
    const propre = ".x[aria-expanded]::after { margin-inline-start: auto; }\n.x::before { content: '·'; }";
    expect(feuillesQuiEcriventLEtat(propre, 'src/ui/styles/x.css')).toEqual([]);
    expect(feuillesQuiEcriventLEtat(fautive, 'src/ui/styles/components.css'), 'la règle canonique').toEqual([]);
  });

  it('aucune divulgation de `src` n’écrit son propre état', () => {
    expect(readCorpus(['src']).flatMap((f) => divulgationsQuiEcriventLeurEtat(f.text, f.rel))).toEqual([]);
  });

  it('aucune feuille de `src` hors de `components.css` n’écrit l’état d’une divulgation', () => {
    expect(readCorpus(['src'], { exts: ['.css'] }).flatMap((f) => feuillesQuiEcriventLEtat(f.text, f.rel))).toEqual([]);
  });
});
