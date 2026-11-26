import type { Bone, Mesh, Object3D, SkinnedMesh } from 'three';
import type { SceneChargee } from './chargement.ts';
import { COUCHES } from '../couches.ts';

/** La zone d'un mesh de la base (`extras.zone`, sur le mesh ou son nœud), `undefined` hors zone. */
export const zoneDe = (m: Object3D): unknown => m.userData.zone ?? (m.parent && !(m.parent as Bone).isBone ? m.parent.userData.zone : undefined);

export function meshesDuCorps(base: Pick<SceneChargee, 'meshes' | 'skinnes'>): readonly Mesh[] {
  const zones = base.meshes.filter((m) => typeof zoneDe(m) === 'string');
  return zones.length ? zones : base.skinnes;
}

/** La zone du corps que tient l'os `os` : celle dont les meshes skinnés de `corps` portent, ensemble, le plus de poids
 *  de peau sur lui, chaque face du corps ayant reçu la zone de son os dominant (`scripts/personnage-3d/base/anatomie.py`,
 *  `zones_des_faces`) ; `undefined` si aucun mesh de zone ne lui est lié. */
export function zoneDeLOs(corps: readonly Mesh[], zoneDe: (m: Mesh) => string | undefined, os: string): string | undefined {
  const parts = new Map<string, number>();
  for (const m of corps) {
    const zone = zoneDe(m), { skeleton, geometry } = m as SkinnedMesh;
    const rang = skeleton?.bones.findIndex((b) => b.name === os) ?? -1;
    if (zone === undefined || rang < 0) continue;
    const { skinIndex, skinWeight } = geometry.attributes;
    for (let i = 0; i < skinIndex.array.length; i++) if (skinIndex.array[i] === rang) parts.set(zone, (parts.get(zone) ?? 0) + skinWeight.array[i]);
  }
  return [...parts].reduce<[string, number] | undefined>((pire, part) => (part[1] > (pire?.[1] ?? 0) ? part : pire), undefined)?.[0];
}

const RANG_DE_LA_PEAU = COUCHES.indexOf('peau');

/** La peau d'une tenue (#3842) : les meshes de `corps` dont la zone (`zoneDe`) n'est couverte par aucune pièce de la
 *  couche `peau`, un mesh sans zone compris, puis les meshes des pièces de la couche `peau` qui couvrent une zone, dans
 *  l'ordre de `pieces`. */
export function peauDeLaTenue(
  corps: readonly Mesh[], pieces: readonly { readonly rang: number; readonly couvre: readonly string[]; readonly meshes: readonly Mesh[] }[], zoneDe: (m: Mesh) => string | undefined,
): readonly Mesh[] {
  const peaux = pieces.filter((p) => p.rang === RANG_DE_LA_PEAU && p.couvre.length);
  const couvertes = new Set(peaux.flatMap((p) => p.couvre));
  return [...corps.filter((m) => { const z = zoneDe(m); return z === undefined || !couvertes.has(z); }), ...peaux.flatMap((p) => p.meshes)];
}
