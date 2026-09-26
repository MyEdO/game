/**
 * Combat de masse / Puissance de Bataille — orchestration (ADE II 8, l.13-321).
 *
 * Couche STATE au-dessus du moteur PUR `engine/massBattle` : conduit la boucle de bataille.
 *
 *   PRÉ-BATAILLE (l.79-110) : jusqu'à 3 Activités (Discours l.71, Planification, Infiltration,
 *     Rassembler des forces, Repérage, Sabotage) dont l'issue alimente la Puissance de départ et les
 *     modificateurs permanents (`allyMod`) AVANT le premier Round.
 *   ROUND DE BATAILLE (l.114-124) : (1) composition d'une SITUATION (un SOUS-ENSEMBLE de Scènes du
 *     moment : tirage/authorées + Scènes IMPOSÉES par l'ennemi — menaces l.219 et enchaînements) ; (2)
 *     Scènes cinématiques MULTI-PJ (l.116-118) résolues en SOUTIEN (LDB 12) ; (3) Test spectaculaire de
 *     Puissance NON opposé (l.120) ; (4) Rassemblement (l.122) entre Rounds.
 *
 * TOUS les jets des PJ passent par le CANAL UNIQUE des Activités : `PendingActivity` (marqué `battle`) +
 * la modale `RollShell` (via la fabrique `activity` de `rollFlowSpecs`). Les Activités de préparation et
 * les Scènes sont des `ActivityDef` (contextes 'bataille'/'bataille-round') d'`activities.json`, dont
 * l'issue (bandes `outcomes` + `battle`) est appliquée à l'ARMÉE par `confirmBattleActivity`. Le Test
 * spectaculaire NON opposé est un jet d'ARMÉE (sans Chance/Résilience personnelles) résolu directement.
 * Une Scène `combat`/`threat` réutilise le combat tactique existant (`startCombat`).
 */
import type { Get, Set } from './flowTypes';
import type { Combatant, CharKey, Difficulty } from '../engine/types';
import { battleRng } from './battleRng';
import { d10, d100, type RNG } from '../engine/dice';
import { testValue, skillBaseValue, bestForSkills, bestForCombined, bestAssistedOption, type SupportDetail } from '../engine/skills';
import type { RefDesignee } from '../data/schemas/grammaire/ref';
import { isStructure } from '../engine/structures';
import { inanimateCombatant } from '../engine/inanimate';
import { applyOps } from '../engine/ops';
import { bonus, effectiveChar } from '../engine/characteristics';
import { refLabel, dataLabel } from '../data';
import { CHAR_LABELS } from '../engine/types';
import { clampTarget } from '../engine/tests';
import { rollLine } from './rollSeam';
import {
  activityById, activitiesFor, activityModLines, matchBattleOutcomes, battleOutcomeAmount,
  type ActivityDef, type BattleResolution, type BattleOutcome as BattleOutcomeDelta,
  type BattleMeasure, type BattleTestModPool,
} from '../engine/activities';
import type { PendingActivity, PendingActivityFields, ActivityOppositionOn } from './interludeFlow';
import {
  gapDifficulty, resolveClash, rallyHealAmount, battleOutcome, isDestroyed,
  battleHazard, clampMight, initHoldState, resolveHoldRound, holdEnemyBonus,
  type ClashResult, type BattleOutcome, type HoldState, type BattleHold, type MassBattleSpec,
} from '../engine/massBattle';
import { t } from '../i18n';

/** Une armée engagée dans la Puissance de Bataille, modélisée comme un COMBATTANT INANIMÉ à Blessures
 *  (même patron que les structures de siège `structureCombatant`) : `combatant.wounds.current` = Puissance
 *  courante (0-100, recalculée chaque Round, l.19), `combatant.wounds.max` = Puissance de DÉPART (plafond
 *  des gains d'une Scène, l.135). Les deltas de Puissance sont de purs `GameOp` (`heal`/`wounds`) exécutés
 *  par `applyOps` — le plafond « pas au-dessus du départ » est celui, NATUREL, de `heal` à `wounds.max`. */
export interface MassBattleArmy {
  label: string;
  /** Combattant inanimé porteur de la Puissance (Blessures courantes/max). */
  combatant: Combatant;
}

/** Puissance COURANTE d'une armée (= Blessures restantes du Combattant, 0-100). */
export function armyMight(a: MassBattleArmy): number {
  return a.combatant.wounds.current;
}

/** Puissance de DÉPART d'une armée (= Blessures max du Combattant) — plafond des gains d'une Scène (l.135). */
export function armyStartMight(a: MassBattleArmy): number {
  return a.combatant.wounds.max;
}

/** Construit le Combattant inanimé d'une armée depuis sa Puissance de départ (`wounds.current = wounds.max
 *  = startMight`). `inert:true` : la perte de Blessures ne déclenche AUCUNE conséquence de créature. */
function makeArmy(name: string, startMight: number): MassBattleArmy {
  const m = clampMight(startMight);
  return {
    label: name,
    combatant: inanimateCombatant({ id: `army-${name}`, label: name, refId: 'mass-army', bodyShape: 'army', hull: { e: 0, woundsB: m }, inert: true }),
  };
}

/** Clone une armée en appliquant un delta de Puissance COURANTE par `GameOp` (langue unique des effets) :
 *  gain → `heal` (plafonné NATURELLEMENT à `wounds.max` = départ, l.135) ; perte → `wounds` (mitigation nulle
 *  — E:0 → soustraction exacte, plancher 0). Pur : ne mute pas l'entrée. */
function armyWithMightDelta(a: MassBattleArmy, delta: number): MassBattleArmy {
  if (delta === 0) return a;
  const combatant = cloneArmyCombatant(a.combatant);
  applyOps(combatant, [delta > 0 ? { op: 'heal', amount: delta } : { op: 'wounds', amount: -delta }]);
  return { ...a, combatant };
}

/** Clone une armée en ajustant sa Puissance de DÉPART (`wounds.max`) du delta — Sabotage/Rassembler des
 *  forces (l.96/106 : renfort/affaiblissement AVANT la bataille). La Puissance courante suit le même delta
 *  (patron `refreshWounds`), bornée [0, nouveau max]. Pur. */
function armyWithStartMightDelta(a: MassBattleArmy, delta: number): MassBattleArmy {
  if (delta === 0) return a;
  const combatant = cloneArmyCombatant(a.combatant);
  const newMax = clampMight(combatant.wounds.max + delta);
  combatant.wounds.max = newMax;
  if (combatant.wounds.base != null) combatant.wounds.base = newMax;
  combatant.wounds.current = Math.max(0, Math.min(newMax, combatant.wounds.current + delta));
  return { ...a, combatant };
}

/** Clone profond (suffisant) du Combattant-armée pour muter les Blessures hors de l'état Zustand. */
function cloneArmyCombatant(c: Combatant): Combatant {
  return { ...c, wounds: { ...c.wounds } };
}

/** Delta de Puissance d'une Scène résolue (affichage). */
export interface SceneDelta { side: 'ally' | 'enemy'; amount: number; label: string }

