import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { IMPORT_RE } from '../../../../scripts/guards/lib/importGraph.mjs';
import {
  COPLANAR_BIAS_M,
  biasPoly,
  coplanarOverlapPairs,
  coplanarRanks,
  crossQuadPolys,
  facePoly,
  faceQuads,
  faceQuadsOriented,
  facesGeometry,
  faceUv1,
  faceUvFrame,
  planarFrame,
  planarUV,
  fanTriangles,
  gpToWorld,
  isConvex,
  planarity,
  polyBounds,
  polyNormal,
  pxPerM,
  wallBoxPolys,
  type Bounds,
  type Vec3,
  type WorldPoly,
} from './worldTris';
import { faceDepthM, faceDepthOf } from './faceRelief';
import {
  uprightCrossM,
  UPRIGHT_OVERHANG_M,
  UPRIGHT_WIDTH_M,
  WALL_MATTER_M,
  wallMatterM,
  wallPartRelief,
  type StructureAppearanceDef,
  type WallPart,
} from '../../catalog/structures';
import { buildFloors } from '../../builders/floors';
import { buildWalls } from '../../builders/walls';
import { buildRoofs } from '../../builders/roofs';
import { buildScene } from '../../../state/mapSpec';
import { spec as siegeSpec } from '../../../scenes/test-scenarios/siege-enceinte';
import { scenario as arene } from '../../../scenes/test-scenarios/arene';
import { scenario as diligence } from '../../../scenes/test-scenarios/diligence';
import { buildVitrineScene } from '../../../scenes/vitrine-batiments';
import { buildOperaFloorplan } from '../../../scenes/opera/floorplan';
import { sceneMetresPerTile, type Scene } from '../../../state/scene';
import { memoByRef } from '../../../state/sceneMemo';
import { TW } from '../../../geometry/iso';
import type { Face } from '../../builders/types';

const siege = buildScene(siegeSpec);
/** La vitrine est BÂTIE une fois : son IDENTITÉ est la clé des listes retenues ci-dessous. */
const vitrine = buildVitrineScene();

/**
 * Toutes les faces MONDE d'une scène, dans l'ordre de peinture des builders.
 *
 * Cette liste et les deux qui suivent sont RETENUES par l'identité de la scène — patron canonique
 * du dépôt (`memoByRef`, `state/sceneMemo.ts`, celui de l'écran). Ce fichier rejoue les cinq mêmes
 * cartes-témoins d'un cas à l'autre et la construction des builders est la passe LOURDE ; les
 * listes rendues sont LUES, jamais mutées (biais, géométrie et empreintes rendent des tableaux
 * neufs). Une scène bâtie DANS un cas garde son identité propre, donc sa liste propre.
 */
const facesOf = memoByRef((scene: Scene): Face[] =>
  [...buildFloors(scene), ...buildWalls(scene), ...buildRoofs(scene)].flatMap((el) => el.faces));

/** Quads MONDE d'une scène à la profondeur que les catalogues d'apparence résolvent (`faceRelief`) —
 *  la liste EXACTE que `bakeWorldGeometry` fusionne, jamais une géométrie de laboratoire. */
const quadsOf = memoByRef((scene: Scene): WorldPoly[] => {
  const mpt = sceneMetresPerTile(scene);
  const depthOf = faceDepthOf();
  return facesOf(scene).flatMap((f) => faceQuads(f, mpt, depthOf(f)));
});

/** La géométrie triangulée de TOUTES les faces d'une scène — ce que `bakeWorldGeometry` appelle. */
const geomsOf = memoByRef((scene: Scene) => facesGeometry(facesOf(scene), sceneMetresPerTile(scene), faceDepthOf()));

describe('gpToWorld — GP (tuiles + mètres) → repère three Y-haut', () => {
  it('(x, y, h) devient (x·mpt, h, y·mpt)', () => {
    expect(gpToWorld({ x: 3, y: -1.5, h: 4 }, 2)).toEqual({ x: 6, y: 4, z: -3 });
  });

  it('pxPerM dérive de TW : la demi-diagonale projetée d’une tuile', () => {
    expect(pxPerM(2)).toBeCloseTo((TW * Math.SQRT1_2) / 2, 12);
  });
});

describe('Triangulation en ÉVENTAIL — le pivot n’émet que des faces planes, convexes, ≤ 4 points', () => {
  const scenes: [string, Scene][] = [
    ['siege-enceinte', siege],
    ['arene (hub)', arene.scene],
  ];

  for (const [name, scene] of scenes) {
    it(`${name} : 0 face > 4 points, 0 non-plane (> 1e-4 m), 0 non-convexe`, () => {
      const mpt = sceneMetresPerTile(scene);
      let counted = 0;
      let tooMany = 0;
      let nonPlanar = 0;
      let nonConvex = 0;
      let worst = 0;
      for (const f of facesOf(scene)) {
        if (f.poly.length < 3) continue; // montant : traité en quads croisés
        counted++;
        const poly = facePoly(f, mpt);
        if (poly.length > 4) tooMany++;
        const flat = planarity(poly);
        worst = Math.max(worst, flat);
        if (flat > 1e-4) nonPlanar++;
        if (!isConvex(poly)) nonConvex++;
      }
      expect(counted).toBeGreaterThan(100);
      expect({ tooMany, nonPlanar, nonConvex }).toEqual({ tooMany: 0, nonPlanar: 0, nonConvex: 0 });
      expect(worst).toBeLessThanOrEqual(1e-4);
    });
  }

  it('un quad donne 2 triangles en éventail depuis son premier sommet', () => {
    const quad: WorldPoly = [
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 0, z: 0 },
      { x: 1, y: 0, z: 1 },
      { x: 0, y: 0, z: 1 },
    ];
    const tris = fanTriangles(quad);
    expect(tris).toHaveLength(2);
    expect(tris[0]).toEqual([quad[0], quad[1], quad[2]]);
    expect(tris[1]).toEqual([quad[0], quad[2], quad[3]]);
  });
});

