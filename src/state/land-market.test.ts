import { describe, it, expect, beforeEach, vi } from 'vitest';
import { emptyScene } from './scene';
import { useGame } from './store';
import { makePregens } from '../data/pregens';
import { seedBattleRng } from './battleRng';
import { draineCascadeDifferee } from './cascadeTestKit';
import { toBrass } from '../engine/money';
import { partyMoneyTotal, creditBourse } from './bourseFlow';
import { WINE_QUALITY } from '../engine/landCargo';
import { carrierById, persistCarriersCargo } from './carriers';
import type { WorldMap } from './worldMap';
import type { CargoLot } from '../engine/cargo';
import type { Possession } from '../engine/possession';

/**
 * #58 — Commerce de cargaison TERRESTRE (Mort sur le Reik Compagnon ch.11) : les consommateurs runtime du
 * moteur `landCargo` + `MapPlace.market`. Le flux `landMarketFlow` ouvre le marché à un Lieu de commerce,
 * achète (disponibilité 2 temps + Marchandage + lot partiel — plafonné à la Contenance du porteur, #327),
 * vend (Demande/Mise à prix), brade (½). La cargaison vit sur un PORTEUR RÉEL — une Possession du registre
 * (`Possession.cargo`, SOCLE POSSESSIONS #617/#618).
 */
const get = useGame.getState.bind(useGame);
const set = useGame.setState.bind(useGame);

/** id du porteur de convoi (diligence, chargement 80) donné au groupe pour tout le commerce terrestre. */
const CARRIER_ID = 'convoi-1';
const dili = (ownerId: string, uid = CARRIER_ID): Possession =>
  ({ uid, ownerId, nature: 'vehicule', vehicleId: 'diligence', location: { kind: 'avec-le-groupe' }, items: [] });

/** Cargaison du porteur de convoi (source unique = sa `Possession.cargo`). */
const carrierCargo = (): CargoLot[] => carrierById(get(), CARRIER_ID)?.cargo ?? [];
/** Pose directement des lots sur le porteur (bypass Contenance : mise en scène des ventes/bradages). */
function setCarrierCargo(lots: CargoLot[]): void {
  useGame.setState(persistCarriersCargo(get(), [{ carrierId: CARRIER_ID, cargo: lots }]) as never);
}

/** Draine une cascade influençable (héros piloté-humain → modale, #274). */
function drainCascade(): void {
  let g = 0;
  while (get().pendingCascade && g++ < 50) {
    const p = get().pendingCascade!;
    const cur = p.participants[p.cursor];
    if (cur && cur.target != null && !cur.result) get().cascadeRoll(cur.id);
    else get().cascadeNext();
  }
}

const landMap: WorldMap = {
  id: 'm', label: 'Reikland',
  places: [
    { id: 'A', label: 'Grünburg', pos: { x: 0, y: 0 }, scene: 'ville-a', market: { taille: 4, richesse: 4, produits: ['vivres', 'vin', 'metal', 'commerce'] } },
  ],
  routes: [],
};

function freshState(withCarrier = true) {
  const party = makePregens().slice(0, 3);
  const possessions: Possession[] = withCarrier ? [dili(party[0].id)] : [];
  useGame.setState({
    party, possessions,
    scene: { ...emptyScene(2, 2), id: 'ville-a', label: 'Ville', layers: [{ z: 0, tiles: ['sol', 'sol', 'sol', 'sol'] }] },
    battle: null,
    worldMap: landMap,
    travelPlan: null,
    travelRecap: null,
    landMarket: null,
    gameTime: 8 * 60,
    lastUpkeepDay: 0,
    journal: [],
  } as never);
  // T-bourse #531 : la mise de commerce vit dans la bourse personnelle (ici, celle du meneur).
  creditBourse(get, set, party[0].id, { gold: 5000, silver: 0, brass: 0 });
}

/** Vend le lot 0 du convoi et JOUE la fenêtre du dé de monde (#1426) : « Lancer », puis les maillons
 *  différés (mise à prix, Marchandage) que la continuation enchaîne. */
function vendLot0(index = 0): void {
  vi.useFakeTimers();
  get().landSellCargo(CARRIER_ID, index);
  draineCascadeDifferee(get, () => vi.runAllTimers());
  vi.useRealTimers();
}

