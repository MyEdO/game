/**
 * LE CHARGEMENT D'UN GLB PAR THREE, EN NODE (#2972) : `GLTFLoader.parse` sans DOM. Une image ne se décode pas hors du
 * navigateur : le document est réécrit sans images, textures, échantillonneurs ni référence de texture des matériaux
 * (`ecrireGlb`, `glb.ts`) avant le chargement ; leur présence se lit par `lireGlb` (`images`).
 */
import type { AnimationClip, Mesh, Object3D, Skeleton, SkinnedMesh } from 'three';
import { GLTFLoader, type GLTFReference } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { estObjet } from '../../../../src/hote/formes';
import { ecrireGlb, lireConteneur, type DocumentGltf } from '../glb.ts';

export interface SceneChargee {
  readonly scene: Object3D;
  /** Tous les meshes de la scène, skinnés ou rigides. */
  readonly meshes: readonly Mesh[];
  readonly skinnes: readonly SkinnedMesh[];
  /** Le squelette du premier mesh skinné, `null` sans skinning. */
  readonly squelette: Skeleton | null;
  readonly clips: readonly AnimationClip[];
  /** Par mesh, son nœud glTF et sa primitive (`GLTFParser.associations`). */
  readonly origines: ReadonlyMap<Mesh, OrigineGltf>;
}

/** Le nœud glTF d'un mesh chargé, et l'indice de sa primitive dans le mesh glTF de ce nœud. */
export interface OrigineGltf {
  /** L'objet qui porte le nœud : le mesh lui-même, ou le `Group` ou l'os parent des primitives. */
  readonly objet: Object3D;
  /** Le nom du nœud dans le GLB, unique (`lireGlb`, `arborescence`). */
  readonly noeud: string;
  readonly primitive: number;
}

/** `GLTFReference` avec `primitives`, que `GLTFLoader.loadMesh` pose sur chaque primitive et que `@types/three` omet. */
type ReferenceGltf = GLTFReference & { readonly primitives?: number };

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
  gltf.scene.traverse((n) => { if ((n as Mesh).isMesh) meshes.push(n as Mesh); });
  const skinnes = meshes.filter((m): m is SkinnedMesh => (m as SkinnedMesh).isSkinnedMesh === true);
  const associations: ReadonlyMap<object, ReferenceGltf> = gltf.parser.associations;
  const noeuds = (json.nodes ?? []) as readonly { name?: unknown }[];
  const origines = new Map(meshes.map((m) => {
    let objet: Object3D | null = m;
    while (objet && associations.get(objet)?.nodes === undefined) objet = objet.parent;
    const indice = objet ? associations.get(objet)?.nodes : undefined;
    const noeud = indice === undefined ? undefined : noeuds[indice]?.name;
    if (!objet || typeof noeud !== 'string' || !noeud) throw new Error(`chargement : mesh ${m.name} sans nœud glTF nommé`);
    return [m, { objet, noeud, primitive: associations.get(m)?.primitives ?? 0 }] as const;
  }));
  return { scene: gltf.scene, meshes, skinnes, squelette: skinnes[0]?.skeleton ?? null, clips: gltf.animations, origines };
}