describe('MONTANTS à 2 points — deux quads verticaux croisés, largeur AUTHORÉE EN MÈTRES', () => {
  it('les largeurs sont des MÈTRES de donnée, indépendants de l’échelle de la carte', () => {
    // Le fossile qu'elles remplacent dérivait ces trois nombres de largeurs de TRAIT SVG (3,8 / 3,6 /
    // 5 px) divisées par l'échelle d'écran : un poteau était deux fois plus ÉPAIS sur une carte à
    // 4 m/tuile. La donnée ne connaît plus l'écran.
    expect(UPRIGHT_WIDTH_M.poteau).toBe(WALL_MATTER_M);
    expect(UPRIGHT_WIDTH_M.jambage).toBeLessThan(UPRIGHT_WIDTH_M.poteau);
    expect(UPRIGHT_WIDTH_M.pilier).toBeGreaterThan(UPRIGHT_WIDTH_M.poteau);
    for (const w of Object.values(UPRIGHT_WIDTH_M)) {
      expect(w).toBeGreaterThan(0.1);
      expect(w).toBeLessThan(0.3);
    }
  });

  it('un montant produit 4 triangles (2 quads croisés) centrés sur le segment', () => {
    const tris = crossQuadPolys({ x: 10, y: 4, z: 6 }, { x: 10, y: 0, z: 6 }, 0.4).flatMap(fanTriangles);
    expect(tris).toHaveLength(4);
    const xs = tris.flat().map((p) => p.x);
    const zs = tris.flat().map((p) => p.z);
    expect(Math.min(...xs)).toBeCloseTo(9.8, 12);
    expect(Math.max(...xs)).toBeCloseTo(10.2, 12);
    expect(Math.min(...zs)).toBeCloseTo(5.8, 12);
    expect(Math.max(...zs)).toBeCloseTo(6.2, 12);
  });

  it('la croix DÉPASSE les joues du mur : largeur = max(largeur propre, matière du mur) + 2 saillies', () => {
    expect(UPRIGHT_OVERHANG_M).toBeGreaterThan(0.03);
    expect(UPRIGHT_OVERHANG_M).toBeLessThan(0.05);
    for (const part of ['poteau', 'jambage', 'pilier'])
      expect(uprightCrossM(part, WALL_MATTER_M)).toBeCloseTo(
        Math.max(UPRIGHT_WIDTH_M[part], WALL_MATTER_M) + 2 * UPRIGHT_OVERHANG_M,
        12,
      );
    expect(uprightCrossM('poteau', WALL_MATTER_M)).toBeGreaterThan(WALL_MATTER_M);
    // …et c'est bien CETTE largeur que la géométrie du monde reçoit, par le canal des profondeurs.
    const montant: Face = {
      poly: [{ x: 1, y: 1, h: 4 }, { x: 1, y: 1, h: 0 }],
      material: { domain: 'structure', id: 'mur-pierre', part: 'poteau' },
      oriented: false,
    };
    expect(faceDepthM(montant)).toBeCloseTo(uprightCrossM('poteau', WALL_MATTER_M), 12);
    const [bras] = faceQuads(montant, 2, faceDepthM(montant));
    const xs = bras.map((p) => p.x);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(uprightCrossM('poteau', WALL_MATTER_M), 12);
  });

  it('arène : AUCUN montant n’est entièrement noyé dans la matière des murs', () => {
    const mpt = sceneMetresPerTile(arene.scene);
    const faces = facesOf(arene.scene);
    const depthOf = faceDepthOf();
    // Matière = les boîtes des faces qui SONT la matière pleine du mur (`wallPartRelief`) — depuis le
    // relief mince (#1176 P1-E), une partie en SAILLIE produit une boîte elle aussi, mais plus épaisse
    // que le montant : la mesure porterait à faux si on la comptait comme de la matière.
    const boites: Bounds[] = [];
    for (const f of faces) {
      const part = f.material.part as WallPart | undefined;
      if (f.material.domain !== 'structure' || !part) continue;
      if (wallPartRelief(part).famille !== 'matiere') continue;
      const { quads, oriented } = faceQuadsOriented(f, mpt, depthOf(f));
      if (oriented) boites.push(polyBounds(quads.flat()));
    }
    expect(boites.length).toBeGreaterThan(100);
    const dedans = (p: Vec3) =>
      boites.some(
        (b) =>
          p.x >= b.lo.x - 1e-9 && p.x <= b.hi.x + 1e-9 &&
          p.y >= b.lo.y - 1e-9 && p.y <= b.hi.y + 1e-9 &&
          p.z >= b.lo.z - 1e-9 && p.z <= b.hi.z + 1e-9,
      );
    let montants = 0;
    let noyesEntiers = 0;
    for (const f of faces) {
      if (f.poly.length !== 2) continue;
      montants++;
      const pts = faceQuads(f, mpt, depthOf(f)).flat();
      if (pts.every((p) => dedans(p))) noyesEntiers++;
    }
    expect(montants).toBeGreaterThan(300);
    expect(noyesEntiers).toBe(0);
  });

  it('les faces à 2 points des builders passent par les quads croisés, jamais par l’éventail', () => {
    const face: Face = {
      poly: [{ x: 1, y: 1, h: 4 }, { x: 1, y: 1, h: 0 }],
      material: { domain: 'structure', id: 'mur-en-bois', part: 'poteau' },
      oriented: false,
    };
    const [geom] = facesGeometry([face], 2, faceDepthOf());
    expect(geom.tris).toHaveLength(4);
    expect(geom.normal).toBeNull();
  });
});

