/**
 * Combat de masse / Puissance de Bataille — ADE II 8 « Le théâtre de la guerre » (l.13-321).
 *
 * Règles FACULTATIVES de bataille à grande échelle qui restent centrées sur les Personnages : deux
 * camps opposés portent un Attribut de PUISSANCE (0-100 — « la taille de leur armée entière, et la
 * maîtrise relative de leurs soldats », l.17-19), réduit à chaque Round de bataille par un « Test
 * spectaculaire de Puissance » NON opposé. Les Personnages influent sur l'issue via des Scènes
 * cinématiques (quelques Rounds de Combat OU un Test de Compétence) et un Discours inspirant.
 *
 * Moteur PUR (aucun import `state`, règle 3) + data-driven : les TABLES verbatim (estimation de
 * Puissance, modificateurs, machines de guerre, structures, aléas environnementaux) vivent dans
 * `mass-battle.json` ; les ACTIVITÉS de préparation et les SCÈNES cinématiques sont des `ActivityDef`
 * (contextes 'bataille'/'bataille-round') dans `activities.json` — mécanique unifiée avec les Activités
 * d'interlude/voyage (bandes d'issue `outcomes` + `battle`). Aucune valeur inventée (règle 1).
 */
import {
  massBattlePowerEstimate, massBattleMightModifiers, massBattleWarMachines, massBattleStructures, massBattleHazards,
} from '../data';
import { rollTest, difficultyFromModifier, type TestResult } from './tests';
import type { Money } from './money';
import { type Difficulty } from './types';
import { RNG, defaultRNG } from './dice';
import { findTableEntry } from './tables';

// ── Tables verbatim (`mass-battle.json`) ─────────────────────────────────────────────────────────

/** Une ligne de la table d'estimation par force relative (l.26-33) : Puissance alliée/ennemie de départ. */
export interface PowerEstimateRow { id: string; label: string; ally: number; enemy: number; example: string }
/** Un modificateur de Puissance par ASPECT d'armée (l.36-47) : ±10/±20/±30 selon équipement/Vétérans/Taille. */
export interface MightModifierRow { id: string; label: string; mod: number; example: string }
/** Une machine de guerre (l.235-247) — statistiques verbatim ; `siege` = porte l'Atout Siège. */
export interface WarMachineRow { id: string; label: string; price: Money; crew: number; availability: string; range: string; damage: string; traits: string; siege: boolean }
/** Une structure ciblable par les armes de siège (l.282-288) : BE + Blessures + Atout. */
export interface StructureRow { id: string; label: string; be: number; wounds: number; traits: string }
/** Un facteur environnemental d'aléa de bataille (l.311-322, 1d10) — texte verbatim. */
export interface HazardRow { id: string; min: number; max: number; label: string; desc: string }

// Les 5 tableaux sont maintenant portés par la facade `data/index.ts` (seam `overrides.ts` — édition
// Codex) ; ce module en reste le PROPRIÉTAIRE des types (import type ré-emprunté par la facade, comme
// `maladies`/`DiseaseDef`) et de la logique PURE ci-dessous. Mêmes références vivantes (pas de copie) :
// une édition Codex persistée ici se reflète immédiatement dans ces constantes.
export const POWER_ESTIMATE: PowerEstimateRow[] = massBattlePowerEstimate;
export const MIGHT_MODIFIERS: MightModifierRow[] = massBattleMightModifiers;
export const WAR_MACHINES: WarMachineRow[] = massBattleWarMachines;
export const STRUCTURES: StructureRow[] = massBattleStructures;
export const BATTLE_HAZARDS: HazardRow[] = massBattleHazards;

export const MIGHT_MIN = 0;
export const MIGHT_MAX = 100;

/** Puissance ARRONDIE et bornée à [0, 100] (l.24 : « une valeur comprise entre 0 et 100 »). */
export function clampMight(m: number): number {
  return Math.max(MIGHT_MIN, Math.min(MIGHT_MAX, Math.round(m)));
}

// ── Estimation de la Puissance de départ ─────────────────────────────────────────────────────────

/** Puissance de départ par la table de FORCE RELATIVE (l.24-33) : « Estimez la force du camp des
 *  Personnages par rapport à celle de leurs adversaires » → couple {allié, ennemi}. */
