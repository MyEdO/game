import type { ItemInstance, Weapon, WeaponRangeSpec, AmmoRangeMod, WeaponDamageSpec, Combatant, ReachValue } from './types';
import type { TriggeredEffect } from './flowCore';
import { damageString } from './items';
import { effectiveWeaponDamage, effectiveRange } from './weaponDamage';
import { improvisedProfile } from './weaponDamage';
import { resolveQualities, type QualityCarrier } from './qualities/dispatch';
import { siegeMultiplier } from './structures';
import { t } from '../i18n';

/** Les Dégâts d'une arme dont le champ `damage` imprimé n'est pas la vérité inconditionnelle (#135) : `belier` (cap
 *  `ram`, ADE II 8 l.249, `repli`) ; `siege` (cap `siege`, ADE II 8 l.292, `mult`) ; `aLaTouche` (`onHitEffects` sans
 *  `damage`). */
export type DegatsConditionnels = { genre: 'belier'; repli: WeaponDamageSpec } | { genre: 'siege'; mult: number } | { genre: 'aLaTouche' };

/** Le profil mécanique d'une arme pour son porteur (hors Atouts et Défauts) : ses Dégâts, leur formule et leur total
 *  résolu au Bonus de Force (`effectiveWeaponDamage`, « Spécial » → 0), `null` sans Dégâts ; sa Portée en mètres
 *  (`effectiveRange`) ; son Allonge, `null` pour une arme à Portée (LDB 62) ; ses
 *  Dégâts conditionnels (`degatsConditionnels`). */
export interface ProfilDArme {
  degats: { formule: WeaponDamageSpec; total: number } | null;
  portee: number | null;
  allonge: ReachValue | null;
  conditionnels: DegatsConditionnels[];
}

/** Ce que porte une arme ou une pièce dont on lit les Dégâts conditionnels. */
type PorteurDeDegats = QualityCarrier & { damage?: WeaponDamageSpec | null; onHitEffects?: TriggeredEffect[] };

/** Le profil de l'arme `it` (un `ItemInstance` comme un `Weapon` dérivé) pour un porteur de force `force`
 *  (`forceDuPorteur`), injectée dans les Dégâts résolus et la Portée (arme de jet `{bf}` → BF×N). PUR. */
export function profilDArme(it: ItemInstance | Weapon, force: { bf: number; passif: number }): ProfilDArme {
  const portee = effectiveRange(it.range, force.bf);
  return {
    degats: it.damage ? { formule: it.damage, total: effectiveWeaponDamage(it as Weapon, force) } : null,
    portee,
    allonge: portee === null ? it.reach ?? null : null,
    conditionnels: degatsConditionnels(it as PorteurDeDegats),
  };
}

/** Le profil `p` en texte, une part par stat : « Dégâts <formule> (<total>) », la Portée ou l'Allonge, puis la note
 *  de ses Dégâts conditionnels. */
export function weaponStatParts(p: ProfilDArme): string[] {
  const note = noteDesConditionnels(p.conditionnels);
  return [
    ...(p.degats ? [t('ws.degats', { spec: damageString(p.degats.formule), total: p.degats.total })] : []),
    ...(p.portee !== null ? [t('ws.portee', { m: p.portee })] : p.allonge ? [t('ws.allonge', { reach: p.allonge })] : []),
    ...(note ? [note] : []),
  ];
}

/** Repli d'**Arme improvisée** (LDB 62 l.31, `+BF+1`) — dérivé une fois via `improvisedProfile` (résultat
 *  constant, indépendant de l'entrée) plutôt que retypé en littéral : SOURCE UNIQUE avec l'usure/la Lance
 *  hors Charge/le Bélier hors-porte (`engine/weaponDamage`). */
const IMPROVISED_DAMAGE: WeaponDamageSpec = improvisedProfile({ label: '', type: 'melee', damage: { plusBF: false, flat: 0 }, qualities: [] }).damage;

/** Cible SYNTHÉTIQUE « structure » — `siegeMultiplier` ne lit que `bodyShape` (`isStructure`) ; aucune
 *  structure réelle n'existe à l'affichage d'une fiche catalogue (Codex), hors combat. */
const SIEGE_TARGET = { bodyShape: 'structure' } as Combatant;

/** Les Dégâts conditionnels de `w` (`DegatsConditionnels`), lus des capacités de ses qualités par les fonctions
 *  qu'emploie le combat (`resolveQualities`, `siegeMultiplier`, `engine/structures`) ; `aLaTouche` seulement sans
 *  autre condition. PUR. */
export function degatsConditionnels(w: PorteurDeDegats): DegatsConditionnels[] {
  const siegeMult = siegeMultiplier({ qualities: w.qualities } as Weapon, SIEGE_TARGET);
  const conditions: DegatsConditionnels[] = [
    ...(resolveQualities(w).some((r) => r.caps?.ram) ? [{ genre: 'belier', repli: IMPROVISED_DAMAGE } as const] : []),
    ...(siegeMult > 1 ? [{ genre: 'siege', mult: siegeMult } as const] : []),
  ];
  return conditions.length || w.damage || !w.onHitEffects?.length ? conditions : [{ genre: 'aLaTouche' }];
}

/** Les Dégâts conditionnels `conditions` en une note, `null` sans condition. */
const noteDesConditionnels = (conditions: readonly DegatsConditionnels[]): string | null =>
  conditions.length
    ? conditions.map((c) => (c.genre === 'belier' ? t('ws.belier', { dmg: damageString(c.repli) }) : c.genre === 'siege' ? t('ws.siege', { mult: c.mult }) : t('ws.conditionnels'))).join(' · ')
    : null;

/** La note des Dégâts conditionnels de `w` (`degatsConditionnels`), `null` quand les Dégâts imprimés sont fidèles. */
export const conditionalDamageNote = (w: PorteurDeDegats): string | null => noteDesConditionnels(degatsConditionnels(w));

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