describe('BIAIS COPLANAIRE — l’ordre de peinture affine devient une séparation métrique', () => {
  it('3 faces empilées dans un même plan reçoivent les rangs 0/1/2', () => {
    const quad = (h: number): WorldPoly => [
      { x: 0, y: h, z: 0 },
      { x: 2, y: h, z: 0 },
      { x: 2, y: h - 2, z: 0 },
      { x: 0, y: h - 2, z: 0 },
    ];
    const polys = [quad(4), quad(3), quad(2.5)];
    expect(coplanarRanks(polys)).toEqual([0, 1, 2]);
  });

  it('un rang N déplace la face de N × 1.5 mm le long de SA normale', () => {
    const poly: WorldPoly = [
      { x: 0, y: 2, z: 0 },
      { x: 1, y: 2, z: 0 },
      { x: 1, y: 0, z: 0 },
      { x: 0, y: 0, z: 0 },
    ];
    expect(COPLANAR_BIAS_M).toBe(0.0015);
    const n = polyNormal(poly)!;
    const moved = biasPoly(poly, 2);
    expect(Math.abs(moved[0].z - poly[0].z)).toBeCloseTo(0.003, 12);
    expect(moved[0].z).toBeCloseTo(poly[0].z + 2 * COPLANAR_BIAS_M * n.z, 12);
    expect(biasPoly(poly, 0)).toBe(poly);
  });

  it('deux faces d’un même plan qui ne se RECOUVRENT pas ne sont pas comptées (sols voisins)', () => {
    const tile = (x: number): WorldPoly => [
      { x, y: 0, z: 0 },
      { x: x + 2, y: 0, z: 0 },
      { x: x + 2, y: 0, z: 2 },
      { x, y: 0, z: 2 },
    ];
    expect(coplanarOverlapPairs([tile(0), tile(2)])).toHaveLength(0);
    expect(coplanarOverlapPairs([tile(0), tile(1)])).toHaveLength(1);
  });

  const scenes: [string, Scene][] = [
    ['siege-enceinte', siege],
    ['arene (hub)', arene.scene],
  ];
  for (const [name, scene] of scenes)
    it(`${name} : des paires coplanaires recouvrantes AVANT biais, zéro APRÈS (montants COMPRIS)`, () => {
      const quads = quadsOf(scene);
      const ranks = coplanarRanks(quads);
      const biased = quads.map((p, i) => biasPoly(p, ranks[i]));
      expect(coplanarOverlapPairs(quads).length).toBeGreaterThan(0);
      expect(coplanarOverlapPairs(biased)).toEqual([]);
    });

  it('arène : les quads de MONTANT entrent dans le rang (poteaux/jambages/piliers)', () => {
    const mpt = sceneMetresPerTile(arene.scene);
    const faces = facesOf(arene.scene);
    const depthOf = faceDepthOf();
    const quads: WorldPoly[] = [];
    const montant: boolean[] = [];
    for (const f of faces)
      for (const q of faceQuads(f, mpt, depthOf(f))) {
        quads.push(q);
        montant.push(f.poly.length === 2);
      }
    expect(montant.filter(Boolean).length).toBeGreaterThan(0);
    const pairs = coplanarOverlapPairs(quads);
    const mm = pairs.filter(([a, b]) => montant[a] && montant[b]).length;
    const mf = pairs.filter(([a, b]) => montant[a] !== montant[b]).length;
    expect({ montantMontant: mm > 0, montantFace: mf > 0 }).toEqual({ montantMontant: true, montantFace: true });
    const ranks = coplanarRanks(quads);
    expect(ranks.some((r, i) => r > 0 && montant[i])).toBe(true);
  });

  it('facesGeometry biaise AUSSI les quads d’un montant (même liste de rangs que faceQuads)', () => {
    const mpt = sceneMetresPerTile(arene.scene);
    const faces = facesOf(arene.scene);
    const geoms = facesGeometry(faces, mpt, faceDepthOf());
    const iMontant = faces.findIndex((f, i) => f.poly.length === 2 && geoms[i].rank > 0);
    expect(iMontant).toBeGreaterThanOrEqual(0);
    // les sommets rendus ne sont plus ceux des quads NUS : le biais les a déplacés.
    const nus = faceQuads(faces[iMontant], mpt, faceDepthM(faces[iMontant])).flatMap(fanTriangles);
    const rendus = geoms[iMontant].tris;
    expect(rendus).toHaveLength(nus.length);
    expect(rendus).not.toEqual(nus);
  });
});

/**
 * ÉQUIVALENCE DU BALAYAGE SPATIAL (#1397). Le rang coplanaire se cherche dans une grille de hachage par
 * plan, jamais contre tous les précédents — 2 384 quads sur le seul plan du sol de l'arène, soit 475
 * des 532 ms de la cuisson au banc. Le prédicat de recouvrement, lui, ne change pas : ce qui se mesure
 * ici est que les rangs sont EXACTEMENT ceux de la recherche exhaustive, qui tient lieu d'ORACLE — sur
 * les scènes du dépôt, et sur les configurations que les scènes ne garantissent pas (plan oblique,
 * dalle qui déborde de la maille).
 */
