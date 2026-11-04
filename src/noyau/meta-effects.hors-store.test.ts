/**
 * Méta-flux comme Effets de scène (#83) : `sessionEnd` ouvre `SessionEndModal` (via le flag `sessionEndOpen`).
 * La liaison de `openCharacterCreator` à l'assistant du web vit en `src/state/meta-effects.test.ts`.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { applyEffects } from './combatEffects';
import { createHero } from '../engine/character';

let banc: Banc;

describe('Méta-effets de scène (#83)', () => {
  beforeEach(() => {
    const h = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    banc = ouvrirLeBanc({ etat: { party: [h], journal: [], sessionEndOpen: false } });
  });

  it('sessionEnd ouvre l’écran de fin de séance existant', () => {
    expect(banc.getState().sessionEndOpen).toBe(false);
    applyEffects(banc.getState, banc.setState, [{ type: 'sessionEnd' }]);
    expect(banc.getState().sessionEndOpen).toBe(true);
    banc.getState().closeSessionEnd();
    expect(banc.getState().sessionEndOpen).toBe(false);
  });
});
