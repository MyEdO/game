// Mécanique de scan de la garde « ajouter une rangée » (#1473) : le geste qui étend une liste d'un
// éditeur est UN composant, `AjoutRangee` (`src/ui/AjoutRangee.tsx`). Motif refusé : un élément JSX
// `<button>` dont le CONTENU s'ouvre par le glyphe « + » (un « + » suivi d'un chiffre est un signe de
// nombre, « +1 ») ou par l'icône `ui/add`, sur une ou plusieurs lignes. Lu par l'AST du compilateur (`dialecte.mjs`) : commentaires et chaînes hors
// JSX ne portent rien. Module ESM pur, exécutable par `node` nu.
import { typescript, scriptKindDe } from './dialecte.mjs';

/** Premier enfant SIGNIFIANT d'un élément JSX : texte non blanc, élément, ou expression. */
function premierEnfant(ts, enfants) {
  return enfants.find((e) => !(ts.isJsxText(e) && e.containsOnlyTriviaWhiteSpaces));
}

/** `<Icon id="ui/add" …>` (ouvrant ou auto-fermant). */
function estIconeAjout(ts, noeud) {
  const ouvrant = ts.isJsxSelfClosingElement(noeud) ? noeud : ts.isJsxElement(noeud) ? noeud.openingElement : null;
  if (!ouvrant || ouvrant.tagName.getText() !== 'Icon') return false;
  return ouvrant.attributes.properties.some((a) =>
    ts.isJsxAttribute(a) && a.name.getText() === 'id' && a.initializer && ts.isStringLiteral(a.initializer) && a.initializer.text === 'ui/add');
}

/**
 * Boutons d'ajout de rangée NUS d'un fichier `.tsx`.
 * @param {string} relPath @param {string} contenu @returns {{ line: number, detail: string }[]}
 */
export function scanAjoutRangee(relPath, contenu) {
  const ts = typescript();
  const sf = ts.createSourceFile(relPath, contenu, ts.ScriptTarget.Latest, true, scriptKindDe(relPath));
  const findings = [];
  const visite = (n) => {
    if (ts.isJsxElement(n) && n.openingElement.tagName.getText() === 'button') {
      const tete = premierEnfant(ts, n.children);
      const plus = tete && ts.isJsxText(tete) && /^\+(?!\d)/.test(tete.getText().trimStart());
      if (plus || (tete && estIconeAjout(ts, tete))) {
        findings.push({ line: sf.getLineAndCharacterOfPosition(n.getStart()).line + 1, detail: n.getText().replace(/\s+/g, ' ').slice(0, 160) });
      }
    }
    ts.forEachChild(n, visite);
  };
  visite(sf);
  return findings;
}
