import type { ItemInstance, Weapon, WeaponRangeSpec, AmmoRangeMod, WeaponDamageSpec, Combatant } from '../engine/types';
import type { TriggeredEffect } from '../engine/flowCore';
import { damageString } from '../engine/items';
import { effectiveWeaponDamage, effectiveRange } from '../engine/weaponDamage';
import { improvisedProfile } from '../engine/weaponDamage';
import { resolveQualities, type QualityCarrier } from '../engine/qualities/dispatch';
import { siegeMultiplier } from '../engine/structures';

/**
 * Parts d'affichage CANONIQUES des stats MÉCANIQUES d'une arme (hors qualités, gérées par l'appelant) :
 * « Dégâts <spec> (<total>) » puis l'Allonge de mêlée OU la Portée de tir (mutuellement exclusives —
 * LDB 62 : Allonge = mêlée, Portée = distance en mètres). SOURCE UNIQUE consommée par le Sac
 * (`CharacterSheet`), l'encart « En main » et le popover d'arme (`EquipmentPanel`) — fin des trois copies
 * dont deux affichaient « [object Object] » (un `WeaponDamageSpec` / `reach` brut non routé par `damageString`).
 * Marche pour un `ItemInstance` (Sac/popover) comme pour un `Weapon` dérivé (armes EN MAIN). `force` = BF
 * du porteur (`forceDuPorteur`), injecté dans les Dégâts résolus ET la Portée (arme de jet `{bf}` → BF×N) ;
 * « Spécial » → total 0.
 */
export function weaponStatParts(it: ItemInstance | Weapon, force: { bf: number; passif: number }): string[] {
  const parts: string[] = [];
  if (it.damage) parts.push(`Dégâts ${damageString(it.damage)} (${effectiveWeaponDamage(it as Weapon, force)})`);
  const rangeM = effectiveRange(it.range, force.bf); // SPEC → mètres (BF×N pour une arme de jet)
  if (rangeM != null) parts.push(`Portée ${rangeM} m`);
  else if (it.reach) parts.push(`Allonge ${it.reach}`);
  const note = conditionalDamageNote(it as QualityCarrier & { damage?: WeaponDamageSpec | null; onHitEffects?: TriggeredEffect[] });
  if (note) parts.push(note);
  return parts;
}

/** Repli d'**Arme improvisée** (LDB 62 l.31, `+BF+1`) — dérivé une fois via `improvisedProfile` (résultat
 *  constant, indépendant de l'entrée) plutôt que retypé en littéral : SOURCE UNIQUE avec l'usure/la Lance
 *  hors Charge/le Bélier hors-porte (`engine/weaponDamage`). */
const IMPROVISED_DAMAGE: WeaponDamageSpec = improvisedProfile({ label: '', type: 'melee', damage: { plusBF: false, flat: 0 }, qualities: [] }).damage;

/** Cible SYNTHÉTIQUE « structure » — `siegeMultiplier` ne lit que `bodyShape` (`isStructure`) ; aucune
 *  structure réelle n'existe à l'affichage d'une fiche catalogue (Codex/popover), hors combat. */
const SIEGE_TARGET = { bodyShape: 'structure' } as Combatant;

/**
 * Note de DÉGÂTS CONDITIONNELS d'une arme/pièce dont le champ `damage` imprimé n'est PAS la vérité
 * inconditionnelle (#135 — le Codex affichait le statbloc brut pour des armes dont les dégâts RÉELS
 * dépendent de la cible/du contexte) :
 *  - **Bélier** (cap `ram`, ADE II 8 l.249) : ne frappe QUE les portes — Arme improvisée sinon.
 *  - **Siège** (cap `siege`, ADE II 8 l.292) : double les dégâts contre une STRUCTURE.
 * DATA-DRIVEN : capacités lues via `resolveQualities`/`siegeMultiplier` — les MÊMES fonctions que consomme
 * `engine/structures` en combat, zéro id d'arme en dur (toute future qualité à capacité `ram`/`siege` est
 * couverte sans code supplémentaire). Sans dégâts imprimés (`damage` absent) mais un effet À LA TOUCHE
 * déclenché (`onHitEffects`) dont on ne peut pas dériver de formule : badge générique. `null` = dégâts
 * imprimés déjà fidèles (rien à ajouter).
 */
export function conditionalDamageNote(w: QualityCarrier & { damage?: WeaponDamageSpec | null; onHitEffects?: TriggeredEffect[] }): string | null {
  const notes: string[] = [];
  if (resolveQualities(w).some((r) => r.caps?.ram)) notes.push(`contre une porte uniquement — sinon Arme improvisée (${damageString(IMPROVISED_DAMAGE)})`);
  const siegeMult = siegeMultiplier({ qualities: w.qualities } as Weapon, SIEGE_TARGET);
  if (siegeMult > 1) notes.push(`×${siegeMult} contre une structure`);
  if (notes.length) return notes.join(' · ');
  if (!w.damage && w.onHitEffects?.length) return 'Dégâts conditionnels — voir Effets';
  return null;
}

/** Libellé d'AFFICHAGE d'une Portée NON résolue (catalogue : Codex/Marchand/Création, sans BF de porteur) :
 *  « 50 m » (mètres fixes) ou « BF×3 m » (formule de jet). null → pas de Portée. Pour les vues qui ne
 *  connaissent pas le porteur ; aux vues qui le connaissent (combat/fiche), résoudre via `effectiveRange`. */
export function rangeSpecLabel(range: WeaponRangeSpec | null | undefined): string | null {
  if (range == null) return null;
  return typeof range === 'number' ? `${range} m` : `BF×${range.bf} m`;
}

/** Libellé d'AFFICHAGE du modificateur de Portée d'une MUNITION : `{mult}` → « ×½ »/« ×¼ »/« ×k » (fraction
 *  de la Portée de l'arme) ; `{add}` → « +50 m »/« -10 m » (mètres ±). null → pas de modificateur. */
export function ammoRangeModLabel(mod: AmmoRangeMod | null | undefined): string | null {
  if (mod == null) return null;
  if ('mult' in mod) {
    const frac: Record<number, string> = { 0.25: '¼', 0.5: '½', 0.75: '¾' };
    return `×${frac[mod.mult] ?? mod.mult}`;
  }
  return `${mod.add >= 0 ? '+' : ''}${mod.add} m`;
}
