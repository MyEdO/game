import { describe, it, expect } from 'vitest';
import { buildRoofs, roofPans, roofCoursesPerStep, ROOF_SLOPE_M, type RoofShapeSpec } from '../builders/roofs';
import type { RoofEl } from '../builders/types';
import { roofDepth, roofSvg } from './roofsSvg';
import { diamondPath, footprintDepth, tileCenter, WALL_H, type Dims } from '../../geometry/iso';
import { WALL_H_M } from '../iso';
import { metricToLift, METRES_PER_LEVEL } from '../../state/relief';
import { roofMaterial } from '../catalog/roofs';
import { shade } from '../shade';
import { mix } from '../../data/couleur';
import { emptyScene } from '../../state/scene';

/**
 * Backend écran-affine des toits : projette les éléments `roof` du pivot via le pont partagé (`projGP`).
 * On vérifie la teinte PAR PAN (une couleur par orientation, STABLE aux 4 rotations — fini le choix
 * par-cellule), les lignes stylées par la def (`line`/`course`), la géométrie d'avant-toit attendue
 * (à WALL_H px au-dessus du coin de grille), la profondeur de tri (footprintDepth) et les
 * deux modes PLAN (vue du dessus = boîte étiquetée ; éditeur = couverture par-cellule + libellé).
 */

const dims: Dims = { w: 10, h: 10 };

/** `RoofEl` construit À LA MAIN (#822) : ce fichier teste le
 *  RENDU du pivot `roof` — indépendant de sa PROVENANCE (masse authorée ou, ici, cellules directes) —
 *  jamais le modèle `Scene`. `roofPans` est la même fonction que `buildRoofs` appelle en production. */
function elFromCells(cells: Set<string>, opts: { material?: string; label?: string; eaveHeightM?: number } = {}): RoofEl {
  const coords = [...cells].map((k) => { const [x, y] = k.split(',').map(Number); return { x, y }; });
  const minX = Math.min(...coords.map((c) => c.x)), minY = Math.min(...coords.map((c) => c.y));
  const maxX = Math.max(...coords.map((c) => c.x)), maxY = Math.max(...coords.map((c) => c.y));
  const w = maxX - minX + 1, h = maxY - minY + 1;
  const material = opts.material ?? 'tuile';
  const shape: RoofShapeSpec = {
    profile: w === 1 || h === 1 ? 'flat' : 'hip',
    ridge: w >= h ? 'x' : 'y',
    pitch: ROOF_SLOPE_M,
    eaveHeightM: opts.eaveHeightM ?? WALL_H_M,
  };
  const def = roofMaterial(material);
  const { faces, lines } = roofPans(cells, material, roofCoursesPerStep(def.detail), { overhang: def.eaveOverhangM ?? 0, fasciaDrop: def.fasciaDropM ?? 0 }, shape);
  return {
    kind: 'roof',
    key: 'roof:r1',
    cell: { x: minX, y: minY, z: 0 },
    span: { w, h },
    cells: coords,
    material,
    profile: shape.profile,
    ridge: shape.ridge,
    pitch: shape.pitch,
    eaveHeightM: shape.eaveHeightM,
    label: opts.label ?? 'maison',
    faces,
    lines,
    states: { visible: true, roofOccupied: false },
  };
}

function el(patch: { foot?: { x: number; y: number; w: number; h: number }; label?: string; eaveHeightM?: number; params?: { roofMaterial?: string } } = {}): RoofEl {
  const foot = patch.foot ?? { x: 2, y: 2, w: 4, h: 2 };
  const cells = new Set<string>();
  for (let dy = 0; dy < foot.h; dy++) for (let dx = 0; dx < foot.w; dx++) cells.add(`${foot.x + dx},${foot.y + dy}`);
  return elFromCells(cells, { material: patch.params?.roofMaterial, label: patch.label, eaveHeightM: patch.eaveHeightM });
}

const count = (svg: string, needle: string) => svg.split(needle).length - 1;

/** `pitch` = ancienne convention m PAR CASE de distance transverse (ce que les assertions ci-dessous
 *  attendent) ; convertie en l'angle authoré (`pitchDeg`) via la même formule que le builder
 *  (`metresPerTile` par défaut 2, non posé sur `emptyScene`) — la géométrie produite reste identique. */
