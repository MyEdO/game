/**
 * #2533 — les écrans du voyage terrestre disent vrai : la halte nomme son lieu et joue l'Exposition sous
 * la météo du JOUR, la durée du récapitulatif est l'heure écoulée, le jour clos n'a qu'une carte, et le
 * d10 des péripéties passe par la porte des jets.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { seedBattleRng } from './battleRng';
import { emptyScene, type Scene } from './monde/scene';
import { buildEncounter } from './monde/encounterAuthoring';
import type { MapRouteTrace, WorldMap } from './worldMap';
import { campaignStart, toDate } from '../engine/clock';
import { setRule, resetRule, rule } from '../engine/policy';
import { setDesFixes, resetDesFixes } from '../engine/fixedDie';
import { resetCadence } from '../engine/cadence';
import { seasonOfMonth } from '../engine/travelStages';
import { t } from '../i18n';
import { activeDayWeather, activeExposureSeverity } from './combatFlow';
import { tableSpec, tableStepDef } from './cascade';
import { draineCascade } from './cascade.testkit';
import { creditBourse } from './bourseFlow';
import { sceneLieu } from './restFlow';
import { PERIPETIES, peripetieSeuilDie } from '../data/peripeties';
import type { Combatant } from '../engine/types';
import { blessuresSurLeProfil, blessuresDeBase } from '../engine/combattantDeTest.testkit';
import type { Ecrit } from './proprietaireDuJeu';
import { ouvrirLeBanc, type Banc } from './banc.testkit';

let banc: Banc;
beforeEach(() => {
  banc = ouvrirLeBanc();
});

const get = () => banc.getState();
const set = (e: Ecrit) => banc.setState(e);

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

/** Les `kind` des étapes de la NUIT de halte, couchage dehors et sans repas. */
function etapesDeLaNuit(): string[] {
  get().fenetreChoisir('repos', 'couchage', 'dehors', 'h'); get().fenetreChoisir('repos', 'pitance', 'rien', 'h');
  get().fenetreValider('repos');
  return get().pendingCascade?.participants.map((s) => s.kind) ?? [];
}

beforeEach(() => { seedBattleRng(1); resetDesFixes(); resetCadence(); });
afterEach(() => { resetDesFixes(); resetCadence(); resetRule('voyage-etapes'); resetRule('voyage-attraper-froid'); });

describe('#2533 (1) — halte de voyage : le lieu de la ROUTE, la météo du JOUR', () => {
  it('la halte nomme la route du voyage, jamais la scène de départ — relais ou bivouac', () => {
    for (const inns of [true, false]) {
      setup(map({ inns }));
      get().partirEnVoyage('r1', 'pied'); // 30 km à 4 km/h : 6 h, puis la nuit
      const halte = get().pendingRest!;
      expect(halte.travelHalt).toBe(true);
      expect(halte.lieu).toBe('Weiler → Federholz');
    }
  });

  it('la forme de l’en-tête de voyage, « {from} → {to} » : les libellés gardent leur article et leur majuscule', () => {
    const carte = map();
    carte.places[0] = { ...carte.places[0], label: 'Auberge La Diligence' };
    carte.places[1] = { ...carte.places[1], label: 'La route principale' };
    setup(carte);
    get().partirEnVoyage('r1', 'pied');
    expect(get().pendingRest!.lieu).toBe('Auberge La Diligence → La route principale');
  });

  it('Étapes allumées : la nuit joue l’Exposition sous la météo POSÉE du jour, pas sous celle de la scène de départ', () => {
    setRule('voyage-etapes', true);
    setDesFixes(true);
    setup(map(), 'clair');
    get().partirEnVoyage('r1', 'pied');
    poseMeteo('pluie-diluvienne');
    draineCascade(get);
    expect(get().pendingRest?.travelHalt).toBe(true);
    expect(activeExposureSeverity(get)).toBe('extreme');
    expect(etapesDeLaNuit(), 'abri de fortune sous l’averse du jour').toContain('abri-de-fortune');
  });

  it('test opposé, Étapes allumées : beau temps posé sur la route, tempête sur la scène de départ — aucune Exposition', () => {
    setRule('voyage-etapes', true);
    setDesFixes(true);
    setup(map(), 'tempete');
    get().partirEnVoyage('r1', 'pied');
    poseMeteo('beau');
    draineCascade(get);
    expect(activeExposureSeverity(get)).toBe('clement');
    expect(etapesDeLaNuit()).not.toContain('abri-de-fortune');
  });

  it('Étapes éteintes (défaut) : la route n’a pas de météo, la nuit lit la scène de départ (#2533 c.6071899887)', () => {
    setup(map(), 'tempete');
    get().partirEnVoyage('r1', 'pied');
    expect(rule('voyage-etapes')).toBe(false);
    expect(get().pendingRest?.travelHalt).toBe(true);
    expect(get().travelPlan?.log?.[0]?.weather).toBeUndefined();
    expect(activeExposureSeverity(get)).toBe('extreme');
  });
});

