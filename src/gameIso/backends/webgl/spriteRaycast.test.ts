import { Mesh, MeshBasicMaterial, OrthographicCamera, PlaneGeometry, type Intersection, type Raycaster } from 'three';
import { describe, expect, it } from 'vitest';
import { pickNearestTarget, type PickTarget } from './spriteRaycast';

const CAMERA = new OrthographicCamera(-10, 10, 10, -10, 0.1, 100);
CAMERA.updateMatrixWorld(true);

function decor(z: number): { cible: PickTarget; balayages: () => number } {
  const m = new Mesh(new PlaneGeometry(2, 2), new MeshBasicMaterial());
  m.position.set(0, 0, z);
  m.updateMatrixWorld(true);
  let n = 0;
  const vrai = m.raycast.bind(m);
  m.raycast = (r: Raycaster, i: Intersection[]) => { n += 1; vrai(r, i); };
  return { cible: { object: m }, balayages: () => n };
}

const CENTRE = { x: 0, y: 0 };
const BORD = { x: 0.9, y: 0.9 };

describe('pickNearestTarget — les billboards occultent sans nommer', () => {
  it('interroge un décor même quand le pixel manque son quad', () => {
    const d = decor(-9);
    expect(pickNearestTarget(CAMERA, [d.cible], null, BORD)).toBeNull();
    expect(d.balayages()).toBe(1);
  });

  it('rend null pour un décor touché ou une liste vide', () => {
    const d = decor(-3);
    expect(pickNearestTarget(CAMERA, [d.cible], null, CENTRE)).toBeNull();
    expect(d.balayages()).toBe(1);
    expect(pickNearestTarget(CAMERA, [], null, CENTRE)).toBeNull();
  });

  it('balaye tous les décors quel que soit leur ordre', () => {
    const proche = decor(-3);
    const loin = decor(-9);
    for (const cibles of [[proche.cible, loin.cible], [loin.cible, proche.cible]])
      expect(pickNearestTarget(CAMERA, cibles, null, CENTRE)).toBeNull();
    expect(proche.balayages()).toBe(2);
    expect(loin.balayages()).toBe(2);
  });
});
