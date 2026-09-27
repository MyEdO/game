// GARDE « clé d'arête construite à la main » (#1883 c7) : l'identité d'une arête de mur (case, côté,
// étage) se calcule par `cleArete`, au SOCLE `src/geometry/arete.ts`, et nulle part ailleurs. Un
// gabarit de chaîne qui aligne deux interpolations et le côté, le côté en tête ou en queue, interpolé
// ou littéral (`${x},${y},${side}`, `${side}:${x},${y}`, `${x}|${ny}|S`, `N,${x},${y}`…), recompose
// cette identité à la main.
// Banc et balayage : `src/geometry/cle-arete-guard.test.ts`.
// LIMITE — garde LEXICALE, ligne par ligne ; lui échappent, une ligne par forme :
//  - une clé bâtie par `join` (`[x, y, side, z].join(',')`) ;
//  - une clé bâtie par concaténation (`x + ',' + y + ',' + side`) ;
//  - une clé écrite sur plusieurs lignes ;
//  - un côté interpolé sous un autre nom que `side` (`${s}`, `${e.cote}`) : trois interpolations
//    quelconques ne se distinguent pas d'une couleur `${r},${g},${b}` ;
//  - le côté au MILIEU (`${x},${side},${y}`) ;
//  - un séparateur hors de `,` `:` `_` `|` `.` `/` `;` `-` et des espaces, ou de plus d'un caractère
//    (`${x}::${y}::${side}`) ;
//  - un côté littéral en tête COLLÉ à la première interpolation (`N${x},${y}`) : indiscernable d'un
//    libellé (`N${niveau}`).
// Un n-uplet ouvert par `(` est un LIBELLÉ d'affichage (`arête (3,4,N)`), jamais une clé : il n'est
// pas mordu.

/** Le SOCLE : ce n'est pas une exemption, c'est l'endroit où la clé a le droit d'être écrite. */
export const SOCLE = ['src/geometry/arete.ts'];

/** Deux interpolations, puis le côté (interpolé sous le nom `side`, ou `N`/`E`/`S`/`O` littéral) ; ou le
 *  côté (interpolé, ou littéral suivi d'un séparateur franc), puis deux interpolations — séparés par au
 *  plus un de `,` `:` `_` `|` `.` `/` `;` `-`, bordé d'espaces ou non, voire par rien, hors libellé
 *  parenthésé. Une interpolation qui APPELLE (`${cleArete(…)}`) n'est pas une coordonnée nue. Le `$`
 *  est écrit en classe : ce module est lui-même balayé. */
const INTERP = String.raw`[$]\{[^}(]*\}`;
const COTE = String.raw`[$]\{[^}(]*\bside\b[^}(]*\}`;
const SEP = String.raw`\s*[,:_|./;-]?\s*`;
const LITTERAL = String.raw`[NESO]`;
/** Séparateur EXIGÉ derrière un côté littéral en tête : collé, `N${x}` est un libellé (`N${niveau}`). */
const SEP_FRANC = String.raw`\s*[,:_|./;-]\s*`;
export const CLE_A_LA_MAIN = new RegExp(
  String.raw`(?<!\()(?:${INTERP}${SEP}${INTERP}${SEP}(?:${COTE}|${LITTERAL}(?![\w$]))|${COTE}${SEP}${INTERP}${SEP}${INTERP})` +
    String.raw`|(?<![(\w$])${LITTERAL}${SEP_FRANC}${INTERP}${SEP}${INTERP}`,
);

// Exemptions AU SITE : `fichier` + `motif` de la ligne + `raison`. Chacune doit toucher un site.
export const EXEMPTIONS = [];

/** Sites fautifs d'un texte : `[{ ligne, texte }]`, un par ligne mordue. PURE. */
export function sitesFautifs(texte) {
  const out = [];
  texte.split('\n').forEach((l, i) => { if (CLE_A_LA_MAIN.test(l)) out.push({ ligne: i + 1, texte: l.trim() }); });
  return out;
}
