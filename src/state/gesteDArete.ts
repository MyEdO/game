/**
 * PORTEUR D'UN GESTE D'ARÊTE (#700, #2190) — prédicat UNIQUE de « ce mobile peut-il, maintenant,
 * accomplir ce geste depuis cette case ? ». Lu par l'ACTION (`climbAcross`, `fallAcross`,
 * `windowAcross`, `store.ts`) et par l'AFFICHAGE (marqueurs d'arête, `gameIso/stage/MondeDeCampagne.tsx`) :
 * afficher et agir ne peuvent pas répondre différemment (`netOwnership.ts`, `humanControlled`).
 *
 * Exploration : le mobile est le meneur DEBOUT (`meneurDeboutDuMonde`), sa case `partyPos`. Combat : le
 * PRÉFIXE du déplacement (`combatFlow.ts:mobileDuTour`, celui de `resolveMovement`), sa case `pos`.
 * Le coût propre à chaque geste (Mouvement, Action du Test) reste au geste.
 */
import type { GameState, BattleState } from './store';
import type { Combatant } from '../engine/types';
import type { Pt } from './path';
import type { MsgKey } from '../i18n';
import type { CapaciteArete } from './aretes';
import { mouvementDeLaChute, type RefusFranchissement } from './fallMove';
import { sceneMetresPerTile, type Scene } from './scene';
import { garanti, inBattleId, meneurDeboutDuMonde } from './combatants';
import { mobileDuTour, type RefusDuTour } from './combatFlow';
import { isMount, isRider, movementRemaining } from './mount';
import { findActionById } from '../data';

/** Les capacités d'arête qui DÉPLACENT le mobile — les trois gestes de ce prédicat. */
export const GESTES_DEPLACANTS = ['escalade', 'chute', 'fenetre'] as const satisfies readonly CapaciteArete[];
export type GesteDeplacant = (typeof GESTES_DEPLACANTS)[number];

export type RefusGeste = { refus: MsgKey; vars: Record<string, string | number> };
export type VerdictGeste = { mobile: Combatant; case: Pt } | RefusGeste;
/** Geste accordé : le mobile, sa case, et le monde où il se joue — `battle` nul hors combat. */
export type GesteOuvert = { mobile: Combatant; case: Pt; scene: Scene; battle: BattleState | null };

const REFUS_DU_TOUR: Readonly<Record<RefusDuTour, MsgKey>> = {
  'combat-over': 'geste.refus.combatTermine',
  targeting: 'geste.refus.ciblage',
  'no-active': 'geste.refus.aucunActif',
  'not-controlled': 'geste.refus.pasLaMain',
  engaged: 'geste.refus.engage',
  'movement-spent': 'geste.refus.mouvementEpuise',
};

/** LDB 14 l.179 ; CRB 032 l.53 ; #2205. */
const REFUS_MONTE: MsgKey = 'geste.refus.monte';

const refus = (cle: MsgKey, vars: Record<string, string | number> = {}): RefusGeste => ({ refus: cle, vars });

/** Libellé de l'action « Descendre » (`actions.json`, id `dismount`) — l'issue que le refus monté nomme. */
const libelleDescendre = (): string => garanti(findActionById('dismount'), 'dismount', 'action').label;

/** Ce que dit un plan de franchissement refusé (`fallMove.ts:RefusFranchissement`). */
export const REFUS_FRANCHISSEMENT: Readonly<Record<RefusFranchissement, MsgKey>> = {
  'non-adjacente': 'franchir.refus.nonAdjacente',
  'aucune-surface': 'franchir.refus.aucuneSurface',
  muree: 'franchir.refus.muree',
  escalade: 'franchir.refus.escalade',
  marche: 'franchir.refus.marche',
};

/** Exploration : le meneur DEBOUT, sur `partyPos`, hors dialogue — porteur de tout geste d'exploration
 *  du groupe (gestes d'arête, `fouillerLaPiece`). */
