/** Un GLB de pièces fabriquées sur un squelette commun : la fixture des gardes qui lisent les zones du corps et les
 *  éléments montés par `evaluer`. */
import { ecrireGlb } from '../../glb.ts';

export type Point = readonly [number, number, number];
export type Forme = (p: Point) => Point;

export interface Piece {
  readonly nom: string;
  readonly sommets: readonly Point[];
  readonly triangles: readonly number[];
  readonly formes?: Readonly<Record<string, Forme>>;
  /** Sans lui, la pièce a un skin ; avec lui, un nœud rigide. */
  readonly rigide?: true;
  readonly zone?: string;
}

/** Le squelette commun, translations locales : `pied` sous `jambe`, de sorte qu'un facteur `legs` le déplace. */
const OS = [
  { name: 'racine', translation: [0, 0, 0], children: [1] },
  { name: 'jambe', translation: [0, 1, 0], children: [2] },
  { name: 'pied', translation: [0, -0.5, 0] },
] as const;
const HAUTEUR_DES_OS = [0, 1, 0.5];
const osDuSommet = ([, y]: Point): number => (y < 0.5 ? 2 : 1);

/** Le GLB des `pieces`, chaque sommet skinné tout entier sur `pied` sous y = 0,5, sur `jambe` au-dessus ; avec `clip`, un
 *  clip de ce nom qui laisse le squelette au repos. */
export function glb(pieces: readonly Piece[], clip?: string): Uint8Array {
  const morceaux: Uint8Array[] = [];
  const vues: object[] = [];
  const accesseurs: object[] = [];
  let decalage = 0;
  const accesseur = (donnees: Float32Array | Uint16Array, type: string, count: number, bornes: object = {}): number => {
    const octets = new Uint8Array(donnees.buffer);
    vues.push({ buffer: 0, byteOffset: decalage, byteLength: octets.byteLength });
    const bourrage = (4 - (octets.byteLength % 4)) % 4;
    morceaux.push(octets, new Uint8Array(bourrage));
    decalage += octets.byteLength + bourrage;
    accesseurs.push({ bufferView: vues.length - 1, componentType: donnees instanceof Float32Array ? 5126 : 5123, count, type, ...bornes });
    return accesseurs.length - 1;
  };
  const vec3 = (points: readonly Point[]): number => {
    const borne = (f: (...v: number[]) => number) => [0, 1, 2].map((c) => f(...points.map((p) => p[c])));
    return accesseur(Float32Array.from(points.flat()), 'VEC3', points.length, { min: borne(Math.min), max: borne(Math.max) });
  };
  const meshes = pieces.map((p) => ({
    primitives: [{
      attributes: {
        POSITION: vec3(p.sommets),
        ...(p.rigide ? {} : {
          JOINTS_0: accesseur(Uint16Array.from(p.sommets.flatMap((s) => [osDuSommet(s), 0, 0, 0])), 'VEC4', p.sommets.length),
          WEIGHTS_0: accesseur(Float32Array.from(p.sommets.flatMap(() => [1, 0, 0, 0])), 'VEC4', p.sommets.length),
        }),
      },
      indices: accesseur(Uint16Array.from(p.triangles), 'SCALAR', p.triangles.length),
      material: 0,
      ...(p.formes && Object.keys(p.formes).length ? { targets: Object.values(p.formes).map((f) => ({ POSITION: vec3(p.sommets.map(f)) })) } : {}),
    }],
    ...(p.formes && Object.keys(p.formes).length ? { extras: { targetNames: Object.keys(p.formes) } } : {}),
  }));
  const inverses = accesseur(Float32Array.from(HAUTEUR_DES_OS.flatMap((h) => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, -h, 0, 1])), 'MAT4', OS.length);
  const n = pieces.length;
  const animations = clip === undefined ? [] : [{
    name: clip,
    channels: [{ sampler: 0, target: { node: n, path: 'translation' } }],
    samplers: [{ input: accesseur(Float32Array.from([0, 1]), 'SCALAR', 2, { min: [0], max: [1] }), output: accesseur(new Float32Array(6), 'VEC3', 2), interpolation: 'LINEAR' }],
  }];
  const bin = new Uint8Array(decalage);
  morceaux.reduce((o, m) => (bin.set(m, o), o + m.byteLength), 0);
  return ecrireGlb({
    asset: { version: '2.0' },
    scene: 0,
    scenes: [{ nodes: [...pieces.keys(), n] }],
    nodes: [
      ...pieces.map((p, i) => ({ name: p.nom, mesh: i, ...(p.rigide ? {} : { skin: 0 }), ...(p.zone ? { extras: { zone: p.zone } } : {}) })),
      ...OS.map((o) => ({ ...o, ...('children' in o ? { children: o.children.map((c) => c + n) } : {}) })),
    ],
    meshes,
    materials: [{ name: 'peau' }],
    skins: [{ joints: OS.map((_, i) => i + n), inverseBindMatrices: inverses }],
    ...(animations.length ? { animations } : {}),
    accessors: accesseurs,
    bufferViews: vues,
    buffers: [{ byteLength: decalage }],
  }, bin);
}
