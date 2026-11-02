import { describe, it, expect } from 'vitest';
import { tileCenter, type Dims } from '../../geometry/iso';
import { metricToLift } from '../../noyau/monde/relief';
import { actorCapsuleOf } from './actorCapsule';

/**
 * LA CAPSULE D'UN ACTEUR (#907) : le segment ÉCRAN pieds→tête, d'UN niveau au-dessus du sol de sa
 * case. La caméra en vise le milieu (`stage/MondeDeCampagne`).
 */
describe('actorCapsuleOf — le segment pieds→tête du sujet (#907)', () => {
  const dims: Dims = { w: 20, h: 20, rot: 1, view: 'iso' };

  it('pieds au sol de la case, tête un niveau plus haut, relief compris', () => {
    const h = 1.5;
    const base = metricToLift(h);
    const pieds = tileCenter(5, 7, dims, base), tete = tileCenter(5, 7, dims, base + 1);
    expect(actorCapsuleOf({ x: 5, y: 7, h }, dims).segment).toEqual([
      { x: pieds.cx, y: pieds.cy },
      { x: tete.cx, y: tete.cy },
    ]);
  });
});
