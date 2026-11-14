/** Un GLB fabriqué et le manifeste qui le décrit : la fixture de l’évaluateur et de sa ligne de commande. */
import { tableTotale } from '../../../../src/lib/tableTotale';
import { ecrireGlb, lireGlb } from '../glb.ts';
import { empreinte } from '../empreinte.ts';
import { FACTEURS_NEUTRES } from '../facteursDuGabarit.ts';
import { poidsDuGabarit } from '../gabarit.ts';
import { FEMININ } from '../silhouettes.ts';
import type { TableDeGabarit } from '../manifesteDeBase.ts';

export const TABLE: TableDeGabarit = { legs: ['racine'], arms: [], head: [], racine: 'racine', st: { min: 0.8, max: 1.2 }, bornes: { legs: { min: 0.7, max: 1.3 }, arms: { min: 1, max: 1.5 }, head: { min: 1, max: 2 } }, osDesSilhouettes: {} };

const TAILLE = { SCALAR: 1, VEC3: 3, VEC4: 4, MAT4: 16 } as const;
const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Un GLB fabriqué (chunks JSON et BIN) : un triangle `Corps` (zone `torse`, shape key `feminin`) skinné sur l'os `racine`,
 *  avec au choix une texture d'image, un jeu d'influence `JOINTS_1`, un os `pelvis` enfant de `racine`, et des clips de
 *  translation de `pelvis` s'il est là, sinon de `racine`, ou explicitement de `racine` par `cibleDuClip` ;
 *  en `rotations`, des clips de rotation du même os, de l'identité au quaternion `[x, y, z, w]` donné ; en marche,
 *  deux triangles de pied et leur cycle appui/vol, et en `formes` leurs shape keys, par nom, en déplacements à plat de
 *  leurs six sommets ; en
 *  anneau, `ANNEAU` (six sommets mi-`racine` mi-`pelvis`, puis un triangle de pied sur `racine`) et ses shape keys, par
 *  nom, en déplacements à plat de ses neuf sommets ; en bande, le triangle `Corps` au sommet (0, 1, 0) skinné sur `pelvis`
 *  et ses shape keys, par nom, en déplacements à plat de ses trois sommets ; en `primitives`, le mesh en autant de
 *  primitives identiques, le jeu `JOINTS_1` sur la première seule ; en `instances`, d'autres nœuds de ces noms qui portent
 *  le même mesh, le même skin et la même zone. */
export interface MarcheFabriquee { racine?: number; decolle?: number; lateral?: number; bloque?: boolean; vitesseDroite?: number; nom?: string; sens?: number; vitesse?: number }

