/**
 * POSTES d'Activité d'une Étape de voyage (EDOC 8) — module FEUILLE (convention « baril ») :
 * n'importe RIEN de `travelFlow` (ré-exporté par lui). Chaque héros tient ≤1 Activité ; depuis la
 * Phase B (voyage terrestre), TOUS les jets de l'Étape (Activités + Exposition de fin d'Étape) passent
 * par la CASCADE influençable du JOUR (`purpose:'travelDay'`) au lieu d'être auto-résolus inline —
 * Chance/Pacte/Résilience s'appliquent, exactement comme la nuit et le voyage fluvial.
 *
 * Deux temps, zéro duplication de formule (moteur PUR `engine/activities` + `engine/exposure`) :
 *  - `buildStageSteps` construit les ÉTAPES influençables (1 jet par poste testé + 1 pas d'agrégation)
 *    et pose le contexte transitoire de l'Étape sur le plan (`travelPlan.stage`) ;
 *  - les APPLIERS (`etapePoste`, `etapeBilan`, `etapeExposition`) appliquent la conséquence RAW à la
 *    VALIDATION de chaque étape — un poste réussi/raté (ops/Exténué/issue de portée Étape), puis
 *    l'agrégation (fourrage cumulé, camp, cartes, Rencontre) qui INSÈRE les jets d'Exposition (comme
 *    la nuit : l'abri insère les jets d'Exposition). RAW : « chaque Personnage bénéficie d'une Activité
 *    par Étape » (l.131) ; un échec octroie un Exténué (l.133).
 */
import type { IconId } from '../data/icons';
import { battleRng } from './battleRng';
import {
  travelActivitySpec, aggregateActivityOutcomes, activityById,
  type ActivityDef, type TravelActivityResult,
} from '../engine/activities';
import type { RefDesignee } from '../data/schemas/grammaire/ref';
import { refLabel, testSkillLabel, weatherStakeRef, voyageStakeRef } from '../data';
import { stageEncounterCategory } from '../engine/travelEncounter';
import { encounterTable, rollEncounter, encounterDie, type EncounterCategory } from '../engine/travelTables';
import { facesDuDe } from '../engine/tables';
import { applyOps, type GameOp } from '../engine/ops';
import { applyHealWounds } from '../engine/healing';
import { removeCondition, stacks } from '../engine/conditions';
import { extendedTestSteps, type EchecSansJet } from '../engine/tests';
import { appliquerIssueActivite } from './activityIssue';
import { freeCons, resultLines, rollStep, monoStep, displayStep, bandStep, pousseSi, tableStep, type Consequence } from './rollSeam';
import { type BuiltCascadeStep } from './stepBrand';
import { toRecapLines } from './recapLine';
import { t, type MsgKey } from '../i18n';
import { rule } from '../engine/policy';
import {
  stageCount, forageYield, stageExposureDifficulty, weatherResistanceTest,
  isColdSeason, weatherCondition, type Weather, type Season,
} from '../engine/travelStages';
import { weatherTestMods } from '../engine/weatherTestMod'; // #341
import { hasCoat, partyHasTent, applyExposureFailure, isWeatherWarded, exposureFirstFailChars } from '../engine/exposure';
import { rationCount } from '../engine/provisions';
import { contractDiseaseOnce } from '../engine/disease';
import { contexteDeNaissanceDObjet, itemFromGive, autoStowNewItem } from '../engine/items';
import { effectiveSkillCharKey } from '../engine/skills';
import type { Difficulty, Combatant } from '../engine/types';
import type { ModLine } from '../engine/combat';
import { weatherRef } from '../engine/travelStages';
import { partyWalkSpeed, vehicleTravel, type TravelMode } from '../engine/travel';
import { partyMounts } from '../engine/mountTravel';
import type { Possession } from '../engine/possession';
import type { CascadeStepMeta, BatchParticipant } from './pendings';
import type { Get, Set } from './flowTypes';
import type { Jeu } from './etat';
import type { TableStepDef } from './cascade';
import { garanti } from '../lib/garanti';
import { dataLabel } from '../data';
import { stepDetail } from './rollSeam';
import { postingTenu } from '../engine/activities';
import { refuserGesteDuSiege } from './refusVisible';
import { ecrireActeur } from './monde/combatants';
import type { FabriqueDuNoyau } from './machinerieDuNoyau';
import type { FragmentDeTables, PartDeTable } from './tablesPosees';
import { nomDe } from '../engine/nom';