/** Scène de COMBAT en cours (Charge/Pluie de flèches/Duel/Intrus…) : touches et PJ frappeurs suivis
 *  EN DIRECT par `massBattleTrackHit` durant la mêlée (l.139/145 ; intervention en Duel l.225). */
export interface MassBattleCombatScene {
  sceneId: string;
  /** Total des touches portées à l'ennemi par les PJ (−1/touche, l.139). */
  hits: number;
  /** Ids des PJ ayant porté au moins une touche (≥ 2 ⇒ intervention en Duel, l.225). */
  hitters: string[];
}

/** État runtime d'une bataille de masse. */
export interface MassBattleState {
  ally: MassBattleArmy;
  enemy: MassBattleArmy;
  /** Rounds de bataille prévus (escarmouche = 1, siège ≥ 5, l.124). */
  plannedRounds: number;
  /** Round de bataille courant (1-based). */
  round: number;
  /** 'prep' = pré-bataille (Activités de préparation, via l'interlude) ; 'round' = Round actif ;
   *  'over' = terminée. */
  phase: 'prep' | 'round' | 'over';
  /** Description narrative de la configuration du terrain du Round (l.126). */
  terrain?: string;
  /** Modificateur PERMANENT au Test de Puissance allié (Planification +10/+20, l.81). */
  allyMod: number;
  /** Bonus au Test de Puissance allié du PREMIER Round seul (Discours inspirant réussi, l.71). */
  firstRoundBonus: number;
  // ── Activités de bataille pré-combat (l.79-110) ──
  /** Ids des Activités de préparation déjà réalisées — set ANTI-RÉPÉTITION seul (« Les Activités ratées ne
   *  peuvent être réessayées », l.67). Le BUDGET des 3 Activités est celui, UNIQUE, de l'interlude
   *  (`interlude.perHero[id].left`, LDB 23 l.5 / ADE II 8 l.65). */
  activitiesDone: string[];
  /** Planification réussie (prérequis de l'Infiltration). */
  planned?: boolean;
  /** Repérage réussi (prérequis du Sabotage) — révèle aussi la Puissance ennemie (l.100). */
  scouted?: boolean;
  /** Bonus cumulé au Test de Planification (Repérage/Infiltration, l.75/100). */
  planningBonus: number;
  // ── Round courant ──
  /** Facteur environnemental du Round (l.309) — narratif (le MJ/joueur l'applique en Scène). */
  hazard?: { label: string; text: string };
  /** Catalogue des Scènes disponibles (pioche des situations). */
  pool: string[];
  /** Situations AUTHORÉES par Round (l.128) : `situations[round-1]` sinon la dernière ; à défaut, tirage. */
  situations?: string[][];
  /** Taille du tirage par défaut d'une situation (si non authorée). */
  situationSize: number;
  /** Scènes PRÉSENTÉES ce Round (la SITUATION du moment, l.114-116) — PAS tout le catalogue. */
  situation: string[];
  /** Scènes IMPOSÉES au Round suivant (enchaînements l.169/175/208/217/225). */
  imposed: string[];
  /** Scènes MENACE actives non vaincues (Intrus l.219) : pénalisent les Tests des autres Scènes. */
  activeThreats: string[];
  /** Scènes résolues CE Round (une résolution par Scène). */
  resolvedScenes: string[];
  /** PJ ayant agi CE Round : tout PJ engagé dans une Scène résolue (l.116-118). */
  actedHeroes: string[];
  /** AFFECTATION explicite de PJ à une action CE Round — clé = id d'action (Scène OU Activité), valeur =
   *  liste ordonnée des ids de PJ postés. */
  assignment: Record<string, string[]>;
  /** PJ ayant tenté le Rassemblement CE Round (l.122). */
  ralliedHeroes: string[];
  /** Deltas de Puissance appliqués CE Round (affichage, cumulés). */
  sceneDeltas: SceneDelta[];
  /** Post-clash : en attente du Rassemblement / passage au Round suivant. */
  awaitingNext?: boolean;
  /** Résultat du dernier Test spectaculaire (affichage). */
  lastClash?: ClashResult;
  /** Issue finale (phase 'over'). */
  outcome?: BattleOutcome;
  /** Scène de combat tactique en attente de reprise (startCombat). */
  combatScene?: MassBattleCombatScene;
  /** Rencontres à démarrer pour les Scènes de COMBAT/MENACE (par id de Scène → id d'encounter). */
  sceneEncounters?: Record<string, string>;
  /** État PERSISTANT par Scène entre Rounds (générique) — ex. Point de rupture d'une « Tenez votre
   *  position » (`HoldState`, l.161). Clé = id de Scène. */
  sceneState: Record<string, HoldState>;
  /** Journal de bataille (une ligne par événement marquant). */
  log: string[];
}

// ── Catalogues data-driven des Activités/Scènes de bataille (`activities.json`) ────────────────────

/** Toutes les Activités de PRÉPARATION (contexte 'bataille'). */
const PREP_ACTIVITIES = (): ActivityDef[] => activitiesFor('bataille');
/** Toutes les Scènes de Round (contexte 'bataille-round'). */
const ROUND_SCENES = (): ActivityDef[] => activitiesFor('bataille-round');
/** Scène de Round par id (repli undefined). */
export function battleSceneById(id: string): ActivityDef | undefined {
  const d = activityById(id);
  return d?.contexts.includes('bataille-round') ? d : undefined;
}
/** Activité de préparation par id (repli undefined). */
export function battleActivityById(id: string): ActivityDef | undefined {
  const d = activityById(id);
  return d?.contexts.includes('bataille') ? d : undefined;
}

/** Une Scène est-elle un COMBAT tactique (combat/menace) ? (engage tout le groupe, `startCombat`). */
function isCombatScene(def: ActivityDef): boolean {
  return def.sceneKind === 'combat' || def.sceneKind === 'threat';
}

// ── Utilitaires purs de composition ──────────────────────────────────────────────────────────────

function uniq(ids: string[]): string[] {
  return [...new Set(ids)];
}

/** Tirage déterministe d'un sous-ensemble du catalogue (mélange de Fisher-Yates borné par le RNG). */
function drawSubset(pool: string[], size: number, rng: RNG): string[] {
  const a = [...pool];
  for (let i = a.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, Math.max(0, Math.min(size, a.length)));
}

/** Compose la SITUATION du Round courant (l.114-116) : base (situation authorée OU tirage du
 *  catalogue) + Scènes IMPOSÉES (enchaînements) + MENACES actives. */
function composeSituation(mb: MassBattleState, rng: RNG): { situation: string[]; activeThreats: string[]; imposed: string[] } {
  const idx = mb.round - 1;
  const authored = mb.situations && mb.situations.length
    ? (mb.situations[idx] ?? mb.situations[mb.situations.length - 1])
    : null;
  const base = authored ?? drawSubset(mb.pool, mb.situationSize, rng);
  const ids = uniq([...base, ...mb.imposed, ...mb.activeThreats]).filter((id) => !!battleSceneById(id));
  const threats = uniq([...mb.activeThreats, ...ids.filter((id) => battleSceneById(id)?.sceneKind === 'threat')]);
  return { situation: ids, activeThreats: threats, imposed: [] };
}

