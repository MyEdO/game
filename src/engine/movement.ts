/**
 * Règles de déplacement étendu — Livre de base, ch.15 « Déplacement ».
 */
import { RNG } from './dice';
import { effectiveChar } from './characteristics';
import { loseWounds, addCondition } from './conditions';
import type { Combatant, Difficulty } from './types';
import type { RefDesignee } from '../data/schemas/grammaire/ref';
import { rollTest, cibleMesuree, type CibleMesuree, type TestResult } from './tests';
import { effectiveMovement } from './encumbrance';

/**
 * Le plus PETIT Mouvement effectif (`effectiveMovement`) des membres fournis ; liste vide → 0, plancher
 * 0. LDB 51 l.193. LOI UNIQUE, paramétrée par la LISTE : c'est l'APPELANT qui décide qui compte (le
 * voyage prend les vivants, la portée de saut du groupe sa propre population). PUR.
 */
export function slowestMovement(membres: readonly Combatant[]): number {
  return membres.length ? Math.max(0, Math.min(...membres.map((c) => effectiveMovement(c)))) : 0;
}

/** Le Test de fiche que jette un cavalier (LDB 14 l.179), posé UNE fois par l'ouvreur de la Course (héros :
 *  `battleRun` ; IA : `aiApproachPlan`). Le saut et la chute volontaire ne se jouent pas montés : refus
 *  `geste.refus.monte` (`noyau/gesteDArete.ts:89`), saut du groupe hors combat (`noyau/monde/jumpMove.ts`). */
export function testDuCavalier<T extends { readonly skill: RefDesignee }>(actor: Pick<Combatant, 'mountId'>, test: T): T {
  return actor.mountId ? { ...test, skill: { id: 'chevaucher' } } : test;
}

/**
 * Course (LDB 15 l.41) : on parcourt sa Marche (Mouvement) PLUS la distance de course que donne le Test.
 * `difficulty` est la Difficulté RÉSOLUE du Test (fiche `course`, `testDeRegle`), jamais relue ici.
 *
 * Grille du jeu : 2 m/case ; le Mouvement de Course = 2×Mouvement cases (cf. Charge). Le DR du Test est
 * exprimé en MÈTRES par le livre → converti en cases (÷2, arrondi). `bonusCases` = la distance de course
 * ajoutée à la Marche, plancher 0. Le `success` sert à l'affichage ; le bonus s'applique même sur un DR
 * négatif, clampé ≥ 0.
 */
export function resolveRun(
  athletics: number,
  difficulty: Difficulty,
  movement: number,
  rng: RNG,
): IssueDeCourse {
  return runFromTest(rollTest(athletics, difficulty, rng), movement);
}

/** Issue rangée d'une Course : le jet (cible mesurée) et la distance qu'il donne. */
export type IssueDeCourse = { success: boolean; roll: number; dr: number; bonusCases: number } & CibleMesuree;
/** PROJECTION PURE d'un `TestResult` sur l'issue d'une Course (distance en cases). SÉPARE le jet de sa
 *  lecture : le socle des jets rejoue cette projection sur un dé SAISI sans relancer, et sans recopier
 *  la formule. */
export function runFromTest(t: TestResult, movement: number): IssueDeCourse {
  return { success: t.success, roll: t.roll, ...cibleMesuree(t), dr: t.sl, bonusCases: distanceDeCourse(movement, t.sl) };
}

/** Distance de Course en cases, plancher 0 : LDB 15 l.41 ; LDB 15 l.18-31 ; 2 m/case. `dr` absent = distance
 *  NOMINALE, avant le jet. SOURCE UNIQUE de l'issue du Test et de la zone affichée. */
export function distanceDeCourse(movement: number, dr = 0): number {
  return Math.max(0, 2 * movement + Math.round(dr / 2));
}

/**
 * Portée d'une CHARGE, en cases (LDB 15 l.35-37 — la portée est celle de la Course du Tableau des
 * Mouvements, LDB 15 l.18-31). Grille du jeu : 2 m/case, Course = 4×M mètres = 2×M cases.
 * `runMult` = multiplicateur de Course dû aux Traits (`runMultiplier`, Bond/Foulée/Rampant) — passé par
 * l'appelant pour garder ce module libre de la donnée.
 */
