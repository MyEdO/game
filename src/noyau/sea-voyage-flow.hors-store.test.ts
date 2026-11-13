import { idsDeTest } from '../engine/idsDeTest.testkit';
import { fixtureText } from '../i18n/fixtureText';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { tousLesHerosDeScenario } from '../scenes/test-scenarios/_heros';
import {
  buildSeaPlan, portRepairVessel, installerLAmelioration, runSeaDay, continueSeaDayAfterCascade,
  resolvePortArrival, damageVesselHull, healVesselHull,
  buildOverspeedSteps, engineerOf, etapeDEquipage, SEA_BOARD_EVENT_TABLE, type SeaVoyageState,
} from './seaVoyageFlow';
import { seedBattleRng, battleRng } from './battleRng';
import { DIFFICULTY_MODIFIERS } from '../engine/types';
import { effectiveChar } from '../engine/characteristics';
import { partyBest, skillBaseValue, testValue } from '../engine/skills';
import { toBrass } from '../engine/money';
import { partyMoneyTotal, creditBourse } from './bourseFlow';
import { bourseOf } from '../engine/bourse';
import { itemFromTrappingById } from '../engine/items';
import type { VivresDeCale } from '../engine/provisions';
import { bankWithdraw } from './interludeFlow';
import { traumaById } from '../engine/trauma';
import { byId, maladies, species } from '../data';
import { setDataset, resetData } from '../data/overrides';
import { sousLeDe } from '../data/deDeLaTable.testkit';
import type { Combatant } from '../engine/types';
import { buildEncounter } from './monde/encounterAuthoring';
import { emptyScene, type Scene } from './monde/scene';
import type { WorldMap } from './worldMap';
import { formatDice, type RNG } from '../engine/dice';
import type { CascadeStep } from './pendings';
import { reprendreLeVoyage } from './travelFlow';
import { applyEffects, jouerFlowEntier, runFlow } from './combatEffects';
import { imposerLesD100 } from './battleRng.testkit';
import { EMPTY_FLOW } from '../engine/flowCore';
import { navigationDuNavire } from './shipCrew';
import { estCompetenceDePropulsion } from '../engine/propulsion';
import { applierDe, runCascadeImmediate, startCascade, tableStepDef } from './cascade';
import { inexplique, soutienDe, avanceEtapeCascade, draineCascade, type PoseDe, type ChoisitCle } from './cascade.testkit';
import { crewRoleValue } from '../engine/crewMorale';
import { findCrewRoleById, findVehicleById, resolveStake, testSkillLabel, voyageStakeRef } from '../data';
import { resultLine, buildBand } from './rollSeam';
import { rollLine } from './ligneDeJet';
import { t } from '../i18n';
import { checkBattleOver } from './combatFlow';
import { BOARD_EVENTS, seaBoardEventById } from '../engine/seaVoyage';
import type { RecapEvent } from './recapLine';
import { findSeaHazard } from '../engine/seaPerils';
import { overspeedRow, foulingEffects } from '../engine/seaNavigation';
import { setRule, resetRule } from '../engine/policy';
import { isOutOfAction } from '../engine/conditions';
import { WORLD_STEP_OWNER } from './pendings';
import { poserLeSiegeMJ, seatOwns } from './sieges';
import type { NetState } from './etat';
import { modalOwnerOf } from './modalArbiter';
import { contractDisease } from '../engine/disease';
import { makeRNG } from '../engine/dice';
import { ECHEC_SANS_JET, estJete } from '../engine/tests';
import { jete } from '../engine/tests.testkit';
import { hullNavalTraits } from '../engine/navalTraits';
import { avecLesTables, cleDeFixture } from './noyau.testkit';
import { tablesDuJeu } from './tablesDuJeu';
import { chargerLaSave, lireSave, snapshotSave } from './persistance/save';
import type { GenreDeCascade } from './tablesPosees';
import { desEnSuite } from '../engine/dice.testkit';
import { ligneDe } from '../engine/modLine.testkit';
import { RULE_REF } from '../engine/ruleRefs';
import { refDeRegle } from '../engine/reglesChiffrees';
import { blessuresSurLeProfil } from '../engine/combattantDeTest.testkit';

/** Le réseau où le siège 1, assis à la table (`siegesDeLaTable`), tient le rôle MJ. */
const mjAuSiege1 = (net: NetState): NetState => poserLeSiegeMJ({ ...net, seatNames: { ...net.seatNames, 1: 'MJ' } }, 1);

/**
 * VOYAGE MARITIME (7b) — la traversée jour par jour sur le navire de campagne (MDG 13/15), pilotée
 * par le pipeline CASCADE (#275 Ronde 2 cran 3) : un jour = `pendingCascade` `purpose:'travelDay'`,
 * Blessures de coque persistées sur `CampaignVessel` (#30), services portuaires. L'équipage hors
 * combat = les PJ (MDG 14 l.39).
 */
let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

const get = () => banc.getState();
const set: Banc['setState'] = (e) => banc.setState(e);

const seaMap: WorldMap = {
  id: 'm', label: 'Mer des Griffes',
  places: [
    { id: 'A', label: 'Salzenmund', pos: { x: 0, y: 0 }, scene: { id: 'port-a' } },
    { id: 'B', label: 'Erengrad', pos: { x: 10, y: 0 }, scene: { id: 'port-b' }, port: { taille: 3, richesse: 3, production: ['bois-mer'] } },
  ],
  routes: [{ id: 'r1', a: { id: 'A' }, b: { id: 'B' }, km: 550, modes: ['mer'], sea: true, seaHeading: 'est' }],
};

function freshState() {
  seedBattleRng(1); // jour 1 navigable → le Test de Progression se joue
  set({
    party: tousLesHerosDeScenario(idsDeTest).slice(0, 3),
    scene: { ...emptyScene('port-a', 2, 2), label: 'Port', layers: [{ z: 0, tiles: ['sol', 'sol', 'sol', 'sol'] }] },
    battle: null,
    worldMap: seaMap,
    lieu: 'A',
    travelPlan: null,
    travelRecap: null,
    pendingRest: null,
    pendingCascade: null,
    suspendedCascades: [],
    gameTime: 8 * 60, // 08:00 jour 0
    lastUpkeepDay: 0,
    vessel: { vehicleId: 'cogue', morale: { score: 75, lastMoraleWeek: 0, factors: [] } },
    journal: [],
  } as never);
}

/** Fait avancer LA cascade active d'UNE étape — pilote PARTAGÉ `cascade.testkit › avanceEtapeCascade`. */
function stepCascade(): void {
  avanceEtapeCascade(get);
}

describe('buildSeaPlan — appareillage sur le navire de campagne', () => {
  beforeEach(freshState);

  it('exige un navire de campagne ; la coque de trajet repart des Blessures PERSISTÉES (#30)', () => {
    set({ vessel: null } as never);
    expect(buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0])).toBeNull();
    freshState();
    set({ vessel: { ...get().vessel!, wounds: { current: 20, max: 50 } } });
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0])!;
    expect(plan.mode).toBe('mer');
    expect(plan.sea!.heading).toBe('est');
    expect(plan.vehicle!.wounds.current).toBe(20); // Blessures de coque persistantes
    expect(plan.sea!.daysToEvent).toBeGreaterThanOrEqual(1);
    expect(plan.sea!.daysToEvent).toBeLessThanOrEqual(10);
  });

  it('jette sans défaut silencieux si la route mer n\'a pas de seaHeading (#416, pit #408)', () => {
    expect(() => buildSeaPlan(get, 'r1', 'A', 'B', { km: 550 })).toThrow(/seaHeading/);
  });
});

describe('#296 — state.vessel SOURCE UNIQUE de la coque de trajet (non-divergence)', () => {
  beforeEach(freshState);

  it('un Dégât de coque en cours de traversée se lit IDENTIQUEMENT sur vessel (damageVesselHull)', () => {
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0])!;
    set({ travelPlan: plan });
    damageVesselHull(get, set, get().travelPlan!.vehicle!, 8);
    expect(get().vessel!.wounds!.current).toBe(get().travelPlan!.vehicle!.wounds.current);
    expect(get().vessel!.wounds!.current).toBe(plan.vehicle!.wounds.max - 8);
    healVesselHull(get, set, get().travelPlan!.vehicle!, 3);
    expect(get().vessel!.wounds!.current).toBe(get().travelPlan!.vehicle!.wounds.current);
    expect(get().vessel!.wounds!.current).toBe(plan.vehicle!.wounds.max - 5);
  });

  it('reprise après une interruption (combat naval) : la coque de trajet, périmée, est RECHARGÉE depuis vessel.wounds — la reprise n’écrase plus le writeback du combat', () => {
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0])!;
    set({ travelPlan: { ...plan, interrupted: true } }); // voyage interrompu, coque de trajet = état D'AVANT combat
    const intactMax = plan.vehicle!.wounds.max;
    // `finalizeBattle` (combatFlow.ts) a déjà écrit la fin du combat naval sur `vessel.wounds` — la copie
    // de travail embarquée dans `travelPlan.vehicle` n'a pas bougé (objet distinct de la coque de bataille).
    set({ vessel: { ...get().vessel!, wounds: { current: intactMax - 15, max: intactMax } } });
    expect(get().travelPlan!.vehicle!.wounds.current).not.toBe(intactMax - 15); // toujours périmée avant la reprise
    reprendreLeVoyage(get, set);
    // Le rechargement a eu lieu AVANT que `runSeaDay` ne reprenne — aucun Dégât ultérieur ne peut avoir
    // déjà écrasé vessel avec l'ancienne valeur (c'était le bug caché du #296).
    expect(get().vessel!.wounds!.current).toBe(intactMax - 15);
  });

  it('#308 — effet adjustVessel (valeur ABSOLUE d\'auteur) pendant une traversée active : travelPlan.vehicle et vessel restent d\'accord', () => {
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0])!;
    set({ travelPlan: plan });
    applyEffects(get, set, [{ type: 'adjustVessel', hullCurrent: 12, hullMax: plan.vehicle!.wounds.max }]);
    expect(get().vessel!.wounds!.current).toBe(12);
    expect(get().travelPlan!.vehicle!.wounds.current).toBe(12);
  });

  it('la journée close ne porte que le DELTA de coque ; après un soin, la coque vive suit et la chronique du jour clos garde son delta', () => {
    get().partirEnVoyage('r1', 'mer', { cadence: 'jourParJour' });
    const hull0 = get().travelPlan!.vehicle!.wounds.current;
    damageVesselHull(get, set, get().travelPlan!.vehicle!, 10);
    for (let i = 0; i < 30 && !get().pendingRest; i++) {
      if (!get().pendingCascade) break;
      stepCascade();
    }
    const day = get().travelPlan!.log!.slice(-1)[0]!;
    expect(day.sea!.hullDelta).toBe(-10); // ce que la journée a coûté à la coque
    // Réparation APRÈS la clôture : la surface vive suit, et la chronique du jour clos garde son delta.
    healVesselHull(get, set, get().travelPlan!.vehicle!, 10);
    expect(get().vessel!.wounds!.current).toBe(hull0);
    expect(day.sea!.hullDelta).toBe(-10);
  });
});

describe('journée en mer — la journée est UNE cascade `purpose:travelDay` (#275 Ronde 2 cran 3)', () => {
  beforeEach(freshState);

  it('partirEnVoyage(mer) déroule la journée : Progression et Orientation sont des étapes de la cascade ; la nuit = halte de repos', () => {
    const kinds: string[] = [];
    get().partirEnVoyage('r1', 'mer', { cadence: 'jourParJour' });
    // La cascade se déroule étape par étape — garde-fou 30 pas (événements/crises possibles).
    for (let i = 0; i < 30 && !get().pendingRest; i++) {
      const p = get().pendingCascade;
      if (!p) break;
      const cur = p.participants[p.cursor];
      if (cur) kinds.push(cur.kind);
      stepCascade();
    }
    expect(kinds).toContain('equipage-progression'); // Test quotidien de Progression (MDG 14 l.61, ch.15 l.78)
    expect(kinds).toContain('equipage-orientation'); // « un Test par jour de voyage » (MDG 13 l.311)
    expect(get().pendingRest).toBeTruthy(); // halte de nuit — machinerie de repos EXISTANTE
    expect(get().travelPlan!.sea!.daysAtSea).toBe(1);
    // La journée de mer s'arrête au CRÉPUSCULE (18:00) : la nuit de sommeil (halte) enjambe minuit —
    // un seul franchissement de jour par cycle jour+nuit (l'entretien s'y résout, après le repas).
    expect(get().gameTime).toBe(18 * 60); // départ 08:00 jour 0 → crépuscule du même jour
  });
});

/**
 * SEUIL DE SUCCÈS d'un Test d'équipage résolu PAR CASCADE (#1019) — MDG 14 l.13. La machinerie de batch
 * (`cascade.ts`) est sous quarantaine d'import naval (#328) : le flux propriétaire lui INJECTE son
 * prédicat (`reglesDeSucces['crew-test']`), l'étape ne portant que l'id.
 * Sans cette injection, une étape de voyage retomberait sur le seuil générique et IGNORERAIT la règle
 * optionnelle `equipage-zero-dr-succes`.
 */
describe('Test d’équipage par CASCADE — seuil de succès injecté par le flux naval (MDG 14 l.13, #1019)', () => {
  beforeEach(freshState);
  afterEach(() => resetRule('equipage-zero-dr-succes'));

  /** Avance la journée jusqu'à l'étape d'équipage `kind` (non encore jouée), et la rend. */
  function driveToCrewStep(kind: string): CascadeStep | undefined {
    for (let i = 0; i < 30 && !get().pendingRest; i++) {
      const p = get().pendingCascade;
      if (!p) break;
      const cur = p.participants[p.cursor];
      if (cur?.kind === kind) return cur;
      stepCascade();
    }
    return undefined;
  }

  /** Joue la journée jusqu'à l'étape `equipage-progression`, FORCE un total d'équipage de 0 DR (chaque
   *  contributeur à 0), valide, et rend le `result` agrégé de l'étape committée. */
  function crewStepAtZero(): { sl: number; success: boolean } {
    get().partirEnVoyage('r1', 'mer', { cadence: 'jourParJour' });
    const step = driveToCrewStep('equipage-progression');
    expect(step).toBeTruthy();
    expect(step!.meta?.aggregateSuccessRule).toBe('crew-test'); // le flux naval verse SON id de règle
    expect(Number(step!.meta?.aggregateFlatDR ?? 0)).toBe(0); // Moral 75, sans saboteur ni trait → total = Σ des DR
    const p = get().pendingCascade!;
    const zeroed = p.participants.map((s, i) => (i !== p.cursor ? s : {
      ...s, participants: s.participants!.map((part) => ({ ...part, result: { roll: 40, target: 40, sl: 0, success: true } })),
    }));
    set({ pendingCascade: { ...p, participants: zeroed } });
    get().jetValider('cascade'); // agrège via `aggregateBatchStep` → prédicat de succès du registre
    const committed = get().pendingCascade?.participants.find((s) => s.kind === 'equipage-progression') ?? zeroed[p.cursor];
    return { sl: committed.result!.sl, success: committed.result!.success };
  }

  it('DR total 0 → ÉCHEC par défaut (« 1 DR ou plus … est un succès », l.13)', () => {
    const r = crewStepAtZero();
    expect(r.sl).toBe(0);
    expect(r.success).toBe(false);
  });

  it('DR total 0 → SUCCÈS sous la règle optionnelle « 0 DR compte comme un succès » (l.13, 2ᵉ phrase)', () => {
    setRule('equipage-zero-dr-succes', true);
    const r = crewStepAtZero();
    expect(r.sl).toBe(0);
    expect(r.success).toBe(true); // le bord qui manquait avant l'injection
  });

  /**
   * MANQUE DE BRAS en VOYAGE (MDG 14 l.55) : « les résultats du Test d'équipage subissent −2 DR et ne
   * peuvent jamais être meilleurs qu'un Succès Minime » — la règle vise TOUT Test d'équipage, pas
   * seulement ceux du combat. L'attrition de campagne (`vessel.crewLost`, MDG 15 l.245) est la couture
   * qui la déclenche en mer ; le flux verse le −2/tranche ET le plafond CHIFFRÉ dans la `meta` neutre.
   */
  it('équipage décimé (crewLost) : la journée de mer subit −2 DR/tranche ET plafonne le total au Succès Minime', () => {
    // Cogue : équipage nominal 15 (vehicles.json) — 5 perdus = 33 % → 3 tranches de 10 % (l.55).
    set({ vessel: { ...get().vessel!, crewLost: 5 } });
    get().partirEnVoyage('r1', 'mer', { cadence: 'jourParJour' });
    const step = driveToCrewStep('equipage-progression');
    expect(step).toBeTruthy();
    expect(Number(step!.meta?.aggregateFlatDR ?? 0)).toBe(-6); // 3 tranches × −2 DR (l.55)
    expect(step!.meta?.aggregateCapTo).toBe(1); // « jamais mieux qu'un Succès Minime »

    // Même avec des contributeurs excellents, le total ne dépasse pas le Succès Minime.
    const p = get().pendingCascade!;
    const strong = p.participants.map((s, i) => (i !== p.cursor ? s : {
      ...s, participants: s.participants!.map((part) => ({ ...part, result: { roll: 5, target: 60, sl: 6, success: true } })),
    }));
    set({ pendingCascade: { ...p, participants: strong } });
    get().jetValider('cascade');
    const committed = get().pendingCascade?.participants.find((s) => s.kind === 'equipage-progression') ?? strong[p.cursor];
    expect(committed.result!.sl).toBe(1); // plafonné (sans plafond : 6×N − 10)
    expect(committed.result!.success).toBe(true); // un Succès Minime reste un succès (LDB 12 l.110)
  });

  /** Un PJ ÉPINGLÉ (`shipRole`) à la barre sans Voile — Compétence Avancée sans Augmentation (LDB 09 l.30). */
  function barreSansVoile(): string {
    const [a, b, c] = get().party;
    set({ party: [a, b, { ...c, shipRole: 'timonier', skills: c.skills.filter((sk) => sk.id !== 'voile') }] });
    return c.id;
  }

  it('membre qui ne peut pas tenter son rôle : N+1 rangées, dont UNE échec sans jet à refus nommé (LDB 09 l.30 ; #2588 Q1)', () => {
    const muet = barreSansVoile();
    get().partirEnVoyage('r1', 'mer', { cadence: 'jourParJour' });
    const rows = driveToCrewStep('equipage-progression')!.participants!;
    const sansJet = rows.filter((r) => r.result && !estJete(r.result));
    expect(sansJet.map((r) => r.id)).toEqual([muet]);
    expect(sansJet[0].result).toEqual(ECHEC_SANS_JET);
    expect(sansJet[0].refus).toBe(`${get().party[2].label} ne peut pas tenter le Test de Voile (Cogue).`);
    expect(sansJet[0].interactive).toBe(false);
    const tentables = rows.filter((r) => r.id !== muet);
    expect(tentables.length).toBeGreaterThan(0);
    expect(tentables.every((r) => r.result === null)).toBe(true); // les N autres attendent LEUR jet
  });

  it('membre qui ne peut pas tenter son rôle : total = Σ des N jets + DR plats (MDG 14 l.13)', () => {
    const muet = barreSansVoile();
    get().partirEnVoyage('r1', 'mer', { cadence: 'jourParJour' });
    const step = driveToCrewStep('equipage-progression')!;
    for (const r of step.participants!) if (r.id !== muet) get().jetLancer('cascadeEnBande', r.id);
    const p = get().pendingCascade!;
    const rolled = p.participants[p.cursor];
    const somme = rolled.participants!.filter((r) => r.id !== muet).reduce((t, r) => t + jete(r.result).sl * (r.essential ? 2 : 1), 0);
    get().jetValider('cascade');
    const committed = get().pendingCascade?.participants.find((s) => s.kind === 'equipage-progression') ?? rolled;
    expect(committed.result!.sl).toBe(somme + Number(rolled.meta?.aggregateFlatDR ?? 0));
  });

  it('membre qui ne peut pas tenter son rôle : ni jet, ni Résilience, ni Chance — aucun tirage consommé (LDB 09 l.30 ; #2588 Q1)', () => {
    const muet = barreSansVoile();
    get().partirEnVoyage('r1', 'mer', { cadence: 'jourParJour' });
    driveToCrewStep('equipage-progression');
    const avant = get().party.find((h) => h.id === muet)!;
    const points = { fortune: Math.max(1, avant.fortune ?? 0), resilience: Math.max(1, avant.resilience ?? 0) };
    Object.assign(avant, points);
    seedBattleRng(9);
    get().jetLancer('cascadeEnBande', muet);
    get().jetForcerLaReussite('cascadeEnBande', muet);
    get().jetAjouterUnDR('cascadeEnBande', muet);
    get().jetRelancer('cascadeEnBande', muet);
    const p = get().pendingCascade!;
    expect(p.participants[p.cursor].participants!.find((r) => r.id === muet)!.result).toEqual(ECHEC_SANS_JET);
    const apres = get().party.find((h) => h.id === muet)!;
    expect({ fortune: apres.fortune, resilience: apres.resilience }).toEqual(points); // aucun point dépensé
    expect(battleRng().int(1, 1_000_000)).toBe(makeRNG(9).int(1, 1_000_000));
  });

  it('équipage au complet : aucune pénalité de Manque de bras, aucun plafond', () => {
    get().partirEnVoyage('r1', 'mer', { cadence: 'jourParJour' });
    const step = driveToCrewStep('equipage-progression');
    expect(Number(step!.meta?.aggregateFlatDR ?? 0)).toBe(0);
    expect(step!.meta?.aggregateCapTo).toBeUndefined();
  });
});

describe('Carte marine (MDG 15) — Orientation & Planque (#147)', () => {
  beforeEach(freshState);

  function driveDayCaptureOrientation(): number | undefined {
    let extra: number | undefined;
    for (let i = 0; i < 30 && !get().pendingRest; i++) {
      const p = get().pendingCascade;
      if (!p) break;
      const cur = p.participants[p.cursor];
      // Dé-navalisation (#328) : Moral + sabotage + traits + carte sont versés DÉJÀ chiffrés dans le
      // modificateur plat NEUTRE `aggregateFlatDR`. À Moral 75 (bande crewTestDR 0), il isole la carte/sabotage.
      if (cur?.kind === 'equipage-orientation') extra = Number(cur.meta?.aggregateFlatDR ?? 0) || undefined;
      stepCascade();
    }
    return extra;
  }

  it('un héros portant une Carte marine → +2 DR au Test d’Orientation quotidien (règle maison mer-carte-orientation-dr)', () => {
    const chart = itemFromTrappingById('carte-marine', idsDeTest)!;
    set({ party: get().party.map((h, i) => (i === 0 ? { ...h, items: [...(h.items ?? []), chart] } : h)) } as never);
    get().partirEnVoyage('r1', 'mer', { cadence: 'jourParJour' });
    expect(driveDayCaptureOrientation()).toBe(2); // +2 DR de la carte (défaut de la règle éditable)
  });

  it('sans Carte marine → aucun bonus d’Orientation (extraDR absent)', () => {
    get().partirEnVoyage('r1', 'mer');
    expect(driveDayCaptureOrientation()).toBeUndefined();
  });

  it('#214 : un saboteur authoré sur la coque de campagne pèse (−DR) sur les Tests d’équipage de VOYAGE, clampé [-5,0]', () => {
    set({ vessel: { ...get().vessel!, saboteurDR: -3 } });
    get().partirEnVoyage('r1', 'mer', { cadence: 'jourParJour' });
    expect(driveDayCaptureOrientation()).toBe(-3); // MDG 14 l.45-47, cumulable avec le bonus Carte marine

    freshState();
    set({ vessel: { ...get().vessel!, saboteurDR: -9 } }); // hors fourchette RAW → clampé à -5
    get().partirEnVoyage('r1', 'mer', { cadence: 'jourParJour' });
    expect(driveDayCaptureOrientation()).toBe(-5);
  });

  it('Planque (l.292) : sûre tant que le dépositaire GARDE la carte, à découvert si elle est perdue', () => {
    const hero = get().party[0];
    // Stash chartSecured à rate 100 = découverte GARANTIE sans la carte → isole l'effet de la possession.
    const deposit = { uid: 'depot-1', heroId: hero.id, kind: 'planque' as const, brass: 1000, rate: 100, chartSecured: true };

    // (a) le héros GARDE la carte → EN SÛRETÉ : le trésor est récupéré malgré rate 100. Le retrait est
    // recrédité au DÉPOSITAIRE (interludeFlow `bankWithdrawInner`, SOCLE POSSESSIONS #531) — SA bourse.
    const chart = itemFromTrappingById('carte-marine', idsDeTest)!;
    set({ party: get().party.map((h, i) => (i === 0 ? { ...h, items: [chart] } : h)), bank: [deposit] } as never);
    bankWithdraw(get, set, 'depot-1');
    expect(get().bank).toHaveLength(0);
    expect(toBrass(bourseOf(get().party[0]))).toBe(1000); // récupéré sur la bourse du déposant

    // (b) la carte est PERDUE (héros sans carte) → même stash → DÉCOUVERT (rien récupéré).
    set({ party: get().party.map((h, i) => (i === 0 ? { ...h, items: [] } : h)), bank: [deposit] } as never);
    bankWithdraw(get, set, 'depot-1');
    expect(get().bank).toHaveLength(0);
    expect(toBrass(bourseOf(get().party[0]))).toBe(0);
  });
});

describe('Infestation de rats géants — Extermination des nuisibles Complexe (MDG 15 l.159-164)', () => {
  beforeEach(freshState);

  function driveDayCaptureExtermination(): number | undefined {
    let extra: number | undefined;
    for (let i = 0; i < 30 && !get().pendingRest; i++) {
      const p = get().pendingCascade;
      if (!p) break;
      const cur = p.participants[p.cursor];
      if (cur?.kind === 'equipage-extermination') extra = Number(cur.meta?.aggregateFlatDR ?? 0) || undefined;
      stepCascade();
    }
    return extra;
  }

  /** L'infestation que pose la rangée de la donnée, par un événement de bord FORCÉ. */
  function infestationDeLaDonnee(): NonNullable<NonNullable<ReturnType<typeof get>['vessel']>['infestation']> {
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0])!;
    set({ travelPlan: { ...plan, sea: { ...plan.sea!, forcedEventId: 'infestation-de-rats-geants' } } });
    runSeaDay(get, set);
    return get().vessel!.infestation!;
  }

  it('Complexe (–10) descend au Test d’équipage d’Extermination en −1 DR plat (même canal que l’Ouragan)', () => {
    get().partirEnVoyage('r1', 'mer', { cadence: 'jourParJour' });
    set({ vessel: { ...get().vessel!, infestation: { label: 'Infestation de rats géants', crewTestType: 'extermination-nuisibles', difficulty: 'complexe', drCible: 25, progres: 0, chaqueNuit: EMPTY_FLOW } } });
    expect(driveDayCaptureExtermination()).toBe(-1);
  });

  it('l’événement de bord FORCÉ pose l’infestation de la donnée sur le navire : Complexe, 25 DR', () => {
    const inf = infestationDeLaDonnee();
    expect(inf.difficulty).toBe('complexe');
    expect(inf.drCible).toBe(25);
    expect(inf.progres).toBe(0);
  });

  it('3d10 : un total NON multiple de 3 (ex. 4/7/11) est ATTEIGNABLE — 1d10×3 en interdirait 20/28', () => {
    const infestation = infestationDeLaDonnee();
    freshState();
    const vessel0 = get().vessel!;
    const contenance = findVehicleById(vessel0.vehicleId)!.ship!.capacity; // MDG 12 l.70-75
    const seen = new Set<number>();
    for (let seed = 1; seed <= 60; seed++) {
      freshState();
      set({ vessel: { ...vessel0, infestation, cargo: [{ uid: 'lot-1', cargoId: 'bois-mer', enc: contenance, basePriceGold: 1 }] } });
      const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0])!;
      set({ travelPlan: plan });
      const before = get().vessel!.cargo!.reduce((n, l) => n + l.enc, 0);
      seedBattleRng(seed);
      continueSeaDayAfterCascade(get, set);
      const after = get().vessel!.cargo!.reduce((n, l) => n + l.enc, 0);
      const spoiled = before - after;
      expect(spoiled).toBeGreaterThanOrEqual(3);
      expect(spoiled).toBeLessThanOrEqual(30);
      seen.add(spoiled);
    }
    expect([...seen].some((v) => v % 3 !== 0)).toBe(true);
  });
});

