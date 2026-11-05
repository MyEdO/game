import { Bone, Euler, Skeleton, Vector3 } from 'three';
import { TABLE_DU_JOUET } from '../../../hotes/godot/asset/gabarit.testkit.ts';
import { NOMS_DES_SILHOUETTES } from '../../../hotes/godot/asset/silhouettes.ts';
import type { PoidsDuSommet } from './gabarit.ts';
import type { Arete } from './laplacien.ts';

export function jouet() {
  let seed = 7;
  const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const rnd = (a: number) => (rand() * 2 - 1) * a;
  const mk = (name: string, parent?: Bone) => {
    const b = new Bone(); b.name = name;
    b.position.set(rnd(0.2), 0.1 + rand() * 0.4, rnd(0.2));
    b.quaternion.setFromEuler(new Euler(rnd(1.5), rnd(1.5), rnd(1.5)));
    parent?.add(b); return b;
  };
  const root = mk('root'), pelvis = mk('pelvis', root), thigh = mk('thigh', pelvis), calf = mk('calf', thigh), foot = mk('foot', calf);
  const spine = mk('spine', pelvis), up = mk('upperarm', spine), low = mk('lowerarm', up), hand = mk('hand', low);
  const neck = mk('neck', spine), head = mk('Head', neck);
  const bones = [root, pelvis, thigh, calf, foot, spine, up, low, hand, neck, head];
  root.updateMatrixWorld(true);
  const squelette = new Skeleton(bones);
  const positions: Vector3[] = [], poids: PoidsDuSommet[] = [];
  for (let i = 0; i < 90; i++) {
    const bi = 1 + Math.floor(rand() * (bones.length - 1)), b = bones[bi], pi = bones.indexOf(b.parent as Bone);
    positions.push(b.getWorldPosition(new Vector3()).add(new Vector3(rnd(0.05), rnd(0.05), rnd(0.05))));
    const w = i % 3 === 0 ? 1 : 0.3 + 0.6 * rand();
    poids.push(w === 1 ? [[bi, 1]] : [[bi, w], [pi, 1 - w]]);
  }
  const edges = new Set<string>();
  for (let i = 1; i < positions.length; i++) edges.add(`${i - 1},${i}`);
  for (let t = 0; t < 180; t++) { const a = Math.floor(rand() * 90), b = Math.floor(rand() * 90); if (a !== b) edges.add(`${Math.min(a, b)},${Math.max(a, b)}`); }
  const aretes = [...edges].map((s): Arete => { const [a, b] = s.split(',').map(Number); return [a, b]; });
  const silhouettes = NOMS_DES_SILHOUETTES.map((nom) => ({ nom, deltas: positions.map(() => new Vector3(rnd(0.03), rnd(0.03), rnd(0.03))) }));
  return { positions, aretes, poids, squelette, table: TABLE_DU_JOUET, silhouettes };
}

