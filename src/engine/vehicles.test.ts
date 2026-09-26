import { describe, it, expect } from 'vitest';
import { vehicles, trappings } from '../data';
import { VEHICLES_LIST, travelVehicles, travelModeLabels, vehicleTravel, travelModeIcon } from './travel';

/**
 * Fondation données « véhicule à coque » (`vehicles.json`) — FOYER UNIQUE des transports payants.
 * On garantit l'intégrité du catalogue et l'accès data-driven (aucun `id` de véhicule codé en dur côté moteur).
 */
describe('catalogue véhicules (data-driven)', () => {
  it('expose les mêmes données via data/index et engine/travel', () => {
    expect(VEHICLES_LIST).toBe(vehicles);
    expect(VEHICLES_LIST.length).toBeGreaterThanOrEqual(2);
  });

  it('ids uniques (pas de doublon de véhicule)', () => {
    const ids = VEHICLES_LIST.map((v) => v.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('toute facette travel a un Déplacement > 0 et au moins une classe', () => {
    for (const v of travelVehicles()) {
      expect(v.travel!.movement).toBeGreaterThan(0);
      expect(v.travel!.classes.length).toBeGreaterThan(0);
      for (const c of v.travel!.classes) expect(c.brassPerKm).toBeGreaterThanOrEqual(0);
    }
  });

  it('diligence M6 (2/1 sous) et barge M8 (5/2 sous) — RAW LDB 51 l.180-189', () => {
    const dil = vehicleTravel('diligence')!;
    expect(dil.movement).toBe(6);
    expect(dil.classes.map((c) => c.brassPerKm)).toEqual([2, 1]);
    const barge = vehicleTravel('barge')!;
    expect(barge.movement).toBe(8);
    expect(barge.classes.map((c) => c.brassPerKm)).toEqual([5, 2]);
  });

  it('vehicleTravel("pied") = undefined (le pied n’est pas un passage payant)', () => {
    expect(vehicleTravel('pied')).toBeUndefined();
  });

  it('libellés et pictogrammes de mode viennent de la donnée', () => {
    expect(travelModeLabels().pied).toBe('À pied');
    expect(travelModeLabels().diligence).toBe('Diligence');
    expect(travelModeIcon('pied')).toBe('travel/foot');
    expect(travelModeIcon('diligence')).toBe('travel/coach');
    expect(travelModeIcon('barge')).toBe('travel/barge');
  });
});

describe('dédup trappings ⊥ vehicles (foyer unique)', () => {
  it('aucun id de véhicule ne subsiste en double dans trappings.json', () => {
    const trapIds = new Set(trappings.map((t) => t.id));
    const collisions = VEHICLES_LIST.filter((v) => trapIds.has(v.id)).map((v) => v.id);
    expect(collisions).toEqual([]);
  });

  it('les 6 véhicules migrés (achat) portent prix + dispo verbatim LDB 70 l.7-27', () => {
    const dil = vehicles.find((v) => v.id === 'diligence')!;
    expect(dil.purchase).toEqual({ price: { gold: 150, silver: 0, brass: 0 }, availability: 'Rare' });
    const coracle = vehicles.find((v) => v.id === 'coracle')!;
    expect(coracle.enc).toBe(6);
    expect(coracle.purchase!.price.gold).toBe(2);
  });

  it('hull (E/Blessures) posé pour les 9 véhicules terrestres EDOC 07 (table Coût/Enc/Chargement/Dispo/Mode/E/B)', () => {
    expect(vehicles.find((v) => v.id === 'diligence')!.hull!.char).toEqual({ endurance: 45, B: 50 });
    expect(vehicles.find((v) => v.id === 'charrette')!.hull!.char).toEqual({ endurance: 25, B: 10 });
    expect(vehicles.find((v) => v.id === 'chariot-leger')!.hull!.char).toEqual({ endurance: 50, B: 35 });
    expect(vehicles.find((v) => v.id === 'chariot-moyen')!.hull!.char).toEqual({ endurance: 50, B: 60 });
    expect(vehicles.find((v) => v.id === 'chariot-lourd')!.hull!.char).toEqual({ endurance: 50, B: 95 });
    expect(vehicles.find((v) => v.id === 'chaise')!.hull!.char).toEqual({ endurance: 20, B: 8 });
    expect(vehicles.find((v) => v.id === 'charrette-a-bras')!.hull!.char).toEqual({ endurance: 20, B: 8 });
    expect(vehicles.find((v) => v.id === 'petite-litiere')!.hull!.char).toEqual({ endurance: 30, B: 20 });
    expect(vehicles.find((v) => v.id === 'grande-litiere')!.hull!.char).toEqual({ endurance: 35, B: 35 });
  });
});