const POSTE_ICON: Record<string, IconId> = {
  'plein-air': 'expedition/grand-air', approvisionnement: 'objet/consommable', 'recueillir-informations': 'expedition/rumeurs', 'rester-aux-aguets': 'interface/oeil',
  'etablir-cartes': 'expedition/cartographie', 'pratiquer-competence': 'expedition/entrainement', recuperer: 'repos/lit', 'monter-camp': 'repos/campement',
};

/** Clés de libellé d'une catégorie de Rencontre (EDOC 8) — des CLÉS, jamais des phrases figées à
 *  l'évaluation du module (dette nommée de `src/i18n/index.ts`). */
const ENCOUNTER_KEY: Record<EncounterCategory, MsgKey> = {
  positives: 'tp.encounterPositive',
  fortuites: 'tp.encounterChance',
  dangereuses: 'tp.encounterDanger',
};

/** CONTEXTE TRANSITOIRE de l'Étape en cours (posé par `buildStageSteps`, lu par les appliers, effacé à
 *  la clôture du jour). Résultats de poste ACCUMULÉS (agrégés par le pas `etapeBilan`) + drapeaux. */
export interface StageContext {
  weather: Weather;
  season: Season;
  /** Ids des héros vivants (cibles potentielles de l'Exposition). */
  livingIds: string[];
  /** Résultats des postes déjà validés cette Étape — l'agrégation les relit (fourrage/camp/carte/Rencontre). */
  results: TravelActivityResult[];
}

/** Reconstruit une réf de compétence libre depuis le meta sérialisé d'une étape. */
function freeSkillFromMeta(meta?: CascadeStepMeta): RefDesignee | undefined {
  const id = meta?.freeSkillId;
  return typeof id === 'string' ? { id, spec: typeof meta?.freeSkillSpec === 'string' ? meta.freeSkillSpec : undefined } : undefined;
}

/** Modificateur météo au Test d'une Activité — DONNÉE (`ActivityDef.weatherMod`, plus d'`id` en dur) :
 *  Plein air (l.106) / Approvisionnement (l.56) portent leur table météo ; les autres n'en ont pas. */
function weatherModOf(def: ActivityDef, weather: Weather): number {
  return def.weatherMod?.[weather] ?? 0;
}

/** Mods CIRCONSTANCIELS d'une rangée BATCH d'Activité (SOURCE UNIQUE avec le mono) : Météo
 *  (`weatherMod`, l.106/56) + « Tests physiques » de la pluie diluvienne (l.82). La DIFFICULTÉ n'y est
 *  PAS (#1072) : elle voyage en donnée de LIGNE (`RollParticipant.difficulty`), rendue en texte + valeur
 *  par `RollLine`. `undefined` si aucun mod (rien à détailler). */
function stageActivityMods(weather: Weather, wMod: number, pMod: number): ModLine[] | undefined {
  const mods: ModLine[] = [
    ...(wMod !== 0 ? [{ label: t('tp.modWeather', { weather: weatherCondition(weather).label }), value: wMod, famille: 'circonstance' as const, ref: weatherRef(weather) }] : []),
    ...(pMod !== 0 ? [{ label: t('tp.modPhysical'), value: pMod, famille: 'circonstance' as const, ref: weatherRef(weather) }] : []),
  ];
  return mods.length ? mods : undefined;
}

/**
 * Construit les ÉTAPES influençables de l'Étape (EDOC 8) : un jet par poste TESTÉ (Activité à
 * compétence), un pas d'AFFICHAGE par poste sans Test (Récupérer), puis UN pas d'agrégation
 * `etapeBilan` (fourrage cumulé, camp, cartes, Rencontre → INSÈRE les jets d'Exposition). Pose le
 * contexte transitoire (`travelPlan.stage`). Ne consomme AUCUN RNG (les jets vivent dans les étapes /
 * l'agrégation). RENVOIE `[]` s'il n'y a aucun poste (l'appelant finalise directement).
 */
