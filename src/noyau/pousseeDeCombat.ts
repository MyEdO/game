import type { Combatant } from '../engine/types';
import { chebyshev } from '../engine/grid';
import { mannedPosteWeapon } from '../engine/items';
import { t } from '../i18n';
import { bus, EVT } from './bus';
import { ev } from './combatLog';
import type { BattleState } from './etat';
import type { Get, Set } from './flowTypes';
import { mountMovement } from './mount';
import { captureMoveSnapshot } from './monde/combatGeometry';
import { inBattleId } from './monde/combatants';
import { tileKey, type Pt } from './monde/path';
import type { Scene } from './monde/scene';
import { posteDeLaBataille, translaterFormation } from './monde/shipPostes';
import { pushCrewOk, pushEligible, pushReachable } from './siegePush';

/** ADE II 08 l.233, l.258 ; LDB 13 l.79, l.106. */
export function preparerPoussee(battle: BattleState, scene: Scene, active: Combatant) {
  const origin = active.pos;
  const poste = active.mannedPoste;
  const movement = mountMovement(battle, active);
  if (battle.over || !origin || !poste || !pushEligible(active) || (battle.movementUsed ?? 0) >= movement) return null;
  const hull = posteDeLaBataille(poste.item.uid, battle.combatants)?.porteur;
  const arme = mannedPosteWeapon(active, poste);
  if (!hull?.pos || !arme || !pushCrewOk(poste, arme, battle.combatants)) return null;
  return { origin, poste, hull, movement, reachable: pushReachable(battle, scene, active, hull) };
}

/** LDB 13 l.79, l.106. */
export function executerPoussee(get: Get, set: Set, active: Combatant, to: Pt): boolean {
  const { battle, scene } = get();
  if (!battle || !scene) return false;
  const plan = preparerPoussee(battle, scene, active);
  if (!plan || !plan.reachable.has(tileKey(to.x, to.y, to.z))) return false;
  const snapshot = (battle.movementUsed ?? 0) === 0 ? captureMoveSnapshot(battle, get().facing) : battle.moveSnapshot ?? null;
  const delta = { x: to.x - plan.origin.x, y: to.y - plan.origin.y };
  const deplaces = translaterFormation(battle.combatants, scene, plan.hull, plan.poste.crewIds ?? [], delta);
  if (!deplaces) return false;
  for (const { mobile, depart } of deplaces) bus.emit(EVT.ANIM_MOVE, { id: mobile.id, path: [depart, { ...mobile.pos! }] });
  for (const id of plan.poste.crewIds ?? []) {
    if (id === active.id) continue;
    const servant = inBattleId(battle, id);
    if (servant) servant.loseNextMovement = true;
  }
  const dist = chebyshev(delta, { x: 0, y: 0 });
  const log = [...battle.log, ev('deplacement', t('cs.pushEngine', { name: active.label, weapon: plan.hull.label, n: dist, s: dist > 1 ? 's' : '' }), active.id)];
  set({
    battle: {
      ...get().battle!,
      moveSnapshot: snapshot, movementUsed: plan.movement, action: null, reachable: new Map(), preview: null, log,
    },
  });
  bus.emit(EVT.SCENE_DIRTY);
  return true;
}
