// GARDE « clé d'arête construite à la main » (#1883 c7) : l'identité d'une arête de mur (case, côté,
// étage) se calcule par `cleArete`, au SOCLE `src/geometry/arete.ts`, et nulle part ailleurs. Un
// gabarit de chaîne qui aligne deux interpolations puis le côté (`${x},${y},${side}`, `${x},${ny},N`…)
// recompose cette identité à la main.
// Banc et balayage : `src/geometry/cle-arete-guard.test.ts`.
// LIMITE : garde LEXICALE, ligne par ligne — une clé bâtie par `join`, par concaténation ou sur
// plusieurs lignes lui échappe. Un n-uplet ouvert par `(` est un LIBELLÉ d'affichage (`arête (3,4,N)`),
// jamais une clé : il n'est pas mordu.

/** Le SOCLE : ce n'est pas une exemption, c'est l'endroit où la clé a le droit d'être écrite. */
export const SOCLE = ['src/geometry/arete.ts'];

/** Deux interpolations, puis le côté (interpolé, ou `N`/`E` littéral), séparés par `,` `:` `_` ou `-`,
 *  hors libellé parenthésé. Une interpolation qui APPELLE (`${cleArete(…)}`) n'est pas une coordonnée
 *  nue. Le `$` est écrit en classe : ce module est lui-même balayé. */
export const CLE_A_LA_MAIN = /(?<!\()[$]\{[^}(]*\}[,:_-][$]\{[^}(]*\}[,:_-](?:[$]\{[^}(]*\bside\b[^}(]*\}|[NE](?![\w$]))/;

// Exemptions AU SITE : `fichier` + `motif` de la ligne + `raison`. Chacune doit toucher un site.
const RAISON_FLAG = 'clé de FLAG d’état (`scene.flags`), PERSISTÉE dans la sauvegarde (`state/saves.ts`) : son format est figé tant que `SAVE_VERSION` ne bouge pas — constructeur nommé, défini une fois';
export const EXEMPTIONS = [
  { fichier: 'src/state/scene.ts', motif: /^return `__door_[$]\{x\}_/, raison: `${RAISON_FLAG} (\`doorKey\`)` },
  { fichier: 'src/state/scene.ts', motif: /^return `__struct_down_[$]\{x\}_/, raison: `${RAISON_FLAG} (\`structureDownKey\`)` },
];

/** Sites fautifs d'un texte : `[{ ligne, texte }]`, un par ligne mordue. PURE. */
export function sitesFautifs(texte) {
  const out = [];
  texte.split('\n').forEach((l, i) => { if (CLE_A_LA_MAIN.test(l)) out.push({ ligne: i + 1, texte: l.trim() }); });
  return out;
}
