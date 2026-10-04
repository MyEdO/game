import { describe, it, expect } from 'vitest';
import { harvestProfileFor, harvestSizeOf, harvestYield, valeurDUnePiece } from './harvest';
import { formatMoney, fromBrass, toBrass } from './money';
import { findCreatureById } from '../data';

describe('harvest — Précieuses Entrailles (ZI)', () => {
  it('ZI 13 l.337, l.342, l.381 : valeur Conservée d’une pièce = coût du tableau', () => {
    const p = harvestProfileFor('cockatrice')!;
    expect(p.rarity).toBe('Exotique');
    expect(p.danger).toBe('Menaçante');
    expect(formatMoney(valeurDUnePiece(p, 'Conservé'))).toBe('6 CO');
    expect(formatMoney(valeurDUnePiece(harvestProfileFor('dragon-de-la-foret')!, 'Conservé'))).toBe('9 CO');
    expect(formatMoney(valeurDUnePiece(harvestProfileFor('troll-des-rivieres')!, 'Conservé'))).toBe('1 CO');
  });

  it('ZI 13 l.402-405 : une pièce de cockatrice par degré — ×2, standard, moitié, 1/8 (Exotique)', () => {
    const p = harvestProfileFor('cockatrice')!;
    expect(formatMoney(valeurDUnePiece(p, 'Frais'))).toBe('12 CO');
    expect(formatMoney(valeurDUnePiece(p, 'Conservé'))).toBe('6 CO');
    expect(formatMoney(valeurDUnePiece(p, 'Faisandé'))).toBe('3 CO');
    expect(formatMoney(valeurDUnePiece(p, 'Pourri'))).toBe('15/–');
  });

  it('ZI 13 l.414 : cockatrice Grande → 4 Enc, 24 CO (Conservé), 3 CO (Pourri)', () => {
    const p = harvestProfileFor('cockatrice')!;
    const enc = harvestYield('Grande', 0);
    expect(enc).toBe(4);
    expect(formatMoney(fromBrass(enc * toBrass(valeurDUnePiece(p, 'Conservé'))))).toBe('24 CO');
    expect(formatMoney(fromBrass(enc * toBrass(valeurDUnePiece(p, 'Pourri'))))).toBe('3 CO');
  });

  it('chaque DR d’échec au Savoir retire un cran de quantité', () => {
    expect(harvestYield('Grande', 0)).toBe(4); // Grande
    expect(harvestYield('Grande', -1)).toBe(2); // → Moyenne
    expect(harvestYield('Grande', -2)).toBe(1); // → Inf. Moyenne
    expect(harvestYield('Grande', -5)).toBe(1); // plancher
  });

  it('ZI 13 l.400 : une pièce Pourrie hors Exotique/Unique vaut 0 (#2137)', () => {
    const troll = harvestProfileFor('troll-des-rivieres')!; // Rare
    expect(formatMoney(valeurDUnePiece(troll, 'Faisandé'))).toBe('10/–');
    expect(formatMoney(valeurDUnePiece(troll, 'Pourri'))).toBe('0 sc');
    expect(formatMoney(valeurDUnePiece(harvestProfileFor('dragon-de-la-foret')!, 'Pourri'))).toBe('1 CO 2/6');
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
