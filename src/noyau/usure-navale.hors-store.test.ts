import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { vehicles } from '../data';
import { setDataset } from '../data/overrides';
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { BOARD_EVENTS, type SeaEventDef } from '../engine/seaVoyage';
import type { VehicleData } from '../engine/types';
import { tousLesHerosDeScenario } from '../scenes/test-scenarios/_heros';
import { ouvrirLeBanc } from './banc.testkit';
import { seedBattleRng } from './battleRng';
import { emptyScene } from './monde/scene';
import { buildSeaPlan, damageCampaignVessel, healVesselHull, runSeaDay, setVesselHull } from './seaVoyageFlow';

const NAVIRE: Omit<VehicleData, 'id'> & { id: string } = {
  id: 'voilier-dessai',
  type: 'vehicles',
  label: 'Voilier d’essai',
  icon: 'voyage/navire-a-voile',
  source: { book: 'mer-des-griffes', page: 93 },
  hull: { char: { endurance: 45, B: 50 }, bodyShape: 'vehicule', propulsion: 'maritime', footprint: 3 },
  ship: {
    crew: 15, manoeuvre: 0, lengthM: 25, capacity: 300,
    sail: { m: 5, crew: 8, spec: 'cogue' }, traits: [],
  },
};

const USURE: SeaEventDef = {
  id: 'usure-dessai',
  label: 'Usure de la coque',
  desc: 'La coque s’abîme.',
  min: 44,
  max: 47,
  infligeUsure: true,
  source: { book: 'mer-des-griffes', page: 132 },
  consequence: {
    kind: 'effet',
    effet: { type: 'ops', on: 'navire', ops: [{ op: 'wounds', amount: { dice: { n: 1, sides: 10 } }, ignoreTB: true, ignoreAP: true }] },
  },
};

function jouerUnJourDUsure(current: number) {
  const { getState: get, setState: set } = ouvrirLeBanc();
  seedBattleRng(3);
  set({
    party: tousLesHerosDeScenario(idsDeTest).slice(0, 3),
    scene: emptyScene('port-a', 2, 2),
    vessel: {
      uid: 'navire-1',
      vehicleId: NAVIRE.id,
      morale: { score: 75, lastMoraleWeek: 0, factors: [] },
      wounds: { current, max: 50 },
    },
  });
  const plan = buildSeaPlan(get, 'r1', 'A', 'B', { km: 550, seaHeading: 'est' }, { cadence: 'jourParJour' })!;
  set({ travelPlan: { ...plan, sea: { ...plan.sea!, forcedEventId: USURE.id } } });
  runSeaDay(get, set);
  return { get, set };
}

describe('Usure du voyage (MDG 15 l.200)', () => {
  let naviresAvant: VehicleData[];
  let evenementsAvant: SeaEventDef[];

  beforeEach(() => {
    naviresAvant = [...vehicles];
    evenementsAvant = [...BOARD_EVENTS];
    setDataset('vehicles', [...naviresAvant, NAVIRE]);
    setDataset('seaBoardEvents', [USURE]);
  });

  afterEach(() => {
    setDataset('vehicles', naviresAvant);
    setDataset('seaBoardEvents', evenementsAvant);
  });

  it('ne compte que les Blessures effectivement perdues, même si le dé dépasse la coque restante', () => {
    const { get } = jouerUnJourDUsure(1);
    expect(get().vessel).toMatchObject({ usure: 1, wounds: { current: 0, max: 50 } });
    expect(get().travelPlan!.vehicle!.wounds.current).toBe(0);
  });

  it('conserve la part d’Usure quand la coque est encore blessée et ne la recrée pas après guérison complète', () => {
    const courantAvantUsure = 35;
    const { get, set } = jouerUnJourDUsure(courantAvantUsure);
    const apres = get().vessel!;
    const perte = courantAvantUsure - apres.wounds!.current;
    expect(perte).toBeGreaterThanOrEqual(1);
    expect(perte).toBeLessThanOrEqual(10);
    expect(apres.usure).toBe(perte);

    const courantApresSoin = 50 - perte;
    setVesselHull(get, set, courantApresSoin, 50);
    expect(get().vessel).toMatchObject({ usure: perte, wounds: { current: courantApresSoin, max: 50 } });

    healVesselHull(get, set, get().travelPlan!.vehicle!, perte);
    expect(get().vessel!.wounds).toEqual({ current: 50, max: 50 });
    expect(get().vessel!.usure).toBeUndefined();
    damageCampaignVessel(get, set, 5);
    expect(get().vessel!.wounds).toEqual({ current: 45, max: 50 });
    expect(get().vessel!.usure).toBeUndefined();
  });
});
