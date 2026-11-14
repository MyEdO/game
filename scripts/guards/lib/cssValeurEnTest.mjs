// MÉCANIQUE du cliquet « un test unitaire ne cite pas à la fois un sélecteur d'écran ET une valeur »
// (#1806, `docs/charte-ui.md` § « Où se garde un contrat CSS »). Module ESM pur, sans disque : il LIT
// des lignes et rend des sites. Le VERDICT appartient à la garde (`src/ui/css-valeur-en-test.test.ts`),
// la SPÉCIFICATION à `cssValeurEnTest.test.mjs` (formes couvertes et faux positifs écartés, en
// littéraux) — ce test vit HORS de `src/**`, sinon ses propres fixtures déclencheraient le cliquet.
//
// LA RÈGLE : jsdom ne met rien en page et n'applique aucune tranche `@media`. Un test qui lit une
// DÉCLARATION CSS et la compare à une VALEUR DE DESIGN ne garde aucun rendu — il gèle l'interface :
// changer un réglage casse un test qui ne protégeait rien. Ce contrat-là se mesure au navigateur
// (`scripts/recette/*.mjs`). Restent légitimes, et ne sont PAS visées :
//   · les RELATIONS (une grandeur comparée à une AUTRE grandeur, un calcul évalué : `evalLen`, `pxCalc`) ;
//   · la PRÉSENCE/ABSENCE et les bornes triviales `0` et `1` (une opacité pleine, un bord à zéro,
//     « strictement positif ») — elles ne disent aucun choix de design ;
//   · une NORME, qui n'est pas un choix de design : elle s'exempte AU SITE, par `// norme: <laquelle>`
//     sur la ligne (jamais une liste de fichiers, jamais un stock).
//
// COUVERTURE, à énoncer et non à supposer : la mesure est PAR LIGNE. Un `expect(` dont l'argument
// s'étale sur plusieurs lignes n'est vu que si la lecture CSS et la valeur tiennent sur la MÊME
// ligne que lui. C'est la forme que le corpus écrit ; une forme éclatée passerait — le jour où l'une
// apparaît, c'est ici qu'elle se traite.

// Lectures de CSS : les fonctions par lesquelles un test atteint une déclaration, plus les feuilles
// lues en clair. Les sections (`CC_BASE`, `CHIPS_BASE`…) ne figurent PAS : elles ne se lisent qu'à
// TRAVERS ces fonctions, et un suffixe `_BASE` seul attrape des constantes de règle sans rapport.
const LECTURES_CSS = [
  /\bdecl\s*\(/, /\bruleOf\s*\(/, /\breadCss\s*\(/, /\bmediaBlock\s*\(/, /\bbaseSection\s*\(/,
  /\b[A-Z][A-Z0-9_]*_CSS\b/,
];

/** Longueur LITTÉRALE : la valeur de design par excellence (`12px`, `-50%`, `1.1em`, `84vh`). */
const LONGUEUR = /(?<![\w.])-?\d+(?:\.\d+)?(?:px|rem|em|%|vh|vw)(?![\w-])/g;

/** Une LARGEUR DE TRANCHE nomme un breakpoint du canon — c'est le NOM d'une tranche, pas une valeur
 *  de design : `mediaBlock(CSS, '@media (max-width: 900px)')` désigne sa cible, il ne la règle pas. */
const NOM_DE_TRANCHE = /(?:max|min)-width:\s*-?\d+(?:\.\d+)?(?:px|rem|em)/g;

/** Comparaisons numériques d'un `expect` — le nombre attendu est capturé pour être jugé. */
const COMPARAISONS = [
  /\.toBe\(\s*(-?\d+(?:\.\d+)?)\s*[,)]/,
  /\.toBeGreaterThan(?:OrEqual)?\(\s*(-?\d+(?:\.\d+)?)\s*[,)]/,
  /\.toBeLessThan(?:OrEqual)?\(\s*(-?\d+(?:\.\d+)?)\s*[,)]/,
  /\.toBeCloseTo\(\s*(-?\d+(?:\.\d+)?)\s*[,)]/,
];

/** Un `calc(` épinglé au TEXTE : c'est la SYNTAXE d'une formule qui est gelée, pas sa loi. */
const FORMULE_EPINGLEE = /\.(?:toBe|toEqual)\(\s*['"`]calc\(/;

/** Bornes TRIVIALES : « rien », « tout », « existe » — aucune de ces valeurs n'est un choix de design. */
const TRIVIALES = new Set([0, 1, -1]);

/** Longueurs DÉGÉNÉRÉES, de même nature que `0` et `1` côté nombres : elles disent « rien » ou
 *  « toute sa boîte », jamais une grandeur choisie. `width: 100%` est une STRUCTURE (le dessin
 *  remplit sa boîte), pas un réglage. */
const LONGUEURS_TRIVIALES = new Set(['0px', '0%', '0em', '0rem', '100%']);

/** Exemption AU SITE : la ligne porte la norme, NOMMÉE (`// norme: WCAG 4.5`). */
export const estNormeDite = (ligne) => /\/\/\s*norme\s*:\s*\S/.test(String(ligne));

/** Vrai si la ligne atteint une déclaration CSS. */
export const litDuCss = (ligne) => LECTURES_CSS.some((r) => r.test(ligne));

/**
 * La VALEUR de design que la ligne épingle, ou `null`.
 * @param {string} ligne @returns {string | null}
 */
export function valeurEpinglee(ligne) {
  // Les largeurs de TRANCHE sont blanchies d'abord (même longueur, pour ne pas décaler la lecture).
  const sansTranches = String(ligne).replace(NOM_DE_TRANCHE, (m) => ' '.repeat(m.length));
  LONGUEUR.lastIndex = 0;
  for (let m = LONGUEUR.exec(sansTranches); m; m = LONGUEUR.exec(sansTranches)) {
    if (!LONGUEURS_TRIVIALES.has(m[0])) return m[0];
  }
  if (FORMULE_EPINGLEE.test(ligne)) return 'calc(…) épinglé au texte';
  for (const r of COMPARAISONS) {
    const m = r.exec(ligne);
    if (m && !TRIVIALES.has(Number(m[1]))) return m[1];
  }
  return null;
}

/**
 * Sites de la classe, sur un corpus de fichiers de test déjà lus.
 * @param {{ rel: string, text: string }[]} fichiers
 * @returns {{ file: string, line: number, valeur: string, texte: string }[]}
 */
export function sitesValeurCss(fichiers) {
  const sites = [];
  for (const { rel, text } of fichiers) {
    const lignes = String(text).split('\n');
    for (let i = 0; i < lignes.length; i++) {
      const ligne = lignes[i];
      if (!ligne.includes('expect(') || !litDuCss(ligne) || estNormeDite(ligne)) continue;
      const valeur = valeurEpinglee(ligne);
      if (valeur) sites.push({ file: rel, line: i + 1, valeur, texte: ligne.trim().slice(0, 150) });
    }
  }
  return sites;
}
