/**
 * Chip de REFUS NU (#2404) : un élément dont le `className` compose À LA FOIS `chip` et `tone-danger`
 * hors de la primitive `ChipDeRefus` (`src/ui/ChipDeRefus.tsx`), seule à poser la matière d'un refus.
 *
 * Classes lues : toutes les chaînes LITTÉRALES de l'initialiseur de `className` — chaîne, gabarit et
 * ses morceaux, branches de ternaire et opérandes de `&&`/`||` compris —, découpées aux blancs. Un
 * site est l'élément porteur, son texte aux blancs réduits : la clé d'une exclusion AU SITE.
 *
 * ANGLE MORT : une classe CALCULÉE hors de l'attribut (variable, appel de fonction) n'est pas lue ;
 * un refus rendu sans `chip tone-danger` (`.hint`, texte nu) n'est pas vu.
 */
import { ast, typescript } from './dialecte.mjs';

/** Les chaînes littérales d'un nœud, à toute profondeur. */
function chaines(n, sf, acc = []) {
  const ts = typescript();
  if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) acc.push(n.text);
  else if (ts.isTemplateExpression(n)) {
    acc.push(n.head.text);
    for (const span of n.templateSpans) {
      chaines(span.expression, sf, acc);
      acc.push(span.literal.text);
    }
  } else n.forEachChild((c) => { chaines(c, sf, acc); });
  return acc;
}

/**
 * Sites d'un `.tsx` : `{ ligne, texte }` de chaque élément au `className` qui compose `chip` et
 * `tone-danger`.
 * @param {{ rel: string, text: string }} f
 * @param {import('typescript/unstable/ast').SourceFile} [sourceFile]
 * @returns {{ ligne: number, texte: string }[]}
 */
export function sitesChipDeRefusNu(f, sourceFile) {
  const ts = typescript();
  const sf = sourceFile ?? ast(f);
  if (!sf) return [];
  const sites = [];
  const visite = (n) => {
    if (ts.isJsxAttribute(n) && n.name.getText(sf) === 'className' && n.initializer) {
      const classes = new Set(chaines(n.initializer, sf).join(' ').split(/\s+/));
      if (classes.has('chip') && classes.has('tone-danger')) {
        const ouvrant = n.parent.parent;
        const element = ts.isJsxOpeningElement(ouvrant) ? ouvrant.parent : ouvrant;
        sites.push({
          ligne: sf.getLineAndCharacterOfPosition(element.getStart(sf)).line + 1,
          texte: element.getText(sf).replace(/\s+/g, ' ').trim(),
        });
      }
    }
    n.forEachChild(visite);
  };
  visite(sf);
  return sites;
}
