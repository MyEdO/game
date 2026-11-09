/**
 * LE KIT DES ARÊTES (#3476, lot C, décision 5) : les pièces 3D que le volume de la scène de Godot pose sur les arêtes de
 * la scène (`projet/scripts/volume_de_scene.gd`, `poser_les_aretes`), assemblées en un seul GLB (`projet/kit/kit.glb`)
 * depuis les glTF d'un pack modulaire (`PACK`). Chaque pièce y est un nœud racine nommé `<famille>--<pièce>` (`CONTRAT.md`, section
 * « Plateau »), ramenée au repère d'une arête : son premier élément, le mur, occupe une longueur de 1 sur X centrée,
 * une hauteur de 1 sur Y depuis 0, et son épaisseur en mètres centrée sur Z ; le volume l'étire à la longueur de
 * l'arête et à la hauteur du mur. Une image n'est embarquée qu'une fois, une normale prise en convention OpenGL
 * (`NORMALES_OPENGL`), qui est celle de Godot.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sha256 } from './empreinte.ts';
import { ecrireGlb, type DocumentGltf } from './glb.ts';

/** Le dossier du kit au projet Godot (`res://kit/`), épinglé (`./epingles.ts`). */
export const DOSSIER_DU_KIT = fileURLToPath(new URL('../projet/kit', import.meta.url));
/** Le fichier du kit, dans son dossier. */
const KIT = 'kit.glb';

/** Le pack dont le kit tire ses glTF : sa page, sa licence, et le dossier de ses glTF dans son archive. */
export const PACK = {
  nom: 'Medieval Village MegaKit[Standard]',
  page: 'https://quaternius.itch.io/medieval-village-megakit',
  licence: 'CC0-1.0',
  gltf: 'glTF',
} as const;

/** Le dossier du pack dont les normales sont en convention OpenGL, et remplacent celles des glTF. */
const NORMALES_OPENGL = join('Textures', 'Normals Godot-Unity');

/** Un élément d'une pièce : un glTF du pack, posé à `position` (mètres) et tourné de `lacetDeg` autour de Y. */
interface Element { readonly gltf: string; readonly position?: readonly [number, number, number]; readonly lacetDeg?: number }

/** Le chambranle et le vantail d'une porte, fermée ou ouverte d'un quart de tour sur son gond, et la croisée d'une
 *  fenêtre, ses volets clos ou ouverts : posés dans l'ouverture du mur qui les porte. */
const VANTAIL = { gltf: 'Door_2_Flat', position: [-0.535, 0, 0] } as const;
const PORTE_FERMEE: readonly Element[] = [{ gltf: 'DoorFrame_Flat_WoodDark' }, VANTAIL];
const PORTE_OUVERTE: readonly Element[] = [{ gltf: 'DoorFrame_Flat_WoodDark' }, { ...VANTAIL, lacetDeg: -90 }];
const FENETRE: readonly Element[] = [{ gltf: 'Window_Wide_Flat1' }, { gltf: 'WindowShutters_Wide_Flat_Open' }];
const FENETRE_CLOSE: readonly Element[] = [{ gltf: 'Window_Wide_Flat1' }, { gltf: 'WindowShutters_Wide_Flat_Closed' }];

/** Les pièces du kit, par nom (`<famille>--<pièce>`) : le mur d'abord, qui donne le repère de la pièce. */
export const PIECES: Readonly<Record<string, readonly Element[]>> = {
  'colombage--mur': [{ gltf: 'Wall_Plaster_Straight' }],
  'colombage--porte-fermee': [{ gltf: 'Wall_Plaster_Door_Flat' }, ...PORTE_FERMEE],
  'colombage--porte-ouverte': [{ gltf: 'Wall_Plaster_Door_Flat' }, ...PORTE_OUVERTE],
  'colombage--fenetre': [{ gltf: 'Wall_Plaster_Window_Wide_Flat' }, ...FENETRE],
  'colombage--fenetre-close': [{ gltf: 'Wall_Plaster_Window_Wide_Flat' }, ...FENETRE_CLOSE],
  'pierre--mur': [{ gltf: 'Wall_UnevenBrick_Straight' }],
  'pierre--porte-fermee': [{ gltf: 'Wall_UnevenBrick_Door_Flat' }, ...PORTE_FERMEE],
  'pierre--porte-ouverte': [{ gltf: 'Wall_UnevenBrick_Door_Flat' }, ...PORTE_OUVERTE],
  'pierre--fenetre': [{ gltf: 'Wall_UnevenBrick_Window_Wide_Flat' }, ...FENETRE],
  'pierre--fenetre-close': [{ gltf: 'Wall_UnevenBrick_Window_Wide_Flat' }, ...FENETRE_CLOSE],
  'cloture--mur': [{ gltf: 'Prop_WoodenFence_Single' }],
};

