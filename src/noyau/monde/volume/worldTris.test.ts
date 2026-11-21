import { describe, expect, it } from 'vitest';
import { trianglesDuPolygone, type Vec3, type WorldPoly } from './worldTris';

/**
 * Triangulation d'une face du pivot (#4471) : une face est plane et simple, pas toujours convexe — un pan de toit
 * fusionné en L en est une. Ses triangles couvrent exactement le polygone : aucune aire hors de lui, aucun recouvrement.
 */

/** Le point `(x, z)` du plan de toit qui monte de `pente` vers +x, en repère three (Y = haut). */
const surLePan = (pente: number) => ([x, z]: [number, number]): Vec3 => ({ x, y: 4 + pente * x, z });
/** Aire (projetée sur XZ) signée d'un contour, positive dans le sens du contour du polygone de référence. */
const aireXZ = (pts: readonly Vec3[]) => pts.reduce((s, a, i) => {
  const b = pts[(i + 1) % pts.length];
  return s + a.x * b.z - b.x * a.z;
}, 0) / 2;
const dedans = (poly: WorldPoly, x: number, z: number) => {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.z > z) !== (b.z > z) && x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x) c = !c;
  }
  return c;
};

/** Le contour, sens direct en XZ, d'un polyomino `cases` (« x,z ») sans trou ni sommet pincé, ses sommets alignés gardés
 *  ou non ; `null` s'il en a. */
function contourDe(cases: ReadonlySet<string>, alignes: boolean): [number, number][] | null {
  const suivant = new Map<string, [number, number][]>();
  let aretes = 0;
  const arete = (a: [number, number], b: [number, number]) => {
    (suivant.get(a.join()) ?? suivant.set(a.join(), []).get(a.join())!).push(b);
    aretes++;
  };
  for (const k of cases) {
    const [x, z] = k.split(',').map(Number);
    const a = (dx: number, dz: number) => cases.has(`${x + dx},${z + dz}`);
    if (!a(0, -1)) arete([x, z], [x + 1, z]);
    if (!a(1, 0)) arete([x + 1, z], [x + 1, z + 1]);
    if (!a(0, 1)) arete([x + 1, z + 1], [x, z + 1]);
    if (!a(-1, 0)) arete([x, z + 1], [x, z]);
  }
  if ([...suivant.values()].some((v) => v.length > 1)) return null;
  const depart = suivant.keys().next().value!.split(',').map(Number) as [number, number];
  const boucle: [number, number][] = [depart];
  for (let p = suivant.get(depart.join())![0]; p.join() !== depart.join(); p = suivant.get(p.join())![0]) boucle.push(p);
  if (boucle.length !== aretes) return null;
  return alignes ? boucle : boucle.filter((p, i) => {
    const a = boucle[(i + boucle.length - 1) % boucle.length], b = boucle[(i + 1) % boucle.length];
    return (p[0] - a[0]) * (b[1] - p[1]) - (p[1] - a[1]) * (b[0] - p[0]) !== 0;
  });
}

/** Les cases « x,z » d'une union de rectangles. */
const casesDe = (rects: { x: number; y: number; w: number; h: number }[]) =>
  new Set(rects.flatMap(({ x, y, w, h }) => [...Array(w * h).keys()].map((i) => `${x + (i % w)},${y + Math.floor(i / w)}`)));

/** La triangulation de `poly` couvre exactement la face : `n − 2` triangles non dégénérés, chacun dans le sens de la
 *  face et dedans, d'aire totale celle de la face. */
function couvreLaFace(poly: WorldPoly): void {
  const tris = trianglesDuPolygone(poly);
  const aire = aireXZ(poly);
  expect(tris).toHaveLength(poly.length - 2);
  for (const t of tris) {
    expect(Math.abs(aireXZ(t))).toBeGreaterThan(1e-9);
    expect(Math.sign(aireXZ(t))).toBe(Math.sign(aire));
    expect(dedans(poly, (t[0].x + t[1].x + t[2].x) / 3, (t[0].z + t[1].z + t[2].z) / 3)).toBe(true);
  }
  expect(tris.reduce((s, t) => s + Math.abs(aireXZ(t)), 0)).toBeCloseTo(Math.abs(aire), 9);
}

const FACES: { nom: string; poly: WorldPoly }[] = [
  // L dont le premier sommet ne voit pas tout le contour : l'éventail depuis lui déborde par l'encoche.
  { nom: 'L horizontal', poly: ([[0, 0], [6, 0], [6, 2], [2, 2], [2, 6], [0, 6]] as [number, number][]).map(surLePan(0)).reverse() },
  { nom: 'L de pan incliné', poly: ([[6, 0], [6, 2], [2, 2], [2, 6], [0, 6], [0, 0]] as [number, number][]).map(surLePan(0.5)) },
  { nom: 'pan de La Diligence (z0, versant est)', poly: ([[72, 64], [77, 59], [77, 83], [70, 76], [72, 74]] as [number, number][]).map(surLePan(-0.33)) },
  // T dont un sommet tombe sur le bord d'une oreille : la diagonale y passerait.
  { nom: 'T, sommets alignés gardés', poly: contourDe(casesDe([{ x: 8, y: 3, w: 1, h: 5 }, { x: 6, y: 6, w: 5, h: 2 }]), true)!.map(surLePan(0.5)) },
];

describe('trianglesDuPolygone — une face simple non convexe (#4471)', () => {
  it.each(FACES)('$nom : triangles de même sens que la face, dans la face, d’aire totale celle de la face', ({ poly }) => couvreLaFace(poly));

  it('tout polyomino sans trou, sommets alignés gardés ou non, dans les deux sens et depuis chaque sommet', () => {
    let graine = 12345;
    const hasard = () => (graine = (graine * 1103515245 + 12345) % 2147483648) / 2147483648;
    let faces = 0;
    for (let essai = 0; essai < 300; essai++) {
      const cases = new Set(['0,0']);
      for (const taille = 3 + Math.floor(hasard() * 12); cases.size < taille;) {
        const [x, z] = [...cases][Math.floor(hasard() * cases.size)].split(',').map(Number);
        const [dx, dz] = [[1, 0], [-1, 0], [0, 1], [0, -1]][Math.floor(hasard() * 4)];
        cases.add(`${x + dx},${z + dz}`);
      }
      for (const alignes of [true, false]) {
        const contour = contourDe(cases, alignes);
        if (!contour) continue;
        const pente = surLePan(hasard() - 0.5);
        for (const sens of [contour, [...contour].reverse()])
          for (let r = 0; r < sens.length; r++) {
            couvreLaFace([...sens.slice(r), ...sens.slice(0, r)].map(pente));
            faces++;
          }
      }
    }
    expect(faces).toBeGreaterThan(1000);
  });

  it('une face convexe garde l’éventail depuis son premier sommet', () => {
    const quad = ([[0, 0], [4, 0], [5, 3], [0, 2]] as [number, number][]).map(surLePan(0.5));
    expect(trianglesDuPolygone(quad)).toEqual([[quad[0], quad[1], quad[2]], [quad[0], quad[2], quad[3]]]);
  });
});
