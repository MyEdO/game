import { describe, it, expect } from 'vitest';
import { rotTile, unrotTile, effDims, tileCenter, screenToTile, stageSize, depth, footprintDepth, projectOccluder, occludesActor, capsuleCenter, screenBasis, Z_STEP, BASE_SCALE, CELL, LEVEL_H, TW, screenToTileAtZ, screenToTileF, diamondPath, diamondCorners, billboardScale, type ActorCapsule, type Dims, type ProjectedOccluder } from './iso';

describe('screenToTileF — picking FRACTIONNAIRE (arêtes éditeur)', () => {
  for (const rot of [0, 1, 2, 3] as const) {
    it(`centre d'une case → coords ~entières (rot ${rot})`, () => {
      const dims: Dims = { w: 6, h: 4, rot };
      const { cx, cy } = tileCenter(2, 1, dims);
      const f = screenToTileF(cx, cy, dims);
      expect(f.x).toBeCloseTo(2, 5);
      expect(f.y).toBeCloseTo(1, 5);
    });
  }
  it('point vers l’arête E (cx + un quart de losange) → x ≈ +0.35 du centre', () => {
    const dims: Dims = { w: 6, h: 4 };
    const { cx, cy } = tileCenter(2, 1, dims);
    const f = screenToTileF(cx + 64 / 2 / 2, cy, dims); // +TW/4 vers la droite (arête E)
    expect(f.x - 2).toBeGreaterThan(0.2);
    expect(Math.abs(f.y - 1)).toBeLessThan(0.3);
  });
});

describe('rotTile / unrotTile', () => {
  const dims: Dims = { w: 5, h: 3 };

  it('rot 0 = identité', () => {
    expect(rotTile(2, 1, { ...dims, rot: 0 })).toEqual({ x: 2, y: 1 });
  });

  it('rot 1 : (x,y) -> (y, W-1-x)', () => {
    expect(rotTile(0, 0, { ...dims, rot: 1 })).toEqual({ x: 0, y: 4 });
    expect(rotTile(4, 0, { ...dims, rot: 1 })).toEqual({ x: 0, y: 0 });
  });

  it('rot 2 : (x,y) -> (W-1-x, H-1-y)', () => {
    expect(rotTile(0, 0, { ...dims, rot: 2 })).toEqual({ x: 4, y: 2 });
  });

  it('rot 3 : (x,y) -> (H-1-y, x)', () => {
    expect(rotTile(0, 0, { ...dims, rot: 3 })).toEqual({ x: 2, y: 0 });
  });

  it('unrotTile inverse rotTile pour les 4 rotations', () => {
    for (const rot of [0, 1, 2, 3] as const) {
      const d = { ...dims, rot };
      for (let x = 0; x < dims.w; x++)
        for (let y = 0; y < dims.h; y++) {
          const r = rotTile(x, y, d);
          expect(unrotTile(r.x, r.y, d)).toEqual({ x, y });
        }
    }
  });
});

describe('effDims', () => {
  it('rot pair = dims inchangées', () => {
    expect(effDims({ w: 5, h: 3, rot: 0 })).toEqual({ w: 5, h: 3 });
    expect(effDims({ w: 5, h: 3, rot: 2 })).toEqual({ w: 5, h: 3 });
  });
  it('rot impair = w/h permutés', () => {
    expect(effDims({ w: 5, h: 3, rot: 1 })).toEqual({ w: 3, h: 5 });
    expect(effDims({ w: 5, h: 3, rot: 3 })).toEqual({ w: 3, h: 5 });
  });
});