/** Mouvement le plus faible du groupe pour le mode de voyage courant (EDOC 8 l.25, modificateur du
 *  nombre d'Étapes) : à pied = Mouvement effectif le plus lent (`partyWalkSpeed`) ; en selle = M le
 *  plus faible des montures possédées ; en véhicule = Déplacement du véhicule. `undefined` si non
 *  déterminable (ex. mode `monture` sans aucune bête) — `stageCount` n'applique alors aucun modificateur. */
function groupMinMovement(party: Combatant[], possessions: Possession[], mode: TravelMode): number | undefined {
  if (mode === 'monture') {
    const mounts = partyMounts(party, possessions);
    return mounts.length ? Math.min(...mounts.map((m) => m.profile.m)) : undefined;
  }
  if (mode !== 'pied') return vehicleTravel(mode)?.movement;
  const speed = partyWalkSpeed(party);
  return speed > 0 ? speed : undefined;
}

export function buildStageSteps(get: Get, set: Set, weather: Weather, season: Season): BuiltCascadeStep[] {
  const plan = get().travelPlan;
  const party = get().party;
  if (!plan?.postes || Object.keys(plan.postes).length === 0) return [];

  const stages = stageCount(plan.km, undefined, groupMinMovement(party, get().possessions, plan.mode));
  const livingIds = party.filter((h) => !h.dead && !h.outOfRencontre).map((h) => h.id);
  const stage: StageContext = { weather, season, livingIds, results: [] };
  set({ travelPlan: { ...plan, stage } });

  const steps: BuiltCascadeStep[] = [];
  // Postes AVEC Test → UN SEUL pas BATCH (une rangée par héros, jets INDÉPENDANTS — arbitrage user
  // 2026-07-11 : « chacun a son propre jet », pas de séquence « jet 1/5 »). Primitive #328 (`BatchParticipant`,
  // flux `cascadeEnBande`). Postes SANS Test → pas d'affichage à conséquence immédiate.
  const batchParts: BatchParticipant[] = [];
  for (const hero of party) {
    const posting = plan.postes[hero.id];
    if (!posting) continue;
    const def = activityById(posting.activityId);
    if (!def) continue;
    const spec = travelActivitySpec(hero, def, { skillMod: weatherModOf(def, weather), stages, freeSkill: posting.freeSkill });
    if (!spec) continue; // poste non tenu (`postingTenu`, EDOC 8 l.172)
    // Test étendu DÉJÀ ACHEVÉ (LDB 12 l.170-186 : un Test étendu SE TERMINE à la cible — il ne se relance
    // PAS chaque jour, sinon le cumul déborde son plafond « 5/2 », « 6/2 » à chaque re-complétion) : le
    // poste n'a plus d'objet → un pas d'AFFICHAGE « achevée », aucun jet ni accumulation (F1).
    if (spec.drTarget != null && (plan.extendedProgress ?? 0) >= spec.drTarget) {
      steps.push(displayStep({ id: `poste-${hero.id}`, kind: 'etapePosteFini', actorId: hero.id, icon: POSTE_ICON[def.id] ?? 'voyage/boussole',
        label: dataLabel(def.label), outcome: toRecapLines([t('tp.activityDone', { label: def.label, dr: spec.drTarget })]) }));
      continue;
    }
    if (spec.target == null) {
      // Activité SANS Test (Récupérer) : pas de rangée de jet — un pas d'affichage dont l'applier applique l'issue.
      const meta: CascadeStepMeta = { activityId: def.id };
      if (posting.freeSkill?.id) { meta.freeSkillId = posting.freeSkill.id; if (posting.freeSkill.spec) meta.freeSkillSpec = posting.freeSkill.spec; }
      steps.push(displayStep({ id: `poste-${hero.id}`, kind: 'etapePoste', actorId: hero.id, icon: POSTE_ICON[def.id] ?? 'voyage/boussole', label: dataLabel(def.label), meta }));
    } else {
      // label = Compétence RÉELLEMENT utilisée, résolue AVEC sa spec (« Métier (Cartographe) ») via
      // `testSkillLabel` ; base/cible déjà influençables. Test ÉTENDU (Établir des cartes, EDOC 8 l.161) : la
      // rangée porte sa progression cumulée (drDone AVANT ce jet, drTarget = 2 × Étapes) → barre de DR
      // sur SA rangée, persistante (arbitrage user). L'accumulation réelle vit dans `etapeBilan`.
      // Mods de rangée : Difficulté + `testMods` + Météo (déjà dans `spec.target`) + « Tests physiques » de la pluie
      // diluvienne (l.82), CE dernier ajouté ici car keyé sur la carac de la compétence utilisée par CE
      // héros (`effectiveSkillCharKey`) — le −10 s'ajoute au mod météo (recalcul de la cible, dont les
      // bornes viennent de `getTestPolicy` via `clampTarget`, jamais d'un plafond écrit ici).
      const wMod = weatherModOf(def, weather);
      const char = effectiveSkillCharKey(hero, spec.test);
      const pMod = weatherTestMods(weather, char).reduce((s, l) => s + l.value, 0); // CANAL UNIQUE (#341)
      const mods = [...spec.mods, ...(stageActivityMods(weather, wMod, pMod) ?? [])];
      const difficulty = spec.difficulty;
      batchParts.push({
        id: hero.id,
        label: testSkillLabel(spec.test),
        interactive: true,
        difficulty,
        result: null,
        // Les mods de MÉTÉO (`wMod`/`pMod`) s'ajoutent à la CIBLE, ils ne sont pas dans la valeur. Poste
        // qu'il ne peut pas tenter (`spec.refus`) : la ligne naît `ECHEC_SANS_JET` (LDB 09 l.30 ; #2588 Q1).
        ...rollStep({ actor: hero, test: spec.test, valeur: spec.value, difficulty, surLaCible: mods, refus: spec.refus }),
        ...(spec.drTarget != null ? { extendedDrDone: Math.min(plan.extendedProgress ?? 0, spec.drTarget), extendedDrTarget: spec.drTarget, extendedDrPartage: true } : {}),
      });
    }
  }
  // Une bande par le mint (`bandStep`) : jets INDÉPENDANTS (#351, cf. l'applier) et POSSESSION posée —
  // plusieurs héros postés → fenêtre de GROUPE, un seul → SON `actorId`. Sans elle, l'arbitre rendait la
  // fenêtre à l'HÔTE SEUL et le siège qui tient le posté ne voyait jamais sa rangée (classe #1268).
  pousseSi(steps, bandStep({ id: 'stage-postes', kind: 'etapePosteEnBande', icon: 'voyage/boussole', label: t('step.stagePostes')}, batchParts));
  // Pas d'agrégation de fin d'Étape (fourrage cumulé, camp, cartes, Rencontre) + insertion des Expositions.
  // Bilan de l'ÉTAPE : aucun personnage n'en est le concerné (c'est la journée du groupe qui se solde) —
  // étape de MONDE, routée au siège MJ (`worldOwner`), jamais une fenêtre sans propriétaire déclaré.
  steps.push(displayStep({ id: 'stage-agg', kind: 'etapeBilan', icon: 'interface/bilan', label: t('step.stageAgg'), worldOwner: true,
    meta: { weatherLabel: dataLabel(weatherCondition(weather).label), stages } }));
  return steps;
}

