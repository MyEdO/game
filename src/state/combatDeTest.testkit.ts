/**
 * Le duel de `noyau/combatDeTest.testkit.ts`, posé dans le store, dans `testScene`. Partagé par les tests
 * de flux de combat sous horloge factice (#2779).
 */
import { vi } from 'vitest';
import { useGame } from './store';
import { heroFaceAUnEnnemi as ouvrirLeDuel } from '../noyau/combatDeTest.testkit';
import { testScene } from '../scenes/test-fixture';
import type { Combatant } from '../engine/types';
import { actorIn } from '../noyau/monde/combatants';

export function heroFaceAUnEnnemi(): { H: Combatant; E: Combatant } {
  return ouvrirLeDuel({ getState: useGame.getState, setState: (patch) => useGame.setState(patch), abandonner: () => vi.clearAllTimers() }, testScene());
}

/** L'acteur `c` relu par son id dans le store : une écriture copie le combattant dont le maximum des
 *  Blessures bouge (`noyau/transitionDuJeu.ts`), une référence prise avant elle désigne l'ancien objet. */
export function relu(c: Combatant): Combatant {
  return actorIn(useGame.getState(), c.id)!;
}