/** Pénalité active infligée aux Tests des Scènes ce Round (Intrus l.219 : −20 tant que la menace vit). */
export function massBattleThreatPenalty(mb: MassBattleState): number {
  return mb.activeThreats.reduce((sum, id) => sum + (battleSceneById(id)?.threat?.penalty ?? 0), 0);
}

/** Flags de préparation acquis (satisfaction des `requires`, octroi des `grantsFlag`). */
function prepFlags(mb: MassBattleState): ReadonlySet<string> {
  const flags = [...(mb.planned ? ['planned'] : []), ...(mb.scouted ? ['scouted'] : [])];
  return new Set(flags);
}

// ── Amorçage ─────────────────────────────────────────────────────────────────────────────────────

const DEFAULT_SITUATION_SIZE = 3;

/** Ouvre une bataille de masse et bascule sur sa vue. */
export function startMassBattle(get: Get, set: Set, spec: MassBattleSpec): void {
  if (get().battle) { get().log(t('mbf.inCombat')); return; }
  const allyMight = clampMight(spec.allyMight);
  const enemyMight = clampMight(spec.enemyMight);
  // Le Rassemblement (sceneKind 'rally', l.122) n'est PAS une Scène cinématique de la pioche : il s'ouvre
  // entre les Rounds (`openMassBattleRally`). La pioche par défaut = les Scènes cinématiques (test/combat/
  // threat/hold, l.137-225).
  const defaultPool = ROUND_SCENES().filter((d) => d.sceneKind !== 'rally').map((d) => d.id);
  const pool = (spec.scenes && spec.scenes.length ? spec.scenes : defaultPool).filter((id) => !!battleSceneById(id));
  const mb: MassBattleState = {
    ally: makeArmy(spec.allyName ?? t('mbf.allyDefault'), allyMight),
    enemy: makeArmy(spec.enemyName ?? t('mbf.enemyDefault'), enemyMight),
    plannedRounds: Math.max(1, Math.floor(spec.plannedRounds ?? 1)),
    round: 1,
    phase: 'prep',
    terrain: spec.terrain,
    allyMod: spec.allyMod ?? 0,
    firstRoundBonus: 0,
    activitiesDone: [],
    planningBonus: 0,
    pool,
    situations: spec.situations && spec.situations.length ? spec.situations : undefined,
    situationSize: Math.max(1, Math.floor(spec.situationSize ?? DEFAULT_SITUATION_SIZE)),
    situation: [],
    imposed: [],
    activeThreats: [],
    resolvedScenes: [],
    actedHeroes: [],
    assignment: {},
    ralliedHeroes: [],
    sceneDeltas: [],
    sceneEncounters: spec.sceneEncounters,
    sceneState: {},
    log: [t('mbf.opened', {
      ally: spec.allyName ? dataLabel(spec.allyName) : t('mbf.allyShortDefault'), allyMight,
      enemy: spec.enemyName ? dataLabel(spec.enemyName) : t('mbf.enemyShortDefault'), enemyMight,
    })],
  };
  set({ massBattle: mb });
  // « Interlude c'est interlude » : la PRÉPARATION (Activités 'bataille') se joue DANS le menu d'interlude,
  // pas sur un écran à part. Avec un interlude ouvert → on reste sur son écran (les prépas y figurent, budget
  // UNIQUE). Sans interlude → aucune préparation possible : la bataille démarre directement au Round 1.
  if (get().interlude) {
    set({ screen: 'interlude' });
  } else {
    massBattleBegin(get, set);
    set({ screen: 'massBattle' });
  }
}

/** Passe de la phase pré-bataille aux Rounds : compose la situation du Round 1. */
export function massBattleBegin(get: Get, set: Set): void {
  const mb = get().massBattle;
  if (!mb || mb.phase !== 'prep') return;
  const { situation, activeThreats, imposed } = composeSituation(mb, battleRng());
  const threatLine = describeThreats(activeThreats);
  set({ massBattle: { ...mb, phase: 'round', situation, activeThreats, imposed, log: threatLine ? [...mb.log, threatLine] : mb.log } });
  if (threatLine) get().log(threatLine);
}

function describeThreats(threats: string[]): string | null {
  if (!threats.length) return null;
  const names = threats.map((id) => battleSceneById(id)?.label ?? id).join(', ');
  return t('mbf.threats', { names });
}

// ── Construction de la modale de jet (canal UNIQUE : PendingActivity + flux `activity`) ────────────

/** Fabrique une `PendingActivity` de bataille (préparation ou Scène) et l'ouvre. Le flux `activity`
 *  (RollShell) résout ensuite le jet (combiné/opposé compris) ; `confirmBattleActivity` applique l'issue. */
function openBattlePending(_get: Get, set: Set, o: {
  actor: Combatant; battle: 'prep' | 'round'; def: ActivityDef;
  skillValue: number; skillId?: string; spec?: string; char?: CharKey; difficulty: Difficulty;
  label?: string; mod?: number; modLabel?: string;
  combined?: { skillId?: string; spec?: string; value: number };
  opposition?: ActivityOppositionOn;
  heroIds?: string[]; support?: SupportDetail;
}): void {
  const skillLabel = o.skillId ? refLabel('skills', { id: o.skillId, spec: o.spec }) : o.char ? CHAR_LABELS[o.char] : t('mbf.testFallback');
  // Cibles montées par le monteur canonique (`rollLine`, #1153) : le modificateur de SITUATION (Menace
  // ADE II 8 l.219 / Planification l.75) pèse SUR LA CIBLE (il n'est pas dans la valeur) et se nomme.
  const surLaCible = activityModLines(o.mod, o.modLabel);
  const target = rollLine({
    actor: o.actor,
    ...(o.skillId || o.char ? { test: { skill: o.skillId, char: o.char, spec: o.spec } } : {}),
    valeur: o.skillValue, soutien: o.support, difficulty: o.difficulty, surLaCible,
  }).target;
  const combined = o.combined
    ? { skill2: o.combined.skillId ? refLabel('skills', { id: o.combined.skillId, spec: o.combined.spec }) : CHAR_LABELS[o.char ?? 'intelligence'], skillValue2: o.combined.value,
      target2: rollLine({ actor: o.actor, test: { skill: o.combined.skillId, char: o.char, spec: o.combined.spec }, valeur: o.combined.value, difficulty: o.difficulty, surLaCible }).target }
    : {};
  const pa: PendingActivityFields = {
    heroId: o.actor.id, kind: 'catalog', activityId: o.def.id, battle: o.battle,
    label: o.label ?? o.def.label, skillLabel, skillValue: o.skillValue, difficulty: o.difficulty,
    roll: null, target, sl: 0, success: false,
    ...(o.mod ? { mod: o.mod, modLabel: o.modLabel } : {}),
    ...(o.support ? { support: o.support } : {}),
    ...(o.heroIds ? { heroIds: o.heroIds } : {}),
    ...combined,
  };
  set({ pendingActivity: o.opposition ? { ...pa, ...o.opposition } : pa });
}

/** Budget d'Activités restant d'un héros — le budget UNIQUE de l'interlude (LDB 23 l.5 / ADE II 8
 *  l.65). Une prépa de bataille EST une Activité d'interlude : sans interlude ouvert, aucun budget. */