export function chargeReach(movement: number, runMult = 1): number {
  return Math.max(0, Math.floor(movement * 2 * runMult));
}

/**
 * Saut (LDB 15 l.76). « Vous pouvez sauter de votre valeur de Mouvement/3 en mètres
 * SANS avoir à effectuer de Test. » Échelle du jeu = 2 m/case (précédent `resolveRun` : les mètres du
 * livre se convertissent en cases ÷2). Saut libre = `floor((M/3)/2)` = `floor(M/6)` cases.
 */
export function freeJumpTiles(movement: number): number {
  return Math.max(0, Math.floor(movement / 6));
}

/**
 * Distance MAXIMALE qu'on peut TENTER (au prix du Test de la fiche `saut`) = saut libre + 1 case. Le livre
 * étend le saut de « 30 cm par DR » sur réussite ; sur la grille à 2 m/case, l'incrément minimal
 * praticable est UNE case. Au-delà, le gouffre est infranchissable.
 */
export function maxJumpTiles(movement: number): number {
  return freeJumpTiles(movement) + 1;
}

/** Un saut de `tiles` cases exige-t-il le Test de `saut` ? Oui dès qu'il dépasse le saut libre. */
export function jumpNeedsTest(movement: number, tiles: number): boolean {
  return tiles > freeJumpTiles(movement);
}

/**
 * Escalade — échelle ou surface facile (LDB 15 l.55). « Le fait de grimper à une échelle,
 * ou sur une autre surface tout aussi facile, ne nécessite pas de Test mais va simplement vous ralentir.
 * Sur de telles surfaces, vous vous déplacez à la moitié de votre vitesse. » La Marche = 2×M mètres/Round →
 * la montée passive (½ vitesse) atteint `M` mètres avec le Mouvement d'un Round (ex. 4 m de Mouvement pour
 * gravir 2 m d'échelle : ½ vitesse). Pur.
 */
export function ladderClimbReach(movement: number): number {
  return Math.max(0, movement);
}

/**
 * Escalade RAPIDE d'une échelle/surface facile (LDB 15 l.55) : « utilisez votre Action pour effectuer un
 * Test d'Escalade Accessible (+20). Vous escaladerez alors une distance supplémentaire équivalent à votre
 * Mouvement + DR mètres » (ex. M4, DR+2 → 6 m de plus). Le bonus s'applique même sur DR négatif (clampé ≥ 0).
 */
export function resolveLadderClimb(
  escalade: number,
  movement: number,
  rng: RNG,
): { success: boolean; roll: number; target: number; dr: number; metres: number } {
  const t = rollTest(escalade, 'accessible', rng); // Escalade Accessible (+20)
  return { success: t.success, roll: t.roll, target: t.target, dr: t.sl, metres: Math.max(0, movement + t.sl) };
}

/**
 * Surface d'escalade trop difficile pour qui ne possède pas le Talent Grimpeur (LDB 15 l.57) : gate PUR,
 * partagé par `resolveSurfaceClimb` (moteur) et la résolution de scène (`noyau/monde/climbMove`).
 */
export function surfaceClimbImpossible(requiresGrimpeur: boolean, hasGrimpeur: boolean): boolean {
  return requiresGrimpeur && !hasGrimpeur;
}

/**
 * Coût en CASES de Mouvement pour gravir `metres` de hauteur à la MOITIÉ de la vitesse (LDB 15 l.55 :
 * « vous vous déplacez à la moitié de votre vitesse »). Une case = `metresPerTile` m ; à ½ vitesse,
 * franchir `metres` de dénivelé dépense `2·metres` de budget de Marche, soit `2·metres/metresPerTile`
 * cases (arrondi supérieur — un dénivelé entamé coûte une case pleine). Pur.
 */
export function climbMovementCost(metres: number, metresPerTile: number): number {
  return Math.ceil((2 * Math.max(0, metres)) / metresPerTile);
}

