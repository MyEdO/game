// Mécanique de scan des gardes « SOURCE UNIQUE » lues à l'AST (#1440) — TypeScript compiler API,
// jamais une regex de ligne (une recopie multi-ligne échappe à tout motif de ligne) et jamais un
// scan par NOM (une copie s'appelle rarement comme le canon). Deux scans, tous deux par FORME :
//  - `scanUnionRecopies` : les SIX formes sous lesquelles un tuple canon se re-tape (tableau, union
//    de types littéraux, clés d'objet littéral, membres d'un type littéral, `case` d'un `switch`,
//    chaîne de comparaisons `=== 'a' || === 'b'`), moins les DEUX formes que le compilateur borne
//    déjà (sélection zod `.extract` sur un schéma du canon, table `Record<UnionNommée, …>` annotée) ;
//  - `scanChebyshevFormula` : la FORMULE de la distance de Chebyshev, quel que soit le nom qu'on lui
//    donne (`cheb`, `dist`, ou aucun — inline dans un `filter`).
// La lecture du corpus n'est PAS ici : elle vit dans `sourceCorpus.mjs` (`readCorpus`), qui la
// mémoïse par clé. Ce module reçoit des fichiers `{ rel, text }` et rend des `Finding`.
import ts from 'typescript';
import { scriptKindDe } from './dialecte.mjs';

/** AST d'un fichier, rangé dans `arbres` — carte de l'APPELANT, keyée sur l'identité de l'entrée :
 *  elle naît et meurt avec lui (`tsProgram.mjs`, en-tête). Un appelant qui scanne plusieurs fois le
 *  même corpus passe la même carte et la vide quand il a fini.
 *  @param {{ rel: string, text: string }} file @param {Map<object, ts.SourceFile>} arbres
 *  @returns {ts.SourceFile} */
function ast(file, arbres) {
  let sf = arbres.get(file);
  if (!sf) {
    sf = ts.createSourceFile(file.rel, file.text, ts.ScriptTarget.Latest, true, scriptKindDe(file.rel));
    arbres.set(file, sf);
  }
  return sf;
}

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

/** SCHÉMAS DÉRIVÉS du canon : les seuls récepteurs dont un `.extract(…)`/`.exclude(…)` SÉLECTIONNE
 *  dans le canon (leurs options SONT le tuple, cf. `src/data/schemas/grammaire/valeurs.ts`). Un `.extract` posé
 *  sur n'importe quel autre objet ne prouve rien — il ne blanchit donc rien.
 * @type {string[]} */
export const SCHEMAS_DU_CANON = ['availabilitySchema', 'stakeFormSchema', 'harvestRaritySchema'];

/** Le tableau est-il l'argument d'un `.extract(…)`/`.exclude(…)` posé sur un schéma DU CANON ? zod
 *  type cet argument par les options du récepteur : sur un schéma du canon, un palier renommé ne
 *  compile plus. Le récepteur est donc vérifié NOMMÉMENT — sinon n'importe quel
 *  `truc.extract(['Commune', 'Rare'])` se blanchirait tout seul.
 * @param {ts.ArrayLiteralExpression} n @returns {boolean} */
function estSelectionDerivee(n) {
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
  return ts.isIdentifier(recepteur) && SCHEMAS_DU_CANON.includes(recepteur.text);
}

/** TABLE EXHAUSTIVE keyée par une union NOMMÉE (`const T: Record<Availability, X> = { … }`) : ce ne
 *  sont pas des membres re-tapés mais les clés d'une table que le COMPILATEUR exige complètes — un
 *  palier ajouté, renommé ou retiré du canon casse la compilation de la table. `Record<string, …>`
 *  n'en est pas une (aucune exhaustivité exigée), ni un `as Record<…>` (une assertion ne vérifie pas
 *  les clés manquantes) : seules l'ANNOTATION et le `satisfies` valent verrou. LIMITE assumée d'un
 *  scan SYNTAXIQUE : le compilateur n'exige les clés que si la clé est une vraie union nommée — un
 *  `Record<MonAlias, …>` dont `MonAlias` est un alias de `string` passerait ici sans être vérifié
 *  là-bas ; le trancher demanderait un checker de types, pas un AST.
 * @param {ts.TypeNode | undefined} t @returns {boolean} */
function estRecordDUnionNommee(t) {
  if (!t || !ts.isTypeReferenceNode(t) || !ts.isIdentifier(t.typeName)) return false;
  const nom = t.typeName.text;
  const args = t.typeArguments ?? [];
  if ((nom === 'Partial' || nom === 'Readonly' || nom === 'Required') && args.length === 1) return estRecordDUnionNommee(args[0]);
  if (nom !== 'Record' || args.length !== 2) return false;
  const cle = args[0];
  return ts.isTypeReferenceNode(cle) && ts.isIdentifier(cle.typeName);
}

