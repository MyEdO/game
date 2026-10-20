/**
 * Gestes de PLACEMENT en combat qui écrivent la bataille ou la scène et émettent sur le bus : poussée
 * Perturbante, dégagement des plus petits, retrait d'entités, traversée de zones. La géométrie
 * qu'ils lisent vit dans `combatGeometry.ts`.
 */
import type { BattleState } from './store';
import type { Get, Set as SetFn } from './flowTypes';
import type { Combatant, EffectSource } from '../engine/types';
import { Scene, isWalkable } from '../noyau/monde/scene';
import { Pt, tileKey } from '../noyau/monde/path';
import { footprintTiles, footprintN, occupiesTile } from '../noyau/monde/footprint';
import { actorIn } from '../noyau/monde/combatants';
import { sizeGap } from '../engine/size';
import { isOutOfAction } from '../engine/conditions';
import { crossZones, zoneCovers } from '../noyau/monde/zones';
import { battleRng } from '../noyau/battleRng';
import { ev } from '../noyau/combatLog';
import { t } from '../i18n';
import { bus, EVT } from '../noyau/bus';
import { pruneSeatAssignments } from '../noyau/monde/seating';
import { occupied, premiereCaseEnAnneaux } from '../noyau/monde/combatGeometry';
// Type-only (effacé à la compilation) : la FORME du Flow gaté posé pour une zone `crossTest` — ce
// module reste BAS NIVEAU (aucun import de `combat/triggeredTest`/`combatEffects`, qui remonteraient
// vers lui → cycle) ; la résolution cadence-aware est déléguée au hook `setZoneCrossTestHook`
// (inversion de dépendance, calque `setFreeAttackHook`/`setBladeTrapHook`, installé par le store).
import type { Flow as CoreFlow, EffectOp } from '../engine/flowCore';
import { EMPTY_FLOW } from '../engine/flowCore';

/** Perturbante (LDB 62 l.272-274) : repousse `target` d'au plus `tiles` cases dans la direction
 *  opposée à l'attaquant (cases praticables et libres seulement). Renvoie les cases reculées. */
export function pushBackTiles(get: Get, attacker: Combatant, target: Combatant, tiles: number): number {
  const { scene, battle } = get();
  if (!scene || !battle || !attacker.pos || !target.pos || tiles <= 0) return 0;
  let pos = target.pos;
  const dx = Math.sign(pos.x - attacker.pos.x);
  const dy = Math.sign(pos.y - attacker.pos.y);
  if (!dx && !dy) return 0;
  const blocked = occupied(battle, target);
  let moved = 0;
  const tz = target.pos.z ?? 0; // la poussée glisse au même étage que la cible (clé z-aware ; z=0 → « x,y »)
  for (let i = 0; i < tiles; i++) {
    const next = tz ? { x: pos.x + dx, y: pos.y + dy, z: tz } : { x: pos.x + dx, y: pos.y + dy };
    const foot = footprintTiles(next, footprintN(target));
    if (!foot.every((t) => isWalkable(scene, t.x, t.y, tz) && !blocked.has(tileKey(t.x, t.y, tz)))) break;
    pos = next;
    moved++;
  }
  target.pos = pos;
  if (moved) bus.emit(EVT.ANIM_MOVE, { id: target.id, path: [{ ...target.pos }] });
  return moved;
}

/**
 * Après qu'un combattant a bougé, « dégage de son chemin » les combattants de Taille STRICTEMENT
 * inférieure dont la case se retrouve SOUS son empreinte (LDB 85 l.373-374 : un plus grand « se
 * déplace où il veut ») : chacun est poussé vers la case libre la plus proche, hors de l'empreinte.
 * Mute les `pos` en place ; l'appelant émet SCENE_DIRTY / re-set la bataille. Renvoie true si déplacé.
 */
export function displaceSmaller(get: Get, mover: Combatant): boolean {
  const battle = get().battle;
  const scene = get().scene;
  if (!battle || !scene || !mover.pos || footprintN(mover) <= 1) return false;
  let moved = false;
  for (const c of battle.combatants) {
    if (c.id === mover.id || c.id === mover.riderId || isOutOfAction(c) || !c.pos) continue; // jamais éjecter SON propre cavalier (il chevauche)
    if (sizeGap(c.size, mover.size) >= 0) continue; // pas strictement plus petit → non dégagé
    if ((mover.pos.z ?? 0) !== (c.pos.z ?? 0)) continue; // pas le même étage → hors d'atteinte du mover
    if (!occupiesTile(mover.pos, footprintN(mover), c.pos.x, c.pos.y)) continue; // pas sous l'empreinte du mover
    const free = nearestFreeOutside(scene, battle, c, mover);
    if (free) { c.pos = free; moved = true; }
  }
  return moved;
}

/** Case walkable la plus proche de `c`, non occupée (toutes empreintes) et HORS de l'empreinte de
 *  `mover` — anneaux croissants (rayon ≤ 6). `undefined` si rien (c reste, co-occupation tolérée). */
function nearestFreeOutside(scene: Scene, battle: BattleState, c: Combatant, mover: Combatant): Pt | undefined {
  const blocked = occupied(battle, c.id); // Taille de `c` non prise en compte ici ⇒ TOUTES les empreintes bloquent (placement)
  const cz = c.pos!.z ?? 0; // le dégagement reste sur l'étage de `c` (z-aware)
  const p = premiereCaseEnAnneaux(c.pos!, 1, 6, (x, y) =>
    !occupiesTile(mover.pos!, footprintN(mover), x, y) // garder hors empreinte du mover
    && isWalkable(scene, x, y, cz) && !blocked.has(tileKey(x, y, cz)));
  return p && (cz ? { ...p, z: cz } : p); // même étage que `c`
}

