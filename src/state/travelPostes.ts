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
 *  - les APPLIERS (`stagePoste`, `stageAggregate`, `stageExposure`) appliquent la conséquence RAW à la
 *    VALIDATION de chaque étape — un poste réussi/raté (ops/Exténué/issue de portée Étape), puis
 *    l'agrégation (fourrage cumulé, camp, cartes, Rencontre) qui INSÈRE les jets d'Exposition (comme
 *    la nuit : l'abri insère les jets d'Exposition). RAW : « chaque Personnage bénéficie d'une Activité
 *    par Étape » (l.131) ; un échec octroie un Exténué (l.133).
 */
import { battleRng } from './battleRng';
import { d100 } from '../engine/dice';
import {
  travelActivitySpec, applyTravelActivityResult, aggregateActivityOutcomes, activityById,
  type ActivityDef, type TravelActivityResult,
} from '../engine/activities';
import type { RefDesignee } from '../data/schemas/grammaire/ref';
import { refLabel, weatherStakeRef, voyageStakeRef } from '../data';
import { stageEncounterCategory } from '../engine/travelEncounter';
import { rollEncounter, type EncounterCategory } from '../engine/travelTables';
import { applyOps, type GameOp } from '../engine/ops';
import { applyHealWounds } from '../engine/healing';
import { removeCondition, stacks } from '../engine/conditions';
import { extendedTestStep } from '../engine/tests';
import { registerCascadeApplier } from './cascade';
import { freeCons, resultLines, rollStep, monoStep, displayStep, bandStep, pousseSi, type Consequence, type BuiltCascadeStep } from './rollSeam';
import { toRecapLines } from './recapLine';
import { t, type MsgKey } from '../i18n';
import { rule } from '../engine/policy';
import {
  stageCount, forageYield, stageExposureDifficulty, weatherResistanceTest,
  isColdSeason, weatherCondition, type Weather, type Season,
} from '../engine/travelStages';
import { weatherTestMods } from '../engine/weatherTestMod'; // CANAL UNIQUE « Tests physiques » (#341) — jamais weatherPhysicalTestMod en direct
import { hasCoat, partyHasTent, applyExposureFailure, isWeatherWarded, exposureFirstFailChars } from '../engine/exposure';
import { rationCount } from '../engine/provisions';
import { contractDiseaseOnce } from '../engine/disease';
import { itemFromGive, autoStowNewItem } from '../engine/items';
import { effectiveSkillCharKey } from '../engine/skills';
import type { Difficulty, Combatant } from '../engine/types';
import type { ModLine } from '../engine/combat';
import { weatherRef } from '../engine/travelStages';
import { partyWalkSpeed, vehicleTravel, type TravelMode } from '../engine/travel';
import { partyMounts } from '../engine/mountTravel';
import type { Possession } from '../engine/possession';
import type { CascadeStepMeta, BatchParticipant } from './pendings';
import type { Get, Set } from './flowTypes';
import { dataLabel } from '../data';
import { stepDetail } from './rollSeam';

const POSTE_ICON: Record<string, string> = {
  'plein-air': 'expedition/outdoors', approvisionnement: 'item/consumable', 'recueillir-informations': 'expedition/rumor', 'rester-aux-aguets': 'ui/eye',
  'etablir-cartes': 'expedition/cartography', 'pratiquer-competence': 'expedition/practice', recuperer: 'rest/bed', 'monter-camp': 'rest/camp',
};

/** Clés de libellé d'une catégorie de Rencontre (EDOC 8) — des CLÉS, jamais des phrases figées à
 *  l'évaluation du module (dette nommée de `src/i18n/index.ts`). */
const ENCOUNTER_KEY: Record<EncounterCategory, MsgKey> = {
  positives: 'tp.encounterPositive',
  fortuites: 'tp.encounterChance',
  dangereuses: 'tp.encounterDanger',
};