describe('coplanarRanks — le balayage spatial rend EXACTEMENT les rangs de la recherche exhaustive (#1397)', () => {
  /** Prédicat de recouvrement de l'ORACLE — écrit ICI au littéral, jamais emprunté au module : un
   *  seuil qui bougerait dans l'implémentation doit faire diverger l'oracle, pas le suivre. */
  function recouvrent(a: Bounds, b: Bounds): boolean {
    let axes = 0;
    for (const k of ['x', 'y', 'z'] as const)
      if (Math.min(a.hi[k], b.hi[k]) - Math.max(a.lo[k], b.lo[k]) > 1e-6) axes++;
    return axes >= 2;
  }

  /** ORACLE : la recherche exhaustive, poly par poly, contre tous les précédents de son plan. */
  function rangsExhaustifs(polys: readonly WorldPoly[]): number[] {
    const plan = (poly: WorldPoly): string | null => {
      const n = polyNormal(poly);
      if (!n) return null;
      const lead = [n.x, n.y, n.z].find((c) => Math.abs(c) > 1e-9) ?? 1;
      const s = lead < 0 ? -1 : 1;
      const c = { x: n.x * s, y: n.y * s, z: n.z * s };
      const d = c.x * poly[0].x + c.y * poly[0].y + c.z * poly[0].z;
      const r = (v: number) => Math.round(v * 1000);
      return `${r(c.x)},${r(c.y)},${r(c.z)}|${r(d)}`;
    };
    const groups = new Map<string, { box: Bounds; rank: number }[]>();
    return polys.map((poly) => {
      const key = plan(poly);
      if (!key) return 0;
      const box = polyBounds(poly);
      const g = groups.get(key) ?? [];
      let rank = 0;
      for (const prev of g) if (recouvrent(prev.box, box)) rank = Math.max(rank, prev.rank + 1);
      g.push({ box, rank });
      groups.set(key, g);
      return rank;
    });
  }

  const cartes: [string, Scene][] = [
    ['arene (hub)', arene.scene],
    ['siege-enceinte', siege],
    ['diligence', diligence.scene],
    ['vitrine-batiments', vitrine],
    ['opera (la plus lourde du dépôt)', buildOperaFloorplan()],
  ];
  for (const [nom, scene] of cartes)
    it(`${nom} : rangs identiques à l’oracle, quad par quad`, () => {
      const quads = quadsOf(scene);
      const attendus = rangsExhaustifs(quads);
      expect(attendus.filter((r) => r > 0).length).toBeGreaterThan(0); // prémisse : il y a bien des piles
      expect(coplanarRanks(quads)).toEqual(attendus);
    });

  /** Quad AXÉ, dans le plan horizontal y = h. */
  const dalle = (x: number, z: number, w: number, d: number, h = 0): WorldPoly => [
    { x, y: h, z },
    { x: x + w, y: h, z },
    { x: x + w, y: h, z: z + d },
    { x, y: h, z: z + d },
  ];

  const cas: [string, WorldPoly[]][] = [
    ['pile de 3 dans un même plan', [dalle(0, 0, 2, 2), dalle(0, 0, 2, 2), dalle(0, 0, 2, 2)]],
    ['voisins sans recouvrement (sols côte à côte)', [dalle(0, 0, 2, 2), dalle(2, 0, 2, 2), dalle(4, 0, 2, 2)]],
    ['enjambement de deux éléments', [dalle(0, 0, 2, 2), dalle(2, 0, 2, 2), dalle(1, 0, 2, 2)]],
    // Une dalle qui déborde très largement de la maille (le lot des GROSSES) sous un semis de tuiles.
    ['grande dalle sous 400 tuiles', [dalle(0, 0, 20, 20), ...Array.from({ length: 400 }, (_, i) => dalle(i % 20, Math.floor(i / 20), 1, 1))]],
  ];
  for (const [nom, polys] of cas)
    it(`cas synthétique — ${nom}`, () => {
      const attendus = rangsExhaustifs(polys);
      expect(coplanarRanks(polys)).toEqual(attendus);
    });

  it('plan OBLIQUE (les trois axes vivants — un pan de toit) : mêmes rangs que l’oracle', () => {
    // Repère d'un plan dont la normale a ses trois composantes non nulles : aucun axe n'y est plat,
    // et le rang ne peut donc pas se ramener à une seule paire d'axes.
    const u = { x: 1 / Math.SQRT2, y: -1 / Math.SQRT2, z: 0 };
    const v = { x: 1 / Math.sqrt(6), y: 1 / Math.sqrt(6), z: -2 / Math.sqrt(6) };
    const quad = (s: number, t: number, w: number, h: number): WorldPoly =>
      ([[s, t], [s + w, t], [s + w, t + h], [s, t + h]] as [number, number][]).map(([a, b]) => ({
        x: a * u.x + b * v.x,
        y: a * u.y + b * v.y,
        z: a * u.z + b * v.z,
      }));
    const polys = [quad(0, 0, 2, 2), quad(0, 0, 2, 2), quad(1, 1, 2, 2), quad(5, 5, 2, 2)];
    const n = polyNormal(polys[0])!;
    expect(Math.min(Math.abs(n.x), Math.abs(n.y), Math.abs(n.z))).toBeGreaterThan(1e-3); // prémisse : plan oblique
    const attendus = rangsExhaustifs(polys);
    expect(attendus).toEqual([0, 1, 2, 0]);
    expect(coplanarRanks(polys)).toEqual(attendus);
  });
});

