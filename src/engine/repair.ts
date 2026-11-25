import type { ItemInstance } from './types';
import { isImprovised } from './weaponDamage';
import { objetAuProfilEffectif } from './items';

type ObjetAReparer = Pick<ItemInstance, 'kind' | 'pa' | 'trappingId' | 'damage' | 'damageTaken' | 'usure' | 'qualities'>;
type ArmeAReparer = Pick<ItemInstance, 'trappingId' | 'damage' | 'damageTaken' | 'qualities'>;

/** Dégâts subis par l'objet : PA perdus sur tous ses Emplacements pour une armure (LDB 63 l.64), Dégâts d'arme
 *  sinon (LDB 62 l.135). */
export function degatsSubis(item: Pick<ItemInstance, 'kind' | 'damageTaken' | 'usure'>): number {
  if (item.kind !== 'armor') return item.damageTaken ?? 0;
  return Object.values(item.usure ?? {}).reduce((n, v) => n + (v ?? 0), 0);
}

/** L'objet réparé : plus aucun Dégât. LDB 62 l.135 ; LDB 63 l.64 */
export function remettreEnEtat(item: ItemInstance): void {
  delete item.damageTaken;
  delete item.usure;
}

/** Coût de réparation d’une armure, en sous de cuivre. LDB 63 l.21, l.64 ; #4973 */
export function repairCostBrass(item: Pick<ItemInstance, 'pa' | 'usure'>, basePriceBrass: number): number {
  const lost = degatsSubis({ kind: 'armor', usure: item.usure });
  if (lost <= 0) return 0;
  const brisee = Object.values(item.usure ?? {}).some((v) => (item.pa ?? 0) - (v ?? 0) < 0);
  return Math.round(basePriceBrass * Math.max(brisee ? 0.30 : 0, 0.10 * lost));
}

/** LDB 62 l.135 */
function weaponImprovised(item: ArmeAReparer): boolean {
  const { damage, damageTaken, qualities } = objetAuProfilEffectif(item);
  return damage !== undefined && isImprovised({ damage, damageTaken, qualities });
}

/** Coût de réparation d'une ARME, en sous de cuivre. RAW LDB 62 « Dégâts d'Arme » l.135 : « Les armes
 *  peuvent être réparées par des artisans appropriés pour 10 % du coût de l'arme par point de Dégâts
 *  subi. » Une arme réduite à l'état improvisé est IRRÉPARABLE → 0 (cf. `isRepairable`). */
export function repairWeaponCostBrass(item: ArmeAReparer, basePriceBrass: number): number {
  const lost = item.damageTaken ?? 0;
  if (lost <= 0 || weaponImprovised(item)) return 0;
  return Math.round(basePriceBrass * 0.10 * lost);
}

/** Un objet endommagé est-il réparable par un artisan ? Armure : toujours (une pièce brisée se répare à
 *  30 %). Arme : sauf réduite à l'état improvisé (LDB 62 l.135). Non endommagé → false (rien à réparer). */
export function isRepairable(item: ObjetAReparer): boolean {
  if (degatsSubis(item) <= 0) return false;
  if (item.kind === 'melee' || item.kind === 'distance') return !weaponImprovised(item);
  return item.kind === 'armor';
}

/** Coût de réparation UNIFIÉ (armure ou arme), en sous de cuivre — dispatch par `kind`. SOURCE UNIQUE
 *  du prix de réparation (armures LDB 63 l.64 · armes LDB 62 l.135), partagée par le marchand et l'UI. */
export function itemRepairCostBrass(item: ObjetAReparer, basePriceBrass: number): number {
  return item.kind === 'melee' || item.kind === 'distance'
    ? repairWeaponCostBrass(item, basePriceBrass)
    : repairCostBrass(item, basePriceBrass);
}