const pitchDegFor = (pitchMPerCase: number) => (Math.atan(pitchMPerCase / 2) * 180) / Math.PI;

function authoredGable(pitch = 0.5): RoofEl[] {
  const scene = emptyScene(10, 10);
  scene.architecture = [{
    id: 'corps',
    style: 'maison',
    storeys: [],
    facades: [],
    masses: [{
      id: 'toit',
      z: 0,
      footprint: [{ x: 2, y: 2, w: 4, h: 2 }],
      levels: 1,
      profile: 'gable',
      ridge: 'x',
      pitchDeg: pitchDegFor(pitch),
      material: 'tuile',
    }],
  }];
  return buildRoofs(scene);
}

function authoredProfile(profile: 'hip' | 'shed', ridge: 'x' | 'y'): RoofEl[] {
  const scene = emptyScene(10, 10);
  scene.architecture = [{
    id: 'corps',
    style: 'maison',
    storeys: [],
    facades: [],
    masses: [{
      id: `toit-${profile}-${ridge}`,
      z: 0,
      footprint: [ridge === 'x' ? { x: 2, y: 2, w: 4, h: 2 } : { x: 2, y: 2, w: 2, h: 4 }],
      levels: 1,
      profile,
      ridge,
      ...(profile === 'shed' ? { eaveSide: (ridge === 'x' ? 'N' : 'O') as 'N' | 'O' } : {}),
      pitchDeg: pitchDegFor(0.5),
      material: 'tuile',
    }],
  }];
  return buildRoofs(scene);
}

describe('roofSvg — pans : UNE teinte par pan, par ORIENTATION de la def, stable aux 4 rotations', () => {
  const tuile = roofMaterial('tuile');
  it.each([0, 1, 2, 3] as const)('cran %s : 4 pans remplis N/E/S/O de la donnée, exactement un chacun', (rot) => {
    const svg = roofSvg(el({}), { ...dims, rot });
    for (const part of ['N', 'E', 'S', 'O'] as const) expect(count(svg, `fill="${tuile[part]}"`)).toBe(1);
  });

  it('edge-on : mêmes 4 pans (la nappe suit la projection, pas la boîte-plan)', () => {
    const svg = roofSvg(el({}), { ...dims, rot: 1, edge: true });
    for (const part of ['N', 'E', 'S', 'O'] as const) expect(count(svg, `fill="${tuile[part]}"`)).toBe(1);
  });

  it('matériau des params (ardoise) : teintes de SA def', () => {
    const svg = roofSvg(el({ params: { roofMaterial: 'toit-ardoise' } }), dims);
    expect(svg).toContain(`fill="${roofMaterial('toit-ardoise').N}"`);
    expect(svg).not.toContain(`fill="${tuile.N}"`);
  });

  it('1×1 : pan PLAT au ton N + son avant-toit (4 soffites + 4 fascias débordants)', () => {
    const svg = roofSvg(el({ foot: { x: 3, y: 3, w: 1, h: 1 } }), dims);
    expect(count(svg, '<path')).toBe(9); // 1 pan + 4 soffites + 4 fascias (un débord par égout)
    expect(count(svg, `fill="${tuile.N}"`)).toBe(1); // le pan reste au ton N
    expect(svg).toContain(`fill="${tuile.soffite}"`); // dessous débordant ombré
    expect(svg).toContain(`fill="${tuile.fascia}"`); // planche de rive sombre
  });
});

