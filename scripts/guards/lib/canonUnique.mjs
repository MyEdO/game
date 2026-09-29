// Scan des CONSTRUCTIONS RÉSERVÉES (#1440, #2007) — TypeScript compiler API, jamais une regex de
// ligne (une recopie multi-ligne échappe à tout motif de ligne) et jamais un scan par NOM (une copie
// s'appelle rarement comme le canon). UN scan, `scanConstructionsReservees(fichier, constructions)` :
// une déclaration gardée hors de son foyer, reconnue sur chaque nœud par son prédicat `reconnait`,
// après son `indice` (le coupe-circuit qui évite le parse quand elle ne peut pas apparaître dans le
// texte) ; une trouvaille par ligne et par construction. `constructionsReserveesDuCorpus` en est la
// lecture sur un corpus.
// Une déclaration porte un `foyer` et un `domaine`, que lit `sAppliqueA` (`sourceCorpus.mjs`) : le
// scan ne cherche une construction que dans un fichier où elle s'applique, et ne prend aucune autre
// exemption. Ce module exporte la MÉCANIQUE, sans foyer ; le consommateur la déclare en y joignant son
// foyer (`{ ...FORMULE_DE_CHEBYSHEV, foyer: 'src/engine/grid.ts' }`) :
//  - les constructions génériques `FORMULE_DE_CHEBYSHEV`, `ECHAPPEUR_DE_LITTERAL`,
//    `CONSTRUCTION_DE_PROGRAMME`, `ECRITURE_DE_STOCK_JSON` et `CONSTRUCTION_DE_TABLE_TOTALE` ;
//  - deux fabriques : `recopieDeCanon` (un canon, ses membres, six formes de recopie, paramètres
//    `complet` et `formes`, la forme `membres de type` lisant un type littéral comme une `interface`)
//    et `cleEnLigne` (la clé d'un site de stock écrite en ligne) ;
//  - `estAppelDeclare`, la reconnaissance d'un appel à une fonction déclarée par son module, sur la
//    liaison `origineImportee` et la table `tableDesExports` ;
//  - `estTableTotale`, la reconnaissance d'une table totale déclarée, que lit aussi
//    `registryIdBranch.mjs`.
// Le parse est `ast` (`dialecte.mjs`). Ce scan est l'hôte des constructions réservées que ses
// appelants déclarent ; les verrous ESLint du même concept sont #2019.
import ts from 'typescript';
import { join, relative } from 'node:path';
import { ast } from './dialecte.mjs';
import { sAppliqueA } from './sourceCorpus.mjs';
import { RACINE } from './bindingsVivants.mjs';
import { resolveImport } from './importGraph.mjs';
// Clôture statique chargeable sous un Node refusé : scripts/node-requis.mjs (#1801).
const { echapperRegex } = await import('../../../src/lib/regex.ts');

/** @param {ts.SourceFile} sf @param {ts.Node} n @returns {number} ligne 1-based */
const lineOf = (sf, n) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;

/** Nom d'une clé de propriété (identifiant, chaîne, clé calculée littérale). `null` si dynamique.
 * @param {ts.PropertyName | undefined} name @returns {string | null} */
function keyName(name) {
  if (!name) return null;
  if (ts.isIdentifier(name) || ts.isStringLiteral(name)) return name.text;
  if (ts.isComputedPropertyName(name) && ts.isStringLiteralLike(name.expression)) return name.expression.text;
  return null;
}

/** Texte d'un type littéral de chaîne (`'a'` dans une union) ; `null` sinon.
 * @param {ts.TypeNode} t @returns {string | null} */
const litType = (t) => (ts.isLiteralTypeNode(t) && ts.isStringLiteralLike(t.literal) ? t.literal.text : null);

/** SCHÉMAS DÉRIVÉS du canon, par module qui les exporte : les seuls récepteurs dont un
 *  `.extract(…)`/`.exclude(…)` SÉLECTIONNE dans le canon (leurs options SONT le tuple, cf.
 *  `src/data/schemas/grammaire/valeurs.ts`). Un `.extract` posé sur n'importe quel autre objet ne
 *  prouve rien — il ne blanchit donc rien.
 * @type {Readonly<Record<string, readonly string[]>>} */
export const SCHEMAS_DU_CANON = Object.freeze({
  'src/data/schemas/grammaire/valeurs.ts': ['availabilitySchema', 'stakeFormSchema', 'harvestRaritySchema'],
});

/** Le tableau est-il l'argument d'un `.extract(…)`/`.exclude(…)` posé sur un schéma DU canon ? zod
 *  type cet argument par les options du récepteur : sur un schéma du canon, un palier renommé ne
 *  compile plus. Le récepteur est donc vérifié par sa LIAISON (`origineImportee`, import renommé
 *  compris) à un export de `SCHEMAS_DU_CANON` — sinon n'importe quel `truc.extract(['Commune',
 *  'Rare'])`, ou un homonyme local du schéma, se blanchirait tout seul.
 *  HORS DE PORTÉE (vus comme recopie) : le schéma lu dans son module déclarant, par un espace de noms
 *  (`v.availabilitySchema`) ou par un alias local ; un nom local qui masque l'import est confondu avec
 *  lui (la liaison se tient par NOM).
 * @param {ts.ArrayLiteralExpression} n @param {ts.SourceFile} sf @returns {boolean} */
