import { describe, it, expect } from 'vitest';
import { useGame } from './store';
import { createHero } from '../engine/character';
import { itemFromTrappingById } from '../engine/items';
import { toBrass } from '../engine/money';
import { partyMoneyTotal } from './bourseFlow';
import type { MerchantState } from './merchantFlow';

// Panier de VENTE (#22b) : parité avec l'achat, sans dupliquer la logique (prix via `sellGain`).
describe('Panier de vente (#22b)', () => {
  function setup() {
    const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    const a = itemFromTrappingById('hallebarde')!;
    const b = itemFromTrappingById('dague')!;
    hero.items = [a, b];
    const merchant: MerchantState = {
      entityId: 'm', archetype: 'armurier', settlement: 'ville', resaleRate: 0.5, stock: [], cart: [], bargainLocked: false,
    };
    useGame.setState({ party: [hero], merchant });
    return { heroId: hero.id, a, b };
  }

  it('ajoute des instances puis vend tout : bourse créditée, objets retirés, panier vidé', () => {
    const { heroId, a, b } = setup();
    useGame.getState().addToSellCart(a.uid, heroId);
    useGame.getState().addToSellCart(b.uid, heroId);
    useGame.getState().addToSellCart(a.uid, heroId); // doublon ignoré (instance unique)
    expect(useGame.getState().merchant!.sellCart).toHaveLength(2);

    useGame.getState().confirmSell();
    const s = useGame.getState();
    expect(s.merchant!.sellCart).toHaveLength(0);
    expect(s.party[0].items?.filter((i) => i.uid === a.uid || i.uid === b.uid)).toHaveLength(0); // les deux objets vendus, retirés (la Bourse créditée demeure)
    expect(toBrass(partyMoneyTotal(useGame.getState))).toBeGreaterThan(0); // bourse créditée
  });

  it('retirer du panier de vente n’altère pas l’inventaire', () => {
    const { heroId, a } = setup();
    useGame.getState().addToSellCart(a.uid, heroId);
    useGame.getState().removeFromSellCart(a.uid);
    expect(useGame.getState().merchant!.sellCart).toHaveLength(0);
    expect(useGame.getState().party[0].items).toHaveLength(2); // rien vendu
    expect(toBrass(partyMoneyTotal(useGame.getState))).toBe(0);
  });
});