describe('projection rot-aware', () => {
  const ROTS = [0, 1, 2, 3] as const;

  it('screenToTile inverse tileCenter pour les 4 rotations', () => {
    for (const rot of ROTS) {
      const dims: Dims = { w: 6, h: 4, rot };
      for (let x = 0; x < dims.w; x++)
        for (let y = 0; y < dims.h; y++) {
          const { cx, cy } = tileCenter(x, y, dims);
          expect(screenToTile(cx, cy, dims)).toEqual({ x, y });
        }
    }
  });

  it('la rotation change réellement la projection écran', () => {
    // une tuile non centrale doit projeter ailleurs sous rot 1 que sous rot 0
    const a = tileCenter(1, 0, { w: 6, h: 4, rot: 0 });
    const b = tileCenter(1, 0, { w: 6, h: 4, rot: 1 });
    expect(b).not.toEqual(a);
    // et la tuile au sommet de l'écran (min cy) change avec la rotation
    const topTile = (rot: 0 | 1) => {
      let best = { x: 0, y: 0, cy: Infinity };
      for (let x = 0; x < 6; x++)
        for (let y = 0; y < 4; y++) {
          const { cy } = tileCenter(x, y, { w: 6, h: 4, rot });
          if (cy < best.cy) best = { x, y, cy };
        }
      return { x: best.x, y: best.y };
    };
    expect(topTile(1)).not.toEqual(topTile(0));
  });

  it('toutes les tuiles tiennent dans stageSize pour les 4 rotations', () => {
    for (const rot of ROTS) {
      const dims: Dims = { w: 6, h: 4, rot };
      const stage = stageSize(dims);
      for (let x = 0; x < dims.w; x++)
        for (let y = 0; y < dims.h; y++) {
          const { cx, cy } = tileCenter(x, y, dims);
          expect(cx).toBeGreaterThanOrEqual(0);
          expect(cx).toBeLessThanOrEqual(stage.w);
          expect(cy).toBeGreaterThanOrEqual(0);
          expect(cy).toBeLessThanOrEqual(stage.h);
        }
    }
  });
});

describe('depth rot-aware', () => {
  it('le tri depth suit la position écran (cy) pour les 4 rotations', () => {
    for (const rot of [0, 1, 2, 3] as const) {
      const dims: Dims = { w: 5, h: 5, rot };
      const tiles: { d: number; cy: number }[] = [];
      for (let x = 0; x < dims.w; x++)
        for (let y = 0; y < dims.h; y++)
          tiles.push({ d: depth(x, y, dims), cy: tileCenter(x, y, dims).cy });
      const byDepth = [...tiles].sort((a, b) => a.d - b.d).map((t) => t.cy);
      for (let i = 1; i < byDepth.length; i++) expect(byDepth[i]).toBeGreaterThanOrEqual(byDepth[i - 1]);
    }
  });
});

