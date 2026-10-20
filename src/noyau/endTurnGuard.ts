import type { Combatant } from '../engine/types';
import type { BattleState } from './etat';
import type { PendingCleave } from './pendings';
import { canTakeAction } from '../engine/conditions';

/**
 * GARDE-FOU « TOUR GÂCHÉ » (spec HUD combat §1c-bis, COIN) — module FEUILLE : finir son tour avec
 * l'Action INTACTE demande DEUX gestes. La POLITIQUE est celle de l'entrée de registre `end-turn`
 * (`actionRegistry`), franchie par la plaque de sortie de la console COMME par la touche ; l'armement
 * vit dans le combat (`battle.endTurnArmed`), donc il est répliqué et il se LIT à l'écran.
 */
/**
 * EMPREINTE de l'économie du tour EN COURS : Round, rang du tour, Mouvement dépensé, Action prise.
 * Support de l'armement du garde-fou de fin de tour (ci-dessous) : tout geste qui touche à l'économie
 * (un pas, l'Action, l'annulation d'un déplacement, le passage au combattant suivant) change
 * l'empreinte — l'armement devient caduc PAR CONSTRUCTION, sans remise à zéro dispersée à chaque site.
 * Seule exception nécessaire : `cancelMove`, INVERSE unique de l'économie, RESTAURE une empreinte
 * déjà vue et désarme donc explicitement (`combatSlice.ts`, `endTurnArmed: undefined`).
 */
export function turnEconomyStamp(b: BattleState): string {
  return `${b.round}|${b.turn}|${b.movementUsed}|${b.acted ? 1 : 0}`;
}

/** L'Action est-elle PRISE pour le tour ? — `battle.acted`, sauf sous une chaîne de balayage qui porte
 *  la restitution d'une gratuite (`PendingCleave.restitution`, LDB 85 l.43, LDB 21 l.33) : la chaîne
 *  rendra `prevActed` à sa fermeture, c'est donc l'état vrai du tour. Source UNIQUE du compteur
 *  d'Action de la console et du garde-fou ci-dessous. */
export function actionPrise(battle: BattleState, pendingCleave: PendingCleave | null): boolean {
  return pendingCleave?.restitution ? pendingCleave.restitution.prevActed : battle.acted;
}

/** Finir le tour MAINTENANT gâcherait-il l'Action ? (elle est intacte et l'acteur peut encore agir) —
 *  prédicat UNIQUE du garde-fou : l'entrée de registre et la plaque de sortie de la console lisent le
 *  même, elles ne peuvent plus diverger. */
export function wastesAction(active: Combatant, battle: BattleState, pendingCleave: PendingCleave | null): boolean {
  return !actionPrise(battle, pendingCleave) && canTakeAction(active);
}

/** Le 2ᵉ geste de fin de tour est-il ARMÉ pour l'économie COURANTE ? (`battle.endTurnArmed` porte
 *  l'empreinte posée par le 1er geste ; une empreinte périmée ne vaut rien). */
export function endTurnArmed(b: BattleState): boolean {
  return !!b.endTurnArmed && b.endTurnArmed === turnEconomyStamp(b);
}
