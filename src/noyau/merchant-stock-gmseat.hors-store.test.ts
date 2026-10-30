/**
 * #273 dernier volet — stocks marchands routés par la porte du seam de jet : local sans MJ → tirage
 * INLINE inchangé (zéro friction) ; siège MJ (`net.gmSeat`) → tirage VISIBLE (étape de cascade
 * `merchant-stock`, jamais silencieux). Le RNG SEEDÉ reste identique quelle que soit la surface.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { emptyScene } from './monde/scene';
import type { Combatant } from '../engine/types';
import { combattantDeTest } from '../engine/combattantDeTest.testkit';
import { blessuresDeBase } from '../engine/characteristics';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

const hero = (): Combatant =>
  combattantDeTest({ id: 'h', label: 'H', items: [], characteristics: {}, wounds: blessuresDeBase(10), conditions: [], weapons: [] });

const merchantScene = () => {
  const sc = emptyScene('scene-test', 4, 4); sc.id = 'm';
  sc.entities.push({ id: 'pnj', kind: 'personnage', ref: 'humain', pos: { x: 0, y: 0 }, merchant: { archetype: 'armurier' } } as never);
  return sc;
};

const baseState = () => ({ party: [hero()], scene: merchantScene(), money: { gold: 50, silver: 0, brass: 0 }, merchantStocks: {}, gameTime: 8 * 60 });

describe('#273 dernier volet — policy de la porte sur le stock marchand', () => {
  beforeEach(() => banc.getState().seedRng(4));

  it('local sans MJ : openMerchant tire et ouvre le panneau INLINE, aucune cascade posée', () => {
    banc.setState(baseState());
    banc.getState().openMerchant('pnj');
    const s = banc.getState();
    expect(s.merchant).not.toBeNull();
    expect(s.merchant!.stock.length).toBeGreaterThan(0);
    expect(s.pendingCascade).toBeNull();
  });

  it('siège MJ : openMerchant NE tire PAS de stock silencieux — pose une étape de cascade visible', () => {
    banc.setState({ ...baseState(), net: { ...banc.getState().net, gmSeat: 0 } });
    banc.getState().openMerchant('pnj');
    const s = banc.getState();
    expect(s.merchant).toBeNull(); // pas ouvert tant que le MJ n'a pas validé
    expect(s.pendingCascade).not.toBeNull();
    expect(s.pendingCascade!.participants[0].kind).toBe('merchant-stock');
  });

  it('siège MJ : « Continuer » applique la MÊME persistance (merchantStocks) et ouvre le panneau', () => {
    banc.setState({ ...baseState(), net: { ...banc.getState().net, gmSeat: 0 } });
    banc.getState().openMerchant('pnj');
    expect(banc.getState().pendingCascade).not.toBeNull();
    banc.getState().cascadeNext();
    const s = banc.getState();
    expect(s.pendingCascade).toBeNull();
    expect(s.merchant).not.toBeNull();
    expect(s.merchant!.entityId).toBe('pnj');
    expect(s.merchantStocks['pnj']).toBeDefined();
    expect(s.merchant!.stock).toEqual(s.merchantStocks['pnj'].stock);
  });

  it('déterminisme : le tirage MJ (après Continuer) == le tirage inline local, MÊME seed/état', () => {
    // Chemin local.
    banc.getState().seedRng(4);
    banc.setState(baseState());
    banc.getState().openMerchant('pnj');
    const inlineStock = banc.getState().merchant!.stock.map((l) => `${l.id}:${l.qty}`).sort().join('|');

    // Chemin MJ (même état de départ, même seed).
    banc.getState().seedRng(4);
    banc.setState({ ...baseState(), net: { ...banc.getState().net, gmSeat: 0 } });
    banc.getState().openMerchant('pnj');
    banc.getState().cascadeNext();
    const gmStock = banc.getState().merchant!.stock.map((l) => `${l.id}:${l.qty}`).sort().join('|');

    expect(gmStock).toEqual(inlineStock);
  });
});
