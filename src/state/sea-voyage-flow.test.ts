import { fixtureText } from '../i18n/fixtureText';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useGame } from './store';
import { makePregens } from '../data/pregens';
import {
  buildSeaPlan, portRepairVessel, portInstallUpgrade, runSeaDay, continueSeaDayAfterCascade,
  resolvePortArrival, resolveManannPriest, resolveShoreLeave, damageVesselHull, healVesselHull,
  buildOverspeedSteps, engineerOf, type SeaVoyageState,
} from './seaVoyageFlow';
import { seedBattleRng, battleRng } from './battleRng';
import { DIFFICULTY_MODIFIERS } from '../engine/types';
import { effectiveChar } from '../engine/characteristics';
import { partyBest, skillBaseValue, testValue } from '../engine/skills';
import { subtract, toBrass } from '../engine/money';
import { partyMoneyTotal, bourseOf, creditBourse } from './bourseFlow';
import { itemFromTrappingById } from '../engine/items';
import { bankWithdraw } from './interludeFlow';
import { traumaById } from '../engine/trauma';
import { byId, maladies, species } from '../data';
import { setDataset, resetData } from '../data/overrides';
import type { Combatant } from '../engine/types';
import { buildEncounter } from './encounterAuthoring';
import { emptyScene, type Scene } from './scene';
import type { WorldMap } from './worldMap';
import type { RNG } from '../engine/dice';
import type { CascadeStep } from './pendings';
import { resumeTravel } from './travelFlow';
import { applyEffects, runFlow } from './combatEffects';
import { EMPTY_FLOW } from '../engine/flowCore';
import { navigationDuNavire } from './shipCrew';
import { estCompetenceDePropulsion } from '../engine/propulsion';
import { cascadeAppliers, registerCascadeApplier, runCascadeImmediate } from './cascade';
import { inexplique, soutienDe, avanceEtapeCascade, draineCascade, type PoseDe } from './cascadeTestKit';
import { crewRoleValue } from '../engine/crewMorale';
import { findCrewRoleById, resolveStake, testSkillLabel } from '../data';
import { resultLine, buildBand, rollLine } from './rollSeam';
import { t } from '../i18n';
import { voyageTiles, vesselHullGauge } from '../ui/VoyageScreen';
import { checkBattleOver } from './combatFlow';
import { BOARD_EVENTS, seaBoardEventById } from '../engine/seaVoyage';
import type { RecapEvent } from './recapLine';
import { SEA_HAZARDS, findSeaHazard } from '../engine/seaPerils';
import { overspeedRow, foulingEffects } from '../engine/seaNavigation';
import { setRule, resetRule } from '../engine/policy';
import { isOutOfAction } from '../engine/conditions';
import { jetStepPresentable } from '../ui/CascadeModal';
import { WORLD_STEP_OWNER, seatOwns } from './netOwnership';
import { contractDisease } from '../engine/disease';
import { makeRNG } from '../engine/dice';
import { ECHEC_SANS_JET, estJete } from '../engine/tests';
import { jete } from '../engine/tests.testkit';
import { hullNavalTraits } from '../engine/navalTraits';

/**
 * VOYAGE MARITIME (7b) — la traversée jour par jour sur le navire de campagne (MDG 13/15), pilotée
 * par le pipeline CASCADE (#275 Ronde 2 cran 3) : un jour = `pendingCascade` `purpose:'travelDay'`,
 * Blessures de coque persistées sur `CampaignVessel` (#30), services portuaires. L'équipage hors
 * combat = les PJ (MDG 14 l.39). `pendingCrewTest` est réservé au combat (`crewTestModal` seul).
 */
const get = useGame.getState.bind(useGame);
const set = useGame.setState.bind(useGame);

const seaMap: WorldMap = {
  id: 'm', label: 'Mer des Griffes',
  places: [
    { id: 'A', label: 'Salzenmund', pos: { x: 0, y: 0 }, scene: 'port-a' },
    { id: 'B', label: 'Erengrad', pos: { x: 10, y: 0 }, scene: 'port-b', port: { taille: 3, richesse: 3, production: ['bois'] } },
  ],
  routes: [{ id: 'r1', a: 'A', b: 'B', km: 550, modes: ['mer'], sea: true, seaHeading: 'est' }],
};

function freshState() {
  seedBattleRng(1); // déterminisme (suite isolate:false) : jour 1 navigable → le Test de Progression se joue
  useGame.setState({
    party: makePregens().slice(0, 3),
    scene: { ...emptyScene(2, 2), id: 'port-a', label: 'Port', layers: [{ z: 0, tiles: ['sol', 'sol', 'sol', 'sol'] }] },
    battle: null,
    worldMap: seaMap,
    travelPlan: null,
    travelRecap: null,
    pendingCrewTest: null,
    pendingRest: null,
    pendingCascade: null,
    suspendedCascades: [],
    gameTime: 8 * 60, // 08:00 jour 0
    lastUpkeepDay: 0,
    vessel: { vehicleId: 'cogue', morale: { score: 75, lastMoraleWeek: 0, factors: [] } },
    journal: [],
  } as never);
}

/** Fait avancer LA cascade active d'UNE étape — pilote PARTAGÉ `cascadeTestKit.avanceEtapeCascade`. */
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
    resumeTravel(get, set);
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

  it('la journée close ne porte que le DELTA de coque ; la jauge de l’écran de traversée et la tuile de voyage lisent la MÊME source vive après un soin', () => {
    get().startTravel('r1', 'mer', { cadence: 'jour-par-jour' });
    const hull0 = get().travelPlan!.vehicle!.wounds.current;
    damageVesselHull(get, set, get().travelPlan!.vehicle!, 10);
    for (let i = 0; i < 30 && !get().pendingRest; i++) {
      if (!get().pendingCascade) break;
      stepCascade();
    }
    const day = get().pendingRest!.travelDay!;
    expect(day.sea!.hullDelta).toBe(-10); // ce que la journée a coûté à la coque
    // Réparation APRÈS la clôture : la surface vive suit, et la chronique du jour clos garde son delta.
    healVesselHull(get, set, get().travelPlan!.vehicle!, 10);
    const gauge = vesselHullGauge(get().vessel!)!;
    const tile = voyageTiles('mer', get().travelPlan!, get().vessel!, get().party, [], get().gameTime).find((t) => t.key === 'coque')!;
    expect(gauge.current).toBe(hull0);
    expect(tile.value).toBe(`${hull0} / ${gauge.max}`);
    expect(gauge.current).toBe(get().vessel!.wounds!.current);
    expect(day.sea!.hullDelta).toBe(-10);
  });
});

describe('journée en mer — la journée est UNE cascade `purpose:travelDay` (#275 Ronde 2 cran 3)', () => {
  beforeEach(freshState);

  it('startTravel(mer) déroule la journée : Progression et Orientation sont des étapes de la cascade ; la nuit = halte de repos', () => {
    const kinds: string[] = [];
    get().startTravel('r1', 'mer', { cadence: 'jour-par-jour' });
    // La cascade se déroule étape par étape — garde-fou 30 pas (événements/crises possibles).
    for (let i = 0; i < 30 && !get().pendingRest; i++) {
      const p = get().pendingCascade;
      if (!p) break;
      const cur = p.participants[p.cursor];
      if (cur) kinds.push(cur.kind);
      stepCascade();
    }
    expect(kinds).toContain('progression'); // Test quotidien de Progression (MDG 14 l.61, ch.15 l.78)
    expect(kinds).toContain('orientation'); // « un Test par jour de voyage » (MDG 13 l.311)
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
 * prédicat (`registerCascadeSuccessRule('crew-test', crewTestSuccess)`), l'étape ne portant que l'id.
 * Sans cette injection, une étape de voyage retomberait sur le seuil générique et IGNORERAIT la règle
 * optionnelle `crew-test-zero-success`.
 */
describe('Test d’équipage par CASCADE — seuil de succès injecté par le flux naval (MDG 14 l.13, #1019)', () => {
  beforeEach(freshState);
  afterEach(() => resetRule('crew-test-zero-success'));

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

  /** Joue la journée jusqu'à l'étape `progression`, FORCE un total d'équipage de 0 DR (chaque
   *  contributeur à 0), valide, et rend le `result` agrégé de l'étape committée. */
  function crewStepAtZero(): { sl: number; success: boolean } {
    get().startTravel('r1', 'mer', { cadence: 'jour-par-jour' });
    const step = driveToCrewStep('progression');
    expect(step).toBeTruthy();
    expect(step!.meta?.aggregateSuccessRule).toBe('crew-test'); // le flux naval verse SON id de règle
    expect(Number(step!.meta?.aggregateFlatDR ?? 0)).toBe(0); // Moral 75, sans saboteur ni trait → total = Σ des DR
    const p = get().pendingCascade!;
    const zeroed = p.participants.map((s, i) => (i !== p.cursor ? s : {
      ...s, participants: s.participants!.map((part) => ({ ...part, result: { roll: 40, target: 40, sl: 0, success: true } })),
    }));
    set({ pendingCascade: { ...p, participants: zeroed } });
    get().cascadeNext(); // agrège via `aggregateBatchStep` → prédicat de succès du registre
    const committed = get().pendingCascade?.participants.find((s) => s.kind === 'progression') ?? zeroed[p.cursor];
    return { sl: committed.result!.sl, success: committed.result!.success };
  }

  it('DR total 0 → ÉCHEC par défaut (« 1 DR ou plus … est un succès », l.13)', () => {
    const r = crewStepAtZero();
    expect(r.sl).toBe(0);
    expect(r.success).toBe(false);
  });

  it('DR total 0 → SUCCÈS sous la règle optionnelle « 0 DR compte comme un succès » (l.13, 2ᵉ phrase)', () => {
    setRule('crew-test-zero-success', true);
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
    get().startTravel('r1', 'mer', { cadence: 'jour-par-jour' });
    const step = driveToCrewStep('progression');
    expect(step).toBeTruthy();
    expect(Number(step!.meta?.aggregateFlatDR ?? 0)).toBe(-6); // 3 tranches × −2 DR (l.55)
    expect(step!.meta?.aggregateCapTo).toBe(1); // « jamais mieux qu'un Succès Minime »

    // Même avec des contributeurs excellents, le total ne dépasse pas le Succès Minime.
    const p = get().pendingCascade!;
    const strong = p.participants.map((s, i) => (i !== p.cursor ? s : {
      ...s, participants: s.participants!.map((part) => ({ ...part, result: { roll: 5, target: 60, sl: 6, success: true } })),
    }));
    set({ pendingCascade: { ...p, participants: strong } });
    get().cascadeNext();
    const committed = get().pendingCascade?.participants.find((s) => s.kind === 'progression') ?? strong[p.cursor];
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
    get().startTravel('r1', 'mer', { cadence: 'jour-par-jour' });
    const rows = driveToCrewStep('progression')!.participants!;
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
    get().startTravel('r1', 'mer', { cadence: 'jour-par-jour' });
    const step = driveToCrewStep('progression')!;
    for (const r of step.participants!) if (r.id !== muet) get().cascadeBatchRoll(r.id);
    const p = get().pendingCascade!;
    const rolled = p.participants[p.cursor];
    const somme = rolled.participants!.filter((r) => r.id !== muet).reduce((t, r) => t + jete(r.result).sl * (r.essential ? 2 : 1), 0);
    get().cascadeNext();
    const committed = get().pendingCascade?.participants.find((s) => s.kind === 'progression') ?? rolled;
    expect(committed.result!.sl).toBe(somme + Number(rolled.meta?.aggregateFlatDR ?? 0));
  });

  it('membre qui ne peut pas tenter son rôle : ni jet, ni Résilience, ni Chance — aucun tirage consommé (LDB 09 l.30 ; #2588 Q1)', () => {
    const muet = barreSansVoile();
    get().startTravel('r1', 'mer', { cadence: 'jour-par-jour' });
    driveToCrewStep('progression');
    const avant = get().party.find((h) => h.id === muet)!;
    const points = { fortune: Math.max(1, avant.fortune ?? 0), resilience: Math.max(1, avant.resilience ?? 0) };
    Object.assign(avant, points);
    seedBattleRng(9);
    get().cascadeBatchRoll(muet);
    get().cascadeBatchForceSuccess(muet);
    get().cascadeBatchBonusSL(muet);
    get().cascadeBatchReroll(muet);
    const p = get().pendingCascade!;
    expect(p.participants[p.cursor].participants!.find((r) => r.id === muet)!.result).toEqual(ECHEC_SANS_JET);
    const apres = get().party.find((h) => h.id === muet)!;
    expect({ fortune: apres.fortune, resilience: apres.resilience }).toEqual(points); // aucun point dépensé
    expect(battleRng().int(1, 1_000_000)).toBe(makeRNG(9).int(1, 1_000_000));
  });

  it('équipage au complet : aucune pénalité de Manque de bras, aucun plafond', () => {
    get().startTravel('r1', 'mer', { cadence: 'jour-par-jour' });
    const step = driveToCrewStep('progression');
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
      if (cur?.kind === 'orientation') extra = Number(cur.meta?.aggregateFlatDR ?? 0) || undefined;
      stepCascade();
    }
    return extra;
  }

  it('un héros portant une Carte marine → +2 DR au Test d’Orientation quotidien (règle maison sea-chart-orientation-dr)', () => {
    const chart = itemFromTrappingById('carte-marine')!;
    set({ party: get().party.map((h, i) => (i === 0 ? { ...h, items: [...(h.items ?? []), chart] } : h)) } as never);
    get().startTravel('r1', 'mer', { cadence: 'jour-par-jour' });
    expect(driveDayCaptureOrientation()).toBe(2); // +2 DR de la carte (défaut de la règle éditable)
  });

  it('sans Carte marine → aucun bonus d’Orientation (extraDR absent)', () => {
    get().startTravel('r1', 'mer');
    expect(driveDayCaptureOrientation()).toBeUndefined();
  });

  it('#214 : un saboteur authoré sur la coque de campagne pèse (−DR) sur les Tests d’équipage de VOYAGE, clampé [-5,0]', () => {
    set({ vessel: { ...get().vessel!, saboteurDR: -3 } });
    get().startTravel('r1', 'mer', { cadence: 'jour-par-jour' });
    expect(driveDayCaptureOrientation()).toBe(-3); // MDG 14 l.45-47, cumulable avec le bonus Carte marine

    freshState();
    set({ vessel: { ...get().vessel!, saboteurDR: -9 } }); // hors fourchette RAW → clampé à -5
    get().startTravel('r1', 'mer', { cadence: 'jour-par-jour' });
    expect(driveDayCaptureOrientation()).toBe(-5);
  });

  it('Planque (l.292) : sûre tant que le dépositaire GARDE la carte, à découvert si elle est perdue', () => {
    const hero = get().party[0];
    // Stash chartSecured à rate 100 = découverte GARANTIE sans la carte → isole l'effet de la possession.
    const deposit = { heroId: hero.id, kind: 'stash' as const, brass: 1000, rate: 100, chartSecured: true };

    // (a) le héros GARDE la carte → EN SÛRETÉ : le trésor est récupéré malgré rate 100. Le retrait est
    // recrédité au DÉPOSITAIRE (interludeFlow `bankWithdrawInner`, SOCLE POSSESSIONS #531) — SA bourse.
    const chart = itemFromTrappingById('carte-marine')!;
    set({ party: get().party.map((h, i) => (i === 0 ? { ...h, items: [chart] } : h)), bank: [deposit] } as never);
    bankWithdraw(get, set, 0);
    expect(get().bank).toHaveLength(0);
    expect(toBrass(bourseOf(get().party[0]))).toBe(1000); // récupéré sur la bourse du déposant

    // (b) la carte est PERDUE (héros sans carte) → même stash → DÉCOUVERT (rien récupéré).
    set({ party: get().party.map((h, i) => (i === 0 ? { ...h, items: [] } : h)), bank: [deposit] } as never);
    bankWithdraw(get, set, 0);
    expect(get().bank).toHaveLength(0);
    expect(toBrass(bourseOf(get().party[0]))).toBe(0);
  });
});

describe('Infestation de rats géants — Extermination des nuisibles Complexe (MDG 15 l.159-162)', () => {
  beforeEach(freshState);

  function driveDayCaptureExtermination(): number | undefined {
    let extra: number | undefined;
    for (let i = 0; i < 30 && !get().pendingRest; i++) {
      const p = get().pendingCascade;
      if (!p) break;
      const cur = p.participants[p.cursor];
      if (cur?.kind === 'extermination') extra = Number(cur.meta?.aggregateFlatDR ?? 0) || undefined;
      stepCascade();
    }
    return extra;
  }

  it('Complexe (–10) descend au Test d’équipage d’Extermination en −1 DR plat (même canal que l’Ouragan)', () => {
    get().startTravel('r1', 'mer', { cadence: 'jour-par-jour' });
    const plan = get().travelPlan!;
    set({ travelPlan: { ...plan, sea: { ...plan.sea!, infestation: { label: 'Infestation de rats géants', difficulty: 'complexe', need: 25, progress: 0, spoilPerNight: '3d10' } } } });
    expect(driveDayCaptureExtermination()).toBe(-1);
  });

  it('l’événement de bord FORCÉ pose la difficulté COMPLEXE de la donnée (jamais Intermédiaire en dur)', () => {
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0])!;
    set({ travelPlan: { ...plan, sea: { ...plan.sea!, forcedEventId: 'infestation-de-rats-geants' } } });
    runSeaDay(get, set);
    expect(get().travelPlan!.sea!.infestation?.difficulty).toBe('complexe');
  });

  it('3d10 : un total NON multiple de 3 (ex. 4/7/11) est ATTEIGNABLE — 1d10×3 en interdirait 20/28', () => {
    const vessel0 = get().vessel!;
    const seen = new Set<number>();
    for (let seed = 1; seed <= 60; seed++) {
      freshState();
      set({ vessel: { ...vessel0, cargo: [{ cargoId: 'bois', enc: 999, basePriceGold: 1 }] } });
      const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0])!;
      set({ travelPlan: { ...plan, sea: { ...plan.sea!, infestation: { label: 'Rats', difficulty: 'complexe', need: 25, progress: 0, spoilPerNight: '3d10' } } } });
      const before = get().vessel!.cargo!.reduce((n, l) => n + l.enc, 0);
      seedBattleRng(seed);
      continueSeaDayAfterCascade(get, set);
      const after = get().vessel!.cargo!.reduce((n, l) => n + l.enc, 0);
      const spoiled = before - after;
      if (spoiled > 0) seen.add(spoiled);
    }
    expect([...seen].some((v) => v % 3 !== 0)).toBe(true);
  });
});

