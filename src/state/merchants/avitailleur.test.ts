/**
 * #220 — Avitailleur (chandlerie navale) : archétype au registre + stock garanti (`curated`)
 * contenant l'eau douce et les pièces détachées de navire indispensables au réassort en mer.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { makeRNG } from '../../engine/dice';
import { rollStock, type CatalogItem } from '../../engine/disponibilite';
import { trappings } from '../../data';
import { MERCHANTS } from './index';
import { useGame } from '../store';
import { emptyScene } from '../scene';
import { setRule, resetRule } from '../../engine/policy';
import type { Combatant } from '../../engine/types';

describe('#220 — archétype avitailleur (registre)', () => {
  it('est chargé au registre avec son étiquette et sa catégorie', () => {
    expect(MERCHANTS.avitailleur).toMatchObject({ label: 'Avitailleur', settlement: 'ville', resaleRate: 0.5, bargainSkill: 40 });
    expect(MERCHANTS.avitailleur.category.subTypes).toEqual(
      expect.arrayContaining(['nourriture-boisson-et-hebergement', 'possessions-diverses', 'munition-de-siege']),
    );
  });

  it('le curated est exhaustif : eau douce + pièces de navire + munitions navales + rations de mer', () => {
    expect(MERCHANTS.avitailleur.curated).toEqual(
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
    const arch = MERCHANTS.avitailleur;
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
 * Le contrat `curated` (« Articles garantis en stock […] Disponibilité ignorée », `merchants/types.ts`)
 * vaut pour TOUT mode de marché : le mode simplifié / sans-Disponibilité passe par `fullStock`, qui
 * excluait les Exotiques SANS regarder le `curated` — l'Avitailleur perdait sa mitraille (Exotique).
 */
const hero = (): Combatant => ({ id: 'h', name: 'H', items: [], characteristics: { sociabilite: 35 }, skills: [], wounds: { current: 10, max: 10 }, conditions: [], weapons: [], armour: {} } as unknown as Combatant);

const sceneWithAvitailleur = (marketMode?: string) => {
  const sc = emptyScene(4, 4); sc.id = 'm';
  sc.entities.push({ id: 'pnj', kind: 'personnage', ref: 'humain', pos: { x: 0, y: 0 }, merchant: { archetype: 'avitailleur', ...(marketMode ? { marketMode } : {}) } as never });
  return sc;
};

describe('curated garanti QUEL QUE SOIT le mode de marché (chemin réel `openMerchant`)', () => {
  beforeEach(() => useGame.setState({ party: [], scene: null, merchant: null, merchantStocks: {} }));
  afterEach(() => resetRule('market-mode'));

  for (const mode of ['simplifie', 'sans-disponibilite'] as const) {
    it(`mode « ${mode} » : la mitraille (Exotique, curatée par l’avitailleur) reste en stock`, () => {
      expect(MERCHANTS.avitailleur.curated).toContain('mitraille-et-poudre');
      expect(trappings.find((t) => t.id === 'mitraille-et-poudre')!.availability).toBe('Exotique');
      useGame.setState({ party: [hero()], scene: sceneWithAvitailleur(mode) });
      useGame.getState().openMerchant('pnj');
      expect(useGame.getState().merchant!.stock.map((l) => l.id)).toContain('mitraille-et-poudre');
    });
  }

  it('la règle GLOBALE « simplifie » (sans override d’entité) garantit le curated de même', () => {
    setRule('market-mode', 'simplifie');
    useGame.setState({ party: [hero()], scene: sceneWithAvitailleur() });
    useGame.getState().openMerchant('pnj');
    expect(useGame.getState().merchant!.stock.map((l) => l.id)).toContain('mitraille-et-poudre');
  });
});
