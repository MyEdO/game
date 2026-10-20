/**
 * COLLISION / ÉPERONNAGE appliqué (MDG 13 l.423-465) — couche STATE mince au-dessus du résolveur PUR
 * `engine/collision.ts`. La RÉSOLUTION (Indice de Collision, frontal/poupe, Bélier) reste du DOMAINE ; ce
 * module ne fait que (1) mapper une coque-`Combatant` en `CollisionShip`, (2) appeler `resolveCollision`,
 * (3) APPLIQUER les Dégâts à chaque coque via la langue UNIQUE `applyOps` (op `wounds` : la mitigation BE +
 * PA de coque + `extraAP` situationnel reste DANS l'op, jamais pré-calculée ici). Aucune règle recodée.
 */
import type { Combatant } from '../../engine/types';
import { collisionIndex, resolveCollision, type CollisionShip, type CollisionDamage } from '../../engine/collision';
import { belierRam, hullNavalTraits } from '../../engine/navalTraits';
import { applyOps } from '../../engine/ops';
import { defaultRNG, type RNG } from '../../engine/dice';
import { propulsionDuNavire, type MilieuDeNavigation } from '../../engine/shipBuild';
import { garanti } from '../../lib/garanti';

/** Mappe une coque-`Combatant` en `CollisionShip` (vue Dégâts) : IC = `collisionIndex` (Bonus d'Endurance +
 *  Bonus de Blessures) ; M = `propulsionDuNavire` dans le `milieu` du flux ; Bélier lu dans
 *  les Traits du TYPE + Améliorations d'INSTANCE (`belierRam`). PUR. */
function toCollisionShip(hull: Combatant, milieu: MilieuDeNavigation): CollisionShip {
  const m = garanti(propulsionDuNavire(hull.creatureId, hull.upgrades, milieu), hull.creatureId, 'propulsion du navire').m;
  return { ic: collisionIndex(hull), m, belier: belierRam(hullNavalTraits(hull)) };
}

/**
 * Applique une collision entre `causer` (qui percute) et `victim` : résout (`resolveCollision`, PUR) puis
 * applique les Dégâts bruts de CHAQUE coque sur sa Localisation Coque via l'op `wounds` — la mitigation
 * (Bonus d'Endurance + PA de coque + `extraAP` = PA situationnels poupe/Bélier) est faite PAR l'op. Mute les
 * deux coques (RNG injecté ; les montants sont constants → déterministe). Renvoie les lignes + les Dégâts résolus.
 */
export function applyShipCollision(
  causer: Combatant, victim: Combatant, milieu: MilieuDeNavigation, opts: { frontal?: boolean; ramProue?: boolean } = {}, rng: RNG = defaultRNG,
): { lines: string[]; causer: CollisionDamage; victim: CollisionDamage } {
  const res = resolveCollision(toCollisionShip(causer, milieu), toCollisionShip(victim, milieu), opts);
  const lines = [`${causer.label} percute ${victim.label}${opts.frontal ? ' de plein fouet' : ''} !`];
  // Dégâts sur la Coque (l.464), mitigés DANS l'op : BE + PA de coque + extraAP (armorBonus situationnel).
  lines.push(...applyOps(victim, [{ op: 'wounds', amount: res.victim.damage, ignoreTB: false, ignoreAP: false, extraAP: res.victim.armorBonus }], { rng }));
  lines.push(...applyOps(causer, [{ op: 'wounds', amount: res.causer.damage, ignoreTB: false, ignoreAP: false, extraAP: res.causer.armorBonus }], { rng }));
  return { lines, causer: res.causer, victim: res.victim };
}
