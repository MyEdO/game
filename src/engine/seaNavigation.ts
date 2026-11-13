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
 *    Changement de cap (au dé de sa table ; « –5 ou moins » y ajoute 2) ; côté de dérive 1-5 tribord / 6-10 bâbord.
 *  - Phares (MDG 13 l.333-351) : Perception par distance (≤5 milles Facile +40 ; 5-10 Intermédiaire ;
 *    10-15 Difficile) ; +20 pour repérer un danger proche du phare ; clochers = +2 DR d'Orientation,
 *    distances divisées par 2.
 *  - Longs voyages (MDG 15 l.57-78) : 18 milles/jour par point de M ; « voguer de nuit » sinon ÷2 ;
 *    Test d'équipage de Progression : « tout DR obtenu peut augmenter la progression du jour
 *    d'environ 10 % ».
 *  - Course-poursuite (MDG 13 l.354-420) : Distance en points de 10 m ; Tests de Navigation → Distance
 *    parcourue = mètres ÷ 10 (min 1) ±1/−2 selon la bande de DR ; M 3/2/1 → −1/−2/−3 DR.
 */
import { seaNavigation } from '../data';
import { deDeLaTableTiree, findTableEntry, tableOuverte, type DeDeTable } from './tables';
import { memoParVersion } from '../data/versionDataset';
import { d10, rollDice, type RNG } from './dice';
import { progressionMovement } from './shipNavigation';
import type { Combatant, Difficulty } from './types';
import { testValue } from './skills';

type FicheDeNavigation = typeof seaNavigation;

/** Les tables telles que `findTableEntry` les lit (`tableOuverte`) : « 4 ou plus », « –5 ou moins »…
 *  (MDG 13) ouvrent leurs bandes extrêmes. Mémoïsées sur la fiche, que le Codex édite. */
const tables = memoParVersion('seaNavigation', () => ({
  vitesseMax: tableOuverte(seaNavigation.vitesseMax.table),
  reperes: tableOuverte(seaNavigation.orientation.reperes),
  changementDeCap: tableOuverte(seaNavigation.orientation.changementDeCap.entries),
  voirLaLumiere: tableOuverte(seaNavigation.phares.voirLaLumiere),
  drDeltas: tableOuverte(seaNavigation.poursuite.drDeltas),
}));

export const WORK_PERIOD_HOURS = seaNavigation.workPeriodHours;
export const REPARATION = seaNavigation.reparation;
/** Les vivres de la cale, dans l'ordre où l'équipage les mange, et le tonneau d'eau douce. MDG 14 l.238, l.248-252, l.263 */
export const VIVRES_DE_CALE = { vivres: seaNavigation.longsVoyages.vivresDeCale.map((v) => v.id), tonneau: seaNavigation.longsVoyages.tonneauDeCale.id };

/** Bonus de Savoir (Océans) aux Tests de NAVIGATION en mer (MDG 13 l.20) : « le premier chiffre de leur score
 *  de Compétence » (36 → +3). 0 si la Compétence n'est pas ACQUISE (le bonus récompense une formation,
 *  pas une Int nue — un score sans avance ne « possède » pas la Compétence). PUR. */
export function savoirOceansBonus(c: Combatant): number {
  const adv = (c.skills ?? []).find((s) => s.id === 'savoir' && s.spec === 'oceans')?.advances ?? 0;
  if (adv <= 0) return 0;
  return Math.floor(testValue(c, { skill: { id: 'savoir', spec: 'oceans' } }) / 10);
}

// ── Forcer le rythme & Épuisement (MDG 13 l.95-111) ─────────────────────────────────────────────────────

/** Difficulté du Test de Voile/Ramer pour gagner `bonusM` (MDG 13 l.99-105) — `null` si impossible
 *  (ex. +2 M à la voile : « n/a »). PUR. */
export function forcePaceDifficulty(bonusM: number, rig: 'voile' | 'avirons'): Difficulty | null {
  const row = seaNavigation.forcerLeRythme.find((r) => r.bonusM === bonusM);
  return row?.[rig] ?? null;
}

/** Difficulté du Test d'Épuisement, `forced` = rythme forcé (MDG 13 l.111). PUR. */
export function exhaustionDifficulty(forced: boolean): Difficulty {
  return forced ? seaNavigation.epuisement.forcedDifficulty : seaNavigation.epuisement.difficulty;
}

