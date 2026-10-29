/**
 * Ignorance de PA — mécanisme GÉNÉRAL et réutilisable (armes enchantées en mêlée, Projectiles
 * magiques, attributs de Domaine, qualités…). Un même descripteur `ArmourBypass` exprime tous les
 * cas RAW : ignorer N points, tout, seulement le métal (Chamon/Azyr), seulement le cuir (Ghur),
 * tout le non-magique (Ulgu), ou tout le non-métallique (Perforante, LDB 62 l.270). `bypassedAP`
 * calcule combien de PA sont ignorés à une Localisation.
 *
 * Point de lecture unique : `engine/combat` (mêlée, `woundsFromHit`), `engine/magic` (Projectile,
 * via `domainMissileMods`) et tout futur consommateur appellent `bypassedAP` — pas de logique d'AP
 * dupliquée ailleurs.
 */
import type { Combatant, HitLocation, ArmourBypass, ItemInstance } from './types';
import { findWeaponGroupById } from '../data';
export type { ArmourBypass };

/** PA effectifs d'une pièce d'armure portée (usure déduite). */
const piecePA = (i: NonNullable<Combatant['items']>[number]): number => Math.max(0, (i.pa ?? 0) - (i.damageTaken ?? 0));

/** Matériau TYPÉ d'une pièce d'armure, dérivé de son Groupe (`subType` → `WeaponGroupData.material`) —
 *  SOURCE UNIQUE, jamais une devinette par regex sur le nom. `undefined` = armure naturelle/synthétique. */
export function armourMaterialOf(item: ItemInstance): 'metal' | 'leather' | 'chaos' | undefined {
  const groupe = findWeaponGroupById(item.subType);
  return groupe?.kind === 'armour' ? groupe.material : undefined;
}

/** Somme des PA des pièces portées à `loc` retenues par `pred` sur leur matériau TYPÉ (`undefined` exclu —
 *  armure naturelle/synthétique, hors périmètre de ces lecteurs). */
function typedAPAt(c: Combatant, loc: HitLocation, pred: (m: 'metal' | 'leather' | 'chaos') => boolean): number {
  return (c.items ?? [])
    .filter((i) => i.equipped && i.kind === 'armor' && i.locs?.includes(loc))
    .filter((i) => { const m = armourMaterialOf(i); return m !== undefined && pred(m); })
    .reduce((s, i) => s + piecePA(i), 0);
}

/** Somme des PA des pièces portées à `loc` du `material` typé donné. */
function materialAPAt(c: Combatant, loc: HitLocation, material: 'metal' | 'leather'): number {
  return typedAPAt(c, loc, (m) => m === material);
}

/** PA des armures MÉTALLIQUES portées à `loc`. */
export const metalAPAt = (c: Combatant, loc: HitLocation): number => materialAPAt(c, loc, 'metal');

/** PA des armures de CUIR portées à `loc`. */
export const leatherAPAt = (c: Combatant, loc: HitLocation): number => materialAPAt(c, loc, 'leather');

/** PA des pièces PORTÉES et TYPÉES dont le matériau n'est pas du métal, à `loc`. */
export const nonMetalTypedAPAt = (c: Combatant, loc: HitLocation): number => typedAPAt(c, loc, (m) => m !== 'metal');

/** PA MAGIQUES (effets actifs `apAll` — Armure Aethyrique) : seuls épargnés par Ulgu. Plancher 0 — un
 *  `apAll` NÉGATIF (op `ap` de retrait, VDM 05) ronge l'armure PORTÉE, il ne crée pas un bonus d'Ulgu. */
export const magicAPOf = (c: Combatant): number => Math.max(0, (c.activeEffects ?? []).reduce((s, e) => s + (e.apAll ?? 0), 0));

/** Points de PA IGNORÉS par `bypass` à la Localisation `loc`, bornés à `totalAP` (jamais négatif). */
export function bypassedAP(target: Combatant, loc: HitLocation, bypass: ArmourBypass | undefined, totalAP: number): number {
  if (!bypass || totalAP <= 0) return 0;
  if (bypass === 'all') return totalAP;
  if (typeof bypass === 'number') return Math.min(totalAP, Math.max(0, bypass));
  if (bypass === 'metal') return Math.min(totalAP, metalAPAt(target, loc));
  if (bypass === 'leather') return Math.min(totalAP, leatherAPAt(target, loc));
  if (bypass === 'nonMagic') return Math.max(0, totalAP - magicAPOf(target));
  // Perforante — LDB 62 l.270. Les PA au matériau INCONNU (armure naturelle, statbloc, PA de sort)
  // ne sont PAS ignorés par ce bypass : nature de ces PA hors périmètre, chantier #1255.
  if (bypass === 'nonMetal') return Math.min(totalAP, nonMetalTypedAPAt(target, loc));
  return 0;
}
