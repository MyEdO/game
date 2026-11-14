import type { ItemInstance } from './types';
import { isImprovised } from './weaponDamage';

/** Coût de réparation d'une armure, en sous de cuivre (PA). RAW LDB 63 « Réparer Une Armure » l.64 :
 *  10 % du prix de base PAR PA perdu ; 30 % du prix de base si la pièce est complètement brisée (PA nette < 0, LDB 63 l.21). */
export function repairCostBrass(item: Pick<ItemInstance, 'pa' | 'damageTaken'>, basePriceBrass: number): number {
  const lost = item.damageTaken ?? 0;
  if (lost <= 0) return 0;
  const broken = (item.pa ?? 0) - lost < 0;
  return Math.round(basePriceBrass * (broken ? 0.30 : 0.10 * lost));
}

/** LDB 62 l.135 : arme réduite à l'état improvisé, irréparable (`isImprovised`, Solide compris). */
function weaponImprovised(item: Pick<ItemInstance, 'damage' | 'damageTaken' | 'qualities'>): boolean {
  return !!item.damage && isImprovised({ damage: item.damage, damageTaken: item.damageTaken, qualities: item.qualities });
}

/** Coût de réparation d'une ARME, en sous de cuivre. RAW LDB 62 « Dégâts d'Arme » l.135 : « Les armes
 *  peuvent être réparées par des artisans appropriés pour 10 % du coût de l'arme par point de Dégâts
 *  subi. » Une arme réduite à l'état improvisé est IRRÉPARABLE → 0 (cf. `isRepairable`). */
export function repairWeaponCostBrass(item: Pick<ItemInstance, 'damage' | 'damageTaken' | 'qualities'>, basePriceBrass: number): number {
  const lost = item.damageTaken ?? 0;
  if (lost <= 0 || weaponImprovised(item)) return 0;
  return Math.round(basePriceBrass * 0.10 * lost);
}

/** Un objet endommagé est-il réparable par un artisan ? Armure : toujours (une pièce brisée se répare à
 *  30 %). Arme : sauf réduite à l'état improvisé (LDB 62 l.135). Non endommagé → false (rien à réparer). */
export function isRepairable(item: Pick<ItemInstance, 'kind' | 'damage' | 'damageTaken' | 'qualities'>): boolean {
  const lost = item.damageTaken ?? 0;
  if (lost <= 0) return false;
  if (item.kind === 'melee' || item.kind === 'distance') return !weaponImprovised(item);
  return item.kind === 'armor';
}

/** Coût de réparation UNIFIÉ (armure ou arme), en sous de cuivre — dispatch par `kind`. SOURCE UNIQUE
 *  du prix de réparation (armures LDB 63 l.64 · armes LDB 62 l.135), partagée par le marchand et l'UI. */
export function itemRepairCostBrass(item: Pick<ItemInstance, 'kind' | 'pa' | 'damage' | 'damageTaken' | 'qualities'>, basePriceBrass: number): number {
  return item.kind === 'melee' || item.kind === 'distance'
    ? repairWeaponCostBrass(item, basePriceBrass)
    : repairCostBrass(item, basePriceBrass);
}
