import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MerchantPanelView } from './MerchantPanel';
import type { Combatant, ItemInstance } from '../engine/types';

const noop = {
  onAddToCart: () => {}, onDecCart: () => {}, onRemoveCart: () => {}, onClearCart: () => {}, onRefuse: () => {}, onPay: () => {},
  onAssignDist: () => {}, onConfirmDist: () => {}, onRepair: () => {}, onBargain: () => {},
  onAppraise: () => {}, onClose: () => {},
  onAddToSellCart: () => {}, onRemoveSellCart: () => {}, onClearSellCart: () => {}, onConfirmSell: () => {},
};
const base = { entityId: 'p', archetype: 'armurier', settlement: 'ville' as const, resaleRate: 0.5, stock: [] as { id: string; qty: number }[], cart: [] as { id: string; qty: number }[], bargainLocked: false };

/** Stub de héros : le marchand compare l'équipement et rend des tuiles-portraits (CharFrame), qui
 *  lisent wounds/conditions. */
const stubHero = (id: string, label: string, items: ItemInstance[] = []) =>
  ({
    id, label, kind: 'hero', wounds: { current: 10, max: 12 }, conditions: [], advantage: 0,
    weapons: [], skills: [], items, movement: 4,
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
  }) as unknown as Combatant;

describe('MerchantPanel (#2 — panier)', () => {
  // #1318 E1 : le champ de quantité du Troc passe par `NumberField` — la borne n'est plus rejouée à la
  // main au site, elle est DÉCLARÉE, et ce qu'elle déclare doit rester le domaine réel (le stock).
  it('Troc : la borne du champ « Quantité acquise » est le STOCK du marchand, plancher 1', () => {
    const porteur = stubHero('h', 'H', [{ uid: 'u1', trappingId: 'hallebarde' } as unknown as ItemInstance]);
    const html = renderToStaticMarkup(
      <MerchantPanelView
        merchant={{ ...base, stock: [{ id: 'epee', qty: 3 }] }}
        party={[porteur]}
        money={{ gold: 5, silver: 0, brass: 0 }}
        initialTab="barter"
        onBarter={() => {}}
        {...noop}
      />,
    );
    const champ = [...html.matchAll(/<input[^>]*type="number"[^>]*>/g)].map((m) => m[0])
      .find((t) => t.includes('aria-label="Quantité acquise"'));
    expect(champ, 'aucun champ de quantité au Troc').toBeTruthy();
    expect(champ).toContain('min="1"');
    expect(champ).toContain('max="3"');
  });

  it('Parcourir : tableau par famille + bouton « Ajouter » + barre panier', () => {
    const party = [{ id: 'h', label: 'H', items: [] } as unknown as Combatant];
    const html = renderToStaticMarkup(
      <MerchantPanelView merchant={{ ...base, stock: [{ id: 'hallebarde', qty: 2 }] }} party={party} money={{ gold: 5, silver: 0, brass: 0 }} {...noop} />,
    );
    expect(html).toContain('Armes de mêlée');
    expect(html).toContain('Hallebarde');
    expect(html).toContain('2 CO'); // prix canon
    expect(html).toMatch(/Ajouter/); // ajoute au panier (plus de « Acheter » direct)
    expect(html).toContain('Panier vide');
    expect(html).toContain('Bourse');
  });

  it('grise « Ajouter » si on ne peut pas payer une seule unité', () => {
    const party = [{ id: 'h', label: 'H', items: [] } as unknown as Combatant];
    const html = renderToStaticMarkup(
      <MerchantPanelView merchant={{ ...base, stock: [{ id: 'hallebarde', qty: 1 }] }} party={party} money={{ gold: 1, silver: 0, brass: 0 }} {...noop} />,
    );
    expect(html).toContain('unaffordable');
    expect(html).toMatch(/disabled/);
  });

  it('fiche de détail (clic sur le nom) : stats + Atouts/Défauts, sans bouton d’équipement', () => {
    const party = [stubHero('h', 'Hans')];
    const html = renderToStaticMarkup(
      <MerchantPanelView merchant={{ ...base, stock: [{ id: 'hallebarde', qty: 1 }] }} party={party} money={{ gold: 5, silver: 0, brass: 0 }} {...noop} initialDetails="hallebarde" />,
    );
    expect(html).toContain('merch-compare');
    expect(html).toContain('Dégâts'); // colonne / comparaison
    expect(html).toContain('entity-chip'); // le NOM de qualité = chip canonique (EntityRef)
    expect(html).toContain('Empaleuse'); // Atout listé (dans le chip)
    expect(html).toMatch(/Critique/); // … avec sa description canon (sous le chip)
    expect(html).toContain('Fermer');
    expect(html).not.toMatch(/Équiper/); // plus d'équipement depuis le marchand
  });

  it('Panier : lignes, total marchandable, bouton Payer', () => {
    const party = [{ id: 'h', label: 'H', items: [] } as unknown as Combatant];
    const html = renderToStaticMarkup(
      <MerchantPanelView merchant={{ ...base, stock: [{ id: 'hallebarde', qty: 3 }], cart: [{ id: 'hallebarde', qty: 2 }] }} party={party} money={{ gold: 9, silver: 0, brass: 0 }} {...noop} initialBuyView="cart" />,
    );
    expect(html).toContain('Hallebarde');
    expect(html).toMatch(/Marchander le panier/); // négociation claire sur le panier
    expect(html).toContain('Total'); // total affiché
    expect(html).toContain('4 CO'); // 2 × Hallebarde (2 CO)
    expect(html).toMatch(/Payer/);
  });

  it('Répartition (après paiement) : un menu héros par objet + Confirmer', () => {
    const party = [stubHero('h1', 'Anna'), stubHero('h2', 'Bruno')];
    const bought = { uid: 'b1', label: 'Hallebarde', kind: 'melee', qualities: [], enc: 3, equipped: false } as ItemInstance;
    const html = renderToStaticMarkup(
      <MerchantPanelView merchant={{ ...base, pendingDistribution: [{ item: bought, heroId: 'h1' }] }} party={party} money={{ gold: 5, silver: 0, brass: 0 }} {...noop} />,
    );
    expect(html).toContain('Répartition');
    expect(html).toContain('qui récupère / possède quoi');
    expect(html).toContain('Anna');
    expect(html).toContain('Bruno'); // tuile de l'autre héros (nom en title/aria-label)
    expect(html).toMatch(/Confirmer la répartition/);
  });

  it('panier négocié : retirer OK, plus ajouter/renégocier, « Refuser le marché » remplace Vider, « Continuer » désactivé', () => {
    const party = [{ id: 'h', label: 'H', items: [] } as unknown as Combatant];
    const html = renderToStaticMarkup(
      <MerchantPanelView merchant={{ ...base, stock: [{ id: 'hallebarde', qty: 3 }], cart: [{ id: 'hallebarde', qty: 1 }], bargainBuy: { won: true, drNet: 2, negotiator: false } }} party={party} money={{ gold: 9, silver: 0, brass: 0 }} {...noop} initialBuyView="cart" />,
    );
    expect(html).toContain('Prix arrêté'); // note de marché scellé (texte condensé, détail en title)
    expect(html).not.toMatch(/Marchander le panier/); // plus de renégociation
    expect(html).toContain('Refuser le marché'); // remplace « Vider »
    expect(html).not.toContain('Vider le panier');
    expect(html).toContain('Marché négocié : réglez ou refusez le marché'); // titre du « Continuer les achats » désactivé
  });

  it('Marchandage verrouillé jusqu’au réassort (négocié puis quitté sans payer)', () => {
    const party = [{ id: 'h', label: 'H', items: [] } as unknown as Combatant];
    const html = renderToStaticMarkup(
      <MerchantPanelView merchant={{ ...base, stock: [{ id: 'hallebarde', qty: 1 }], cart: [{ id: 'hallebarde', qty: 1 }], bargainLocked: true }} party={party} money={{ gold: 9, silver: 0, brass: 0 }} {...noop} initialBuyView="cart" />,
    );
    expect(html).toContain('Marchandage indisponible');
    expect(html).not.toMatch(/Marchander le panier/);
  });

  it('bande d’ambiance : rendue quand le service porte un backdrop (forgeron → forge), absente sinon (#381)', () => {
    const party = [{ id: 'h', label: 'H', items: [] } as unknown as Combatant];
    const withBd = renderToStaticMarkup(
      <MerchantPanelView merchant={{ ...base, backdrop: 'forge' }} party={party} money={{ gold: 5, silver: 0, brass: 0 }} {...noop} />,
    );
    expect(withBd).toContain('scene-backdrop'); // slot backdrop de ScreenShell rempli par le registre
    expect(withBd).not.toContain('scene-backdrop-fallback'); // id connu → décor, pas le repli
    const withoutBd = renderToStaticMarkup(
      <MerchantPanelView merchant={base} party={party} money={{ gold: 5, silver: 0, brass: 0 }} {...noop} />,
    );
    expect(withoutBd).not.toContain('scene-backdrop'); // pas de backdrop → slot absent (aucune régression)
  });

  it('onglet Vendre / Réparer + Marchandage par onglet (#2c/#2d)', () => {
    const party = [stubHero('h', 'H', [
      { uid: 'x', trappingId: 'dague', label: 'Dague', kind: 'melee', qualities: [], enc: 0, equipped: false },
      { uid: 'a', trappingId: 'chemise-de-mailles', label: 'Chemise de mailles', kind: 'armor', pa: 3, damageTaken: 2, qualities: [], enc: 1, equipped: true },
    ] as ItemInstance[])];
    const sell = renderToStaticMarkup(<MerchantPanelView merchant={base} party={party} money={{ gold: 1, silver: 0, brass: 0 }} {...noop} initialTab="sell" />);
    expect(sell).toContain('Dague');
    expect(sell).toMatch(/Marchander la vente/);
    const repair = renderToStaticMarkup(<MerchantPanelView merchant={base} party={party} money={{ gold: 1, silver: 0, brass: 0 }} {...noop} initialTab="repair" />);
    expect(repair).toContain('Chemise de mailles');
    expect(repair).toMatch(/Réparer/);
    // marchand méfiant : plus de marchandage dans le panier
    const soured = renderToStaticMarkup(<MerchantPanelView merchant={{ ...base, soured: true, cart: [{ id: 'hallebarde', qty: 1 }] }} party={party} money={{ gold: 5, silver: 0, brass: 0 }} {...noop} initialBuyView="cart" />);
    expect(soured).toContain('méfiant');
  });
});