// ── Vitesses maximum — « Ça va lâcher, capitaine ! » (MDG 13 l.121-142) ─────────────────────────────────

export type OverspeedRow = Pick<FicheDeNavigation['vitesseMax']['table'][number], 'difficulty' | 'per' | 'damage'>;

/** Ligne du tableau « Ça va lâcher, capitaine ! » pour une vitesse de `m` quand le M de conception est
 *  `baseM` (MDG 13 l.125 : « jusqu'à M+4 sans risquer de subir des Dégâts ») — `null` sous le seuil. PUR. */
export function overspeedRow(baseM: number, m: number): OverspeedRow | null {
  const plus = m - baseM;
  if (plus <= seaNavigation.vitesseMax.safeBonus) return null;
  const row = findTableEntry(tables().vitesseMax, plus);
  return { difficulty: row.difficulty, per: row.per, damage: row.damage };
}

/** Dégâts d'un ÉCHEC du Test de survitesse (MDG 13 l.142), sur le résultat d'un Test résolu par la
 *  porte des jets (`seaVoyageFlow.ts`). PUR. */
export function overspeedDamage(baseDamage: number, sl: number): number {
  return baseDamage + Math.max(0, -sl);
}

// ── Salissures (MDG 13 l.144-159) ───────────────────────────────────────────────────────────────────────

export type FoulingLevel = Omit<FicheDeNavigation['salissures']['levels'][number], 'source'>;

/** Effets du niveau de Salissures courant (0 = coque propre → tout à 0). PUR. */
export function foulingEffects(level: number): FoulingLevel {
  if (level <= 0) return { level: 0, manDR: 0, mMod: 0, navDR: 0, repairPctOfBase: 0, desc: '' };
  const capped = Math.min(level, seaNavigation.salissures.levels.length);
  return seaNavigation.salissures.levels.find((l) => l.level === capped)!;
}

/** Niveau de Salissures après le Test HEBDOMADAIRE (MDG 13 l.148), plafonné au dernier niveau du
 *  tableau. PUR. */
export function weeklyFoulingLevel(level: number, success: boolean): { level: number; gained: boolean } {
  const gained = !success && level < seaNavigation.salissures.levels.length;
  return { level: gained ? level + 1 : level, gained };
}

// ── Orientation : Repères & Changement de cap (MDG 13 l.307-331) ────────────────────────────────────────

export type OrientationOutcome = FicheDeNavigation['orientation']['reperes'][number]['outcome'];
export type CourseChangeOutcome = FicheDeNavigation['orientation']['changementDeCap']['entries'][number]['outcome'];

export interface OrientationResult {
  outcome: OrientationOutcome;
  desc: string;
  /** Le tableau Changement de cap doit être tiré (dérive avérée — `derive-mineure` répété inclus). */
  rollCourseChange: boolean;
  /** Bonus au d10 de Changement de cap (« –5 ou moins … ajoutez 2 au résultat », MDG 13 l.320). */
  courseChangeBonus: number;
}

/** Issue du Test d'ORIENTATION quotidien (tableau Repères, MDG 13 l.313-320). `minorDriftBefore` = une dérive
 *  mineure a DÉJÀ eu lieu (« ce résultat n'a aucun effet la première fois, mais s'il se reproduit,
 *  lancez le dé », MDG 13 l.318). PUR. */
export function orientationOutcome(dr: number, minorDriftBefore: boolean): OrientationResult {
  const row = findTableEntry(tables().reperes, dr);
  const rollCourseChange = row.outcome === 'derive' || row.outcome === 'derive-majeure' || (row.outcome === 'derive-mineure' && minorDriftBefore);
  return { outcome: row.outcome, desc: row.desc, rollCourseChange, courseChangeBonus: row.outcome === 'derive-majeure' ? seaNavigation.orientation.bonusDeDeriveMajeure : 0 };
}

export interface CourseChangeResult {
  roll: number;
  outcome: CourseChangeOutcome;
  delayPct: number;
  side: 'tribord' | 'babord';
  desc: string;
}

/** Le dé du tableau CHANGEMENT DE CAP, lu à l'appel. */
export const deDuChangementDeCap = (): DeDeTable => deDeLaTableTiree(seaNavigation.orientation.changementDeCap);

/** Tirage du tableau CHANGEMENT DE CAP au dé de sa table (MDG 13 l.324-331) + côté de dérive (MDG 13 l.322 :
 *  « 1-5 tribord, 6-10 bâbord »). `bonus` = +2 d'une dérive majeure. PUR (RNG injecté). */