/** @param {ts.ObjectLiteralExpression} n @returns {boolean} */
function estTableExhaustive(n) {
  const p = n.parent;
  if (!p) return false;
  if (ts.isSatisfiesExpression(p)) return estRecordDUnionNommee(p.type);
  if ((ts.isVariableDeclaration(p) || ts.isPropertySignature(p) || ts.isPropertyDeclaration(p) || ts.isParameter(p)) && p.type) return estRecordDUnionNommee(p.type);
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

/**
 * Recopies d'un tuple canon dans UN fichier : ≥2 membres DISTINCTS du canon reproduits ENSEMBLE,
 * sous l'une des six formes scannées — divergente ou non, c'est la duplication qui est la faute et
 * la divergence n'en est que la conséquence tardive.
 * @param {{ rel: string, text: string }} file
 * @param {{ nom: string, membres: readonly string[] }[]} canons
 * @param {Map<object, ts.SourceFile>} [arbres] AST déjà bâtis, carte de l'appelant (`ast`)
 * @returns {{ line: number, detail: string }[]}
 */
export function scanUnionRecopies(file, canons, arbres = new Map()) {
  const cibles = canons.map((c) => ({ nom: c.nom, membres: new Set(c.membres) }));
  const present = (m) => file.text.includes(`'${m}'`) || file.text.includes(`"${m}"`) || new RegExp(`(^|[^\\w$.'"])${m}\\s*[:?]`, 'm').test(file.text);
  if (!cibles.some((c) => [...c.membres].filter(present).length >= 2)) return [];
  const sf = ast(file, arbres);
  /** @type {{ line: number, detail: string }[]} */
  const findings = [];
  const vus = new Set();
  /** @param {ts.Node} node @param {(string | null)[]} membres @param {string} forme */
  const verdict = (node, membres, forme) => {
    const distincts = new Set(membres.filter((m) => m != null));
    for (const c of cibles) {
      const communs = [...distincts].filter((m) => c.membres.has(m));
      if (communs.length < 2) continue;
      const line = lineOf(sf, node);
      const cle = `${line}|${c.nom}`;
      if (vus.has(cle)) continue;
      vus.add(cle);
      findings.push({ line, detail: `${c.nom} recopiée en ${forme} (${communs.map((m) => `'${m}'`).join(', ')})` });
    }
  };
  /** @param {ts.Node} n */
  const walk = (n) => {
    if (ts.isArrayLiteralExpression(n)) {
      if (!estSelectionDerivee(n)) verdict(n, n.elements.filter(ts.isStringLiteralLike).map((e) => e.text), 'tableau');
    } else if (ts.isUnionTypeNode(n)) {
      verdict(n, n.types.map(litType), 'union de types');
    } else if (ts.isObjectLiteralExpression(n)) {
      if (!estTableExhaustive(n)) verdict(n, n.properties.map((p) => keyName(p.name)), 'clés d’objet');
    } else if (ts.isTypeLiteralNode(n)) {
      verdict(n, n.members.map((m) => keyName(m.name)), 'membres de type littéral');
    } else if (ts.isCaseBlock(n)) {
      verdict(n, n.clauses.flatMap((c) => (ts.isCaseClause(c) && ts.isStringLiteralLike(c.expression) ? [c.expression.text] : [])), 'case d’un switch');
    } else if (ts.isBinaryExpression(n)) {
      const lits = litterauxDeChaine(n);
      if (lits) verdict(n, lits, 'chaîne de comparaisons');
    }
    ts.forEachChild(n, walk);
  };
  walk(sf);
  return findings;
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
 * La FORMULE de la distance de Chebyshev recopiée INLINE : `Math.max(Math.abs(a.x - b.x),
 * Math.abs(a.y - b.y))`, ses commutations (ordre des axes, ordre des opérandes, opérandes nus ou
 * propriétés) ET sa forme à écarts PRÉ-CALCULÉS (`Math.max(Math.abs(dx), Math.abs(dy))`, où la
 * soustraction a eu lieu plus haut — la mesure est la même, la garde ne s'arrête pas à l'emballage).
 * Le NOM n'entre pas dans le scan : `cheb`, `dist`, ou aucun nom du tout, c'est la même recopie du
 * canon `chebyshev` (`src/engine/grid.ts`).
 * @param {{ rel: string, text: string }} file
 * @param {Map<object, ts.SourceFile>} [arbres] AST déjà bâtis, carte de l'appelant (`ast`)
 * @returns {{ line: number, detail: string }[]}
 */
export function scanChebyshevFormula(file, arbres = new Map()) {
  if (!file.text.includes('Math.abs')) return [];
  const sf = ast(file, arbres);
  /** @type {{ line: number, detail: string }[]} */
  const findings = [];
  /** @param {ts.Node} n */
  const walk = (n) => {
    if (ts.isCallExpression(n) && n.arguments.length === 2) {
      const f = n.expression;
      if (ts.isPropertyAccessExpression(f) && f.name.text === 'max' && ts.isIdentifier(f.expression) && f.expression.text === 'Math') {
        const a = absDelta(n.arguments[0]);
        const b = absDelta(n.arguments[1]);
        if (a && b && paireDAxes(a, b)) {
          findings.push({ line: lineOf(sf, n), detail: 'formule de Chebyshev recopiée inline' });
        }
      }
    }
    ts.forEachChild(n, walk);
  };
  walk(sf);
  return findings;
}
