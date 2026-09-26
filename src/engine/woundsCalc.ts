/**
 * Résolveur de Blessures d'un COUP D'ARME — `woundsFromHit`. Module FEUILLE, hors du cycle de
 * `combat.ts` (pour être réutilisable SANS cycle par `ops.ts` : `op:'wounds'` en « mode coup d'arme » y délègue, et
 * `combat.ts` le ré-exporte pour ses importeurs). N'importe QUE des modules feuilles (characteristics,
 * combatFeatures, qualities, armourBypass) — aucune dépendance vers `ops`/`combat`.
 */
import type { Weapon, Combatant, HitLocation } from './types';
import { bonus, effectiveChar, effectiveArmourAt } from './characteristics';
import { bypassedAP } from './armourBypass';
import { qualitySum, qualityArmourBypasses, hasQuality } from './qualities/dispatch';
import { talentDamageReduction } from './combatFeatures/dispatch';
import { isStructure, structureImmune, siegeMultiplier, structureEnduranceMult } from './structures';
import type { SizeCategory } from './size';

/**
 * Blessures infligées par un coup : `totalDamage` (Dégâts d'arme + DR + qualités) moins le Bonus
 * d'Endurance et les PA EFFECTIFS à la `location` (armure portée/naturelle + `extraAP`, matériau
 * ignoré PUIS retrait plat, LDB 62 l.270). `minWounds` = plancher (1 pour un PERSONNAGE — garantit
 * Robuste LDB 10 ; 0 pour un NAVIRE, MDG 13 l.605 : un coup trop faible peut ricocher sur la coque).
 *
 * STRUCTURE de siège (ADE II 8) : on greffe l'Atout Siège data-driven (cf. `engine/structures`). Une arme
 * IMPARABLE (Résistant/Impénétrable/Bélier hors-porte) inflige 0 ; sinon le TOTAL de Dégâts est doublé par
 * Siège AVANT le Bonus d'Endurance (RAW « le double des dégâts »), et le plancher passe à 0 (un coup trop
 * faible ne raye pas la structure — comme une coque). Sans PA, l'`effectiveArmour` d'une structure vaut 0.
 *
 * `attackerSize` = Taille de l'attaquant, qui compte le Bonus d'Endurance d'une STRUCTURE
 * (`structureEnduranceMult`, `AA 10 l.98`). REQUIS (jamais omis à l'appel) : `undefined` est une valeur
 * qui se PASSE, et `effectiveSize` la rabat alors sur Moyenne (`LDB 14 l.128`), le standard jouable.
 */
export function woundsFromHit(weapon: Weapon | undefined, target: Combatant, location: HitLocation | undefined, totalDamage: number, extraAP = 0, minWounds = 1, attackerSize: SizeCategory | undefined): number {
  // Engin de siège INERTE (AA 10 l.136-193) : le RAW ne lui donne aucune Blessure → NON-DESTRUCTIBLE (immune).
  // On le neutralise en tuant son équipage, jamais en le frappant. (≠ structure/véhicule, qui NE sont PAS `inert`.)
  if (target.inert) return 0;
  if (isStructure(target)) {
    if (weapon && structureImmune(weapon, target)) return 0;
    if (weapon) totalDamage *= siegeMultiplier(weapon, target);
    minWounds = 0;
  }
  // Inoffensive (LDB 62 l.327) : « Tous les PA sont doublés contre les armes Inoffensives. De plus, vous
  // n'infligez pas automatiquement le minimum de 1 Blessure sur une touche réussie en combat. »
  const inoffensive = !!weapon && hasQuality(weapon, 'inoffensive');
  if (inoffensive) minWounds = 0;
  // Robuste (LDB 10) : « Vous réduisez tous les Dégâts subis de 1 par niveau […] toujours un minimum de 1 Blessure ».
  totalDamage -= talentDamageReduction(target);
  // `AA 10 l.98` — le BE d'une Structure se compte une fois de plus par catégorie de Taille au-dessus de
  // l'attaquant (Atout Siège exempté) ; hors Structure le multiplicateur vaut 1.
  const tb = bonus(effectiveChar(target, 'endurance')) * structureEnduranceMult(weapon, target, attackerSize);
  // PA bruts = armure portée/naturelle + PA temporisés de sort + PA conférés par l'arme d'opposition
  // (`extraAP`). `location` ABSENTE (STRUCTURE inanimée, ADE II 8 : pas de Localisation) → aucune armure
  // de pièce (une structure a 0 PA partout) : le terme d'armure vaut 0.
  const rawAP = (location ? effectiveArmourAt(target, location) : 0) + extraAP;
  // ORDRE (LDB 62 l.270) : bypass (`weapon.bypass` — Épée de justice → 'all', etc. — et les bypass de
  // qualité, ex. Perforante) sur le reliquat AVANT le retrait plat (`armourReduction`) — jamais l'inverse.
  let ap = rawAP;
  if (location && weapon) for (const b of [weapon.bypass, ...qualityArmourBypasses(weapon)]) ap = Math.max(0, ap - bypassedAP(target, location, b, ap));
  if (weapon) ap = Math.max(0, ap - qualitySum(weapon, 'armourReduction'));
  const effAP = inoffensive ? ap * 2 : ap; // LDB 62 l.327 — PA doublés contre cette arme
  return Math.max(minWounds, totalDamage - (tb + effAP));
}