describe('Phare du port d’arrivée — Test de Perception VISUEL (MDG 13 l.337) : la Surdité ne pénalise pas', () => {
  const lighthouseMap: WorldMap = {
    id: 'm2', label: 'Mer des Griffes',
    places: [
      { id: 'A', label: 'Salzenmund', pos: { x: 0, y: 0 }, scene: 'port-a' },
      { id: 'B', label: 'Erengrad', pos: { x: 10, y: 0 }, scene: 'port-b', port: { taille: 3, richesse: 3, production: [], lighthouse: true } as never },
    ],
    routes: [{ id: 'r1', a: 'A', b: 'B', km: 1, modes: ['mer'], sea: true, seaHeading: 'est' }],
  };

  function freshLighthouseState() {
    seedBattleRng(1);
    const [a, b] = makePregens();
    const vigie = { ...a, skills: [{ id: 'perception', characteristic: 'initiative', advances: 0 }], traumas: [traumaById('surdite', undefined, 'tete')] };
    const timonier = { ...b, skills: [{ id: 'voile', spec: 'cogue', characteristic: 'dexterite', advances: 30 }], traumas: [] };
    useGame.setState({
      party: [vigie, timonier],
      scene: { ...emptyScene(2, 2), id: 'port-a', label: 'Port', layers: [{ z: 0, tiles: ['sol', 'sol', 'sol', 'sol'] }] },
      battle: null,
      worldMap: lighthouseMap,
      travelPlan: null,
      travelRecap: null,
      pendingCrewTest: null,
      pendingRest: null,
      pendingCascade: null,
      suspendedCascades: [],
      gameTime: 8 * 60,
      lastUpkeepDay: 0,
      vessel: { vehicleId: 'cogue', morale: { score: 75, lastMoraleWeek: 0, factors: [] } },
      journal: [],
    } as never);
  }

  it('la Vigie SOURDE n’est PAS pénalisée au Test de Perception du phare (sense "vue" posé par kind "phare")', () => {
    freshLighthouseState();
    useGame.getState().startTravel('r1', 'mer', { cadence: 'jour-par-jour' });
    let phare: CascadeStep | undefined;
    let progression: CascadeStep | undefined;
    for (let i = 0; i < 30 && !phare; i++) {
      const p = useGame.getState().pendingCascade;
      if (!p) break;
      const cur = p.participants[p.cursor];
      if (cur?.kind === 'phare') { phare = cur; break; }
      if (cur?.kind === 'progression') progression = cur;
      // Le choix de Progression (MDG 14 l.63) se répond par défaut — voie d'équipage.
      if (cur?.options && !cur.chosen) useGame.getState().cascadeChoose(cur.id, cur.defaultChoice ?? cur.options[0].key);
      else if (cur?.participants) { for (const part of cur.participants) if (!part.result) useGame.getState().cascadeBatchRoll(part.id); }
      else if (cur && !cur.result) useGame.getState().cascadeRoll(cur.id);
      useGame.getState().cascadeNext();
    }
    expect(phare).toBeTruthy(); // l'étape du phare a bien été atteinte (port à phare, km 1 → dans la portée dès le jour 1)
    // Dé-navalisation (#328) : `sense`/`roleId` ne sont plus des champs du participant GÉNÉRIQUE —
    // l'effet du sens « vue » est BAKÉ dans la présentation `base` À LA CONSTRUCTION (`crewRoleValue`,
    // kind 'phare' = Perception visuelle). On l'OBSERVE : la base de la Vigie SOURDE au phare = sa
    // valeur de Perception avec sens « vue » (non pénalisée), non la valeur sans sens (pénalisée).
    const vigie = useGame.getState().party.find((h) => h.traumas?.some((t) => t.traumaId === 'surdite'))!;
    const vigieRole = findCrewRoleById('vigie')!;
    const vigiePart = phare!.participants!.find((x) => x.id === vigie.id);
    expect(vigiePart).toBeTruthy();
    expect(vigiePart!.base).toBe(crewRoleValue(vigie, vigieRole, navigationDuNavire(useGame.getState, useGame.getState().travelPlan!.vehicle!), 'vue').value);
    // Autre étape (Progression, sans sens narratif dédié) : base résolue SANS sens — comportement historique.
    expect(progression).toBeTruthy();
    for (const part of progression!.participants!) expect(typeof part.base).toBe('number');
  });
});

