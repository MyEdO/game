/**
 * LE COMBAT DE `combatantClickActs` : deux héros déclarés (`combattantDeTest`) et un ennemi adjacent au premier, sur une arène au sol de départ,
 * celui du décideur au noyau (`combatOrParty.hors-store.test.ts`).
 */
import { combattantDeTest } from '../engine/combattantDeTest.testkit';
import { unarmedWeapon } from '../engine/items';
import { spawnEnemy } from './monde/spawn';
import { emptyScene } from './monde/scene';
import type { EtatDeJeu } from './etat';

/** Arène minimale au sol de départ (combatantClickActs dérive l'affordance d'attaque → besoin d'une scène). */
const arena = () => emptyScene('s', 16, 12);

/** Pose le combat par `set`, le tour au premier héros, `over` fusionné au `battle`. */
export function poserLeCombat(set: (patch: Partial<EtatDeJeu>) => void, over: Record<string, unknown> = {}) {
  const hero = combattantDeTest({ id: 'h1', label: 'Héros', kind: 'heros', pos: { x: 6, y: 6 }, weapons: [unarmedWeapon()] });
  const ally = combattantDeTest({ id: 'h2', label: 'Allié', kind: 'heros', pos: { x: 5, y: 6 } });
  const enemy = spawnEnemy({ ref: 'humain' }, 'e1', { x: 7, y: 6 }); // adjacent au héros
  const battle = {
    combatants: [hero, ally, enemy], order: ['h1', 'h2', 'e1'], baseOrder: ['h1', 'h2', 'e1'],
    turn: 0, round: 1, action: null, selectedSpellId: null, reachable: new Map(),
    movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null, ...over,
  } as never;
  set({ battle, scene: arena(), party: [hero, ally] });
  return { hero, ally, enemy };
}