/** CONTEXTE TRANSITOIRE de l'Étape en cours (posé par `buildStageSteps`, lu par les appliers, effacé à
 *  la clôture du jour). Résultats de poste ACCUMULÉS (agrégés par le pas `stageAggregate`) + drapeaux. */
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
 * `stageAggregate` (fourrage cumulé, camp, cartes, Rencontre → INSÈRE les jets d'Exposition). Pose le
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
  // flux `cascadeBatch`). Postes SANS Test → pas d'affichage à conséquence immédiate.
  const batchParts: BatchParticipant[] = [];
  for (const hero of party) {
    const posting = plan.postes[hero.id];
    if (!posting) continue;
    const def = activityById(posting.activityId);
    if (!def) continue;
    const spec = travelActivitySpec(hero, def, { skillMod: weatherModOf(def, weather), stages, freeSkill: posting.freeSkill });
    // Test étendu DÉJÀ ACHEVÉ (LDB 12 l.170-186 : un Test étendu SE TERMINE à la cible — il ne se relance
    // PAS chaque jour, sinon le cumul déborde son plafond « 5/2 », « 6/2 » à chaque re-complétion) : le
    // poste n'a plus d'objet → un pas d'AFFICHAGE « achevée », aucun jet ni accumulation (F1).
    if (spec.drTarget != null && (plan.extendedProgress ?? 0) >= spec.drTarget) {
      steps.push(displayStep({ id: `poste-${hero.id}`, kind: 'stagePosteDone', actorId: hero.id, icon: POSTE_ICON[def.id] ?? 'travel/compass',
        label: dataLabel(def.label), outcome: toRecapLines([t('tp.activityDone', { label: def.label, dr: spec.drTarget })]) }));
      continue;
    }
    if (spec.target == null) {
      // Activité SANS Test (Récupérer) : pas de rangée de jet — un pas d'affichage dont l'applier applique l'issue.
      const meta: CascadeStepMeta = { activityId: def.id };
      if (posting.freeSkill?.id) { meta.freeSkillId = posting.freeSkill.id; if (posting.freeSkill.spec) meta.freeSkillSpec = posting.freeSkill.spec; }
      steps.push(displayStep({ id: `poste-${hero.id}`, kind: 'stagePoste', actorId: hero.id, icon: POSTE_ICON[def.id] ?? 'travel/compass', label: dataLabel(def.label), meta }));
    } else {
      // label = Compétence RÉELLEMENT utilisée, résolue AVEC sa spec (« Métier (Cartographe) ») via
      // `refLabel` ; base/cible déjà influençables. Test ÉTENDU (Établir des cartes, EDOC 8 l.161) : la
      // rangée porte sa progression cumulée (drDone AVANT ce jet, drTarget = 2 × Étapes) → barre de DR
      // sur SA rangée, persistante (arbitrage user). L'accumulation réelle vit dans `stageAggregate`.
      // Mods de rangée : Difficulté + Météo (déjà dans `spec.target`) + « Tests physiques » de la pluie
      // diluvienne (l.82), CE dernier ajouté ici car keyé sur la carac de la compétence utilisée par CE
      // héros (`effectiveSkillCharKey`) — le −10 s'ajoute au mod météo (recalcul de la cible, dont les
      // bornes viennent de `getTestPolicy` via `clampTarget`, jamais d'un plafond écrit ici).
      const wMod = weatherModOf(def, weather);
      const char = spec.used ? effectiveSkillCharKey(hero, spec.used.id, { spec: spec.used.spec }) : undefined;
      const pMod = weatherTestMods(weather, char ?? null).reduce((s, l) => s + l.value, 0); // CANAL UNIQUE (#341)
      const mods = stageActivityMods(weather, wMod, pMod);
      const difficulty = def.difficulty ?? 'intermediaire';
      batchParts.push({
        id: hero.id,
        label: spec.used ? refLabel('skills', { id: spec.used.id, spec: spec.used.spec }) : def.label,
        interactive: true,
        difficulty,
        // Les mods de MÉTÉO (`wMod`/`pMod`) s'ajoutent à la CIBLE, ils ne sont pas dans la valeur.
        ...rollStep(spec.used
          ? { actor: hero, test: { skill: spec.used.id, spec: spec.used.spec }, valeur: spec.value, difficulty, surLaCible: mods }
          : { valeur: spec.value, valeurEtrangere: true, difficulty, surLaCible: mods }),
        result: null,
        ...(spec.drTarget != null ? { extendedDrDone: Math.min(plan.extendedProgress ?? 0, spec.drTarget), extendedDrTarget: spec.drTarget } : {}),
      });
    }
  }
  // Une bande par le mint (`bandStep`) : jets INDÉPENDANTS (#351, cf. l'applier) et POSSESSION posée —
  // plusieurs héros postés → fenêtre de GROUPE, un seul → SON `actorId`. Sans elle, l'arbitre rendait la
  // fenêtre à l'HÔTE SEUL et le siège qui tient le posté ne voyait jamais sa rangée (classe #1268).
  pousseSi(steps, bandStep({ id: 'stage-postes', kind: 'stagePosteBatch', icon: 'travel/compass', label: t('step.stagePostes')}, batchParts));
  // Pas d'agrégation de fin d'Étape (fourrage cumulé, camp, cartes, Rencontre) + insertion des Expositions.
  // Bilan de l'ÉTAPE : aucun personnage n'en est le concerné (c'est la journée du groupe qui se solde) —
  // étape de MONDE, routée au siège MJ (`worldOwner`), jamais une fenêtre sans propriétaire déclaré.
  steps.push(displayStep({ id: 'stage-agg', kind: 'stageAggregate', icon: 'ui/tally', label: t('step.stageAgg'), worldOwner: true,
    meta: { weatherLabel: dataLabel(weatherCondition(weather).label), stages } }));
  return steps;
}

