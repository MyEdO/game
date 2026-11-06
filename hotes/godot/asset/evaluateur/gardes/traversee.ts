/**
 * GARDE DE LA TRAVERSÉE DES COUCHES (#2972, #3319) : en clip, une couche ne passe pas devant celle qui la couvre. Le
 * corps est sous toute couche ; un mesh skinné d'élément est sous ceux des éléments de couche plus extérieure (`COUCHES`,
 * `element.ts`) ; deux éléments de même couche ne se couvrent pas. Un mesh de zone (`extras.zone`) qu'un élément de
 * couche plus extérieure couvre (`couvre`) est masqué au montage (`sansLesZonesMasquees`,
 * `projet/scripts/montage_de_composition.gd`) : il n'est ni sujet ni couverture.
 *
 * Au repos, chaque sommet v d'un sujet, de normale n_v, se lie au triangle de sa couverture le plus proche dont il est
 * derrière, à moins de `PORTEE_DE_COUVERTURE_M`, tourné du même côté (n·n_v > 0), sa projection dans le triangle : le
 * point lié p, aux coordonnées barycentriques de la projection, suit la couverture ; une doublure tournée vers le corps
 * ne couvre rien. À chaque échantillon, l'écart signé e(v) = (p − v)·n, n la normale du triangle posé :
 * `couche-traversee` si un sommet a e(v) < −`ECART_DE_SUIVI_M`, un écart par (sujet, couverture, clip), à son pire
 * instant. Un sommet devant sa couverture dès le repos n'est lié à rien : il relève du montage, pas du mouvement.
 */
import { Triangle, Vector3, type Mesh, type SkinnedMesh } from 'three';
import type { Ecart, LibelleDeMesh } from '../ecart.ts';
import type { Echantillon, Pose } from '../echantillonnage.ts';
import { ECART_DE_SUIVI_M } from './suiviDuCorps.ts';
import { RANG_DU_CORPS } from '../../element.ts';

/** La distance, en mètres, au-delà de laquelle une couche n'en couvre plus une autre : l'épaisseur d'une manche bouffante. */
export const PORTEE_DE_COUVERTURE_M = 0.03;

const GARDE = 'traversee';

/** Les sommets d'un sujet liés sous une couverture : pour chaque sommet lié, son indice, les trois sommets du triangle
 *  de la couverture et les coordonnées barycentriques du point lié. */
export interface LiaisonDeCouches {
  readonly sujet: Mesh;
  readonly couverture: SkinnedMesh;
  readonly sommets: Uint32Array;
  readonly triangles: Uint32Array;
  readonly barycentres: Float32Array;
}

export interface TraverseeDUnEchantillon {
  readonly liaison: LiaisonDeCouches;
  readonly clip: string;
  readonly t: number;
  /** Le nombre de sommets au-delà de la tolérance, et l'écart signé le plus négatif. */
  readonly sommets: number;
  readonly pire: number;
}

const positionsDe = (pose: Pick<Pose, 'positions'>, m: Mesh): Float32Array => {
  const p = pose.positions.get(m);
  if (!p) throw new Error(`${GARDE} : mesh absent ${m.name}`);
  return p;
};

function indicesDe(m: Mesh, n: number): ArrayLike<number> {
  const { index } = m.geometry;
  return index ? index.array : Uint32Array.from({ length: n }, (_, i) => i);
}

const cellule = (x: number): number => Math.floor(x / PORTEE_DE_COUVERTURE_M);
const cle = (i: number, j: number, k: number): string => `${i},${j},${k}`;

/** Les triangles non dégénérés de `couverture`, rangés par cellule de `PORTEE_DE_COUVERTURE_M` de côté qu'ils touchent. */
function grilleDe(p: Float32Array, indices: ArrayLike<number>): Map<string, number[]> {
  const grille = new Map<string, number[]>();
  for (let t = 0; t + 2 < indices.length; t += 3) {
    const [a, b, c] = [indices[t], indices[t + 1], indices[t + 2]];
    const borne = (axe: number, f: (...v: number[]) => number) => cellule(f(p[a * 3 + axe], p[b * 3 + axe], p[c * 3 + axe]));
    const [x0, y0, z0, x1, y1, z1] = [borne(0, Math.min), borne(1, Math.min), borne(2, Math.min), borne(0, Math.max), borne(1, Math.max), borne(2, Math.max)];
    for (let i = x0; i <= x1; i++) for (let j = y0; j <= y1; j++) for (let k = z0; k <= z1; k++) {
      const liste = grille.get(cle(i, j, k));
      if (liste) liste.push(t);
      else grille.set(cle(i, j, k), [t]);
    }
  }
  return grille;
}

