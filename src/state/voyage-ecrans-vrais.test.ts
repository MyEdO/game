/**
 * #2533 — les écrans du voyage terrestre disent vrai : la halte nomme son lieu et joue l'Exposition sous
 * la météo du JOUR, la durée du récapitulatif est l'heure écoulée, le jour clos n'a qu'une carte, et le
 * d10 des péripéties passe par la porte des jets. Ici, les cartes de jour de l'écran (`voyageDayCards`) ; le reste se
 * joue au banc du noyau (`src/noyau/voyage-ecrans-vrais.hors-store.test.ts`).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useGame } from './store';
import { seedBattleRng } from '../noyau/battleRng';
import { emptyScene, type Scene } from '../noyau/monde/scene';
import { buildEncounter } from '../noyau/monde/encounterAuthoring';
import type { MapRouteTrace, WorldMap } from '../noyau/worldMap';
import { campaignStart, toDate } from '../engine/clock';
import { setRule, resetRule } from '../engine/policy';
import { setDesFixes, resetDesFixes } from '../engine/fixedDie';
import { resetCadence } from '../engine/cadence';
import { seasonOfMonth } from '../engine/travelStages';
import { t } from '../i18n';
import { activeDayWeather } from '../noyau/combatFlow';
import { tableStepDef } from '../noyau/cascade';
import { voyageDayCards } from '../ui/VoyageScreen';
import { draineCascade } from '../noyau/cascade.testkit';
import type { Combatant } from '../engine/types';
import { blessuresSurLeProfil, blessuresDeBase } from '../engine/combattantDeTest.testkit';

const get = () => useGame.getState();
const set = useGame.setState;

const hero = (p: Partial<Combatant> = {}): Combatant => (blessuresSurLeProfil({
  id: 'h', label: 'Hilda', kind: 'heros',
  characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 40, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 35, sociabilite: 30 },
  wounds: blessuresDeBase(12), advantage: 0, conditions: [], skills: [], talents: [],
  weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
  items: [], movement: 4, ...p,
}) as Combatant);

/** Les SCÈNES portent un autre nom que les LIEUX de la carte : la halte ne doit nommer aucune scène. */
function scene(id: string, label: string, weather?: Scene['weather']): Scene {
  const s = emptyScene('scene-test', 10, 10);
  s.id = id;
  s.label = label;
  if (weather) s.weather = weather;
  const enc = buildEncounter({
    id: 'enc-brigands',
    enemies: [{ statblock: { type: 'statblock', label: 'Brigand', char: { 'capacite-de-combat': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, B: 8 } }, pos: { x: 5, y: 5 } }],
  });
  s.entities.push(...enc.entities);
  s.encounters = [enc.encounter];
  return s;
}
function map(route: Partial<MapRouteTrace> = {}): WorldMap {
  return {
    id: 'carte', label: 'Carte',
    places: [
      { id: 'pa', label: 'Weiler', pos: { x: 20, y: 50 }, scene: { id: 'scene-depart' } },
      { id: 'pb', label: 'Federholz', pos: { x: 70, y: 40 }, scene: { id: 'scene-arrivee' } },
    ],
    routes: [{ id: 'r1', a: { id: 'pa' }, b: { id: 'pb' }, km: 30, modes: ['pied'], perilDie: 0, ...route }],
  };
}
function setup(worldMap: WorldMap, departWeather?: Scene['weather'], party: Combatant[] = [hero()]): void {
  set({ party, travelPlan: null, pendingRest: null, pendingCascade: null, travelRecap: null, journal: [], battle: null });
  get().chargerLeProjet({ scenes: [scene('scene-depart', 'Cour du relais de départ', departWeather), scene('scene-arrivee', 'Place de Federholz')], entryId: 'scene-depart', worldMap, projet: null });
  set({ gameTime: campaignStart() });
}

/** POSE le dé de Météo d'Étape (« Dés fixés ») sur la rangée `id` de la table de la saison courante. */
function poseMeteo(id: string): void {
  const meteo = get().pendingCascade!.participants.find((s) => s.kind === 'etape-meteo')!;
  const saison = seasonOfMonth(toDate(get().gameTime).month);
  const rangee = tableStepDef(`stage-weather-${saison}`)!.rows.find((r) => r.id === id)!;
  get().jetImposerLeResultat('cascadeTirage', rangee.min, meteo.id);
}

beforeEach(() => { seedBattleRng(1); resetDesFixes(); resetCadence(); });
afterEach(() => { resetDesFixes(); resetCadence(); resetRule('voyage-etapes'); resetRule('voyage-attraper-froid'); });

describe('#2533 — la reprise clôt le jour interrompu au log, avant toute halte (2026-10-09 01:51)', () => {
  /** Interruption à pied sous l'averse (6 h marchées), victoire simulée : rend le jour interrompu. */
  function jourInterrompu(): unknown {
    setRule('voyage-etapes', true);
    setDesFixes(true);
    setup(map({ km: 60, perils: [{ label: 'Brigands !', chancePct: 100, effects: [{ type: 'startCombat', encounter: 'enc-brigands' }] }] }), 'clair');
    get().partirEnVoyage('r1', 'pied');
    poseMeteo('pluie-diluvienne');
    draineCascade(get);
    const jours = get().travelPlan!.recap!.days;
    const jour = structuredClone(jours[jours.length - 1]);
    get().fenetreFermer('recitDeVoyage');
    set({ battle: null, mode: 'exploration' });
    const wm = get().worldMap!;
    set({ worldMap: { ...wm, routes: wm.routes.map((r) => ({ ...r, perils: [] })) } });
    return jour;
  }

  it('budget nul : le jour interrompu est le dernier du log, `recap` effacé, halte de route sans marche forcée', () => {
    const jour = jourInterrompu();
    get().reprendreLeVoyage();
    const plan = get().travelPlan!;
    const halte = get().pendingRest!;
    expect(plan.log).toEqual([jour]);
    expect(plan.recap).toBeUndefined();
    expect(get().pendingCascade).toBeNull();
    expect(halte.travelHalt).toBe(true);
    expect(halte.travelMarch).toEqual([]);
    expect(activeDayWeather(get)).toBe('pluie-diluvienne');
    expect(voyageDayCards(plan, 'terre', 'Étape', true, [], true).map((c) => c.dayLabel)).toEqual(['Étape 1', t('vs.phaseNuit')]);
  });
});

describe('#2533 (4) — un jour, une carte', () => {
  it('halte : le jour clos vit dans `plan.log` seul — UNE carte pour lui, puis la Nuit', () => {
    setup(map());
    get().partirEnVoyage('r1', 'pied');
    const plan = get().travelPlan!;
    expect(plan.log).toHaveLength(1);
    const cards = voyageDayCards(plan, 'terre', 'Étape', true, [], !!get().pendingRest?.travelHalt);
    expect(cards.map((c) => c.dayLabel)).toEqual(['Étape 1', 'Nuit']);
  });
});