describe('occlusion locale par panneau', () => {
  const ACTOR_CAPSULE: ActorCapsule = {
    segment: [{ x: 100, y: 150 }, { x: 100, y: 100 }],
    radius: 12,
    depth: 10,
    vertical: [0, 0.5],
  };
  const makeOccluder = ({
    front,
    overlap,
    vertical,
  }: {
    front: boolean;
    overlap: boolean;
    vertical: boolean;
  }): ProjectedOccluder => ({
    polygons: [{
      points: [
        { x: overlap ? 90 : 180, y: 90 },
        { x: overlap ? 110 : 200, y: 90 },
        { x: overlap ? 110 : 200, y: 160 },
        { x: overlap ? 90 : 180, y: 160 },
      ],
      bounds: { left: overlap ? 90 : 180, right: overlap ? 110 : 200, top: 90, bottom: 160 },
      depths: new Array(4).fill(front ? 11 : 9),
      lifts: new Array(4).fill(vertical ? 0.25 : -0.75),
      vertical: vertical ? [0, 1] : [-1, -0.5],
    }],
    bounds: { left: overlap ? 90 : 180, right: overlap ? 110 : 200, top: 90, bottom: 160 },
  });

  it.each([
    ['derrière', { front: false, overlap: true, vertical: true }],
    ['sans recouvrement', { front: true, overlap: false, vertical: true }],
    ['sous les pieds', { front: true, overlap: true, vertical: false }],
  ])('ne masque pas un panneau %s', (_label, fixture) => {
    expect(occludesActor(makeOccluder(fixture), ACTOR_CAPSULE)).toBe(false);
  });

  it('masque seulement lorsque devant, intersection 2D et hauteur coïncident', () => {
    expect(occludesActor(
      makeOccluder({ front: true, overlap: true, vertical: true }),
      ACTOR_CAPSULE,
    )).toBe(true);
  });

  it('évalue la profondeur du polygone qui intersecte, jamais le maximum global du panneau', () => {
    expect(occludesActor({
      polygons: [{
        points: [
          { x: 90, y: 90 },
          { x: 200, y: 90 },
          { x: 200, y: 160 },
          { x: 90, y: 160 },
        ],
        bounds: { left: 90, right: 200, top: 90, bottom: 160 },
        depths: [9, 11, 11, 9],
        lifts: [0.25, 0.25, 0.25, 0.25],
        vertical: [0, 1],
      }],
      bounds: { left: 90, right: 200, top: 90, bottom: 160 },
    }, ACTOR_CAPSULE)).toBe(false);
  });

  it('traite la tangence exacte comme non occlusive et une pénétration comme occlusive', () => {
    const tangent = makeOccluder({ front: true, overlap: true, vertical: true });
    tangent.polygons[0].points = [
      { x: 70, y: 90 },
      { x: 88, y: 90 },
      { x: 88, y: 160 },
      { x: 70, y: 160 },
    ];
    tangent.polygons[0].bounds = { left: 70, right: 88, top: 90, bottom: 160 };
    tangent.bounds = tangent.polygons[0].bounds;
    expect(occludesActor(tangent, ACTOR_CAPSULE)).toBe(false);

    tangent.polygons[0].points[1].x = 88.001;
    tangent.polygons[0].points[2].x = 88.001;
    tangent.polygons[0].bounds.right = 88.001;
    tangent.bounds.right = 88.001;
    expect(occludesActor(tangent, ACTOR_CAPSULE)).toBe(true);
  });

  it('#907 — occulte le sujet couvert à l’écran par une nappe ENTIÈREMENT au-dessus de sa tête et peinte après lui', () => {
    const dims: Dims = { w: 16, h: 16, rot: 0 };
    // Sujet debout sur le sol de sa case : capsule pieds→tête d'UN niveau (cf. `actorCapsuleOf`).
    const foot = tileCenter(5, 5, dims, 0);
    const head = tileCenter(5, 5, dims, 1);
    const capsule: ActorCapsule = {
      segment: [{ x: foot.cx, y: foot.cy }, { x: head.cx, y: head.cy }],
      radius: TW * 0.28,
      depth: depth(5, 5, dims, 0),
      vertical: [0, 1],
    };
    // Nappe de toit à 2 niveaux, 3 cases plus loin en diagonale : à l'écran elle retombe SUR le sujet.
    const roof = projectOccluder({
      polygons: [[
        { x: 6.5, y: 6.5, lift: 2 },
        { x: 9.5, y: 6.5, lift: 2 },
        { x: 9.5, y: 9.5, lift: 2 },
        { x: 6.5, y: 9.5, lift: 2 },
      ]],
    }, dims);
    const poly = roof.polygons[0];
    expect(poly.vertical[0]).toBeGreaterThan(capsule.vertical[1]); // bande verticale entièrement au-dessus de la tête
    expect(Math.min(...poly.depths)).toBeGreaterThan(capsule.depth); // peinte APRÈS le sujet
    expect(poly.bounds.left).toBeLessThan(head.cx);
    expect(poly.bounds.right).toBeGreaterThan(head.cx);
    expect(poly.bounds.top).toBeLessThan(head.cy);
    expect(poly.bounds.bottom).toBeGreaterThan(head.cy); // et elle couvre la tête à l'écran

    expect(occludesActor(roof, capsule)).toBe(true);
  });

  it('capsuleCenter : le milieu du segment pieds→tête, une demi-capsule au-dessus des pieds', () => {
    const dims: Dims = { w: 8, h: 8, rot: 0 };
    const pieds = tileCenter(3, 4, dims, 0), tete = tileCenter(3, 4, dims, 1);
    const centre = capsuleCenter({
      segment: [{ x: pieds.cx, y: pieds.cy }, { x: tete.cx, y: tete.cy }],
      radius: TW * 0.28,
      depth: depth(3, 4, dims, 0),
      vertical: [0, 1],
    });
    expect(centre.x).toBe(pieds.cx);
    expect(pieds.cy - centre.y).toBe(LEVEL_H / 2);
  });

  it('projette polygones, bornes et profondeur avec les primitives iso aux quatre rotations', () => {
    const panel = {
      polygons: [[
        { x: 4.5, y: 4.5, lift: 0 },
        { x: 5.5, y: 4.5, lift: 0 },
        { x: 5.5, y: 4.5, lift: 1 },
        { x: 4.5, y: 4.5, lift: 1 },
      ]],
    };
    for (const rot of [0, 1, 2, 3] as const) {
      const dims: Dims = { w: 11, h: 11, rot };
      const projected = projectOccluder(panel, dims);
      const expected = panel.polygons[0].map((point) => {
        const { cx, cy } = tileCenter(point.x, point.y, dims, point.lift);
        return { x: cx, y: cy };
      });
      expect(projected.polygons[0].points).toEqual(expected);
      expect(projected.polygons[0].depths).toEqual(
        panel.polygons[0].map((point) => depth(point.x, point.y, dims, point.lift)),
      );
      expect(projected.polygons[0].lifts).toEqual(panel.polygons[0].map((point) => point.lift));
      expect(projected.bounds).toEqual({
        left: Math.min(...expected.map((point) => point.x)),
        right: Math.max(...expected.map((point) => point.x)),
        top: Math.min(...expected.map((point) => point.y)),
        bottom: Math.max(...expected.map((point) => point.y)),
      });
    }
  });

  it('décide devant et derrière aux quatre rotations', () => {
    const actor = { x: 5, y: 5 };
    for (const rot of [0, 1, 2, 3] as const) {
      const dims: Dims = { w: 11, h: 11, rot };
      const actorCenter = tileCenter(actor.x, actor.y, dims);
      const actorHead = tileCenter(actor.x, actor.y, dims, 1);
      const capsule: ActorCapsule = {
        segment: [
          { x: actorCenter.cx, y: actorCenter.cy },
          { x: actorHead.cx, y: actorHead.cy },
        ],
        radius: 18,
        depth: depth(actor.x, actor.y, dims),
        vertical: [0, 1],
      };
      const basis = screenBasis(actor.x, actor.y, dims);
      const candidates = [
        { x: 4, y: 4 },
        { x: 4, y: 6 },
        { x: 6, y: 4 },
        { x: 6, y: 6 },
      ].filter((point) => screenBasis(point.x, point.y, dims).col === basis.col);
      const front = candidates.find((point) => depth(point.x, point.y, dims) > capsule.depth)!;
      const behind = candidates.find((point) => depth(point.x, point.y, dims) < capsule.depth)!;
      const panelAt = (point: { x: number; y: number }) => projectOccluder({
        polygons: [[
          { x: point.x - 0.2, y: point.y - 0.2, lift: 0 },
          { x: point.x + 0.2, y: point.y + 0.2, lift: 0 },
          { x: point.x + 0.2, y: point.y + 0.2, lift: 1 },
          { x: point.x - 0.2, y: point.y - 0.2, lift: 1 },
        ]],
      }, dims);

      expect(occludesActor(panelAt(front), capsule)).toBe(true);
      expect(occludesActor(panelAt(behind), capsule)).toBe(false);
    }
  });
});

