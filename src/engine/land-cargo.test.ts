import { describe, it, expect } from 'vitest';
import {
  availabilityPct, rollFindMerchant, rollCargoQuantity, rollRandomLandCargo,
  rollWineQuality, landCargoBasePrice, wineEvalDifficulty, wineEvalReveal, rollMerchantSkill, sellDemandTarget,
  sellOfferPct, landDumpingPct, rollTradeRumour, rumourMatches, minCargoEnc, partialSurchargePct,
  tradeRumourApplies, tradeRumourMult, type LandMarketProfile, type TradeRumour,
} from './landCargo';
import { cargoTotalEnc, findCargoById, removeCargo } from './cargo';
import type { RNG } from './dice';
import { deMax, desEnSuite } from './dice.testkit';
import { datasetObject, setObjectDataset } from '../data/overrides';

const seq = (...vals: number[]): RNG => desEnSuite(vals, { boucle: true, borne: true });

// Exemples canoniques de l'Index géographique du Reikland (MSRC 13 l.164-174).
const grunburg: LandMarketProfile = { taille: 3, richesse: 2, produits: ['commerce-terre'] };      // Ville, Richesse Moyenne
const kemperbad: LandMarketProfile = { taille: 3, richesse: 4, produits: ['armement', 'commerce-terre', 'metal', 'vin-eau-de-vie'], wineBonusEchelons: 2 };
const hameau: LandMarketProfile = { taille: 1, richesse: 1, produits: ['subsistance'] };

describe('Commerce terrestre MSRC 13 — ACHAT (l.22-131)', () => {
  it('disponibilité : (Taille + Richesse) × 10 % — Grünburg = 50 % (l.164)', () => {
    expect(availabilityPct(grunburg)).toBe(50);
    expect(availabilityPct(hameau)).toBe(20);
  });

  it('Emplacement « Commerce » lance DEUX fois (l.28) : locale + cargaison aléatoire', () => {
    const r = rollFindMerchant(grunburg, seq(23, 90)); // 23 ≤ 50 trouvé ; 90 > 50 pas de 2ᵉ
    expect(r).toMatchObject({ pct: 50, localRoll: 23, localFound: true, randomRoll: 90, randomFound: false });
    const noCommerce = rollFindMerchant(hameau, seq(10));
    expect(noCommerce.randomRoll).toBeUndefined(); // un seul jet hors Commerce
  });

  it('taille de cargaison : (Taille+Richesse) × [d100 arrondi dizaine sup.] — Grünburg d100 46 → 50 × 5 = 250 (l.168)', () => {
    expect(rollCargoQuantity(grunburg, seq(46)).enc).toBe(250); // Grünburg a « Commerce » mais NE tire PAS sa Richesse du Commerce → pas d'inversion
    // Centre tirant sa Richesse du Commerce (`commerceRichesse`) : on inverse le d100 (36 → 63) et on garde
    // le plus grand arrondi (l.40-42) — 70.
    const centre: LandMarketProfile = { taille: 3, richesse: 2, produits: ['commerce-terre'], commerceRichesse: true };
    expect(rollCargoQuantity(centre, seq(36)).enc).toBe(350); // max(40, 70) × 5
    // Hameau (hors commerce) : pas d'inversion — 36 → 40 × 2 = 80.
    expect(rollCargoQuantity(hameau, seq(36)).enc).toBe(80);
  });

  it('type de cargaison par SAISON (l.71-78) : d100 65 au printemps → Vin (l.166)', () => {
    expect(rollRandomLandCargo('printemps', seq(65)).id).toBe('vin-eau-de-vie');
    expect(rollRandomLandCargo('automne', seq(20)).id).toBe('vivres');
    expect(rollRandomLandCargo('ete', seq(90)).id).toBe('laine-terre');
  });

  it('prix de base par saison (l.84-91), en CO par point d’Enc : Métal = 8 CO les 10 Enc → 0,8 ; Vivres = 0,25 en automne → 0,025', () => {
    expect(landCargoBasePrice(findCargoById('metal')!, 'automne', hameau, seq())).toBe(0.8);
    expect(landCargoBasePrice(findCargoById('vivres')!, 'automne', hameau, seq())).toBe(0.025);
  });

  it('qualité SECRÈTE du Vin (l.91, l.97-104) : d10 6 → Bon = 3 CO les 10 Enc → 0,3 par point d’Enc ; Kemperbad +2 échelons', () => {
    expect(rollWineQuality(seq(6))).toEqual({ roll: 6, label: 'Bon', price: 0.3 });
    // Kemperbad : +2 échelons — d10 4 (Moyen, idx 2) → idx 4 = Excellent (6 CO les 10 Enc).
    expect(landCargoBasePrice(findCargoById('vin-eau-de-vie')!, 'printemps', kemperbad, seq(4))).toBe(0.6);
    // Le Vin ne suit PAS la colonne saisonnière : le prix vient de la table de qualité.
    expect(landCargoBasePrice(findCargoById('vin-eau-de-vie')!, 'printemps', grunburg, seq(6))).toBe(0.3);
  });

  it('Test d’Évaluation du Vin : Intermédiaire, ou Accessible avec Résistance à l’alcool ≥ 50 (l.95)', () => {
    expect(wineEvalDifficulty(30)).toBe('intermediaire');
    expect(wineEvalDifficulty(50)).toBe('accessible');
  });

  it('Révélation de la qualité du Vin (l.95) : succès → vraie qualité ; échec → fausse indication décalée du DR', () => {
    // Prix de base 0,3 CO par point d'Enc = 3 CO les 10 Enc = « Bon » (idx 3). Succès → la vraie qualité.
    expect(wineEvalReveal(0.3, true, 2)).toEqual({ trueLabel: 'Bon', shownLabel: 'Bon' });
    // Échec DR −2 → décalé de 2 échelons vers le haut (idx 3+2=5) = « Supérieur » (fausse indication).
    expect(wineEvalReveal(0.3, false, -2)).toEqual({ trueLabel: 'Bon', shownLabel: 'Supérieur' });
    // Échec au sommet (12 CO les 10 Enc = « Supérieur » idx 5) : le décalage haut est plafonné → on dévalue (idx 5−2=3).
    expect(wineEvalReveal(1.2, false, -2)).toEqual({ trueLabel: 'Supérieur', shownLabel: 'Bon' });
  });

  it('Marchandage : marchand 2d10+30 (l.129) ; lot partiel +10 %, mini 10 Enc (l.131)', () => {
    expect(rollMerchantSkill(seq(6, 4))).toBe(40); // 6+4+30
    expect(partialSurchargePct()).toBe(10);
    expect(minCargoEnc()).toBe(10);
  });
});

