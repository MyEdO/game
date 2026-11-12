/**
 * LA PILE DES COUCHES POSÉE SUR UNE SCÈNE three (#3842) : `resoudreLaPile` (`../pile.ts`) lue et rendue aux meshes
 * montés de l'évaluateur.
 */
import { BufferAttribute, Matrix3, Skeleton, Vector3, type Bone, type Mesh, type SkinnedMesh } from 'three';
import { resoudreLaPile, type BilanDePile, type MaillageDePile } from '../pile.ts';
import { indicesDe } from './gardes/traversee.ts';

const INFLUENCES = 4;
const recul = new Vector3();

function maillageDe(m: SkinnedMesh, repos: Float32Array): MaillageDePile {
  const { skinIndex, skinWeight } = m.geometry.attributes;
  const n = repos.length / 3;
  const os = new Uint16Array(n * INFLUENCES), poids = new Float32Array(n * INFLUENCES);
  for (let s = 0; s < n; s++) for (let k = 0; k < INFLUENCES; k++) {
    os[s * INFLUENCES + k] = skinIndex.getComponent(s, k);
    poids[s * INFLUENCES + k] = skinWeight.getComponent(s, k);
  }
  return { positions: Float32Array.from(repos), indices: Uint32Array.from(indicesDe(m, n)), os, poids, noms: m.skeleton.bones.map((b) => b.name) };
}

/** Résout la pile des `pieces` (les meshes de chacune) sur `fondue`, leurs positions monde au repos, formes posées, sans
 *  gabarit : ce que le montage fond. Rend à chaque mesh ses sommets reculés, ses poids, les os qu'il y gagne et ses
 *  triangles encore dessinés. `osDeChaine` nomme les os des chaînes de la base, `peaux` les meshes de la peau de la tenue
 *  (`peauDeLaTenue`, `corps.ts`). */
export function poserLaPile<P extends { readonly meshes: readonly SkinnedMesh[] }>(
  pieces: readonly P[], couvre: (e: P, f: P) => boolean, fondue: ReadonlyMap<Mesh, Float32Array>, osDeChaine: ReadonlySet<string>, peaux: readonly Mesh[],
): BilanDePile {
  const maillages = new Map<SkinnedMesh, MaillageDePile>();
  const piles = pieces.map((de) => ({ de, maillages: de.meshes.map((m) => { const mm = maillageDe(m, fondue.get(m) as Float32Array); maillages.set(m, mm); return mm; }) }));
  const avant = new Map([...maillages].map(([m, mm]) => [m, { positions: Float32Array.from(mm.positions), triangles: mm.indices.length }]));
  const os = new Map<string, readonly [Bone, SkinnedMesh, number]>();
  for (const m of maillages.keys()) m.skeleton.bones.forEach((b, i) => { if (!os.has(b.name)) os.set(b.name, [b, m, i]); });
  const parents = new Map([...os.values()].flatMap(([b]) => ((b.parent as Bone | null)?.isBone ? [[b.name, (b.parent as Bone).name] as const] : [])));
  const bilan = resoudreLaPile(piles, (e, f) => couvre(e.de, f.de), { parents, osDeChaine }, peaux.map((m) => fondue.get(m) as Float32Array));
  for (const [m, mm] of maillages) {
    const a = avant.get(m) as { positions: Float32Array; triangles: number };
    const n = mm.positions.length / 3;
    const g = m.geometry;
    const position = g.attributes.position;
    const neuve = new Float32Array(n * 3);
    const versLeMesh = new Matrix3().setFromMatrix4(m.matrixWorld).invert();
    for (let s = 0; s < n; s++) {
      recul.set(mm.positions[s * 3] - a.positions[s * 3], mm.positions[s * 3 + 1] - a.positions[s * 3 + 1], mm.positions[s * 3 + 2] - a.positions[s * 3 + 2]).applyMatrix3(versLeMesh);
      neuve[s * 3] = position.getX(s) + recul.x;
      neuve[s * 3 + 1] = position.getY(s) + recul.y;
      neuve[s * 3 + 2] = position.getZ(s) + recul.z;
    }
    g.setAttribute('position', new BufferAttribute(neuve, 3));
    g.setAttribute('skinIndex', new BufferAttribute(mm.os, INFLUENCES));
    g.setAttribute('skinWeight', new BufferAttribute(mm.poids, INFLUENCES));
    if (mm.indices.length !== a.triangles) g.setIndex(new BufferAttribute(mm.indices, 1));
    if (mm.noms.length > m.skeleton.bones.length) {
      const neufs = mm.noms.slice(m.skeleton.bones.length).map((nom) => os.get(nom) as readonly [Bone, SkinnedMesh, number]);
      m.bind(new Skeleton([...m.skeleton.bones, ...neufs.map(([b]) => b)], [...m.skeleton.boneInverses, ...neufs.map(([, de, i]) => de.skeleton.boneInverses[i])]), m.bindMatrix);
    }
  }
  return bilan;
}