describe('registre cascadeAppliers — les 10 Tests d’équipage de VOYAGE (#275 Ronde 2 cran 3 — PILOTE RÉEL)', () => {
  beforeEach(freshState);

  function planWithSea() {
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0])!;
    set({ travelPlan: plan });
    return plan;
  }

  /** Étape À PARTICIPANTS déjà agrégée (`commitStep`/`aggregateBatchStep`, #275 Décision 4 cran 1) —
   *  `result.sl` = total agrégé, `result.success` = total ≥ 1 (MDG 14 l.13). */
  function step(kind: string, sl: number, success = sl >= 1): CascadeStep {
    return { id: kind, kind, label: fixtureText(kind), result: { roll: 0, target: 0, sl, success }};
  }

  const apply = (kind: string, sl: number, success = sl >= 1) =>
    cascadeAppliers[kind].apply(get, set, step(kind, sl, success), undefined, { steps: [], index: 0 });

  it('entretien : réussite (total −2 ≥ 1) → réparation temporaire 1d10 Blessures, PERSISTÉE (#30 ; MDG 14 l.122 + ch.13 l.647)', () => {
    const plan = planWithSea();
    plan.vehicle!.wounds.current = 30; // coque endommagée (max 50 : cogue)
    apply('entretien', 5); // +5 → +3 après −2 → réussite
    const cur = get().vessel!.wounds!.current;
    expect(cur).toBeGreaterThan(30);
    expect(cur).toBeLessThanOrEqual(40); // +1d10 max
    apply('entretien', 2); // 2 − 2 = 0 → échec (« 1 DR ou plus », MDG 14 l.13)
    expect(get().vessel!.wounds!.current).toBe(cur);
  });

  it('orientation : dérive majeure (DR ≤ −5) → Changement de cap (retard % sur la distance restante), km jamais réduit', () => {
    const plan = planWithSea();
    set({ travelPlan: { ...plan, kmDone: 100 } });
    const before = get().travelPlan!.km;
    apply('orientation', -6, false);
    expect(get().travelPlan!.km).toBeGreaterThanOrEqual(before);
  });

  it('affaler : échec → Critique au Gréement PERSISTÉ (`vessel.criticals`)', () => {
    planWithSea();
    apply('affaler', -3, false);
    expect(get().vessel!.criticals?.length ?? 0).toBeGreaterThan(0);
  });

  it('affaler : réussite → aucun Critique, conséquence composée (#295 Lot 1)', () => {
    planWithSea();
    const out = apply('affaler', 3, true);
    expect(resultLine(out?.consequences ?? [])).toContain('affalées à temps');
    expect(get().vessel!.criticals?.length ?? 0).toBe(0);
  });

  it('phare : réussite → bonus d’Orientation posé (Savoir Océans/manuel, ch.13 l.335)', () => {
    planWithSea();
    apply('phare', 1, true);
    expect(get().travelPlan!.sea!.lighthouseDR).toBeGreaterThanOrEqual(0);
  });

  it('phare : échec → aucun bonus posé', () => {
    planWithSea();
    apply('phare', -1, false);
    expect(get().travelPlan!.sea!.lighthouseDR).toBe(0);
  });

  it('extermination : progression cumulée jusqu’à extermination complète (MDG 14 l.98-104)', () => {
    const plan = planWithSea();
    set({ travelPlan: { ...plan, sea: { ...plan.sea!, infestation: { label: 'Rats', difficulty: 'intermediaire', need: 5, progress: 0, spoilPerNight: '1d10' } } } });
    apply('extermination', 5, true);
    expect(get().travelPlan!.sea!.infestation).toBeUndefined();
  });

  it('voyage-rapide : calcule ET applique le palier (Rude épreuve, l.28)', () => {
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0])!;
    set({ travelPlan: { ...plan, sea: { ...plan.sea!, fast: { days: 3, weeks: 0 } } } });
    apply('voyage-rapide', 2, true);
    // `finalizeFastVoyage` a tourné : `pendingFinalize` retombe à false (ou le plan a été purgé à l'accostage).
    expect(get().travelPlan?.sea?.fast?.pendingFinalize).toBeFalsy();
  });

  it('poursuite : gain de Distance mute la crise EN PLACE (ni échappé, ni rattrapé)', () => {
    const plan = planWithSea();
    set({ travelPlan: { ...plan, sea: { ...plan.sea!, crisis: { kind: 'poursuite', label: 'Écumeur', distance: 0, escapeAt: 100, foeM: 3, foeSkill: 10, desc: '' } } } });
    apply('poursuite', 10, true);
    expect(get().travelPlan!.sea!.crisis).toBeTruthy();
  });

  it('tourbillon : chaque manche endommage la coque (IC − Endurance/10) et cumule l’évasion', () => {
    const plan = planWithSea();
    plan.vehicle!.wounds.current = plan.vehicle!.wounds.max;
    set({ travelPlan: { ...plan, sea: { ...plan.sea!, crisis: { kind: 'tourbillon', whirlpoolId: 'maelstrom', need: 999, progress: 0, label: 'Maelström' } } } });
    const before = plan.vehicle!.wounds.current;
    apply('tourbillon', 3, true);
    expect(get().travelPlan!.vehicle!.wounds.current).toBeLessThanOrEqual(before); // Dégâts de collision (peuvent être nuls si BE couvre)
    expect(get().travelPlan!.sea!.crisis).toBeTruthy(); // `need` 999 : le total agrégé ne peut pas l'atteindre en une manche
  });

  it('embuscade : succès → préparés (pas de Surprise) — conséquence composée (#295 Lot 1)', () => {
    planWithSea();
    const out = apply('embuscade', 1, true);
    expect(resultLine(out?.consequences ?? [])).toContain('prépare');
  });

  it('progression : applique les milles du jour PUIS insère le reste de la journée (Décision 2, cran 3)', () => {
    planWithSea();
    const out = apply('progression', 2, true);
    expect(get().travelPlan!.sea!.milesToday).toBeGreaterThan(0);
    // Orientation (toujours jouée) fait partie de l'insert post-progression.
    expect(out?.insert?.some((s) => s.kind === 'orientation')).toBe(true);
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
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0], { cadence: 'jour-par-jour' })!;
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
      { id: 'A', label: 'Salzenmund', pos: { x: 0, y: 0 }, scene: 'port-a' },
      { id: 'B', label: 'Erengrad', pos: { x: 10, y: 0 }, scene: 'port-b', port: { taille: 3, richesse: 3, production: ['bois'] } },
    ],
    routes: [{ id: 'r1', a: 'A', b: 'B', km: 550, modes: ['mer'], sea: true, seaHeading: 'est', ambush: { scene: 'ls-abordage', encounter: 'enc-abordage', at: 0.5 } }],
  };

  function portScene(id: string, nom: string): Scene {
    const s = emptyScene(2, 2); s.id = id; s.label = nom; return s;
  }
  function abordageScene(): Scene {
    const s = emptyScene(10, 10); s.id = 'ls-abordage'; s.label = 'Abordage';
    const enc = buildEncounter({ id: 'enc-abordage', enemies: [{ statblock: { type: 'statblock', label: 'Écumeur', char: { 'capacite-de-combat': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, B: 8 } }, pos: { x: 5, y: 5 } }] });
    s.entities.push(...enc.entities); s.encounters = [enc.encounter];
    return s;
  }
  function freshAmbush(worldMap: WorldMap = abordageMap) {
    seedBattleRng(1); // RNG semé : le jour joué directement à l'étape 'embuscade' ne tire AUCUN événement de bord
    useGame.setState({
      party: makePregens().slice(0, 3), battle: null, travelPlan: null, travelRecap: null,
      pendingCrewTest: null, pendingRest: null, pendingCascade: null, suspendedCascades: [], gameTime: 8 * 60, lastUpkeepDay: 0,
      vessel: { vehicleId: 'cogue', morale: { score: 75, lastMoraleWeek: 0, factors: [] } }, journal: [],
    } as never);
    useGame.getState().loadProject([portScene('port-a', 'Port A'), portScene('port-b', 'Port B'), abordageScene()], 'port-a', worldMap);
    useGame.setState({ vessel: { vehicleId: 'cogue', morale: { score: 75, lastMoraleWeek: 0, factors: [] } } } as never); // startScene remet le vessel de campagne — repose-le
  }

  it('franchissement de l’ancrage (kmDone ≥ at × km) → Test de Perception PUIS abordage, une seule fois — la cascade-jour SURVIT au combat (#284/#275)', () => {
    freshAmbush();
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', abordageMap.routes[0], { cadence: 'jour-par-jour' })!;
    // Ancrage = 0.5 × 550 = 275 milles. On force `sea.crisis`-like via une progression déjà proche de l'ancrage :
    // kmDone 270, une progression du jour d'~20 milles franchit l'ancrage (290 ≥ 275).
    set({ travelPlan: { ...plan, kmDone: 270 } } as never);
    runSeaDay(get, set);
    // Déroule la cascade jusqu'à l'étape 'embuscade'.
    let guard = 0;
    while (get().pendingCascade && get().pendingCascade!.participants[get().pendingCascade!.cursor]?.kind !== 'embuscade' && guard++ < 30) stepCascade();
    const casc = get().pendingCascade;
    expect(casc).toBeTruthy();
    const embuscadeStep = casc!.participants[casc!.cursor];
    expect(embuscadeStep?.kind).toBe('embuscade'); // Test de Perception influençable (patron terrestre « Attaqués ! »)
    stepCascade(); // valide l'étape 'embuscade' → ouvre l'abordage (startCombat)
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
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', abordageMap.routes[0], { cadence: 'jour-par-jour' })!;
    set({ travelPlan: { ...plan, kmDone: 270 } } as never);
    runSeaDay(get, set);
    let guard = 0;
    while (get().pendingCascade && get().pendingCascade!.participants[get().pendingCascade!.cursor]?.kind !== 'embuscade' && guard++ < 30) stepCascade();
    stepCascade(); // valide 'embuscade' → ouvre l'abordage (startCombat), suspend la cascade-jour
    expect(get().battle).toBeTruthy();
    expect(get().suspendedCascades.length).toBe(1);

    // Victoire du combat (raccourci de test — la résolution d'attaque RÉELLE est couverte ailleurs) :
    // l'ennemi tombe, `checkBattleOver` pose `over:'victory'` + `pendingVictory`.
    const battle = get().battle!;
    for (const c of battle.combatants) if (c.kind === 'enemy') c.dead = true;
    set({ battle: { ...battle } });
    checkBattleOver(get, set);
    expect(get().pendingVictory).toBeTruthy();
    expect(get().battle?.over).toBe('victory');
    // AVANT « Continuer » : la cascade-jour reste SUSPENDUE — l'écran de victoire passe devant.
    expect(get().pendingCascade).toBeNull();
    expect(get().suspendedCascades.length).toBe(1);

    get().dismissVictory();
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
    expect(joues.map((x) => x.kind)).toEqual(expect.arrayContaining(['progression', 'embuscade']));
    const progression = joues.find((x) => x.kind === 'progression')!;

    const battle = get().battle!;
    for (const c of battle.combatants) if (c.kind === 'enemy') c.dead = true;
    set({ battle: { ...battle } });
    checkBattleOver(get, set);
    get().dismissVictory();

    expect(get().pendingCascade, 'la reprise après la victoire a rouvert une fenêtre').toBeNull();
    expect(get().suspendedCascades).toEqual([]);
    expect(get().travelPlan!.sea!.daysAtSea, 'la clôture du jour ne s’est pas jouée une fois').toBe(1);
    expect(get().travelPlan!.log, 'la clôture du jour ne s’est pas jouée une fois').toHaveLength(1);
    const ids = get().pendingRest!.travelDay!.entries!.map((e) => e.id ?? '');
    expect(ids.filter((i) => i.startsWith('sea-progression')), 'les dés résolus avant l’embuscade manquent au PV').toHaveLength(progression.participants!.length);
    expect(ids.some((i) => i.startsWith('sea-orientation')), 'le reste du jour ne s’est pas joué').toBe(true);
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
      if (casc.participants[casc.cursor]?.kind === 'embuscade') break;
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
    get().startTravel('r1', 'mer');
    // On déroule la 1ʳᵉ journée jusqu’à la halte : le péril d’auteur DOIT avoir été lu (journal).
    for (let i = 0; i < 30 && !get().pendingRest; i++) {
      if (!get().pendingCascade) break;
      stepCascade();
    }
    expect(get().journal.some((l) => l.includes('Péripétie : Récif affleurant'))).toBe(true);
  });

  it('un péril d’auteur `startCombat` INTERROMPT la traversée (comme l’embuscade)', () => {
    const krakenScene = emptyScene(10, 10); krakenScene.id = 'port-a'; krakenScene.label = 'Mer';
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
    expect(cur?.kind).toBe('voyage-rapide');
    stepCascade(); // valide → `computeFastPalier` + `finalizeFastVoyage` (calcule ET applique dans le même geste)
  }

  it('appareille en UN Test, franchit les jours et accoste (pendingShoreLeave) sans dérouler la boucle jour par jour', () => {
    set({ vessel: { ...get().vessel!, waterLitres: 1000 } });
    const t0 = get().gameTime;
    get().startTravel('r1', 'mer', { fast: true });
    driveFast();
    expect(get().travelPlan).toBeNull(); // arrivée
    expect(get().pendingShoreLeave).toBeTruthy(); // événement de port (port B a un profil)
    expect(get().vessel!.lastVoyageMilles).toBe(550);
    // 550 milles / (18×5) = ~7 jours → l’horloge a franchi ~7 jours (couture unique advanceTime).
    expect(get().gameTime - t0).toBe(7 * 24 * 60);
    expect(get().vessel!.waterLitres).toBeLessThan(1000); // eau des tonneaux consommée (comme le détaillé)
  });

  // Manann élevé → palier de voyage rapide BÉNIN (aucune perte d’équipage) : la population de consommation
  // reste l’effectif nominal, sans bruit d’un crewLost aléatoire du palier.
  const benign = { manann: { score: 1000, applied: [] } };

  it('#245 — l’eau se consomme sur TOUTE la population (3 héros + 15 PNJ de la cogue) sur 7 jours', () => {
    set({ vessel: { ...get().vessel!, ...benign, waterLitres: 1000 } }); // party = 3 héros, cogue = 15 PNJ nominaux → 18 âmes
    get().startTravel('r1', 'mer', { fast: true });
    driveFast();
    // 18 âmes × 3 L (médiane) × 7 jours = 378 L.
    expect(get().vessel!.waterLitres).toBe(1000 - 18 * 3 * 7);
  });

  it('#245 — l’effectif nominal perdu (crewLost) réduit la population qui consomme', () => {
    set({ vessel: { ...get().vessel!, ...benign, waterLitres: 1000, crewLost: 10 } }); // 15 − 10 = 5 PNJ → 3 + 5 = 8 âmes
    get().startTravel('r1', 'mer', { fast: true });
    driveFast();
    expect(get().vessel!.waterLitres).toBe(1000 - 8 * 3 * 7);
  });

  it('#245 — l’équipage mange les vivres de cale ; à court → facteur de Moral « nourriture-insuffisante »', () => {
    // 15 PNJ × 7 jours = 105 rations requises. Vivres de cale 50 < 105 → disette.
    set({ vessel: { ...get().vessel!, ...benign, waterLitres: 1000, provisions: 50 } });
    get().startTravel('r1', 'mer', { fast: true });
    driveFast();
    const v = get().vessel!;
    expect(v.provisions).toBe(0); // épuisés
    expect(v.morale.factors).toContain('nourriture-insuffisante'); // pèsera au recalcul hebdomadaire (MDG 14 l.171)
  });

  it('#245 — vivres de cale suffisants → aucun facteur de disette, stock décrémenté', () => {
    set({ vessel: { ...get().vessel!, ...benign, waterLitres: 1000, provisions: 200, morale: { score: 75, lastMoraleWeek: 0, factors: ['nourriture-insuffisante'] } } });
    get().startTravel('r1', 'mer', { fast: true });
    driveFast();
    const v = get().vessel!;
    expect(v.provisions).toBe(200 - 15 * 7); // 105 consommés
    expect(v.morale.factors).not.toContain('nourriture-insuffisante'); // réapprovisionné → facteur retiré
  });

  it('palier DÉSASTREUX (Humeur de Manann effondrée) : équipage manquant, cargaison perdue, coque meurtrie, 3 Critiques', () => {
    set({ vessel: {
      ...get().vessel!, manann: { score: -1000, applied: [] }, // dizaine −100 → résultat ≤ 0 quel que soit le d10/DR
      wounds: { current: 50, max: 50 }, cargo: [{ cargoId: 'bois', enc: 100, basePriceGold: 1 }], criticals: [],
    } });
    get().startTravel('r1', 'mer', { fast: true });
    driveFast();
    const v = get().vessel!;
    expect(v.crewLost).toBe(8); // 50 % de 15 PNJ (round 7,5) — couture partagée applyVesselCrewLoss
    expect(v.cargo![0].enc).toBe(25); // −75 % (floor 100×0,25)
    expect(v.wounds!.current).toBe(12); // 50 − round(50×0,75)=38
    expect(v.criticals!.length).toBe(3); // 3 Coups Critiques (l.33)
  });

  it('palier PARFAIT (Humeur de Manann au zénith) : aucune conséquence négative', () => {
    set({ vessel: {
      ...get().vessel!, manann: { score: 1000, applied: [] }, // dizaine +100 → résultat ≥ 10 → Voyage parfait
      wounds: { current: 50, max: 50 }, cargo: [{ cargoId: 'bois', enc: 100, basePriceGold: 1 }], criticals: [],
    } });
    get().startTravel('r1', 'mer', { fast: true });
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
      { id: 'A', label: 'Salzenmund', pos: { x: 0, y: 0 }, scene: 'port-a' },
      { id: 'B', label: 'Erengrad', pos: { x: 10, y: 0 }, scene: 'port-b', port: { taille: 3, richesse: 3, production: ['bois'] } },
    ],
    routes: [{ id: 'r1', a: 'A', b: 'B', km: 550, modes: ['mer'], sea: true, seaHeading: 'est', ambush: { scene: 'ls-abordage', encounter: 'enc-abordage', at: 0.5 } }],
  };
  function portScene(id: string, nom: string): Scene { const s = emptyScene(2, 2); s.id = id; s.label = nom; return s; }
  function abordageScene(): Scene {
    const s = emptyScene(10, 10); s.id = 'ls-abordage'; s.label = 'Abordage';
    const enc = buildEncounter({ id: 'enc-abordage', enemies: [{ statblock: { type: 'statblock', label: 'Écumeur', char: { 'capacite-de-combat': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, B: 8 } }, pos: { x: 5, y: 5 } }] });
    s.entities.push(...enc.entities); s.encounters = [enc.encounter];
    return s;
  }
  beforeEach(() => {
    seedBattleRng(1);
    useGame.setState({
      party: makePregens().slice(0, 3), battle: null, travelPlan: null, travelRecap: null,
      pendingCrewTest: null, pendingRest: null, pendingCascade: null, suspendedCascades: [], gameTime: 8 * 60, lastUpkeepDay: 0,
      vessel: { vehicleId: 'cogue', morale: { score: 75, lastMoraleWeek: 0, factors: [] } }, journal: [],
    } as never);
    useGame.getState().loadProject([portScene('port-a', 'Port A'), portScene('port-b', 'Port B'), abordageScene()], 'port-a', abordageMap);
    useGame.setState({ vessel: { vehicleId: 'cogue', morale: { score: 75, lastMoraleWeek: 0, factors: [] } } } as never);
  });

  it('l’abordage ancré INTERROMPT le voyage rapide (cascade `purpose:test` suspendue) ; après le combat, la traversée se finit en rapide', () => {
    get().startTravel('r1', 'mer', { fast: true });
    const p = get().pendingCascade!;
    expect(p.participants[p.cursor]?.kind).toBe('voyage-rapide');
    stepCascade(); // valide → computeFastPalier + finalizeFastVoyage → embuscade ancrée → startCombat
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
    get().resumeTravel();
    expect(get().travelPlan).toBeNull(); // accosté
    expect(get().pendingShoreLeave).toBeTruthy();
    // Post-combat : la narration du palier part ENFIN, avec son application (même geste).
    expect(get().journal.some((l) => l.startsWith('Voyage rapide —'))).toBe(true);
  });
});

