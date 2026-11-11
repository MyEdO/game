import { describe, it, expect } from 'vitest';
import { cargoOverload, overloadMaxEnc, overloadHardCapPct } from './seaVoyage';

/**
 * SURCHARGE de la cale (MDG 12 l.70-75, Contenance) : paliers d'assiette au-delà de la Contenance —
 * >100 % : −1 M / −1 DR Manœuvre ; >120 % : −2 ; >140 % : −3 ; >150 % : « Impossible de prendre la mer ».
 */
describe('cargoOverload — paliers d’assiette (MDG 12 l.70-75)', () => {
  const CAP = 300;

  it('charge ≤ Contenance : aucun palier, aucun effet, navigable', () => {
    for (const enc of [0, 150, 300]) {
      const o = cargoOverload(enc, CAP);
      expect(o.palierId).toBeNull();
      expect(o.mMod).toBe(0);
      expect(o.drDeManoeuvre).toBe(0);
      expect(o.canSail).toBe(true);
    }
  });

  it('> 100 % (seuil strict) → palier 1 : −1 M, −1 DR Manœuvre', () => {
    expect(cargoOverload(300, CAP).palierId).toBeNull(); // exactement 100 % : PAS surchargé
    const o = cargoOverload(301, CAP);
    expect(o.palierId).toBe('surcharge-1');
    expect(o.mMod).toBe(-1);
    expect(o.drDeManoeuvre).toBe(-1);
    expect(o.canSail).toBe(true);
  });

  it('> 120 % → palier 2 (−2) ; exactement 120 % reste palier 1', () => {
    expect(cargoOverload(360, CAP).palierId).toBe('surcharge-1'); // 120 % pile
    const o = cargoOverload(361, CAP);
    expect(o.palierId).toBe('surcharge-2');
    expect(o.mMod).toBe(-2);
    expect(o.drDeManoeuvre).toBe(-2);
  });

  it('> 140 % → palier 3 (−3)', () => {
    const o = cargoOverload(421, CAP); // 140,3 %
    expect(o.palierId).toBe('surcharge-3');
    expect(o.mMod).toBe(-3);
    expect(o.drDeManoeuvre).toBe(-3);
    expect(o.canSail).toBe(true);
  });

  it('> 150 % → « Impossible de prendre la mer » (canSail false), effets plafonnés à −3', () => {
    expect(cargoOverload(450, CAP).canSail).toBe(true); // 150 % pile : encore navigable
    const o = cargoOverload(451, CAP);
    expect(o.canSail).toBe(false);
    expect(o.mMod).toBe(-3); // reste au palier 3
    expect(o.ratioPct).toBe(150);
  });

  it('overloadMaxEnc = Contenance × plafond dur (150 %)', () => {
    expect(overloadHardCapPct()).toBe(150);
    expect(overloadMaxEnc(CAP)).toBe(450);
    expect(overloadMaxEnc(0)).toBe(0);
  });

  it('Contenance nulle → aucun effet (pas de division par zéro)', () => {
    expect(cargoOverload(100, 0)).toMatchObject({ palierId: null, mMod: 0, canSail: true });
  });
});
