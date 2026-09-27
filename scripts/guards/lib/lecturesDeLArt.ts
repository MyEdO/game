/**
 * Garde des LECTURES DE L'ART du rig hors de leur foyer (#1903) : jetons `@clé`, gammes, vues d'un art
 * orienté, références de dégradé. Sept CONSTRUCTIONS RÉSERVÉES (`canonUnique.mjs`), chacune déclarée
 * avec son foyer et filtrée par `sAppliqueA` (`sourceCorpus.mjs`), dans `LECTURES_DE_L_ART` :
 * `REGEX_DE_JETON`, `GAMME_EN_LIGNE`, `PROJECTION_DE_VUES`, `REGEX_DE_DEGRADE_DERIVE`,
 * `REGEX_DE_DEGRADE_FIXE`, `CANON_VIEWS`, `CANON_ROLES_DE_GAMME`. Les motifs se déclarent depuis les
 * canons qu'ils gardent (`CLES`, `SUFFIXE_DE_ROLE`, `ROLES_DE_GAMME`, `VIEWS`), jamais recopiés ici.
 * Lecture par l'AST (`ast`, `dialecte.mjs`) ; ce module et sa garde écrivent les constructions qu'ils
 * détectent, et sont dans le foyer de chacune (`MODULE`, `GARDE`).
 *
 * Formes que `CANON_VIEWS` ne lit pas. Les clés d'objet : un art orienté EST une table keyée par vue,
 * typée par son format ; ses projections, dont chaque valeur se lit ou se calcule depuis la vue de sa
 * clé, relèvent de `PROJECTION_DE_VUES`. La case d'un `switch` : un rétrécissement que le compilateur
 * borne, comme `unions-canon.test.ts` l'arbitre pour l'arête de mur.
 *
 * Ce que cette garde ne voit pas. Une lecture de jeton sans regex (`includes('@')`, `toContain('@')`,
 * `split`, `indexOf`). Un suffixe concaténé depuis un identifiant qui n'est pas lié par `const` à un
 * conditionnel de suffixes (paramètre, variable, retour de fonction), ou rangé dans un tuple plus large
 * (`['O', 0.78, -1]`). Un tableau d'appels `gammeDe` dont les rôles ne sont pas des littéraux. Une
 * projection de vues sans test de `typeof` : la lecture directe d'un format TOTAL (`ViewSet`) n'en est
 * pas une, ni la re-projection locale d'un `ViewArt`, qui n'a pas de forme chaîne. Les sous-ensembles
 * de vues : listes de deux, et projections en clés d'objet de moins de trois vues (#2008). Les formes
 * que `CANON_VIEWS` ne lit pas. La lecture des DÉFINITIONS `id="dg-…"` dans un rendu résolu, dont seul
 * `deriverDegrades` écrit la forme. La lecture par SOUS-CHAÎNE d'un id de dégradé fixe sans classe après
 * `g_` (`/g_steel/`). La lecture DIRECTE d'une vue sur un art orienté en objet (`p.viewArt?.[view]`),
 * égale à `declaredView` sur un objet, qui n'est pas une projection. Une table keyée par vue remplie
 * par une boucle (`for (const v of VIEWS) o[v] = …`). Des appels frères, un par vue, hors des arguments
 * d'un appel, d'un tableau littéral et des instructions d'un bloc : en substitutions d'un gabarit
 * (`` `${f('front')}${f('profile')}${f('back')}` ``), en opérandes d'une concaténation, en enfants d'un
 * élément JSX. Un tableau d'objets à propriété de vue (`{ label: VIEW_LABEL[view], view }`) :
 * `CANON_VIEWS` ne lit pas les valeurs d'un objet. Une liste des vues écrite dans une chaîne
 * (`'front,profile,back'.split(',')`) : `CANON_VIEWS` ne lit pas le texte d'un littéral.
 */
import ts from 'typescript';
import { recopieDeCanon, type ConstructionGardee } from './canonUnique.mjs';
import { CLES } from '../../../src/gameIso/rig/clesDePalette';
import { ROLES_DE_GAMME, SUFFIXE_DE_ROLE } from '../../../src/data/palette.types';
import { VIEWS } from '../../../src/gameIso/rig/facing';

/** Ce module, dans le foyer de chaque construction. */
export const MODULE = 'scripts/guards/lib/lecturesDeLArt.ts';
/** La garde, dans le foyer de chaque construction. */
export const GARDE = 'src/lectures-de-l-art-guard.test.ts';

/** Les formes de liste que lisent `CANON_VIEWS` et `CANON_ROLES_DE_GAMME`. */
const FORMES_DES_LISTES = ['tableau', 'union de types', 'membres de type', 'chaîne de comparaisons'];

