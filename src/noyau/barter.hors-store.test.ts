/**
 * Troc (LDB 59 l.64-76) + « Baisse des prix » (l.60) — câblage marchand : le Troc échange des biens
 * sans argent au ratio de rareté ; la baisse de moitié réduit le gain de vente.
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { barterQuote, sellGain, sellRefusal, type MerchantState } from './merchantFlow';
import { partyMoneyTotal } from './bourseFlow';
import { troquer } from './marchand.testkit';
import { t } from '../i18n';
import { itemFromTrappingById } from '../engine/items';
import { toBrass } from '../engine/money';
import { tousLesHerosDeScenario } from '../scenes/test-scenarios/_heros';
import type { Combatant, ItemInstance } from '../engine/types';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

const merchant = (stock: { id: string; qty: number }[], extra: Partial<MerchantState> = {}): MerchantState => ({
  entityId: 'p', archetype: 'armurier', settlement: 'ville', resaleRate: 0.5, stock, cart: [], bargainLocked: false, ...extra,
});

beforeEach(() => { banc.setState({ battle: null, party: [], journal: [], merchant: null, merchantStocks: {} }); });

describe('barterQuote (LDB 59 l.64-76)', () => {
  it('deux biens chiffrés → ratio de rareté + nombre à céder ≥ 1', () => {
    const q = barterQuote('hallebarde', 'dague', 1);
    expect(q).toBeTruthy();
    expect(q!.giveCount).toBeGreaterThanOrEqual(1);
    // Céder une hallebarde (chère) contre une dague (bon marché) : 1 suffit largement.
    expect(q!.giveCount).toBe(1);
  });
});

describe('marchand.troquer', () => {
  it('cède les exemplaires requis, reçoit le bien acquis, décrémente le stock, bourse INCHANGÉE', () => {
    const hero = tousLesHerosDeScenario(idsDeTest)[0] as Combatant;
    hero.items = [itemFromTrappingById('hallebarde', idsDeTest), itemFromTrappingById('hallebarde', idsDeTest)].filter(Boolean) as ItemInstance[];
    banc.setState({ party: [hero], merchant: merchant([{ id: 'dague', qty: 5 }]) });
    const before = toBrass(partyMoneyTotal(banc.getState));
    troquer(banc.getState, { giveHeroId: hero.id, giveTrappingId: 'hallebarde', getStockId: 'dague', getCount: 1 });
    const st = banc.getState();
    const items = st.party[0].items ?? [];
    expect(items.filter((i) => i.trappingId === 'hallebarde')).toHaveLength(1); // 1 cédée
    expect(items.some((i) => i.trappingId === 'dague')).toBe(true); // 1 acquise
    expect(st.merchant!.stock.find((l) => l.id === 'dague')!.qty).toBe(4); // stock décrémenté
    expect(toBrass(partyMoneyTotal(banc.getState))).toBe(before); // aucun argent échangé
  });

  it('refuse, et le dit, si le héros n’a pas assez d’exemplaires à céder', () => {
    const hero = tousLesHerosDeScenario(idsDeTest)[0] as Combatant;
    hero.items = [itemFromTrappingById('dague', idsDeTest)!]; // une dague ne vaut pas une hallebarde
    banc.setState({ party: [hero], merchant: merchant([{ id: 'hallebarde', qty: 5 }]) });
    troquer(banc.getState, { giveHeroId: hero.id, giveTrappingId: 'dague', getStockId: 'hallebarde', getCount: 1 });
    expect((banc.getState().party[0].items ?? []).some((i) => i.trappingId === 'hallebarde')).toBe(false);
    expect(banc.getState().journal.join('\n')).toMatch(/il faut \d+ × Dague à céder \(1 disponible/);
  });

  it('le troc conclu vide son brouillon ; sans bien cédé, l’échange ne s’offre pas', () => {
    const hero = tousLesHerosDeScenario(idsDeTest)[0] as Combatant;
    hero.items = [itemFromTrappingById('hallebarde', idsDeTest)!];
    banc.setState({ party: [hero], merchant: merchant([{ id: 'dague', qty: 5 }]) });
    banc.getState().fenetreChoisir('marchand', 'troquer', true);
    expect(banc.getState().journal[banc.getState().journal.length - 1]).toBe(t('choix.refus.valeur'));
    troquer(banc.getState, { giveHeroId: hero.id, giveTrappingId: 'hallebarde', getStockId: 'dague', getCount: 1 });
    expect(banc.getState().merchant!.troc).toBeNull();
  });
});

describe('Baisse des prix à la vente (LDB 59 l.60)', () => {
  it('diviser le prix par deux réduit le gain de vente', () => {
    const item = itemFromTrappingById('hallebarde', idsDeTest)!;
    const full = toBrass(sellGain(item, merchant([])));
    const halved = toBrass(sellGain(item, merchant([], { sellHalvings: { [item.uid]: 1 } })));
    expect(halved).toBe(Math.floor(full / 2));
    const quartered = toBrass(sellGain(item, merchant([], { sellHalvings: { [item.uid]: 2 } })));
    expect(quartered).toBe(Math.floor(full / 4));
  });
});

/**
 * HORS COMMERCE (LDB 59 l.15) — un objet dont la ligne du livre ne porte aucune des 4 classes n'a ni
 * acheteur (l.54 : « Vous vérifiez d'abord la Disponibilité pour un acheteur ») ni ratio de troc
 * (l.66 : « comparez la Disponibilité des objets échangés »). Le refus est explicite et journalisé ;
 * la CONTRE-ÉPREUVE montre qu'un objet ordinaire, lui, passe.
 */