describe('roofSvg — lignes stylées par la def (liseré + rangs de la recette)', () => {
  it('faîte/arêtiers/égouts au liseré `line`, rangs de tuiles au ton `detail.courses.joint`', () => {
    const tuile = roofMaterial('tuile');
    const svg = roofSvg(el({}), dims, { zoom: 0.4 }); // LOD 0 : rendu historique, rangs droits seuls
    // 1 faîte + 4 arêtiers + 4 égouts = 9 lignes de structure ; 3 rangs × 4 pans = 12 rangs
    // (pas hM = 0.24 m → 3 rangs par cran de montée, source unique builder/backend).
    expect(count(svg, `stroke="${tuile.line}"`)).toBe(9);
    expect(count(svg, `stroke="${tuile.detail!.courses!.joint}"`)).toBe(12);
    expect(svg).not.toContain('<clipPath'); // aucun détail de couverture en LOD 0
  });

  it('faîtage : liseré CLAIR `ridgeCap` par-dessus le trait de base → couronnement volumique', () => {
    const tuile = roofMaterial('tuile');
    const svg = roofSvg(el({}), dims, { zoom: 0.4 });
    expect(svg).toContain(`stroke="${tuile.ridgeCap}"`);
    // chaume = crête molle : pas de couronnement — sa faîte n'emprunte AUCUN autre ton que `line`.
    expect(roofMaterial('chaume').ridgeCap).toBeUndefined();
  });
});

describe('roofSvg — VOLUME d’avant-toit (le toit DÉBORDE, ne pose plus à ras)', () => {
  const tuile = roofMaterial('tuile');
  it.each([0, 1, 2, 3] as const)('cran %s : soffites + fascias débordants au ton dédié de la def', (rot) => {
    const svg = roofSvg(el({}), { ...dims, rot });
    expect(count(svg, `fill="${tuile.soffite}"`)).toBeGreaterThan(0); // dessous ombré
    expect(count(svg, `fill="${tuile.fascia}"`)).toBeGreaterThan(0); // planche de rive sombre
  });
  it('edge-on : le débord suit la projection (soffites + fascias présents)', () => {
    const svg = roofSvg(el({}), { ...dims, rot: 1, edge: true });
    expect(svg).toContain(`fill="${tuile.soffite}"`);
    expect(svg).toContain(`fill="${tuile.fascia}"`);
  });
  it('chaume : soffite débordant mais AUCUNE fascia dure (bord arrondi)', () => {
    const chaume = roofMaterial('chaume');
    const svg = roofSvg(el({ params: { roofMaterial: 'chaume' } }), dims);
    expect(svg).toContain(`fill="${chaume.soffite}"`);
    expect(chaume.fascia).toBeUndefined();
  });
});

describe('roofSvg — détail de couverture (matériaux v2, LOD ≥ 1)', () => {
  const tuile = roofMaterial('tuile');
  const pv = tuile.detail!.courses!.paletteVar!;
  const nuances = (['N', 'E', 'S', 'O'] as const).flatMap((p) => [shade(tuile[p]!, 1 + pv * 1.5), shade(tuile[p]!, 1 - pv * 1.5)]);
  it('tuile : bardeaux + nuances par pan, CLIPPÉS au polygone du pan, déterministes', () => {
    const svg = roofSvg(el({}), dims);
    expect(svg).toBe(roofSvg(el({}), dims));
    expect(count(svg, '<clipPath')).toBeGreaterThan(0);
    expect(count(svg, 'clip-path="url(#rfc-0-')).toBe(count(svg, '<clipPath')); // 1 groupe par clip, id par projection
    // Nuances de bardeau (LOD 2) : chemins clairs/sombres dérivés du fill du pan par `shade`.
    expect(nuances.some((c) => svg.includes(`fill="${c}"`))).toBe(true);
  });
  it('LOD 1 : bardeaux (joints) sans nuances ; ids de clip étiquetés par rotation', () => {
    const svg = roofSvg(el({}), { ...dims, rot: 2 }, { zoom: 0.6 });
    expect(svg).toContain('clip-path="url(#rfc-2-');
    for (const c of nuances) expect(svg).not.toContain(`fill="${c}"`);
  });
  it('chaume : rangs TREMBLÉS (plus aucune <line> de rang droite) + brins de paille ancrés au pan', () => {
    const chaume = roofMaterial('chaume');
    const svg = roofSvg(el({ params: { roofMaterial: 'chaume' } }), dims);
    const droits = count(svg, `<line`) - 9; // 9 lignes de structure (faîte/arêtiers/égouts)
    expect(droits).toBe(0);
    expect(count(svg, `stroke="${chaume.detail!.courses!.joint}"`)).toBeGreaterThan(0); // polylignes organiques
    // Paille : teinte de la recette MIXÉE au fill de son pan (jamais la couleur brute qui claque).
    const straws = (['N', 'E', 'S', 'O'] as const).flatMap((p) => chaume.detail!.tufts!.colors.map((c) => mix(chaume[p]!, c, 0.55)));
    expect(straws.some((c) => svg.includes(`stroke="${c}"`))).toBe(true);
  });
});