describe('ÉPAISSEUR de mur — un plan d’épaisseur nulle n’a AUCUNE surface à 90° de plongée', () => {
  /** Aire (m²) d'un triangle. */
  const aire = ([a, b, c]: [Vec3, Vec3, Vec3]) => {
    const u = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
    const v = { x: c.x - a.x, y: c.y - a.y, z: c.z - a.z };
    return Math.hypot(u.y * v.z - u.z * v.y, u.z * v.x - u.x * v.z, u.x * v.y - u.y * v.x) / 2;
  };
  /** Aire PROJETÉE au sol (ce que la caméra top voit) d'un triangle. */
  const aireVueDuDessus = (t: [Vec3, Vec3, Vec3]) => {
    const n = polyNormal(t);
    return n ? aire(t) * Math.abs(n.y) : 0;
  };

  const murVertical: WorldPoly = [
    { x: 0, y: 4, z: 6 },
    { x: 2, y: 4, z: 6 },
    { x: 2, y: 0, z: 6 },
    { x: 0, y: 0, z: 6 },
  ];

  it('l’épaisseur MONDE de la matière pleine est une DONNÉE en mètres, la même que le poteau', () => {
    expect(WALL_MATTER_M).toBe(UPRIGHT_WIDTH_M.poteau);
    expect(WALL_MATTER_M).toBeGreaterThan(0.15);
    expect(WALL_MATTER_M).toBeLessThan(0.2);
    // Elle est SURCHARGEABLE par apparence, comme toute autre épaisseur du catalogue.
    expect(wallMatterM({ relief: { wallM: 0.4 } } as StructureAppearanceDef)).toBe(0.4);
    expect(wallMatterM(undefined)).toBe(WALL_MATTER_M);
  });

  it('un quad de mur devient une boîte : 2 joues + coiffe + 2 chants, AUCUN dessous', () => {
    const box = wallBoxPolys(murVertical, polyNormal(murVertical)!, 0.2);
    expect(box).toHaveLength(5);
    const zs = box.flat().map((p) => p.z);
    expect(Math.min(...zs)).toBeCloseTo(5.9, 12);
    expect(Math.max(...zs)).toBeCloseTo(6.1, 12);
    // La COIFFE : le seul quad horizontal, au sommet ; aucun quad au point bas (dessous omis).
    const horizontaux = box.filter((q) => Math.abs(polyNormal(q)!.y) > 0.99);
    expect(horizontaux).toHaveLength(1);
    expect(horizontaux[0].every((p) => p.y === 4)).toBe(true);
    // Chaque quad regarde le DEHORS de la boîte (le biais coplanaire pousse hors de la matière).
    const mid = { x: 1, y: 2, z: 6 };
    for (const q of box) {
      const n = polyNormal(q)!;
      const g = q.reduce((s, p) => ({ x: s.x + p.x / q.length, y: s.y + p.y / q.length, z: s.z + p.z / q.length }), { x: 0, y: 0, z: 0 });
      expect(n.x * (g.x - mid.x) + n.y * (g.y - mid.y) + n.z * (g.z - mid.z)).toBeGreaterThan(0);
    }
  });

  /** Une face de mur de laboratoire, dans le plan z=0, sur le tronçon [1,2] de l'arête. */
  const partFace = (part: WallPart): Face => ({
    poly: [{ x: 1, y: 0, h: 3 }, { x: 2, y: 0, h: 3 }, { x: 2, y: 0, h: 1 }, { x: 1, y: 0, h: 1 }],
    material: { domain: 'structure', id: 'mur-en-bois', part },
    oriented: false,
  });

  it('SAILLIE : une boîte CENTRÉE sur le plan médian, épaisseur = mur + 2 × saillie', () => {
    const relief = wallPartRelief('panneau');
    expect(relief.famille).toBe('saillie');
    const jut = relief.famille === 'saillie' ? relief.jutM : 0;
    const attendue = WALL_MATTER_M + 2 * jut;
    const face = partFace('panneau');
    expect(faceDepthM(face)).toBeCloseTo(attendue, 12);
    const quads = faceQuads(face, 2, faceDepthM(face));
    const zs = quads.flat().map((p) => p.z);
    // CENTRÉE : les deux joues encadrent le plan médian (z = 0) à égale distance, et l'épaisseur totale
    // est bien celle que le catalogue a résolue.
    expect(Math.min(...zs)).toBeCloseTo(-attendue / 2, 12);
    expect(Math.max(...zs)).toBeCloseTo(attendue / 2, 12);
    expect(Math.max(...zs) + Math.min(...zs)).toBeCloseTo(0, 12);
    expect(attendue).toBeGreaterThan(WALL_MATTER_M); // la saillie DÉPASSE la matière du mur
  });

  it('TRAVERSANT : le DOS est là — une partie qui bouche une ouverture la bouche des DEUX côtés', () => {
    for (const part of ['vantail', 'herse-barreau', 'gravats'] as WallPart[]) {
      expect(wallPartRelief(part).famille).toBe('traversant');
      const face = partFace(part);
      const { quads, oriented } = faceQuadsOriented(face, 2, faceDepthM(face));
      expect(oriented).toBe(true);
      // 2 joues + coiffe + 2 chants latéraux (le dessous d'une part de mur ne se voit jamais).
      expect(quads).toHaveLength(5);
      // Une joue DEVANT et une joue DERRIÈRE, symétriques du plan médian : sans le dos, l'ouverture se
      // verrait à jour du revers (le pivot n'émet AUCUNE face derrière une partie traversante).
      const centreZ = (q: WorldPoly) => q.reduce((s, p) => s + p.z, 0) / q.length;
      const [devant, derrière] = [centreZ(quads[0]), centreZ(quads[1])];
      expect(Math.sign(devant)).toBe(-Math.sign(derrière));
      expect(devant).toBeCloseTo(-derrière, 12);
      expect(Math.abs(devant) * 2).toBeCloseTo(faceDepthM(face)!, 12);
    }
  });

  it('PROFONDEUR NULLE (le carreau d’une croisée) : UN plan, au médian, sans orientation propre', () => {
    const vitre = partFace('vitre');
    expect(faceDepthM(vitre)).toBe(0);
    const { quads, oriented } = faceQuadsOriented(vitre, 2, faceDepthM(vitre));
    expect(quads).toHaveLength(1); // plus AUCUNE copie par joue
    expect(quads[0]).toEqual(facePoly(vitre, 2)); // au plan médian, inchangé
    expect(oriented).toBe(false); // un sens de parcours arbitraire orienterait la carte d'ombre
  });

  const parScene: [string, Scene][] = [
    ['siege-enceinte', siege],
    ['arene (hub)', arene.scene],
  ];
  for (const [name, scene] of parScene)
    it(`${name} : les murs offrent une surface NON NULLE vue du dessus (coiffes)`, () => {
      const mpt = sceneMetresPerTile(scene);
      const faces = buildWalls(scene).flatMap((el) => el.faces);
      const tris = facesGeometry(faces, mpt, faceDepthOf()).flatMap((g) => g.tris);
      const vueDuDessus = tris.reduce((s, t) => s + aireVueDuDessus(t), 0);
      const coiffes = tris.filter((t) => Math.abs(polyNormal(t)?.y ?? 0) > 0.99).length;
      expect(coiffes).toBeGreaterThan(0);
      expect(vueDuDessus).toBeGreaterThan(1); // m² — 2 aplats vides sur la planche `*-top-*` sinon
    });
});

describe('CONVERSION des murs — la géométrie rendue est celle que `buildWalls` a émise', () => {
  // L'opéra dresse 983 segments (aucun diagonal : son ovale est un ESCALIER de segments N/E). La garde
  // mesure que la conversion n'en PERD ni n'en DÉPLACE aucun — l'aspect « dalles disjointes » de la
  // planche `opera-iso-rot2-unlit.png` se joue en amont, dans le plan authoré.
  const opera = buildOperaFloorplan();

  it('opéra : chaque face de mur émise produit des triangles, tous DANS l’emprise de la scène', () => {
    const mpt = sceneMetresPerTile(opera);
    const faces = buildWalls(opera).flatMap((el) => el.faces);
    expect(faces.length).toBeGreaterThan(1000);
    const geoms = facesGeometry(faces, mpt, faceDepthOf());
    expect(geoms.filter((g) => g.tris.length === 0)).toEqual([]);
    // Emprise MÉTRIQUE de la grille authorée (case 0 → case n−1), à 1 cm près : une tolérance d'une CASE
    // laissait 2 m de jeu, de quoi loger un mur entier hors de la carte sans que la garde bronche.
    const TOL_M = 0.01;
    const hors = geoms
      .flatMap((g) => g.tris.flat())
      .filter(
        (p) =>
          p.x < -TOL_M ||
          p.x > (opera.dimensions.w - 1) * mpt + TOL_M ||
          p.z < -TOL_M ||
          p.z > (opera.dimensions.h - 1) * mpt + TOL_M,
      );
    expect(hors).toEqual([]);
  });
});

