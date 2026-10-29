import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { applyEffects } from './combatEffects';
import type { Effect } from '../data/schemas/defs-scenes/effets';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

/**
 * Effet `setLight` (Lot L — mise en scène) : « les lumières baissent, le rideau se lève ». Pose un
 * niveau de lumière de scène (0 = noir, 1 = plein jour) lu par le rendu (overlay d'assombrissement).
 * Générique/éditable — vaut pour tout intérieur (donjon, théâtre…), pas seulement l'Opéra.
 */
describe('Effet setLight', () => {
  it('pose le niveau de lumière courant', () => {
    applyEffects(banc.getState, banc.setState, [{ type: 'setLight', level: 0.2 }] as Effect[]);
    expect(banc.getState().lightLevel).toBe(0.2);
  });

  it('borne le niveau dans [0,1]', () => {
    applyEffects(banc.getState, banc.setState, [{ type: 'setLight', level: 5 }] as Effect[]);
    expect(banc.getState().lightLevel).toBe(1);
    applyEffects(banc.getState, banc.setState, [{ type: 'setLight', level: -3 }] as Effect[]);
    expect(banc.getState().lightLevel).toBe(0);
  });
});