describe('#2533 — interruption puis reprise à budget nul : le jour interrompu est FINI, la halte suit', () => {
  it('l’embuscade se joue sous la météo du jour ; la reprise clôt ce jour au log, puis la halte du soir', () => {
    setRule('voyage-etapes', true);
    setDesFixes(true);
    setup(map({ km: 60, perils: [{ label: 'Brigands sur la route !', chancePct: 100, effects: [{ type: 'startCombat', encounter: 'enc-brigands' }] }] }), 'clair');
    get().partirEnVoyage('r1', 'pied');
    poseMeteo('pluie-diluvienne');
    draineCascade(get);
    expect(get().travelPlan?.interrupted).toBe(true);
    expect(activeDayWeather(get), 'le jour interrompu garde sa météo').toBe('pluie-diluvienne');
    get().fenetreFermer('recitDeVoyage'); // « Faire face » : le combat s'ouvre
    expect(get().battle!.combatants.every((c) => c.envWeather === 'pluie-diluvienne'), 'l’embuscade lit la météo du jour').toBe(true);

    // Victoire simulée, puis reprise le MÊME jour : les 6 h sont marchées (LDB 51 l.195).
    set({ battle: null, mode: 'exploration' });
    const wm = get().worldMap!;
    set({ worldMap: { ...wm, routes: wm.routes.map((r) => ({ ...r, perils: [] })) } });
    get().reprendreLeVoyage();
    expect(get().pendingCascade, 'aucun jour de 0 h : ni météo ni péripétie').toBeNull();
    expect(get().pendingRest?.travelHalt).toBe(true);
    const log = get().travelPlan!.log!;
    expect(log, 'la reprise a clos le jour interrompu au log').toHaveLength(1);
    expect(log[0].weather?.id).toBe('pluie-diluvienne');
    expect(log[0].hours).toBeCloseTo(6, 1);
    expect(activeExposureSeverity(get), 'la nuit passe sous l’averse du jour, pas sous le ciel clair du départ').toBe('extreme');
  });
});

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

  it('un repos déjà ouvert refuse la halte : le jour interrompu reste au log quand même', () => {
    const jour = jourInterrompu();
    get().offrirLeRepos({ lieu: sceneLieu(get), places: { camp: true } });
    get().reprendreLeVoyage();
    const plan = get().travelPlan!;
    expect(plan.log, 'le jour interrompu est perdu si sa clôture attend `ouvrirLeRepos`').toEqual([jour]);
    expect(plan.recap).toBeUndefined();
  });
});