/** Le motif d'une regex : le texte d'un littéral, ou celui du premier argument d'un `new RegExp(…)`
 *  tel qu'écrit, une barre oblique inverse doublée d'une chaîne lue simple. */
function motifDeRegex(n: ts.Node, sf: ts.SourceFile): string | null {
  if (ts.isRegularExpressionLiteral(n)) return n.text;
  if (ts.isNewExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'RegExp' && n.arguments?.[0]) {
    return n.arguments[0].getText(sf).replace(/\\\\/g, '\\');
  }
  return null;
}

const echappe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Construction réservée lue sur le motif d'une regex. */
function regexReservee(nom: string, lit: RegExp, detail: string, indice: (texte: string) => boolean): Omit<ConstructionGardee, 'foyer'> {
  return {
    nom,
    indice,
    reconnait: (n, sf) => {
      const motif = motifDeRegex(n, sf);
      return motif != null && lit.test(motif) ? detail : null;
    },
  };
}

/** `@` suivi d'une classe ouverte sur une lettre, de `\w`, d'une substitution, ou d'un groupe ouvert
 *  sur l'un d'eux ou sur une clé de `CLES`. */
const JETON = new RegExp(String.raw`@(\[a-zA-Z|\\w|\$\{|\((\?:)?(\[a-zA-Z|\\w|\$\{|(${CLES.map(echappe).join('|')})\b))`);

const REGEX_DE_JETON = {
  ...regexReservee('REGEX_DE_JETON', JETON, 'regex de jeton (`TOKEN_RE`, `tokensOf`, `replaceTokens`, `palette.ts`)', (t) => t.includes('@')),
  foyer: ['src/gameIso/rig/palette.ts', MODULE, GARDE],
} satisfies ConstructionGardee;

/** Les suffixes de rôle, lus dans la table. */
const SUFFIXES: readonly string[] = Object.values(SUFFIXE_DE_ROLE);
const estSuffixe = (s: string) => SUFFIXES.includes(s);
const COMMENCE_PAR_UN_SUFFIXE = new RegExp(`^(${SUFFIXES.map(echappe).join('|')})(?!\\w)`);

/** Au moins deux suffixes DISTINCTS dans une alternance `(…|…)` ou une classe `[…]` du motif. */
function suffixesEnAlternance(motif: string): boolean {
  for (const [, corps] of motif.matchAll(/\((?:\?:)?([^()]*)\)/g)) {
    const alternatives = corps.split('|');
    if (alternatives.length > 1 && alternatives.every(estSuffixe) && new Set(alternatives).size >= 2) return true;
  }
  for (const [, corps] of motif.matchAll(/\[([^\]]*)\]/g)) {
    const lettres = [...corps];
    if (lettres.length > 1 && lettres.every(estSuffixe) && new Set(lettres).size >= 2) return true;
  }
  return false;
}

/** Les feuilles d'une expression conditionnelle (`a ? b : c`, imbriquée), parenthèses retirées. */
function feuilles(e: ts.Expression): ts.Expression[] {
  while (ts.isParenthesizedExpression(e)) e = e.expression;
  return ts.isConditionalExpression(e) ? [...feuilles(e.whenTrue), ...feuilles(e.whenFalse)] : [e];
}

/** Vrai si `id` est lié par `const` à un conditionnel dont toutes les feuilles sont `''` ou des
 *  suffixes, au moins un suffixe. */
function lieAUnConditionnelDeSuffixes(id: ts.Identifier, sf: ts.SourceFile): boolean {
  let trouve = false;
  const walk = (x: ts.Node) => {
    if (trouve) return;
    if (
      ts.isVariableDeclaration(x) && ts.isIdentifier(x.name) && x.name.text === id.text && x.initializer
      && ts.isVariableDeclarationList(x.parent) && (x.parent.flags & ts.NodeFlags.Const) !== 0
    ) {
      const fs = feuilles(x.initializer);
      const lits = fs.map((f) => (ts.isStringLiteralLike(f) ? f.text : null));
      if (fs.length > 1 && lits.every((l) => l === '' || (l != null && estSuffixe(l))) && lits.some((l) => l != null && estSuffixe(l))) trouve = true;
    }
    ts.forEachChild(x, walk);
  };
  walk(sf);
  return trouve;
}

const estLitteral = (e: ts.Expression) => ts.isStringLiteralLike(e) || ts.isNumericLiteral(e) || ts.isTemplateExpression(e);

