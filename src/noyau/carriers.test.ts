import { describe, it, expect } from 'vitest';
import type { Characteristics, Combatant, ItemInstance } from '../engine/types';
import type { CargoLot } from '../engine/cargo';
import { carrierUsedEnc } from '../engine/cargo';
import type { Possession } from '../engine/possession';
import { partyCarriers, carrierById, primaryCargoCarrier, bulkCargoRefs, partyCargoTotalEnc, persistCarriersCargo, CAMPAIGN_VESSEL_CARRIER_ID, type CarrierStateSlice } from './carriers';

const chars = (F = 30, E = 30): Characteristics => ({
  'capacite-de-combat': 30, 'capacite-de-tir': 30, force: F, endurance: E, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30,
});

function hero(id: string, items: ItemInstance[] = [], F = 30, E = 30): Combatant {
  return {
    id, label: id, kind: 'hero', characteristics: chars(F, E),
    wounds: { current: 10, max: 10 }, advantage: 0, conditions: [],
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    items, skills: [], talents: [], movement: 4,
  };
}

const item = (uid: string, over: Partial<ItemInstance> = {}): ItemInstance => ({ uid, label: uid, kind: 'misc', qualities: [], enc: 0, equipped: false, ...over });
const lot = (cargoId: string, enc: number): CargoLot => ({ cargoId, enc, basePriceGold: 1 });

/** Possession bête (SOCLE POSSESSIONS #617/#618) — `mule` = `poney-ane-ou-mule` → encPortee 14. */
const beastPossession = (uid: string, ownerId: string, creatureId: string, cargo: CargoLot[] = []): Possession =>
  ({ uid, ownerId, nature: 'bete', ref: { creatureId }, location: { kind: 'avec-le-groupe' }, items: [], cargo });

/** Possession véhicule terrestre — `charrette` → chargement 25. */
const vehiclePossession = (uid: string, ownerId: string, vehicleId: string, cargo: CargoLot[] = []): Possession =>
  ({ uid, ownerId, nature: 'vehicule', vehicleId, location: { kind: 'avec-le-groupe' }, items: [], cargo });

const slice = (over: Partial<CarrierStateSlice> = {}): CarrierStateSlice => ({
  party: [], vessel: null, worldMap: null, scene: null, possessions: [], ...over,
} as CarrierStateSlice);

describe('partyCarriers — couture d’état des porteurs (#327 lot B)', () => {
  it('un héros est un porteur à jambes : capacité = BF+BE, occupé = totalEncumbrance', () => {
    // F=40,E=40 → BF+BE = 4+4 = 8 ; deux objets non rangés à 2 Enc → occupé 4.
    const h = hero('nel', [item('a', { enc: 2 }), item('b', { enc: 2 })], 40, 40);
    const carriers = partyCarriers(slice({ party: [h] }));
    const hc = carriers.find((c) => c.id === 'nel')!;
    expect(hc).toMatchObject({ hull: 'jambes', capacity: 8 });
    expect(carrierUsedEnc(hc)).toBe(4);
    expect(hc.cargo).toEqual([]); // le héros porte des objets DISCRETS, pas du vrac
  });

  it('une bête de bât (Possession) expose encPortee comme capacité et lit sa cargaison propre', () => {
    const h = hero('nel');
    const mule = beastPossession('m1', 'nel', 'mule', [lot('vin', 6)]); // poney-ane-ou-mule → encPortee 14
    const carriers = partyCarriers(slice({ party: [h], possessions: [mule] }));
    const mc = carriers.find((c) => c.id === 'm1')!;
    expect(mc).toMatchObject({ hull: 'jambes', capacity: 14 });
    expect(mc.cargo).toBe(mule.cargo); // SOURCE UNIQUE : le carrier lit le stock réel de la Possession
    expect(carrierUsedEnc(mc)).toBe(6);
  });

  it('un véhicule terrestre possédé expose chargement comme capacité', () => {
    const h = hero('nel');
    const cart = vehiclePossession('v1', 'nel', 'charrette'); // vehicles.json chargement 25
    const mc = partyCarriers(slice({ party: [h], possessions: [cart] })).find((c) => c.id === 'v1')!;
    expect(mc).toMatchObject({ hull: 'jambes', capacity: 25 });
  });

  it('le navire de campagne : Contenance navale + cale = vessel.cargo (source unique, verrou 1)', () => {
    const cargo = [lot('vin', 50)];
    const vessel = { vehicleId: 'barge', label: 'Le Cormoran', cargo } as CarrierStateSlice['vessel'];
    const vc = carrierById(slice({ vessel }), CAMPAIGN_VESSEL_CARRIER_ID)!;
    expect(vc).toMatchObject({ hull: 'coque', capacity: 300, label: 'Le Cormoran' }); // barge ship.capacity 300
    expect(vc.cargo).toBe(cargo); // pas de double stock
  });

  it('les héros morts / hors rencontre ne sont pas des porteurs', () => {
    const dead = { ...hero('mort'), dead: true };
    expect(partyCarriers(slice({ party: [dead] })).some((c) => c.id === 'mort')).toBe(false);
  });
});

describe('primaryCargoCarrier / bulkCargoRefs / persist (#327 lot C)', () => {
  it('porteur de défaut : le VÉHICULE prime la bête ; le navire prime tout', () => {
    const h = hero('nel');
    const cart = vehiclePossession('v1', 'nel', 'charrette'); // chargement 25
    const mule = beastPossession('m1', 'nel', 'mule'); // encPortee 14
    expect(primaryCargoCarrier(slice({ party: [h], possessions: [mule, cart] }))!.id).toBe('v1'); // véhicule > bête
    const vessel = { vehicleId: 'barge', cargo: [] } as unknown as CarrierStateSlice['vessel'];
    expect(primaryCargoCarrier(slice({ party: [h], possessions: [mule, cart], vessel }))!.id).toBe(CAMPAIGN_VESSEL_CARRIER_ID); // navire > tout
  });

  it('sans bête/véhicule/navire, aucun porteur de défaut (Contenance = plafond réel)', () => {
    expect(primaryCargoCarrier(slice({ party: [hero('nu')] }))).toBeUndefined();
  });

  it('bulkCargoRefs liste les lots de tous les porteurs de vrac (hors héros) ; partyCargoTotalEnc les somme', () => {
    const h = hero('nel');
    const mule = beastPossession('m1', 'nel', 'mule', [lot('vin', 6)]);
    const cart = vehiclePossession('v1', 'nel', 'charrette', [lot('sel', 10)]);
    const s = slice({ party: [h], possessions: [mule, cart] });
    const refs = bulkCargoRefs(s);
    expect(refs.map((r) => r.carrierId).sort()).toEqual(['m1', 'v1']);
    expect(partyCargoTotalEnc(s)).toBe(16);
  });

  it('persistCarriersCargo réécrit le cargo sur la source unique (Possession.cargo)', () => {
    const h = hero('nel');
    const mule = beastPossession('m1', 'nel', 'mule', [lot('vin', 6)]);
    const patch = persistCarriersCargo(slice({ party: [h], possessions: [mule] }), [{ carrierId: 'm1', cargo: [lot('vin', 2)] }]);
    expect(patch.possessions![0].cargo).toEqual([lot('vin', 2)]);
  });
});