// ── APPLIERS des étapes de l'Étape (purpose `travelDay`) : conséquence RAW par `kind`, moteur PUR ──

/** UN poste RÉSOLU : issue du jet (ops/Exténué/portée Étape) via le jumeau PUR `applyTravelActivityResult`,
 *  enregistrée dans le contexte d'Étape (l'agrégation `stageAggregate` la relira), et RENDUE en
 *  `Consequence[]` STRUCTURÉES (#295) — jamais une chaîne composée à la main :
 *   - Activité SANS Test → `out.activityDone` (nom en var : la rangée batch peut n'avoir pas d'actorId) ;
 *   - Exténué (EDOC 8 l.133) → op `condition` APPLIQUÉ par `applyOps`, ligne DÉRIVÉE via `opConsequenceLine` ;
 *   - issues individuelles (Récupérer/Pratiquer/Recueillir infos) → notes narratives.
 *  Partagé par le pas d'affichage (`stagePoste`, sans Test) et le pas BATCH (`stagePosteBatch`, avec Test). */
function applyPoste(get: Get, set: Set, hero: Combatant, def: ActivityDef, freeSkill: RefDesignee | undefined, roll: { roll: number; target: number; sl: number; success: boolean } | null): Consequence[] {
  const spec = travelActivitySpec(hero, def, { freeSkill });
  const r = applyTravelActivityResult({ ...spec, actorId: hero.id }, def, roll);
  const plan = get().travelPlan;
  if (plan?.stage) set({ travelPlan: { ...plan, stage: { ...plan.stage, results: [...plan.stage.results, r] } } });
  const cons: Consequence[] = [];
  if (r.roll == null) cons.push({ say: 'out.activityDone', vars: { name: hero.label, activity: def.label } });
  if (r.ops.length) cons.push(...freeCons(applyOps(hero, r.ops, { source: { kind: 'activity', id: def.id } })));
  if (r.extenue) {
    const op: GameOp = { op: 'condition', id: 'extenue', value: 1 }; // EDOC 8 l.133
    applyOps(hero, [op], { source: { kind: 'activity', id: def.id } });
    cons.push({ ops: [op] });
  }
  // Issues INDIVIDUELLES (Récupérer / Pratiquer / Recueillir infos) : récit (systèmes dédiés câblés ailleurs).
  if (r.success && r.stageOutcome === 'countsAsRest') cons.push(...freeCons([t('tp.countsAsRest', { name: hero.label })]));
  else if (r.success && r.stageOutcome === 'rerollToken') cons.push(...freeCons([t('tp.practice', { name: hero.label })]));
  else if (r.success && r.stageOutcome === 'gatherInfo') cons.push(...freeCons([t('tp.gatherInfo', { name: hero.label })]));
  return cons;
}

