import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { applyEffects } from './combatEffects';
import { createHero } from '../engine/character';
import { bonus } from '../engine/characteristics';
import { hasCondition } from '../engine/conditions';
import type { Effect } from './scene';
import { draineCascade } from './cascadeTestKit';

/**
 * Effet `fall` — Chute (LDB 15 l.78-84) : 3 Dégâts par mètre + 1d10, réduits par le Bonus
 * d'Endurance mais PAS par les PA ; si les Blessures subies dépassent le BE → État À Terre. `to`
 * (optionnel) repositionne le groupe à l'arrivée (balcon → parterre, plancher de loge effondré).
 */
describe('Effet fall — chute', () => {
  beforeEach(() => useGame.setState({ battle: null, partyPos: { x: 0, y: 0 } }));

  function loneHero() {
    const h = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'A', seed: 3 });
    h.wounds = { current: 40, max: 40 };
    useGame.setState({ party: [h] });
    return h;
  }

  it('inflige 3/m + 1d10 réduits par le BE (pas les PA), et pose À Terre si > BE', () => {
    const h = loneHero();
    const be = bonus(h.characteristics.endurance);
    const before = h.wounds.current;
    applyEffects(useGame.getState, useGame.setState, [{ type: 'fall', target: 'party', metres: 4 }] as Effect[]);
    // Le 1d10 des Dégâts est un dé du jeu : il tombe à la PORTE (#1508), en étape à dé nu par tombant.
    expect(useGame.getState().party[0].wounds.current, 'rien avant le dé').toBe(before);
    draineCascade(useGame.getState);
    const lost = before - useGame.getState().party[0].wounds.current;
    expect(lost).toBeGreaterThanOrEqual(3 * 4 - be + 1); // 1d10 ≥ 1
    expect(lost).toBeLessThanOrEqual(3 * 4 - be + 10); // 1d10 ≤ 10
    expect(hasCondition(useGame.getState().party[0], 'a-terre')).toBe(true); // 12−BE+1d10 ≫ BE
  });

  it('`to` repositionne le groupe (balcon → parterre)', () => {
    loneHero();
    useGame.setState({ partyPos: { x: 5, y: 5, z: 1 } });
    applyEffects(useGame.getState, useGame.setState, [{ type: 'fall', target: 'party', metres: 4, to: { x: 5, y: 8, z: 0 } }] as Effect[]);
    expect(useGame.getState().partyPos).toEqual({ x: 5, y: 8, z: 0 });
  });
});
