import type { Bone, Mesh, Object3D } from 'three';
import type { SceneChargee } from './chargement.ts';

const zoneDe = (m: Object3D): unknown => m.userData.zone ?? (m.parent && !(m.parent as Bone).isBone ? m.parent.userData.zone : undefined);

export function meshesDuCorps(base: Pick<SceneChargee, 'meshes' | 'skinnes'>): readonly Mesh[] {
  const zones = base.meshes.filter((m) => typeof zoneDe(m) === 'string');
  return zones.length ? zones : base.skinnes;
}
