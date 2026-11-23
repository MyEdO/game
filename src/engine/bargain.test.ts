import { describe, it, expect } from 'vitest';
import {
  bargainBuyFactor, bargainPct, bargainSellFactor, FACTEUR_DE_VENTE_SANS_MARCHANDAGE, hausseDeVente, variationDuMarchandage, variationDuNegoce,
} from './bargain';

const issue = (won: boolean, drNet: number, negotiator: boolean) => ({ won, drNet, negotiator });

describe('bargain — Marchandage RAW (LDB 59 l.43 / l.54)', () => {
  it('achat, LDB 59 l.43 : perdu → plein ; gagné → −10 %', () => {
    expect(bargainPct(false, 0, false)).toBe(0);
    expect(bargainBuyFactor(issue(false, 0, false))).toBe(1);
    expect(bargainPct(true, 0, false)).toBe(10);
    expect(variationDuMarchandage(issue(true, 5, false), 'achat')).toBe(-10);
    expect(bargainBuyFactor(issue(true, 5, false))).toBe(0.9);
  });
  it('achat, LDB 59 l.43 : Succès Stupéfiant (+6) seul → −20 %', () => {
    expect(bargainPct(true, 6, false)).toBe(20);
    expect(bargainBuyFactor(issue(true, 6, false))).toBe(0.8);
  });
  it('achat, LDB 10 l.818 (arbitrage #2547, 2026-10-09) : Négociateur seul → −20 %', () => {
    expect(bargainPct(true, 1, true)).toBe(20);
    expect(bargainBuyFactor(issue(true, 1, true))).toBe(0.8);
  });
  it('achat, arbitrage #2547 (2026-10-09) : Succès Stupéfiant ET Négociateur se cumulent → −30 %', () => {
    expect(bargainPct(true, 6, true)).toBe(30);
    expect(variationDuMarchandage(issue(true, 9, true), 'achat')).toBe(-30);
    expect(bargainBuyFactor(issue(true, 9, true))).toBe(0.7);
  });
  it('achat : Négociateur sans victoire → aucune remise', () => {
    expect(bargainPct(false, 6, true)).toBe(0);
    expect(variationDuMarchandage(issue(false, 6, true), 'achat')).toBe(0);
    expect(bargainBuyFactor(issue(false, 6, true))).toBe(1);
  });
  it('vente, LDB 59 l.54 : sur la base ½, gagné seul → 1 (½ du listé) ; perdu → 0,5 (¼)', () => {
    expect(variationDuMarchandage(issue(true, 5, false), 'vente'), 'le double du prix sans Marchandage').toBe(100);
    expect(bargainSellFactor(issue(true, 0, false))).toBe(1);
    expect(variationDuMarchandage(issue(false, 0, false), 'vente'), 'le prix sans Marchandage').toBe(0);
    expect(bargainSellFactor(issue(false, 0, false))).toBe(FACTEUR_DE_VENTE_SANS_MARCHANDAGE);
    expect(bargainSellFactor(issue(false, 0, false))).toBe(0.5);
  });
  it('vente, arbitrage #2547 (2026-10-09) « dans l’autre sens » : Stupéfiant +10 %, Négociateur +10 %, cumulés', () => {
    expect(bargainSellFactor(issue(true, 6, false))).toBe(1.1);
    expect(bargainSellFactor(issue(true, 1, true))).toBe(1.1);
    expect(bargainSellFactor(issue(true, 6, true))).toBe(1.2);
    expect(hausseDeVente(issue(true, 9, true))).toBe(20);
    expect(variationDuMarchandage(issue(true, 9, true), 'vente')).toBe(140);
  });
  it('vente perdue : Négociateur sans effet → 0,5 (¼)', () => {
    expect(bargainSellFactor(issue(false, 1, true))).toBe(0.5);
    expect(variationDuMarchandage(issue(false, 6, true), 'vente')).toBe(0);
  });
});

describe('négoce de cargaison — MSRC 13 l.127/158, MDG 15 l.335/385', () => {
  const personne = { joueur: false, marchand: false };
  it('achat : le groupe gagne → remise ; le marchand gagne → hausse ; égalité → rien', () => {
    expect(variationDuNegoce({ winner: 'attaquant', netSL: 2 }, 'achat', personne)).toBe(-10);
    expect(variationDuNegoce({ winner: 'defenseur', netSL: 6 }, 'achat', personne)).toBe(20);
    expect(variationDuNegoce({ winner: 'egalite', netSL: 0 }, 'achat', personne)).toBe(0);
  });
  it('vente : le groupe gagne → hausse ; le marchand gagne → baisse', () => {
    expect(variationDuNegoce({ winner: 'attaquant', netSL: 1 }, 'vente', personne)).toBe(10);
    expect(variationDuNegoce({ winner: 'defenseur', netSL: 1 }, 'vente', personne)).toBe(-10);
  });
  it('le Négociateur ne compte que pour le vainqueur (LDB 10 l.818)', () => {
    expect(variationDuNegoce({ winner: 'attaquant', netSL: 1 }, 'achat', { joueur: true, marchand: true })).toBe(-20);
    expect(variationDuNegoce({ winner: 'attaquant', netSL: 1 }, 'achat', { joueur: false, marchand: true })).toBe(-10);
    expect(variationDuNegoce({ winner: 'defenseur', netSL: 1 }, 'vente', { joueur: true, marchand: true })).toBe(-20);
  });
});
