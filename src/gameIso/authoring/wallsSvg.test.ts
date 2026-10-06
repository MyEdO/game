import { describe, it, expect } from 'vitest';
import { buildWalls } from '../builders/walls';
import type { WallEl } from '../builders/types';
import { wallDepth, wallSvg, wallAccentsSvg } from './wallsSvg';
import { depth, tileEdge, type Dims } from '../../geometry/iso';
import { structureAppearance } from '../catalog/structures';
import { shade, SIDE_N } from '../shade';
import { emptyScene, setStructureDown, type Scene, type WallSeg } from '../../state/scene';

/**
 * Backend écran-affine des murs : projette les éléments `wall` du pivot via la projection partagée.
 * On vérifie la PARITÉ de géométrie avec `tileEdge` (l'arête historique), l'ombrage d'orientation
 * (arête N dans l'ombre), les couleurs tirées de la def (par `wallPartColor`), la profondeur de tri
 * (MAX des 2 cases bordantes + 0.45) et la branche VUE DU DESSUS (représentation symbolique).
 */

const dims: Dims = { w: 6, h: 6 };

function el(seg: WallSeg, edit?: (s: Scene) => Scene): WallEl {
  let s = emptyScene(6, 6);
  s.walls = [seg];
  if (edit) s = edit(s);
  return buildWalls(s, 'jeu')[0];
}

describe('wallSvg — parité de géométrie avec tileEdge (arête historique)', () => {
  it.each([0, 1, 2, 3] as const)('cran %s : la base de la face passe par les extrémités de tileEdge', (rot) => {
    const d: Dims = { ...dims, rot };
    for (const side of ['N', 'E'] as const) {
      const svg = wallSvg(el({ x: 2, y: 2, side }), d);
      const [a, b] = tileEdge(2, 2, side, d, 0);
      expect(svg).toContain(`${a.cx},${a.cy}`);
      expect(svg).toContain(`${b.cx},${b.cy}`);
    }
  });
});

describe('wallSvg — bois : couleurs de la def, ombrage par ORIENTATION MONDE', () => {
  const app = structureAppearance('plain');
  it('arête E (éclairée) : la face garde sa couleur de def, la plinthe aussi', () => {
    const svg = wallSvg(el({ x: 2, y: 2, side: 'E' }), dims);
    expect(svg).toContain(`fill="${app.face}"`);
    expect(svg).toContain(`fill="${app.wood!.skirt}"`);
    expect(svg).toContain(`stroke="${shade(app.face, 0.4)}"`); // liseré dérivé de la face
  });
  it('arête N (dans l’ombre) : face assombrie par SIDE_N', () => {
    const svg = wallSvg(el({ x: 2, y: 2, side: 'N' }), dims);
    expect(svg).toContain(`fill="${shade(app.face, SIDE_N)}"`);
    expect(svg).not.toContain(`fill="${app.face}" stroke`); // la face pleine n'est plus au ton éclairé
  });
  it('montants : 2 rects de poteau (corps + chapiteau + socle) aux extrémités', () => {
    const svg = wallSvg(el({ x: 2, y: 2, side: 'E' }), dims);
    expect((svg.match(new RegExp(`fill="${app.post}"`, 'g')) ?? []).length).toBe(2);
  });
  it('bayPanel : le panneau prend `wood.inset`, la moulure est sa ligne médiane 1.3 px en `wood.frame`', () => {
    const nu = wallSvg(el({ x: 2, y: 2, side: 'E' }), dims);
    const def = structureAppearance('plain');
    def.bayPanel = true;
    try {
      const svg = wallSvg(el({ x: 2, y: 2, side: 'E' }), dims);
      expect(svg).toContain(`fill="${app.wood!.inset}"`);
      expect(svg).toContain(`stroke="${app.wood!.frame}" stroke-width="1.3"`);
      expect(svg.length).toBeGreaterThan(nu.length);
    } finally {
      delete def.bayPanel;
    }
  });
});

describe('wallSvg — porte bois OUVERTE : un TROU bordé de jambages', () => {
  it('aucune face ne remplit l’ouverture ; les 2 jambages la bordent', () => {
    const svg = wallSvg(el({ x: 2, y: 2, side: 'N', door: true }), dims);
    expect(svg).not.toContain('opacity=');
    const app = structureAppearance('plain');
    expect((svg.match(new RegExp(`fill="${shade(app.face, 1.25)}"`, 'g')) ?? []).length).toBe(2); // chapiteaux de jambage (repli)
  });
});