function estSelectionDerivee(n, sf) {
  const p = n.parent;
  if (!p || !ts.isCallExpression(p) || p.arguments[0] !== n) return false;
  const cible = p.expression;
  if (!ts.isPropertyAccessExpression(cible)) return false;
  if (cible.name.text !== 'extract' && cible.name.text !== 'exclude') return false;
  // Récepteur : le schéma nu, ou une chaîne de dérivations qui en part (`x.extract([…]).optional()`).
  let recepteur = cible.expression;
  for (;;) {
    if (ts.isCallExpression(recepteur)) { recepteur = recepteur.expression; continue; }
    if (ts.isPropertyAccessExpression(recepteur)) { recepteur = recepteur.expression; continue; }
    break;
  }
  if (!ts.isIdentifier(recepteur)) return false;
  const origine = origineImportee(recepteur.text, sf);
  return !!origine && (SCHEMAS_DU_CANON[origine.module] ?? []).includes(origine.nom);
}

/** Clés OUVERTES d'un `Record` : celles dont le compilateur n'exige aucune complétude. */
const CLES_OUVERTES = new Set([ts.SyntaxKind.StringKeyword, ts.SyntaxKind.NumberKeyword, ts.SyntaxKind.SymbolKeyword, ts.SyntaxKind.AnyKeyword, ts.SyntaxKind.UnknownKeyword]);

/** @param {ts.TypeNode} t @returns {boolean} */
function estCleOuverte(t) {
  if (CLES_OUVERTES.has(t.kind)) return true;
  if (ts.isUnionTypeNode(t)) return t.types.some(estCleOuverte);
  if (ts.isParenthesizedTypeNode(t)) return estCleOuverte(t.type);
  if (ts.isTemplateLiteralTypeNode(t)) return t.templateSpans.some((s) => estCleOuverte(s.type));
  return false;
}

/** @param {ts.TypeNode | undefined} t @returns {boolean} */
function estRecordACleFermee(t) {
  while (t && ts.isTypeReferenceNode(t) && ts.isIdentifier(t.typeName) && ['Partial', 'Readonly', 'Required'].includes(t.typeName.text) && t.typeArguments?.length === 1) t = t.typeArguments[0];
  if (!t || !ts.isTypeReferenceNode(t) || !ts.isIdentifier(t.typeName) || t.typeName.text !== 'Record' || t.typeArguments?.length !== 2) return false;
  return !estCleOuverte(t.typeArguments[0]);
}

/**
 * TABLE TOTALE DÉCLARÉE : l'expression d'une table (un objet littéral, ou le nom qui en tient un)
 * dont le type déclaré — remonté par les parenthèses et `as const` : le type du `satisfies` qui
 * l'enveloppe, sinon l'annotation de la variable, de la propriété ou du paramètre dont elle est la
 * valeur — est, passé `Partial`, `Readonly` et `Required`, un `Record` à clé FERMÉE : toute clé sauf
 * `string`, `number`, `symbol`, `any` et `unknown`, et sauf une union ou un gabarit qui en contient
 * une. Ce ne sont pas des membres re-tapés mais les clés d'une table que le COMPILATEUR exige
 * complètes (aucune exhaustivité exigée d'une clé ouverte). Une assertion (`{…} as Record<…>`) ne
 * vérifie pas les clés manquantes et n'en fait pas une.
 * Angle mort : un `Record<Alias, …>` dont `Alias` vaut `string` passe ici sans que le compilateur
 * exige ses clés ; le voir demande un checker de types, pas un AST.
 * @param {ts.Expression} valeur @returns {boolean}
 */
export function estTableTotale(valeur) {
  let n = valeur;
  while (n.parent && (ts.isParenthesizedExpression(n.parent) || (ts.isAsExpression(n.parent) && ts.isConstTypeReference(n.parent.type)))) n = n.parent;
  const p = n.parent;
  if (!p) return false;
  if (ts.isSatisfiesExpression(p)) return estRecordACleFermee(p.type);
  if ((ts.isVariableDeclaration(p) || ts.isPropertySignature(p) || ts.isPropertyDeclaration(p) || ts.isParameter(p)) && p.type) return estRecordACleFermee(p.type);
  return false;
}

const LOGIQUES = new Set([ts.SyntaxKind.BarBarToken, ts.SyntaxKind.AmpersandAmpersandToken]);
const EGALITES = new Set([
  ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken,
  ts.SyntaxKind.EqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsToken,
]);

/** Chaîne de comparaisons `a === 'x' || a === 'y'` : les littéraux comparés par ÉGALITÉ dans tout le
 *  sous-arbre `||`/`&&`. Le nœud n'est traité qu'en TÊTE de chaîne (son parent n'est pas `||`/`&&`).
 * @param {ts.BinaryExpression} n @returns {string[] | null} */
