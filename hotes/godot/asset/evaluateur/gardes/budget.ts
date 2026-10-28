/** GARDE DU BUDGET DE TRIANGLES (#2972) : le total des triangles de l'assemblage sous un plafond, `PLAFOND_ASSEMBLE` par défaut. */
import type { Mesh } from 'three';
import type { Ecart } from '../ecart.ts';

export const PLAFOND_ASSEMBLE = 16000;

/** Le nombre de triangles de `m`. */
export const trianglesDe = (m: Mesh): number => (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3;

export function gardeBudget(meshes: readonly Mesh[], plafond = PLAFOND_ASSEMBLE): Ecart[] {
  const parMesh = meshes.map((m) => [m.name, trianglesDe(m)] as const);
  const total = parMesh.reduce((s, [, t]) => s + t, 0);
  if (total <= plafond) return [];
  return [{ garde: 'budget', code: 'plafond-assemble', valeur: total, seuil: plafond, detail: `${total} triangles (${parMesh.map(([nom, t]) => `${nom} ${t}`).join(', ')})` }];
}
