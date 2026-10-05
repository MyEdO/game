/**
 * Résolveur UNIQUE des CAPACITÉS d'objet (canal `capabilities`) — MÊME logique cross-source que
 * `traitCapability`/`diseaseHasCapability`/les caps de qualité : une règle que le moteur INTERROGE par
 * id (jamais par le nom FR de l'objet). Deux natures de lecture :
 *
 *  - `itemCapability(it, cap)` — par-OBJET, NON gaté sur le port : « cet objet EST une ration / un
 *    grimoire / une cape ». Trouver une ration dans le sac pour la manger, ou lire un grimoire, ne
 *    demande pas de le « porter » au sens armure. Lu DEPUIS le catalogue par `trappingId` (comme `passive`).
 *
 *  - `hasCapability(c, cap)` — agrégat par-PERSONNAGE, CROSS-SOURCE et GATÉ sur le port pour les OBJETS :
 *    « le personnage A cette capacité ». Un objet ne compte que PORTÉ (`it.equipped`) ou TENU (`c.weapons`
 *    contient son uid) — le gantelet doit être tenu pour empêcher le lâcher, la cape PORTÉE pour protéger
 *    du froid. Réunit en plus les traits, les qualités des objets portés/tenus, et les maladies (la MÊME
 *    cap par nom). Point d'entrée unique : les nombreux call-sites internes de `traitCapability` restent
 *    intacts — `hasCapability` les RÉUTILISE, il ne les remplace pas.
 */
import type { Combatant, ItemInstance } from './types';
import { findTrappingById, type ItemCapabilities } from '../data';
import { traitCapability } from './traits/dispatch';
import { resolveQualities } from './qualities/dispatch';
import { hasActiveCapability } from './disease';

/** Lecture par-OBJET (catalogue, NON gatée) : cet objet porte-t-il la capacité `cap` ? Lue PAR ID dans
 *  `TrappingData.capabilities` — une arme invoquée (`DesignationParSource`) n'en a aucune. */
export function itemCapability(it: ItemInstance, cap: keyof ItemCapabilities): boolean {
  return !!(it.trappingId && findTrappingById(it.trappingId)?.capabilities?.[cap]);
}

/** Un objet est-il PORTÉ (equipped) ou TENU (arme du loadout actif `c.weapons`) ? Même garde que le
 *  collecteur passif (`trauma.passiveMods`) : les objets RANGÉS/en vrac ne comptent pas. */
function isHeld(c: Combatant, it: ItemInstance): boolean {
  return !!it.equipped || (c.weapons ?? []).some((w) => w.uid === it.uid);
}

/**
 * Agrégat par-PERSONNAGE CROSS-SOURCE de la capacité `cap`, GATÉ sur le port pour les objets :
 *  (a) objets PORTÉS/TENUS portant la cap (`itemCapability`) ;
 *  (b) traits du porteur (`traitCapability` — INCLUT les capacités octroyées par mutations/maladies, qui
 *      posent leurs Traits/États au porteur : pas de canal mutation séparé, il remonterait par les traits) ;
 *  (c) qualités des objets PORTÉS/TENUS (caps de `qualities/dispatch`) ;
 *  (d) maladies ACTIVES du porteur (`hasActiveCapability`).
 * Les ensembles de clés de chaque canal sont disjoints — un même nom de cap n'est servi que par sa source —
 * mais le résolveur est GÉNÉRIQUE par construction (une nouvelle cap d'un canal est lue sans code dédié).
 */
export function hasCapability(c: Combatant, cap: string): boolean {
  for (const it of c.items ?? []) {
    if (!isHeld(c, it)) continue;
    if (itemCapability(it, cap as keyof ItemCapabilities)) return true;
    if (resolveQualities(it).some((r) => !!(r.caps as Record<string, unknown> | undefined)?.[cap])) return true;
  }
  if (traitCapability(c.traits, cap as never)) return true;
  if (hasActiveCapability(c, cap as never)) return true;
  return false;
}
