import { BufferGeometry, Float32BufferAttribute, Matrix4, Skeleton, SkinnedMesh, Uint16BufferAttribute, Vector3, type Bone, type Mesh, type Object3D } from 'three';
import { PREFIXE_DES_CLES_DU_GABARIT, type CandidatDAppui } from '../manifesteDeBase.ts';

export function copierSommet(mesh: SkinnedMesh, indice: number): CandidatDAppui {
  const g = mesh.geometry, p = new Vector3().fromBufferAttribute(g.attributes.position, indice).applyMatrix4(mesh.bindMatrix);
  const os: { nom: string; poids: number }[] = [];
  for (let k = 0; k < g.attributes.skinWeight.itemSize; k++) {
    const poids = g.attributes.skinWeight.getComponent(indice, k);
    if (poids > 0) os.push({ nom: mesh.skeleton.bones[g.attributes.skinIndex.getComponent(indice, k)].name, poids });
  }
  const deltas = Object.fromEntries(Object.entries(mesh.morphTargetDictionary ?? {}).flatMap(([nom, i]) => {
    const attribut = g.morphAttributes.position?.[i];
    if (!attribut) throw new Error(`appuis : delta absent ${nom}`);
    const d = new Vector3().fromBufferAttribute(attribut, indice);
    if (!g.morphTargetsRelative) d.sub(new Vector3().fromBufferAttribute(g.attributes.position, indice));
    const m = mesh.bindMatrix.clone().setPosition(0, 0, 0);
    const delta = d.applyMatrix4(m).toArray() as [number, number, number];
    return delta.every((v) => v === 0) ? [] : [[nom, delta]];
  }));
  return { position: p.toArray(), os, deltas };
}

export function peauxDesCandidats(scene: Object3D, candidats: readonly CandidatDAppui[], source?: Skeleton) {
  const bones: Bone[] = [], sources: Mesh[] = [], inverses = new Map<string, Matrix4>();
  source?.bones.forEach((b, i) => inverses.set(b.name, source.boneInverses[i].clone()));
  scene.updateMatrixWorld(true);
  scene.traverse((n) => {
    if ((n as Bone).isBone) bones.push(n as Bone);
    if ((n as Mesh).isMesh) sources.push(n as Mesh);
    if ((n as SkinnedMesh).isSkinnedMesh) {
      const s = (n as SkinnedMesh).skeleton;
      s.bones.forEach((b, i) => {
        const avant = inverses.get(b.name);
        if (!source && avant && avant.elements.some((v, k) => Math.abs(v - s.boneInverses[i].elements[k]) > 1e-10)) throw new Error(`appuis.plusBas : binds ambigus pour ${b.name}, squelette de base attendu`);
        if (!avant) inverses.set(b.name, s.boneInverses[i].clone());
      });
    }
  });
  const noms = [...new Set(candidats.flatMap((c) => Object.keys(c.deltas)))];
  for (const c of candidats) for (const o of c.os) if (!bones.some((b) => b.name === o.nom)) throw new Error(`appuis.plusBas : os absent ${o.nom}`);
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(candidats.flatMap((c) => [...c.position]), 3));
  g.setAttribute('skinIndex', new Uint16BufferAttribute(candidats.flatMap((c) => [0, 1, 2, 3].map((i) => c.os[i] ? bones.findIndex((b) => b.name === c.os[i].nom) : 0)), 4));
  g.setAttribute('skinWeight', new Float32BufferAttribute(candidats.flatMap((c) => [0, 1, 2, 3].map((i) => c.os[i]?.poids ?? 0)), 4));
  g.morphTargetsRelative = true;
  g.morphAttributes.position = noms.map((nom) => Object.assign(new Float32BufferAttribute(candidats.flatMap((c) => [...(c.deltas[nom] ?? [0, 0, 0])]), 3), { name: nom }));
  const original = new Skeleton(bones, bones.map((b) => inverses.get(b.name) ?? b.matrixWorld.clone().invert()));
  const neutre = new SkinnedMesh(g), courante = new SkinnedMesh(g);
  neutre.bind(original, new Matrix4());
  courante.bind(new Skeleton(bones, original.boneInverses.map((m) => m.clone())), new Matrix4());
  const synchroniser = () => {
    for (const [i, nom] of noms.entries()) {
      const source = sources.find((m) => m.morphTargetDictionary?.[nom] !== undefined);
      const poids = source?.morphTargetInfluences?.[source.morphTargetDictionary?.[nom] ?? -1] ?? 0;
      courante.morphTargetInfluences![i] = poids;
      neutre.morphTargetInfluences![i] = nom.startsWith(PREFIXE_DES_CLES_DU_GABARIT) ? 0 : poids;
    }
  };
  return { neutre, courante, synchroniser };
}

export function hauteurDesCandidats(scene: Object3D, mesh: SkinnedMesh): number {
  scene.updateMatrixWorld(true);
  const p = new Vector3(); let y = Infinity;
  for (let i = 0; i < mesh.geometry.attributes.position.count; i++) y = Math.min(y, mesh.getVertexPosition(i, p).y);
  return y;
}
