import type { Bone, Mesh, Object3D } from 'three';
import type { SceneChargee } from './chargement.ts';
import { COUCHES } from '../element.ts';

/** La zone d'un mesh de la base (`extras.zone`, sur le mesh ou son nœud), `undefined` hors zone. */
export const zoneDe = (m: Object3D): unknown => m.userData.zone ?? (m.parent && !(m.parent as Bone).isBone ? m.parent.userData.zone : undefined);

export function meshesDuCorps(base: Pick<SceneChargee, 'meshes' | 'skinnes'>): readonly Mesh[] {
  const zones = base.meshes.filter((m) => typeof zoneDe(m) === 'string');
  return zones.length ? zones : base.skinnes;
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
