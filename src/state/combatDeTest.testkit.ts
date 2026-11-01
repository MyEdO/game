/**
 * Le duel de `noyau/combatDeTest.testkit.ts`, posé dans le store, dans `testScene`. Partagé par les tests
 * de flux de combat sous horloge factice (#2779).
 */
import { vi } from 'vitest';
import { useGame } from './store';
import { heroFaceAUnEnnemi as ouvrirLeDuel, reluDans } from '../noyau/combatDeTest.testkit';
import { testScene } from '../scenes/test-fixture';
import type { Combatant } from '../engine/types';

export function heroFaceAUnEnnemi(): { H: Combatant; E: Combatant } {
  return ouvrirLeDuel({ getState: useGame.getState, setState: (patch) => useGame.setState(patch), abandonner: () => vi.clearAllTimers() }, testScene());
}

/** L'acteur `c` relu par son id dans le store (`reluDans`). */
export function relu(c: Combatant): Combatant {
  return reluDans(useGame.getState, c);
}