function heroBudget(get: Get, heroId: string): number {
  return get().interlude?.perHero[heroId]?.left ?? 0;
}

/** Héros MENEURS éligibles d'une Activité de préparation : vivants ET disposant du budget d'interlude
 *  (`left > 0`). Sans interlude ouvert, personne — une bataille sans préparation démarre au Round 1. */
function budgetedParty(get: Get): Combatant[] {
  return get().party.filter((h) => !h.dead && heroBudget(get, h.id) > 0);
}

// ── Activités pré-combat (l.79-110) ──────────────────────────────────────────────────────────────

/** ÉCART (allié − ennemi) d'une mesure d'armée NOMMÉE par une entrée (`difficultyFrom.gap`). PUR. */
function battleMeasureGap(mb: MassBattleState, measure: BattleMeasure): number {
  switch (measure) {
    case 'armyMight': return armyMight(mb.ally) - armyMight(mb.enemy);
  }
}

/** Difficulté du Test d'une Activité/Scène de bataille : DÉRIVÉE de l'écart d'armées quand l'entrée le
 *  DÉCLARE (`difficultyFrom` — Discours inspirant, ADE II 8 l.71), sinon sa Difficulté fixe. PUR. */
export function battleActivityDifficulty(def: ActivityDef, mb: MassBattleState): Difficulty {
  const d = def.difficultyFrom;
  return d ? gapDifficulty(battleMeasureGap(mb, d.gap), d.roundTo ?? 1) : def.difficulty ?? 'intermediaire';
}

/** Valeur COURANTE d'un réservoir de modificateur de Test d'armée, lu par l'Activité qui le DÉCLARE
 *  (`testModFrom`) : Planification dépense le crédit de Repérage/Infiltration (l.75/100). PUR. */
export function battleTestModPool(mb: MassBattleState, pool: BattleTestModPool): number {
  switch (pool) {
    case 'allyTestMod': return mb.allyMod;
    case 'firstRoundBonus': return mb.firstRoundBonus;
    case 'planningBonus': return mb.planningBonus;
  }
}

/** Entrée d'Activité de préparation pour le menu d'interlude : la définition + son état de blocage
 *  (`done` = déjà réalisée ; `blocked` = raison d'indisponibilité — prérequis non satisfait). Toutes les
 *  Activités de préparation sont RETOURNÉES (jamais filtrées) pour être affichées désactivées avec la raison,
 *  cohérent avec le rendu générique des Activités d'interlude. */
export interface BattlePrepEntry {
  def: ActivityDef;
  done: boolean;
  /** Raison d'indisponibilité (prérequis manquant) — `null` si praticable. */
  blocked: string | null;
}

/** Libellé du prérequis manquant d'une Activité de préparation (l.73/104). */
const REQUIRES_LABEL = (): Record<string, string> => ({
  planned: t('mbf.requiresPlanned'),
  scouted: t('mbf.requiresScouted'),
});

/** Toutes les Activités de PRÉPARATION (Discours + `activitiesFor('bataille')`) avec leur état pour le menu
 *  d'interlude : déjà réalisées (anti-répétition, l.67) ou verrouillées par un prérequis (Infiltration ⇐
 *  Planification l.73 ; Sabotage ⇐ Repérage l.104). L'affichage rend l'entrée DÉSACTIVÉE avec la raison. */
export function battlePrepEntries(mb: MassBattleState): BattlePrepEntry[] {
  const flags = prepFlags(mb);
  const defs = PREP_ACTIVITIES();
  return defs.map((def) => {
    const done = mb.activitiesDone.includes(def.id);
    const missing = (def.requires ?? []).find((f) => !flags.has(f));
    return { def, done, blocked: missing ? (REQUIRES_LABEL()[missing] ?? t('mbf.requiresMissing', { flag: missing })) : null };
  });
}

/** Résout l'AFFECTATION explicite d'une action (`assignment[actionId]`) en la LISTE des PJ effectivement
 *  DISPONIBLES : membres du groupe, vivants, non encore engagés ce Round (`actedHeroes`). Tableau vide si
 *  aucun poste valable — l'appelant retombe sur la SUGGESTION. Pur : lit l'état, ne mute rien. */
export function assignedHeroesFor(mb: MassBattleState, party: Combatant[], actionId: string): Combatant[] {
  const ids = mb.assignment[actionId] ?? [];
  return ids
    .map((id) => party.find((h) => h.id === id))
    .filter((h): h is Combatant => !!h && !h.dead && !mb.actedHeroes.includes(h.id));
}

/** Enregistre l'AFFECTATION de PJ à une action du Round (Scène MULTI-PJ / Activité). */
export function setMassBattleHero(get: Get, set: Set, actionId: string, heroIds: string[]): void {
  const mb = get().massBattle;
  if (!mb) return;
  const assignment = { ...mb.assignment };
  if (heroIds.length) assignment[actionId] = heroIds; else delete assignment[actionId];
  set({ massBattle: { ...mb, assignment } });
}

/** Sélectionne l'équipe SOUTENUE (Soutien LDB 12) d'une Activité/Scène de bataille : les PJ POSTÉS (à
 *  défaut le meilleur PJ SEUL), puis la meilleure option assistée. `null` si aucune équipe/option. Source
 *  UNIQUE du motif crew→solo→team→picked (Planification l.81, Scènes multi-PJ l.116-118, tenue l.161). */
function resolveAssistedTeam(
  mb: MassBattleState, party: Combatant[], actionId: string, skills: RefDesignee[] | undefined, char: CharKey | undefined,
): { team: Combatant[]; picked: NonNullable<ReturnType<typeof bestAssistedOption>> } | null {
  const crew = assignedHeroesFor(mb, party, actionId);
  const solo = bestForSkills(party, skills, char)?.actor;
  const team = crew.length ? crew : (solo ? [solo] : []);
  if (!team.length) return null;
  const picked = bestAssistedOption(team, skills, char);
  return picked ? { team, picked } : null;
}

/** Ouvre le Test d'une Activité de bataille pré-combat (Planification/Infiltration/… l.79-106). Un Test
 *  COMBINÉ (Infiltration/Repérage, `def.combined`) confronte UN jet aux DEUX compétences de l'acteur ;
 *  une Activité SOUTENABLE (`def.assisted`, Planification l.81) est résolue en Soutien multi-PJ. */