function litterauxDeChaine(n) {
  if (!LOGIQUES.has(n.operatorToken.kind)) return null;
  const p = n.parent;
  if (p && ts.isBinaryExpression(p) && LOGIQUES.has(p.operatorToken.kind)) return null;
  const vus = [];
  /** @param {ts.Node} x */
  const walk = (x) => {
    if (ts.isBinaryExpression(x) && EGALITES.has(x.operatorToken.kind)) {
      for (const cote of [x.left, x.right]) if (ts.isStringLiteralLike(cote)) vus.push(cote.text);
    }
    ts.forEachChild(x, walk);
  };
  walk(n);
  return vus;
}

/** Les six formes SYNTAXIQUES d'une recopie de canon, lues sur un nœud : le nom de la forme et les
 *  membres qu'il reproduit, ou `null` si le nœud n'est d'aucune. Deux formes que le compilateur borne
 *  n'en sont pas : la sélection zod `.extract` sur un schéma du canon (`estSelectionDerivee`) et la
 *  table totale déclarée (`estTableTotale`).
 * @param {ts.Node} n @param {ts.SourceFile} sf @returns {{ forme: string, membres: (string | null)[] } | null} */
function formeDeRecopie(n, sf) {
  if (ts.isArrayLiteralExpression(n)) {
    return estSelectionDerivee(n, sf) ? null : { forme: 'tableau', membres: n.elements.filter(ts.isStringLiteralLike).map((e) => e.text) };
  }
  if (ts.isUnionTypeNode(n)) return { forme: 'union de types', membres: n.types.map(litType) };
  if (ts.isObjectLiteralExpression(n)) {
    return estTableTotale(n) ? null : { forme: 'clés d’objet', membres: n.properties.map((p) => keyName(p.name)) };
  }
  if (ts.isTypeLiteralNode(n) || ts.isInterfaceDeclaration(n)) return { forme: 'membres de type', membres: n.members.map((m) => keyName(m.name)) };
  if (ts.isCaseBlock(n)) {
    return { forme: 'case d’un switch', membres: n.clauses.flatMap((c) => (ts.isCaseClause(c) && ts.isStringLiteralLike(c.expression) ? [c.expression.text] : [])) };
  }
  if (ts.isBinaryExpression(n)) {
    const lits = litterauxDeChaine(n);
    return lits ? { forme: 'chaîne de comparaisons', membres: lits } : null;
  }
  return null;
}

/** Les noms des six formes de recopie que lit `recopieDeCanon`. @type {readonly string[]} */
export const FORMES_DE_RECOPIE = Object.freeze(['tableau', 'union de types', 'clés d’objet', 'membres de type', 'case d’un switch', 'chaîne de comparaisons']);

/**
 * Mécanique de la RECOPIE d'un tuple canon, construction réservée : un nœud d'une forme retenue qui
 * reproduit au moins deux membres DISTINCTS du canon (TOUS sous `complet`) — divergente ou non, c'est
 * la duplication qui est la faute. La déclaration y joint son foyer.
 * @param {{ nom: string, membres: readonly string[], complet?: boolean, formes?: readonly string[] }} p
 *   `nom` celui du canon ; `formes` un sous-ensemble de `FORMES_DE_RECOPIE` (une forme inconnue lève).
 * @returns {{ nom: string, indice: (texte: string) => boolean, reconnait: (noeud: ts.Node, sf: ts.SourceFile) => string | null }}
 */
export function recopieDeCanon({ nom, membres, complet = false, formes = FORMES_DE_RECOPIE }) {
  const inconnues = formes.filter((f) => !FORMES_DE_RECOPIE.includes(f));
  if (inconnues.length) throw new Error(`recopieDeCanon(${nom}) : forme(s) inconnue(s) ${inconnues.join(', ')} (attendu : ${FORMES_DE_RECOPIE.join(', ')})`);
  const canon = new Set(membres);
  const retenues = new Set(formes);
  const present = (texte, m) => texte.includes(`'${m}'`) || texte.includes(`"${m}"`) || new RegExp(`(^|[^\\w$.'"])${m}\\s*[:?]`, 'm').test(texte);
  return {
    nom,
    indice: (texte) => [...canon].filter((m) => present(texte, m)).length >= 2,
    reconnait: (noeud, sf) => {
      const lue = formeDeRecopie(noeud, sf);
      if (!lue || !retenues.has(lue.forme)) return null;
      const communs = [...new Set(lue.membres.filter((m) => m != null))].filter((m) => canon.has(m));
      if (communs.length < 2 || (complet && communs.length < canon.size)) return null;
      return `${nom} recopiée en ${lue.forme} (${communs.map((m) => `'${m}'`).join(', ')})`;
    },
  };
}

/** Axes touchés par un côté de soustraction : nom de propriété (`p.x`) ou identifiant nu (`x`).
 * @param {ts.Node} n @returns {Set<string>} */
function axes(n) {
  const out = new Set();
  /** @param {ts.Node} x */
  const walk = (x) => {
    if (ts.isPropertyAccessExpression(x)) out.add(x.name.text);
    else if (ts.isIdentifier(x)) out.add(x.text);
    ts.forEachChild(x, walk);
  };
  walk(n);
  return out;
}