describe('Infestation — les rats attaquent sur une étape d’Extermination à DR négatif (MDG 15 l.161-164, l.176-178)', () => {
  beforeEach(freshState);
  afterEach(() => { resetRule('test-etendu-dr-minimum'); resetRule('equipage-zero-dr-succes'); });

  /** La journée de mer RÉELLE sous l'Infestation `ligne` de la donnée (son op appliquée par son Flow) : le d100 de
   *  chaque rangée de l'Extermination POSÉ à `d100(cible)`, la graine `graine` posée au moment de ce jet (elle tire
   *  les 1d10 heures puis le soir : `membreAuHasard`, dés de `chaqueNuit`). Rend l'état à la tombée de la nuit. */
  function journeeInfestee(ligne: 'infestation-de-rats-geants' | 'infestation-de-rats', d100: (cible: number) => number, graine: number) {
    const ev = seaBoardEventById(ligne)!;
    jouerFlowEntier(runFlow(get, set, ev.consequence!, ev.label));
    get().partirEnVoyage('r1', 'mer', { cadence: 'jourParJour' });
    for (let i = 0; i < 30 && !get().pendingRest; i++) {
      if (!get().pendingCascade) break;
      avanceEtapeCascade(get, (e, rangee) => (e.kind === 'equipage-extermination' && rangee ? (seedBattleRng(graine), d100(rangee.target!)) : undefined));
    }
    return get();
  }

  /** Les étapes de dé `nombre` d'attaques subies, en avant-plan comme derrière (`suspendedCascades`). */
  const etapesDAttaques = (s: ReturnType<typeof get>) => [s.pendingCascade, ...s.suspendedCascades]
    .flatMap((c) => c?.participants ?? []).filter((x) => x.kind === 'nombreDAttaquesSubies');

  /** Le dé `nombre` posé à 1 : la série d'une attaque s'ouvre, son d100 d'attaque et de localisation imposés (`des`),
   *  puis le héros perd sa Défense (97). Rend le coup tranché. */
  function uneAttaquePerdue(des: number[]) {
    avanceEtapeCascade(get, () => 1);
    expect(get().serieSubie).toBeTruthy();
    imposerLesD100(...des);
    get().jetLancer('defense');
    get().jetImposerLeResultat('defense', 97);
    const coup = get().pendingDefense!.result!;
    get().jetValider('defense');
    return coup;
  }

  it('Extermination à DR −1 : au soir, le dé `nombre` sur le héros tiré, la journée close, `chaqueNuit` jouée ; puis la série', () => {
    const s = journeeInfestee('infestation-de-rats-geants', (cible) => cible, 1);
    expect(s.travelPlan!.kmDone).toBeGreaterThan(0);
    expect(s.pendingRest).toBeTruthy();
    expect(s.vessel!.infestation!.assaillie).toBeUndefined();
    expect(s.journal).toContain(t('eff.membreAuHasardMarin'));
    expect(s.journal).toContain(t('eff.cargaisonPerdueEnc', { enc: 0 }));
    expect(s.pendingCascade).toMatchObject({ purpose: 'sequence' });
    const [etape, ...autres] = etapesDAttaques(s);
    expect(autres).toEqual([]);
    expect(etape).toMatchObject({ actorId: 'soldat-de-test', de: { spec: { n: 1, sides: 10 } } });
    expect(etape.meta!.attaquesSubies![0].assaillant.statblock).toMatchObject({ label: 'Rats géants', char: { 'capacite-de-combat': 35 } });
    avanceEtapeCascade(get, () => 3);
    expect(get().serieSubie).toMatchObject({ cibleId: 'soldat-de-test', restantes: 3 });
    expect(get().pendingDefense).toMatchObject({ attackerId: get().serieSubie!.assaillant.id, defenderId: 'soldat-de-test' });
  });

  it('échec à DR 0, `test-etendu-dr-minimum` désactivée : aucune attaque', () => {
    const s = journeeInfestee('infestation-de-rats', (cible) => cible + 1, 3);
    expect(s.pendingRest).toBeTruthy();
    expect(etapesDAttaques(s)).toEqual([]);
    expect(s.serieSubie).toBeNull();
  });

  it('échec à DR 0, `test-etendu-dr-minimum` activée : l’étape compte −1 DR, les rats attaquent (LDB 12 l.185)', () => {
    setRule('test-etendu-dr-minimum', true);
    const s = journeeInfestee('infestation-de-rats', (cible) => cible + 1, 3);
    expect(s.pendingRest).toBeTruthy();
    expect(etapesDAttaques(s).map((e) => e.actorId)).toEqual(['soldat-de-test']);
  });

  it('réussite à DR 0, `test-etendu-dr-minimum` activée : l’étape compte +1 DR, aucune attaque (LDB 12 l.185 ; MDG 14 l.13)', () => {
    setRule('test-etendu-dr-minimum', true);
    setRule('equipage-zero-dr-succes', true);
    const s = journeeInfestee('infestation-de-rats', (cible) => cible, 3);
    expect(s.vessel!.infestation!.progres).toBe(1);
    expect(etapesDAttaques(s)).toEqual([]);
  });

  it('rats géants : une touche qui blesse expose à la fièvre du rongeur (MDG 15 l.164)', () => {
    journeeInfestee('infestation-de-rats-geants', (cible) => cible, 1);
    const coup = uneAttaquePerdue([20, 23]);
    expect(coup.hit && (coup.woundsLost ?? 0) > 0).toBe(true);
    const s = get();
    expect(s.serieSubie).toBeNull();
    expect(s.pendingCascade!.participants.filter((x) => x.kind === 'maladieDeFinDeCombat').map((x) => [x.meta?.disease, x.participants!.map((p) => p.id)]))
      .toEqual([['fievre-du-rongeur', ['soldat-de-test']]]);
  });

  it('rats : une touche qui blesse n’expose à aucune maladie (MDG 15 l.178)', () => {
    journeeInfestee('infestation-de-rats', (cible) => cible + 10, 1);
    const coup = uneAttaquePerdue([20, 23]);
    expect(coup.hit && (coup.woundsLost ?? 0) > 0).toBe(true);
    const s = get();
    expect(s.serieSubie).toBeNull();
    expect((s.pendingCascade?.participants ?? []).filter((x) => x.kind === 'maladieDeFinDeCombat')).toEqual([]);
  });

  it('rats (Très petite) contre un héros halfling (Petite) : la ligne « plus petit » +10 est dans leur jet (LDB 85 l.366)', () => {
    set({ party: tousLesHerosDeScenario(idsDeTest).filter((h) => h.id === 'voleur-de-test') });
    expect(get().party[0].size).toBe('petite');
    journeeInfestee('infestation-de-rats', (cible) => cible + 10, 1);
    avanceEtapeCascade(get, () => 1);
    const pd = get().pendingDefense!;
    expect(pd.defenderId).toBe('voleur-de-test');
    expect(ligneDe(pd.atkCompo!.difficultyParts, refDeRegle('taille-modificateurs-en-combat'))?.value).toBe(10);
  });

  it('un marin tiré au sort : aucune série, une ligne au journal (MDG 15 l.161)', () => {
    const avant = get().journal.length;
    const s = journeeInfestee('infestation-de-rats-geants', (cible) => cible, 13);
    expect(s.pendingRest).toBeTruthy();
    expect(etapesDAttaques(s)).toEqual([]);
    expect(s.serieSubie).toBeNull();
    expect(s.journal.slice(avant).filter((l) => l === t('eff.membreAuHasardMarin'))).toHaveLength(1);
  });

  it('le marqueur `assaillie` et `surDRNegatif` traversent une sauvegarde puis un chargement (MDG 15 l.161, l.176)', () => {
    const ev = seaBoardEventById('infestation-de-rats-geants')!;
    jouerFlowEntier(runFlow(get, set, ev.consequence!, ev.label));
    const { vessel } = get();
    const infestation = vessel!.infestation!;
    set({ vessel: { ...vessel!, infestation: { ...infestation, assaillie: true } } });
    const lu = lireSave(JSON.stringify(snapshotSave(get(), '2026-11-12T00:00:00Z')));
    if (typeof lu === 'string') throw new Error(lu);
    const { etat } = chargerLaSave(lu);
    expect(etat.vessel!.infestation!.assaillie).toBe(true);
    expect(etat.vessel!.infestation!.surDRNegatif).toEqual(infestation.surDRNegatif);
  });
});

describe('Phare du port d’arrivée — Test de Perception VISUEL (MDG 13 l.337) : la Surdité ne pénalise pas', () => {
  const lighthouseMap: WorldMap = {
    id: 'm2', label: 'Mer des Griffes',
    places: [
      { id: 'A', label: 'Salzenmund', pos: { x: 0, y: 0 }, scene: { id: 'port-a' } },
      { id: 'B', label: 'Erengrad', pos: { x: 10, y: 0 }, scene: { id: 'port-b' }, port: { taille: 3, richesse: 3, production: [], lighthouse: true } as never },
    ],
    routes: [{ id: 'r1', a: { id: 'A' }, b: { id: 'B' }, km: 1, modes: ['mer'], sea: true, seaHeading: 'est' }],
  };

  function freshLighthouseState() {
    seedBattleRng(1);
    const [a, b] = tousLesHerosDeScenario(idsDeTest);
    const vigie = { ...a, skills: [{ id: 'perception', characteristic: 'initiative', advances: 0 }], traumas: [traumaById('surdite', undefined, 'tete')] };
    const timonier = { ...b, skills: [{ id: 'voile', spec: 'cogue', characteristic: 'dexterite', advances: 30 }], traumas: [] };
    set({
      party: [vigie, timonier],
      scene: { ...emptyScene('port-a', 2, 2), label: 'Port', layers: [{ z: 0, tiles: ['sol', 'sol', 'sol', 'sol'] }] },
      battle: null,
      worldMap: lighthouseMap,
      lieu: 'A',
      travelPlan: null,
      travelRecap: null,
      pendingRest: null,
      pendingCascade: null,
      suspendedCascades: [],
      gameTime: 8 * 60,
      lastUpkeepDay: 0,
      vessel: { vehicleId: 'cogue', morale: { score: 75, lastMoraleWeek: 0, factors: [] } },
      journal: [],
    } as never);
  }

  it('la Vigie SOURDE n’est PAS pénalisée au Test de Perception du phare (sense "vue" posé par kind "equipage-phare")', () => {
    freshLighthouseState();
    get().partirEnVoyage('r1', 'mer', { cadence: 'jourParJour' });
    let phare: CascadeStep | undefined;
    let progression: CascadeStep | undefined;
    for (let i = 0; i < 30 && !phare; i++) {
      const p = get().pendingCascade;
      if (!p) break;
      const cur = p.participants[p.cursor];
      if (cur?.kind === 'equipage-phare') { phare = cur; break; }
      if (cur?.kind === 'equipage-progression') progression = cur;
      // Le choix de Progression (MDG 14 l.63) se répond par défaut — voie d'équipage.
      if (cur?.options && !cur.chosen) get().jetRegler('cascade', 'choix', cur.defaultChoice ?? cur.options[0].key, cur.id);
      else if (cur?.participants) { for (const part of cur.participants) if (!part.result) get().jetLancer('cascadeEnBande', part.id); }
      else if (cur && !cur.result) get().jetLancer('cascade', cur.id);
      get().jetValider('cascade');
    }
    expect(phare).toBeTruthy(); // l'étape du phare a bien été atteinte (port à phare, km 1 → dans la portée dès le jour 1)
    // Dé-navalisation (#328) : `sense`/`roleId` ne sont plus des champs du participant GÉNÉRIQUE —
    // l'effet du sens « vue » est BAKÉ dans la présentation `base` À LA CONSTRUCTION (`crewRoleValue`,
    // kind 'equipage-phare' = Perception visuelle). On l'OBSERVE : la base de la Vigie SOURDE au phare = sa
    // valeur de Perception avec sens « vue » (non pénalisée), non la valeur sans sens (pénalisée).
    const vigie = get().party.find((h) => h.traumas?.some((t) => t.traumaId === 'surdite'))!;
    const vigieRole = findCrewRoleById('vigie')!;
    const vigiePart = phare!.participants!.find((x) => x.id === vigie.id);
    expect(vigiePart).toBeTruthy();
    expect(vigiePart!.base).toBe(crewRoleValue(vigie, vigieRole, navigationDuNavire(get, get().travelPlan!.vehicle!), 'vue').value);
    // Autre étape (Progression, sans sens narratif dédié) : base résolue SANS sens — comportement historique.
    expect(progression).toBeTruthy();
    for (const part of progression!.participants!) expect(typeof part.base).toBe('number');
  });
});

describe('table appliers — les 10 Tests d’équipage de VOYAGE (#275 Ronde 2 cran 3 — PILOTE RÉEL)', () => {
  beforeEach(freshState);

  function planWithSea() {
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0])!;
    set({ travelPlan: plan });
    return plan;
  }

  /** Étape À PARTICIPANTS déjà agrégée (`commitStep`/`aggregateBatchStep`, #275 Décision 4 cran 1) —
   *  `result.sl` = total agrégé, `result.success` = total ≥ 1 (MDG 14 l.13). */
  function step(kind: GenreDeCascade, sl: number, success = sl >= 1): CascadeStep {
    return { id: kind, kind, label: fixtureText(kind), result: { roll: 0, target: 0, sl, success }};
  }

  const apply = (kind: GenreDeCascade, sl: number, success = sl >= 1) =>
    applierDe(kind)!(get, set, step(kind, sl, success), undefined, { steps: [], index: 0 });

  it('entretien : réussite (total −2 ≥ 1) → réparation temporaire 1d10 Blessures, PERSISTÉE (#30 ; MDG 14 l.122 + ch.13 l.647)', () => {
    const plan = planWithSea();
    plan.vehicle!.wounds.current = 30; // coque endommagée (max 50 : cogue)
    apply('equipage-entretien', 5); // +5 → +3 après −2 → réussite
    const cur = get().vessel!.wounds!.current;
    expect(cur).toBeGreaterThan(30);
    expect(cur).toBeLessThanOrEqual(40); // +1d10 max
    apply('equipage-entretien', 2); // 2 − 2 = 0 → échec (« 1 DR ou plus », MDG 14 l.13)
    expect(get().vessel!.wounds!.current).toBe(cur);
  });

  it('orientation : dérive majeure (DR ≤ −5) → Changement de cap (retard % sur la distance restante), km jamais réduit', () => {
    const plan = planWithSea();
    set({ travelPlan: { ...plan, kmDone: 100 } });
    const before = get().travelPlan!.km;
    apply('equipage-orientation', -6, false);
    expect(get().travelPlan!.km).toBeGreaterThanOrEqual(before);
  });

  it('affaler : échec → Critique au Gréement PERSISTÉ (`vessel.criticals`)', () => {
    planWithSea();
    apply('equipage-affaler', -3, false);
    expect(get().vessel!.criticals?.length ?? 0).toBeGreaterThan(0);
  });

  it('affaler : réussite → aucun Critique, conséquence composée (#295 Lot 1)', () => {
    planWithSea();
    const out = apply('equipage-affaler', 3, true);
    expect(resultLine(out?.consequences ?? [])).toContain('affalées à temps');
    expect(get().vessel!.criticals?.length ?? 0).toBe(0);
  });

  it('phare : réussite → bonus d’Orientation posé (Savoir Océans/manuel, ch.13 l.335)', () => {
    planWithSea();
    apply('equipage-phare', 1, true);
    expect(get().travelPlan!.sea!.lighthouseDR).toBeGreaterThanOrEqual(0);
  });

  it('phare : échec → aucun bonus posé', () => {
    planWithSea();
    apply('equipage-phare', -1, false);
    expect(get().travelPlan!.sea!.lighthouseDR).toBe(0);
  });

  it('extermination : progression cumulée jusqu’à extermination complète (MDG 14 l.98-104)', () => {
    planWithSea();
    set({ vessel: { ...get().vessel!, infestation: { label: 'Rats', crewTestType: 'extermination-nuisibles', difficulty: 'intermediaire', drCible: 5, progres: 0, chaqueNuit: EMPTY_FLOW } } });
    apply('equipage-extermination', 3, true);
    expect(get().vessel!.infestation?.progres).toBe(3);
    apply('equipage-extermination', 2, true);
    expect(get().vessel!.infestation).toBeUndefined();
  });

  it('voyage-rapide : calcule ET applique le palier (Rude épreuve, l.28)', () => {
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0])!;
    set({ travelPlan: { ...plan, sea: { ...plan.sea!, fast: { days: 3, weeks: 0 } } } });
    apply('equipage-voyage-rapide', 2, true);
    // `finalizeFastVoyage` a tourné : `pendingFinalize` retombe à false (ou le plan a été purgé à l'accostage).
    expect(get().travelPlan?.sea?.fast?.pendingFinalize).toBeFalsy();
  });

  it.each(['equipage-voyage-rapide', 'testDEquipage'] as const)('%s : un total de Rude épreuve à −2 DR retire 2 points de Moral au navire, un total positif aucun (MDG 14 l.110, MDG 15 l.27)', (kind) => {
    const traverser = (sl: number): number => {
      set({ vessel: { ...get().vessel!, morale: { ...get().vessel!.morale, score: 75 } } });
      const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0])!;
      set({ travelPlan: { ...plan, sea: { ...plan.sea!, fast: { days: 3, weeks: 0 } } } });
      // L'étape que le voyage construit (traversée rapide, nœud `test` de Flow à `crewTestType`), son total posé.
      const etape = etapeDEquipage(get, 'rude-epreuve', kind, voyageStakeRef('equipage-voyage-rapide'))!;
      const resolue: CascadeStep = { ...etape, result: { roll: 0, target: 0, sl, success: sl >= 1 } };
      applierDe(kind)!(get, set, resolue, undefined, { steps: [], index: 0 });
      return get().vessel!.morale.score;
    };
    expect(traverser(-2)).toBe(73);
    expect(traverser(3)).toBe(75);
  });

  it('poursuite : gain de Distance mute la crise EN PLACE (ni échappé, ni rattrapé)', () => {
    const plan = planWithSea();
    set({ travelPlan: { ...plan, sea: { ...plan.sea!, crisis: { kind: 'poursuite', label: 'Écumeur', distance: 0, escapeAt: 100, foeM: 3, foeSkill: 10 } } } });
    apply('equipage-poursuite', 10, true);
    expect(get().travelPlan!.sea!.crisis).toBeTruthy();
  });

  it('tourbillon : chaque manche endommage la coque (IC − Endurance/10) et cumule l’évasion', () => {
    const plan = planWithSea();
    plan.vehicle!.wounds.current = plan.vehicle!.wounds.max;
    set({ travelPlan: { ...plan, sea: { ...plan.sea!, crisis: { kind: 'tourbillon', whirlpoolId: 'maelstrom', need: 999, progress: 0, label: 'Maelström' } } } });
    const before = plan.vehicle!.wounds.current;
    apply('equipage-tourbillon', 3, true);
    expect(get().travelPlan!.vehicle!.wounds.current).toBeLessThanOrEqual(before); // Dégâts de collision (peuvent être nuls si BE couvre)
    expect(get().travelPlan!.sea!.crisis).toBeTruthy(); // `need` 999 : le total agrégé ne peut pas l'atteindre en une manche
  });

  it('embuscade : succès → préparés (pas de Surprise) — conséquence composée (#295 Lot 1)', () => {
    planWithSea();
    const out = apply('equipage-embuscade', 1, true);
    expect(resultLine(out?.consequences ?? [])).toContain('prépare');
  });

  it('progression : applique les milles du jour PUIS insère le reste de la journée (Décision 2, cran 3)', () => {
    planWithSea();
    const out = apply('equipage-progression', 2, true);
    expect(get().travelPlan!.sea!.milesToday).toBeGreaterThan(0);
    // Orientation (toujours jouée) fait partie de l'insert post-progression.
    expect(out?.insert?.some((s) => s.kind === 'equipage-orientation')).toBe(true);
  });
});

describe('progression — message « Encalminé »/« Voiles affalées » piloté par la STRUCTURE (sailsDown / m===null), pas par le libellé FR du vent', () => {
  beforeEach(freshState);

  // Mer calme (calme-plat → cellule `encalmine` sur TOUS les aspects, ch.13 l.276) → eff.m === null,
  // indépendamment de `sailsDown` (posé par un jour de vent violent PRÉCÉDENT, ne dépend pas de la météo courante).
  function planAtProgression(sailsDown: boolean) {
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0])!;
    const sea = { ...plan.sea!, weather: { ...plan.sea!.weather, vent: 'calme-plat' as const }, sailsDown };
    set({ travelPlan: { ...plan, sea } });
  }

  it('mer calme (eff.m === null), voiles NON affalées → message « Encalminé »', () => {
    planAtProgression(false);
    runSeaDay(get, set);
    const journal = get().journal;
    expect(journal.some((l) => l.includes('Encalminé'))).toBe(true);
    expect(journal.some((l) => l.includes('affalées'))).toBe(false);
  });

  it('voiles affalées (sailsDown), MÊME mer calme → message « Voiles affalées » (la structure prime sur le libellé du vent)', () => {
    planAtProgression(true);
    runSeaDay(get, set);
    const journal = get().journal;
    expect(journal.some((l) => l.includes('affalées'))).toBe(true);
    expect(journal.some((l) => l.includes('Encalminé'))).toBe(false);
  });
});

describe('voiles affalées sans ancre : la dérive est créditée le long du trajet (MDG 13 l.294, l.262-270)', () => {
  function derive(windFrom: 'ouest' | 'est' | 'nord', upgrades?: { id: string }[]): { miles: number; ligne: string | undefined } {
    freshState();
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0], { cadence: 'jourParJour' })!;
    const vehicle = upgrades ? { ...plan.vehicle!, upgrades } : plan.vehicle!;
    set({ travelPlan: { ...plan, vehicle, kmDone: 100, sea: { ...plan.sea!, windFrom, sailsDown: true } } });
    runSeaDay(get, set);
    return { miles: get().travelPlan!.sea!.milesToday, ligne: get().journal.find((l) => l.includes('affalées')) };
  }

  it('cap est : vent d’ouest → vers l’avant, vent d’est → vers l’arrière, vent du nord → nul ; même dérive', () => {
    const arriere = derive('ouest');
    const face = derive('est');
    const lateral = derive('nord');
    expect(hullNavalTraits(get().travelPlan!.vehicle!).some((r) => r.id === 'ancre')).toBe(false);
    expect(arriere.miles).toBeGreaterThan(0);
    expect(face.miles).toBe(-arriere.miles);
    expect(lateral.miles).toBe(0);
    expect(arriere.ligne).toContain(`${arriere.miles} milles gagnés`);
    expect(face.ligne).toContain(`${arriere.miles} milles perdus`);
    expect(lateral.ligne).toContain('aucun mille');
  });

  it('ancre jetée : aucune dérive', () => {
    expect(derive('ouest', [{ id: 'ancre' }]).miles).toBe(0);
  });
});

describe('Embuscade maritime AUTHORÉE à ancrage déterministe — #212', () => {
  const abordageMap: WorldMap = {
    id: 'm', label: 'Mer des Griffes',
    places: [
      { id: 'A', label: 'Salzenmund', pos: { x: 0, y: 0 }, scene: { id: 'port-a' } },
      { id: 'B', label: 'Erengrad', pos: { x: 10, y: 0 }, scene: { id: 'port-b' }, port: { taille: 3, richesse: 3, production: ['bois-mer'] } },
    ],
    routes: [{ id: 'r1', a: { id: 'A' }, b: { id: 'B' }, km: 550, modes: ['mer'], sea: true, seaHeading: 'est', ambush: { scene: { id: 'ls-abordage' }, encounter: 'enc-abordage', at: 0.5 } }],
  };

  function portScene(id: string, nom: string): Scene {
    const s = emptyScene('scene-test', 2, 2); s.id = id; s.label = nom; return s;
  }
  function abordageScene(): Scene {
    const s = emptyScene('scene-test', 10, 10); s.id = 'ls-abordage'; s.label = 'Abordage';
    const enc = buildEncounter({ id: 'enc-abordage', enemies: [{ statblock: { type: 'statblock', label: 'Écumeur', char: { 'capacite-de-combat': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, B: 8 } }, pos: { x: 5, y: 5 } }] });
    s.entities.push(...enc.entities); s.encounters = [enc.encounter];
    return s;
  }
  function freshAmbush(worldMap: WorldMap = abordageMap) {
    seedBattleRng(1); // RNG semé : le jour joué directement à l'étape 'equipage-embuscade' ne tire AUCUN événement de bord
    set({
      party: tousLesHerosDeScenario(idsDeTest).slice(0, 3), battle: null, travelPlan: null, travelRecap: null,
      pendingRest: null, pendingCascade: null, suspendedCascades: [], gameTime: 8 * 60, lastUpkeepDay: 0,
      vessel: { vehicleId: 'cogue', morale: { score: 75, lastMoraleWeek: 0, factors: [] } }, journal: [],
    } as never);
    get().chargerLeProjet({ scenes: [portScene('port-a', 'Port A'), portScene('port-b', 'Port B'), abordageScene()], entryId: 'port-a', worldMap, projet: null });
    set({ vessel: { vehicleId: 'cogue', morale: { score: 75, lastMoraleWeek: 0, factors: [] } } } as never); // lancerLaScene remet le vessel de campagne — repose-le
  }

  it('franchissement de l’ancrage (kmDone ≥ at × km) → Test de Perception PUIS abordage, une seule fois — la cascade-jour SURVIT au combat (#284/#275)', () => {
    freshAmbush();
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', abordageMap.routes[0], { cadence: 'jourParJour' })!;
    // Ancrage = 0.5 × 550 = 275 milles. On force `sea.crisis`-like via une progression déjà proche de l'ancrage :
    // kmDone 270, une progression du jour d'~20 milles franchit l'ancrage (290 ≥ 275).
    set({ travelPlan: { ...plan, kmDone: 270 } } as never);
    runSeaDay(get, set);
    // Déroule la cascade jusqu'à l'étape 'equipage-embuscade'.
    let guard = 0;
    while (get().pendingCascade && get().pendingCascade!.participants[get().pendingCascade!.cursor]?.kind !== 'equipage-embuscade' && guard++ < 30) stepCascade();
    const casc = get().pendingCascade;
    expect(casc).toBeTruthy();
    const embuscadeStep = casc!.participants[casc!.cursor];
    expect(embuscadeStep?.kind).toBe('equipage-embuscade'); // Test de Perception influençable (patron terrestre « Attaqués ! »)
    stepCascade(); // valide l'étape 'equipage-embuscade' → ouvre l'abordage (lancerLeCombat)
    expect(get().travelPlan!.sea!.ambushFired).toBe(true);
    expect(get().travelPlan!.interrupted).toBe(true);
    expect(get().battle).toBeTruthy(); // abordage ouvert par la couture partagée
    expect(get().scene!.id).toBe('ls-abordage');
    // La cascade-jour a été SUSPENDUE (pas perdue) : ses étapes restantes (Orientation/Extermination/
    // Entretien) vivent dans la pile, prêtes à reprendre au teardown de combat (#275 Ronde 2 cran 3).
    expect(get().pendingCascade).toBeNull(); // le slot est libre pour les cascades DU combat
    expect(get().suspendedCascades.length).toBe(1);
    expect(get().suspendedCascades[0].purpose).toBe('travelDay');
  });

  it('reprise après COMBAT ne double PAS l\'écran de victoire (décision ii, #275 Ronde 2 cran 3) : victoire d\'abord, cascade-jour ENSUITE', () => {
    freshAmbush();
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', abordageMap.routes[0], { cadence: 'jourParJour' })!;
    set({ travelPlan: { ...plan, kmDone: 270 } } as never);
    runSeaDay(get, set);
    let guard = 0;
    while (get().pendingCascade && get().pendingCascade!.participants[get().pendingCascade!.cursor]?.kind !== 'equipage-embuscade' && guard++ < 30) stepCascade();
    stepCascade(); // valide 'equipage-embuscade' → ouvre l'abordage (lancerLeCombat), suspend la cascade-jour
    expect(get().battle).toBeTruthy();
    expect(get().suspendedCascades.length).toBe(1);

    // Victoire du combat (raccourci de test — la résolution d'attaque RÉELLE est couverte ailleurs) :
    // l'ennemi tombe, `checkBattleOver` pose `over:'victoire'` + `pendingVictory`.
    const battle = get().battle!;
    for (const c of battle.combatants) if (c.kind === 'ennemi') c.dead = true;
    set({ battle: { ...battle } });
    checkBattleOver(get, set);
    expect(get().pendingVictory).toBeTruthy();
    expect(get().battle?.over).toBe('victoire');
    // AVANT « Continuer » : la cascade-jour reste SUSPENDUE — l'écran de victoire passe devant.
    expect(get().pendingCascade).toBeNull();
    expect(get().suspendedCascades.length).toBe(1);

    get().fenetreFermer('victoire');
    // APRÈS « Continuer » : la victoire s'efface ET la cascade-jour REPREND (teardown de combat,
    // couture universelle `resumeSuspendedCascade`).
    expect(get().pendingVictory).toBeNull();
    expect(get().battle).toBeNull();
    expect(get().suspendedCascades.length).toBe(0);
    expect(get().pendingCascade).toBeTruthy();
    expect(get().pendingCascade!.purpose).toBe('travelDay');
  });

  /**
   * TRAVERSÉE SOUS ORDRES (#1595) : l'embuscade ancrée n'exclut pas le jour du pilote immédiat. Le combat
   * qu'elle ouvre en plein vol parque la journée ENTIÈRE derrière lui ; le combat clos, le même pilote
   * reprend SANS fenêtre, et la clôture du jour se joue une fois, PV compris des dés résolus AVANT l'embuscade.
   */
  it('traversée COMMANDÉE : routine sans fenêtre ; au franchissement, l’abordage parque le jour, qui reprend après la victoire et se clôt une fois, PV complet', () => {
    freshAmbush();
    set({ travelPlan: buildSeaPlan(get, 'r1', 'A', 'B', abordageMap.routes[0], { cadence: 'commande' })! } as never);
    runSeaDay(get, set);
    expect(get().pendingCascade, 'le jour de routine a ouvert une fenêtre').toBeNull();
    expect(get().battle).toBeNull();
    expect(get().travelPlan!.sea!.daysAtSea, 'le jour de routine ne s’est pas clos').toBe(1);

    freshAmbush();
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', abordageMap.routes[0], { cadence: 'commande' })!;
    set({ travelPlan: { ...plan, kmDone: 270 } } as never);
    runSeaDay(get, set);
    expect(get().battle, 'l’embuscade n’a pas ouvert son combat').toBeTruthy();
    expect(get().pendingCascade, 'le jour s’est ouvert en fenêtre').toBeNull();
    const [parque] = get().suspendedCascades;
    expect(parque?.piloteImmediat, 'le jour parqué a perdu son contexte de lancement').toEqual({ rowSurface: 'pv' });
    const joues = parque.participants.slice(0, parque.cursor);
    expect(joues.map((x) => x.kind)).toEqual(expect.arrayContaining(['equipage-progression', 'equipage-embuscade']));
    const progression = joues.find((x) => x.kind === 'equipage-progression')!;

    const battle = get().battle!;
    for (const c of battle.combatants) if (c.kind === 'ennemi') c.dead = true;
    set({ battle: { ...battle } });
    checkBattleOver(get, set);
    get().fenetreFermer('victoire');

    expect(get().pendingCascade, 'la reprise après la victoire a rouvert une fenêtre').toBeNull();
    expect(get().suspendedCascades).toEqual([]);
    expect(get().travelPlan!.sea!.daysAtSea, 'la clôture du jour ne s’est pas jouée une fois').toBe(1);
    expect(get().travelPlan!.log, 'la clôture du jour ne s’est pas jouée une fois').toHaveLength(1);
    const ids = get().travelPlan!.log!.slice(-1)[0]!.entries!.map((e) => e.id ?? '');
    expect(ids.filter((i) => i.startsWith('mer-equipage-progression')), 'les dés résolus avant l’embuscade manquent au PV').toHaveLength(progression.participants!.length);
    expect(ids.some((i) => i.startsWith('mer-equipage-orientation')), 'le reste du jour ne s’est pas joué').toBe(true);
  });

  it('route SANS embuscade authorée → le franchissement ne déclenche rien', () => {
    const noAmbush: WorldMap = { ...abordageMap, routes: [{ ...abordageMap.routes[0], ambush: undefined }] };
    freshAmbush(noAmbush);
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', noAmbush.routes[0])!;
    set({ travelPlan: { ...plan, kmDone: 270 } } as never);
    runSeaDay(get, set);
    let guard = 0;
    while (get().pendingCascade && guard++ < 30) {
      const casc = get().pendingCascade!;
      if (casc.participants[casc.cursor]?.kind === 'equipage-embuscade') break;
      stepCascade();
    }
    expect(get().travelPlan?.sea?.ambushFired).toBeFalsy();
    expect(get().battle).toBeNull();
  });
});

