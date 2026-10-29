/**
 * #220 — Avitailleur (chandlerie navale) : archétype au registre + stock garanti (`curated`)
 * contenant l'eau douce et les pièces détachées de navire indispensables au réassort en mer.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { makeRNG } from '../engine/dice';
import { rollStock, type CatalogItem } from '../engine/disponibilite';
import { trappings, findMerchantArchetypeById } from '../data';
import { garanti } from '../lib/garanti';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { emptyScene } from './monde/scene';
import { setRule } from '../engine/policy';
import type { Combatant } from '../engine/types';
import { combattantDeTest } from '../engine/combattantDeTest.testkit';
import { blessuresDeBase } from '../engine/characteristics';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

describe('#220 — archétype avitailleur (registre)', () => {
  it('est chargé au registre avec son étiquette et sa catégorie', () => {
    expect(findMerchantArchetypeById('avitailleur')).toMatchObject({ label: 'Avitailleur', settlement: 'ville', resaleRate: 0.5, bargainSkill: 40 });
    expect(findMerchantArchetypeById('avitailleur')?.category.subTypes).toEqual(
      expect.arrayContaining(['nourriture-boisson-et-hebergement', 'possessions-diverses', 'munition-de-siege']),
    );
  });

  it('le curated est exhaustif : eau douce + pièces de navire + munitions navales + rations de mer', () => {
    expect(findMerchantArchetypeById('avitailleur')?.curated).toEqual(
      expect.arrayContaining([
        'tonneau-d-eau-douce',
        'pieces-detachees-de-navire',
        'boulet-et-poudre',
        'mitraille-et-poudre',
        'ration-biscuits-de-mer',
        'ration-nourriture-preservee',
        'ration-soupe-chou-fermente',
      ]),
    );
  });

  it('le stock tiré (rollStock, RNG seedé) garantit l\'eau douce et les pièces détachées de navire', () => {
    const arch = garanti(findMerchantArchetypeById('avitailleur'), 'avitailleur', 'archétype de marchand');
    const cat: CatalogItem[] = trappings
      .filter((t) => !arch.category.categories && t.subType != null && arch.category.subTypes!.includes(t.subType))
      .map((t) => ({ id: t.id, label: t.label, availability: (t.availability as CatalogItem['availability']) ?? null }));
    // seeds multiples : le curated doit ressortir quelle que soit l'issue du Test de Disponibilité du reste du stock
    for (const seed of [1, 2, 3, 42]) {
      const stock = rollStock(cat, 'ville', makeRNG(seed), arch.curated);
      const ids = stock.map((l) => l.id);
      expect(ids).toContain('tonneau-d-eau-douce');
      expect(ids).toContain('pieces-detachees-de-navire');
      expect(ids).toContain('boulet-et-poudre');
      expect(ids).toContain('mitraille-et-poudre');
    }
  });
});

/**
 * Le contrat `curated` (« Articles garantis en stock […] Disponibilité ignorée », `data/merchants.types.ts`)
 * vaut pour TOUT mode de marché : le mode simplifié / sans-Disponibilité passe par `fullStock`, qui
 * excluait les Exotiques SANS regarder le `curated` — l'Avitailleur perdait sa mitraille (Exotique).
 */
const hero = (): Combatant => combattantDeTest({ id: 'h', label: 'H', items: [], characteristics: { sociabilite: 35 }, skills: [], wounds: blessuresDeBase(10), conditions: [], weapons: [] });

const sceneWithAvitailleur = (marketMode?: string) => {
  const sc = emptyScene('scene-test', 4, 4); sc.id = 'm';
  sc.entities.push({ id: 'pnj', kind: 'personnage', ref: 'humain', pos: { x: 0, y: 0 }, merchant: { archetype: 'avitailleur', ...(marketMode ? { marketMode } : {}) } as never });
  return sc;
};

describe('curated garanti QUEL QUE SOIT le mode de marché (chemin réel `openMerchant`)', () => {
  beforeEach(() => banc.setState({ party: [], scene: null, merchant: null, merchantStocks: {} }));

  for (const mode of ['simplifie', 'sans-disponibilite'] as const) {
    it(`mode « ${mode} » : la mitraille (Exotique, curatée par l’avitailleur) reste en stock`, () => {
      expect(findMerchantArchetypeById('avitailleur')?.curated).toContain('mitraille-et-poudre');
      expect(trappings.find((t) => t.id === 'mitraille-et-poudre')!.availability).toBe('Exotique');
      banc.setState({ party: [hero()], scene: sceneWithAvitailleur(mode) });
      banc.getState().openMerchant('pnj');
      expect(banc.getState().merchant!.stock.map((l) => l.id)).toContain('mitraille-et-poudre');
    });
  }

  it('la règle GLOBALE « simplifie » (sans override d’entité) garantit le curated de même', () => {
    setRule('market-mode', 'simplifie');
    banc.setState({ party: [hero()], scene: sceneWithAvitailleur() });
    banc.getState().openMerchant('pnj');
    expect(banc.getState().merchant!.stock.map((l) => l.id)).toContain('mitraille-et-poudre');
  });
});
