import { describe, it, expect } from 'vitest';
import type { CampaignVessel } from '../state/store';
import type { Combatant } from '../engine/types';
import type { TravelPlan } from '../state/travelFlow';
import { rollSeaWeather } from '../engine/seaWeather';
import { voyageMode, voyageTiles, voyageDayCards, dayAgenda } from './VoyageScreen';
import { moraleBand } from '../engine/crewMorale';
import { voyageStepPending } from '../state/modalArbiter';
import type { PendingCascade, CascadeStep } from '../state/pendings';
import type { PendingRest } from '../state/store';

const cascadeStep = (kind: string): CascadeStep => ({ id: kind, kind, result: null } as CascadeStep);
const cascade = (participants: CascadeStep[], cursor: number, purpose: PendingCascade['purpose'] = 'travelDay'): PendingCascade =>
  ({ title: 't', cursor, log: [], purpose, participants } as unknown as PendingCascade);

const hero = (id: string): Combatant => ({
  id, label: `Héros ${id}`, kind: 'hero',
  characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 40, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 35, sociabilite: 30 },
  wounds: { current: 12, max: 12 }, advantage: 0, conditions: [], skills: [], talents: [],
  weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
  items: [], movement: 4,
} as Combatant);

const vessel = (): CampaignVessel => ({
  vehicleId: 'cogue', label: 'Le Cormoran',
  morale: { score: 62, lastMoraleWeek: 0, factors: [] },
  wounds: { current: 8, max: 20 },
  provisions: 9,
  cargo: [{ cargoId: 'cereales', enc: 200, basePriceGold: 3 }],
});

const base = (): TravelPlan => ({ routeId: 'r', fromPlaceId: 'a', toPlaceId: 'b', mode: 'mer', hoursPerDay: 24, km: 380, kmDone: 212, interrupted: false });

const seaPlan = (): TravelPlan => ({ ...base(), sea: { heading: 'ouest', weather: rollSeaWeather('ete'), windFrom: 'nord', daysToEvent: 3, daysAtSea: 4, lines: [], milesToday: 0, hullAtDayStart: 50 } });
const riverPlan = (): TravelPlan => ({ ...base(), mode: 'barge-du-sel', river: { windForce: 'modere', windDir: 'contraire', daysAfloat: 2 } as TravelPlan['river'], vehicle: { ...hero('barge'), wounds: { current: 18, max: 24 } } });
const landPlan = (): TravelPlan => ({ ...base(), mode: 'monture', allure: 'trot' });
// Transport PAYANT en barge (#333 correctif) : ni `.sea` ni `.river` (pas de descente JOUÉE, un
// passeur) — le sous-mode se dérive de la donnée `vehicles.json` id `barge` (`travel.medium:'fluvial'`,
// facette VOYAGE LDB 51 l.185-187 — INDÉPENDANTE de `hull.propulsion:'maritime'`, table navale MDG 12).
const bargePassagePlan = (): TravelPlan => ({ ...base(), mode: 'barge' });