export function glbFabrique(options: { nom?: string; image?: boolean; jeuEtendu?: boolean; pelvis?: boolean; clips?: Record<string, readonly [number, number]>; rotations?: Record<string, readonly [number, number, number, number]>; cibleDuClip?: 'racine'; marche?: MarcheFabriquee; autresMarches?: readonly MarcheFabriquee[]; formes?: Record<string, readonly number[]>; anneau?: Record<string, readonly number[]>; bande?: Record<string, readonly number[]>; primitives?: number; instances?: readonly string[]; os?: readonly string[] } = {}): Uint8Array {
  const morceaux: Uint8Array[] = [];
  const vues: object[] = [];
  const accesseurs: object[] = [];
  let decalage = 0;
  const vue = (octets: Uint8Array): number => {
    vues.push({ buffer: 0, byteOffset: decalage, byteLength: octets.byteLength });
    const bourrage = (4 - (octets.byteLength % 4)) % 4;
    morceaux.push(octets, new Uint8Array(bourrage));
    decalage += octets.byteLength + bourrage;
    return vues.length - 1;
  };
  const accesseur = (donnees: Float32Array | Uint16Array, type: keyof typeof TAILLE, bornes: object = {}): number => {
    accesseurs.push({ bufferView: vue(new Uint8Array(donnees.buffer)), componentType: donnees instanceof Float32Array ? 5126 : 5123, count: donnees.length / TAILLE[type], type, ...bornes });
    return accesseurs.length - 1;
  };
  const attributes: Record<string, number> = {
    POSITION: accesseur(Float32Array.from([0, 0, 0, 1, 0, 0, 0, 1, 0]), 'VEC3', { min: [0, 0, 0], max: [1, 1, 0] }),
    NORMAL: accesseur(Float32Array.from([0, 0, 1, 0, 0, 1, 0, 0, 1]), 'VEC3'),
    JOINTS_0: accesseur(new Uint16Array(12), 'VEC4'),
    WEIGHTS_0: accesseur(Float32Array.from([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0]), 'VEC4'),
    ...(options.jeuEtendu ? { JOINTS_1: accesseur(new Uint16Array(12), 'VEC4'), WEIGHTS_1: accesseur(new Float32Array(12), 'VEC4') } : {}),
  };
  if (options.marche) {
    attributes.POSITION = accesseur(Float32Array.from([-0.3, 0, 0, -0.1, 0, 0, -0.2, 0, 0.2, 0.1, 0, 0, 0.3, 0, 0, 0.2, 0, 0.2]), 'VEC3', { min: [-0.3, 0, 0], max: [0.3, 0, 0.2] });
    attributes.NORMAL = accesseur(Float32Array.from(Array.from({ length: 6 }, () => [0, 1, 0]).flat()), 'VEC3');
    attributes.JOINTS_0 = accesseur(Uint16Array.from([1, 1, 1, 2, 2, 2].flatMap((i) => [i, 0, 0, 0])), 'VEC4');
    attributes.WEIGHTS_0 = accesseur(Float32Array.from(Array.from({ length: 6 }, () => [1, 0, 0, 0]).flat()), 'VEC4');
  }
  const targets: Record<string, number>[] = [];
  const cles = (formes: Record<string, readonly number[]>) => {
    for (const deltas of Object.values(formes)) {
      const d = Float32Array.from(deltas);
      const borne = (f: (a: number, b: number) => number) => [0, 1, 2].map((c) => d.filter((_, i) => i % 3 === c).reduce(f));
      targets.push({ POSITION: accesseur(d, 'VEC3', { min: borne(Math.min), max: borne(Math.max) }) });
    }
  };
  if (options.bande) {
    attributes.JOINTS_0 = accesseur(Uint16Array.from([0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0]), 'VEC4');
    cles(options.bande);
  }
  if (options.anneau) {
    const n = ANNEAU.length / 3;
    attributes.POSITION = accesseur(Float32Array.from(ANNEAU), 'VEC3', { min: [-0.3, 0, -0.1], max: [0.1, 0.5, 0.2] });
    attributes.NORMAL = accesseur(Float32Array.from(Array.from({ length: n }, () => [0, -1, 0]).flat()), 'VEC3');
    attributes.JOINTS_0 = accesseur(Uint16Array.from(Array.from({ length: n }, (_, i) => [0, i < 6 ? 1 : 0, 0, 0]).flat()), 'VEC4');
    attributes.WEIGHTS_0 = accesseur(Float32Array.from(Array.from({ length: n }, (_, i) => (i < 6 ? [0.5, 0.5, 0, 0] : [1, 0, 0, 0])).flat()), 'VEC4');
    cles(options.anneau);
  }
  if (options.marche && options.formes) cles(options.formes);
  const formes = options.anneau ?? options.bande ?? (options.marche ? options.formes : undefined);
  const identite = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  const joints = options.marche ? [1, 2, 3] : options.pelvis || options.anneau || options.bande ? [1, 2] : [1];
  const inverseBindMatrices = accesseur(Float32Array.from(joints.flatMap(() => identite)), 'MAT4');
  const cible = options.cibleDuClip === 'racine' ? joints[0] : joints[joints.length - 1];
  const piste = (name: string, path: 'translation' | 'rotation', valeurs: readonly number[]) => ({
    name,
    channels: [{ sampler: 0, target: { node: cible, path } }],
    samplers: [{ input: accesseur(Float32Array.from([0, 1]), 'SCALAR', { min: [0], max: [1] }), output: accesseur(Float32Array.from(valeurs), path === 'rotation' ? 'VEC4' : 'VEC3'), interpolation: 'LINEAR' }],
  });
  const animations = [
    ...Object.entries(options.clips ?? {}).map(([name, [de, a]]) => piste(name, 'translation', [0, de, 0, 0, a, 0])),
    ...Object.entries(options.rotations ?? {}).map(([name, q]) => piste(name, 'rotation', [0, 0, 0, 1, ...q])),
  ];
  for (const m of options.marche ? [options.marche, ...(options.autresMarches ?? [])] : []) {
    const temps = [0, 0.25, 0.5, 0.75, 1];
    const poses = [1, 2, 3].map((node) => temps.flatMap((t) => {
      if (node === 1) return [0, 0, (m.racine ?? 0) * t * (m.sens ?? 1)];
      const phase = node === 2 ? t : (t + 0.5) % 1;
      const z = m.bloque ? 0 : (phase <= 0.5 ? 0.5 - 2 * phase : -0.5 + 2 * (phase - 0.5));
      const vol = phase <= 0.5 ? 0 : 0.2 * (1 - Math.abs(phase - 0.75) * 4);
      return [node === 2 ? (m.lateral ?? 0) * t : 0, vol + (node === 2 ? (m.decolle ?? 0) : 0), z * (node === 3 ? (m.vitesseDroite ?? 1) : 1) * (m.sens ?? 1) * (m.vitesse ?? 1)];
    }));
    animations.push({ name: m.nom ?? 'Walk_Loop', channels: [1, 2, 3].map((node, sampler) => ({ sampler, target: { node, path: 'translation' } })), samplers: poses.map((p) => ({ input: accesseur(Float32Array.from(temps), 'SCALAR', { min: [0], max: [1] }), output: accesseur(Float32Array.from(p), 'VEC3'), interpolation: 'LINEAR' })) });
  }
  const image = options.image ? { images: [{ bufferView: vue(PNG), mimeType: 'image/png' }], textures: [{ source: 0, sampler: 0 }], samplers: [{}] } : {};
  const bin = new Uint8Array(decalage);
  morceaux.reduce((n, m) => (bin.set(m, n), n + m.byteLength), 0);
  const noeudDuMesh = (name: string) => ({ name, mesh: 0, skin: 0, extras: { zone: 'torse' } });
  const noeuds = [noeudDuMesh(options.nom ?? 'Corps'), { name: 'racine', ...(options.marche ? { children: [2, 3] } : options.pelvis || formes ? { children: [2] } : {}) }, ...(options.marche ? [{ name: 'piedG' }, { name: 'piedD' }] : options.pelvis || formes ? [{ name: 'pelvis' }] : [])];
  for (const [k, name] of (options.os ?? []).entries()) noeuds[k + 1] = { ...noeuds[k + 1], name };
  const premierJeu = Object.fromEntries(Object.entries(attributes).filter(([nom]) => nom !== 'JOINTS_1' && nom !== 'WEIGHTS_1'));
  return ecrireGlb({
    asset: { version: '2.0' },
    scene: 0,
    scenes: [{ nodes: [0, 1, ...(options.instances ?? []).map((_, k) => noeuds.length + k)] }],
    nodes: [...noeuds, ...(options.instances ?? []).map(noeudDuMesh)],
    meshes: [{ primitives: Array.from({ length: options.primitives ?? 1 }, (_, j) => ({ attributes: j ? premierJeu : attributes, material: 0, ...(targets.length ? { targets } : {}) })), extras: { targetNames: formes ? Object.keys(formes) : [FEMININ] } }],
    materials: [{ name: 'peau', pbrMetallicRoughness: options.image ? { baseColorTexture: { index: 0 } } : {} }],
    skins: [{ joints, inverseBindMatrices }],
    ...(animations.length ? { animations } : {}),
    ...image,
    accessors: accesseurs,
    bufferViews: vues,
    buffers: [{ byteLength: decalage }],
  }, bin);
}

