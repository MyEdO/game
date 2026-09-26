/**
 * NAVIGATION MARITIME — couche PURE de MDG 13 l.39-351 + « Longs voyages » MDG 15 l.53-78,
 * données verbatim dans `src/data/sea-navigation.json`. Complète `shipNavigation.ts` (Progression /
 * Manœuvre, déjà en place) : ici Périodes de travail, Forcer le rythme, Épuisement, Vitesses maximum
 * (« Ça va lâcher, capitaine ! »), Salissures, Orientation (Repères / Changement de cap), Phares &
 * clochers, milles/jour des longs voyages et Course-poursuite.
 *
 * RAW :
 *  - Savoir (Océans) : « bonus sur les Tests de Navigation égal au premier chiffre de leur score de
 *    Compétence … Ce bonus ne s'applique que sur l'océan » (MDG 13 l.20) ; idem sur l'Orientation en vue
 *    d'un phare (MDG 13 l.335). NOTE : « ce Test [Forcer le rythme] n'est pas un Test de Navigation et
 *    Savoir (Océans) ne donne donc pas de bonus dessus » (MDG 13 l.97).
 *  - Périodes de travail (MDG 13 l.62) : rameurs 2 h, voiles/barre 8 h ; Épuisement (MDG 13 l.109-111) : fin de
 *    Période → Test de Résistance Accessible (+20) sous peine d'Exténué ; Complexe (−10) si le
 *    rythme a été forcé.
 *  - Forcer le rythme (MDG 13 l.95-107) : +1 M Voile Très Difficile (−30) / Ramer Difficile (−20) ;
 *    +2 M Ramer Très Difficile (−30) seulement.
 *  - Vitesses maximum (MDG 13 l.121-142) : « jusqu'à M+4 sans risquer de subir des Dégâts » ; au-delà,
 *    Test d'Endurance du NAVIRE sinon Dégâts « 1+X … 8+X », X = DR négatifs du Test raté.
 *  - Salissures (MDG 13 l.144-159) : « Pour chaque semaine qu'un navire passe en mer sans l'entretien
 *    approprié, effectuez un Test de Résistance pour le vaisseau. Pour chaque Test raté, ajoutez un
 *    niveau de Salissures » (max 5, tableau verbatim).
 *  - Orientation (MDG 13 l.307-331) : « un Test par jour de voyage » → tableau Repères ; dérive → tableau
 *    Changement de cap (d10 ; « –5 ou moins » y ajoute 2) ; côté de dérive 1-5 tribord / 6-10 bâbord.
 *  - Phares (MDG 13 l.333-351) : Perception par distance (≤5 milles Facile +40 ; 5-10 Intermédiaire ;
 *    10-15 Difficile) ; +20 pour repérer un danger proche du phare ; clochers = +2 DR d'Orientation,
 *    distances divisées par 2.
 *  - Longs voyages (MDG 15 l.57-78) : 18 milles/jour par point de M ; « voguer de nuit » sinon ÷2 ;
 *    Test d'équipage de Progression : « tout DR obtenu peut augmenter la progression du jour
 *    d'environ 10 % ».
 *  - Course-poursuite (MDG 13 l.354-420) : Distance en points de 10 m ; Tests de Navigation → Distance
 *    parcourue = mètres ÷ 10 (min 1) ±1/−2 selon la bande de DR ; M 3/2/1 → −1/−2/−3 DR.
 */
import seaNavJson from '../data/sea-navigation.json';
import { findTableEntry } from './tables';
import { d10, type RNG, defaultRNG } from './dice';
import { rollTest } from './tests';
import { progressionMovement } from './shipNavigation';
import type { Combatant, Difficulty } from './types';
import { effectiveChar } from './characteristics';
import { testValue } from './skills';
import { memeRef } from './careerSlots';