const forme = new Triangle(), normale = new Vector3(), v = new Vector3(), projection = new Vector3(), coordonnees = new Vector3();

function poserTriangle(p: Float32Array, a: number, b: number, c: number): boolean {
  forme.a.set(p[a * 3], p[a * 3 + 1], p[a * 3 + 2]);
  forme.b.set(p[b * 3], p[b * 3 + 1], p[b * 3 + 2]);
  forme.c.set(p[c * 3], p[c * 3 + 1], p[c * 3 + 2]);
  if (forme.getArea() <= 0) return false;
  forme.getNormal(normale);
  return true;
}

/** Les normales de sommet de `m` aux positions `p`, somme des normales de ses triangles pondérées par leur aire. */
function normalesDe(m: Mesh, p: Float32Array): Float32Array {
  const indices = indicesDe(m, p.length / 3);
  const normales = new Float32Array(p.length);
  for (let t = 0; t + 2 < indices.length; t += 3) {
    const sommets = [indices[t], indices[t + 1], indices[t + 2]];
    forme.a.set(p[sommets[0] * 3], p[sommets[0] * 3 + 1], p[sommets[0] * 3 + 2]);
    forme.b.set(p[sommets[1] * 3], p[sommets[1] * 3 + 1], p[sommets[1] * 3 + 2]);
    forme.c.set(p[sommets[2] * 3], p[sommets[2] * 3 + 1], p[sommets[2] * 3 + 2]);
    normale.subVectors(forme.c, forme.b).cross(projection.subVectors(forme.a, forme.b));
    for (const s of sommets) { normales[s * 3] += normale.x; normales[s * 3 + 1] += normale.y; normales[s * 3 + 2] += normale.z; }
  }
  return normales;
}

/** La liaison de `sujet` sous `couverture` dans la pose `repos`, ou `null` si aucun sommet n'est couvert. */
export function lierSous(sujet: Mesh, couverture: SkinnedMesh, repos: Pick<Pose, 'positions'>): LiaisonDeCouches | null {
  const ps = positionsDe(repos, sujet), pc = positionsDe(repos, couverture);
  const ns = normalesDe(sujet, ps);
  const indices = indicesDe(couverture, pc.length / 3);
  const grille = grilleDe(pc, indices);
  const sommets: number[] = [], triangles: number[] = [], barycentres: number[] = [];
  for (let s = 0; s < ps.length / 3; s++) {
    v.set(ps[s * 3], ps[s * 3 + 1], ps[s * 3 + 2]);
    const [nx, ny, nz] = [ns[s * 3], ns[s * 3 + 1], ns[s * 3 + 2]];
    let retenu = -1, distance = Infinity, bx = 0, by = 0, bz = 0;
    const [ci, cj, ck] = [cellule(v.x), cellule(v.y), cellule(v.z)];
    const vus = new Set<number>();
    for (let i = ci - 1; i <= ci + 1; i++) for (let j = cj - 1; j <= cj + 1; j++) for (let k = ck - 1; k <= ck + 1; k++) {
      for (const t of grille.get(cle(i, j, k)) ?? []) {
        if (vus.has(t)) continue;
        vus.add(t);
        if (!poserTriangle(pc, indices[t], indices[t + 1], indices[t + 2]) || normale.x * nx + normale.y * ny + normale.z * nz <= 0) continue;
        const e = projection.subVectors(forme.a, v).dot(normale);
        if (e <= 0 || e > PORTEE_DE_COUVERTURE_M || e >= distance) continue;
        projection.copy(v).addScaledVector(normale, e);
        if (!forme.getBarycoord(projection, coordonnees) || coordonnees.x < 0 || coordonnees.y < 0 || coordonnees.z < 0) continue;
        retenu = t; distance = e; bx = coordonnees.x; by = coordonnees.y; bz = coordonnees.z;
      }
    }
    if (retenu < 0) continue;
    sommets.push(s);
    triangles.push(indices[retenu], indices[retenu + 1], indices[retenu + 2]);
    barycentres.push(bx, by, bz);
  }
  if (!sommets.length) return null;
  return { sujet, couverture, sommets: Uint32Array.from(sommets), triangles: Uint32Array.from(triangles), barycentres: Float32Array.from(barycentres) };
}

