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

const FACES: { nom: string; poly: WorldPoly }[] = [
  // L dont le premier sommet ne voit pas tout le contour : l'éventail depuis lui déborde par l'encoche.
  { nom: 'L horizontal', poly: ([[0, 0], [6, 0], [6, 2], [2, 2], [2, 6], [0, 6]] as [number, number][]).map(surLePan(0)).reverse() },
  { nom: 'L de pan incliné', poly: ([[6, 0], [6, 2], [2, 2], [2, 6], [0, 6], [0, 0]] as [number, number][]).map(surLePan(0.5)) },
  { nom: 'pan de La Diligence (z0, versant est)', poly: ([[72, 64], [77, 59], [77, 83], [70, 76], [72, 74]] as [number, number][]).map(surLePan(-0.33)) },
];

describe('trianglesDuPolygone — une face simple non convexe (#4471)', () => {
  it.each(FACES)('$nom : triangles de même sens que la face, dans la face, d’aire totale celle de la face', ({ poly }) => {
    const tris = trianglesDuPolygone(poly);
    const aire = aireXZ(poly);
    expect(tris).toHaveLength(poly.length - 2);
    for (const t of tris) {
      expect(Math.sign(aireXZ(t))).toBe(Math.sign(aire));
      expect(dedans(poly, (t[0].x + t[1].x + t[2].x) / 3, (t[0].z + t[1].z + t[2].z) / 3)).toBe(true);
    }
    expect(tris.reduce((s, t) => s + Math.abs(aireXZ(t)), 0)).toBeCloseTo(Math.abs(aire), 9);
  });

  it('une face convexe garde l’éventail depuis son premier sommet', () => {
    const quad = ([[0, 0], [4, 0], [5, 3], [0, 2]] as [number, number][]).map(surLePan(0.5));
    expect(trianglesDuPolygone(quad)).toEqual([[quad[0], quad[1], quad[2]], [quad[0], quad[2], quad[3]]]);
  });
});