describe('Cogue pirate (#327 A5.3) — l’événement navire-hostile PRÉSENTE les 3 choix (couture RÉELLE, re-recette)', () => {
  beforeEach(freshState);

  /** Force l’événement de bord `navire-hostile` (Langskip / Cogue pirate) au jour courant et déroule la
   *  résolution RÉELLE du jour (`runSeaDay` → `resolveSeaDayEvent` → `openPirateHail`) — PAS un step
   *  fabriqué : on vérifie que la COUTURE présente bien la cascade de choix (le lot D ne testait que les
   *  appliers, sur un step monté à la main → il passait alors que le joueur ne voyait rien). */
  function forceHail() {
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0])!;
    set({ travelPlan: { ...plan, sea: { ...plan.sea!, forcedEventId: 'navire-hostile' } } });
    runSeaDay(get, set);
  }

  it('runSeaDay ouvre la cascade de CHOIX (fuir/combattre/soumettre) — AUCUNE auto-résolution silencieuse', () => {
    forceHail();
    const p = get().pendingCascade;
    expect(p).toBeTruthy();
    const cur = p!.participants[p!.cursor];
    expect(cur.kind).toBe('sea-pirate-hail');
    expect(cur.options?.map((o) => o.key)).toEqual(['fuir', 'combattre', 'soumettre']); // les 3 choix présentés
    // Rien de tranché AVANT le choix : ni fuite (Poursuite), ni pillage — le joueur décide.
    expect(get().travelPlan!.sea!.crisis).toBeFalsy();
    expect(get().journal.some((l) => l.includes('prend la fuite'))).toBe(false);
  });

  it('branche PRÉSENTÉE « fuir » (défaut) → Poursuite (mute la crise, aucune perte silencieuse)', () => {
    forceHail();
    const cur = get().pendingCascade!.participants[get().pendingCascade!.cursor];
    get().cascadeChoose(cur.id, 'fuir');
    get().cascadeNext();
    expect(get().travelPlan!.sea!.crisis?.kind).toBe('poursuite');
  });

  it('après « fuir », la conduite du jour REPREND SYNCHRONEMENT (couture `dispatchCascadeDone`, pas de `setTimeout`) → la manche de Poursuite finit par surfacer (#383)', () => {
    forceHail();
    const cur = get().pendingCascade!.participants[get().pendingCascade!.cursor];
    get().cascadeChoose(cur.id, 'fuir');
    get().cascadeNext(); // ferme la cascade de choix → dispatchCascadeDone (purpose 'test' + mer) relance runSeaDay
    // Pas de soft-lock : le jour a redémarré SANS attendre un macrotask (la crise reste posée).
    expect(get().travelPlan!.sea!.crisis?.kind).toBe('poursuite');
    expect(get().pendingCascade?.purpose).toBe('travelDay');
    // La Progression du jour ouvre ; sa résolution INSÈRE la manche de Poursuite (buildPostProgressionSteps).
    for (let i = 0; i < 6 && !get().pendingCascade?.participants.some((s) => s.kind === 'poursuite'); i++) stepCascade();
    expect(get().pendingCascade?.participants.some((s) => s.kind === 'poursuite')).toBe(true);
  });

  it('équipage SANS compétence navale : la manche de Poursuite se JOUE quand même (plancher de Manque de bras, MDG 14 l.55), jamais droppée en silence (#383)', () => {
    set({ party: makePregens().slice(0, 3).map((h) => ({ ...h, skills: [] })) } as never);
    forceHail();
    const cur = get().pendingCascade!.participants[get().pendingCascade!.cursor];
    get().cascadeChoose(cur.id, 'fuir');
    get().cascadeNext(); // → runSeaDay : aucun PJ apte = sous l'effectif minimal → crise résolue au plancher (−2 DR, MDG 14 l.55), pas de lock
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
    set({ vessel: { ...get().vessel!, cargo: [{ cargoId: 'vin', enc: 30, basePriceGold: 2 }] } } as never);
    forceHail();
    const cur = get().pendingCascade!.participants[get().pendingCascade!.cursor];
    get().cascadeChoose(cur.id, 'soumettre');
    get().cascadeNext();
    expect(get().vessel!.cargo!.reduce((n, l) => n + l.enc, 0)).toBe(0); // cale vidée (piratePillagePct 100 %)
    const p2 = get().pendingCascade;
    expect(p2?.participants.some((s) => s.kind === 'sea-pirate-tribute')).toBe(true); // choix du tribut offert
  });
});

/** Joue la journée étape par étape JUSQU'À la validation de l'étape d'événement de bord (incluse) : le
 *  `RecapEvent` du jour vit dans `sea.events` tant que le jour n'est pas CLOS (la clôture le déplace
 *  dans `travelPlan.log`, cf. le bloc « Clôture du jour de mer » ci-dessous). */
function jusquApresEvenementDeBord(max = 40): void {
  for (let i = 0; i < max && get().pendingCascade; i++) {
    const joue = get().pendingCascade!.participants[get().pendingCascade!.cursor];
    avanceEtapeCascade(get);
    if (joue?.kind === 'seaBoardEvent') return;
  }
}

describe('Événement de bord RACONTÉ → carte-parchemin (#371 LOT 4, non couvert avant #383)', () => {
  beforeEach(freshState);

  it('un événement de bord FORCÉ (couture réelle `forcedEventId` + `runSeaDay`) pousse un `RecapEvent` {title,text} VERBATIM (source `sea-events.json`, sans tirage — recette #332)', () => {
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0], { cadence: 'jour-par-jour' })!;
    set({ travelPlan: { ...plan, sea: { ...plan.sea!, forcedEventId: 'calme-plat' } } });
    runSeaDay(get, set);
    const events = get().travelPlan!.sea!.events ?? [];
    expect(events).toHaveLength(1);
    const def = seaBoardEventById('calme-plat')!;
    expect(events[0]).toEqual({ title: def.label, text: def.desc, roll: undefined }); // forcé → pas de tirage (recapLine.ts)
  });

  /** CONTRAT (#1426) : l'événement de bord n'est plus résolu inline — c'est une ÉTAPE À TABLE du canal
   *  de cascade (`sea-board-event`, dé de MONDE). Le `RecapEvent` naît donc quand l'étape est DRAINÉE,
   *  pas à l'appel de `runSeaDay` : le test joue la journée comme un joueur (pilote partagé) au lieu de
   *  lire l'état à mi-course. */
  it('un tirage NATUREL (non forcé, `daysToEvent` échu) : l’étape à TABLE drainée capture le d100 dans le `RecapEvent` — label+texte SOURCÉS (`BOARD_EVENTS`, pas de copie en dur)', () => {
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0], { cadence: 'jour-par-jour' })!;
    set({ travelPlan: { ...plan, sea: { ...plan.sea!, daysToEvent: 1, forcedEventId: undefined } } });
    runSeaDay(get, set);
    const etape = get().pendingCascade!.participants.find((s) => s.kind === 'seaBoardEvent')!;
    expect(etape.worldOwner, 'dé de MONDE : aucun acteur ne le porte').toBe(true);
    // La table se JOUE dans sa fenêtre (le siège qui possède le monde lance) : elle naît non tirée.
    expect(etape.table!.result, 'le socle ne tire pas à la place de la fenêtre').toBeUndefined();
    jusquApresEvenementDeBord();
    const events = get().travelPlan!.sea!.events ?? [];
    expect(events).toHaveLength(1);
    const ev = events[0];
    expect(typeof ev.roll).toBe('number'); // tirage capturé (chemin non forcé)
    const def = BOARD_EVENTS.find((e) => e.label === ev.title && e.desc === ev.text);
    expect(def).toBeTruthy(); // titre + texte VERBATIM d'une entrée RÉELLE de sea-events.json
  });

  /** L'Humeur de Manann DÉCALE le d100 de l'événement (MDG 15 l.85) : elle est le `mod` de la table
   *  d'étape, versé par `liveTableDecl` au rang du tirage. */
  it('l’Humeur de Manann du navire est le `mod` de la table d’événement de bord', () => {
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0], { cadence: 'jour-par-jour' })!;
    set({ vessel: { ...get().vessel!, manann: { score: -40, applied: [] } } });
    set({ travelPlan: { ...plan, sea: { ...plan.sea!, daysToEvent: 1, forcedEventId: undefined } } });
    runSeaDay(get, set);
    jusquApresEvenementDeBord(); // la table se joue dans sa fenêtre : c'est le geste qui la tire
    const etape = get().pendingCascade!.participants.find((s) => s.kind === 'seaBoardEvent')!;
    expect(etape.table!.mod).toBe(-40);
    expect(etape.table!.result!.die).toBe(etape.table!.result!.roll - 40); // le dé EFFECTIF est décalé
  });

  /** La FOURCHETTE 48-80 de la table (`sea-events.json`) rend « Navigation ordinaire », l'entrée
   *  `kind:'rien'` — mesurée SUR LE FLUX réel, dé posé par la fenêtre. */
  it('dé posé à 60 (Humeur neutre) → l’entrée « Navigation ordinaire », et la journée ne raconte aucun incident', () => {
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0], { cadence: 'jour-par-jour' })!;
    set({ travelPlan: { ...plan, sea: { ...plan.sea!, daysToEvent: 1, forcedEventId: undefined } } });
    runSeaDay(get, set);
    const etape = get().pendingCascade!.participants.find((s) => s.kind === 'seaBoardEvent')!;
    expect(etape.table!.mod ?? 0, 'Humeur de Manann neutre : le dé posé est le dé effectif').toBe(0);
    get().cascadeTableSetForcedRoll(etape.id, 60);
    const tiree = get().pendingCascade!.participants.find((s) => s.kind === 'seaBoardEvent')!.table!.result!;
    expect(tiree.id).toBe('navigation-ordinaire');
    expect(seaBoardEventById(tiree.id)!.kind).toBe('rien');
  });

  /** LOT 3 (#1426) : UNE voix par événement, et elle est la CONSÉQUENCE de l'étape. Deux exigences que
   *  seule la conséquence satisfait ENSEMBLE : (a) le joueur ne lit qu'une ligne au journal, portant le
   *  texte VERBATIM de `sea-events.json` (la ligne de TABLE reste l'issue de la RANGÉE, elle ne se
   *  re-verse pas) ; (b) la rangée validée GARDE son `outcome`, donc reste dans la pile à l'écran
   *  (« on ne perd pas les conséquences », `CascadeModal`) — une étape à table dont l'applier raconte à
   *  côté et rend `{}` DISPARAÎT du bilan (`CascadeModal.rowOf` : ni `result` mono, ni `outcome`). */
  it('l’événement de bord ne s’écrit QU’UNE fois au journal, et la rangée validée GARDE sa conséquence', () => {
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0], { cadence: 'jour-par-jour' })!;
    set({ travelPlan: { ...plan, sea: { ...plan.sea!, daysToEvent: 1, forcedEventId: undefined } } });
    set({ journal: [] });
    runSeaDay(get, set);
    jusquApresEvenementDeBord(); // la table se joue dans sa fenêtre : c'est le geste qui la tire
    const etape = get().pendingCascade!.participants.find((s) => s.kind === 'seaBoardEvent')!;
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
    expect(portRepairVessel(get, set)[0]).toContain('bourse');
  });

  it('pose d’une Amélioration : coût par bande de Taille (MDG 12) — Nid-de-pie sur une cogue (25 m, Moyenne) = 5 CO', () => {
    creditBourse(get, set, get().party[0].id, { gold: 10, silver: 0, brass: 0 });
    const lines = portInstallUpgrade(get, set, 'nid-de-pie');
    expect(lines[0]).toContain('Nid-de-pie');
    expect(partyMoneyTotal(get).gold).toBe(5);
    expect(get().vessel!.upgrades).toEqual([{ id: 'nid-de-pie' }]);
    // Un Trait de CONSTRUCTION ne se pose pas après coup (ch.12 l.169).
    expect(portInstallUpgrade(get, set, 'renforce')[0]).toContain('Trait de construction');
  });
});

describe('Prêtre de Manann — CHOIX joueur, pas paiement automatique (#132, MDG 15 l.246)', () => {
  beforeEach(freshState);

  const seq = (...vals: number[]): RNG => {
    let i = 0;
    return { int: (min, max) => Math.min(max, Math.max(min, vals[i++ % vals.length])) };
  };

  // Humeur de Manann neutre (mod 0) + 2d10 = 1+1 = 2 → « Prêtre de Manann » (min 2 max 2, sea-events.json).
  // Puis 2d10 = 3+4 (heures, sans effet ici), puis 1d10 = 7 (coût en CO).
  function triggerPriest() {
    resolvePortArrival(get, set, undefined, seq(1, 1, 3, 4, 7));
  }

  it('ouvre un CHOIX (pendingManannPriest) au lieu de payer automatiquement', () => {
    creditBourse(get, set, get().party[0].id, { gold: 100, silver: 0, brass: 0 });
    triggerPriest();
    expect(get().pendingManannPriest).toEqual({ cost: { gold: 7, silver: 25, brass: 0 } }); // 1d10=7 CO + 25 m (cogue) en pistoles
    expect(partyMoneyTotal(get)).toEqual({ gold: 100, silver: 0, brass: 0 }); // pas débité tant que non résolu
    expect(get().vessel!.manann?.score ?? 0).toBe(0); // Humeur inchangée tant que non résolu
  });

  it('choix PAYER : débite le coût déjà tiré, Humeur INCHANGÉE', () => {
    const before = { gold: 100, silver: 0, brass: 0 };
    creditBourse(get, set, get().party[0].id, before);
    triggerPriest();
    const cost = get().pendingManannPriest!.cost;
    resolveManannPriest(get, set, true);
    expect(get().pendingManannPriest).toBeNull();
    expect(partyMoneyTotal(get)).toEqual(subtract(before, cost));
    expect(get().vessel!.manann?.score ?? 0).toBe(0);
  });

  it('choix REFUSER : Humeur de Manann réduite de 4d10, bourse INCHANGÉE', () => {
    const before = { gold: 100, silver: 0, brass: 0 };
    creditBourse(get, set, get().party[0].id, before);
    triggerPriest();
    seedBattleRng(7); // détermine le 4d10 de resolveManannPriest (battleRng interne)
    resolveManannPriest(get, set, false);
    expect(get().pendingManannPriest).toBeNull();
    expect(partyMoneyTotal(get)).toEqual(before); // pas débité
    const score = get().vessel!.manann!.score;
    expect(score).toBeLessThanOrEqual(-4); // 4d10 : 4 à 40
    expect(score).toBeGreaterThanOrEqual(-40);
  });

  it('choix PAYER avec bourse insuffisante : garde défensive — aucune mutation (l’UI désactive le bouton)', () => {
    // Bourse du groupe VIDE (aucun héros financé) → payFromGroup insolvable → garde défensive.
    triggerPriest();
    resolveManannPriest(get, set, true);
    expect(get().pendingManannPriest).toBeNull();
    expect(partyMoneyTotal(get)).toEqual({ gold: 0, silver: 0, brass: 0 });
    expect(get().vessel!.manann?.score ?? 0).toBe(0);
  });
});

describe('Port désert & Embrigadement — #150 (resolvePortArrival appelé APRÈS purge de travelPlan)', () => {
  beforeEach(freshState);

  const seq = (...vals: number[]): RNG => {
    let i = 0;
    return { int: (min, max) => Math.min(max, Math.max(min, vals[i++ % vals.length])) };
  };

  it('Port désert (min 5 max 5, sea-events.json) applique bien son delta d’Humeur — ship résolu depuis `vessel`, PAS `travelPlan` (déjà `null` ici, cf. accostage)', () => {
    expect(get().travelPlan).toBeNull(); // reproduit exactement le contexte du bug : plan déjà purgé
    // Humeur de Manann neutre (mod 0) : 2d10 = 2+3 = 5 → « Port désert ». Puis 2d10 = 1+1 (heures, sans
    // effet ici). Puis 1d10 = 6 → delta d'Humeur −6 (MDG 15 l.249 : « le Moral diminue d'1d10 »).
    resolvePortArrival(get, set, undefined, seq(2, 3, 1, 1, 6));
    expect(get().vessel!.morale.score).toBe(75 - 6);
    expect(get().journal.some((l) => l.includes('Moral de l’équipage') || l.includes("Moral de l'équipage"))).toBe(true);
  });

  it('Embrigadement (min 1 max 1) réduit l’effectif d’équipage de 2d10 (MDG 15 l.245)', () => {
    set({ vessel: { ...get().vessel!, manann: { score: -1, applied: [] } } }); // Humeur < 0 → mod −1 (nécessaire : min 1 est hors de portée à mod 0, cf. Prêtre de Manann ci-dessus)
    // roll = d10+d10 + mod(−1) = 1+1−1 = 1 → « Embrigadement ». Hours = 1+1 = 2 (sans effet ici).
    // lostCrew "2d10" = 3+4 = 7 marins perdus (cogue : effectif nominal 15, vehicles.json).
    resolvePortArrival(get, set, undefined, seq(1, 1, 1, 1, 3, 4));
    expect(get().vessel!.crewLost).toBe(7);
    expect(get().journal.some((l) => l.includes('Équipage'))).toBe(true);
  });

  it('Embrigadement : la perte est PLAFONNÉE au complément nominal du type (on ne peut pas perdre plus de marins qu’il n’y en a)', () => {
    set({ vessel: { ...get().vessel!, crewLost: 12, manann: { score: -1, applied: [] } } }); // déjà 12/15 perdus
    resolvePortArrival(get, set, undefined, seq(1, 1, 1, 1, 9, 9)); // lostCrew roulé à 18 → 12+18=30, plafonné à 15
    expect(get().vessel!.crewLost).toBe(15);
  });
});

