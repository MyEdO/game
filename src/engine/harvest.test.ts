import { describe, it, expect } from 'vitest';
import { harvestProfileFor, harvestSizeOf, harvestYield, costPerEnc } from './harvest';
import { formatMoney } from './money';
import { findCreatureById } from '../data';

describe('harvest — Précieuses Entrailles (ZI)', () => {
  it('profil porté par la créature (creatures.json), coût = rareté × dangerosité', () => {
    const p = harvestProfileFor('cockatrice')!; // Exotique, Menaçante
    expect(p.rarity).toBe('Exotique');
    expect(p.danger).toBe('Menaçante');
    expect(formatMoney(costPerEnc(p))).toBe('6 CO');
  });

  it('exemple du livre : cockatrice Grande → 4 Enc, 24 CO (Conservé), 3 CO (Pourri)', () => {
    const p = harvestProfileFor('cockatrice')!;
    const conserve = harvestYield(p, 'Grande', 0, 'Conservé');
    expect(conserve.enc).toBe(4);
    expect(formatMoney(conserve.total)).toBe('24 CO');
    expect(formatMoney(harvestYield(p, 'Grande', 0, 'Pourri').total)).toBe('3 CO'); // 1/8, Exotique
  });

  it('Frais double le prix standard', () => {
    const p = harvestProfileFor('cockatrice')!;
    expect(formatMoney(harvestYield(p, 'Grande', 0, 'Frais').total)).toBe('48 CO');
  });

  it('chaque DR d’échec au Savoir retire un cran de quantité', () => {
    const p = harvestProfileFor('cockatrice')!;
    expect(harvestYield(p, 'Grande', 0, 'Conservé').enc).toBe(4); // Grande
    expect(harvestYield(p, 'Grande', -1, 'Conservé').enc).toBe(2); // → Moyenne
    expect(harvestYield(p, 'Grande', -2, 'Conservé').enc).toBe(1); // → Inf. Moyenne
    expect(harvestYield(p, 'Grande', -5, 'Conservé').enc).toBe(1); // plancher
  });

  it('Pourri : les pièces non Exotiques/Uniques ne valent plus rien', () => {
    const troll = harvestProfileFor('troll-des-rivieres')!; // Rare
    expect(formatMoney(harvestYield(troll, 'Grande', 0, 'Pourri').total)).toBe('0 sc');
    const dragon = harvestProfileFor('dragon-de-la-foret')!; // Exotique
    expect(harvestYield(dragon, 'Énorme', 0, 'Pourri').total.gold).toBeGreaterThan(0);
  });

  it('Taille de récolte : catégorie lue au Trait `taille` par son id (bestiaire RÉEL)', () => {
    expect(harvestSizeOf(findCreatureById('cockatrice')!)).toBe('Grande');
    expect(harvestSizeOf(findCreatureById('dragon-de-la-foret')!)).toBe('Énorme');
    expect(harvestSizeOf({ traits: [{ id: 'taille', arg: 'monstrueuse' }] })).toBe('Monstrueuse');
  });

  it('« Inférieure à Moyenne » (ZI 13 l.306) regroupe les trois catégories sous Moyenne', () => {
    expect(harvestSizeOf({ traits: [{ id: 'taille', arg: 'petite' }] })).toBe('InfMoyenne');
    expect(harvestSizeOf({ traits: [{ id: 'taille', arg: 'tresPetite' }] })).toBe('InfMoyenne');
    expect(harvestSizeOf({ traits: [{ id: 'taille', arg: 'minuscule' }] })).toBe('InfMoyenne');
  });

  it('sans Trait Taille, le Talent Petit (LDB 10 l.943) porte la Taille de récolte', () => {
    expect(harvestSizeOf({ talents: [{ id: 'petit' }] })).toBe('InfMoyenne');
    expect(harvestSizeOf({ traits: [{ id: 'taille', arg: 'grande' }], talents: [{ id: 'petit' }] })).toBe('Grande');
  });

  it('sans Trait Taille : défaut Moyenne (arbitrage `effectiveSize`)', () => {
    expect(harvestSizeOf({ traits: [{ id: 'bestial' }, { id: 'vol', value: 80 }] })).toBe('Moyenne');
    expect(harvestSizeOf({})).toBe('Moyenne');
  });
});