describe('#2533 — reprise d’un jour interrompu : le jour interrompu est FINI, une journée NEUVE part', () => {
  afterEach(() => { resetRule('voyage-allures'); });

  /** Embuscade du jour, « Faire face », victoire simulée et péril d'auteur neutralisé. */
  function interromptPuisVainc(): void {
    draineCascade(get);
    expect(get().travelPlan?.interrupted).toBe(true);
    get().fenetreFermer('recitDeVoyage');
    set({ battle: null, mode: 'exploration' });
    const wm = get().worldMap!;
    set({ worldMap: { ...wm, routes: wm.routes.map((r) => ({ ...r, perils: [] })) } });
  }
  const brigands = [{ label: 'Brigands sur la route !', chancePct: 100, effects: [{ type: 'startCombat' as const, encounter: 'enc-brigands' }] }];

  it('transport (diligence), reprise le même jour : le jour interrompu entre au log, la journée neuve a sa météo', () => {
    setRule('voyage-etapes', true);
    setup(map({ km: 200, modes: ['diligence', 'pied'], perils: brigands }));
    creditBourse(get, set, 'h', { gold: 5, silver: 0, brass: 0 });
    get().partirEnVoyage('r1', 'diligence', { classeId: 'exterieur' });
    interromptPuisVainc();
    const jours = get().travelPlan!.recap!.days;
    const jourInterrompu = jours[jours.length - 1];
    get().reprendreLeVoyage();
    const log = get().travelPlan!.log!;
    expect(log, 'le jour interrompu est clos, tel quel').toEqual([jourInterrompu]);
    expect(get().pendingCascade?.participants[0].kind, 'la journée neuve tire sa Météo d’Étape').toBe('etape-meteo');
  });

  it('à pied, nuit passée en scène puis reprise : une carte = un jour, la journée neuve a sa météo', () => {
    setRule('voyage-etapes', true);
    setup(map({ km: 60, perils: brigands }));
    get().partirEnVoyage('r1', 'pied');
    interromptPuisVainc();
    get().offrirLeRepos({ lieu: sceneLieu(get), places: { camp: true } });
    get().fenetreValider('repos');
    draineCascade(get);
    get().reprendreLeVoyage();
    const log = get().travelPlan!.log!;
    expect(log).toHaveLength(1);
    expect(log[0].hours).toBeLessThanOrEqual(6.01);
    expect(get().pendingCascade?.participants[0].kind).toBe('etape-meteo');
  });

  it('allure forcée, conducteur joueur : la journée neuve ouvre la Conduite d’attelage à la porte, aucun Test roulé hors porte', () => {
    setRule('voyage-allures', true);
    setup(map({ km: 300, modes: ['diligence', 'pied'], perils: brigands }), undefined,
      [hero({ skills: [{ id: 'conduite-d-attelage', advances: 60 }] } as Partial<Combatant>)]);
    creditBourse(get, set, 'h', { gold: 500, silver: 0, brass: 0 });
    get().partirEnVoyage('r1', 'diligence', { allure: 'galop' });
    const premierPas = get().pendingCascade!.participants[0].kind;
    interromptPuisVainc();
    const nJournal = get().journal.length;
    get().reprendreLeVoyage();
    const roulesHorsPorte = get().journal.slice(nJournal).filter((l) => /attelage/i.test(l));
    expect(roulesHorsPorte).toEqual([]);
    expect(get().pendingCascade?.participants[0].kind, 'la journée neuve rouvre le jet du conducteur').toBe(premierPas);
    expect(get().travelPlan!.log).toHaveLength(1);
  });
});

describe('#2533 — Plein air réussi dispense la nuit de son Exposition (EDOC 08 l.141)', () => {
  function journeeSousLAverse(issue: number): string[] {
    setRule('voyage-etapes', true);
    setRule('voyage-attraper-froid', true);
    setDesFixes(true);
    setup(map(), 'clair', [hero({ travelRole: { activityId: 'plein-air' } })]);
    get().partirEnVoyage('r1', 'pied');
    poseMeteo('pluie-diluvienne');
    const jour: string[] = [];
    draineCascade(get, 200, (step) => { jour.push(step.kind); return step.table || step.de ? undefined : issue; });
    expect(get().pendingRest?.travelHalt).toBe(true);
    return jour;
  }

  it('réussite : ni Exposition de fin d’Étape, ni Exposition de nuit', () => {
    const jour = journeeSousLAverse(1);
    expect(jour).not.toContain('etapeExposition');
    expect(get().travelPlan!.log![0].pleinAir).toBe(true);
    expect(activeExposureSeverity(get)).toBe('clement');
    const nuit = etapesDeLaNuit();
    expect(nuit).not.toContain('abri-de-fortune');
    expect(nuit).not.toContain('exposition-nocturne');
  });

  it('test opposé, échec : les deux Expositions se jouent (LDB 18 l.328, EDOC 08 l.90)', () => {
    const jour = journeeSousLAverse(100);
    expect(jour).toContain('etapeExposition');
    expect(get().travelPlan!.log![0].pleinAir).toBeUndefined();
    expect(activeExposureSeverity(get)).toBe('extreme');
    expect(etapesDeLaNuit()).toContain('abri-de-fortune');
  });
});