/** SCALAIRES NOMMÉS PAR L'AXE : `x1 - x0`, `xa - xb` — la soustraction de deux identifiants dont les
 *  noms commencent par la MÊME lettre d'axe (`x`/`y`) mesure bien cet axe, sans point ni `.x`. Les
 *  DEUX opérandes sont exigés (un seul suffixé laisserait passer `yaw - x0`).
 * @param {ts.Node} arg @returns {string | null} */
function axeDeScalaires(arg) {
  if (!ts.isBinaryExpression(arg) || arg.operatorToken.kind !== ts.SyntaxKind.MinusToken) return null;
  const lettre = (e) => (ts.isIdentifier(e) ? (/^([xy])[0-9A-Za-z_$]*$/.exec(e.text)?.[1] ?? null) : null);
  const g = lettre(arg.left), d = lettre(arg.right);
  return g && g === d ? g : null;
}

/** `Math.abs(<quoi que ce soit>)` → les axes portés par l'argument. La soustraction n'est PAS exigée :
 *  l'écart est souvent PRÉ-CALCULÉ (`Math.abs(dx)`, `Math.abs(delta.x)`, boucle d'anneau) et c'est la
 *  même mesure. `null` si ce n'est pas un `Math.abs(…)` à un argument.
 * @param {ts.Expression} n @returns {Set<string> | null} */
function absDelta(n) {
  if (!ts.isCallExpression(n) || n.arguments.length !== 1) return null;
  const f = n.expression;
  if (!ts.isPropertyAccessExpression(f) || f.name.text !== 'abs' || !ts.isIdentifier(f.expression) || f.expression.text !== 'Math') return null;
  const arg = n.arguments[0];
  const out = axes(arg);
  const scalaire = axeDeScalaires(arg);
  if (scalaire) out.add(scalaire);
  return out;
}

/** Les DEUX arguments d'un `Math.max` portent-ils les deux axes du plan, l'un chacun ? Trois
 *  vocabulaires reconnus, et trois seulement : les composantes `.x`/`.y` (points, deltas d'objet), les
 *  écarts nommés `dx`/`dy` (boucles d'anneau, supercover) et les scalaires nommés par l'axe
 *  (`x1 - x0`, cf. `axeDeScalaires`). `z` n'en fait pas partie : une distance verticale n'est pas la
 *  métrique de la grille.
 * @param {Set<string>} a @param {Set<string>} b @returns {boolean} */
const paireDAxes = (a, b) => [['x', 'y'], ['dx', 'dy']].some(([u, v]) => (a.has(u) && b.has(v)) || (a.has(v) && b.has(u)));

/**
 * La FORMULE de la distance de Chebyshev recopiée en ligne : `Math.max(Math.abs(a.x - b.x),
 * Math.abs(a.y - b.y))`, ses commutations (ordre des axes, ordre des opérandes, opérandes nus ou
 * propriétés) ET sa forme à écarts PRÉ-CALCULÉS (`Math.max(Math.abs(dx), Math.abs(dy))`, où la
 * soustraction a eu lieu plus haut — la mesure est la même). Le NOM n'entre pas dans la
 * reconnaissance : `cheb`, `dist`, ou aucun nom du tout, c'est la même recopie du canon `chebyshev`.
 */
export const FORMULE_DE_CHEBYSHEV = Object.freeze({
  nom: 'FORMULE_DE_CHEBYSHEV',
  indice: (texte) => texte.includes('Math.abs'),
  /** @param {ts.Node} n @returns {string | null} */
  reconnait: (n) => {
    if (!ts.isCallExpression(n) || n.arguments.length !== 2) return null;
    const f = n.expression;
    if (!ts.isPropertyAccessExpression(f) || f.name.text !== 'max' || !ts.isIdentifier(f.expression) || f.expression.text !== 'Math') return null;
    const a = absDelta(n.arguments[0]);
    const b = absDelta(n.arguments[1]);
    return a && b && paireDAxes(a, b) ? 'formule de Chebyshev recopiée inline' : null;
  },
});

/** L'appel `<récepteur>.<méthode>(…)` : son récepteur et ses arguments, ou `null` si `n` n'est pas un
 *  appel de cette méthode. @param {ts.Node} n @param {string} methode
 * @returns {{ recepteur: ts.Expression, args: ts.NodeArray<ts.Expression> } | null} */
function appelDeMethode(n, methode) {
  if (!ts.isCallExpression(n) || !ts.isPropertyAccessExpression(n.expression) || n.expression.name.text !== methode) return null;
  return { recepteur: n.expression.expression, args: n.arguments };
}

/** L'ÉCHAPPEUR du guillemet simple d'un littéral JS écrit à la main : un appel `.replace(/'/g, "\\'")`
 *  (#2007). `JSON.stringify` d'une chaîne n'en est pas un : son échappement est celui de la plateforme. */
