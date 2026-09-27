// GARDE « clé d'arête construite à la main » (#1883 c7) : l'identité d'une arête de mur (case, côté,
// étage) se calcule par `cleArete`, au SOCLE `src/geometry/arete.ts`, et nulle part ailleurs. Un
// gabarit de chaîne qui aligne deux interpolations et le côté, le côté en tête ou en queue, interpolé
// ou littéral, nu ou entre guillemets (`${x},${y},${side}`, `${side}:${x},${y}`, `${x}|${ny}|S`,
// `N,${x},${y}`, `${x},${y},'N'`, `${x},${y},${String(side)}`…), recompose cette identité à la main.
// Les COMMENTAIRES ne sont pas du code : ils sont blanchis avant la lecture (`codeSeul` de
// `commentPoison.mjs`).
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
//    libellé (`N${niveau}`) ;
//  - un côté littéral en queue derrière un blanc seul (`${x} ${y} N`, `${x}${y}N`) : indiscernable
//    d'une prose (`${n} ${unite} E`) ;
//  - un côté interpolé par un appel autre que `String(…)` (`${nomDe(side)}`) : indiscernable d'une
//    clé déjà calculée (`${cleArete(x, y, side, z)}`).
// Un n-uplet ouvert par `(` est un LIBELLÉ d'affichage (`arête (3,4,N)`), jamais une clé : il n'est
// pas mordu.

import { codeSeul } from './commentPoison.mjs';

/** Le SOCLE : ce n'est pas une exemption, c'est l'endroit où la clé a le droit d'être écrite. */
export const SOCLE = ['src/geometry/arete.ts'];

/** Deux interpolations, puis le côté (interpolé sous le nom `side`, ou `N`/`E`/`S`/`O` littéral, nu ou
 *  entre guillemets, derrière un séparateur franc) ; ou le côté (interpolé, ou littéral suivi d'un
 *  séparateur franc), puis deux interpolations — séparés par au plus un de `,` `:` `_` `|` `.` `/` `;`
 *  `-`, bordé d'espaces ou non, voire par rien, hors libellé parenthésé. Une interpolation qui APPELLE
 *  (`${cleArete(…)}`) n'est pas une coordonnée nue, sauf la conversion `String(…)` du côté. Le `$` est
 *  écrit en classe : ce module est lui-même balayé. */
const INTERP = String.raw`[$]\{[^}(]*\}`;
const COTE = String.raw`[$]\{(?:[^}(]*\bside\b[^}(]*|\s*String\([^}()]*\bside\b[^}()]*\)\s*)\}`;
const SEP = String.raw`\s*[,:_|./;-]?\s*`;
/** Côté littéral, nu ou entre guillemets appariés ; `q` nomme le groupe du guillemet. */
const litteral = (q) => String.raw`(?<${q}>['"]?)[NESO]\k<${q}>`;
/** Séparateur EXIGÉ autour d'un côté littéral : collé en tête, `N${x}` est un libellé (`N${niveau}`) ;
 *  derrière un blanc seul en queue, `${n} ${unite} E` est une prose. */
const SEP_FRANC = String.raw`\s*[,:_|./;-]\s*`;
export const CLE_A_LA_MAIN = new RegExp(
  String.raw`(?<!\()(?:${INTERP}${SEP}${INTERP}(?:${SEP}${COTE}|${SEP_FRANC}${litteral('queue')}(?![\w$]))|${COTE}${SEP}${INTERP}${SEP}${INTERP})` +
    String.raw`|(?<![(\w$'"])${litteral('tete')}${SEP_FRANC}${INTERP}${SEP}${INTERP}`,
);

// Exemptions AU SITE : `fichier` + `motif` de la ligne + `raison`. Chacune doit toucher un site.
export const EXEMPTIONS = [];

/** Sites fautifs d'un texte : `[{ ligne, texte }]`, un par ligne mordue, lue sur son CODE (commentaires
 *  blanchis, lignes préservées). PURE. */
export function sitesFautifs(texte) {
  const code = codeSeul(texte).split('\n');
  const out = [];
  texte.split('\n').forEach((l, i) => { if (CLE_A_LA_MAIN.test(code[i])) out.push({ ligne: i + 1, texte: l.trim() }); });
  return out;
}