describe('#58 — commerce de cargaison terrestre (MSRC 13)', () => {
  beforeEach(() => freshState());

  it('openLandMarket génère des offres d’achat (disponibilité 2 temps + Taille de cargaison)', () => {
    seedBattleRng(3);
    get().openLandMarket();
    const lm = get().landMarket;
    expect(lm).toBeTruthy();
    expect(lm!.offers.length).toBeGreaterThan(0);
    expect(lm!.offers.every((o) => o.enc > 0 && o.basePrice > 0)).toBe(true);
    expect(lm!.offers.some((o) => o.wine)).toBe(true);
  });

  it('landBuyCargo débite la bourse et charge le porteur de convoi (Possession.cargo)', () => {
    seedBattleRng(3);
    get().openLandMarket();
    const offer = get().landMarket!.offers[0];
    const before = partyMoneyTotal(get).gold;
    get().landBuyCargo(offer.cargoId, Math.min(30, offer.enc)); // ≤ Contenance 80
    const cargo = carrierCargo();
    expect(cargo.length).toBe(1);
    expect(cargo[0].cargoId).toBe(offer.cargoId);
    expect(cargo[0].enc).toBe(Math.min(30, offer.enc));
    expect(partyMoneyTotal(get).gold).toBeLessThanOrEqual(before);
  });

  it('landBuyCargo REFUSE au-delà de la Contenance du porteur (plafond réel, #327)', () => {
    freshState(true); // Contenance 80
    seedBattleRng(3);
    get().openLandMarket();
    const offer = get().landMarket!.offers[0];
    const before = partyMoneyTotal(get).gold;
    get().landBuyCargo(offer.cargoId, 200); // > 80 → refusé
    expect(carrierCargo().length).toBe(0);
    expect(partyMoneyTotal(get).gold).toBe(before);
    expect(get().journal.some((l) => /ne peut plus charger/.test(l))).toBe(true);
  });

  it('landBuyCargo REFUSE si le groupe n’a AUCUN porteur (bête/véhicule/navire)', () => {
    freshState(false); // aucun porteur
    seedBattleRng(3);
    get().openLandMarket();
    const offer = get().landMarket!.offers[0];
    const before = partyMoneyTotal(get).gold;
    get().landBuyCargo(offer.cargoId, 20);
    expect(partyMoneyTotal(get).gold).toBe(before);
    expect(get().journal.some((l) => /Aucune bête de somme ni véhicule/.test(l))).toBe(true);
  });

  it('landSellCargo trouve un acheteur et crédite la bourse (Demande = Taille×10 +30 Commerce)', () => {
    setCarrierCargo([{ cargoId: 'vivres', enc: 40, basePriceGold: 2 }]);
    useGame.setState({ landMarket: { placeId: 'A', label: 'Grünburg', market: structuredClone(landMap.places[0].market!), offers: [] } } as never);
    seedBattleRng(2);
    const before = partyMoneyTotal(get).gold;
    vendLot0();
    const cargo = carrierCargo();
    expect(cargo.length === 0 || cargo[0].enc < 40).toBe(true);
    expect(partyMoneyTotal(get).gold).toBeGreaterThan(before);
  });

  it('landDumpCargo brade à la moitié du prix de base (Lieu de Commerce, l.160)', () => {
    setCarrierCargo([{ cargoId: 'metal', enc: 20, basePriceGold: 3 }]);
    useGame.setState({ landMarket: { placeId: 'A', label: 'Grünburg', market: structuredClone(landMap.places[0].market!), offers: [] } } as never);
    const before = partyMoneyTotal(get).gold;
    get().landDumpCargo(CARRIER_ID, 0);
    expect(carrierCargo().length).toBe(0);
    expect(partyMoneyTotal(get).gold).toBe(before + 30); // 20 Enc × 3 CO × 50 % = 30 CO
  });

  it('landDumpCargo REFUSE si le Lieu n’a pas le Commerce en Produits', () => {
    const noCommerce = { taille: 2, richesse: 2, produits: ['vivres'] };
    setCarrierCargo([{ cargoId: 'vivres', enc: 20, basePriceGold: 1 }]);
    useGame.setState({ landMarket: { placeId: 'A', label: 'Bourg', market: noCommerce, offers: [] } } as never);
    const before = partyMoneyTotal(get).gold;
    get().landDumpCargo(CARRIER_ID, 0);
    expect(carrierCargo().length).toBe(1); // refusé : rien bradé
    expect(partyMoneyTotal(get).gold).toBe(before);
  });

  it('landBuyCargo REFUSE un lot de moins de minCargoEnc (l.131)', () => {
    seedBattleRng(3);
    get().openLandMarket();
    const offer = get().landMarket!.offers[0];
    const before = partyMoneyTotal(get).gold;
    get().landBuyCargo(offer.cargoId, 5); // < 10 Enc → refusé
    expect(carrierCargo().length).toBe(0);
    expect(partyMoneyTotal(get).gold).toBe(before);
  });

  it('landEvalWine révèle la qualité secrète d’un lot de Vin (Test d’Évaluation, l.95)', () => {
    seedBattleRng(3);
    get().openLandMarket();
    const wine = get().landMarket!.offers.find((o) => o.wine)!;
    expect(wine.wineTier).toBeUndefined();
    get().landEvalWine(wine.cargoId);
    drainCascade();
    const after = get().landMarket!.offers.find((o) => o.cargoId === wine.cargoId)!;
    expect(WINE_QUALITY.map((w) => w.label)).toContain(after.wineTier);
    expect(typeof after.wineEvalOk).toBe('boolean');
  });

  it('rumeur commerciale (l.180) : le bien se vend au DOUBLE au Lieu DÉSIGNÉ par la rumeur du board (#99)', () => {
    const mkt = { taille: 4, richesse: 3, produits: ['vivres', 'commerce'] };
    const lot: CargoLot = { cargoId: 'vivres', enc: 100, basePriceGold: 1 };
    const rum = { placeId: 'A', biens: ['vivres'], mult: 2, text: 'Forte demande de vivres.', heardDay: 0 };
    setCarrierCargo([lot]);
    useGame.setState({ tradeRumours: [], landMarket: { placeId: 'A', label: 'X', market: mkt, offers: [] } } as never);
    seedBattleRng(2);
    const b0 = toBrass(partyMoneyTotal(get));
    vendLot0();
    const base = toBrass(partyMoneyTotal(get)) - b0;
    setCarrierCargo([lot]);
    useGame.setState({ tradeRumours: [rum], landMarket: { placeId: 'A', label: 'X', market: mkt, offers: [] } } as never);
    seedBattleRng(2);
    const b1 = toBrass(partyMoneyTotal(get));
    vendLot0();
    const withRumour = toBrass(partyMoneyTotal(get)) - b1;
    expect(base).toBeGreaterThan(0);
    expect(withRumour).toBe(base * 2);
  });

  it('rumeur commerciale : un bien NON visé n’est pas doublé — ni un Lieu NON désigné', () => {
    const mkt = { taille: 4, richesse: 3, produits: ['vivres', 'commerce'] };
    const lot: CargoLot = { cargoId: 'metal', enc: 100, basePriceGold: 1 };
    const rums = [
      { placeId: 'A', biens: ['vivres'], mult: 2, text: 'Forte demande de vivres.', heardDay: 0 },
      { placeId: 'B', biens: ['metal'], mult: 2, text: 'Le métal s’arrache à B.', heardDay: 0 },
    ];
    setCarrierCargo([lot]);
    useGame.setState({ tradeRumours: [], landMarket: { placeId: 'A', label: 'X', market: mkt, offers: [] } } as never);
    seedBattleRng(2);
    const b0 = toBrass(partyMoneyTotal(get));
    vendLot0();
    const base = toBrass(partyMoneyTotal(get)) - b0;
    setCarrierCargo([lot]);
    useGame.setState({ tradeRumours: rums, landMarket: { placeId: 'A', label: 'X', market: mkt, offers: [] } } as never);
    seedBattleRng(2);
    const b1 = toBrass(partyMoneyTotal(get));
    vendLot0();
    expect(toBrass(partyMoneyTotal(get)) - b1).toBe(base);
  });
});