describe('UV — la maille MONDE en mètres (attribut `uv`)', () => {
  /** Distance entre deux UV. */
  const dUV = (a: { u: number; v: number }, b: { u: number; v: number }) => Math.hypot(a.u - b.u, a.v - b.v);
  /** Distance monde entre deux sommets. */
  const d3 = (a: Vec3, b: Vec3) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

  /** Un quad par ORIENTATION, en mètres : sol horizontal, mur vertical, pan de toit incliné. */
  const HORIZONTAL: WorldPoly = [
    { x: 0, y: 0, z: 0 },
    { x: 4, y: 0, z: 0 },
    { x: 4, y: 0, z: 3 },
    { x: 0, y: 0, z: 3 },
  ];
  const VERTICAL: WorldPoly = [
    { x: 1, y: 5, z: 2 },
    { x: 6, y: 5, z: 2 },
    { x: 6, y: 1, z: 2 },
    { x: 1, y: 1, z: 2 },
  ];
  const INCLINE: WorldPoly = [
    { x: 0, y: 3, z: 0 },
    { x: 4, y: 3, z: 0 },
    { x: 4, y: 0, z: 3 },
    { x: 0, y: 0, z: 3 },
  ];

  it.each([
    ['horizontal (sol)', HORIZONTAL],
    ['vertical (mur)', VERTICAL],
    ['incliné (pan de toit)', INCLINE],
  ])('%s : l’UV mesure les MÈTRES du quad (isométrie — chaque arête garde sa longueur)', (_libellé, poly) => {
    const f = planarFrame(polyNormal(poly));
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      expect(dUV(planarUV(a, f), planarUV(b, f))).toBeCloseTo(d3(a, b), 9);
    }
    // Les diagonales aussi : une isométrie n'est pas qu'une conservation des bords.
    expect(dUV(planarUV(poly[0], f), planarUV(poly[2], f))).toBeCloseTo(d3(poly[0], poly[2]), 9);
  });

  it('quad vertical : u court à l’horizontale, v DESCEND (v croît quand y baisse)', () => {
    const f = planarFrame(polyNormal(VERTICAL));
    expect(f.eu.y).toBeCloseTo(0, 12);
    const haut = planarUV({ x: 1, y: 5, z: 2 }, f);
    const bas = planarUV({ x: 1, y: 1, z: 2 }, f);
    expect(bas.v - haut.v).toBeCloseTo(4, 9);
  });

  it('sol : la maille est ancrée au MONDE — deux dalles voisines se raccordent sans couture', () => {
    const f = planarFrame(polyNormal(HORIZONTAL));
    // Le sommet partagé par deux dalles adjacentes reçoit la MÊME UV, quel que soit le quad qui le porte.
    expect(planarUV({ x: 4, y: 0, z: 3 }, f)).toEqual(planarUV({ x: 4, y: 0, z: 3 }, planarFrame(polyNormal(HORIZONTAL))));
    // …et une dalle décalée d'un mètre voit son UV décalée d'exactement un mètre (jamais remise à 0).
    expect(planarUV({ x: 5, y: 0, z: 3 }, f).u - planarUV({ x: 4, y: 0, z: 3 }, f).u).toBeCloseTo(1, 12);
  });

  it('le biais coplanaire (déplacement le long de la NORMALE) ne bouge aucune UV', () => {
    const f = planarFrame(polyNormal(VERTICAL));
    const biaisé = biasPoly(VERTICAL, 7);
    for (let i = 0; i < VERTICAL.length; i++) {
      expect(planarUV(biaisé[i], f).u).toBeCloseTo(planarUV(VERTICAL[i], f).u, 9);
      expect(planarUV(biaisé[i], f).v).toBeCloseTo(planarUV(VERTICAL[i], f).v, 9);
    }
  });

  it('scène réelle (siege-enceinte) : chaque triangle porte 3 UV monde, à l’échelle métrique de SON quad', () => {
    const geoms = geomsOf(siege);
    expect(geoms.length).toBeGreaterThan(100);
    let pires = 0;
    for (const g of geoms) {
      expect(g.uv.length).toBe(g.tris.length);
      g.tris.forEach((tri, t) => {
        for (let i = 0; i < 3; i++) {
          const j = (i + 1) % 3;
          const écart = Math.abs(dUV(g.uv[t][i], g.uv[t][j]) - d3(tri[i], tri[j]));
          if (écart > 1e-6) pires++;
        }
      });
    }
    expect(pires).toBe(0);
  });
});

describe('UV1 — la FACE d’origine en [0,1]² (attribut `uv1`)', () => {
  it('une face pleine : ses 4 coins prennent les 4 coins de [0,1]², v=0 en HAUT', () => {
    const poly: WorldPoly = [
      { x: 1, y: 5, z: 2 },
      { x: 6, y: 5, z: 2 },
      { x: 6, y: 1, z: 2 },
      { x: 1, y: 1, z: 2 },
    ];
    const fr = faceUvFrame(poly);
    const coins = poly.map((p) => faceUv1(p, fr));
    expect(coins.map((c) => Math.round(c.v))).toEqual([0, 0, 1, 1]);
    expect(new Set(coins.map((c) => `${Math.round(c.u)},${Math.round(c.v)}`)).size).toBe(4);
  });

  it('scène réelle : TOUTES les uv1 sont bornées [0,1] (montants et chants de boîte compris)', () => {
    for (const [, scène] of [
      ['siege', siege],
      ['arene', arene.scene],
    ] as [string, Scene][]) {
      const geoms = geomsOf(scène);
      const hors = geoms.flatMap((g) => g.uv1.flat()).filter((c) => c.u < 0 || c.u > 1 || c.v < 0 || c.v > 1);
      expect(hors).toEqual([]);
    }
  });

  it('scène réelle : uv1 EXPLOITE la face (elle n’est pas un aplat de zéros)', () => {
    const geoms = geomsOf(siege);
    const toutes = geoms.flatMap((g) => g.uv1.flat());
    expect(toutes.length).toBeGreaterThan(100);
    expect(toutes.filter((c) => c.u > 0.99).length).toBeGreaterThan(50);
    expect(toutes.filter((c) => c.v > 0.99).length).toBeGreaterThan(50);
  });

  it('les DEUX joues d’une boîte de mur partagent leurs uv1 : le même ornement des deux côtés', () => {
    const mpt = sceneMetresPerTile(siege);
    const depthOf = faceDepthOf();
    // Toute face verticale de mur devient une boîte : ses deux premiers quads sont ses JOUES.
    const face = facesOf(siege).find((f) => faceQuadsOriented(f, mpt, depthOf(f)).oriented);
    expect(face).toBeDefined();
    const fr = faceUvFrame(facePoly(face!, mpt));
    const [avant, arrière] = faceQuadsOriented(face!, mpt, depthOf(face!)).quads;
    const uvA = avant.map((p) => faceUv1(p, fr));
    const uvB = arrière.map((p) => faceUv1(p, fr));
    // Mêmes 4 coins de part et d'autre (l'ordre de parcours d'une joue est inversé).
    const clé = (c: { u: number; v: number }) => `${c.u.toFixed(6)},${c.v.toFixed(6)}`;
    expect(new Set(uvA.map(clé))).toEqual(new Set(uvB.map(clé)));
  });
});

