/**
 * DÉLÉGUÉ DE VERBE MANUSCRIT (#2903) : un appel direct du handler d'un verbe de flux de jet —
 * `FLOWS.<flux>.<verbe>(…)`, `FLOWS[…].<verbe>(…)` — hors des verbes de jet du noyau (`creerVerbesDeJet`,
 * `src/noyau/rollFlowSpecs.ts`). Un geste de jet passe par son verbe `jet<Verbe>(flux, …)` (#3311) : appeler le
 * handler à la main contourne son refus de frontière, la surface d'intentions dérivée (`coopFlowIntents`) et sa
 * possession (`netOwnership`, route de chaque verbe de jet).
 *
 * `verbes` : les verbes de jet, lus par l'appelant dans `FLOW_VERBS`.
 *
 * FRONTIÈRE avec le verrou de compilation `verrouDuLexique` (`src/noyau/fabriquesDuNoyau.ts`), qui
 * refuse tout verbe `<flux><Verbe>` (hors lexique) ou `jet<Verbe>` hors des verbes de jet (#2961, #3371) :
 * ce scanner voit ce que le verrou ne peut pas voir — l'appel direct d'un handler, sous un autre nom ou hors de
 * toute fabrique (un écran qui contourne le verbe, donc le routage coop).
 *
 * ANGLE MORT : un handler lu dans une liaison locale (`const flow = FLOWS.x; flow.annuler(…)`) puis
 * appelé n'est pas vu ; `creerVerbesDeJet` appelle ainsi le handler qu'il reçoit en paramètre.
 */
import { ast, typescript } from './dialecte.mjs';

/** `FLOWS.<flux>` ou `FLOWS[…]` : la racine nommée, sinon `null`. */
function racineDeHandler(n) {
  const ts = typescript();
  if (!ts.isPropertyAccessExpression(n) && !ts.isElementAccessExpression(n)) return null;
  const e = n.expression;
  return ts.isIdentifier(e) && e.text === 'FLOWS' ? e.text : null;
}

/**
 * Sites `{ ligne, texte }` d'un fichier source où un verbe de `verbes` est appelé directement sur un
 * handler de flux.
 * @param {{ rel: string, text: string }} f
 * @param {Iterable<string>} verbes
 * @returns {{ ligne: number, texte: string }[]}
 */
export function sitesDeDelegueManuscrit(f, verbes) {
  if (!f.text.includes('FLOWS')) return [];
  const ts = typescript();
  const sf = ast(f);
  if (!sf) return [];
  const noms = new Set(verbes);
  const sites = [];
  const visite = (n) => {
    if (ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)
      && noms.has(n.expression.name.text) && racineDeHandler(n.expression.expression)) {
      sites.push({
        ligne: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1,
        texte: n.getText(sf).replace(/\s+/g, ' ').trim(),
      });
    }
    n.forEachChild(visite);
  };
  visite(sf);
  return sites;
}