describe('#2533 (2) — durée RÉELLE du récapitulatif : arrivée moins départ', () => {
  it('2 h 40 de route : 160 minutes, pas « 1 jour »', () => {
    setup(map({ km: 8, speed: { pied: 3 } })); // 8 km à 3 km/h
    get().partirEnVoyage('r1', 'pied');
    expect(get().travelRecap?.status).toBe('arrived');
    expect(get().travelRecap?.dureeMin).toBe(160);
  });

  it('deux jours de route : la durée écoulée, nuit et attente de l’aube comprises', () => {
    setup(map());
    const t0 = get().gameTime;
    get().partirEnVoyage('r1', 'pied');
    get().fenetreValider('repos');
    draineCascade(get);
    expect(get().travelRecap?.status).toBe('arrived');
    expect(get().travelRecap?.dureeMin).toBe(get().gameTime - t0);
    expect(get().travelRecap!.dureeMin!).toBeGreaterThan(24 * 60 - 6 * 60);
  });
});

describe('#2533 (5) — péripéties : le dé de seuil passe par la porte des jets (LDB 51 l.208)', () => {
  it('jour sans événement : la rangée montre le dé POSÉ et « aucune péripétie »', () => {
    setDesFixes(true);
    setup(map({ perilDie: 8 }));
    get().partirEnVoyage('r1', 'pied');
    const seuil = get().pendingCascade!.participants.find((s) => s.kind === 'perilATerre')!;
    expect(seuil.worldOwner).toBe(true);
    expect(tableSpec(seuil.table!), 'le dé de seuil est celui de la donnée (`peripeties.json › tirageQuotidien`)').toEqual(peripetieSeuilDie());
    expect(seuil.table!.result, 'le socle ne tire pas à la place du siège qui possède le monde').toBeUndefined();
    get().jetImposerLeResultat('cascadeTirage', 3, seuil.id);
    const tire = get().pendingCascade!.participants.find((s) => s.id === seuil.id)!.table!.result!;
    expect(tire.roll).toBe(3);
    expect(tire.lines).toEqual([t('tf.sansPeril')]);
    draineCascade(get);
    expect(get().pendingRest?.travelHalt).toBe(true);
    expect(get().travelPlan!.log![0].lines.some((l) => l.text === t('tf.sansPeril'))).toBe(true);
  });

  it('dé posé sur le seuil : la table des péripéties s’insère, son dé passe aussi par la porte', () => {
    setDesFixes(true);
    setup(map({ perilDie: 8 }));
    get().partirEnVoyage('r1', 'pied');
    const seuil = get().pendingCascade!.participants.find((s) => s.kind === 'perilATerre')!;
    get().jetImposerLeResultat('cascadeTirage', 8, seuil.id);
    get().jetValider('cascade');
    const table = get().pendingCascade!.participants.find((s) => s.kind === 'perilATerreTable')!;
    expect(table, 'le seuil atteint insère la table des péripéties').toBeTruthy();
    expect(table.worldOwner, 'aucun acteur ne la porte : le sentinel la route au siège').toBe(true);
    expect(table.table!.result).toBeUndefined();
    const narratif = PERIPETIES.find((p) => p.kind === 'narratif')!;
    get().jetImposerLeResultat('cascadeTirage', narratif.roll, table.id);
    expect(get().pendingCascade!.participants.find((s) => s.id === table.id)!.table!.result!.id).toBe(narratif.id);
    draineCascade(get);
    expect(get().journal.join('\n')).toContain(narratif.label);
  });
});