export function openMassBattleActivity(get: Get, set: Set, activityId: string): void {
  const mb = get().massBattle;
  const def = battleActivityById(activityId);
  if (!mb || mb.phase !== 'prep' || !def) return;
  if (mb.activitiesDone.includes(activityId)) return; // anti-répétition (l.67)
  const flags = prepFlags(mb);
  if (!(def.requires ?? []).every((f) => flags.has(f))) return;
  // Budget UNIQUE (l.65) : seuls les meneurs disposant d'une Activité d'interlude peuvent préparer.
  const party = budgetedParty(get);
  if (!party.length) return;
  // Le Test dépense le RÉSERVOIR de modificateur que l'entrée déclare (Planification ⇐ Repérage/
  // Infiltration, `testModFrom: planningBonus`, l.75/100), et sa Difficulté peut être DÉRIVÉE de
  // l'écart d'armées (Discours inspirant, `difficultyFrom`, l.71).
  const mod = def.testModFrom ? battleTestModPool(mb, def.testModFrom) : 0;
  const modLabel = mod ? t('mbf.modPrep') : undefined;
  const difficulty = battleActivityDifficulty(def, mb);
  if (def.combined && def.skills && def.skills.length >= 2) {
    // Test COMBINÉ (l.75/102) : l'acteur posté décide (à défaut, SUGGESTION = celui maximisant le PLUS FAIBLE
    // des deux). Les DEUX valeurs de l'acteur retenu sont dérivées via une passe SINGLETON.
    const chosen = assignedHeroesFor(mb, party, activityId)[0] ?? bestForCombined(party, def.skills[0], def.skills[1], def.char)?.actor;
    if (!chosen) return;
    const picked = bestForCombined([chosen], def.skills[0], def.skills[1], def.char);
    if (!picked) return;
    openBattlePending(get, set, {
      actor: picked.actor, battle: 'prep', def, skillValue: picked.value1, skillId: def.skills[0].id, spec: def.skills[0].spec, char: def.char,
      difficulty, mod, modLabel,
      combined: { skillId: def.skills[1].id, spec: def.skills[1].spec, value: picked.value2 },
    });
    return;
  }
  if (def.assisted) {
    // Activité SOUTENABLE (Planification l.81) : résolue comme une Scène de Round. Équipe = les PJ POSTÉS ;
    // à défaut, la SUGGESTION = le meilleur PJ SEUL. Valeur SOUTENUE (`bestAssistedOption`, LDB 12).
    const at = resolveAssistedTeam(mb, party, activityId, def.skills, def.char);
    if (!at) return;
    const { team, picked } = at;
    openBattlePending(get, set, {
      actor: picked.actor, battle: 'prep', def, skillValue: picked.value, skillId: picked.skillId, spec: picked.spec, char: def.char,
      difficulty, mod, modLabel,
      heroIds: team.map((h) => h.id), support: picked.support,
    });
    return;
  }
  // Activité SOLO (RAW l.75/102/106 « un Personnage », sans aide) : acteur = PJ posté (à défaut, SUGGESTION).
  const chosen = assignedHeroesFor(mb, party, activityId)[0] ?? bestForSkills(party, def.skills, def.char)?.actor;
  if (!chosen) return;
  const picked = bestForSkills([chosen], def.skills, def.char);
  if (!picked) return;
  openBattlePending(get, set, {
    actor: picked.actor, battle: 'prep', def, skillValue: picked.value, skillId: picked.skillId, spec: picked.spec, char: def.char,
    difficulty, mod, modLabel,
  });
}

// ── Scènes cinématiques (l.116-225) ──────────────────────────────────────────────────────────────

/** Choisit une Scène de la SITUATION : 'test' → modale de jet ; 'hold' → Test opposé de tenue ;
 *  'combat'/'threat' → combat tactique. Scène MULTI-PJ (l.116-118) résolue en SOUTIEN (LDB 12). */
export function openMassBattleScene(get: Get, set: Set, sceneId: string): void {
  const mb = get().massBattle;
  const scene = battleSceneById(sceneId);
  if (!mb || mb.phase !== 'round' || mb.awaitingNext || !scene) return;
  if (!mb.situation.includes(sceneId) || mb.resolvedScenes.includes(sceneId)) return;
  if (isCombatScene(scene)) { startBattleCombat(get, set, scene); return; }
  if (scene.sceneKind === 'hold') { openHoldScene(get, set, scene); return; }
  // Scène 'test' MULTI-PJ (l.116-118/151/153) : compétences AU CHOIX, Soutien LDB 12.
  const party = get().party.filter((h) => !h.dead && !mb.actedHeroes.includes(h.id));
  if (!party.length) { get().log(t('mbf.allActed')); return; }
  const at = resolveAssistedTeam(mb, party, scene.id, scene.skills, scene.char);
  if (!at) return;
  const { team, picked } = at;
  const mod = massBattleThreatPenalty(mb); // Intrus l.219 : −20 aux Tests des autres Scènes.
  openBattlePending(get, set, {
    actor: picked.actor, battle: 'round', def: scene, skillValue: picked.value, skillId: picked.skillId, spec: picked.spec, char: scene.char,
    difficulty: scene.difficulty ?? 'intermediaire', mod, modLabel: mod ? t('mbf.modThreat') : undefined,
    heroIds: team.map((h) => h.id), support: picked.support,
  });
}

/** Ouvre le Test OPPOSÉ d'une Scène « Tenez votre position » (l.161-163) : les PJ engagés défendent en
 *  SOUTIEN ; l'ennemi oppose un jet FIGÉ (Puissance ennemie + bonus cumulatif de tenue). */
function openHoldScene(get: Get, set: Set, scene: ActivityDef): void {
  const mb = get().massBattle;
  if (!mb || !scene.hold) return;
  const state = mb.sceneState[scene.id] ?? initHoldState();
  if (state.broken) { get().log(t('mbf.holdAlreadyBroken', { scene: scene.label })); return; }
  const party = get().party.filter((h) => !h.dead && !mb.actedHeroes.includes(h.id));
  if (!party.length) { get().log(t('mbf.allActed')); return; }
  const at = resolveAssistedTeam(mb, party, scene.id, scene.skills, scene.char);
  if (!at) return;
  const { team, picked } = at;
  const enemyBonus = holdEnemyBonus(scene.hold, state.held); // +10 cumulatif par Round déjà tenu (l.163).
  const mod = massBattleThreatPenalty(mb);
  // `enemyValue`/`skillValue` = les CIBLES jetées (bonus de tenue ADE II 8 l.163, Soutien, États,
  // Menace) ; `enemyBase`/`skillBase` = les valeurs NUES que `resolveOpposed` compare (LDB 12 l.160).
  // Les quatre voyagent ensemble jusqu'au verdict — aucun site en aval ne re-dérive une nue.
  // Niveau de Compétence NU du PJ retenu (`LDB 09 l.17`) — Compétence si la Scène en teste une,
  // Caractéristique effective sinon ; une Scène qui ne déclare ni l'une ni l'autre n'en pose aucune.
  const skillBase = picked.skillId
    ? skillBaseValue(picked.actor, picked.skillId, picked.spec)
    : scene.char ? effectiveChar(picked.actor, scene.char) : undefined;
  const opposition: ActivityOppositionOn = {
    // Seuil de l'opposition (aucune Difficulté : Puissance + tenue) — écrêté par la primitive PARTAGÉE.
    enemyValue: clampTarget(armyMight(mb.enemy) + enemyBonus).target,
    enemyRoll: d100(battleRng()),
    enemyBase: armyMight(mb.enemy),
    ...(skillBase != null ? { skillBase } : {}),
  };
  openBattlePending(get, set, {
    actor: picked.actor, battle: 'round', def: scene, skillValue: picked.value, skillId: picked.skillId, spec: picked.spec, char: scene.char,
    difficulty: scene.difficulty ?? 'intermediaire', mod, modLabel: mod ? t('mbf.modThreat') : undefined,
    opposition, heroIds: team.map((h) => h.id), support: picked.support,
  });
}