export function porteurDExploration(s: GameState): VerdictGeste {
  if (s.dialogue) return refus('geste.refus.dialogue');
  const meneur = meneurDeboutDuMonde(s);
  if (!meneur) return refus('geste.refus.personne');
  return { mobile: meneur, case: s.partyPos };
}

/** Combat : le préfixe de tout déplacement (`mobileDuTour`), ses refus nommés. */
function porteurDeCombat(s: GameState, battle: BattleState): VerdictGeste {
  const tour = mobileDuTour(s, battle);
  if (!('refus' in tour)) return tour;
  if (!tour.mobile) return refus(REFUS_DU_TOUR[tour.refus]);
  const vars = { name: tour.mobile.label };
  // `canMove` refuse deux cas : Mouvement épuisé, ou Mouvement → Action → Mouvement (`mount.ts:canMove`).
  if (tour.refus === 'movement-spent' && movementRemaining(battle, tour.mobile) > 0) {
    return refus('geste.refus.mouvementEntrelace', vars);
  }
  return refus(REFUS_DU_TOUR[tour.refus], vars);
}

export function gesteDArete(s: GameState): GesteOuvert | RefusGeste {
  const { scene } = s;
  if (!scene) return refus('geste.refus.aucuneScene');
  const battle = s.mode === 'battle' ? s.battle : null;
  const v = s.mode === 'exploration'
    ? porteurDExploration(s)
    : battle ? porteurDeCombat(s, battle) : refus('geste.refus.horsJeu');
  if ('refus' in v) return v;
  if (isRider(v.mobile) || isMount(v.mobile)) return refus(REFUS_MONTE, { action: libelleDescendre() });
  return { ...v, scene, battle };
}

/** Le geste part-il de la case du mobile ? (#2190 : un `from` falsifié téléportait l'actif.) */
export function gesteDepuis(s: GameState, from: Pt): GesteOuvert | RefusGeste {
  const v = gesteDArete(s);
  if ('refus' in v) return v;
  const c = v.case;
  if (c.x !== from.x || c.y !== from.y || (c.z ?? 0) !== (from.z ?? 0)) {
    return refus('geste.refus.caseDuMobile', { name: v.mobile.label });
  }
  return v;
}

/** Le Test de chute tenté consomme l'Action (LDB 13 l.86-88) : refusé quand elle est déjà prise.
 *  `tombantId` = la rangée qui déclare. Lu par « Tenter » (`fallChoose`) et par son option dans la
 *  modale (`ui/FallModal.tsx`). */
export function refusDuTestDeChute(s: GameState, tombantId: string): RefusGeste | null {
  const b = s.mode === 'battle' ? s.battle : null;
  if (!b?.acted) return null;
  return refus('fall.actionDejaPrise', { name: garanti(inBattleId(b, tombantId), tombantId, 'sauteur').label });
}

/** Se suspendre d'abord coûte, en combat, le Mouvement de `mouvementDeLaChute` : refusé quand le
 *  Mouvement restant ne le couvre pas. Lu par la déclaration (`fallChoose`) et par son option dans la
 *  modale (`ui/FallModal.tsx`). */
export function refusDeLaSuspension(s: GameState, tombantId: string): RefusGeste | null {
  const b = s.mode === 'battle' ? s.battle : null;
  if (!b || !s.pendingFall || !s.scene) return null;
  const c = garanti(inBattleId(b, tombantId), tombantId, 'sauteur');
  const cout = mouvementDeLaChute(s.pendingFall, true, sceneMetresPerTile(s.scene));
  return movementRemaining(b, c) < cout ? refus('fall.suspension.mouvementInsuffisant', { name: c.label, cout }) : null;
}

/** Le mobile peut-il accomplir un geste déplaçant MAINTENANT ? (sélecteur de store, valeur primitive). */
export function gestesDeplacantsOuverts(s: GameState): boolean {
  return !('refus' in gesteDArete(s));
}