describe('VoyageScreen — hub de voyage paramétré par mode (#333)', () => {
  it('voyageMode : mer / fleuve / terre dérivés du plan', () => {
    expect(voyageMode(seaPlan())).toBe('mer');
    expect(voyageMode(riverPlan())).toBe('fleuve');
    expect(voyageMode(landPlan())).toBe('terre');
  });

  it('voyageMode : transport PAYANT en barge (pas de descente JOUÉE) reste FLEUVE — dérivé de `travel.medium` (donnée), jamais un id nommé (#333 correctif)', () => {
    expect(voyageMode(bargePassagePlan())).toBe('fleuve');
  });

  it('tuiles du transport payant en barge : NOMME le mode réel (jamais « À pied »), pas de tuile Bêtes sans monture', () => {
    const tiles = voyageTiles('fleuve', bargePassagePlan(), null, [hero('h1')], [], 0);
    const transport = tiles.find((t) => t.key === 'allure')!;
    expect(transport.value).toBe('Barge');
    expect(transport.value).not.toBe('À pied');
    expect(tiles.some((t) => t.key === 'betes')).toBe(false);
  });

  it('tuiles MER : vent, coque, moral, provisions, cale', () => {
    const keys = voyageTiles('mer', seaPlan(), vessel(), [hero('h1')], [], 0).map((t) => t.key);
    expect(keys).toEqual(expect.arrayContaining(['vent', 'coque', 'moral', 'provisions', 'cale']));
    const coque = voyageTiles('mer', seaPlan(), vessel(), [hero('h1')], [], 0).find((t) => t.key === 'coque')!;
    expect(coque.value).toBe('8 / 20');
    expect(coque.gauge).toBeDefined();
  });

  it('tuile MORAL : le titre affiché est le `label` de la bande (score 120 — MDG 14), jamais une phrase d’effet tronquée', () => {
    const haut: CampaignVessel = { ...vessel(), morale: { score: 120, lastMoraleWeek: 0, factors: [] } };
    const moral = voyageTiles('mer', seaPlan(), haut, [hero('h1')], [], 0).find((t) => t.key === 'moral')!;
    const band = moraleBand(120);
    expect(moral.value).toBe(`120 — ${band.label}`);
  });

  it('tuiles TERRE : allure et saison (sans navire ni bêtes)', () => {
    const keys = voyageTiles('terre', landPlan(), null, [hero('h1')], [], 0).map((t) => t.key);
    expect(keys).toEqual(expect.arrayContaining(['allure', 'saison']));
    const allure = voyageTiles('terre', landPlan(), null, [hero('h1')], [], 0).find((t) => t.key === 'allure')!;
    expect(allure.value).toBe('Trot');
  });

  it('tuiles FLEUVE : vent du jour et coque de la barge', () => {
    const keys = voyageTiles('fleuve', riverPlan(), null, [hero('h1')], [], 0).map((t) => t.key);
    expect(keys).toEqual(expect.arrayContaining(['vent', 'coque']));
    const coque = voyageTiles('fleuve', riverPlan(), null, [hero('h1')], [], 0).find((t) => t.key === 'coque')!;
    expect(coque.value).toBe('18 / 24');
  });

  it('chronique : une carte par jour clos + le jour EN COURS', () => {
    const plan: TravelPlan = { ...seaPlan(), log: [
      { kmFrom: 0, kmTo: 32, hours: 24, lines: [{ text: 'Départ, vent portant' }], entries: [] },
      { kmFrom: 32, kmTo: 60, hours: 24, lines: [{ text: 'Grain — voiles ✓' }], entries: [] },
    ] };
    const cards = voyageDayCards(plan, 'mer', 'Jour', true);
    expect(cards).toHaveLength(3);
    expect(cards[0].dayLabel).toBe('Jour 1');
    expect(cards[0].summary).toBe('Départ, vent portant');
    expect(cards[2].current).toBe(true);
    expect(cards[2].summary).toBe('EN COURS…');
    expect(cards[2].dayLabel).toBe('Jour 3');
  });

  // Vague « lisibilité du voyage » 2/2 : le bilan du jour CLOS d'une halte de nuit EN COURS sort du
  // panneau de nuit — il devient une carte SÉLECTIONNABLE (comme un jour passé) ; `current` bascule sur
  // la Nuit elle-même (aucun doublon jour/nuit sous un même index).
  it('chronique : une halte de nuit EN COURS ajoute une carte SÉLECTIONNABLE pour le jour clos, « Nuit » devient la carte current', () => {
    const plan: TravelPlan = { ...seaPlan(), log: [
      { kmFrom: 0, kmTo: 32, hours: 24, lines: [{ text: 'Départ, vent portant' }], entries: [] },
    ] };
    const pendingDay = { kmFrom: 32, kmTo: 60, hours: 24, lines: [{ text: 'Grain — voiles ✓' }], entries: [] };
    const cards = voyageDayCards(plan, 'mer', 'Jour', true, [], pendingDay);
    expect(cards).toHaveLength(3); // Jour 1 (log) + Jour 2 (clos, en attente de la nuit) + Nuit (current)
    expect(cards[1].dayLabel).toBe('Jour 2');
    expect(cards[1].summary).toBe('Grain — voiles ✓');
    expect(cards[1].current).toBeUndefined();
    expect(cards[2].dayLabel).toBe('Nuit');
    expect(cards[2].current).toBe(true);
  });
});

describe('dayAgenda — sous-phases du jour EN COURS (arbitrage user verbatim)', () => {
  it('sans cascade ni halte : agenda vide', () => {
    expect(dayAgenda(null, null)).toEqual([]);
  });

  it('cascade travelDay : phases DÉRIVÉES des kinds présents, état fait/en cours/à venir par CURSEUR', () => {
    const steps = [cascadeStep('stagePosteBatch'), cascadeStep('landPeril'), cascadeStep('landForcedPace')];
    const agenda = dayAgenda(cascade(steps, 1), null); // curseur sur landPeril (index 1)
    expect(agenda.map((a) => a.key)).toEqual(['activites', 'rencontre', 'route', 'nuit']);
    expect(agenda.find((a) => a.key === 'activites')!.state).toBe('done');
    expect(agenda.find((a) => a.key === 'rencontre')!.state).toBe('current');
    expect(agenda.find((a) => a.key === 'route')!.state).toBe('pending');
    expect(agenda.find((a) => a.key === 'nuit')!.state).toBe('pending');
  });

  it('phase absente ce jour (aucun kind ne matche) : omise, pas affichée « à venir » à tort', () => {
    const agenda = dayAgenda(cascade([cascadeStep('landPeril')], 0), null);
    expect(agenda.some((a) => a.key === 'activites')).toBe(false);
    expect(agenda.some((a) => a.key === 'route')).toBe(false);
  });

  it('halte de nuit en cours : Route faite, Nuit en cours (plus de cascade active)', () => {
    const agenda = dayAgenda(null, {} as PendingRest);
    expect(agenda).toEqual([
      { key: 'route', label: 'Route', state: 'done' },
      { key: 'nuit', label: 'Nuit', state: 'current' },
    ]);
  });
});

describe('voyageStepPending — une ÉTAPE du hub attend (cascade OU nuit, #333 correctif)', () => {
  it('faux sans cascade ni repos en attente', () => {
    expect(voyageStepPending({})).toBe(false);
  });
  it('vrai avec une cascade en attente', () => {
    expect(voyageStepPending({ pendingCascade: {} as never })).toBe(true);
  });
  it('vrai avec une nuit de halte en attente (repos EMBARQUÉ au centre du hub)', () => {
    expect(voyageStepPending({ pendingRest: {} as never })).toBe(true);
  });
  it('vrai avec une relâche à terre en attente (accostage intégré au journal de voyage, #333 / user 2026-07-11)', () => {
    expect(voyageStepPending({ pendingShoreLeave: {} as never })).toBe(true);
  });
});
