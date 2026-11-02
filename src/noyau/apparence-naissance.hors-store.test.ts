import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { applyEffects } from './combatEffects';
import { giveTrappingSchema } from '../data/schemas/defs-scenes/effets';
import { withBourseMoney } from '../engine/bourse';
import type { MerchantState } from './merchantFlow';
import { herosDeNaissance, poserVariantesDeNaissance, restaurerApparencesDeNaissance, varianteDeNaissance } from '../apparenceNaissance.testkit';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

const porteur = (id: string, espece = 'nains', carriere = 'soldat') => {
  const h = herosDeNaissance(espece, carriere);
  h.id = id;
  h.items = [];
  return withBourseMoney(h, { gold: 100, silver: 0, brass: 0 });
};
const marchand = (): MerchantState => ({
  entityId: 'vendeur', archetype: 'armurier', settlement: 'ville', stock: [{ id: 'arme-simple', qty: 3 }],
  buyMarkup: 1, resaleRate: 0.5, cart: [{ id: 'arme-simple', qty: 1 }],
  pendingDistribution: null, bargainBuy: null, bargainSell: null, bargainLocked: false,
});
const donner = (heroId: string, apparence?: { id: string }) =>
  applyEffects(() => banc.getState(), banc.setState, [giveTrappingSchema.parse({ type: 'giveTrapping', trappingId: 'arme-simple', heroId, ...(apparence ? { apparence } : {}) })]);

beforeEach(() => {
  poserVariantesDeNaissance(varianteDeNaissance(), varianteDeNaissance({ id: 'naissance-humaine', especes: ['humains-reiklander'] }));
});
afterEach(() => {
  restaurerApparencesDeNaissance();
});

describe('la naissance est câblée aux flux réels', () => {
  it('giveTrapping lit le destinataire nommé, pas le premier héros', () => {
    banc.setState({ party: [porteur('humain', 'humains-reiklander'), porteur('nain')] });
    donner('nain');
    expect(banc.getState().party[1].items?.find((i) => i.trappingId === 'arme-simple')?.apparence).toBe('naissance-naine');
    expect(banc.getState().party[0].items?.some((i) => i.trappingId === 'arme-simple')).toBe(false);
  });

  it('l’apparence portée par giveTrapping gagne sur celle du nouveau destinataire', () => {
    banc.setState({ party: [porteur('humain', 'humains-reiklander')] });
    donner('humain', { id: 'naissance-naine' });
    expect(banc.getState().party[0].items?.find((i) => i.trappingId === 'arme-simple')?.apparence).toBe('naissance-naine');
  });

  it('transferItem transmet la même décision et le même uid entre deux héros de contextes différents', () => {
    banc.setState({ party: [porteur('nain'), porteur('humain', 'humains-reiklander', 'noble')] });
    donner('nain');
    const objet = banc.getState().party[0].items!.find((i) => i.trappingId === 'arme-simple')!;
    expect(objet.apparence).toBe('naissance-naine');
    banc.getState().transferItem(objet.uid, 'nain', 'humain');
    expect(banc.getState().party[0].items?.some((i) => i.uid === objet.uid)).toBe(false);
    expect(banc.getState().party[1].items?.find((i) => i.uid === objet.uid)?.apparence).toBe('naissance-naine');
  });

  it('le panier fait naître sans propriétaire : aucune apparence, et la répartition n’en décide aucune', () => {
    banc.setState({ party: [porteur('nain'), porteur('humain', 'humains-reiklander')], merchant: marchand() });
    banc.getState().payCart();
    const attribution = banc.getState().merchant!.pendingDistribution?.[0];
    const objet = attribution && 'item' in attribution ? attribution.item : undefined;
    expect(objet).toBeDefined();
    expect(objet).not.toHaveProperty('apparence');
    banc.getState().assignDistribution(0, 'humain');
    banc.getState().confirmDistribution();
    expect(banc.getState().party[1].items?.find((i) => i.uid === objet?.uid)).not.toHaveProperty('apparence');
  });
});
