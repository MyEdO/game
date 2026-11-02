import { describe, it, expect } from 'vitest';
import { shipUndercrew } from '../noyau/shipCrew';
import type { Combatant } from '../engine/types';
import type { Get } from '../noyau/flowTypes';
import { blessuresSurLeProfil, blessuresDeBase } from '../engine/combattantDeTest.testkit';

// Cogue : équipage NOMINAL 15 (vehicles.json). Un marin « présent » = crewId vivant (exposedCrew : !dead && PB>0).
const crewman = (id: string): Combatant =>
  ({ id, name: id, kind: 'enemy', pos: { x: 0, y: 0 }, wounds: { current: 5, max: 5 } }) as unknown as Combatant;
const crew = Array.from({ length: 15 }, (_, i) => crewman(`m${i}`));
const cogue = {
  id: 'ship', name: 'Cogue', kind: 'enemy', bodyShape: 'vehicule', creatureId: 'cogue',
  pos: { x: 5, y: 5 }, crewIds: crew.map((c) => c.id),
} as unknown as Combatant;
const combatants = [cogue, ...crew];
// `get` mock minimal : `shipUndercrew` ne lit que `get().vessel` (comme `shipMoraleScore`).
const getVessel = (crewLost?: number): Get =>
  (() => ({ vessel: crewLost == null ? undefined : { vehicleId: 'cogue', crewLost } })) as unknown as Get;

describe('shipUndercrew — Embrigadement (crewLost) consommé par le Manque de bras (#155, MDG 15 l.245)', () => {
  it('équipage complet, aucune perte de campagne → aucune pénalité', () => {
    expect(shipUndercrew(getVessel(0), cogue, combatants)).toEqual({ tranches: 0, dr: 0, capSuccesMinime: false });
    expect(shipUndercrew(getVessel(undefined), cogue, combatants)).toEqual({ tranches: 0, dr: 0, capSuccesMinime: false });
  });

  it('crewLost=5 (2d10 embrigadés) → présent 10/15 = 33 % manquant → 3 tranches (−6 DR, plafond Succès Minime)', () => {
    expect(shipUndercrew(getVessel(5), cogue, combatants)).toEqual({ tranches: 3, dr: -6, capSuccesMinime: true });
  });

  it('la perte de campagne S’AJOUTE aux morts de combat : 2 marins tués + crewLost=3 → présent 10/15', () => {
    const wounded = combatants.map((c) =>
      c.id === 'm0' || c.id === 'm1' ? (blessuresSurLeProfil({ ...c, wounds: blessuresDeBase(5, 0) }) as Combatant) : c);
    expect(shipUndercrew(getVessel(3), cogue, wounded)).toEqual({ tranches: 3, dr: -6, capSuccesMinime: true });
  });

  it('crewLost n’affecte QUE le vaisseau de campagne (creatureId === vehicleId) : un navire d’un AUTRE type est épargné', () => {
    const getOther = (() => ({ vessel: { vehicleId: 'fregate', crewLost: 9 } })) as unknown as Get;
    expect(shipUndercrew(getOther, cogue, combatants)).toEqual({ tranches: 0, dr: 0, capSuccesMinime: false });
  });
});
