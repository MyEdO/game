/**
 * Applications de COMBAT des Compétences (Livre de base, Compétences, LDB 09 l.60) — « De nombreuses
 * Compétences peuvent également avoir certaines applications en combat. » Deux familles data-driven
 * (métadonnées `SkillData.combatAdvantage` / `SkillData.combatSubstitute`, aucune Compétence nommée en
 * dur) :
 *
 *  A) CUMULER l'AVANTAGE (l.305-308) : passer son tour à réussir un Test de la Compétence donne +1
 *     Avantage, jusqu'à un maximum = Bonus de la Caractéristique `cap` — Intuition/Savoir/Survie en
 *     extérieur (Int, l.308/493/556), Prière (Soc, l.419). `skillAdvantageCap` renvoie ce plafond.
 *
 *  B) SUBSTITUER une Compétence sociale à la Compétence de COMBAT (l.207/287) : Intimidation « à la place
 *     de Corps à corps … face à ceux qui ont peur de vous » (défense) et « attaquer de telles cibles »
 *     (attaque) ; Dressage « au lieu de Corps à corps » après avoir instillé la peur à l'animal. Gate
 *     `fear` : l'ADVERSAIRE est sous une Peur SOURCÉE par ce personnage (`sourceId` = son id, non surmontée).
 *
 * PUR : lit la donnée (`byId('skill', …)`) + `effectiveChar` ; ne mute rien. La couche combat/UI consomme
 * ces primitives (surface d'attaque/défense) — cette FEUILLE ne connaît ni le store ni le rendu.
 */
import type { Combatant } from './types';
import { byId } from '../data';
import { effectiveChar, bonus } from './characteristics';
import { skillBaseValue, possesses } from './skills';

/** Valeur d'un Test de la Compétence `skillId` (spécialisation `spec`) pour `c` — SOURCE UNIQUE partagée
 *  avec la valeur de défense sociale : `skillBaseValue` (Caractéristique EFFECTIVE + carac alternative +
 *  Augmentations), pour que la valeur OFFERTE (surface d'attaque/défense) == la valeur RÉSOLUE. */
function skillValue(c: Combatant, skillId: string, spec?: string): number {
  return skillBaseValue(c, skillId, spec);
}

// ── A) Cumuler l'Avantage ────────────────────────────────────────────────────

/** Plafond d'Avantage cumulable via cette Compétence en combat (LDB 09 l.305-308) = Bonus de la
 *  Caractéristique `cap` déclarée. 0 si la Compétence n'a pas d'application « Avantage » ou n'est pas possédée. */
export function skillAdvantageCap(c: Combatant, skillId: string): number {
  const sd = byId('skill', skillId);
  if (!sd?.combatAdvantage || !possesses(c, skillId)) return 0;
  return Math.max(0, bonus(effectiveChar(c, sd.combatAdvantage.cap)));
}

/** Compétences dont `c` peut se servir en combat pour cumuler l'Avantage, avec leur plafond. */
export function combatAdvantageSkills(c: Combatant): { skillId: string; cap: number }[] {
  const out: { skillId: string; cap: number }[] = [];
  for (const s of c.skills ?? []) {
    const cap = skillAdvantageCap(c, s.id);
    if (cap > 0) out.push({ skillId: s.id, cap });
  }
  return out;
}

// ── B) Substitution sociale en combat ───────────────────────────────────────

/** `foe` est-il sous une Peur SOURCÉE par `self` (non surmontée) — gate `fear` des substitutions (l.287) ? */
export function fearsBy(foe: Combatant, self: Combatant): boolean {
  return (foe.psychState ?? []).some((p) => p.type === 'peur' && p.sourceId === self.id && (p.indice ?? 0) > (p.calmeDR ?? 0));
}

/** Compétence sociale que `self` peut SUBSTITUER à sa Compétence de combat contre `foe`, pour un `role`
 *  (défense/attaque), avec sa valeur de Test — ou `null` si aucune (pas la Compétence, ou gate non rempli).
 *  RAW : Intimidation/Dressage « à la place de / au lieu de Corps à corps » quand `foe` a peur de `self`. */
export function combatSubstitute(self: Combatant, foe: Combatant, role: 'defense' | 'attack'): { skillId: string; value: number } | null {
  let best: { skillId: string; value: number } | null = null;
  for (const inst of self.skills ?? []) {
    const sub = byId('skill', inst.id)?.combatSubstitute;
    if (!sub || (sub.role !== 'both' && sub.role !== role)) continue;
    if (!possesses(self, inst.id)) continue;
    if (sub.gate === 'fear' && !fearsBy(foe, self)) continue;
    const value = skillValue(self, inst.id, inst.spec);
    if (!best || value > best.value) best = { skillId: inst.id, value };
  }
  return best;
}
