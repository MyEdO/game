/**
 * LE DESSUS D'UNE CASE EN VOLUME (#3476, décision 6) : la hauteur de jeu d'une case (`heightAt`) est celle de son
 * CENTRE ; entre deux cases d'un lien franchissable (`gradeBetween`) que nul mur ne sépare, le dessus se raccorde d'un
 * centre à l'autre — en pente sur un sol naturel, en marches sur un sol bâti (`terrainBuilt`), le long de la volée
 * seule (`raccordeLeLongDeLaVolee`). Chaque quart de case est le carreau bilinéaire des centres de ses quatre cases (la
 * case, ses deux voisines d'arête, la diagonale) ; une voisine que la case ne raccorde pas y compte à la hauteur de la
 * case. PUR, en unités de grille + mètres.
 */
import { edgeOf, heightAt, tileAt, type SceneDuVolume } from '../scene';
import { aretesA } from '../wallIndex';
import { gradeBetween } from '../relief';
import { estAbsent, terrainBuilt, terrainSolidHeightM } from '../terrain';
import type { Face, GP } from './types';

/** Hauteur (m) d'une contremarche d'escalier dessinée sur un sol bâti. Choix de rendu : aucune règle ne la chiffre. */
export const CONTREMARCHE_M = 0.2;
/** Subdivisions par côté d'une case en marches (giron de 0,2 m à 2 m/case) et d'une case en pente. */
const DIVISIONS_MARCHES = 10;
const DIVISIONS_PENTE = 4;

/** Hauteur d'AFFICHAGE (m) d'une surface = hauteur de jeu (`heightAt`, vérité INTOUCHÉE) + le BLOC PLEIN
 *  éventuel du terrain (`solidHeightM`, ex. mur), qui s'ajoute à la hauteur propre de la case. Seul le volume la lit :
 *  aucun code de combat ne voit la hauteur du bloc. */
export function displayHeightAt(scene: SceneDuVolume, x: number, y: number, z: number): number {
  return heightAt(scene, x, y, z) + terrainSolidHeightM(tileAt(scene, x, y, z));
}

/** La case (x,y) de la couche z porte-t-elle un sol, dans la grille ? */
export function presenteDansLaGrille(scene: SceneDuVolume, x: number, y: number, z: number): boolean {
  const { w, h } = scene.dimensions;
  return x >= 0 && y >= 0 && x < w && y < h && !estAbsent(tileAt(scene, x, y, z));
}

/** Deux cases voisines de la couche z se rejoignent-elles à pied ? Un bloc plein n'en rejoint aucune, ni un segment
 *  posé sur leur côté commun (`aretesA`), mur ou porte, ouverte ou non : le sol ne passe pas sous un mur. */
export function rejointAPied(scene: SceneDuVolume, ax: number, ay: number, bx: number, by: number, z: number): boolean {
  if (!presenteDansLaGrille(scene, ax, ay, z) || !presenteDansLaGrille(scene, bx, by, z)) return false;
  const cote = edgeOf(ax, ay, bx, by);
  if (cote && aretesA(scene, cote.x, cote.y, cote.side, z).length > 0) return false;
  if (terrainSolidHeightM(tileAt(scene, ax, ay, z)) > 0 || terrainSolidHeightM(tileAt(scene, bx, by, z)) > 0) return false;
  return gradeBetween(displayHeightAt(scene, ax, ay, z), displayHeightAt(scene, bx, by, z)) !== 'cliff';
}

/** Hauteurs (m) des trois autres centres d'un quart de case : voisine d'arête est/ouest, voisine d'arête nord/sud,
 *  diagonale. */
interface Quart {
  ex: number;
  ny: number;
  diag: number;
}

/** Le dessus d'une case : sa hauteur au centre, ses quatre quarts, et son régime. */
export interface Dessus {
  x: number;
  y: number;
  h: number;
  /** Quarts indexés par `(sx > 0 ? 1 : 0) + (sy > 0 ? 2 : 0)` : NO, NE, SO, SE. */
  quarts: Quart[];
  /** Le dessus n'est pas plat. */
  pente: boolean;
  /** Pente d'un sol bâti : dessinée en marches. */
  marches: boolean;
  divisions: number;
}

