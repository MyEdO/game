/**
 * VOYAGE TERRESTRE (LDB « Voyage » + EDOC 8 « Voyage par Étapes ») — la journée de route JOUÉE.
 * Depuis la Phase B, TOUS les jets du JOUR terrestre (Activités de l'Étape, Exposition de fin d'Étape,
 * péripéties Survie/Perception) passent par la MÊME cascade influençable (`purpose:'travelDay'`,
 * Chance/Pacte/Résilience) que le voyage fluvial et la nuit — aucune auto-résolution inline. La cascade
 * du jour se clôt sur le calcul de la progression puis enchaîne la halte
 * de nuit / l'arrivée. La marche forcée reste une étape de la cascade de NUIT (inchangée).
 */
import { resolveStake, weather } from '../data';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useGame } from './store';
import { seedBattleRng } from './battleRng';
import { makeRNG } from '../engine/dice';
import { findTableEntry } from '../engine/tables';
import { stageWeatherRows } from './travelFlow';
import { emptyScene, Scene } from './scene';
import { buildEncounter } from './encounterAuthoring';
import { WorldMap } from './worldMap';
import { campaignStart } from '../engine/clock';
import { setRule, resetRule } from '../engine/policy';
import { buildWeatherResistanceSteps, buildStageSteps } from './travelPostes';
import { seasonOfMonth, weatherFromRoll, type Season } from '../engine/travelStages';
import { toDate } from '../engine/clock';
import { creditBourse } from './bourseFlow';
import { DIFFICULTY_MODIFIERS, type Combatant, type ItemInstance } from '../engine/types';
import { cascadeAppliers, rollTableStep } from './cascade';
import { inexplique, soutienDe, draineCascade, avanceEtapeCascade } from './cascadeTestKit';
import { skillBaseValue, testValue, soutienDetail, partyAssisted } from '../engine/skills';
import { objetDeTest } from '../engine/objetDeTest.testkit';

const get = () => useGame.getState();
const set = useGame.setState;

const ration = (uid: string): ItemInstance => (objetDeTest({ uid, trappingId: 'ration', kind: 'misc', qualities: [], enc: 0, equipped: false }));
const hero = (p: Partial<Combatant> = {}): Combatant => ({
  id: 'h', label: 'Hilda', kind: 'hero',
  characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 40, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 35, sociabilite: 30 },
  wounds: { current: 12, max: 12 }, advantage: 0, conditions: [], skills: [], talents: [],
  weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
  items: [], movement: 4, ...p,
} as Combatant);
function sceneA(): Scene {
  const s = emptyScene(10, 10); s.id = 'lieu-a-scene'; s.label = 'A';
  const enc = buildEncounter({ id: 'enc-test', enemies: [{ statblock: { type: 'statblock', label: 'Brigand', char: { 'capacite-de-combat': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, B: 8 } }, pos: { x: 5, y: 5 } }] });
  s.entities.push(...enc.entities); s.encounters = [enc.encounter];
  return s;
}
function sceneB(): Scene { const s = emptyScene(10, 10); s.id = 'lieu-b-scene'; s.label = 'B'; return s; }
function map(rp: Partial<WorldMap['routes'][0]> = {}): WorldMap {
  return { id: 'c', label: 'c', places: [
    { id: 'pa', label: 'A', pos: { x: 20, y: 50 }, scene: 'lieu-a-scene' },
    { id: 'pb', label: 'B', pos: { x: 70, y: 40 }, scene: 'lieu-b-scene' },
  ], routes: [{ id: 'r1', a: 'pa', b: 'pb', km: 12, modes: ['pied'], perilDie: 0, ...rp }] };
}
function setup(wm: WorldMap, party: Combatant[]) {
  useGame.setState({ party, gameTime: campaignStart(), travelPlan: null, pendingRest: null, pendingCascade: null, travelRecap: null, journal: [] });
  get().loadProject([sceneA(), sceneB()], 'lieu-a-scene', wm);
  useGame.setState({ gameTime: campaignStart() });
}

/** Déroule la cascade OUVERTE (jour ou nuit) — pilote PARTAGé `cascadeTestKit.draineCascade`. */
function drainCascade(): void {
  draineCascade(get);
}
/** Va au bout d'un voyage : draine cascades du jour, dort les haltes, jusqu'à l'arrivée (ou blocage). */
function runToEnd(maxSteps = 60): void {
  for (let i = 0; i < maxSteps; i++) {
    if (get().pendingCascade) { drainCascade(); continue; }
    if (get().pendingRest) { get().restSleep(); drainCascade(); continue; }
    if (!get().travelPlan) return;
  }
}

beforeEach(() => { seedBattleRng(1); });
afterEach(() => { resetRule('travel-etapes'); resetRule('travel-attraper-froid'); });

