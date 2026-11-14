import { describe, it, expect } from 'vitest';
import {
  manannBase, applyManannFactor, addManann, rollPortEvent, rollDaysToNextEvent,
  rollRandomCargo, cargoBasePrice, rollCargoAvailability, rollMerchantSkill, buySellerDR,
  sellRelation, sellChance, offerPricePct, dumpingPricePct, opportunityTradePct,
  cargoTotalEnc, removeCargo, resolveFastVoyage, profilDuMarche, alterationsDuPort, type PortProfile, type AlterationDuMarche,
} from './seaVoyage';
import type { RNG } from './dice';
import { desDuTest, desEnSuite } from './dice.testkit';

const seq = (...vals: number[]): RNG => desEnSuite(vals, { boucle: true, borne: true });

const salzenmund: PortProfile = {
  taille: 4, richesse: 4,
  production: ['bois-mer', 'commerce-mer'],
  surplus: { 'produits-de-luxe-mer': 1 },
  demande: { armes: 1, cereales: 1 },
};

describe('Humeur de Manann (MDG 15 l.83-125)', () => {
  it('chaque facteur ne s’applique qu’UNE fois par navire (l.85)', () => {
    // Grand sacrifice : +5+2d10 → dés 3 et 4 → +12.
    const a = applyManannFactor(manannBase(), 'grand-sacrifice', seq(3, 4));
    expect(a.delta).toBe(12);
    expect(a.mood.score).toBe(12);
    const b = applyManannFactor(a.mood, 'grand-sacrifice', seq(10, 10));
    expect(b.delta).toBe(0); // déjà appliqué — « les sacrifices ne sont pas cumulatifs »
    expect(b.mood.score).toBe(12);
  });

  it('facteurs négatifs : Invoquer les Puissances de la Ruine ou Stromfels = −5d10', () => {
    const a = applyManannFactor(manannBase(), 'invoquer-ruine-ou-stromfels', seq(2, 2, 2, 2, 2));
    expect(a.delta).toBe(-10);
    expect(addManann(a.mood, 7).score).toBe(-3); // delta libre d'événement
  });
});

describe('événements de bord & de port (MDG 15 l.89 + l.127-129)', () => {
  it('le délai du prochain événement de bord est un d10 (l.89)', () => {
    expect(rollDaysToNextEvent(seq(7))).toBe(7);
  });

  it('port : 2d10 ±1 selon le signe de l’Humeur ; l’événement survient dans les 2d10 heures', () => {
    const e = rollPortEvent(-10, seq(5, 5, 3, 4)); // 5+5−1 = 9 → « Pas d'événement » (9-12)
    expect(e.roll).toBe(9);
    expect(e.event.id).toBe('pas-d-evenement');
    expect(e.hours).toBe(7);
    const f = rollPortEvent(15, seq(10, 10, 1, 1)); // 10+10+1 = 21 → Saturation
    expect(f.roll).toBe(21);
    expect(f.event.id).toBe('saturation-de-produits');
  });
});

describe('longs voyages très rapides (MDG 15 l.21-37)', () => {
  it('d10 seul → le palier suit la table (6-9 = sans encombre, ≥10 = parfait)', () => {
    expect(resolveFastVoyage(0, 0, 0, seq(7)).palier.id).toBe('sans-encombre'); // 7 ∈ [6,9]
    expect(resolveFastVoyage(0, 0, 0, seq(10)).palier.id).toBe('parfait'); // 10 ∈ [10,+]
    expect(resolveFastVoyage(0, 0, 0, seq(4)).palier.id).toBe('difficile'); // 4 ∈ [3,5]
  });

  it('−1 par semaine en mer (l.28) : deux semaines abaissent un d10 de 1 à −1 → désastreux', () => {
    const r = resolveFastVoyage(0, 0, 2, seq(1)); // 1 − 2 semaines = −1
    expect(r.result).toBe(-1);
    expect(r.palier.id).toBe('desastreux'); // ≤ 0
  });

  it('dizaine SIGNÉE de l’Humeur de Manann (l.26) : +30 → +3, −23 → −2', () => {
    expect(resolveFastVoyage(0, 30, 0, seq(7)).manannTens).toBe(3);
    expect(resolveFastVoyage(0, 30, 0, seq(7)).result).toBe(10); // 7 + 3 → parfait
    expect(resolveFastVoyage(0, 30, 0, seq(7)).palier.id).toBe('parfait');
    expect(resolveFastVoyage(0, -23, 0, seq(5)).manannTens).toBe(-2);
    expect(resolveFastVoyage(0, -23, 0, seq(5)).result).toBe(3); // 5 − 2 → difficile
  });

  it('les DR du Test de Rude épreuve s’ajoutent (l.28) : +5 DR remonte un d10 raté', () => {
    expect(resolveFastVoyage(5, 0, 0, seq(1)).result).toBe(6); // 1 + 5 DR → sans encombre
    expect(resolveFastVoyage(5, 0, 0, seq(1)).palier.id).toBe('sans-encombre');
    expect(resolveFastVoyage(-4, 0, 0, seq(5)).result).toBe(1); // 5 − 4 DR → éreintant [1,2]
    expect(resolveFastVoyage(-4, 0, 0, seq(5)).palier.id).toBe('ereintant');
  });
});

