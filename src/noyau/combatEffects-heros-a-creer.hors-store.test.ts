/**
 * L'Effet de scène `openCharacterCreator` (`EFFECT_HANDLERS`, `combatEffects.ts`) : contrat déclaré, le noyau émet
 * `EVT.HEROS_A_CREER` et l'hôte ouvre son assistant de création. Aucun état du jeu ne change.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { applyEffects } from './combatEffects';
import { bus, EVT } from './bus';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

describe('openCharacterCreator — l’hôte est appelé à créer un héros', () => {
  it('appliqué, l’Effet émet une fois `HEROS_A_CREER`, sans toucher au groupe', () => {
    let appels = 0;
    const off = bus.on(EVT.HEROS_A_CREER, () => { appels++; });
    try {
      const avant = banc.getState().party;
      applyEffects(banc.getState, banc.setState, [{ type: 'openCharacterCreator' }]);
      expect(appels).toBe(1);
      expect(banc.getState().party).toBe(avant);
    } finally {
      off();
    }
  });
});
