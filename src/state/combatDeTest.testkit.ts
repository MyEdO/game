/**
 * Le duel de `noyau/combatDeTest.testkit.ts`, posé dans le store, dans `testScene`, pour les tests d'interface
 * sous horloge factice (#2779).
 */
import { vi } from 'vitest';
import { useGame } from './store';
import { heroFaceAUnEnnemi as heroFaceAUnEnnemiDuNoyau } from '../noyau/combatDeTest.testkit';
import { testScene } from '../scenes/test-fixture';
import type { Combatant } from '../engine/types';

export function heroFaceAUnEnnemi(): { H: Combatant; E: Combatant } {
  return heroFaceAUnEnnemiDuNoyau({ getState: useGame.getState, setState: (patch) => useGame.setState(patch), abandonner: () => vi.clearAllTimers() }, testScene());
}