describe('roofSvg — parité de géométrie avec l’ex-nappe (base WALL_H px au-dessus du coin de grille)', () => {
  it.each([0, 1, 2, 3] as const)('cran %s : le coin d’avant-toit NO passe par tileCenter(x−0.5,y−0.5) − WALL_H', (rot) => {
    const d: Dims = { ...dims, rot };
    const svg = roofSvg(el({}), d);
    const { cx, cy } = tileCenter(1.5, 1.5, d, metricToLift(WALL_H_M)); // coin de grille (2,2) soulevé de WALL_H px
    expect(svg).toContain(`${cx},${cy}`);
    expect(metricToLift(WALL_H_M) * 96).toBe(WALL_H); // la conversion m⇔px retombe sur la vérité partagée
  });
});

describe('roofDepth — footprintDepth de l’empreinte à l’ALTITUDE de la nappe', () => {
  it.each([0, 1, 2, 3] as const)('cran %s', (rot) => {
    const d: Dims = { ...dims, rot };
    expect(roofDepth(el({}), d)).toBe(footprintDepth(2, 2, 4, 2, d, metricToLift(WALL_H_M)));
  });

  it.each([0, 1, 2, 3] as const)('section authorée cran %s : profondeur calculée sur la borne serrée du pan', (rot) => {
    const d: Dims = { ...dims, rot };
    const pans = authoredGable();
    expect(pans.map((pan) => roofDepth(pan, d))).toEqual(
      pans.map((pan) => footprintDepth(pan.cell.x, pan.cell.y, pan.span.w, pan.span.h, d, metricToLift(pan.eaveHeightM))),
    );
    expect(pans.map((pan) => pan.span)).toEqual([{ w: 4, h: 1 }, { w: 4, h: 1 }]);
  });
});

describe('roofSvg — pans authorés indépendants', () => {
  it.each([0, 1, 2, 3] as const)('cran %s conserve les deux orientations monde du gable', (rot) => {
    const tuile = roofMaterial('tuile');
    const svg = authoredGable().map((pan) => roofSvg(pan, { ...dims, rot })).join('');
    expect(count(svg, `fill="${tuile.N}"`)).toBe(1);
    expect(count(svg, `fill="${tuile.S}"`)).toBe(1);
  });

  it.each([
    ['hip', 'x'],
    ['hip', 'y'],
    ['shed', 'x'],
    ['shed', 'y'],
  ] as const)('%s faîtage %s reste stable aux quatre rotations avec détail matériel', (profile, ridge) => {
    const outputs = ([0, 1, 2, 3] as const).map((rot) =>
      authoredProfile(profile, ridge).map((pan) => roofSvg(pan, { ...dims, rot })).join(''));
    for (const svg of outputs) {
      expect(svg).toContain(`fill="${roofMaterial('tuile').soffite}"`);
      expect(svg).toContain(`fill="${roofMaterial('tuile').fascia}"`);
      expect(svg).toContain(`stroke="${roofMaterial('tuile').detail!.courses!.joint}"`);
    }
  });

  it('détail SVG : le pas de bardeau suit pitch/courses authorés, pas ROOF_SLOPE_M', () => {
    const [pan] = authoredGable(0.96);
    const rangs = pan.lines.filter((line) => line.kind === 'rang');
    const levels = [...new Set(rangs.map((line) => line.a.h))].sort((a, b) => a - b);
    const fallback: RoofEl = { ...pan, pitch: undefined };
    const authoredSvg = roofSvg(pan, dims);
    const fallbackSvg = roofSvg(fallback, dims);
    expect(levels[1] - levels[0]).toBeCloseTo(0.24);
    expect(roofSvg(pan, dims, { zoom: 0.4 })).toBe(roofSvg(fallback, dims, { zoom: 0.4 }));
    expect(authoredSvg).not.toBe(fallbackSvg);
    expect(authoredSvg).toContain('<clipPath');
    expect(authoredSvg).not.toContain('NaN');
  });
});

