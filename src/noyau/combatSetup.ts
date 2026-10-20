/**
 * Mise en place d'un combat — MODULE FEUILLE (n'importe RIEN de combatFlow ; combatFlow le ré-exporte).
 * Extrait du corps de `store.startCombat` les points NOMMÉS surchargeables, pour ouvrir des coutures
 * d'extension (cf. refonte par hooks, plan transient-dancing-shamir.md) sans éditer le monolithe.
 */
import type { Combatant } from '../engine/types';
import type { RNG } from '../engine/dice';
import { baseWithTraits, bonus, effectiveChar } from '../engine/characteristics';
import { talentInitiativeBonus } from '../engine/combatFeatures/dispatch';
import { rule } from '../engine/policy';
import { initiativeOrder } from '../engine/combat';
import { strikesLast } from '../engine/qualities/dispatch';
import { isPassengerInBattle } from './monde/shipPostes';
import { isControlledMount } from './mount';

/**
 * Initiative d'un combattant au début du combat — POINT NOMMÉ, seam de la règle optionnelle « méthode
 * d'Initiative » (`combat-init-method`). Combat instinctif (LDB 10 : +10 × niveau) toujours ajouté via
 * `talentInitiativeBonus`. Le `rng` est passé par l'appelant (un `rng.int(1,10)` par combattant dans
 * `roll-i`/`roll-bi`) → l'ordre de tirage est préservé par la boucle appelante.
 *  - `fixed-i` (DÉFAUT) : tri par Initiative, SANS dé (LDB 13 l.29 ; ne consomme pas le RNG).
 *  - `roll-i` : 1d10 + Initiative (méthode aléatoire optionnelle, LDB 13 l.40).
 *  - `roll-bi` : 1d10 + Bonus d'Initiative + Bonus d'Agilité (méthode aléatoire optionnelle).
 */
export function rollInitiative(c: Combatant, rng: RNG): number {
  const talent = talentInitiativeBonus(c);
  switch (rule('combat-init-method')) {
    case 'fixed-i':
      return baseWithTraits(c, 'initiative') + talent;
    case 'roll-bi':
      return rng.int(1, 10) + bonus(baseWithTraits(c, 'initiative')) + bonus(effectiveChar(c, 'agilite')) + talent;
    default: // 'roll-i'
      return baseWithTraits(c, 'initiative') + rng.int(1, 10) + talent;
  }
}

/**
 * Ordre d'initiative (`battle.order`) à partir des combattants (Initiative DÉJÀ fixée) : trie par Initiative
 * (`initiativeOrder`), puis place les porteurs d'arme « Lente » en dernier (LDB 62 l.331). À l'échelle MER, EXCLUT
 * les PASSAGERS (`isPassengerInBattle` : équipage d'une coque — le NAVIRE agit en unité, MDG 14). Les passagers
 * RESTENT dans `battle.combatants` ; seul leur slot d'`order` est retiré. Au person-scale (ou sans navire), `order`
 * est inchangé — y compris les MONTURES, qui gardent leur tour (RAW Combat monté LDB 14 l.182). PUR.
 * `rng` (optionnel) : départage RAW des égalités EXACTES d'Initiative+Agilité par Test d'Agilité (LDB 13
 * l.31), propagé à `initiativeOrder`. Absent = tri stable déterministe (tests purs inchangés).
 */
export function combatOrder(all: Combatant[], merScale: boolean, rng?: RNG): string[] {
  // Exclus de l'ordre : PASSAGERS de coque (échelle MER) ET montures Nerveux CHEVAUCHÉES (LDB 14 l.182 —
  // pas de tour propre tant qu'elles sont montées). Elles RESTENT dans `combatants` (ciblables, prennent des coups).
  const ordered = initiativeOrder(all, rng).filter((c) => !isPassengerInBattle(c, all, merScale) && !isControlledMount(c));
  return [...ordered.filter((c) => !strikesLast(c.weapons)), ...ordered.filter((c) => strikesLast(c.weapons))].map((c) => c.id);
}