// ── Rassemblement (l.122) ────────────────────────────────────────────────────────────────────────

/** Ouvre le Test de Résistance de guérison du Rassemblement (l.122, `ActivityDef` sceneKind 'rally') pour
 *  le prochain PJ vivant n'ayant pas récupéré ce Round. Disponible entre les Rounds (post-clash). */
export function openMassBattleRally(get: Get, set: Set): void {
  const mb = get().massBattle;
  if (!mb || mb.phase !== 'round' || !mb.awaitingNext) return;
  const def = activityById('rassemblement');
  if (!def) return;
  const hero = get().party.find((h) => !h.dead && !mb.ralliedHeroes.includes(h.id) && h.wounds.current < h.wounds.max);
  if (!hero) { get().log(t('mbf.rallyNobody')); return; }
  openBattlePending(get, set, {
    actor: hero, battle: 'round', def, skillValue: testValue(hero, 'resistance'), skillId: 'resistance',
    difficulty: 'intermediaire', label: t('mbf.rallyLabel'), heroIds: [hero.id],
  });
}

// ── Application des issues (appelée par `confirmActivity` pour une `PendingActivity` de bataille) ───

/** Applique un delta de Puissance COURANTE à un camp par `GameOp` (`heal`/`wounds`). */
function applyDelta(mb: MassBattleState, side: 'ally' | 'enemy', delta: number): MassBattleState {
  return { ...mb, [side]: armyWithMightDelta(mb[side], delta) };
}

/** Applique une issue de bataille (`BattleOutcome`) à l'état : delta de Puissance courante/départ ou
 *  modificateur de Test. Retourne l'état muté + le delta AFFICHABLE éventuel. */
function applyBattleOutcome(mb: MassBattleState, o: BattleOutcomeDelta, amount: number, label: string): { mb: MassBattleState; shown?: SceneDelta } {
  switch (o.target) {
    case 'might': {
      const side = o.side ?? 'enemy';
      return { mb: applyDelta(mb, side, amount), shown: { side, amount, label } };
    }
    case 'startMight': {
      const side = o.side ?? 'ally';
      return { mb: { ...mb, [side]: armyWithStartMightDelta(mb[side], amount) }, shown: { side, amount, label } };
    }
    case 'allyTestMod': return { mb: { ...mb, allyMod: mb.allyMod + amount } };
    case 'firstRoundBonus': return { mb: { ...mb, firstRoundBonus: mb.firstRoundBonus + amount } };
    case 'planningBonus': return { mb: { ...mb, planningBonus: mb.planningBonus + amount } };
  }
}

/** Issue effective (Succès + DR de palier) d'une Activité/Scène, Test COMBINÉ compris (l.75/102) : un Test
 *  combiné RÉUSSIT sur `full` ; son DR de palier = le PLUS FAIBLE des deux DR (facteur limitant). */
function activityTestResult(pa: PendingActivity): { success: boolean; sl: number } {
  if (pa.combinedLevel) return { success: pa.combinedLevel === 'full', sl: Math.min(pa.sl, pa.sl2 ?? pa.sl) };
  return { success: pa.success, sl: pa.sl };
}

/** Construit la `BattleResolution` d'un Test (Scène de Test/Activité de préparation). La chute du
 *  général/capitaine (`generalDown`) suit la condition DÉCLARÉE par la Scène (`def.generalDownOn`,
 *  ADE II 8 l.208/217) : 'success' (Ligne de mire) ou 'stupefying' = DR ≥ 6 (Survol). */
function testResolution(success: boolean, sl: number, def?: Pick<ActivityDef, 'generalDownOn'>): BattleResolution {
  const gd = def?.generalDownOn;
  const generalDown = success && (gd === 'stupefying' ? sl >= 6 : gd === 'success');
  return { success, sl, hits: 0, kills: 0, generalDown, intervention: false, combat: false };
}

/** Applique les bandes d'issue de bataille d'une résolution (deltas `battle` + enchaînements `chains`),
 *  met à jour situation/menaces/agissants pour une Scène. */
function applyBattleBands(
  mb: MassBattleState, def: ActivityDef, res: BattleResolution, heroes: string[], isScene: boolean,
): { mb: MassBattleState; lines: string[] } {
  let next = mb;
  const bands = matchBattleOutcomes(def, res);
  const shown: SceneDelta[] = [];
  const chains: string[] = [];
  const deltaLabels: string[] = [];
  for (const b of bands) {
    for (const o of (b.battle ?? [])) {
      const amount = battleOutcomeAmount(o, res);
      if (amount === 0) continue;
      const r = applyBattleOutcome(next, o, amount, def.label);
      next = r.mb;
      if (r.shown) shown.push(r.shown);
      deltaLabels.push(outcomeLabel(o, amount));
    }
    chains.push(...(b.chains ?? []));
  }
  const lines: string[] = [];
  const noun = isScene ? t('mbf.nounScene') : t('mbf.nounActivity');
  if (deltaLabels.length) lines.push(t('mbf.resolved', { noun, label: def.label, deltas: deltaLabels.join(' ; ') }));
  else if (res.success) lines.push(t('mbf.succeededNoEffect', { noun, label: def.label }));
  else lines.push(t('mbf.failedNoEffect', { noun, label: def.label }));
  for (const cid of uniq(chains)) {
    lines.push(t('mbf.chain', { scene: battleSceneById(cid)?.label ?? cid }));
  }
  next = {
    ...next,
    ...(isScene ? {
      resolvedScenes: uniq([...next.resolvedScenes, def.id]),
      actedHeroes: uniq([...next.actedHeroes, ...heroes]),
      imposed: uniq([...next.imposed, ...chains]),
      // Intrus (l.219) : la menace PERSISTE tant qu'elle n'est pas VAINCUE — ne la retirer que sur succès/victoire.
      activeThreats: def.sceneKind === 'threat' && res.success ? next.activeThreats.filter((id) => id !== def.id) : next.activeThreats,
      sceneDeltas: [...next.sceneDeltas, ...shown],
    } : {}),
  };
  return { mb: next, lines };
}

/** Libellé chiffré d'une issue appliquée (journal). */
function outcomeLabel(o: BattleOutcomeDelta, amount: number): string {
  const sign = amount >= 0 ? '+' : '';
  switch (o.target) {
    case 'might': return t('mbf.outMight', { side: t((o.side ?? 'enemy') === 'ally' ? 'mbf.sideAlly' : 'mbf.sideEnemy'), amount: `${sign}${amount}` });
    case 'startMight': return t('mbf.outStartMight', { side: t((o.side ?? 'ally') === 'ally' ? 'mbf.sideAlly' : 'mbf.sideEnemy'), amount: `${sign}${amount}` });
    case 'allyTestMod': return t('mbf.outAllyTestMod', { amount: `${sign}${amount}` });
    case 'firstRoundBonus': return t('mbf.outFirstRound', { amount: `${sign}${amount}` });
    case 'planningBonus': return t('mbf.outPlanning', { amount: `${sign}${amount}` });
  }
}

/** Applique un Round de « Tenez votre position » (l.161-163) : accumule le Point de rupture, persiste la
 *  tenue, et — TANT QUE la position TIENT — applique l'issue `on:'success'` de la Scène (−2 Puissance
 *  ennemie) et RÉIMPOSE la Scène au Round suivant. Rupture → déroute. */
