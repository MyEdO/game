/**
 * COQUE DE NAVIRE sous les coups PERSONNELS (MDG 13 « Infliger des Dégâts aux navires ») — module
 * PUR, consommé par `applyHit` (combat.ts) :
 *
 *  - **Tirs de petites armes** (l.603-605) : « les tirs de petites armes, c'est-à-dire d'armes à
 *    projectiles qui ne sont pas des pièces d'artillerie, n'infligent pas assez de Dégâts pour avoir un
 *    effet sur un vaisseau » → un tir NON-artillerie n'inflige AUCUNE Blessure à la coque (l'équipage
 *    exposé, lui, reste ciblable individuellement).
 *
 *  - **Attaques de corps à corps** (l.610-637) : « Le BE du navire est ajusté de la façon indiquée dans
 *    le tableau [DE COMPARAISON DES TAILLES]… Si le résultat est une case sans chiffre, cela signifie que
 *    les attaques du personnage concerné n'infligent normalement pas de Dégâts à un bateau. » Le tableau
 *    « remplace les modificateurs normaux pour les Dégâts qu'un Personnage pourrait recevoir parce qu'il
 *    fait une certaine Taille » (l.616) → en mêlée contre une coque, les règles de Taille LDB 85 (Atouts
 *    conférés + ×N) sont REMPLACÉES par cet ajustement de BE.
 *
 * La Taille du navire est DÉRIVÉE de sa longueur par `hullShipSize` (`./shipBuild`), qui lit le
 * tableau CARACTÉRISTIQUES DE BATEAU STANDARD en donnée (MDG 12 l.120-129) — aucun champ de donnée
 * redondant, et aucune seconde écriture de la même table.
 */
import type { Combatant, Weapon } from './types';
import type { ShipSize } from '../data';
import { ammoFamily } from './items';
import { hullShipSize } from './shipBuild';
import { bonus, effectiveChar } from './characteristics';
import { SIZE_ORDER, effectiveSize, type SizeCategory } from './size';

const SHIP_SIZE_ORDER: Record<ShipSize, number> = {
  minuscule: 0, 'tres-petite': 1, petite: 2, moyenne: 3, grande: 4, enorme: 5, monstrueuse: 6,
};

/** Ajustement de BE du TABLEAU DE COMPARAISON DES TAILLES (MDG 13 l.618-637) : `null` = case « – »
 *  (aucun Dégât possible) ; `{ mult }` = « N × BE » ; `{ flat }` = « BE−N » (0 = « BE » tel quel).
 *  Le tableau suit l'ÉCART de catégories (personnage − navire) : +1 → 4×BE, +2 → 3×BE, +3 → 2×BE,
 *  +4 → BE, +5 → BE−1, +6 → BE−2 ; écart ≤ 0 → « – » (vérifié case à case contre le verbatim :
 *  halfling Petite vs chaloupe Minuscule = écart +2 = 3×BE, l.614 ; vs Grand bateau = aucun Dégât). */
export function meleeVsHullBE(shipSize: ShipSize, attackerSize: SizeCategory): { mult: number } | { flat: number } | null {
  const gap = SIZE_ORDER[effectiveSize(attackerSize)] - SHIP_SIZE_ORDER[shipSize];
  switch (gap) {
    case 1: return { mult: 4 };
    case 2: return { mult: 3 };
    case 3: return { mult: 2 };
    case 4: return { flat: 0 };
    case 5: return { flat: -1 };
    case 6: return { flat: -2 };
    default: return null; // écart ≤ 0 : « les attaques du personnage concerné n'infligent normalement pas de Dégâts » (l.614)
  }
}

/** Pièce d'ARTILLERIE (MDG 13 l.605 : ce qui n'en est pas est une « petite arme ») — même famille
 *  canonique que les munitions de siège (`ammoFamily`), donc balistes/canons/mortiers/pierriers. */
export function isArtilleryWeapon(w: Weapon): boolean {
  return ammoFamily(w.subType) === 'artillerie';
}

/** Ajustement d'un COUP PERSONNEL contre une coque (MDG 13) — consommé par `applyHit` :
 *  - `null` : la cible n'est pas une coque → chemin normal ;
 *  - `{ blocked }` : AUCUNE Blessure à la coque (petites armes l.605 / case « – » du tableau l.614) ;
 *  - `{ extraTB }` : BE SUPPLÉMENTAIRE soustrait des Dégâts (mult/flat du tableau déjà résolu :
 *    « 3 × BE » ⇔ +2×BE de plus ; « BE−1 » ⇔ −1), avec plancher 0 Blessure (un coup trop faible ricoche). */
export function hullHitAdjust(attackerSize: SizeCategory | undefined, weapon: Weapon, target: Combatant):
  | { blocked: 'petites-armes' | 'taille' }
  | { extraTB: number }
  | null {
  const size = hullShipSize(target);
  if (!size) return null;
  if (weapon.type === 'ranged') return isArtilleryWeapon(weapon) ? { extraTB: 0 } : { blocked: 'petites-armes' };
  const f = meleeVsHullBE(size, effectiveSize(attackerSize));
  if (!f) return { blocked: 'taille' };
  return { extraTB: 'mult' in f ? (f.mult - 1) * bonus(effectiveChar(target, 'endurance')) : f.flat };
}