describe('Relâche à terre — #185 (choix joueur AVANT événement de port, MDG 15 l.245 : « Si vous avez refusé la permission de faire relâche à terre à votre équipage, cet événement [Embrigadement] n\'a pas lieu »)', () => {
  beforeEach(freshState);

  const seq = (...vals: number[]): RNG => {
    let i = 0;
    return { int: (min, max) => Math.min(max, Math.max(min, vals[i++ % vals.length])) };
  };

  function moodMinus1() {
    set({ vessel: { ...get().vessel!, manann: { score: -1, applied: [] } } }); // mod −1 → roll min 1 atteignable (Embrigadement)
  }

  it('relâche REFUSÉE : Embrigadement (2d10 → 1) n\'a pas lieu — aucune perte d\'équipage, journal explicite', () => {
    moodMinus1();
    resolvePortArrival(get, set, undefined, seq(1, 1, 1, 1, 3, 4), false);
    expect(get().vessel!.crewLost ?? 0).toBe(0);
    expect(get().journal.some((l) => l.includes('n\'a pas lieu'))).toBe(true);
  });

  it('relâche ACCORDÉE (défaut) : Embrigadement se produit normalement (2d10 marins perdus)', () => {
    moodMinus1();
    resolvePortArrival(get, set, undefined, seq(1, 1, 1, 1, 3, 4), true);
    expect(get().vessel!.crewLost).toBe(7); // 3+4
  });

  it('relâche REFUSÉE : Fête de Manann (2d10 → 18) perd son bonus d\'Humeur (MDG 15 l.260)', () => {
    // Humeur neutre (mod 0) : 2d10 = 9+9 = 18 → « Fête de Manann » (min 18 max 18, sea-events.json).
    resolvePortArrival(get, set, undefined, seq(9, 9, 1, 1), false);
    expect(get().vessel!.manann?.score ?? 0).toBe(0);
    expect(get().journal.some((l) => l.includes('ne se joint pas aux festivités'))).toBe(true);
  });

  it('relâche ACCORDÉE : Fête de Manann applique bien son bonus d\'Humeur (2d10)', () => {
    resolvePortArrival(get, set, undefined, seq(9, 9, 1, 1, 5, 5), true);
    expect(get().vessel!.manann?.score ?? 0).toBe(10); // 5+5
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
    resolveShoreLeave(get, set, true);
    expect(get().pendingShoreLeave).toBeNull();
    draineCascade(get); // le dé de Désertion se joue dans SA fenêtre (siège du monde), puis la suite s'enchaîne
    expect(get().journal.some((l) => l.includes('Événement de port'))).toBe(true); // tiré APRÈS le choix
  });

  /**
   * #1426 — le dé de Désertion est un dé de MONDE : le siège qui POSSÈDE le monde (ici l'hôte solo,
   * `netOwnership.worldSeat`) le VOIT et le lance, comme le jet d'un héros. L'option de confort
   * « Dés fixés » n'entre pas dans cette surface : elle n'ajoute que la POSE du dé.
   */
  it('seam de jet — Désertion : SANS siège MJ, le siège du monde tient la fenêtre (la journée reprend quand il l\'a jouée)', () => {
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0])!;
    set({ travelPlan: { ...plan, kmDone: plan.km - 5, sea: { ...plan.sea!, milesToday: 5 } } });
    continueSeaDayAfterCascade(get, set);
    draineCascade(get); // Mal de mer du premier jour : sa bande se joue avant l'accostage (#1479)
    resolveShoreLeave(get, set, true);
    expect(get().pendingCascade, 'le siège local possède le monde : son dé se joue, il ne se tire pas en silence').toBeTruthy();
    expect(get().journal.some((l) => l.includes('Événement de port')), 'la suite attend le geste').toBe(false);
    draineCascade(get);
    expect(get().journal.some((l) => l.includes('Événement de port'))).toBe(true);
  });

  it('seam de jet (#275 Ronde 1, delta 1) — Désertion : AVEC siège MJ ≠ hôte, l\'étape SURFACE et est OWNÉE par le MJ', async () => {
    const { setGmSeat } = await import('./netFlow');
    setGmSeat(get, set, 1);
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0])!;
    // daysAtSea non-nul + mer calme : évite le mal de mer (#460, MDG 14 l.211-222 — 1er jour/mauvais
    // temps) de surfacer AVANT la Désertion, seule étape que ce test veut ici.
    set({ travelPlan: { ...plan, kmDone: plan.km - 5, sea: { ...plan.sea!, daysAtSea: 5, milesToday: 5, weather: { ...plan.sea!.weather, vent: 'calme-plat' } } } });
    continueSeaDayAfterCascade(get, set);
    resolveShoreLeave(get, set, true);
    expect(get().pendingCascade).toBeTruthy(); // 'V' — surfacé au siège MJ, pas résolu d'office
    expect(get().journal.some((l) => l.includes('Événement de port'))).toBe(false); // suspendu AVANT la suite
    const { modalOwnerOf } = await import('./modalArbiter');
    const { seatOwns } = await import('./netOwnership');
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
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0], { cadence: 'jour-par-jour' })!;
    set({ travelPlan: { ...plan, sea: { ...plan.sea!, daysAtSea: 29, milesToday: 50 } } });
    continueSeaDayAfterCascade(get, set);
    const casc = get().pendingCascade!;
    expect(casc.purpose).toBe('seaScorbut');
    const bande = casc.participants.find((st) => st.kind === 'sea-scorbut')!;
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

  it('Scorbut : AVEC siège MJ, l’étape SURFACE (V) — plus d’auto-résolution silencieuse ; la journée reprend après résolution', async () => {
    const { setGmSeat } = await import('./netFlow');
    setGmSeat(get, set, 1);
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0], { cadence: 'jour-par-jour' })!;
    set({ travelPlan: { ...plan, sea: { ...plan.sea!, daysAtSea: 29, milesToday: 50 } } });
    continueSeaDayAfterCascade(get, set);
    expect(get().pendingCascade).toBeTruthy();
    expect(get().pendingCascade!.purpose).toBe('seaScorbut');
    expect(get().pendingCascade!.participants.every((s) => s.kind === 'sea-scorbut')).toBe(true);
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
    const party = makePregens().slice(0, postes.length).map((h, i) => ({
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
      avanceEtapeCascade(get, opts.poser, (st) => (st.kind === 'sea-progression-choice' ? opts.voie : undefined));
    }
    const casc = get().pendingCascade;
    return casc?.purpose === 'seaExhaustion' ? casc.participants.find((st) => st.kind === 'sea-epuisement') : undefined;
  }

  /** Temps clément du jour en cours (setup : la météo du lendemain se tire à la clôture). */
  const tempsClement = { temperature: 'mediane', precipitations: 'aucune', vent: 'brise-fraiche' } as const;

  /** Joue UNE journée par `runSeaDay`, comme un joueur, jusqu'à la bande d'Épuisement ; `undefined` si
   *  la journée se clôt sans elle. */
  function bandeDuJour(opts: { pace?: number; poser?: PoseDe; voie?: 'nav' | 'crew'; sea?: Partial<SeaVoyageState>; cadence?: 'jour-par-jour' | 'commande' } = {}): CascadeStep | undefined {
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0], { cadence: opts.cadence ?? 'jour-par-jour', ...(opts.pace ? { pace: opts.pace } : {}) })!;
    set({ travelPlan: { ...plan, sea: { ...plan.sea!, daysAtSea: 1, daysToEvent: 99, ...opts.sea, weather: { ...plan.sea!.weather, ...tempsClement, ...opts.sea?.weather } } } });
    runSeaDay(get, set);
    return jusquaLaBande(opts);
  }

  /** Clôt la journée en cours, dort (le bouton Repos), et joue le LENDEMAIN jusqu'à sa bande. */
  function bandeDuLendemain(opts: { voie?: 'nav' | 'crew' } = {}): CascadeStep | undefined {
    draineCascade(get);
    const sea = get().travelPlan!.sea!;
    set({ travelPlan: { ...get().travelPlan!, sea: { ...sea, daysToEvent: 99, weather: { ...sea.weather, ...tempsClement } } } });
    get().restSleep();
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
    for (const [de, issue] of [[1, 'won'], [100, 'lost']] as const) {
      freshState();
      const [capitaine] = equipage(['capitaine', 'vigie', 'repos'], [0]);
      const bande = bandeDuJour({ pace: 1, poser: (etape) => (etape.kind === 'sea-force-pace' ? de : undefined) });
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

  it('avec siège MJ, la bande SURFACE et la journée reprend après résolution', async () => {
    const { setGmSeat } = await import('./netFlow');
    equipage(['timonier', 'mousse'], [0, 1]);
    setGmSeat(get, set, 1);
    expect(bandeDuJour(), 'la bande s’ouvre').toBeTruthy();
    draineCascade(get);
    expect(get().pendingRest).toBeTruthy();
  });
});

