import { idsDeTest } from '../engine/idsDeTest.testkit';
import { acheterAuMarche } from './cargaison.testkit';
import { t } from '../i18n';
import { describe, it, expect, beforeEach } from 'vitest';
import { emptyScene } from './monde/scene';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { tousLesHerosDeScenario } from '../scenes/test-scenarios/_heros';
import { seedBattleRng, battleRng } from './battleRng';
import { draineCascadeDifferee } from './cascade.testkit';
import { toBrass } from '../engine/money';
import { partyMoneyTotal, creditBourse } from './bourseFlow';
import { WINE_QUALITY } from '../engine/landCargo';
import { carrierById, persistCarriersCargo } from './carriers';
import type { WorldMap } from './worldMap';
import type { CargoLot } from '../engine/cargo';
import type { Possession } from '../engine/possession';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

/**
 * #58 — Commerce de cargaison TERRESTRE (Mort sur le Reik Compagnon ch.11) : les consommateurs runtime du
 * moteur `landCargo` + `MapPlace.market`. Le flux `landMarketFlow` ouvre le marché à un Lieu de commerce,
 * achète (disponibilité 2 temps + Marchandage + lot partiel — plafonné à la Contenance du porteur, #327),
 * vend (Demande/Mise à prix), brade (½). La cargaison vit sur un PORTEUR RÉEL — une Possession du registre
 * (`Possession.cargo`, SOCLE POSSESSIONS #617/#618).
 */
const get = () => banc.getState();
const set: Banc['setState'] = (e) => banc.setState(e);

/** id du porteur de convoi (diligence, chargement 80) donné au groupe pour tout le commerce terrestre. */
const CARRIER_ID = 'convoi-1';
const dili = (ownerId: string, uid = CARRIER_ID): Possession =>
  ({ uid, ownerId, nature: 'vehicule', vehicleId: 'diligence', location: { kind: 'avec-le-groupe' }, items: [] });

/** Cargaison du porteur de convoi (source unique = sa `Possession.cargo`). */
const carrierCargo = (): CargoLot[] => carrierById(get(), CARRIER_ID)?.cargo ?? [];
/** Pose directement des lots sur le porteur (bypass Contenance : mise en scène des ventes/bradages). */
function setCarrierCargo(lots: CargoLot[]): void {
  banc.setState(persistCarriersCargo(get(), [{ carrierId: CARRIER_ID, cargo: lots }]) as never);
}

/** Draine une cascade influençable (héros piloté-humain → modale, #274). */
function drainCascade(): void {
  let g = 0;
  while (get().pendingCascade && g++ < 50) {
    const p = get().pendingCascade!;
    const cur = p.participants[p.cursor];
    if (cur && cur.target != null && !cur.result) get().jetLancer('cascade', cur.id);
    else get().jetValider('cascade');
  }
}

const landMap: WorldMap = {
  id: 'm', label: 'Reikland',
  places: [
    { id: 'A', label: 'Grünburg', pos: { x: 0, y: 0 }, scene: { id: 'ville-a' }, market: { taille: 4, richesse: 4, produits: ['vivres', 'vin-eau-de-vie', 'metal', 'commerce-terre'] } },
  ],
  routes: [],
};

