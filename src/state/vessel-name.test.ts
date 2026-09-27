import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { buildSeaPlan } from './seaVoyageFlow';
import { createHero } from '../engine/character';
import { seedBattleRng } from './battleRng';
import { findVehicleById } from '../data';
import { DEFAULT_RELIEF_DEFAULTS, DEFAULT_ROOF_DEFAULTS, type Scene } from './scene';
import type { CampaignVessel } from './store';

// #230 — le nom d'INSTANCE du navire de campagne (affichage) se propage aux coques spawnées.

const vessel = (over: Partial<CampaignVessel> = {}): CampaignVessel => ({
  vehicleId: 'cogue', morale: { score: 75, lastMoraleWeek: 0, factors: [] }, ...over,
});

describe('#230 — voyageShip (coque de trajet maritime) porte le nom d’instance', () => {
  beforeEach(() => { seedBattleRng(1); useGame.setState({ gameTime: 0 }); });

  it('la coque de trajet reprend le nom d’instance quand il est posé', () => {
    useGame.setState({ vessel: vessel({ label: 'Le Cormoran' }) });
    const plan = buildSeaPlan(useGame.getState, 'r', 'a', 'b', { km: 100, seaHeading: 'est' });
    expect(plan?.vehicle?.label).toBe('Le Cormoran');
    expect(plan?.vehicle?.creatureId).toBe('cogue'); // le rendu reste keyé par creatureId
  });

  it('sans nom d’instance : la coque garde le label du TYPE', () => {
    useGame.setState({ vessel: vessel() });
    const plan = buildSeaPlan(useGame.getState, 'r', 'a', 'b', { km: 100, seaHeading: 'est' });
    expect(plan?.vehicle?.label).toBe(findVehicleById('cogue')!.label);
  });
});

describe('#230 — réconciliation combat : le nom d’instance ne touche QUE la coque de campagne', () => {
  beforeEach(() => { vi.useFakeTimers(); seedBattleRng(1); });
  afterEach(() => { vi.useRealTimers(); });

  const scene = (): Scene => ({
    type: 'scene', id: 's', label: 'Bataille navale', dimensions: { w: 8, h: 8 }, reliefDefaults: { ...DEFAULT_RELIEF_DEFAULTS }, roofDefaults: { ...DEFAULT_ROOF_DEFAULTS },
    layers: [{ z: 0, tiles: new Array(64).fill('eau') }],
    entities: [
      { id: 'coque-campagne', kind: 'personnage', ref: 'cogue', pos: { x: 1, y: 1 } },
      { id: 'coque-ennemie', kind: 'personnage', ref: 'langskip', pos: { x: 6, y: 6 } },
    ],
    dialogues: [], triggers: [], flags: {},
    encounters: [{ id: 'enc-naval', members: [
      { entityId: 'coque-campagne', side: 'ally' },
      { entityId: 'coque-ennemie', side: 'enemy' },
    ] }],
  });

  it('la coque « creatureId === vessel.vehicleId » prend le nom d’instance ; l’ennemie d’un autre vehicleId garde son label de type', () => {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    useGame.setState({ party: [hero], battle: null });
    useGame.getState().startScene(scene()); // remet le store à neuf → poser le vessel APRÈS
    useGame.setState({ vessel: vessel({ label: 'Le Cormoran' }) });
    useGame.getState().startCombat('enc-naval');

    const combatants = useGame.getState().battle!.combatants;
    const mine = combatants.find((c) => c.id === 'coque-campagne')!;
    const foe = combatants.find((c) => c.id === 'coque-ennemie')!;
    expect(mine.creatureId).toBe('cogue');
    expect(mine.label).toBe('Le Cormoran'); // coque de campagne renommée
    expect(foe.creatureId).toBe('langskip');
    expect(foe.label).toBe(findVehicleById('langskip')!.label); // autre vehicleId → inchangé
  });
});