describe('Mal de mer — #460 (MDG 14 l.211-222, câblage jamais branché, cycle de maladie réutilisé)', () => {
  beforeEach(freshState);

  /** Bande du mal de mer : une rangée par porteur, chacune avec SON verdict. */
  const bandeMalDeMer = (rows: { id: string; success: boolean }[]): CascadeStep => ({
    id: 'x', kind: 'sea-mal-de-mer', label: fixtureText('x'), groupOwner: true,
    participants: rows.map((r) => ({ id: r.id, interactive: true, base: 40, target: 40, result: { roll: r.success ? 1 : 99, target: 40, sl: r.success ? 6 : -6, success: r.success } })),
  });

  it('applier `sea-mal-de-mer` : la rangée en échec contracte (malaise/nausée/persistant), pas sa voisine', () => {
    const [a, b] = get().party;
    a.diseases = [];
    b.diseases = [];
    cascadeAppliers['sea-mal-de-mer'].apply(get, set, bandeMalDeMer([{ id: a.id, success: false }, { id: b.id, success: true }]), a, { steps: [], index: 0 });
    const found = get().party.find((h) => h.id === a.id)!.diseases?.find((d) => d.id === 'mal-de-mer');
    expect(found).toBeTruthy();
    expect(found!.symptoms.map((s) => s.symptomId).sort()).toEqual(['malaise', 'nausee', 'persistant']);
    expect(get().party.find((h) => h.id === b.id)!.diseases ?? [], 'la réussite ne contracte rien').toHaveLength(0);
  });

  it('applier `sea-mal-de-mer` : bande TOUTE réussie → rien', () => {
    const [a, b] = get().party;
    a.diseases = [];
    b.diseases = [];
    cascadeAppliers['sea-mal-de-mer'].apply(get, set, bandeMalDeMer([{ id: a.id, success: true }, { id: b.id, success: true }]), a, { steps: [], index: 0 });
    expect(get().party.flatMap((h) => h.diseases ?? [])).toHaveLength(0);
  });

  it('1er jour de traversée (`daysAtSea === 0`) → UNE bande `sea-mal-de-mer`, une RANGÉE par PJ non-elfe', async () => {
    const { setGmSeat } = await import('./netFlow');
    setGmSeat(get, set, 1);
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0], { cadence: 'jour-par-jour' })!;
    set({ travelPlan: { ...plan, sea: { ...plan.sea!, daysAtSea: 0, weather: { ...plan.sea!.weather, vent: 'calme-plat' } } } });
    continueSeaDayAfterCascade(get, set);
    expect(get().pendingCascade).toBeTruthy();
    expect(get().pendingCascade!.purpose).toBe('seaScorbut'); // MÊME cascade « Entretien — Maladies » (#460)
    // UNE SITUATION = UNE FENÊTRE : un seul Test (MDG 14 l.217), donc UNE étape — les PJ appelés y
    // tiennent chacun leur rangée, jamais N modales pour le même jet.
    const bandes = get().pendingCascade!.participants.filter((s) => s.kind === 'sea-mal-de-mer');
    expect(bandes).toHaveLength(1);
    expect(bandes[0].participants!.map((r) => r.id)).toEqual(get().party.map((h) => h.id));
  });

  it('mauvais temps (Vent violent ou plus, l.218) → une bande `sea-mal-de-mer`, même hors 1er jour', async () => {
    const { setGmSeat } = await import('./netFlow');
    setGmSeat(get, set, 1);
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0], { cadence: 'jour-par-jour' })!;
    set({ travelPlan: { ...plan, sea: { ...plan.sea!, daysAtSea: 5, weather: { ...plan.sea!.weather, vent: 'vent-violent' } } } });
    continueSeaDayAfterCascade(get, set);
    expect(get().pendingCascade).toBeTruthy();
    const kinds = get().pendingCascade!.participants.map((s) => s.kind);
    expect(kinds).toContain('sea-mal-de-mer');
  });

  it('ni 1er jour ni mauvais temps → aucune étape `sea-mal-de-mer` (jour de routine)', async () => {
    const { setGmSeat } = await import('./netFlow');
    setGmSeat(get, set, 1);
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0])!;
    set({ travelPlan: { ...plan, sea: { ...plan.sea!, daysAtSea: 5, weather: { ...plan.sea!.weather, vent: 'calme-plat' } } } });
    continueSeaDayAfterCascade(get, set);
    expect(get().pendingCascade).toBeNull();
    expect(get().pendingRest).toBeTruthy();
  });

  it('Personnage elfe (`hauts-elfes`) IMMUNISÉ (l.215) : aucune étape posée, même au 1er jour + mauvais temps', async () => {
    const { setGmSeat } = await import('./netFlow');
    setGmSeat(get, set, 1);
    const party = get().party.map((h) => ({ ...h, species: 'hauts-elfes' }));
    set({ party });
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0])!;
    set({ travelPlan: { ...plan, sea: { ...plan.sea!, daysAtSea: 0, weather: { ...plan.sea!.weather, vent: 'vent-violent' } } } });
    continueSeaDayAfterCascade(get, set);
    // Aucune maladie déclenchée du tout ce jour (ni tonneau — pas d'eau suivie — ni scorbut) : routine.
    expect(get().pendingCascade).toBeNull();
    expect(get().pendingRest).toBeTruthy();
  });

  it('l’immunité suit le groupe `elfe` de l’espèce (`grantGroups`), pas son id : groupe retiré → testé', async () => {
    const { setGmSeat } = await import('./netFlow');
    setGmSeat(get, set, 1);
    setDataset('species', species.map((s) => (s.id === 'hauts-elfes' ? { ...s, grantGroups: s.grantGroups.filter((g) => g !== 'elfe') } : s)));
    set({ party: get().party.map((h) => ({ ...h, species: 'hauts-elfes' })) });
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0], { cadence: 'jour-par-jour' })!;
    set({ travelPlan: { ...plan, sea: { ...plan.sea!, daysAtSea: 0, weather: { ...plan.sea!.weather, vent: 'calme-plat' } } } });
    continueSeaDayAfterCascade(get, set);
    const bandes = get().pendingCascade?.participants.filter((s) => s.kind === 'sea-mal-de-mer') ?? [];
    resetData();
    expect(bandes).toHaveLength(1);
  });

  it('déjà immunisé (`diseaseImmunities`) → aucune étape reposée', async () => {
    const { setGmSeat } = await import('./netFlow');
    setGmSeat(get, set, 1);
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

  it('applier `sea-tonneau-contamine` : échec → `sea.waterContaminated` posé (visible dès demain)', () => {
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0])!;
    set({ travelPlan: plan });
    const hero = get().party[0];
    cascadeAppliers['sea-tonneau-contamine'].apply(get, set, { id: 'x', kind: 'sea-tonneau-contamine', label: fixtureText('x'), result: { roll: 99, target: 40, sl: -6, success: false }, meta: { diseaseId: 'flux-sanglant' } }, hero, { steps: [], index: 0 });
    expect(get().travelPlan!.sea!.waterContaminated).toEqual({ diseaseId: 'flux-sanglant' });
  });

  it('applier `sea-tonneau-contamine` : réussite → rien', () => {
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0])!;
    set({ travelPlan: plan });
    const hero = get().party[0];
    cascadeAppliers['sea-tonneau-contamine'].apply(get, set, { id: 'x', kind: 'sea-tonneau-contamine', label: fixtureText('x'), result: { roll: 1, target: 40, sl: 6, success: true }, meta: { diseaseId: 'flux-sanglant' } }, hero, { steps: [], index: 0 });
    expect(get().travelPlan!.sea!.waterContaminated).toBeUndefined();
  });

  it('applier `sea-tonneau-expose` : boire au tonneau contaminé, échec → contracté', () => {
    const hero = get().party[0];
    hero.diseases = [];
    cascadeAppliers['sea-tonneau-expose'].apply(get, set, { id: 'x', kind: 'sea-tonneau-expose', label: fixtureText('x'), result: { roll: 99, target: 20, sl: -8, success: false }, meta: { diseaseId: 'peste-noire' } }, hero, { steps: [], index: 0 });
    expect(get().party.find((h) => h.id === hero.id)!.diseases?.some((d) => d.id === 'peste-noire')).toBe(true);
  });

  it('applier `sea-tonneau-expose` : réussite → rien', () => {
    const hero = get().party[0];
    hero.diseases = [];
    cascadeAppliers['sea-tonneau-expose'].apply(get, set, { id: 'x', kind: 'sea-tonneau-expose', label: fixtureText('x'), result: { roll: 1, target: 20, sl: 8, success: true }, meta: { diseaseId: 'peste-noire' } }, hero, { steps: [], index: 0 });
    expect(get().party.find((h) => h.id === hero.id)!.diseases ?? []).toHaveLength(0);
  });

  it('porteur ACTIF de peste noire buvant à `vessel.waterLitres` → une étape `sea-tonneau-contamine`', async () => {
    const { setGmSeat } = await import('./netFlow');
    setGmSeat(get, set, 1);
    const party = [...get().party];
    party[0] = { ...party[0], diseases: [contractDisease('peste-noire', makeRNG(1), { incubation: 0 })!] };
    set({ party, vessel: { ...get().vessel!, waterLitres: 1000 } });
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0], { cadence: 'jour-par-jour' })!;
    set({ travelPlan: { ...plan, sea: { ...plan.sea!, daysAtSea: 5, weather: { ...plan.sea!.weather, vent: 'calme-plat' } } } });
    continueSeaDayAfterCascade(get, set);
    expect(get().pendingCascade).toBeTruthy();
    const step = get().pendingCascade!.participants.find((s) => s.kind === 'sea-tonneau-contamine');
    expect(step).toBeTruthy();
    expect(step!.actorId).toBe(party[0].id);
  });

  it('PARITÉ : les 4 maladies contaminant le tonneau le DÉCLARENT en donnée, et elles seules (MDG 14 l.209)', () => {
    // « Si un membre d'équipage souffrant de la peste noire, du flux sanglant, de la courante galopante
    // ou de la vérole urticante boit dans un tonneau d'eau… » — le flux ne nomme plus aucun id.
    const declares = maladies.filter((m) => m.contaminatesWaterBarrel).map((m) => m.id).sort();
    expect(declares).toEqual(['courante-galopante', 'flux-sanglant', 'peste-noire', 'verole-urticante']);
  });

  it('SANS tonneau d\'eau suivi (`vessel.waterLitres` absent) → aucune étape de tonneau, même avec un porteur actif', async () => {
    const { setGmSeat } = await import('./netFlow');
    setGmSeat(get, set, 1);
    const party = [...get().party];
    party[0] = { ...party[0], diseases: [contractDisease('peste-noire', makeRNG(1), { incubation: 0 })!] };
    set({ party }); // vessel.waterLitres reste undefined (freshState)
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0])!;
    set({ travelPlan: { ...plan, sea: { ...plan.sea!, daysAtSea: 5, weather: { ...plan.sea!.weather, vent: 'calme-plat' } } } });
    continueSeaDayAfterCascade(get, set);
    expect(get().pendingCascade).toBeNull();
    expect(get().pendingRest).toBeTruthy();
  });

  it('tonneau DÉJÀ contaminé la veille → chaque PJ qui boit AUJOURD\'HUI est EXPOSÉ (`sea-tonneau-expose`)', async () => {
    const { setGmSeat } = await import('./netFlow');
    setGmSeat(get, set, 1);
    set({ vessel: { ...get().vessel!, waterLitres: 1000 } });
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0], { cadence: 'jour-par-jour' })!;
    set({ travelPlan: { ...plan, sea: { ...plan.sea!, daysAtSea: 5, weather: { ...plan.sea!.weather, vent: 'calme-plat' }, waterContaminated: { diseaseId: 'courante-galopante' } } } });
    continueSeaDayAfterCascade(get, set);
    expect(get().pendingCascade).toBeTruthy();
    const kinds = get().pendingCascade!.participants.map((s) => s.kind);
    expect(kinds.filter((k) => k === 'sea-tonneau-expose')).toHaveLength(get().party.length);
  });

  it('un PJ DÉJÀ porteur de la maladie du tonneau n\'est PAS re-testé (`contractionDue`)', async () => {
    const { setGmSeat } = await import('./netFlow');
    setGmSeat(get, set, 1);
    const party = [...get().party];
    party[0] = { ...party[0], diseases: [contractDisease('courante-galopante', makeRNG(1), { incubation: 0 })!] };
    set({ party, vessel: { ...get().vessel!, waterLitres: 1000 } });
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0], { cadence: 'jour-par-jour' })!;
    set({ travelPlan: { ...plan, sea: { ...plan.sea!, daysAtSea: 5, weather: { ...plan.sea!.weather, vent: 'calme-plat' }, waterContaminated: { diseaseId: 'courante-galopante' } } } });
    continueSeaDayAfterCascade(get, set);
    expect(get().pendingCascade).toBeTruthy();
    const kinds = get().pendingCascade!.participants.map((s) => s.kind);
    expect(kinds.filter((k) => k === 'sea-tonneau-expose')).toHaveLength(get().party.length - 1); // le porteur déjà malade est écarté
  });
});

describe('Périls en mer — collision routée par la DONNÉE (#444, MDG 13 l.475-499, zéro IC/chance en dur)', () => {
  beforeEach(freshState);

  /** Force le tirage sur UN péril donné (`pickSeaHazard`, poids MAISON) — mutation RESTAURÉE en `finally`. */
  function forceHazard(id: string): (number | undefined)[] {
    const original = SEA_HAZARDS.map((h) => h.weight);
    for (const h of SEA_HAZARDS) h.weight = h.id === id ? 1 : 0;
    return original;
  }
  function restoreWeights(original: (number | undefined)[]): void {
    SEA_HAZARDS.forEach((h, i) => { h.weight = original[i]; });
  }

  it('le dégât suit l’IC ÉDITÉ en donnée (pas 47 figé) — modifier `sea-perils.json` en mémoire change le résultat', () => {
    const original = forceHazard('rocher');
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
      restoreWeights(original);
    }
  });

  it('Iceberg/Débris marins/Bas-fonds : chacun des 4 périls routés se résout (dégâts de coque encaissés)', () => {
    for (const id of ['iceberg', 'debris-marins', 'rocher', 'bas-fonds']) {
      freshState();
      const original = forceHazard(id);
      try {
        const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0])!;
        set({ travelPlan: { ...plan, sea: { ...plan.sea!, forcedEventId: 'collision-soudaine' } } });
        const before = get().travelPlan!.vehicle!.wounds.current;
        runSeaDay(get, set);
        const hazard = findSeaHazard(id)!;
        expect(get().journal.some((l) => l.includes(`${hazard.label} IC ${hazard.ic}`))).toBe(true);
        expect(get().travelPlan!.vehicle!.wounds.current).toBeLessThanOrEqual(before);
      } finally {
        restoreWeights(original);
      }
    }
  });

  it('Rocher/Bas-fonds : Échouage possible (`strandingOccurs`) → `sea.stranded` posé, dégagement = Test de Force (#444)', () => {
    const original = forceHazard('rocher');
    const rocher = findSeaHazard('rocher')!;
    const originalPct = rocher.strandChancePct;
    try {
      rocher.strandChancePct = 100; // force l'Échouage (garantit le branchement, indépendant du hasard)
      const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0], { cadence: 'jour-par-jour' })!;
      set({ travelPlan: { ...plan, sea: { ...plan.sea!, forcedEventId: 'collision-soudaine' } } });
      runSeaDay(get, set);
      expect(get().travelPlan!.sea!.stranded).toBeTruthy();
      expect(get().travelPlan!.sea!.stranded!.hazardId).toBe('rocher');
    } finally {
      rocher.strandChancePct = originalPct;
      restoreWeights(original);
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
      const original = forceHazard('debris-marins');
      try {
        freshState(); // renseème à 1
        debris.entangleChancePct = chance;
        const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0], { cadence: 'jour-par-jour' })!;
        set({ travelPlan: { ...plan, sea: { ...plan.sea!, forcedEventId: 'collision-soudaine' } } });
        runSeaDay(get, set);
        return tiragesConsommes(1);
      } finally {
        restoreWeights(original);
      }
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
    const original = forceHazard('debris-marins');
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
      expect(entangled!.need).toBe(debris.freeTest!.totalDR); // cogue = Taille moyenne → bande moyenne/grande
      expect(entangled!.manDR).toBe(-1);
      expect(entangled!.mMod).toBe(0);
    } finally {
      debris.entangleChancePct = originalPct;
      restoreWeights(original);
    }
  });
});

describe('Échouage/Empêtrement — dégagement par Test de Force (#444, appliers `sea-degagement`/`sea-degagement-debris`)', () => {
  beforeEach(freshState);

  function planWithSea() {
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0])!;
    set({ travelPlan: plan });
    return plan;
  }
  function step(kind: string, sl: number, success = sl >= 1): CascadeStep {
    return { id: kind, kind, label: fixtureText(kind), result: { roll: 0, target: 0, sl, success }};
  }
  const apply = (kind: string, sl: number, success = sl >= 1) =>
    cascadeAppliers[kind].apply(get, set, step(kind, sl, success), undefined, { steps: [], index: 0 });

  it('Débris marins : l’étape de dégagement met en jeu SON enjeu (MDG 13 l.487-491), pas la progression bloquée de l’Échouage', () => {
    const plan = planWithSea();
    const need = findSeaHazard('debris-marins')!.freeTest!.totalDR;
    set({ travelPlan: { ...plan, sea: { ...plan.sea!, entangled: { hazardId: 'debris-marins', label: 'Débris marins', need, progress: 0, manDR: -1, mMod: 0, difficulty: 'accessible' } } } });
    const st = apply('progression', 2, true)?.insert?.find((s) => s.kind === 'sea-degagement-debris');
    expect(st).toBeTruthy();
    expect(st?.stake?.key?.kind).toBe('sea-degagement-debris');
    expect(resolveStake(st!.stake!).text).toContain(`total de ${need} DR`); // MDG 13 l.491
  });

  it('sea-degagement : succès → `sea.stranded` levé', () => {
    const plan = planWithSea();
    set({ travelPlan: { ...plan, sea: { ...plan.sea!, stranded: { hazardId: 'rocher', label: 'Rocher' } } } });
    apply('sea-degagement', 3, true);
    expect(get().travelPlan!.sea!.stranded).toBeUndefined();
  });

  it('sea-degagement : échec → `sea.stranded` PERSISTE (à retenter)', () => {
    const plan = planWithSea();
    set({ travelPlan: { ...plan, sea: { ...plan.sea!, stranded: { hazardId: 'rocher', label: 'Rocher' } } } });
    apply('sea-degagement', -2, false);
    expect(get().travelPlan!.sea!.stranded).toBeTruthy();
  });

  it('sea-degagement-debris : Test ÉTENDU — cumule jusqu’au total DR de `hazard.freeTest`, puis lève `sea.entangled`', () => {
    const plan = planWithSea();
    set({ travelPlan: { ...plan, sea: { ...plan.sea!, entangled: { hazardId: 'debris-marins', label: 'Débris marins', need: 10, progress: 6, manDR: -1, mMod: 0, difficulty: 'accessible' } } } });
    apply('sea-degagement-debris', 5, true); // 6 + 5 = 11 ≥ 10 → dégagé
    expect(get().travelPlan!.sea!.entangled).toBeUndefined();
  });

  it('sea-degagement-debris : progression insuffisante → `sea.entangled` PERSISTE avec le total cumulé', () => {
    const plan = planWithSea();
    set({ travelPlan: { ...plan, sea: { ...plan.sea!, entangled: { hazardId: 'debris-marins', label: 'Débris marins', need: 10, progress: 0, manDR: -1, mMod: 0, difficulty: 'accessible' } } } });
    apply('sea-degagement-debris', 3, true);
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
    set({ vessel: { ...get().vessel!, cargo: [{ cargoId: 'vin', enc: 18, basePriceGold: 0 }] } });
    const plan = planWithSea();
    set({ travelPlan: { ...plan, orders: { cadence: 'jour-par-jour' }, sea: { ...plan.sea!, stranded: { hazardId: 'rocher', label: 'Rocher' } } } });
    runSeaDay(get, set);
    const st = get().pendingCascade?.participants.find((x) => x.kind === 'sea-degagement');
    expect(st?.difficulty).toBe('intermediaire');
    expect(st?.mods).toContainEqual(expect.objectContaining({ label: 'Encombrement du navire et de sa cargaison', value: -18, famille: 'circonstance' }));
  });
});