export const ECHAPPEUR_DE_LITTERAL = Object.freeze({
  nom: 'ECHAPPEUR_DE_LITTERAL',
  indice: (texte) => texte.includes('.replace('),
  /** @param {ts.Node} n @returns {string | null} */
  reconnait: (n) => {
    const appel = appelDeMethode(n, 'replace');
    if (!appel) return null;
    const [motif, remplacement] = appel.args;
    if (!motif || !ts.isRegularExpressionLiteral(motif) || !/^\/'\/[a-z]*g[a-z]*$/.test(motif.text)) return null;
    return remplacement && ts.isStringLiteralLike(remplacement) && remplacement.text === "\\'" ? 'échappeur de littéral JS recopié (`litteralJs`)' : null;
  },
});

/** Nom exporté par le compilateur d'une fabrique de `ts.Program` (`createProgram`,
 *  `createIncrementalProgram`, `createWatchProgram`, `create*BuilderProgram`) ou d'un
 *  `ts.LanguageService`, qui construit le sien (`getProgram()`). */
const FABRIQUE_DE_PROGRAMME = /^create(\w*Program|LanguageService)$/;

/**
 * La CONSTRUCTION d'un `ts.Program` (#1806) : un appel dont l'appelé est une fabrique du paquet
 * `typescript` (`liaisonDAppele`, l'import par défaut du paquet valant son espace de noms) — les
 * fabriques partagées sont celles de `tsProgram.mjs`. Un homonyme local, un membre d'un autre objet et
 * un appel écrit dans un littéral (fixture de morsure) ne sont pas lus.
 * HORS DE PORTÉE : l'accès calculé (`ts['createProgram']`), la déstructuration (`const { createProgram:
 * fab } = ts`), l'alias de membre (`const creer = ts.createProgram`), le compilateur reçu par un
 * paramètre, `require('typescript')`, `import ts = require(…)` et `import('typescript')` ; un nom local
 * qui masque l'import est confondu avec lui (la liaison se tient par NOM, `liaisonDe`).
 */
export const CONSTRUCTION_DE_PROGRAMME = Object.freeze({
  nom: 'CONSTRUCTION_DE_PROGRAMME',
  indice: (texte) => /create(\w*Program|LanguageService)/.test(texte),
  /** @param {ts.Node} n @param {ts.SourceFile} sf @returns {string | null} */
  reconnait: (n, sf) => {
    if (!ts.isCallExpression(n)) return null;
    const l = liaisonDAppele(n.expression, sf, ['*', 'default']);
    const nom = l?.spec === 'typescript' ? l.nom : null;
    return nom && FABRIQUE_DE_PROGRAMME.test(nom) ? `\`${nom}\` hors des fabriques (\`tsProgram.mjs\`)` : null;
  },
});

/** L'ÉCRITURE du format JSON des stocks de sites recopiée : un appel `JSON.stringify(<objet
 *  littéral>, …)` dont l'objet porte une propriété `entrees`, avec `quoi`, avec une propagation ou seule. */
export const ECRITURE_DE_STOCK_JSON = Object.freeze({
  nom: 'ECRITURE_DE_STOCK_JSON',
  indice: (texte) => texte.includes('JSON.stringify'),
  /** @param {ts.Node} n @returns {string | null} */
  reconnait: (n) => {
    const appel = appelDeMethode(n, 'stringify');
    if (!appel || !ts.isIdentifier(appel.recepteur) || appel.recepteur.text !== 'JSON') return null;
    const objet = appel.args[0];
    if (!objet || !ts.isObjectLiteralExpression(objet)) return null;
    return objet.properties.some((p) => keyName(p.name) === 'entrees') ? 'écriture du format JSON des stocks recopiée (`texteDeStock`)' : null;
  },
});

/** Expression privée de ses parenthèses, casts et `satisfies`. @param {ts.Expression} e @returns {ts.Expression} */
function sansEnveloppe(e) {
  while (ts.isParenthesizedExpression(e) || ts.isAsExpression(e) || ts.isSatisfiesExpression(e) || ts.isTypeAssertionExpression(e) || ts.isNonNullExpression(e)) e = e.expression;
  return e;
}

/** Les expressions que rend une fonction : son corps expression, ou les `return` de son corps (hors
 *  fonctions imbriquées). @param {ts.ArrowFunction | ts.FunctionExpression} f @returns {ts.Expression[]} */
function rendusDe(f) {
  if (!ts.isBlock(f.body)) return [f.body];
  const out = [];
  /** @param {ts.Node} x */
  const walk = (x) => {
    if (ts.isFunctionLike(x)) return;
    if (ts.isReturnStatement(x) && x.expression) out.push(x.expression);
    ts.forEachChild(x, walk);
  };
  ts.forEachChild(f.body, walk);
  return out;
}

/** La TABLE TOTALE construite en ligne : `Object.fromEntries(<liste>.map(<fonction>))` dont la
 *  fonction, au premier paramètre identifiant `p`, rend `[p, …]` — la table keyée par les éléments
 *  d'une liste, que construit `tableTotale` (`src/lib/tableTotale.ts`). */
export const CONSTRUCTION_DE_TABLE_TOTALE = Object.freeze({
  nom: 'CONSTRUCTION_DE_TABLE_TOTALE',
  indice: (texte) => texte.includes('fromEntries'),
  /** @param {ts.Node} n @returns {string | null} */
  reconnait: (n) => {
    const appel = appelDeMethode(n, 'fromEntries');
    if (!appel || !ts.isIdentifier(appel.recepteur) || appel.recepteur.text !== 'Object' || appel.args.length !== 1) return null;
    const carte = appelDeMethode(sansEnveloppe(appel.args[0]), 'map');
    const f = carte?.args[0];
    if (!f || !(ts.isArrowFunction(f) || ts.isFunctionExpression(f))) return null;
    const p = f.parameters[0]?.name;
    if (!p || !ts.isIdentifier(p)) return null;
    const keyee = rendusDe(f).some((r) => {
      const paire = sansEnveloppe(r);
      if (!ts.isArrayLiteralExpression(paire) || paire.elements.length !== 2) return false;
      const cle = sansEnveloppe(paire.elements[0]);
      return ts.isIdentifier(cle) && cle.text === p.text;
    });
    return keyee ? 'table totale construite en ligne (`tableTotale`)' : null;
  },
});

/** L'import de tête de `sf` qui lie le nom LOCAL `identifiant` : son spécificateur, non résolu, et le
 *  nom qu'il importe (`'default'`, `'*'`, ou le nom exporté).
 * @param {string} identifiant @param {ts.SourceFile} sf @returns {{ spec: string, nom: string } | null} */
function liaisonDe(identifiant, sf) {
  for (const st of sf.statements) {
    if (!ts.isImportDeclaration(st) || !ts.isStringLiteral(st.moduleSpecifier) || !st.importClause) continue;
    const spec = st.moduleSpecifier.text;
    const clause = st.importClause;
    if (clause.name?.text === identifiant) return { spec, nom: 'default' };
    const b = clause.namedBindings;
    if (b && ts.isNamespaceImport(b) && b.name.text === identifiant) return { spec, nom: '*' };
    if (b && ts.isNamedImports(b)) {
      for (const el of b.elements) if (el.name.text === identifiant) return { spec, nom: (el.propertyName ?? el.name).text };
    }
  }
  return null;
}

/** La liaison d'import d'un APPELÉ (`liaisonDe`) : un identifiant, ou `x.f` sur un `x` dont
 *  l'import est l'un des `espaces` (`'*'`, `'default'`) — `nom` est alors le membre `f`.
 * @param {ts.Expression} e @param {ts.SourceFile} sf @param {readonly string[]} espaces
 * @returns {{ spec: string, nom: string } | null} */
function liaisonDAppele(e, sf, espaces) {
  if (ts.isIdentifier(e)) return liaisonDe(e.text, sf);
  if (!ts.isPropertyAccessExpression(e) || !ts.isIdentifier(e.expression)) return null;
  const l = liaisonDe(e.expression.text, sf);
  return l && espaces.includes(l.nom) ? { spec: l.spec, nom: e.name.text } : null;
}

/** Le module, relatif à la racine, qu'un spécificateur de `sf` désigne (`resolveImport`), ou `null`.
 * @param {string} spec @param {ts.SourceFile} sf @returns {string | null} */
function moduleDe(spec, sf) {
  const abs = resolveImport(join(RACINE, sf.fileName), spec);
  return abs ? relative(RACINE, abs).split('\\').join('/') : null;
}

/**
 * LIAISON d'un nom local à son origine importée : parmi les `import` de tête du fichier, celui qui lie
 * `identifiant` — spécificateur nommé renommé ou non (`nom` : le nom EXPORTÉ), `import type` et
 * spécificateur `type` compris, espace de noms (`nom` : `'*'`) ou import par défaut (`nom` :
 * `'default'`) —, son spécificateur résolu par `resolveImport` depuis la RACINE du dépôt (le chemin
 * relatif que porte `sf.fileName`), jamais depuis le répertoire courant.
 * @param {string} identifiant @param {ts.SourceFile} sf
 * @returns {{ module: string, nom: string } | null} `module` relatif à la racine, séparateurs `/`,
 *   extension comprise ; `null` pour un nom qu'aucun import de tête ne lie, ou dont le spécificateur
 *   ne se résout pas (paquet, alias `@/`, fichier absent).
 */
export function origineImportee(identifiant, sf) {
  const l = liaisonDe(identifiant, sf);
  const module = l && moduleDe(l.spec, sf);
  return module ? { module, nom: l.nom } : null;
}

/**
 * APPEL à une fonction DÉCLARÉE par son module : un callee `f` lié par un import nommé (renommé ou
 * non ; le nom exporté fait foi) ou `ns.f` sur un `import * as ns`, dont l'origine est une clé de
 * `fonctions` qui liste ce nom exporté. Un homonyme local, une fonction d'un autre module ou une
 * liaison non importée ne comptent pas.
 * @param {ts.CallExpression} appel @param {ts.SourceFile} sf
 * @param {Readonly<Record<string, readonly string[]>>} fonctions `{ '<module relatif à la racine>': ['<nom exporté>', …] }`
 * @returns {string | null} le nom exporté que l'appel lie, `null` s'il n'en lie aucun de la table.
 */
export function estAppelDeclare(appel, sf, fonctions) {
  const liaison = liaisonDAppele(appel.expression, sf, ['*']);
  const nom = liaison?.nom;
  if (!nom || !Object.values(fonctions).some((noms) => noms.includes(nom))) return null;
  const module = moduleDe(liaison.spec, sf);
  return module && (fonctions[module] ?? []).includes(nom) ? nom : null;
}

/**
 * TABLE DES EXPORTS de fichiers lus : `{ '<rel>': ['<nom exporté>', …] }`, les exports déclarés
 * (`export function f`, `export const f = (…) => …`) ou réexportés (`export { a, b as c } from '…'`,
 * sous le nom qu'ils exportent) dont le nom d'origine est dans `noms` ; un fichier sans tel export n'a
 * pas de clé. L'autre côté de la liaison d'`origineImportee` : aucun import n'y est lu.
 * Angle mort : une réexportation `export * from` n'y entre pas.
 * @param {readonly Pick<import('./sourceCorpus.mjs').CorpusFile, 'rel' | 'text'>[]} fichiers
 * @param {Iterable<string>} noms lu une fois
 * @returns {Record<string, string[]>}
 */
export function tableDesExports(fichiers, noms) {
  const retenus = new Set(noms);
  /** @type {Record<string, string[]>} */
  const table = {};
  const exporte = (n) => n.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
  for (const fichier of fichiers) {
    const sf = ast(fichier);
    const exportes = [];
    for (const st of sf.statements) {
      if (ts.isFunctionDeclaration(st) && st.name && exporte(st) && retenus.has(st.name.text)) exportes.push(st.name.text);
      if (ts.isVariableStatement(st) && exporte(st)) {
        for (const d of st.declarationList.declarations) {
          if (ts.isIdentifier(d.name) && d.initializer && (ts.isArrowFunction(d.initializer) || ts.isFunctionExpression(d.initializer)) && retenus.has(d.name.text)) exportes.push(d.name.text);
        }
      }
      if (ts.isExportDeclaration(st) && st.exportClause && ts.isNamedExports(st.exportClause)) {
        for (const el of st.exportClause.elements) if (retenus.has((el.propertyName ?? el.name).text)) exportes.push(el.name.text);
      }
    }
    if (exportes.length) table[fichier.rel] = exportes;
  }
  return table;
}

/** Le NOM d'une substitution : accès de propriété (`x.c`, `x!.c`), identifiant (`c`), ou partie
 *  gauche d'un `??`. @param {ts.Expression} e @returns {string | null} */
function nomDe(e) {
  while (ts.isNonNullExpression(e) || ts.isParenthesizedExpression(e) || ts.isAsExpression(e)) e = e.expression;
  if (ts.isBinaryExpression(e) && e.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken) return nomDe(e.left);
  if (ts.isPropertyAccessExpression(e)) return e.name.text;
  if (ts.isIdentifier(e)) return e.text;
  return null;
}

/**
 * Mécanique de la CLÉ D'UN SITE DE STOCK ÉCRITE EN LIGNE, construction réservée. Le prédicat APLATIT
 * chaque littéral de chaîne, gabarit sans substitution et gabarit (une substitution devient `⟨nom⟩`,
 * le nom du champ qui la nomme — `x.c`, `x!.c`, `c`, `c ?? …` —, sinon `⟨?⟩`), et chaque tableau
 * littéral suivi de `.join(<separateur>)` (éléments aplatis joints par le séparateur). Un texte aplati
 * est un site s'il contient :
 *  - une « clé à occurrence » : `separateur`, puis plus loin `separateur` suivi d'un entier ou de
 *    `⟨occurrence⟩`, lui-même suivi de la fin du texte ou de `separateurDeRemede` ;
 *  - un « champ puis occurrence » : `⟨champ⟩` `separateur` `⟨occurrence⟩` ;
 *  - une « clé de groupe » : les champs de `champsDeGroupe`, nommés, dans leur ordre, joints par
 *    `separateur` ;
 *  - une « clé tronquée » avant l'occurrence : `separateur`, puis plus loin `separateur` en fin de
 *    texte.
 * Hors de l'aplatissement, une « clé calculée suivie de son remède » : dans un gabarit, une
 * substitution qui appelle l'une des `fonctionsDeCle` (`estAppelDeclare`), suivie d'un morceau
 * littéral qui commence par `separateurDeRemede`. L'indice est le séparateur, ou, pour cette dernière
 * règle, le séparateur de remède avec le nom d'une fonction de clé (le nom exporté est écrit dans
 * l'import, même renommé).
 * @param {{ nom: string, champsDeGroupe: readonly string[], occurrence: string, separateur: string,
 *   separateurDeRemede: string, fonctionsDeCle: Readonly<Record<string, readonly string[]>> }} p
 * @returns {{ nom: string, indice: (texte: string) => boolean, reconnait: (noeud: ts.Node, sf: ts.SourceFile) => string | null }}
 */
export function cleEnLigne({ nom, champsDeGroupe, occurrence, separateur, separateurDeRemede, fonctionsDeCle }) {
  const ph = (n) => `⟨${n}⟩`;
  const S = echapperRegex(separateur);
  const champs = [...champsDeGroupe, occurrence];
  /** @type {[string, RegExp][]} */
  const regles = [
    ['clé à occurrence', new RegExp(`${S}[^]*?${S}(\\d+|${echapperRegex(ph(occurrence))})(?=$|${echapperRegex(separateurDeRemede)})`)],
    ['champ puis occurrence', new RegExp(`(${champs.map((c) => echapperRegex(ph(c))).join('|')})${S}${echapperRegex(ph(occurrence))}`)],
    ['clé de groupe', new RegExp(champsDeGroupe.map((c) => echapperRegex(ph(c))).join(S))],
    ['clé tronquée', new RegExp(`${S}[^]*?${S}$`)],
  ];
  const nomsDeCle = Object.values(fonctionsDeCle).flat();
  /** @param {ts.Node} n @returns {string | null} */
  const aplati = (n) => {
    if (ts.isTemplateExpression(n)) return n.head.text + n.templateSpans.map((s) => ph(nomDe(s.expression) ?? '?') + s.literal.text).join('');
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) {
      return n.parent && (ts.isImportDeclaration(n.parent) || ts.isExportDeclaration(n.parent)) ? null : n.text;
    }
    const jointure = appelDeMethode(n, 'join');
    if (!jointure || !ts.isArrayLiteralExpression(jointure.recepteur)) return null;
    const sep = jointure.args[0];
    if (!sep || !ts.isStringLiteralLike(sep) || sep.text !== separateur) return null;
    return jointure.recepteur.elements.map((e) => (ts.isStringLiteralLike(e) ? e.text : ph(nomDe(e) ?? '?'))).join(separateur);
  };
  return {
    nom,
    indice: (texte) => texte.includes(separateur) || (texte.includes(separateurDeRemede) && nomsDeCle.some((f) => texte.includes(f))),
    reconnait: (n, sf) => {
      if (ts.isTemplateExpression(n)) {
        for (const span of n.templateSpans) {
          if (span.literal.text.startsWith(separateurDeRemede) && ts.isCallExpression(span.expression) && estAppelDeclare(span.expression, sf, fonctionsDeCle)) {
            return `${nom} : clé calculée suivie de son remède`;
          }
        }
      }
      const texte = aplati(n);
      if (texte == null) return null;
      const lues = regles.filter(([, rx]) => rx.test(texte)).map(([regle]) => regle);
      return lues.length ? `${nom} : ${lues.join(', ')} ${JSON.stringify(texte)}` : null;
    },
  };
}