// ── APPLIERS des étapes de l'Étape (purpose `travelDay`) : conséquence RAW par `kind`, moteur PUR ──

/** UN poste RÉSOLU : son issue (`appliquerIssueActivite`, source unique terre et mer) enregistrée dans le
 *  contexte d'Étape (l'agrégation `etapeBilan` la relira). Partagé par le pas d'affichage
 *  (`etapePoste`, sans Test) et le pas BATCH (`etapePosteEnBande`, avec Test). */
function applyPoste(get: Get, set: Set, hero: Combatant, def: ActivityDef, freeSkill: RefDesignee | undefined, roll: { roll: number; target: number; sl: number; success: boolean } | EchecSansJet | null): Consequence[] {
  const spec = travelActivitySpec(hero, def, { freeSkill });
  if (!spec) return [];
  const { result, consequences } = appliquerIssueActivite(get, hero, def, spec, roll);
  const plan = get().travelPlan;
  if (plan?.stage) set({ travelPlan: { ...plan, stage: { ...plan.stage, results: [...plan.stage.results, result] } } });
  return consequences;
}

/** Test de RÉSISTANCE de traversée (Neige l.86 / Blizzard l.127) au DÉMARRAGE du jour de voyage : UNE
 *  BANDE (une rangée par héros voyageant, jets INDÉPENDANTS influençables) — DISTINCTE de l'Exposition
 *  de fin d'Étape. L'ENJEU verbatim (donnée `resistanceTest.enjeu`) est porté sur la bande ; l'échec
 *  octroie un Exténué (applier `resistanceALaMeteo`). La POSSESSION est posée par le mint (`bandStep`) :
 *  plusieurs voyageurs → fenêtre de GROUPE, un seul → SON `actorId`. Renvoie `[]` si la météo du jour
 *  n'impose aucun Test de traversée. */
