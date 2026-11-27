/**
 * Les deux ouvertures d'un tour pilotées sur un banc (`ouvrirLeTour`, combatFlow) : le tour suivant du même Round
 * (`advanceTurn`) et le premier tour d'un Round neuf (franchissement, pause de début de Round, `ouvrirLeRound`).
 */
import type { Banc } from './banc.testkit';
import type { JeuDuNoyau } from './machinerieDuNoyau';
import { advanceTurn } from './combatFlow';
import { battleRng } from './battleRng';
import { draineCascade } from './cascade.testkit';

/** Tous les dés de combat (`battleRng`) posés sur `n`, ramené à l'étendue de chaque dé (1 : réussite d'un d100, 100 :
 *  échec). */
export function deDeCombat(n: number): void {
  battleRng().int = (min: number, max: number) => Math.min(max, Math.max(min, n));
}

/** Passe la main de `actifId` au combattant qui le suit dans l'ordre du Round, `suivantId` : le tour suivant du même
 *  Round s'ouvre (`advanceTurn`). */
export function ouvrirLeTourSuivant(banc: Banc, actifId: string, suivantId: string): void {
  const b = banc.getState().battle!;
  const reste = b.order.filter((id) => id !== actifId && id !== suivantId);
  const order = [actifId, suivantId, ...reste];
  banc.setState({ battle: { ...b, order, baseOrder: order, turn: 0 } });
  advanceTurn(banc.getState, banc.setState);
}

/** Franchit le Round depuis le dernier de l'ordre : l'ordre du Round suivant est `ordre` (puis les autres), le
 *  franchissement joue ses crochets (`onRoundEnd`, dont les effets `onRoundStart` du Round qui s'ouvre). La séquence de
 *  fin de Round ou la pause de début de Round reste due : `lancerLeRoundDu` la clôt. */
export function franchirLeRound(banc: Banc, ordre: readonly string[]): void {
  const b = banc.getState().battle!;
  const order = [...ordre, ...b.order.filter((id) => !ordre.includes(id))];
  banc.setState({ battle: { ...b, order, baseOrder: order, turn: order.length - 1 } });
  advanceTurn(banc.getState, banc.setState);
}

/** Joue la séquence due jusqu'à sa clôture (`draineCascade`), puis valide la pause de début de Round si elle est due : le
 *  premier tour du Round s'ouvre. */
export function lancerLeRoundDu(p: { getState: () => JeuDuNoyau }): void {
  draineCascade(p.getState);
  if (p.getState().pendingRoundStart) p.getState().fenetreValider('debutDuRound');
}
