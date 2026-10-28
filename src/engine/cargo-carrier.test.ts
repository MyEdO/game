import { describe, it, expect } from 'vitest';
import {
  type CargoCarrier, type CargoLot,
  carrierUsedEnc, carrierFreeEnc, carrierCanLoad, loadCargo, unloadCargo,
  carriersColocated, transferCargo, splitCargo, removeCargo,
} from './cargo';

const lot = (cargoId: string, enc: number, basePriceGold = 1): CargoLot => ({ cargoId, enc, basePriceGold });

const mkCarrier = (over: Partial<CargoCarrier> = {}): CargoCarrier => ({
  id: 'c1', label: 'Mule', hull: 'jambes', capacity: 14, discreteEnc: 0, cargo: [], location: { kind: 'au-lieu', placeId: 'grunburg' }, ...over,
});

describe('CargoCarrier — arithmétique d’Enc (#327 lot B)', () => {
  it('Enc occupé = objets discrets + cargaison en vrac (décision 2)', () => {
    const c = mkCarrier({ discreteEnc: 3, cargo: [lot('vin', 4), lot('sel', 2)] });
    expect(carrierUsedEnc(c)).toBe(9);
    expect(carrierFreeEnc(c)).toBe(14 - 9);
  });

  it('capacité Infinity (convoi non plafonné) → reste Infinity, charge toujours acceptée', () => {
    const c = mkCarrier({ capacity: Infinity, cargo: [lot('vin', 100)] });
    expect(carrierFreeEnc(c)).toBe(Infinity);
    expect(carrierCanLoad(c, 999)).toBe(true);
  });

  it('plafond DUR v1 (A5.6) : REFUSE de charger au-delà de la capacité', () => {
    const c = mkCarrier({ capacity: 14, cargo: [lot('vin', 10)] }); // reste 4
    expect(carrierCanLoad(c, 4)).toBe(true);
    expect(carrierCanLoad(c, 5)).toBe(false);
  });

  it('loadCargo tronque à la place restante (jamais au-delà du plafond)', () => {
    const c = mkCarrier({ capacity: 14, cargo: [lot('vin', 10)] }); // reste 4
    const { carrier, loaded } = loadCargo(c, lot('sel', 9, 2));
    expect(loaded).toBe(4);
    expect(carrierUsedEnc(carrier)).toBe(14);
    expect(carrier.cargo).toHaveLength(2);
    expect(carrier.cargo[1]).toEqual({ cargoId: 'sel', enc: 4, basePriceGold: 2 });
  });

  it('loadCargo sur un porteur plein → 0, porteur inchangé', () => {
    const c = mkCarrier({ capacity: 14, cargo: [lot('vin', 14)] });
    const { carrier, loaded } = loadCargo(c, lot('sel', 5));
    expect(loaded).toBe(0);
    expect(carrier).toBe(c);
  });

  it('unloadCargo retire au fil des lots (décharge partielle/totale)', () => {
    const c = mkCarrier({ cargo: [lot('vin', 4), lot('vin', 3), lot('sel', 2)] });
    const { carrier, removed } = unloadCargo(c, 'vin', 5);
    expect(removed).toBe(5);
    expect(carrier.cargo).toEqual([lot('vin', 2), lot('sel', 2)]);
  });
});

describe('CargoCarrier — co-localisation (décision 5)', () => {
  it('même Lieu → co-localisés ; Lieux différents → non', () => {
    const a = mkCarrier({ id: 'a' });
    const b = mkCarrier({ id: 'b' });
    const c = mkCarrier({ id: 'c', location: { kind: 'au-lieu', placeId: 'kemperbad' } });
    expect(carriersColocated(a, b)).toBe(true);
    expect(carriersColocated(a, c)).toBe(false);
  });

  it('embarqué sur l’hôte, ou sur le même hôte → co-localisés', () => {
    const barge = mkCarrier({ id: 'barge', hull: 'coque', location: { kind: 'avec-le-groupe' } });
    const mule = mkCarrier({ id: 'mule', location: { kind: 'embarquee', hostUid: 'barge' } });
    const cart = mkCarrier({ id: 'cart', location: { kind: 'embarquee', hostUid: 'barge' } });
    expect(carriersColocated(mule, barge)).toBe(true);
    expect(carriersColocated(mule, cart)).toBe(true);
  });

  it('avec le groupe ensemble → co-localisés ; avec le groupe vs embarqué sur un TIERS → non', () => {
    const heros = mkCarrier({ id: 'h1', location: { kind: 'avec-le-groupe' } });
    const charrette = mkCarrier({ id: 'charrette', location: { kind: 'avec-le-groupe' } });
    const mule = mkCarrier({ id: 'mule', location: { kind: 'embarquee', hostUid: 'pos-navire' } });
    expect(carriersColocated(heros, charrette)).toBe(true);
    expect(carriersColocated(heros, mule)).toBe(false);
  });

  it('un porteur n’est pas co-localisé avec lui-même', () => {
    const a = mkCarrier({ id: 'a' });
    expect(carriersColocated(a, a)).toBe(false);
  });
});

describe('CargoCarrier — transfert co-localisé (décision 8)', () => {
  it('déplace la cargaison, plafonné par la place libre de la cible, prix préservés', () => {
    const from = mkCarrier({ id: 'mule', capacity: 14, cargo: [lot('vin', 8, 5), lot('vin', 4, 7)] });
    const to = mkCarrier({ id: 'cart', capacity: 30, cargo: [lot('sel', 24)] }); // reste 6
    const r = transferCargo(from, to, 'vin', 100);
    expect(r.moved).toBe(6); // plafonné par la place libre de la cible
    expect(carrierUsedEnc(r.from)).toBe(12 - 6);
    expect(carrierUsedEnc(r.to)).toBe(30);
    // prix préservés : 6 pris = 8@5 d’abord tronqué à 6
    expect(r.to.cargo).toEqual([lot('sel', 24), { cargoId: 'vin', enc: 6, basePriceGold: 5 }]);
  });

  it('refuse (moved 0) si les porteurs ne sont pas co-localisés', () => {
    const from = mkCarrier({ id: 'mule', cargo: [lot('vin', 8)] });
    const to = mkCarrier({ id: 'cart', location: { kind: 'au-lieu', placeId: 'kemperbad' }, capacity: 30 });
    const r = transferCargo(from, to, 'vin', 8);
    expect(r.moved).toBe(0);
    expect(r.from).toBe(from);
    expect(r.to).toBe(to);
  });

  it('transfert d’un id absent de la source → moved 0', () => {
    const from = mkCarrier({ id: 'mule', cargo: [lot('vin', 8)] });
    const to = mkCarrier({ id: 'cart', capacity: 30 });
    expect(transferCargo(from, to, 'sel', 8).moved).toBe(0);
  });
});

describe('splitCargo — brique commune (retrait/transfert)', () => {
  it('sépare en remaining/taken en conservant les prix par lot', () => {
    const { remaining, taken } = splitCargo([lot('vin', 5, 3), lot('vin', 5, 9), lot('sel', 2)], 'vin', 7);
    expect(taken).toEqual([lot('vin', 5, 3), lot('vin', 2, 9)]);
    expect(remaining).toEqual([lot('vin', 3, 9), lot('sel', 2)]);
  });

  it('removeCargo reste cohérent (délègue à splitCargo)', () => {
    const { lots, removed } = removeCargo([lot('vin', 5), lot('sel', 2)], 'vin', 3);
    expect(removed).toBe(3);
    expect(lots).toEqual([lot('vin', 2), lot('sel', 2)]);
  });
});