export function buildWeatherResistanceSteps(get: Get, weather: Weather): BuiltCascadeStep[] {
  const rt = weatherResistanceTest(weather);
  if (!rt) return [];
  const parts: BatchParticipant[] = [];
  for (const hero of get().party) {
    if (hero.dead || hero.outOfRencontre) continue;
    parts.push({
      id: hero.id, label: refLabel('skills', { id: 'resistance' }), interactive: true,
      difficulty: rt.difficulty,
      ...rollStep({ actor: hero, test: { skill: { id: 'resistance' }, characteristic: 'endurance' }, difficulty: rt.difficulty }),
      result: null,
    });
  }
  const stake = rt.enjeu ? weatherStakeRef(weather) : undefined; // ENJEU = la RÉFÉRENCE de la condition (#1117), résolue au rendu
  const out: BuiltCascadeStep[] = [];
  pousseSi(out, bandStep({ id: 'weather-resistance', kind: 'resistanceALaMeteo', icon: 'repos/froid',
    label: stepDetail(t('step.traversee'), dataLabel(weatherCondition(weather).label)), ...(stake ? { stake } : {}) }, parts));
  return out;
}

/** Jets d'EXPOSITION de fin d'Étape (l.73) à insérer : un par héros vivant devant un Test de Résistance
 *  (météo × équipement via `stageExposureDifficulty`). Protection magique = pas de jet (issue directe). */
function buildExposureSteps(state: { party: Combatant[] }, stage: StageContext): BuiltCascadeStep[] {
  if (!rule('voyage-attraper-froid')) return [];
  const party = state.party;
  const tent = partyHasTent(party);
  const out: BuiltCascadeStep[] = [];
  for (const id of stage.livingIds) {
    const h = party.find((x) => x.id === id);
    if (!h || h.dead) continue;
    const diff = stageExposureDifficulty(stage.weather, hasCoat(h), tent);
    if (!diff) continue; // bien équipé sous pluie/neige normale, ou beau temps → aucun Test
    const st = monoStep({
      id: `expo-${id}`, kind: 'etapeExposition', actor: h, icon: 'repos/froid', label: t('step.exposition'),
      rollLabel: refLabel('skills', { id: 'resistance' }), difficulty: diff as Difficulty,
      // MÊME Test d'Exposition que la nuit de repos : EDOC 08 l.90 renvoie à LDB p181, donc MÊME entrée.
      stake: voyageStakeRef('voyage-exposition', { chars: exposureFirstFailChars('froid') }),
      ligne: { test: { skill: { id: 'resistance' }, characteristic: 'endurance' } },
      meta: { weatherLabel: dataLabel(weatherCondition(stage.weather).label), warded: isWeatherWarded(h), coldSeason: isColdSeason(stage.season) },
    });
    pousseSi(out, st);
  }
  return out;
}

/** Suite « Rhume commun » d'une Exposition ratée, sur la primitive unique `contractDiseaseOnce` : héros
 *  SAIN → contraction à l'incubation authorée de `maladies.json#rhume-commun` (EDOC 08 l.92), donc encore
 *  en incubation à la fin de l'Étape ; héros DÉJÀ enrhumé → ré-exposition, prolongation portée par la
 *  DONNÉE (`reExposition`). Hors saison froide, seule la ré-exposition est ouverte (`contraction: false`).
 *  Mute `hero.diseases`, renvoie son journal. */
function coldExposureChill(hero: Combatant, coldSeason: boolean): string[] {
  return contractDiseaseOnce(hero, 'rhume-commun', battleRng(), {
    incubation: 'raw', message: 'tp.coldSeasonChill', contraction: coldSeason,
  });
}

export function creerActionsDesPostesDeVoyage(get: Get, set: Set) {
  return {
    affecterAuRoleDeMarche: (heroId, role) => {
      if (role && !postingTenu(role)) { refuserGesteDuSiege(get, set, t('tp.refusPosteNonTenu', { label: activityById(role.activityId)?.label ?? role.activityId })); return; }
      set((s) => ecrireActeur(s, heroId, (h) => ({ ...h, travelRole: role ?? undefined })));
    },
  } satisfies FabriqueDuNoyau;
}