/** Rôle littéral d'un appel `gammeDe(…, '<rôle>')`, ou `null`. */
function roleDeGammeDe(e: ts.Expression): string | null {
  if (!ts.isCallExpression(e) || !ts.isIdentifier(e.expression) || e.expression.text !== 'gammeDe') return null;
  const role = e.arguments[1];
  return role && ts.isStringLiteralLike(role) ? role.text : null;
}

const GAMME_EN_LIGNE = {
  nom: 'GAMME_EN_LIGNE',
  foyer: ['src/data/palette.types.ts', MODULE, GARDE],
  reconnait: (n, sf) => {
    if (ts.isTemplateExpression(n)) {
      const enLigne = n.templateSpans.some((span, i) => {
        const avant = i === 0 ? n.head.text : n.templateSpans[i - 1].literal.text;
        const dernier = i === n.templateSpans.length - 1;
        return (dernier && estSuffixe(span.literal.text)) || (avant.endsWith('@') && COMMENCE_PAR_UN_SUFFIXE.test(span.literal.text));
      });
      return enLigne ? 'suffixe de rôle écrit dans un gabarit (`gammeDe`)' : null;
    }
    if (ts.isArrayLiteralExpression(n)) {
      const lits = n.elements.map((e) => (ts.isStringLiteralLike(e) ? e.text : null));
      if (lits.length > 1 && lits.every((l) => l === '' || (l != null && estSuffixe(l))) && new Set(lits.filter((l) => l)).size >= 2) {
        return 'liste des suffixes de rôle (`gammes`, `ROLES_DE_GAMME`)';
      }
      const roles = n.elements.map(roleDeGammeDe);
      if (roles.filter((r) => r != null).length >= 2 && new Set(roles.filter((r) => r != null)).size >= 2) {
        return 'liste des rôles recopiée en appels `gammeDe` (`gammes`, `ROLES_DE_GAMME`)';
      }
      return null;
    }
    if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.PlusToken) {
      const b = n.right;
      if (ts.isStringLiteralLike(b) && estSuffixe(b.text) && !estLitteral(n.left)) return 'suffixe de rôle concaténé (`gammeDe`)';
      if (ts.isIdentifier(b) && lieAUnConditionnelDeSuffixes(b, sf)) return 'suffixe de rôle concaténé depuis un conditionnel (`gammeDe`)';
      return null;
    }
    const motif = motifDeRegex(n, sf);
    return motif != null && suffixesEnAlternance(motif) ? 'suffixes de rôle en alternance de regex (`baseDeGamme`)' : null;
  },
} satisfies ConstructionGardee;

/** Texte d'un récepteur, chaînage optionnel et assertion non nulle retirés. */
const recepteur = (e: ts.Expression, sf: ts.SourceFile) => e.getText(sf).replace(/\?\./g, '.').replace(/!/g, '');

/** Vue lue par un accès `<x>.<vue>` (chaînage optionnel admis) : `[x, vue]`, ou `null`. */
function vueLue(e: ts.Node, sf: ts.SourceFile, vues: readonly string[]): [string, string] | null {
  if (ts.isPropertyAccessExpression(e) && vues.includes(e.name.text)) return [recepteur(e.expression, sf), e.name.text];
  return null;
}

/** Vrai si `zone` lit une vue sur `x` (`.<vue>`, ou `x[…]`) ou en fabrique une (`{ <vue>: x }`). */
function litUneVueSur(zone: ts.Node, x: string, sf: ts.SourceFile, vues: readonly string[], indexee: boolean): boolean {
  let lu = false;
  const walk = (c: ts.Node) => {
    if (lu) return;
    const v = vueLue(c, sf, vues);
    if (v && v[0] === x) lu = true;
    else if (indexee && ts.isElementAccessExpression(c) && recepteur(c.expression, sf) === x) lu = true;
    else if (indexee && ts.isPropertyAssignment(c) && ts.isIdentifier(c.name) && vues.includes(c.name.text) && recepteur(c.initializer, sf) === x) lu = true;
    ts.forEachChild(c, walk);
  };
  walk(zone);
  return lu;
}

/** Vrai si le sous-arbre nomme une vue (identifiant, chaîne ou nom de propriété). */
function nommeUneVue(zone: ts.Node, vues: readonly string[]): boolean {
  let nomme = false;
  const walk = (c: ts.Node) => {
    if (nomme) return;
    if ((ts.isIdentifier(c) || ts.isStringLiteralLike(c)) && vues.includes(c.text)) nomme = true;
    ts.forEachChild(c, walk);
  };
  walk(zone);
  return nomme;
}

const OPERATEURS_EGAL = [ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.EqualsEqualsToken];
const OPERATEURS_DIFFERENT = [ts.SyntaxKind.ExclamationEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsToken];

