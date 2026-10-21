import { describe, it, expect } from 'vitest';
import {
  lodOf,
  LOD_ZOOM,
  detailOf,
  detailPatternDefs,
  terrainFillGradient,
  terrainCoursesPattern,
  coursesOverlaySvg,
  verticalAccentsSvg,
  timberOverlaySvg,
  groundAccentsSvg,
  type VerticalFaceCtx,
} from './detailSvg';
import { hash32 } from '../../data/hash';
import { terrainGradientId } from '../catalog/terrain';
import type { DetailRecipe } from '../../data/materials.types';
import type { Dims } from '../../geometry/iso';

/**
 * Machinerie des MATÉRIAUX v2 (backend affine) : motifs partagés « pattern = structure, fill =
 * couleur » (un par recette × orientation × variante, patternTransform constant par projection),
 * accents seedés à l'identité MONDE, variance de teinte de terrain, LOD par zoom.
 */

const dims: Dims = { w: 6, h: 6 };
const STONE: DetailRecipe = {
  seedScope: 'edge',
  courses: { hM: 0.35, joint: '#33302b', jointW: 0.035, stagger: 0.5, blockWM: [0.4, 0.9], edgeWobble: 0.025, paletteVar: 0.08 },
  speckle: { perM2: 0.5, rM: [0.05, 0.11], colors: ['#5d6b52', '#4c4841'], vBias: 1.6 },
};

/** Quad écran d'une face type (parallélogramme 2 m × 2.25 m projeté au cran 0, arête N). */
const QUAD: [number, number][] = [[100, 50], [132, 66], [132, 120], [100, 104]];
const ctx = (over?: Partial<VerticalFaceCtx>): VerticalFaceCtx => ({
  recipe: STONE,
  side: 'N',
  cell: { x: 2, y: 2, z: 0 },
  quad: QUAD,
  faceWM: 2,
  faceHM: 2.25,
  base: '#6b6f76',
  seed: hash32('wall', 2, 2, 0, 'N'),
  dims,
  mpt: 2,
  ...over,
});

describe('LOD par zoom', () => {
  it('paliers : < 0.5 fills plats · < 0.7 motifs seuls · ≥ 0.7 motifs + accents', () => {
    expect(lodOf(0.4)).toBe(0);
    expect(lodOf(0.5)).toBe(1);
    expect(lodOf(0.69)).toBe(1);
    expect(lodOf(0.7)).toBe(2);
    expect(lodOf(2)).toBe(2);
  });
  it('LOD_ZOOM : le zoom représentatif de chaque palier retombe sur SON palier', () => {
    LOD_ZOOM.forEach((z, lod) => expect(lodOf(z)).toBe(lod));
  });
  it('detailOf : défauts plein détail à l’échelle RAW (QC/scripts)', () => {
    expect(detailOf()).toEqual({ lod: 2, mpt: 2 });
    expect(detailOf({ zoom: 0.55, mpt: 3 })).toEqual({ lod: 1, mpt: 3 });
  });
});