/** Les genres d'étape que ce module déclare (table `appliers`). */
export const GENRES_D_ETAPE = [
  'etapePoste', 'etapePosteEnBande', 'resistanceALaMeteo', 'etapeBilan', 'etapeRencontre', 'etapeExposition',
] as const;

/** Les genres d'étape que ce module produit SANS applier : l'hôte ou le jet les traite (`GenreHote`). */
export const GENRES_HOTES = ['etapePosteFini'] as const;

/** Le BILAN de l'Étape, lu sur l'état une fois ses postes résolus : les rations que le fourrage cumulé donne aux
 *  héros qui n'en ont plus, les Exténués que chaque DR du camp retire, la progression des cartes (Test ÉTENDU
 *  inter-Étapes, jets cumulés dans l'ordre des rangées comme leurs barres), la catégorie de Rencontre due, et
 *  si un « Plein air » réussi dispense des Expositions. Lu par son application.
 *  EDOC 8 l.141, l.161, l.180, l.182-233 ; LDB 12 l.170-185 */
function bilanDeLEtape(s: Jeu, stages: number) {
  const plan = s.travelPlan;
  const results = plan?.stage?.results;
  if (!plan || !results) return null;
  let fourrage = results.filter((r) => r.resolver === 'forage' && r.success).reduce((n, r) => n + forageYield(r.sl, 'recherche'), 0);
  const rations: string[] = [];
  for (const h of s.party.filter((x) => !x.dead && !x.outOfRencontre)) {
    if (fourrage <= 0) break;
    if (rationCount(h) >= 1) continue;
    rations.push(h.id);
    fourrage -= 1;
  }
  const agg = aggregateActivityOutcomes(results);
  let campDR = agg.stacks.campCare ?? 0;
  const soins: { heroId: string; n: number }[] = [];
  for (const h of s.party) {
    if (campDR <= 0) break;
    const n = Math.min(campDR, stacks(h, 'extenue'));
    if (n <= 0) continue;
    soins.push({ heroId: h.id, n });
    campDR -= n;
  }
  const jetsDeCarte = agg.etendus.mapMade ?? [];
  const cible = results.find((r) => r.drTarget != null)?.drTarget ?? 2 * stages;
  return {
    rations, soins,
    carte: jetsDeCarte.length ? { cible, ...extendedTestSteps(plan.extendedProgress ?? 0, jetsDeCarte, cible) } : null,
    rencontre: stageEncounterCategory(results),
    pleinAir: agg.gates.includes('suppressExposure'),
  };
}

/** Les lignes du bilan `b` : les rations, le camp, les cartes. */
function lignesDuBilan(s: Jeu, b: NonNullable<ReturnType<typeof bilanDeLEtape>>): string[] {
  const nom = (heroId: string) => nomDe(garanti(s.party.find((h) => h.id === heroId), heroId, 'héros du bilan'));
  return [
    ...b.rations.map((heroId) => t('tp.rationFound', { name: nom(heroId) })),
    ...b.soins.map(({ heroId, n }) => t('tp.campCare', { name: nom(heroId), n })),
    ...(b.carte ? [b.carte.done ? t('tp.mapDone', { dr: b.carte.cible }) : t('tp.mapProgress', { total: b.carte.total, target: b.carte.cible })] : []),
  ];
}

/** Les catégories de Rencontre, une table tirable chacune. EDOC 8 l.186-233 */
const CATEGORIES_DE_RENCONTRE = ['positives', 'fortuites', 'dangereuses'] as const satisfies readonly EncounterCategory[];
const tableDeRencontre = (c: EncounterCategory) => `rencontres-${c}` as const;

/** Les tables tirables que ce module déclare (table `tablesTirables`) : une par catégorie de Rencontre. */
export const TABLES_TIRABLES: readonly string[] = CATEGORIES_DE_RENCONTRE.map(tableDeRencontre);