describe('MerchantPanel — verdicts du Marchandage (LDB 59 l.43/l.54, LDB 10 l.818 ; arbitrage #2547)', () => {
  const party = [stubHero('h', 'H')];
  const rendu = (merchant: typeof base & Record<string, unknown>, initialTab?: 'sell') =>
    renderToStaticMarkup(<MerchantPanelView merchant={merchant} party={party} money={{ gold: 5, silver: 0, brass: 0 }} {...noop} initialTab={initialTab} />);
  it('vente gagnée par un Négociateur : le verdict dit la hausse, comme la popin', () => {
    expect(rendu({ ...base, bargainSell: { won: true, drNet: 1, negotiator: true } }, 'sell')).toContain('Gagné (½ du prix listé, +10 %)');
    expect(rendu({ ...base, bargainSell: { won: true, drNet: 6, negotiator: true } }, 'sell')).toContain('Gagné (½ du prix listé, +20 %)');
    expect(rendu({ ...base, bargainSell: { won: false, drNet: 1, negotiator: true } }, 'sell')).toContain('Perdu (¼ du prix listé)');
  });
  it('achat gagné, Stupéfiant + Négociateur : prix réduits de 30 %', () => {
    const html = renderToStaticMarkup(<MerchantPanelView merchant={{ ...base, cart: [{ id: 'hallebarde', qty: 1 }], bargainBuy: { won: true, drNet: 6, negotiator: true } }} party={party} money={{ gold: 5, silver: 0, brass: 0 }} {...noop} initialBuyView="cart" />);
    expect(html.replace(/<!-- -->/g, '')).toContain('Prix réduits de 30 %');
  });
});