/** Les neuf sommets de l'anneau fabriqué : six sur un cercle de rayon 0,1 m à 0,5 m de haut, puis un triangle au sol. */
export const ANNEAU = [
  ...Array.from({ length: 6 }, (_, k) => [0.1 * Math.cos(k * Math.PI / 3), 0.5, 0.1 * Math.sin(k * Math.PI / 3)]).flat(),
  -0.3, 0, 0, -0.1, 0, 0, -0.2, 0, 0.2,
];

export const ATTACHE = { os: 'racine', position: [0, 0, 0], rotation: [0, 0, 0] };

/** Les bornes articulaires d'os libres `os`. */
export const osLibres = (os: readonly string[]) => tableTotale(os, () => ({ x: [-180, 180], y: [-180, 180], z: [-180, 180] }));

/** Le manifeste qui décrit le GLB `octets` de `glbFabrique`, d'os `os`. */
export const manifesteDe = (octets: Uint8Array, os = ['racine']) => ({
  schema: 7, base: 'fabrique', os, bornesArticulaires: osLibres(os), chaines: { jambe: ['racine'] }, zones: ['torse'], emplacements: { dos: { ...ATTACHE } },
  prises: { main: { ...ATTACHE }, secondaire: { ...ATTACHE } }, silhouettes: [FEMININ], gabarit: { ...TABLE, legs: [] },
  porteur: { espece: 'humain', gabarit: 'moyen', taille: 'moyenne', echelleDArt: 1 },
  clips: { marche: [...lireGlb(octets).animations][0] },
  appuis: { pieds: ['racine'], plusBas: [{ position: [0, 0, 0] as const, os: [{ nom: 'racine', poids: 1 }], deltas: {} }], vitesseAuSol: 1.4 },
  osAPositionAnimee: os.filter((o) => o !== 'racine'),
  glb: empreinte(octets),
});

export const formesAvecGabarit = (silhouettes: Record<string, readonly number[]>, deltas: Record<string, readonly number[]> = {}) => ({
  ...tableTotale(Object.keys(poidsDuGabarit(FACTEURS_NEUTRES, TABLE.bornes, tableTotale(Object.keys(silhouettes), () => 0))), () => new Array<number>(Object.values(silhouettes)[0].length).fill(0)),
  ...silhouettes,
  ...deltas,
});
