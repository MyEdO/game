/**
 * GARDE DES MEMBRES DANS LE TRONC (#3806, #3810) : en clip, un avant-bras ou une main de la base n'entre pas dans son tronc.
 * Les meshes de zone (`extras.zone`, `scripts/personnage-3d/base/anatomie.py`) `ZONES_DES_MEMBRES` sont les sujets, ceux
 * de `ZONES_DU_TRONC` la surface du tronc, ouverte au cou, aux épaules et aux cuisses.
 *
 * La posture du tronc est la rotation moyenne de ses os depuis leur repos, pondérée par le poids de peau de chacun sur
 * ses sommets (`troncDe`). À chaque échantillon, tronc et sujets sont ramenés dans le repère du tronc au repos par
 * l'inverse de cette posture ; l'avant du tronc y est l'avant du corps au repos. Un sommet v d'un sujet est dans le
 * tronc si les deux demi-droites qui en partent vers l'avant et vers l'arrière du tronc coupent chacune sa surface un
 * nombre impair de fois : les ouvertures
 * du tronc regardent le haut, le bas et les côtés, qu'aucune de ces demi-droites ne traverse, quelle que soit sa
 * posture. Sa profondeur est la plus petite distance de v à un triangle du tronc à moins de `PORTEE_DU_VOISINAGE_M`,
 * sinon à la plus proche intersection de ces demi-droites. `membre-dans-le-tronc` si un sommet est plus profond que
 * `ECART_DE_SUIVI_M`, le contact de la peau, un écart par (sujet, clip), à son pire instant.
 */
import { Quaternion, Triangle, Vector3, type Mesh, type SkinnedMesh } from 'three';
import type { Ecart, LibelleDeMesh } from '../ecart.ts';
import { rotationLocale, type Echantillon, type Pose } from '../echantillonnage.ts';
import { ECART_DE_SUIVI_M } from './suiviDuCorps.ts';

export const ZONES_DES_MEMBRES: readonly string[] = ['avant_bras_g', 'avant_bras_d', 'main_g', 'main_d'];
export const ZONES_DU_TRONC: readonly string[] = ['torse', 'hanches'];

/** Le côté des cellules où se rangent les triangles du tronc, et la portée de la recherche de sa surface la plus proche. */
export const PORTEE_DU_VOISINAGE_M = 0.03;

/** Le décalage de la demi-droite, hors des arêtes et des sommets du tronc qu'elle toucherait sinon deux fois. */
const DECALAGE_M = 1.37e-6;

const GARDE = 'membres';

export interface MembreDansLeTronc {
  readonly membre: Mesh;
  readonly clip: string;
  readonly t: number;
  /** Le nombre de sommets plus profonds que la tolérance, et la plus grande profondeur, négative. */
  readonly sommets: number;
  readonly pire: number;
}

const forme = new Triangle(), proche = new Vector3(), v = new Vector3();

/** Un os du tronc : son poids total sur les sommets du tronc et l'inverse de sa rotation monde au repos. */
interface OsDuTronc {
  readonly nom: string;
  readonly poids: number;
  readonly reposInverse: Quaternion;
}

/** Les meshes du tronc et les os qui pèsent sur leurs sommets. */
export interface Tronc {
  readonly meshes: readonly Mesh[];
  readonly os: readonly OsDuTronc[];
}

/** Le tronc des `meshes` sur la pose de repos `repos`, `null` sans mesh : chaque os qui pèse sur leurs sommets, et son
 *  poids de peau total. */
export function troncDe(meshes: readonly Mesh[], repos: Pose): Tronc | null {
  if (!meshes.length) return null;
  const poidsParOs = new Map<string, number>();
  for (const m of meshes) {
    const { skeleton, geometry } = m as SkinnedMesh;
    const indices = geometry.attributes.skinIndex, poids = geometry.attributes.skinWeight;
    if (!skeleton || !indices || !poids) continue;
    for (let s = 0; s < indices.count; s++) for (let k = 0; k < indices.itemSize; k++) {
      const w = poids.getComponent(s, k);
      if (w <= 0) continue;
      const nom = skeleton.bones[indices.getComponent(s, k)].name;
      poidsParOs.set(nom, (poidsParOs.get(nom) ?? 0) + w);
    }
  }
  if (!poidsParOs.size) throw new Error(`${GARDE} : aucun os ne pèse sur le tronc ${meshes.map((m) => m.name).join(', ')}`);
  const os = [...poidsParOs].map(([nom, poids]) => ({ nom, poids, reposInverse: rotationLocale(repos, nom, undefined, new Quaternion()).invert() }));
  return { meshes, os };
}