export function mightFromRelation(id: string): { ally: number; enemy: number } {
  const row = POWER_ESTIMATE.find((r) => r.id === id) ?? POWER_ESTIMATE[2]; // repli « De force égale »
  return { ally: row.ally, enemy: row.enemy };
}

/** Machine de guerre pour le calcul de Puissance (l.302-304). */
export interface MightMachine {
  /** Porte l'Atout Siège (l.290-292). */
  siege?: boolean;
  /** Équipage complet ? Sinon sa contribution est divisée par deux (« Si elles n'ont pas d'Équipes
   *  complètes, divisez leur Puissance par deux », l.304). */
  fullCrew?: boolean;
}

/** Apport de Puissance des machines de guerre (l.302-304) : « chaque machine de guerre apporte +5 de
 *  Puissance. Si la bataille est un siège, toutes les machines de guerre avec l'Atout Siège du côté
 *  offensif augmentent la Puissance de l'armée de +10 à la place. Si elles n'ont pas d'Équipes
 *  complètes, divisez leur Puissance par deux. » */
export function warMachineMight(machines: MightMachine[], opts: { siege?: boolean; offensive?: boolean } = {}): number {
  return machines.reduce((sum, m) => {
    const base = opts.siege && opts.offensive && m.siege ? 10 : 5;
    return sum + (m.fullCrew === false ? base / 2 : base);
  }, 0);
}

/** Puissance BRUTE d'une armée par la méthode des ASPECTS (l.34-47) : « Faites commencer chaque armée
 *  avec une Puissance de 30, et accordez-lui un modificateur pour chaque aspect qui s'y applique »,
 *  plus l'apport des machines de guerre (l.302). NON normalisée (cf. `normalizeMights`). */
export function estimateMightFromAspects(
  modifierIds: string[],
  machines: MightMachine[] = [],
  opts: { siege?: boolean; offensive?: boolean } = {},
): number {
  const mods = modifierIds.reduce((sum, id) => sum + (MIGHT_MODIFIERS.find((m) => m.id === id)?.mod ?? 0), 0);
  return 30 + mods + warMachineMight(machines, opts);
}

/** Normalise deux Puissances BRUTES (l.34) : « Ensuite, retirez 10 aux deux armées jusqu'à ce que la
 *  Puissance soit comprise entre 0 et 100. » `decided` = « Si la différence de Puissance entre les deux
 *  Armées est supérieure à 100, l'issue du combat est déjà décidée. » (mesurée sur l'écart BRUT). */
export function normalizeMights(rawAlly: number, rawEnemy: number): { ally: number; enemy: number; decided: boolean } {
  const decided = Math.abs(rawAlly - rawEnemy) > 100;
  let a = rawAlly;
  let b = rawEnemy;
  while (a > MIGHT_MAX || b > MIGHT_MAX) { a -= 10; b -= 10; }
  return { ally: clampMight(a), enemy: clampMight(b), decided };
}

// ── Test spectaculaire de Puissance (l.120) ──────────────────────────────────────────────────────
//
// Lecture de la coquille OCR l.120 (« … et sur le score de Puissance actuelle la Puissance de leur
// adversaire de 10 + DR (5 minimum) ») : la phrase mutilée décrit un Test NON opposé où chaque armée
// jette sa Puissance courante (d100 ≤ Puissance) et RÉDUIT la Puissance adverse de « 10 + DR (5
// minimum) ». Les deux attaques sont résolues EN MÊME TEMPS (« Chaque attaque est résolue en même
// temps sur le score de Puissance actuelle des armées »). Reconstitution confirmée par la boucle du
// chapitre (l.19) et par l'issue (l.124 : « l'armée avec la Puissance la plus élevée gagne »).

/** Réduction de Puissance infligée à l'adversaire (l.120) : « 10 + DR (5 minimum) ». Un DR négatif
 *  (Test raté) réduit la casse jusqu'au plancher de 5. */
export function mightReduction(sl: number): number {
  return Math.max(5, 10 + sl);
}

/** Un Test spectaculaire de Puissance NON opposé (l.120) : d100 ≤ Puissance courante, modifié par les
 *  bonus/malus de bataille (Planification/Discours/aléas). `modifier` = somme des modificateurs. */
export function rollMightTest(might: number, modifier = 0, rng: RNG = defaultRNG): TestResult {
  return rollTest(might, 'intermediaire', rng, modifier);
}

