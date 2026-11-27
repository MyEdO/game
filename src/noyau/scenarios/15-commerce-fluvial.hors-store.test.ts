import { idsDeTest } from '../../engine/idsDeTest.testkit';
import { acheterAuMarche } from '../cargaison.testkit';
import { describe, it, expect, beforeEach, onTestFinished } from 'vitest';
import { ouvrirLeBanc, type Banc } from '../banc.testkit';
import { lancerLeScenario } from '../lancementDeScenario';
import { lancementDuScenario } from '../../scenes/test-scenarios/_shared';
import { testScenarios } from '../../scenes/test-scenarios/index';
import { seedBattleRng } from '../../noyau/battleRng';
import { fromBrass, toBrass } from '../../engine/money';
import { distributeCredit, drainGroup, partyMoneyTotal, payFromGroup } from '../../noyau/bourseFlow';
import { riverNavigation } from '../../data';
import { damageCampaignVessel, setVesselHull } from '../seaVoyageFlow';
import { CAMPAIGN_VESSEL_CARRIER_ID, primaryCargoCarrier } from '../../noyau/carriers';
import { resetDesFixes, setDesFixes } from '../../engine/fixedDie';
import { encDeLaCapacite } from '../../engine/items';
import { testValue } from '../../engine/skills';
import { appliquerLIntentionDUnSiege } from '../intentionsDeSiege';
import { lieuEnVue } from '../lieuEnVue';
import { avanceEtapeCascade, draineCascade, draineCascadeDifferee, draineEtapes, inexplique, type PoseDe } from '../../noyau/cascade.testkit';
import { carrierFreeEnc } from '../../engine/cargo';
import { REIK_INDEX } from '../../scenes/test-scenarios/_reik-index';
import type { VoyageCadence } from '../voyageCadence';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