function freshState(withCarrier = true) {
  const party = tousLesHerosDeScenario(idsDeTest).slice(0, 3);
  const possessions: Possession[] = withCarrier ? [dili(party[0].id)] : [];
  banc.setState({
    party, possessions,
    scene: { ...emptyScene('ville-a', 2, 2), label: 'Ville', layers: [{ z: 0, tiles: ['sol', 'sol', 'sol', 'sol'] }] },
    battle: null,
    worldMap: landMap,
    lieu: 'A',
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

/** Vend le lot désigné et JOUE la fenêtre du dé de monde (#1426) : « Lancer », puis les maillons
 *  différés (mise à prix, Marchandage) que la continuation enchaîne. */
function vendre(lotId: string): void {
  get().fenetreChoisir('marcheDeTerre', 'vendre', lotId);
  draineCascadeDifferee(get, () => banc.reprendreLesEnAttente());
}

describe('#58 — commerce de cargaison terrestre (MSRC 13)', () => {
  beforeEach(() => freshState());

  it('ouvrirLeMarche génère des offres d’achat (disponibilité 2 temps + Taille de cargaison)', () => {
    seedBattleRng(3);
    get().ouvrirLeMarche();
    const lm = get().landMarket;
    expect(lm).toBeTruthy();
    expect(lm!.offers.length).toBeGreaterThan(0);
    expect(lm!.offers.every((o) => o.enc > 0 && o.basePrice > 0)).toBe(true);
    expect(lm!.offers.some((o) => o.wine)).toBe(true);
  });

  it('l’achat de cargaison débite la bourse et charge le porteur de convoi (Possession.cargo)', () => {
    seedBattleRng(3);
    get().ouvrirLeMarche();
    const offer = get().landMarket!.offers[0];
    const before = partyMoneyTotal(get).gold;
    acheterAuMarche(get, 'marcheDeTerre', CARRIER_ID, offer.cargoId, Math.min(30, offer.enc)); // ≤ Contenance 80
    const cargo = carrierCargo();
    expect(cargo.length).toBe(1);
    expect(cargo[0].cargoId).toBe(offer.cargoId);
    expect(cargo[0].enc).toBe(Math.min(30, offer.enc));
    expect(partyMoneyTotal(get).gold).toBeLessThanOrEqual(before);
  });

  it('l’achat de cargaison charge le porteur DÉSIGNÉ, jamais un autre porteur du groupe', () => {
    banc.setState({ possessions: [...get().possessions, dili(get().party[0].id, 'convoi-2')] } as never);
    seedBattleRng(3);
    get().ouvrirLeMarche();
    const offer = get().landMarket!.offers[0];
    acheterAuMarche(get, 'marcheDeTerre', 'convoi-2', offer.cargoId, Math.min(30, offer.enc));
    expect(carrierCargo(), 'le premier convoi n’était pas désigné').toEqual([]);
    expect(carrierById(get(), 'convoi-2')!.cargo.map((l) => l.cargoId)).toEqual([offer.cargoId]);
  });

  it('l’achat de cargaison REFUSE au-delà de la Contenance du porteur (plafond réel, #327)', () => {
    freshState(true); // Contenance 80
    seedBattleRng(3);
    get().ouvrirLeMarche();
    const offer = get().landMarket!.offers[0];
    const before = partyMoneyTotal(get).gold;
    acheterAuMarche(get, 'marcheDeTerre', CARRIER_ID, offer.cargoId, 200); // > 80 → refusé
    expect(carrierCargo().length).toBe(0);
    expect(partyMoneyTotal(get).gold).toBe(before);
    expect(get().journal.some((l) => /ne peut plus charger/.test(l))).toBe(true);
  });

  it('l’achat de cargaison REFUSE si le groupe n’a AUCUN porteur (bête/véhicule/navire)', () => {
    freshState(false); // aucun porteur
    seedBattleRng(3);
    get().ouvrirLeMarche();
    const offer = get().landMarket!.offers[0];
    const before = partyMoneyTotal(get).gold;
    expect(acheterAuMarche(get, 'marcheDeTerre', CARRIER_ID, offer.cargoId, 20), 'aucun porteur à désigner').toBe(t('choix.refus.valeur'));
    get().fenetreChoisir('marcheDeTerre', 'acheter', true);
    expect(partyMoneyTotal(get).gold).toBe(before);
    expect(get().journal.some((l) => /Aucune bête de somme ni véhicule/.test(l))).toBe(true);
  });

  it('la vente de cargaison trouve un acheteur et crédite la bourse (Demande = Taille×10 +30 Commerce)', () => {
    setCarrierCargo([{ uid: 'lot-1', cargoId: 'vivres', enc: 40, basePriceGold: 2 }]);
    banc.setState({ landMarket: { placeId: 'A', label: 'Grünburg', market: structuredClone(landMap.places[0].market!), offers: [] } } as never);
    seedBattleRng(2);
    const before = partyMoneyTotal(get).gold;
    vendre('lot-1');
    const cargo = carrierCargo();
    expect(cargo.length === 0 || cargo[0].enc < 40).toBe(true);
    expect(partyMoneyTotal(get).gold).toBeGreaterThan(before);
  });

  it('l’achat de cargaison : Marchandage gagné de 6 DR ou plus par un Négociateur → remise de 30 % (LDB 59 l.43, LDB 10 l.818 ; arbitrage #2547)', () => {
    const meneur = get().party[0];
    meneur.talents = [...meneur.talents, { talentId: 'negociateur', times: 1 }];
    meneur.skills = [...meneur.skills.filter((sk) => sk.id !== 'marchandage'), { id: 'marchandage', advances: 60 } as never];
    banc.setState({ party: [meneur], landMarket: { placeId: 'A', label: 'Grünburg', market: structuredClone(landMap.places[0].market!), offers: [{ cargoId: 'metal', label: 'Métal', enc: 20, basePrice: 10 }] } } as never);
    seedBattleRng(3);
    const rng = battleRng() as { int: (min: number, max: number) => number };
    const brut = rng.int.bind(rng);
    const des = [5, 99]; // le meneur, puis le marchand
    rng.int = (min, max) => (min === 1 && max === 100 && des.length ? des.shift()! : brut(min, max));
    const before = partyMoneyTotal(get).gold;
    acheterAuMarche(get, 'marcheDeTerre', CARRIER_ID, 'metal', 20);
    expect(get().journal.some((l) => /remise de 30 %/.test(l)), get().journal.join('\n')).toBe(true);
    expect(before - partyMoneyTotal(get).gold).toBe(140); // 20 Enc × 10 CO × 0,7
  });

  it('la vente de cargaison : un Négociateur qui gagne de moins de 6 DR monte la mise à prix de 20 % (LDB 59 l.43, LDB 10 l.818 ; arbitrage #2547)', () => {
    const meneur = get().party[0];
    meneur.talents = [...meneur.talents, { talentId: 'negociateur', times: 1 }];
    meneur.skills = [...meneur.skills.filter((sk) => sk.id !== 'marchandage'), { id: 'marchandage', advances: 60 } as never];
    banc.setState({ party: [meneur], landMarket: { placeId: 'A', label: 'Grünburg', market: structuredClone(landMap.places[0].market!), offers: [] } } as never);
    setCarrierCargo([{ uid: 'lot-2', cargoId: 'vivres', enc: 20, basePriceGold: 2 }]);
    seedBattleRng(2);
    const rng = battleRng() as { int: (min: number, max: number) => number };
    const brut = rng.int.bind(rng);
    const des = [5, 70, 40]; // acheteur trouvé, le meneur (DR 1 au plus haut), le marchand (2d10+30)
    rng.int = (min, max) => (min === 1 && max === 100 && des.length ? des.shift()! : brut(min, max));
    vendre('lot-2');
    expect(get().journal.some((l) => /Marchandage \(70 vs 40\) : \+20 %/.test(l)), get().journal.join('\n')).toBe(true);
  });

  it('le bradage de cargaison brade à la moitié du prix de base (Lieu de Commerce, l.160)', () => {
    setCarrierCargo([{ uid: 'lot-3', cargoId: 'metal', enc: 20, basePriceGold: 3 }]);
    banc.setState({ landMarket: { placeId: 'A', label: 'Grünburg', market: structuredClone(landMap.places[0].market!), offers: [] } } as never);
    const before = partyMoneyTotal(get).gold;
    get().fenetreChoisir('marcheDeTerre', 'jeter', 'lot-3');
    expect(carrierCargo().length).toBe(0);
    expect(partyMoneyTotal(get).gold).toBe(before + 30); // 20 Enc × 3 CO × 50 % = 30 CO
  });

  it('le bradage de cargaison : deux lots du même bien, seul le lot désigné est bradé, à SON prix', () => {
    setCarrierCargo([{ uid: 'lot-a', cargoId: 'metal', enc: 10, basePriceGold: 3 }, { uid: 'lot-b', cargoId: 'metal', enc: 10, basePriceGold: 5 }]);
    banc.setState({ landMarket: { placeId: 'A', label: 'Grünburg', market: structuredClone(landMap.places[0].market!), offers: [] } } as never);
    const before = partyMoneyTotal(get).gold;
    get().fenetreChoisir('marcheDeTerre', 'jeter', 'lot-b');
    expect(carrierCargo()).toEqual([{ uid: 'lot-a', cargoId: 'metal', enc: 10, basePriceGold: 3 }]);
    expect(partyMoneyTotal(get).gold).toBe(before + 25); // 10 Enc × 5 CO × 50 %
  });

  it('le bradage de cargaison REFUSE si le Lieu n’a pas le Commerce en Produits', () => {
    const noCommerce = { taille: 2, richesse: 2, produits: ['vivres'] };
    setCarrierCargo([{ uid: 'lot-4', cargoId: 'vivres', enc: 20, basePriceGold: 1 }]);
    banc.setState({ landMarket: { placeId: 'A', label: 'Bourg', market: noCommerce, offers: [] } } as never);
    const before = partyMoneyTotal(get).gold;
    get().fenetreChoisir('marcheDeTerre', 'jeter', 'lot-4');
    expect(carrierCargo().length).toBe(1); // refusé : rien bradé
    expect(partyMoneyTotal(get).gold).toBe(before);
  });

  it('l’achat de cargaison REFUSE un lot de moins de minCargoEnc (l.131)', () => {
    seedBattleRng(3);
    get().ouvrirLeMarche();
    const offer = get().landMarket!.offers[0];
    const before = partyMoneyTotal(get).gold;
    acheterAuMarche(get, 'marcheDeTerre', CARRIER_ID, offer.cargoId, 5); // < 10 Enc → refusé
    expect(carrierCargo().length).toBe(0);
    expect(partyMoneyTotal(get).gold).toBe(before);
  });

  it('evaluerLeVin révèle la qualité secrète d’un lot de Vin (Test d’Évaluation, l.95)', () => {
    seedBattleRng(3);
    get().ouvrirLeMarche();
    const wine = get().landMarket!.offers.find((o) => o.wine)!;
    expect(wine.wineTier).toBeUndefined();
    get().evaluerLeVin(wine.cargoId);
    drainCascade();
    const after = get().landMarket!.offers.find((o) => o.cargoId === wine.cargoId)!;
    expect(WINE_QUALITY.map((w) => w.label)).toContain(after.wineTier);
    expect(typeof after.wineEvalOk).toBe('boolean');
  });

  it('personne qui puisse tenter l’Évaluation (LDB 09 l.30) : evaluerLeVin journalise le refus NOMMÉ, aucun Test ouvert', () => {
    seedBattleRng(3);
    get().ouvrirLeMarche();
    const wine = get().landMarket!.offers.find((o) => o.wine)!;
    set({ party: get().party.map((h) => ({ ...h, skills: h.skills.filter((sk) => sk.id !== 'evaluation') })) });
    get().evaluerLeVin(wine.cargoId);
    expect(get().journal.slice(-1)[0]).toBe('Personne dans le groupe ne peut tenter le Test d’Évaluation.');
    expect(get().pendingCascade).toBeNull();
    expect(get().landMarket!.offers.find((o) => o.cargoId === wine.cargoId)!.wineTier).toBeUndefined();
  });

  it('rumeur commerciale (l.180) : le bien se vend au DOUBLE au Lieu DÉSIGNÉ par la rumeur du board (#99)', () => {
    const mkt = { taille: 4, richesse: 3, produits: ['vivres', 'commerce-terre'] };
    const lot: CargoLot = { uid: 'lot-5', cargoId: 'vivres', enc: 100, basePriceGold: 1 };
    const rum = { placeId: 'A', biens: ['vivres'], mult: 2, text: 'Forte demande de vivres.', heardDay: 0 };
    setCarrierCargo([lot]);
    banc.setState({ tradeRumours: [], landMarket: { placeId: 'A', label: 'X', market: mkt, offers: [] } } as never);
    seedBattleRng(2);
    const b0 = toBrass(partyMoneyTotal(get));
    vendre('lot-5');
    const base = toBrass(partyMoneyTotal(get)) - b0;
    setCarrierCargo([lot]);
    banc.setState({ tradeRumours: [rum], landMarket: { placeId: 'A', label: 'X', market: mkt, offers: [] } } as never);
    seedBattleRng(2);
    const b1 = toBrass(partyMoneyTotal(get));
    vendre('lot-5');
    const withRumour = toBrass(partyMoneyTotal(get)) - b1;
    expect(base).toBeGreaterThan(0);
    expect(withRumour).toBe(base * 2);
  });

  it('rumeur commerciale : un bien NON visé n’est pas doublé — ni un Lieu NON désigné', () => {
    const mkt = { taille: 4, richesse: 3, produits: ['vivres', 'commerce-terre'] };
    const lot: CargoLot = { uid: 'lot-6', cargoId: 'metal', enc: 100, basePriceGold: 1 };
    const rums = [
      { placeId: 'A', biens: ['vivres'], mult: 2, text: 'Forte demande de vivres.', heardDay: 0 },
      { placeId: 'B', biens: ['metal'], mult: 2, text: 'Le métal s’arrache à B.', heardDay: 0 },
    ];
    setCarrierCargo([lot]);
    banc.setState({ tradeRumours: [], landMarket: { placeId: 'A', label: 'X', market: mkt, offers: [] } } as never);
    seedBattleRng(2);
    const b0 = toBrass(partyMoneyTotal(get));
    vendre('lot-6');
    const base = toBrass(partyMoneyTotal(get)) - b0;
    setCarrierCargo([lot]);
    banc.setState({ tradeRumours: rums, landMarket: { placeId: 'A', label: 'X', market: mkt, offers: [] } } as never);
    seedBattleRng(2);
    const b1 = toBrass(partyMoneyTotal(get));
    vendre('lot-6');
    expect(toBrass(partyMoneyTotal(get)) - b1).toBe(base);
  });
});