describe('Précipitations sur le pont — Tests d’équipage du jour de mer (MDG 13 l.185-200, #1936)', () => {
  beforeEach(freshState);

  const MALUS_TRES_ABONDANTES: Record<string, number> = {
    athletisme: -30, escalade: -30, commandement: -20, orientation: -20, perception: -20, ramer: -20, voile: -20,
  };

  it('un jour Très abondantes : chaque marin du Test d’Orientation porte la ligne « Météo : Très abondantes » sur la cible', () => {
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0], { cadence: 'jour-par-jour' })!;
    set({ travelPlan: { ...plan, sea: { ...plan.sea!, weather: { ...plan.sea!.weather, precipitations: 'tres-abondantes', vent: 'brise-fraiche' } } } });
    runSeaDay(get, set);
    let orientation: CascadeStep | undefined;
    for (let i = 0; i < 30 && !orientation; i++) {
      const p = get().pendingCascade;
      if (!p) break;
      const cur = p.participants[p.cursor];
      if (cur?.kind === 'orientation') { orientation = cur; break; }
      avanceEtapeCascade(get);
    }
    expect(orientation?.participants?.length).toBeGreaterThan(0);
    for (const part of orientation!.participants!) {
      expect(part.mods).toContainEqual(expect.objectContaining({
        label: 'Météo : Très abondantes', value: MALUS_TRES_ABONDANTES[part.skillId ?? ''] ?? -10, famille: 'circonstance',
      }));
    }
  });

  /** Le plan du jour sous Précipitations `precip`, à la cadence `cadence` (ordres permanents). */
  const sousLaPluie = (precip: 'aucune' | 'tres-abondantes', cadence: 'jour-par-jour' | 'commande', sea: Record<string, unknown> = {}) => {
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0], { cadence })!;
    set({ travelPlan: { ...plan, sea: { ...plan.sea!, ...sea, weather: { ...plan.sea!.weather, precipitations: precip, vent: 'brise-fraiche' } } } });
  };
  const METEO_CARAC = { label: 'Météo : Très abondantes', value: -10, famille: 'circonstance' };

  it('ÉCHOUÉ un jour Très abondantes : le Test de Force de dégagement porte « Météo » (Test de Caractéristique, −10) sur la cible', () => {
    sousLaPluie('tres-abondantes', 'jour-par-jour', { stranded: { hazardId: 'rocher', label: 'Rocher' } });
    runSeaDay(get, set);
    const st = get().pendingCascade?.participants.find((x) => x.kind === 'sea-degagement');
    expect(st?.mods).toContainEqual(expect.objectContaining(METEO_CARAC));
    expect(inexplique(st!)).toBe(0);
  });

  it('un Test de Caractéristique SANS Compétence ouvert en mer (`runFlow` → `openSkillTest`) porte « Météo » (−10) sur la cible', () => {
    sousLaPluie('tres-abondantes', 'jour-par-jour');
    runFlow(get, set, { kind: 'test', test: { characteristic: 'force', difficulty: 'intermediaire' }, success: EMPTY_FLOW, fail: EMPTY_FLOW });
    const pt = get().pendingTest!;
    expect(pt.skillId).toBeUndefined();
    expect(pt.mods).toContainEqual(expect.objectContaining(METEO_CARAC));
  });

  it('cadence COMMANDÉE (résolution sur place) : au procès-verbal, la cible du Test d’Orientation inclut le −20 des Précipitations', () => {
    const lignesOrientation = (precip: 'aucune' | 'tres-abondantes') => {
      freshState();
      seedBattleRng(7);
      sousLaPluie(precip, 'commande');
      runSeaDay(get, set);
      expect(get().pendingCascade?.purpose ?? null, 'aucune fenêtre de jour en cadence commandée').not.toBe('travelDay');
      return (get().pendingRest?.travelDay?.entries ?? []).filter((e) => e.id?.startsWith('sea-orientation-')).map((e) => e.d!);
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
      const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0], { cadence: 'jour-par-jour' })!;
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
      const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0], { pace: 1, cadence: 'jour-par-jour' })!;
      set({ travelPlan: { ...plan, sea: { ...plan.sea!, daysAtSea: 1, forcePace: 1, paceToday: undefined, weather: { ...plan.sea!.weather, temperature: 'mediane', precipitations: precip, vent: 'brise-fraiche' } } } });
      runSeaDay(get, set);
      let guard = 0;
      while (get().pendingCascade && get().pendingCascade!.purpose !== 'seaExhaustion' && guard++ < 80) stepCascade();
      const casc = get().pendingCascade;
      expect(casc?.purpose, 'la journée atteint le Test d’Épuisement').toBe('seaExhaustion');
      const rangees = casc!.participants[0].participants!.map((r) => ({ id: r.id, target: r.target!, mods: r.mods ?? [], avant: extenue(r.id) }));
      draineCascade(get, 200, (etape, rangee) => (etape.kind === 'sea-epuisement' && rangee ? de(rangee.id, rangee.target!) : undefined));
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
      const sec = rollLine({ actor: h, test: { skill, char }, difficulty: 'intermediaire' }).target;
      return rollLine({ actor: h, test: { skill, char }, difficulty: 'intermediaire', pont: precip }).target - sec;
    };
    expect(ecart('athletisme', 'agilite')).toBe(physique);
    expect(ecart('perception', 'initiative')).toBe(manoeuvre);
    expect(ecart('resistance', 'endurance')).toBe(autre);
  });
});

