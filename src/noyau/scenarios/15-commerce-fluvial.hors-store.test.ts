import { idsDeTest } from '../../engine/idsDeTest.testkit';
import { acheterAuMarche } from '../cargaison.testkit';
import { describe, it, expect, beforeEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from '../banc.testkit';
import { lancerLeScenario } from '../lancementDeScenario';
import { lancementDuScenario } from '../../scenes/test-scenarios/_shared';
import { testScenarios } from '../../scenes/test-scenarios/index';
import { seedBattleRng } from '../../noyau/battleRng';
import { toBrass } from '../../engine/money';
import { distributeCredit, partyMoneyTotal } from '../../noyau/bourseFlow';
import { primaryCargoCarrier } from '../../noyau/carriers';
import { avanceEtapeCascade, draineCascade, draineCascadeDifferee } from '../../noyau/cascade.testkit';
import { carrierFreeEnc } from '../../engine/cargo';
import { REIK_INDEX } from '../../scenes/test-scenarios/_reik-index';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

/**
 * « Commerce fluvial (le Reik) » — le commerce de cargaison MSRC 13 rendu JOUABLE. Vérifie (1) que la
 * carte porte les VRAIES localités marchandes de l'Index géographique avec leurs indices verbatim, et
 * (2) la BOUCLE complète du marchand : acheter à Grünburg → descendre le Reik en barge (le convoi persiste)
 * → revendre à Altdorf (Florissant R 5, +10 %) avec PROFIT (l.11-13, l.150-156).
 */
const scen = testScenarios.find((s) => s.id === 'commerce-fluvial')!;
const scenConstruit = scen.construire(idsDeTest);
const get = () => banc.getState();

/** Lance le scénario par le lanceur du menu (`lancerLeScenario`). */
function launch() {
  lancerLeScenario(get, banc.setState, lancementDuScenario(scen, idsDeTest));
}

/** Descend le fleuve par une route de barge jusqu'à l'arrivée (travelPlan retombé à null). Route directe
 *  ≤ 48 km → une seule journée, pas de halte ; on gère quand même une éventuelle nuit de relais, et on force un barrage rencontré (MSRC 7 l.128). */
function drainCascade(): void {
  draineCascade(get, 200, undefined, () => 'forcer');
}
function bargeTo(routeId: string, destPlaceId: string, maxSteps = 60): void {
  get().partirEnVoyage(routeId, 'barge');
  for (let i = 0; i < maxSteps; i++) {
    if (!get().travelPlan && get().lieu === destPlaceId) return;
    // Les jets du JOUR fluvial (et l'exposition) sont une cascade influençable : la drainer.
    if (get().pendingCascade) { drainCascade(); continue; }
    if (get().pendingRest) { get().fenetreValider('repos'); drainCascade(); continue; }
    if (!get().travelPlan) return;
  }
}

describe('Scénario Commerce fluvial — carte fidèle à l’Index géographique (MSRC 13)', () => {
  it('est dans la section Marché, avec les VRAIES localités du Reik et leurs indices verbatim', () => {
    expect(scen.category).toBe('marche');
    const places = scenConstruit.worldMap!.places;
    const place = (id: string) => places.find((p) => p.id === `p-${id}`)!;
    // Indices recopiés de l'Index (l.187 Altdorf, l.227 Kemperbad, l.221 Grünburg, l.237 Ubersreik).
    expect(place('altdorf').market).toMatchObject({ taille: 4, richesse: 5, produits: ['commerce-terre'] });
    expect(place('kemperbad').market).toMatchObject({ taille: 3, richesse: 4, wineBonusEchelons: 2 });
    expect(place('grunburg').market).toMatchObject({ taille: 3, richesse: 2, produits: ['commerce-terre'] });
    expect(place('ubersreik').market).toMatchObject({ taille: 3, richesse: 4 });
    // Chaque Lieu de la carte a un marché (LandMarketProfile) et est relié par barge.
    expect(places.every((p) => p.market)).toBe(true);
    expect(scenConstruit.worldMap!.routes.every((r) => r.modes.includes('barge'))).toBe(true);
    // Les Hameaux (Taille 1) restent hors carte mais dans les données (l.139).
    expect(REIK_INDEX.some((e) => e.taille === 1)).toBe(true);
    expect(places.some((p) => p.id === 'p-furtild')).toBe(false);
  });
});

describe('Scénario Commerce fluvial — qui tient la barre', () => {
  beforeEach(launch);

  it('Gunnar (Voile 40) mène la Navigation de la barge ; Otto, sans Voile, ne la tente pas (LDB 09 l.30)', () => {
    // Otto devient le plus agile du groupe : sans la porte `peutTenter`, sa Voile non augmentée l'élirait.
    banc.setState({ party: get().party.map((h) => (h.id === 'com-otto' ? { ...h, characteristics: { ...h.characteristics, agilite: 95 } } : h)) });
    drainCascade();
    get().partirEnVoyage('r-grunburg-altdorf', 'barge', { cadence: 'jourParJour' });
    const barre = get().pendingCascade?.participants.find((p) => p.kind === 'fleuveNavigation');
    expect(barre?.actorId).toBe('com-gunnar');
  });

  it('la barre se lit à la Voile (Chaland) de Gunnar, sa seule instance : Agilité + 40 (LDB 09 l.40)', () => {
    drainCascade();
    const gunnar = get().party.find((h) => h.id === 'com-gunnar')!;
    expect(gunnar.skills.filter((k) => k.id === 'voile').map((k) => [k.spec, k.advances])).toEqual([['chaland', 40]]);
    get().partirEnVoyage('r-grunburg-altdorf', 'barge', { cadence: 'jourParJour' });
    const barre = get().pendingCascade?.participants.find((p) => p.kind === 'fleuveNavigation');
    expect(barre?.base).toBe(gunnar.characteristics.agilite + 40);
  });
});

describe('Scénario Commerce fluvial — boucle acheter → barge → revendre avec PROFIT', () => {
  beforeEach(launch);

  it('achète une cargaison à Grünburg, descend le Reik en barge (convoi persistant) et la revend plus cher à Altdorf', () => {
    // Bourse large pour garantir l'achat du LOT PLEIN (pas de surcoût de lot partiel, l.131).
    distributeCredit(get, banc.setState, { gold: 200000, silver: 0, brass: 0 });
    expect(get().scene?.id).toBe('quai-grunburg');

    // ── ACHAT à Grünburg (R 2) ──
    seedBattleRng(7);
    get().ouvrirLeMarche();
    get().jetValider('etalLot'); // #1426 : la fenêtre de LOT s'ouvre d'abord ; l'étal se pose à sa validation
    drainCascade(); // #274 : le Test de Ragot est surfacé par la porte (héros piloté-humain → modale)
    const offers = get().landMarket!.offers;
    expect(offers.length).toBeGreaterThan(0);
    const offer = offers[0];
    // La Contenance du chariot est un plafond RÉEL (#327) : on charge ce qui TIENT (lot potentiellement partiel).
    const carrierId = primaryCargoCarrier(get())!.id;
    const buyEnc = Math.min(carrierFreeEnc(primaryCargoCarrier(get())!), offer.enc);
    const purseBeforeBuy = toBrass(partyMoneyTotal(get));
    acheterAuMarche(get, 'marcheDeTerre', carrierId, offer.cargoId, buyEnc);
    const spent = purseBeforeBuy - toBrass(partyMoneyTotal(get));
    expect(spent).toBeGreaterThan(0);
    expect(primaryCargoCarrier(get())!.cargo.length).toBe(1);
    expect(primaryCargoCarrier(get())!.cargo[0].cargoId).toBe(offer.cargoId);
    const lotId = primaryCargoCarrier(get())!.cargo[0].uid;
    get().fenetreFermer('marcheDeTerre');

    // ── DESCENTE du Reik en BARGE (le convoi voyage avec le groupe) ──
    bargeTo('r-grunburg-altdorf', 'p-altdorf');
    expect(get().travelPlan).toBeNull();
    expect(get().lieu).toBe('p-altdorf'); // arrivé à la capitale
    expect(primaryCargoCarrier(get())!.cargo.length).toBe(1); // cargaison PERSISTÉE pendant le voyage

    // ── VENTE à Altdorf (Florissant R 5 → Mise à prix +10 %, l.156) ──
    seedBattleRng(3);
    get().ouvrirLeMarche();
    get().jetValider('etalLot');
    drainCascade();
    const purseBeforeSell = toBrass(partyMoneyTotal(get));
    // Le dé d'acheteur est un dé de MONDE : le joueur le LANCE dans sa fenêtre (#1426), et la vente
    // s'enchaîne sur ses maillons différés (mise à prix, Marchandage).
    get().fenetreChoisir('marcheDeTerre', 'vendre', lotId);
    draineCascadeDifferee(get, () => banc.reprendreTout());
    const earned = toBrass(partyMoneyTotal(get)) - purseBeforeSell;
    expect(earned).toBeGreaterThan(0);
    // La cargaison a rapporté PLUS qu'elle n'a coûté à l'achat → profit prouvé (boucle MSRC 13 l.11-13).
    expect(earned).toBeGreaterThan(spent);
    expect(primaryCargoCarrier(get())!.cargo.length ?? 0).toBe(0); // lot vendu en entier
  });
});

/**
 * #2545 — la descente COMMANDÉE (ordres par défaut, `DEFAULT_VOYAGE_ORDERS`) se résout sans fenêtre par
 * jet : le jour se joue d'un bloc (`runCascadeImmediate`) et le dé d'Exposition hydrique comme son Test
 * (MSRC 16 l.5-13) sont des Tests de route sous ordres (`voyageCadence.KINDS_SOUS_ORDRES`). Aucune
 * fenêtre n'en montre les dés : chacun laisse sa ligne au journal.
 */
describe('Scénario Commerce fluvial — descente commandée sans fenêtre (#2545)', () => {
  beforeEach(launch);

  /** Descend jusqu'à l'arrivée en dormant aux haltes et en FORÇANT chaque barrage (MSRC 7 l.128) :
   *  rend chaque fenêtre de JET rencontrée ; les décisions tranchées s'accumulent dans `decisions`. */
  function descendre(cadence?: 'jourParJour', decisions: string[] = []): string[] {
    drainCascade(); // l'entrée de scène du lanceur (affichage, aucun jet)
    const fenetres: string[] = [];
    get().partirEnVoyage('r-grunburg-altdorf', 'barge', cadence ? { cadence } : undefined);
    for (let i = 0; i < 40 && get().travelPlan; i++) {
      const p = get().pendingCascade;
      const cur = p?.participants[p.cursor];
      if (p && cur?.options && cur.chosen == null) {
        decisions.push(cur.kind);
        avanceEtapeCascade(get, undefined, () => 'forcer');
        continue;
      }
      if (p) { fenetres.push(p.purpose); break; }
      if (get().pendingRest) get().fenetreValider('repos');
    }
    return fenetres;
  }

  /** Le barrage de la descente (MSRC 7 l.128) POSÉ : sa chance d'auteur sur la route, donnée éditable, passe à 100 %. */
  function barragePose(): void {
    const wm = get().worldMap!;
    banc.setState({ worldMap: { ...wm, routes: wm.routes.map((r) => (r.id !== 'r-grunburg-altdorf' ? r
      : { ...r, riverPerils: (r.riverPerils ?? []).map((pe) => (pe.perilId === 'barrage' ? { ...pe, chancePct: 100 } : pe)) })) } });
  }

  it('graine 5, cadence par défaut, barrage posé : aucune fenêtre de jour ni d’Exposition jusqu’à Altdorf, chaque jet au journal', () => {
    seedBattleRng(5);
    barragePose();
    // Le journal du store est plafonné : chaque ligne se capte à son puits (`ecrireAuJournal`), le temps de la descente.
    const journal: string[] = [];
    const puits = get().ecrireAuJournal;
    banc.setState({ ecrireAuJournal: (msg) => { journal.push(...(Array.isArray(msg) ? msg : [msg])); puits(msg); } });
    const decisions: string[] = [];
    try {
      expect(descendre(undefined, decisions), 'aucune fenêtre de jet sur la descente').toEqual([]);
    } finally {
      banc.setState({ ecrireAuJournal: puits });
    }
    expect(decisions.length, 'le barrage posé est rencontré').toBeGreaterThan(0);
    expect(new Set(decisions), 'le barrage (MSRC 7 l.128) est la seule décision de la descente').toEqual(new Set(['fleuveChoixDObstacle']));
    expect(get().lieu).toBe('p-altdorf');
    const jours = journal.filter((l) => /^Progression du jour/.test(l)).length;
    expect(jours, `journal :\n${journal.join('\n')}`).toBeGreaterThan(1);
    // Un dé d'Exposition par jour, et un Test de Résistance par héros pour chaque exposition.
    expect(journal.filter((l) => /^Exposition hydrique : \d+\/\d+ → /.test(l)).length).toBe(jours);
    const expositions = journal.filter((l) => /^Exposition hydrique : \d+\/\d+ → exposition\.$/.test(l)).length;
    expect(expositions).toBeGreaterThan(0);
    expect(journal.filter((l) => / — Résistance : \d+\/\d+ → /.test(l)).length).toBe(expositions * get().party.length);
    // MSRC 5 l.13, l.17 ; #2588 (issuecomment-6124973279).
    expect(journal.filter((l) => / — Agilité : \d+\/\d+ → /.test(l)), 'le barreur a Voile : aucune Agilité').toEqual([]);
  });

  it('graine 7, JOUR-PAR-JOUR : le même jour ouvre sa fenêtre', () => {
    seedBattleRng(7);
    expect(descendre('jourParJour')).toEqual(['travelDay']);
  });
});