function applyHoldResolution(
  mb: MassBattleState, scene: ActivityDef, pa: PendingActivity, heroes: string[],
): { mb: MassBattleState; lines: string[] } {
  const hold = scene.hold as BattleHold;
  const prev = mb.sceneState[scene.id] ?? initHoldState();
  const r = resolveHoldRound(prev, hold, pa.enemySL ?? 0);
  const lines: string[] = [];
  let next: MassBattleState = { ...mb, sceneState: { ...mb.sceneState, [scene.id]: r.next } };
  const shown: SceneDelta[] = [];
  if (r.held) {
    // Tenu : issue `on:'success'` de la Scène (−2 Puissance ennemie), gated par la tenue.
    for (const b of matchBattleOutcomes(scene, testResolution(true, pa.sl, scene))) {
      for (const o of (b.battle ?? [])) {
        const amount = battleOutcomeAmount(o, testResolution(true, pa.sl, scene));
        if (amount === 0) continue;
        const ap = applyBattleOutcome(next, o, amount, scene.label);
        next = ap.mb;
        if (ap.shown) shown.push(ap.shown);
      }
    }
    lines.push(t('mbf.holdHeld', { bp: r.next.breakpoint, max: hold.breakpoint, bonus: holdEnemyBonus(hold, r.next.held) }));
  }
  if (r.next.broken) {
    lines.push(t('mbf.holdBreak', { bp: r.next.breakpoint, max: hold.breakpoint }));
  } else {
    next = { ...next, imposed: uniq([...next.imposed, scene.id]) };
    if (!r.held) lines.push(t('mbf.holdLose', { bp: r.next.breakpoint, max: hold.breakpoint }));
  }
  next = {
    ...next,
    resolvedScenes: uniq([...next.resolvedScenes, scene.id]),
    actedHeroes: uniq([...next.actedHeroes, ...heroes]),
    sceneDeltas: [...next.sceneDeltas, ...shown],
  };
  return { mb: next, lines };
}

/** Applique l'issue d'une `PendingActivity` de BATAILLE à `MassBattleState` (appelé par `confirmActivity`).
 *  Route selon le contexte (préparation / Scène de Round) et le genre. Le budget d'Activité (une prépa =
 *  une Activité d'interlude, l.65) est décrémenté par `confirmActivity`, PAS ici (application ⊥ budget). */
export function confirmBattleActivity(get: Get, set: Set, pa: PendingActivity): void {
  const mb = get().massBattle;
  if (!mb || pa.roll == null || !pa.activityId) return;
  const lines: string[] = [];
  let next = mb;

  const prepDef = pa.battle === 'prep' ? battleActivityById(pa.activityId) : undefined;
  const scene = pa.battle === 'round' ? battleSceneById(pa.activityId) : undefined;

  if (prepDef) {
    const { success, sl } = activityTestResult(pa);
    const res = testResolution(success, sl, prepDef);
    const applied = applyBattleBands(next, prepDef, res, [], false);
    next = applied.mb;
    if (success && prepDef.grantsFlag) next = { ...next, [prepDef.grantsFlag]: true } as MassBattleState;
    next = { ...next, activitiesDone: uniq([...next.activitiesDone, pa.activityId]) };
    lines.push(...applied.lines);

  } else if (scene?.sceneKind === 'rally') {
    // Rassemblement (l.122) : Test de Résistance de guérison sur le héros acteur (pas l'armée).
    const hero = get().party.find((h) => h.id === pa.heroId);
    if (hero) {
      const be = bonus(effectiveChar(hero, 'endurance'));
      const heal = pa.success ? rallyHealAmount(pa.sl, be) : 0;
      if (heal > 0) {
        // HÉROS (pas la coque) : `applyOps` direct sur un clone, comme `armyWithMightDelta` ci-dessus.
        const healed = { ...hero, wounds: { ...hero.wounds } };
        applyOps(healed, [{ op: 'heal', amount: heal }]);
        set({ party: get().party.map((h) => h.id === hero.id ? healed : h) });
        lines.push(t('mbf.rallyHeal', { name: hero.label, heal, dr: pa.sl, be }));
      } else {
        lines.push(t('mbf.rallyFail', { name: hero.label }));
      }
      next = { ...next, ralliedHeroes: uniq([...next.ralliedHeroes, hero.id]) };
    }

  } else if (scene?.sceneKind === 'hold') {
    const applied = applyHoldResolution(next, scene, pa, pa.heroIds ?? [pa.heroId]);
    next = applied.mb;
    lines.push(...applied.lines);

  } else if (scene) {
    // Scène de Test (l.116-225) : delta de Puissance par l'issue.
    const applied = applyBattleBands(next, scene, testResolution(pa.success, pa.sl, scene), pa.heroIds ?? [pa.heroId], true);
    next = applied.mb;
    lines.push(...applied.lines);
  }

  set({ massBattle: { ...next, log: [...next.log, ...lines] } });
  for (const l of lines) get().log(l);
}

// ── Scène de COMBAT tactique (l.137-145/211-225) ─────────────────────────────────────────────────

/** Démarre une Scène de COMBAT/MENACE : réutilise le combat existant. */
function startBattleCombat(get: Get, set: Set, scene: ActivityDef): void {
  const mb = get().massBattle;
  if (!mb) return;
  const encId = mb.sceneEncounters?.[scene.id] ?? scene.encounter;
  const enc = encId && get().scene?.encounters.find((e) => e.id === encId);
  if (!enc) {
    get().log(t('mbf.noEncounter', { scene: scene.label, enc: encId ?? '?' }));
    return;
  }
  set({ massBattle: { ...mb, combatScene: { sceneId: scene.id, hits: 0, hitters: [] } }, screen: 'campaign' });
  get().log(t('mbf.engage', { scene: scene.label }));
  get().startCombat(encId);
}

/** Comptage EN DIRECT des touches d'une Scène de COMBAT (l.139/145) — appelé par `applyAttackResult`. */
export function massBattleTrackHit(get: Get, set: Set, attacker: Combatant, target: Combatant): void {
  const mb = get().massBattle;
  if (!mb?.combatScene) return;
  if (attacker.kind !== 'hero' || target.kind !== 'enemy' || isStructure(target)) return;
  const cs = mb.combatScene;
  const hitters = cs.hitters.includes(attacker.id) ? cs.hitters : [...cs.hitters, attacker.id];
  set({ massBattle: { ...mb, combatScene: { ...cs, hits: cs.hits + 1, hitters } } });
}

/** Reprise après une Scène de COMBAT (appelée par `dismissVictory`/`dismissDefeat`) : applique la
 *  réduction/malus de Puissance selon l'issue, puis revient à la vue de bataille. */