type Per = 'heure' | 'minute' | 'round';
const DATA = seaNavJson as unknown as {
  workPeriodHours: { voile: number; avirons: number };
  epuisement: { difficulty: Difficulty; forcedDifficulty: Difficulty };
  forcerLeRythme: { bonusM: number; voile?: Difficulty; avirons?: Difficulty }[];
  vitesseMax: { safeBonus: number; table: { min: number; max: number; difficulty: Difficulty; per: Per; damage: number }[] };
  salissures: { weeklyTest: boolean; levels: { level: number; manDR: number; mMod: number; navDR: number; repairPctOfBase: number; desc: string }[] };
  orientation: {
    testsPerDay: number;
    reperes: { min: number; max: number; outcome: OrientationOutcome; desc: string }[];
    driftMajorBonus: number;
    driftSide: { tribordMax: number };
    changementDeCap: { min: number; max: number; outcome: CourseChangeOutcome; delayPct?: number; desc: string }[];
  };
  phares: { voirLaLumiere: { min: number; max: number; difficulty: Difficulty }[]; perilSpotBonus: number; clocher: { orientationDR: number; distanceDiviseur: number } };
  longsVoyages: { millesParJourParM: number; sansVoguerDeNuitDiviseur: number; progressionPctParDR: number };
  poursuite: {
    distanceUnitM: number;
    escapeDistances: { id: string; label: string; distance: number }[];
    drDeltas: { min: number; max: number; delta: number }[];
    lowMPenalty: { m: number; dr: number }[];
  };
  reparation: {
    portCostGoldPerWound: number; testHours: string; woundsPerTest: string; charpentierPenalty: number;
    lissageRepairSurcoutPct: number;
    temporaire: { difficultyMin: Difficulty; difficultyMax: Difficulty; hoursPerRepair: number; woundsPerRepair: string; failDamage: string };
    entretienCrewTestDR: number;
  };
};

export const WORK_PERIOD_HOURS = DATA.workPeriodHours;
export const REPARATION = DATA.reparation;

/** Bonus de Savoir (Océans) aux Tests de NAVIGATION en mer (MDG 13 l.20) : « le premier chiffre de leur score
 *  de Compétence » (36 → +3). 0 si la Compétence n'est pas ACQUISE (le bonus récompense une formation,
 *  pas une Int nue — un score sans avance ne « possède » pas la Compétence). PUR. */
export function savoirOceansBonus(c: Combatant): number {
  const adv = (c.skills ?? []).find((s) => memeRef(s, { id: 'savoir', spec: 'oceans' }))?.advances ?? 0;
  if (adv <= 0) return 0;
  return Math.floor(testValue(c, 'savoir', undefined, 'oceans') / 10);
}

// ── Forcer le rythme & Épuisement (MDG 13 l.95-111) ─────────────────────────────────────────────────────

/** Difficulté du Test de Voile/Ramer pour gagner `bonusM` (MDG 13 l.99-105) — `null` si impossible
 *  (ex. +2 M à la voile : « n/a »). PUR. */
export function forcePaceDifficulty(bonusM: number, rig: 'voile' | 'avirons'): Difficulty | null {
  const row = DATA.forcerLeRythme.find((r) => r.bonusM === bonusM);
  return row?.[rig] ?? null;
}

/** Test d'ÉPUISEMENT de fin de Période de travail (MDG 13 l.109-111) : Résistance Accessible (+20), Complexe
 *  (−10) si le rythme a été forcé ; échec → +1 Exténué (l'appelant pose l'État). PUR. */
export function exhaustionDifficulty(forced: boolean): Difficulty {
  return forced ? DATA.epuisement.forcedDifficulty : DATA.epuisement.difficulty;
}

// ── Vitesses maximum — « Ça va lâcher, capitaine ! » (MDG 13 l.121-142) ─────────────────────────────────

export interface OverspeedRow { difficulty: Difficulty; per: Per; damage: number }

/** Ligne du tableau « Ça va lâcher, capitaine ! » pour une vitesse de `m` quand le M de conception est
 *  `baseM` (MDG 13 l.125 : « jusqu'à M+4 sans risquer de subir des Dégâts ») — `null` sous le seuil. PUR. */
export function overspeedRow(baseM: number, m: number): OverspeedRow | null {
  const plus = m - baseM;
  if (plus <= DATA.vitesseMax.safeBonus) return null;
  const row = findTableEntry(DATA.vitesseMax.table, plus);
  return { difficulty: row.difficulty, per: row.per, damage: row.damage };
}