/** Issue de l'affrontement d'un Round : les deux Tests + les pertes de Puissance infligées de part et
 *  d'autre. Les pertes sont ensuite APPLIQUÉES aux Combattants-armées par l'op `wounds` (côté flux), pas
 *  ici : ce résolveur reste PUR et ne connaît pas les Blessures. */
export interface ClashResult {
  allyTest: TestResult;
  enemyTest: TestResult;
  /** Puissance perdue par l'ennemi (= `mightReduction` du DR allié). */
  enemyLoss: number;
  /** Puissance perdue par l'allié (= `mightReduction` du DR ennemi). */
  allyLoss: number;
}

/** Résout l'affrontement d'un Round de bataille (l.120) : chaque armée teste sa Puissance courante et
 *  réduit celle de l'adverse de 10 + DR (min 5), simultanément (les deux DR sont figés AVANT réduction).
 *  Ne retourne QUE les pertes ; le flux les applique en Blessures sur chaque Combattant-armée. */
export function resolveClash(
  allyMight: number,
  enemyMight: number,
  opts: { allyMod?: number; enemyMod?: number; rng?: RNG } = {},
): ClashResult {
  const rng = opts.rng ?? defaultRNG;
  const allyTest = rollMightTest(allyMight, opts.allyMod ?? 0, rng);
  const enemyTest = rollMightTest(enemyMight, opts.enemyMod ?? 0, rng);
  return {
    allyTest,
    enemyTest,
    enemyLoss: mightReduction(allyTest.sl),
    allyLoss: mightReduction(enemyTest.sl),
  };
}

// ── Difficulté DÉRIVÉE d'un écart d'armées (Discours inspirant, l.69-71) ─────────────────────────

/** Arrondi au PAS déclaré par l'entrée (`difficultyFrom.roundTo`) — 10 = « arrondie à la dizaine la
 *  plus proche » (l.71). Pas ≤ 0 → valeur inchangée. */
export function roundToStep(n: number, step: number): number {
  return step > 0 ? Math.round(n / step) * step : n;
}

/** Difficulté d'un Test DÉRIVÉE d'un ÉCART de mesure d'armée (l.71) : « une Difficulté déterminée par la
 *  différence de Puissance entre les armées, arrondie à la dizaine la plus proche ». L'écart arrondi EST
 *  le modificateur — favorable (allié devant) → plus facile ; défavorable → plus dur. En cas de Succès du
 *  Discours → +10 au Test de Puissance du premier Round (`INSPIRE_BONUS`). PUR. */
export function gapDifficulty(gap: number, roundTo = 1): Difficulty {
  return difficultyFromModifier(roundToStep(gap, roundTo));
}

/** Bonus au Test de Puissance du premier Round de bataille en cas de Discours inspirant réussi (l.71). */
export const INSPIRE_BONUS = 10;

// ── « Tenez votre position » — Point de rupture (l.161-163) ──────────────────────────────────────

/** Paramètre d'une Scène « Tenez votre position » (l.161-163) — porté par `ActivityDef.hold` (donnée). */
export interface BattleHold { breakpoint: number; maxRounds: number; enemyBonusPerHold: number }

/** État PERSISTANT (entre Rounds de bataille) d'une Scène « Tenez votre position » (l.161-163) : le
 *  Point de rupture (`breakpoint`, DR cumulés de l'ennemi), le nombre de Rounds tenus, et si la position
 *  a déjà cédé (déroute — l'ennemi a percé). Générique : porté par `MassBattleState.sceneState`. */
export interface HoldState {
  /** Somme cumulée des DR de l'ennemi au Test opposé (« On nomme le nombre cumulé des DR : Point de rupture »). */
  breakpoint: number;
  /** Nombre de Rounds où la position a été TENUE (Point de rupture < seuil). */
  held: number;
  /** La position a-t-elle cédé ? (Point de rupture ≥ seuil, ou `maxRounds` atteint → déroute.) */
  broken: boolean;
}

/** État de tenue vierge (avant le 1ᵉʳ Round de la Scène). */
export function initHoldState(): HoldState {
  return { breakpoint: 0, held: 0, broken: false };
}

