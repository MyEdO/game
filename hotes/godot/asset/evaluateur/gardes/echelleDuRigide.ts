/**
 * GARDE DE L'ÉCHELLE D'UN RIGIDE TENU (#2972, G13) : un nœud rigide dont l'os le plus proche est un os de prise garde,
 * gabarit appliqué, une échelle monde de 1 à `TOLERANCE_ECHELLE_RIGIDE` près sur chaque axe.
 */
import { Vector3, type Bone, type Mesh, type Object3D, type SkinnedMesh } from 'three';
import type { Ecart } from '../ecart.ts';

export const TOLERANCE_ECHELLE_RIGIDE = 0.01;

/** Un rigide tenu : son nom, l'os de prise qui le porte, son échelle monde. */
export interface RigideTenu {
  readonly nom: string;
  readonly os: string;
  readonly echelle: readonly [number, number, number];
}

const echelle = new Vector3();

/** Les rigides de `scene` dont l'os le plus proche est l'un de `prises`, avec leur échelle monde courante. */
export function rigidesTenus(scene: Object3D, prises: ReadonlySet<string>): RigideTenu[] {
  scene.updateMatrixWorld(true);
  const tenus: RigideTenu[] = [];
  scene.traverse((n) => {
    if (!(n as Mesh).isMesh || (n as SkinnedMesh).isSkinnedMesh) return;
    let os: Object3D | null = n.parent;
    while (os && !(os as Bone).isBone) os = os.parent;
    if (!os || !prises.has(os.name)) return;
    n.getWorldScale(echelle);
    tenus.push({ nom: n.name, os: os.name, echelle: [echelle.x, echelle.y, echelle.z] });
  });
  return tenus;
}

export function gardeEchelleDuRigide(rigides: readonly RigideTenu[]): Ecart[] {
  return rigides.flatMap((r) => {
    const ecart = Math.max(...r.echelle.map((e) => Math.abs(e - 1)));
    return ecart > TOLERANCE_ECHELLE_RIGIDE
      ? [{ garde: 'echelleDuRigide', code: 'echelle-du-rigide', mesh: r.nom, valeur: ecart, seuil: TOLERANCE_ECHELLE_RIGIDE, detail: `échelle monde (${r.echelle.map((e) => e.toFixed(4)).join(', ')}) sous la prise ${r.os}` }]
      : [];
  });
}