/**
 * Escalade d'une surface À PRISES, deux mains libres (LDB 15 l.57) : « en utilisant votre Action du tour et
 * en réussissant un Test d'Escalade. Votre vitesse (de monte ou de descente) est (½ Mouvement + DR) mètres.
 * La difficulté du Test est définie par le MJ… Certaines escalades seront bien trop compliquées pour la
 * plupart des Personnages qui ne possèdent pas le Talent Grimpeur. » `tooHard` (surface exigeant Grimpeur) +
 * absence du Talent ⇒ escalade IMPOSSIBLE (0 m). Sur un échec de Test : aucune progression. Pur.
 */
export function resolveSurfaceClimb(
  escalade: number,
  movement: number,
  rng: RNG,
  opts: { difficulty?: import('./types').Difficulty; requiresGrimpeur?: boolean; hasGrimpeur?: boolean } = {},
): { success: boolean; roll: number; target: number; dr: number; metres: number; impossible: boolean } {
  if (surfaceClimbImpossible(!!opts.requiresGrimpeur, !!opts.hasGrimpeur)) {
    return { success: false, roll: 0, target: 0, dr: 0, metres: 0, impossible: true };
  }
  const t = rollTest(escalade, opts.difficulty ?? 'intermediaire', rng);
  return { success: t.success, roll: t.roll, target: t.target, dr: t.sl, metres: t.success ? Math.max(0, Math.floor(movement / 2) + t.sl) : 0, impossible: false };
}

/**
 * Chute VOLONTAIRE — « à dessein » (LDB 15 l.82). `difficulty` est la Difficulté RÉSOLUE du Test (fiche
 * `chute`, `testDeRegle`), jamais relue ici. Renvoie la hauteur EFFECTIVE de chute (à passer à `applyFall`)
 * après réduction ; seul un DR POSITIF réduit. Pur ; ne mute rien.
 */
export function resolveDeliberateFall(
  athletics: number,
  difficulty: Difficulty,
  metres: number,
  rng: RNG,
): IssueDeChute {
  return fallFromTest(rollTest(athletics, difficulty, rng), metres);
}

/** Issue rangée d'une chute volontaire : le jet (cible mesurée) et la hauteur effective. */
export type IssueDeChute = { success: boolean; roll: number; dr: number; effectiveMetres: number } & CibleMesuree;
/** PROJECTION PURE d'un `TestResult` sur l'issue d'une chute volontaire (−1 m par DR positif, LDB 15
 *  l.82). SÉPARE le jet de sa lecture : le socle des jets rejoue cette projection sur un dé SAISI sans
 *  relancer, et sans recopier la formule. */
export function fallFromTest(t: TestResult, metres: number): IssueDeChute {
  const reduction = Math.max(0, t.sl); // −1 m par DR (positif) ; échec = aucune réduction
  return { success: t.success, roll: t.roll, ...cibleMesuree(t), dr: t.sl, effectiveMetres: Math.max(0, metres - reduction) };
}

/**
 * CHUTE appliquée à UN combattant (LDB 15 l.80, l.84) — FOYER UNIQUE de la formule dans tout `src/**` :
 * 3 Dégâts par mètre + 1d10, réduits par le Bonus d'Endurance et par lui seul ; si les Blessures
 * subies dépassent le BE, l'État À Terre est posé. MUTE `c`.
 *
 * Vit ICI, avec les deux autres briques de chute du chapitre (`resolveDeliberateFall`, `fallFromTest`) :
 * toute chute du jeu — repositionnement de groupe (Effet `fall`), effondrement d'une passerelle
 * (`collapseStructure`), incident de monture, op `fall` du gréement (MDG 13 l.678) — s'y applique.
 *
 * Le 1d10 entre PAR PARAMÈTRE (#1508) : c'est un dé du jeu comme un autre, il tombe à la porte des jets
 * (étape à dé nu, affichable/posable), et `applyFall` en est le seul LECTEUR. Ce qui vit ici est la
 * formule, pas le tirage.
 */
export function applyFall(c: Combatant, metres: number, d10Chute: number): void {
  const m = Math.max(0, metres);
  const be = Math.floor(effectiveChar(c, 'endurance') / 10);
  const lost = Math.max(0, 3 * m + d10Chute - be);
  loseWounds(c, lost);
  if (lost > be) addCondition(c, 'a-terre');
}