/** Retrait par lot d'entités de scène (un seul `set` + un seul SCENE_DIRTY). No-op si rien à retirer.
 *  FUNNEL PARTAGÉ de toute suppression d'entité : l'assise (`Scene.seatAssignments`) y est renormalisée
 *  DANS LA MÊME écriture de scène — un meuble ou un PNJ qui disparaît ne laisse pas sa place derrière
 *  lui, et aucun appelant n'a à s'en souvenir. */
export function removeEntities(get: Get, set: SetFn, ids: string[]) {
  const scene = get().scene;
  if (!scene || !ids.length) return;
  const drop = new Set(ids);
  const next = scene.entities.filter((e) => !drop.has(e.id));
  if (next.length === scene.entities.length) return; // aucun id présent → rien à faire
  const elague: Scene = { ...scene, entities: next };
  const seatAssignments = pruneSeatAssignments(elague, get().party.length);
  set({ scene: scene.seatAssignments === undefined && !Object.keys(seatAssignments).length ? elague : { ...elague, seatAssignments } });
  bus.emit(EVT.SCENE_DIRTY);
}

export function removeEntity(get: Get, set: SetFn, id: string) {
  removeEntities(get, set, [id]);
}

/** HOOK de résolution cadence-aware d'une zone `crossTest` (Forêt d'épines, LDB 48 l.749) — injecté par
 *  le store (`setZoneCrossTestHook`, `createCombatSlice`), pointe sur `routeTriggeredTest`
 *  (`combat/triggeredTest`). Appelé par `applyZoneCrossings` pour CHAQUE zone gatée croisée : héros
 *  manuel → étape de cascade influençable ; ennemi/auto → jet inline (journal). Inversion de dépendance
 *  (ce module reste sans import de `combat/triggeredTest` → pas de cycle, cf. import ci-dessus). Absent
 *  (hors store, ex. test unitaire de cette seule brique) ⇒ no-op — comme les autres hooks. */
type ZoneCrossTestHook = (get: Get, set: SetFn, mover: Combatant, caster: Combatant, flow: CoreFlow<EffectOp>, label: string, source?: EffectSource) => void;
let zoneCrossTestHook: ZoneCrossTestHook | undefined;
export function setZoneCrossTestHook(fn: ZoneCrossTestHook): void { zoneCrossTestHook = fn; }

/** Traversée de zones persistantes (Mur de feu, LDB 47 — L11) au terme d'un déplacement :
 *  applique l'`onCross` des zones SANS `crossTest` et journalise (comportement inchangé) ; pour les
 *  zones GATÉES (Forêt d'épines, LDB 48 l.749 : « doit réussir un Test… sans posséder le Talent… »),
 *  route un `test` cadence-aware par le hook — succès → `onCross` sauté, échec → identique à `onCross`.
 *  (La Téléportation ne « traverse » pas — apparition — et n'appelle pas ce helper.)
 *  `resolveCaster` résout via la primitive PARTAGÉE `actorIn` (docs/primitives.md, table des primitives — combat
 *  OU groupe) plutôt qu'une fermeture `inBattleId` ad hoc : un lanceur mort/inconscient (`dead`/États)
 *  RESTE dans `battle.combatants` (aucune purge « morts persistants », #211 — non implémentée) donc
 *  reste résolvable, gardant SA Force Mentale comme référent des formules (`escapeStrength` de l'op
 *  `condition` posé par `onCross`, `ref = ctx.caster ?? target` — LDB 48 l.749 : « qui utilise VOTRE
 *  Force Mentale », pas celle du traverseur) ; le référent EST le mover uniquement quand `casterId` est
 *  absent/introuvable dans la bataille (cf. `applyTriggeredTestBranch`/`CascadeStepMeta.casterId` pour
 *  le threading identique côté cascade héros — même fallback, même réf). */
export function applyZoneCrossings(get: Get, set: SetFn, mover: Combatant, path: Pt[]): void {
  const battle = get().battle;
  if (!battle?.zones?.length || !path.length) return;
  const resolveCaster = (id?: string) => (id ? actorIn(get(), id) : undefined);
  const lines = crossZones(battle.zones, mover, path, resolveCaster, battleRng());
  for (const l of lines) battle.log.push(ev('condition', l, mover.id));
  if (lines.length) bus.emit(EVT.SCENE_DIRTY);
  if (mover.dead || isOutOfAction(mover)) return;
  for (const z of battle.zones) {
    if (!z.crossTest || !path.some((p) => zoneCovers(z, p))) continue;
    battle.log.push(ev('move', t('cf.zoneCross', { name: mover.label, zone: z.label }), mover.id));
    bus.emit(EVT.SCENE_DIRTY);
    const caster = resolveCaster(z.casterId) ?? mover;
    const flow: CoreFlow<EffectOp> = {
      kind: 'test', test: z.crossTest, success: EMPTY_FLOW,
      fail: z.onCross?.length ? { kind: 'do', effect: { type: 'ops', ops: z.onCross, on: 'target' } } : EMPTY_FLOW,
    };
    // L'ENTITÉ qui a posé la zone voyage avec le Test : la fenêtre dit ce qui barre le passage (#1262 V2 L6d).
    zoneCrossTestHook?.(get, set, mover, caster, flow, z.label, z.source);
  }
}