/**
 * « Commerce fluvial (le Reik) » — le commerce de cargaison MSRC 13 rendu JOUABLE. Vérifie (1) que la
 * carte porte les VRAIES localités marchandes de l'Index géographique avec leurs indices verbatim, et
 * (2) la BOUCLE complète du marchand : acheter à Grünburg → descendre le Reik en barge (sa cargaison persiste)
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
function drainCascade(poser?: PoseDe): void {
  draineCascade(get, 200, poser, () => 'forcer');
}

function terminerLeVoyage(destPlaceId: string, poser?: PoseDe): void {
  for (let i = 0; i < 60; i++) {
    if (!get().travelPlan && get().lieu === destPlaceId) return;
    // Les jets du JOUR fluvial (et l'exposition) sont une cascade influençable : la drainer.
    if (get().pendingCascade) { drainCascade(poser); continue; }
    if (get().pendingRest) { get().fenetreValider('repos'); drainCascade(poser); continue; }
    if (!get().travelPlan) return;
  }
}

function bargeTo(routeId: string, destPlaceId: string, poser?: PoseDe): void {
  get().partirEnVoyage(routeId, 'barge-fluviale');
  terminerLeVoyage(destPlaceId, poser);
}

describe('Scénario Commerce fluvial — carte fidèle à l’Index géographique (MSRC 13)', () => {
  it('est dans la section Marché, avec les VRAIES localités du Reik et leurs indices verbatim', () => {
    expect(scen.category).toBe('marche');
    const places = scenConstruit.worldMap!.places;
    const place = (id: string) => places.find((p) => p.id === `p-${id}`)!;
    // Indices recopiés de l'Index (l.187 Altdorf, l.227 Kemperbad, l.221 Grünburg, l.237 Ubersreik).
    expect(place('altdorf')).toMatchObject({ taille: 4, market: { richesse: 5, produits: ['commerce-terre'] } });
    expect(place('kemperbad')).toMatchObject({ taille: 3, market: { richesse: 4, wineBonusEchelons: 2 } });
    expect(place('grunburg')).toMatchObject({ taille: 3, market: { richesse: 2, produits: ['commerce-terre'] } });
    expect(place('ubersreik')).toMatchObject({ taille: 3, market: { richesse: 4 } });
    // Chaque Lieu de la carte a un marché (LandMarketProfile) et est relié par barge.
    expect(places.every((p) => p.market)).toBe(true);
    expect(scenConstruit.worldMap!.routes.every((r) => r.modes.includes('barge-fluviale'))).toBe(true);
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
    get().partirEnVoyage('r-grunburg-altdorf', 'barge-fluviale', { cadence: 'jourParJour' });
    const barre = get().pendingCascade?.participants.find((p) => p.kind === 'fleuveNavigation');
    expect(barre?.actorId).toBe('com-gunnar');
  });

  it('la barre se lit à la Voile (Chaland) de Gunnar, sa seule instance : Agilité + 40 (LDB 09 l.40)', () => {
    drainCascade();
    const gunnar = get().party.find((h) => h.id === 'com-gunnar')!;
    expect(gunnar.skills.filter((k) => k.id === 'voile').map((k) => [k.spec, k.advances])).toEqual([['chaland', 40]]);
    get().partirEnVoyage('r-grunburg-altdorf', 'barge-fluviale', { cadence: 'jourParJour' });
    const barre = get().pendingCascade?.participants.find((p) => p.kind === 'fleuveNavigation');
    expect(barre?.base).toBe(gunnar.characteristics.agilite + 40);
  });
});

describe('Scénario Commerce fluvial — boucle acheter → barge → revendre avec PROFIT', () => {
  beforeEach(launch);

  it('achète une cargaison à Grünburg, descend le Reik avec la cargaison en cale et la revend plus cher à Altdorf', () => {
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
    // #327
    const carrierId = primaryCargoCarrier(get())!.id;
    expect(carrierId).toBe(CAMPAIGN_VESSEL_CARRIER_ID);
    const buyEnc = Math.min(carrierFreeEnc(primaryCargoCarrier(get())!), offer.enc);
    const purseBeforeBuy = toBrass(partyMoneyTotal(get));
    acheterAuMarche(get, 'marcheDeTerre', carrierId, offer.cargoId, buyEnc);
    const spent = purseBeforeBuy - toBrass(partyMoneyTotal(get));
    expect(spent).toBeGreaterThan(0);
    expect(primaryCargoCarrier(get())!.cargo.length).toBe(1);
    expect(primaryCargoCarrier(get())!.cargo[0].cargoId).toBe(offer.cargoId);
    const lotId = primaryCargoCarrier(get())!.cargo[0].uid;
    get().fenetreFermer('marcheDeTerre');

    // ── DESCENTE du Reik en BARGE ──
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

describe('Scénario Commerce fluvial — réparation permanente à la cale sèche (MSRC 7 l.109-111)', () => {
  const ROUTE = 'r-grunburg-altdorf';
  const CRITIQUE = 'Critique témoin';
  const REPARATIONS = ['reparerLeNavire', 'reparerParLeGroupe'] as const;
  const TEST = 'fleuve-reparation-permanente';
  const DEGATS = 'fleuve-reparation-permanente-degats';
  const DUREE = 'fleuve-reparation-permanente-duree';
  const navigationReussie: PoseDe = (etape) => etape.kind === 'fleuveNavigation' ? 10 : undefined;

  beforeEach(() => {
    setDesFixes(true);
    onTestFinished(resetDesFixes);
    const lancement = lancementDuScenario(scen, idsDeTest);
    const carte = lancement.worldMap!;
    const routes = carte.routes.map((r) => r.id === ROUTE ? { ...r, riverPerils: [], riverExposure: undefined } : r);
    lancerLeScenario(get, banc.setState, {
      ...lancement,
      worldMap: { ...carte, routes },
      vessel: { ...lancement.vessel!, criticals: [CRITIQUE] },
    });
    drainCascade();
  });

  function gestesDeLaCale() {
    const lieu = lieuEnVue(get());
    expect(lieu, 'écran du lieu ouvert').not.toBeNull();
    return lieu!.services.find((s) => s.id === 'cale-seche')?.gestes ?? [];
  }

  function jouerLOffre(verbe: typeof REPARATIONS[number]) {
    const offre = gestesDeLaCale().find((g) => g.geste.verbe === verbe);
    expect(offre?.refus).toBeNull();
    const geste = offre!.geste;
    if (geste.verbe !== 'reparerLeNavire' && geste.verbe !== 'reparerParLeGroupe') throw new Error(geste.verbe);
    expect(geste.args).toEqual([]);
    get()[geste.verbe]();
  }

  function arriverAAltdorf() {
    seedBattleRng(7);
    bargeTo(ROUTE, 'p-altdorf', navigationReussie);
    expect(get().travelPlan).toBeNull();
    expect(get().lieu).toBe('p-altdorf');
    expect(get().vessel?.escale).toBe('p-altdorf');
    expect(get().travelRecap?.status, 'le récit de la descente tient la main à l’accostage').toBe('arrived');
    get().fenetreFermer('recitDeVoyage');
    expect(gestesDeLaCale().map(({ geste, refus }) => [geste, refus])).toEqual(
      REPARATIONS.map((verbe) => [{ verbe, args: [] }, null]),
    );
  }

  function etatDeLaReparation() {
    return {
      coque: get().vessel!.wounds!,
      critiques: get().vessel!.criticals,
      cuivre: toBrass(partyMoneyTotal(get)),
      minutes: get().gameTime,
    };
  }

  function reussirLaReparation(degats: number, heures: number) {
    const tirages: Record<string, number> = { [TEST]: 25, [DEGATS]: degats, [DUREE]: heures };
    const etapes = draineEtapes(get, 3, (etape) => tirages[etape.kind]);
    expect(etapes.map((etape) => etape.kind)).toEqual([TEST, DEGATS, DUREE]);
    expect(etapes.slice(1).map((etape) => etape.de?.spec)).toEqual([{ n: 1, sides: 10 }, { n: 1, sides: 10 }]);
    expect(etapes[1].de?.spec).not.toBe(riverNavigation.permanentRepairWounds.dice);
    expect(etapes[2].de?.spec).not.toBe(riverNavigation.permanentRepairHours.dice);
    drainCascade();
    expect(get().pendingCascade).toBeNull();
  }

  it('amarrage à Grünburg, Test des deux réparateurs à Altdorf, retour avec la même barge réparée', () => {
    const uid = get().vessel?.uid;
    expect(uid).toBeTruthy();
    expect(get().vessel?.escale).toBe('p-grunburg');
    get().ouvrirLeLieu();
    expect(gestesDeLaCale()).toEqual([]);
    const avantDepart = etatDeLaReparation();
    for (const verbe of REPARATIONS) {
      get()[verbe]();
      expect(get().pendingCascade).toBeNull();
      expect(etatDeLaReparation()).toEqual(avantDepart);
    }

    arriverAAltdorf();
    expect(get().vessel?.uid).toBe(uid);
    const avant = etatDeLaReparation();

    jouerLOffre('reparerLeNavire');
    const constructeur = get().pendingCascade!.participants[0];
    expect(constructeur).toMatchObject({ kind: TEST, worldOwner: true, target: 65, teste: { skill: { id: 'metier', spec: 'construction-de-bateaux' } } });
    expect(constructeur.actorId).toBeUndefined();
    expect(draineCascade(get, 10, () => 98)).toEqual([TEST]);
    expect(etatDeLaReparation()).toEqual(avant);

    expect(encDeLaCapacite(get().party, 'shipParts')).toBe(0);
    jouerLOffre('reparerParLeGroupe');
    const gunnar = get().party.find((p) => p.id === 'com-gunnar')!;
    const charpentier = get().pendingCascade!.participants[0];
    const competence = { id: 'metier', spec: 'charpentier' };
    expect(charpentier).toMatchObject({ kind: TEST, actorId: gunnar.id, teste: { skill: competence } });
    expect(charpentier.target).toBe(testValue(gunnar, { skill: competence }) - 10);
    expect(charpentier.mods?.map((m) => m.value)).toContain(-10);
    expect(inexplique(charpentier)).toBe(0);
    reussirLaReparation(3, 2);
    const apresGroupe = etatDeLaReparation();
    expect(apresGroupe).toEqual({
      ...avant,
      coque: { ...avant.coque, current: avant.coque.current + 3 },
      minutes: avant.minutes + 2 * 60,
    });

    jouerLOffre('reparerLeNavire');
    reussirLaReparation(9, 4);
    const apresConstructeur = etatDeLaReparation();
    const restaure = apresGroupe.coque.max - apresGroupe.coque.current;
    expect(restaure).toBeGreaterThan(0);
    expect(restaure).toBeLessThan(9);
    expect(apresConstructeur).toEqual({
      coque: { ...apresGroupe.coque, current: apresGroupe.coque.max },
      critiques: [CRITIQUE],
      cuivre: apresGroupe.cuivre - toBrass({ gold: restaure, silver: 0, brass: 0 }),
      minutes: apresGroupe.minutes + 4 * 60,
    });

    seedBattleRng(7);
    get().partirEnVoyage(ROUTE, 'barge-fluviale', { cadence: 'jourParJour' });
    expect(get().travelPlan?.vehicle?.navireDeCampagneUid).toBe(uid);
    expect(get().vessel?.escale).toBeUndefined();
    expect(lieuEnVue(get())).toBeNull();
    terminerLeVoyage('p-grunburg', navigationReussie);
    expect(get().travelPlan).toBeNull();
    expect(get().lieu).toBe('p-grunburg');
    expect(get().vessel).toMatchObject({
      uid, escale: 'p-grunburg', wounds: apresConstructeur.coque, criticals: [CRITIQUE],
    });
    get().fenetreFermer('recitDeVoyage');
    expect(gestesDeLaCale()).toEqual([]);
  });

  it('une réparation temporaire devient permanente avec une bourse vide malgré les dégâts survenus pendant les travaux', () => {
    arriverAAltdorf();
    const max = get().vessel!.wounds!.max;
    setVesselHull(get, banc.setState, max, max);
    banc.setState({ vessel: { ...get().vessel!, reparationTemporaire: true } });
    drainGroup(get, banc.setState, partyMoneyTotal(get));
    const avant = etatDeLaReparation();
    expect(avant.cuivre).toBe(0);

    jouerLOffre('reparerLeNavire');
    expect(avanceEtapeCascade(get, () => 25)).toBe(TEST);
    damageCampaignVessel(get, banc.setState, 4);
    expect(get().vessel?.wounds?.current).toBe(max - 4);
    expect(draineCascade(get, 10, (etape) => etape.kind === DEGATS ? 9 : 4)).toContain(DUREE);
    expect(etatDeLaReparation()).toEqual({ ...avant, coque: { max, current: max - 4 }, minutes: avant.minutes + 4 * 60 });
    expect(get().vessel?.reparationTemporaire).toBeUndefined();
    expect(get().pendingCascade).toBeNull();
  });

  it('un crédit reçu après l’ouverture ne relève pas le plafond du devis accepté', () => {
    arriverAAltdorf();
    const avant = etatDeLaReparation();
    const coutAnnonce = toBrass({ gold: 2, silver: 0, brass: 0 });
    expect(payFromGroup(get, banc.setState, fromBrass(avant.cuivre - coutAnnonce))).toBe(true);
    jouerLOffre('reparerLeNavire');
    distributeCredit(get, banc.setState, { gold: 10, silver: 0, brass: 0 });
    const cuivreAvantTravaux = toBrass(partyMoneyTotal(get));

    reussirLaReparation(9, 4);
    expect(etatDeLaReparation()).toEqual({
      ...avant,
      coque: { ...avant.coque, current: avant.coque.current + 2 },
      cuivre: cuivreAvantTravaux - coutAnnonce,
      minutes: avant.minutes + 4 * 60,
    });
  });

  it.each(['bourse vidée', 'coque déjà réparée'])('les travaux déjà acceptés prennent le temps tiré avec %s', (imprevu) => {
    arriverAAltdorf();
    const garderLeCalfatage = imprevu === 'bourse vidée';
    if (garderLeCalfatage) banc.setState({ vessel: { ...get().vessel!, reparationTemporaire: true } });
    jouerLOffre('reparerLeNavire');
    expect(draineCascade(get, 2, (etape) => etape.kind === TEST ? 25 : 9)).toEqual([TEST, DEGATS]);

    if (garderLeCalfatage) drainGroup(get, banc.setState, partyMoneyTotal(get));
    else {
      const { max } = get().vessel!.wounds!;
      setVesselHull(get, banc.setState, max, max);
    }

    const avantLaDuree = etatDeLaReparation();
    expect(draineCascade(get, 10, () => 4)).toContain(DUREE);
    expect(etatDeLaReparation()).toEqual({ ...avantLaDuree, minutes: avantLaDuree.minutes + 4 * 60 });
    expect(get().vessel?.reparationTemporaire).toBe(garderLeCalfatage ? true : undefined);
    expect(gestesDeLaCale().find((offre) => offre.geste.verbe === 'reparerLeNavire')?.refus).toBeTruthy();
  });

  it('en coop, le siège du monde lance le Test du constructeur et le siège de Gunnar lance le sien', () => {
    arriverAAltdorf();
    banc.setState({
      net: { ...get().net, mode: 'hote', mySeat: 0, seatNames: { 0: 'Hôte', 1: 'Invité' }, ownership: { 'com-gunnar': 1 } },
    });
    for (const [verbe, siege] of [['reparerLeNavire', 0], ['reparerParLeGroupe', 1]] as const) {
      jouerLOffre(verbe);
      const etape = get().pendingCascade!.participants[0];
      expect(appliquerLIntentionDUnSiege(get, 1 - siege, 'jetLancer', ['cascade', etape.id])).toBe('refusee');
      expect(get().pendingCascade!.participants[0].result ?? null).toBeNull();
      expect(appliquerLIntentionDUnSiege(get, siege, 'jetLancer', ['cascade', etape.id])).toBe('appliquee');
      expect(get().pendingCascade!.participants[0].result).toBeTruthy();
      expect(appliquerLIntentionDUnSiege(get, siege, 'jetImposerLeResultat', ['cascade', 98, etape.id])).toBe('appliquee');
      expect(appliquerLIntentionDUnSiege(get, siege, 'jetValider', ['cascade'])).toBe('appliquee');
      drainCascade();
      expect(get().pendingCascade).toBeNull();
    }
  });
});

/**
 * #2545 — la descente COMMANDÉE (`{ cadence: 'commande' }`) se résout sans fenêtre par
 * jet : le jour se joue d'un bloc (`runCascadeImmediate`) et le dé d'Exposition hydrique comme son Test
 * (MSRC 16 l.5-13) sont des Tests de route sous ordres (`voyageCadence.KINDS_SOUS_ORDRES`). Aucune
 * fenêtre n'en montre les dés : chacun laisse sa ligne au journal.
 */