const indiceDuQuart = (u: number, v: number): number => (u >= 0 ? 1 : 0) + (v >= 0 ? 2 : 0);

/** La case (x,y,z) est-elle une marche de volée le long de l'axe (ax, ay) : rejoint à pied ses deux voisines sur cet axe,
 *  l'une plus basse, l'autre plus haute qu'elle ? */
function traverseeLeLongDe(scene: SceneDuVolume, x: number, y: number, z: number, ax: number, ay: number): boolean {
  if (!rejointAPied(scene, x, y, x - ax, y - ay, z) || !rejointAPied(scene, x, y, x + ax, y + ay, z)) return false;
  const h = displayHeightAt(scene, x, y, z);
  return Math.sign(displayHeightAt(scene, x - ax, y - ay, z) - h) * Math.sign(displayHeightAt(scene, x + ax, y + ay, z) - h) < 0;
}

/** Sur un sol bâti, la case (x,y,z) se raccorde-t-elle à sa voisine (x+dx, y+dy), sur un axe : le long d'une volée
 *  seulement, quand l'une des deux est une marche de cette volée sur cet axe (`traverseeLeLongDe`) et que la case n'est
 *  pas la marche d'une volée de l'autre axe. Un palier, le sol au flanc d'une volée ou une estrade restent plats : la
 *  contremarche de leur arête comble l'écart. */
function raccordeLeLongDeLaVolee(scene: SceneDuVolume, x: number, y: number, z: number, dx: number, dy: number): boolean {
  const [ax, ay] = [Math.abs(dx), Math.abs(dy)];
  if (traverseeLeLongDe(scene, x, y, z, ay, ax)) return false;
  return traverseeLeLongDe(scene, x, y, z, ax, ay) || traverseeLeLongDe(scene, x + dx, y + dy, z, ax, ay);
}

/** Le dessus de la case (x,y,z) présente. */
export function dessusDe(scene: SceneDuVolume, x: number, y: number, z: number): Dessus {
  const h = displayHeightAt(scene, x, y, z);
  const bati = terrainBuilt(tileAt(scene, x, y, z));
  const raccorde = (dx: number, dy: number): boolean =>
    rejointAPied(scene, x, y, x + dx, y + dy, z) && (!bati || raccordeLeLongDeLaVolee(scene, x, y, z, dx, dy));
  const quarts: Quart[] = [];
  for (const sy of [-1, 1]) for (const sx of [-1, 1]) {
    const l1 = raccorde(sx, 0);
    const l2 = raccorde(0, sy);
    const ex = l1 ? displayHeightAt(scene, x + sx, y, z) : h;
    const ny = l2 ? displayHeightAt(scene, x, y + sy, z) : h;
    const enCarre = l1 && l2 && rejointAPied(scene, x + sx, y, x + sx, y + sy, z) && rejointAPied(scene, x, y + sy, x + sx, y + sy, z);
    quarts.push({ ex, ny, diag: enCarre ? displayHeightAt(scene, x + sx, y + sy, z) : ex + ny - h });
  }
  const pente = quarts.some((q) => [q.ex, q.ny, q.diag].some((v) => Math.abs(v - h) > 1e-6));
  const marches = pente && bati;
  return { x, y, h, quarts, pente, marches, divisions: marches ? DIVISIONS_MARCHES : pente ? DIVISIONS_PENTE : 1 };
}

/** Hauteur lisse du dessus au point local (u,v) ∈ [−½, ½]², centre de la case en (0,0). */
export function hauteurLisse(d: Dessus, u: number, v: number): number {
  const q = d.quarts[indiceDuQuart(u, v)];
  const a = Math.abs(u), b = Math.abs(v);
  return (1 - a) * (1 - b) * d.h + a * (1 - b) * q.ex + (1 - a) * b * q.ny + a * b * q.diag;
}

