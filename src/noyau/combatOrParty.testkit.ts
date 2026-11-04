/**
 * LE COMBAT DE `combatantClickActs` : deux héros prétirés et un ennemi adjacent au premier, sur une arène au sol de départ,
 * partagé par le test du noyau (`combatOrParty.hors-store.test.ts`) et celui de la liaison web
 * (`src/state/combatOrParty-inspection.test.ts`).
 */
import { makePregens } from '../data/pregens';
import { spawnEnemy } from './monde/spawn';
import { DEFAULT_TERRAIN } from './monde/scene';
import type { EtatDeJeu } from './etat';

/** Arène minimale au sol de départ (combatantClickActs dérive l'affordance d'attaque → besoin d'une scène). */
const arena = () => {
  const w = 16, h = 12;
  return { id: 's', dimensions: { w, h }, levels: [{ z: 0, tiles: new Array(w * h).fill(DEFAULT_TERRAIN) }], entities: [], dialogues: [], triggers: [], encounters: [] } as never;
};

/** Pose le combat par `set`, le tour au premier héros, `over` fusionné au `battle`. */
export function poserLeCombat(set: (patch: Partial<EtatDeJeu>) => void, over: Record<string, unknown> = {}) {
  const hero = makePregens()[0]; hero.id = 'h1'; hero.pos = { x: 6, y: 6 };
  const ally = makePregens()[1]; ally.id = 'h2'; ally.pos = { x: 5, y: 6 };
  const enemy = spawnEnemy({ ref: 'humain' }, 'e1', { x: 7, y: 6 }); // adjacent au héros
  const battle = {
    combatants: [hero, ally, enemy], order: ['h1', 'h2', 'e1'], baseOrder: ['h1', 'h2', 'e1'],
    turn: 0, round: 1, action: null, selectedSpellId: null, reachable: new Map(),
    movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null, ...over,
  } as never;
  set({ battle, scene: arena(), party: [hero, ally] });
  return { hero, ally, enemy };
}