describe('wallSvg — pierre : palette UNIFIÉE du JSON (hex), face ombrée par orientation comme le bois', () => {
  const pierre = structureAppearance('mur-en-pierre');
  it('courtine N : face assombrie (SIDE_N), bandes/arase/merlons aux hex de la def + motif d’appareillage', () => {
    const svg = wallSvg(el({ x: 2, y: 2, side: 'N', structure: 'mur-en-pierre' }), dims);
    expect(svg).toContain(`fill="${shade(pierre.face, SIDE_N)}"`);
    expect(svg).toContain(`fill="${pierre.band}"`);
    expect(svg).toContain(`fill="${pierre.cap}"`); // arase + merlons
    expect(svg).toContain('fill="url(#dt-'); // motif de joints partagé (recette `detail.courses`)
    expect(svg).not.toContain('stroke-width="1.7"');
  });
  it('LOD 0 (fills plats) : plus aucun motif', () => {
    const svg = wallSvg(el({ x: 2, y: 2, side: 'N', structure: 'mur-en-pierre' }), dims, { zoom: 0.4 });
    expect(svg).not.toContain('fill="url(#dt-');
  });
  it('porte-de-ville : 7 barreaux de herse (lignes 1.7 px) + 2 traverses', () => {
    const svg = wallSvg(el({ x: 2, y: 2, side: 'N', structure: 'porte-de-ville' }), dims);
    expect((svg.match(/stroke-width="1\.7"/g) ?? []).length).toBe(7);
    const trav = structureAppearance('porte-de-ville').door!.herse!.traverseColor;
    expect((svg.match(new RegExp(`fill="${trav}"`, 'g')) ?? []).length).toBe(2);
  });
  it('brèche : gravats + tas dentelé (liseré ferrure)', () => {
    const svg = wallSvg(el({ x: 2, y: 2, side: 'N', structure: 'mur-en-pierre' }, (s) => setStructureDown(s, 2, 2, 'N', 0, true)), dims);
    expect(svg).toContain(`fill="${pierre.rubble}"`);
    expect(svg).toContain(`fill="${pierre.rubbleHi}"`);
    expect(svg).toContain('stroke-width="0.6"');
  });
});

describe('wallAccentsSvg — couche d’accents seedés (LOD 2), séparée du memo', () => {
  it('pierre : blocs nuancés + mouchetis, déterministes au seed monde ; vide en LOD < 2 / vue du dessus / brèche', () => {
    const w = el({ x: 2, y: 2, side: 'N', structure: 'mur-en-pierre' });
    const a1 = wallAccentsSvg(w, dims);
    const a2 = wallAccentsSvg(w, dims);
    expect(a1).toBe(a2);
    expect(a1).toContain('<path');
    expect(wallAccentsSvg(el({ x: 3, y: 2, side: 'N', structure: 'mur-en-pierre' }), dims)).not.toBe(a1); // seed = identité monde
    expect(wallAccentsSvg(w, dims, { zoom: 0.6 })).toBe('');
    expect(wallAccentsSvg(w, { ...dims, view: 'top' })).toBe('');
    expect(wallAccentsSvg(el({ x: 2, y: 2, side: 'N', structure: 'mur-en-pierre' }, (s) => setStructureDown(s, 2, 2, 'N', 0, true)), dims)).toBe('');
  });
  it('bois : nuances de PLANCHES (rangs continus sans blocs, paletteVar) — pleine largeur de face', () => {
    const a = wallAccentsSvg(el({ x: 2, y: 2, side: 'N' }), dims);
    expect(a).toContain('<path'); // quelques planches plus claires/sombres
    expect(a).toBe(wallAccentsSvg(el({ x: 2, y: 2, side: 'N' }), dims));
  });
});

describe('wallSvg — colombage (recette `timber`, matériaux v2)', () => {
  const timber = structureAppearance('mur-en-bois').detail!.timber!;
  it('mur-en-bois : poteaux + écharpes en X à la couleur de la recette (LOD ≥ 1, pas en LOD 0)', () => {
    const svg = wallSvg(el({ x: 2, y: 2, side: 'E', structure: 'mur-en-bois' }), dims);
    expect(svg).toContain(`stroke="${timber.color}"`);
    expect(wallSvg(el({ x: 2, y: 2, side: 'E', structure: 'mur-en-bois' }), dims, { zoom: 0.4 })).not.toContain(`stroke="${timber.color}"`);
  });
  it('jamais sur une travée de PORTE (l’ouverture couperait les écharpes) ni un mur nu `plain`', () => {
    expect(wallSvg(el({ x: 2, y: 2, side: 'E', structure: 'mur-en-bois', door: true }), dims)).not.toContain(`stroke="${timber.color}"`);
    expect(wallSvg(el({ x: 2, y: 2, side: 'E' }), dims)).not.toContain(`stroke="${timber.color}"`);
  });
});