/** Hauteur d'une marche (i,j) de la grille de `d.divisions` côtés : la pente à son centre, au pas de contremarche
 *  compté depuis le centre de la case. */
export function hauteurDeMarche(d: Dessus, i: number, j: number): number {
  const n = d.divisions;
  const pente = hauteurLisse(d, (i + 0.5) / n - 0.5, (j + 0.5) / n - 0.5);
  return d.h + Math.round((pente - d.h) / CONTREMARCHE_M) * CONTREMARCHE_M;
}

/** Hauteur du dessus au point local (u,v) : la marche qui le porte, ou la pente lisse. */
export function hauteurDuDessus(d: Dessus, u: number, v: number): number {
  if (!d.pente) return d.h;
  if (!d.marches) return hauteurLisse(d, u, v);
  const n = d.divisions;
  const rang = (t: number) => Math.min(n - 1, Math.max(0, Math.floor((t + 0.5) * n)));
  return hauteurDeMarche(d, rang(u), rang(v));
}

type Point = { x: number; y: number };
/** Segments d'échantillonnage d'une arête : multiple commun des subdivisions d'une case en marches et en pente. */
const SEGMENTS_D_ARETE = 20;
/** Écart (m) en deçà duquel deux bords se rejoignent. */
const JOINT_M = 1e-4;

const sur = (A: Point, B: Point, t: number, h: number): GP => ({ x: A.x + (B.x - A.x) * t, y: A.y + (B.y - A.y) * t, h });

/** Bord du dessus `d` le long de l'arête A→B (coins en unités de grille) : par segment, la hauteur à ses deux bouts —
 *  celle de la marche qu'il borde, ou la pente. */
export function profilDArete(d: Dessus, A: Point, B: Point): [number, number][] {
  return Array.from({ length: SEGMENTS_D_ARETE }, (_, k) => {
    const [t0, t1] = [k / SEGMENTS_D_ARETE, (k + 1) / SEGMENTS_D_ARETE];
    const enLocal = (t: number): [number, number] => { const p = sur(A, B, t, 0); return [p.x - d.x, p.y - d.y]; };
    if (d.marches) {
      const m = hauteurDuDessus(d, ...enLocal((t0 + t1) / 2));
      return [m, m];
    }
    return [hauteurDuDessus(d, ...enLocal(t0)), hauteurDuDessus(d, ...enLocal(t1))];
  });
}

/** Faces verticales de l'arête A→B là où le bord `haut` dépasse le bord `bas` : un quad [haut-A, haut-B, bas-B, bas-A]
 *  par segment, les segments de mêmes hauteurs constantes fondus en un seul, un triangle là où les bords se croisent. */
export function parois(A: Point, B: Point, haut: [number, number][], bas: [number, number][]): GP[][] {
  const out: GP[][] = [];
  let fondu: { t0: number; h: number; b: number } | null = null;
  const clore = (t1: number) => {
    if (fondu) out.push([sur(A, B, fondu.t0, fondu.h), sur(A, B, t1, fondu.h), sur(A, B, t1, fondu.b), sur(A, B, fondu.t0, fondu.b)]);
    fondu = null;
  };
  haut.forEach(([c0, c1], k) => {
    const [n0, n1] = bas[k];
    const [t0, t1] = [k / haut.length, (k + 1) / haut.length];
    const [d0, d1] = [c0 - n0, c1 - n1];
    const constant = c0 === c1 && n0 === n1;
    if (!(constant && d0 > JOINT_M && fondu && fondu.h === c0 && fondu.b === n0)) clore(t0);
    if (d0 <= JOINT_M && d1 <= JOINT_M) return;
    if (d0 > JOINT_M && d1 > JOINT_M) {
      if (constant) fondu ??= { t0, h: c0, b: n0 };
      else out.push([sur(A, B, t0, c0), sur(A, B, t1, c1), sur(A, B, t1, n1), sur(A, B, t0, n0)]);
      return;
    }
    const s = d0 / (d0 - d1);
    const tm = t0 + s * (t1 - t0), hm = c0 + s * (c1 - c0);
    out.push(d0 > JOINT_M
      ? [sur(A, B, t0, c0), sur(A, B, tm, hm), sur(A, B, t0, n0)]
      : [sur(A, B, tm, hm), sur(A, B, t1, c1), sur(A, B, t1, n1)]);
  });
  clore(1);
  return out;
}