/** Par zone, le rang le plus extérieur des éléments de `elements` qui la couvrent ; rend les meshes d'un rang donné
 *  que ne masque aucun élément de couche plus extérieure couvrant leur zone (`zoneDe`). */
export function sansLesZonesMasquees(elements: readonly { readonly rang: number; readonly couvre: readonly string[] }[], zoneDe: (m: Mesh) => string | undefined) {
  const couvrant = new Map<string, number>();
  for (const { rang, couvre } of elements) for (const z of couvre) couvrant.set(z, Math.max(couvrant.get(z) ?? RANG_DU_CORPS, rang));
  return <M extends Mesh>(meshes: readonly M[], rang: number): M[] => meshes.filter((m) => {
    const zone = zoneDe(m);
    return zone === undefined || (couvrant.get(zone) ?? RANG_DU_CORPS) <= rang;
  });
}

/** Les meshes skinnés d'un élément et le rang de sa couche dans `COUCHES`. */
export interface CoucheDElement {
  readonly rang: number;
  readonly meshes: readonly SkinnedMesh[];
}

/** Les liaisons au repos du corps sous chaque élément, et de chaque élément sous ceux de couche plus extérieure. */
export function lierLesCouches(corps: readonly Mesh[], elements: readonly CoucheDElement[], repos: Pick<Pose, 'positions'>): LiaisonDeCouches[] {
  return elements.flatMap(({ rang, meshes }) => {
    const sujets = [...corps, ...elements.filter((e) => e.rang < rang).flatMap((e) => e.meshes)];
    return meshes.flatMap((couverture) => sujets.flatMap((sujet) => lierSous(sujet, couverture, repos) ?? []));
  });
}

/** La traversée de chaque liaison dans l'échantillon `e` ; une liaison sans sommet au-delà de la tolérance n'y figure pas. */
export function mesurerTraversee(liaisons: readonly LiaisonDeCouches[], e: Echantillon): TraverseeDUnEchantillon[] {
  return liaisons.flatMap((liaison) => {
    const ps = positionsDe(e, liaison.sujet), pc = positionsDe(e, liaison.couverture);
    let sommets = 0, pire = 0;
    liaison.sommets.forEach((s, i) => {
      const [a, b, c] = [liaison.triangles[i * 3], liaison.triangles[i * 3 + 1], liaison.triangles[i * 3 + 2]];
      if (!poserTriangle(pc, a, b, c)) return;
      const [u, w, x] = [liaison.barycentres[i * 3], liaison.barycentres[i * 3 + 1], liaison.barycentres[i * 3 + 2]];
      projection.set(0, 0, 0).addScaledVector(forme.a, u).addScaledVector(forme.b, w).addScaledVector(forme.c, x);
      const ecart = projection.sub(v.set(ps[s * 3], ps[s * 3 + 1], ps[s * 3 + 2])).dot(normale);
      if (ecart >= -ECART_DE_SUIVI_M) return;
      sommets++;
      pire = Math.min(pire, ecart);
    });
    return sommets ? [{ liaison, clip: e.clip, t: e.t, sommets, pire }] : [];
  });
}

/** Un écart par (sujet, couverture, clip), à l'instant de son écart signé le plus négatif. */
export function gardeTraversee(mesures: readonly TraverseeDUnEchantillon[], libelle: LibelleDeMesh): Ecart[] {
  const pires = new Map<string, TraverseeDUnEchantillon>();
  for (const m of mesures) {
    const k = `${libelle(m.liaison.sujet)}|${libelle(m.liaison.couverture)}|${m.clip}`;
    const avant = pires.get(k);
    if (!avant || m.pire < avant.pire) pires.set(k, m);
  }
  return [...pires.values()].map((m): Ecart => ({
    garde: GARDE, code: 'couche-traversee', mesh: libelle(m.liaison.couverture), clip: m.clip, t: m.t, valeur: m.pire, seuil: -ECART_DE_SUIVI_M,
    detail: `${m.sommets} sommet(s) de ${libelle(m.liaison.sujet)}, sur ${m.liaison.sommets.length} couverts, passent devant la couverture : écart signé le plus négatif, en m`,
  }));
}