/** Poste SANS Test (Récupérer) : pas d'affichage — l'issue s'applique d'office (le journal annonce
 *  seule l'exécution ; aucune rangée de jet). */
registerCascadeApplier('stagePoste', (get, set, step, hero) => {
  const def = activityById(String(step.meta?.activityId ?? ''));
  if (!def || !hero) return;
  const cons = applyPoste(get, set, hero, def, freeSkillFromMeta(step.meta), step.result ?? null);
  set({ party: [...get().party] });
  return { consequences: cons };
});

/** Postes AVEC Test = UN pas BATCH (arbitrage user 2026-07-11 : jets INDÉPENDANTS, un par héros posté).
 *  Chaque rangée porte son propre jet influençable (déjà résolu ici) ; sa CONSÉQUENCE est rendue SUR SA
 *  rangée (`part.outcome`, le portrait porte l'attribution — pas de note agrégée à l'étape). `aggregate:
 *  'none'` (ces Tests ne sont pas reliés) : aucun `step.result` agrégé posé/lu (#351). */
registerCascadeApplier('stagePosteBatch', (get, set, step) => {
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
    for (const l of lines) get().log(l.text); // + journal/recap (une ligne par héros, pas d'agrégat)
  }
  set({ party: [...get().party] });
  return { consequences: [] };
});

/** Test de RÉSISTANCE de traversée (Neige l.86 / Blizzard l.127) au DÉMARRAGE du jour de voyage : UNE
 *  BANDE (une rangée par héros voyageant, jets INDÉPENDANTS influençables) — DISTINCTE de l'Exposition
 *  de fin d'Étape. L'ENJEU verbatim (donnée `resistanceTest.enjeu`) est porté sur la bande ; l'échec
 *  octroie un Exténué (applier `weatherResistance`). La POSSESSION est posée par le mint (`bandStep`) :
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
      ...rollStep({ actor: hero, test: { skill: 'resistance', char: 'endurance' }, difficulty: rt.difficulty }),
      result: null,
    });
  }
  const stake = rt.enjeu ? weatherStakeRef(weather) : undefined; // ENJEU = la RÉFÉRENCE de la condition (#1117), résolue au rendu
  const out: BuiltCascadeStep[] = [];
  pousseSi(out, bandStep({ id: 'weather-resistance', kind: 'weatherResistance', icon: 'rest/cold',
    label: stepDetail(t('step.traversee'), dataLabel(weatherCondition(weather).label)), ...(stake ? { stake } : {}) }, parts));
  return out;
}

/** Test de RÉSISTANCE de traversée (l.86/127) : échec → Exténué (op `condition`, patron #338/#340), ligne
 *  DÉRIVÉE (`resultLines`/`opConsequenceLine` case condition) SUR SA rangée (le portrait attribue). Succès →
 *  aucune note (la rangée ✓ ±DR porte le verdict). */
registerCascadeApplier('weatherResistance', (get, set, step) => {
  if (!step.participants) return;
  for (const part of step.participants) {
    const hero = get().party.find((h) => h.id === part.id);
    const res = part.result;
    if (!hero || !res || res.success) { part.outcome = []; continue; }
    const op: GameOp = { op: 'condition', id: 'extenue', value: 1 }; // EDOC 8 l.86/127
    applyOps(hero, [op]);
    const lines = resultLines([{ ops: [op] }]);
    part.outcome = lines;
    for (const l of lines) get().log(l.text);
  }
  set({ party: [...get().party] });
  return { consequences: [] };
});