describe('Commerce terrestre MSRC 13 — VENTE (l.133-160)', () => {
  it('Demande : Taille × 10 (+30 si Commerce) — Kemperbad = 60 % (l.172)', () => {
    expect(sellDemandTarget(kemperbad)).toBe(60); // 3×10 + 30 (commerce)
    expect(sellDemandTarget(hameau)).toBe(10);    // 1×10, pas de commerce
  });

  it('Mise à prix par Richesse (l.150-156) : Prospère(4→Animé) +5 % ; Misérable 50 % ; Moyen 100 %', () => {
    expect(sellOfferPct(kemperbad)).toBe(105);  // Richesse 4 → Animé +5 % (exemple l.172)
    expect(sellOfferPct(hameau)).toBe(50);      // Richesse 1 → Misérable 50 %
    expect(sellOfferPct(grunburg)).toBe(80);    // Richesse 2 → Pauvre −20 %
  });

  it('bradage : moitié du prix de base à un Lieu « Commerce » (l.160), sinon impossible', () => {
    expect(landDumpingPct(grunburg)).toBe(50);
    expect(landDumpingPct(hameau)).toBeNull();
  });
});

describe('Commerce terrestre MSRC 13 — dé des tables (l.97, l.283 ; #1667)', () => {
  it('la qualité du vin et la rumeur se tirent au `die` VIVANT de leur table', () => {
    const imprime = structuredClone(datasetObject('landCargo'));
    try {
      setObjectDataset('landCargo', { ...imprime, qualiteDuVin: { ...imprime.qualiteDuVin, die: 'd1' }, rumeurs: { ...imprime.rumeurs, die: 'd5' } });
      expect(rollWineQuality(deMax), 'd1 → Médiocre').toMatchObject({ roll: 1, label: 'Médiocre' });
      expect(rollTradeRumour(deMax), 'd5 au max → 01-05').toMatchObject({ min: 1, max: 5 });
    } finally {
      setObjectDataset('landCargo', imprime);
    }
  });
});

describe('Commerce terrestre MSRC 13 — RUMEURS (l.176-303)', () => {
  it('tire une rumeur au d100 et signale les biens demandés → prix doublé sur correspondance', () => {
    const rum = rollTradeRumour(seq(3)); // 01-05
    expect(rum.biens).toEqual(['produits-de-luxe-terre', 'vin-eau-de-vie', 'vivres']);
    expect(rumourMatches(rum, 'vin-eau-de-vie')).toBe(true);
    expect(rumourMatches(rum, 'metal')).toBe(false);
  });

  it('board CROSS-LIEU (l.180) : le prix double UNIQUEMENT au Lieu désigné et pour le bien visé', () => {
    const board: TradeRumour[] = [
      { placeId: 'altdorf', biens: ['vin-eau-de-vie', 'vivres'], mult: 2, text: '…', heardDay: 3 },
    ];
    expect(tradeRumourApplies(board[0], 'altdorf', 'vin-eau-de-vie')).toBe(true);
    expect(tradeRumourApplies(board[0], 'altdorf', 'metal')).toBe(false); // bien hors rumeur
    expect(tradeRumourApplies(board[0], 'kemperbad', 'vin-eau-de-vie')).toBe(false); // autre Lieu
    expect(tradeRumourMult(board, 'altdorf', 'vin-eau-de-vie')).toBe(2);
    expect(tradeRumourMult(board, 'altdorf', 'metal')).toBe(1);
    expect(tradeRumourMult(board, 'kemperbad', 'vin-eau-de-vie')).toBe(1);
    expect(tradeRumourMult([], 'altdorf', 'vin-eau-de-vie')).toBe(1);
  });
});

describe('Tronc commun partagé (mer + terre) — CargoLot', () => {
  it('cargoTotalEnc / removeCargo fonctionnent identiquement pour la cargaison terrestre', () => {
    const lots = [{ uid: 'lot-1', cargoId: 'vin-eau-de-vie', enc: 250, basePriceGold: 3 }, { uid: 'lot-2', cargoId: 'metal', enc: 40, basePriceGold: 8 }];
    expect(cargoTotalEnc(lots)).toBe(290);
    const r = removeCargo(lots, 'vin-eau-de-vie', 100);
    expect(r.removed).toBe(100);
    expect(cargoTotalEnc(r.lots)).toBe(190);
  });
});
