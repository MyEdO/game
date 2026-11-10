import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, beforeEach, expect } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { createHero } from '../engine/character';
import { itemFromTrappingById } from '../engine/items';
import { toBrass } from '../engine/money';
import { partyMoneyTotal } from './bourseFlow';
import type { MerchantState } from './merchantFlow';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

// Panier de VENTE (#22b) : parité avec l'achat, sans dupliquer la logique (prix via `sellGain`).
describe('Panier de vente (#22b)', () => {
  function setup() {
    const hero = createHero({ idNeuf: idsDeTest, speciesId: 'humains-reiklander', careerId: 'soldat', label: 'H', seed: 1 });
    const a = itemFromTrappingById('hallebarde', idsDeTest)!;
    const b = itemFromTrappingById('dague', idsDeTest)!;
    hero.items = [a, b];
    const merchant: MerchantState = {
      entityId: 'm', archetype: 'armurier', settlement: 'ville', resaleRate: 0.5, stock: [], cart: [], bargainLocked: false,
    };
    banc.setState({ party: [hero], merchant });
    return { heroId: hero.id, a, b };
  }

  it('ajoute des instances puis vend tout : bourse créditée, objets retirés, panier vidé', () => {
    const { heroId, a, b } = setup();
    banc.getState().fenetreChoisir('marchand', 'ajouterALaVente', a.uid);
    banc.getState().fenetreChoisir('marchand', 'ajouterALaVente', b.uid);
    banc.getState().fenetreChoisir('marchand', 'ajouterALaVente', a.uid); // doublon refusé : l'instance est déjà en vente
    expect(banc.getState().merchant!.sellCart, 'chaque objet, chez son porteur').toEqual([{ uid: a.uid, heroId }, { uid: b.uid, heroId }]);

    banc.getState().fenetreChoisir('marchand', 'vendre', true);
    const s = banc.getState();
    expect(s.merchant!.sellCart).toHaveLength(0);
    expect(s.party[0].items?.filter((i) => i.uid === a.uid || i.uid === b.uid)).toHaveLength(0); // les deux objets vendus, retirés (la Bourse créditée demeure)
    expect(toBrass(partyMoneyTotal(banc.getState))).toBeGreaterThan(0); // bourse créditée
  });

  it('retirer du panier de vente n’altère pas l’inventaire', () => {
    const { a } = setup();
    banc.getState().fenetreChoisir('marchand', 'ajouterALaVente', a.uid);
    banc.getState().fenetreChoisir('marchand', 'retirerDeLaVente', a.uid);
    expect(banc.getState().merchant!.sellCart).toHaveLength(0);
    expect(banc.getState().party[0].items).toHaveLength(2); // rien vendu
    expect(toBrass(partyMoneyTotal(banc.getState))).toBe(0);
  });
});
