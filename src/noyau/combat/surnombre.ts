/**
 * Le décompte du Surnombre (LDB 14 l.110) : combien de combattants d'un camp sont au contact d'une cible. Source
 * unique de la résolution de mêlée (`outnumberMod`, `noyau/combatFlow.ts`), de l'État de situation Assailli
 * (`noyau/pontDeCombat.ts`) et du feu concentré de l'IA (`noyau/monde/ai.ts`).
 */
import type { Combatant } from '../../engine/types';
import type { BattleState } from '../etat';
import type { Scene } from '../monde/scene';
import { isOutOfAction } from '../../engine/conditions';
import { isInanimate } from '../../engine/structures';
import { distanceDeContact } from '../monde/footprint';

/** Parmi `combattants`, ceux du camp `kind`, vivants, posés, animés (`isInanimate`) et au contact de `cible`
 *  (`distanceDeContact`, relief compris). */
export function effectifAuContactParmi(scene: Scene | null, combattants: readonly Combatant[], cible: Combatant, kind: Combatant['kind']): number {
  return combattants.filter((c) => c.kind === kind && !isOutOfAction(c) && !isInanimate(c) && c.pos && distanceDeContact(scene, c, cible) <= 1).length;
}

/** `effectifAuContactParmi` sur tous les combattants de la bataille. */
export function effectifAuContact(scene: Scene | null, battle: BattleState, cible: Combatant, kind: Combatant['kind']): number {
  return effectifAuContactParmi(scene, battle.combatants, cible, kind);
}