describe('detailPatternDefs — motifs partagés par (recette × orientation × variante)', () => {
  it('émet 3 variantes par axe pour la recette pierre, déterministes, étiquetées par PROJECTION', () => {
    const d0 = detailPatternDefs(dims, 2);
    expect(d0).toBe(detailPatternDefs(dims, 2));
    expect((d0.match(/dt-[a-z0-9]+-0-x/g) ?? []).length).toBeGreaterThanOrEqual(3); // ≥ 1 recette × 3 variantes, axe x, proj rot0
    const d1 = detailPatternDefs({ ...dims, rot: 1 }, 2);
    expect(d1).toContain('-1-x0'); // ids par projection : rot1 ne collisionne pas avec rot0 (planche QC multi-panneaux)
    expect(d1).not.toContain('-0-x0');
  });
  it('vue du DESSUS : variantes de dégradé + motifs de SOL, mais aucun motif de face VERTICALE', () => {
    const top = detailPatternDefs({ ...dims, view: 'top' }, 2);
    expect(top).toContain(`${terrainGradientId('herbe')}-v0`);
    expect(top).toContain(`${terrainGradientId('herbe')}-v3`);
    expect(top).toContain('-top-g"'); // sol appareillé : le plan du sol reste affine vu du dessus
    expect(top).not.toMatch(/dt-[a-z0-9]+-top-[xyda]\d/); // pas de face verticale en vue carrée
  });

  it('motif de SOL appareillé : UN motif par recette (surface continue), nuances de pierre CUITES dedans', () => {
    const d0 = detailPatternDefs(dims, 2);
    const grounds = d0.match(/dt-[a-z0-9]+-0-g"/g) ?? [];
    expect(grounds.length).toBeGreaterThan(0);
    expect(new Set(grounds).size).toBe(grounds.length); // pas de variantes : continuité entre tuiles
    expect(d0).toContain('rgba(255,255,255'); // nuances claires (spec) cuites dans le motif
    expect(d0).toContain('rgba(0,0,0'); // nuances sombres (ao)
  });

  it('terrainCoursesPattern : id du motif de sol pour un terrain appareillé, null sinon', () => {
    expect(terrainCoursesPattern('pave', dims, 2)).toMatch(/^dt-[a-z0-9]+-0-g$/);
    expect(terrainCoursesPattern('pave', { ...dims, rot: 3 }, 2)).toMatch(/-3-g$/);
    expect(terrainCoursesPattern('herbe', dims, 2)).toBeNull();
    expect(terrainCoursesPattern('???', dims, 2)).toBeNull();
  });
  it('edge-on : l’axe de CHANT (y, perpendiculaire à l’écran) est dégénéré → pas de motif y', () => {
    const edge = detailPatternDefs({ ...dims, rot: 0, edge: true }, 2);
    expect(edge).toContain('-0e-x0');
    expect(edge).not.toContain('-0e-y0');
  });
});

describe('terrainFillGradient — variance de teinte par tuile', () => {
  it('herbe : variante stable au hash du monde en LOD ≥ 1, dégradé de base en LOD 0, null si terrain inconnu', () => {
    const a = terrainFillGradient('herbe', { x: 3, y: 4, z: 0 }, 2);
    expect(a).toMatch(new RegExp(`^${terrainGradientId('herbe')}-v[0-3]$`));
    expect(terrainFillGradient('herbe', { x: 3, y: 4, z: 0 }, 1)).toBe(a);
    expect(terrainFillGradient('herbe', { x: 3, y: 4, z: 0 }, 0)).toBe(terrainGradientId('herbe'));
    expect(terrainFillGradient('vide', { x: 3, y: 4, z: 0 }, 2)).toBe(terrainGradientId('vide')); // terrain sans `tintVar`
    expect(terrainFillGradient('???', { x: 3, y: 4, z: 0 }, 2)).toBeNull();
  });
});

describe('coursesOverlaySvg — surcouche de structure (joints)', () => {
  it('polygone rempli du motif partagé de son orientation ; rien en vue du dessus / sans assises', () => {
    const ov = coursesOverlaySvg({ recipe: STONE, side: 'N', cell: { x: 2, y: 2, z: 0 }, quad: QUAD, dims, mpt: 2 });
    expect(ov).toMatch(/^<polygon points="[^"]+" fill="url\(#dt-[a-z0-9]+-0-x[0-2]\)"\/>$/);
    expect(coursesOverlaySvg({ recipe: STONE, side: 'N', cell: { x: 2, y: 2, z: 0 }, quad: QUAD, dims: { ...dims, view: 'top' }, mpt: 2 })).toBe('');
    expect(coursesOverlaySvg({ recipe: { seedScope: 'tile' }, side: 'N', cell: { x: 2, y: 2, z: 0 }, quad: QUAD, dims, mpt: 2 })).toBe('');
  });
  it('face de CHANT (edge-on, axe y dégénéré) : aucun motif', () => {
    expect(coursesOverlaySvg({ recipe: STONE, side: 'E', cell: { x: 2, y: 2, z: 0 }, quad: QUAD, dims: { ...dims, edge: true }, mpt: 2 })).toBe('');
  });
});

describe('verticalAccentsSvg — accents alignés sur l’appareillage', () => {
  it('déterministe au seed ; UN <path> par couleur (blocs clairs/sombres + mouchetis groupés)', () => {
    const a = verticalAccentsSvg(ctx());
    expect(a).toBe(verticalAccentsSvg(ctx()));
    expect(a).toContain('<path');
    // ≤ 2 chemins de blocs + 1 par couleur de mouchetis (fusion multi-sous-chemins, budget nœuds)
    expect((a.match(/<path /g) ?? []).length).toBeLessThanOrEqual(4);
    expect(verticalAccentsSvg(ctx({ seed: hash32('wall', 9, 9, 0, 'N') }))).not.toBe(a);
  });
  it('reservedV (ferrures) : les accents laissent les intervalles réservés intacts', () => {
    const libre = verticalAccentsSvg(ctx());
    const barre = verticalAccentsSvg(ctx({ reservedV: [[0, 2.25]] })); // TOUTE la face réservée
    expect(barre).not.toContain('fill="#'); // plus aucun bloc ni mouchetis opaque
    expect(libre.length).toBeGreaterThan(barre.length);
  });
  it('rangs CONTINUS (planches, sans blockWM) + paletteVar : nuances de rangs ENTIERS', () => {
    const BOIS: DetailRecipe = { seedScope: 'edge', courses: { hM: 0.3, joint: '#54432e', jointW: 0.022, paletteVar: 0.05 } };
    const a = verticalAccentsSvg(ctx({ recipe: BOIS }));
    expect(a).toContain('<path'); // au moins une planche nuancée
    expect((a.match(/<path /g) ?? []).length).toBeLessThanOrEqual(2); // 1 chemin clair + 1 sombre max
  });
});

describe('timberOverlaySvg — colombage (poteaux + écharpes X/V)', () => {
  const TIMBER: DetailRecipe = { seedScope: 'edge', timber: { postEveryM: 2, braces: 'X', wM: 0.08, color: '#3b2e1f' } };
  it('UN <path> stroké à la couleur de la recette, déterministe ; rien sans recette / en vue du dessus', () => {
    const t = timberOverlaySvg({ recipe: TIMBER, quad: QUAD, faceWM: 2, faceHM: 2.25, dims });
    expect(t).toMatch(/^<path d="[^"]+" fill="none" stroke="#3b2e1f" stroke-width="[\d.]+" stroke-linecap="square"\/>$/);
    expect((t.match(/M/g) ?? []).length).toBe(4); // 2 poteaux + 2 écharpes (X sur une travée)
    expect(timberOverlaySvg({ recipe: { seedScope: 'edge' }, quad: QUAD, faceWM: 2, faceHM: 2.25, dims })).toBe('');
    expect(timberOverlaySvg({ recipe: TIMBER, quad: QUAD, faceWM: 2, faceHM: 2.25, dims: { ...dims, view: 'top' } })).toBe('');
  });
});

describe('groundAccentsSvg — touffes/cailloux ancrés MONDE', () => {
  const HERBE: DetailRecipe = { seedScope: 'tile', tufts: { perM2: 1.1, hM: [0.1, 0.22], colors: ['#5c8a40', '#3a5c28'] } };
  it('déterministe ; UN SEUL <path> par section (couleur tirée PAR TUILE — budget sol) ; le nombre de brins survit à la rotation caméra', () => {
    const a = groundAccentsSvg(HERBE, { x: 1, y: 1, z: 0 }, 0, dims, 2);
    expect(a).toBe(groundAccentsSvg(HERBE, { x: 1, y: 1, z: 0 }, 0, dims, 2));
    expect((a.match(/<path /g) ?? []).length).toBe(1);
    expect(HERBE.tufts!.colors.some((c) => a.includes(`stroke="${c}"`))).toBe(true);
    const subCount = (svg: string) => (svg.match(/M/g) ?? []).length;
    for (const rot of [1, 2, 3] as const)
      expect(subCount(groundAccentsSvg(HERBE, { x: 1, y: 1, z: 0 }, 0, { ...dims, rot }, 2))).toBe(subCount(a));
  });
});