describe('MerchantPanel — « Évaluer » à la vente suit qui peut tenter le Test (LDB 09 l.30)', () => {
  const inconnu = { uid: 'x', trappingId: 'dague', label: 'Dague', kind: 'melee', qualities: [], enc: 0, equipped: false, identified: false } as unknown as ItemInstance;
  const vente = (h: Combatant) => renderToStaticMarkup(<MerchantPanelView merchant={base} party={[h]} money={{ gold: 1, silver: 0, brass: 0 }} {...noop} initialTab="sell" />);
  const evaluer = (html: string) => new RegExp('<button[^>]*>Évaluer</button>').exec(html)?.[0] ?? '';

  it('un vendeur avec une Augmentation en Évaluation : le geste est offert', () => {
    const h = { ...stubHero('h', 'H', [inconnu]), skills: [{ id: 'evaluation', characteristic: 'intelligence', advances: 5 }] } as Combatant;
    const html = vente(h);
    expect(evaluer(html), 'le bouton est rendu').toBeTruthy();
    expect(evaluer(html)).not.toContain('aria-disabled');
  });

  it('personne qui l’ait : le geste est fermé, sa raison NOMMÉE', () => {
    const html = vente(stubHero('h', 'H', [inconnu]));
    expect(evaluer(html)).toContain('aria-disabled="true"');
    expect(html).toContain('Personne dans le groupe ne peut tenter le Test d’Évaluation.');
  });
});