describe('Scénario Commerce fluvial — descente commandée sans fenêtre (#2545)', () => {
  beforeEach(launch);

  /** Descend jusqu'à l'arrivée en dormant aux haltes et en FORÇANT chaque barrage (MSRC 7 l.128) :
   *  rend chaque fenêtre de JET rencontrée ; les décisions tranchées s'accumulent dans `decisions`. */
  function descendre(cadence: VoyageCadence, decisions: string[] = []): string[] {
    drainCascade(); // l'entrée de scène du lanceur (affichage, aucun jet)
    const fenetres: string[] = [];
    get().partirEnVoyage('r-grunburg-altdorf', 'barge-fluviale', { cadence });
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

  it('graine 5, sous ordres, barrage posé : aucune fenêtre de jour ni d’Exposition jusqu’à Altdorf, chaque jet au journal', () => {
    seedBattleRng(5);
    barragePose();
    // Le journal du store est plafonné : chaque ligne se capte à son puits (`ecrireAuJournal`), le temps de la descente.
    const journal: string[] = [];
    const puits = get().ecrireAuJournal;
    banc.setState({ ecrireAuJournal: (msg) => { journal.push(...(Array.isArray(msg) ? msg : [msg])); puits(msg); } });
    const decisions: string[] = [];
    try {
      expect(descendre('commande', decisions), 'aucune fenêtre de jet sur la descente').toEqual([]);
    } finally {
      banc.setState({ ecrireAuJournal: puits });
    }
    expect(decisions.length, 'le barrage posé est rencontré').toBeGreaterThan(0);
    expect(new Set(decisions), 'le barrage (MSRC 7 l.128) est la seule décision de la descente').toEqual(new Set(['fleuveChoixDObstacle']));
    expect(get().lieu).toBe('p-altdorf');
    const jours = journal.filter((l) => /^Progression du jour/.test(l)).length;
    expect(jours, `journal :\n${journal.join('\n')}`).toBeGreaterThan(1);
    // Un dé d'Exposition par jour, et un Test de Résistance par héros pour chaque exposition.
    expect(journal.filter((l) => /^Exposition hydrique : \d+\/\d+, /.test(l)).length).toBe(jours);
    const expositions = journal.filter((l) => /^Exposition hydrique : \d+\/\d+, exposition\.$/.test(l)).length;
    expect(expositions).toBeGreaterThan(0);
    expect(journal.filter((l) => / — Résistance : \d+\/\d+, /.test(l)).length).toBe(expositions * get().party.length);
    // MSRC 5 l.13, l.17 ; #2588 (issuecomment-6124973279).
    expect(journal.filter((l) => / — Agilité : \d+\/\d+, /.test(l)), 'le barreur a Voile : aucune Agilité').toEqual([]);
  });

  it('graine 7, JOUR-PAR-JOUR : le même jour ouvre sa fenêtre', () => {
    seedBattleRng(7);
    expect(descendre('jourParJour')).toEqual(['travelDay']);
  });
});
