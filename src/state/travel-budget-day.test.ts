/**
 * Budget d'heures de voyage PAR JOUR CALENDAIRE + portes d'heure de départ + nuit forcée (#340).
 *
 * Le budget RAW de 6 h sans Test (LDB 51 l.195) se compte PAR JOUR, pas par trajet : des trajets à pied
 * ENCHAÎNÉS le même jour cumulent leur budget (l'accumulateur unique `store.travelDayHours` keyé sur
 * `dayIndex(gameTime)`) ; l'allure choisie au départ borne la journée, et la marche forcée (case cochée)
 * se teste dès que le cumul dépasse 6 h (un seul Test/jour). Portes maison : départ terrestre/fluvial de l'aube au crépuscule
 * (`travel-departure-gate`), privation de sommeil au jour franchi sans nuit (`travel-sleep-forced`).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useGame } from './store';
import { seedBattleRng } from '../noyau/battleRng';
import { emptyScene, Scene } from '../noyau/monde/scene';
import { WorldMap } from './worldMap';
import { maxHoursPerDay } from './travelFlow';
import { sceneLieu } from './restFlow';
import { campaignStart } from '../engine/clock';
import { setRule, resetRule, rule } from '../engine/policy';
import { stacks } from '../engine/conditions';
import { dayIndex } from './upkeep';
import type { Combatant } from '../engine/types';

const get = () => useGame.getState();

const hero = (p: Partial<Combatant> = {}): Combatant => ({
  id: 'h', label: 'Hilda', kind: 'hero',
  characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 20, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 35, sociabilite: 30 },
  wounds: { current: 12, max: 12 }, advantage: 0, conditions: [], skills: [], talents: [],
  weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
  items: [], movement: 4, ...p,
} as Combatant);

function sceneA(): Scene { const s = emptyScene(10, 10); s.id = 'lieu-a-scene'; s.label = 'A'; return s; }
function sceneB(): Scene { const s = emptyScene(10, 10); s.id = 'lieu-b-scene'; s.label = 'B'; return s; }
function map(km = 16): WorldMap {
  return { id: 'c', label: 'c', places: [
    { id: 'pa', label: 'A', pos: { x: 20, y: 50 }, scene: 'lieu-a-scene' },
    { id: 'pb', label: 'B', pos: { x: 70, y: 40 }, scene: 'lieu-b-scene' },
  ], routes: [{ id: 'r1', a: 'pa', b: 'pb', km, modes: ['pied'], perilDie: 0 }] };
}
function setup(km = 16, party: Combatant[] = [hero()]): void {
  useGame.setState({ party, gameTime: campaignStart(), travelPlan: null, pendingRest: null, pendingCascade: null, travelRecap: null, journal: [] });
  get().loadProject({ scenes: [sceneA(), sceneB()], entryId: 'lieu-a-scene', worldMap: map(km), projet: null });
  useGame.setState({ gameTime: campaignStart() });
}

beforeEach(() => { seedBattleRng(1); });
afterEach(() => { resetRule('travel-sleep-forced'); resetRule('travel-departure-gate'); resetRule('sea-night-sailing'); });

describe('#340 / #2533 — budget d’heures PAR JOUR CALENDAIRE (LDB 51 l.195)', () => {
  // `LDB 51 l.195` — le groupe ne dépasse le budget que s'il l'a CHOISI au départ (case « marche forcée »).
  it('case NON cochée : un 2ᵉ tronçon le même jour s’arrête au budget de 6 h — halte, aucun Test de marche forcée', () => {
    // À pied, 4 km/h (Mouvement 4). Route 16 km = 4 h par trajet.
    setup(16);

    // Trajet 1 (08:00 → 12:00) : cumul 4 h.
    get().startTravel('r1', 'pied');
    expect(get().travelDayHours.foot).toBeCloseTo(4, 1);

    // Trajet 2 : il RESTE 2 h au jour — le groupe marche 2 h (8 km) puis fait halte.
    get().startTravel('r1', 'pied');
    expect(get().travelDayHours.foot).toBeCloseTo(6, 1);
    expect(get().travelPlan?.kmDone).toBeCloseTo(8, 1);
    expect(get().travelDayHours.marched).toBe(false);
    const halte = get().pendingRest!;
    expect(halte.travelHalt).toBe(true);
    expect(halte.travelMarch ?? []).toEqual([]); // aucun Test de Résistance : 6 h n'ont pas été dépassées
  });

  it('case NON cochée, budget du jour déjà épuisé au DÉPART d’un tronçon : nuit sur place, aucun jour de 0 h', () => {
    setup(24);
    get().startTravel('r1', 'pied'); // 24 km = 6 h : arrivée, budget du jour épuisé
    expect(get().travelDayHours.foot).toBeCloseTo(6, 1);
    const t0 = get().gameTime;
    const sceneArrivee = get().scene?.id;
    get().startTravel('r1', 'pied');
    expect(get().gameTime).toBe(t0); // aucune minute de marche
    expect(get().travelPlan).toBeNull(); // aucun « Étape 0 »
    expect(get().pendingCascade).toBeNull(); // ni météo ni péripétie d'un jour vide
    expect(get().pendingDeparture?.cause).toBe('budget');
    get().departWaitDawn(); // patron de la porte de départ : la nuit se passe SUR PLACE
    const nuit = get().pendingRest!;
    expect(nuit.lieu).toBe(sceneLieu(get));
    expect(nuit.travelHalt).toBeFalsy();
    expect(get().scene?.id).toBe(sceneArrivee);
  });

  it('case COCHÉE : Test au-delà de 6 h CUMULÉES, un seul par jour', () => {
    setup(16);
    const forcee = maxHoursPerDay(get().worldMap); // ce que la case envoie (`WorldMapView`)
    get().startTravel('r1', 'pied', { hoursPerDay: forcee }); // 4 h
    expect(get().travelDayHours.marched).toBe(false);

    // Trajet 2 : cumul 8 h > 6 h → marche forcée TESTÉE, marquée pour le jour.
    get().startTravel('r1', 'pied', { hoursPerDay: forcee });
    expect(get().travelDayHours.foot).toBeCloseTo(8, 1);
    expect(get().travelDayHours.marched).toBe(true);

    // Trajet 3 : il reste 2 h à l'allure choisie → halte de nuit ; pas de second Test ce jour-là.
    get().startTravel('r1', 'pied', { hoursPerDay: forcee });
    expect(get().travelDayHours.foot).toBeCloseTo(forcee, 1);
    expect(get().pendingRest?.travelHalt).toBe(true);
    expect(get().pendingRest?.travelMarch ?? []).toEqual([]);
  });

  it('le budget est remis à neuf au jour calendaire suivant', () => {
    setup(16);
    const forcee = maxHoursPerDay(get().worldMap);
    get().startTravel('r1', 'pied', { hoursPerDay: forcee }); // 4 h
    get().startTravel('r1', 'pied', { hoursPerDay: forcee }); // cumul 8 h, même jour
    expect(get().travelDayHours.foot).toBeCloseTo(8, 1);
    const day0 = get().travelDayHours.day;

    // Une nuit jouée fait passer au jour suivant → l'accumulateur repart de zéro au prochain trajet.
    get().restParty(1);
    get().startTravel('r1', 'pied');
    expect(get().travelDayHours.day).toBe(dayIndex(get().gameTime));
    expect(get().travelDayHours.day).not.toBe(day0);
    expect(get().travelDayHours.foot).toBeCloseTo(4, 1); // seul le trajet du nouveau jour compte
  });
});

describe('#340 — porte d’heure de départ (terre & fleuve, maison ON par défaut)', () => {
  it('départ à pied de nuit (23:00) → porte « Attendre l’aube » (aucun trajet lancé)', () => {
    setup(16);
    useGame.setState({ gameTime: campaignStart() + 15 * 60 }); // 08:00 + 15 h = 23:00 (nuit)
    get().startTravel('r1', 'pied');
    expect(get().travelPlan).toBeNull();
    expect(get().pendingDeparture).not.toBeNull();
    expect(get().pendingDeparture!.mode).toBe('pied');
    expect(get().pendingDeparture!.dawnAt).toBeGreaterThan(get().gameTime); // prochain départ possible = l'aube

    // « Attendre l'aube » : joue une nuit (repos) et lève la porte.
    get().departWaitDawn();
    expect(get().pendingDeparture).toBeNull();
    expect(get().pendingRest).not.toBeNull();
  });

  it('en plein jour (08:00) le départ passe la porte normalement', () => {
    setup(16);
    get().startTravel('r1', 'pied');
    expect(get().pendingDeparture).toBeNull();
    // trajet court d'un jour → arrivée (plus de plan) ou halte, mais jamais bloqué par la porte.
    expect(get().travelDayHours.foot).toBeGreaterThan(0);
  });

  it('porte débrayable : désactivée, un départ de nuit part directement', () => {
    setRule('travel-departure-gate', false);
    setup(16);
    useGame.setState({ gameTime: campaignStart() + 15 * 60 });
    get().startTravel('r1', 'pied');
    expect(get().pendingDeparture).toBeNull();
  });
});

describe('#340 — nuit forcée (privation de sommeil, maison, défaut ON [arbitrage user 2026-07-11])', () => {
  it('ACTIVÉE PAR DÉFAUT : jour calendaire franchi SANS nuit jouée → +1 Exténué « privation de sommeil »', () => {
    setup(16);
    useGame.setState({ gameTime: campaignStart(), lastNightDay: dayIndex(campaignStart()), lastUpkeepDay: dayIndex(campaignStart()) });
    const before = stacks(get().party[0], 'extenue');
    get().advanceTime(24 * 60); // franchit un jour sans dormir
    expect(stacks(get().party[0], 'extenue')).toBeGreaterThan(before);
  });

  it('débrayable : désactivée, franchir un jour sans dormir ne coûte pas d’Exténué', () => {
    setRule('travel-sleep-forced', false);
    setup(16);
    useGame.setState({ gameTime: campaignStart(), lastNightDay: dayIndex(campaignStart()), lastUpkeepDay: dayIndex(campaignStart()) });
    const before = stacks(get().party[0], 'extenue');
    get().advanceTime(24 * 60);
    expect(stacks(get().party[0], 'extenue')).toBe(before);
  });
});

describe('#340 — voguer de nuit (÷2 mer, MDG 15 l.76) câblé sur une règle maison', () => {
  it('la capacité de navigation nocturne est portée par `sea-night-sailing` (défaut ON)', () => {
    expect(rule('sea-night-sailing')).toBe(true); // navire équipé pour la nuit → distance pleine
    setRule('sea-night-sailing', false);
    expect(rule('sea-night-sailing')).toBe(false); // OFF → seaMilesPerDay(m, false) applique le ÷2
  });
});