describe('roofSvg — modes PLAN', () => {
  it('vue du dessus : empreinte exacte (planBody/planEdge), et rien d’autre que l’empreinte', () => {
    const plan = roofMaterial('plan');
    const svg = roofSvg(el({ label: 'Taverne' }), { ...dims, view: 'top' });
    expect(count(svg, '<path')).toBe(8); // 4×2 cases
    expect(svg).toContain(`fill="${plan.planBody}"`);
    expect(svg).toContain(`stroke="${plan.planEdge}"`);
    expect(svg).not.toContain(`fill="${roofMaterial('tuile').N}"`); // pas de pans en plan
    expect(svg).not.toContain('<text');
  });

  it('le TEXTE d’un plan est une ENTRÉE de rendu : peint exactement le `label` que l’appelant passe', () => {
    const plan = roofMaterial('plan');
    const svg = roofSvg(el({ label: 'Forge' }), dims, { plan: true, label: 'Corps de garde' });
    expect(count(svg, '<text')).toBe(1);
    expect(svg).toContain('>Corps de garde</text>');
    expect(svg).toContain(`fill="${plan.planText}"`);
  });

  it('appelant sans `label` : le plan est une couverture NUE (aucun texte fabriqué par le backend)', () => {
    for (const svg of [roofSvg(el({ label: 'Forge' }), dims, { plan: true }), roofSvg(el({ label: 'Forge' }), { ...dims, view: 'top' })])
      expect(svg).not.toContain('<text');
  });

  it('éditeur ({ plan: true }) : une tuile semi-transparente PAR CASE de l’empreinte + libellé', () => {
    const svg = roofSvg(el({ label: 'Forge' }), dims, { plan: true, label: 'Forge' });
    expect(count(svg, '<path')).toBe(8); // 4×2 cases
    expect(count(svg, 'opacity="0.7"')).toBe(8);
    expect(svg).toContain(`fill="${roofMaterial('tuile').O}"`); // teinte du matériau de couverture
    expect(svg).toContain('>Forge</text>');
  });

  it('libellé échappé (XML)', () => {
    expect(roofSvg(el({}), dims, { plan: true, label: 'A<B & C>' })).toContain('A&lt;B &amp; C&gt;');
  });

  it('vue du dessus : peint seulement les cellules exactes d’une union en L', () => {
    const grouped = elFromCells(new Set(['0,0', '0,1', '0,2', '1,2', '2,2']));
    const svg = roofSvg(grouped, { ...dims, view: 'top' });
    expect(count(svg, '<path')).toBe(5);
    expect(svg).not.toContain(`d="${diamondPath(1, 0, { ...dims, view: 'top' })}"`);
  });

  describe('ALTITUDE de la nappe (#835 FU-2)', () => {
    // Une SEULE vérité d'altitude dans le pivot : la cote MÉTRIQUE de l'égout. L'index de couche
    // `cell.z` ne la porte pas — un plancher coté (butte, cage d'escalier) hisse la nappe sans
    // changer d'étage.
    const auSol = el({ label: 'Grange' });
    const perchee = el({ label: 'Grange', eaveHeightM: WALL_H_M + 2 * METRES_PER_LEVEL });
    // La MÊME nappe, à la MÊME altitude, mais déclarée deux étages plus haut : l'index ne trace rien.
    const percheeAEtage = { ...perchee, cell: { ...perchee.cell, z: 2 } };

    it('mode plan éditeur : la nappe se trace à l’ALTITUDE de son égout, pas au sol', () => {
      const sol = roofSvg(auSol, dims, { plan: true });
      const haut = roofSvg(perchee, dims, { plan: true });
      // Le grief exact de #835 FU-2 : le SVG était byte-identique d'une hauteur à l'autre.
      expect(haut).not.toBe(sol);
      expect(sol).toContain(`d="${diamondPath(2, 2, dims, metricToLift(WALL_H_M))}"`);
      expect(haut).toContain(`d="${diamondPath(2, 2, dims, metricToLift(WALL_H_M + 2 * METRES_PER_LEVEL))}"`);
      expect(tileCenter(2, 2, dims, metricToLift(perchee.eaveHeightM)).cy).toBeLessThan(tileCenter(2, 2, dims, metricToLift(WALL_H_M)).cy);
    });

    it('l’INDEX de couche ne trace rien : à égout égal, la même nappe se trace pareil quel que soit `cell.z`', () => {
      expect(roofSvg(percheeAEtage, dims, { plan: true })).toBe(roofSvg(perchee, dims, { plan: true }));
      expect(roofDepth(percheeAEtage, dims)).toBe(roofDepth(perchee, dims));
    });

    it('vue du dessus : la hauteur ne décale RIEN (regard vertical) — même SVG, contrairement à l’iso', () => {
      const top: Dims = { ...dims, view: 'top' };
      expect(roofSvg(perchee, top)).toBe(roofSvg(auSol, top));
    });

    it('la profondeur de tri suit l’altitude : une nappe haute passe devant une nappe basse superposée', () => {
      expect(roofDepth(perchee, dims)).toBeGreaterThan(roofDepth(auSol, dims));
    });
  });
});