/** Issue d'un Round de « Tenez votre position » (l.161-163). */
export interface HoldResolution {
  /** Nouvel état persistant (à réécrire dans `sceneState`). */
  next: HoldState;
  /** La position a-t-elle TENU ce Round (breakpoint encore < seuil, hors déroute) ? */
  held: boolean;
  /** DR net de l'ennemi ce Round (positif = l'ennemi progresse et fait monter le Point de rupture). */
  enemySL: number;
  /** Bonus cumulatif d'opposition que l'ennemi APPLIQUERA au Round suivant (« +10 pour les Rounds
   *  successifs ») — dérivé du nombre de Rounds déjà tenus. */
  nextEnemyBonus: number;
}

/** Bonus cumulatif d'opposition de l'ennemi au Round `heldSoFar+1` d'une Scène « Tenez votre position »
 *  (l.163 : « obtient un bonus cumulatif de +10 pour les Rounds successifs ») : +`enemyBonusPerHold`
 *  par Round DÉJÀ tenu. Pur — le flux le passe en modificateur du Test opposé de l'ennemi. */
export function holdEnemyBonus(hold: BattleHold, heldSoFar: number): number {
  return Math.max(0, heldSoFar) * hold.enemyBonusPerHold;
}

/** Résout un Round de « Tenez votre position » (l.161-163) à partir du DR net de l'ENNEMI au Test opposé
 *  de ce Round (positif = l'ennemi l'emporte). Accumule le Point de rupture (jamais sous 0), décide de la
 *  tenue (breakpoint < seuil ET Rounds restants), et calcule le bonus d'opposition du Round suivant. La
 *  réduction −2 de la Puissance ennemie « pour chaque Round tenu » est portée par l'issue `on:'success'`
 *  de la Scène (gated par la tenue via le flux) — pas ici (le résolveur reste PUR et sans Puissance). */
export function resolveHoldRound(prev: HoldState, hold: BattleHold, enemySL: number): HoldResolution {
  const breakpoint = Math.max(0, prev.breakpoint + enemySL);
  const roundsElapsed = prev.held + 1;
  const broken = breakpoint >= hold.breakpoint || roundsElapsed >= hold.maxRounds;
  // Tenu ce Round si le Point de rupture n'a pas atteint le seuil (l.163 : « avant que le Point de rupture
  // n'atteigne 10 »). Une déroute par nombre de Rounds n'est PAS une tenue supplémentaire.
  const held = breakpoint < hold.breakpoint;
  const nextHeld = held ? prev.held + 1 : prev.held;
  return {
    next: { breakpoint, held: nextHeld, broken },
    held,
    enemySL,
    nextEnemyBonus: holdEnemyBonus(hold, nextHeld),
  };
}

// ── Rassemblement (l.122) ────────────────────────────────────────────────────────────────────────

/** Blessures guéries par le Rassemblement (l.122) : « un Test de Résistance Intermédiaire (+0) pour
 *  guérir un nombre de Blessures égal au DR + le Bonus d'Endurance ». Sur Succès uniquement (l'appelant
 *  gate) ; DR négatif borné à 0. */
export function rallyHealAmount(sl: number, enduranceBonus: number): number {
  return Math.max(0, sl) + Math.max(0, enduranceBonus);
}

// ── Issue de la bataille (l.124) ─────────────────────────────────────────────────────────────────

export type BattleOutcome = 'ally' | 'enemy' | 'draw';

/** « À la fin des Rounds de bataille prévus, l'armée avec la Puissance la plus élevée gagne. Le côté
 *  adverse doit fuir, sous peine d'être détruit. » (l.124). Égalité → indécis. */
export function battleOutcome(allyMight: number, enemyMight: number): BattleOutcome {
  if (allyMight === enemyMight) return 'draw';
  return allyMight > enemyMight ? 'ally' : 'enemy';
}

/** Une armée réduite à 0 est DÉTRUITE — la bataille se conclut immédiatement (l.19/124). */
export function isDestroyed(might: number): boolean {
  return might <= MIGHT_MIN;
}

// ── Aléa de bataille (l.307-322) ─────────────────────────────────────────────────────────────────

/** Facteur environnemental tiré/choisi (l.309, 1d10) — « vous pouvez faire un jet sur la table
 *  ci-dessous, ou simplement choisir l'un des résultats ». */
export function battleHazard(roll: number): HazardRow {
  return findTableEntry(BATTLE_HAZARDS, roll);
}

/** Spec d'amorçage d'une bataille (scénario de test / recette `__wfrp`). */
export type MassBattleSpec = import('zod').z.infer<typeof import('../data/schemas/defs-scenes/effets').massBattleSpecSchema>;
