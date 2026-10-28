/**
 * GARDE DE L'ENROULEMENT DES TRIANGLES (#2972) : au repos, un triangle dont la normale géométrique s'oppose à la moyenne
 * des normales de ses sommets (produit scalaire < 0) est retourné. Seuil : `TRIANGLES_RETOURNES_MAX`.
 */
import { Vector3, type Mesh } from 'three';
import type { Ecart } from '../ecart.ts';

export const TRIANGLES_RETOURNES_MAX = 0;

const a = new Vector3();
const b = new Vector3();
const c = new Vector3();
const normale = new Vector3();
const moyenne = new Vector3();
const n = new Vector3();

/** Les triangles retournés de `m` (indices de triangle). */
function retournes(m: Mesh): number[] {
  const { position, normal } = m.geometry.attributes;
  if (!normal) return [];
  const index = m.geometry.index;
  const sommet = (k: number) => (index ? index.getX(k) : k);
  const total = (index ? index.count : position.count) / 3;
  const trouves: number[] = [];
  for (let t = 0; t < total; t++) {
    const [i, j, k] = [sommet(t * 3), sommet(t * 3 + 1), sommet(t * 3 + 2)];
    a.fromBufferAttribute(position, i);
    b.fromBufferAttribute(position, j).sub(a);
    c.fromBufferAttribute(position, k).sub(a);
    normale.crossVectors(b, c);
    if (normale.lengthSq() === 0) continue;
    moyenne.fromBufferAttribute(normal, i).add(n.fromBufferAttribute(normal, j)).add(n.fromBufferAttribute(normal, k));
    if (normale.dot(moyenne) < 0) trouves.push(t);
  }
  return trouves;
}

export function gardeEnroulement(meshes: readonly Mesh[]): Ecart[] {
  return meshes.flatMap((m) => {
    const t = retournes(m);
    return t.length > TRIANGLES_RETOURNES_MAX
      ? [{ garde: 'enroulement', code: 'triangle-retourne', mesh: m.name, valeur: t.length, seuil: TRIANGLES_RETOURNES_MAX, detail: `${t.length} triangle(s) à normale opposée à celle de leurs sommets, premier #${t[0]}` }]
      : [];
  });
}