/** Dégâts d'un ÉCHEC du Test de survitesse : `damage + X`, « X est égal au nombre de Degrés de
 *  Réussite négatifs générés sur un Test de Résistance raté » (MDG 13 l.142). PUR — factorisé pour être
 *  partagé par `rollOverspeedDamage` (jet auto-contenu) et tout appelant qui possède déjà le résultat
 *  d'un Test résolu ailleurs (ex. couture cascade, `seaVoyageFlow.ts`). */
export function overspeedDamage(baseDamage: number, sl: number): number {
  return baseDamage + Math.max(0, -sl);
}

/** Test d'Endurance du NAVIRE en survitesse : échec → Dégâts `damage + X` (MDG 13 l.142, `overspeedDamage`).
 *  PUR (RNG injecté). */
export function rollOverspeedDamage(hull: Combatant, row: OverspeedRow, rng: RNG = defaultRNG): { roll: number; target: number; success: boolean; damage: number } {
  const t = rollTest(effectiveChar(hull, 'endurance'), row.difficulty, rng);
  return { roll: t.roll, target: t.target, success: t.success, damage: t.success ? 0 : overspeedDamage(row.damage, t.sl) };
}

// ── Salissures (MDG 13 l.144-159) ───────────────────────────────────────────────────────────────────────

export interface FoulingLevel { level: number; manDR: number; mMod: number; navDR: number; repairPctOfBase: number; desc: string }

/** Effets du niveau de Salissures courant (0 = coque propre → tout à 0). PUR. */
export function foulingEffects(level: number): FoulingLevel {
  if (level <= 0) return { level: 0, manDR: 0, mMod: 0, navDR: 0, repairPctOfBase: 0, desc: '' };
  const capped = Math.min(level, DATA.salissures.levels.length);
  return DATA.salissures.levels.find((l) => l.level === capped)!;
}

/** Test HEBDOMADAIRE de Salissures (MDG 13 l.148 : Test de Résistance du VAISSEAU ; raté → +1 niveau, max 5).
 *  PUR — renvoie le nouveau niveau + le détail du jet. */
export function rollWeeklyFouling(hullE: number, level: number, rng: RNG = defaultRNG): { level: number; roll: number; target: number; gained: boolean } {
  const t = rollTest(hullE, 'intermediaire', rng);
  const gained = !t.success && level < DATA.salissures.levels.length;
  return { level: gained ? level + 1 : level, roll: t.roll, target: t.target, gained };
}

// ── Orientation : Repères & Changement de cap (MDG 13 l.307-331) ────────────────────────────────────────

export type OrientationOutcome = 'exact' | 'ok' | 'drift-minor' | 'drift' | 'drift-major';
export type CourseChangeOutcome = 'aucun' | 'retard' | 'quart-de-tour' | 'demi-tour';

export interface OrientationResult {
  outcome: OrientationOutcome;
  desc: string;
  /** Le tableau Changement de cap doit être tiré (dérive avérée — `drift-minor` répété inclus). */
  rollCourseChange: boolean;
  /** Bonus au d10 de Changement de cap (« –5 ou moins … ajoutez 2 au résultat », MDG 13 l.320). */
  courseChangeBonus: number;
}

/** Issue du Test d'ORIENTATION quotidien (tableau Repères, MDG 13 l.313-320). `minorDriftBefore` = une dérive
 *  mineure a DÉJÀ eu lieu (« ce résultat n'a aucun effet la première fois, mais s'il se reproduit,
 *  lancez le dé », MDG 13 l.318). PUR. */
export function orientationOutcome(dr: number, minorDriftBefore: boolean): OrientationResult {
  const row = findTableEntry(DATA.orientation.reperes, dr);
  const rollCourseChange = row.outcome === 'drift' || row.outcome === 'drift-major' || (row.outcome === 'drift-minor' && minorDriftBefore);
  return { outcome: row.outcome, desc: row.desc, rollCourseChange, courseChangeBonus: row.outcome === 'drift-major' ? DATA.orientation.driftMajorBonus : 0 };
}

export interface CourseChangeResult {
  roll: number;
  outcome: CourseChangeOutcome;
  delayPct: number;
  side: 'tribord' | 'babord';
  desc: string;
}

