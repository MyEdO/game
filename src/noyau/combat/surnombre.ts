/**
 * Le décompte du Surnombre (LDB 14 l.110) : combien de combattants d'un camp sont au contact d'une cible. Source
 * unique de la résolution de mêlée (`outnumberMod`, `noyau/combatFlow.ts`) et de l'État de situation Assailli
 * (`noyau/pontDeCombat.ts`).
 */
import type { Combatant } from '../../engine/types';
import type { BattleState } from '../etat';
import { isOutOfAction } from '../../engine/conditions';
import { distanceDeContact } from '../monde/footprint';

/** Les combattants vivants et posés du camp `kind` au contact de `cible` (`distanceDeContact`, relief compris). */
export function effectifAuContact(battle: BattleState, cible: Combatant, kind: Combatant['kind']): number {
  return battle.combatants.filter((c) => c.kind === kind && !isOutOfAction(c) && c.pos && distanceDeContact(c, cible) <= 1).length;
}
