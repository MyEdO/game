/**
 * DÉLÉGUÉ DE VERBE MANUSCRIT (#2903) : un appel direct du handler d'un verbe de flux de jet —
 * `FLOWS.<flux>.<verbe>(…)`, `FLOWS[…].<verbe>(…)`, `FLOW_HANDLERS.<flux>.<verbe>(…)`,
 * `FLOW_HANDLERS[…].<verbe>(…)` — hors du générateur des délégués (`buildRollFlowActions`,
 * `src/noyau/rollFlowSpecs.ts`). Le délégué `<prefix><Verbe>` d'un verbe de `FLOW_VERBS` se GÉNÈRE :
 * l'écrire à la main recopie le corps canonique, hors de la surface d'intentions dérivée
 * (`coopFlowIntents`) et de sa possession (`jetOwnedIntents`).
 *
 * `verbes` : les verbes des délégués générés, lus par l'appelant dans `FLOW_VERBS`.
 *
 * FRONTIÈRE avec le verrou de compilation `horsDelegues` (`src/noyau/fabriquesDuNoyau.ts`), qui
 * refuse toute clé de `RollFlowActionsMap` redéclarée par une fabrique : ce scanner voit ce que le
 * verrou ne peut pas voir — un délégué écrit sous un nom que la table ne génère PAS (verbe absent de
 * `FLOW_VERBS`, la forme de #2903), et l'appel direct hors de toute fabrique (un écran qui contourne
 * le délégué, donc le routage coop, `src/ui/forcedDieRow.ts`).
 *
 * ANGLE MORT : un handler lu dans une liaison locale (`const flow = FLOWS.x; flow.cancel(…)`) puis
 * appelé n'est pas vu ; le générateur lui-même appelle ainsi un paramètre (`flow[v]`).
 */
import { ast, typescript } from './dialecte.mjs';

const RACINES = new Set(['FLOWS', 'FLOW_HANDLERS']);

/** `FLOWS.<flux>` ou `FLOWS[…]` (idem `FLOW_HANDLERS`) : la racine nommée, sinon `null`. */
function racineDeHandler(n) {
  const ts = typescript();
  if (!ts.isPropertyAccessExpression(n) && !ts.isElementAccessExpression(n)) return null;
  const e = n.expression;
  return ts.isIdentifier(e) && RACINES.has(e.text) ? e.text : null;
}

/**
 * Sites `{ ligne, texte }` d'un fichier source où un verbe de `verbes` est appelé directement sur un
 * handler de flux.
 * @param {{ rel: string, text: string }} f
 * @param {Iterable<string>} verbes
 * @returns {{ ligne: number, texte: string }[]}
 */
export function sitesDeDelegueManuscrit(f, verbes) {
  if (!f.text.includes('FLOWS') && !f.text.includes('FLOW_HANDLERS')) return [];
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
