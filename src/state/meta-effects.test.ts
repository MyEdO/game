/**
 * Méta-flux comme Effets de scène (#83) : les événements de campagne s'exposent comme des `Effect`
 * authorables, câblés sur les SURFACES EXISTANTES — `sessionEnd` ouvre `SessionEndModal` (via le flag
 * `sessionEndOpen`), `openCharacterCreator` émet `EVT.HEROS_A_CREER`, que le store câble sur l'assistant
 * existant (`setEditingHero(null)` + écran `creator`, #2817 D5). Aucun nouveau moteur : on branche sur ce
 * qui existe.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { applyEffects } from '../noyau/combatEffects';
import { createHero } from '../engine/character';

describe('Méta-effets de scène (#83)', () => {
  beforeEach(() => {
    const h = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    useGame.setState({ party: [h], journal: [], sessionEndOpen: false, screen: 'campaign', editingHeroId: 'x' });
  });

  it('sessionEnd ouvre l’écran de fin de séance existant', () => {
    expect(useGame.getState().sessionEndOpen).toBe(false);
    applyEffects(useGame.getState, useGame.setState, [{ type: 'sessionEnd' }]);
    expect(useGame.getState().sessionEndOpen).toBe(true);
    useGame.getState().closeSessionEnd();
    expect(useGame.getState().sessionEndOpen).toBe(false);
  });

  it('openCharacterCreator ouvre l’assistant existant pour un NOUVEAU héros', () => {
    applyEffects(useGame.getState, useGame.setState, [{ type: 'openCharacterCreator' }]);
    expect(useGame.getState().screen).toBe('creator');
    expect(useGame.getState().editingHeroId).toBeNull(); // nouveau héros (pas d'édition)
  });
});