describe('footprintDepth — MAX sur les 4 coins (coin proche caméra aux 4 rotations)', () => {
  const corners = (x: number, y: number, w: number, h: number): [number, number][] =>
    [[x, y], [x + w - 1, y], [x, y + h - 1], [x + w - 1, y + h - 1]];

  it('= MAX de depth sur les 4 coins de l’empreinte (3×2)', () => {
    const dims: Dims = { w: 8, h: 8 };
    const [x, y, w, h] = [2, 3, 3, 2];
    const expected = Math.max(...corners(x, y, w, h).map(([cx, cy]) => depth(cx, cy, dims)));
    expect(footprintDepth(x, y, w, h, dims)).toBe(expected);
  });

  it('empreinte 1×1 = depth de la case (généralise depth)', () => {
    const dims: Dims = { w: 6, h: 6 };
    for (let x = 0; x < dims.w; x++)
      for (let y = 0; y < dims.h; y++)
        expect(footprintDepth(x, y, 1, 1, dims)).toBe(depth(x, y, dims));
  });

  it('aux 4 rotations : = depth du coin le PLUS PROCHE caméra (cy max à l’écran)', () => {
    const [x, y, w, h] = [1, 2, 4, 3];
    for (const rot of [0, 1, 2, 3] as const) {
      const dims: Dims = { w: 9, h: 7, rot };
      const cs = corners(x, y, w, h);
      const nearest = cs.reduce((best, c) =>
        tileCenter(c[0], c[1], dims).cy > tileCenter(best[0], best[1], dims).cy ? c : best, cs[0]);
      // le coin proche caméra (cy max) porte aussi la depth max → footprintDepth s'y ancre
      expect(footprintDepth(x, y, w, h, dims)).toBe(depth(nearest[0], nearest[1], dims));
      expect(footprintDepth(x, y, w, h, dims)).toBe(Math.max(...cs.map((c) => depth(c[0], c[1], dims))));
    }
  });

  it('porte l’élévation z comme cran SECONDAIRE (même empreinte : haut > bas ; base prime sur z)', () => {
    const dims: Dims = { w: 6, h: 6 };
    // même empreinte, z plus haut → profondeur plus grande (z = départage secondaire)
    expect(footprintDepth(1, 1, 2, 2, dims, 1)).toBeGreaterThan(footprintDepth(1, 1, 2, 2, dims, 0));
    // mais la BASE (position écran) domine z : une empreinte AVANT au sol passe devant une empreinte
    // ARRIÈRE d'un étage haut (≠ ancien modèle de bande z où le haut écrasait tout le bas)
    expect(footprintDepth(5, 5, 1, 1, dims, 0)).toBeGreaterThan(footprintDepth(0, 0, 1, 1, dims, 1));
  });

  it('w/h ≤ 0 traités comme 1 case (robustesse)', () => {
    const dims: Dims = { w: 5, h: 5 };
    expect(footprintDepth(2, 2, 0, 0, dims)).toBe(depth(2, 2, dims));
  });
});

