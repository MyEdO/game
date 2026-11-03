/**
 * Le banc de recette `shipCrit` sur une coque routière (EDOC 07 l.334, MDG 13 l.656) rend son refus. La règle de la
 * coque routière se joue au banc du noyau (`src/noyau/coque-non-navire.hors-store.test.ts`).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Combatant } from '../engine/types';
import { useGame } from './store';
import { seedBattleRng } from '../noyau/battleRng';
import { buildApi } from './devtools';
import { emptyScene } from '../noyau/monde/scene';
import { vehicleCombatant } from '../engine/vehicle';
import { findVehicleById } from '../data';

const poser = (combatants: Combatant[], over: Record<string, unknown> = {}): void => {
  useGame.setState({
    battle: { combatants, order: combatants.map((c) => c.id), turn: 0, round: 1, acted: false, log: [] } as never,
    party: [], scene: emptyScene('scene-test', 20, 20), travelPlan: null, facing: {}, vessel: null, journal: [], ...over,
  } as never);
};

describe('coque routière (EDOC 07 l.334) : ni Critique, ni collision, ni IA de navire', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    seedBattleRng(7);
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('le banc shipCrit sur un trajet terrestre (diligence au plan de voyage) rend ✗ sans lever', () => {
    const coche = vehicleCombatant(findVehicleById('diligence')!)!;
    poser([], { travelPlan: { vehicle: coche } });
    const api = buildApi();
    expect(api.shipCrit('coque')).toBe('✗ aucune coque de NAVIRE en jeu (lance un scénario naval, ou appareille)');
    expect(api.shipCrit('coque', { hullId: coche.id })).toBe(`✗ « ${coche.label} » n'est pas une coque de NAVIRE : aucun Critique de navire`);
  });
});
