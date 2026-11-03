/**
 * Méta-flux comme Effets de scène (#83), côté web : `openCharacterCreator` émet `EVT.HEROS_A_CREER`, que le
 * store câble sur l'assistant existant (`setEditingHero(null)` + écran `creator`, #2817 D5). `sessionEnd` se
 * joue au banc du noyau (`src/noyau/meta-effects.hors-store.test.ts`).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { applyEffects } from '../noyau/combatEffects';
import { createHero } from '../engine/character';

describe('Méta-effets de scène (#83)', () => {
  beforeEach(() => {
    const h = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    useGame.setState({ party: [h], journal: [], screen: 'campaign', editingHeroId: 'x' });
  });

  it('openCharacterCreator ouvre l’assistant existant pour un NOUVEAU héros', () => {
    applyEffects(useGame.getState, useGame.setState, [{ type: 'openCharacterCreator' }]);
    expect(useGame.getState().screen).toBe('creator');
    expect(useGame.getState().editingHeroId).toBeNull(); // nouveau héros (pas d'édition)
  });
});