/** Les récepteurs testés `typeof <x> === 'string'` dans `zone`. */
function testsDeChaine(zone: ts.Node, sf: ts.SourceFile): string[] {
  const out: string[] = [];
  const walk = (c: ts.Node) => {
    if (
      ts.isBinaryExpression(c) && ts.isTypeOfExpression(c.left) && ts.isStringLiteralLike(c.right)
      && c.right.text === 'string' && OPERATEURS_EGAL.includes(c.operatorToken.kind)
    ) out.push(recepteur(c.left.expression, sf));
    ts.forEachChild(c, walk);
  };
  walk(zone);
  return out;
}

/** Une fonction qui projette les vues d'un art sous un test `typeof … === 'string'`. */
function projetteSousTestDeChaine(f: ts.SignatureDeclaration & { body?: ts.Node }, sf: ts.SourceFile, vues: readonly string[]): boolean {
  if (!f.body || !nommeUneVue(f.body, vues)) return false;
  return testsDeChaine(f.body, sf).some((x) => litUneVueSur(f.body!, x, sf, vues, true));
}

/** La valeur d'une clé de vue lit cette vue : `<x>.<vue>` (repli `?? …` admis), ou un appel qui reçoit
 *  la vue en argument littéral. Rend le callee d'un appel dont un argument lit la vue, pour la forme à
 *  callee commun, ou `true`/`false`. */
function valeurDeVue(valeur: ts.Expression, vue: string, sf: ts.SourceFile, vues: readonly string[]): boolean | string {
  let e = valeur;
  while (ts.isParenthesizedExpression(e)) e = e.expression;
  if (ts.isBinaryExpression(e) && e.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken) e = e.left;
  const lue = vueLue(e, sf, vues);
  if (lue && lue[1] === vue) return true;
  if (ts.isCallExpression(e)) {
    if (e.arguments.some((a) => ts.isStringLiteralLike(a) && a.text === vue)) return true;
    if (e.arguments.some((a) => { const l = vueLue(a, sf, vues); return l != null && l[1] === vue; })) return e.expression.getText(sf);
  }
  return false;
}

/** Projection en CLÉS D'OBJET : toutes les vues en clés, chacune lue ou calculée depuis sa clé. */
function projectionEnCles(n: ts.ObjectLiteralExpression, sf: ts.SourceFile, vues: readonly string[]): boolean {
  const parCle = new Map<string, ts.Expression>();
  for (const p of n.properties) if (ts.isPropertyAssignment(p) && (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name))) parCle.set(p.name.text, p.initializer);
  if (!vues.every((v) => parCle.has(v))) return false;
  const lectures = vues.map((v) => valeurDeVue(parCle.get(v)!, v, sf, vues));
  if (lectures.some((l) => l === false)) return false;
  const callees = lectures.filter((l): l is string => typeof l === 'string');
  return callees.length === 0 || (callees.length === vues.length && new Set(callees).size === 1);
}

/** APPELS FRÈRES : dans un contenant, des appels au même callee et aux mêmes arguments hors de la vue,
 *  chacun recevant UNE vue en argument littéral, qui ensemble nomment toutes les vues. */
function appelsFreres(elements: readonly ts.Node[], sf: ts.SourceFile, vues: readonly string[]): boolean {
  const groupes = new Map<string, Set<string>>();
  for (const el of elements) {
    const appel = ts.isExpressionStatement(el) ? el.expression : el;
    if (!ts.isCallExpression(appel)) continue;
    const vuesLues = appel.arguments.filter((a) => ts.isStringLiteralLike(a) && vues.includes(a.text));
    if (vuesLues.length !== 1) continue;
    const vue = (vuesLues[0] as ts.StringLiteralLike).text;
    const cle = [appel.expression.getText(sf), ...appel.arguments.map((a) => (a === vuesLues[0] ? '\u0000' : a.getText(sf)))].join('\u0001');
    const vus = groupes.get(cle) ?? new Set<string>();
    vus.add(vue);
    groupes.set(cle, vus);
  }
  return [...groupes.values()].some((vus) => vues.every((v) => vus.has(v)));
}

