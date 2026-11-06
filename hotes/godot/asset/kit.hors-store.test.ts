import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { lireConteneur } from './glb.ts';
import { sha256 } from './empreinte.ts';
import { assemblerLeKit, ecrireLeKit, PACK, PIECES } from './kit.ts';

const dossiers: string[] = [];
afterEach(() => { for (const d of dossiers.splice(0)) rmSync(d, { recursive: true, force: true }); });

/** Un triangle de `min` à `max`, et le matériau `materiau` qui lit la couleur et la normale de l'image `T_Bois`. */
function gltf(nom: string, min: number[], max: number[], materiau: string) {
  const positions = new Float32Array([...min, max[0], min[1], max[2], ...max]);
  return {
    bin: new Uint8Array(positions.buffer),
    json: {
      asset: { version: '2.0' },
      buffers: [{ uri: `${nom}.bin`, byteLength: positions.byteLength }],
      bufferViews: [{ buffer: 0, byteLength: positions.byteLength }],
      accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: 'VEC3', min, max }],
      images: [{ uri: 'T_Bois_Normal.png', mimeType: 'image/png' }, { uri: 'T_Bois_BaseColor.png', mimeType: 'image/png' }],
      textures: [{ source: 0 }, { source: 1 }],
      materials: [{ name: materiau, normalTexture: { index: 0 }, pbrMetallicRoughness: { baseColorTexture: { index: 1 } } }],
      meshes: [{ primitives: [{ attributes: { POSITION: 0 }, material: 0 }] }],
      nodes: [{ mesh: 0 }],
      scenes: [{ nodes: [0] }],
    },
  };
}

/** Un dossier temporaire. */
const temporaire = () => {
  const d = mkdtempSync(join(tmpdir(), 'kit-'));
  dossiers.push(d);
  return d;
};

/** Un pack : un mur (2 m sur 3, 0,4 d'épaisseur décentrée) et un vantail, deux images, et la normale OpenGL. */
function pack(gltfs: readonly string[] = ['Mur', 'Vantail']): string {
  const d = temporaire();
  mkdirSync(join(d, PACK.gltf));
  mkdirSync(join(d, 'Textures', 'Normals Godot-Unity'), { recursive: true });
  for (const nom of gltfs) {
    const g = nom === 'Vantail' ? gltf(nom, [0, 0, -0.1], [1, 2, 0.1], 'MI_Bois') : gltf(nom, [-1, 0, -0.3], [1, 3, 0.1], 'MI_Bois');
    writeFileSync(join(d, PACK.gltf, `${nom}.gltf`), JSON.stringify(g.json));
    writeFileSync(join(d, PACK.gltf, `${nom}.bin`), g.bin);
  }
  writeFileSync(join(d, PACK.gltf, 'T_Bois_Normal.png'), 'normale DirectX');
  writeFileSync(join(d, PACK.gltf, 'T_Bois_BaseColor.png'), 'couleur');
  writeFileSync(join(d, 'Textures', 'Normals Godot-Unity', 'T_Bois_Normal.png'), 'normale OpenGL');
  return d;
}

interface Kit {
  nodes: { name: string; mesh?: number; children?: number[]; translation?: number[]; rotation?: number[]; scale?: number[] }[];
  scenes: { nodes: number[] }[];
  meshes: unknown[];
  materials: unknown[];
  images: { bufferView: number }[];
  bufferViews: { byteOffset: number; byteLength: number }[];
}

const assembler = () => {
  const { json, bin } = lireConteneur(assemblerLeKit(pack(), {
    'bois--mur': [{ gltf: 'Mur' }],
    'bois--porte-ouverte': [{ gltf: 'Mur' }, { gltf: 'Vantail', position: [-0.5, 0, 0], lacetDeg: -90 }],
  }));
  return { kit: json as unknown as Kit, bin: bin! };
};

describe('assemblerLeKit', () => {
  it('pose chaque pièce sous un nœud racine qui la nomme, ses éléments en enfants', () => {
    const { kit } = assembler();
    const racines = kit.scenes[0].nodes.map((i) => kit.nodes[i]);
    expect(racines.map((r) => r.name)).toEqual(['bois--mur', 'bois--porte-ouverte']);
    expect(racines.map((r) => r.children!.length)).toEqual([1, 2]);
    const vantail = kit.nodes[racines[1].children![1]];
    expect(vantail.translation).toEqual([-0.5, 0, 0]);
    expect(vantail.rotation![1]).toBeCloseTo(-Math.SQRT1_2);
    expect(vantail.rotation![3]).toBeCloseTo(Math.SQRT1_2);
  });

  it('ramène chaque pièce au repère d’une arête par son mur : longueur 1 centrée, hauteur 1 depuis 0, épaisseur centrée en mètres', () => {
    const { kit } = assembler();
    for (const i of kit.scenes[0].nodes) {
      const { scale, translation } = kit.nodes[i];
      expect(scale).toEqual([0.5, 1 / 3, 1]);
      expect(translation![0]).toBeCloseTo(0);
      expect(translation![1]).toBeCloseTo(0);
      expect(translation![2]).toBeCloseTo(0.1);
    }
  });

  it('n’embarque qu’une fois un glTF, un matériau et une image, la normale prise en convention OpenGL', () => {
    const { kit, bin } = assembler();
    expect(kit.meshes).toHaveLength(2);
    expect(kit.materials).toHaveLength(1);
    const images = kit.images.map(({ bufferView }) => kit.bufferViews[bufferView]).map((v) => new TextDecoder().decode(bin.subarray(v.byteOffset, v.byteOffset + v.byteLength)));
    expect(images).toEqual(['normale OpenGL', 'couleur']);
  });
});

describe('ecrireLeKit', () => {
  it('écrit le kit de toutes les pièces au dossier et l’y épingle, avec la page et la licence du pack', () => {
    const dossier = temporaire();
    const empreinte = ecrireLeKit(pack([...new Set(Object.values(PIECES).flat().map((e) => e.gltf))]), dossier);
    const kit = readFileSync(join(dossier, 'kit.glb'));
    expect(sha256(kit)).toBe(empreinte);
    expect(JSON.parse(readFileSync(join(dossier, 'provenance.json'), 'utf8'))).toEqual({ 'kit.glb': { sha256: empreinte, source: `${PACK.page} (${PACK.nom})`, licence: PACK.licence } });
    const { json } = lireConteneur(kit) as unknown as { json: Kit };
    expect(json.scenes[0].nodes.map((i) => json.nodes[i].name)).toEqual(Object.keys(PIECES));
  });
});