/** Les tables que ce module déclare au jeu (`noyau/tablesDuJeu.ts`). */
export const TABLES = {
  appliers: {
    /** Poste SANS Test (Récupérer) : pas d'affichage — l'issue s'applique d'office (le journal annonce
     *  seule l'exécution ; aucune rangée de jet). */
    etapePoste: (get, set, step, hero) => {
      const def = activityById(String(step.meta?.activityId ?? ''));
      if (!def || !hero) return;
      const cons = applyPoste(get, set, hero, def, freeSkillFromMeta(step.meta), step.result ?? null);
      set({ party: [...get().party] });
      return { consequences: cons };
    },
    /** Postes AVEC Test = UN pas BATCH (arbitrage user 2026-07-11 : jets INDÉPENDANTS, un par héros posté).
     *  Chaque rangée porte son propre jet influençable (déjà résolu ici) ; sa CONSÉQUENCE est rendue SUR SA
     *  rangée (`part.outcome`, le portrait porte l'attribution — pas de note agrégée à l'étape). `aggregate:
     *  'none'` (ces Tests ne sont pas reliés) : aucun `step.result` agrégé posé/lu (#351). */
    etapePosteEnBande: (get, set, step) => {
      const plan = get().travelPlan;
      if (!step.participants || !plan?.postes) return;
      for (const part of step.participants) {
        const posting = plan.postes[part.id];
        const hero = get().party.find((h) => h.id === part.id);
        const def = posting ? activityById(posting.activityId) : undefined;
        if (!hero || !def || !posting) { part.outcome = []; continue; }
        const cons = applyPoste(get, set, hero, def, posting.freeSkill, part.result ?? null);
        const lines = resultLines(cons); // #349 : ligne STRUCTURÉE (tone dérivé de la Consequence)
        part.outcome = lines; // conséquence SUR SA rangée (le portrait attribue)
        for (const l of lines) get().ecrireAuJournal(l.text); // + journal/recap (une ligne par héros, pas d'agrégat)
      }
      set({ party: [...get().party] });
      return { consequences: [] };
    },
    /** Test de RÉSISTANCE de traversée (l.86/127) : échec → Exténué (op `condition`, patron #338/#340), ligne
     *  DÉRIVÉE (`resultLines`/`opConsequenceLine` case condition) SUR SA rangée (le portrait attribue). Succès →
     *  aucune note (la rangée ✓ ±DR porte le verdict). */
    resistanceALaMeteo: (get, set, step) => {
      if (!step.participants) return;
      for (const part of step.participants) {
        const hero = get().party.find((h) => h.id === part.id);
        const res = part.result;
        if (!hero || !res || res.success) { part.outcome = []; continue; }
        const op: GameOp = { op: 'condition', id: { id: 'extenue' }, value: 1 }; // EDOC 8 l.86/127
        applyOps(hero, [op], { idNeuf: get().forgerUnId, rng: battleRng() });
        const lines = resultLines([{ ops: [op] }]);
        part.outcome = lines;
        for (const l of lines) get().ecrireAuJournal(l.text);
      }
      set({ party: [...get().party] });
      return { consequences: [] };
    },
    /** Le BILAN de fin d'Étape (`bilanDeLEtape`), appliqué ; puis la Rencontre due, tirée à sa table, et
     *  les jets d'Exposition (option « Attraper froid », l.73), sautés si un « Plein air » a réussi (l.141). */
    etapeBilan: (get, set, step) => {
      const bilan = bilanDeLEtape(get(), Number(step.meta?.stages ?? 1));
      const plan = get().travelPlan;
      if (!bilan || !plan?.stage) return;
      const party = get().party;
      for (const heroId of bilan.rations) {
        const h = party.find((x) => x.id === heroId)!;
        const ration = itemFromGive({ trappingId: 'ration' }, get().forgerUnId, undefined, undefined, contexteDeNaissanceDObjet(h));
        h.items = [...(h.items ?? []), ration];
        autoStowNewItem(h, ration); // #204 : rangement par défaut
      }
      for (const { heroId, n } of bilan.soins) removeCondition(party.find((x) => x.id === heroId)!, 'extenue', n);
      // ACHEVÉ : progression FIGÉE à la cible, `buildStageSteps` n'ouvre plus de jet (F1).
      if (bilan.carte) set({ travelPlan: { ...get().travelPlan!, extendedProgress: bilan.carte.done ? bilan.carte.cible : bilan.carte.total } });
      set({ party: [...get().party] });
      const jours = get().travelPlan?.recap?.days ?? [];
      if (bilan.pleinAir && jours.length) jours[jours.length - 1].pleinAir = true;
      const rencontre = bilan.rencontre ? tableStep({
        id: 'etape-rencontre', kind: 'etapeRencontre', worldOwner: true, icon: 'interface/attention', label: t(ENCOUNTER_KEY[bilan.rencontre]),
        table: { tableId: tableDeRencontre(bilan.rencontre), spec: encounterDie() },
        stake: voyageStakeRef('etape-rencontre'),
      }) : undefined;
      return { consequences: freeCons(lignesDuBilan(get(), bilan)), insert: [...(rencontre ? [rencontre] : []), ...(bilan.pleinAir ? [] : buildExposureSteps(get(), plan.stage))] };
    },
    /** La Rencontre tirée (EDOC 8 l.182-233) : sa ligne, et le repos complet d'un voyage tranquille. */
    etapeRencontre: (get, set, step) => {
      const tiree = step.table?.result;
      const entree = tiree && CATEGORIES_DE_RENCONTRE.flatMap(encounterTable).find((e) => e.id === tiree.id);
      if (!tiree || !entree) return;
      const j = [...tiree.lines];
      if (entree.stageOutcome === 'fullRecovery') {
        for (const h of get().party.filter((x) => !x.dead)) {
          // SOURCE UNIQUE `applyHealWounds` — plafond munition logée (LDB 62 l.250) même chemin que Guérison/repos.
          if (h.wounds.current < h.wounds.max) applyHealWounds(h, h.wounds.max - h.wounds.current, { wake: false, log: () => [] });
          const ex = stacks(h, 'extenue');
          if (ex > 0) removeCondition(h, 'extenue', ex);
        }
        set({ party: [...get().party] });
        j.push(t('tp.calmTravel'));
      }
      return { consequences: freeCons(j) };
    },
    /** Un Test d'EXPOSITION de fin d'Étape (l.73) : échec → escalade cumulative de froid (l.415), rhume
     *  CONTRACTÉ en saison froide ou PROLONGÉ (`coldExposureChill`). Protection magique = ignorée d'office.
     *  Le RANG d'échec = nombre de paliers de
     *  froid DÉJÀ PERSISTÉS (activeEffects `exposition-froid`, seule mémoire du cumul) — escalade
     *  cumulative INTER-Étapes (0 → −10 CT/Ag/Dex, 3 → le reste, 10 → Blessures). */
    etapeExposition: (_get, _set, step, hero) => {
      if (!hero || !step.result) return;
      const weatherLabel = String(step.meta?.weatherLabel ?? '');
      if (step.meta?.warded) return { consequences: freeCons([t('eff.meteoConjuree', { name: nomDe(hero), what: t('eff.protectionDuFroid') })]) };
      // Le jet est DÉJÀ affiché par la rangée de l'étape (CascadeModal) — pas de re-print (#295 Lot 5) ;
      // succès sans effet (rien à ajouter) → aucune conséquence.
      if (step.result.success) return { consequences: freeCons([]) };
      const j: string[] = [t('tp.exposureLine', { name: nomDe(hero), weather: weatherLabel })];
      const prior = (hero.activeEffects ?? []).filter((e) => e.effectId === 'exposition-froid').length;
      const rank = prior >= 10 ? 3 : prior >= 3 ? 2 : 1;
      j.push(...applyExposureFailure(hero, rank, battleRng()).log);
      j.push(...coldExposureChill(hero, !!step.meta?.coldSeason));
      return { consequences: freeCons(j) };
    },
  } satisfies PartDeTable<'appliers', typeof GENRES_D_ETAPE>,
  tablesTirables: Object.fromEntries(CATEGORIES_DE_RENCONTRE.map((c) => [tableDeRencontre(c), {
    label: t(ENCOUNTER_KEY[c]),
    get die() { return facesDuDe(encounterDie()); },
    get rows() { return encounterTable(c).map(({ id, min, max, label }) => ({ id, min, max, label })); },
    lines: (roll: number) => {
      const e = rollEncounter(c, roll);
      return [t('out.travelEncounter', { label: e.label, text: e.desc })];
    },
  } satisfies TableStepDef])) as PartDeTable<'tablesTirables', typeof TABLES_TIRABLES>,
} satisfies FragmentDeTables;