/** AGRÉGATION de fin d'Étape (fourrage cumulé, camp, cartes, Rencontre) + INSERTION des jets d'Exposition
 *  (option « Attraper froid », l.73), sautés si un « Plein air » a réussi (`suppressExposure`, l.141). */
registerCascadeApplier('stageAggregate', (get, set, step) => {
  const plan = get().travelPlan;
  const stage = plan?.stage;
  if (!plan || !stage) return;
  const party = get().party;
  const results = stage.results;
  const j: string[] = [];

  // Approvisionnement (résolveur « forage », CUMUL des fourrageurs) — mêmes rendements qu'inline.
  const foraged = results.filter((r) => r.resolver === 'forage' && r.success).reduce((n, r) => n + forageYield(r.sl, 'recherche'), 0);
  if (foraged > 0) {
    let remaining = foraged;
    for (const h of party.filter((x) => !x.dead && !x.outOfRencontre)) {
      if (remaining <= 0) break;
      if (rationCount(h) >= 1) continue;
      const ration = itemFromGive({ trappingId: 'ration' });
      h.items = [...(h.items ?? []), ration];
      autoStowNewItem(h, ration); // #204 : rangement par défaut
      remaining -= 1;
      j.push(t('tp.rationFound', { name: h.label }));
    }
  }

  const agg = aggregateActivityOutcomes(results);

  // Monter le camp (CUMUL) : chaque DR retire un Exténué d'un Personnage (l.180).
  let campDR = agg.stacks.campCare ?? 0;
  for (const h of party) {
    if (campDR <= 0) break;
    const n = stacks(h, 'extenue');
    if (n <= 0) continue;
    const take = Math.min(campDR, n);
    removeCondition(h, 'extenue', take);
    campDR -= take;
    j.push(t('tp.campCare', { name: h.label, n: take }));
  }

  // Établir des cartes (Test ÉTENDU inter-Étapes) : cumul via le helper UNIQUE + persistance sur le plan.
  const mapDR = agg.stacks.mapMade ?? 0;
  if (mapDR > 0) {
    const drTarget = results.find((r) => r.activityId === 'etablir-cartes')?.drTarget ?? 2 * Number(step.meta?.stages ?? 1);
    const { total, done } = extendedTestStep(plan.extendedProgress ?? 0, { success: true, sl: mapDR }, drTarget, !!rule('test-extended-min-sl'));
    // ACHEVÉ : on FIGE la progression À LA CIBLE (jamais un reset à `undefined` qui RECOMMENCERAIT le Test
    // étendu le lendemain — LDB 12 : il se termine à la cible) → `buildStageSteps` voit `>= drTarget` et
    // n'ouvre plus de jet (F1). En cours : le cumul réel `total` (borné à la cible pour l'affichage).
    set({ travelPlan: { ...get().travelPlan!, extendedProgress: done ? drTarget : total } });
    j.push(done ? t('tp.mapDone', { dr: drTarget }) : t('tp.mapProgress', { total, target: drTarget }));
  }

  // Individuel (Récupérer / Pratiquer / Recueillir infos) : le récit a déjà été poussé PAR POSTE (stagePoste).

  // RENCONTRE de l'Étape (l.182-233) : catégorie issue de la qualité des Tests, tirage d100, texte verbatim.
  const category = stageEncounterCategory(results);
  if (category) {
    const enc = rollEncounter(category, d100(battleRng()));
    j.push(t('out.travelEncounter', { category: t(ENCOUNTER_KEY[category]), label: enc.label, text: enc.desc }));
    if (enc.stageOutcome === 'fullRecovery') {
      for (const h of party.filter((x) => !x.dead)) {
        // SOURCE UNIQUE `applyHealWounds` — plafond munition logée (LDB 62 l.250) même chemin que Guérison/repos.
        if (h.wounds.current < h.wounds.max) applyHealWounds(h, h.wounds.max - h.wounds.current, { skillCheck: false, wake: false, log: () => [] });
        const ex = stacks(h, 'extenue');
        if (ex > 0) removeCondition(h, 'extenue', ex);
      }
      j.push(t('tp.calmTravel'));
    }
  }
  set({ party: [...get().party] });

  // EXPOSITION de fin d'Étape (l.73) : INSÈRE un jet influençable par héros exposé (sauf « Plein air » l.141).
  const suppress = agg.gates.includes('suppressExposure');
  const insert = suppress ? [] : buildExposureSteps(get(), stage);
  return { consequences: freeCons(j), insert };
});

