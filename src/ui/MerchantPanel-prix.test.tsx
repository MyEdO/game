/**
 * L'écran du marchand affiche le prix du NOYAU (#3059) : sous « Tenir les comptes », une ligne au prix
 * listé ≤ Statut du groupe s'affiche à 0 et se paie bourse vide, comme `payCart` la débite.
 * LDB 59 l.9-11.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MerchantPanelView } from './MerchantPanel';
import { statutLePlusHaut } from '../engine/statut.testkit';
import { setRule, resetRule } from '../engine/policy';
import type { Combatant } from '../engine/types';

const noop = {
  onAddToCart: () => {}, onDecCart: () => {}, onRemoveCart: () => {}, onClearCart: () => {}, onRefuse: () => {}, onPay: () => {},
  onAssignDist: () => {}, onConfirmDist: () => {}, onRepair: () => {}, onBargain: () => {},
  onAppraise: () => {}, onClose: () => {},
  onAddToSellCart: () => {}, onRemoveSellCart: () => {}, onClearSellCart: () => {}, onConfirmSell: () => {},
};

/** Héros au Statut le plus haut de la donnée (son budget dépasse les 2 CO de la hallebarde). */
function heroAuStatutLePlusHaut(): Combatant {
  const { career, careerLevel } = statutLePlusHaut();
  return { id: 'h', label: 'H', career, careerLevel, items: [] } as unknown as Combatant;
}

const merchant = { entityId: 'p', archetype: 'armurier', settlement: 'ville' as const, resaleRate: 0.5, stock: [{ id: 'hallebarde', qty: 2 }], cart: [{ id: 'hallebarde', qty: 1 }], bargainLocked: false };

/** Le bouton « Payer le panier » d'un rendu : présent, et refusé ou non. */
function payer(html: string): { present: boolean; refuse: boolean } {
  const bouton = [...html.matchAll(/<button[^>]*>/g)].map((m) => m[0]).find((b) => b.includes('aria-label="Payer le panier"'));
  return { present: !!bouton, refuse: !!bouton?.includes('aria-disabled="true"') };
}

afterEach(() => resetRule('market-tenir-comptes'));

describe('#3059 — MerchantPanel lit le prix du noyau', () => {
  it('Tenir les comptes : la hallebarde dans les moyens du Statut se paie bourse vide', () => {
    setRule('market-tenir-comptes', true);
    const html = renderToStaticMarkup(
      <MerchantPanelView merchant={merchant} party={[heroAuStatutLePlusHaut()]} money={{ gold: 0, silver: 0, brass: 0 }} initialBuyView="cart" {...noop} />,
    );
    expect(payer(html)).toEqual({ present: true, refuse: false });
    expect(html).not.toContain('2 CO');
  });

  it('option désactivée : le prix catalogue s’affiche et la bourse vide refuse le paiement', () => {
    setRule('market-tenir-comptes', false);
    const html = renderToStaticMarkup(
      <MerchantPanelView merchant={merchant} party={[heroAuStatutLePlusHaut()]} money={{ gold: 0, silver: 0, brass: 0 }} initialBuyView="cart" {...noop} />,
    );
    expect(payer(html)).toEqual({ present: true, refuse: true });
    expect(html).toContain('2 CO');
  });
});

describe('#3059 — MerchantPanel affiche la remise d’achat du noyau', () => {
  it('Marchandage gagné : le panier dit la remise de `bargainPct` (LDB 59 l.43)', () => {
    const bargainBuy = { won: true, drNet: 6, negotiator: false };
    const html = renderToStaticMarkup(
      <MerchantPanelView merchant={{ ...merchant, bargainBuy }} party={[heroAuStatutLePlusHaut()]} money={{ gold: 50, silver: 0, brass: 0 }} initialBuyView="cart" {...noop} />,
    );
    // Gagné de 6 DR (Succès Stupéfiant) sans Négociateur : 10 + 10 points (LDB 59 l.43).
    expect(html).toContain('marchandé −20 %');
  });
});

describe('#3059 — « Un de plus » se juge contre la bourse que le panier entame', () => {
  it('3 CO en bourse, une hallebarde (2 CO) au panier : la seconde est refusée', () => {
    setRule('market-tenir-comptes', false);
    const html = renderToStaticMarkup(
      <MerchantPanelView merchant={merchant} party={[heroAuStatutLePlusHaut()]} money={{ gold: 3, silver: 0, brass: 0 }} initialBuyView="cart" {...noop} />,
    );
    expect(html).toContain('Bourse insuffisante pour Hallebarde.');
  });
});