describe('marché d’un port altéré (MDG 15 l.253, l.259, l.263)', () => {
  const alteration = (a: Partial<AlterationDuMarche>): AlterationDuMarche => ({ placeId: 'P', jusqua: 'escale', ...a } as AlterationDuMarche);

  it('Pénuries : la Production n’est plus disponible, le Surplus passe en Production, les marqueurs restent (l.253)', () => {
    const p = profilDuMarche(salzenmund, [alteration({ colonnes: 'penurie' })]);
    expect(p.production).toEqual(['commerce-mer', 'produits-de-luxe-mer']);
    expect(p.surplus).toEqual({});
    expect(p.demande).toEqual(salzenmund.demande);
  });

  it('Saturation : la Production passe en Surplus à +1, le Surplus double (l.263)', () => {
    const p = profilDuMarche({ ...salzenmund, surplus: { 'produits-de-luxe-mer': 2 } }, [alteration({ colonnes: 'saturation' })]);
    expect(p.production).toEqual(['commerce-mer']);
    expect(p.surplus).toEqual({ 'bois-mer': 1, 'produits-de-luxe-mer': 4 });
  });

  it('Rumeurs commerciales : la Demande de la cargaison croît, absente elle naît (l.259)', () => {
    const p = profilDuMarche(salzenmund, [alteration({ demande: { cargoId: 'armes', delta: 2 } }), alteration({ demande: { cargoId: 'sel', delta: 2 } })]);
    expect(p.demande).toEqual({ armes: 3, cereales: 1, sel: 2 });
    expect(sellChance(p, 'sel', 0).cible).toBeGreaterThan(sellChance(salzenmund, 'sel', 0).cible);
  });

  it('seules les altérations du port et encore actives comptent', () => {
    const liste = [alteration({ colonnes: 'penurie' }), alteration({ placeId: 'Q', colonnes: 'saturation' }), alteration({ jusqua: 100, demande: { cargoId: 'sel', delta: 2 } })];
    expect(alterationsDuPort(liste, 'P', 99)).toHaveLength(2);
    expect(alterationsDuPort(liste, 'P', 100)).toEqual([liste[0]]);
  });
});

