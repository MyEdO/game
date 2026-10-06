import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { applyEffects, EFFECT_HANDLERS, type EffectRefCtx } from './combatEffects';
import { createHero } from '../engine/character';
import { bonus } from '../engine/characteristics';
import { hasCondition } from '../engine/conditions';
import { emptyScene, isWalkable, type Effect, type Scene, type Terrain } from './scene';
import { validateScene } from './validateScene';
import { flowFromEffects } from './flow';
import { draineCascade } from './cascadeTestKit';
import { t } from '../i18n';

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

  /** Balcon (couche 1, 4 m) sur la seule case (5,5) d'un parterre 10×10 au sol (couche 0). */
  function balconScene(): Scene {
    const s = emptyScene(10, 10);
    const tiles = new Array(100).fill('vide') as Terrain[];
    tiles[5 * 10 + 5] = s.layers[0].tiles[0];
    const height = new Array(100).fill(0) as number[];
    height[5 * 10 + 5] = 4;
    s.layers.push({ z: 1, tiles, height });
    return s;
  }

  it('l’atterrissage est un PAS du groupe : il arrive sur `to` (balcon → parterre)', () => {
    loneHero();
    useGame.setState({ mode: 'exploration', scene: balconScene(), partyPos: { x: 5, y: 5, z: 1 } });
    applyEffects(useGame.getState, useGame.setState, [{ type: 'fall', target: 'party', metres: 4, to: { x: 5, y: 8, z: 0 } }] as Effect[]);
    expect(useGame.getState().partyPos).toEqual({ x: 5, y: 8, z: 0 });
  });

  it('`to` où le groupe ne se pose pas : l’Effet entier est REFUSÉ en le disant — ni pas, ni dé, ni Dégâts', () => {
    const before = loneHero().wounds.current;
    useGame.setState({ mode: 'exploration', scene: balconScene(), partyPos: { x: 5, y: 5, z: 1 }, journal: [], pendingCascade: null });
    applyEffects(useGame.getState, useGame.setState, [{ type: 'fall', target: 'party', metres: 4, to: { x: 5, y: 8, z: 1 } }] as Effect[]);
    expect(useGame.getState().partyPos).toEqual({ x: 5, y: 5, z: 1 });
    expect(useGame.getState().journal.slice(-1)[0]).toBe(t('eff.fallAtterrissageRefuse'));
    expect(t('eff.fallAtterrissageRefuse')).not.toMatch(/[0-9]/);
    expect(useGame.getState().pendingCascade, 'aucun dé de chute ouvert').toBeNull();
    draineCascade(useGame.getState);
    expect(useGame.getState().party[0].wounds.current).toBe(before);
  });

  it('authoring : un `to` hors de la carte, ou sur une case non marchable À SON ÉTAGE, est une ERREUR ; marchable, rien', () => {
    const balcon = balconScene();
    const ctx = {
      within: (x: number, y: number) => x >= 0 && y >= 0 && x < 10 && y < 10,
      walkable: (x: number, y: number, z: number) => isWalkable(balcon, x, y, z),
    } as EffectRefCtx;
    const refs = EFFECT_HANDLERS.fall.refs!;
    expect(refs({ type: 'fall', target: 'party', metres: 4, to: { x: 12, y: 3 } }, ctx)).toEqual([{ level: 'error', message: 'Chute : atterrissage (12,3) hors de la carte' }]);
    expect(refs({ type: 'fall', target: 'party', metres: 4, to: { x: 5, y: 8, z: 1 } }, ctx)).toEqual([{ level: 'error', message: 'Chute : atterrissage (5,8, étage 1) sur une case non marchable' }]);
    expect(refs({ type: 'fall', target: 'party', metres: 4, to: { x: 5, y: 8, z: 0 } }, ctx)).toEqual([]);
    expect(refs({ type: 'fall', target: 'party', metres: 4, to: { x: 5, y: 5, z: 1 } }, ctx)).toEqual([]);
    expect(refs({ type: 'fall', target: 'party', metres: 4 }, ctx)).toEqual([]);
  });

  it('authoring : `validateScene` branche la marchabilité de LA scène — le `to` non marchable remonte à l’auteur', () => {
    const sautVers = (to: { x: number; y: number; z: number }): Scene => ({
      ...balconScene(),
      triggers: [{ id: 'saut', rect: { x: 5, y: 5, w: 1, h: 1 }, flow: flowFromEffects([{ type: 'fall', target: 'party', metres: 4, to }] as Effect[]) }],
    });
    const chutes = (sc: Scene) => validateScene([sc]).filter((w) => w.refId === 'saut' && w.message.startsWith('Chute')).map((w) => [w.level, w.message]);
    expect(chutes(sautVers({ x: 5, y: 8, z: 1 }))).toEqual([['error', 'Chute : atterrissage (5,8, étage 1) sur une case non marchable']]);
    expect(chutes(sautVers({ x: 5, y: 8, z: 0 }))).toEqual([]);
  });
});
