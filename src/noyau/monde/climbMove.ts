import { climbEdgeBetween, heightAt, piedDEscalade, surfaceDAtterrissage, type Scene } from './scene';
import type { Effect, Flow } from '../../data/schemas/defs-scenes/effets';
import { EMPTY_FLOW } from '../../engine/flowCore';
import type { Pt } from './path';
import { surfaceClimbImpossible } from '../../engine/movement';
import { rule } from '../../engine/policy';
import { isDoubleRoll } from '../../engine/tests';
import { fingersLost } from '../../engine/trauma';
import { DIFFICULTE_PAR_DEFAUT, type Combatant } from '../../engine/types';
import { combatStakeRef } from '../../data';

const SEUIL_CHUTE = -4;

type ChuteDEscalade = Extract<Effect, { type: 'fall' }>;

export interface EscaladeEnAttente {
  arrivee: Pt;
  chute?: ChuteDEscalade;
}

export type ClimbPlan =
  | { kind: 'free'; auto?: boolean }
  | { kind: 'impossible' }
  | { kind: 'test'; flow: Extract<Flow, { kind: 'test' }>; escalade: EscaladeEnAttente };

/** LDB 15 l.53-57 · LDB 85 l.160-162 · #4188 */
export function planClimb(
  scene: Scene, from: Pt, to: Pt, hasGrimpeur: boolean, fallerId?: string, autoSucceed = false,
  appuiAdmissible?: (appui: Pt) => boolean,
): ClimbPlan | null {
  const climb = climbEdgeBetween(scene, from, to)?.climb;
  if (!climb) return null;
  if (climb.kind === 'ladder') return { kind: 'free' };
  if (autoSucceed) return { kind: 'free', auto: true };
  if (surfaceClimbImpossible(!!climb.requiresGrimpeur, hasGrimpeur)) return { kind: 'impossible' };

  const chute = rule('escalade-chute-sur-echec') ? chuteDEscalade(scene, from, to, fallerId, appuiAdmissible) : undefined;
  const stake = chute
    ? combatStakeRef('escalade-test', { values: { metres: chute.metres } })
    : combatStakeRef('escalade-test-sans-chute');

  return {
    kind: 'test',
    flow: {
      kind: 'test',
      test: { skill: { id: 'escalade' }, difficulty: climb.difficulty ?? DIFFICULTE_PAR_DEFAUT, label: 'Escalade', stake },
      reussite: EMPTY_FLOW,
      echec: EMPTY_FLOW,
    },
    escalade: { arrivee: to, ...(chute ? { chute } : {}) },
  };
}

/** #4188 · LDB 15 l.80-84 */
function chuteDEscalade(
  scene: Scene, from: Pt, to: Pt, fallerId: string | undefined, appuiAdmissible?: (appui: Pt) => boolean,
): ChuteDEscalade | undefined {
  const depart = heightAt(scene, from.x, from.y, from.z ?? 0);
  const pied = piedDEscalade(scene, from, to);
  const appui = surfaceDAtterrissage(scene, pied.x, pied.y, depart, 'chute', appuiAdmissible);
  if (appui.kind !== 'surface') return undefined;
  const metres = depart - appui.hauteur;
  return fallerId
    ? { type: 'fall', target: 'heros', heroId: fallerId, metres, to: appui.to }
    : { type: 'fall', target: 'groupe', metres, to: appui.to };
}

/** #4188 · LDB 12 l.111-127 · LDB 18 l.251 */
export function chuteSurEchecDEscalade(escalade: EscaladeEnAttente, sl: number, roll: number, acteur?: Combatant): ChuteDEscalade | undefined {
  if (!escalade.chute) return undefined;
  if (sl <= SEUIL_CHUTE || (rule('test-critiques-doubles') && isDoubleRoll(roll))) return escalade.chute;
  if (!acteur) return undefined;
  const doigtsPerdus = Math.max(fingersLost(acteur, 'brasG'), fingersLost(acteur, 'brasD'));
  const unites = roll % 10;
  return unites > 0 && unites <= doigtsPerdus ? escalade.chute : undefined;
}