/** La mécanique de `PROJECTION_DE_VUES` sur la liste des vues `vues` (lue dans `VIEWS` pour la garde). */
export function projectionDeVues(vues: readonly string[]): Omit<ConstructionGardee, 'foyer'> {
  return {
    nom: 'PROJECTION_DE_VUES',
    reconnait: (n, sf) => {
      if (ts.isFunctionLike(n) && projetteSousTestDeChaine(n, sf, vues)) {
        let interne = true;
        const walk = (c: ts.Node) => {
          if (!interne) return;
          if (ts.isFunctionLike(c) && projetteSousTestDeChaine(c, sf, vues)) interne = false;
          ts.forEachChild(c, walk);
        };
        ts.forEachChild(n, walk);
        if (interne) return 'projection de vues sous `typeof` chaîne (`declaredView`, `mapViews`, `viewArt.ts`)';
      }
      if (ts.isBinaryExpression(n) && ts.isTypeOfExpression(n.left) && ts.isStringLiteralLike(n.right)) {
        const op = n.operatorToken.kind;
        const duale = (n.right.text === 'object' && OPERATEURS_EGAL.includes(op)) || (n.right.text === 'string' && OPERATEURS_DIFFERENT.includes(op));
        if (duale) {
          let haut: ts.Node = n;
          while (haut.parent && (ts.isBinaryExpression(haut.parent) || ts.isConditionalExpression(haut.parent) || ts.isParenthesizedExpression(haut.parent))) haut = haut.parent;
          const zone = haut.parent && ts.isIfStatement(haut.parent) ? haut.parent : haut;
          if (litUneVueSur(zone, recepteur(n.left.expression, sf), sf, vues, false)) return 'projection de vues sous `typeof` objet (`declaredView`, `viewArt.ts`)';
        }
      }
      if (ts.isArrayLiteralExpression(n)) {
        const lues = n.elements.map((e) => vueLue(e, sf, vues)).filter((l): l is [string, string] => l != null);
        const parRecepteur = new Map<string, Set<string>>();
        for (const [x, v] of lues) parRecepteur.set(x, (parRecepteur.get(x) ?? new Set()).add(v));
        if ([...parRecepteur.values()].some((vus) => vues.every((v) => vus.has(v)))) return 'vues d’un art listées en tableau (`viewEntries`, `viewArt.ts`)';
        if (appelsFreres(n.elements, sf, vues)) return 'appels frères, un par vue (`VIEWS.map`)';
      }
      if (ts.isObjectLiteralExpression(n) && projectionEnCles(n, sf, vues)) return 'projection de vues en clés d’objet (`tableTotale(VIEWS, …)`, `mapViews`)';
      if (ts.isCallExpression(n) && appelsFreres(n.arguments, sf, vues)) return 'appels frères, un par vue (`VIEWS.map`)';
      if (ts.isBlock(n) && appelsFreres(n.statements, sf, vues)) return 'appels frères, un par vue (`VIEWS.map`)';
      return null;
    },
  };
}

const PROJECTION_DE_VUES = { ...projectionDeVues(VIEWS), foyer: ['src/gameIso/rig/viewArt.ts', MODULE, GARDE] } satisfies ConstructionGardee;

const REGEX_DE_DEGRADE_DERIVE = {
  ...regexReservee('REGEX_DE_DEGRADE_DERIVE', /url\\\(#dg-|\^dg-/, 'grammaire d’une référence `dg-` (`lireDegradeDerive`, `palette.ts`)', (t) => t.includes('dg-')),
  foyer: ['src/gameIso/rig/palette.ts', MODULE, GARDE],
} satisfies ConstructionGardee;

const REGEX_DE_DEGRADE_FIXE = {
  ...regexReservee('REGEX_DE_DEGRADE_FIXE', /g_(\\w|\[)/, 'préfixe de dégradé fixe (`FX_GRADIENT_IDS`, `fxGradients.ts`)', (t) => t.includes('g_')),
  foyer: [MODULE, GARDE],
} satisfies ConstructionGardee;

const CANON_VIEWS = {
  ...recopieDeCanon({ nom: 'VIEWS', membres: VIEWS, complet: true, formes: FORMES_DES_LISTES }),
  foyer: ['src/gameIso/rig/facing.ts', MODULE, GARDE],
} satisfies ConstructionGardee;

const CANON_ROLES_DE_GAMME = {
  ...recopieDeCanon({ nom: 'ROLES_DE_GAMME', membres: ROLES_DE_GAMME, complet: true, formes: FORMES_DES_LISTES }),
  foyer: ['src/data/palette.types.ts', MODULE, GARDE],
} satisfies ConstructionGardee;

/** Les sept lectures de l'art, dans l'ordre de leurs motifs. */
export const LECTURES_DE_L_ART: readonly ConstructionGardee[] = [
  REGEX_DE_JETON,
  GAMME_EN_LIGNE,
  PROJECTION_DE_VUES,
  REGEX_DE_DEGRADE_DERIVE,
  REGEX_DE_DEGRADE_FIXE,
  CANON_VIEWS,
  CANON_ROLES_DE_GAMME,
];