describe('Périls d’AUTEUR lus au fil des jours en mer — C.22 (route.perils)', () => {
  beforeEach(freshState);

  it('un `route.perils` à 100 % se déclenche CHAQUE jour de mer (patron terrestre), en plus de l’ambush ANCRÉE', () => {
    const perilMap: WorldMap = {
      ...seaMap,
      routes: [{ ...seaMap.routes[0], perils: [{ label: 'Récif affleurant', chancePct: 100, effects: [{ type: 'journal', desc: 'La coque frôle un récif.' }] }] }],
    };
    set({ worldMap: perilMap } as never);
    get().partirEnVoyage('r1', 'mer');
    // On déroule la 1ʳᵉ journée jusqu’à la halte : le péril d’auteur DOIT avoir été lu (journal).
    for (let i = 0; i < 30 && !get().pendingRest; i++) {
      if (!get().pendingCascade) break;
      stepCascade();
    }
    expect(get().journal.some((l) => l.includes('Péripétie : Récif affleurant'))).toBe(true);
  });

  it('un péril d’auteur `startCombat` INTERROMPT la traversée (comme l’embuscade)', () => {
    const krakenScene = emptyScene('scene-test', 10, 10); krakenScene.id = 'port-a'; krakenScene.label = 'Mer';
    const enc = buildEncounter({ id: 'enc-kraken', enemies: [{ statblock: { type: 'statblock', label: 'Kraken', char: { 'capacite-de-combat': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, B: 8 } }, pos: { x: 5, y: 5 } }] });
    krakenScene.entities.push(...enc.entities); krakenScene.encounters = [enc.encounter];
    const combatPeril: WorldMap = {
      ...seaMap,
      routes: [{ ...seaMap.routes[0], perils: [{ label: 'Kraken', chancePct: 100, effects: [{ type: 'startCombat', encounter: 'enc-kraken' }] }] }],
    };
    set({ scene: krakenScene as never, worldMap: combatPeril } as never);
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', combatPeril.routes[0])!;
    set({ travelPlan: plan } as never);
    runSeaDay(get, set);
    // Le péril d'auteur est une ÉTAPE de monde (#1426) : son dé se joue dans la cascade du jour, comme
    // celui du péril à 100 % du cas précédent — on la déroule jusqu'à ce que le combat prenne la main.
    for (let i = 0; i < 30 && get().pendingCascade && !get().battle; i++) stepCascade();
    expect(get().travelPlan!.interrupted).toBe(true); // la traversée s’arrête sur le combat d’auteur
    expect(get().battle).toBeTruthy();
    // La ligne du péril est la CONSÉQUENCE de son étape, écrite par le routage unique
    // (`combatLog.journaliser`) : le combat d'auteur étant OUVERT à cet instant, elle va au `battle.log`
    // — la surface que le joueur regarde en combat — et non au journal d'exploration, non ouvrable là.
    // On lit donc UNE surface, NOMMÉE : le journal du combat ouvert.
    const lues = get().battle!.log.map((e) => e.text);
    expect(lues.some((l) => l.includes('Péripétie : Kraken'))).toBe(true);
  });
});

describe('Traversée RAPIDE — un seul Test de Rude épreuve (MDG 15 l.21-37, C.16)', () => {
  beforeEach(freshState);

  function driveFast(): void {
    const p = get().pendingCascade;
    expect(p?.purpose).toBe('test');
    const cur = p!.participants[p!.cursor];
    expect(cur?.kind).toBe('equipage-voyage-rapide');
    stepCascade(); // valide → `computeFastPalier` + `finalizeFastVoyage` (calcule ET applique dans le même geste)
  }

  it('appareille en UN Test, franchit les jours et accoste (pendingShoreLeave) sans dérouler la boucle jour par jour', () => {
    set({ vessel: { ...get().vessel!, waterLitres: 1000 } });
    const t0 = get().gameTime;
    get().partirEnVoyage('r1', 'mer', { fast: true });
    driveFast();
    expect(get().travelPlan).toBeNull(); // arrivée
    expect(get().pendingShoreLeave).toBeTruthy(); // événement de port (port B a un profil)
    expect(get().vessel!.lastVoyageMilles).toBe(550);
    // 550 milles / (18×5) = ~7 jours → l’horloge a franchi ~7 jours (couture unique avancerLeTemps).
    expect(get().gameTime - t0).toBe(7 * 24 * 60);
    expect(get().vessel!.waterLitres).toBeLessThan(1000); // eau des tonneaux consommée (comme le détaillé)
  });

  // Manann élevé → palier de voyage rapide BÉNIN (aucune perte d’équipage) : la population de consommation
  // reste l’effectif nominal, sans bruit d’un crewLost aléatoire du palier.
  const benign = { manann: { score: 1000, applied: [] } };

  it('#245 — l’eau se consomme sur TOUTE la population (3 héros + 15 PNJ de la cogue) sur 7 jours', () => {
    set({ vessel: { ...get().vessel!, ...benign, waterLitres: 1000 } }); // party = 3 héros, cogue = 15 PNJ nominaux → 18 âmes
    get().partirEnVoyage('r1', 'mer', { fast: true });
    driveFast();
    // 18 âmes × 3 L (médiane) × 7 jours = 378 L.
    expect(get().vessel!.waterLitres).toBe(1000 - 18 * 3 * 7);
  });

  it('#245 — l’effectif nominal perdu (crewLost) réduit la population qui consomme', () => {
    set({ vessel: { ...get().vessel!, ...benign, waterLitres: 1000, crewLost: 10 } }); // 15 − 10 = 5 PNJ → 3 + 5 = 8 âmes
    get().partirEnVoyage('r1', 'mer', { fast: true });
    driveFast();
    expect(get().vessel!.waterLitres).toBe(1000 - 8 * 3 * 7);
  });

  const FRAIS = 'nourriture-courses-journee', PRESERVEE = 'ration-nourriture-preservee', BISCUITS = 'ration-biscuits-de-mer';
  const cale = (v: Record<string, number>) => v as VivresDeCale;

  it('#245 — l’équipage mange les vivres de cale ; à court → facteur de Moral « nourriture-insuffisante » (MDG 14 l.171)', () => {
    // 15 PNJ × 7 jours = 105 rations requises. Vivres de cale 20 + 20 + 10 = 50 < 105 → disette.
    set({ vessel: { ...get().vessel!, ...benign, waterLitres: 1000, provisions: cale({ [FRAIS]: 20, [PRESERVEE]: 20, [BISCUITS]: 10 }) } });
    get().partirEnVoyage('r1', 'mer', { fast: true });
    driveFast();
    const v = get().vessel!;
    expect(v.provisions).toEqual({ [FRAIS]: 0, [PRESERVEE]: 0, [BISCUITS]: 0 });
    expect(v.morale.factors).toContain('nourriture-insuffisante');
  });

  it('#245 — l’équipage mange le frais, puis la nourriture préservée, puis les biscuits de mer (MDG 14 l.238, l.263)', () => {
    set({ vessel: { ...get().vessel!, ...benign, waterLitres: 1000, provisions: cale({ [BISCUITS]: 70, [PRESERVEE]: 100, [FRAIS]: 30 }), morale: { score: 75, lastMoraleWeek: 0, factors: ['nourriture-insuffisante'] } } });
    get().partirEnVoyage('r1', 'mer', { fast: true });
    driveFast();
    const v = get().vessel!;
    // 15 PNJ × 7 jours = 105 : les 30 frais, puis 75 des 100 préservées ; les biscuits restent entiers.
    expect(v.provisions).toEqual({ [FRAIS]: 0, [PRESERVEE]: 25, [BISCUITS]: 70 });
    expect(v.morale.factors).not.toContain('nourriture-insuffisante');
  });

  // 15 PNJ × 7 jours = 105 rations ; le dernier jour de la traversée (15 rations) fait la nourriture du recalcul.
  it('#1652 — dernier jour couvert par les seuls biscuits de mer → facteur « nourriture-biscuits-de-mer » (MDG 14 l.166)', () => {
    set({ vessel: { ...get().vessel!, ...benign, waterLitres: 1000, provisions: cale({ [PRESERVEE]: 50, [BISCUITS]: 100 }) } });
    get().partirEnVoyage('r1', 'mer', { fast: true });
    driveFast();
    const v = get().vessel!;
    expect(v.provisions).toEqual({ [PRESERVEE]: 0, [BISCUITS]: 45 });
    expect(v.morale.factors).toEqual(['nourriture-biscuits-de-mer']);
  });

  it('#1652 — dernier jour mêlé (nourriture préservée puis biscuits) → aucun facteur de nourriture (MDG 14 l.166)', () => {
    set({ vessel: { ...get().vessel!, ...benign, waterLitres: 1000, provisions: cale({ [PRESERVEE]: 100, [BISCUITS]: 70 }), morale: { score: 75, lastMoraleWeek: 0, factors: ['nourriture-biscuits-de-mer'] } } });
    get().partirEnVoyage('r1', 'mer', { fast: true });
    driveFast();
    const v = get().vessel!;
    expect(v.provisions).toEqual({ [PRESERVEE]: 0, [BISCUITS]: 65 });
    expect(v.morale.factors).toEqual([]);
  });

  it('#1652 — jour court sur des biscuits → « nourriture-insuffisante » seul, les deux facteurs s’excluent (MDG 14 l.166, l.171)', () => {
    set({ vessel: { ...get().vessel!, ...benign, waterLitres: 1000, provisions: cale({ [BISCUITS]: 100 }), morale: { score: 75, lastMoraleWeek: 0, factors: ['nourriture-biscuits-de-mer'] } } });
    get().partirEnVoyage('r1', 'mer', { fast: true });
    driveFast();
    const v = get().vessel!;
    expect(v.provisions).toEqual({ [BISCUITS]: 0 });
    expect(v.morale.factors).toEqual(['nourriture-insuffisante']);
  });

  it('palier DÉSASTREUX (Humeur de Manann effondrée) : équipage manquant, cargaison perdue, coque meurtrie, 3 Critiques', () => {
    set({ vessel: {
      ...get().vessel!, manann: { score: -1000, applied: [] }, // dizaine −100 → résultat ≤ 0 quel que soit le d10/DR
      wounds: { current: 50, max: 50 }, cargo: [{ uid: 'lot-2', cargoId: 'bois-mer', enc: 100, basePriceGold: 1 }], criticals: [],
    } });
    get().partirEnVoyage('r1', 'mer', { fast: true });
    driveFast();
    const v = get().vessel!;
    expect(v.crewLost).toBe(8); // l.33 : 50 % de 15 PNJ, 7,5 arrondi
    expect(v.cargo![0].enc).toBe(25); // l.33 : 75 % de 100 Enc
    expect(v.wounds!.current).toBe(13); // l.33 : 75 % de 50 Blessures, 37,5 arrondi à l'inférieur
    expect(v.criticals!.length).toBe(3); // l.33
  });

  it('palier PARFAIT (Humeur de Manann au zénith) : aucune conséquence négative', () => {
    set({ vessel: {
      ...get().vessel!, manann: { score: 1000, applied: [] }, // dizaine +100 → résultat ≥ 10 → Voyage parfait
      wounds: { current: 50, max: 50 }, cargo: [{ uid: 'lot-3', cargoId: 'bois-mer', enc: 100, basePriceGold: 1 }], criticals: [],
    } });
    get().partirEnVoyage('r1', 'mer', { fast: true });
    driveFast();
    const v = get().vessel!;
    expect(v.crewLost ?? 0).toBe(0);
    expect(v.cargo![0].enc).toBe(100);
    expect(v.wounds!.current).toBe(50);
    expect(v.criticals!.length).toBe(0);
  });
});

describe('Traversée rapide × embuscade ANCRÉE (#212) : interruption puis reprise en rapide', () => {
  const abordageMap: WorldMap = {
    id: 'm', label: 'Mer des Griffes',
    places: [
      { id: 'A', label: 'Salzenmund', pos: { x: 0, y: 0 }, scene: { id: 'port-a' } },
      { id: 'B', label: 'Erengrad', pos: { x: 10, y: 0 }, scene: { id: 'port-b' }, port: { taille: 3, richesse: 3, production: ['bois-mer'] } },
    ],
    routes: [{ id: 'r1', a: { id: 'A' }, b: { id: 'B' }, km: 550, modes: ['mer'], sea: true, seaHeading: 'est', ambush: { scene: { id: 'ls-abordage' }, encounter: 'enc-abordage', at: 0.5 } }],
  };
  function portScene(id: string, nom: string): Scene { const s = emptyScene('scene-test', 2, 2); s.id = id; s.label = nom; return s; }
  function abordageScene(): Scene {
    const s = emptyScene('scene-test', 10, 10); s.id = 'ls-abordage'; s.label = 'Abordage';
    const enc = buildEncounter({ id: 'enc-abordage', enemies: [{ statblock: { type: 'statblock', label: 'Écumeur', char: { 'capacite-de-combat': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, B: 8 } }, pos: { x: 5, y: 5 } }] });
    s.entities.push(...enc.entities); s.encounters = [enc.encounter];
    return s;
  }
  beforeEach(() => {
    seedBattleRng(1);
    set({
      party: tousLesHerosDeScenario(idsDeTest).slice(0, 3), battle: null, travelPlan: null, travelRecap: null,
      pendingRest: null, pendingCascade: null, suspendedCascades: [], gameTime: 8 * 60, lastUpkeepDay: 0,
      vessel: { vehicleId: 'cogue', morale: { score: 75, lastMoraleWeek: 0, factors: [] } }, journal: [],
    } as never);
    get().chargerLeProjet({ scenes: [portScene('port-a', 'Port A'), portScene('port-b', 'Port B'), abordageScene()], entryId: 'port-a', worldMap: abordageMap, projet: null });
    set({ vessel: { vehicleId: 'cogue', morale: { score: 75, lastMoraleWeek: 0, factors: [] } } } as never);
  });

  it('l’abordage ancré INTERROMPT le voyage rapide (cascade `purpose:test` suspendue) ; après le combat, la traversée se finit en rapide', () => {
    get().partirEnVoyage('r1', 'mer', { fast: true });
    const p = get().pendingCascade!;
    expect(p.participants[p.cursor]?.kind).toBe('equipage-voyage-rapide');
    stepCascade(); // valide → computeFastPalier + finalizeFastVoyage → embuscade ancrée → lancerLeCombat
    expect(get().battle).toBeTruthy(); // abordage ouvert par la couture partagée (#212)
    expect(get().scene!.id).toBe('ls-abordage');
    expect(get().travelPlan!.sea!.ambushFired).toBe(true);
    expect(get().travelPlan!.interrupted).toBe(true);
    expect(get().travelPlan!.sea!.fast!.pendingFinalize).toBe(true); // le palier reste à appliquer
    // Timing (docs/plans/…) : à l'interruption, seule la narration d'embuscade part — le texte du palier
    // (« Voyage rapide — … ») ne doit PAS précéder son application (l'écran de combat le démentirait).
    expect(get().journal.some((l) => l.includes('voile hostile surgit'))).toBe(true);
    expect(get().journal.some((l) => l.startsWith('Voyage rapide —'))).toBe(false);
    // Combat gagné → reprise : la traversée s’achève en rapide (arrivée), sans rejouer l’embuscade.
    set({ battle: null });
    get().reprendreLeVoyage();
    expect(get().travelPlan).toBeNull(); // accosté
    expect(get().pendingShoreLeave).toBeTruthy();
    // Post-combat : la narration du palier part ENFIN, avec son application (même geste).
    expect(get().journal.some((l) => l.startsWith('Voyage rapide —'))).toBe(true);
  });
});

describe('Cogue pirate (#327 A5.3) — l’op `navireHostile` PRÉSENTE les 3 choix (couture RÉELLE, re-recette)', () => {
  beforeEach(freshState);

  /** Nomme l’événement de bord `cogue-pirate` d’avance et déroule la résolution RÉELLE du jour
   *  (`runSeaDay` → étape d’événement de bord → op `navireHostile` → `openPirateHail`) — PAS un step
   *  fabriqué : on vérifie que la COUTURE présente bien la cascade de choix (le lot D ne testait que les
   *  appliers, sur un step monté à la main → il passait alors que le joueur ne voyait rien). */
  function forceHail(id = 'cogue-pirate') {
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0])!;
    set({ travelPlan: { ...plan, sea: { ...plan.sea!, forcedEventId: id } } });
    runSeaDay(get, set);
  }

  it('Langskip skaeling : aucune extorsion (MDG 15 l.150-151) — fuir ou combattre, jamais se soumettre', () => {
    forceHail('langskip-skaeling');
    const cur = get().pendingCascade!.participants[get().pendingCascade!.cursor];
    expect(cur.kind).toBe('merPiratesSommation');
    expect(cur.options?.map((o) => o.key)).toEqual(['fuir', 'combattre']);
  });

  it('la Poursuite se joue au M de conception du navire hostile (Cogue : voile M 5, MDG 12)', () => {
    forceHail();
    const cur = get().pendingCascade!.participants[get().pendingCascade!.cursor];
    get().jetRegler('cascade', 'choix', 'fuir', cur.id);
    get().jetValider('cascade');
    const crise = get().travelPlan!.sea!.crisis;
    expect(crise?.kind === 'poursuite' && crise.foeM).toBe(5);
  });

  it('runSeaDay ouvre la cascade de CHOIX (fuir/combattre/soumettre) — AUCUNE auto-résolution silencieuse', () => {
    forceHail();
    const p = get().pendingCascade;
    expect(p).toBeTruthy();
    const cur = p!.participants[p!.cursor];
    expect(cur.kind).toBe('merPiratesSommation');
    expect(cur.options?.map((o) => o.key)).toEqual(['fuir', 'combattre', 'soumettre']); // les 3 choix présentés
    // Rien de tranché AVANT le choix : ni fuite (Poursuite), ni pillage — le joueur décide.
    expect(get().travelPlan!.sea!.crisis).toBeFalsy();
    expect(get().journal.some((l) => l.includes('prend la fuite'))).toBe(false);
  });

  it('branche PRÉSENTÉE « fuir » (défaut) → Poursuite (mute la crise, aucune perte silencieuse)', () => {
    forceHail();
    const cur = get().pendingCascade!.participants[get().pendingCascade!.cursor];
    get().jetRegler('cascade', 'choix', 'fuir', cur.id);
    get().jetValider('cascade');
    expect(get().travelPlan!.sea!.crisis?.kind).toBe('poursuite');
  });

  it('après « fuir », la pile rend le jour en vol, qui compose la manche de Poursuite le jour même (#383)', () => {
    forceHail();
    expect(get().suspendedCascades.map((c) => c.purpose), 'la sommation s’ouvre sous le jour en vol').toEqual(['travelDay']);
    const cur = get().pendingCascade!.participants[get().pendingCascade!.cursor];
    get().jetRegler('cascade', 'choix', 'fuir', cur.id);
    get().jetValider('cascade'); // ferme la sommation → `reprendreLaPile` rend le jour, sans `setTimeout`
    expect(get().travelPlan!.sea!.crisis?.kind).toBe('poursuite');
    draineCascade(get);
    const prefixeManche = t('sv.chase', { label: '§', issue: '', gain: '', distance: '', escapeAt: '' }).split('§')[0];
    expect(get().journal.filter((l) => l.startsWith(prefixeManche)), 'la manche de Poursuite se joue dans le jour de la sommation').toHaveLength(1);
    expect(get().journal.filter((l) => l.startsWith(t('sv.weatherOfDay', { weather: '§', from: '', heading: '' }).split('§')[0])), 'le jour n’est bâti qu’une fois').toHaveLength(1);
    expect(get().travelPlan!.sea!.daysAtSea).toBe(1);
    expect(get().pendingRest, 'le jour se dénoue sur la halte').toBeTruthy();
  });

  it('équipage SANS compétence navale : la manche de Poursuite se JOUE quand même (plancher de Manque de bras, MDG 14 l.55), jamais droppée en silence (#383)', () => {
    set({ party: tousLesHerosDeScenario(idsDeTest).slice(0, 3).map((h) => ({ ...h, skills: [] })) } as never);
    forceHail();
    const cur = get().pendingCascade!.participants[get().pendingCascade!.cursor];
    get().jetRegler('cascade', 'choix', 'fuir', cur.id);
    get().jetValider('cascade'); // → runSeaDay : aucun PJ apte = sous l'effectif minimal → crise résolue au plancher (−2 DR, MDG 14 l.55), pas de lock
    // La manche a JOUÉ : soit la crise s'est résolue (échappée/rattrapée), soit une manche a été jouée
    // ET JOURNALISÉE (`sea.lines`). Au plancher de Manque de bras l'écart peut nier à 0 milles (le navire
    // sous-armé ne creuse pas l'écart, MDG 14 l.55) — c'est le RAW, pas un drop : le journal le prouve.
    const sea = get().travelPlan?.sea;
    const journaled = (sea?.lines ?? []).some((l) => l.includes('Poursuite'))
      || (get().travelPlan?.log ?? []).some((d) => d.lines?.some((l) => l.text.includes('Poursuite')));
    const played = sea?.crisis?.kind !== 'poursuite' || journaled;
    expect(played).toBe(true);
  });

  it('branche PRÉSENTÉE « soumettre » → pillage (100 %) puis choix du tribut (étape insérée)', () => {
    set({ vessel: { ...get().vessel!, cargo: [{ uid: 'lot-4', cargoId: 'vin', enc: 30, basePriceGold: 2 }] } } as never);
    forceHail();
    const cur = get().pendingCascade!.participants[get().pendingCascade!.cursor];
    get().jetRegler('cascade', 'choix', 'soumettre', cur.id);
    get().jetValider('cascade');
    expect(get().vessel!.cargo!.reduce((n, l) => n + l.enc, 0)).toBe(0); // cale vidée (pirate-pillage-pct 100 %)
    const p2 = get().pendingCascade;
    expect(p2?.participants.some((s) => s.kind === 'merPiratesTribut')).toBe(true); // choix du tribut offert
  });
});

/** Joue la journée étape par étape JUSQU'À ce que l'étape d'événement de bord soit tirée et validée, et la rend : un
 *  tirage de MONDE que le siège ne fixe pas n'est pas un vrai choix, la journée le passe d'elle-même (#3534). Le
 *  `RecapEvent` du jour vit dans `sea.events` tant que le jour n'est pas CLOS (la clôture le déplace dans
 *  `travelPlan.log`, cf. le bloc « Clôture du jour de mer » ci-dessous). */
function evenementDeBordTire(max = 40): CascadeStep {
  const tire = () => get().pendingCascade?.participants.find((s) => s.kind === 'mer-evenement-de-bord' && s.committed);
  for (let i = 0; i < max && get().pendingCascade && !tire(); i++) avanceEtapeCascade(get);
  const etape = tire();
  if (!etape) throw new Error('la journée s’est close sans montrer l’événement de bord tiré');
  return etape;
}

describe('Événement de bord RACONTÉ → carte-parchemin (#371 LOT 4, non couvert avant #383)', () => {
  beforeEach(freshState);

  it('un événement de bord FORCÉ (couture réelle `forcedEventId` + `runSeaDay`) pousse un `RecapEvent` {title,text} VERBATIM (source `sea-events.json`, sans tirage — recette #332)', () => {
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0], { cadence: 'jourParJour' })!;
    set({ travelPlan: { ...plan, sea: { ...plan.sea!, forcedEventId: 'calme-plat' } } });
    runSeaDay(get, set);
    const events = get().travelPlan!.sea!.events ?? [];
    expect(events).toHaveLength(1);
    const def = seaBoardEventById('calme-plat')!;
    expect(events[0]).toEqual({ title: def.label, text: def.desc, roll: undefined }); // forcé → pas de tirage (recapLine.ts)
  });

  /** CONTRAT (#1426) : l'événement de bord n'est plus résolu inline — c'est une ÉTAPE À TABLE du canal
   *  de cascade (`mer-evenement-de-bord`, dé de MONDE). Le `RecapEvent` naît donc quand l'étape est DRAINÉE,
   *  pas à l'appel de `runSeaDay` : le test joue la journée comme un joueur (pilote partagé). */
  it('un tirage NATUREL (non forcé, `daysToEvent` échu) : l’étape à TABLE drainée capture le d100 dans le `RecapEvent` — label+texte SOURCÉS (`BOARD_EVENTS`, pas de copie en dur)', () => {
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0], { cadence: 'jourParJour' })!;
    set({ travelPlan: { ...plan, sea: { ...plan.sea!, daysToEvent: 1, forcedEventId: undefined } } });
    runSeaDay(get, set);
    const etape = evenementDeBordTire();
    expect(etape.worldOwner, 'dé de MONDE : aucun acteur ne le porte').toBe(true);
    const events = get().travelPlan!.sea!.events ?? [];
    expect(events).toHaveLength(1);
    const ev = events[0];
    expect(typeof ev.roll).toBe('number'); // tirage capturé (chemin non forcé)
    const def = BOARD_EVENTS.find((e) => e.label === ev.title && e.desc === ev.text);
    expect(def).toBeTruthy(); // titre + texte VERBATIM d'une entrée RÉELLE de sea-events.json
  });

  it('l’étape d’événement de bord tire au `die` de la table en donnée, jamais à un dé recopié (MDG 15 l.134 ; #1667)', () => {
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0], { cadence: 'jourParJour' })!;
    sousLeDe('seaBoardEvents', 'd10', () => {
      set({ travelPlan: { ...plan, sea: { ...plan.sea!, daysToEvent: 1, forcedEventId: undefined } } });
      runSeaDay(get, set);
      const etape = get().pendingCascade!.participants.find((s) => s.kind === 'mer-evenement-de-bord')!;
      expect(formatDice(etape.table!.spec!)).toBe('1d10');
      expect(tableStepDef(SEA_BOARD_EVENT_TABLE)!.die, 'la table tirable suit le dé écrit').toBe(10);
    });
  });

  /** L'Humeur de Manann DÉCALE le d100 de l'événement (MDG 15 l.85) : elle est le `mod` de la table
   *  d'étape, versé par `liveTableDecl` au rang du tirage. */
  it('l’Humeur de Manann du navire est le `mod` de la table d’événement de bord', () => {
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0], { cadence: 'jourParJour' })!;
    set({ vessel: { ...get().vessel!, manann: { score: -40, applied: [] } } });
    set({ travelPlan: { ...plan, sea: { ...plan.sea!, daysToEvent: 1, forcedEventId: undefined } } });
    runSeaDay(get, set);
    const etape = evenementDeBordTire();
    expect(etape.table!.mod).toBe(-40);
    expect(etape.table!.result!.die).toBe(etape.table!.result!.roll - 40); // le dé EFFECTIF est décalé
  });

  /** La FOURCHETTE 48-80 de la table (`sea-events.json`) rend « Navigation ordinaire », rangée narrative
   *  (MDG 15 l.201) — mesurée SUR LE FLUX réel, dé posé par la fenêtre. */
  it('dé posé à 60 (Humeur neutre) → l’entrée « Navigation ordinaire », et la journée ne raconte aucun incident', () => {
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0], { cadence: 'jourParJour' })!;
    set({ travelPlan: { ...plan, sea: { ...plan.sea!, daysToEvent: 1, forcedEventId: undefined } } });
    runSeaDay(get, set);
    const etape = get().pendingCascade!.participants.find((s) => s.kind === 'mer-evenement-de-bord')!;
    expect(etape.table!.mod ?? 0, 'Humeur de Manann neutre : le dé posé est le dé effectif').toBe(0);
    get().jetImposerLeResultat('cascadeTirage', 60, etape.id);
    const tiree = get().pendingCascade!.participants.find((s) => s.kind === 'mer-evenement-de-bord')!.table!.result!;
    expect(tiree.id).toBe('navigation-ordinaire');
    const rangee = seaBoardEventById(tiree.id)!;
    expect(rangee.consequence).toBeUndefined();
  });

  /** LOT 3 (#1426) : UNE voix par événement, et elle est la CONSÉQUENCE de l'étape. Deux exigences que
   *  seule la conséquence satisfait ENSEMBLE : (a) le joueur ne lit qu'une ligne au journal, portant le
   *  texte VERBATIM de `sea-events.json` (la ligne de TABLE reste l'issue de la RANGÉE, elle ne se
   *  re-verse pas) ; (b) la rangée validée GARDE son `outcome`, donc reste dans la pile à l'écran
   *  (« on ne perd pas les conséquences », `CascadeModal`) — une étape à table dont l'applier raconte à
   *  côté et rend `{}` DISPARAÎT du bilan (`CascadeModal.rowOf` : ni `result` mono, ni `outcome`). */
  it('l’événement de bord ne s’écrit QU’UNE fois au journal, et la rangée validée GARDE sa conséquence', () => {
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0], { cadence: 'jourParJour' })!;
    set({ travelPlan: { ...plan, sea: { ...plan.sea!, daysToEvent: 1, forcedEventId: undefined } } });
    set({ journal: [] });
    runSeaDay(get, set);
    const etape = evenementDeBordTire();
    const def = BOARD_EVENTS.find((e) => e.id === etape.table!.result!.id)!;
    const portantes = get().journal.filter((l) => l.includes(def.label));
    expect(portantes).toHaveLength(1);
    expect(portantes[0]).toBe(`${def.label} — ${def.desc}`); // texte VERBATIM, pas le titre nu
    expect(etape.committed, 'précondition : l’étape a bien été validée').toBe(true);
    expect(etape.outcome?.map((l) => l.text), 'la pile garde la conséquence de l’étape').toEqual([`${def.label} — ${def.desc}`]);
  });
});

