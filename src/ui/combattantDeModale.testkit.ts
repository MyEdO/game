/**
 * Combattant minimal qu'une modale de jet rend : caractéristiques, PB, Chance et Résilience posés,
 * aucune compétence avancée ; et le combat minimal qui l'accueille. Partagé par les tests de rendu des modales (#2779).
 */
import type { Combatant } from '../engine/types';
import type { BattleState } from '../noyau/etat';
import { combattantDeTest, blessuresDeBase } from '../engine/combattantDeTest.testkit';

const CARACTERISTIQUES = {
  'capacite-de-combat': 45, 'capacite-de-tir': 50, force: 35, endurance: 35, initiative: 30,
  agilite: 40, dexterite: 30, intelligence: 30, 'force-mentale': 40, sociabilite: 40,
};

export function combattantDeModale(id: string, kind: Combatant['kind'] = 'heros'): Combatant {
  return combattantDeTest({
    id, label: id, kind, characteristics: CARACTERISTIQUES, traumas: [], engagedWith: [], items: [], size: 'moyenne',
    pos: { x: 0, y: 0 }, wounds: blessuresDeBase(18), resilience: 2, fortune: 2, species: 'humains-reiklander',
    bodyShape: 'humanoide',
  });
}

/** Le combat minimal où une modale de jet de combat se rend (`HealModal` : le soin hors infirmerie est un soin de
 *  combat), `combatants` dans l'ordre du tour, le premier actif. */
export function combatDeModale(combatants: Combatant[]): BattleState {
  const order = combatants.map((c) => c.id);
  return {
    combatants, order, baseOrder: order, turn: 0, round: 1, action: null, selectedSpellId: null, reachable: new Map(),
    movementUsed: 0, acted: false, log: [], over: null,
  } as unknown as BattleState;
}
