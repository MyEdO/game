import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useGame } from '../../state/store';
import { lancerScenario } from '../../state/scenarioFlow';
import { testScenarios } from './index';
import { seedBattleRng } from '../../state/battleRng';
import { toBrass } from '../../engine/money';
import { distributeCredit, partyMoneyTotal } from '../../state/bourseFlow';
import { primaryCargoCarrier } from '../../state/carriers';
import { draineCascadeDifferee } from '../../state/cascadeTestKit';
import { carrierFreeEnc } from '../../engine/cargo';
import { REIK_INDEX } from './_reik-index';

/**
 * « Commerce fluvial (le Reik) » — le commerce de cargaison MSRC 13 rendu JOUABLE. Vérifie (1) que la
 * carte porte les VRAIES localités marchandes de l'Index géographique avec leurs indices verbatim, et
 * (2) la BOUCLE complète du marchand : acheter à Grünburg → descendre le Reik en barge (le convoi persiste)
 * → revendre à Altdorf (Florissant R 5, +10 %) avec PROFIT (l.11-13, l.150-156).
 */
const scen = testScenarios.find((s) => s.id === 'commerce-fluvial')!;
const scenConstruit = scen.construire();
const get = () => useGame.getState();

/** Lance le scénario par le lanceur du menu (`lancerScenario`). */
function launch() {
  lancerScenario(get, useGame.setState, scen);
}

/** Descend le fleuve par une route de barge jusqu'à l'arrivée (travelPlan retombé à null). Route directe
 *  ≤ 48 km → une seule journée, pas de halte ; on gère quand même une éventuelle nuit de relais. */
function drainCascade(): void {
  let g = 0;
  while (get().pendingCascade && g++ < 200) {
    const p = get().pendingCascade!;
    const cur = p.participants[p.cursor];
    if (cur && cur.target != null && !cur.result) get().cascadeRoll(cur.id);
    else get().cascadeNext();
  }
}
function bargeTo(routeId: string, destSceneId: string, maxSteps = 60): void {
  get().startTravel(routeId, 'barge');
  for (let i = 0; i < maxSteps; i++) {
    if (!get().travelPlan && get().scene?.id === destSceneId) return;
    // Les jets du JOUR fluvial (et l'exposition) sont désormais une cascade influençable : la drainer.
    if (get().pendingCascade) { drainCascade(); continue; }
    if (get().pendingRest) { get().restSleep(); drainCascade(); continue; }
    if (!get().travelPlan) return;
  }
}

describe('Scénario Commerce fluvial — carte fidèle à l’Index géographique (MSRC 13)', () => {
  it('est dans la section Marché, avec les VRAIES localités du Reik et leurs indices verbatim', () => {
    expect(scen.category).toBe('marche');
    const places = scenConstruit.worldMap!.places;
    const place = (id: string) => places.find((p) => p.id === `p-${id}`)!;
    // Indices recopiés de l'Index (l.187 Altdorf, l.227 Kemperbad, l.221 Grünburg, l.237 Ubersreik).
    expect(place('altdorf').market).toMatchObject({ taille: 4, richesse: 5, produits: ['commerce'] });
    expect(place('kemperbad').market).toMatchObject({ taille: 3, richesse: 4, wineBonusEchelons: 2 });
    expect(place('grunburg').market).toMatchObject({ taille: 3, richesse: 2, produits: ['commerce'] });
    expect(place('ubersreik').market).toMatchObject({ taille: 3, richesse: 4 });
    // Chaque Lieu de la carte a un marché (LandMarketProfile) et est relié par barge.
    expect(places.every((p) => p.market)).toBe(true);
    expect(scenConstruit.worldMap!.routes.every((r) => r.modes.includes('barge'))).toBe(true);
    // Les Hameaux (Taille 1) restent hors carte mais dans les données (l.139).
    expect(REIK_INDEX.some((e) => e.taille === 1)).toBe(true);
    expect(places.some((p) => p.id === 'p-furtild')).toBe(false);
  });
});

describe('Scénario Commerce fluvial — boucle acheter → barge → revendre avec PROFIT', () => {
  beforeEach(launch);

  it('achète une cargaison à Grünburg, descend le Reik en barge (convoi persistant) et la revend plus cher à Altdorf', () => {
    // Bourse large pour garantir l'achat du LOT PLEIN (pas de surcoût de lot partiel, l.131).
    distributeCredit(get, useGame.setState, { gold: 200000, silver: 0, brass: 0 });
    expect(get().scene?.id).toBe('quai-grunburg');

    // ── ACHAT à Grünburg (R 2) ──
    seedBattleRng(7);
    get().openLandMarket();
    get().etalLotConfirm(); // #1426 : la fenêtre de LOT s'ouvre d'abord ; l'étal se pose à sa validation
    drainCascade(); // #274 : le Test de Ragot est surfacé par la porte (héros piloté-humain → modale)
    const offers = get().landMarket!.offers;
    expect(offers.length).toBeGreaterThan(0);
    const offer = offers[0];
    // La Contenance du chariot est un plafond RÉEL (#327) : on charge ce qui TIENT (lot potentiellement partiel).
    const carrierId = primaryCargoCarrier(get())!.id;
    const buyEnc = Math.min(carrierFreeEnc(primaryCargoCarrier(get())!), offer.enc);
    const purseBeforeBuy = toBrass(partyMoneyTotal(get));
    get().landBuyCargo(offer.cargoId, buyEnc);
    const spent = purseBeforeBuy - toBrass(partyMoneyTotal(get));
    expect(spent).toBeGreaterThan(0);
    expect(primaryCargoCarrier(get())!.cargo.length).toBe(1);
    expect(primaryCargoCarrier(get())!.cargo[0].cargoId).toBe(offer.cargoId);
    get().closeLandMarket();

    // ── DESCENTE du Reik en BARGE (le convoi voyage avec le groupe) ──
    bargeTo('r-grunburg-altdorf', 'quai-altdorf');
    expect(get().travelPlan).toBeNull();
    expect(get().scene?.id).toBe('quai-altdorf'); // arrivé à la capitale
    expect(primaryCargoCarrier(get())!.cargo.length).toBe(1); // cargaison PERSISTÉE pendant le voyage

    // ── VENTE à Altdorf (Florissant R 5 → Mise à prix +10 %, l.156) ──
    seedBattleRng(3);
    get().openLandMarket();
    get().etalLotConfirm();
    drainCascade();
    const purseBeforeSell = toBrass(partyMoneyTotal(get));
    // Le dé d'acheteur est un dé de MONDE : le joueur le LANCE dans sa fenêtre (#1426), et la vente
    // s'enchaîne sur ses maillons différés (mise à prix, Marchandage).
    vi.useFakeTimers();
    get().landSellCargo(carrierId, 0);
    draineCascadeDifferee(get, () => vi.runAllTimers());
    vi.useRealTimers();
    const earned = toBrass(partyMoneyTotal(get)) - purseBeforeSell;
    expect(earned).toBeGreaterThan(0);
    // La cargaison a rapporté PLUS qu'elle n'a coûté à l'achat → profit prouvé (boucle MSRC 13 l.11-13).
    expect(earned).toBeGreaterThan(spent);
    expect(primaryCargoCarrier(get())!.cargo.length ?? 0).toBe(0); // lot vendu en entier
  });
});