describe('Clôture du jour de mer — le récap porte les events, `sea.events` se RÉINITIALISE (#371 LOT 4, non couvert avant #383)', () => {
  beforeEach(freshState);

  it('`continueSeaDayAfterCascade` : le `TravelRecapDay` (`travelPlan.log`) porte les events du jour ; `sea.events` repart à vide (pas de fuite au lendemain)', () => {
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0])!;
    const def = seaBoardEventById('calme-plat')!;
    const carried: RecapEvent = { title: def.label, text: def.desc, roll: 21 };
    set({ travelPlan: { ...plan, sea: { ...plan.sea!, events: [carried], milesToday: 5 } } });
    continueSeaDayAfterCascade(get, set);
    draineCascade(get); // les Tests de l'entretien-survie se jouent dans LEUR fenêtre (#1479), la clôture suit
    const log = get().travelPlan!.log!;
    expect(log).toHaveLength(1);
    expect(log[0].events).toEqual([carried]); // la carte du jour porte l'événement
    expect(get().travelPlan!.sea!.events).toEqual([]); // reset — pas de fuite au jour suivant
  });
});

describe('services portuaires (#30)', () => {
  beforeEach(freshState);

  it('réparation au port : 1 CO par Blessure restaurée (MDG 13 l.643), le temps de chantier passe', () => {
    set({ vessel: { ...get().vessel!, wounds: { current: 40, max: 50 } } });
    creditBourse(get, set, get().party[0].id, { gold: 20, silver: 0, brass: 0 });
    const t0 = get().gameTime;
    const lines = portRepairVessel(get, set);
    expect(lines[0]).toContain('remis à neuf');
    expect(get().vessel!.wounds!.current).toBe(50);
    expect(partyMoneyTotal(get).gold).toBe(10); // 10 Blessures × 1 CO
    expect(get().gameTime).toBeGreaterThan(t0);
    // Bourse insuffisante → refus (il ne reste que 10 CO, la réparation de 40 Blessures en coûte 40).
    set({ vessel: { ...get().vessel!, wounds: { current: 10, max: 50 } } });
    expect(portRepairVessel(get, set)).toEqual([]);
    expect(get().journal).toContain(t('sv.yardTooExpensive', { cost: 40 }));
  });

  it('pose d’une Amélioration : coût par bande de Taille (MDG 12) — Nid-de-pie sur une cogue (25 m, Moyenne) = 5 CO', () => {
    creditBourse(get, set, get().party[0].id, { gold: 10, silver: 0, brass: 0 });
    const lines = installerLAmelioration(get, set, 'nid-de-pie');
    expect(lines[0]).toContain('Nid-de-pie');
    expect(partyMoneyTotal(get).gold).toBe(5);
    expect(get().vessel!.upgrades).toEqual([{ id: 'nid-de-pie' }]);
    // Un Trait de CONSTRUCTION ne se pose pas après coup (ch.12 l.169).
    expect(installerLAmelioration(get, set, 'renforce')).toEqual([]);
    expect(get().journal.some((l) => l.includes('Trait de construction'))).toBe(true);
  });
});

describe('#1652 — chaque événement lit SES paramètres en donnée (MDG 15 l.132-263)', () => {
  beforeEach(freshState);
  afterEach(() => resetData());

  function jourForce(id: string): void {
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0], { cadence: 'jourParJour' })!;
    set({ travelPlan: { ...plan, sea: { ...plan.sea!, forcedEventId: id } } });
    runSeaDay(get, set);
  }

  it('Bonne humeur : sa `consequence` fait bouger le Moral (MDG 15 l.220 « Gagnez 2d10 Moral »)', () => {
    const moral = (delta: object) => ({ kind: 'effet', effet: { type: 'ops', on: 'navire', ops: [{ op: 'shipMorale', delta }] } });
    expect(seaBoardEventById('bonne-humeur')?.consequence).toEqual(moral({ sign: 1, dice: { n: 2, sides: 10 } }));
    setDataset('seaBoardEvents', BOARD_EVENTS.map((e) => (e.id === 'bonne-humeur' ? { ...e, consequence: moral({ sign: 1, dice: { n: 0, sides: 10, plus: 4 } }) } : e)) as never);
    jourForce('bonne-humeur');
    expect(get().vessel!.morale.score).toBe(75 + 4);
  });
});

describe('Port désert — #150 (resolvePortArrival appelé APRÈS purge de travelPlan)', () => {
  beforeEach(freshState);

  const seq = (...vals: number[]): RNG => desEnSuite(vals, { boucle: true, borne: true });

  it('Port désert (Taille 1 ou 2) : si le capitaine insiste pour fouiller, le Moral diminue d’1d10 — navire résolu depuis `vessel`, PAS `travelPlan` (déjà `null` ici, cf. accostage) (MDG 15 l.249)', () => {
    expect(get().travelPlan).toBeNull(); // reproduit exactement le contexte du bug : plan déjà purgé
    // Humeur de Manann neutre (mod 0) : 2d10 = 2+3 = 5 → « Port désert ». Puis 2d10 = 1+1 (heures, sans effet ici).
    resolvePortArrival(get, set, { taille: 2, richesse: 1, production: [] }, seq(2, 3, 1, 1));
    expect(get().pendingCascade?.participants[0].kind).toBe('choixDeFlux');
    avanceEtapeCascade(get, undefined, () => 'oui');
    expect(get().vessel!.morale.score).toBeLessThan(75);
    expect(get().vessel!.morale.score).toBeGreaterThanOrEqual(65);
  });

  it('Port désert : un port plus grand que Taille 2 n’est pas désert (MDG 15 l.249 « Taille 1 ou 2 »)', () => {
    resolvePortArrival(get, set, { taille: 3, richesse: 1, production: [] }, seq(2, 3, 1, 1));
    expect(get().pendingCascade).toBeNull();
    expect(get().vessel!.morale.score).toBe(75);
  });
});

describe('Relâche à terre — #185 (choix joueur AVANT événement de port, MDG 15 l.245 : « Si vous avez refusé la permission de faire relâche à terre à votre équipage, cet événement [Embrigadement] n\'a pas lieu »)', () => {
  beforeEach(freshState);

  const seq = (...vals: number[]): RNG => desEnSuite(vals, { boucle: true, borne: true });

  function moodMinus1() {
    set({ vessel: { ...get().vessel!, manann: { score: -1, applied: [] } } }); // mod −1 → roll min 1 atteignable (Embrigadement)
  }

  it('relâche REFUSÉE : Embrigadement (2d10 → 1) n\'a pas lieu — aucune perte d\'équipage, journal explicite', () => {
    moodMinus1();
    resolvePortArrival(get, set, undefined, seq(1, 1, 1, 1), false);
    expect(get().vessel!.crewLost ?? 0).toBe(0);
    expect(get().journal.some((l) => l.includes('n\'a pas lieu'))).toBe(true);
  });

  it('relâche ACCORDÉE (défaut) : Embrigadement se produit normalement (2d10 marins perdus, MDG 15 l.245)', () => {
    moodMinus1();
    resolvePortArrival(get, set, undefined, seq(1, 1, 1, 1), true);
    expect(get().vessel!.crewLost).toBeGreaterThanOrEqual(2);
    expect(get().vessel!.crewLost).toBeLessThanOrEqual(15); // cogue : effectif nominal 15
  });

  it('relâche REFUSÉE : Fête de Manann (2d10 → 18) perd son bonus d\'Humeur (MDG 15 l.260)', () => {
    // Humeur neutre (mod 0) : 2d10 = 9+9 = 18 → « Fête de Manann » (min 18 max 18, sea-events.json).
    const drapeaux = get().flags;
    resolvePortArrival(get, set, undefined, seq(9, 9, 1, 1), false);
    expect(get().journal.some((l) => l.includes('« Fête de Manann » n\'a pas lieu'))).toBe(true);
    expect(get().vessel!.manann?.score ?? 0).toBe(0);
    expect(get().flags, 'la relâche se lit sur la rangée, aucun drapeau de monde').toEqual(drapeaux);
  });

  it('relâche ACCORDÉE : Fête de Manann applique bien son bonus d\'Humeur (2d10)', () => {
    resolvePortArrival(get, set, undefined, seq(9, 9, 1, 1), true);
    expect(get().vessel!.manann!.score).toBeGreaterThanOrEqual(2);
    expect(get().vessel!.manann!.score).toBeLessThanOrEqual(20);
  });

  it('accostage RÉEL (continueSeaDayAfterCascade) : pendingShoreLeave s\'ouvre AVANT tout tirage d\'événement de port', () => {
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0])!;
    set({ travelPlan: { ...plan, kmDone: plan.km - 5, sea: { ...plan.sea!, milesToday: 5 } } });
    // Clôture directe du jour (équivalent RAW-fidèle de la fin de cascade, sans dépendre du tirage du jour).
    continueSeaDayAfterCascade(get, set);
    draineCascade(get); // Mal de mer du premier jour : sa bande se joue avant l'accostage (#1479)
    expect(get().pendingShoreLeave).toBeTruthy();
    expect(get().pendingShoreLeave!.to.id).toBe('B');
    expect(get().journal.some((l) => l.includes('Événement de port'))).toBe(false); // pas encore tiré
    get().fenetreChoisir('relacheATerre', 'accorder', true);
    expect(get().pendingShoreLeave).toBeNull();
    draineCascade(get); // le dé de Désertion se joue dans SA fenêtre (siège du monde), puis la suite s'enchaîne
    expect(get().journal.some((l) => l.includes('Événement de port'))).toBe(true); // tiré APRÈS le choix
  });

  /**
   * #1426 — le dé de Désertion est un dé de MONDE : le siège qui POSSÈDE le monde (ici l'hôte solo,
   * `sieges.worldSeat`) le VOIT et le lance, comme le jet d'un héros. L'option de confort
   * « Dés fixés » n'entre pas dans cette surface : elle n'ajoute que la POSE du dé.
   */
  it('seam de jet — Désertion : SANS siège MJ, le siège du monde tient la fenêtre (la journée reprend quand il l\'a jouée)', () => {
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0])!;
    set({ travelPlan: { ...plan, kmDone: plan.km - 5, sea: { ...plan.sea!, milesToday: 5 } } });
    continueSeaDayAfterCascade(get, set);
    draineCascade(get); // Mal de mer du premier jour : sa bande se joue avant l'accostage (#1479)
    get().fenetreChoisir('relacheATerre', 'accorder', true);
    expect(get().pendingCascade, 'le siège local possède le monde : son dé se joue, il ne se tire pas en silence').toBeTruthy();
    expect(get().journal.some((l) => l.includes('Événement de port')), 'la suite attend le geste').toBe(false);
    draineCascade(get);
    expect(get().journal.some((l) => l.includes('Événement de port'))).toBe(true);
  });

  it('seam de jet (#275 Ronde 1, delta 1) — Désertion : AVEC siège MJ ≠ hôte, l\'étape SURFACE et est OWNÉE par le MJ', () => {
    set({ net: mjAuSiege1(get().net) });
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0])!;
    // daysAtSea non-nul + mer calme : évite le mal de mer (#460, MDG 14 l.211-222 — 1er jour/mauvais
    // temps) de surfacer AVANT la Désertion, seule étape que ce test veut ici.
    set({ travelPlan: { ...plan, kmDone: plan.km - 5, sea: { ...plan.sea!, daysAtSea: 5, milesToday: 5, weather: { ...plan.sea!.weather, vent: 'calme-plat' } } } });
    continueSeaDayAfterCascade(get, set);
    get().fenetreChoisir('relacheATerre', 'accorder', true);
    expect(get().pendingCascade).toBeTruthy(); // 'V' — surfacé au siège MJ, pas résolu d'office
    expect(get().journal.some((l) => l.includes('Événement de port'))).toBe(false); // suspendu AVANT la suite
    const owner = modalOwnerOf(get());
    expect(seatOwns(get(), 1, owner ?? undefined)).toBe(true);
    expect(seatOwns(get(), 0, owner ?? undefined)).toBe(false);
  });
});

describe('Entretien-survie maritime — #272 résiduel (Scorbut/Épuisement : la surface se DÉRIVE des porteurs, #1479)', () => {
  beforeEach(freshState);

  /**
   * #1479 — « À partir du moment où je dois faire un jet, il doit apparaitre. Y'a pas de "classe
   * spéciale" […] face a ... une maladie » (utilisateur, 2026-08-24). Le Scorbut est un Test de
   * Résistance porté par un héros que son joueur TIENT : sa fenêtre s'ouvre en solo comme ailleurs.
   */
  it('Scorbut : en solo jour-par-jour, la BANDE s’ouvre (M) — un jet subi n’est plus silencieux', () => {
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0], { cadence: 'jourParJour' })!;
    set({ travelPlan: { ...plan, sea: { ...plan.sea!, daysAtSea: 29, milesToday: 50 } } });
    continueSeaDayAfterCascade(get, set);
    const casc = get().pendingCascade!;
    expect(casc.purpose).toBe('seaScorbut');
    const bande = casc.participants.find((st) => st.kind === 'mer-scorbut')!;
    expect(bande, 'UNE bande, pas N étapes qui défilent pour le MÊME Test').toBeTruthy();
    expect(bande.participants).toHaveLength(get().party.filter((h) => !h.dead).length);
    expect(bande.participants!.every((r) => r.interactive), 'chaque porteur tient SA rangée').toBe(true);
    draineCascade(get);
    expect(get().pendingRest, 'la journée reprend une fois la bande jouée').toBeTruthy();
    expect(get().journal.some((l) => l.toLowerCase().includes('scorbut'))).toBe(true);
  });

  it('Scorbut : sous ORDRES COMMANDÉS, aucune fenêtre — la journée va d’un trait jusqu’à la halte', () => {
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0])!;
    set({ travelPlan: { ...plan, orders: { cadence: 'commande' }, sea: { ...plan.sea!, daysAtSea: 29, milesToday: 50 } } });
    continueSeaDayAfterCascade(get, set);
    expect(get().pendingCascade, 'traversée commandée = sans fenêtre (attendu validé en recette #1426)').toBeNull();
    expect(get().pendingRest).toBeTruthy();
    expect(get().journal.some((l) => l.toLowerCase().includes('scorbut')), 'jamais moins de TRACES').toBe(true);
  });

  it('Scorbut : AVEC siège MJ, l’étape SURFACE (V) — plus d’auto-résolution silencieuse ; la journée reprend après résolution', () => {
    set({ net: mjAuSiege1(get().net) });
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0], { cadence: 'jourParJour' })!;
    set({ travelPlan: { ...plan, sea: { ...plan.sea!, daysAtSea: 29, milesToday: 50 } } });
    continueSeaDayAfterCascade(get, set);
    expect(get().pendingCascade).toBeTruthy();
    expect(get().pendingCascade!.purpose).toBe('seaScorbut');
    expect(get().pendingCascade!.participants.every((s) => s.kind === 'mer-scorbut')).toBe(true);
    let guard = 0;
    while (get().pendingCascade?.purpose === 'seaScorbut' && guard++ < 10) stepCascade();
    expect(get().pendingRest).toBeTruthy(); // jamais résolue en silence — la journée reprend malgré tout
    expect(get().journal.some((l) => l.toLowerCase().includes('scorbut'))).toBe(true); // parité recap/journal avec le chemin inline
  });
});

/** ÉPUISEMENT : MDG 13 l.62, l.111 ; MDG 14 l.24-32, l.69 ; #1595 (issuecomment-6153321990). */
describe('Épuisement — les impliqués testent à la fin de la Période de travail (MDG 13 l.111, #1595)', () => {
  beforeEach(freshState);

  /** Groupe de prétirés, poste ÉPINGLÉ par index (`shipRole`, le geste du roster) ; Voile aux index
   *  `voile`, aucun autre porteur de Voile ni de Ramer. */
  function equipage(postes: (string | undefined)[], voile: number[]): Combatant[] {
    const party = tousLesHerosDeScenario(idsDeTest).slice(0, postes.length).map((h, i) => ({
      ...h,
      ...(postes[i] ? { shipRole: postes[i] } : {}),
      skills: [...h.skills.filter((sk) => sk.id !== 'voile' && sk.id !== 'ramer'), ...(voile.includes(i) ? [{ id: 'voile', spec: 'cogue', characteristic: 'agilite' as const, advances: 10 }] : [])],
    }));
    set({ party } as never);
    return party;
  }

  /** Joue les étapes, comme un joueur, jusqu'à la bande d'Épuisement ; `voie` tranche le choix de
   *  Progression (MDG 14 l.63), sinon son défaut. `undefined` si la journée se clôt sans la bande. */
  function jusquaLaBande(opts: { poser?: PoseDe; voie?: 'nav' | 'crew' }): CascadeStep | undefined {
    for (let i = 0; i < 120 && get().pendingCascade && get().pendingCascade!.purpose !== 'seaExhaustion'; i++) {
      avanceEtapeCascade(get, opts.poser, (st) => (st.kind === 'merProgressionChoix' ? opts.voie : undefined));
    }
    const casc = get().pendingCascade;
    return casc?.purpose === 'seaExhaustion' ? casc.participants.find((st) => st.kind === 'mer-epuisement') : undefined;
  }

  /** Temps clément du jour en cours (setup : la météo du lendemain se tire à la clôture). */
  const tempsClement = { temperature: 'mediane', precipitations: 'aucune', vent: 'brise-fraiche' } as const;

  /** Joue UNE journée par `runSeaDay`, comme un joueur, jusqu'à la bande d'Épuisement ; `undefined` si
   *  la journée se clôt sans elle. */
  function bandeDuJour(opts: { pace?: number; poser?: PoseDe; voie?: 'nav' | 'crew'; sea?: Partial<SeaVoyageState>; cadence?: 'jourParJour' | 'commande' } = {}): CascadeStep | undefined {
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0], { cadence: opts.cadence ?? 'jourParJour', ...(opts.pace ? { pace: opts.pace } : {}) })!;
    set({ travelPlan: { ...plan, sea: { ...plan.sea!, daysAtSea: 1, daysToEvent: 99, ...opts.sea, weather: { ...plan.sea!.weather, ...tempsClement, ...opts.sea?.weather } } } });
    runSeaDay(get, set);
    return jusquaLaBande(opts);
  }

  /** Clôt la journée en cours, dort (le bouton Repos), et joue le LENDEMAIN jusqu'à sa bande. */
  function bandeDuLendemain(opts: { voie?: 'nav' | 'crew' } = {}): CascadeStep | undefined {
    draineCascade(get);
    const sea = get().travelPlan!.sea!;
    set({ travelPlan: { ...get().travelPlan!, sea: { ...sea, daysToEvent: 99, weather: { ...sea.weather, ...tempsClement } } } });
    get().fenetreValider('repos');
    return jusquaLaBande(opts);
  }

  it('un Timonier et un Mousse testent en Accessible ; la Vigie, le marin au repos et le passager ne testent pas', () => {
    const [timonier, mousse] = equipage(['timonier', 'mousse', 'vigie', 'repos', undefined], [0, 1]);
    const bande = bandeDuJour();
    expect(bande, 'la Période de travail à la voile ouvre la bande').toBeTruthy();
    expect(bande!.participants!.map((r) => r.id)).toEqual([timonier.id, mousse.id]);
    expect(bande!.participants!.map((r) => r.difficulty), 'jour non forcé').toEqual(['accessible', 'accessible']);
  });

  it('voie Navigation retenue : le barreur et son soutien de Voile, sans poste de propulsion, testent', () => {
    const [capitaine, navigateur] = equipage(['capitaine', 'navigateur', 'vigie'], [0, 1]);
    const bande = bandeDuJour({ voie: 'nav' });
    expect(bande, 'la Période de travail à la voile ouvre la bande').toBeTruthy();
    expect(bande!.participants!.map((r) => r.id)).toEqual([capitaine.id, navigateur.id]);
  });

  it('jour forcé avec un soutien : le soutien teste lui aussi, en Complexe', () => {
    const [capitaine, soutien] = equipage(['capitaine', 'repos', 'vigie'], [0, 1]);
    const bande = bandeDuJour({ pace: 1 });
    expect(bande!.participants!.map((r) => r.id)).toEqual([capitaine.id, soutien.id]);
    expect(bande!.participants!.map((r) => r.difficulty)).toEqual(['complexe', 'complexe']);
  });

  it('le lendemain, en voie d’équipage, l’ex-barreur sans poste de propulsion ne teste plus', () => {
    const [capitaine, navigateur] = equipage(['capitaine', 'navigateur', 'vigie'], [0, 1]);
    expect(bandeDuJour({ voie: 'nav' })!.participants!.map((r) => r.id), 'jour 1 : voie Navigation').toEqual([capitaine.id, navigateur.id]);
    expect(bandeDuLendemain({ voie: 'crew' }), 'jour 2 : personne n’a manié ni ne tient de poste de propulsion').toBeUndefined();
    expect(get().travelPlan!.sea!.daysAtSea, 'le lendemain s’est bien joué').toBe(3);
    expect(get().pendingRest).toBeTruthy();
  });

  it('un Mousse inconscient ne teste pas', () => {
    const [timonier] = equipage(['timonier', 'mousse'], [0, 1]);
    set({ party: get().party.map((h, i) => (i === 1 ? { ...h, conditions: [...h.conditions, { id: 'inconscient', value: 1 }] } : h)) } as never);
    expect(bandeDuJour()!.participants!.map((r) => r.id)).toEqual([timonier.id]);
  });

  it('un Capitaine qui a Forcé le rythme teste, en Complexe, que le Test de Voile soit gagné ou perdu', () => {
    for (const [de, issue] of [[1, 'reussite'], [100, 'echec']] as const) {
      freshState();
      const [capitaine] = equipage(['capitaine', 'vigie', 'repos'], [0]);
      const bande = bandeDuJour({ pace: 1, poser: (etape) => (etape.kind === 'mer-forcer-le-rythme' ? de : undefined) });
      expect(get().travelPlan!.sea!.paceToday, `rythme forcé : ${issue}`).toBe(issue);
      expect(bande!.participants!.map((r) => r.id), 'le Capitaine a manié les voiles en forçant').toEqual([capitaine.id]);
      expect(bande!.participants!.map((r) => r.difficulty)).toEqual(['complexe']);
    }
  });

  it('affalé, encalminé, échoué ou à vapeur : aucune Période de travail, aucune bande', () => {
    const cas: [string, () => void, Partial<SeaVoyageState>][] = [
      ['affalé', () => {}, { weather: { vent: 'violente-tempete' } as SeaVoyageState['weather'] }],
      ['encalminé', () => {}, { weather: { vent: 'calme-plat' } as SeaVoyageState['weather'] }],
      ['échoué', () => {}, { stranded: { hazardId: 'bas-fonds', label: 'un banc de sable' } }],
      ['à vapeur', () => set({ vessel: { ...get().vessel!, upgrades: [{ id: 'propulsion-a-vapeur' }] } }), {}],
    ];
    for (const [nom, navire, sea] of cas) {
      freshState();
      equipage(['timonier', 'mousse'], [0, 1]);
      navire();
      expect(bandeDuJour({ sea }), nom).toBeUndefined();
      expect(get().pendingRest, `${nom} : la journée s’est close`).toBeTruthy();
    }
  });

  it('sous ordres COMMANDÉS, la bande se résout sans fenêtre et le journal trace le jet de chaque impliqué', () => {
    const [timonier, mousse, vigie] = equipage(['timonier', 'mousse', 'vigie'], [0, 1]);
    expect(bandeDuJour({ cadence: 'commande' })).toBeUndefined();
    expect(get().pendingCascade).toBeNull();
    expect(get().pendingRest).toBeTruthy();
    const resistance = (h: Combatant) => get().journal.filter((l) => l.startsWith(`${h.label} — Résistance`)).length;
    expect([timonier, mousse, vigie].map(resistance)).toEqual([1, 1, 0]);
  });

  it('avec siège MJ, la bande SURFACE et la journée reprend après résolution', () => {
    equipage(['timonier', 'mousse'], [0, 1]);
    set({ net: mjAuSiege1(get().net) });
    expect(bandeDuJour(), 'la bande s’ouvre').toBeTruthy();
    draineCascade(get);
    expect(get().pendingRest).toBeTruthy();
  });
});

describe('Mal de mer — #460 (MDG 14 l.211-222, câblage jamais branché, cycle de maladie réutilisé)', () => {
  beforeEach(freshState);

  /** Bande du mal de mer : une rangée par porteur, chacune avec SON verdict. */
  const bandeMalDeMer = (rows: { id: string; success: boolean }[]): CascadeStep => ({
    id: 'x', kind: 'mer-mal-de-mer', label: fixtureText('x'), groupOwner: true,
    participants: rows.map((r) => ({ id: r.id, interactive: true, base: 40, target: 40, result: { roll: r.success ? 1 : 99, target: 40, sl: r.success ? 6 : -6, success: r.success } })),
  });

  it('applier `mer-mal-de-mer` : la rangée en échec contracte (malaise/nausée/persistant), pas sa voisine', () => {
    const [a, b] = get().party;
    a.diseases = [];
    b.diseases = [];
    applierDe('mer-mal-de-mer')!(get, set, bandeMalDeMer([{ id: a.id, success: false }, { id: b.id, success: true }]), a, { steps: [], index: 0 });
    const found = get().party.find((h) => h.id === a.id)!.diseases?.find((d) => d.id === 'mal-de-mer');
    expect(found).toBeTruthy();
    expect(found!.symptoms.map((s) => s.symptomId).sort()).toEqual(['malaise', 'nausee', 'persistant']);
    expect(get().party.find((h) => h.id === b.id)!.diseases ?? [], 'la réussite ne contracte rien').toHaveLength(0);
  });

  it('applier `mer-mal-de-mer` : bande TOUTE réussie → rien', () => {
    const [a, b] = get().party;
    a.diseases = [];
    b.diseases = [];
    applierDe('mer-mal-de-mer')!(get, set, bandeMalDeMer([{ id: a.id, success: true }, { id: b.id, success: true }]), a, { steps: [], index: 0 });
    expect(get().party.flatMap((h) => h.diseases ?? [])).toHaveLength(0);
  });

  it('1er jour de traversée (`daysAtSea === 0`) → UNE bande `mer-mal-de-mer`, une RANGÉE par PJ non-elfe', () => {
    set({ net: mjAuSiege1(get().net) });
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0], { cadence: 'jourParJour' })!;
    set({ travelPlan: { ...plan, sea: { ...plan.sea!, daysAtSea: 0, weather: { ...plan.sea!.weather, vent: 'calme-plat' } } } });
    continueSeaDayAfterCascade(get, set);
    expect(get().pendingCascade).toBeTruthy();
    expect(get().pendingCascade!.purpose).toBe('seaScorbut'); // MÊME cascade « Entretien — Maladies » (#460)
    // UNE SITUATION = UNE FENÊTRE : un seul Test (MDG 14 l.217), donc UNE étape — les PJ appelés y
    // tiennent chacun leur rangée, jamais N modales pour le même jet.
    const bandes = get().pendingCascade!.participants.filter((s) => s.kind === 'mer-mal-de-mer');
    expect(bandes).toHaveLength(1);
    expect(bandes[0].participants!.map((r) => r.id)).toEqual(get().party.map((h) => h.id));
  });

  it('mauvais temps (Vent violent ou plus, l.218) → une bande `mer-mal-de-mer`, même hors 1er jour', () => {
    set({ net: mjAuSiege1(get().net) });
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0], { cadence: 'jourParJour' })!;
    set({ travelPlan: { ...plan, sea: { ...plan.sea!, daysAtSea: 5, weather: { ...plan.sea!.weather, vent: 'vent-violent' } } } });
    continueSeaDayAfterCascade(get, set);
    expect(get().pendingCascade).toBeTruthy();
    const kinds = get().pendingCascade!.participants.map((s) => s.kind);
    expect(kinds).toContain('mer-mal-de-mer');
  });

  it('ni 1er jour ni mauvais temps → aucune étape `mer-mal-de-mer` (jour de routine)', () => {
    set({ net: mjAuSiege1(get().net) });
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0])!;
    set({ travelPlan: { ...plan, sea: { ...plan.sea!, daysAtSea: 5, weather: { ...plan.sea!.weather, vent: 'calme-plat' } } } });
    continueSeaDayAfterCascade(get, set);
    expect(get().pendingCascade).toBeNull();
    expect(get().pendingRest).toBeTruthy();
  });

  it('Personnage elfe (`hauts-elfes`) IMMUNISÉ (l.215) : aucune étape posée, même au 1er jour + mauvais temps', () => {
    set({ net: mjAuSiege1(get().net) });
    const party = get().party.map((h) => ({ ...h, species: 'hauts-elfes' }));
    set({ party });
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0])!;
    set({ travelPlan: { ...plan, sea: { ...plan.sea!, daysAtSea: 0, weather: { ...plan.sea!.weather, vent: 'vent-violent' } } } });
    continueSeaDayAfterCascade(get, set);
    // Aucune maladie déclenchée du tout ce jour (ni tonneau — pas d'eau suivie — ni scorbut) : routine.
    expect(get().pendingCascade).toBeNull();
    expect(get().pendingRest).toBeTruthy();
  });

  it('l’immunité suit le groupe `elfe` de l’espèce (`grantGroups`), pas son id : groupe retiré → testé', () => {
    set({ net: mjAuSiege1(get().net) });
    setDataset('species', species.map((s) => (s.id === 'hauts-elfes' ? { ...s, grantGroups: s.grantGroups.filter((g) => g !== 'elfe') } : s)));
    set({ party: get().party.map((h) => ({ ...h, species: 'hauts-elfes' })) });
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0], { cadence: 'jourParJour' })!;
    set({ travelPlan: { ...plan, sea: { ...plan.sea!, daysAtSea: 0, weather: { ...plan.sea!.weather, vent: 'calme-plat' } } } });
    continueSeaDayAfterCascade(get, set);
    const bandes = get().pendingCascade?.participants.filter((s) => s.kind === 'mer-mal-de-mer') ?? [];
    resetData();
    expect(bandes).toHaveLength(1);
  });

  it('déjà immunisé (`diseaseImmunities`) → aucune étape reposée', () => {
    set({ net: mjAuSiege1(get().net) });
    const party = get().party.map((h) => ({ ...h, diseaseImmunities: ['mal-de-mer'] }));
    set({ party });
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0])!;
    set({ travelPlan: { ...plan, sea: { ...plan.sea!, daysAtSea: 0, weather: { ...plan.sea!.weather, vent: 'calme-plat' } } } });
    continueSeaDayAfterCascade(get, set);
    expect(get().pendingCascade).toBeNull();
    expect(get().pendingRest).toBeTruthy();
  });
});

