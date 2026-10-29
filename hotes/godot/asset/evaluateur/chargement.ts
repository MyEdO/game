/**
 * LE CHARGEMENT D'UN GLB PAR THREE, EN NODE (#2972) : `GLTFLoader.parse` sans DOM. Une image ne se décode pas hors du
 * navigateur : le document est réécrit sans images, textures, échantillonneurs ni référence de texture des matériaux
 * (`ecrireGlb`, `glb.ts`) avant le chargement ; leur présence se lit par `lireGlb` (`images`).
 */
import type { AnimationClip, Mesh, Object3D, Skeleton, SkinnedMesh } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { ecrireGlb, lireConteneur, type DocumentGltf } from '../glb.ts';
import { estObjet } from '../../../../src/hote/formes.ts';

export interface SceneChargee {
  readonly scene: Object3D;
  /** Tous les meshes de la scène, skinnés ou rigides. */
  readonly meshes: readonly Mesh[];
  readonly skinnes: readonly SkinnedMesh[];
  /** Le squelette du premier mesh skinné, `null` sans skinning. */
  readonly squelette: Skeleton | null;
  readonly clips: readonly AnimationClip[];
  /** Par nom de nœud, ses `extras` glTF (`userData`), pour les nœuds qui en portent. */
  readonly userData: ReadonlyMap<string, Readonly<Record<string, unknown>>>;
}

const LISTES_D_IMAGE = ['images', 'textures', 'samplers'];
const EXTENSION_DE_TEXTURE = /texture/i;

/** `valeur` sans référence de texture : toute clé `…Texture` dont la valeur porte un `index`, à toute profondeur. */
function sansReferenceDeTexture(valeur: unknown): unknown {
  if (Array.isArray(valeur)) return valeur.map(sansReferenceDeTexture);
  if (!estObjet(valeur)) return valeur;
  return Object.fromEntries(Object.entries(valeur)
    .filter(([cle, v]) => !(/Texture$/.test(cle) && estObjet(v) && typeof v.index === 'number'))
    .map(([cle, v]) => [cle, sansReferenceDeTexture(v)]));
}

/** Le document `json` sans images, textures, échantillonneurs, références de texture ni extension de texture. */
function sansImages(json: DocumentGltf): DocumentGltf {
  const filtrees = (cle: string) => (Array.isArray(json[cle]) ? { [cle]: (json[cle] as unknown[]).filter((e) => typeof e !== 'string' || !EXTENSION_DE_TEXTURE.test(e)) } : {});
  const reste = Object.fromEntries(Object.entries(json).filter(([cle]) => !LISTES_D_IMAGE.includes(cle)));
  return { ...reste, ...(Array.isArray(json.materials) ? { materials: sansReferenceDeTexture(json.materials) } : {}), ...filtrees('extensionsUsed'), ...filtrees('extensionsRequired') };
}

/** La scène du GLB `octets`, chargée par `GLTFLoader` sans ses images. */
export async function chargerScene(octets: Uint8Array): Promise<SceneChargee> {
  const { json, bin } = lireConteneur(octets);
  const reecrit = ecrireGlb(sansImages(json), bin);
  const gltf = await new GLTFLoader().parseAsync(reecrit.slice().buffer, '');
  const meshes: Mesh[] = [];
  const userData = new Map<string, Readonly<Record<string, unknown>>>();
  gltf.scene.traverse((n) => {
    if ((n as Mesh).isMesh) meshes.push(n as Mesh);
    if (Object.keys(n.userData).length) userData.set(n.name, n.userData);
  });
  const skinnes = meshes.filter((m): m is SkinnedMesh => (m as SkinnedMesh).isSkinnedMesh === true);
  return { scene: gltf.scene, meshes, skinnes, squelette: skinnes[0]?.skeleton ?? null, clips: gltf.animations, userData };
}
