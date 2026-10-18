import type { ItemInstance, WeaponDamageSpec } from './types';

/** Coût de réparation d'une armure, en sous de cuivre (PA). RAW LDB 63 « Réparer Une Armure » l.64 :
 *  10 % du prix de base PAR PA perdu ; 30 % du prix de base si la pièce est complètement brisée (PA nette < 0, LDB 63 l.21). */
export function repairCostBrass(item: Pick<ItemInstance, 'pa' | 'damageTaken'>, basePriceBrass: number): number {
  const lost = item.damageTaken ?? 0;
  if (lost <= 0) return 0;
  const broken = (item.pa ?? 0) - lost < 0;
  return Math.round(basePriceBrass * (broken ? 0.30 : 0.10 * lost));
}

/** Une arme est-elle réduite à l'état improvisé (Dégâts fixes tombés à +0 par usure) — LDB 62 l.135 :
 *  « Les armes réduites à l'état d'Armes improvisées ne peuvent pas être réparées. » Miroir de
 *  `weaponDamage.isImprovised` sur la donnée d'inventaire (`ItemInstance.damage`, non résolue). */
function weaponImprovised(dmg: WeaponDamageSpec | undefined, damageTaken: number): boolean {
  if (!dmg || !('flat' in dmg)) return false; // « Spécial » (literal) : jamais improvisé
  return dmg.flat >= 0 && dmg.flat - damageTaken <= 0;
}

/** Coût de réparation d'une ARME, en sous de cuivre. RAW LDB 62 « Dégâts d'Arme » l.135 : « Les armes
 *  peuvent être réparées par des artisans appropriés pour 10 % du coût de l'arme par point de Dégâts
 *  subi. » Une arme réduite à l'état improvisé est IRRÉPARABLE → 0 (cf. `isRepairable`). */
export function repairWeaponCostBrass(item: Pick<ItemInstance, 'damage' | 'damageTaken'>, basePriceBrass: number): number {
  const lost = item.damageTaken ?? 0;
  if (lost <= 0 || weaponImprovised(item.damage, lost)) return 0;
  return Math.round(basePriceBrass * 0.10 * lost);
}

/** Un objet endommagé est-il réparable par un artisan ? Armure : toujours (une pièce brisée se répare à
 *  30 %). Arme : sauf réduite à l'état improvisé (LDB 62 l.135). Non endommagé → false (rien à réparer). */
export function isRepairable(item: Pick<ItemInstance, 'kind' | 'damage' | 'damageTaken'>): boolean {
  const lost = item.damageTaken ?? 0;
  if (lost <= 0) return false;
  if (item.kind === 'melee' || item.kind === 'ranged') return !weaponImprovised(item.damage, lost);
  return item.kind === 'armor';
}

/** Coût de réparation UNIFIÉ (armure ou arme), en sous de cuivre — dispatch par `kind`. SOURCE UNIQUE
 *  du prix de réparation (armures LDB 63 l.64 · armes LDB 62 l.135), partagée par le marchand et l'UI. */
export function itemRepairCostBrass(item: Pick<ItemInstance, 'kind' | 'pa' | 'damage' | 'damageTaken'>, basePriceBrass: number): number {
  return item.kind === 'melee' || item.kind === 'ranged'
    ? repairWeaponCostBrass(item, basePriceBrass)
    : repairCostBrass(item, basePriceBrass);
}