describe('Tonneau d\'eau contaminé — #460 (MDG 14 l.209, `vessel.waterLitres` seul — la petite bière y échappe)', () => {
  beforeEach(freshState);

  it('applier `mer-tonneau-contamine` : échec → `sea.waterContaminated` posé (visible dès demain)', () => {
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0])!;
    set({ travelPlan: plan });
    const hero = get().party[0];
    applierDe('mer-tonneau-contamine')!(get, set, { id: 'x', kind: 'mer-tonneau-contamine', label: fixtureText('x'), result: { roll: 99, target: 40, sl: -6, success: false }, meta: { diseaseId: 'flux-sanglant' } }, hero, { steps: [], index: 0 });
    expect(get().travelPlan!.sea!.waterContaminated).toEqual({ diseaseId: 'flux-sanglant' });
  });

  it('applier `mer-tonneau-contamine` : réussite → rien', () => {
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0])!;
    set({ travelPlan: plan });
    const hero = get().party[0];
    applierDe('mer-tonneau-contamine')!(get, set, { id: 'x', kind: 'mer-tonneau-contamine', label: fixtureText('x'), result: { roll: 1, target: 40, sl: 6, success: true }, meta: { diseaseId: 'flux-sanglant' } }, hero, { steps: [], index: 0 });
    expect(get().travelPlan!.sea!.waterContaminated).toBeUndefined();
  });

  it('applier `mer-tonneau-expose` : boire au tonneau contaminé, échec → contracté', () => {
    const hero = get().party[0];
    hero.diseases = [];
    applierDe('mer-tonneau-expose')!(get, set, { id: 'x', kind: 'mer-tonneau-expose', label: fixtureText('x'), result: { roll: 99, target: 20, sl: -8, success: false }, meta: { diseaseId: 'peste-noire' } }, hero, { steps: [], index: 0 });
    expect(get().party.find((h) => h.id === hero.id)!.diseases?.some((d) => d.id === 'peste-noire')).toBe(true);
  });

  it('applier `mer-tonneau-expose` : réussite → rien', () => {
    const hero = get().party[0];
    hero.diseases = [];
    applierDe('mer-tonneau-expose')!(get, set, { id: 'x', kind: 'mer-tonneau-expose', label: fixtureText('x'), result: { roll: 1, target: 20, sl: 8, success: true }, meta: { diseaseId: 'peste-noire' } }, hero, { steps: [], index: 0 });
    expect(get().party.find((h) => h.id === hero.id)!.diseases ?? []).toHaveLength(0);
  });

  it('porteur ACTIF de peste noire buvant à `vessel.waterLitres` → une étape `mer-tonneau-contamine`', () => {
    set({ net: mjAuSiege1(get().net) });
    const party = [...get().party];
    party[0] = { ...party[0], diseases: [contractDisease('peste-noire', makeRNG(1), { incubation: 0 })!] };
    set({ party, vessel: { ...get().vessel!, waterLitres: 1000 } });
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0], { cadence: 'jourParJour' })!;
    set({ travelPlan: { ...plan, sea: { ...plan.sea!, daysAtSea: 5, weather: { ...plan.sea!.weather, vent: 'calme-plat' } } } });
    continueSeaDayAfterCascade(get, set);
    expect(get().pendingCascade).toBeTruthy();
    const step = get().pendingCascade!.participants.find((s) => s.kind === 'mer-tonneau-contamine');
    expect(step).toBeTruthy();
    expect(step!.actorId).toBe(party[0].id);
  });

  it('PARITÉ : les 4 maladies contaminant le tonneau le DÉCLARENT en donnée, et elles seules (MDG 14 l.209)', () => {
    // « Si un membre d'équipage souffrant de la peste noire, du flux sanglant, de la courante galopante
    // ou de la vérole urticante boit dans un tonneau d'eau… » — le flux ne nomme plus aucun id.
    const declares = maladies.filter((m) => m.contaminatesWaterBarrel).map((m) => m.id).sort();
    expect(declares).toEqual(['courante-galopante', 'flux-sanglant', 'peste-noire', 'verole-urticante']);
  });

  it('SANS tonneau d\'eau suivi (`vessel.waterLitres` absent) → aucune étape de tonneau, même avec un porteur actif', () => {
    set({ net: mjAuSiege1(get().net) });
    const party = [...get().party];
    party[0] = { ...party[0], diseases: [contractDisease('peste-noire', makeRNG(1), { incubation: 0 })!] };
    set({ party }); // vessel.waterLitres reste undefined (freshState)
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0])!;
    set({ travelPlan: { ...plan, sea: { ...plan.sea!, daysAtSea: 5, weather: { ...plan.sea!.weather, vent: 'calme-plat' } } } });
    continueSeaDayAfterCascade(get, set);
    expect(get().pendingCascade).toBeNull();
    expect(get().pendingRest).toBeTruthy();
  });

  it('tonneau DÉJÀ contaminé la veille → chaque PJ qui boit AUJOURD\'HUI est EXPOSÉ (`mer-tonneau-expose`)', () => {
    set({ net: mjAuSiege1(get().net) });
    set({ vessel: { ...get().vessel!, waterLitres: 1000 } });
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0], { cadence: 'jourParJour' })!;
    set({ travelPlan: { ...plan, sea: { ...plan.sea!, daysAtSea: 5, weather: { ...plan.sea!.weather, vent: 'calme-plat' }, waterContaminated: { diseaseId: 'courante-galopante' } } } });
    continueSeaDayAfterCascade(get, set);
    expect(get().pendingCascade).toBeTruthy();
    const kinds = get().pendingCascade!.participants.map((s) => s.kind);
    expect(kinds.filter((k) => k === 'mer-tonneau-expose')).toHaveLength(get().party.length);
  });

  it('un PJ DÉJÀ porteur de la maladie du tonneau n\'est PAS re-testé (`contractionDue`)', () => {
    set({ net: mjAuSiege1(get().net) });
    const party = [...get().party];
    party[0] = { ...party[0], diseases: [contractDisease('courante-galopante', makeRNG(1), { incubation: 0 })!] };
    set({ party, vessel: { ...get().vessel!, waterLitres: 1000 } });
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0], { cadence: 'jourParJour' })!;
    set({ travelPlan: { ...plan, sea: { ...plan.sea!, daysAtSea: 5, weather: { ...plan.sea!.weather, vent: 'calme-plat' }, waterContaminated: { diseaseId: 'courante-galopante' } } } });
    continueSeaDayAfterCascade(get, set);
    expect(get().pendingCascade).toBeTruthy();
    const kinds = get().pendingCascade!.participants.map((s) => s.kind);
    expect(kinds.filter((k) => k === 'mer-tonneau-expose')).toHaveLength(get().party.length - 1); // le porteur déjà malade est écarté
  });
});

describe('Périls en mer — collision routée par la DONNÉE (#444, MDG 13 l.475-499, zéro IC/chance en dur)', () => {
  beforeEach(freshState);
  afterEach(() => resetData());

  /** La Collision soudaine heurte le péril `id` (op `perilDeMer`) — surcharge levée par `resetData`. */
  function forceHazard(id: string): void {
    const consequence = { kind: 'effet', effet: { type: 'ops', on: 'navire', ops: [{ op: 'perilDeMer', collision: { id } }] } };
    setDataset('seaBoardEvents', BOARD_EVENTS.map((e) => (e.id === 'collision-soudaine' ? { ...e, consequence } : e)) as never);
  }

  it('la Collision soudaine heurte un Rocher (MDG 15 l.181 « se heurte à un rocher »)', () => {
    expect(seaBoardEventById('collision-soudaine')?.consequence).toEqual({ kind: 'effet', effet: { type: 'ops', on: 'navire', ops: [{ op: 'perilDeMer', collision: { id: 'rocher' } }] } });
  });

  it('le dégât suit l’IC ÉDITÉ en donnée (pas 47 figé) — modifier `sea-perils.json` en mémoire change le résultat', () => {
    const rocher = findSeaHazard('rocher')!;
    const originalIc = rocher.ic;
    try {
      rocher.ic = 5; // valeur ÉDITÉE, jamais l'ancien magic number 47
      const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0])!;
      set({ travelPlan: { ...plan, sea: { ...plan.sea!, forcedEventId: 'collision-soudaine' } } });
      runSeaDay(get, set);
      expect(get().journal.some((l) => l.includes('Rocher IC 5'))).toBe(true);
      expect(get().journal.some((l) => l.includes('IC 47'))).toBe(false);
    } finally {
      rocher.ic = originalIc;
    }
  });

  it('l’op `perilDeMer` résout chacun des 4 périls de la donnée (dégâts de coque encaissés)', () => {
    for (const id of ['iceberg', 'debris-marins', 'rocher', 'bas-fonds']) {
      freshState();
      forceHazard(id);
      const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0])!;
      set({ travelPlan: { ...plan, sea: { ...plan.sea!, forcedEventId: 'collision-soudaine' } } });
      const before = get().travelPlan!.vehicle!.wounds.current;
      runSeaDay(get, set);
      const hazard = findSeaHazard(id)!;
      expect(get().journal.some((l) => l.includes(`${hazard.label} IC ${hazard.ic}`))).toBe(true);
      expect(get().travelPlan!.vehicle!.wounds.current).toBeLessThanOrEqual(before);
    }
  });

  it('Rocher/Bas-fonds : Échouage possible (`strandingOccurs`) → `sea.stranded` posé, dégagement = Test de Force (#444)', () => {
    const rocher = findSeaHazard('rocher')!;
    const originalPct = rocher.strandChancePct;
    try {
      rocher.strandChancePct = 100; // force l'Échouage (garantit le branchement, indépendant du hasard)
      const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0], { cadence: 'jourParJour' })!;
      set({ travelPlan: { ...plan, sea: { ...plan.sea!, forcedEventId: 'collision-soudaine' } } });
      runSeaDay(get, set);
      expect(get().travelPlan!.sea!.stranded).toBeTruthy();
      expect(get().travelPlan!.sea!.stranded!.hazardId).toBe('rocher');
    } finally {
      rocher.strandChancePct = originalPct;
    }
  });

  /**
   * LA POSITION DU DÉ SE LIT SUR LE GARDE, JAMAIS SUR LA DONNÉE QU'IL PROTÈGE (#1479) — la
   * conséquence d'une collision tire un dé de MONDE (`deMonde`) pour l'empêtrement (l.485). Ce dé ne
   * doit être demandé QUE si le péril ouvre l'issue (`entangleChancePct`), exactement comme le dé
   * d'Échouage l'est déjà (`strandChancePct != null && strandingOccurs(...)`). Tiré AVANT le garde, il
   * décalait le flux RNG de toute la suite du voyage pour des périls qui n'empêtrent jamais.
   *
   * MESURE : la MÊME journée, même graine, même péril — seule la DONNÉE change. `0 %` (donnée
   * PRÉSENTE, chance qui ne mord jamais) tire son dé ; ABSENTE, aucun. L'écart doit être d'UN dé.
   */
  it('un péril SANS `entangleChancePct` ne consomme AUCUN dé (le garde passe AVANT le dé)', () => {
    /** Tirages consommés par le RNG de bataille depuis `seed` : le flux est déterministe — on ré-avance
     *  un flux NEUF jusqu'à retrouver la valeur qui vient. */
    const tiragesConsommes = (seed: number, limite = 50000): number => {
      const suivante = battleRng().int(0, 2 ** 30);
      const neuf = makeRNG(seed);
      for (let i = 0; i < limite; i++) if (neuf.int(0, 2 ** 30) === suivante) return i;
      throw new Error('flux du RNG introuvable — la mesure ne vaut rien');
    };
    const debris = findSeaHazard('debris-marins')!;
    const pctOriginal = debris.entangleChancePct;
    const consomme = (chance: number | undefined): number => {
      forceHazard('debris-marins');
      freshState(); // renseème à 1
      debris.entangleChancePct = chance;
      const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0], { cadence: 'jourParJour' })!;
      set({ travelPlan: { ...plan, sea: { ...plan.sea!, forcedEventId: 'collision-soudaine' } } });
      runSeaDay(get, set);
      return tiragesConsommes(1);
    };
    try {
      const avecDonnee = consomme(0);
      const sansDonnee = consomme(undefined);
      expect(avecDonnee - sansDonnee, 'le dé d’empêtrement se tire APRÈS le garde — un péril sans chance n’en consomme aucun').toBe(1);
    } finally {
      debris.entangleChancePct = pctOriginal;
      freshState();
    }
  });

  it('Débris marins : empêtrement possible (`debrisEntangleFor`) → `sea.entangled` posé avec manDR/mMod de la donnée', () => {
    forceHazard('debris-marins');
    const debris = findSeaHazard('debris-marins')!;
    const originalPct = debris.entangleChancePct;
    try {
      debris.entangleChancePct = 100; // force l'empêtrement
      const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0])!;
      set({ travelPlan: { ...plan, sea: { ...plan.sea!, forcedEventId: 'collision-soudaine' } } });
      runSeaDay(get, set);
      const entangled = get().travelPlan!.sea!.entangled;
      expect(entangled).toBeTruthy();
      expect(entangled!.hazardId).toBe('debris-marins');
      expect(entangled!.need).toBe(debris.freeTest!.drCible); // cogue = Taille moyenne → bande moyenne/grande
      expect(entangled!.manDR).toBe(-1);
      expect(entangled!.mMod).toBe(0);
    } finally {
      debris.entangleChancePct = originalPct;
    }
  });
});

describe('Échouage/Empêtrement — dégagement par Test de Force (#444, appliers `mer-degagement`/`mer-degagement-debris`)', () => {
  beforeEach(freshState);

  function planWithSea() {
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0])!;
    set({ travelPlan: plan });
    return plan;
  }
  function step(kind: GenreDeCascade, sl: number, success = sl >= 1): CascadeStep {
    return { id: kind, kind, label: fixtureText(kind), result: { roll: 0, target: 0, sl, success }};
  }
  const apply = (kind: GenreDeCascade, sl: number, success = sl >= 1) =>
    applierDe(kind)!(get, set, step(kind, sl, success), undefined, { steps: [], index: 0 });

  it('Débris marins : l’étape de dégagement met en jeu SON enjeu (MDG 13 l.487-491), pas la progression bloquée de l’Échouage', () => {
    const plan = planWithSea();
    const need = findSeaHazard('debris-marins')!.freeTest!.drCible;
    set({ travelPlan: { ...plan, sea: { ...plan.sea!, entangled: { hazardId: 'debris-marins', label: 'Débris marins', need, progress: 0, manDR: -1, mMod: 0, difficulty: 'accessible' } } } });
    const st = apply('equipage-progression', 2, true)?.insert?.find((s) => s.kind === 'mer-degagement-debris');
    expect(st).toBeTruthy();
    expect(st?.stake?.key?.kind).toBe('mer-degagement-debris');
    expect(resolveStake(st!.stake!).text).toContain(`total de ${need} DR`); // MDG 13 l.491
  });

  it('mer-degagement : succès → `sea.stranded` levé', () => {
    const plan = planWithSea();
    set({ travelPlan: { ...plan, sea: { ...plan.sea!, stranded: { hazardId: 'rocher', label: 'Rocher' } } } });
    apply('mer-degagement', 3, true);
    expect(get().travelPlan!.sea!.stranded).toBeUndefined();
  });

  it('mer-degagement : échec → `sea.stranded` PERSISTE (à retenter)', () => {
    const plan = planWithSea();
    set({ travelPlan: { ...plan, sea: { ...plan.sea!, stranded: { hazardId: 'rocher', label: 'Rocher' } } } });
    apply('mer-degagement', -2, false);
    expect(get().travelPlan!.sea!.stranded).toBeTruthy();
  });

  it('mer-degagement-debris : Test ÉTENDU — cumule jusqu’au total DR de `hazard.freeTest`, puis lève `sea.entangled`', () => {
    const plan = planWithSea();
    set({ travelPlan: { ...plan, sea: { ...plan.sea!, entangled: { hazardId: 'debris-marins', label: 'Débris marins', need: 10, progress: 6, manDR: -1, mMod: 0, difficulty: 'accessible' } } } });
    apply('mer-degagement-debris', 5, true); // 6 + 5 = 11 ≥ 10 → dégagé
    expect(get().travelPlan!.sea!.entangled).toBeUndefined();
  });

  it('mer-degagement-debris : progression insuffisante → `sea.entangled` PERSISTE avec le total cumulé', () => {
    const plan = planWithSea();
    set({ travelPlan: { ...plan, sea: { ...plan.sea!, entangled: { hazardId: 'debris-marins', label: 'Débris marins', need: 10, progress: 0, manDR: -1, mMod: 0, difficulty: 'accessible' } } } });
    apply('mer-degagement-debris', 3, true);
    expect(get().travelPlan!.sea!.entangled?.progress).toBe(3);
  });

  it('ÉCHOUÉ : aucune Progression le temps du dégagement (`buildSeaDayCascade` route un Test de Force, milesToday reste à 0)', () => {
    const plan = planWithSea();
    set({ travelPlan: { ...plan, sea: { ...plan.sea!, stranded: { hazardId: 'rocher', label: 'Rocher' } } } });
    runSeaDay(get, set);
    expect(get().travelPlan!.sea!.milesToday).toBe(0);
    expect(get().journal.some((l) => l.includes('ÉCHOUÉ'))).toBe(true);
  });

  it('ÉCHOUÉ, cargaison de 18 Enc : le Test de Force de dégagement reste Intermédiaire et porte −18 sur la cible (MDG 13 l.473)', () => {
    set({ vessel: { ...get().vessel!, cargo: [{ uid: 'lot-6', cargoId: 'vin', enc: 18, basePriceGold: 0 }] } });
    const plan = planWithSea();
    set({ travelPlan: { ...plan, orders: { cadence: 'jourParJour' }, sea: { ...plan.sea!, stranded: { hazardId: 'rocher', label: 'Rocher' } } } });
    runSeaDay(get, set);
    const st = get().pendingCascade?.participants.find((x) => x.kind === 'mer-degagement');
    expect(st?.difficulty).toBe('intermediaire');
    expect(ligneDe(st?.mods, RULE_REF['echouer-en-mer'])).toMatchObject({ value: -18, famille: 'circonstance' });
  });
});

describe('Précipitations sur le pont — Tests d’équipage du jour de mer (MDG 13 l.185-200, #1936)', () => {
  beforeEach(freshState);

  const MALUS_TRES_ABONDANTES: Record<string, number> = {
    athletisme: -30, escalade: -30, commandement: -20, orientation: -20, perception: -20, ramer: -20, voile: -20,
  };

  it('un jour Très abondantes : chaque marin du Test d’Orientation porte la ligne « Météo : Très abondantes » sur la cible', () => {
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0], { cadence: 'jourParJour' })!;
    set({ travelPlan: { ...plan, sea: { ...plan.sea!, weather: { ...plan.sea!.weather, precipitations: 'tres-abondantes', vent: 'brise-fraiche' } } } });
    runSeaDay(get, set);
    let orientation: CascadeStep | undefined;
    for (let i = 0; i < 30 && !orientation; i++) {
      const p = get().pendingCascade;
      if (!p) break;
      const cur = p.participants[p.cursor];
      if (cur?.kind === 'equipage-orientation') { orientation = cur; break; }
      avanceEtapeCascade(get);
    }
    expect(orientation?.participants?.length).toBeGreaterThan(0);
    for (const part of orientation!.participants!) {
      expect(part.mods).toContainEqual(expect.objectContaining({
        label: 'Météo : Très abondantes', value: MALUS_TRES_ABONDANTES[part.skill?.id ?? ''] ?? -10, famille: 'circonstance',
      }));
    }
  });

  /** Le plan du jour sous Précipitations `precip`, à la cadence `cadence` (ordres permanents). */
  const sousLaPluie = (precip: 'aucune' | 'tres-abondantes', cadence: 'jourParJour' | 'commande', sea: Record<string, unknown> = {}) => {
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0], { cadence })!;
    set({ travelPlan: { ...plan, sea: { ...plan.sea!, ...sea, weather: { ...plan.sea!.weather, precipitations: precip, vent: 'brise-fraiche' } } } });
  };
  const METEO_CARAC = { label: 'Météo : Très abondantes', value: -10, famille: 'circonstance' };

  it('ÉCHOUÉ un jour Très abondantes : le Test de Force de dégagement porte « Météo » (Test de Caractéristique, −10) sur la cible', () => {
    sousLaPluie('tres-abondantes', 'jourParJour', { stranded: { hazardId: 'rocher', label: 'Rocher' } });
    runSeaDay(get, set);
    const st = get().pendingCascade?.participants.find((x) => x.kind === 'mer-degagement');
    expect(st?.mods).toContainEqual(expect.objectContaining(METEO_CARAC));
    expect(inexplique(st!)).toBe(0);
  });

  it('un Test de Caractéristique SANS Compétence ouvert en mer (`runFlow` → `openSkillTest`) porte « Météo » (−10) sur la cible', () => {
    sousLaPluie('tres-abondantes', 'jourParJour');
    runFlow(get, set, { kind: 'test', test: { characteristic: 'force', difficulty: 'intermediaire' }, reussite: EMPTY_FLOW, echec: EMPTY_FLOW });
    const pt = get().pendingTest!;
    expect(pt.sujet?.skill?.id).toBeUndefined();
    expect(pt.mods).toContainEqual(expect.objectContaining(METEO_CARAC));
  });

  it('cadence COMMANDÉE (résolution sur place) : au procès-verbal, la cible du Test d’Orientation inclut le −20 des Précipitations', () => {
    const lignesOrientation = (precip: 'aucune' | 'tres-abondantes') => {
      freshState();
      seedBattleRng(7);
      sousLaPluie(precip, 'commande');
      runSeaDay(get, set);
      expect(get().pendingCascade?.purpose ?? null, 'aucune fenêtre de jour en cadence commandée').not.toBe('travelDay');
      return (get().travelPlan?.log?.slice(-1)[0]?.entries ?? []).filter((e) => e.id?.startsWith('mer-equipage-orientation-')).map((e) => e.d!);
    };
    const seche = lignesOrientation('aucune');
    const mouille = lignesOrientation('tres-abondantes');
    expect(seche.length).toBeGreaterThan(0);
    expect(mouille.map((d) => d.base)).toEqual(seche.map((d) => d.base));
    expect(mouille.map((d) => d.target)).toEqual(seche.map((d) => d.target - 20));
  });

  it('EXPOSITION par le chemin joueur (`runSeaDay`) : sous Très abondantes, chaque cible de Résistance vaut celle du temps sec − 10', () => {
    const ciblesExposition = (precip: 'aucune' | 'tres-abondantes') => {
      freshState();
      seedBattleRng(7);
      const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0], { cadence: 'jourParJour' })!;
      set({ travelPlan: { ...plan, sea: { ...plan.sea!, daysAtSea: 1, weather: { ...plan.sea!.weather, temperature: 'glaciale', precipitations: precip, vent: 'brise-fraiche' } } } });
      runSeaDay(get, set);
      let guard = 0;
      while (get().pendingCascade && get().pendingCascade!.purpose !== 'seaExposure' && guard++ < 80) stepCascade();
      const casc = get().pendingCascade;
      expect(casc?.purpose, 'la journée atteint les Tests d’Exposition').toBe('seaExposure');
      return casc!.participants[0].participants!.map((r) => ({ id: r.id, target: r.target!, mods: r.mods ?? [] }));
    };
    const sec = ciblesExposition('aucune');
    const mouille = ciblesExposition('tres-abondantes');
    expect(sec.length).toBeGreaterThan(0);
    expect(mouille.map((r) => r.id)).toEqual(sec.map((r) => r.id));
    expect(mouille.map((r) => r.target)).toEqual(sec.map((r) => r.target - 10));
    for (const r of mouille) expect(r.mods).toContainEqual(expect.objectContaining(METEO_CARAC));
  });

  it('ÉPUISEMENT par le chemin joueur (`runSeaDay`) : sous Très abondantes, la cible vaut celle du temps sec − 10, et le même dé fait l’Exténué (MDG 13 l.111, l.185, l.200)', () => {
    const extenue = (id: string): number => get().party.find((h) => h.id === id)?.conditions.find((c) => c.id === 'extenue')?.value ?? 0;
    /** Joue la journée de rythme forcé jusqu'à la bande d'Épuisement, puis la draine au dé `de(rangée)`. */
    const journee = (precip: 'aucune' | 'tres-abondantes', de: (id: string, target: number) => number) => {
      freshState();
      seedBattleRng(7);
      // Forcer le rythme est un Test de Voile (MDG 13 l.95-107) : un marin au moins doit pouvoir le tenter.
      set({ party: get().party.map((h) => ({ ...h, skills: [...h.skills.filter((sk) => sk.id !== 'voile'), { id: 'voile', spec: 'cogue', characteristic: 'agilite', advances: 10 }] })) } as never);
      const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0], { pace: 1, cadence: 'jourParJour' })!;
      set({ travelPlan: { ...plan, sea: { ...plan.sea!, daysAtSea: 1, forcePace: 1, paceToday: undefined, weather: { ...plan.sea!.weather, temperature: 'mediane', precipitations: precip, vent: 'brise-fraiche' } } } });
      runSeaDay(get, set);
      let guard = 0;
      while (get().pendingCascade && get().pendingCascade!.purpose !== 'seaExhaustion' && guard++ < 80) stepCascade();
      const casc = get().pendingCascade;
      expect(casc?.purpose, 'la journée atteint le Test d’Épuisement').toBe('seaExhaustion');
      const rangees = casc!.participants[0].participants!.map((r) => ({ id: r.id, target: r.target!, mods: r.mods ?? [], avant: extenue(r.id) }));
      draineCascade(get, 200, (etape, rangee) => (etape.kind === 'mer-epuisement' && rangee ? de(rangee.id, rangee.target!) : undefined));
      return rangees.map((r) => ({ ...r, gagne: extenue(r.id) - r.avant }));
    };
    const sec = journee('aucune', (_id, target) => target);
    const cibleSeche = new Map(sec.map((r) => [r.id, r.target]));
    const mouille = journee('tres-abondantes', (id) => cibleSeche.get(id)!);
    expect(sec.length).toBeGreaterThan(0);
    expect(mouille.map((r) => r.id)).toEqual(sec.map((r) => r.id));
    expect(mouille.map((r) => r.target)).toEqual(sec.map((r) => r.target - 10));
    for (const r of mouille) expect(r.mods).toContainEqual(expect.objectContaining(METEO_CARAC));
    expect(sec.map((r) => r.gagne), 'temps sec : le dé égal à la cible réussit').toEqual(sec.map(() => 0));
    expect(mouille.map((r) => r.gagne), 'sous la pluie : le même dé échoue, l’applier pose l’Exténué').toEqual(mouille.map(() => 1));
  });

  /** MDG 13 l.187-200 : écart de cible imposé par chaque palier à un Test de chacune des trois familles. */
  const PALIERS = [
    { precip: 'legeres', physique: -10, manoeuvre: 0, autre: 0 },
    { precip: 'abondantes', physique: -20, manoeuvre: -10, autre: 0 },
    { precip: 'tres-abondantes', physique: -30, manoeuvre: -20, autre: -10 },
  ] as const;
  it.each(PALIERS)('palier « $precip » au monteur canonique : Athlétisme $physique, Perception $manoeuvre, Résistance $autre', ({ precip, physique, manoeuvre, autre }) => {
    const h = get().party[0];
    const ecart = (skill: string, char: 'agilite' | 'initiative' | 'endurance') => {
      const sec = rollLine({ actor: h, test: { skill: { id: skill }, characteristic: char }, difficulty: 'intermediaire' }).target;
      return rollLine({ actor: h, test: { skill: { id: skill }, characteristic: char }, difficulty: 'intermediaire', pont: precip }).target - sec;
    };
    expect(ecart('athletisme', 'agilite')).toBe(physique);
    expect(ecart('perception', 'initiative')).toBe(manoeuvre);
    expect(ecart('resistance', 'endurance')).toBe(autre);
  });
});