describe('Survitesse — « Ça va lâcher, capitaine ! » (#443, MDG 13 l.121-142)', () => {
  beforeEach(freshState);
  afterEach(() => resetRule('sea-overspeed-tests-per-day'));

  // Cogue : sail.m = 5 (M de conception). Légère brise + vent arrière/latéral = pctSail 0 (aucun mod de
  // vent) → `eff.m` dépend UNIQUEMENT de `eventMMod` (deterministe, aucun bruit de la météo tirée).
  function planWithSea(eventMMod?: number) {
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0])!;
    const sea = {
      ...plan.sea!,
      weather: { ...plan.sea!.weather, vent: 'legere-brise' as const },
      windFrom: 'ouest' as const, // heading 'est' + vent d'ouest → aspect ARRIÈRE (pctSail 0)
      ...(eventMMod != null ? { eventMMod } : {}),
    };
    set({ travelPlan: { ...plan, sea } });
    return plan;
  }
  function step(kind: string, sl: number, success = sl >= 1, meta?: Record<string, number>): CascadeStep {
    return { id: kind, kind, label: fixtureText(kind), result: { roll: 0, target: 0, sl, success }, meta };
  }
  const apply = (kind: string, sl: number, success = sl >= 1, meta?: Record<string, number>) =>
    cascadeAppliers[kind].apply(get, set, step(kind, sl, success, meta), undefined, { steps: [], index: 0 });

  it('pas de survitesse (M dans les clous, ≤ M+4) → la Progression n’insère aucun Test de survitesse', () => {
    planWithSea(); // aucun eventMMod → M 5, sous le seuil M+4 (safeBonus)
    const out = apply('progression', 2, true);
    expect(get().travelPlan!.sea!.effMToday).toBeLessThanOrEqual(9); // baseM(5) + safeBonus(4)
    expect(out?.insert?.some((s) => s.kind === 'sea-overspeed')).toBeFalsy();
  });

  it('survitesse (eventMMod +5 → M+5) → la Progression insère un Test de survitesse (ligne « ÇA VA LÂCHER, CAPITAINE ! »)', () => {
    planWithSea(5); // baseM_local 5+5=10, vent neutre (pctSail 0) → eff.m 10 = M+5
    const out = apply('progression', 2, true);
    expect(get().travelPlan!.sea!.effMToday).toBe(10);
    const row = overspeedRow(5, 10)!;
    expect(row).toMatchObject({ difficulty: 'accessible', per: 'heure', damage: 1 }); // M+5
    const st = out?.insert?.find((s) => s.kind === 'sea-overspeed');
    expect(st).toBeTruthy();
    expect(st!.meta?.overspeedDamage).toBe(row.damage);
    expect(st!.worldOwner, 'MDG 12 l.58 : le navire teste, le MONDE tient le dé').toBe(true);
    expect(st!.actorId).toBeUndefined();
  });

  it('le Test se lance sur l’Endurance du NAVIRE ± la Difficulté, tenu par le MONDE (MDG 13 l.125, MDG 12 l.58)', () => {
    planWithSea(5);
    const st = apply('progression', 2, true)?.insert?.find((s) => s.kind === 'sea-overspeed');
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
      return apply('progression', 2, true)?.insert?.find((s) => s.kind === 'sea-overspeed')?.target;
    };
    const faible = cible(20);
    expect(faible).toBeDefined();
    expect(cible(70)).toBe(faible);
  });

  it('applier sea-overspeed : échec du Test de Résistance → Dégâts de coque = damage + X (X = DR négatifs), routés par damageVesselHull (#296)', () => {
    const plan = planWithSea();
    plan.vehicle!.wounds.current = plan.vehicle!.wounds.max;
    const before = plan.vehicle!.wounds.current;
    apply('sea-overspeed', -5, false, { overspeedDamage: 1 }); // ligne M+5 : 1+X, X=5 → 6
    expect(get().travelPlan!.vehicle!.wounds.current).toBe(before - 6);
    expect(get().vessel!.wounds!.current).toBe(before - 6); // persisté (#296)
  });

  it('applier sea-overspeed : succès → aucun Dégât', () => {
    const plan = planWithSea();
    plan.vehicle!.wounds.current = plan.vehicle!.wounds.max;
    const before = plan.vehicle!.wounds.current;
    apply('sea-overspeed', 3, true, { overspeedDamage: 1 });
    expect(get().travelPlan!.vehicle!.wounds.current).toBe(before);
  });

  it('données éditées (`sea-navigation.json` via `overspeedRow`) : le Test de survitesse suit le tableau — bande extrême « M+9 ou plus » → damage 8', () => {
    planWithSea(20); // baseM_local 5+20=25, vent neutre → eff.m 25 = M+20 (plafonné par la table à « M+9 ou plus »)
    const row = overspeedRow(5, 25)!;
    expect(row.damage).toBe(8); // « M+9 ou plus » — le calcul de la ligne suit la DONNÉE, jamais une valeur en dur
    const out = apply('progression', 2, true);
    const st = out?.insert?.find((s) => s.kind === 'sea-overspeed');
    expect(st!.meta?.overspeedDamage).toBe(8);
  });

  it('règle éditable `sea-overspeed-tests-per-day` (#443, cadence infra-journalière mappée sur le jour) : N=2 → deux Tests de survitesse insérés', () => {
    setRule('sea-overspeed-tests-per-day', 2);
    planWithSea(5);
    const out = apply('progression', 2, true);
    expect(out?.insert?.filter((s) => s.kind === 'sea-overspeed').length).toBe(2);
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
 * (`kind: 'exposure'`, restFlow) : le cumul des échecs d'un héros reste RAW.
 */
describe('Exposition en mer — une étape influençable par Test, une cascade par jour (#1104b)', () => {
  beforeEach(freshState);

  /** Plan de mer par temps GLACIAL (bande à 2 h → 4 Tests par héros, Difficulté Intermédiaire). */
  function glacialDay() {
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0], { cadence: 'jour-par-jour' })!;
    set({ travelPlan: { ...plan, sea: { ...plan.sea!, daysAtSea: 1, milesToday: 50, weather: { ...plan.sea!.weather, temperature: 'glaciale' } } } });
  }

  it('AVEC siège MJ : UNE cascade `seaExposure`, une BANDE par VAGUE (héros en rangées), chaque ligne DIT sa Difficulté', async () => {
    const { setGmSeat } = await import('./netFlow');
    setGmSeat(get, set, 1);
    glacialDay();
    continueSeaDayAfterCascade(get, set);
    const casc = get().pendingCascade!;
    expect(casc.purpose).toBe('seaExposure');
    const living = get().party.filter((h) => !h.dead).length;
    // 4 Tests/jour (`seaExposureTestsPerDay('glaciale')`) = 4 VAGUES ; la 1ʳᵉ s'ouvre, les suivantes se
    // construisent après elle (#1117 L3) — une RANGÉE par héros vivant dans la fenêtre.
    expect(casc.participants).toHaveLength(1);
    expect(casc.participants[0].kind).toBe('sea-exposition'); // applier d'escalade PARTAGÉ
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

  it('un héros sous protection magique ne reçoit AUCUNE étape (le Test n’a pas lieu)', async () => {
    const { setGmSeat } = await import('./netFlow');
    setGmSeat(get, set, 1);
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
    set({ party: get().party.map((h) => ({ ...h, characteristics: { ...h.characteristics, endurance: 1 } })) } as never);
    seaDay('glaciale');
    expect(exposureScales().length).toBeGreaterThan(0); // des pénalités ont bien été subies
    expect(exposureScales()).not.toContain('permanent'); // toutes portent leur horloge de 24 h
  });

  it('les jours CLÉMENTS suivants n’oublient personne : aucune pénalité ne reste `permanent`', () => {
    seedBattleRng(3);
    set({ party: get().party.map((h) => ({ ...h, characteristics: { ...h.characteristics, endurance: 1 } })) } as never);
    seaDay('glaciale');
    const subies = exposureScales().length;
    expect(subies).toBeGreaterThan(0);
    seaDay('mediane'); // tempérée : AUCUN Test d'Exposition ce jour-là
    seaDay('mediane');
    expect(exposureScales()).not.toContain('permanent');
    expect(exposureScales()).toHaveLength(subies); // les pénalités existent toujours, mais horlogées
  });

  it('la règle ÉDITABLE `exposure-expire-hours` gouverne AUSSI le répit de MER (48 h ⇒ échéance à 48 h)', () => {
    // Le chemin de mer portait 24 h EN DUR : régler la règle sur 48 h laissait la mer court-circuiter le
    // réglage du joueur. Une seule règle pour les deux répits (camp `restFlow` ET jour de mer).
    setRule('exposure-expire-hours', 48);
    seedBattleRng(3);
    set({ party: get().party.map((h) => ({ ...h, characteristics: { ...h.characteristics, endurance: 1 } })) } as never);
    const t0 = get().gameTime;
    seaDay('glaciale');
    const echeances = get().party
      .flatMap((h) => (h.activeEffects ?? []).filter((e) => String(e.effectId).startsWith('exposition')))
      .map((e) => (e.duration as { scale: string; until?: number }).until);
    expect(echeances.length).toBeGreaterThan(0);
    for (const u of echeances) expect(u).toBeGreaterThanOrEqual(t0 + 48 * 60);
  });
  afterEach(() => resetRule('exposure-expire-hours'));
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

  // Cliquet « zéro chip anonyme » et lecture du Soutien : SOURCE UNIQUE `cascadeTestKit`
  // (`inexplique`/`soutienDe`) — les quatre flux migrés jugent la MÊME grandeur.

  /** Toutes les étapes SOUTENUES posées par la cascade courante. */
  function soutenues(): CascadeStep[] {
    const p = get().pendingCascade;
    return (p?.participants ?? []).filter((st) => soutienDe(st) > 0 && st.target != null);
  }

  function seaDay(patch: Record<string, unknown>) {
    partyThatSupports();
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0], { pace: 1, cadence: 'jour-par-jour' })!;
    set({ travelPlan: { ...plan, sea: { ...plan.sea!, ...patch } } });
  }

  it('« Forcer le rythme » : la cible porte le Soutien (aucun résidu)', () => {
    seaDay({ forcePace: 1, paceToday: undefined });
    runSeaDay(get, set);
    const st = soutenues().find((x) => x.kind === 'sea-force-pace');
    expect(st, 'l’étape de Forcer le rythme est posée ET soutenue').toBeTruthy();
    expect(soutienDe(st!), 'des soutiens contribuent, en ligne de mod NOMMÉE').toBeGreaterThan(0);
    expect(inexplique(st!), 'aucune chip « autres » : tout est nommé').toBe(0);
  });

  it('« Dégagement » (échouage) : la cible porte le Soutien (aucun résidu)', () => {
    seaDay({ stranded: { hazardId: 'bas-fonds', label: 'un banc de sable' } });
    runSeaDay(get, set);
    const st = soutenues().find((x) => x.kind === 'sea-degagement');
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
    const st = soutenues().find((x) => x.kind === 'sea-force-pace')!;
    const attendu = st.target!;
    get().cascadeRoll(st.id);
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
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0], { pace: 1, cadence: 'jour-par-jour' })!;
    set({ travelPlan: plan });
    runSeaDay(get, set);
    // Répond « Navigation » au choix de Progression (MDG 14 l.63).
    for (let i = 0; i < 30; i++) {
      const p = get().pendingCascade;
      if (!p) break;
      const cur = p.participants[p.cursor];
      if (cur?.kind === 'sea-progression-choice') { get().cascadeChoose(cur.id, 'nav'); get().cascadeNext(); break; }
      stepCascade();
    }
    const nav = get().pendingCascade!.participants.find((x) => x.kind === 'sea-progression-nav');
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
    expect(testValue(porteur, 'resistance', 'endurance'), 'l’État mord les jets du PJ').toBeLessThan(skillBaseValue(porteur, 'resistance', undefined, 'endurance'));

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
 * l'enjeu AFFICHÉ décrit l'EFFET du jet (catalogue `voyage-stakes.json`), et le VERBATIM MDG 14 se
 * lit à un clic (fiche `regles.json` portée par le type). Et le choix ouvert par MDG 14 l.63
 * (« vous pouvez effectuer un Test d'équipage au lieu d'un Test de Navigation ») est POSÉ au joueur.
 */
describe('Tests d’équipage — enjeu d’EFFET, règle en fiche, choix de Progression (#1117)', () => {
  beforeEach(() => {
    freshState();
    // Un barreur qui peut tenter la Voile (LDB 09 l.30) : aucun prétiré ne l'a.
    useGame.setState({ party: get().party.map((h, i) => (i === 0 ? { ...h, skills: [...h.skills, { id: 'voile', spec: 'cogue', characteristic: 'agilite' as const, advances: 10 }] } : h)) });
  });

  it('la Progression PROPOSE les deux voies RAW, équipage par défaut', () => {
    get().startTravel('r1', 'mer', { cadence: 'jour-par-jour' });
    const p = get().pendingCascade!;
    const choix = p.participants.find((s) => s.kind === 'sea-progression-choice');
    expect(choix, 'le choix est POSÉ, jamais tranché en silence').toBeTruthy();
    expect(choix!.options!.map((o) => o.key)).toEqual(['crew', 'nav']);
    expect(choix!.defaultChoice, 'cadence commandée = voie d’équipage').toBe('crew');
  });

  it('« Navigation » retenue → un Test MONO de Voile/Ramer, et la journée continue pareil', () => {
    get().startTravel('r1', 'mer', { cadence: 'jour-par-jour' });
    for (let i = 0; i < 30; i++) {
      const p = get().pendingCascade;
      if (!p) break;
      const cur = p.participants[p.cursor];
      if (cur?.kind === 'sea-progression-choice') { get().cascadeChoose(cur.id, 'nav'); get().cascadeNext(); break; }
      stepCascade();
    }
    const nav = get().pendingCascade!.participants.find((s) => s.kind === 'sea-progression-nav');
    expect(nav, 'la voie Navigation est insérée').toBeTruthy();
    expect(nav!.participants, 'voie MONO : un barreur, pas un batch d’équipage').toBeUndefined();
    const competence = navigationDuNavire(get, get().travelPlan!.vehicle!);
    expect(estCompetenceDePropulsion(competence.id), 'Voile ou Ramer').toBe(true);
    expect(nav!.rollLabel).toBe(testSkillLabel({ skill: competence.id, spec: competence.spec }));
  });

  it('personne qui puisse tenter la Voile (LDB 09 l.30) : la voie Navigation reste OFFERTE, fermée avec son refus nommé', () => {
    useGame.setState({ party: get().party.map((h) => ({ ...h, skills: h.skills.filter((sk) => sk.id !== 'voile') })) });
    get().startTravel('r1', 'mer', { cadence: 'jour-par-jour' });
    const choix = get().pendingCascade!.participants.find((s) => s.kind === 'sea-progression-choice');
    expect(choix, 'le choix MDG 14 l.63 reste posé').toBeTruthy();
    const nav = choix!.options!.find((o) => o.key === 'nav');
    expect(nav, 'la voie Navigation est présente').toBeTruthy();
    expect(nav!.refus).toBe('Personne dans le groupe ne peut tenter le Test de Voile (Cogue).');
    expect(choix!.options!.find((o) => o.key === 'crew')!.refus, 'la voie d’équipage reste ouverte').toBeUndefined();
    expect(choix!.defaultChoice).toBe('crew');
  });

  it('l’enjeu d’une étape d’équipage dit son EFFET, jamais la règle-cadre de substitution', () => {
    get().startTravel('r1', 'mer', { cadence: 'jour-par-jour' });
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
    set({
      party: get().party.map((h) => ({
        ...h,
        skills: [...h.skills.filter((sk) => !['voile', 'ramer'].includes(sk.id)), { id: 'voile', spec: 'cogue', advances: 12 }, { id: 'ramer', advances: 12 }],
        activeEffects: [...(h.activeEffects ?? []), { label: 'Naviguons tous ensemble', crewTestMod: 10, duration: { scale: 'permanent' as const } }],
      })),
    } as never);
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0], { pace: 1, cadence: 'jour-par-jour' })!;
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
      if (cur?.options && !cur.chosen) { get().cascadeChoose(cur.id, cur.defaultChoice ?? cur.options[0].key); get().cascadeNext(); continue; }
      stepCascade();
    }
    expect(batch, 'la journée pose bien un Test d’équipage').toBeTruthy();
    for (const part of batch!.participants!) {
      const crew = get().party.find((h) => h.id === part.id)!;
      expect(part.mods?.some((m) => m.label === 'Naviguons tous ensemble' && m.value === 10),
        'la chanson se NOMME sur la rangée du marin').toBe(true);
      expect(part.base, 'base NUE : la chanson n’y est plus fondue')
        .toBe(skillBaseValue(crew, part.skillId, part.spec));
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
    const h = makePregens()[0];
    h.characteristics.intelligence = 30;
    h.skills = [{ id: 'metier', characteristic: 'intelligence', advances: 25, spec: 'ingenieur' }];
    return h;
  }
  /** Un badaud : même Intelligence, aucune compétence de Métier. */
  function badaud(): Combatant {
    const h = makePregens()[1];
    h.characteristics.intelligence = 30;
    h.skills = [];
    return h;
  }

  it('la spec « ingenieur » EXISTE dans skills.json (id, pas libellé)', () => {
    expect((byId('skill', 'metier')?.specs ?? []).some((s) => s.id === 'ingenieur')).toBe(true);
  });

  it('testValue trouve la spécialisation par son ID — le LIBELLÉ perd les avances (contre-preuve)', () => {
    const h = ingenieur();
    const parId = testValue(h, 'metier', undefined, 'ingenieur');
    const parLabel = testValue(h, 'metier', undefined, 'Ingénieur');
    expect(parId, 'par id : les avances comptent').toBeGreaterThan(parLabel);
    // …et le libellé rend EXACTEMENT ce que rend une demande SANS compétence : la compétence est
    // réputée absente, les 25 avances tombent en silence (33 sur cette fixture, passifs compris).
    expect(parLabel, 'par libellé : la compétence est réputée absente').toBe(testValue(h, 'metier', undefined, 'inconnue-xyz'));
  });

  it('LE SITE — `engineerOf` élit bien l’INGÉNIEUR, là où la demande par libellé n’élit personne', () => {
    const b = badaud(), i = ingenieur();
    // Le SITE de production, pas son mécanisme : débrancher l'id au call-site rougit ICI.
    expect(engineerOf([b, i])?.id, 'le mécano de la chaudière est celui qui sait réparer').toBe(i.id);
    // Contre-preuve du mécanisme sous-jacent : la MÊME élection demandée par LIBELLÉ ne trouve aucun porteur.
    expect(partyBest([b, i], 'metier', undefined, undefined, 'Ingénieur'), 'par libellé : personne ne possède la spécialisation').toBeNull();
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
    expect(get().pendingCrewTest, 'un Test d’équipage a été posé sans personne pour le tenir').toBeNull();
    const etapes: CascadeStep[] = get().pendingCascade?.participants ?? [];
    expect(etapes.some((e) => e.kind === 'progression'), 'une étape de Progression a été posée sans PJ apte').toBe(false);

    // Verrou : l'issue est la DÉFAITE hors combat (`state/partyWipe.ts` — prédicat identique à la
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
    get().startTravel('r1', 'mer');

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
  registerCascadeApplier('progression-choix-test', () => {});

  it('la bande résolue à la reprise arrive au PV de la halte', () => {
    set({ travelPlan: buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0], { cadence: 'commande' })! });
    const h = get().party[0];
    const bande = buildBand(get, { id: 'bande-pv', kind: 'orientation', label: fixtureText('Orientation'), difficulty: 'intermediaire', porteurs: [{ actor: h, ligne: { test: { skill: 'orientation', char: 'intelligence' } } }] })!;
    const decision: CascadeStep = { id: 'decision', kind: 'progression-choix-test', label: fixtureText('Décision'), options: [{ key: 'a', label: fixtureText('A') }, { key: 'b', label: fixtureText('B') }] };
    expect(runCascadeImmediate(get, set, [decision, bande], { title: 'Jour', purpose: 'travelDay', rowSurface: 'pv' })).toBeUndefined();

    get().cascadeChoose('decision', 'a');
    get().cascadeNext();
    for (let i = 0; i < 30 && get().pendingCascade && !get().pendingRest; i++) stepCascade();
    const entrees = get().pendingRest?.travelDay?.entries ?? [];
    expect(entrees.length, 'la bande résolue à la reprise n’est pas au PV du jour').toBeGreaterThan(0);
  });
});

describe('Salissures — Test de Résistance hebdomadaire du vaisseau par la porte des jets (#1105, MDG 13 l.148)', () => {
  beforeEach(freshState);
  afterEach(() => resetRule('sea-salissures-difficulty'));

  /** 7ᵉ jour en mer, en semaine 1 : le Test de la semaine est dû. */
  function septiemeJour(fouling?: { level: number; lastWeek: number }) {
    set({ gameTime: 7 * 24 * 60 + 8 * 60, vessel: { ...get().vessel!, ...(fouling ? { fouling } : {}) } });
    const plan = buildSeaPlan(get, 'r1', 'A', 'B', seaMap.routes[0], { cadence: 'jour-par-jour' })!;
    set({ travelPlan: { ...plan, sea: { ...plan.sea!, daysAtSea: 6 } } });
  }
  /** Joue la journée comme un joueur jusqu'au Test de Salissures, dont le dé est POSÉ à `de`. */
  function jusquAuxSalissures(de: number): CascadeStep | undefined {
    runSeaDay(get, set);
    let joue: CascadeStep | undefined;
    for (let i = 0; i < 40 && get().pendingCascade && !joue; i++) {
      const cur = get().pendingCascade!.participants[get().pendingCascade!.cursor];
      avanceEtapeCascade(get, (st) => (st.kind === 'sea-salissures' ? de : undefined));
      if (cur?.kind === 'sea-salissures') joue = cur;
    }
    return joue;
  }
  /** Le dé de Salissures n'a qu'UNE surface (#1291) : aucune entrée de procès-verbal ne le recopie. */
  const entreeSalissures = () => (get().travelPlan?.sea?.entries ?? []).find((e) => e.id?.startsWith('sea-salissures'));
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

  it('règle maison `sea-salissures-difficulty` (LDB 12 l.137) : la Difficulté éditée entre dans la cible', () => {
    setRule('sea-salissures-difficulty', 'complexe');
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
    const [a, b, c, d] = makePregens();
    const faible = cible([{ ...a!, characteristics: { ...a!.characteristics, endurance: 20 } }]);
    expect(faible).toBeDefined();
    expect(cible([b!, c!, { ...d!, characteristics: { ...d!.characteristics, endurance: 70 } }])).toBe(faible);
  });

  it('la fenêtre du Test du navire s’ouvre chez l’hôte en solo, présentable sans acteur', () => {
    septiemeJour();
    const st = jusquAuxSalissures(96);
    expect(seatOwns(get(), 0, WORLD_STEP_OWNER), 'en solo, l’hôte tient le monde').toBe(true);
    expect(jetStepPresentable(st!, undefined), 'l’étape monde est présentable sans acteur').toBe(true);
  });

  it('la Résilience d’un PJ ne bascule pas l’issue du Test du navire (LDB 17 l.21-24)', () => {
    septiemeJour();
    runSeaDay(get, set);
    let id: string | undefined;
    for (let i = 0; i < 40 && get().pendingCascade && !id; i++) {
      const cur = get().pendingCascade!.participants[get().pendingCascade!.cursor];
      if (cur?.kind === 'sea-salissures') { id = cur.id; break; }
      avanceEtapeCascade(get);
    }
    expect(id, 'étape sea-salissures atteinte').toBeTruthy();
    get().cascadeRoll(id!);
    get().cascadeSetForcedRoll(id!, 96);
    const avant = get().party.map((h) => [h.resilience, h.fortune]);
    get().cascadeForceSuccess(id!);
    get().cascadeReroll(id!);
    const st = get().pendingCascade!.participants.find((x) => x.id === id)!;
    expect(st.result?.success, 'l’échec du navire reste un échec').toBe(false);
    expect(get().party.map((h) => [h.resilience, h.fortune]), 'aucune ressource de héros dépensée').toEqual(avant);
  });

  it('aucun PJ apte : le Test du navire a lieu quand même, et la semaine est notée', () => {
    set({ party: get().party.map((h) => ({ ...h, wounds: { ...h.wounds, current: 0 }, conditions: [...(h.conditions ?? []), { id: 'inconscient', value: 1 }] })) } as never);
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
    const pv = get().pendingRest?.travelDay?.entries ?? [];
    expect(pv.some((e) => e.id?.startsWith('sea-salissures')), 'le procès-verbal ne recopie pas le dé').toBe(false);
    const navire = get().travelPlan!.vehicle!.label;
    const libelle = testSkillLabel({ char: 'endurance' })!;
    const traces = get().journal.filter((x) => x.includes(t('sv.foulingTest')) && x.includes('→'));
    expect(traces, 'le dé du navire a UNE surface : sa trace au journal (#1291)').toHaveLength(1);
    expect(traces[0], 'la trace dit QUI lance (le navire) et QUOI (#1595)').toContain(navire);
    expect(traces[0]).toContain(libelle);
  });
});