describe('commerce maritime (MDG 15 l.309-436)', () => {
  it('cargaison aléatoire par SAISON (l.402-418) : d100 50 → Laine au printemps, Vin en été', () => {
    expect(rollRandomCargo('printemps', seq(50)).id).toBe('laine-mer');
    expect(rollRandomCargo('ete', seq(50)).id).toBe('vin');
  });

  it('prix de base par saison ; le Vin roule 3d10 CO (l.429/436)', () => {
    const ble = rollRandomCargo('printemps', seq(3));
    expect(ble.id).toBe('cereales');
    expect(cargoBasePrice(ble, 'printemps', desDuTest)).toBe(2);
    expect(cargoBasePrice(ble, 'automne', desDuTest)).toBe(0.5);
    const vin = rollRandomCargo('ete', seq(50));
    expect(cargoBasePrice(vin, 'ete', seq(4, 5, 6))).toBe(15);
  });

  it('disponibilité (l.323-331) : (Taille + Richesse + Surplus) × 1d10 × 10 ; d10 = 1 → rien — exemple Salzenmund l.329-331', () => {
    expect(rollCargoAvailability(salzenmund, 'bois-mer', seq(4)).enc).toBe(320); // (4+4) × 40
    expect(rollCargoAvailability(salzenmund, 'produits-de-luxe-mer', seq(4)).enc).toBe(360); // (4+4+1) × 40
    expect(rollCargoAvailability(salzenmund, 'bois-mer', seq(1)).enc).toBe(0);
  });

  it('marchand : 3d10+40, Négociateur sur deux 10 ; Marienburg/Lothern 3d10+55, un seul 10 suffit (l.337/349)', () => {
    expect(rollMerchantSkill(false, seq(10, 10, 2))).toEqual({ value: 62, negotiator: true });
    expect(rollMerchantSkill(false, seq(10, 3, 2))).toEqual({ value: 55, negotiator: false });
    expect(rollMerchantSkill(true, seq(10, 3, 2))).toEqual({ value: 70, negotiator: true });
  });

  it('+DR du vendeur à l’achat : lot partiel +1, Surplus +1 (l.339-341)', () => {
    expect(buySellerDR(true, true)).toBe(2);
    expect(buySellerDR(false, false)).toBe(0);
  });

  it('vente (l.355-397) : relation du port au bien → nombre visé + DR du vendeur', () => {
    // Salzenmund a « commerce » en Production → toujours 'sansProduction' ; armes en Demande +1.
    expect(sellRelation(salzenmund, 'bois-mer')).toBe('sansProduction');
    const armes = sellChance(salzenmund, 'armes', 500);
    expect(armes.ragot).toBeNull();
    expect(armes.cible).toBe(80); // (4 + 1) × 10 + 30 (commerce)
    expect(armes.drDuVendeur).toBe(2); // +1 sansProduction/commerce, +1 Demande
    // Port producteur SANS commerce : Ragot Complexe, Taille × 10 ; à moins de 100 milles → traité en Surplus.
    const producer: PortProfile = { taille: 3, richesse: 3, production: ['poisson-sale'] };
    const far = sellChance(producer, 'poisson-sale', 500);
    expect(far.ragot?.difficulty).toBe('complexe');
    expect(far.cible).toBe(30);
    expect(far.drDuVendeur).toBe(-2);
    const near = sellChance(producer, 'poisson-sale', 50);
    expect(near.ragot?.difficulty).toBe('tresDifficile'); // l.368 : « comme … un Surplus »
    expect(near.cible).toBe(15);
    expect(near.drDuVendeur).toBe(-3);
  });

  it('prix d’offre (l.374-383) : Richesse+Taille+Demande ≥ 4 → 100 % ; 2 → 75 % ; brader = 25 % (l.399)', () => {
    expect(offerPricePct(salzenmund, 'armes')).toBe(100);
    const hamlet: PortProfile = { taille: 1, richesse: 1, production: [] };
    expect(offerPricePct(hamlet, 'bois-mer')).toBe(75);
    expect(dumpingPricePct(salzenmund, 'laine-mer')).toBe(25); // « commerce » en Production
    expect(dumpingPricePct(hamlet, 'laine-mer')).toBeNull();
  });

  it('commerce d’opportunité (l.276-286) : échec de 6 DR → 0 % ; échec → 50 % ; succès → 110 % ; +6 DR → 120 %', () => {
    expect(opportunityTradePct(4)).toBe(0);
    expect(opportunityTradePct(7)).toBe(50);
    expect(opportunityTradePct(12)).toBe(110);
    expect(opportunityTradePct(16)).toBe(120);
  });

  it('cargaison embarquée : total d’Enc, retrait par lots (avaries d’événement)', () => {
    const lots = [{ uid: 'lot-1', cargoId: 'bois-mer', enc: 100, basePriceGold: 1.5 }, { uid: 'lot-2', cargoId: 'bois-mer', enc: 40, basePriceGold: 1 }, { uid: 'lot-3', cargoId: 'sel', enc: 20, basePriceGold: 2 }];
    expect(cargoTotalEnc(lots)).toBe(160);
    const r = removeCargo(lots, 'bois-mer', 120);
    expect(r.removed).toBe(120);
    expect(cargoTotalEnc(r.lots)).toBe(40);
    expect(r.lots).toHaveLength(2); // bois 20 + sel 20
  });
});
