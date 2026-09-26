/**
 * #273 dernier volet — stocks marchands routés par la porte du seam de jet : local sans MJ → tirage
 * INLINE inchangé (zéro friction) ; siège MJ (`net.gmSeat`) → tirage VISIBLE (étape de cascade
 * `merchant-stock`, jamais silencieux). Le RNG SEEDÉ reste identique quelle que soit la surface.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { emptyScene } from './scene';
import type { Combatant } from '../engine/types';

const hero = (): Combatant =>
  ({ id: 'h', name: 'H', items: [], characteristics: {}, wounds: { current: 10, max: 10 }, conditions: [], weapons: [], armour: {} } as unknown as Combatant);

const merchantScene = () => {
  const sc = emptyScene(4, 4); sc.id = 'm';
  sc.entities.push({ id: 'pnj', kind: 'personnage', ref: 'humain', pos: { x: 0, y: 0 }, merchant: { archetype: 'armurier' } } as never);
  return sc;
};

const baseState = () => ({ party: [hero()], scene: merchantScene(), money: { gold: 50, silver: 0, brass: 0 }, merchantStocks: {}, gameTime: 8 * 60 });

describe('#273 dernier volet — policy de la porte sur le stock marchand', () => {
  beforeEach(() => useGame.getState().seedRng(4));

  it('local sans MJ : openMerchant tire et ouvre le panneau INLINE, aucune cascade posée', () => {
    useGame.setState(baseState());
    useGame.getState().openMerchant('pnj');
    const s = useGame.getState();
    expect(s.merchant).not.toBeNull();
    expect(s.merchant!.stock.length).toBeGreaterThan(0);
    expect(s.pendingCascade).toBeNull();
  });

  it('siège MJ : openMerchant NE tire PAS de stock silencieux — pose une étape de cascade visible', () => {
    useGame.setState({ ...baseState(), net: { ...useGame.getState().net, gmSeat: 0 } });
    useGame.getState().openMerchant('pnj');
    const s = useGame.getState();
    expect(s.merchant).toBeNull(); // pas ouvert tant que le MJ n'a pas validé
    expect(s.pendingCascade).not.toBeNull();
    expect(s.pendingCascade!.participants[0].kind).toBe('merchant-stock');
  });

  it('siège MJ : « Continuer » applique la MÊME persistance (merchantStocks) et ouvre le panneau', () => {
    useGame.setState({ ...baseState(), net: { ...useGame.getState().net, gmSeat: 0 } });
    useGame.getState().openMerchant('pnj');
    expect(useGame.getState().pendingCascade).not.toBeNull();
    useGame.getState().cascadeNext();
    const s = useGame.getState();
    expect(s.pendingCascade).toBeNull();
    expect(s.merchant).not.toBeNull();
    expect(s.merchant!.entityId).toBe('pnj');
    expect(s.merchantStocks['pnj']).toBeDefined();
    expect(s.merchant!.stock).toEqual(s.merchantStocks['pnj'].stock);
  });

  it('déterminisme : le tirage MJ (après Continuer) == le tirage inline local, MÊME seed/état', () => {
    // Chemin local.
    useGame.getState().seedRng(4);
    useGame.setState(baseState());
    useGame.getState().openMerchant('pnj');
    const inlineStock = useGame.getState().merchant!.stock.map((l) => `${l.id}:${l.qty}`).sort().join('|');

    // Chemin MJ (même état de départ, même seed).
    useGame.getState().seedRng(4);
    useGame.setState({ ...baseState(), net: { ...useGame.getState().net, gmSeat: 0 } });
    useGame.getState().openMerchant('pnj');
    useGame.getState().cascadeNext();
    const gmStock = useGame.getState().merchant!.stock.map((l) => `${l.id}:${l.qty}`).sort().join('|');

    expect(gmStock).toEqual(inlineStock);
  });
});