describe('RELIEF MINCE — le prix mesuré du volume (#1176 P1-E)', () => {
  /** Les faces que le backend FUSIONNE réellement — la liste de `sceneMeshes.worldFaces` (toutes les
   *  couches pleines, `activeZ` au plus haut étage), pas celle du `facesOf` d'atelier : une scène à deux
   *  niveaux n'y émet pas les mêmes planchers, et le compte de triangles s'en ressent. */
  const facesRendues = memoByRef((scene: Scene): Face[] => {
    const maxZ = Math.max(...scene.layers.map((l) => l.z));
    return [...buildFloors(scene, undefined, { activeZ: maxZ }), ...buildWalls(scene), ...buildRoofs(scene)]
      .flatMap((el) => el.faces);
  });

  /** Ce que le backend produisait AVANT le relief : les parties PLEINES en boîte mince à l'épaisseur du
   *  mur, TOUTE autre partie de mur en deux copies plates (une par joue), le reste en plan. Réplique
   *  gardée ICI pour que la hausse se mesure contre un chiffre RECALCULÉ à chaque run, jamais contre une
   *  constante qui vieillirait en silence dès qu'un builder change son assemblage. */
  const PLEINES = new Set(['face', 'couronnement', 'parapet', 'arase', 'merlon']);
  function trisAvantRelief(faces: readonly Face[], mpt: number): number {
    let n = 0;
    for (const f of faces) {
      const poly = facePoly(f, mpt);
      if (poly.length === 2) { n += 4; continue; } // montant : 2 quads croisés
      const nn = polyNormal(poly);
      if (f.material.domain !== 'structure' || !nn || Math.abs(nn.y) > 1e-6) { n += poly.length - 2; continue; }
      n += PLEINES.has(f.material.part ?? '')
        ? wallBoxPolys(poly, nn, WALL_MATTER_M).reduce((s, q) => s + (q.length - 2), 0)
        : 2 * (poly.length - 2);
    }
    return n;
  }

  /** MESURES du lot, par scène-témoin du spike : triangles avant/après le relief, et paires coplanaires
   *  recouvrantes AVANT biais. Les chants de boîte des parties en saillie/traversant recréent des paires
   *  (une joue de plinthe et son chant croisent les plans voisins) : +13,3 % au siège, +11,4 % à la
   *  vitrine — toutes séparées par le biais coplanaire, comme l'atteste le zéro final. La vitrine porte
   *  en plus la RUINE authorée par ce lot (gravats, seuil, vantail), d'où un `avant` qui n'est plus
   *  celui d'avant l'extension.
   *  Les deux sujets qui restent sont CONSTRUITS : `siege-enceinte` compile son `MapSpec` dans le
   *  fichier du scénario, la vitrine est une spec de rendu — aucune main d'auteur ne peut déplacer
   *  leurs chiffres. */
  const MESURES: [string, () => Scene, { trisAvant: number; trisApres: number; paires: number }][] = [
    ['siege-enceinte', () => siege, { trisAvant: 6912, trisApres: 7404, paires: 1238 }],
    ['vitrine-batiments', () => vitrine, { trisAvant: 9666, trisApres: 11146, paires: 5279 }],
  ];

  /** SANS ÉPINGLE CHIFFRÉE — scènes dont la carte appartient à un AUTEUR (ou à son générateur) : une
   *  épingle chiffrée n'y mesure plus une dérive de géométrie mais un coup de pinceau, et bloque le
   *  tronc. Arbitrage 2026-08-21 (#1447), verbatim de l'utilisateur : « C'est absurde d'avoir un guard
   *  qui bloque totalement la diligence alors qu'elle n'est même pas finalisé » ; étendu à toute carte
   *  livrée par #1709, arbitrage 2026-09-07, verbatim de l'utilisateur : « Franchement si on veut faire
   *  de test, faites les sur des scenes créé spécialement pour ces tests, pas sur des scénes qui sont
   *  utilisés » — `arene (hub)` EST la carte de campagne (`test-scenarios/arene.ts` parse
   *  `arene-projet.json` et prend `arene-hub`), et un coffre déplacé d'une case par le générateur
   *  déplaçait ses épingles. Ce qui NE dépend pas d'un chiffre authoré (plafond de hausse, zéro paire
   *  coplanaire après biais) continue de couvrir ces scènes, ici et dans les blocs voisins.
   *  DETTE NOMMÉE : la mesure de relief a seulement DEUX sujets chiffrés. Un TROISIÈME régime
   *  (bourg meublé à fort relief) se rétablit par une scène CONSTRUITE portant du relief, pas en
   *  ré-épinglant une carte livrée. */
  const SANS_EPINGLE: [string, () => Scene, string][] = [
    ['diligence', () => diligence.scene, 'carte livrée (authoring au studio)'],
    ['arene (hub)', () => arene.scene, 'carte livrée (générateur d’auteur)'],
  ];

  /** Plafond de hausse ASSUMÉ du lot : au-delà, le relief coûte plus qu'il ne rend et la mesure remonte
   *  au ticket au lieu de faire monter la borne. Il se juge sur les chiffres du RUN, AVANT les épingles :
   *  entre deux constantes déjà accordées entre elles il ne dirait rien, et il doit précisément mordre
   *  au moment du RÉ-ÉPINGLAGE, quand les épingles suivent la géométrie. */
  const HAUSSE_MAX = 1.35;

  for (const [nom, faire, m] of MESURES)
    it(`${nom} : ${m.trisAvant} → ${m.trisApres} triangles (hausse sous +35 %)`, () => {
      const scene = faire();
      const avant = trisAvantRelief(facesOf(scene), sceneMetresPerTile(scene));
      const tris = geomsOf(scene).reduce((s, g) => s + g.tris.length, 0);
      expect(tris / avant).toBeLessThanOrEqual(HAUSSE_MAX);
      expect({ avant, tris }).toEqual({ avant: m.trisAvant, tris: m.trisApres });
    });

  for (const [nom, faire, m] of MESURES)
    it(`${nom} : ${m.paires} paires coplanaires AVANT biais (bornées), zéro APRÈS`, () => {
      const scene = faire();
      const quads = quadsOf(scene);
      const paires = coplanarOverlapPairs(quads).length;
      expect(paires).toBeGreaterThan(0);
      expect(paires).toBeLessThanOrEqual(Math.ceil(m.paires * 1.1));
      const ranks = coplanarRanks(quads);
      expect(coplanarOverlapPairs(quads.map((p, i) => biasPoly(p, ranks[i])))).toEqual([]);
    });

  for (const [nom, faire, raison] of SANS_EPINGLE)
    it(`${nom} (SANS ÉPINGLE, ${raison}) : hausse sous +35 % et zéro paire coplanaire après biais`, () => {
      const scene = faire();
      const avant = trisAvantRelief(facesOf(scene), sceneMetresPerTile(scene));
      const tris = geomsOf(scene).reduce((s, g) => s + g.tris.length, 0);
      expect(tris / avant).toBeLessThanOrEqual(HAUSSE_MAX);
      const quads = quadsOf(scene);
      expect(coplanarOverlapPairs(quads).length).toBeGreaterThan(0);
      const ranks = coplanarRanks(quads);
      expect(coplanarOverlapPairs(quads.map((p, i) => biasPoly(p, ranks[i])))).toEqual([]);
    });

  it('la vitrine porte les parties de RUINE et de porte FERMÉE qu’aucune autre scène-témoin n’émet', () => {
    const parts = new Set(facesRendues(vitrine).map((f) => f.material.part));
    for (const part of ['gravats', 'gravats-tas', 'seuil', 'vantail', 'vantail-planche', 'poignee'])
      expect(parts.has(part as WallPart), `${part} absent de la vitrine`).toBe(true);
  });
});

