import { describe, it, expect } from 'vitest';
import { harvestProfileFor, harvestSizeOf, harvestYield, costPerEnc, testsDeRecolte } from './harvest';
import { formatMoney } from './money';
import { findCreatureById } from '../data';

describe('harvest — Précieuses Entrailles (ZI)', () => {
  it('profil porté par la créature (creatures.json), coût = rareté × dangerosité', () => {
    const p = harvestProfileFor('cockatrice')!; // Exotique, Menaçante
    expect(p.rarity).toBe('exotique');
    expect(p.danger).toBe('menacante');
    expect(formatMoney(costPerEnc(p))).toBe('6 CO');
  });

  it('exemple du livre : cockatrice Grande → 4 Enc, 24 CO (Conservé), 3 CO (Pourri)', () => {
    const p = harvestProfileFor('cockatrice')!;
    const conserve = harvestYield(p, 'grande', 0, 'conserve');
    expect(conserve.enc).toBe(4);
    expect(formatMoney(conserve.total)).toBe('24 CO');
    expect(formatMoney(harvestYield(p, 'grande', 0, 'pourri').total)).toBe('3 CO'); // 1/8, Exotique
  });

  it('Frais double le prix standard', () => {
    const p = harvestProfileFor('cockatrice')!;
    expect(formatMoney(harvestYield(p, 'grande', 0, 'frais').total)).toBe('48 CO');
  });

  it('quantité exploitable selon la Taille (ZI 13 l.307-313)', () => {
    const p = harvestProfileFor('cockatrice')!;
    expect((['inf-moyenne', 'moyenne', 'grande', 'enorme', 'monstrueuse'] as const).map((taille) => harvestYield(p, taille, 0).enc)).toEqual([1, 2, 4, 8, 16]);
  });

  it('chaque Degré d’échec retire un cran de quantité, jusqu’à 0 (ZI 13 l.320-321)', () => {
    const p = harvestProfileFor('cockatrice')!;
    expect(harvestYield(p, 'grande', 0, 'conserve').enc).toBe(4); // Grande : DR 0, aucun Degré d'échec
    expect(harvestYield(p, 'grande', -1, 'conserve').enc).toBe(2); // → Moyenne
    expect(harvestYield(p, 'grande', -2, 'conserve').enc).toBe(1); // → Inf. Moyenne
    expect(harvestYield(p, 'grande', -3, 'conserve').enc).toBe(0); // plancher : rien
    expect(harvestYield(p, 'grande', -5, 'conserve')).toMatchObject({ enc: 0, total: { gold: 0, silver: 0, brass: 0 } });
    expect(harvestYield(p, 'enorme', -2).enc, 'exemple du livre : Énorme à −2 DR').toBe(2);
  });

  it('les Tests admis selon la créature (ZI 13 l.322)', () => {
    const noms = (id: string) => testsDeRecolte(findCreatureById(id)!).map((x) => `${x.skill?.id}/${x.skill?.spec}`);
    const toutes = ['savoir/betes-sauvages', 'savoir/remedes'];
    expect(noms('geant')).toEqual(toutes);
    expect(noms('vouivre'), 'venimeuse : Trait Venin').toEqual([...toutes, 'metier/empoisonneur']);
    expect(noms('chimere'), 'mystique : Trait Magique').toEqual([...toutes, 'savoir/magie']);
  });

  it('Pourri : les pièces non Exotiques/Uniques ne valent plus rien', () => {
    const troll = harvestProfileFor('troll-des-rivieres')!; // Rare
    expect(formatMoney(harvestYield(troll, 'grande', 0, 'pourri').total)).toBe('0 sc');
    const dragon = harvestProfileFor('dragon-de-la-foret')!; // Exotique
    expect(harvestYield(dragon, 'enorme', 0, 'pourri').total.gold).toBeGreaterThan(0);
  });

  it('Taille de récolte : catégorie lue au Trait `taille` par son id (bestiaire RÉEL)', () => {
    expect(harvestSizeOf(findCreatureById('cockatrice')!)).toBe('grande');
    expect(harvestSizeOf(findCreatureById('dragon-de-la-foret')!)).toBe('enorme');
    expect(harvestSizeOf({ traits: [{ id: 'taille', arg: 'monstrueuse' }] })).toBe('monstrueuse');
  });

  it('« Inférieure à Moyenne » (ZI 13 l.306) regroupe les trois catégories sous Moyenne', () => {
    expect(harvestSizeOf({ traits: [{ id: 'taille', arg: 'petite' }] })).toBe('inf-moyenne');
    expect(harvestSizeOf({ traits: [{ id: 'taille', arg: 'tresPetite' }] })).toBe('inf-moyenne');
    expect(harvestSizeOf({ traits: [{ id: 'taille', arg: 'minuscule' }] })).toBe('inf-moyenne');
  });

  it('sans Trait Taille, le Talent Petit (LDB 10 l.943) porte la Taille de récolte', () => {
    expect(harvestSizeOf({ talents: [{ id: 'petit' }] })).toBe('inf-moyenne');
    expect(harvestSizeOf({ traits: [{ id: 'taille', arg: 'grande' }], talents: [{ id: 'petit' }] })).toBe('grande');
  });

  it('sans Trait Taille : défaut Moyenne (arbitrage `effectiveSize`)', () => {
    expect(harvestSizeOf({ traits: [{ id: 'bestial' }, { id: 'vol' }] })).toBe('moyenne');
    expect(harvestSizeOf({})).toBe('moyenne');
  });
});
