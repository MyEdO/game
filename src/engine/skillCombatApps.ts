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
 * PUR : lit la donnée (`byId('skill', …)`) + `bonusDe` ; ne mute rien. La couche combat/UI consomme
 * ces primitives (surface d'attaque/défense) — cette FEUILLE ne connaît ni le store ni le rendu.
 */
import type { Combatant } from './types';
import { byId, skills } from '../data';
import { bonusDe } from './characteristics';
import { skillBaseValue, possesses } from './skills';
import { sousPeur } from './psychology';


// ── A) Cumuler l'Avantage ────────────────────────────────────────────────────

/** Plafond d'Avantage cumulable via cette Compétence en combat (LDB 09 l.305-308) = Bonus de la
 *  Caractéristique `cap` déclarée. 0 si la Compétence n'a pas d'application « Avantage » ou n'est pas possédée. */
export function skillAdvantageCap(c: Combatant, skillId: string): number {
  const sd = byId('skill', skillId);
  if (!sd?.combatAdvantage || !possesses(c, { id: skillId })) return 0;
  return Math.max(0, bonusDe(c, sd.combatAdvantage.cap));
}

/** Compétences dont `c` peut se servir en combat pour cumuler l'Avantage, avec leur plafond : toute Compétence du
 *  catalogue qui en déclare l'application et qu'il possède (`possesses`, Compétence de base comprise). */
export function combatAdvantageSkills(c: Combatant): { skillId: string; cap: number }[] {
  return skills.filter((sd) => sd.combatAdvantage)
    .map((sd) => ({ skillId: sd.id, cap: skillAdvantageCap(c, sd.id) }))
    .filter((s) => s.cap > 0);
}

// ── B) Substitution sociale en combat ───────────────────────────────────────

/** `foe` est-il sous une Peur SOURCÉE par `self` (`sousPeur`) — gate `fear` des substitutions (l.287) ? */
export function fearsBy(foe: Combatant, self: Combatant): boolean {
  return (foe.psychState ?? []).some((p) => p.sourceId === self.id && sousPeur(p));
}

/** Compétence sociale que `self` peut SUBSTITUER à sa Compétence de combat contre `foe`, pour un `role`
 *  (défense/attaque), avec sa valeur de Test — ou `null` si aucune (pas la Compétence, ou gate non rempli).
 *  RAW : Intimidation/Dressage « à la place de / au lieu de Corps à corps » quand `foe` a peur de `self`. */
export function combatSubstitute(self: Combatant, foe: Combatant, role: 'defense' | 'attaque'): { skillId: string; value: number } | null {
  let best: { skillId: string; value: number } | null = null;
  for (const inst of self.skills ?? []) {
    const sub = byId('skill', inst.id)?.combatSubstitute;
    if (!sub || (sub.role !== 'lesDeux' && sub.role !== role)) continue;
    if (!possesses(self, { id: inst.id })) continue;
    if (sub.gate === 'peur' && !fearsBy(foe, self)) continue;
    const value = skillBaseValue(self, { skill: inst }); // même valeur que la défense sociale résolue
    if (!best || value > best.value) best = { skillId: inst.id, value };
  }
  return best;
}