export function massBattleResumeCombat(get: Get, set: Set, kills: number, outcome: 'won' | 'lost' = 'won'): void {
  const mb = get().massBattle;
  if (!mb?.combatScene) return;
  const scene = battleSceneById(mb.combatScene.sceneId);
  const cs = mb.combatScene;
  let next: MassBattleState = { ...mb, combatScene: undefined };
  const lines: string[] = [];
  if (scene) {
    const res: BattleResolution = outcome === 'won'
      // Victoire : le général (la rencontre) est neutralisé ; intervention si > 1 frappeur (Duel l.225).
      ? { success: true, sl: 0, hits: cs.hits, kills, generalDown: true, intervention: cs.hitters.length > 1, combat: true }
      : { success: false, sl: 0, hits: cs.hits, kills: 0, generalDown: false, intervention: cs.hitters.length > 1, combat: true };
    const applied = applyBattleBands(next, scene, res, cs.hitters, true);
    next = applied.mb;
    lines.push(t(outcome === 'won' ? 'mbf.combatWon' : 'mbf.combatLost', { scene: scene.label, hits: cs.hits, kills }));
    lines.push(...applied.lines);
  }
  set({ massBattle: { ...next, log: [...next.log, ...lines] }, screen: 'massBattle' });
  for (const l of lines) get().log(l);
}

// ── Aléa, Test spectaculaire, Rounds, issue (l.120-124/309) ──────────────────────────────────────

/** Tire (ou choisit) le facteur environnemental du Round (l.309, 1d10). */
export function massBattleSetHazard(get: Get, set: Set, roll?: number): void {
  const mb = get().massBattle;
  if (!mb || mb.phase !== 'round') return;
  const h = battleHazard(roll ?? d10(battleRng()));
  set({ massBattle: { ...mb, hazard: { label: h.label, text: h.desc }, log: [...mb.log, t('mbf.hazardLog', { label: h.label })] } });
  get().log(t('mbf.hazard', { label: h.label }));
}

/** Résout le Test spectaculaire de Puissance du Round (l.120) puis marque l'attente du Rassemblement /
 *  passage au Round suivant (l.122-124). Ne fait PAS avancer le Round (cf. `massBattleAdvance`). */
export function massBattleClash(get: Get, set: Set): void {
  const mb = get().massBattle;
  if (!mb || mb.phase !== 'round' || mb.awaitingNext) return;
  const allyMod = mb.allyMod + (mb.round === 1 ? mb.firstRoundBonus : 0);
  const clash = resolveClash(armyMight(mb.ally), armyMight(mb.enemy), { allyMod, enemyMod: 0, rng: battleRng() });
  const ally = armyWithMightDelta(mb.ally, -clash.allyLoss);
  const enemy = armyWithMightDelta(mb.enemy, -clash.enemyLoss);
  const lines: string[] = [
    t('mbf.clash', { n: mb.round, total: mb.plannedRounds, enemyLoss: clash.enemyLoss, allyLoss: clash.allyLoss }),
    t('mbf.mightLine', { ally: ally.label, allyMight: armyMight(ally), enemy: enemy.label, enemyMight: armyMight(enemy) }),
  ];
  let next: MassBattleState = { ...mb, ally, enemy, lastClash: clash };
  const destroyed = isDestroyed(armyMight(ally)) || isDestroyed(armyMight(enemy));
  if (destroyed || mb.round >= mb.plannedRounds) {
    const outcome = battleOutcome(armyMight(ally), armyMight(enemy));
    next = { ...next, phase: 'over', outcome };
    lines.push(outcomeLine(next, outcome, destroyed));
  } else {
    next = { ...next, awaitingNext: true };
  }
  set({ massBattle: { ...next, log: [...next.log, ...lines] } });
  for (const l of lines) get().log(l);
}

/** Passe au Round suivant (l.124) : compose la nouvelle SITUATION et réinitialise l'état par-Round. */
export function massBattleAdvance(get: Get, set: Set): void {
  const mb = get().massBattle;
  if (!mb || mb.phase !== 'round' || !mb.awaitingNext) return;
  const advanced: MassBattleState = { ...mb, round: mb.round + 1 };
  const { situation, activeThreats, imposed } = composeSituation(advanced, battleRng());
  const threatLine = describeThreats(activeThreats);
  const next: MassBattleState = {
    ...advanced,
    situation, activeThreats, imposed,
    resolvedScenes: [], actedHeroes: [], assignment: {}, ralliedHeroes: [], sceneDeltas: [],
    hazard: undefined, awaitingNext: false,
  };
  set({ massBattle: { ...next, log: threatLine ? [...next.log, threatLine] : next.log } });
  if (threatLine) get().log(threatLine);
}

function outcomeLine(mb: MassBattleState, outcome: BattleOutcome, destroyed: boolean): string {
  if (outcome === 'draw') return t('mbf.outcomeDraw');
  const winner = outcome === 'ally' ? mb.ally.label : mb.enemy.label;
  const loser = outcome === 'ally' ? mb.enemy.label : mb.ally.label;
  return t(destroyed ? 'mbf.outcomeDestroyed' : 'mbf.outcomeSuperior', { winner, loser });
}

/** Ferme la bataille et revient au jeu. */
export function endMassBattle(get: Get, set: Set): void {
  if (!get().massBattle) return;
  set({ massBattle: null, screen: get().scene ? 'campaign' : 'menu' });
}

// ── Sélecteurs pour la vue ───────────────────────────────────────────────────────────────────────

/** Libellé COURT d'une issue de bataille chiffrée (aperçu de la vue). */
function shortOutcomeLabel(o: BattleOutcomeDelta): string {
  const target: Record<BattleOutcomeDelta['target'], string> = {
    might: t((o.side ?? 'enemy') === 'ally' ? 'mbf.shortAlly' : 'mbf.shortEnemy'),
    startMight: t((o.side ?? 'ally') === 'ally' ? 'mbf.shortAlly' : 'mbf.shortEnemy'),
    allyTestMod: t('mbf.shortAllyTestMod'), firstRoundBonus: t('mbf.shortFirstRound'), planningBonus: t('mbf.shortPlanning'),
  };
  const per = o.scale === 'perDR' ? t('mbf.perDR') : o.scale === 'perHit' ? t('mbf.perHit') : o.scale === 'perKill' ? t('mbf.perKill') : '';
  return t('mbf.shortOutcome', { amount: `${o.amount >= 0 ? '+' : ''}${o.amount}`, per, target: target[o.target] });
}

const BATTLE_WHEN_LABEL = (): Record<string, string> => ({
  generalDown: t('mbf.whenGeneralDown'), intervention: t('mbf.whenIntervention'), noIntervention: t('mbf.whenNoIntervention'),
  combatWon: t('mbf.whenCombatWon'), combatLost: t('mbf.whenCombatLost'),
});

/** Aperçu chiffré des effets d'une Scène de Round (base + conditionnels). */
export function battleSceneEffectLabel(def: ActivityDef): string {
  if (def.threat) return t('mbf.threatEffect', { penalty: def.threat.penalty });
  const parts: string[] = [];
  for (const b of def.outcomes ?? []) {
    for (const o of (b.battle ?? [])) {
      const cond = b.when ? t('mbf.condWhen', { what: BATTLE_WHEN_LABEL()[b.when] ?? b.when }) : b.minSL === 6 ? t('mbf.condAstounding') : '';
      parts.push(`${shortOutcomeLabel(o)}${cond}`);
    }
  }
  return parts.join(' ; ') || t('mbf.noDirectEffect');
}
