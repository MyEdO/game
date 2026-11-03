/**
 * Ignorance de PA — mécanisme GÉNÉRAL et réutilisable (armes enchantées en mêlée, Projectiles
 * magiques, attributs de Domaine, qualités…). Un même descripteur `ArmourBypass` exprime tous les
 * cas RAW : ignorer N points, tout, seulement le métal (Chamon/Azyr), tout le non-magique (Ulgu), ou
 * tout le non-métallique (Perforante, LDB 62 l.270). `bypassedAP` calcule combien de PA sont ignorés à
 * une Localisation.
 *
 * Point de lecture unique : `engine/combat` (mêlée, `woundsFromHit`), `engine/magic` (Projectile,
 * via `domainMissileMods`) et tout futur consommateur appellent `bypassedAP` — pas de logique d'AP
 * dupliquée ailleurs. Les PA d'une Localisation et leur matière se lisent par `sourcesDArmureA` : pièces
 * portées et Trait Armure.
 */
import type { Combatant, HitLocation, ArmourBypass } from './types';
import type { TraitInstance } from './statEntry';
import type { MatiereDArmure } from '../data/schemas/grammaire/valeurs';
import { findTraitById, matiereDuGroupe } from '../data';
import { paNette, piecesPorteesA } from './items';
export type { ArmourBypass };

/** Le Trait Armure de `traits` : celui dont la def déclare l'Indice par Localisation. LDB 85 l.37-39 */
export const armureDuTrait = (traits: readonly TraitInstance[] | undefined): TraitInstance | undefined =>
  traits?.find((t) => findTraitById(t.id)?.parLocalisation);

/** Une source de PA à une Localisation : ses PA, sa matière (`undefined` : inconnue), et si elle est une armure
 *  PORTÉE au sens de LDB 46 l.150 (une pièce ; le Trait d'une matière d'armure, hors `peau`). */
export interface SourceDArmure { pa: number; matiere: MatiereDArmure | undefined; portee: boolean }

/** Les sources de PA à `loc` : chaque pièce d'armure portée, et le Trait Armure. LDB 63 l.13 ; LDB 85 l.39 ;
 *  #1463 */
export function sourcesDArmureA(c: Combatant, loc: HitLocation): SourceDArmure[] {
  const pieces = piecesPorteesA(c, loc).map((i): SourceDArmure => ({ pa: paNette(i), matiere: matiereDuGroupe(i.subType), portee: true }));
  const trait = sourceDuTraitA(c, loc);
  return trait ? [...pieces, trait] : pieces;
}

/** La source du Trait Armure à `loc`. LDB 85 l.39 ; #1463 */
export function sourceDuTraitA(c: Combatant, loc: HitLocation): SourceDArmure | undefined {
  const trait = armureDuTrait(c.traits);
  if (!trait) return undefined;
  const pa = trait.parLocalisation ? trait.parLocalisation[loc] : (trait.value ?? 0);
  return { pa, matiere: trait.matiere, portee: trait.matiere !== undefined && trait.matiere !== 'peau' };
}

/** Somme des PA à `loc` dont la matière CONNUE satisfait `pred` ; une matière inconnue n'est retenue par aucun
 *  lecteur. */
function typedAPAt(c: Combatant, loc: HitLocation, pred: (m: MatiereDArmure) => boolean): number {
  return sourcesDArmureA(c, loc)
    .filter((s) => s.matiere !== undefined && pred(s.matiere))
    .reduce((n, s) => n + s.pa, 0);
}

/** PA MÉTALLIQUES à `loc`. */
export const metalAPAt = (c: Combatant, loc: HitLocation): number => typedAPAt(c, loc, (m) => m === 'metal');

/** PA de matière connue autre que le métal, à `loc`. */
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
  if (bypass === 'nonMagic') return Math.max(0, totalAP - magicAPOf(target));
  // LDB 62 l.270
  if (bypass === 'nonMetal') return Math.min(totalAP, nonMetalTypedAPAt(target, loc));
  return 0;
}
