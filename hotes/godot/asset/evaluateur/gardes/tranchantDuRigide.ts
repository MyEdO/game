/**
 * GARDE DU TRANCHANT D'UN RIGIDE TENU (#3319) : un rigide pendu à l'os de la prise `main` porte son tranchant sur le +Z
 * de la prise, du poignet vers les jointures, comme une lame dans le poing (`creer-un-personnage-3d`, procédure) : dans
 * le repère de la prise, chacune de ses primitives n'est pas plus étendue sur X, l'axe de la paume, que sur Z, à
 * `TOLERANCE_TRANCHANT_M` près. Une lame tournée d'un quart de tour frappe de plat. Un objet qui n'est pas une arme (un sac
 * rangé, son +Z sortant du corps) n'a pas de tranchant.
 */
import { Box3, Euler, Matrix4, Vector3, type Bone, type Mesh, type Object3D, type SkinnedMesh } from 'three';
import type { Attache } from '../../attache.ts';
import type { Ecart, LibelleDeMesh } from '../ecart.ts';

/** Écart admis, en mètres, de l'étendue sur X à celle sur Z : celui d'une poignée ronde. */
export const TOLERANCE_TRANCHANT_M = 0.002;

const versLaPrise = new Matrix4();
const boite = new Box3();
const point = new Vector3();
const taille = new Vector3();

/** Les écarts des rigides de `scene` pendus à l'os de la prise `prise`, mesurés dans son repère ; ceux d'`armes` seuls
 *  quand elle est donnée. */
export function gardeTranchantDuRigide(scene: Object3D, prise: Attache, libelle: LibelleDeMesh, armes?: ReadonlySet<Object3D>): Ecart[] {
  scene.updateMatrixWorld(true);
  const attache = new Matrix4().makeRotationFromEuler(new Euler(...prise.rotation, 'XYZ')).setPosition(...prise.position);
  const ecarts: Ecart[] = [];
  scene.traverse((n) => {
    if (!(n as Mesh).isMesh || (n as SkinnedMesh).isSkinnedMesh || (armes && !armes.has(n))) return;
    let os: Object3D | null = n.parent;
    while (os && !(os as Bone).isBone) os = os.parent;
    if (!os || os.name !== prise.os) return;
    const mesh = n as Mesh;
    versLaPrise.copy(os.matrixWorld).multiply(attache).invert().multiply(mesh.matrixWorld);
    const positions = mesh.geometry.getAttribute('position');
    boite.makeEmpty();
    for (let i = 0; i < positions.count; i++) boite.expandByPoint(point.fromBufferAttribute(positions, i).applyMatrix4(versLaPrise));
    boite.getSize(taille);
    const ecart = taille.x - taille.z;
    if (ecart > TOLERANCE_TRANCHANT_M) ecarts.push({ garde: 'tranchantDuRigide', code: 'tranchant-vers-la-paume', mesh: libelle(mesh), valeur: ecart, seuil: TOLERANCE_TRANCHANT_M, detail: `étendue de ${taille.x.toFixed(3)} m sur X (la paume) pour ${taille.z.toFixed(3)} m sur Z (les jointures), sous la prise ${prise.os}` });
  });
  return ecarts;
}