type Materiau = { name?: string; [cle: string]: unknown };

interface Gltf {
  buffers: { uri?: string; byteLength: number }[];
  bufferViews: { buffer: number; byteOffset?: number; byteLength: number; byteStride?: number; target?: number }[];
  accessors: { bufferView?: number; min?: number[]; max?: number[]; [cle: string]: unknown }[];
  images?: { uri?: string; mimeType?: string; name?: string }[];
  samplers?: Record<string, unknown>[];
  textures?: { source?: number; sampler?: number }[];
  materials?: Materiau[];
  meshes: { primitives: { attributes: Record<string, number>; indices?: number; material?: number }[]; name?: string }[];
  nodes: { mesh?: number; children?: number[]; name?: string; translation?: number[]; rotation?: number[]; scale?: number[] }[];
  scenes: { nodes: number[] }[];
  scene?: number;
}

/** Les indices d'un objet glTF (`textureInfo`) à renuméroter, à toute profondeur d'un matériau. */
function renumeroterTextures(valeur: unknown, texture: (i: number) => number): unknown {
  if (Array.isArray(valeur)) return valeur.map((v) => renumeroterTextures(v, texture));
  if (valeur === null || typeof valeur !== 'object') return valeur;
  return Object.fromEntries(Object.entries(valeur).map(([cle, v]) => [cle, cle === 'index' && typeof v === 'number' ? texture(v) : renumeroterTextures(v, texture)]));
}

const aligne4 = (n: number): number => Math.ceil(n / 4) * 4;

/** Le GLB du kit, assemblé depuis le dossier `pack` (l'archive du pack extraite) : `PIECES`, chacune sous un nœud
 *  racine qui la ramène au repère d'une arête. */
