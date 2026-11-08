import { idsDeTest } from './idsDeTest.testkit';
import { describe, it, expect } from 'vitest';
import {
  type CargoCarrier, type CargoLot,
  carrierUsedEnc, carrierFreeEnc, carrierCanLoad, loadCargo, unloadCargo,
  carriersColocated, transferCargo, splitCargo, removeCargo,
} from './cargo';

const lot = (uid: string, cargoId: string, enc: number, basePriceGold = 1): CargoLot => ({ uid, cargoId, enc, basePriceGold });

const mkCarrier = (over: Partial<CargoCarrier> = {}): CargoCarrier => ({
  id: 'c1', label: 'Mule', hull: 'jambes', capacity: 14, discreteEnc: 0, cargo: [], location: { kind: 'au-lieu', placeId: 'grunburg' }, ...over,
});

describe('CargoCarrier — arithmétique d’Enc (#327 lot B)', () => {
  it('Enc occupé = objets discrets + cargaison en vrac (décision 2)', () => {
    const c = mkCarrier({ discreteEnc: 3, cargo: [lot('a', 'vin', 4), lot('b', 'sel', 2)] });
    expect(carrierUsedEnc(c)).toBe(9);
    expect(carrierFreeEnc(c)).toBe(14 - 9);
  });

  it('capacité Infinity (convoi non plafonné) → reste Infinity, charge toujours acceptée', () => {
    const c = mkCarrier({ capacity: Infinity, cargo: [lot('a', 'vin', 100)] });
    expect(carrierFreeEnc(c)).toBe(Infinity);
    expect(carrierCanLoad(c, 999)).toBe(true);
  });

  it('plafond DUR v1 (A5.6) : REFUSE de charger au-delà de la capacité', () => {
    const c = mkCarrier({ capacity: 14, cargo: [lot('a', 'vin', 10)] }); // reste 4
    expect(carrierCanLoad(c, 4)).toBe(true);
    expect(carrierCanLoad(c, 5)).toBe(false);
  });

  it('loadCargo tronque à la place restante (jamais au-delà du plafond)', () => {
    const c = mkCarrier({ capacity: 14, cargo: [lot('a', 'vin', 10)] }); // reste 4
    const { carrier, loaded } = loadCargo(c, lot('b', 'sel', 9, 2));
    expect(loaded).toBe(4);
    expect(carrierUsedEnc(carrier)).toBe(14);
    expect(carrier.cargo).toHaveLength(2);
    expect(carrier.cargo[1]).toEqual(lot('b', 'sel', 4, 2));
  });

  it('loadCargo sur un porteur plein → 0, porteur inchangé', () => {
    const c = mkCarrier({ capacity: 14, cargo: [lot('a', 'vin', 14)] });
    const { carrier, loaded } = loadCargo(c, lot('b', 'sel', 5));
    expect(loaded).toBe(0);
    expect(carrier).toBe(c);
  });

  it('unloadCargo retire au fil des lots (décharge partielle/totale)', () => {
    const c = mkCarrier({ cargo: [lot('a', 'vin', 4), lot('b', 'vin', 3), lot('c', 'sel', 2)] });
    const { carrier, removed } = unloadCargo(c, 'vin', 5);
    expect(removed).toBe(5);
    expect(carrier.cargo).toEqual([lot('b', 'vin', 2), lot('c', 'sel', 2)]);
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
  it('déplace le lot désigné, plafonné par la place libre de la cible, prix préservé', () => {
    const from = mkCarrier({ id: 'mule', capacity: 14, cargo: [lot('a', 'vin', 8, 5), lot('b', 'vin', 4, 7)] });
    const to = mkCarrier({ id: 'cart', capacity: 30, cargo: [lot('c', 'sel', 24)] }); // reste 6
    const r = transferCargo(from, to, 'b', 100, idsDeTest);
    expect(r.moved).toBe(4);
    expect(r.from.cargo).toEqual([lot('a', 'vin', 8, 5)]);
    expect(r.to.cargo).toEqual([lot('c', 'sel', 24), lot('b', 'vin', 4, 7)]);
  });

  it('une part séparée naît avec son propre uid ; le reste garde celui du lot', () => {
    const from = mkCarrier({ id: 'mule', capacity: 14, cargo: [lot('a', 'vin', 8, 5), lot('b', 'vin', 4, 7)] });
    const to = mkCarrier({ id: 'cart', capacity: 30, cargo: [lot('c', 'sel', 24)] }); // reste 6
    const r = transferCargo(from, to, 'a', 100, idsDeTest);
    expect(r.moved).toBe(6); // plafonné par la place libre de la cible
    expect(r.from.cargo).toEqual([lot('a', 'vin', 2, 5), lot('b', 'vin', 4, 7)]);
    const [, part] = r.to.cargo;
    expect(part).toMatchObject({ cargoId: 'vin', enc: 6, basePriceGold: 5 });
    expect(new Set([...r.from.cargo, ...r.to.cargo].map((l) => l.uid)).size, 'deux lots partagent un uid').toBe(4);
  });

  it('refuse (moved 0) si les porteurs ne sont pas co-localisés', () => {
    const from = mkCarrier({ id: 'mule', cargo: [lot('a', 'vin', 8)] });
    const to = mkCarrier({ id: 'cart', location: { kind: 'au-lieu', placeId: 'kemperbad' }, capacity: 30 });
    const r = transferCargo(from, to, 'a', 8, idsDeTest);
    expect(r.moved).toBe(0);
    expect(r.from).toBe(from);
    expect(r.to).toBe(to);
  });

  it('transfert d’un lot absent de la source → moved 0', () => {
    const from = mkCarrier({ id: 'mule', cargo: [lot('a', 'vin', 8)] });
    const to = mkCarrier({ id: 'cart', capacity: 30 });
    expect(transferCargo(from, to, 'b', 8, idsDeTest).moved).toBe(0);
  });
});

describe('splitCargo — brique commune (retrait/transfert)', () => {
  it('sépare en remaining/taken en conservant les prix par lot', () => {
    const { remaining, taken } = splitCargo([lot('a', 'vin', 5, 3), lot('b', 'vin', 5, 9), lot('c', 'sel', 2)], 'vin', 7);
    expect(taken).toEqual([lot('a', 'vin', 5, 3), lot('b', 'vin', 2, 9)]);
    expect(remaining).toEqual([lot('b', 'vin', 3, 9), lot('c', 'sel', 2)]);
  });

  it('removeCargo reste cohérent (délègue à splitCargo)', () => {
    const { lots, removed } = removeCargo([lot('a', 'vin', 5), lot('b', 'sel', 2)], 'vin', 3);
    expect(removed).toBe(3);
    expect(lots).toEqual([lot('a', 'vin', 2), lot('b', 'sel', 2)]);
  });
});