describe('wallSvg — apparence de façade authorée', () => {
  const authored = (): WallEl => {
    const s = emptyScene(6, 6);
    s.walls = [{ x: 2, y: 2, side: 'E' }];
    s.architecture = [{
      id: 'corps-auberge',
      style: 'taverne',
      storeys: [],
      facades: [{
        id: 'facade-rue',
        z: 0,
        edges: [{ x: 2, y: 2, side: 'E' }],
        appearance: 'auberge-relais-imperiale',
      }],
      masses: [],
    }];
    return buildWalls(s, 'jeu')[0];
  };

  it.each([0, 1, 2, 3] as const)('cran %s : résout le matériau partagé et conserve la même arête', (rot) => {
    const d: Dims = { ...dims, rot };
    const wall = authored();
    const svg = wallSvg(wall, d);
    const timber = structureAppearance('mur-a-ossature-en-bois');
    const [a, b] = tileEdge(2, 2, 'E', d, 0);
    expect(wall.appearance).toBe('auberge-relais-imperiale');
    expect(svg).toContain(timber.detail!.timber!.color);
    expect(svg).toContain(`${a.cx},${a.cy}`);
    expect(svg).toContain(`${b.cx},${b.cy}`);
  });

  it.each([0, 1, 2, 3] as const)('cran %s : les features planaires restent attachées et identifiables', (rot) => {
    const s = emptyScene(6, 6);
    s.walls = [{ x: 2, y: 2, side: 'E' }];
    s.architecture = [{
      id: 'corps', style: 'taverne', storeys: [], masses: [],
      facades: [{
        id: 'rue', z: 0, edges: [{ x: 2, y: 2, side: 'E' }], appearance: 'auberge-relais-imperiale',
        features: [
          { id: 'fenetres', kind: 'window-band', edge: { x: 2, y: 2, side: 'E' }, width: 0.6 },
          { id: 'entree', kind: 'stone-entry', edge: { x: 2, y: 2, side: 'E' }, width: 0.7 },
          { id: 'pignon', kind: 'gable', edge: { x: 2, y: 2, side: 'E' }, width: 0.8 },
        ],
      }],
    }];
    const svg = wallSvg(buildWalls(s, 'jeu')[0], { ...dims, rot });
    for (const id of ['fenetres', 'entree', 'pignon'])
      expect(svg).toContain(`data-architecture-feature="corps:rue:${id}"`);
  });

  it('la géométrie de feature suit les quatre rotations sans coordonnées invalides', () => {
    const s = emptyScene(6, 6);
    s.walls = [{ x: 2, y: 2, side: 'N' }];
    s.architecture = [{
      id: 'corps', style: 'taverne', storeys: [], masses: [],
      facades: [{
        id: 'rue', z: 0, edges: [{ x: 2, y: 2, side: 'N' }], appearance: 'auberge-relais-imperiale',
        features: [{ id: 'pignon', kind: 'gable', edge: { x: 2, y: 2, side: 'N' }, width: 0.8 }],
      }],
    }];
    const outputs = ([0, 1, 2, 3] as const).map((rot) => wallSvg(buildWalls(s, 'jeu')[0], { ...dims, rot }));
    expect(new Set(outputs).size).toBe(4);
    expect(outputs.every((svg) => !svg.includes('NaN') && !svg.includes('Infinity'))).toBe(true);
  });
});

describe('wallDepth — MAX des cases bordantes + 0.45, aux 4 rotations', () => {
  it.each([0, 1, 2, 3] as const)('cran %s', (rot) => {
    const d: Dims = { ...dims, rot };
    expect(wallDepth(el({ x: 2, y: 2, side: 'E' }), d)).toBe(Math.max(depth(2, 2, d), depth(3, 2, d)) + 0.45);
    expect(wallDepth(el({ x: 2, y: 2, side: 'N' }), d)).toBe(Math.max(depth(2, 2, d), depth(2, 1, d)) + 0.45);
    expect(wallDepth(el({ x: 2, y: 2, side: '\\' }), d)).toBe(depth(2, 2, d) + 0.45);
  });
  it('vue du dessus : +0.6 au-dessus des overlays de sol', () => {
    const d: Dims = { ...dims, view: 'top' };
    expect(wallDepth(el({ x: 2, y: 2, side: 'E' }), d)).toBe(Math.max(depth(2, 2, d), depth(3, 2, d)) + 0.45 + 0.6);
  });
});

describe('wallSvg — vue du DESSUS (représentation symbolique)', () => {
  const top: Dims = { ...dims, view: 'top' };
  it('mur bois : double trait arrondi ; porte : deux jambages (ouverture centrale)', () => {
    const mur = wallSvg(el({ x: 2, y: 2, side: 'N' }), top);
    expect((mur.match(/stroke-linecap="round"/g) ?? []).length).toBe(2); // liseré + trait
    expect(mur).not.toContain('<polygon'); // symbolique, pas les faces
    const porte = wallSvg(el({ x: 2, y: 2, side: 'N', door: true }), top);
    expect((porte.match(/<line /g) ?? []).length).toBe(2);
  });
  it('courtine : traits 11/7 ; corps de garde : case pleine + glyphe ; abattue : tirets', () => {
    const courtine = wallSvg(el({ x: 2, y: 2, side: 'N', structure: 'mur-en-pierre' }), top);
    expect(courtine).toContain('stroke-width="11"');
    expect(courtine).toContain('stroke-width="7"');
    const porte = wallSvg(el({ x: 2, y: 2, side: 'N', structure: 'porte-de-ville' }), top);
    expect(porte).toContain('<path'); // la case (diamondPath) pleine
    expect(porte).toContain('fill="#241a10"'); // renfoncement du glyphe (def recess)
    const breche = wallSvg(el({ x: 2, y: 2, side: 'N', structure: 'mur-en-pierre' }, (s) => setStructureDown(s, 2, 2, 'N', 0, true)), top);
    expect(breche).toContain('stroke-dasharray="3 5"');
  });
});
