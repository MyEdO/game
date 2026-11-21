import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { buildSeaPlan, coqueDuNavireDeCampagne, reparationTemporaireTient } from './seaVoyageFlow';
import { finalizeBattle } from './combatFlow';
import { seaMagicContext } from './combatOrParty';
import { createHero } from '../engine/character';
import { findVehicleById } from '../data';
import { DEFAULT_RELIEF_DEFAULTS, DEFAULT_ROOF_DEFAULTS, type Scene } from './monde/scene';
import type { CampaignVessel } from './etat';
import { lireSave, snapshotSave } from './persistance/save';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

// #230 — le nom d'INSTANCE du navire de campagne (affichage) se propage aux coques spawnées.

const vessel = (over: Partial<CampaignVessel> = {}): CampaignVessel => ({
  uid: 'navire-1', vehicleId: 'cogue', morale: { score: 75, lastMoraleWeek: 0, factors: [] }, ...over,
});

describe('#230 — voyageShip (coque de trajet maritime) porte le nom d’instance', () => {
  beforeEach(() => { banc.setState({ gameTime: 0 }); });

  it('la coque de trajet reprend le nom d’instance quand il est posé', () => {
    banc.setState({ vessel: vessel({ label: 'Le Cormoran' }) });
    const plan = buildSeaPlan(banc.getState, 'r', 'a', 'b', { km: 100, seaHeading: 'est' });
    expect(plan?.vehicle?.label).toBe('Le Cormoran');
    expect(plan?.vehicle?.creatureId).toBe('cogue'); // le rendu reste keyé par creatureId
  });

  it('sans nom d’instance : la coque garde le label du TYPE', () => {
    banc.setState({ vessel: vessel() });
    const plan = buildSeaPlan(banc.getState, 'r', 'a', 'b', { km: 100, seaHeading: 'est' });
    expect(plan?.vehicle?.label).toBe(findVehicleById('cogue')!.label);
  });

  it('le trajet rechargé reconnaît toujours le navire qui était parti', () => {
    banc.setState({ vessel: vessel() });
    const plan = buildSeaPlan(banc.getState, 'r', 'a', 'b', { km: 100, seaHeading: 'est' })!;
    banc.setState({ travelPlan: plan });
    const enregistre = snapshotSave(banc.getState(), '2026-11-19T00:00:00.000Z');
    const relu = lireSave(JSON.stringify(enregistre));
    if (typeof relu === 'string') throw new Error(relu);
    const { travelPlan, vessel: navireRelu } = relu.data;
    expect(coqueDuNavireDeCampagne(travelPlan, navireRelu)).toBe(travelPlan!.vehicle);
    expect(coqueDuNavireDeCampagne(travelPlan, vessel({ uid: 'navire-2' }))).toBeUndefined();
  });
});

describe('#4227 — identité du navire de campagne en combat', () => {
  const scene = (): Scene => ({
    type: 'scene', id: 's', label: 'Bataille navale', dimensions: { w: 8, h: 8 }, reliefDefaults: structuredClone(DEFAULT_RELIEF_DEFAULTS), roofDefaults: structuredClone(DEFAULT_ROOF_DEFAULTS),
    layers: [{ z: 0, tiles: new Array(64).fill('eau') }],
    entities: [
      { id: 'coque-campagne', kind: 'personnage', vehicule: { id: 'cogue' }, pos: { x: 1, y: 1 } },
      { id: 'coque-ennemie', kind: 'personnage', vehicule: { id: 'cogue' }, pos: { x: 6, y: 6 } },
    ],
    dialogues: [], triggers: [], flags: {},
    encounters: [{ id: 'enc-naval', members: [
      { entityId: 'coque-ennemie', side: 'ennemi' },
      { entityId: 'coque-campagne', side: 'allie', navireDeCampagne: true },
    ] }],
  });

  function combat(s = scene(), navire: CampaignVessel | null = vessel({ label: 'Le Cormoran', wounds: { current: 12, max: 100 }, reparationTemporaire: true })) {
    const hero = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    banc.setState({ party: [hero], battle: null });
    banc.getState().lancerLaScene(s);
    banc.setState({ vessel: navire });
    banc.getState().lancerLeCombat('enc-naval');
    const combatants = banc.getState().battle!.combatants;
    const mine = combatants.find((c) => c.id === 'coque-campagne')!;
    const foe = combatants.find((c) => c.id === 'coque-ennemie')!;
    return { mine, foe };
  }

  it('seule la coque désignée reçoit le nom et les Blessures de campagne et les rend à la fin', () => {
    const { mine, foe } = combat();
    expect(mine).toMatchObject({ creatureId: 'cogue', label: 'Le Cormoran', wounds: { current: 12 } });
    expect(foe).toMatchObject({ creatureId: 'cogue', label: findVehicleById('cogue')!.label, wounds: { current: foe.wounds.max } });
    expect(seaMagicContext(banc.getState()).atSea).toBe(true);
    expect(reparationTemporaireTient(banc.getState, mine)).toBe(true);
    expect(reparationTemporaireTient(banc.getState, foe)).toBe(false);
    mine.wounds.current = 9;
    foe.wounds.current = 19;
    finalizeBattle(banc.getState, banc.setState);
    expect(banc.getState().vessel!.wounds!.current).toBe(9);
  });

  it('une désignation ambiguë entre deux alliés de même type ne transfère aucun état', () => {
    const s = scene();
    Object.assign(s.encounters[0].members![0], { side: 'allie', navireDeCampagne: true });
    const { mine, foe } = combat(s);
    expect([mine, foe].map((c) => c.label)).toEqual([findVehicleById('cogue')!.label, findVehicleById('cogue')!.label]);
    expect(seaMagicContext(banc.getState()).atSea).toBe(false);
    finalizeBattle(banc.getState, banc.setState);
    expect(banc.getState().vessel!.wounds!.current).toBe(12);
  });

  it('la coque de la rencontre ne peut écraser un nouveau navire du même type', () => {
    const { mine } = combat();
    mine.wounds.current = 9;
    banc.setState({ vessel: vessel({ uid: 'navire-2', wounds: { current: 23, max: 100 } }) });
    expect(seaMagicContext(banc.getState()).atSea).toBe(false);
    finalizeBattle(banc.getState, banc.setState);
    expect(banc.getState().vessel!.wounds!.current).toBe(23);
  });

  it('une rencontre désignée sans navire de campagne garde ses deux coques normales', () => {
    const { mine, foe } = combat(scene(), null);
    expect([mine, foe].map((c) => c.label)).toEqual([findVehicleById('cogue')!.label, findVehicleById('cogue')!.label]);
    finalizeBattle(banc.getState, banc.setState);
    expect(banc.getState().vessel).toBeNull();
  });
});
