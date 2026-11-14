/**
 * Prix d'achat jugé par le NOYAU (#3059, lot marchand) : le geste `marchand.payer` débite le total de
 * `devisDuPanier`, que l'écran du marchand affiche. Sous « Tenir les comptes », une ligne au prix listé
 * ≤ Statut du groupe coûte 0 au débit ET au devis. La réparation débite `coutDeReparation`, le Troc
 * refusé dit le refus de `devisDeTroc`. LDB 59 l.9-11 ; LDB 59 l.43 ; LDB 59 l.64-76 ; LDB 62 l.135.
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { describe, it, expect } from 'vitest';
import { creerPartie, etatInitialDuJeu, type EntreesDeLaPartie, type Partie } from './index';
import { tousLesHerosDeScenario } from '../scenes/test-scenarios/_heros';
import { statutLePlusHaut } from '../engine/statut.testkit';
import { emptyScene } from './monde/scene';
import { toBrass, priceToMoney, add as moneyAdd, fromBrass } from '../engine/money';
import { bourseOf, withBourseMoney } from '../engine/bourse';
import type { ItemInstance } from '../engine/types';
import { itemFromTrappingById } from '../engine/items';
import { t } from '../i18n';
import { choixDuTroc } from './marchand.testkit';
import { catalogEntryOf, devisDuPanier, prixDeLigne, coutDeReparation, devisDeTroc, devisDeVente, sellGain } from './merchantFlow';

const bourseDuGroupe = (p: Partie) => toBrass(p.etat().party.reduce((s, h) => moneyAdd(s, bourseOf(h)), fromBrass(0)));

/** Ouvre l'armurier pour un groupe au Statut le plus haut, bourse de 50 CO, règle `marche-tenir-comptes` posée. L'échoppe
 *  s'ouvre par le geste d'une partie locale (`jouerAction` est `hôte`) ; en `mode` invité, la partie reprend cet état. */
function ouvrir(tenirComptes: boolean, objets: ItemInstance[] = [], mode: 'local' | 'invite' = 'local'): { partie: Partie; budget: number } {
  const { career, careerLevel, budget } = statutLePlusHaut();
  const scene = { ...emptyScene('marche', 4, 4), id: 'marche' };
  scene.entities.push({ id: 'pnj', kind: 'personnage', creature: { id: 'humain' }, pos: { x: 0, y: 0 }, merchant: { archetype: { id: 'armurier' }, buyMarkup: MAJORATION } } as never);
  const entrees: EntreesDeLaPartie = { graine: 4, reglesMaison: { 'marche-tenir-comptes': tenirComptes }, cadence: 'manuel', desFixes: false, persisterLeHeros: () => {} };
  const partie = creerPartie({
    ...etatInitialDuJeu(),
    party: tousLesHerosDeScenario(idsDeTest).slice(0, 1).map((h) => withBourseMoney({ ...h, career, careerLevel, items: [...(h.items ?? []), ...objets] }, { gold: 50, silver: 0, brass: 0 }, idsDeTest)),
    scene,
  }, entrees);
  partie.envoyer({ type: 'jouerAction', args: ['pnj', 'commercer'] });
  if (mode === 'local') return { partie, budget };
  const ouverte = partie.etat();
  partie.fermer();
  return { partie: creerPartie({ ...ouverte, net: { ...ouverte.net, mode } }, entrees), budget };
}

/** Majoration d'achat posée sur le marchand de la fixture (`SceneEntity.merchant.buyMarkup`). */
const MAJORATION = 1.5;

/** Ligne de stock au prix catalogue chiffré ≤ `budget` (sous). */
function ligneDansLeStatut(partie: Partie, budget: number): string {
  // Ligne sans qualité d'artisanat (facteur de prix 1) : son prix est exactement le catalogue.
  const ligne = partie.etat().merchant!.stock.find((l) => {
    const entree = catalogEntryOf(l.id);
    const prix = toBrass(priceToMoney(entree?.price ?? null));
    return l.qty > 0 && prix > 0 && prix <= budget && !(entree?.qualities ?? []).length;
  });
  expect(ligne, 'stock sans ligne dans les moyens du Statut').toBeTruthy();
  return ligne!.id;
}

