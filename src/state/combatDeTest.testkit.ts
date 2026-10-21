/**
 * Le duel de `noyau/combatDeTest.testkit.ts`, posé dans le store, dans `testScene`. Partagé par les tests
 * de flux de combat sous horloge factice (#2779).
 */
import { vi } from 'vitest';
import { useGame } from './store';
import { auContact, heroDuDuel } from '../noyau/combatDeTest.testkit';
import { testScene } from '../scenes/test-fixture';
import type { Combatant } from '../engine/types';

export function heroFaceAUnEnnemi(): { H: Combatant; E: Combatant } {
  const g = useGame.getState;
  useGame.setState({ party: [heroDuDuel()] });
  g().startScene(testScene());
  g().startCombat('enc-mutants');
  g().confirmRoundStart();
  vi.clearAllTimers();
  const { H, E, patch } = auContact(g());
  useGame.setState(patch);
  return { H, E };
}