// ─────────────────────────────────────────────────────────────────────────────────────────────
// (b) INFLUENCE : les jets du JOUR terrestre sont des étapes influençables d'une cascade travelDay.
// ─────────────────────────────────────────────────────────────────────────────────────────────
describe('cascade du JOUR terrestre — les jets d’Étape sont influençables (purpose travelDay)', () => {
  beforeEach(() => setRule('travel-etapes', true));

/** Franchit la Météo d'Étape — étape à TABLE en tête du jour (#1426) dont l'applier INSÈRE les pas qui
 *  dépendent du temps qu'il fait (Résistance de traversée, postes). Sans elle, la séquence du jour n'a
 *  encore qu'une étape : c'est le dé de monde qui fait exister la suite. En cadence MANUELLE la table
 *  attend sa fenêtre : le pilote partagé (`cascadeTestKit.avanceEtapeCascade`) la LANCE puis valide,
 *  exactement comme le joueur qui voit la rangée et clique. */
function passerLaMeteo(): void {
  if (get().pendingCascade?.participants[get().pendingCascade!.cursor]?.kind !== 'stageWeather') return;
  avanceEtapeCascade(get);
}

  it('la Météo d’Étape déclare la table de SA SAISON, SANS modificateur (#1426)', () => {
    seedBattleRng(1);
    setup(map({ km: 12, perilDie: 0 }), [hero({ travelRole: 'approvisionnement', items: [] })]);
    get().startTravel('r1', 'pied');
    const meteo = get().pendingCascade!.participants.find((st) => st.kind === 'stageWeather')!;
    expect(meteo, 'la Météo est une étape à TABLE de monde').toBeTruthy();
    expect(meteo.worldOwner).toBe(true);
    // La SAISON choisit la TABLE — jamais un `mod` : un décalage saisonnier rendrait des lignes
    // faussement inatteignables à la pose (les N premiers naturels seraient morts).
    const saison = seasonOfMonth(toDate(get().gameTime).month);
    expect(meteo.table!.tableId).toBe(`stage-weather-${saison}`);
    expect(meteo.table!.mod ?? 0).toBe(0);
  });

  it('la rangée APPLIQUÉE est celle que la ligne AFFICHÉE annonce — 100 jets × 4 saisons (#1463 L4)', () => {
    // UN jet, DEUX lectures : l'applier `stageWeather` prend l'id de la rangée trouvée dans les `rows`
    // de la table enregistrée (`step.table.result`), la ligne montrée passe par `weatherFromRoll` (les
    // bornes authorées de `weather.json`). Tant que la borne basse des `rows` était reconstruite par
    // POSITION, éditer un `min` au Codex les faisait diverger sans un mot.
    const rng = makeRNG(1);
    const saisons: Season[] = ['printemps', 'ete', 'automne', 'hiver'];
    for (const s of saisons) {
      for (let jet = 1; jet <= 100; jet++) {
        const applique = rollTableStep({ tableId: `stage-weather-${s}`, forcedRoll: jet }, rng).id;
        expect(applique, `saison ${s}, jet ${jet} : la rangée appliquée n’est pas celle qu’annonce la ligne affichée`).toBe(
          weatherFromRoll(jet, s),
        );
      }
    }
  });

  it('les bornes des rangées de la table sont AUTHORÉES, jamais reconstruites par position (#1463 L4)', () => {
    // La donnée réelle est écrite dans l'ordre croissant : une borne basse reconstruite par position y
    // rendrait les MÊMES chiffres — c'est ce qui la rendait indétectable. On mesure donc la
    // construction sur une saison RÉORDONNÉE (ce que le Codex permet) : la rangée trouvée doit rester
    // celle que la fourchette authorée désigne.
    for (const saison of weather) {
      const desordre = [...saison.ranges].reverse();
      const rows = stageWeatherRows(desordre);
      for (let jet = 1; jet <= 100; jet++) {
        expect(findTableEntry(rows, jet).id, `saison ${saison.id}, jet ${jet}`).toBe(findTableEntry(desordre, jet).weather);
      }
    }
  });

  it('les postes AVEC Test = UN pas BATCH (arbitrage user : jets indépendants), une rangée par héros', () => {
    seedBattleRng(1);
    const h = hero({ travelRole: 'approvisionnement', items: [], skills: [{ id: 'survie-en-exterieur', advances: 40 } as any] });
    setup(map({ km: 12, perilDie: 0 }), [h]);
    get().startTravel('r1', 'pied');
    const pc0 = get().pendingCascade;
    expect(pc0?.purpose).toBe('travelDay'); // le jour ne s'auto-résout plus
    passerLaMeteo();
    const pc = get().pendingCascade;
    const batch = pc!.participants.find((s) => s.kind === 'stagePosteBatch');
    expect(batch?.participants?.length).toBe(1); // une rangée pour le seul héros posté
    const part = batch!.participants![0];
    expect(part.target).toBeGreaterThan(0);
    expect(part.result ?? null).toBeNull(); // pas encore roulé → influençable par rangée
  });

  it('la Résilience force la réussite d’une RANGÉE du batch (mécanisme UNIQUE de cascade)', () => {
    seedBattleRng(5); // seed où l'Approvisionnement échoue (parité : 78/70)
    const h = hero({ id: 'h', travelRole: 'approvisionnement', resilience: 2, items: [], skills: [{ id: 'survie-en-exterieur', advances: 40 } as any] });
    setup(map({ km: 12, perilDie: 0 }), [h]);
    get().startTravel('r1', 'pied');
    expect(get().pendingCascade!.purpose).toBe('travelDay');
    passerLaMeteo();
    const batch = get().pendingCascade!.participants.find((s) => s.kind === 'stagePosteBatch')!;
    get().cascadeBatchForceSuccess(batch.participants![0].id); // Résilience « Je ne faillirai pas ! » par rangée
    const after = get().pendingCascade!.participants.find((s) => s.kind === 'stagePosteBatch')!;
    expect(after.participants![0].result?.success).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────
// (a) GOLDEN RNG à graine fixe : la mise en scène en cascade ne change RIEN aux issues RAW.
//     Valeurs figées par probe à graine fixe.
// ─────────────────────────────────────────────────────────────────────────────────────────────
describe('GOLDEN — issues figées à graine égale', () => {

  it('Approvisionnement seed 1 : fourrage réussi (DR 7), 1 ration reçue', () => {
    setRule('travel-etapes', true);
    seedBattleRng(1);
    const h = hero({ travelRole: 'approvisionnement', items: [], skills: [{ id: 'survie-en-exterieur', advances: 40 } as any] });
    setup(map({ km: 12, perilDie: 0 }), [h]);
    get().startTravel('r1', 'pied');
    drainCascade();
    const st = get();
    expect(st.scene?.id).toBe('lieu-b-scene');
    expect((st.party[0].items ?? []).length).toBe(1); // ration trouvée
    const j = st.journal.join('\n');
    // Le jet est DÉJÀ affiché par la rangée de l'étape (CascadeModal) — succès sans effet PROPRE (le
    // gain de ration vient de l'agrégation de fin d'Étape) → aucune ligne de verdict (#295 Lot 5).
    expect(j).not.toContain('réussi (DR');
    expect(j).toContain('reçoit une ration trouvée en chemin');
  });

  it('Approvisionnement seed 5 : échec 78/70 → Exténué, 0 ration', () => {
    setRule('travel-etapes', true);
    seedBattleRng(5);
    const h = hero({ travelRole: 'approvisionnement', items: [], skills: [{ id: 'survie-en-exterieur', advances: 40 } as any] });
    setup(map({ km: 12, perilDie: 0 }), [h]);
    get().startTravel('r1', 'pied');
    drainCascade();
    const st = get();
    expect((st.party[0].items ?? []).length).toBe(0);
    expect(st.party[0].conditions.some((c) => c.id === 'extenue')).toBe(true);
    // La conséquence est DÉRIVÉE de l'op `condition` appliqué (#295, opConsequenceLine), jamais une
    // chaîne composée « Nom — Activité : Exténué. » : ligne structurée (l'État surfacé sur la rangée).
    expect(st.journal.join('\n')).toContain('État Exténué subi.');
  });

  it('Exposition seed 2 : transi → escalade de froid (3 effets exposition-froid, rang 1)', () => {
    setRule('travel-etapes', true); setRule('travel-attraper-froid', true);
    seedBattleRng(2);
    const h = hero({ travelRole: 'recuperer' });
    setup(map({ km: 12, perilDie: 0 }), [h]);
    get().startTravel('r1', 'pied');
    drainCascade();
    const st = get();
    const eff = (st.party[0].activeEffects ?? []).map((e) => e.effectId);
    expect(eff.filter((e) => e === 'exposition-froid').length).toBe(3); // rang 1 : −10 CT/Ag/Dex
    // Le jet est DÉJÀ affiché par la rangée de l'étape (CascadeModal) — pas de re-print (#295 Lot 5).
    expect(st.journal.join('\n')).toContain("Exposition de fin d'Étape (Pluie) : transi par le froid.");
  });

  it('Péripétie seed 2 : « Voyage éreintant », Survie 29/70 réussie → pas de retard', () => {
    seedBattleRng(2);
    const hh = hero({ items: [ration('r1')], skills: [{ id: 'survie-en-exterieur', advances: 20 } as any, { id: 'perception', advances: 20 } as any] });
    setup(map({ km: 12, perilDie: 8 }), [hh]);
    get().startTravel('r1', 'pied');
    drainCascade();
    const st = get();
    expect(st.scene?.id).toBe('lieu-b-scene');
    expect(st.party[0].conditions.some((c) => c.id === 'extenue')).toBe(false); // Survie réussie → pas d'Exténué
    const j = st.journal.join('\n');
    expect(j).toContain('Voyage éreintant');
    // Le jet est DÉJÀ affiché par la rangée de l'étape (CascadeModal) — pas de re-print (#295 Lot 5).
    expect(j).toContain('Survie en extérieur (+20) : un itinéraire de substitution est trouvé.');
  });

  it('Péripétie seed 3 : « Voyage reposant », soigne toutes les Blessures (routé par applyHealWounds, #473)', () => {
    seedBattleRng(3);
    const h = hero({ wounds: { current: 5, max: 12 } });
    setup(map({ km: 12, perilDie: 8 }), [h]);
    get().startTravel('r1', 'pied');
    drainCascade();
    const st = get();
    expect(st.scene?.id).toBe('lieu-b-scene');
    expect(st.party[0].wounds.current).toBe(12); // soin total (non-régression sans munition logée)
    expect(st.journal.join('\n')).toContain('Hilda récupère toutes ses Blessures.');
  });

  it('Péripétie seed 3 : « Voyage reposant », munition logée plafonne le soin (LDB 62 l.250)', () => {
    seedBattleRng(3);
    const h = hero({ wounds: { current: 5, max: 12 }, conditions: [{ id: 'munition-logee', value: 1 }] });
    setup(map({ km: 12, perilDie: 8 }), [h]);
    get().startTravel('r1', 'pied');
    drainCascade();
    const st = get();
    expect(st.party[0].wounds.current).toBe(11); // plafonné à max−1
    expect(st.journal.join('\n')).toContain('Hilda récupère des Blessures (munition logée bloque le reste).');
  });

  it('Rencontre seed 7 : Succès Impressionnant → « fullRecovery », soigne toutes les Blessures (routé par applyHealWounds, #473)', () => {
    setRule('travel-etapes', true);
    seedBattleRng(7);
    const h = hero({ travelRole: 'approvisionnement', items: [], skills: [{ id: 'survie-en-exterieur', advances: 60 } as any], wounds: { current: 5, max: 12 } });
    setup(map({ km: 12, perilDie: 0 }), [h]);
    get().startTravel('r1', 'pied');
    drainCascade();
    const st = get();
    expect(st.party[0].wounds.current).toBe(12); // soin total (non-régression sans munition logée)
    expect(st.journal.join('\n')).toContain('Voyage tranquille : le groupe récupère toutes ses Blessures et tous ses États Exténué.');
  });

  it('Rencontre seed 7 : « fullRecovery » avec munition logée → soin plafonné (LDB 62 l.250)', () => {
    setRule('travel-etapes', true);
    seedBattleRng(7);
    const h = hero({ travelRole: 'approvisionnement', items: [], skills: [{ id: 'survie-en-exterieur', advances: 60 } as any], wounds: { current: 5, max: 12 }, conditions: [{ id: 'munition-logee', value: 1 }] });
    setup(map({ km: 12, perilDie: 0 }), [h]);
    get().startTravel('r1', 'pied');
    drainCascade();
    const st = get();
    expect(st.party[0].wounds.current).toBe(11); // plafonné à max−1
  });

  it('Rencontre seed 2 : échec d’Approvisionnement → Rencontre dangereuse (texte verbatim)', () => {
    setRule('travel-etapes', true);
    seedBattleRng(2);
    const h = hero({ travelRole: 'approvisionnement', items: [], skills: [{ id: 'survie-en-exterieur', advances: 0 } as any] });
    setup(map({ km: 12, perilDie: 0 }), [h]);
    get().startTravel('r1', 'pied');
    drainCascade();
    expect(get().journal.join('\n')).toContain('Rencontre dangereuse — Territoire hostile');
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────
// (c) ENCHAÎNEMENT : jour → halte de nuit → reprise → arrivée.
// ─────────────────────────────────────────────────────────────────────────────────────────────
describe('enchaînement JOUR → halte de nuit → reprise → arrivée', () => {

  it('trajet long (30 km) avec Étapes : le jour ouvre la cascade, sa clôture pose la halte de nuit', () => {
    setRule('travel-etapes', true);
    seedBattleRng(1);
    const h = hero({ travelRole: 'approvisionnement', items: [ration('r1'), ration('r2')], skills: [{ id: 'survie-en-exterieur', advances: 40 } as any] });
    setup(map({ km: 30, perilDie: 0 }), [h]);
    get().startTravel('r1', 'pied');
    // Le jour ouvre la cascade travelDay ; sa clôture pose la halte de nuit (30 km > 24 km/jour).
    expect(get().pendingCascade?.purpose).toBe('travelDay');
    drainCascade();
    expect(get().pendingRest).toBeTruthy();
    expect(get().scene?.id).toBe('lieu-a-scene'); // toujours en route
    // Dormir puis reprendre : arrivée.
    runToEnd();
    expect(get().travelPlan).toBeNull();
    expect(get().scene?.id).toBe('lieu-b-scene');
  });

  it('péripétie de combat pendant le jour : le voyage est INTERROMPU (recap.then), pas de halte', () => {
    seedBattleRng(1);
    const h = hero({ items: [ration('r1')] });
    setup(map({ km: 30, perils: [{ label: 'Brigands !', chancePct: 100, effects: [{ type: 'startCombat', encounter: 'enc-test' }] }] }), [h]);
    get().startTravel('r1', 'pied');
    drainCascade();
    const st = get();
    expect(st.battle).toBeNull(); // différé derrière le récit
    expect(st.travelRecap?.then?.kind).toBe('effects');
    expect(st.travelPlan?.interrupted).toBe(true);
    expect(st.pendingRest).toBeFalsy(); // interrompu → pas de halte de nuit
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────
// #270 — Attelage FORCÉ (allure « galop », EDOC 07 l.229) : le Test de Conduite d'attelage au km était
// roulé INLINE (aucune Chance offerte sur un jet répété qui peut se solder en Accident) — gate CONTRÔLEUR :
// conducteur PILOTÉ PAR UN HUMAIN → chaîne d'étapes `landForcedPace` (cascade `travelDay`, UNE cascade,
// pas N modales) ; sinon → chemin synchrone historique (`forcedPaceDay`, inchangé).
// ─────────────────────────────────────────────────────────────────────────────────────────────
describe('#270 — allure forcée (attelage) : gate contrôleur', () => {
  afterEach(() => resetRule('travel-allures'));

  function forcedRoute(km: number): WorldMap {
    return { id: 'c', label: 'c', places: [
      { id: 'pa', label: 'A', pos: { x: 0, y: 0 }, scene: 'lieu-a-scene' },
      { id: 'pb', label: 'B', pos: { x: 70, y: 0 }, scene: 'lieu-b-scene' },
    ], routes: [{ id: 'r1', a: 'pa', b: 'pb', km, modes: ['diligence', 'pied'], perilDie: 0 }] };
  }

  it('conducteur JOUEUR (humanControlled) → la cascade travelDay s’ouvre sur une étape landForcedPace influençable', () => {
    setRule('travel-allures', true);
    seedBattleRng(1);
    const h = hero({ id: 'h', skills: [{ id: 'conduite-d-attelage', advances: 40 } as any] });
    useGame.setState({ party: [h], gameTime: campaignStart(), travelPlan: null, pendingRest: null, pendingCascade: null, travelRecap: null, journal: [] });
    get().loadProject([sceneA(), sceneB()], 'lieu-a-scene', forcedRoute(20));
    useGame.setState({ gameTime: campaignStart() });
    creditBourse(get, set, 'h', { gold: 500, silver: 0, brass: 0 }); // passage de l'attelage (dépense de groupe)
    get().startTravel('r1', 'diligence', { allure: 'galop' });
    const pc = get().pendingCascade;
    expect(pc?.purpose).toBe('travelDay');
    const first = pc!.participants[0];
    expect(first.kind).toBe('landForcedPace');
    expect(first.result ?? null).toBeNull(); // pas encore roulé → influençable (Chance/Résilience)
  });

  it('conducteur SANS pilote humain (aiControlled) → repli inline (aucune étape landForcedPace), même formule', () => {
    setRule('travel-allures', true);
    seedBattleRng(1);
    const h = hero({ id: 'h', aiControlled: true, skills: [{ id: 'conduite-d-attelage', advances: 40 } as any] });
    useGame.setState({ party: [h], gameTime: campaignStart(), travelPlan: null, pendingRest: null, pendingCascade: null, travelRecap: null, journal: [] });
    get().loadProject([sceneA(), sceneB()], 'lieu-a-scene', forcedRoute(20));
    useGame.setState({ gameTime: campaignStart() });
    creditBourse(get, set, 'h', { gold: 500, silver: 0, brass: 0 }); // passage de l'attelage (dépense de groupe)
    get().startTravel('r1', 'diligence', { allure: 'galop' });
    // Résolu par le chemin synchrone historique : soit une cascade travelDay SANS étape landForcedPace
    // (postes/périls du jour, non liés à l'attelage), soit aucune cascade du tout.
    const pc = get().pendingCascade;
    if (pc) expect(pc.participants.some((s) => s.kind === 'landForcedPace')).toBe(false);
    expect(get().journal.join('\n')).toMatch(/Conduite d'attelage \(allure forcée\)/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────
// #341 follow-up — Test de RÉSISTANCE de traversée (Neige l.86 / Blizzard l.127) au démarrage du jour,
// DISTINCT de l'Exposition de fin d'Étape ; + breakdown de mods sur les rangées BATCH d'activité.
// ─────────────────────────────────────────────────────────────────────────────────────────────
describe('#341 — Résistance de traversée Neige/Blizzard (pas BATCH au démarrage du jour)', () => {
  it('Neige : un pas BATCH par héros voyageant, enjeu VERBATIM EDOC, cible = Résistance + Accessible', () => {
    const h1 = hero({ id: 'h1' });
    const h2 = hero({ id: 'h2' });
    set({ party: [h1, h2] });
    const steps = buildWeatherResistanceSteps(get, 'neige');
    expect(steps.length).toBe(1);
    const step = steps[0];
    expect(step.kind).toBe('weatherResistance');
    expect(step.participants?.length).toBe(2); // un jet INDÉPENDANT par héros
    expect(resolveStake(step.stake!).text).toContain('Résistance Accessible (+20)'); // enjeu verbatim (l.86)
    const p0 = step.participants![0];
    expect(p0.target).toBe(Math.min(99, p0.base + 20)); // Accessible +20 baké dans la cible
    // #1072 : la Difficulté est une donnée de LIGNE (rendue en texte + valeur par `RollLine`), jamais
    // une chip de `mods` — celles-ci ne portent QUE le circonstanciel (ici : rien).
    expect(p0.difficulty).toBe('accessible');
    expect(p0.mods ?? []).toEqual([]);
  });

  it('Blizzard sans Test de traversée pour beau temps : aucune météo clémente ne produit de pas', () => {
    set({ party: [hero({ id: 'h1' })] });
    expect(buildWeatherResistanceSteps(get, 'blizzard').length).toBe(1); // Intermédiaire (+0)
    expect(buildWeatherResistanceSteps(get, 'beau').length).toBe(0);
    expect(buildWeatherResistanceSteps(get, 'pluie').length).toBe(0);
  });

  it('échec du Test de Résistance (Neige) → Exténué APPLIQUÉ, ligne DÉRIVÉE (op condition) sur la rangée', () => {
    const h = hero({ id: 'h' });
    set({ party: [h], pendingCascade: null, journal: [] });
    const steps = buildWeatherResistanceSteps(get, 'neige');
    // Jet FORCÉ en échec (déterministe) : la rangée est prête → cascadeNext commit → applier.
    steps[0].participants![0].result = { roll: 99, target: steps[0].participants![0].target, sl: -4, success: false };
    set({ pendingCascade: { title: 'Traversée', icon: 'rest/cold', purpose: 'test', cursor: 0, log: [], participants: steps } as never });
    get().cascadeNext();
    const st = get();
    expect(st.party[0].conditions.some((c) => c.id === 'extenue')).toBe(true);
    expect(st.journal.join('\n')).toContain('État Exténué subi.'); // opConsequenceLine case condition
  });
});

describe('#341 — breakdown de mods sur les rangées BATCH d’activité (source unique avec le mono)', () => {
  it('Pluie diluvienne : Plein air porte la ligne « Météo » ; carto (Métier=Dex) la ligne « Tests physiques »', () => {
    setRule('travel-etapes', true);
    const hOut = hero({ id: 'hOut', travelRole: 'plein-air', skills: [{ id: 'survie-en-exterieur', advances: 20 } as never] });
    const hCarto = hero({ id: 'hCarto', travelRole: 'etablir-cartes', skills: [{ id: 'metier', spec: 'Cartographe', advances: 20 } as never] });
    set({ party: [hOut, hCarto], travelPlan: {
      routeId: 'r1', fromPlaceId: 'pa', toPlaceId: 'pb', mode: 'pied', hoursPerDay: 6, km: 12, kmDone: 0, interrupted: false,
      postes: { hOut: { activityId: 'plein-air' }, hCarto: { activityId: 'etablir-cartes' } },
    } as never });
    const steps = buildStageSteps(get, set, 'pluie-diluvienne', 'ete');
    const batch = steps.find((s) => s.kind === 'stagePosteBatch')!;
    const outPart = batch.participants!.find((p) => p.id === 'hOut')!;
    const cartoPart = batch.participants!.find((p) => p.id === 'hCarto')!;
    expect(outPart.mods?.some((m) => typeof m.label === 'string' && m.label.startsWith('Météo'))).toBe(true); // Plein air -20 (l.106)
    expect(cartoPart.mods?.some((m) => m.label === 'Tests physiques' && m.value === -10)).toBe(true); // pluie diluvienne l.82, carac Dex
    resetRule('travel-etapes');
  });

  /** #1153 L2bis (sonde du juge B3) : la rangée batch monte sa ligne par le MONTEUR — un `mods` posé
   *  APRÈS l'étalement l'écrasait, et l'écart météo repartait en chip « autres ». */
  it('la rangée d’Étape n’a AUCUNE part anonyme : base nue, chips météo, cible et écrêtage du monteur', () => {
    setRule('travel-etapes', true);
    const hOut = hero({ id: 'hOut', travelRole: 'plein-air', skills: [{ id: 'survie-en-exterieur', advances: 20 } as never] });
    const hCarto = hero({ id: 'hCarto', travelRole: 'etablir-cartes', skills: [{ id: 'metier', spec: 'Cartographe', advances: 20 } as never] });
    set({ party: [hOut, hCarto], travelPlan: {
      routeId: 'r1', fromPlaceId: 'pa', toPlaceId: 'pb', mode: 'pied', hoursPerDay: 6, km: 12, kmDone: 0, interrupted: false,
      postes: { hOut: { activityId: 'plein-air' }, hCarto: { activityId: 'etablir-cartes' } },
    } as never });
    const batch = buildStageSteps(get, set, 'pluie-diluvienne', 'ete').find((s) => s.kind === 'stagePosteBatch')!;
    expect(batch.participants!.length).toBeGreaterThan(1);
    for (const part of batch.participants!) {
      const st = { base: part.base, target: part.target, mods: part.mods, difficulty: part.difficulty, clamped: part.clamped } as never;
      expect(inexplique(st), `rangée ${part.id} : chip « autres » = un monteur qui ment`).toBe(0);
      // …et les chips météo sont bien LÀ (le résidu nul ne vient pas d'une ligne vidée de ses mods).
      expect(part.mods?.length ?? 0).toBeGreaterThan(0);
    }
    resetRule('travel-etapes');
  });
});

/**
 * #1153 L2bis — l'étape-jet insérée par une péripétie pose le Niveau de Compétence NU (`LDB 09 l.17`)
 * et sort le Soutien (LDB 12 l.187-200) en ligne de mod NOMMÉE ; la CIBLE reste dérivée de la valeur
 * SOUTENUE (l.189-190), au point près. Un meneur sous ÉTAT le PROUVE : la pénalité d'État sépare la
 * nue (`skillBaseValue`) de la valeur jetée (`testValue`), qu'une base fondue confondrait.
 */
describe('Péripétie terrestre — base NUE + Soutien NOMMÉ, cible invariante (#1153 L2bis)', () => {
  /** Rejoue `landPeril` en cherchant le tirage qui donne « Voyage éreintant » (1d10 = 4, l.237) :
   *  la table est tirée sur le RNG de bataille, donc c'est la GRAINE qui choisit — jamais un stub. */
  const perilInsert = (kind: string) => {
    const step = { id: 'p', kind: 'landPeril', meta: { destLabel: 'B' } } as never;
    for (let seed = 1; seed <= 400; seed++) {
      seedBattleRng(seed);
      const out = cascadeAppliers.landPeril.apply(get, set, step, undefined, { steps: [step], index: 0 });
      const found = (out?.insert ?? []).find((s) => s.kind === kind);
      if (found) return found;
    }
    return undefined;
  };

  it('« Voyage éreintant » : `base` = Survie NUE du meneur EMPOISONNÉ, chip « Soutien », cible = valeur soutenue', () => {
    const lead = hero({ id: 'lead', skills: [{ id: 'survie-en-exterieur', advances: 25 } as never], conditions: [{ id: 'empoisonne', value: 1 }] as never });
    // DEUX soutiens (+20) : le Soutien ne compense pas exactement l'État (−10), donc une base FONDUE
    // ne peut pas se faire passer pour la nue par coïncidence arithmétique.
    const aide = hero({ id: 'aide', skills: [{ id: 'survie-en-exterieur', advances: 3 } as never] });
    const aide2 = hero({ id: 'aide2', skills: [{ id: 'survie-en-exterieur', advances: 2 } as never] });
    setup(map({ perilDie: 8 }), [lead, aide, aide2]);
    set({ travelPlan: { routeId: 'r1', fromPlaceId: 'pa', toPlaceId: 'pb', mode: 'pied', hoursPerDay: 6, km: 12, kmDone: 0, interrupted: false } as never });

    const nue = skillBaseValue(lead, 'survie-en-exterieur');
    const jetee = testValue(lead, 'survie-en-exterieur');
    expect(jetee, 'l’État mord le jet, pas le Niveau de Compétence').toBeLessThan(nue);
    const soutien = soutienDetail(get().party, lead, 'survie-en-exterieur');
    expect(soutien.bonus, 'le camarade éligible soutient (l.195)').toBeGreaterThan(0);

    const st = perilInsert('landPerilSurvie')!;
    expect(st, 'la péripétie « éreintant » insère bien son Test').toBeTruthy();
    expect(st.actorId).toBe('lead');
    expect(st.base, 'Niveau de Compétence NU (LDB 09 l.17)').toBe(nue);
    expect(soutienDe(st), 'le Soutien est une ligne de mod NOMMÉE').toBe(soutien.bonus);
    // CIBLE INVARIANTE : la valeur SOUTENUE + la Difficulté Accessible (+20) — inchangée par la migration.
    expect(st.target).toBe(jetee + soutien.bonus + DIFFICULTY_MODIFIERS.accessible);
    // CLIQUET « zéro chip anonyme » : l'État est NOMMÉ lui aussi, il ne reste aucun écart muet.
    expect(inexplique(st), 'aucune chip « autres » : États compris, tout est nommé').toBe(0);
  });
});

/**
 * #1153 L2bis (sondes du juge B1/B4) — l'attelage forcé au fil des kilomètres : chaque km REDEMANDE le
 * même Test de Conduite d'attelage, avec le MÊME conducteur soutenu (`LDB 12 l.189` : « le Personnage
 * qui possède la plus forte chance de réussite lance les dés. Chaque Personnage qui apporte son
 * soutien octroie un bonus de +10 au Test ») — les passagers sont adjacents (l.196) et ce Test n'est
 * pas une résistance (l.197). La pénalité de −10/km (`EDOC 07 l.229`) est fondue dans la valeur et
 * NOMMÉE une seule fois.
 */
describe('#1153 — allure forcée : km suivant et reprise de contrôle, une seule grandeur', () => {
  afterEach(() => resetRule('travel-allures'));

  function attelage(): { lead: Combatant; aide: Combatant } {
    const lead = hero({ id: 'lead', label: 'Lead', skills: [{ id: 'conduite-d-attelage', advances: 40 } as never] });
    const aide = hero({ id: 'aide', label: 'Aide', skills: [{ id: 'conduite-d-attelage', advances: 5 } as never] });
    return { lead, aide };
  }

  function ouvreJournee(): void {
    setRule('travel-allures', true);
    seedBattleRng(1);
    const { lead, aide } = attelage();
    useGame.setState({ party: [lead, aide], gameTime: campaignStart(), travelPlan: null, pendingRest: null, pendingCascade: null, travelRecap: null, journal: [] });
    get().loadProject([sceneA(), sceneB()], 'lieu-a-scene', { id: 'c', label: 'c', places: [
      { id: 'pa', label: 'A', pos: { x: 0, y: 0 }, scene: 'lieu-a-scene' },
      { id: 'pb', label: 'B', pos: { x: 70, y: 0 }, scene: 'lieu-b-scene' },
    ], routes: [{ id: 'r1', a: 'pa', b: 'pb', km: 20, modes: ['diligence', 'pied'], perilDie: 0 }] } as WorldMap);
    useGame.setState({ gameTime: campaignStart() });
    creditBourse(get, set, 'lead', { gold: 500, silver: 0, brass: 0 });
    get().startTravel('r1', 'diligence', { allure: 'galop' });
  }

  it('1ᵉʳ km : base NUE, Soutien NOMMÉ, aucune chip anonyme', () => {
    ouvreJournee();
    const st = get().pendingCascade!.participants.find((s) => s.kind === 'landForcedPace')!;
    const picked = partyAssisted(get().party, 'conduite-d-attelage')!;
    expect(st.base).toBe(skillBaseValue(picked.actor, 'conduite-d-attelage'));
    expect(soutienDe(st)).toBe(picked.support.bonus);
    expect(st.target).toBe(picked.value + DIFFICULTY_MODIFIERS.intermediaire);
    expect(inexplique(st)).toBe(0);
  });

  it('2ᵉ km : le −10/km est NOMMÉ une seule fois et la cible ne le compte pas deux fois (B1)', () => {
    ouvreJournee();
    const st = get().pendingCascade!.participants.find((s) => s.kind === 'landForcedPace')!;
    const picked = partyAssisted(get().party, 'conduite-d-attelage')!;
    // Le km courant RÉUSSIT → l'applier insère le km suivant (`galloped = 1`, pénalité −10).
    const reussi = { ...st, result: { roll: 5, target: st.target!, sl: 3, success: true } } as typeof st;
    const out = cascadeAppliers.landForcedPace.apply(get, set, reussi, get().party[0], { steps: [reussi], index: 0 });
    const km2 = (out?.insert ?? []).find((s) => s.kind === 'landForcedPace')!;
    expect(km2, 'le kilomètre suivant s’insère').toBeTruthy();
    expect(km2.base, 'base NUE : ni le Soutien ni la pénalité ne s’y cachent').toBe(skillBaseValue(picked.actor, 'conduite-d-attelage'));
    const chips = km2.mods!.map((m) => m.label);
    expect(chips.filter((l) => l.startsWith('Km déjà au pas de course'))).toHaveLength(1);
    expect(soutienDe(km2)).toBe(picked.support.bonus);
    expect(km2.target).toBe(picked.value - 10 + DIFFICULTY_MODIFIERS.intermediaire);
    expect(inexplique(km2), 'aucune chip « autres » : le −10 compte UNE fois').toBe(0);
  });

  /**
   * #673 L3 (G1) — l'aggravation de `EDOC 07 l.253` (« Un Échec Impressionnant ou pire sur n'importe
   * quel Test de Résistance d'un animal impose un État *Exténué* supplémentaire, et un Échec
   * Stupéfiant coûte à la bête 1d10 Blessures en plus ») doit être atteignable DEPUIS LE CHEMIN RÉEL
   * du joueur — la cascade `landForcedPace` — et non seulement depuis le résolveur pur. Le dé
   * des bêtes vit dans `battleRng` : on cherche la graine qui produit le cas, sans stub.
   */
  function consequencesSurEchecDuConducteur(seed: number): string[] {
    seedBattleRng(seed);
    const st = get().pendingCascade!.participants.find((s) => s.kind === 'landForcedPace')!;
    // Échec SIMPLE (−1 DR) : pas de Problème de véhicule (l.253 côté conducteur), seules les bêtes jouent.
    const rate = { ...st, result: { roll: 99, target: st.target!, sl: -1, success: false } } as typeof st;
    const out = cascadeAppliers.landForcedPace.apply(get, set, rate, get().party[0], { steps: [rate], index: 0 });
    return (out?.consequences ?? []).map((c) => String((c as { vars?: { text?: string } }).vars?.text ?? ''));
  }

  it('l.253 — Échec Impressionnant d’une bête : l’État Exténué SUPPLÉMENTAIRE est atteignable depuis la cascade', () => {
    ouvreJournee();
    let lignes: string[] = [];
    for (let seed = 1; seed <= 300 && !lignes.some((l) => l.includes('supplémentaire')); seed++) {
      lignes = consequencesSurEchecDuConducteur(seed);
    }
    expect(lignes.some((l) => l.includes('Exténuée')), 'la bête rate sa Résistance (l.229)').toBe(true);
    expect(
      lignes.some((l) => l.includes('Échec Impressionnant ou pire') && l.includes('supplémentaire')),
      'l.253 : État Exténué supplémentaire, sur le chemin JOUEUR',
    ).toBe(true);
  });

  it('l.253 — Échec Stupéfiant d’une bête : les 1d10 Blessures (− Bonus d’Endurance) sont atteignables depuis la cascade', () => {
    ouvreJournee();
    let lignes: string[] = [];
    for (let seed = 1; seed <= 4000 && !lignes.some((l) => l.includes('Blessures de plus')); seed++) {
      lignes = consequencesSurEchecDuConducteur(seed);
    }
    const blessee = lignes.find((l) => l.includes('Blessures de plus'));
    expect(blessee, 'l.253 : 1d10 Blessures à la bête, sur le chemin JOUEUR').toBeTruthy();
    // Cheval de trait E45 → BE 4 : 1d10 − 4, plancher 1 → 1..6.
    const n = Number(/(\d+) Blessures/.exec(blessee!)![1]);
    expect(n).toBeGreaterThanOrEqual(1);
    expect(n).toBeLessThanOrEqual(6);
  });

  it('reprise de contrôle : MÊME conducteur soutenu que le km, sur les DEUX surfaces (B4)', () => {
    ouvreJournee();
    const st = get().pendingCascade!.participants.find((s) => s.kind === 'landForcedPace')!;
    const picked = partyAssisted(get().party, 'conduite-d-attelage')!;
    // Échec STUPÉFIANT (−6 DR) : l'applier tire le Tableau des problèmes ; sur « Incontrôlable » il
    // insère la reprise de contrôle. Les autres tirages n'en insèrent pas — on cherche la graine qui
    // produit le cas, sans stub (le d100 vit dans `battleRng`).
    let control: typeof st | undefined;
    for (let seed = 1; seed <= 200 && !control; seed++) {
      seedBattleRng(seed);
      const rate = { ...st, result: { roll: 99, target: st.target!, sl: -6, success: false } } as typeof st;
      const out = cascadeAppliers.landForcedPace.apply(get, set, rate, get().party[0], { steps: [rate], index: 0 });
      control = (out?.insert ?? []).find((s) => s.kind === 'landForcedPaceControl') as typeof st | undefined;
    }
    expect(control, 'le cas « Incontrôlable » est atteignable').toBeTruthy();
    expect(control!.actorId).toBe(picked.actor.id);
    expect(control!.base).toBe(skillBaseValue(picked.actor, 'conduite-d-attelage'));
    expect(soutienDe(control!), 'le Soutien s’applique aussi à la reprise (LDB 12 l.189)').toBe(picked.support.bonus);
    expect(control!.target, 'la cible NE dépend PAS de la surface : même valeur soutenue').toBe(picked.value + DIFFICULTY_MODIFIERS.intermediaire);
    expect(inexplique(control!)).toBe(0);
  });
});
