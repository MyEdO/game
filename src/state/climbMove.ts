import { Scene, Effect, WallSeg, heightAt, climbEdgeBetween } from './scene';
import { type Flow, EMPTY_FLOW, flowFromEffects } from './flow';
import type { Pt } from './path';
import { surfaceClimbImpossible } from '../engine/movement';
import { combatStakeRef } from '../data';

/**
 * Traduit une ESCALADE d'arête (LDB 15 l.53-57) — `from` (case basse) vers `to` (case haute, adjacente en
 * cardinal) à travers une arête `WallSeg.climb` — en plan jouable, SANS flux dédié, sur le patron de
 * `jumpMove.planJump` :
 *  - `ladder` (échelle / surface facile, LDB 15 l.55) → franchissement d'office SANS Test (`free`) ;
 *  - `surface` exigeant le Talent Grimpeur, absent → `impossible` (LDB 15 l.57) ;
 *  - `surface` → l'Effet `test` existant (Escalade, difficulté ÉDITÉE sur l'arête) dont l'ÉCHEC déclenche
 *    `fall` : le grimpeur retombe au pied (`to`=`from`), sur la hauteur RÉELLE du décor (relief).
 * Le Test consomme l'Action en combat (LDB 13 l.86-88) — arbitré au seam (store).
 */
export type ClimbPlan =
  | { kind: 'free'; auto?: boolean }
  | { kind: 'impossible' }
  | { kind: 'test'; flow: Extract<Flow, { kind: 'test' }> };

/**
 * `autoSucceed` (Grimpant, LDB 85 l.160-162 : « réussit automatiquement tous ses Tests d'Escalade ») :
 * toute arête `climb` — échelle OU surface — se résout `free` (aucun jet, pas un jet silencieux). Le
 * verbatim ne réserve nulle part `requiresGrimpeur` (garde du TALENT joueur, LDB 15 l.57 : « bien trop
 * compliquée pour la plupart des Personnages ») aux créatures — arbitrage : `autoSucceed` l'ignore.
 */
export function planClimb(scene: Scene, from: Pt, to: Pt, hasGrimpeur: boolean, fallerId?: string, autoSucceed = false): ClimbPlan | null {
  const seg: WallSeg | undefined = climbEdgeBetween(scene, from, to);
  if (!seg?.climb) return null; // arête non grimpable → le geste ne s'applique pas
  const c = seg.climb;
  if (c.kind === 'ladder') return { kind: 'free' }; // LDB 15 l.55 : échelle = pas de Test, ralentit seulement
  if (autoSucceed) return { kind: 'free', auto: true };
  if (surfaceClimbImpossible(!!c.requiresGrimpeur, hasGrimpeur)) return { kind: 'impossible' };
  // Chute sur échec = vraie hauteur métrique (relief) entre les deux surfaces — retombe au pied (`from`).
  // En combat, le faller NOMMÉ (`fallerId`) chute et regagne le pied ; hors combat, c'est le GROUPE.
  const metres = Math.abs(heightAt(scene, to.x, to.y, to.z ?? 0) - heightAt(scene, from.x, from.y, from.z ?? 0));
  const foot = { x: from.x, y: from.y, z: from.z ?? 0 };
  const fall: Effect = fallerId
    ? { type: 'fall', target: 'hero', heroId: fallerId, metres, to: foot }
    : { type: 'fall', target: 'party', metres, to: foot };
  return {
    kind: 'test',
    flow: {
      kind: 'test',
      test: { skill: { id: 'escalade' }, difficulty: c.difficulty ?? 'intermediaire', label: 'Escalade', stake: combatStakeRef('climbTest', { values: { metres } }) },
      success: EMPTY_FLOW,
      fail: flowFromEffects([fall]),
    },
  };
}