/**
 * PURETÉ DU MODULE — sa liste d'IMPORTS est un contrat, pas une intention de JSDoc.
 *
 * `worldTris.ts` annonce en tête « Module PUR : ni DOM, ni renderer, ni `three`, ni catalogue » : c'est
 * ce qui lui permet d'être la SEULE définition du dehors, partagée par la cuisson (`sceneMeshes.ts`) et
 * par l'instrument de QC hors navigateur (`scripts/qc/lib/plancheVolumique.ts`, exécuté par `tsx` en
 * ligne de commande). Un `three` ou un `document` qui y entrerait casserait le QC sans que rien ne le
 * dise, et la LOI d'orientation se dédoublerait aussitôt.
 *
 * Le parseur d'imports est le CANONIQUE du dépôt (`scripts/guards/lib/importGraph.mjs:IMPORT_RE`) —
 * jamais un second.
 */
describe('worldTris — module PUR : ses imports sont son contrat (#1680)', () => {
  const SRC = readFileSync(fileURLToPath(new URL('./worldTris.ts', import.meta.url)), 'utf8');
  /** Le code seul : une réf `'./x'` citée en commentaire n'est pas un import. Seul le COMMENTAIRE
   *  est masqué, jamais la ligne entière — `const el = document.body; // …` doit rester lisible par
   *  la clause DOM ci-dessous. */
  const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  const specificateurs = [...CODE.matchAll(IMPORT_RE)].map((m) => m[1] ?? m[2] ?? m[3]);

  it('n’importe QUE la géométrie pure et la FORME du pivot', () => {
    expect(specificateurs.length, 'aucun import lu : ce contrat ne mesure plus rien').toBeGreaterThan(0);
    expect([...specificateurs].sort()).toEqual(
      [
        '../../../geometry/iso', // projection pure (TW) — zéro dépendance framework
        '../../builders/types', // TYPE seul : la forme `Face`/`GP` que le pivot émet
      ].sort(),
    );
  });

  it('ni three, ni catalogue, ni voisin de backends/webgl', () => {
    const fautes = specificateurs.flatMap((s) => {
      if (/(^|\/)three($|\/)/.test(s)) return [`${s} — renderer`];
      if (/(^|\/)catalog\//.test(s)) return [`${s} — catalogue d’apparence (les épaisseurs arrivent par FaceDepth)`];
      if (/^\.\//.test(s)) return [`${s} — voisin de backends/webgl`];
      return [];
    });
    expect(fautes).toEqual([]);
  });

  it('aucun accès au DOM ni au global du navigateur', () => {
    const dom = /\b(document|window|navigator|globalThis|HTMLElement|SVGElement|requestAnimationFrame)\b/g;
    expect([...CODE.matchAll(dom)].map((m) => m[0])).toEqual([]);
  });
});

/** `IMPORT_RE` capture l'import à effet de bord RELATIF (`import './x'`, groupe 3). La clause reste à
 *  part parce qu'elle vise plus large : un `import 'paquet'` NON relatif, qu'aucun parseur de graphe
 *  ne résout, reste un effet de bord qu'un module pur ne porte pas. */
describe('worldTris — aucun import à effet de bord', () => {
  it('zéro `import \'…\'` nu', () => {
    const SRC = readFileSync(fileURLToPath(new URL('./worldTris.ts', import.meta.url)), 'utf8');
    expect(SRC.match(/^\s*import\s+['"][^'"]+['"]\s*;?\s*$/gm)).toBeNull();
  });
});
