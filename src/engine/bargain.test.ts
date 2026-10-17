import { describe, it, expect } from 'vitest';
import { bargainBuyFactor, bargainPct, bargainSellBonusPct, bargainSellFactor } from './bargain';

describe('bargain — Marchandage RAW (LDB 59 l.43 / l.54)', () => {
  it('achat, LDB 59 l.43 : perdu → plein ; gagné → −10 %', () => {
    expect(bargainPct(false, 0, false)).toBe(0);
    expect(bargainBuyFactor(false, 0, false)).toBe(1);
    expect(bargainPct(true, 0, false)).toBe(10);
    expect(bargainBuyFactor(true, 5, false)).toBe(0.9);
  });
  it('achat, LDB 59 l.43 : Succès Stupéfiant (+6) seul → −20 %', () => {
    expect(bargainPct(true, 6, false)).toBe(20);
    expect(bargainBuyFactor(true, 6, false)).toBe(0.8);
  });
  it('achat, LDB 10 l.818 (arbitrage #2547, 2026-10-09) : Négociateur seul → −20 %', () => {
    expect(bargainPct(true, 1, true)).toBe(20);
    expect(bargainBuyFactor(true, 1, true)).toBe(0.8);
  });
  it('achat, arbitrage #2547 (2026-10-09) : Succès Stupéfiant ET Négociateur se cumulent → −30 %', () => {
    expect(bargainPct(true, 6, true)).toBe(30);
    expect(bargainBuyFactor(true, 9, true)).toBe(0.7);
  });
  it('achat : Négociateur sans victoire → aucune remise', () => {
    expect(bargainPct(false, 6, true)).toBe(0);
    expect(bargainBuyFactor(false, 6, true)).toBe(1);
  });
  it('vente, LDB 59 l.54 : sur la base ½, gagné seul → 1 (½ du listé) ; perdu → 0,5 (¼)', () => {
    expect(bargainSellFactor(true, 0, false)).toBe(1);
    expect(bargainSellBonusPct(true, 5, false)).toBe(0);
    expect(bargainSellFactor(false, 0, false)).toBe(0.5);
  });
  it('vente, arbitrage #2547 (2026-10-09) « dans l’autre sens » : Stupéfiant +10 %, Négociateur +10 %, cumulés', () => {
    expect(bargainSellFactor(true, 6, false)).toBe(1.1);
    expect(bargainSellFactor(true, 1, true)).toBe(1.1);
    expect(bargainSellFactor(true, 6, true)).toBe(1.2);
    expect(bargainSellBonusPct(true, 9, true)).toBe(20);
  });
  it('vente perdue : Négociateur sans effet → 0,5 (¼)', () => {
    expect(bargainSellFactor(false, 1, true)).toBe(0.5);
    expect(bargainSellBonusPct(false, 6, true)).toBe(0);
  });
});