/** Faces du dessus de la case, matière = son terrain : la dalle plate, la pente en triangles, ou les marches (girons
 *  fondus par rangée, contremarches fondues le long de leur ligne), rangées de bas en haut. */
export function facesDuDessus(d: Dessus, terrain: string): Face[] {
  const material = { domain: 'terrain' as const, id: terrain };
  const face = (poly: GP[]): Face => ({ poly, material, oriented: false });
  const { x, y, h } = d;
  if (!d.pente)
    return [face([{ x: x - 0.5, y: y - 0.5, h }, { x: x + 0.5, y: y - 0.5, h }, { x: x + 0.5, y: y + 0.5, h }, { x: x - 0.5, y: y + 0.5, h }])];
  const n = d.divisions;
  const bord = (i: number) => i / n - 0.5;
  if (!d.marches) {
    const point = (i: number, j: number): GP => ({ x: x + bord(i), y: y + bord(j), h: hauteurLisse(d, bord(i), bord(j)) });
    return Array.from({ length: n * n }, (_, k) => [k % n, Math.floor(k / n)]).flatMap(([i, j]) => [
      face([point(i, j), point(i + 1, j), point(i + 1, j + 1)]),
      face([point(i, j), point(i + 1, j + 1), point(i, j + 1)]),
    ]);
  }
  const q = Array.from({ length: n }, (_, j) => Array.from({ length: n }, (_, i) => hauteurDeMarche(d, i, j)));
  const rangees: { cle: number; face: Face }[] = [];
  for (let j = 0; j < n; j++)
    for (let i0 = 0; i0 < n;) {
      let i1 = i0 + 1;
      while (i1 < n && q[j][i1] === q[j][i0]) i1++;
      const m = q[j][i0];
      rangees.push({ cle: m, face: face([{ x: x + bord(i0), y: y + bord(j), h: m }, { x: x + bord(i1), y: y + bord(j), h: m }, { x: x + bord(i1), y: y + bord(j + 1), h: m }, { x: x + bord(i0), y: y + bord(j + 1), h: m }]) });
      i0 = i1;
    }
  // Contremarches : sur chaque ligne intérieure de la grille, de la plus haute à la plus basse des deux marches qu'elle
  // sépare, fondues tant que ces deux hauteurs restent les mêmes.
  for (const sens of ['x', 'y'] as const)
    for (let l = 1; l < n; l++) {
      const de = (k: number): [number, number] => (sens === 'x' ? [q[k][l - 1], q[k][l]] : [q[l - 1][k], q[l][k]]);
      const coin = (k: number): Point => (sens === 'x' ? { x: x + bord(l), y: y + bord(k) } : { x: x + bord(k), y: y + bord(l) });
      for (let k0 = 0; k0 < n;) {
        const [a, b] = de(k0);
        let k1 = k0 + 1;
        while (k1 < n && de(k1)[0] === a && de(k1)[1] === b) k1++;
        if (a !== b) {
          const [hi, lo] = [Math.max(a, b), Math.min(a, b)];
          const [P, Q] = [coin(k0), coin(k1)];
          rangees.push({ cle: lo + CONTREMARCHE_M / 2, face: face([{ ...P, h: hi }, { ...Q, h: hi }, { ...Q, h: lo }, { ...P, h: lo }]) });
        }
        k0 = k1;
      }
    }
  return rangees.sort((a, b) => a.cle - b.cle).map((r) => r.face);
}
