/**
 * Garde des LECTURES DE L'ART hors de leur foyer (#1903) : vues d'un art orienté, références de dégradé
 * fixe. Trois CONSTRUCTIONS RÉSERVÉES (`canonUnique.mjs`), chacune déclarée avec son foyer et filtrée par
 * `sAppliqueA` (`sourceCorpus.mjs`), dans `LECTURES_DE_L_ART` : `PROJECTION_DE_VUES`,
 * `REGEX_DE_DEGRADE_FIXE`, `CANON_VIEWS`. Les motifs de vues se déclarent depuis le canon qu'ils gardent
 * (`VIEWS`), jamais recopiés ici. Lecture par l'AST (`ast`, `dialecte.mjs`) ; ce module et sa garde
 * écrivent les constructions qu'ils détectent, et sont dans le foyer de chacune (`MODULE`, `GARDE`).
 *
 * Formes que `CANON_VIEWS` ne lit pas. Les clés d'objet : un art orienté EST une table keyée par vue,
 * typée par son format ; ses projections, dont chaque valeur se lit ou se calcule depuis la vue de sa
 * clé, relèvent de `PROJECTION_DE_VUES`. La case d'un `switch` : un rétrécissement que le compilateur
 * borne, comme `unions-canon.test.ts` l'arbitre pour l'arête de mur.
 *
 * Ce que cette garde ne voit pas. Une projection de vues sans test de `typeof` : la lecture directe d'un
 * format TOTAL (`Record<View, …>`) n'en est pas une, ni la re-projection locale d'un `ViewArt`, qui n'a
 * pas de forme chaîne. Les sous-ensembles de vues : listes de deux, et projections en clés d'objet de
 * moins de trois vues (#2008). Les formes que `CANON_VIEWS` ne lit pas. La lecture par SOUS-CHAÎNE d'un
 * id de dégradé fixe sans classe après `g_` (`/g_steel/`). La lecture DIRECTE d'une vue sur un art
 * orienté en objet (`art[view]`), qui n'est pas une projection. Une table keyée par vue remplie
 * par une boucle (`for (const v of VIEWS) o[v] = …`). Des appels frères, un par vue, hors des arguments
 * d'un appel, d'un tableau littéral et des instructions d'un bloc : en substitutions d'un gabarit
 * (`` `${f('front')}${f('profile')}${f('back')}` ``), en opérandes d'une concaténation, en enfants d'un
 * élément JSX. Un tableau d'objets à propriété de vue (`{ label: VIEW_LABEL[view], view }`) :
 * `CANON_VIEWS` ne lit pas les valeurs d'un objet. Une liste des vues écrite dans une chaîne
 * (`'front,profile,back'.split(',')`) : `CANON_VIEWS` ne lit pas le texte d'un littéral.
 */
import * as ts from 'typescript/unstable/ast';
import { recopieDeCanon, type ConstructionGardee } from './canonUnique.mjs';
import { VIEWS } from '../../../src/gameIso/facing';

export const MODULE = 'scripts/guards/lib/lecturesDeLArt.ts';
/** La garde, dans le foyer de chaque construction. */
export const GARDE = 'src/lectures-de-l-art-guard.test.ts';

/** Les formes de liste que lit `CANON_VIEWS`. */
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
    c.forEachChild(walk);
  };
  walk(zone);
  return lu;
}

/** Vrai si le sous-arbre nomme une vue (identifiant, chaîne ou nom de propriété). */
function nommeUneVue(zone: ts.Node, vues: readonly string[]): boolean {
  let nomme = false;
  const walk = (c: ts.Node) => {
    if (nomme) return;
    if ((ts.isIdentifier(c) || ts.isStringLiteralLikeNode(c)) && vues.includes(c.text)) nomme = true;
    c.forEachChild(walk);
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
      ts.isBinaryExpression(c) && ts.isTypeOfExpression(c.left) && ts.isStringLiteralLikeNode(c.right)
      && c.right.text === 'string' && OPERATEURS_EGAL.includes(c.operatorToken.kind)
    ) out.push(recepteur(c.left.expression, sf));
    c.forEachChild(walk);
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
    if (e.arguments.some((a) => ts.isStringLiteralLikeNode(a) && a.text === vue)) return true;
    if (e.arguments.some((a) => { const l = vueLue(a, sf, vues); return l != null && l[1] === vue; })) return e.expression.getText(sf);
  }
  return false;
}