const delta = new Quaternion(), premier = new Quaternion();

/** La posture du tronc à l'échantillon `e` : la moyenne, pondérée par leurs poids, des rotations monde de ses os depuis
 *  leur repos, alignées en signe sur la première, normalisée. */
function postureDuTronc(tronc: Tronc, e: Pose): Quaternion {
  const somme = new Quaternion(0, 0, 0, 0);
  tronc.os.forEach(({ nom, poids, reposInverse }, i) => {
    rotationLocale(e, nom, undefined, delta).multiply(reposInverse);
    if (i === 0) premier.copy(delta);
    const w = premier.dot(delta) >= 0 ? poids : -poids;
    somme.set(somme.x + w * delta.x, somme.y + w * delta.y, somme.z + w * delta.z, somme.w + w * delta.w);
  });
  return somme.normalize();
}

const cellule = (x: number): number => Math.floor(x / PORTEE_DU_VOISINAGE_M);

function ranger(grille: Map<string, number[]>, cle: string, t: number): void {
  const liste = grille.get(cle);
  if (liste) liste.push(t);
  else grille.set(cle, [t]);
}

/** Les triangles du tronc posé, ramenés au repère du tronc au repos, neuf coordonnées chacun, rangés par colonne
 *  avant-arrière, rangées sur les axes latéral et vertical, et par cellule. Au repère glTF du corps au repos, l'avant
 *  est +z, le haut +y, le latéral x. */
interface TroncPose {
  readonly sommets: Float32Array;
  readonly colonnes: Map<string, number[]>;
  readonly cellules: Map<string, number[]>;
  readonly min: Vector3;
  readonly max: Vector3;
  /** La rotation qui ramène une position monde de l'échantillon au repère du tronc au repos. */
  readonly retour: Quaternion;
}

function poserLeTronc(tronc: Tronc, e: Pose): TroncPose {
  const retour = postureDuTronc(tronc, e).invert();
  const coordonnees: number[] = [];
  for (const m of tronc.meshes) {
    const p = e.positions.get(m);
    if (!p) throw new Error(`${GARDE} : mesh absent ${m.name}`);
    const indices = m.geometry.index?.array ?? Uint32Array.from({ length: p.length / 3 }, (_, i) => i);
    for (let t = 0; t + 2 < indices.length; t += 3) {
      for (const s of [indices[t], indices[t + 1], indices[t + 2]]) {
        v.set(p[s * 3], p[s * 3 + 1], p[s * 3 + 2]).applyQuaternion(retour);
        coordonnees.push(v.x, v.y, v.z);
      }
    }
  }
  const sommets = Float32Array.from(coordonnees);
  const colonnes = new Map<string, number[]>(), cellules = new Map<string, number[]>();
  const min = new Vector3(Infinity, Infinity, Infinity), max = new Vector3(-Infinity, -Infinity, -Infinity);
  for (let t = 0; t < sommets.length / 9; t++) {
    const axe = (a: number, f: (...v: number[]) => number) => f(sommets[t * 9 + a], sommets[t * 9 + 3 + a], sommets[t * 9 + 6 + a]);
    const [x0, y0, z0, x1, y1, z1] = [axe(0, Math.min), axe(1, Math.min), axe(2, Math.min), axe(0, Math.max), axe(1, Math.max), axe(2, Math.max)];
    min.min(new Vector3(x0, y0, z0));
    max.max(new Vector3(x1, y1, z1));
    for (let i = cellule(x0); i <= cellule(x1); i++) for (let j = cellule(y0); j <= cellule(y1); j++) {
      ranger(colonnes, `${i},${j}`, t);
      for (let k = cellule(z0); k <= cellule(z1); k++) ranger(cellules, `${i},${j},${k}`, t);
    }
  }
  return { sommets, colonnes, cellules, min, max, retour };
}

function poserTriangle(s: Float32Array, t: number): void {
  forme.a.set(s[t * 9], s[t * 9 + 1], s[t * 9 + 2]);
  forme.b.set(s[t * 9 + 3], s[t * 9 + 4], s[t * 9 + 5]);
  forme.c.set(s[t * 9 + 6], s[t * 9 + 7], s[t * 9 + 8]);
}

