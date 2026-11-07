/**
 * Méta-flux comme Effets de scène (#83) : `sessionEnd` ouvre la fin de séance (`finDeSeance`, aucune case cochée).
 * `openCharacterCreator` : `combatEffects-heros-a-creer.hors-store.test.ts`.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { applyEffects } from './combatEffects';
import { createHero } from '../engine/character';

let banc: Banc;

describe('Méta-effets de scène (#83)', () => {
  beforeEach(() => {
    const h = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    banc = ouvrirLeBanc({ etat: { party: [h], journal: [] } });
  });

  it('sessionEnd ouvre la fin de séance ; sa sortie la ferme sans rien appliquer', () => {
    expect(banc.getState().finDeSeance).toBeNull();
    applyEffects(banc.getState, banc.setState, [{ type: 'sessionEnd' }]);
    expect(banc.getState().finDeSeance).toEqual({ heros: {}, groupe: {} });
    banc.getState().fenetreFermer('finDeSeance');
    expect(banc.getState().finDeSeance).toBeNull();
  });
});
