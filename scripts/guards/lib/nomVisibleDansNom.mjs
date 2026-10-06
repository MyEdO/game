/**
 * Nom accessible qui ne CONTIENT PAS le texte vu (WCAG 2.5.3 « Label in Name », #2199) : un élément
 * interactif dont l'`aria-label` LITTÉRAL remplace un texte visible LITTÉRAL qu'il ne reprend pas.
 *
 * Élément interactif : `<button>`, `<a>`, `<summary>`, un `role` de contrôle, ou un `onClick`.
 * `<select>`, `<input>`, `<textarea>` n'en sont pas : le texte qu'ils portent est une VALEUR, pas
 * leur libellé.
 *
 * Texte vu : les `JsxText` et les chaînes littérales des enfants, fragments `<>…</>` traversés. Un
 * sous-arbre n'est exclu que MASQUÉ À COUP SÛR (`aria-hidden`, `aria-hidden="true"`, `{true}`) ;
 * `aria-hidden={false}` ou CONDITIONNEL (`{x || undefined}`) le laisse vu : il l'est dans un état. Le
 * texte vu est réduit aux segments qui portent au moins DEUX lettres. Un glyphe (`✕`, `＋`), un rang (`1`) ou une
 * touche d'une lettre (`X`) n'est pas un libellé textuel.
 *
 * Nom : l'`aria-label` littéral, ou chaque branche d'un ternaire de littéraux. Chaque texte vu doit
 * être contenu, casse et blancs normalisés, dans au moins une branche.
 *
 * ANGLE MORT : un `aria-label` ou un texte vu CALCULÉS (variable, appel, gabarit à substitution)
 * ne sont pas mesurés.
 */
import { ast, typescript } from './dialecte.mjs';

const TAGS_INTERACTIFS = new Set(['button', 'a', 'summary']);
const ROLES_DE_CONTROLE = new Set(['button', 'tab', 'link', 'menuitem', 'checkbox', 'switch', 'option', 'radio']);
const DEUX_LETTRES = /\p{L}.*\p{L}/u;

const normal = (s) => s.replace(/\s+/g, ' ').trim().toLowerCase();

/** L'attribut `aria-hidden` masque-t-il À COUP SÛR ? (nu, `"true"`, `{true}`) */
function masqueSur(init) {
  const ts = typescript();
  if (init === undefined) return true;
  if (ts.isStringLiteral(init)) return init.text === 'true';
  return ts.isJsxExpression(init) && init.expression?.kind === ts.SyntaxKind.TrueKeyword;
}

/** Les chaînes d'une expression faite de littéraux (ternaires compris), sinon `null`. */
function litteraux(e) {
  if (!e) return null;
  const ts = typescript();
  if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) return [e.text];
  if (ts.isJsxExpression(e) || ts.isParenthesizedExpression(e)) return litteraux(e.expression);
  if (ts.isConditionalExpression(e)) {
    const a = litteraux(e.whenTrue);
    const b = litteraux(e.whenFalse);
    return a && b ? [...a, ...b] : null;
  }
  return null;
}

/**
 * Sites `chemin:ligne` d'un fichier `.tsx` (chemin tel que fourni).
 * @param {{ rel: string, text: string }} f
 * @param {import('typescript/unstable/ast').SourceFile} [sourceFile]
 * @returns {string[]}
 */
export function sitesNomSansTexteVisible(f, sourceFile) {
  const ts = typescript();
  const sf = sourceFile ?? ast(f);
  if (!sf) return [];
  const sites = [];
  const attributs = (o) => new Map(o.attributes.properties.filter(ts.isJsxAttribute).map((a) => [a.name.getText(sf), a.initializer]));
  const visite = (n) => {
    if (ts.isJsxElement(n)) {
      const o = n.openingElement;
      const attrs = attributs(o);
      const role = attrs.has('role') ? litteraux(attrs.get('role'))?.[0] : undefined;
      const interactif = TAGS_INTERACTIFS.has(o.tagName.getText(sf)) || ROLES_DE_CONTROLE.has(role ?? '') || attrs.has('onClick');
      const noms = interactif && attrs.has('aria-label') ? litteraux(attrs.get('aria-label')) : null;
      if (noms) {
        const vus = [];
        const collecte = (c) => {
          if (ts.isJsxText(c)) vus.push(c.text);
          else if (ts.isJsxExpression(c)) vus.push(...(litteraux(c) ?? []));
          else if (ts.isJsxFragment(c)) c.children.forEach(collecte);
          else if (ts.isJsxElement(c)) {
            const a = attributs(c.openingElement);
            if (!(a.has('aria-hidden') && masqueSur(a.get('aria-hidden')))) c.children.forEach(collecte);
          }
        };
        n.children.forEach(collecte);
        const N = noms.map(normal);
        const absents = vus.map(normal).filter((v) => DEUX_LETTRES.test(v) && !N.some((nom) => nom.includes(v)));
        if (absents.length) sites.push(`${f.rel}:${sf.getLineAndCharacterOfPosition(o.getStart(sf)).line + 1}`);
      }
    }
    n.forEachChild(visite);
  };
  visite(sf);
  return sites;
}
