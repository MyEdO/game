/**
 * Les REFUS ÉLÉMENTAIRES du tour, purs : chacun rend `null` (ouvert) ou sa raison. Les gates du registre
 * (`actionRegistry.ts`) et les verdicts de geste (`refusDeCourse`, `combat/desengagement.ts`) les composent :
 * chaque condition n'a qu'un site. Purs, ils ne lisent que l'acteur, son combat et sa scène ; imports du noyau :
 * `mount.ts` (`mountMovement`), `combat/surnombre.ts` (`bouclierDuBinome`).
 */
import type { Combatant } from '../engine/types';
import type { BattleState } from './etat';
import type { Scene } from './monde/scene';
import { canTakeAction, conditionGating, isActionLocked } from '../engine/conditions';
import { hasNoRun } from '../engine/traits/dispatch';
import { bouclierDuBinome } from './combat/surnombre';
import { isVehicle } from '../engine/coque';
import { isEngaged } from '../engine/engagement';
import { prayerForActionBy } from '../engine/magic';
import { mountMovement } from './mount';
import { t } from '../i18n';
import { nomDe } from '../engine/nom';

/** L'Action du Tour est dépensée. */
export function refusActionDepensee(battle: Pick<BattleState, 'acted'>): string | null {
  return battle.acted ? t('agate.actionSpent') : null;
}

/** Le set d'armes a déjà changé ce Tour (plafond MAISON de 1×/tour, `panoplie`, `actions.json`). */
export function refusSetDejaChange(battle: Pick<BattleState, 'loadoutSwapped'>): string | null {
  return battle.loadoutSwapped ? t('agate.loadoutSwapped') : null;
}

/** Le porteur ne peut pas effectuer d'Action (`canTakeAction`, LDB 16 l.125). */
export function refusHorsDEtatDAgir(c: Combatant): string | null {
  return canTakeAction(c) ? null : t('agate.unableToAct');
}

/** Le porteur doit effectuer des Tests de Prière pour son Action (`prayerForActionBy`) : un geste qui
 *  coûte l'Action sans être une Prière est refusé. LDB 40 l.74 */
export function refusPriereImposee(c: Combatant): string | null {
  const source = prayerForActionBy(c);
  return source ? t('agate.prayerForAction', { name: nomDe(c), source }) : null;
}

/** Une coque n'a pas de corps de fantassin (`engine/vehicle.ts`). */
export function refusCoque(c: Combatant): string | null {
  return isVehicle(c) ? t('agate.hullHasNoBody') : null;
}

/** Le porteur est déjà Engagé (LDB 15 l.43-49). */
export function refusEngage(roster: readonly Combatant[], c: Combatant): string | null {
  return isEngaged(c, roster) ? t('agate.alreadyEngaged') : null;
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

/** Un trait interdit la Course (`hasNoRun`, Rampant : MSRC 15 l.171). */
export function refusSansCourse(c: Combatant): string | null {
  return hasNoRun(c.traits) ? t('agate.cannotRun') : null;
}

/** Le porteur est en binôme au bouclier (`bouclierDuBinome`) : ni Course ni Fuite volontaires, sauf fuite forcée par un
 *  État (`isActionLocked`, LDB 16 l.52). ZI 13 l.193 ; #4202 */
export function refusDuBinome(scene: Scene | null, battle: Pick<BattleState, 'combatants'>, c: Combatant): string | null {
  const bouclier = bouclierDuBinome(scene, battle.combatants, c);
  if (!bouclier || isActionLocked(c)) return null;
  return t(c.weapons.includes(bouclier) ? 'agate.binomeTientLeBouclier' : 'agate.binomeCouvert', { bouclier: bouclier.label });
}

/** Ce que la Course exige du PORTEUR (LDB 15 l.41 ; Brisé : LDB 16 l.52), hors de l'économie du Tour. */
function refusDeCourseDuPorteur(roster: readonly Combatant[], c: Combatant): string | null {
  return refusCoque(c) ?? refusHorsDEtatDAgir(c) ?? refusPriereImposee(c) ?? refusEngage(roster, c) ?? refusRampe(c) ?? refusSansCourse(c);
}

/** Verdict de la Course (LDB 15 l.41), lu par le gate `course-possible`, `ouvrirLaCourse` et `computeRunReach`. */
export function refusDeCourse(scene: Scene | null, battle: BattleState, c: Combatant): string | null {
  return refusActionDepensee(battle) ?? refusDeCourseDuPorteur(battle.combatants, c) ?? refusDuBinome(scene, battle, c) ?? refusSansMouvement(battle, c);
}

/** Verdict de la Charge (LDB 15 l.35-37), lu par le gate `charge-possible`, `computeChargeReach` et `attackPlan`. */
export function refusDeCharge(battle: BattleState, c: Combatant): string | null {
  return refusEngage(battle.combatants, c) ?? refusRampe(c) ?? refusHorsDEtatDAgir(c) ?? refusPriereImposee(c) ?? refusSansMouvement(battle, c) ?? refusMouvementEntame(battle);
}

/** Les budgets d'allure `budgets` que la porte du joueur laisse à `c` : la Charge et la Course, `null` quand elle les
 *  refuse (`refusDeCharge`, `refusDeCourse`). LDB 15 l.35-41 */
export function budgetsDAllure(scene: Scene | null, battle: BattleState, c: Combatant, budgets: { charge: number; course: number }): { charge: number | null; course: number | null } {
  return { charge: refusDeCharge(battle, c) ? null : budgets.charge, course: refusDeCourse(scene, battle, c) ? null : budgets.course };
}