/** Jets d'EXPOSITION de fin d'Étape (l.73) à insérer : un par héros vivant devant un Test de Résistance
 *  (météo × équipement via `stageExposureDifficulty`). Protection magique = pas de jet (issue directe). */
function buildExposureSteps(state: { party: Combatant[] }, stage: StageContext): BuiltCascadeStep[] {
  if (!rule('travel-attraper-froid')) return [];
  const party = state.party;
  const tent = partyHasTent(party);
  const out: BuiltCascadeStep[] = [];
  for (const id of stage.livingIds) {
    const h = party.find((x) => x.id === id);
    if (!h || h.dead) continue;
    const diff = stageExposureDifficulty(stage.weather, hasCoat(h), tent);
    if (!diff) continue; // bien équipé sous pluie/neige normale, ou beau temps → aucun Test
    const st = monoStep({
      id: `expo-${id}`, kind: 'stageExposure', actor: h, icon: 'rest/cold', label: t('step.exposition'),
      rollLabel: refLabel('skills', { id: 'resistance' }), difficulty: diff as Difficulty,
      // MÊME Test d'Exposition que la nuit de repos : EDOC 08 l.90 renvoie à LDB p181, donc MÊME entrée.
      stake: voyageStakeRef('exposure', { chars: exposureFirstFailChars('froid') }),
      ligne: { test: { skill: 'resistance', char: 'endurance' } },
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

/** Un Test d'EXPOSITION de fin d'Étape (l.73) : échec → escalade cumulative de froid (l.415), rhume
 *  CONTRACTÉ en saison froide ou PROLONGÉ (`coldExposureChill`). Protection magique = ignorée d'office.
 *  Le RANG d'échec = nombre de paliers de
 *  froid DÉJÀ PERSISTÉS (activeEffects `exposition-froid`, seule mémoire du cumul) — escalade
 *  cumulative INTER-Étapes (0 → −10 CT/Ag/Dex, 3 → le reste, 10 → Blessures). */
registerCascadeApplier('stageExposure', (_get, _set, step, hero) => {
  if (!hero || !step.result) return;
  const weatherLabel = String(step.meta?.weatherLabel ?? '');
  if (step.meta?.warded) return { consequences: freeCons([t('eff.weatherWarded', { name: hero.label, what: t('eff.wardFroid') })]) };
  // Le jet est DÉJÀ affiché par la rangée de l'étape (CascadeModal) — pas de re-print (#295 Lot 5) ;
  // succès sans effet (rien à ajouter) → aucune conséquence.
  if (step.result.success) return { consequences: freeCons([]) };
  const j: string[] = [t('tp.exposureLine', { name: hero.label, weather: weatherLabel })];
  const prior = (hero.activeEffects ?? []).filter((e) => e.effectId === 'exposition-froid').length;
  const rank = prior >= 10 ? 3 : prior >= 3 ? 2 : 1;
  j.push(...applyExposureFailure(hero, rank, battleRng()).log);
  j.push(...coldExposureChill(hero, !!step.meta?.coldSeason));
  return { consequences: freeCons(j) };
});
