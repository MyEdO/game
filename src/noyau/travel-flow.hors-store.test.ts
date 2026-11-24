/**
 * VOYAGE TERRESTRE (LDB « Voyage » + EDOC 8 « Voyage par Étapes ») — la journée de route JOUÉE.
 * Depuis la Phase B, TOUS les jets du JOUR terrestre (Activités de l'Étape, Exposition de fin d'Étape,
 * péripéties Survie/Perception) passent par la MÊME cascade (`purpose:'travelDay'`) que le voyage fluvial et
 * la nuit : influençable jour par jour (Chance/Pacte/Résilience), jouée d'office sous ordres (`TravelPlan.orders`,
 * #3935) — aucune auto-résolution inline. La cascade
 * du jour se clôt sur le calcul de la progression puis enchaîne la halte
 * de nuit / l'arrivée. La marche forcée reste une étape de la cascade de NUIT (inchangée).
 */
import { idsDeTest } from '../engine/idsDeTest.testkit';
import { combatStakeRef, refLabel, resolveStake, testSkillLabel, voyageStakeRef, weather } from '../data';
import { itemFromTrappingById } from '../engine/items';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { seedBattleRng } from './battleRng';
import { makeRNG } from '../engine/dice';
import { contractDisease } from '../engine/disease';
import { findTableEntry } from '../engine/tables';
import { stageWeatherRows } from './travelFlow';
import { voyageEnVue } from './voyageEnVue';
import { recitEnVue } from './recitEnVue';
import { encounterTable } from '../engine/travelTables';
import { PERIPETIES } from '../data/peripeties';
import { emptyScene, Scene } from './monde/scene';
import { buildEncounter } from './monde/encounterAuthoring';
import { documentDeProjet, parseProject, type MapRouteTrace, type RoutePeril, type WorldMap } from './worldMap';
import { emptyNarratif } from './monde/campaignNarratif';
import { campaignStart, dayIndex } from '../engine/clock';
import { setRule, resetRule } from '../engine/policy';
import { applierQuiOuvre } from './noyau.testkit';
import { runFlow } from './combatEffects';
import { setCadence } from '../engine/cadence';
import { setDesFixes, resetDesFixes } from '../engine/fixedDie';
import { t } from '../i18n';
import type { FlowDeScene } from '../data/schemas/defs-scenes/effets';
import { buildWeatherResistanceSteps, buildStageSteps } from './travelPostes';
import { currentSeason, weatherFromRoll, type Season } from '../engine/travelStages';
import { creditBourse } from './bourseFlow';
import { DIFFICULTY_MODIFIERS, type Combatant, type ItemInstance } from '../engine/types';
import type { Possession } from '../engine/possession';
import { applierDe, jouerLaJournee, rollTableStep } from './cascade';
import { bandStep, monoStep, rollStep } from './rollSeam';
import { inexplique, soutienDe, draineCascade, draineEtapes, avanceEtapeCascade, cascadeDeTest, type ChoisitCle, type PoseDe } from './cascade.testkit';
import { skillBaseValue, testValue, soutienDetail, partyAssisted } from '../engine/skills';
import { lignesDe } from '../engine/modLine.testkit';
import { refDeRegle } from '../engine/reglesChiffrees';
import { ligneAllureForcee } from '../engine/vehicle';
import { DEFAULT_VOYAGE_ORDERS } from './voyageCadence';
import { blessuresDeBase, blessuresSurLeProfil } from '../engine/combattantDeTest.testkit';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

const get = () => banc.getState();
const set: Banc['setState'] = (e) => banc.setState(e);

const ration = (uid: string): ItemInstance => ({ ...itemFromTrappingById('ration', idsDeTest)!, uid, enc: 0 });
const hero = (p: Partial<Combatant> = {}): Combatant => (blessuresSurLeProfil({
  id: 'h', label: 'Hilda', kind: 'heros',
  characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 40, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 35, sociabilite: 30 },
  wounds: blessuresDeBase(12), advantage: 0, conditions: [], skills: [], talents: [],
  weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
  items: [], movement: 4, ...p,
}) as Combatant);
function sceneA(surprise?: 'groupe' | 'ennemis'): Scene {
  const s = emptyScene('scene-test', 10, 10); s.id = 'lieu-a-scene'; s.label = 'A';
  const enc = buildEncounter({ id: 'enc-test', surprise, enemies: [{ statblock: { type: 'statblock', label: 'Brigand', char: { 'capacite-de-combat': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, B: 8 } }, pos: { x: 5, y: 5 } }] });
  s.entities.push(...enc.entities); s.encounters = [enc.encounter];
  return s;
}
function sceneB(): Scene { const s = emptyScene('scene-test', 10, 10); s.id = 'lieu-b-scene'; s.label = 'B'; return s; }
function map(rp: Partial<MapRouteTrace> = {}): WorldMap {
  return { id: 'c', label: 'c', places: [
    { id: 'pa', label: 'A', pos: { x: 20, y: 50 }, scene: { id: 'lieu-a-scene' } },
    { id: 'pb', label: 'B', pos: { x: 70, y: 40 }, scene: { id: 'lieu-b-scene' } },
  ], routes: [{ id: 'r1', a: { id: 'pa' }, b: { id: 'pb' }, km: 12, modes: ['pied'], perilDie: 0, ...rp }] };
}
function setup(wm: WorldMap, party: Combatant[], scenes = [sceneA(), sceneB()]) {
  banc.setState({ party, gameTime: campaignStart(), travelPlan: null, pendingRest: null, pendingCascade: null, travelRecap: null, journal: [] });
  get().chargerLeProjet({ scenes, entryId: 'lieu-a-scene', worldMap: wm, projet: null });
  banc.setState({ gameTime: campaignStart() });
}

/** Déroule la cascade OUVERTE (jour ou nuit) — pilote PARTAGé `cascade.testkit › draineCascade`. */
function drainCascade(): void {
  draineCascade(get);
}
/** Va au bout d'un voyage : draine cascades du jour, dort les haltes, jusqu'à l'arrivée (ou blocage). */
function runToEnd(maxSteps = 60): void {
  for (let i = 0; i < maxSteps; i++) {
    if (get().pendingCascade) { drainCascade(); continue; }
    if (get().pendingRest) { get().fenetreValider('repos'); drainCascade(); continue; }
    if (!get().travelPlan) return;
  }
}

/** Franchit la Météo d'Étape — étape à TABLE en tête du jour (#1426) dont l'applier INSÈRE les pas qui
 *  dépendent du temps qu'il fait (Résistance de traversée, postes). Sans elle, la séquence du jour n'a
 *  encore qu'une étape : c'est le dé de monde qui fait exister la suite. En cadence MANUELLE la table
 *  attend sa fenêtre : le pilote partagé (`cascade.testkit › avanceEtapeCascade`) la LANCE puis valide,
 *  exactement comme le joueur qui voit la rangée et clique. */
function passerLaMeteo(): void {
  if (get().pendingCascade?.participants[get().pendingCascade!.cursor]?.kind !== 'etape-meteo') return;
  avanceEtapeCascade(get);
}

