import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { tousLesHerosDeScenario } from '../scenes/test-scenarios/_heros';
import { damageVesselHull, healVesselHull } from '../noyau/seaVoyageFlow';
import { emptyScene } from '../noyau/monde/scene';
import type { WorldMap } from '../noyau/worldMap';
import { voyageTiles, vesselHullGauge } from '../ui/VoyageScreen';

/**
 * VOYAGE MARITIME (7b), liaison web (#296) : la jauge de l'écran de traversée et la tuile de voyage lisent la coque
 * VIVE, `state.vessel`. La traversée elle-même se joue au banc du noyau (`src/noyau/sea-voyage-flow.hors-store.test.ts`).
 */
const get = useGame.getState.bind(useGame);
const set = useGame.setState.bind(useGame);

const seaMap: WorldMap = {
  id: 'm', label: 'Mer des Griffes',
  places: [
    { id: 'A', label: 'Salzenmund', pos: { x: 0, y: 0 }, scene: { id: 'port-a' } },
    { id: 'B', label: 'Erengrad', pos: { x: 10, y: 0 }, scene: { id: 'port-b' } },
  ],
  routes: [{ id: 'r1', a: { id: 'A' }, b: { id: 'B' }, km: 550, modes: ['mer'], sea: true, seaHeading: 'est' }],
};

describe('#296 — state.vessel SOURCE UNIQUE de la coque de trajet (non-divergence)', () => {
  beforeEach(() => {
    set({
      party: tousLesHerosDeScenario(idsDeTest).slice(0, 3), scene: emptyScene('port-a', 2, 2), battle: null, worldMap: seaMap, lieu: 'A',
      travelPlan: null, pendingRest: null, pendingCascade: null, gameTime: 8 * 60,
      vessel: { vehicleId: 'cogue', morale: { score: 75, lastMoraleWeek: 0, factors: [] } },
    } as never);
  });

  it('la jauge de l’écran de traversée et la tuile de voyage lisent la MÊME source vive après un soin', () => {
    get().partirEnVoyage('r1', 'mer', { cadence: 'jourParJour' });
    const hull0 = get().travelPlan!.vehicle!.wounds.current;
    damageVesselHull(get, set, get().travelPlan!.vehicle!, 10);
    healVesselHull(get, set, get().travelPlan!.vehicle!, 3);
    const gauge = vesselHullGauge(get().vessel!)!;
    const tile = voyageTiles('mer', get().travelPlan!, get().vessel!, get().party, [], get().gameTime).find((t) => t.key === 'coque')!;
    expect(gauge.current).toBe(hull0 - 7);
    expect(tile.value).toBe(`${hull0 - 7} / ${gauge.max}`);
    expect(gauge.current).toBe(get().vessel!.wounds!.current);
  });
});