describe('projection multi-niveaux (élévation z)', () => {
  const ROTS = [0, 1, 2, 3] as const;
  const VIEWS = ['iso', 'top'] as const;

  it('z = 0 est rétro-compatible (tileCenter/depth inchangés)', () => {
    const dims: Dims = { w: 5, h: 4 };
    for (let x = 0; x < dims.w; x++)
      for (let y = 0; y < dims.h; y++) {
        expect(tileCenter(x, y, dims, 0)).toEqual(tileCenter(x, y, dims));
        expect(depth(x, y, dims, 0)).toBe(depth(x, y, dims));
      }
  });

  it('un niveau plus haut soulève la tuile à l’écran de z·LEVEL_H (cx inchangé)', () => {
    const dims: Dims = { w: 5, h: 4 };
    const base = tileCenter(2, 1, dims, 0);
    for (const z of [1, 2, 3]) {
      const lifted = tileCenter(2, 1, dims, z);
      expect(lifted.cx).toBe(base.cx);
      expect(lifted.cy).toBe(base.cy - z * LEVEL_H);
    }
  });

  it('vue « top » : une élévation z NE décale RIEN à l’écran (regard vertical, contrairement à l’iso)', () => {
    const dims: Dims = { w: 5, h: 4, view: 'top' };
    const base = tileCenter(2, 1, dims, 0);
    for (const z of [1, 2, 3]) {
      expect(tileCenter(2, 1, dims, z)).toEqual(base);
    }
    // l'iso, LUI, reste décalé (non-régression du comportement légitime)
    const isoDims: Dims = { w: 5, h: 4 };
    const isoBase = tileCenter(2, 1, isoDims, 0);
    const isoLifted = tileCenter(2, 1, isoDims, 1);
    expect(isoLifted.cy).toBe(isoBase.cy - LEVEL_H);
  });

  it('depth : z est un cran SECONDAIRE — interclassement par position écran (base ≫ z)', () => {
    // à position écran ÉGALE, l'étage haut passe DEVANT (départage par z) — vaut pour TOUTES les vues/rots
    for (const view of VIEWS)
      for (const rot of ROTS) {
        const dims: Dims = { w: 5, h: 5, rot, view };
        for (let x = 0; x < dims.w; x++)
          for (let y = 0; y < dims.h; y++)
            expect(depth(x, y, dims, 1)).toBeGreaterThan(depth(x, y, dims, 0));
      }
    // mais la BASE (anti-diagonale écran) DOMINE z : une case plus AVANT au sol passe devant une case
    // plus ARRIÈRE d'un étage HAUT (≠ ancien modèle de bande z qui enterrait tout le bas). Orientation
    // par défaut (base = x+y) pour contrôler l'ordre écran.
    const dims: Dims = { w: 5, h: 5 };
    expect(depth(3, 1, dims, 0)).toBeGreaterThan(depth(1, 1, dims, 1)); // base 4 vs base 2 (+ z=1)
  });

  it('hiérarchie base ≫ z : un cran d’anti-diagonale domine toute la pile d’étages (maxLevels=8)', () => {
    // un pas d'anti-diagonale (base +1, orientation par défaut) doit dépasser l'écart total de z sur 8
    // étages → un objet plus AVANT reste devant quel que soit l'étage de l'objet derrière.
    const maxLevels = 8;
    const dims: Dims = { w: 5, h: 5 };
    expect(depth(1, 0, dims, 0) - depth(0, 0, dims, 0)).toBeGreaterThan(maxLevels * Z_STEP);
    // invariants nominaux : un cran d'étage domine tout offset de couche (≈0.7) ; BASE_SCALE dépasse
    // la pile d'étages + 1.
    expect(Z_STEP).toBeGreaterThan(0.7);
    expect(BASE_SCALE).toBeGreaterThan(maxLevels * Z_STEP + 1);
  });

  it('sol/jeton : un sol (depth−0.5) passe sous son jeton (+0.5) et au-dessus du jeton du dessous', () => {
    for (const view of VIEWS)
      for (const rot of ROTS) {
        const dims: Dims = { w: 6, h: 6, rot, view };
        for (let x = 0; x < dims.w; x++)
          for (let y = 0; y < dims.h; y++) {
            // sous le jeton de SA propre case (jeton à +0.5)
            expect(depth(x, y, dims, 1) - 0.5).toBeLessThan(depth(x, y, dims, 1) + 0.5);
            // au-dessus du jeton de la MÊME case à l'étage inférieur (z=0, +0.5) — surplomb local correct
            expect(depth(x, y, dims, 1) - 0.5).toBeGreaterThan(depth(x, y, dims, 0) + 0.5);
          }
      }
  });

  it('depth : l’ordre intra-niveau est préservé (même tri qu’à z=0)', () => {
    const dims: Dims = { w: 5, h: 5 };
    const cells: { x: number; y: number }[] = [];
    for (let x = 0; x < dims.w; x++) for (let y = 0; y < dims.h; y++) cells.push({ x, y });
    for (const z of [0, 2, 5])
      for (const a of cells)
        for (const b of cells) {
          const base = Math.sign(depth(a.x, a.y, dims, 0) - depth(b.x, b.y, dims, 0));
          const lifted = Math.sign(depth(a.x, a.y, dims, z) - depth(b.x, b.y, dims, z));
          expect(lifted).toBe(base);
        }
  });

  it('screenToTileAtZ inverse tileCenter au niveau donné (iso + top, 4 rotations)', () => {
    for (const view of VIEWS)
      for (const rot of ROTS)
        for (const z of [0, 1, 2]) {
          const dims: Dims = { w: 6, h: 4, rot, view };
          for (let x = 0; x < dims.w; x++)
            for (let y = 0; y < dims.h; y++) {
              const { cx, cy } = tileCenter(x, y, dims, z);
              expect(screenToTileAtZ(cx, cy, dims, z)).toEqual({ x, y });
            }
        }
  });

  it('screenToTileAtZ au niveau 0 = screenToTile (rétro-compat)', () => {
    const dims: Dims = { w: 6, h: 4 };
    for (let x = 0; x < dims.w; x++)
      for (let y = 0; y < dims.h; y++) {
        const { cx, cy } = tileCenter(x, y, dims);
        expect(screenToTileAtZ(cx, cy, dims, 0)).toEqual(screenToTile(cx, cy, dims));
      }
  });

  it('diamondCorners/diamondPath suivent l’élévation z (soulevés de z·LEVEL_H, cx inchangé)', () => {
    const dims: Dims = { w: 5, h: 5 };
    const c0 = diamondCorners(2, 2, dims, 0);
    const c1 = diamondCorners(2, 2, dims, 1);
    expect(c1.cx).toBe(c0.cx);
    expect(c1.cy).toBe(c0.cy - LEVEL_H);
    expect(c1.top[1]).toBe(c0.top[1] - LEVEL_H);
    expect(diamondPath(2, 2, dims)).toBe(diamondPath(2, 2, dims, 0)); // `z` absent = couche 0
    expect(diamondPath(2, 2, dims, 1)).not.toBe(diamondPath(2, 2, dims, 0));
  });
});