export function assemblerLeKit(pack: string, pieces: Readonly<Record<string, readonly Element[]>> = PIECES): Uint8Array {
  const sortie: Required<Pick<Gltf, 'bufferViews' | 'accessors' | 'images' | 'samplers' | 'textures' | 'materials' | 'meshes' | 'nodes'>> = {
    bufferViews: [], accessors: [], images: [], samplers: [], textures: [], materials: [], meshes: [], nodes: [],
  };
  const morceaux: Uint8Array[] = [];
  let longueur = 0;
  const verser = (octets: Uint8Array): number => {
    const debut = longueur;
    morceaux.push(octets);
    const bourrage = aligne4(octets.byteLength) - octets.byteLength;
    if (bourrage) morceaux.push(new Uint8Array(bourrage));
    longueur += aligne4(octets.byteLength);
    sortie.bufferViews.push({ buffer: 0, byteOffset: debut, byteLength: octets.byteLength });
    return sortie.bufferViews.length - 1;
  };
  const images = new Map<string, number>();
  const materiaux = new Map<string, number>();
  const maillages = new Map<string, { mesh: number; min: number[]; max: number[] }>();

  const charger = (nom: string): { mesh: number; min: number[]; max: number[] } => {
    const deja = maillages.get(nom);
    if (deja) return deja;
    const dossier = join(pack, PACK.gltf);
    const gltf = JSON.parse(readFileSync(join(dossier, `${nom}.gltf`), 'utf8')) as Gltf;
    const bin = readFileSync(join(dossier, gltf.buffers[0].uri!));
    const vues = gltf.bufferViews.map((v) => {
      const indice = verser(new Uint8Array(bin.buffer, bin.byteOffset + (v.byteOffset ?? 0), v.byteLength));
      Object.assign(sortie.bufferViews[indice], v.byteStride ? { byteStride: v.byteStride } : {}, v.target ? { target: v.target } : {});
      return indice;
    });
    const accesseurs = gltf.accessors.map((a) => sortie.accessors.push({ ...a, ...(a.bufferView === undefined ? {} : { bufferView: vues[a.bufferView] }) }) - 1);
    const imagesDuGltf = (gltf.images ?? []).map((image) => {
      const fichier = image.uri!;
      const connue = images.get(fichier);
      if (connue !== undefined) return connue;
      const opengl = join(pack, NORMALES_OPENGL, fichier);
      const vue = verser(readFileSync(existsSync(opengl) ? opengl : join(dossier, fichier)));
      images.set(fichier, sortie.images.push({ bufferView: vue, mimeType: image.mimeType ?? 'image/png', name: image.name } as never) - 1);
      return images.get(fichier)!;
    });
    const echantillonneurs = (gltf.samplers ?? []).map((s) => sortie.samplers.push(s) - 1);
    const textures = (gltf.textures ?? []).map((t) => sortie.textures.push({
      ...(t.source === undefined ? {} : { source: imagesDuGltf[t.source] }),
      ...(t.sampler === undefined ? {} : { sampler: echantillonneurs[t.sampler] }),
    }) - 1);
    const materiauxDuGltf = (gltf.materials ?? []).map((m) => {
      const cle = m.name ?? `${nom}#${JSON.stringify(m)}`;
      if (!materiaux.has(cle)) materiaux.set(cle, sortie.materials.push(renumeroterTextures(m, (i) => textures[i]) as Materiau) - 1);
      return materiaux.get(cle)!;
    });
    const racine = gltf.nodes[gltf.scenes[gltf.scene ?? 0].nodes[0]];
    const primitives = gltf.meshes[racine.mesh!].primitives;
    const mesh = sortie.meshes.push({
      name: nom,
      primitives: primitives.map((p) => ({
        attributes: Object.fromEntries(Object.entries(p.attributes).map(([cle, a]) => [cle, accesseurs[a]])),
        ...(p.indices === undefined ? {} : { indices: accesseurs[p.indices] }),
        ...(p.material === undefined ? {} : { material: materiauxDuGltf[p.material] }),
      })),
    }) - 1;
    const positions = primitives.map((p) => gltf.accessors[p.attributes.POSITION]);
    const min = [0, 1, 2].map((i) => Math.min(...positions.map((a) => a.min![i])));
    const max = [0, 1, 2].map((i) => Math.max(...positions.map((a) => a.max![i])));
    maillages.set(nom, { mesh, min, max });
    return maillages.get(nom)!;
  };

  const racines = Object.entries(pieces).map(([nom, elements]) => {
    const enfants = elements.map((e) => {
      const { mesh } = charger(e.gltf);
      const demi = ((e.lacetDeg ?? 0) * Math.PI) / 360;
      return sortie.nodes.push({
        name: `${nom}.${e.gltf}`,
        mesh,
        ...(e.position ? { translation: [...e.position] } : {}),
        ...(e.lacetDeg ? { rotation: [0, Math.sin(demi), 0, Math.cos(demi)] } : {}),
      }) - 1;
    });
    const { min, max } = charger(elements[0].gltf);
    const echelle = [1 / (max[0] - min[0]), 1 / (max[1] - min[1]), 1];
    const translation = [-((min[0] + max[0]) / 2) * echelle[0], -min[1] * echelle[1], -(min[2] + max[2]) / 2];
    return sortie.nodes.push({ name: nom, children: enfants, translation, scale: echelle }) - 1;
  });

  const bin = new Uint8Array(longueur);
  let curseur = 0;
  for (const m of morceaux) { bin.set(m, curseur); curseur += m.byteLength; }
  const json: DocumentGltf = {
    asset: { version: '2.0', generator: `kit des arêtes (${PACK.nom})` },
    buffers: [{ byteLength: longueur }],
    ...sortie,
    scenes: [{ nodes: racines }],
    scene: 0,
  };
  return ecrireGlb(json, bin);
}

/** Assemble le kit depuis le dossier `pack` (`assemblerLeKit`), l'écrit dans `dossier` et l'y épingle : sa provenance
 *  (`provenance.json`) porte son empreinte, la page et la licence du pack. Rend l'empreinte. */
export function ecrireLeKit(pack: string, dossier = DOSSIER_DU_KIT): string {
  const kit = assemblerLeKit(pack);
  const empreinte = sha256(kit);
  writeFileSync(join(dossier, KIT), kit);
  writeFileSync(join(dossier, 'provenance.json'), `${JSON.stringify({ [KIT]: { sha256: empreinte, source: `${PACK.page} (${PACK.nom})`, licence: PACK.licence } }, null, 2)}\n`);
  return empreinte;
}