/** Projection en CLÉS D'OBJET : toutes les vues en clés, chacune lue ou calculée depuis sa clé. */
function projectionEnCles(n: ts.ObjectLiteralExpression, sf: ts.SourceFile, vues: readonly string[]): boolean {
  const parCle = new Map<string, ts.Expression>();
  for (const p of n.properties) if (ts.isPropertyAssignment(p) && (('name' in p && ts.isIdentifier(p.name)) || ts.isStringLiteral(p.name))) parCle.set(p.name.text, p.initializer);
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
    const vuesLues = appel.arguments.filter((a) => ts.isStringLiteralLikeNode(a) && vues.includes(a.text));
    if (vuesLues.length !== 1) continue;
    const vue = (vuesLues[0] as ts.StringLiteralLikeNode).text;
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
      if (ts.isFunctionLikeDeclaration(n) && projetteSousTestDeChaine(n, sf, vues)) {
        let interne = true;
        const walk = (c: ts.Node) => {
          if (!interne) return;
          if (ts.isFunctionLikeDeclaration(c) && projetteSousTestDeChaine(c, sf, vues)) interne = false;
          c.forEachChild(walk);
        };
        n.forEachChild(walk);
        if (interne) return 'projection de vues sous `typeof` chaîne (`nearestView`, `viewArt.ts`)';
      }
      if (ts.isBinaryExpression(n) && ts.isTypeOfExpression(n.left) && ts.isStringLiteralLikeNode(n.right)) {
        const op = n.operatorToken.kind;
        const duale = (n.right.text === 'object' && OPERATEURS_EGAL.includes(op)) || (n.right.text === 'string' && OPERATEURS_DIFFERENT.includes(op));
        if (duale) {
          let haut: ts.Node = n;
          while (haut.parent && (ts.isBinaryExpression(haut.parent) || ts.isConditionalExpression(haut.parent) || ts.isParenthesizedExpression(haut.parent))) haut = haut.parent;
          const zone = haut.parent && ts.isIfStatement(haut.parent) ? haut.parent : haut;
          if (litUneVueSur(zone, recepteur(n.left.expression, sf), sf, vues, false)) return 'projection de vues sous `typeof` objet (`nearestView`, `viewArt.ts`)';
        }
      }
      if (ts.isArrayLiteralExpression(n)) {
        const lues = n.elements.map((e) => vueLue(e, sf, vues)).filter((l): l is [string, string] => l != null);
        const parRecepteur = new Map<string, Set<string>>();
        for (const [x, v] of lues) parRecepteur.set(x, (parRecepteur.get(x) ?? new Set()).add(v));
        if ([...parRecepteur.values()].some((vus) => vues.every((v) => vus.has(v)))) return 'vues d’un art listées en tableau (`VIEWS`, `facing.ts`)';
        if (appelsFreres(n.elements, sf, vues)) return 'appels frères, un par vue (`VIEWS.map`)';
      }
      if (ts.isObjectLiteralExpression(n) && projectionEnCles(n, sf, vues)) return 'projection de vues en clés d’objet (`tableTotale(VIEWS, …)`, `viewArt.ts`)';
      if (ts.isCallExpression(n) && appelsFreres(n.arguments, sf, vues)) return 'appels frères, un par vue (`VIEWS.map`)';
      if (ts.isBlock(n) && appelsFreres(n.statements, sf, vues)) return 'appels frères, un par vue (`VIEWS.map`)';
      return null;
    },
  };
}

const PROJECTION_DE_VUES = { ...projectionDeVues(VIEWS), foyer: ['src/gameIso/catalog/viewArt.ts', MODULE, GARDE] } satisfies ConstructionGardee;

const REGEX_DE_DEGRADE_FIXE = {
  ...regexReservee('REGEX_DE_DEGRADE_FIXE', /g_(\\w|\[)/, 'préfixe de dégradé fixe (`FX_GRADIENT_IDS`, `fxGradients.ts`)', (t) => t.includes('g_')),
  foyer: [MODULE, GARDE],
} satisfies ConstructionGardee;

const CANON_VIEWS = {
  ...recopieDeCanon({ nom: 'VIEWS', membres: VIEWS, complet: true, formes: FORMES_DES_LISTES }),
  foyer: ['src/gameIso/facing.ts', MODULE, GARDE],
} satisfies ConstructionGardee;

/** Les trois lectures de l'art, dans l'ordre de leurs motifs. */
export const LECTURES_DE_L_ART: readonly ConstructionGardee[] = [
  PROJECTION_DE_VUES,
  REGEX_DE_DEGRADE_FIXE,
  CANON_VIEWS,
];