/** Ajoute `id` au panier puis paie par les gestes du noyau ; rend le devis vu avant paiement et le débit. */
function acheter(partie: Partie, id: string): { devis: ReturnType<typeof devisDuPanier>; unitaire: ReturnType<typeof prixDeLigne>; debit: number } {
  partie.envoyer({ type: 'fenetreChoisir', args: ['marchand', 'ajouterAuPanier', id] });
  const s = partie.etat();
  const ent = s.scene!.entities.find((e) => e.id === 'pnj');
  const devis = devisDuPanier(s.merchant!, { ent, party: s.party, bourse: s.party.reduce((acc, h) => moneyAdd(acc, bourseOf(h)), fromBrass(0)), refusHote: null });
  const unitaire = prixDeLigne(s.merchant!, id, ent, s.party);
  const avant = bourseDuGroupe(partie);
  partie.envoyer({ type: 'fenetreChoisir', args: ['marchand', 'payer', true] });
  return { devis, unitaire, debit: avant - bourseDuGroupe(partie) };
}

describe('#3059 — prix d’achat : une seule fonction pour l’écran et le débit', () => {
  it('Tenir les comptes : la ligne dans les moyens du Statut coûte 0 au devis comme au débit', () => {
    const { partie, budget } = ouvrir(true);
    try {
      const id = ligneDansLeStatut(partie, budget);
      const { devis, unitaire, debit } = acheter(partie, id);
      expect(toBrass(unitaire!)).toBe(0);
      expect(toBrass(devis.total)).toBe(0);
      expect(devis.refus).toBeNull();
      expect(debit).toBe(0);
      expect(partie.etat().merchant!.pendingDistribution?.length, 'le paiement a eu lieu').toBe(1);
    } finally {
      partie.fermer();
    }
  });

  it('option désactivée : le débit est le prix catalogue × la majoration du marchand (1,5)', () => {
    const { partie, budget } = ouvrir(false);
    try {
      const id = ligneDansLeStatut(partie, budget);
      const catalogue = toBrass(priceToMoney(catalogEntryOf(id)!.price));
      const { devis, debit } = acheter(partie, id);
      expect(devis.refus).toBeNull();
      expect(debit).toBe(Math.round(catalogue * 1.5));
    } finally {
      partie.fermer();
    }
  });
});

describe('#3059 — réparation et Troc : le geste lit la fonction de l’écran', () => {
  it('réparation : le débit est `coutDeReparation` de l’objet endommagé', () => {
    const hallebarde = { ...itemFromTrappingById('hallebarde', idsDeTest)!, uid: 'abimee', damageTaken: 2, equipped: false };
    const { partie } = ouvrir(false, [hallebarde]);
    try {
      const heros = partie.etat().party[0];
      const abimee = heros.items!.find((i) => i.uid === 'abimee')!;
      // LDB 62 l.135 : 10 % du coût de l'arme par point de Dégâts — hallebarde 2 CO = 480 sous, 2 Dégâts → 96 sous.
      const cout = 96;
      expect(toBrass(coutDeReparation(abimee))).toBe(cout);
      const avant = bourseDuGroupe(partie);
      partie.envoyer({ type: 'fenetreChoisir', args: ['marchand', 'reparer', 'abimee'] });
      expect(avant - bourseDuGroupe(partie)).toBe(cout);
      expect(partie.etat().party[0].items!.find((i) => i.uid === 'abimee')!.damageTaken).toBe(0);
    } finally {
      partie.fermer();
    }
  });

  it('Troc d’une hallebarde contre de la corde, une seule corde à céder : « il faut 5 × Corde », rien ne bouge', () => {
    // Étal fixé : 3 hallebardes. LDB 59 l.66-76 : Commune contre Commune, 1:1, lots de valeur équivalente —
    // hallebarde 2 CO = 480 sous, corde 8 PA 4 s = 100 sous → ⌈480 / 100⌉ = 5 cordes.
    const { partie: ouverte } = ouvrir(false);
    const base = ouverte.etat();
    const corde = { ...itemFromTrappingById('corde', idsDeTest)!, uid: 'corde', equipped: false };
    const party = base.party.map((h, i) => (i === 0 ? { ...h, items: [...(h.items ?? []), corde] } : h));
    const etat = { ...base, party, merchant: { ...base.merchant!, stock: [{ id: 'hallebarde', qty: 3 }], cart: [] } };
    ouverte.fermer();
    const partie = creerPartie(etat, { graine: 4, reglesMaison: {}, cadence: 'manuel', desFixes: false, persisterLeHeros: () => {} });
    try {
      const demande = { giveHeroId: etat.party[0].id, giveTrappingId: 'corde', getStockId: 'hallebarde', getCount: 1 };
      const texte = 'Troc : il faut 5 × Corde à céder (1 disponible(s)).';
      expect(devisDeTroc(etat.merchant, etat.party, demande).refus).toBe(texte);
      for (const args of choixDuTroc(etat, demande)) partie.envoyer({ type: 'fenetreChoisir', args });
      expect(partie.etat().merchant!.stock).toEqual([{ id: 'hallebarde', qty: 3 }]);
      expect(partie.etat().journal.some((l) => l.includes(texte))).toBe(true);
    } finally {
      partie.fermer();
    }
  });

});