// ─────────────────────────────────────────────────────────────────────────────────────────────
// (b) INFLUENCE : les jets du JOUR terrestre sont des étapes influençables d'une cascade travelDay.
// ─────────────────────────────────────────────────────────────────────────────────────────────
describe('cascade du JOUR terrestre — les jets d’Étape sont influençables (purpose travelDay)', () => {
  beforeEach(() => setRule('voyage-etapes', true));

  it('la Météo d’Étape déclare la table de SA SAISON, SANS modificateur (#1426)', () => {
    seedBattleRng(1);
    setup(map({ km: 12, perilDie: 0 }), [hero({ travelRole: { activityId: 'approvisionnement' }, items: [] })]);
    get().partirEnVoyage('r1', 'pied', { cadence: 'jourParJour' });
    const meteo = get().pendingCascade!.participants.find((st) => st.kind === 'etape-meteo')!;
    expect(meteo, 'la Météo est une étape à TABLE de monde').toBeTruthy();
    expect(meteo.worldOwner).toBe(true);
    // La SAISON choisit la TABLE — jamais un `mod` : un décalage saisonnier rendrait des lignes
    // faussement inatteignables à la pose (les N premiers naturels seraient morts).
    const saison = currentSeason(get().gameTime);
    expect(meteo.table!.tableId).toBe(`stage-weather-${saison}`);
    expect(meteo.table!.mod ?? 0).toBe(0);
  });

  it('la rangée APPLIQUÉE est celle que la ligne AFFICHÉE annonce — 100 jets × 4 saisons (#1463 L4)', () => {
    // UN jet, DEUX lectures : l'applier `etape-meteo` prend l'id de la rangée trouvée dans les `rows`
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
      const desordre = [...saison.entries].reverse();
      const rows = stageWeatherRows(desordre);
      for (let jet = 1; jet <= 100; jet++) {
        expect(findTableEntry(rows, jet).id, `saison ${saison.id}, jet ${jet}`).toBe(findTableEntry(desordre, jet).weather);
      }
    }
  });

  it('les postes AVEC Test = UN pas BATCH (arbitrage user : jets indépendants), une rangée par héros', () => {
    seedBattleRng(1);
    const h = hero({ travelRole: { activityId: 'approvisionnement' }, items: [], skills: [{ id: 'survie-en-exterieur', advances: 40 } as any] });
    setup(map({ km: 12, perilDie: 0 }), [h]);
    get().partirEnVoyage('r1', 'pied', { cadence: 'jourParJour' });
    const pc0 = get().pendingCascade;
    expect(pc0?.purpose).toBe('travelDay'); // le jour ne s'auto-résout plus
    passerLaMeteo();
    const pc = get().pendingCascade;
    const batch = pc!.participants.find((s) => s.kind === 'etapePosteEnBande');
    expect(batch?.participants?.length).toBe(1); // une rangée pour le seul héros posté
    const part = batch!.participants![0];
    expect(part.target).toBeGreaterThan(0);
    expect(part.result ?? null).toBeNull(); // pas encore roulé → influençable par rangée
  });

  it('la Résilience force la réussite d’une RANGÉE du batch (mécanisme UNIQUE de cascade)', () => {
    seedBattleRng(5); // seed où l'Approvisionnement échoue (parité : 78/70)
    const h = hero({ id: 'h', travelRole: { activityId: 'approvisionnement' }, resilience: 2, items: [], skills: [{ id: 'survie-en-exterieur', advances: 40 } as any] });
    setup(map({ km: 12, perilDie: 0 }), [h]);
    get().partirEnVoyage('r1', 'pied', { cadence: 'jourParJour' });
    expect(get().pendingCascade!.purpose).toBe('travelDay');
    passerLaMeteo();
    const batch = get().pendingCascade!.participants.find((s) => s.kind === 'etapePosteEnBande')!;
    get().jetForcerLaReussite('cascadeEnBande', batch.participants![0].id); // Résilience « Je ne faillirai pas ! » par rangée
    const after = get().pendingCascade!.participants.find((s) => s.kind === 'etapePosteEnBande')!;
    expect(after.participants![0].result?.success).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────
// (a) GOLDEN RNG à graine fixe : la mise en scène en cascade ne change RIEN aux issues RAW.
//     Valeurs figées par probe à graine fixe.
// ─────────────────────────────────────────────────────────────────────────────────────────────
describe('GOLDEN — issues figées à graine égale', () => {

  it('Approvisionnement seed 1 : fourrage réussi (DR 7), 1 ration reçue', () => {
    setRule('voyage-etapes', true);
    seedBattleRng(1);
    const h = hero({ travelRole: { activityId: 'approvisionnement' }, items: [], skills: [{ id: 'survie-en-exterieur', advances: 40 } as any] });
    setup(map({ km: 12, perilDie: 0 }), [h]);
    get().partirEnVoyage('r1', 'pied', { cadence: 'jourParJour' });
    drainCascade();
    const st = get();
    expect(st.lieu).toBe('pb');
    expect((st.party[0].items ?? []).length).toBe(1); // ration trouvée
    const j = st.journal.join('\n');
    // Le jet est DÉJÀ affiché par la rangée de l'étape (CascadeModal) — succès sans effet PROPRE (le
    // gain de ration vient de l'agrégation de fin d'Étape) → aucune ligne de verdict (#295 Lot 5).
    expect(j).not.toContain('réussi (DR');
    expect(j).toContain('reçoit une ration trouvée en chemin');
  });

  it('Approvisionnement seed 5 : échec 78/70 → Exténué, 0 ration', () => {
    setRule('voyage-etapes', true);
    seedBattleRng(5);
    const h = hero({ travelRole: { activityId: 'approvisionnement' }, items: [], skills: [{ id: 'survie-en-exterieur', advances: 40 } as any] });
    setup(map({ km: 12, perilDie: 0 }), [h]);
    get().partirEnVoyage('r1', 'pied');
    drainCascade();
    const st = get();
    expect((st.party[0].items ?? []).length).toBe(0);
    expect(st.party[0].conditions.some((c) => c.id === 'extenue')).toBe(true);
    // La conséquence est la lecture du fait que l'op `condition` a appliqué (#4574), jamais une chaîne
    // composée « Nom — Activité : Exténué. ».
    expect(st.journal).toContain(`${h.label} reçoit 1 État Exténué.`);
  });

  it('Exposition seed 2 : transi → escalade de froid (3 effets exposition-froid, rang 1)', () => {
    setRule('voyage-etapes', true); setRule('voyage-attraper-froid', true);
    seedBattleRng(2);
    const h = hero({ travelRole: { activityId: 'recuperer' } });
    setup(map({ km: 12, perilDie: 0 }), [h]);
    get().partirEnVoyage('r1', 'pied');
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
    get().partirEnVoyage('r1', 'pied');
    drainCascade();
    const st = get();
    expect(st.lieu).toBe('pb');
    expect(st.party[0].conditions.some((c) => c.id === 'extenue')).toBe(false); // Survie réussie → pas d'Exténué
    const j = st.journal.join('\n');
    expect(j).toContain('Voyage éreintant');
    // Le jet est DÉJÀ affiché par la rangée de l'étape (CascadeModal) — pas de re-print (#295 Lot 5).
    expect(j).toContain('Survie en extérieur (+20) : un itinéraire de substitution est trouvé.');
  });

  it('Péripétie seed 3 : « Voyage reposant », soigne toutes les Blessures (routé par applyHealWounds, #473)', () => {
    seedBattleRng(3);
    const h = hero({ wounds: blessuresDeBase(12, 5) });
    setup(map({ km: 12, perilDie: 8 }), [h]);
    get().partirEnVoyage('r1', 'pied');
    drainCascade();
    const st = get();
    expect(st.lieu).toBe('pb');
    expect(st.party[0].wounds.current).toBe(12); // soin total (non-régression sans munition logée)
    expect(st.journal.join('\n')).toContain('Hilda récupère toutes ses Blessures.');
  });

  it('Péripétie seed 3 : « Voyage reposant », munition logée plafonne le soin (LDB 62 l.250)', () => {
    seedBattleRng(3);
    const h = hero({ wounds: blessuresDeBase(12, 5), conditions: [{ id: 'munition-logee', value: 1 }] });
    setup(map({ km: 12, perilDie: 8 }), [h]);
    get().partirEnVoyage('r1', 'pied');
    drainCascade();
    const st = get();
    expect(st.party[0].wounds.current).toBe(11); // plafonné à max−1
    expect(st.journal.join('\n')).toContain('Hilda récupère des Blessures (munition logée bloque le reste).');
  });

  it('Rencontre seed 7 : Succès Impressionnant → « fullRecovery », soigne toutes les Blessures (routé par applyHealWounds, #473)', () => {
    setRule('voyage-etapes', true);
    seedBattleRng(7);
    const h = hero({ travelRole: { activityId: 'approvisionnement' }, items: [], skills: [{ id: 'survie-en-exterieur', advances: 60 } as any], wounds: blessuresDeBase(12, 5) });
    setup(map({ km: 12, perilDie: 0 }), [h]);
    get().partirEnVoyage('r1', 'pied');
    drainCascade();
    const st = get();
    expect(st.party[0].wounds.current).toBe(12); // soin total (non-régression sans munition logée)
    expect(st.journal.join('\n')).toContain('Voyage tranquille : le groupe récupère toutes ses Blessures et tous ses États Exténué.');
  });

  it('Rencontre seed 7 : « fullRecovery » avec munition logée → soin plafonné (LDB 62 l.250)', () => {
    setRule('voyage-etapes', true);
    seedBattleRng(7);
    const h = hero({ travelRole: { activityId: 'approvisionnement' }, items: [], skills: [{ id: 'survie-en-exterieur', advances: 60 } as any], wounds: blessuresDeBase(12, 5), conditions: [{ id: 'munition-logee', value: 1 }] });
    setup(map({ km: 12, perilDie: 0 }), [h]);
    get().partirEnVoyage('r1', 'pied');
    drainCascade();
    const st = get();
    expect(st.party[0].wounds.current).toBe(11); // plafonné à max−1
  });

  it('Rencontre seed 2 : échec d’Approvisionnement → Rencontre dangereuse (texte verbatim)', () => {
    setRule('voyage-etapes', true);
    seedBattleRng(2);
    const h = hero({ travelRole: { activityId: 'approvisionnement' }, items: [], skills: [{ id: 'survie-en-exterieur', advances: 0 } as any] });
    setup(map({ km: 12, perilDie: 0 }), [h]);
    get().partirEnVoyage('r1', 'pied');
    drainCascade();
    const territoire = encounterTable('dangereuses').find((e) => e.label === 'Territoire hostile')!;
    expect(get().journal.filter((l) => l.includes(territoire.label)), 'une Rencontre = une ligne de journal').toEqual([`${territoire.label} — ${territoire.desc}`]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────
// #4005 — L'ÉVÉNEMENT DU JOUR : la Rencontre tirée vit sur le trajet (`TravelPlan.evenements`), servie à l'hôte
// par `voyageEnVue`, puis rangée une fois dans le jour clos à chaque sortie (halte, arrivée, interruption).
// ─────────────────────────────────────────────────────────────────────────────────────────────
describe('#4005 — la Rencontre tirée est l’événement du jour, rangé à la sortie du jour', () => {
  const territoire = () => encounterTable('dangereuses').find((e) => e.label === 'Territoire hostile')!;
  /** Une péripétie d'auteur à 100 % : une étape du jour APRÈS la Rencontre, qui garde la journée ouverte. */
  const colporteur: RoutePeril = { label: 'Un colporteur partage la route.', chancePct: 100, effects: [{ type: 'journal', desc: 'Il vend des amulettes.' }] };
  /** Ouvre le jour de la Rencontre de la graine 2 (échec d'Approvisionnement → « Territoire hostile ») et avance pas à
   *  pas jusqu'à ce que l'étape de Rencontre soit appliquée, la journée encore ouverte. */
  function jourDeRencontre(wm: WorldMap): void {
    setRule('voyage-etapes', true);
    seedBattleRng(2);
    setup(wm, [hero({ travelRole: { activityId: 'approvisionnement' }, items: [ration('r1'), ration('r2')], skills: [{ id: 'survie-en-exterieur', advances: 0 } as any] })]);
    get().partirEnVoyage('r1', 'pied', { cadence: 'jourParJour' });
    expect(voyageEnVue(get())!.evenements, 'un jour sans événement sert une liste vide').toEqual([]);
    const tiree = () => get().pendingCascade?.participants.some((st) => st.kind === 'etapeRencontre' && st.committed);
    for (let i = 0; i < 40 && get().pendingCascade && !tiree(); i++) avanceEtapeCascade(get);
    expect(tiree(), 'la Rencontre est appliquée, la journée encore ouverte').toBe(true);
  }
  const evenementAttendu = () => expect.objectContaining({ source: { table: 'rencontres-dangereuses', id: territoire().id }, title: territoire().label, text: territoire().desc, tone: 'echec' });

  it('halte : servie par `voyageEnVue` pendant le jour (source, titre, texte, jet, dé de la table, ton), puis rangée une fois au jour clos', () => {
    jourDeRencontre(map({ km: 30, perilDie: 0, perils: [colporteur] }));
    const servis = voyageEnVue(get())!.evenements;
    expect(servis).toEqual([evenementAttendu()]);
    expect(servis[0].de, 'le dé de la table de Rencontre').toEqual({ n: 1, sides: 100 });
    const jet = servis[0].jet!;
    expect(jet.effectif, 'sans modificateur, le dé effectif est le naturel').toBe(jet.naturel);
    expect(jet.effectif, 'le dé effectif tombe dans la rangée').toBeGreaterThanOrEqual(territoire().min);
    expect(jet.effectif).toBeLessThanOrEqual(territoire().max);
    drainCascade();
    expect(get().pendingRest, 'la journée va à la halte').toBeTruthy();
    expect(voyageEnVue(get())!.evenements, 'le trajet n’en sert plus').toEqual([]);
    expect(get().travelPlan!.log!.slice(-1)[0].events).toEqual([evenementAttendu()]);
  });

  it('arrivée le jour de la Rencontre (12 km) : l’événement est dans le jour du bilan d’arrivée, une fois', () => {
    jourDeRencontre(map({ km: 12, perilDie: 0, perils: [colporteur] }));
    drainCascade();
    expect(get().travelPlan, 'arrivé').toBeNull();
    expect(get().travelRecap!.status).toBe('arrived');
    expect(get().travelRecap!.days.flatMap((j) => j.events ?? [])).toEqual([evenementAttendu()]);
    const [journee] = recitEnVue(get())!.journees;
    expect(journee.evenements, 'le récit publie la journée d’arrivée et son événement, avec le dé de sa table').toEqual([expect.objectContaining({ source: { table: 'rencontres-dangereuses', id: territoire().id }, de: { n: 1, sides: 100 } })]);
    expect(Object.keys(journee.meteo!).sort(), 'la météo d’Étape par son id et son nom, sans son jet').toEqual(['id', 'nom']);
    expect(journee.lignes, 'les lignes structurées du jour, telles quelles').toEqual(get().travelRecap!.days[0].lines);
  });

  it('interruption puis reprise : l’événement reste avec le jour interrompu et ne fuit pas dans le jour repris', () => {
    jourDeRencontre(map({ km: 60, perilDie: 0, perils: [{ label: 'Brigands !', chancePct: 100, effects: [{ type: 'transition', scene: { id: 'lieu-b-scene' } }] }] }));
    drainCascade();
    expect(get().travelPlan!.interrupted, 'la péripétie interrompt le jour de la Rencontre').toBe(true);
    expect(recitEnVue(get()), 'la transition différée attend : les lieux du récit se nomment par la carte').toMatchObject({ issue: 'embuscade', depart: 'pa', arrivee: 'pb', de: 'A', vers: 'B' });
    get().fenetreFermer('recitDeVoyage');
    expect(get().scene?.id, 'l’acquittement joue la transition différée').toBe('lieu-b-scene');
    // route sans péripétie : la reprise ouvre le jour suivant (patron de `travel.hors-store.test.ts`)
    set({ worldMap: { ...get().worldMap!, routes: get().worldMap!.routes.map((x) => ({ ...x, perils: [] })) } });
    get().reprendreLeVoyage();
    expect(get().travelPlan!.log!.slice(-1)[0].events, 'le jour interrompu, clos au log, porte l’événement').toEqual([evenementAttendu()]);
    expect(voyageEnVue(get())!.evenements, 'le jour repris ne l’hérite pas').toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────
// (c) ENCHAÎNEMENT : jour → halte de nuit → reprise → arrivée.
// ─────────────────────────────────────────────────────────────────────────────────────────────
describe('enchaînement JOUR → halte de nuit → reprise → arrivée', () => {

  it('trajet long (30 km) avec Étapes : le jour ouvre la cascade, sa clôture pose la halte de nuit', () => {
    setRule('voyage-etapes', true);
    seedBattleRng(1);
    const h = hero({ travelRole: { activityId: 'approvisionnement' }, items: [ration('r1'), ration('r2')], skills: [{ id: 'survie-en-exterieur', advances: 40 } as any] });
    setup(map({ km: 30, perilDie: 0 }), [h]);
    get().partirEnVoyage('r1', 'pied', { cadence: 'jourParJour' });
    // Le jour ouvre la cascade travelDay ; sa clôture pose la halte de nuit (30 km > 24 km/jour).
    expect(get().pendingCascade?.purpose).toBe('travelDay');
    drainCascade();
    expect(get().pendingRest).toBeTruthy();
    expect(get().scene?.id).toBe('lieu-a-scene'); // toujours en route
    // Dormir puis reprendre : arrivée.
    runToEnd();
    expect(get().travelPlan).toBeNull();
    expect(get().lieu).toBe('pb');
  });

  it.each([true, false])('pendant la halte, l’incubation acquise en route attend l’arrivée seulement par Étapes (%s)', (etapes) => {
    setRule('voyage-etapes', etapes);
    seedBattleRng(1);
    const rhume = () => contractDisease('rhume-commun', makeRNG(2), { incubation: 1, duration: 5 })!;
    const auDepart = hero({ id: 'ancien', diseases: [rhume()], items: [ration('ancien')] });
    const enRoute = hero({ id: 'nouveau', items: [ration('nouveau')] });
    setup(map({ km: 30 }), [auDepart, enRoute]);
    get().partirEnVoyage('r1', 'pied', { cadence: 'jourParJour' });
    drainCascade();
    expect(get().pendingRest).toBeTruthy();

    set({ party: get().party.map((h) => h.id === enRoute.id ? { ...h, diseases: [rhume()] } : h) });
    const phase = (id: string) => get().party.find((h) => h.id === id)?.diseases?.[0]?.phase;
    get().fenetreValider('repos');
    expect(phase(auDepart.id)).toBe('active');
    expect(phase(enRoute.id)).toBe(etapes ? 'incubation' : 'active');
    runToEnd();
    expect(get().lieu).toBe('pb');
    expect(phase(enRoute.id)).toBe('active');
  });

  it('péripétie de transition pendant le jour : le voyage est INTERROMPU (recap.then), pas de halte', () => {
    seedBattleRng(1);
    const h = hero({ items: [ration('r1')] });
    setup(map({ km: 30, perils: [{ label: 'Brigands !', chancePct: 100, effects: [{ type: 'transition', scene: { id: 'lieu-b-scene' } }] }] }), [h]);
    get().partirEnVoyage('r1', 'pied');
    drainCascade();
    const st = get();
    expect(st.scene?.id).toBe('lieu-a-scene'); // différé derrière le récit
    expect(st.travelRecap?.then?.kind).toBe('effects');
    expect(st.travelPlan?.interrupted).toBe(true);
    expect(st.pendingRest).toBeFalsy(); // interrompu → pas de halte de nuit
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────
// #270 — Attelage FORCÉ (allure « galop », EDOC 07 l.229) : le Test de Conduite d'attelage au km était
// roulé INLINE (aucune Chance offerte sur un jet répété qui peut se solder en Accident) — gate CONTRÔLEUR :
// conducteur PILOTÉ PAR UN HUMAIN → chaîne d'étapes `rythmeForceATerre` (cascade `travelDay`, UNE cascade,
// pas N modales) ; sinon → chemin synchrone historique (`forcedPaceDay`, inchangé).
// ─────────────────────────────────────────────────────────────────────────────────────────────
describe('#270 — allure forcée (attelage) : gate contrôleur', () => {
  function forcedRoute(km: number): WorldMap {
    return { id: 'c', label: 'c', places: [
      { id: 'pa', label: 'A', pos: { x: 0, y: 0 }, scene: { id: 'lieu-a-scene' } },
      { id: 'pb', label: 'B', pos: { x: 70, y: 0 }, scene: { id: 'lieu-b-scene' } },
    ], routes: [{ id: 'r1', a: { id: 'pa' }, b: { id: 'pb' }, km, modes: ['diligence', 'pied'], perilDie: 0 }] };
  }

  it('conducteur JOUEUR (humanControlled) → la cascade travelDay s’ouvre sur une étape rythmeForceATerre influençable', () => {
    setRule('voyage-allures', true);
    seedBattleRng(1);
    const h = hero({ id: 'h', skills: [{ id: 'conduite-d-attelage', advances: 40 } as any] });
    banc.setState({ party: [h], gameTime: campaignStart(), travelPlan: null, pendingRest: null, pendingCascade: null, travelRecap: null, journal: [] });
    get().chargerLeProjet({ scenes: [sceneA(), sceneB()], entryId: 'lieu-a-scene', worldMap: forcedRoute(20), projet: null });
    banc.setState({ gameTime: campaignStart() });
    creditBourse(get, set, 'h', { gold: 500, silver: 0, brass: 0 }); // passage de l'attelage (dépense de groupe)
    get().partirEnVoyage('r1', 'diligence', { allure: 'galop', cadence: 'jourParJour' });
    const pc = get().pendingCascade;
    expect(pc?.purpose).toBe('travelDay');
    const first = pc!.participants[0];
    expect(first.kind).toBe('rythmeForceATerre');
    expect(first.result ?? null).toBeNull(); // pas encore roulé → influençable (Chance/Résilience)
  });

  it('conducteur SANS pilote humain (aiControlled) → repli inline (aucune étape rythmeForceATerre), même formule', () => {
    setRule('voyage-allures', true);
    seedBattleRng(1);
    const h = hero({ id: 'h', aiControlled: true, skills: [{ id: 'conduite-d-attelage', advances: 40 } as any] });
    banc.setState({ party: [h], gameTime: campaignStart(), travelPlan: null, pendingRest: null, pendingCascade: null, travelRecap: null, journal: [] });
    get().chargerLeProjet({ scenes: [sceneA(), sceneB()], entryId: 'lieu-a-scene', worldMap: forcedRoute(20), projet: null });
    banc.setState({ gameTime: campaignStart() });
    creditBourse(get, set, 'h', { gold: 500, silver: 0, brass: 0 }); // passage de l'attelage (dépense de groupe)
    get().partirEnVoyage('r1', 'diligence', { allure: 'galop' });
    // Résolu par le chemin synchrone historique : soit une cascade travelDay SANS étape rythmeForceATerre
    // (postes/périls du jour, non liés à l'attelage), soit aucune cascade du tout.
    const pc = get().pendingCascade;
    if (pc) expect(pc.participants.some((s) => s.kind === 'rythmeForceATerre')).toBe(false);
    expect(get().journal.join('\n')).toMatch(/Conduite d'attelage \(allure forcée\)/);
  });

  it('aucun conducteur ne peut tenter la Conduite d’attelage (Inconscient) → la journée suit la cadence de base (LDB 16 l.113)', () => {
    setRule('voyage-allures', true);
    seedBattleRng(1);
    const h = hero({ id: 'h', aiControlled: true, conditions: [{ id: 'inconscient', value: 1 }] as never, skills: [{ id: 'conduite-d-attelage', advances: 40 } as any] });
    banc.setState({ party: [h], gameTime: campaignStart(), travelPlan: null, pendingRest: null, pendingCascade: null, travelRecap: null, journal: [] });
    get().chargerLeProjet({ scenes: [sceneA(), sceneB()], entryId: 'lieu-a-scene', worldMap: forcedRoute(20), projet: null });
    banc.setState({ gameTime: campaignStart() });
    creditBourse(get, set, 'h', { gold: 500, silver: 0, brass: 0 });
    get().partirEnVoyage('r1', 'diligence', { allure: 'galop' });
    const pc = get().pendingCascade;
    if (pc) expect(pc.participants.some((s) => s.kind === 'rythmeForceATerre'), 'aucun km au pas de course').toBe(false);
    expect(get().journal.join('\n'), 'aucun Test de Conduite d’attelage au pas de course').not.toMatch(/Conduite d'attelage \(allure forcée\)/);
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
    expect(step.kind).toBe('resistanceALaMeteo');
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
    // Jet FORCÉ en échec (déterministe) : la rangée est prête → jetValider('cascade') commit → applier.
    steps[0].participants![0].result = { roll: 99, target: steps[0].participants![0].target, sl: -4, success: false };
    set({ pendingCascade: cascadeDeTest(steps, { title: 'Traversée', icon: 'repos/froid' }) });
    get().jetValider('cascade');
    const st = get();
    expect(st.party[0].conditions.some((c) => c.id === 'extenue')).toBe(true);
    expect(st.journal).toContain(`${h.label} reçoit 1 État Exténué.`); // #4574
  });
});

describe('#341 — breakdown de mods sur les rangées BATCH d’activité (source unique avec le mono)', () => {
  it('Pluie diluvienne : Plein air porte la ligne « Météo » ; carto (Métier=Dex) la ligne « Tests physiques »', () => {
    setRule('voyage-etapes', true);
    const hOut = hero({ id: 'hOut', travelRole: { activityId: 'plein-air' }, skills: [{ id: 'survie-en-exterieur', advances: 20 } as never] });
    const hCarto = hero({ id: 'hCarto', travelRole: { activityId: 'etablir-cartes' }, skills: [{ id: 'metier', spec: 'cartographe', advances: 20 } as never] });
    set({ party: [hOut, hCarto], travelPlan: {
      routeId: 'r1', fromPlaceId: 'pa', toPlaceId: 'pb', mode: 'pied', hoursPerDay: 6, km: 12, kmDone: 0, interrupted: false,
      postes: { hOut: { activityId: 'plein-air' }, hCarto: { activityId: 'etablir-cartes' } },
    } as never });
    const steps = buildStageSteps(get, set, 'pluie-diluvienne', 'ete');
    const batch = steps.find((s) => s.kind === 'etapePosteEnBande')!;
    const outPart = batch.participants!.find((p) => p.id === 'hOut')!;
    const cartoPart = batch.participants!.find((p) => p.id === 'hCarto')!;
    expect(cartoPart.label).toBe(refLabel('skills', { id: 'metier', spec: 'cartographe' }));
    expect(outPart.mods?.filter((m) => m.ref?.category === 'weatherConditions').map((m) => m.value)).toEqual([-20]); // Plein air -20 (l.106)
    expect(lignesDe(cartoPart.mods, { category: 'weatherConditions', id: 'pluie-diluvienne' }).map((m) => m.value)).toEqual([-10]); // EDOC 8 l.82, carac Dex
  });

  /** #1153 L2bis (sonde du juge B3) : la rangée batch monte sa ligne par le MONTEUR — un `mods` posé
   *  APRÈS l'étalement l'écrasait, et l'écart météo repartait en chip « autres ». */
  it('la rangée d’Étape n’a AUCUNE part anonyme : base nue, chips météo, cible et écrêtage du monteur', () => {
    setRule('voyage-etapes', true);
    const hOut = hero({ id: 'hOut', travelRole: { activityId: 'plein-air' }, skills: [{ id: 'survie-en-exterieur', advances: 20 } as never] });
    const hCarto = hero({ id: 'hCarto', travelRole: { activityId: 'etablir-cartes' }, skills: [{ id: 'metier', spec: 'cartographe', advances: 20 } as never] });
    set({ party: [hOut, hCarto], travelPlan: {
      routeId: 'r1', fromPlaceId: 'pa', toPlaceId: 'pb', mode: 'pied', hoursPerDay: 6, km: 12, kmDone: 0, interrupted: false,
      postes: { hOut: { activityId: 'plein-air' }, hCarto: { activityId: 'etablir-cartes' } },
    } as never });
    const batch = buildStageSteps(get, set, 'pluie-diluvienne', 'ete').find((s) => s.kind === 'etapePosteEnBande')!;
    expect(batch.participants!.length).toBeGreaterThan(1);
    for (const part of batch.participants!) {
      const st = { base: part.base, target: part.target, mods: part.mods, difficulty: part.difficulty, clamped: part.clamped } as never;
      expect(inexplique(st), `rangée ${part.id} : chip « autres » = un monteur qui ment`).toBe(0);
      // …et les chips météo sont bien LÀ (le résidu nul ne vient pas d'une ligne vidée de ses mods).
      expect(part.mods?.length ?? 0).toBeGreaterThan(0);
    }
  });
});

/**
 * #1153 L2bis — l'étape-jet insérée par une péripétie pose le Niveau de Compétence NU (`LDB 09 l.17`)
 * et sort le Soutien (LDB 12 l.187-200) en ligne de mod NOMMÉE ; la CIBLE reste dérivée de la valeur
 * SOUTENUE (l.189-190), au point près. Un meneur sous ÉTAT le PROUVE : la pénalité d'État sépare la
 * nue (`skillBaseValue`) de la valeur jetée (`testValue`), qu'une base fondue confondrait.
 */
describe('Péripétie terrestre — base NUE + Soutien NOMMÉ, cible invariante (#1153 L2bis)', () => {
  /** Le d10 de la table des péripéties (`perilATerreTable`, LDB 51 l.210-221) POSÉ sur la rangée de la
   *  péripétie `peripetieKind` : son applier insère l'étape-jet de kind `kind`. */
  const perilInsert = (peripetieKind: string, kind: string) => {
    const p = PERIPETIES.find((x) => x.kind === peripetieKind)!;
    const step = { id: 'p', kind: 'perilATerreTable', table: { tableId: 'route-peripetie-table', result: { id: p.id, roll: p.roll, lines: [] } }, meta: { destLabel: 'B' } } as never;
    const out = applierDe('perilATerreTable')!(get, set, step, undefined, { steps: [step], index: 0 });
    return (out?.insert ?? []).find((s) => s.kind === kind);
  };

  it('« Voyage éreintant » : `base` = Survie NUE du meneur EMPOISONNÉ, chip « Soutien », cible = valeur soutenue', () => {
    const lead = hero({ id: 'lead', skills: [{ id: 'survie-en-exterieur', advances: 25 } as never], conditions: [{ id: 'empoisonne', value: 1 }] as never });
    // DEUX soutiens (+20) : le Soutien ne compense pas exactement l'État (−10), donc une base FONDUE
    // ne peut pas se faire passer pour la nue par coïncidence arithmétique.
    const aide = hero({ id: 'aide', skills: [{ id: 'survie-en-exterieur', advances: 3 } as never] });
    const aide2 = hero({ id: 'aide2', skills: [{ id: 'survie-en-exterieur', advances: 2 } as never] });
    setup(map({ perilDie: 8 }), [lead, aide, aide2]);
    set({ travelPlan: { routeId: 'r1', fromPlaceId: 'pa', toPlaceId: 'pb', mode: 'pied', hoursPerDay: 6, km: 12, kmDone: 0, interrupted: false } as never });

    const nue = skillBaseValue(lead, { skill: { id: 'survie-en-exterieur' } });
    const jetee = testValue(lead, { skill: { id: 'survie-en-exterieur' } });
    expect(jetee, 'l’État mord le jet, pas le Niveau de Compétence').toBeLessThan(nue);
    const soutien = soutienDetail(get().party, lead, { skill: { id: 'survie-en-exterieur' } });
    expect(soutien.bonus, 'le camarade éligible soutient (l.195)').toBeGreaterThan(0);

    const st = perilInsert('ereintant', 'perilATerreSurvie')!;
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
  function attelage(): { lead: Combatant; aide: Combatant } {
    const lead = hero({ id: 'lead', label: 'Lead', skills: [{ id: 'conduite-d-attelage', advances: 40 } as never] });
    const aide = hero({ id: 'aide', label: 'Aide', skills: [{ id: 'conduite-d-attelage', advances: 5 } as never] });
    return { lead, aide };
  }

  function ouvreJournee(): void {
    setRule('voyage-allures', true);
    seedBattleRng(1);
    const { lead, aide } = attelage();
    banc.setState({ party: [lead, aide], gameTime: campaignStart(), travelPlan: null, pendingRest: null, pendingCascade: null, travelRecap: null, journal: [] });
    get().chargerLeProjet({ scenes: [sceneA(), sceneB()], entryId: 'lieu-a-scene', worldMap: { id: 'c', label: 'c', places: [
      { id: 'pa', label: 'A', pos: { x: 0, y: 0 }, scene: { id: 'lieu-a-scene' } },
      { id: 'pb', label: 'B', pos: { x: 70, y: 0 }, scene: { id: 'lieu-b-scene' } },
    ], routes: [{ id: 'r1', a: { id: 'pa' }, b: { id: 'pb' }, km: 20, modes: ['diligence', 'pied'], perilDie: 0 }] } as WorldMap, projet: null });
    banc.setState({ gameTime: campaignStart() });
    creditBourse(get, set, 'lead', { gold: 500, silver: 0, brass: 0 });
    get().partirEnVoyage('r1', 'diligence', { allure: 'galop', cadence: 'jourParJour' });
  }

  it('1ᵉʳ km : base NUE, Soutien NOMMÉ, aucune chip anonyme', () => {
    ouvreJournee();
    const st = get().pendingCascade!.participants.find((s) => s.kind === 'rythmeForceATerre')!;
    const picked = partyAssisted(get().party, { skill: { id: 'conduite-d-attelage' } })!;
    expect(st.base).toBe(skillBaseValue(picked.actor, { skill: { id: 'conduite-d-attelage' } }));
    expect(soutienDe(st)).toBe(picked.support.bonus);
    expect(st.target).toBe(picked.value + DIFFICULTY_MODIFIERS.intermediaire);
    expect(inexplique(st)).toBe(0);
  });

  it('2ᵉ km : le −10/km est NOMMÉ une seule fois et la cible ne le compte pas deux fois (B1)', () => {
    ouvreJournee();
    const st = get().pendingCascade!.participants.find((s) => s.kind === 'rythmeForceATerre')!;
    const picked = partyAssisted(get().party, { skill: { id: 'conduite-d-attelage' } })!;
    // Le km courant RÉUSSIT → l'applier insère le km suivant (`galloped = 1`, pénalité −10).
    const reussi = { ...st, result: { roll: 5, target: st.target!, sl: 3, success: true } } as typeof st;
    const out = applierDe('rythmeForceATerre')!(get, set, reussi, get().party[0], { steps: [reussi], index: 0 });
    const km2 = (out?.insert ?? []).find((s) => s.kind === 'rythmeForceATerre')!;
    expect(km2, 'le kilomètre suivant s’insère').toBeTruthy();
    expect(km2.base, 'base NUE : ni le Soutien ni la pénalité ne s’y cachent').toBe(skillBaseValue(picked.actor, { skill: { id: 'conduite-d-attelage' } }));
    expect(lignesDe(km2.mods, refDeRegle('allure-forcee-attelage'))).toEqual([ligneAllureForcee(1)]);
    expect(soutienDe(km2)).toBe(picked.support.bonus);
    expect(km2.target).toBe(picked.value + ligneAllureForcee(1)!.value + DIFFICULTY_MODIFIERS.intermediaire);
    expect(inexplique(km2), 'aucune chip « autres » : le −10 compte UNE fois').toBe(0);
  });

  /**
   * #673 L3 (G1) — l'aggravation de `EDOC 07 l.253` (« Un Échec Impressionnant ou pire sur n'importe
   * quel Test de Résistance d'un animal impose un État *Exténué* supplémentaire, et un Échec
   * Stupéfiant coûte à la bête 1d10 Blessures en plus ») doit être atteignable DEPUIS LE CHEMIN RÉEL
   * du joueur — la cascade `rythmeForceATerre` — et non seulement depuis le résolveur pur. Le dé
   * des bêtes vit dans `battleRng` : on cherche la graine qui produit le cas, sans stub.
   */
  function consequencesSurEchecDuConducteur(seed: number): string[] {
    seedBattleRng(seed);
    const st = get().pendingCascade!.participants.find((s) => s.kind === 'rythmeForceATerre')!;
    // Échec SIMPLE (−1 DR) : pas de Problème de véhicule (l.253 côté conducteur), seules les bêtes jouent.
    const rate = { ...st, result: { roll: 99, target: st.target!, sl: -1, success: false } } as typeof st;
    const out = applierDe('rythmeForceATerre')!(get, set, rate, get().party[0], { steps: [rate], index: 0 });
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

  it('EDOC 07 l.284 — plus personne ne peut tenir les rênes : l’attelage Incontrôlable devient un Accident, sans jet', () => {
    ouvreJournee();
    const st = get().pendingCascade!.participants.find((s) => s.kind === 'rythmeForceATerre')!;
    // Le conducteur et son aide tombent Inconscients pendant le km (LDB 16 l.113).
    banc.setState({ party: get().party.map((h) => ({ ...h, conditions: [...h.conditions, { id: 'inconscient', value: 1 }] })) });
    const avant = banc.getState();
    let lignes: string[] = [];
    let insert: readonly unknown[] = [];
    for (let seed = 1; seed <= 200 && !lignes.some((l) => l.includes('Incontrôlable')); seed++) {
      banc.setState(avant);
      seedBattleRng(seed);
      const rate = { ...st, result: { roll: 99, target: st.target!, sl: -6, success: false } } as typeof st;
      const out = applierDe('rythmeForceATerre')!(get, set, rate, get().party[0], { steps: [rate], index: 0 });
      lignes = (out?.consequences ?? []).map((c) => String((c as { vars?: { text?: string } }).vars?.text ?? ''));
      insert = out?.insert ?? [];
    }
    expect(lignes.some((l) => l.includes('Incontrôlable')), 'le cas « Incontrôlable » est atteignable').toBe(true);
    expect(insert, 'aucune reprise de contrôle à jouer').toEqual([]);
    expect(lignes.some((l) => l.includes('tente de reprendre le contrôle')), 'aucun jet de reprise').toBe(false);
    expect(lignes).toContain('Personne ne peut tenir les rênes : ACCIDENT !');
  });

  it('reprise de contrôle : MÊME conducteur soutenu que le km, sur les DEUX surfaces (B4)', () => {
    ouvreJournee();
    const st = get().pendingCascade!.participants.find((s) => s.kind === 'rythmeForceATerre')!;
    const picked = partyAssisted(get().party, { skill: { id: 'conduite-d-attelage' } })!;
    // Échec STUPÉFIANT (−6 DR) : l'applier tire le Tableau des problèmes ; sur « Incontrôlable » il
    // insère la reprise de contrôle. Les autres tirages n'en insèrent pas — on cherche la graine qui
    // produit le cas, sans stub (le d100 vit dans `battleRng`).
    let control: typeof st | undefined;
    for (let seed = 1; seed <= 200 && !control; seed++) {
      seedBattleRng(seed);
      const rate = { ...st, result: { roll: 99, target: st.target!, sl: -6, success: false } } as typeof st;
      const out = applierDe('rythmeForceATerre')!(get, set, rate, get().party[0], { steps: [rate], index: 0 });
      control = (out?.insert ?? []).find((s) => s.kind === 'rythmeForceATerreControle') as typeof st | undefined;
    }
    expect(control, 'le cas « Incontrôlable » est atteignable').toBeTruthy();
    expect(control!.actorId).toBe(picked.actor.id);
    expect(control!.base).toBe(skillBaseValue(picked.actor, { skill: { id: 'conduite-d-attelage' } }));
    expect(soutienDe(control!), 'le Soutien s’applique aussi à la reprise (LDB 12 l.189)').toBe(picked.support.bonus);
    expect(control!.target, 'la cible NE dépend PAS de la surface : même valeur soutenue').toBe(picked.value + DIFFICULTY_MODIFIERS.intermediaire);
    expect(inexplique(control!)).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────
// #4006 — sous `jouerLaJournee` (`travelFlow.ts:726`), ce que l'applier d'un péril d'auteur ouvre arrête le jour.
// ─────────────────────────────────────────────────────────────────────────────────────────────
describe('péril d’auteur dont l’effet ouvre un nœud de scène sous la journée pilotée (#4006)', () => {
  /** Cadence déférée : aucun siège ne tient les dés du jour, le pilote joue l'applier du péril lui-même. */
  beforeEach(() => { setCadence('rapide'); setRule('priere-petites', true); });
  afterEach(() => setCadence('manuel'));
  const drapeau = (flag: string): FlowDeScene => ({ kind: 'effet', effet: { type: 'setFlag', flag } });
  const NOEUDS: { noeud: string; etape: string; reward: FlowDeScene }[] = [
    { noeud: 'test', etape: 'jetDeTestDeScene', reward: { kind: 'test', test: { characteristic: 'force' }, reussite: drapeau('branche'), echec: drapeau('branche') } },
    { noeud: 'choix', etape: 'choixDeFlux', reward: { kind: 'choix', invite: 'Prier encore', oui: drapeau('branche'), non: drapeau('branche') } },
  ];
  /** Le jour : le péril « Sanctuaire » (sa Petite Prière exaucée d'office, Prière à 200 avances, joue le nœud),
   *  puis le péril « Rien », qui ne survient jamais. 30 km : la journée finit sur la halte de nuit. */
  const partir = (reward: FlowDeScene) => {
    seedBattleRng(1);
    const h = hero({ items: [ration('r1')], skills: [{ id: 'priere', characteristic: 'sociabilite', advances: 200 } as any] });
    setup(map({ km: 30, perils: [
      { label: 'Sanctuaire', chancePct: 100, effects: [{ type: 'petitePriere', heroId: h.id, reward }] },
      { label: 'Rien', chancePct: 0, effects: [{ type: 'setFlag', flag: 'rien' }] },
    ] }), [h]);
    get().partirEnVoyage('r1', 'pied');
  };
  const lignes = (texte: string) => get().journal.filter((l) => l.startsWith(texte)).length;
  const exaucee = () => lignes(t('eff.petitePriereExaucee', { name: 'Hilda', roll: '§', threshold: '§' }).split('§')[0]);
  const jours = () => get().travelPlan?.log?.length ?? 0;

  for (const { noeud, etape, reward } of NOEUDS) it(`nœud \`${noeud}\` : il passe avant la suite du jour, repris une fois à sa clôture, une journée comptée, la halte après`, () => {
    partir(reward);
    expect(exaucee(), `prémisse (${noeud}) : l’applier du péril a joué l’effet`).toBe(1);
    expect(get().pendingCascade?.participants[get().pendingCascade!.cursor]?.kind, `prémisse (${noeud}) : le nœud ouvert tient le slot`).toBe(etape);
    expect(get().suspendedCascades.map((c) => [c.purpose, c.cursor]), `le jour en vol est parqué derrière son péril, sous le nœud (${noeud})`).toEqual([['travelDay', 1]]);

    expect(get().suspendedCascades[0]!.participants[1]!.committed, `la suite du jour attend le nœud (${noeud})`).toBeFalsy();
    expect(lignes(t('tf.perilEvite', { label: 'Rien' })), `le péril suivant n’est pas joué par-dessus (${noeud})`).toBe(0);
    expect(jours(), `aucune journée comptée sous le nœud (${noeud})`).toBe(0);
    expect(get().pendingRest, `aucune halte sous le nœud (${noeud})`).toBeNull();
    for (let i = 0; i < 20 && (get().pendingTest || get().pendingCascade); i++) {
      if (get().pendingTest) { get().jetLancer('test'); get().jetValider('test'); } else avanceEtapeCascade(get);
      if (get().flags.branche) break;
    }
    expect(get().flags.branche, `la branche du nœud est jouée (${noeud})`).toBe(true);

    expect(get().pendingCascade, `le jour repris va au bout (${noeud})`).toBeNull();
    expect(get().suspendedCascades, `la pile est vide (${noeud})`).toEqual([]);
    expect(lignes(t('tf.perilEvite', { label: 'Rien' })), `la suite du jour jouée une fois, après le nœud (${noeud})`).toBe(1);
    expect(lignes(t('tf.perilDAuteur', { label: 'Sanctuaire' })), `le péril ouvrant n’est pas rejoué (${noeud})`).toBe(1);
    expect(exaucee(), `son effet n’est pas rejoué (${noeud})`).toBe(1);
    expect(jours(), `une journée comptée (${noeud})`).toBe(1);
    expect(get().pendingRest, `la halte de nuit s’ouvre après la clôture (${noeud})`).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────
// #4075 — la journée tenue au SLOT (cadence manuelle) suit la règle de son pilote : ce que l'applier de sa
// DERNIÈRE étape ouvre passe avant son dénouement (`cascade.ts › sequenceDuPiloteAContexteHorsCombat`).
// ─────────────────────────────────────────────────────────────────────────────────────────────
describe('péril d’auteur, dernière étape du jour tenu au slot, dont l’effet ouvre un nœud (#4075)', () => {
  beforeEach(() => setRule('priere-petites', true));
  afterEach(() => setRule('priere-petites', false));
  const drapeau = (flag: string): FlowDeScene => ({ kind: 'effet', effet: { type: 'setFlag', flag } });
  const priere = (reward: FlowDeScene) => [{ type: 'petitePriere', heroId: 'h', reward }];
  const PERILS: { noeud: string; effects: unknown[] }[] = [
    { noeud: 'Test d’exposition', effects: [{ type: 'exposureNight', kind: 'froid', count: 1, target: 'groupe' }] },
    { noeud: 'choix', effects: priere({ kind: 'choix', invite: 'Prier encore', oui: drapeau('branche'), non: drapeau('branche') }) },
    { noeud: 'Test de scène', effects: priere({ kind: 'test', test: { characteristic: 'force' }, reussite: drapeau('branche'), echec: drapeau('branche') }) },
    { noeud: 'poursuite', effects: [{ type: 'startPursuit', partyRole: 'fleeing', distance: 4, skill: { id: 'athletisme' }, foes: [{ id: 'loup' }] }] },
  ];
  const jours = () => get().travelPlan?.log?.length ?? 0;
  const etat = () => { const s = get(); const p = s.pendingCascade; return `slot=${p ? `${p.purpose}@${p.cursor}/${p.participants.length}` : '-'} test=${!!s.pendingTest} pile=[${s.suspendedCascades.map((c) => `${c.purpose}@${c.cursor}/${c.participants.length}`)}] jours=${jours()} halte=${!!s.pendingRest} combat=${!!s.battle}`; };

  for (const geste of ['Suivant', 'Tout résoudre'] as const) for (const { noeud, effects } of PERILS) {
    it(`${noeud}, par « ${geste} » : la journée se compte et la halte s’ouvre à la clôture du nœud, une fois`, () => {
      seedBattleRng(1);
      const h = hero({ items: [ration('r1')], skills: [{ id: 'priere', characteristic: 'sociabilite', advances: 200 } as any] });
      setup(map({ km: 30, perils: [{ label: 'Péril', chancePct: 100, effects: effects as any }] }), [h]);
      get().partirEnVoyage('r1', 'pied');
      const jour = get().pendingCascade!;
      expect([jour.purpose, jour.cursor, jour.participants.length], `prémisse : le péril est la seule étape du jour, au slot (${etat()})`).toEqual(['travelDay', 0, 1]);
      if (geste === 'Suivant') avanceEtapeCascade(get); else get().jetLancer('cascade');
      banc.reprendreTout();
      expect(get().pendingCascade?.purpose ?? (get().pendingTest ? 'test' : null), `prémisse : le nœud ouvert tient le slot (${etat()})`).not.toBeNull();
      let tours = 0;
      for (; tours < 80 && (get().pendingTest || get().pendingCascade); tours++) {
        expect(jours(), `aucune journée comptée sous le nœud (${etat()})`).toBe(0);
        expect(get().pendingRest, `aucune halte sous le nœud (${etat()})`).toBeNull();
        expect(get().suspendedCascades.map((c) => [c.purpose, c.cursor]), `le jour attend en pile, fini (${etat()})`).toEqual([['travelDay', 1]]);
        if (get().pendingTest) { get().jetLancer('test'); get().jetValider('test'); } else avanceEtapeCascade(get);
        banc.reprendreTout();
      }
      expect(tours, `le nœud s’est clos (${etat()})`).toBeLessThan(80);
      expect(get().suspendedCascades, `la pile est vide (${etat()})`).toEqual([]);
      expect(jours(), `une journée comptée (${etat()})`).toBe(1);
      expect(get().pendingRest, `la halte s’ouvre après la clôture (${etat()})`).toBeTruthy();
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────────────────────
// #4075 — la révélation émise sous la journée tenue au SLOT (cadence manuelle) ouvre sa fenêtre, comme quand
// le pilote joue l'étape lui-même (`combatEffects.ts › pushReveal`).
// ─────────────────────────────────────────────────────────────────────────────────────────────
describe('péril d’auteur qui émet une révélation, seule étape du jour tenu au slot : sa carte se montre (#4075)', () => {
  const MALADIE = 'blessure-purulente';
  const titreDeMaladie = t('eff.titreDeMaladie', { disease: MALADIE });
  const maladie = { type: 'inflictDisease', disease: MALADIE } as const;
  const exposition = { type: 'exposureNight', kind: 'froid', count: 1, target: 'groupe' };
  const jours = () => get().travelPlan?.log?.length ?? 0;
  const etat = () => { const s = get(); const p = s.pendingCascade; return `slot=${p ? `${p.purpose}@${p.cursor}/${p.participants.length}` : '-'} pile=[${s.suspendedCascades.map((c) => `${c.purpose}@${c.cursor}/${c.participants.length}`)}] jours=${jours()} halte=${!!s.pendingRest}`; };
  /** Le jour au slot, son péril seule étape, joué par « Suivant » ; puis la cascade jusqu'au slot libre : rend la suite des
   *  séquences tenues au slot (`purpose`, ou le titre pour une carte), sans répétition. Sous elles, aucune journée comptée. */
  const jouerLeJour = (effects: unknown[], auPremierSlot?: () => void) => {
    seedBattleRng(1);
    setup(map({ km: 30, perils: [{ label: 'Péril', chancePct: 100, effects: effects as any }] }), [hero({ items: [ration('r1')] })]);
    get().partirEnVoyage('r1', 'pied');
    const jour = get().pendingCascade!;
    expect([jour.purpose, jour.cursor, jour.participants.length], `prémisse : le péril est la seule étape du jour, au slot (${etat()})`).toEqual(['travelDay', 0, 1]);
    avanceEtapeCascade(get);
    banc.reprendreTout();
    auPremierSlot?.();
    const vues: string[] = [];
    for (let i = 0; i < 80 && (get().pendingTest || get().pendingCascade); i++) {
      const p = get().pendingCascade;
      const vue = p ? (p.purpose === 'affichage' ? p.title : p.purpose) : 'pendingTest';
      if (vues[vues.length - 1] !== vue) vues.push(vue);
      expect(jours(), `aucune journée comptée tant que le slot est tenu (${etat()})`).toBe(0);
      expect(get().pendingRest, `aucune halte tant que le slot est tenu (${etat()})`).toBeNull();
      if (get().pendingTest) { get().jetLancer('test'); get().jetValider('test'); } else avanceEtapeCascade(get);
      banc.reprendreTout();
    }
    expect(get().suspendedCascades, `la pile est vide (${etat()})`).toEqual([]);
    expect(jours(), `une journée comptée (${etat()})`).toBe(1);
    expect(get().pendingRest, `la halte s’ouvre après la clôture (${etat()})`).toBeTruthy();
    return vues;
  };

  it('A.1 : sous le Test de scène, le départ commandé attend la carte de maladie avant son dénouement', () => {
    setRule('voyage-etapes', false);
    seedBattleRng(1);
    setup(map({ km: 30, perils: [{ label: 'Péril', chancePct: 100, effects: [maladie] }] }), [hero({ items: [ration('r1')] })]);

    const branche: FlowDeScene = { kind: 'effet', effet: { type: 'setFlag', flag: 'test-joue' } };
    runFlow(banc.getState, banc.setState, { kind: 'test', test: { characteristic: 'force' }, reussite: branche, echec: branche });
    expect(get().pendingCascade?.participants.map((s) => s.kind)).toEqual(['jetDeTestDeScene']);

    get().partirEnVoyage('r1', 'pied', { cadence: 'commande' });
    expect(get().pendingTest).not.toBeNull();
    expect(get().party[0].diseases?.map((d) => d.id)).toContain(MALADIE);
    expect(get().pendingCascade?.participants.map((s) => s.kind)).toEqual(['jetDeTestDeScene', 'effet']);
    expect(get().suspendedCascades.map((s) => [s.purpose, s.cursor, s.participants.length])).toEqual([['travelDay', 1, 1]]);
    expect([jours(), get().pendingRest]).toEqual([0, null]);

    get().jetLancer('test');
    get().jetValider('test');
    banc.reprendreTout();
    expect(get().flags['test-joue']).toBe(true);
    expect(get().pendingTest).toBeNull();
    const slot = get().pendingCascade;
    expect(slot?.participants[slot.cursor]?.label).toBe(titreDeMaladie);
    expect([jours(), get().pendingRest]).toEqual([0, null]);

    avanceEtapeCascade(get);
    banc.reprendreTout();
    expect(get().pendingCascade).toBeNull();
    expect(get().suspendedCascades).toEqual([]);
    expect(jours()).toBe(1);
    expect(get().pendingRest).toBeTruthy();
  });

  it('[inflictDisease] : la carte de maladie tient le slot, une fois, le jour attend en pile ; fermée, le jour se dénoue une fois', () => {
    const carteAuSlot = () => {
      const carte = get().pendingCascade;
      expect([carte?.purpose, carte?.title, carte?.cursor], `la carte de maladie est au curseur du slot (${etat()})`).toEqual(['affichage', titreDeMaladie, 0]);
      expect(get().suspendedCascades.map((c) => [c.purpose, c.cursor]), `le jour attend en pile, fini (${etat()})`).toEqual([['travelDay', 1]]);
    };
    expect(jouerLeJour([maladie], carteAuSlot), 'la carte, seule, une fois').toEqual([titreDeMaladie]);
  });

  it('[inflictDisease, exposureNight] : le Test d’exposition passe avant la carte de maladie, puis le jour se dénoue une fois', () => {
    expect(jouerLeJour([maladie, exposition]), 'le Test, puis la carte').toEqual(['test', titreDeMaladie]);
  });

  it('[exposureNight, inflictDisease] : la carte rejoint le Test, qui n’a pas de pilote, puis le jour se dénoue une fois', () => {
    const carteDansLeTest = () => expect(get().pendingCascade?.participants.map((x) => x.label), `la carte est une étape du Test (${etat()})`).toContain(titreDeMaladie);
    expect(jouerLeJour([exposition, maladie], carteDansLeTest), 'le Test seul, la carte en son sein').toEqual(['test']);
  });

  it('[setTime] qui franchit minuit : la carte d’entretien quotidien tient le slot, une fois, le jour attend en pile ; fermée, le jour se dénoue une fois', () => {
    const carteAuSlot = () => {
      expect([get().pendingCascade?.purpose, get().pendingCascade?.cursor], `la carte d’entretien est au curseur du slot (${etat()})`).toEqual(['upkeep', 0]);
      expect(get().suspendedCascades.map((c) => [c.purpose, c.cursor, c.participants.length]), `le jour attend en pile, fini (${etat()})`).toEqual([['travelDay', 1, 1]]);
    };
    expect(jouerLeJour([{ type: 'setTime', hour: 6 }], carteAuSlot), 'la carte, seule, une fois').toEqual(['upkeep']);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────
// #4006 — l'applier de la Rencontre d'Étape (`travelPostes.ts › etapeRencontre`), joué d'office par le pilote du
// jour (`jouerLaJournee`), ouvre un nœud de scène : il passe avant le dénouement du jour, halte ou arrivée.
// ─────────────────────────────────────────────────────────────────────────────────────────────
describe('Rencontre d’Étape dont l’applier ouvre un nœud sous la journée pilotée (#4006)', () => {
  beforeEach(() => { setCadence('rapide'); setRule('voyage-etapes', true); });
  afterEach(() => { setCadence('manuel'); resetRule('voyage-etapes'); });
  const drapeau = (flag: string): FlowDeScene => ({ kind: 'effet', effet: { type: 'setFlag', flag } });
  const OUVREURS: { ouvreur: string; etape: string; flow: FlowDeScene }[] = [
    { ouvreur: 'test', etape: 'jetDeTestDeScene', flow: { kind: 'test', test: { characteristic: 'force' }, reussite: drapeau('branche'), echec: drapeau('branche') } },
    { ouvreur: 'choix', etape: 'choixDeFlux', flow: { kind: 'choix', invite: 'Prier encore', oui: drapeau('branche'), non: drapeau('branche') } },
    { ouvreur: 'volontaires', etape: 'volontaireDeFlux', flow: { kind: 'effet', effet: { type: 'ops', on: { volontaires: 'Qui monte la garde ?' }, ops: [{ op: 'condition', id: { id: 'extenue' }, value: 1 }] } } },
    { ouvreur: 'contagion', etape: 'maladieDeFinDeCombat', flow: { kind: 'effet', effet: { type: 'ops', on: 'groupe', ops: [{ op: 'exposeDisease', disease: { id: 'blessure-purulente' } }] } } },
  ];
  const volontaire: ChoisitCle = (etape) => (etape.kind === 'volontaireDeFlux' ? 'oui' : undefined);
  const jours = () => get().travelPlan?.log?.length ?? 0;
  const etat = () => { const s = get(); const p = s.pendingCascade; return `slot=${p ? `${p.purpose}@${p.cursor}/${p.participants.length}:${p.participants[p.cursor]?.kind}` : '-'} test=${!!s.pendingTest} pile=[${s.suspendedCascades.map((c) => `${c.purpose}@${c.cursor}/${c.participants.length}`)}] jours=${jours()} halte=${!!s.pendingRest} lieu=${s.lieu}`; };
  const rencontreQuiOuvre = (flow: FlowDeScene | null) => applierQuiOuvre('etapeRencontre', flow);
  /** Le jour : l'Approvisionnement de Hilda au slot, puis le pilote joue le bilan d'Étape et sa Rencontre tirée. */
  const partir = (km: number, graine: number) => {
    seedBattleRng(graine);
    const h = hero({ travelRole: { activityId: 'approvisionnement' }, items: [ration('r1')], skills: [{ id: 'survie-en-exterieur', advances: 60 } as any] });
    setup(map({ km, perilDie: 0 }), [h]);
    get().partirEnVoyage('r1', 'pied');
    expect([get().pendingCascade?.purpose, get().pendingCascade?.participants[get().pendingCascade!.cursor]?.kind], `prémisse : le poste du jour tient le slot (${etat()})`).toEqual(['travelDay', 'etapePosteEnBande']);
    avanceEtapeCascade(get);
  };
  /** Le nœud au slot, le jour fini en pile derrière sa Rencontre ; joué jusqu'à sa clôture, le jour se dénoue. */
  const jouerLeNoeud = (cas: string, etape: string) => {
    expect(get().pendingCascade?.participants[get().pendingCascade!.cursor]?.kind, `le nœud tient le slot (${cas}, ${etat()})`).toBe(etape);
    const jour = get().suspendedCascades.map((c) => [c.purpose, c.cursor === c.participants.length]);
    expect(jour, `le jour attend en pile, fini (${cas}, ${etat()})`).toEqual([['travelDay', true]]);
    let tours = 0;
    for (; tours < 20 && (get().pendingTest || get().pendingCascade); tours++) {
      expect(jours(), `aucune journée comptée sous le nœud (${cas}, ${etat()})`).toBe(0);
      expect(get().pendingRest, `aucune halte sous le nœud (${cas}, ${etat()})`).toBeNull();
      expect(get().travelPlan, `aucune arrivée sous le nœud (${cas}, ${etat()})`).not.toBeNull();
      expect(get().suspendedCascades.map((c) => c.purpose), `le jour attend en pile (${cas}, ${etat()})`).toEqual(['travelDay']);
      if (get().pendingTest) { get().jetLancer('test'); get().jetValider('test'); } else avanceEtapeCascade(get, undefined, volontaire);
    }
    banc.reprendreTout();
    expect(tours, `le nœud s’est clos (${cas}, ${etat()})`).toBeLessThan(20);
    expect([get().pendingCascade, get().suspendedCascades], `le slot est libre, la pile vide (${cas}, ${etat()})`).toEqual([null, []]);
  };
  /** L'effet du nœud est joué : la branche du Test ou du choix, l'État du volontaire, le verdict de contagion. */
  const brancheJouee = (ouvreur: string) => {
    if (ouvreur === 'volontaires') return get().party[0]!.conditions.some((c) => c.id === 'extenue');
    if (ouvreur === 'contagion') return get().journal.includes(t('cf.resisteALInfection', { name: 'Hilda' })) || (get().party[0]!.diseases ?? []).length > 0;
    return !!get().flags.branche;
  };

  for (const graine of [7, 2]) for (const { ouvreur, etape, flow } of OUVREURS) it(`${ouvreur}, graine ${graine}, 30 km : le nœud passe avant le dénouement du jour, une journée comptée, la halte après`, () => {
    const cas = `${ouvreur}, graine ${graine}`;
    const passages = rencontreQuiOuvre(flow);
    partir(30, graine);
    expect(passages.n, `prémisse (${cas}) : le pilote a joué l’applier de la Rencontre`).toBe(1);
    jouerLeNoeud(cas, etape);
    expect(brancheJouee(ouvreur), `l’effet du nœud est joué (${cas})`).toBe(true);
    expect(passages.n, `la Rencontre n’est pas rejouée (${cas})`).toBe(1);
    expect(jours(), `une journée comptée (${cas})`).toBe(1);
    expect(get().pendingRest, `la halte s’ouvre après la clôture (${cas})`).toBeTruthy();
  });

  /** Le dénouement « arrivée », que le témoin sans nœud fixe : plan clos au lieu d'arrivée, sans halte. */
  const arrivee = () => [get().travelPlan, get().lieu, get().pendingRest, get().scene?.id, get().journal[get().journal.length - 1]];
  const ARRIVEE = [null, 'pb', null, 'lieu-a-scene', t('tf.arrivee', { to: 'B' })];
  it('témoin sans nœud, 12 km : le jour de la Rencontre finit sur l’arrivée', () => {
    const passages = rencontreQuiOuvre(null);
    partir(12, 7);
    banc.reprendreTout();
    expect(passages.n, 'prémisse : le pilote a joué l’applier de la Rencontre').toBe(1);
    expect([get().pendingCascade, get().suspendedCascades], 'le jour s’est dénoué').toEqual([null, []]);
    expect(arrivee()).toEqual(ARRIVEE);
  });
  for (const { ouvreur, etape, flow } of OUVREURS) it(`${ouvreur}, 12 km : le nœud passe avant l’arrivée, puis le voyage arrive comme le témoin`, () => {
    const passages = rencontreQuiOuvre(flow);
    partir(12, 7);
    expect(passages.n, `prémisse (${ouvreur}) : le pilote a joué l’applier de la Rencontre`).toBe(1);
    jouerLeNoeud(ouvreur, etape);
    expect(brancheJouee(ouvreur), `l’effet du nœud est joué (${ouvreur})`).toBe(true);
    expect(passages.n, `la Rencontre n’est pas rejouée (${ouvreur})`).toBe(1);
    expect(arrivee(), `le même dénouement que le témoin (${ouvreur})`).toEqual(ARRIVEE);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────
// #3935 — la route de terre se joue sous les ordres du trajet (`TravelPlan.orders`, `traverseeCommandee`).
// ─────────────────────────────────────────────────────────────────────────────────────────────
describe('#3935 — la route de terre se joue sous les ordres du trajet', () => {
  /** Quatre héros, chacun tient un poste à Test. */
  const quatrePostes = (): Combatant[] => ([
    ['h1', 'Hilda', 'plein-air', 'survie-en-exterieur'],
    ['h2', 'Gunther', 'approvisionnement', 'survie-en-exterieur'],
    ['h3', 'Elsa', 'recueillir-informations', 'ragot'],
    ['h4', 'Bruno', 'rester-aux-aguets', 'perception'],
  ] as const).map(([id, label, activityId, skill]) => hero({ id, label, travelRole: { activityId }, items: [ration(`${id}-r`)], skills: [{ id: skill, advances: 20 } as any] }));
  const traceDe = (label: string) => get().journal.filter((l) => new RegExp(`^${label} — .+ : \\d+/\\d+ → `).test(l));
  /** Route à « Attaqués ! » (graine 326, péripétie au d8) dont l'embuscade est configurée. */
  const routeAEmbuscade = () => map({ km: 30, perilDie: 8, ambush: { scene: { id: 'lieu-a-scene' }, encounter: 'enc-test' } });
  /** Draine la cascade de nuit ; s'arrête sur celle du jour suivant si elle s'ouvre. */
  const dormir = () => {
    get().fenetreValider('repos');
    for (let i = 0; i < 40 && get().pendingCascade && get().pendingCascade!.purpose !== 'travelDay'; i++) avanceEtapeCascade(get);
  };

  it('sous ordres, quatre postes tenus : du départ à la halte sans arrêt, chaque Test au journal', () => {
    setRule('voyage-etapes', true);
    seedBattleRng(1);
    setup(map({ km: 30, perilDie: 0 }), quatrePostes());
    get().partirEnVoyage('r1', 'pied', { cadence: 'commande' });
    expect(get().travelPlan!.orders, 'le plan de terre porte les ordres du départ').toEqual({ cadence: 'commande' });
    expect(get().pendingCascade, 'aucune fenêtre ne s’ouvre dans la journée').toBeNull();
    expect(get().pendingRest, 'la journée va à la halte').toBeTruthy();
    for (const label of ['Hilda', 'Gunther', 'Elsa', 'Bruno']) expect(traceDe(label).length, `le Test de poste de ${label} laisse sa ligne`).toBeGreaterThanOrEqual(1);
  });

  it('jour par jour (défaut du départ), la même journée s’arrête sur la bande des postes', () => {
    setRule('voyage-etapes', true);
    seedBattleRng(1);
    setup(map({ km: 30, perilDie: 0 }), quatrePostes());
    get().partirEnVoyage('r1', 'pied');
    expect(get().travelPlan!.orders, 'le plan de terre porte les ordres par défaut').toEqual(DEFAULT_VOYAGE_ORDERS);
    passerLaMeteo();
    const pc = get().pendingCascade!;
    expect(pc.purpose).toBe('travelDay');
    expect(pc.participants[pc.cursor].kind).toBe('etapePosteEnBande');
    expect(pc.participants[pc.cursor].participants!.every((r) => r.result == null), 'aucune rangée roulée').toBe(true);
  });

  it('une péripétie éreintante joue son Test d’office et laisse sa trace (perilATerreSurvie)', () => {
    seedBattleRng(2);
    setup(map({ km: 12, perilDie: 8 }), [hero({ items: [ration('r1')], skills: [{ id: 'survie-en-exterieur', advances: 20 } as any, { id: 'perception', advances: 20 } as any] })]);
    get().partirEnVoyage('r1', 'pied', { cadence: 'commande' });
    expect(get().pendingCascade, 'le Test de la péripétie n’ouvre aucune fenêtre').toBeNull();
    expect(get().lieu).toBe('pb');
    expect(get().journal).toContain('Hilda — Survie en extérieur : 29/70 → réussi (DR +5).');
    expect(get().journal).toContain('Hilda — Survie en extérieur (+20) : un itinéraire de substitution est trouvé.');
  });

  it('une péripétie qui ouvre un combat arrête le jour par l’interruption de terre', () => {
    seedBattleRng(326);
    setup(routeAEmbuscade(), [hero({ skills: [{ id: 'perception', advances: 20 } as any] })]);
    get().partirEnVoyage('r1', 'pied', { cadence: 'commande' });
    expect(get().pendingCascade).toBeNull();
    expect(get().travelPlan!.interrupted).toBe(true);
    expect(get().travelRecap!.then?.kind).toBe('ambush');
    expect(get().pendingRest, 'interrompu : aucune halte').toBeFalsy();
    expect(get().battle, 'le combat attend l’acquittement du récit').toBeNull();
  });

  it('fixerLaCadence en route : jour par jour → commandée, le jour suivant se joue sans arrêt', () => {
    seedBattleRng(1);
    setup(map({ km: 60, perilDie: 0 }), [hero({ items: [ration('r1'), ration('r2'), ration('r3')], skills: [{ id: 'survie-en-exterieur', advances: 20 } as any] })]);
    setRule('voyage-etapes', true);
    banc.setState({ party: get().party.map((h) => ({ ...h, travelRole: { activityId: 'approvisionnement' } })) });
    get().partirEnVoyage('r1', 'pied', { cadence: 'jourParJour' });
    expect(get().pendingCascade?.purpose, 'jour 1 : la journée ouvre ses fenêtres').toBe('travelDay');
    drainCascade();
    expect(get().pendingRest).toBeTruthy();
    get().fixerLaCadence('commande');
    dormir();
    expect(get().pendingCascade, 'jour 2 : aucune fenêtre').toBeNull();
    expect(get().travelPlan!.log!.length, 'le jour 2 est joué jusqu’à sa halte').toBe(2);
    expect(get().pendingRest).toBeTruthy();
  });

  it('fixerLaCadence en route : commandée → jour par jour, le jour suivant s’arrête', () => {
    seedBattleRng(1);
    setup(map({ km: 60, perilDie: 0 }), [hero({ items: [ration('r1'), ration('r2'), ration('r3')], skills: [{ id: 'survie-en-exterieur', advances: 20 } as any] })]);
    setRule('voyage-etapes', true);
    banc.setState({ party: get().party.map((h) => ({ ...h, travelRole: { activityId: 'approvisionnement' } })) });
    get().partirEnVoyage('r1', 'pied', { cadence: 'commande' });
    expect(get().pendingCascade, 'jour 1 : aucune fenêtre').toBeNull();
    expect(get().pendingRest).toBeTruthy();
    get().fixerLaCadence('jourParJour');
    dormir();
    expect(get().pendingCascade?.purpose, 'jour 2 : la journée ouvre ses fenêtres').toBe('travelDay');
    expect(get().travelPlan!.log!.length).toBe(1);
  });

  it('sous ordres, l’allure forcée d’un conducteur joueur se joue d’office, chaque km au journal', () => {
    setRule('voyage-allures', true);
    seedBattleRng(1);
    const h = hero({ id: 'h', skills: [{ id: 'conduite-d-attelage', advances: 40 } as any] });
    setup({ ...map({ km: 20, perilDie: 0 }), routes: [{ ...map().routes[0], km: 20, modes: ['diligence', 'pied'], perilDie: 0 }] }, [h]);
    creditBourse(get, set, 'h', { gold: 500, silver: 0, brass: 0 });
    get().partirEnVoyage('r1', 'diligence', { allure: 'galop', cadence: 'commande' });
    expect(get().pendingCascade, 'aucune fenêtre ne s’ouvre dans la journée').toBeNull();
    const kms = get().journal.filter((l) => l.includes('(allure forcée)')).length;
    expect(kms, 'prémisse : des km au pas de course').toBeGreaterThan(0);
    expect(traceDe('Hilda').length, 'chaque km joué laisse sa ligne').toBe(kms);
  });

  /** Chaque moyen de terre, sous ordres puis sans cadence déclarée : en selle, transport payant, attelage conduit. */
  const monture = (uid: string, ownerId: string): Possession => ({ uid, ownerId, nature: 'bete', ref: { id: 'cheval-de-monte' }, location: { kind: 'avec-le-groupe' }, items: [] } as Possession);
  it.each([
    { moyen: 'en selle', mode: 'monture', opts: { allure: 'trot' }, montures: true },
    { moyen: 'transport payant', mode: 'diligence', opts: {}, montures: false },
    { moyen: 'attelage conduit au galop', mode: 'diligence', opts: { allure: 'galop' }, montures: false },
  ] as const)('$moyen : sous ordres, aucune fenêtre ; sans cadence déclarée, jour par jour, la journée ouvre la sienne', ({ mode, opts, montures }) => {
    for (const cadence of ['commande', undefined] as const) {
      setRule('voyage-etapes', true);
      setRule('voyage-allures', true);
      seedBattleRng(1);
      setup(map({ km: 30, modes: ['pied', 'diligence'] }), [
        hero({ id: 'h1', label: 'Hilda', travelRole: { activityId: 'approvisionnement' }, items: [ration('a'), ration('b')], skills: [{ id: 'survie-en-exterieur', advances: 20 } as any, { id: 'conduite-d-attelage', advances: 40 } as any, { id: 'equitation', advances: 20 } as any] }),
        hero({ id: 'h2', label: 'Bruno', travelRole: { activityId: 'rester-aux-aguets' }, items: [ration('c'), ration('d')], skills: [{ id: 'perception', advances: 20 } as any] }),
      ]);
      if (montures) banc.setState({ possessions: [monture('m1', 'h1'), monture('m2', 'h2')] });
      creditBourse(get, set, 'h1', { gold: 500, silver: 0, brass: 0 });
      get().partirEnVoyage('r1', mode, { ...opts, ...(cadence ? { cadence } : {}) });
      if (cadence) {
        expect(get().pendingCascade, 'sous ordres : aucune fenêtre').toBeNull();
        expect(get().lieu, 'la route va au bout sans arrêt').toBe('pb');
      } else {
        expect(get().travelPlan?.mode, 'le trajet part par ce moyen').toBe(mode);
        expect(get().pendingCascade?.purpose, 'jour par jour : la journée ouvre sa fenêtre').toBe('travelDay');
      }
    }
  });

  it('hors mode local, un jour de terre aux ordres commandés reste jour par jour', () => {
    setRule('voyage-etapes', true);
    seedBattleRng(1);
    setup(map({ km: 30, perilDie: 0 }), quatrePostes());
    banc.setState({ net: { ...get().net, mode: 'hote' } });
    get().partirEnVoyage('r1', 'pied', { cadence: 'commande' });
    expect(get().travelPlan!.orders).toEqual({ cadence: 'commande' });
    expect(get().pendingCascade?.purpose, 'la journée ouvre ses fenêtres').toBe('travelDay');
  });

  it('le pilote du jour (`jouerLaJournee`) : commandé, la bande et la péripétie se jouent d’office au journal ; sinon il s’arrête sur la bande', () => {
    for (const commandee of [false, true]) {
      const a = hero({ id: 'a', label: 'Anna', skills: [{ id: 'survie-en-exterieur', characteristic: 'intelligence', advances: 5 } as any] });
      const b = hero({ id: 'b', label: 'Bert', skills: [{ id: 'survie-en-exterieur', characteristic: 'intelligence', advances: 5 } as any] });
      banc.setState({ party: [a, b], pendingCascade: null, journal: [] });
      const bande = bandStep({ id: 'stage-postes', kind: 'etapePosteEnBande', label: t('step.stagePostes') }, [a, b].map((h) => ({
        id: h.id, teste: { skill: { id: 'survie-en-exterieur' } }, label: testSkillLabel({ skill: { id: 'survie-en-exterieur' } }), interactive: true, result: null, difficulty: 'intermediaire' as const,
        ...rollStep({ actor: h, test: { skill: { id: 'survie-en-exterieur' } }, difficulty: 'intermediaire' }),
      })))!;
      const peril = monoStep({ id: 'peril-survie', kind: 'perilATerreSurvie', actor: a, label: t('step.perilATerreSurvie'), difficulty: 'accessible',
        stake: voyageStakeRef('route-peripetie-survie'), ligne: { test: { skill: { id: 'survie-en-exterieur' } } } })!;
      jouerLaJournee(get, set, [bande, peril], { title: 'Jour', purpose: 'travelDay' }, commandee);
      const pc = get().pendingCascade;
      if (!commandee) {
        expect(pc?.participants[pc.cursor].kind, 'jour par jour : arrêt sur la bande').toBe('etapePosteEnBande');
        continue;
      }
      expect(pc, 'commandé : la journée va au bout').toBeNull();
      for (const label of ['Anna', 'Bert']) expect(traceDe(label).length, `la rangée de ${label} laisse sa ligne`).toBeGreaterThanOrEqual(1);
      expect(traceDe('Anna').length, 'la péripétie laisse aussi la sienne').toBe(2);
    }
  });
});

describe('Rester aux aguets, de l’Étape au combat (#4154)', () => {
  const combat = { type: 'startCombat', encounter: { id: 'enc-test' } } as const;
  const transition = { type: 'transition', scene: { id: 'lieu-b-scene' } } as const;
  const embuscade = { perilDie: 8, ambush: { scene: transition.scene, encounter: combat.encounter.id } };
  const miseEnPlace = (route: Partial<MapRouteTrace>, surpris: 'groupe' | 'ennemis' = 'groupe') => {
    seedBattleRng(1);
    const scenes = [sceneA(surpris), { ...sceneA(surpris), id: 'lieu-b-scene', label: 'B' }];
    const worldMap = map({ provenances: { perilDie: { maison: 'Seuil du banc de voyage.' } }, ...route });
    const identite = { type: 'projet', id: 'voyage-aux-aguets', label: 'Voyage aux aguets', versionContenu: 1, maison: 'Banc de voyage.' } as const;
    const projet = parseProject(documentDeProjet(identite, scenes, { worldMap, narratif: emptyNarratif() }));
    setup(projet.worldMap!, [hero({
      travelRole: { activityId: 'rester-aux-aguets' },
      items: [ration('r1'), ration('r2')],
      skills: [{ id: 'perception', characteristic: 'initiative', advances: 20 }, { id: 'discretion', characteristic: 'agilite', advances: 60 }],
    })], projet.scenes);
    get().partirEnVoyage('r1', 'pied', { cadence: 'jourParJour' });
  };
  const poser = (aguets: number, peripetie = 92, seuil = 8): PoseDe => (etape) => {
    switch (etape.kind) {
      case 'etape-meteo': return 31;
      case 'etapePosteEnBande': return aguets;
      case 'perilATerre': return seuil;
      case 'perilATerreTable': return PERIPETIES.find((p) => p.kind === 'attaque')!.roll;
      case 'perilATerrePerception': return peripetie;
      case 'perilDeScene': return 1;
      default: return undefined;
    }
  };
  const enjeuSurprise = combatStakeRef('embuscade-reperer');
  const surpriseEnCours = () => get().pendingCascade?.participants.map((s) => s.stake) ?? [];

  beforeEach(() => {
    setRule('voyage-etapes', true);
    setCadence('manuel');
    setDesFixes(true);
  });
  afterEach(() => {
    resetRule('voyage-etapes');
    resetDesFixes();
  });

  it.each([
    { aguets: 21, peripetie: 92, surprise: false },
    { aguets: 92, peripetie: 92, surprise: true },
    { aguets: 92, peripetie: 21, surprise: false },
  ])('« Attaqués ! » : aguets $aguets, Perception $peripetie, Surprise $surprise', ({ aguets, peripetie, surprise }) => {
    miseEnPlace(embuscade);
    const etapes = draineCascade(get, 40, poser(aguets, peripetie));
    expect(etapes).toContain('etapePosteEnBande');
    expect(etapes).toContain('perilATerrePerception');
    expect(get().travelRecap?.then?.kind).toBe('ambush');
    expect(get().battle).toBeNull();
    get().fenetreFermer('recitDeVoyage');
    expect(get().battle).not.toBeNull();
    if (surprise) expect(surpriseEnCours()).toContainEqual(enjeuSurprise);
    else expect(surpriseEnCours()).not.toContainEqual(enjeuSurprise);
  });

  it('l’embuscade configurée après minuit reste couverte si l’Étape n’a pas changé', () => {
    miseEnPlace({ ...embuscade, perils: [{ label: 'Retard jusqu’à l’aube', chancePct: 100, effects: [{ type: 'setTime', hour: 6 }] }] });
    const jour = dayIndex(get().gameTime);
    let perception: { roll: number; success: boolean } | undefined;
    const desabonner = banc.subscribe((etat) => {
      const test = etat.pendingCascade?.participants.find((etape) => etape.kind === 'perilATerrePerception');
      const resultat = test?.result;
      if (resultat?.roll !== undefined) perception = { roll: resultat.roll, success: resultat.success };
    });
    const etapes = draineCascade(get, 40, poser(21));
    desabonner();
    expect(perception).toMatchObject({ roll: 92, success: false });
    expect(etapes.filter((kind) => kind === 'etapePosteEnBande')).toHaveLength(1);
    expect(etapes).toContain('perilATerrePerception');
    expect(dayIndex(get().gameTime)).toBe(jour + 1);
    expect(get().travelRecap?.then?.kind).toBe('ambush');
    expect(get().battle).toBeNull();
    get().fenetreFermer('recitDeVoyage');
    expect(get().scene?.id).toBe('lieu-b-scene');
    expect(get().battle).not.toBeNull();
    expect(surpriseEnCours()).not.toContainEqual(enjeuSurprise);
  });

  it('la garde du groupe laisse jouer l’embuscade tendue aux ennemis', () => {
    miseEnPlace(embuscade, 'ennemis');
    draineCascade(get, 40, poser(21));
    get().fenetreFermer('recitDeVoyage');
    expect(get().battle).not.toBeNull();
    expect(get().battle!.log.map((e) => e.text)).toContainEqual(expect.stringMatching(/Hilda \(Discrétion\).*Brigand \(Perception — Surprise\) /));
  });

  it('après la halte, la réussite de l’Étape précédente ne couvre plus le groupe', () => {
    miseEnPlace({ ...embuscade, km: 30 });
    expect(draineCascade(get, 40, poser(21, 92, 1))).toContain('etapePosteEnBande');
    expect(get().battle).toBeNull();
    expect(get().pendingRest?.travelHalt).toBe(true);
    get().fenetreValider('repos');
    const etapes = draineCascade(get, 80, poser(92));
    expect(etapes.filter((kind) => kind === 'etapePosteEnBande')).toHaveLength(1);
    expect(get().travelRecap?.then?.kind).toBe('ambush');
    get().fenetreFermer('recitDeVoyage');
    expect(get().battle).not.toBeNull();
    expect(surpriseEnCours()).toContainEqual(enjeuSurprise);
  });

  it('une transition sans combat ne transmet pas la protection au combat libre dans la scène atteinte', () => {
    miseEnPlace({ perils: [{ label: 'Arrivée au pont', chancePct: 100, effects: [transition] }] });
    draineCascade(get, 40, poser(21));
    get().fenetreFermer('recitDeVoyage');
    expect(get().travelPlan?.interrupted).toBe(true);
    expect(get().scene?.id).toBe('lieu-b-scene');
    expect(get().battle).toBeNull();
    get().lancerLeCombat('enc-test');
    expect(get().battle).not.toBeNull();
    expect(surpriseEnCours()).toContainEqual(enjeuSurprise);
  });

  it('l’entrée de combat d’une Rencontre jouée dans l’Étape lit aussi la porte', () => {
    const rencontre = applierQuiOuvre('etapeRencontre', { kind: 'effet', effet: combat });
    miseEnPlace({});
    const etapes = draineEtapes(get, 40, poser(1));
    expect(rencontre.n).toBe(1);
    expect(get().battle).not.toBeNull();
    expect(etapes.map((e) => e.stake)).not.toContainEqual(enjeuSurprise);
    expect(surpriseEnCours()).not.toContainEqual(enjeuSurprise);
  });
});

describe('#4804 — la route passe à pied en tête de la journée où un héros n’est plus en selle', () => {
  /** Trajet de `km` en selle (63 km le premier jour) ; le héros descend à la halte du premier soir, puis dort. */
  function descendreALaHalte(km: number): void {
    setRule('voyage-allures', true);
    seedBattleRng(1);
    setup(map({ km, perilDie: 0 }), [hero({ items: [ration('r1'), ration('r2'), ration('r3')] })]);
    banc.setState({ possessions: [{ uid: 'm1', ownerId: 'h', nature: 'bete', ref: { id: 'cheval-de-monte' }, location: { kind: 'avec-le-groupe' }, items: [] } as Possession] });
    get().partirEnVoyage('r1', 'monture', { cadence: 'commande' });
    expect(get().pendingRest, 'prémisse : la halte du premier soir').toBeTruthy();
    expect(get().travelPlan?.mode).toBe('monture');
    get().quitterLaSelle('m1');
    get().fenetreValider('repos');
  }

  it('descendre à la halte du soir : le lendemain part à pied, sans calage', () => {
    descendreALaHalte(200);
    for (let i = 0; i < 40 && get().pendingCascade; i++) avanceEtapeCascade(get);
    expect(get().travelPlan?.mode).toBe('pied');
    expect(get().travelPlan?.interrupted ?? false).toBe(false);
    expect(get().journal).toContain(t('tf.pasTousMontes'));
    expect(get().journal).not.toContain(t('tf.surcharge'));
    const log = get().travelPlan?.log ?? [];
    const jourDuLendemain = log[log.length - 1];
    expect(jourDuLendemain?.lines.map((l) => l.text)).toContain(t('tf.pasTousMontes'));
  });

  it('arrivée le jour du passage à pied : le récit de voyage dit « à pied »', () => {
    descendreALaHalte(80);
    runToEnd();
    expect(get().travelPlan, 'arrivé').toBeNull();
    expect(get().travelRecap?.status).toBe('arrived');
    expect(get().travelRecap?.mode).toBe('pied');
  });
});