/**
 * FERMETURE DE COMBLE (pignon) : le plan du pignon est EN RETRAIT de son avant-toit — le débord
 * d'égout et sa planche de rive le survolent. Il se peint donc AVANT les pans de sa propre nappe,
 * aux QUATRE rotations, et par une vérité de profondeur — jamais par l'ordre d'émission.
 */
describe('roofDepth — une fermeture de comble passe sous le retour d’égout de sa nappe', () => {
  const scene = (() => {
    const s = emptyScene(16, 16);
    s.walls = [4, 8].flatMap((x) => [3, 4].map((y) => ({ x, y, side: 'E' as const, structure: 'mur-en-bois' })));
    s.architecture = [{
      id: 'corps', style: 'maison', storeys: [], facades: [],
      masses: [{ id: 'nef', z: 0, footprint: [{ x: 5, y: 3, w: 4, h: 2 }], levels: 1, profile: 'gable', ridge: 'x', pitchDeg: 40, material: 'tuile' }],
    }];
    return s;
  })();
  const els = buildRoofs(scene);
  const pignons = els.filter((el) => el.panId?.startsWith('pignon-'));
  const pans = els.filter((el) => !el.panId?.startsWith('pignon-'));

  it('la nappe ferme bien ses deux extrémités et garde ses pans', () => {
    expect(pignons).toHaveLength(2);
    expect(pans.length).toBeGreaterThan(0);
  });

  it.each([0, 1, 2, 3] as const)('rotation %i : le pignon PROCHE se peint avant le pan proche (l’avant-toit le survole)', (rot) => {
    const d: Dims = { w: 16, h: 16, rot };
    expect(Math.max(...pignons.map((el) => roofDepth(el, d)))).toBeLessThan(Math.max(...pans.map((el) => roofDepth(el, d))));
  });

  it.each([0, 1, 2, 3] as const)('rotation %i : AUCUNE égalité de profondeur pignon ⇄ pan — l’ordre ne dépend pas de l’émission', (rot) => {
    const d: Dims = { w: 16, h: 16, rot };
    const dPans = pans.map((el) => roofDepth(el, d));
    for (const el of pignons) expect(dPans).not.toContain(roofDepth(el, d));
  });

  it('le débord d’avant-toit passe RÉELLEMENT au-delà du plan du pignon (sinon rien à trancher)', () => {
    const xPignon = Math.min(...pignons.flatMap((el) => el.faces[0].poly.map((p) => p.x)));
    const xDebord = Math.min(...pans.flatMap((el) => el.faces.flatMap((f) => f.poly.map((p) => p.x))));
    expect(xDebord).toBeLessThan(xPignon);
  });

  it('en mode PLAN et en vue du dessus, une fermeture ne peint RIEN (elle est verticale)', () => {
    for (const el of pignons) {
      expect(roofSvg(el, { w: 16, h: 16 }, { plan: true, label: el.label })).toBe('');
      expect(roofSvg(el, { w: 16, h: 16, view: 'top' })).toBe('');
    }
    expect(roofSvg(pans[0], { w: 16, h: 16 }, { plan: true, label: pans[0].label })).not.toBe('');
  });
});
