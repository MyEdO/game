/**
 * Les REFUS ÉLÉMENTAIRES du tour, purs : chacun rend `null` (ouvert) ou sa raison. Les gates du registre
 * (`actionRegistry.ts`) et les verdicts de geste (`refusDeCourse`, `combat/desengagement.ts`) les composent :
 * chaque condition n'a qu'un site. Purs, ils ne lisent que l'acteur et son combat ; seul import du noyau :
 * `mount.ts` (`mountMovement`).
 */
import type { Combatant } from '../engine/types';
import type { BattleState } from './etat';
import { canTakeAction, conditionGating } from '../engine/conditions';
import { isVehicle } from '../engine/coque';
import { isEngaged } from '../engine/engagement';
import { mountMovement } from './mount';
import { t } from '../i18n';

/** L'Action du Tour est dépensée. */
export function refusActionDepensee(battle: Pick<BattleState, 'acted'>): string | null {
  return battle.acted ? t('agate.actionSpent') : null;
}

/** Le porteur ne peut pas effectuer d'Action (`canTakeAction`, LDB 16 l.125). */
export function refusHorsDEtatDAgir(c: Combatant): string | null {
  return canTakeAction(c) ? null : t('agate.unableToAct');
}

/** Une coque n'a pas de corps de fantassin (`engine/vehicle.ts`). */
export function refusCoque(c: Combatant): string | null {
  return isVehicle(c) ? t('agate.hullHasNoBody') : null;
}

/** Le porteur est déjà Engagé (LDB 15 l.43-49). */
export function refusEngage(c: Combatant): string | null {
  return isEngaged(c) ? t('agate.alreadyEngaged') : null;
}

/** Aucun Mouvement à dépenser ce Tour (`mountMovement`, celui de la monture si cavalier). */
export function refusSansMouvement(battle: BattleState, c: Combatant): string | null {
  return mountMovement(battle, c) <= 0 ? t('agate.cannotMove') : null;
}

/** Le Mouvement du Tour est déjà entamé. */
export function refusMouvementEntame(battle: Pick<BattleState, 'movementUsed'>): string | null {
  return (battle.movementUsed ?? 0) > 0 ? t('agate.movementStarted') : null;
}

/** Un statut ne laisse que ramper (`gating.movement: 'crawl'`, LDB 16 l.35). */
export function refusRampe(c: Combatant): string | null {
  return conditionGating(c).movement === 'crawl' ? t('agate.prone') : null;
}

/** Ce que la Course exige du PORTEUR (LDB 15 l.41 ; Brisé : LDB 16 l.52), hors de l'économie du Tour : lu tel quel
 *  par le plan d'approche de l'IA (`aiApproachPlan`), qui décide avant d'avoir agi. */
export function refusDeCourseDuPorteur(c: Combatant): string | null {
  return refusCoque(c) ?? refusHorsDEtatDAgir(c) ?? refusEngage(c) ?? refusRampe(c);
}

/** Verdict de la Course (LDB 15 l.41), lu par le gate `course-possible`, `battleRun` et `computeRunReach`. */
export function refusDeCourse(battle: BattleState, c: Combatant): string | null {
  return refusActionDepensee(battle) ?? refusDeCourseDuPorteur(c) ?? refusSansMouvement(battle, c);
}

/** Verdict de la Charge (LDB 15 l.35-37), lu par le gate `charge-possible`, `computeChargeReach` et `attackPlan`. */
export function refusDeCharge(battle: BattleState, c: Combatant): string | null {
  return refusEngage(c) ?? refusRampe(c) ?? refusHorsDEtatDAgir(c) ?? refusSansMouvement(battle, c) ?? refusMouvementEntame(battle);
}
