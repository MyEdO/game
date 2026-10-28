/**
 * Les OPTIONS du Désengagement (LDB 15 l.43-49), une par prédicat PUR. Chacune est la source unique que
 * lisent le gate `desengagement` (`noyau/actionRegistry.ts`), l'économie du tour (`noyau/turnEconomy.ts`)
 * et le flux (`startDisengage`, `noyau/combatFlow.ts`). Purs, ils ne lisent que l'acteur et son combat,
 * jamais le store ; ils importent du noyau `combat/advantagePool`, `monde/combatants`, `mount` et `refusDuTour`.
 */
import type { Combatant } from '../../engine/types';
import type { BattleState } from '../etat';
import { isOutOfAction } from '../../engine/conditions';
import { groupAdvantage } from '../../engine/advantagePool';
import { canDisengageWithLessAdvantage, retreatAdvantageCost } from '../../engine/combatFeatures/dispatch';
import { sizeGap } from '../../engine/size';
import { spendableAdvantage } from './advantagePool';
import { inBattleId } from '../monde/combatants';
import { canMove } from '../mount';
import { refusActionDepensee, refusHorsDEtatDAgir } from '../refusDuTour';

/** Le porteur et son combat. */
export interface CtxDeDesengagement {
  active: Combatant;
  battle: BattleState;
}

/** Les adversaires Engagés de l'acteur encore en jeu. */
export function adversairesEngages({ active, battle }: CtxDeDesengagement): Combatant[] {
  return (active.engagedWith ?? [])
    .map((id) => inBattleId(battle, id))
    .filter((c): c is Combatant => !!c && !isOutOfAction(c));
}

/** Départ libre : LDB 85 l.373-374 ; Nuée : LDB 85 l.253. */
export function departLibre(ctx: CtxDeDesengagement): boolean {
  const foes = adversairesEngages(ctx);
  return foes.length > 0 && (!!ctx.active.swarm || foes.every((f) => sizeGap(ctx.active.size, f.size) >= 1));
}

/** Voie de l'option « Utiliser l'Avantage » : LDB 15 l.47 ; Impitoyable LDB 10 l.591 ; Retraite stratégique
 *  AA 11 l.37, AA 13 l.74 (`retreatAdvantageCost`). `null` = option fermée. */
export type VoieDAvantage = 'retraite-strategique' | 'impitoyable' | 'avantage-superieur';
export function voieDAvantage(ctx: CtxDeDesengagement): VoieDAvantage | null {
  const foes = adversairesEngages(ctx);
  if (!foes.length) return null;
  const { active, battle } = ctx;
  if (groupAdvantage()) return spendableAdvantage(battle, active) >= retreatAdvantageCost(active) ? 'retraite-strategique' : null;
  if (canDisengageWithLessAdvantage(active)) return active.advantage > 0 ? 'impitoyable' : null;
  return active.advantage > Math.max(...foes.map((f) => f.advantage)) ? 'avantage-superieur' : null;
}

/** L'option « Utiliser l'Avantage » est-elle ouverte (`voieDAvantage`) ? N'exige pas l'Action. */
export function peutSacrifierLAvantage(ctx: CtxDeDesengagement): boolean {
  return voieDAvantage(ctx) !== null;
}

/** Option « Utiliser l'Esquive » : LDB 15 l.49 ; LDB 16 l.125. `null` = ouverte, sinon la raison. */
export function refusDEsquiveDeDesengagement({ active, battle }: CtxDeDesengagement): string | null {
  return refusActionDepensee(battle) ?? refusHorsDEtatDAgir(active);
}

/** La Fuite : LDB 15 l.61 ; LDB 16 l.125. Ouverte tant que `canMove`. */
export function peutFuir(ctx: CtxDeDesengagement): boolean {
  return adversairesEngages(ctx).length > 0 && canMove(ctx.battle, ctx.active);
}

/** Une option qui ne coûte pas l'Action reste-t-elle ouverte (Avantage, départ libre ou Fuite) ? */
export function desengagementSansAction(ctx: CtxDeDesengagement): boolean {
  return peutSacrifierLAvantage(ctx) || departLibre(ctx) || peutFuir(ctx);
}
