/**
 * CAPSULE ÉCRAN d'un acteur — le segment pieds→tête qu'il occupe une fois projeté : la caméra en tire
 * sa visée du sujet (`capsuleCenter`, `stage/MondeDeCampagne`). Rien ici ne connaît le peintre : c'est
 * de la géométrie de scène.
 */
import { Dims, tileCenter, type ActorCapsule } from '../../geometry/iso';
import { metricToLift } from '../../noyau/monde/relief';

export function actorCapsuleOf(
  actor: { x: number; y: number; h: number },
  dims: Dims,
): ActorCapsule {
  const base = metricToLift(actor.h);
  const foot = tileCenter(actor.x, actor.y, dims, base);
  const head = tileCenter(actor.x, actor.y, dims, base + 1);
  return { segment: [{ x: foot.cx, y: foot.cy }, { x: head.cx, y: head.cy }] };
}
