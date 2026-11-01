/**
 * GARDE DU SUIVI DU CORPS (#3205) : sur la scène montée, au repos et sans gabarit. Chaque sommet d'un mesh skinné
 * d'élément se lie une fois pour toutes au point le plus proche de la surface du corps ; sous chaque clé `gabarit_*` du
 * corps posée seule à 1, son déplacement se compare au déplacement interpolé au point lié. Un rigide n'est pas concerné.
 * `hotes/godot/pont/CONTRAT.md`, « Gabarit d'une base ». L'état des shape keys trouvé à l'entrée est restauré à la
 * sortie (`sousLesFormes`).
 */
import { Triangle, Vector3, type Mesh, type Object3D, type SkinnedMesh } from 'three';
import type { Ecart } from '../ecart.ts';
import { poseDeRepos, type Pose } from '../echantillonnage.ts';
import { PREFIXE_DES_CLES_DU_GABARIT } from '../../manifesteDeBase.ts';
import { SOL_TOLERANCE_M } from './piedsAuSol.ts';
import { sousLesFormes } from './silhouettes.ts';

/** L'écart de déplacement, en mètres, sous lequel un sommet suit le corps : `SOL_TOLERANCE_M`, distance que la chaîne
 *  tient pour nulle entre deux positions d'un sommet. */
export const ECART_DE_SUIVI_M = SOL_TOLERANCE_M;

const GARDE = 'suiviDuCorps';

/** Le point de la surface du corps auquel un sommet d'élément est lié : un triangle d'un mesh du corps, et les
 *  coordonnées barycentriques du point dans ce triangle. */
export interface PointLie {
  readonly mesh: string;
  readonly sommets: readonly [number, number, number];
  readonly barycentre: readonly [number, number, number];
}

interface TriangleDuCorps {
  readonly mesh: string;
  readonly sommets: readonly [number, number, number];
  readonly forme: Triangle;
}

const positionsDe = (pose: Pose, m: Mesh): Float32Array => {
  const p = pose.positions.get(m.name);
  if (!p) throw new Error(`${GARDE} : mesh absent ${m.name}`);
  return p;
};

function trianglesDuCorps(corps: readonly Mesh[], repos: Pose): TriangleDuCorps[] {
  const point = (p: Float32Array, i: number) => new Vector3(p[i * 3], p[i * 3 + 1], p[i * 3 + 2]);
  const coordonnees = new Vector3();
  return corps.flatMap((m) => {
    const p = positionsDe(repos, m);
    const { index } = m.geometry;
    const total = index ? index.count : p.length / 3;
    const triangles: TriangleDuCorps[] = [];
    for (let t = 0; t + 2 < total; t += 3) {
      const sommets: TriangleDuCorps['sommets'] = index ? [index.getX(t), index.getX(t + 1), index.getX(t + 2)] : [t, t + 1, t + 2];
      const forme = new Triangle(point(p, sommets[0]), point(p, sommets[1]), point(p, sommets[2]));
      if (forme.getArea() > 0 && forme.getBarycoord(forme.a, coordonnees)) triangles.push({ mesh: m.name, sommets, forme });
    }
    return triangles;
  });
}

/** Le point lié à chaque sommet de `sommets`, positions monde à plat, sur la surface de `corps` dans la pose `repos`. */
export function lierAuCorps(sommets: Float32Array, corps: readonly Mesh[], repos: Pose): PointLie[] {
  const triangles = trianglesDuCorps(corps, repos);
  if (!triangles.length) throw new Error(`${GARDE} : aucun triangle non dégénéré dans le corps`);
  const v = new Vector3(), proche = new Vector3(), retenu = new Vector3(), coordonnees = new Vector3();
  return Array.from({ length: sommets.length / 3 }, (_, i) => {
    v.set(sommets[i * 3], sommets[i * 3 + 1], sommets[i * 3 + 2]);
    let meilleur = triangles[0], distance = Infinity;
    for (const t of triangles) {
      const d = t.forme.closestPointToPoint(v, proche).distanceToSquared(v);
      if (d < distance) { distance = d; meilleur = t; retenu.copy(proche); }
    }
    meilleur.forme.getBarycoord(retenu, coordonnees);
    return { mesh: meilleur.mesh, sommets: meilleur.sommets, barycentre: [coordonnees.x, coordonnees.y, coordonnees.z] };
  });
}

/** Le point `lie` dans les positions monde `positions` du corps, par nom de mesh. */
export function pointSurLeCorps(lie: PointLie, positions: ReadonlyMap<string, Float32Array>): Vector3 {
  const p = positions.get(lie.mesh);
  if (!p) throw new Error(`${GARDE} : mesh absent ${lie.mesh}`);
  const point = new Vector3();
  lie.sommets.forEach((s, k) => { point.x += lie.barycentre[k] * p[s * 3]; point.y += lie.barycentre[k] * p[s * 3 + 1]; point.z += lie.barycentre[k] * p[s * 3 + 2]; });
  return point;
}

export function gardeSuiviDuCorps(scene: Object3D, corps: readonly Mesh[], elements: readonly SkinnedMesh[]): Ecart[] {
  const cles = [...new Set(corps.flatMap((m) => Object.keys(m.morphTargetDictionary ?? {})))].filter((nom) => nom.startsWith(PREFIXE_DES_CLES_DU_GABARIT));
  if (!cles.length || !elements.length) return [];
  return sousLesFormes(scene, cles, (poser) => {
    const reposDuCorps = poser({}, corps);
    const sujets = elements.map((mesh) => {
      const repos = positionsDe(poseDeRepos(scene, [mesh]), mesh);
      return { mesh, repos, lies: lierAuCorps(repos, corps, reposDuCorps) };
    });
    return cles.flatMap((cle) => {
      const duCorps = poser({ [cle]: 1 }, corps);
      return sujets.flatMap(({ mesh, repos, lies }): Ecart[] => {
        const sous = positionsDe(poseDeRepos(scene, [mesh]), mesh);
        let valeur = 0, pire = 0;
        lies.forEach((lie, i) => {
          const b = pointSurLeCorps(lie, duCorps.positions).sub(pointSurLeCorps(lie, reposDuCorps.positions));
          const ecart = Math.hypot(sous[i * 3] - repos[i * 3] - b.x, sous[i * 3 + 1] - repos[i * 3 + 1] - b.y, sous[i * 3 + 2] - repos[i * 3 + 2] - b.z);
          if (ecart > valeur) { valeur = ecart; pire = i; }
        });
        if (valeur <= ECART_DE_SUIVI_M) return [];
        const porte = mesh.morphTargetDictionary?.[cle] !== undefined;
        return [{ garde: GARDE, code: 'cle-non-suivie', mesh: mesh.name, valeur, seuil: ECART_DE_SUIVI_M, detail: `${cle} ${porte ? 'portée par' : 'absente de'} l’élément : écart au corps du sommet ${pire}, en m` }];
      });
    });
  }, (poids) => poids);
}
