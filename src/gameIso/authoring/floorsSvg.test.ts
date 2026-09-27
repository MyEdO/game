import { describe, it, expect } from 'vitest';
import { buildFloors } from '../builders/floors';
import type { FloorEl } from '../builders/types';
import { emptyScene, type Scene } from '../../state/scene';
import { floorSvg, floorDepth } from './floorsSvg';
import { depth, diamondPath, tileCenter, type Dims } from '../../geometry/iso';
import { terrainGradientId } from '../catalog/terrain';
import { echapperRegex } from '../../lib/regex';

/**
 * Peintre SVG d'authoring des sols : projette les éléments `floor` du pivot (builders/floors) via la
 * projection partagée (iso.ts). On vérifie le DESSIN (classes, gradients, profondeur) et que la
 * rotation caméra — qui vit 100 % ici — oriente correctement les faces (wedges, éclairage).
 */

const dims: Dims = { w: 4, h: 4 };

function withHeight(): Scene {
  const s = emptyScene(4, 4);
  s.layers[0].tiles = new Array(16).fill('plancher');
  s.layers[0].height = new Array(16).fill(0);
  return s;
}
const setH = (s: Scene, x: number, y: number, h: number) => { s.layers[0].height![y * 4 + x] = h; };
const elAt = (scene: Scene, x: number, y: number, z = 0, activeZ = 0): FloorEl => {
  const el = buildFloors(scene, undefined, { activeZ }).find((e) => e.key === `floor:${x},${y},${z}`);
  if (!el) throw new Error(`élément floor:${x},${y},${z} introuvable`);
  return el;
};

describe('floorSvg — losange de base', () => {
  it('tuile plate = un losange au tracé écran de diamondPath ; herbe = VARIANTE de teinte par tuile', () => {
    const s = emptyScene(4, 4); // herbe partout
    const svg = floorSvg(elAt(s, 1, 1), dims);
    expect(svg).toMatch(new RegExp(`^<path d="${echapperRegex(diamondPath(1, 1, dims))}" fill="url\\(#${terrainGradientId('herbe')}-v[0-3]\\)" stroke="rgba\\(0,0,0,0.16\\)"/>$`));
    expect(floorSvg(elAt(s, 1, 1), dims)).toBe(svg); // variante stable (hash du monde)
  });

  it('LOD 0 (fills plats) : le dégradé de BASE du terrain, sans variante', () => {
    const s = emptyScene(4, 4);
    const svg = floorSvg(elAt(s, 1, 1), dims, { zoom: 0.4 });
    expect(svg).toBe(`<path d="${diamondPath(1, 1, dims)}" fill="url(#${terrainGradientId('herbe')})" stroke="rgba(0,0,0,0.16)"/>`);
  });

  it('le losange démarre toujours au coin ÉCRAN haut (ordre stable aux 4 rotations)', () => {
    const s = emptyScene(4, 4);
    for (const rot of [0, 1, 2, 3] as const) {
      const d: Dims = { ...dims, rot };
      expect(floorSvg(elAt(s, 1, 1), d)).toContain(`d="${diamondPath(1, 1, d)}"`);
    }
  });

  it('terrain APPAREILLÉ (pavés) : surcouche de joints CONTINUE du plan du sol en LOD ≥ 1, pas en LOD 0', () => {
    const s = emptyScene(4, 4);
    s.layers[0].tiles = new Array(16).fill('pave');
    const svg = floorSvg(elAt(s, 1, 1), dims);
    expect(svg).toMatch(/fill="url\(#dt-[a-z0-9]+-0-g\)"/); // motif de sol (axe 'g'), étiqueté par projection
    expect((svg.match(/<path /g) ?? []).length).toBe(2); // base + surcouche : 2 nœuds par tuile
    expect(floorSvg(elAt(s, 1, 1), dims, { zoom: 0.4 })).not.toContain('-g)');
    expect(floorSvg(elAt(s, 1, 1), { ...dims, view: 'top' })).toContain('-g)'); // le sol reste affine vu du dessus
  });
});

describe('floorSvg — parois de relief', () => {
  it('une case en falaise porte la classe `elev-cliff` et grossit le SVG', () => {
    const s = withHeight();
    setH(s, 1, 1, 4);
    const flat = floorSvg(elAt(withHeight(), 1, 1), dims);
    const raised = floorSvg(elAt(s, 1, 1), dims);
    expect(raised.length).toBeGreaterThan(flat.length);
    expect(raised).toContain('elev-cliff');
  });

  it('un bord de tablier rend une dalle `overhang-deck` et des piliers `overhang-pillar`', () => {
    const s = withHeight();
    s.layers.push({ z: 1, tiles: new Array(16).fill('vide'), height: new Array(16).fill(0) });
    s.layers[1].tiles[1 * 4 + 1] = 'planches';
    s.layers[1].height![1 * 4 + 1] = 4;
    const svg = floorSvg(elAt(s, 1, 1, 1, 1), dims);
    expect(svg).toContain('overhang-deck');
    expect(svg).toContain('overhang-pillar');
    expect(svg).not.toContain('elev-cliff'); // bord ajouré, pas une falaise pleine
  });
});

describe('floorDepth — profondeur de tri', () => {
  it('sol = depth de sa case − 0.5 (sous les objets de SA case, interclassé par position écran)', () => {
    const s = emptyScene(4, 4);
    for (const rot of [0, 1, 2, 3] as const) {
      const d: Dims = { ...dims, rot };
      expect(floorDepth(elAt(s, 2, 1), d)).toBe(depth(2, 1, d, 0) - 0.5);
    }
  });
});

describe('floorSvg — le wedge de raccord SUIT la rotation caméra', () => {
  // (1,1) herbe (basse priorité), un unique voisin pavé (haute) : le trapèze de raccord doit se dessiner sur
  // l'arête ÉCRAN qui FAIT FACE au voisin, aux 4 crans.
  const outerEdgeMid = (svg: string): [number, number] => {
    const m = svg.match(/<path d="M([\d.-]+),([\d.-]+) L([\d.-]+),([\d.-]+)[^"]*" fill="url\(#[^)]*\)" opacity="0\.7"/);
    if (!m) throw new Error('wedge introuvable dans le SVG');
    const ax = Number(m[1]), ay = Number(m[2]), bx = Number(m[3]), by = Number(m[4]);
    return [(ax + bx) / 2, (ay + by) / 2];
  };
  for (const nb of [
    { dir: 'E', dx: 1, dy: 0 },
    { dir: 'N', dx: 0, dy: -1 },
    { dir: 'S', dx: 0, dy: 1 },
    { dir: 'O', dx: -1, dy: 0 },
  ] as const)
    for (const rot of [0, 1, 2, 3] as const)
      it(`voisin ${nb.dir}, cran ${rot} : l'arête du wedge pointe vers le voisin`, () => {
        const s = emptyScene(3, 3); // tout herbe
        s.layers[0].tiles[(1 + nb.dy) * 3 + (1 + nb.dx)] = 'pave'; // un seul voisin de plus haute priorité
        const d: Dims = { w: 3, h: 3, rot };
        const mid = outerEdgeMid(floorSvg(elAt(s, 1, 1), d));
        const self = tileCenter(1, 1, d);
        const nbc = tileCenter(1 + nb.dx, 1 + nb.dy, d);
        // centre→arête et centre→voisin dans le même demi-plan écran ⟺ produit scalaire > 0
        const dot = (mid[0] - self.cx) * (nbc.cx - self.cx) + (mid[1] - self.cy) * (nbc.cy - self.cy);
        expect(dot).toBeGreaterThan(0);
      });
});