describe('Survitesse — « Ça va lâcher, capitaine ! » (#443, MDG 13 l.121-142)', () => {
  beforeEach(freshState);
  afterEach(() => resetRule('mer-survitesse-tests-par-jour'));

  // Cogue : sail.m = 5 (M de conception). Légère brise + vent arrière/latéral = pctSail 0 (aucun mod de
  // vent) → `eff.m` dépend UNIQUEMENT du modificateur `m` du navire (deterministe, aucun bruit de la météo tirée).
  function planWithSea(m?: number) {
    if (m != null) set({ vessel: { ...get().vessel!, modificateurs: [{ label: 'Vents favorables', m, jusqua: 'evenementDeBord' }] } });
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0])!;
    const sea = {
      ...plan.sea!,
      weather: { ...plan.sea!.weather, vent: 'legere-brise' as const },
      windFrom: 'ouest' as const, // heading 'est' + vent d'ouest → aspect ARRIÈRE (pctSail 0)
    };
    set({ travelPlan: { ...plan, sea } });
    return plan;
  }
  function step(kind: GenreDeCascade, sl: number, success = sl >= 1, meta?: Record<string, number>): CascadeStep {
    return { id: kind, kind, label: fixtureText(kind), result: { roll: 0, target: 0, sl, success }, meta };
  }
  const apply = (kind: GenreDeCascade, sl: number, success = sl >= 1, meta?: Record<string, number>) =>
    applierDe(kind)!(get, set, step(kind, sl, success, meta), undefined, { steps: [], index: 0 });

  it('pas de survitesse (M dans les clous, ≤ M+4) → la Progression n’insère aucun Test de survitesse', () => {
    planWithSea(); // aucun modificateur → M 5, sous le seuil M+4 (safeBonus)
    const out = apply('equipage-progression', 2, true);
    expect(get().travelPlan!.sea!.effMToday).toBeLessThanOrEqual(9); // baseM(5) + safeBonus(4)
    expect(out?.insert?.some((s) => s.kind === 'mer-survitesse')).toBeFalsy();
  });

  it('survitesse (modificateur M +5 → M+5) → la Progression insère un Test de survitesse (ligne « ÇA VA LÂCHER, CAPITAINE ! »)', () => {
    planWithSea(5); // baseM_local 5+5=10, vent neutre (pctSail 0) → eff.m 10 = M+5
    const out = apply('equipage-progression', 2, true);
    expect(get().travelPlan!.sea!.effMToday).toBe(10);
    const row = overspeedRow(5, 10)!;
    expect(row).toMatchObject({ difficulty: 'accessible', per: 'heure', damage: 1 }); // M+5
    const st = out?.insert?.find((s) => s.kind === 'mer-survitesse');
    expect(st).toBeTruthy();
    expect(st!.meta?.overspeedDamage).toBe(row.damage);
    expect(st!.worldOwner, 'MDG 12 l.58 : le navire teste, le MONDE tient le dé').toBe(true);
    expect(st!.actorId).toBeUndefined();
  });

  it('le Test se lance sur l’Endurance du NAVIRE ± la Difficulté, tenu par le MONDE (MDG 13 l.125, MDG 12 l.58)', () => {
    planWithSea(5);
    const st = apply('equipage-progression', 2, true)?.insert?.find((s) => s.kind === 'mer-survitesse');
    const hullE = effectiveChar(get().travelPlan!.vehicle!, 'endurance');
    expect(st!.target).toBe(hullE + DIFFICULTY_MODIFIERS[overspeedRow(5, 10)!.difficulty]);
    expect(st!.base).toBe(hullE);
    expect(st!.worldOwner).toBe(true);
  });

  it('deux PJ de Résistance différente donnent la MÊME cible', () => {
    const cible = (endurancePJ: number) => {
      freshState();
      set({ party: get().party.map((h, i) => (i === 0 ? { ...h, characteristics: { ...h.characteristics, endurance: endurancePJ } } : h)) });
      planWithSea(5);
      return apply('equipage-progression', 2, true)?.insert?.find((s) => s.kind === 'mer-survitesse')?.target;
    };
    const faible = cible(20);
    expect(faible).toBeDefined();
    expect(cible(70)).toBe(faible);
  });

  it('applier mer-survitesse : échec du Test de Résistance → Dégâts de coque = damage + X (X = DR négatifs), routés par damageVesselHull (#296)', () => {
    const plan = planWithSea();
    plan.vehicle!.wounds.current = plan.vehicle!.wounds.max;
    const before = plan.vehicle!.wounds.current;
    apply('mer-survitesse', -5, false, { overspeedDamage: 1 }); // ligne M+5 : 1+X, X=5 → 6
    expect(get().travelPlan!.vehicle!.wounds.current).toBe(before - 6);
    expect(get().vessel!.wounds!.current).toBe(before - 6); // persisté (#296)
  });

  it('applier mer-survitesse : succès → aucun Dégât', () => {
    const plan = planWithSea();
    plan.vehicle!.wounds.current = plan.vehicle!.wounds.max;
    const before = plan.vehicle!.wounds.current;
    apply('mer-survitesse', 3, true, { overspeedDamage: 1 });
    expect(get().travelPlan!.vehicle!.wounds.current).toBe(before);
  });

  it('données éditées (`sea-navigation.json` via `overspeedRow`) : le Test de survitesse suit le tableau — bande extrême « M+9 ou plus » → damage 8', () => {
    planWithSea(20); // baseM_local 5+20=25, vent neutre → eff.m 25 = M+20 (plafonné par la table à « M+9 ou plus »)
    const row = overspeedRow(5, 25)!;
    expect(row.damage).toBe(8); // « M+9 ou plus » — le calcul de la ligne suit la DONNÉE, jamais une valeur en dur
    const out = apply('equipage-progression', 2, true);
    const st = out?.insert?.find((s) => s.kind === 'mer-survitesse');
    expect(st!.meta?.overspeedDamage).toBe(8);
  });

  it('règle éditable `mer-survitesse-tests-par-jour` (#443, cadence infra-journalière mappée sur le jour) : N=2 → deux Tests de survitesse insérés', () => {
    setRule('mer-survitesse-tests-par-jour', 2);
    planWithSea(5);
    const out = apply('equipage-progression', 2, true);
    expect(out?.insert?.filter((s) => s.kind === 'mer-survitesse').length).toBe(2);
  });

  // Navire MIXTE : Langskip (sail.m 4, oars.m 6, distincts — #524). Le référent M de conception DOIT
  // suivre le mode PERSISTÉ du jour (`sea.modeToday`), jamais la voile par défaut.
  function planLangskip(modeToday: 'voile' | 'avirons', effMToday: number) {
    set({ vessel: { ...get().vessel!, vehicleId: 'langskip' } });
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0])!;
    const sea = { ...plan.sea!, milesToday: 1, effMToday, modeToday };
    set({ travelPlan: { ...plan, sea } });
    return plan;
  }

  it('navire MIXTE, modeToday=avirons → bande de survitesse calculée sur oars.m (Langskip : sail.m 4, oars.m 6)', () => {
    planLangskip('avirons', 11); // oars.m 6 → M+5 (safeBonus 4)
    const [st] = buildOverspeedSteps(get);
    expect(st).toBeTruthy();
    expect(resolveStake(st!.stake!).text).toContain('Survitesse M+5'); // référent M = oars.m 6 — le surplus se LIT sur la note d'enjeu
    expect(st!.meta?.overspeedDamage).toBe(overspeedRow(6, 11)!.damage);
  });

  it('navire MIXTE, modeToday=voile → bande de survitesse calculée sur sail.m (Langskip : sail.m 4, oars.m 6)', () => {
    planLangskip('voile', 11); // sail.m 4 → M+7
    const [st] = buildOverspeedSteps(get);
    expect(st).toBeTruthy();
    expect(resolveStake(st!.stake!).text).toContain('Survitesse M+7'); // référent M = sail.m 4
    expect(st!.meta?.overspeedDamage).toBe(overspeedRow(4, 11)!.damage);
  });

  it('navire à VAPEUR (Cogue + propulsion à vapeur), sans `modeToday` → référent M 4, pas la voile (MDG 12 l.311)', () => {
    set({ vessel: { ...get().vessel!, vehicleId: 'cogue', upgrades: [{ id: 'propulsion-a-vapeur' }] } });
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0])!;
    const sea = { ...plan.sea!, modeToday: undefined, milesToday: 1, effMToday: 10 }; // M 4 → M+6 (sail.m 5 → M+5)
    set({ travelPlan: { ...plan, sea } });
    const [st] = buildOverspeedSteps(get);
    expect(st).toBeTruthy();
    expect(resolveStake(st!.stake!).text).toContain('Survitesse M+6');
    expect(st!.meta?.overspeedDamage).toBe(overspeedRow(4, 10)!.damage);
  });
});

/**
 * #1104(b) — EXPOSITION du jour de mer (MDG 13 l.203-225) : chaque Test de la Période de travail est
 * une ÉTAPE influençable (héros × Tests de la bande), toutes dans UNE cascade du jour — plus de
 * résolution synchrone dont le journal était la seule surface. Même applier d'escalade que la nuit
 * (`kind: 'exposition-nocturne'`, restFlow) : le cumul des échecs d'un héros reste RAW.
 */
describe('Exposition en mer — une étape influençable par Test, une cascade par jour (#1104b)', () => {
  beforeEach(freshState);

  /** Plan de mer par temps GLACIAL (bande à 2 h → 4 Tests par héros, Difficulté Intermédiaire). */
  function glacialDay() {
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0], { cadence: 'jourParJour' })!;
    set({ travelPlan: { ...plan, sea: { ...plan.sea!, daysAtSea: 1, milesToday: 50, weather: { ...plan.sea!.weather, temperature: 'glaciale' } } } });
  }

  it('AVEC siège MJ : UNE cascade `seaExposure`, une BANDE par VAGUE (héros en rangées), chaque ligne DIT sa Difficulté', () => {
    set({ net: mjAuSiege1(get().net) });
    glacialDay();
    continueSeaDayAfterCascade(get, set);
    const casc = get().pendingCascade!;
    expect(casc.purpose).toBe('seaExposure');
    const living = get().party.filter((h) => !h.dead).length;
    // 4 Tests/jour (`seaExposureTestsPerDay('glaciale')`) = 4 VAGUES ; la 1ʳᵉ s'ouvre, les suivantes se
    // construisent après elle (#1117 L3) — une RANGÉE par héros vivant dans la fenêtre.
    expect(casc.participants).toHaveLength(1);
    expect(casc.participants[0].kind).toBe('merExposition'); // applier d'escalade PARTAGÉ
    expect(casc.participants[0].meta?.waves).toBe(4);
    expect(casc.participants[0].participants).toHaveLength(living);
    expect(casc.participants[0].participants!.every((r) => r.difficulty === 'intermediaire')).toBe(true);
    expect(casc.participants[0].participants!.every((r) => r.interactive)).toBe(true); // aucun jet hors de portée du joueur
    let guard = 0;
    while (get().pendingCascade?.purpose === 'seaExposure' && guard++ < 40) stepCascade();
    expect(get().pendingRest).toBeTruthy(); // la journée reprend jusqu'à la halte
  });

  it('SANS siège MJ : la vague s’ouvre quand même (M — les porteurs sont tenus), et la journée va jusqu’à la halte', () => {
    glacialDay();
    continueSeaDayAfterCascade(get, set);
    expect(get().pendingCascade!.purpose).toBe('seaExposure');
    draineCascade(get);
    expect(get().pendingRest).toBeTruthy();
  });

  it('sous ORDRES COMMANDÉS : aucune fenêtre d’Exposition — la journée va d’un trait jusqu’à la halte', () => {
    glacialDay();
    set({ travelPlan: { ...get().travelPlan!, orders: { cadence: 'commande' } } });
    continueSeaDayAfterCascade(get, set);
    expect(get().pendingCascade).toBeNull();
    expect(get().pendingRest).toBeTruthy();
  });

  it('un héros sous protection magique ne reçoit AUCUNE étape (le Test n’a pas lieu)', () => {
    set({ net: mjAuSiege1(get().net) });
    const party = get().party.map((h, i) => (i === 0 ? { ...h, activeEffects: [...(h.activeEffects ?? []), { label: 'Abri', weatherImmune: true, duration: { scale: 'permanent' as const } }] } : h));
    set({ party } as never);
    glacialDay();
    continueSeaDayAfterCascade(get, set);
    const casc = get().pendingCascade!;
    const rows = casc.participants[0].participants!;
    expect(rows.some((r) => r.id === party[0].id)).toBe(false);
    expect(rows).toHaveLength(party.length - 1);
    expect(casc.participants[0].meta?.waves).toBe(4); // les 4 Tests du jour restent dus aux autres
  });
});

/**
 * #1104(b) — DISSIPATION des pénalités d'Exposition (purge #T3) : une pénalité subie un jour FROID
 * s'échoit 24 h après (`duration.scale: 'clock'`), y compris si les jours suivants sont CLÉMENTS.
 * Régression réelle du lot : la purge, placée dans la branche « il fait froid aujourd'hui » ET AVANT
 * l'application des échecs, laissait la pénalité PERMANENTE — aucun des Tests existants ne le voyait.
 */
describe('Exposition en mer — les pénalités subies s’échoient à 24 h, jamais permanentes (#1104b)', () => {
  beforeEach(freshState);

  /** Échelles de durée des pénalités d'Exposition portées par le groupe. */
  const exposureScales = (): string[] => get().party
    .flatMap((h) => (h.activeEffects ?? []).filter((e) => String(e.effectId).startsWith('exposition')))
    .map((e) => e.duration.scale);

  /** Joue UN jour de mer de température `temperature` (clôture comprise), sans siège MJ (résolution I). */
  function seaDay(temperature: 'glaciale' | 'mediane'): void {
    const plan = get().travelPlan ?? buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0])!;
    set({ travelPlan: { ...plan, sea: { ...plan.sea!, daysAtSea: 1, milesToday: 50, weather: { ...plan.sea!.weather, temperature } } } });
    set({ pendingRest: null });
    continueSeaDayAfterCascade(get, set);
    draineCascade(get); // les fenêtres du jour se jouent (#1479) — le drainage EST le geste du joueur
  }

  it('un jour GLACIAL pose des pénalités, et la journée leur donne une horloge (jamais `permanent`)', () => {
    // Dé maximal : les Tests d'Exposition échouent → les pénalités tombent à coup sûr.
    seedBattleRng(3);
    seaDay('glaciale');
    expect(exposureScales().length).toBeGreaterThan(0); // des pénalités ont bien été subies
    expect(exposureScales()).not.toContain('permanent'); // toutes portent leur horloge de 24 h
  });

  it('les jours CLÉMENTS suivants n’oublient personne : aucune pénalité ne reste `permanent`', () => {
    seedBattleRng(3);
    seaDay('glaciale');
    const subies = exposureScales().length;
    expect(subies).toBeGreaterThan(0);
    seaDay('mediane'); // tempérée : AUCUN Test d'Exposition ce jour-là
    seaDay('mediane');
    expect(exposureScales()).not.toContain('permanent');
    expect(exposureScales()).toHaveLength(subies); // les pénalités existent toujours, mais horlogées
  });

  it('la règle ÉDITABLE `exposition-dissipation-heures` gouverne AUSSI le répit de MER (48 h ⇒ échéance à 48 h)', () => {
    // Le chemin de mer portait 24 h EN DUR : régler la règle sur 48 h laissait la mer court-circuiter le
    // réglage du joueur. Une seule règle pour les deux répits (camp `restFlow` ET jour de mer).
    setRule('exposition-dissipation-heures', 48);
    seedBattleRng(3);
    const t0 = get().gameTime;
    seaDay('glaciale');
    const echeances = get().party
      .flatMap((h) => (h.activeEffects ?? []).filter((e) => String(e.effectId).startsWith('exposition')))
      .map((e) => (e.duration as { scale: string; until?: number }).until);
    expect(echeances.length).toBeGreaterThan(0);
    for (const u of echeances) expect(u).toBeGreaterThanOrEqual(t0 + 48 * 60);
  });
  afterEach(() => resetRule('exposition-dissipation-heures'));
});

/**
 * #1117 — le SOUTIEN doit atteindre la CIBLE du Test : « Chaque Personnage qui apporte son soutien
 * octroie un bonus de +10 au Test » (LDB 12, fiche `soutien`). `partyAssisted` rend la valeur
 * SOUTENUE ; trois étapes la posaient en `base` mais recalculaient leur cible depuis la carac NUE
 * (`effectiveTarget` sans `baseOverride`) — les soutiens n'amélioraient RIEN, et le réconciliateur
 * comblait l'écart par une chip « autres ». Invariant UNIVERSEL vérifié ici : sur toute étape qui
 * porte un `support`, l'écart base→cible s'explique par la SEULE Difficulté.
 */
describe('Soutien — il entre dans la CIBLE de toute étape soutenue (#1117)', () => {
  beforeEach(freshState);

  /** Le groupe de test soutient VRAIMENT : chaque pregen reçoit les Compétences des étapes visées
   *  (le Soutien exige un avancement dans la Compétence testée — LDB 12 l.195). */
  function partyThatSupports() {
    set({
      party: get().party.map((h) => ({
        ...h,
        skills: [
          ...h.skills.filter((sk) => !['voile', 'ramer', 'resistance'].includes(sk.id)),
          { id: 'voile', spec: 'cogue', advances: 10 },
          { id: 'ramer', advances: 10 },
          { id: 'resistance', advances: 10 },
        ],
      })),
    } as never);
  }

  // Cliquet « zéro chip anonyme » et lecture du Soutien : SOURCE UNIQUE `cascade.testkit`
  // (`inexplique`/`soutienDe`) — les quatre flux migrés jugent la MÊME grandeur.

  /** Toutes les étapes SOUTENUES posées par la cascade courante. */
  function soutenues(): CascadeStep[] {
    const p = get().pendingCascade;
    return (p?.participants ?? []).filter((st) => soutienDe(st) > 0 && st.target != null);
  }

  function seaDay(patch: Record<string, unknown>) {
    partyThatSupports();
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0], { pace: 1, cadence: 'jourParJour' })!;
    set({ travelPlan: { ...plan, sea: { ...plan.sea!, ...patch } } });
  }

  it('« Forcer le rythme » : la cible porte le Soutien (aucun résidu)', () => {
    seaDay({ forcePace: 1, paceToday: undefined });
    runSeaDay(get, set);
    const st = soutenues().find((x) => x.kind === 'mer-forcer-le-rythme');
    expect(st, 'l’étape de Forcer le rythme est posée ET soutenue').toBeTruthy();
    expect(soutienDe(st!), 'des soutiens contribuent, en ligne de mod NOMMÉE').toBeGreaterThan(0);
    expect(inexplique(st!), 'aucune chip « autres » : tout est nommé').toBe(0);
  });

  it('« Dégagement » (échouage) : la cible porte le Soutien (aucun résidu)', () => {
    seaDay({ stranded: { hazardId: 'bas-fonds', label: 'un banc de sable' } });
    runSeaDay(get, set);
    const st = soutenues().find((x) => x.kind === 'mer-degagement');
    expect(st, 'l’étape de Dégagement est posée ET soutenue').toBeTruthy();
    expect(inexplique(st!), 'aucune chip « autres » : tout est nommé').toBe(0);
  });

  it('« Survitesse » : le navire teste, aucun Soutien de l’équipage n’entre dans la cible (MDG 13 l.125)', () => {
    seaDay({ forcePace: 1, milesToday: 50, effMToday: 12 });
    const steps = buildOverspeedSteps(get);
    expect(steps.length).toBeGreaterThan(0);
    for (const st of steps) {
      expect(soutienDe(st)).toBe(0);
      expect(inexplique(st), 'aucune chip « autres » : tout est nommé').toBe(0);
    }
  });

  it('le Soutien atteint le JET RÉEL, pas seulement l’affichage (cible roulée)', () => {
    seaDay({ forcePace: 1, paceToday: undefined });
    runSeaDay(get, set);
    const st = soutenues().find((x) => x.kind === 'mer-forcer-le-rythme')!;
    const attendu = st.target!;
    get().jetLancer('cascade', st.id);
    const roule = (get().pendingCascade!.participants.find((x) => x.id === st.id))!;
    expect(roule.result, 'le jet a bien eu lieu').toBeTruthy();
    expect(roule.result!.target, 'la cible ROULÉE est la cible soutenue').toBe(attendu);
    // Et cette cible vaut bien la base NUE + le Soutien (ligne de mod) ± Difficulté : le +Soutien
    // entre UNE fois dans la cible, il n'a pas été rejoué ailleurs.
    expect(attendu).toBe(st.base! + soutienDe(st) + DIFFICULTY_MODIFIERS[st.difficulty!]);
  });

  it('voie « Navigation » : une base SOUTENUE qui franchit le plafond NOMME son écrêtage', () => {
    partyThatSupports();
    // Un barreur très compétent : base soutenue > 99 → la cible est écrêtée, et l'écart doit se NOMMER.
    set({
      party: get().party.map((h, i) => (i !== 0 ? h : {
        ...h,
        skills: [...h.skills.filter((sk) => sk.id !== 'voile'), { id: 'voile', spec: 'cogue', advances: 80 }],
      })),
    } as never);
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0], { pace: 1, cadence: 'jourParJour' })!;
    set({ travelPlan: plan });
    runSeaDay(get, set);
    // Répond « Navigation » au choix de Progression (MDG 14 l.63).
    for (let i = 0; i < 30; i++) {
      const p = get().pendingCascade;
      if (!p) break;
      const cur = p.participants[p.cursor];
      if (cur?.kind === 'merProgressionChoix') { get().jetRegler('cascade', 'choix', 'nav', cur.id); get().jetValider('cascade'); break; }
      stepCascade();
    }
    const nav = get().pendingCascade!.participants.find((x) => x.kind === 'merProgressionNavigation');
    expect(nav, 'la voie Navigation est posée').toBeTruthy();
    expect(nav!.base!, 'la base soutenue franchit bien le plafond (sinon le cas ne prouve rien)').toBeGreaterThan(99);
    // Le CONTRAT d'abord (ce que le joueur lit), le mécanisme ensuite (ce qui le produit).
    expect(inexplique(nav!), 'aucune chip « autres » sur la voie Navigation').toBe(0);
    expect(nav!.clamped, 'l’écrêtage est MESURÉ à la construction').toBeTruthy();
  });

  it('« Survitesse » sous ÉTAT du groupe : la cible reste l’Endurance du navire ± la Difficulté (MDG 12 l.58)', () => {
    seaDay({ forcePace: 1, milesToday: 50, effMToday: 12 });
    set({ party: get().party.map((h) => ({ ...h, conditions: [{ id: 'empoisonne', value: 1 }] })) } as never);
    const porteur = get().party[0]!;
    expect(testValue(porteur, { skill: { id: 'resistance' }, characteristic: 'endurance' }), 'l’État mord les jets du PJ').toBeLessThan(skillBaseValue(porteur, { skill: { id: 'resistance' }, characteristic: 'endurance' }));

    const st = buildOverspeedSteps(get)[0];
    const hullE = effectiveChar(get().travelPlan!.vehicle!, 'endurance');
    expect(st.worldOwner).toBe(true);
    expect(st.base).toBe(hullE);
    expect(inexplique(st), 'aucune chip « autres »').toBe(0);
    expect(st.target).toBe(hullE + DIFFICULTY_MODIFIERS[st.difficulty!]);
  });
});

/**
 * #1117 volet E — l'ENJEU d'un Test d'équipage disait la règle-cadre (« ce Test peut être remplacé
 * par un Test d'équipage »), qui n'apprend rien au joueur sur ce qu'il risque. Deux contrats :
 * l'enjeu AFFICHÉ décrit l'EFFET du jet (catalogue `stakes.json`), et le VERBATIM MDG 14 se
 * lit à un clic (fiche `regles.json` portée par le type). Et le choix ouvert par MDG 14 l.63
 * (« vous pouvez effectuer un Test d'équipage au lieu d'un Test de Navigation ») est POSÉ au joueur.
 */
describe('Tests d’équipage — enjeu d’EFFET, règle en fiche, choix de Progression (#1117)', () => {
  beforeEach(() => {
    freshState();
    // Un barreur qui peut tenter la Voile (LDB 09 l.30) : aucun prétiré ne l'a.
    set({ party: get().party.map((h, i) => (i === 0 ? { ...h, skills: [...h.skills, { id: 'voile', spec: 'cogue', characteristic: 'agilite' as const, advances: 10 }] } : h)) });
  });

  it('la Progression PROPOSE les deux voies RAW, équipage par défaut', () => {
    get().partirEnVoyage('r1', 'mer', { cadence: 'jourParJour' });
    const p = get().pendingCascade!;
    const choix = p.participants.find((s) => s.kind === 'merProgressionChoix');
    expect(choix, 'le choix est POSÉ, jamais tranché en silence').toBeTruthy();
    expect(choix!.options!.map((o) => o.key)).toEqual(['crew', 'nav']);
    expect(choix!.defaultChoice, 'cadence commandée = voie d’équipage').toBe('crew');
  });

  it('« Navigation » retenue → un Test MONO de Voile/Ramer, et la journée continue pareil', () => {
    get().partirEnVoyage('r1', 'mer', { cadence: 'jourParJour' });
    for (let i = 0; i < 30; i++) {
      const p = get().pendingCascade;
      if (!p) break;
      const cur = p.participants[p.cursor];
      if (cur?.kind === 'merProgressionChoix') { get().jetRegler('cascade', 'choix', 'nav', cur.id); get().jetValider('cascade'); break; }
      stepCascade();
    }
    const nav = get().pendingCascade!.participants.find((s) => s.kind === 'merProgressionNavigation');
    expect(nav, 'la voie Navigation est insérée').toBeTruthy();
    expect(nav!.participants, 'voie MONO : un barreur, pas un batch d’équipage').toBeUndefined();
    const competence = navigationDuNavire(get, get().travelPlan!.vehicle!);
    expect(estCompetenceDePropulsion(competence.id), 'Voile ou Ramer').toBe(true);
    expect(nav!.rollLabel).toBe(testSkillLabel({ skill: competence }));
  });

  it('personne qui puisse tenter la Voile (LDB 09 l.30) : la voie Navigation reste OFFERTE, fermée avec son refus nommé', () => {
    set({ party: get().party.map((h) => ({ ...h, skills: h.skills.filter((sk) => sk.id !== 'voile') })) });
    get().partirEnVoyage('r1', 'mer', { cadence: 'jourParJour' });
    const choix = get().pendingCascade!.participants.find((s) => s.kind === 'merProgressionChoix');
    expect(choix, 'le choix MDG 14 l.63 reste posé').toBeTruthy();
    const nav = choix!.options!.find((o) => o.key === 'nav');
    expect(nav, 'la voie Navigation est présente').toBeTruthy();
    expect(nav!.refus).toBe('Personne dans le groupe ne peut tenter le Test de Voile (Cogue).');
    expect(choix!.options!.find((o) => o.key === 'crew')!.refus, 'la voie d’équipage reste ouverte').toBeUndefined();
    expect(choix!.defaultChoice).toBe('crew');
  });

  it('l’enjeu d’une étape d’équipage dit son EFFET, jamais la règle-cadre de substitution', () => {
    get().partirEnVoyage('r1', 'mer', { cadence: 'jourParJour' });
    let vus = 0;
    for (let i = 0; i < 40; i++) {
      const p = get().pendingCascade;
      if (!p) break;
      for (const st of p.participants) {
        // Test d'ÉQUIPAGE = une bande qui AGRÈGE (`summed-dr`) ; les bandes de jets INDÉPENDANTS
        // (Mal de mer, Scorbut, Exposition, Épuisement — `aggregate:'none'`) ne sont pas du périmètre.
        if (!st.participants || !st.stake || st.aggregate === 'none') continue;
        vus += 1;
        const resolved = resolveStake(st.stake);
        expect(resolved.text, `« ${st.kind} » : l’enjeu ne récite pas la règle-cadre`).not.toMatch(/peut être remplacé|au lieu d'un Test de Navigation/);
        expect(resolved.rule?.id, `« ${st.kind} » : la règle MDG reste à un clic`).toMatch(/^test-equipage-/);
      }
      stepCascade();
    }
    expect(vus, 'au moins une étape d’équipage a été mesurée').toBeGreaterThan(0);
  });
});

/**
 * #1153 L2bis (sonde du juge B2) — la rangée d'un contributeur de Test d'équipage se lit comme un jet
 * mono : base NUE (`LDB 09 l.17`) et TOUT le reste NOMMÉ. Le modificateur de chanson de marin
 * (`MDG 09 l.224` : « un modificateur de +10 sur les Tests individuels de chaque membre d'équipage
 * impliqué dans un Test d'équipage », donnée `sea-shanties.json`) est FONDU par `crewRoleValue` : il
 * doit ressortir en chip portant le NOM de la chanson, sinon la rangée ment de +10.
 */
describe('Test d’équipage — la chanson de marin est NOMMÉE sur la rangée (#1153)', () => {
  beforeEach(freshState);

  it('un équipage qui chante : base nue, chip de la chanson, cible fondue — aucun résidu', () => {
    // Chanson ACTIVE sur tout l'équipage (op `crewTestMod`, +10 aux Tests individuels).
    const chanson = { label: 'Naviguons tous ensemble', crewTestMod: 10, duration: { scale: 'permanent' as const } };
    set({
      party: get().party.map((h) => ({
        ...h,
        skills: [...h.skills.filter((sk) => !['voile', 'ramer'].includes(sk.id)), { id: 'voile', spec: 'cogue', advances: 12 }, { id: 'ramer', advances: 12 }],
        activeEffects: [...(h.activeEffects ?? []), chanson],
      })),
    } as never);
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0], { pace: 1, cadence: 'jourParJour' })!;
    set({ travelPlan: plan });
    runSeaDay(get, set);
    // La journée s'ouvre sur le CHOIX de Progression (MDG 14 l.63) : on répond comme le joueur par
    // défaut (Test d'équipage) jusqu'à trouver le pas à contributeurs.
    let batch: CascadeStep | undefined;
    for (let i = 0; i < 20 && !batch; i++) {
      const p = get().pendingCascade;
      if (!p) break;
      const cur = p.participants[p.cursor];
      if (cur?.participants?.length) { batch = cur; break; }
      if (cur?.options && !cur.chosen) { get().jetRegler('cascade', 'choix', cur.defaultChoice ?? cur.options[0].key, cur.id); get().jetValider('cascade'); continue; }
      stepCascade();
    }
    expect(batch, 'la journée pose bien un Test d’équipage').toBeTruthy();
    for (const part of batch!.participants!) {
      const crew = get().party.find((h) => h.id === part.id)!;
      expect(part.mods, 'la chanson se NOMME sur la rangée du marin').toContainEqual({ label: chanson.label, value: chanson.crewTestMod, famille: 'jet' });
      expect(part.base, 'base NUE : la chanson n’y est plus fondue')
        .toBe(skillBaseValue(crew, { skill: part.skill }));
      const st = { base: part.base, target: part.target, mods: part.mods, difficulty: part.difficulty, clamped: part.clamped } as never;
      expect(inexplique(st), 'aucune chip « autres » sur une rangée d’équipage').toBe(0);
    }
  });
});