describe('projection vue du dessus (view: top)', () => {
  const ROTS = [0, 1, 2, 3] as const;

  it('screenToTile inverse tileCenter (grille carrée) pour les 4 rotations', () => {
    for (const rot of ROTS) {
      const dims: Dims = { w: 6, h: 4, rot, view: 'top' };
      for (let x = 0; x < dims.w; x++)
        for (let y = 0; y < dims.h; y++) {
          const { cx, cy } = tileCenter(x, y, dims);
          expect(screenToTile(cx, cy, dims)).toEqual({ x, y });
        }
    }
  });

  it('les cases voisines sont espacées de CELL (pas de skew iso)', () => {
    const dims: Dims = { w: 5, h: 5, view: 'top' };
    const a = tileCenter(2, 2, dims);
    const bx = tileCenter(3, 2, dims);
    const by = tileCenter(2, 3, dims);
    expect(bx.cx - a.cx).toBe(CELL);
    expect(bx.cy - a.cy).toBe(0); // même rangée → même cy (orthogonal, pas diagonal)
    expect(by.cy - a.cy).toBe(CELL);
    expect(by.cx - a.cx).toBe(0);
  });

  it('diamondPath est un carré axis-aligné de côté CELL', () => {
    const dims: Dims = { w: 3, h: 3, view: 'top' };
    const { cx, cy } = tileCenter(1, 1, dims);
    const h = CELL / 2;
    expect(diamondPath(1, 1, dims)).toBe(
      `M${cx - h},${cy - h} L${cx + h},${cy - h} L${cx + h},${cy + h} L${cx - h},${cy + h} Z`,
    );
  });

  it('toutes les cases tiennent dans stageSize (4 rotations)', () => {
    for (const rot of ROTS) {
      const dims: Dims = { w: 6, h: 4, rot, view: 'top' };
      const stage = stageSize(dims);
      for (let x = 0; x < dims.w; x++)
        for (let y = 0; y < dims.h; y++) {
          const { cx, cy } = tileCenter(x, y, dims);
          expect(cx).toBeGreaterThanOrEqual(0);
          expect(cx).toBeLessThanOrEqual(stage.w);
          expect(cy).toBeGreaterThanOrEqual(0);
          expect(cy).toBeLessThanOrEqual(stage.h);
        }
    }
  });

  it('depth suit la position écran (cy) en top-mode (4 rotations)', () => {
    for (const rot of ROTS) {
      const dims: Dims = { w: 5, h: 5, rot, view: 'top' };
      const tiles: { d: number; cy: number }[] = [];
      for (let x = 0; x < dims.w; x++)
        for (let y = 0; y < dims.h; y++)
          tiles.push({ d: depth(x, y, dims), cy: tileCenter(x, y, dims).cy });
      const byDepth = [...tiles].sort((a, b) => a.d - b.d).map((t) => t.cy);
      for (let i = 1; i < byDepth.length; i++) expect(byDepth[i]).toBeGreaterThanOrEqual(byDepth[i - 1]);
    }
  });
});

describe('billboardScale — réduit le sprite en vue « de face » pour qu’il remplisse sa tuile', () => {
  const D = { w: 20, h: 20 };
  it('1 en iso (losange), EDGE_W/TW en vue de face (edge), 1 en vue du dessus', () => {
    expect(billboardScale({ ...D, rot: 0 })).toBeCloseTo(1, 6);
    expect(billboardScale({ ...D, rot: 0, edge: true })).toBeCloseTo(Math.SQRT1_2, 4);
    expect(billboardScale({ ...D, rot: 0, edge: true, view: 'top' })).toBeCloseTo(1, 6);
  });
});