describe('hors commerce — VENTE et TROC refusés, avec leur raison', () => {
  it('VENTE : `sellRefusal` refuse l’objet sans Disponibilité, accepte l’objet ordinaire', () => {
    expect(sellRefusal(itemFromTrappingById('licence-de-guilde', idsDeTest)!)).toContain('Licence de Guilde');
    expect(sellRefusal(itemFromTrappingById('arme-improvisee', idsDeTest)!)).toContain('Arme improvisée');
    expect(sellRefusal(itemFromTrappingById('hallebarde', idsDeTest)!)).toBeNull(); // contre-épreuve
  });

  it('VENTE : une instance PRÉ-VALUÉE reste vendable (Carte marine, MDG 15 l.290)', () => {
    const carte = itemFromTrappingById('carte-marine', idsDeTest)!;
    expect(sellRefusal(carte)).not.toBeNull(); // sans valeur d'instance : rien à vendre
    carte.price = { gold: 4, silver: 0, brass: 0 };
    expect(sellRefusal(carte)).toBeNull(); // valuée par l'Activité : elle porte son prix
    expect(toBrass(sellGain(carte, merchant([])))).toBeGreaterThan(0);
  });

  it('VENTE : le panier REFUSE l’ajout et le journal porte la raison', () => {
    const hero = tousLesHerosDeScenario(idsDeTest)[0] as Combatant;
    hero.items = [itemFromTrappingById('licence-de-guilde', idsDeTest)!];
    banc.setState({ party: [hero], merchant: merchant([]) });
    banc.getState().fenetreChoisir('marchand', 'ajouterALaVente', hero.items[0].uid);
    expect(banc.getState().merchant!.sellCart ?? []).toHaveLength(0);
    expect(banc.getState().journal.join('\n')).toMatch(/Vente refusée.*Licence de Guilde/);
  });

  it('VENTE : contre-épreuve — un objet ordinaire entre bien au panier', () => {
    const hero = tousLesHerosDeScenario(idsDeTest)[0] as Combatant;
    hero.items = [itemFromTrappingById('hallebarde', idsDeTest)!];
    banc.setState({ party: [hero], merchant: merchant([]) });
    banc.getState().fenetreChoisir('marchand', 'ajouterALaVente', hero.items[0].uid);
    expect(banc.getState().merchant!.sellCart ?? []).toHaveLength(1);
  });

  it('TROC : aucun devis (ni dans un sens, ni dans l’autre) pour un bien hors commerce', () => {
    expect(barterQuote('licence-de-guilde', 'dague', 1)).toBeNull();
    expect(barterQuote('dague', 'licence-de-guilde', 1)).toBeNull();
    expect(barterQuote('hallebarde', 'dague', 1)).not.toBeNull(); // contre-épreuve
  });

  it('TROC : l’échange est refusé et le journal porte la raison', () => {
    const hero = tousLesHerosDeScenario(idsDeTest)[0] as Combatant;
    hero.items = [itemFromTrappingById('licence-de-guilde', idsDeTest)!, itemFromTrappingById('licence-de-guilde', idsDeTest)!];
    banc.setState({ party: [hero], merchant: merchant([{ id: 'dague', qty: 5 }]) });
    banc.getState().fenetreChoisir('marchand', 'trocCeder', hero.items[0].uid);
    expect((banc.getState().party[0].items ?? []).some((i) => i.trappingId === 'dague')).toBe(false);
    expect(banc.getState().journal.join('\n')).toMatch(/Troc impossible.*Licence de Guilde/);
  });
});