export function rollCourseChange(rng: RNG, bonus = 0): CourseChangeResult {
  const roll = rollDice(deDuChangementDeCap(), rng) + bonus;
  const row = findTableEntry(tables().changementDeCap, roll);
  return {
    roll,
    outcome: row.outcome,
    delayPct: row.delayPct ?? 0,
    side: d10(rng) <= seaNavigation.orientation.coteDeLaDerive.tribordMax ? 'tribord' : 'babord',
    desc: row.desc,
  };
}

// ── Phares & clochers (MDG 13 l.333-351) ────────────────────────────────────────────────────────────────

/** Difficulté du Test de PERCEPTION pour voir la lumière d'un phare à `milles` (tableau VOIR LA
 *  LUMIÈRE, MDG 13 l.339-346) — `null` au-delà de 15 milles (hors tableau : invisible). `clocher` → toutes
 *  les distances divisées par 2 (MDG 13 l.351). PUR. */
export function lighthouseSpotDifficulty(milles: number, clocher = false): Difficulty | null {
  const d = clocher ? milles * seaNavigation.phares.clocher.distanceDiviseur : milles;
  const row = findTableEntry(tables().voirLaLumiere, d);
  return d > row.max ? null : row.difficulty;
}

/** Bonus d'ORIENTATION une fois le repère perçu : phare → « premier chiffre » de Savoir (Océans)
 *  (MDG 13 l.335, via `savoirOceansBonus`) ; clocher → +2 DR forfaitaires (MDG 13 l.351). PUR. */
export function lighthouseOrientationDR(navigator: Combatant, clocher: boolean): number {
  return clocher ? seaNavigation.phares.clocher.orientationDR : savoirOceansBonus(navigator);
}

// ── Longs voyages : milles par jour (MDG 15 l.53-78) ──────────────────────────────────────────────

/** Milles parcourus en un JOUR de long voyage (MDG 15 l.57-70 : 18 milles/jour par point de M) ;
 *  « voguer de nuit » impossible → ÷2 (MDG 15 l.76) ; `progressionDR` = total du Test d'équipage de
 *  Progression, ±10 %/DR (MDG 15 l.78). Plancher 0. PUR. */
export function seaMilesPerDay(m: number, nightSailing: boolean, progressionDR = 0): number {
  let miles = Math.max(0, m) * seaNavigation.longsVoyages.millesParJourParM;
  if (!nightSailing) miles /= seaNavigation.longsVoyages.sansVoguerDeNuitDiviseur;
  miles *= 1 + (seaNavigation.longsVoyages.progressionPctParDR / 100) * progressionDR;
  return Math.max(0, miles);
}

// ── Course-poursuite (MDG 13 l.354-420) ─────────────────────────────────────────────────────────────────

/** Voile du Test de Navigation d'un Poursuivant dont aucun profil du bord ne porte Voile (donnée maison). MDG 13 l.376 */
export function voileSansProfil(): number {
  return seaNavigation.poursuite.voileSansProfil;
}

/** Pénalité de Poursuite des bateaux lents (MDG 13 l.399 : M 3 → −1 DR ; M 2 → −2 ; M 1 → −3). PUR. */
export function pursuitLowMPenalty(m: number): number {
  return seaNavigation.poursuite.lowMPenalty.find((r) => r.m === m)?.dr ?? (m >= 4 ? 0 : seaNavigation.poursuite.lowMPenalty[seaNavigation.poursuite.lowMPenalty.length - 1].dr);
}

/** Distance parcourue ce Round de Poursuite (tableau MDG 13 l.378-397) : mètres normaux du résultat du Test
 *  (Progression du navire × 2 m/M/Round, cf. VITESSES DE MOUVEMENT MDG 13 l.47-60) ÷ 10 arrondi à l'inférieur,
 *  min 1, puis +1 (DR ≥ 4) / −1 (DR −1 à −3) / −2 (DR ≤ −4). Peut être négatif après malus (le bateau
 *  perd du terrain). PUR. */
export function pursuitDistanceGain(baseM: number, dr: number): number {
  const metres = progressionMovement(baseM, dr) * 2; // M → mètres par Round (MDG 13 l.47-60 : « Mètres par Round » = 2×M)
  const base = Math.max(1, Math.floor(metres / seaNavigation.poursuite.distanceUnitM));
  return base + findTableEntry(tables().drDeltas, dr).delta;
}
