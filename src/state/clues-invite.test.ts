/**
 * LIAISON WEB du carnet d'indices (#2415) : chez un invité, l'action `marquerLesIndices` du store est enrobée en intent
 * (`interceptGuestActions`) et ne se joue pas localement. La règle du carnet est au noyau
 * (`src/noyau/monde/clues.hors-store.test.ts`), son départ en intention au salon (`src/hote/coop/salon.hors-store.test.ts`).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { applyEffects } from '../noyau/combatEffects';
import { interceptGuestActions, restoreGuestActions } from './netFlow';
import { affichés, narratif, hero, fixtureScene } from '../noyau/monde/clues.fixture';

beforeEach(() => {
  useGame.setState({ campaignNarratif: null, party: [], scene: null, clues: {} });
});

describe('clues — câblage store (#670)', () => {
  it('chez un invité, `marquerLesIndices` PART en intent vers l’hôte et ne s’exécute pas localement (#2415)', () => {
    useGame.setState({ party: [hero()] });
    useGame.getState().loadProject({ scenes: [fixtureScene('scene-o')], entryId: 'scene-o', narratif: narratif, projet: null });
    applyEffects(useGame.getState, useGame.setState, [{ type: 'revealClue', indiceId: 'ind-lettre' }]);
    const local = useGame.getState().marquerLesIndices;
    const vus = affichés(useGame.getState().clues, ['ind-lettre']);
    // Câblage : le substitut RÉELLEMENT posé par `interceptGuestActions` (sans session, l'envoi est inerte).
    interceptGuestActions();
    try {
      expect(useGame.getState().marquerLesIndices, 'marquerLesIndices n’est pas enrobé en intent').not.toBe(local);
      useGame.getState().marquerLesIndices(vus);
      expect(useGame.getState().clues['ind-lettre'].vuParSiège).toBeUndefined();
    } finally {
      restoreGuestActions();
    }
  });
});