/**
 * LE scan des constructions réservées d'un fichier. Retient les déclarations qui s'y appliquent
 * (`sAppliqueA` : hors de leur foyer, dans leur domaine) et dont l'indice, s'il existe, est vrai sur
 * son texte ; sans aucune, rend `[]` sans parser. Sinon parse le fichier (`ast`), parcourt ses nœuds
 * UNE fois et interroge sur chacun le prédicat de chaque construction retenue : une trouvaille par
 * ligne et par construction, la première du parcours.
 * @param {Pick<import('./sourceCorpus.mjs').CorpusFile, 'rel' | 'text'>} fichier
 * @param {readonly { nom: string, foyer?: string | readonly string[], domaine?: (rel: string) => boolean,
 *   indice?: (texte: string) => boolean, reconnait: (noeud: ts.Node, sf: ts.SourceFile) => string | null }[]} constructions
 * @returns {{ line: number, construction: string, detail: string }[]}
 */
export function scanConstructionsReservees(fichier, constructions) {
  const retenues = constructions.filter((c) => sAppliqueA(fichier, c) && (!c.indice || c.indice(fichier.text)));
  if (!retenues.length) return [];
  const sf = ast(fichier);
  /** @type {{ line: number, construction: string, detail: string }[]} */
  const trouvailles = [];
  const vues = new Set();
  /** @param {ts.Node} n */
  const walk = (n) => {
    for (const c of retenues) {
      const detail = c.reconnait(n, sf);
      if (detail == null) continue;
      const line = lineOf(sf, n);
      const cle = `${line}|${c.nom}`;
      if (vues.has(cle)) continue;
      vues.add(cle);
      trouvailles.push({ line, construction: c.nom, detail });
    }
    ts.forEachChild(n, walk);
  };
  walk(sf);
  return trouvailles;
}

/**
 * Les constructions réservées d'un CORPUS : les trouvailles de `scanConstructionsReservees` de chaque
 * fichier, dans l'ordre du corpus puis du scan, chacune portant en tête le `rel` de son fichier.
 * @param {readonly Pick<import('./sourceCorpus.mjs').CorpusFile, 'rel' | 'text'>[]} corpus
 * @param {Parameters<typeof scanConstructionsReservees>[1]} constructions
 * @returns {readonly { rel: string, line: number, construction: string, detail: string }[]}
 */
export function constructionsReserveesDuCorpus(corpus, constructions) {
  return corpus.flatMap((fichier) => scanConstructionsReservees(fichier, constructions).map((t) => ({ rel: fichier.rel, ...t })));
}