/** Tirage du tableau CHANGEMENT DE CAP (MDG 13 l.324-331) + côté de dérive (MDG 13 l.322 : « 1-5 tribord,
 *  6-10 bâbord »). `bonus` = +2 d'une dérive majeure. PUR (RNG injecté). */
export function rollCourseChange(rng: RNG = defaultRNG, bonus = 0): CourseChangeResult {
  const roll = d10(rng) + bonus;
  const row = findTableEntry(DATA.orientation.changementDeCap, roll);
  return {
    roll,
    outcome: row.outcome,
    delayPct: row.delayPct ?? 0,
    side: d10(rng) <= DATA.orientation.driftSide.tribordMax ? 'tribord' : 'babord',
    desc: row.desc,
  };
}

// ── Phares & clochers (MDG 13 l.333-351) ────────────────────────────────────────────────────────────────

/** Difficulté du Test de PERCEPTION pour voir la lumière d'un phare à `milles` (tableau VOIR LA
 *  LUMIÈRE, MDG 13 l.339-346) — `null` au-delà de 15 milles (hors tableau : invisible). `clocher` → toutes
 *  les distances divisées par 2 (MDG 13 l.351). PUR. */
export function lighthouseSpotDifficulty(milles: number, clocher = false): Difficulty | null {
  const d = clocher ? milles * DATA.phares.clocher.distanceDiviseur : milles;
  const row = findTableEntry(DATA.phares.voirLaLumiere, d);
  return d > row.max ? null : row.difficulty;
}

/** Bonus d'ORIENTATION une fois le repère perçu : phare → « premier chiffre » de Savoir (Océans)
 *  (MDG 13 l.335, via `savoirOceansBonus`) ; clocher → +2 DR forfaitaires (MDG 13 l.351). PUR. */
export function lighthouseOrientationDR(navigator: Combatant, clocher: boolean): number {
  return clocher ? DATA.phares.clocher.orientationDR : savoirOceansBonus(navigator);
}

// ── Longs voyages : milles par jour (MDG 15 l.53-78) ──────────────────────────────────────────────

/** Milles parcourus en un JOUR de long voyage (MDG 15 l.57-70 : 18 milles/jour par point de M) ;
 *  « voguer de nuit » impossible → ÷2 (MDG 15 l.76) ; `progressionDR` = total du Test d'équipage de
 *  Progression, ±10 %/DR (MDG 15 l.78). Plancher 0. PUR. */
export function seaMilesPerDay(m: number, nightSailing: boolean, progressionDR = 0): number {
  let miles = Math.max(0, m) * DATA.longsVoyages.millesParJourParM;
  if (!nightSailing) miles /= DATA.longsVoyages.sansVoguerDeNuitDiviseur;
  miles *= 1 + (DATA.longsVoyages.progressionPctParDR / 100) * progressionDR;
  return Math.max(0, miles);
}

// ── Course-poursuite (MDG 13 l.354-420) ─────────────────────────────────────────────────────────────────

/** Pénalité de Poursuite des bateaux lents (MDG 13 l.399 : M 3 → −1 DR ; M 2 → −2 ; M 1 → −3). PUR. */
export function pursuitLowMPenalty(m: number): number {
  return DATA.poursuite.lowMPenalty.find((r) => r.m === m)?.dr ?? (m >= 4 ? 0 : DATA.poursuite.lowMPenalty[DATA.poursuite.lowMPenalty.length - 1].dr);
}

/** Distance parcourue ce Round de Poursuite (tableau MDG 13 l.378-397) : mètres normaux du résultat du Test
 *  (Progression du navire × 2 m/M/Round, cf. VITESSES DE MOUVEMENT MDG 13 l.47-60) ÷ 10 arrondi à l'inférieur,
 *  min 1, puis +1 (DR ≥ 4) / −1 (DR −1 à −3) / −2 (DR ≤ −4). Peut être négatif après malus (le bateau
 *  perd du terrain). PUR. */
export function pursuitDistanceGain(baseM: number, dr: number): number {
  const metres = progressionMovement(baseM, dr) * 2; // M → mètres par Round (MDG 13 l.47-60 : « Mètres par Round » = 2×M)
  const base = Math.max(1, Math.floor(metres / DATA.poursuite.distanceUnitM));
  return base + findTableEntry(DATA.poursuite.drDeltas, dr).delta;
}