/**
 * #1341 (2ᵉ site, trouvé par la passe V8c₃) — la SPÉCIALISATION d'un Test se demande par son ID.
 *
 * `engineerOf` (`seaVoyageFlow.ts`, PANNE DE VAPEUR, MDG 12 l.326) demandait `partyBest(apt, 'metier',
 * …, 'Ingénieur')` : le LIBELLÉ, là où `skills.json` stocke la spec `ingenieur` et où `testValue`
 * compare STRICTEMENT (`s.spec === spec`). Conséquence MESURÉE avant le correctif : la valeur retombait
 * sur la valeur SANS compétence (33 au lieu de 58 sur la fixture de ce fichier), et `partyBest`
 * élisait le PREMIER venu —
 * le mécano de la chaudière n'était donc jamais celui qui sait réparer.
 */
describe('#1341 (site maritime) — `engineerOf` demande la spec Métier par ID, jamais par LABEL', () => {
  /** Un ingénieur : Intelligence figée à 30, +25 avances en Métier (Ingénieur). */
  function ingenieur(): Combatant {
    const h = tousLesHerosDeScenario(idsDeTest)[0];
    h.characteristics.intelligence = 30;
    h.skills = [{ id: 'metier', characteristic: 'intelligence', advances: 25, spec: 'ingenieur' }];
    return h;
  }
  /** Un badaud : même Intelligence, aucune compétence de Métier. */
  function badaud(): Combatant {
    const h = tousLesHerosDeScenario(idsDeTest)[1];
    h.characteristics.intelligence = 30;
    h.skills = [];
    return h;
  }

  it('la spec « ingenieur » EXISTE dans skills.json (id, pas libellé)', () => {
    expect((byId('skill', 'metier')?.specs ?? []).some((s) => s.id === 'ingenieur')).toBe(true);
  });

  it('testValue trouve la spécialisation par son ID — le LIBELLÉ perd les avances (contre-preuve)', () => {
    const h = ingenieur();
    const parId = testValue(h, { skill: { id: 'metier', spec: 'ingenieur' } });
    const libelle = byId('skill', 'metier')?.specs?.find((s) => s.id === 'ingenieur')?.label;
    const parLabel = testValue(h, { skill: { id: 'metier', spec: libelle } });
    expect(parId, 'par id : les avances comptent').toBeGreaterThan(parLabel);
    // …et le libellé rend EXACTEMENT ce que rend une demande SANS compétence : la compétence est
    // réputée absente, les 25 avances tombent en silence (33 sur cette fixture, passifs compris).
    expect(parLabel, 'par libellé : la compétence est réputée absente').toBe(testValue(h, { skill: { id: 'metier', spec: 'inconnue-xyz' } }));
  });

  it('LE SITE — `engineerOf` élit bien l’INGÉNIEUR, là où la demande par libellé n’élit personne', () => {
    const b = badaud(), i = ingenieur();
    // Le SITE de production, pas son mécanisme : débrancher l'id au call-site rougit ICI.
    expect(engineerOf([b, i])?.id, 'le mécano de la chaudière est celui qui sait réparer').toBe(i.id);
    // Contre-preuve du mécanisme sous-jacent : la MÊME élection demandée par LIBELLÉ ne trouve aucun porteur.
    const libelle = byId('skill', 'metier')?.specs?.find((s) => s.id === 'ingenieur')?.label;
    expect(partyBest([b, i], { skill: { id: 'metier', spec: libelle } }), 'par libellé : personne ne possède la spécialisation').toBeNull();
  });
});

/**
 * MANQUE DE BRAS — MDG 14 l.55, verbatim : « Même en occupant deux rôles, il peut être impossible de
 * remplir le nombre minimum de membres d'équipage requis. Dans ce cas, les résultats du Test
 * d'équipage subissent –2 DR et ne peuvent jamais être meilleurs qu'un Succès Minime. »
 *
 * Cas LIMITE : AUCUN PJ apte (tous Inconscients — LDB 16 l.115, « Vous ne pouvez absolument rien
 * faire de votre tour »). Le jour ne se saute pas en silence : il se JOUE au plancher, et la
 * non-viabilité du groupe est constatée par l'invariant HORS COMBAT (`checkPartyWiped`), qui présente
 * l'écran de défaite et purge le voyage.
 */
describe('aucun PJ apte : la journée se joue au plancher de Manque de bras (MDG 14 l.55)', () => {
  beforeEach(freshState);

  it('la Progression est journalisée au plancher, sans Test d’équipage posé, puis la défaite est CONSTATÉE', () => {
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0])!;
    set({
      travelPlan: plan,
      party: get().party.map((h) => ({ ...h, conditions: [{ id: 'inconscient', value: 1 }] })),
      journal: [],
      partyWiped: false,
    });
    runSeaDay(get, set);

    const journal = get().journal.join(' | ');
    expect(journal, 'la Progression du jour n’est pas journalisée au plancher').toMatch(/Progression du jour[^|]*DR d'équipage -2/);
    const etapes: CascadeStep[] = get().pendingCascade?.participants ?? [];
    expect(etapes.some((e) => e.kind === 'equipage-progression'), 'une étape de Progression a été posée sans PJ apte').toBe(false);

    // Verrou : l'issue est la DÉFAITE hors combat (`noyau/partyWipe.ts` — prédicat identique à la
    // victoire de combat, constatée à la CLÔTURE de la cascade du jour), pas une interruption muette.
    draineCascade(get, 80);
    expect(get().partyWiped, 'le groupe entièrement à terre n’est pas constaté non viable').toBe(true);
    expect(get().travelPlan, 'le voyage a survécu à la défaite').toBeNull();
  });

  it('journée SANS JET (aucune étape bâtie) : le départ constate la défaite lui-même, aucune cascade à drainer', () => {
    set({
      party: get().party.map((h) => ({ ...h, conditions: [{ id: 'inconscient', value: 1 }] })),
      journal: [],
      partyWiped: false,
    });
    get().partirEnVoyage('r1', 'mer');

    expect(get().pendingCascade, 'la journée a bâti une étape : ce n’est pas le raccourci sans jet').toBeNull();
    expect(get().suspendedCascades, 'une séquence attend derrière').toEqual([]);
    expect(get().partyWiped, 'le raccourci « journée sans jet » n’a pas constaté le groupe non viable').toBe(true);
    expect(get().travelPlan, 'le voyage a survécu à la défaite').toBeNull();
    // La défaite PRÉCÈDE le dénouement du jour, comme à la clôture d'une cascade (`dispatchCascadeDone`) :
    // l'entretien du bord (`continueSeaDayAfterCascade`) n'est pas joué par un groupe qui n'est plus viable.
    expect(get().journal.join(' | '), 'l’entretien du jour s’est joué après la défaite').not.toMatch(/Résistance/);
  });
});

/**
 * Journée sous ordres PARQUÉE sur un choix sans défaut (`cascade.runCascadeImmediate`, #1595) : la
 * décision prise, la clôture du jour verse au PV les bandes que le pilote a résolues sous `rowSurface`.
 */
describe('journée commandée parquée sur une décision : le PV du jour est versé à la clôture', () => {
  beforeEach(freshState);
  beforeEach(() => { avecLesTables({ appliers: { ...tablesDuJeu().appliers, 'progression-choix-test': () => {} } }); });

  it('la bande résolue à la reprise arrive au PV de la halte', () => {
    set({ travelPlan: buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0], { cadence: 'commande' })! });
    const h = get().party[0];
    const bande = buildBand(get, { id: 'bande-pv', kind: 'equipage-orientation', label: fixtureText('Orientation'), difficulty: 'intermediaire', porteurs: [{ actor: h, ligne: { test: { skill: { id: 'equipage-orientation' }, characteristic: 'intelligence' } } }] })!;
    const decision: CascadeStep = { id: 'decision', kind: cleDeFixture('progression-choix-test'), label: fixtureText('Décision'), options: [{ key: 'a', label: fixtureText('A') }, { key: 'b', label: fixtureText('B') }] };
    expect(runCascadeImmediate(get, set, [decision, bande], { title: 'Jour', purpose: 'travelDay', rowSurface: 'pv' })).toBeUndefined();

    get().jetRegler('cascade', 'choix', 'a', 'decision');
    get().jetValider('cascade');
    for (let i = 0; i < 30 && get().pendingCascade && !get().pendingRest; i++) stepCascade();
    const entrees = get().travelPlan?.log?.slice(-1)[0]?.entries ?? [];
    expect(entrees.length, 'la bande résolue à la reprise n’est pas au PV du jour').toBeGreaterThan(0);
  });
});

describe('Salissures — Test de Résistance hebdomadaire du vaisseau par la porte des jets (#1105, MDG 13 l.148)', () => {
  beforeEach(freshState);
  afterEach(() => resetRule('mer-salissures-difficulte'));

  /** 7ᵉ jour en mer, en semaine 1 : le Test de la semaine est dû. */
  function septiemeJour(fouling?: { level: number; lastWeek: number }) {
    set({ gameTime: 7 * 24 * 60 + 8 * 60, vessel: { ...get().vessel!, ...(fouling ? { fouling } : {}) } });
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0], { cadence: 'jourParJour' })!;
    set({ travelPlan: { ...plan, sea: { ...plan.sea!, daysAtSea: 6 } } });
  }
  /** Joue la journée comme un joueur jusqu'au Test de Salissures, dont le dé est POSÉ à `de`. */
  function jusquAuxSalissures(de: number): CascadeStep | undefined {
    runSeaDay(get, set);
    let joue: CascadeStep | undefined;
    for (let i = 0; i < 40 && get().pendingCascade && !joue; i++) {
      const cur = get().pendingCascade!.participants[get().pendingCascade!.cursor];
      avanceEtapeCascade(get, (st) => (st.kind === 'mer-salissures' ? de : undefined));
      if (cur?.kind === 'mer-salissures') joue = cur;
    }
    return joue;
  }
  /** Le dé de Salissures n'a qu'UNE surface (#1291) : aucune entrée de procès-verbal ne le recopie. */
  const entreeSalissures = () => (get().travelPlan?.sea?.entries ?? []).find((e) => e.id?.startsWith('mer-salissures'));
  const lignesDeMer = () => get().travelPlan?.sea?.lines ?? [];

  it('le Test est une ÉTAPE de la journée, tenue par le MONDE, sur l’Endurance du NAVIRE (MDG 12 l.58)', () => {
    septiemeJour();
    const st = jusquAuxSalissures(5);
    expect(st, 'le Test de la semaine passe par la porte des jets').toBeTruthy();
    expect(st!.worldOwner).toBe(true);
    expect(st!.actorId).toBeUndefined();
    expect(st!.difficulty).toBe('intermediaire');
    expect(st!.base).toBe(effectiveChar(get().travelPlan!.vehicle!, 'endurance'));
    expect(st!.target).toBe(effectiveChar(get().travelPlan!.vehicle!, 'endurance') + DIFFICULTY_MODIFIERS.intermediaire);
  });

  it('règle maison `mer-salissures-difficulte` (LDB 12 l.137) : la Difficulté éditée entre dans la cible', () => {
    setRule('mer-salissures-difficulte', 'complexe');
    septiemeJour();
    const st = jusquAuxSalissures(5);
    expect(st!.difficulty).toBe('complexe');
    expect(st!.target).toBe(effectiveChar(get().travelPlan!.vehicle!, 'endurance') + DIFFICULTY_MODIFIERS.complexe);
  });

  it('deux GROUPES différents donnent la MÊME cible : seul le navire teste', () => {
    const cible = (groupe: Combatant[]) => {
      freshState();
      set({ party: groupe });
      septiemeJour();
      return jusquAuxSalissures(5)?.target;
    };
    const [a, b, c, d] = tousLesHerosDeScenario(idsDeTest);
    const faible = cible([{ ...a!, characteristics: { ...a!.characteristics, endurance: 20 } }]);
    expect(faible).toBeDefined();
    expect(cible([b!, c!, { ...d!, characteristics: { ...d!.characteristics, endurance: 70 } }])).toBe(faible);
  });

  it('la fenêtre du Test du navire s’ouvre chez l’hôte en solo', () => {
    septiemeJour();
    jusquAuxSalissures(96);
    expect(seatOwns(get(), 0, WORLD_STEP_OWNER), 'en solo, l’hôte tient le monde').toBe(true);
  });

  it('la Résilience d’un PJ ne bascule pas l’issue du Test du navire (LDB 17 l.21-24)', () => {
    septiemeJour();
    runSeaDay(get, set);
    let id: string | undefined;
    for (let i = 0; i < 40 && get().pendingCascade && !id; i++) {
      const cur = get().pendingCascade!.participants[get().pendingCascade!.cursor];
      if (cur?.kind === 'mer-salissures') { id = cur.id; break; }
      avanceEtapeCascade(get);
    }
    expect(id, 'étape mer-salissures atteinte').toBeTruthy();
    get().jetLancer('cascade', id!);
    get().jetImposerLeResultat('cascade', 96, id!);
    const avant = get().party.map((h) => [h.resilience, h.fortune]);
    get().jetForcerLaReussite('cascade', id!);
    get().jetRelancer('cascade', id!);
    const st = get().pendingCascade!.participants.find((x) => x.id === id)!;
    expect(st.result?.success, 'l’échec du navire reste un échec').toBe(false);
    expect(get().party.map((h) => [h.resilience, h.fortune]), 'aucune ressource de héros dépensée').toEqual(avant);
  });

  it('aucun PJ apte : le Test du navire a lieu quand même, et la semaine est notée', () => {
    set({ party: get().party.map((h) => (blessuresSurLeProfil({ ...h, wounds: { ...h.wounds, current: 0 }, conditions: [...(h.conditions ?? []), { id: 'inconscient', value: 1 }] }))) } as never);
    expect(get().party.every((h) => isOutOfAction(h)), 'précondition : tout le groupe est hors de combat').toBe(true);
    septiemeJour();
    const st = jusquAuxSalissures(96);
    expect(st, 'le navire teste sans porteur de groupe').toBeTruthy();
    draineCascade(get);
    expect(get().vessel!.fouling).toEqual({ level: 1, lastWeek: 1 });
  });

  it('échec → +1 niveau, semaine notée, conséquence au fil de la journée, aucune entrée de procès-verbal', () => {
    septiemeJour();
    jusquAuxSalissures(96);
    expect(get().vessel!.fouling).toEqual({ level: 1, lastWeek: 1 });
    expect(lignesDeMer()).toContain(t('sv.fouling', { level: 1, desc: foulingEffects(1).desc }));
    expect(entreeSalissures()).toBeUndefined();
  });

  it('réussite → niveau inchangé, semaine notée, conséquence au fil de la journée', () => {
    septiemeJour();
    jusquAuxSalissures(5);
    expect(get().vessel!.fouling).toEqual({ level: 0, lastWeek: 1 });
    expect(lignesDeMer()).toContain(t('sv.foulingHolds'));
    expect(entreeSalissures()).toBeUndefined();
  });

  it('échec au niveau MAXIMUM → niveau inchangé, conséquence dite quand même', () => {
    septiemeJour({ level: 5, lastWeek: 0 });
    jusquAuxSalissures(96);
    expect(get().vessel!.fouling).toEqual({ level: 5, lastWeek: 1 });
    expect(lignesDeMer(), 'aucun jet silencieux, même sans effet').toContain(t('sv.foulingMax', { level: 5 }));
  });

  it('semaine déjà testée → aucun Test', () => {
    septiemeJour({ level: 0, lastWeek: 1 });
    expect(jusquAuxSalissures(96)).toBeUndefined();
  });

  it('traversée commandée : la Salissure se résout sans fenêtre', () => {
    septiemeJour();
    set({ travelPlan: { ...get().travelPlan!, orders: { cadence: 'commande' } } });
    runSeaDay(get, set);
    expect(get().pendingCascade, 'traversée commandée = sans fenêtre (attendu validé en recette #1426)').toBeNull();
    expect(get().vessel!.fouling?.lastWeek, 'le Test de la semaine a eu lieu').toBe(1);
    const pv = get().travelPlan?.log?.slice(-1)[0]?.entries ?? [];
    expect(pv.some((e) => e.id?.startsWith('mer-salissures')), 'le procès-verbal ne recopie pas le dé').toBe(false);
    const navire = get().travelPlan!.vehicle!.label;
    const libelle = testSkillLabel({ characteristic: 'endurance' })!;
    const traces = get().journal.filter((x) => x.includes(t('sv.foulingTest')) && x.includes('→'));
    expect(traces, 'le dé du navire a UNE surface : sa trace au journal (#1291)').toHaveLength(1);
    expect(traces[0], 'la trace dit QUI lance (le navire) et QUOI (#1595)').toContain(navire);
    expect(traces[0]).toContain(libelle);
  });
});