/** La profondeur de `point`, au repère du tronc au repos, dans le tronc, positive, ou `null` s'il en est dehors. */
function profondeurDansLeTronc(tronc: TroncPose, point: Vector3): number | null {
  const { sommets } = tronc;
  const x = point.x + DECALAGE_M, y = point.y + DECALAGE_M;
  let derriere = 0, devant = 0, plusProche = Infinity;
  for (const t of tronc.colonnes.get(`${cellule(x)},${cellule(y)}`) ?? []) {
    const o = t * 9;
    const [ax, ay, bx, by, cx, cy] = [sommets[o], sommets[o + 1], sommets[o + 3], sommets[o + 4], sommets[o + 6], sommets[o + 7]];
    const aire = (bx - ax) * (cy - ay) - (cx - ax) * (by - ay);
    if (aire === 0) continue;
    const u = ((bx - x) * (cy - y) - (cx - x) * (by - y)) / aire;
    const w = ((cx - x) * (ay - y) - (ax - x) * (cy - y)) / aire;
    const r = 1 - u - w;
    if (u < 0 || w < 0 || r < 0) continue;
    const z = u * sommets[o + 2] + w * sommets[o + 5] + r * sommets[o + 8];
    if (z < point.z) derriere++;
    else devant++;
    plusProche = Math.min(plusProche, Math.abs(z - point.z));
  }
  if (derriere % 2 === 0 || devant % 2 === 0) return null;
  const [ci, cj, ck] = [cellule(point.x), cellule(point.y), cellule(point.z)];
  const vus = new Set<number>();
  for (let i = ci - 1; i <= ci + 1; i++) for (let j = cj - 1; j <= cj + 1; j++) for (let k = ck - 1; k <= ck + 1; k++) {
    for (const t of tronc.cellules.get(`${i},${j},${k}`) ?? []) {
      if (vus.has(t)) continue;
      vus.add(t);
      poserTriangle(sommets, t);
      plusProche = Math.min(plusProche, forme.closestPointToPoint(point, proche).distanceTo(point));
    }
  }
  return plusProche;
}

/** Les sujets de l'échantillon `e` qui entrent dans le tronc ; un sujet sans sommet au-delà de la tolérance n'y figure pas. */
export function mesurerMembres(membres: readonly Mesh[], tronc: Tronc | null, e: Echantillon): MembreDansLeTronc[] {
  if (!membres.length || !tronc) return [];
  const pose = poserLeTronc(tronc, e);
  return membres.flatMap((membre) => {
    const p = e.positions.get(membre);
    if (!p) throw new Error(`${GARDE} : mesh absent ${membre.name}`);
    let sommets = 0, pire = 0;
    for (let s = 0; s < p.length / 3; s++) {
      v.set(p[s * 3], p[s * 3 + 1], p[s * 3 + 2]).applyQuaternion(pose.retour);
      if (v.x < pose.min.x || v.y < pose.min.y || v.z < pose.min.z || v.x > pose.max.x || v.y > pose.max.y || v.z > pose.max.z) continue;
      const profondeur = profondeurDansLeTronc(pose, v);
      if (profondeur === null || profondeur <= ECART_DE_SUIVI_M) continue;
      sommets++;
      pire = Math.min(pire, -profondeur);
    }
    return sommets ? [{ membre, clip: e.clip, t: e.t, sommets, pire }] : [];
  });
}

/** Un écart par (sujet, clip), à l'instant de sa plus grande profondeur. */
export function gardeMembres(mesures: readonly MembreDansLeTronc[], libelle: LibelleDeMesh): Ecart[] {
  const pires = new Map<string, MembreDansLeTronc>();
  for (const m of mesures) {
    const k = `${libelle(m.membre)}|${m.clip}`;
    const avant = pires.get(k);
    if (!avant || m.pire < avant.pire) pires.set(k, m);
  }
  return [...pires.values()].map((m): Ecart => ({
    garde: GARDE, code: 'membre-dans-le-tronc', mesh: libelle(m.membre), clip: m.clip, t: m.t, valeur: m.pire, seuil: -ECART_DE_SUIVI_M,
    detail: `${m.sommets} sommet(s) de ${libelle(m.membre)} dans le tronc : profondeur la plus grande, négative, en m`,
  }));
}