describe('#3059 — vente au panier : le crédit est le total du devis de l’écran', () => {
  it('deux objets au panier de vente : crédit = `devisDeVente(...).total` = somme des `sellGain`', () => {
    const a = { ...itemFromTrappingById('hallebarde', idsDeTest)!, uid: 'v1', equipped: false };
    const b = { ...itemFromTrappingById('hallebarde', idsDeTest)!, uid: 'v2', equipped: false };
    const { partie } = ouvrir(false, [a, b]);
    try {
      partie.envoyer({ type: 'fenetreChoisir', args: ['marchand', 'ajouterALaVente', 'v1'] });
      partie.envoyer({ type: 'fenetreChoisir', args: ['marchand', 'ajouterALaVente', 'v2'] });
      const s = partie.etat();
      const devis = devisDeVente(s.merchant!, s.party);
      const somme = s.party[0].items!.filter((i) => i.uid === 'v1' || i.uid === 'v2').reduce((n, i) => n + toBrass(sellGain(i, s.merchant!)), 0);
      expect(toBrass(devis.total)).toBe(somme);
      expect(somme).toBeGreaterThan(0);
      const avant = bourseDuGroupe(partie);
      partie.envoyer({ type: 'fenetreChoisir', args: ['marchand', 'vendre', true] });
      expect(bourseDuGroupe(partie) - avant).toBe(toBrass(devis.total));
    } finally {
      partie.fermer();
    }
  });
});


describe('#3059 — siège invité : l’invité compose le panier, l’encaissement est à l’hôte', () => {
  it('ajout au panier ouvert ; paiement, réparation, vente et Troc refusés, sans écriture', () => {
    const abimee = { ...itemFromTrappingById('hallebarde', idsDeTest)!, uid: 'abimee', damageTaken: 2, equipped: false };
    const avendre = { ...itemFromTrappingById('hallebarde', idsDeTest)!, uid: 'avendre', equipped: false };
    const { partie } = ouvrir(false, [abimee, avendre], 'invite');
    try {
      const s = partie.etat();
      // Ligne que la bourse de 50 CO couvre, majoration 1,5 comprise.
      const ligne = s.merchant!.stock.find((l) => {
        const prix = toBrass(priceToMoney(catalogEntryOf(l.id)?.price ?? null));
        return l.qty > 0 && prix > 0 && prix * MAJORATION <= 50 * 240 && !(catalogEntryOf(l.id)?.qualities ?? []).length;
      })!;
      partie.envoyer({ type: 'fenetreChoisir', args: ['marchand', 'ajouterAuPanier', ligne.id] });
      expect(partie.etat().merchant!.cart).toEqual([{ id: ligne.id, qty: 1 }]);
      partie.envoyer({ type: 'fenetreChoisir', args: ['marchand', 'payer', true] });
      partie.envoyer({ type: 'fenetreChoisir', args: ['marchand', 'reparer', 'abimee'] });
      partie.envoyer({ type: 'fenetreChoisir', args: ['marchand', 'ajouterALaVente', 'avendre'] });
      partie.envoyer({ type: 'fenetreChoisir', args: ['marchand', 'vendre', true] });
      partie.envoyer({ type: 'fenetreChoisir', args: ['marchand', 'troquer', true] });
      const apres = partie.etat();
      expect(apres.merchant!.cart).toEqual([{ id: ligne.id, qty: 1 }]);
      expect(apres.merchant!.pendingDistribution ?? null).toBeNull();
      expect(apres.party[0].items!.find((i) => i.uid === 'abimee')!.damageTaken).toBe(2);
      expect(apres.party[0].items!.some((i) => i.uid === 'avendre')).toBe(true);
      expect(apres.merchant!.stock.find((l) => l.id === ligne.id)!.qty).toBe(ligne.qty);
      expect(apres.journal.filter((l) => l.includes(t('choix.refus.hoteSeul'))).length).toBe(4);
    } finally {
      partie.fermer();
    }
  });
});