describe('Une journée de mer en vol ne se relance pas, la bande d’équipage reste dans sa séquence hôte (#4006)', () => {
  beforeEach(freshState);

  /** Les séquences `travelDay` vivantes, slot et pile confondus (`pendingCascade`/`suspendedCascades`). */
  const journeesVivantes = () => [get().pendingCascade, ...get().suspendedCascades].filter((c) => c?.purpose === 'travelDay');
  /** Une étape de la cascade, puis les reprises différées du banc (patron des sondes du jour). */
  const unPas = (poser?: PoseDe, choisir?: ChoisitCle) => { avanceEtapeCascade(get, poser, choisir); banc.reprendreTout(); };
  const affalerRate: PoseDe = (etape) => (etape.kind === 'testDEquipage' ? 99 : undefined);

  it('le péril d’auteur dont l’effet ouvre un Test parque le jour : sa clôture le reprend UNE fois, `daysAtSea` +1', () => {
    const perilMap: WorldMap = {
      ...seaMap,
      routes: [{ ...seaMap.routes[0], perils: [{ label: 'Froid mordant', chancePct: 100, effects: [{ type: 'exposureNight', kind: 'froid', count: 1, target: 'groupe' }] }] }],
    };
    set({ worldMap: perilMap } as never);
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', perilMap.routes[0], { cadence: 'jourParJour' })!;
    set({ travelPlan: { ...plan, sea: { ...plan.sea!, daysToEvent: 5 } } } as never);
    runSeaDay(get, set);
    const jour = get().pendingCascade!;
    expect(jour.purpose, 'prémisse : le jour tient le slot').toBe('travelDay');
    for (let i = 0; i < 10 && get().pendingCascade?.purpose !== 'test'; i++) unPas();
    expect(get().pendingCascade?.purpose, 'prémisse : l’effet du péril ouvre sa séquence `test`').toBe('test');
    expect(get().suspendedCascades.map((c) => c.purpose), 'prémisse : le jour attend en pile').toEqual(['travelDay']);
    const curseurParque = get().suspendedCascades[0]!.cursor;
    expect(curseurParque, 'prémisse : le jour est parqué après son étape de péril').toBeGreaterThan(0);
    for (let i = 0; i < 10 && get().pendingCascade?.purpose === 'test'; i++) unPas();
    expect(journeesVivantes(), 'une seule journée vivante à la clôture du Test').toHaveLength(1);
    expect(get().pendingCascade?.cursor, 'le jour parqué est repris à son curseur, pas rebâti').toBe(curseurParque);
    expect(get().suspendedCascades).toEqual([]);
    for (let i = 0; i < 40 && get().pendingCascade && !get().pendingRest; i++) {
      unPas();
      expect(journeesVivantes().length).toBeLessThanOrEqual(1);
    }
    expect(get().pendingRest, 'le jour se dénoue sur la halte').toBeTruthy();
    expect(get().travelPlan!.sea!.daysAtSea).toBe(1);
    expect(get().journal.filter((l) => l.includes(t('tf.perilDAuteur', { label: 'Froid mordant' }))), 'le jour n’est bâti qu’une fois').toHaveLength(1);
  });

  it('Ouragan nommé d’avance : la bande du coup à l’équipage (MDG 13 l.763) se joue dans le Test de l’événement, ouvert sous le jour en vol, que la pile rend ensuite à sa Progression', () => {
    seedBattleRng(1);
    set({ party: get().party.map((h) => ({ ...h, shipStation: 'greement', skills: (h.skills ?? []).filter((s) => s.id !== 'voile') })) } as never);
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0], { cadence: 'jourParJour' })!;
    set({ travelPlan: { ...plan, sea: { ...plan.sea!, forcedEventId: 'ouragan' } } } as never);
    runSeaDay(get, set);
    expect(get().pendingCascade?.purpose, 'prémisse : le Test d’équipage de l’Ouragan tient le slot').toBe('test');
    expect(get().suspendedCascades.map((c) => c.purpose), 'le jour en vol attend sous le Test').toEqual(['travelDay']);
    const curseurParque = get().suspendedCascades[0]!.cursor;
    const estBande = (x: CascadeStep) => x.id.startsWith('mer-equipage-touche');
    const bandeVivante = () => [get().pendingCascade, ...get().suspendedCascades].some((c) => c?.participants.some(estBande));
    let bandeVue = false;
    let bandeDansLeTest = false;
    for (let i = 0; i < 20 && get().pendingCascade?.purpose === 'test'; i++) {
      expect(journeesVivantes(), 'une seule journée, en pile, pendant le Test de l’événement').toHaveLength(1);
      if (bandeVivante()) bandeVue = true;
      if (get().pendingCascade!.participants.some(estBande)) bandeDansLeTest = true;
      unPas(affalerRate);
    }
    if (bandeVivante()) bandeVue = true;
    expect(bandeVue, 'prémisse : Affaler raté, le tirage des Critiques porte un coup à l’équipage, une bande `mer-equipage-touche` existe').toBe(true);
    expect(bandeDansLeTest, 'la bande `mer-equipage-touche` rejoint la séquence du Test').toBe(true);
    const jour = get().pendingCascade;
    expect(jour?.purpose, 'la clôture du Test rend le jour par la pile').toBe('travelDay');
    expect(jour!.cursor, 'le jour est repris à son curseur, pas rebâti').toBe(curseurParque);
    expect(jour!.participants.some(estBande), 'la bande ne passe pas dans le jour').toBe(false);
    expect(jour!.participants.some((x) => x.kind === 'merProgressionChoix' || x.kind === 'equipage-progression'), 'le jour porte sa Progression, quelle que soit sa forme').toBe(true);
    for (let i = 0; i < 40 && get().pendingCascade && !get().pendingRest; i++) {
      unPas();
      expect(get().travelPlan!.sea!.daysAtSea).toBe(get().pendingRest ? 1 : 0);
    }
    expect(get().pendingRest).toBeTruthy();
    expect(get().travelPlan!.sea!.daysAtSea).toBe(1);
  });

  /* Le pilote du jour (`jouerLaJournee`) joue d'office l'étape de table de l'événement de bord : ce que son
   * applier ouvre suspend le jour, dont la clôture le reprend une fois. */
  const CADENCES = ['jourParJour', 'commande'] as const;
  /** Le montage des sondes du juge (#4006) : le gréement sans Voile, l'Humeur de Manann à −60, l'événement de bord
   *  dû ce jour ; la graine tire l'événement. `sea` surcharge l'état de traversée (un événement nommé d'avance). */
  const monterLeJour = (graine: number, cadence: (typeof CADENCES)[number], sea: Partial<SeaVoyageState> = {}) => {
    freshState();
    set({
      party: get().party.map((h) => ({ ...h, shipStation: 'greement', skills: (h.skills ?? []).filter((s) => s.id !== 'voile') })),
      vessel: { ...get().vessel!, manann: { score: -60, applied: [] } },
    } as never);
    seedBattleRng(graine);
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0], { cadence })!;
    set({ travelPlan: { ...plan, sea: { ...plan.sea!, daysToEvent: 1, ...sea } } } as never);
  };
  const jourDuMontage = (graine: number, cadence: (typeof CADENCES)[number], sea: Partial<SeaVoyageState> = {}) => {
    monterLeJour(graine, cadence, sea);
    runSeaDay(get, set);
  };
  /** L'événement de bord du jour est-il raconté (`sea.events`, versé au procès-verbal à la clôture) ? */
  const evenementRaconte = (id: string) => [...(get().travelPlan!.sea!.events ?? []), ...(get().travelPlan!.log ?? []).flatMap((j) => j.events ?? [])]
    .some((e) => e.title === seaBoardEventById(id)!.label);
  /** Une séquence vivante, slot ou pile, porte-t-elle une étape de ce `kind` à son curseur ? */
  const ouverte = (kind: string) => [get().pendingCascade, ...get().suspendedCascades].some((c) => c?.participants[c.cursor]?.kind === kind);
  const etapeAuSlot = () => get().pendingCascade?.participants[get().pendingCascade!.cursor]?.kind;
  const pile = () => get().suspendedCascades.map((c) => c.purpose);
  const lignesDuJournal = (cle: Parameters<typeof t>[0], params: Record<string, string>) => {
    const prefixe = t(cle, params).split('§')[0];
    return get().journal.filter((l) => l.startsWith(prefixe)).length;
  };
  /** Joue la cascade jusqu'au slot libre ; rend la suite des `purpose` tenus au slot, sans répétition, et les
   *  `kind` des étapes jouées à la fenêtre. */
  const jusquAuSlotLibre = (poser?: PoseDe, choisir?: ChoisitCle) => {
    const vues: string[] = [];
    const etapes: string[] = [];
    for (let i = 0; i < 80 && get().pendingCascade; i++) {
      const p = get().pendingCascade!.purpose;
      if (vues[vues.length - 1] !== p) vues.push(p);
      expect(journeesVivantes().length, 'jamais deux journées vivantes').toBeLessThanOrEqual(1);
      etapes.push(etapeAuSlot() ?? '');
      unPas(poser, choisir);
    }
    expect(get().pendingCascade, 'la cascade se draine').toBeNull();
    return { vues, etapes };
  };
  /** Une journée comptée, une seule, dénouée sur la halte. */
  const uneJourneeComptee = (cas: string) => {
    expect(get().travelPlan!.sea!.daysAtSea, `une journée comptée (${cas})`).toBe(1);
    expect(get().travelPlan!.log, `le jour se dénoue une fois (${cas})`).toHaveLength(1);
    expect(get().pendingRest, `la halte du soir (${cas})`).toBeTruthy();
  };
  /** Joue la séquence `test` de l'événement tant qu'elle tient le slot : pendant ce temps, le jour attend en pile
   *  derrière son étape d'événement, sans Progression jouée, sans journée comptée ni halte ouverte. */
  const jouerLEvenement = (cas: string, poser?: PoseDe, choisir?: ChoisitCle) => {
    for (let i = 0; i < 40 && get().pendingCascade?.purpose === 'test'; i++) {
      const [jour] = journeesVivantes();
      expect(jour?.cursor, `le jour attend derrière son étape d’événement (${cas})`).toBe(1);
      expect(jour!.participants.some((x) => x.kind === 'equipage-progression' && x.committed), `aucune Progression jouée sous l’événement (${cas})`).toBe(false);
      expect(get().travelPlan!.sea!.daysAtSea, `aucune journée comptée sous l’événement (${cas})`).toBe(0);
      expect(get().pendingRest, `aucune halte sous l’événement (${cas})`).toBeNull();
      unPas(poser, choisir);
    }
  };

  it('Ouragan NATUREL (graines 4 et 11) : le Test d’équipage passe avant le choix de Progression du jour, présenté une fois, une journée comptée', () => {
    for (const cadence of CADENCES) for (const graine of [4, 11]) {
      const cas = `${cadence}, graine ${graine}`;
      jourDuMontage(graine, cadence);
      expect(evenementRaconte('ouragan'), `prémisse (${cas}) : la table du jour tire l’Ouragan`).toBe(true);
      expect(ouverte('testDEquipage'), `prémisse (${cas}) : l’applier de la table ouvre le Test d’équipage`).toBe(true);
      expect(etapeAuSlot(), `le Test d’équipage tient le slot (${cas})`).toBe('testDEquipage');
      expect(pile(), `le jour attend sous le Test (${cas})`).toEqual(['travelDay']);
      jouerLEvenement(cas, affalerRate);
      const { etapes } = jusquAuSlotLibre(affalerRate);
      // En traversée commandée, le pilote joue la Progression sans fenêtre : le jour unique (`uneJourneeComptee`) la porte.
      if (cadence === 'jourParJour') expect(etapes.filter((k) => k === 'merProgressionChoix'), `le choix de Progression présenté une fois, après le Test (${cas})`).toHaveLength(1);
      uneJourneeComptee(cas);
    }
  });

  it('événement de bord NATUREL à nœud `choix` (Vaisseau fantôme, graine 12) puis à nœud `test` (Ouragan, graine 13) : la halte s’ouvre après sa clôture, une journée comptée', () => {
    const montages = [{ graine: 12, evenement: 'vaisseau-fantome-litteralement', noeud: 'choixDeFlux' }, { graine: 13, evenement: 'ouragan', noeud: 'testDEquipage' }];
    for (const cadence of CADENCES) for (const { graine, evenement, noeud } of montages) {
      const cas = `${cadence}, ${evenement}`;
      jourDuMontage(graine, cadence);
      expect(evenementRaconte(evenement), `prémisse (${cas}) : la table du jour tire l’événement`).toBe(true);
      expect(ouverte(noeud), `prémisse (${cas}) : l’applier de la table ouvre son nœud`).toBe(true);
      expect(etapeAuSlot(), `le nœud de l’événement tient le slot (${cas})`).toBe(noeud);
      expect(pile(), `le jour attend sous l’événement (${cas})`).toEqual(['travelDay']);
      jouerLEvenement(cas, affalerRate);
      jusquAuSlotLibre(affalerRate);
      uneJourneeComptee(cas);
    }
  });

  it('sommation NATURELLE (Cogue pirate, graine 3) « fuir » : la Poursuite ouverte une fois, composée le jour même, une journée comptée', () => {
    const fuir: ChoisitCle = (etape) => (etape.kind === 'merPiratesSommation' ? 'fuir' : undefined);
    for (const cadence of CADENCES) {
      jourDuMontage(3, cadence);
      expect(evenementRaconte('cogue-pirate'), `prémisse (${cadence}) : la table du jour tire la Cogue pirate`).toBe(true);
      expect(ouverte('merPiratesSommation'), `prémisse (${cadence}) : l’applier de la table ouvre la sommation`).toBe(true);
      expect(etapeAuSlot(), `la sommation tient le slot (${cadence})`).toBe('merPiratesSommation');
      expect(pile(), `le jour attend sous la sommation (${cadence})`).toEqual(['travelDay']);
      jouerLEvenement(cadence, undefined, fuir);
      expect(get().travelPlan!.sea!.crisis?.kind, `prémisse (${cadence}) : « fuir » pose la Poursuite`).toBe('poursuite');
      jusquAuSlotLibre(undefined, fuir);
      expect(lignesDuJournal('sv.fleeChase', { start: '§', escapeAt: '§' }), `la Poursuite ouverte une fois (${cadence})`).toBe(1);
      const prefixeManche = t('sv.chase', { label: '§', issue: '', gain: '', distance: '', escapeAt: '' }).split('§')[0];
      expect(get().travelPlan!.log![0]!.lines!.filter((l) => l.text.startsWith(prefixeManche)), `la manche de Poursuite se compose dans le jour de la sommation (${cadence})`).toHaveLength(1);
      uneJourneeComptee(cadence);
    }
  });

  it('sommation NATURELLE (Cogue pirate, graine 3) « combattre » : le jour attend sous l’abordage et reprend une fois après la victoire', () => {
    const combattre: ChoisitCle = (etape) => (etape.kind === 'merPiratesSommation' ? 'combattre' : undefined);
    for (const cadence of CADENCES) {
      jourDuMontage(3, cadence);
      expect(ouverte('merPiratesSommation'), `prémisse (${cadence}) : l’applier de la table ouvre la sommation`).toBe(true);
      expect(etapeAuSlot(), `la sommation tient le slot (${cadence})`).toBe('merPiratesSommation');
      unPas(undefined, combattre);
      expect(get().battle, `prémisse (${cadence}) : « combattre » ouvre l’abordage`).toBeTruthy();
      expect(pile(), `le jour sous la carte d’abordage (${cadence})`).toEqual(['travelDay', 'affichage']);
      const battle = get().battle!;
      for (const c of battle.combatants) if (c.kind === 'ennemi') c.dead = true;
      set({ battle: { ...battle } });
      checkBattleOver(get, set);
      get().fenetreFermer('victoire');
      expect(get().travelPlan!.sea!.daysAtSea, `la victoire ne compte aucune journée (${cadence})`).toBe(0);
      const { vues } = jusquAuSlotLibre();
      expect(vues[0], `la carte d’abordage d’abord (${cadence})`).toBe('affichage');
      expect(vues.filter((p) => p === 'travelDay').length, `le jour repris au plus une fois au slot (${cadence})`).toBeLessThanOrEqual(1);
      uneJourneeComptee(cadence);
    }
  });

  const lignesDeMeteo = () => lignesDuJournal('sv.weatherOfDay', { weather: '§', from: '§', heading: '§' });
  /** Les événements de bord racontés sur la traversée (`sea.events` et procès-verbaux), par leur texte. */
  const evenementsDeLaTraversee = () => [...(get().travelPlan!.sea!.events ?? []), ...(get().travelPlan!.log ?? []).flatMap((j) => j.events ?? [])];
  const racontes = (id: string) => evenementsDeLaTraversee().filter((e) => e.text === seaBoardEventById(id)!.desc);

  it('Présage NOMMÉ d’avance (albatros, feu bleu ; réussi, raté) : le Test de Prière s’ouvre sous le jour en vol, puis le jour reprend, une seule Météo du jour, compteur retiré', () => {
    const prierManann = (x: CascadeStep) => !!x.stake && 'key' in x.stake && x.stake.key?.kind === 'mer-priere-manann';
    // Signe de l'écart d'Humeur de Manann selon l'issue (`sea-events.json`, MDG 15 l.197-198, l.230-232).
    const signes = { 'presage-divin-albatros': { reussi: 0, rate: -1 }, 'presage-divin-feu-bleu': { reussi: 1, rate: 0 } } as const;
    for (const cadence of CADENCES) for (const [presage, signe] of Object.entries(signes)) for (const issue of ['reussi', 'rate'] as const) {
      const cas = `${cadence}, ${presage}, ${issue}`;
      monterLeJour(1, cadence, { forcedEventId: presage, daysToEvent: 99 });
      const [h, ...reste] = get().party;
      set({ party: [{ ...h, skills: [...(h.skills ?? []), { id: 'priere', characteristic: 'sociabilite', advances: 20 }], talents: [...h.talents, { talentId: 'beni', spec: 'manann', times: 1 }] }, ...reste] } as never);
      runSeaDay(get, set);
      expect(prierManann(get().pendingCascade!.participants[get().pendingCascade!.cursor]!), `le Test de Prière tient le slot (${cas})`).toBe(true);
      expect(pile(), `le jour attend sous le Test (${cas})`).toEqual(['travelDay']);
      const humeurAvant = get().vessel!.manann!.score;
      let prieres = 0;
      for (let i = 0; i < 80 && (get().pendingTest || get().pendingCascade); i++) {
        expect(journeesVivantes().length, `jamais deux journées vivantes (${cas})`).toBeLessThanOrEqual(1);
        if (get().pendingTest) {
          prieres++;
          expect(pile(), `le Test de Prière se joue sous le jour en vol (${cas})`).toEqual(['travelDay']);
          expect(get().travelPlan!.sea!.daysAtSea, `aucune journée comptée sous le Test (${cas})`).toBe(0);
          get().jetLancer('test');
          get().jetImposerLeResultat('test', issue === 'reussi' ? 1 : 99);
          get().jetValider('test');
        } else unPas();
      }
      expect(prieres, `un Test de Prière joué (${cas})`).toBe(1);
      expect(get().pendingCascade, `la cascade se draine (${cas})`).toBeNull();
      expect(Math.sign(get().vessel!.manann!.score - humeurAvant), `l’issue du Test s’applique (${cas})`).toBe(signe[issue]);
      uneJourneeComptee(cas);
      expect(lignesDeMeteo(), `une seule Météo du jour (${cas})`).toBe(1);
      expect(racontes(presage), `le Présage raconté une fois (${cas})`).toHaveLength(1);
      expect(get().travelPlan!.sea!.forcedEventId, `l’événement nommé est consommé (${cas})`).toBeUndefined();
      expect(get().travelPlan!.sea!.daysToEvent, `le compteur est retiré : délai suivant tiré, 1d10 (${cas})`).toBeLessThanOrEqual(10);
    }
  });

  it('« Bateau endommagé » NOMMÉ d’avance (graines 3, 7, 14) : la bande du coup à l’équipage rejoint le jour en vol, qui se clôt une fois', () => {
    const estBande = (x: CascadeStep) => x.kind === 'testDeclencheEnBande';
    for (const cadence of CADENCES) for (const graine of [3, 7, 14]) {
      const cas = `${cadence}, graine ${graine}`;
      jourDuMontage(graine, cadence, { forcedEventId: 'bateau-endommage' });
      const hotes = new Set<string>();
      const releve = () => { for (const c of [get().pendingCascade, ...get().suspendedCascades]) if (c?.participants.some(estBande)) hotes.add(c.purpose); };
      releve();
      for (let i = 0; i < 80 && get().pendingCascade; i++) { expect(journeesVivantes().length).toBeLessThanOrEqual(1); unPas(); releve(); }
      // Traversée commandée : la journée de routine se joue d'un trait, la bande au procès-verbal du jour.
      if ((get().travelPlan!.log?.[0]?.entries ?? []).some((e) => e.id?.includes('testDeclencheEnBande'))) hotes.add('travelDay');
      expect([...hotes], `la bande rejoint le jour en vol, et lui seul (${cas})`).toEqual(['travelDay']);
      uneJourneeComptee(cas);
    }
  });

  it('sommation NOMMÉE d’avance (Cogue pirate, graines 3 et 7) « fuir » : une seule sommation sur la traversée du montage', () => {
    const fuir: ChoisitCle = (etape) => (etape.kind === 'merPiratesSommation' ? 'fuir' : undefined);
    for (const cadence of CADENCES) for (const graine of [3, 7]) {
      const cas = `${cadence}, graine ${graine}`;
      jourDuMontage(graine, cadence, { forcedEventId: 'cogue-pirate' });
      expect(etapeAuSlot(), `la sommation tient le slot (${cas})`).toBe('merPiratesSommation');
      expect(pile(), `le jour attend sous la sommation (${cas})`).toEqual(['travelDay']);
      const { etapes } = jusquAuSlotLibre(undefined, fuir);
      expect(etapes.filter((k) => k === 'merPiratesSommation'), `une seule sommation (${cas})`).toHaveLength(1);
      expect(racontes('cogue-pirate'), `la Cogue pirate racontée une fois (${cas})`).toHaveLength(1);
      expect(lignesDuJournal('sv.fleeChase', { start: '§', escapeAt: '§' }), `la Poursuite ouverte une fois (${cas})`).toBe(1);
      expect(get().travelPlan!.sea!.forcedEventId, `l’événement nommé est consommé (${cas})`).toBeUndefined();
      uneJourneeComptee(cas);
    }
  });

  it('nommé d’avance contre tiré à la table (Vaisseau fantôme, graine 12, même départ) : même rang, même possession, même ligne, même pile ; seules différences : pas de rangée, pas de dé au procès-verbal, un tirage de moins', () => {
    const KIND = 'mer-evenement-de-bord';
    const EV = 'vaisseau-fantome-litteralement';
    const ligneDeLEvenement = `${seaBoardEventById(EV)!.label} — `;
    for (const cadence of CADENCES) {
      const bras = (sea: Partial<SeaVoyageState>) => {
        jourDuMontage(12, cadence, sea);
        const [jour] = journeesVivantes();
        const rang = jour!.participants.findIndex((x) => x.kind === KIND);
        const etape = jour!.participants[rang]!;
        const releve = {
          rang, etape, slot: etapeAuSlot(), pile: pile(), curseur: jour!.cursor,
          lignes: get().journal.filter((l) => l.startsWith(ligneDeLEvenement)),
          events: (get().travelPlan!.sea!.events ?? []).map((e) => ({ title: e.title, roll: e.roll })),
          forcedEventId: get().travelPlan!.sea!.forcedEventId,
          tirages: [battleRng().int(1, 1000), battleRng().int(1, 1000), battleRng().int(1, 1000)],
        };
        // Possession : l'étape posée seule au slot, telle qu'elle a été bâtie (sans son commit).
        const { committed: _c, outcome: _o, table, ...decl } = etape;
        const tableDeclaree = table ? (({ result: _r, ...d }) => d)(table) : undefined;
        freshState();
        startCascade(get, set, { title: 'possession', purpose: 'travelDay', steps: [{ ...decl, ...(tableDeclaree ? { table: tableDeclaree } : {}) } as never] });
        return { ...releve, proprietaire: modalOwnerOf(get() as never) };
      };
      const naturel = bras({});
      expect(naturel.etape.table?.result?.id, `prémisse (${cadence}) : la table du jour tire le Vaisseau fantôme`).toBe(EV);
      const nomme = bras({ forcedEventId: EV });
      expect(nomme.rang, `même rang dans le jour (${cadence})`).toBe(naturel.rang);
      expect([nomme.etape.worldOwner, nomme.etape.actorId], `même possession déclarée (${cadence})`).toEqual([true, undefined]);
      expect([naturel.etape.worldOwner, naturel.etape.actorId]).toEqual([true, undefined]);
      expect([nomme.proprietaire, naturel.proprietaire], `même propriétaire de la fenêtre (${cadence})`).toEqual([WORLD_STEP_OWNER, WORLD_STEP_OWNER]);
      expect(naturel.lignes, `prémisse (${cadence}) : une ligne de conséquence`).toHaveLength(1);
      expect(nomme.lignes, `même ligne au journal (${cadence})`).toEqual(naturel.lignes);
      expect([nomme.slot, nomme.pile, nomme.curseur], `même slot et même pile après le commit (${cadence})`).toEqual([naturel.slot, naturel.pile, naturel.curseur]);
      expect(nomme.forcedEventId, `l’événement nommé est consommé (${cadence})`).toBeUndefined();
      // Les trois différences, aucun dé n'étant tombé.
      expect([nomme.etape.table, nomme.etape.stake], `pas de rangée de table ni d’enjeu de tirage (${cadence})`).toEqual([undefined, undefined]);
      expect(naturel.etape.stake).toBeDefined();
      expect(naturel.events, `le dé au procès-verbal du tiré (${cadence})`).toEqual([{ title: seaBoardEventById(EV)!.label, roll: expect.any(Number) }]);
      expect(nomme.events, `pas de dé au procès-verbal du nommé (${cadence})`).toEqual([{ title: seaBoardEventById(EV)!.label, roll: undefined }]);
      expect(nomme.tirages.slice(1), `un tirage du générateur de moins (${cadence})`).toEqual(naturel.tirages.slice(0, 2));
    }
  });

  it('un événement nommé pendant qu’une étape tirée attend son commit : la rangée tirée se joue, l’événement nommé reste posé et se joue au jour suivant', () => {
    const NOMME = 'presage-divin-feu-bleu'; // sans Prêtre de Manann à bord : aucune conséquence (`sea-events.json`)
    const perilMap: WorldMap = {
      ...seaMap,
      routes: [{ ...seaMap.routes[0], perils: [{ label: 'Froid mordant', chancePct: 100, effects: [{ type: 'exposureNight', kind: 'froid', count: 1, target: 'groupe' }] }] }],
    };
    set({ worldMap: perilMap } as never);
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', perilMap.routes[0], { cadence: 'jourParJour' })!;
    set({ travelPlan: { ...plan, sea: { ...plan.sea!, daysToEvent: 1 } } } as never);
    runSeaDay(get, set);
    for (let i = 0; i < 10 && get().pendingCascade?.purpose !== 'test'; i++) unPas();
    const [jour] = journeesVivantes();
    expect(pile(), 'prémisse : le Test du péril parque le jour').toEqual(['travelDay']);
    expect(jour!.participants[jour!.cursor]?.kind, 'prémisse : l’étape d’événement tirée attend son commit').toBe('mer-evenement-de-bord');
    expect(jour!.participants[jour!.cursor]?.table, 'prémisse : c’est l’étape de table').toBeDefined();
    set({ travelPlan: { ...get().travelPlan!, sea: { ...get().travelPlan!.sea!, forcedEventId: NOMME } } } as never);
    jusquAuSlotLibre();
    expect(racontes(NOMME), 'le jour joue sa rangée tirée, pas l’événement nommé').toHaveLength(0);
    expect(evenementsDeLaTraversee(), 'la rangée tirée est racontée').toHaveLength(1);
    expect(get().travelPlan!.sea!.forcedEventId, 'l’événement nommé reste posé').toBe(NOMME);
    get().fenetreValider('repos');
    jusquAuSlotLibre();
    expect(racontes(NOMME), 'le jour suivant joue l’événement nommé').toHaveLength(1);
    expect(get().travelPlan!.sea!.forcedEventId).toBeUndefined();
  });

  it('une séquence `test` close sous la halte, en mer, ne bâtit aucune journée (nœud `choix` d’un Flow)', () => {
    const choix = { kind: 'choix', invite: 'Payer', oui: { kind: 'effet', effet: { type: 'setFlag', flag: 'oui', value: true } }, non: EMPTY_FLOW } as never;
    for (const cadence of CADENCES) {
      freshState();
      const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0], { cadence })!;
      set({ travelPlan: { ...plan, sea: { ...plan.sea!, daysToEvent: 9 } } } as never);
      runSeaDay(get, set);
      for (let i = 0; i < 150 && get().pendingCascade && !get().pendingRest; i++) unPas();
      expect(get().pendingRest, `prémisse (${cadence}) : la halte du soir attend`).toBeTruthy();
      const avant = { meteo: lignesDeMeteo(), jours: get().travelPlan!.sea!.daysAtSea, log: get().travelPlan!.log?.length };
      jouerFlowEntier(runFlow(get, set, choix, 'Décision'));
      expect([get().pendingCascade?.purpose, etapeAuSlot()], `prémisse (${cadence}) : le choix ouvre sa séquence \`test\``).toEqual(['test', 'choixDeFlux']);
      unPas(undefined, (e) => (e.kind === 'choixDeFlux' ? 'oui' : undefined));
      expect(get().flags.oui, `prémisse (${cadence}) : la branche est jouée`).toBe(true);
      expect(get().pendingCascade, `aucune journée bâtie à la clôture (${cadence})`).toBeNull();
      expect({ meteo: lignesDeMeteo(), jours: get().travelPlan!.sea!.daysAtSea, log: get().travelPlan!.log?.length }, `ni météo annoncée, ni journée comptée (${cadence})`).toEqual(avant);
      expect(get().pendingRest, `la halte attend toujours (${cadence})`).toBeTruthy();
    }
  });

  it('ouverture puis combat (Puissant monstre marin, graine 6) : derrière le combat, la pile est [travelDay, affichage]', () => {
    for (const cadence of CADENCES) {
      jourDuMontage(6, cadence);
      expect(evenementRaconte('puissant-monstre-marin'), `prémisse (${cadence}) : la table du jour tire le Puissant monstre marin`).toBe(true);
      expect(get().battle, `prémisse (${cadence}) : le combat est ouvert`).toBeTruthy();
      expect(pile(), `le jour dessous, la carte que l’applier a ouverte dessus (${cadence})`).toEqual(['travelDay', 'affichage']);
    }
  });

  it('une séquence `test` close pendant le combat naval, ennemis hors de combat : le combat se conclut, aucune journée bâtie', () => {
    const choix = { kind: 'choix', invite: 'Payer', oui: { kind: 'effet', effet: { type: 'setFlag', flag: 'oui', value: true } }, non: EMPTY_FLOW } as never;
    for (const cadence of CADENCES) {
      jourDuMontage(6, cadence);
      expect(get().battle, `prémisse (${cadence}) : le Puissant monstre marin ouvre le combat`).toBeTruthy();
      const avant = { meteo: lignesDeMeteo(), jours: get().travelPlan!.sea!.daysAtSea, pile: pile() };
      const b = get().battle!;
      set({ battle: { ...b, combatants: b.combatants.map((c) => (c.kind === 'heros' ? c : { ...c, dead: true })) } } as never);
      jouerFlowEntier(runFlow(get, set, choix, 'Décision'));
      expect([get().pendingCascade?.purpose, etapeAuSlot()], `prémisse (${cadence}) : le choix ouvre sa séquence \`test\``).toEqual(['test', 'choixDeFlux']);
      unPas(undefined, (e) => (e.kind === 'choixDeFlux' ? 'oui' : undefined));
      expect(get().flags.oui, `prémisse (${cadence}) : la branche est jouée`).toBe(true);
      expect(get().battle?.over, `le combat se conclut (${cadence})`).toBe('victoire');
      expect(get().pendingCascade, `aucune journée au slot (${cadence})`).toBeNull();
      expect({ meteo: lignesDeMeteo(), jours: get().travelPlan!.sea!.daysAtSea, pile: pile() }, `ni météo annoncée, ni journée comptée, le jour toujours en pile (${cadence})`).toEqual(avant);
    }
  });

  describe('péril d’AUTEUR en traversée COMMANDÉE : ce que son effet ouvre passe avant le reste du jour', () => {
    const MALADIE = 'blessure-purulente';
    const perilMap = (effects: NonNullable<WorldMap['routes'][number]['perils']>[number]['effects']): WorldMap => ({
      ...seaMap, routes: [{ ...seaMap.routes[0], perils: [{ label: 'Fièvre', chancePct: 100, effects }] }],
    });
    const traverser = () => {
      const plan = buildSeaPlan(get, 'r1', 'A', 'B', get().worldMap!.routes[0], { cadence: 'commande' })!;
      set({ travelPlan: { ...plan, sea: { ...plan.sea!, daysToEvent: 5 } } } as never);
      runSeaDay(get, set);
    };
    const porteurs = () => get().party.filter((h) => (h.diseases ?? []).some((d) => d.id === MALADIE));
    const titreDeMaladie = t('eff.titreDeMaladie', { disease: MALADIE });

    it('[inflictDisease, exposureNight] : la maladie et le Test passent avant le jour, qui se dénoue une fois', () => {
      set({ worldMap: perilMap([{ type: 'inflictDisease', disease: MALADIE }, { type: 'exposureNight', kind: 'froid', count: 1, target: 'groupe' }]) } as never);
      traverser();
      expect(porteurs(), 'prémisse : la maladie est contractée').toHaveLength(1);
      expect(get().pendingCascade?.purpose, 'prémisse : l’exposition ouvre son Test').toBe('test');
      expect(pile(), 'le jour au fond, la révélation de la maladie dessus').toEqual(['travelDay', 'affichage']);
      expect(get().suspendedCascades[1]!.title).toBe(titreDeMaladie);
      expect(get().suspendedCascades[0]!.cursor, 'le jour parqué juste après son péril').toBe(1);
      expect(jusquAuSlotLibre().vues, 'le Test, puis la révélation ; le jour reprend sans fenêtre').toEqual(['test', 'affichage']);
      uneJourneeComptee('commande');
      expect(lignesDuJournal('tf.perilDAuteur', { label: 'Fièvre' }), 'le péril joué une fois').toBe(1);
    });

    it('[inflictDisease, transition] : la révélation se montre dans la scène d’arrivée, puis le jour tronqué se dénoue une fois, voyage interrompu', () => {
      const scene = (id: string) => { const s = emptyScene('scene-test', 2, 2); s.id = id; s.label = id; return s; };
      const vessel = get().vessel;
      get().chargerLeProjet({ scenes: [scene('port-a'), scene('port-b'), scene('ilot')], entryId: 'port-a', worldMap: perilMap([{ type: 'inflictDisease', disease: MALADIE }, { type: 'transition', scene: { id: 'ilot' } }]), projet: null });
      set({ vessel } as never); // lancerLaScene remet le vessel de campagne — repose-le
      traverser();
      expect(get().scene!.id, 'prémisse : la transition mène à la scène d’arrivée').toBe('ilot');
      expect(get().travelPlan!.interrupted, 'prémisse : le voyage est interrompu').toBe(true);
      expect(get().pendingCascade?.title, 'la révélation tient le slot dans la scène d’arrivée').toBe(titreDeMaladie);
      expect(pile(), 'le jour attend sous elle').toEqual(['travelDay']);
      const jour = get().suspendedCascades[0]!;
      expect(jour.cursor, 'le jour tronqué après son péril').toBe(jour.participants.length);
      expect(get().travelPlan!.sea!.daysAtSea, 'aucune journée comptée avant la révélation').toBe(0);
      jusquAuSlotLibre();
      uneJourneeComptee('commande');
      expect(get().travelPlan!.interrupted, 'le voyage reste interrompu').toBe(true);
      expect(get().scene!.id).toBe('ilot');
    });
  });
});

describe('l’événement de bord tombe le jour où son compteur arrive à zéro (MDG 15 l.89)', () => {
  beforeEach(freshState);
  /** Une route assez longue pour qu'aucune arrivée ne coupe la traversée observée. */
  const merLongue: WorldMap = { ...seaMap, routes: [{ ...seaMap.routes[0], km: 5000 }] };
  /** Appareille sous la graine ; `daysToEvent` posé au départ, sinon le tirage de `buildSeaPlan`. */
  const appareiller = (graine: number, daysToEvent?: number, cadence: 'jourParJour' | 'commande' = 'jourParJour') => {
    set({ worldMap: merLongue } as never);
    seedBattleRng(graine);
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', merLongue.routes[0], { cadence })!;
    set({ travelPlan: daysToEvent === undefined ? plan : { ...plan, sea: { ...plan.sea!, daysToEvent } } } as never);
    runSeaDay(get, set);
    return plan.sea!.daysToEvent;
  };
  /** Joue la journée en cours jusqu'à sa halte (Activités hebdo validées en route) ; rend le compteur du soir. */
  const jouerLaJournee = (jour: number) => {
    for (let i = 0; i < 300 && !get().pendingRest; i++) {
      if (get().pendingCascade) avanceEtapeCascade(get);
      else if (get().pendingSeaActivities) get().fenetreValider('activitesEnMer');
      else break;
      banc.reprendreTout();
    }
    expect(get().pendingRest, `prémisse : la journée ${jour} se dénoue sur la halte`).toBeTruthy();
    return get().travelPlan!.sea!.daysToEvent;
  };
  /** Joue `jours` journées de plus (la halte de la veille validée, celle du dernier soir laissée) ; rend les
   *  compteurs du soir. */
  const traverser = (jours: number) => {
    const soirs: number[] = [];
    for (let jour = 1; jour <= jours; jour++) {
      if (get().pendingRest) { get().fenetreValider('repos'); banc.reprendreTout(); }
      soirs.push(jouerLaJournee(jour));
    }
    return soirs;
  };
  /** Les jours (1 = premier jour en mer) dont le procès-verbal raconte un événement de bord. */
  const joursDEvenement = () => (get().travelPlan!.log ?? []).flatMap((j, i) => (j.events?.length ? [i + 1] : []));

  it.each([1, 2, 3])('compteur posé à %i au départ : l’événement tombe ce jour-là, aucun avant', (compteur) => {
    appareiller(6, compteur);
    traverser(compteur);
    expect(joursDEvenement()).toEqual([compteur]);
  });

  it.each(Array.from({ length: 10 }, (_, k) => k + 1))('traversée commandée, compteur posé à %i au départ : l’événement tombe ce jour-là, aucun avant', (compteur) => {
    set({ gameTime: 160 * 1440 + 8 * 60, lastUpkeepDay: 160 } as never); // été : le froid ne coupe pas la traversée avant N = 10
    appareiller(6, compteur, 'commande');
    traverser(compteur);
    expect(joursDEvenement()).toEqual([compteur]);
  });

  it.each([{ graine: 5, tirage: 5 }, { graine: 21, tirage: 4 }])('après un événement dont l’applier tire $tirage (graine $graine), le suivant tombe $tirage jours plus tard', ({ graine, tirage }) => {
    appareiller(graine, 1);
    const [soirDuJour1] = traverser(1);
    expect(joursDEvenement(), 'prémisse : l’événement du jour 1').toEqual([1]);
    expect(soirDuJour1, 'prémisse : le délai suivant tiré par l’applier').toBe(tirage);
    traverser(tirage);
    expect(joursDEvenement()).toEqual([1, 1 + tirage]);
  });

  it.each([{ graine: 20, tirage: 2 }, { graine: 3, tirage: 5 }])('premier événement d’une traversée : le tirage du départ ($tirage, graine $graine) le pose ce jour-là', ({ graine, tirage }) => {
    expect(appareiller(graine), 'prémisse : le tirage de `buildSeaPlan`').toBe(tirage);
    traverser(tirage);
    expect(joursDEvenement()).toEqual([tirage]);
  });
});
