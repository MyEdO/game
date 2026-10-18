/**
 * Bande EN LIGNE (#1595) : la graphie d'une bande de table (« 01–35 », « 96+ », « ≤50 ») a une source
 * unique, `fourchette` (`src/engine/tables.ts`). Un site qui la recompose en ligne est refusé.
 *
 * Motif lu, dans un gabarit (`${e.min}–${e.max}`, `de ${t.min} à ${t.max}`) ou dans du JSX
 * (`{min}–{max}`) :
 * - deux interpolations ADJACENTES séparées par un séparateur de bande seul (trait d'union,
 *   demi-cadratin, points de suspension, « à » ; blancs tolérés), dont la borne basse OU la borne
 *   haute porte un nom de borne ;
 * - les mêmes séparées par un tiret long (« — ») seul, si la borne basse ET la borne haute portent un
 *   nom de borne (`{r.min} — {r.label}` est le séparateur d'un libellé, `${b.min} — ${b.max}` une
 *   bande) ;
 * - une QUEUE de bande : un séparateur de bande seul qui précède une interpolation nommée borne haute
 *   (`–${e.max}`, imbriqué en ternaire : `${e.min}${e.max > e.min ? `–${e.max}` : ''}`) ;
 * - un PRÉFIXE de dé recopié devant `fourchette(…)` (`` `d100 ${fourchette(…)}` ``, `1d10 : {fourchette(…)}`) :
 *   le préfixe et la bande s'écrivent ensemble par `bandeAuDe` (`src/engine/tables.ts`).
 * Nom de borne : `min`/`lo`/`low`/`from`/`start`, `max`/`hi`/`high`/`to`/`end`, ou `min…`/`…Min`,
 * `max…`/`…Max` (`minSL`, `drMax`) — dernier nom d'un accès `a.b.min`, membre gauche d'un `??`. Un
 * site est la ligne du gabarit, son texte aux blancs réduits : la clé d'une exclusion AU SITE.
 *
 * ANGLE MORT : des bornes aux noms hors de ce vocabulaire des deux côtés ; une bande composée par
 * concaténation (`a + '–' + b`) ; une bande dite par une seule borne (« jusqu'à ${max} »).
 */
import { ast, typescript } from './dialecte.mjs';

const BASSES = new Set(['min', 'lo', 'low', 'from', 'start']);
const HAUTES = new Set(['max', 'hi', 'high', 'to', 'end']);
const SEPARATEUR_SEUL = /^\s*(?:[-–…]|\.\.\.|à)\s*$/;
const TIRET_LONG_SEUL = /^\s*—\s*$/;
const BASSE = /^min(?:[A-Z]|$)|Min$/;
const HAUTE = /^max(?:[A-Z]|$)|Max$/;
const PREFIXE_DE_DE = /(?:^|\s)1?d10{1,2}\s*:?\s*$/;

/** Dernier nom d'une expression de borne (`e.min` → `min`, `min` → `min`), ou `null`. */
function nomDeBorne(n) {
  const ts = typescript();
  if (ts.isIdentifier(n)) return n.text;
  if (ts.isPropertyAccessExpression(n)) return n.name.text;
  if (ts.isNonNullExpression(n) || ts.isParenthesizedExpression(n)) return nomDeBorne(n.expression);
  if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken) return nomDeBorne(n.left);
  return null;
}

const estBasse = (n) => { const b = nomDeBorne(n) ?? ''; return BASSES.has(b) || BASSE.test(b); };
const estHaute = (n) => { const h = nomDeBorne(n) ?? ''; return HAUTES.has(h) || HAUTE.test(h); };

/** `basse`, `separateur`, `haute` adjacents composent-ils une bande ? */
const estUneBande = (basse, separateur, haute) =>
  (SEPARATEUR_SEUL.test(separateur) && (estBasse(basse) || estHaute(haute)))
  || (TIRET_LONG_SEUL.test(separateur) && estBasse(basse) && estHaute(haute));

/** `separateur` seul devant `haute` est-il la queue d'une bande ? */
const estUneQueue = (separateur, haute) => SEPARATEUR_SEUL.test(separateur) && estHaute(haute);

/** `texte` finit-il par un préfixe de dé recopié devant un appel à `fourchette` ? */
const estUnPrefixeDeDe = (texte, n) => {
  const ts = typescript();
  return PREFIXE_DE_DE.test(texte) && ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'fourchette';
};

/**
 * Sites d'un fichier : `{ ligne, texte }` de chaque bande recomposée en ligne.
 * @param {{ rel: string, text: string }} f
 * @param {import('typescript/unstable/ast').SourceFile} [sourceFile]
 * @returns {{ ligne: number, texte: string }[]}
 */
export function sitesBandeEnLigne(f, sourceFile) {
  const ts = typescript();
  const sf = sourceFile ?? ast(f);
  if (!sf) return [];
  const sites = [];
  const site = (n) => sites.push({
    ligne: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1,
    texte: n.getText(sf).replace(/\s+/g, ' ').trim(),
  });
  const visite = (n) => {
    if (ts.isTemplateExpression(n)) {
      const spans = n.templateSpans;
      for (let i = 0; i < spans.length; i++) {
        const precedent = i === 0 ? n.head.text : spans[i - 1].literal.text;
        if (estUneQueue(precedent, spans[i].expression) || estUnPrefixeDeDe(precedent, spans[i].expression)
          || (i > 0 && estUneBande(spans[i - 1].expression, precedent, spans[i].expression))) { site(n); break; }
      }
    } else if (ts.isJsxElement(n) || ts.isJsxFragment(n)) {
      const enfants = n.children;
      for (let i = 0; i + 1 < enfants.length; i++) {
        const [sep, b] = [enfants[i], enfants[i + 1]];
        if (!ts.isJsxText(sep) || !ts.isJsxExpression(b) || !b.expression) continue;
        const a = enfants[i - 1];
        if (estUneQueue(sep.text, b.expression) || estUnPrefixeDeDe(sep.text, b.expression)
          || (a && ts.isJsxExpression(a) && a.expression && estUneBande(a.expression, sep.text, b.expression))) { site(n); break; }
      }
    }
    n.forEachChild(visite);
  };
  visite(sf);
  return sites;
}
