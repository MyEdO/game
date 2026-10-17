import { describe, it, expect } from 'vitest';
import { bargainBuyFactor, bargainBuyDiscountPct, bargainSellFactor } from './bargain';

describe('bargain — Marchandage RAW (LDB 59 l.43 / l.54)', () => {
  it('achat, LDB 59 l.43 : perdu → plein ; gagné → −10 %', () => {
    expect(bargainBuyDiscountPct(false, 0, false)).toBe(0);
    expect(bargainBuyFactor(false, 0, false)).toBe(1);
    expect(bargainBuyDiscountPct(true, 0, false)).toBe(10);
    expect(bargainBuyFactor(true, 5, false)).toBe(0.9);
  });
  it('achat, LDB 59 l.43 : « jusqu’à 20 % » avec un Succès Stupéfiant (+6) ou le Talent Négociateur', () => {
    expect(bargainBuyDiscountPct(true, 6, false)).toBe(20);
    expect(bargainBuyFactor(true, 6, false)).toBe(0.8);
    expect(bargainBuyDiscountPct(true, 1, true)).toBe(20);
    expect(bargainBuyFactor(true, 1, true)).toBe(0.8);
  });
  it('achat, LDB 59 l.43 : Succès Stupéfiant ET Négociateur ne dépassent pas 20 %', () => {
    expect(bargainBuyDiscountPct(true, 6, true)).toBe(20);
    expect(bargainBuyFactor(true, 9, true)).toBe(0.8);
  });
  it('achat : Négociateur sans victoire → aucune remise', () => {
    expect(bargainBuyDiscountPct(false, 6, true)).toBe(0);
    expect(bargainBuyFactor(false, 6, true)).toBe(1);
  });
  it('vente (sur la base ½) : gagné → 1 (½), perdu → 0.5 (¼)', () => {
    expect(bargainSellFactor(true, 0, false)).toBe(1);
    expect(bargainSellFactor(false, 0, false)).toBe(0.5);
  });
});
