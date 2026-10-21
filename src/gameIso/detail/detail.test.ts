import { describe, it, expect } from 'vitest';
import { hash32, seedStream } from '../../data/hash';
import { expandRecipe, type DetailExpansion } from './expand';
import type { DetailRecipe } from '../../data/materials.types';

/** Recette type « appareillage de pierre » (celle ancrée dans structureAppearance.json). */
const STONE: DetailRecipe = {
  seedScope: 'edge',
  courses: { hM: 0.35, joint: '#2e2a24', jointW: 0.02, stagger: 0.5, blockWM: [0.4, 0.9], edgeWobble: 0.02, paletteVar: 0.12 },
  speckle: { perM2: 3, rM: [0.02, 0.06], colors: ['#556052', '#4a4438'] },
};

/** Arrondi récursif à 4 décimales — goldens lisibles, insensibles au bruit flottant. */
function round4(x: unknown): unknown {
  if (typeof x === 'number') return Math.round(x * 1e4) / 1e4;
  if (Array.isArray(x)) return x.map(round4);
  if (x && typeof x === 'object') return Object.fromEntries(Object.entries(x).map(([k, v]) => [k, round4(v)]));
  return x;
}

describe('hash32 — identité MONDE → seed déterministe', () => {
  it('même entrée = même sortie ; entrées voisines = sorties distinctes', () => {
    expect(hash32('wall', 3, 4, 0, 'N')).toBe(hash32('wall', 3, 4, 0, 'N'));
    expect(hash32('wall', 3, 4, 0, 'N')).not.toBe(hash32('wall', 3, 5, 0, 'N'));
    expect(hash32('wall', 3, 4, 0, 'N')).not.toBe(hash32('wall', 3, 4, 0, 'S'));
    expect(hash32('wall', 3, 4, 0, 'N')).not.toBe(hash32('tile', 3, 4, 0, 'N'));
  });

  it("le séparateur inter-parts distingue ('ab','c') de ('a','bc')", () => {
    expect(hash32('ab', 'c')).not.toBe(hash32('a', 'bc'));
  });

  it('entier non signé 32 bits, et valeur FIGÉE (stabilité inter-plateformes/sessions)', () => {
    const h = hash32('wall', 3, 4, 0, 'N');
    expect(Number.isInteger(h)).toBe(true);
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThan(2 ** 32);
    // GOLDEN : si cette valeur bouge, TOUS les détails du monde changent d'aspect.
    expect(h).toMatchInlineSnapshot(`2557326957`);
  });

  it('seedStream : flux déterministe ∈ [0,1)', () => {
    const a = seedStream(hash32('x'));
    const b = seedStream(hash32('x'));
    for (let i = 0; i < 20; i++) {
      const v = a();
      expect(v).toBe(b());
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('expandRecipe — expansion pure en primitives UV', () => {
  it('déterminisme total au seed : deux appels = même sortie ; seed différent = sortie différente', () => {
    const seed = hash32('wall', 7, 2, 0, 'E');
    const a = expandRecipe(STONE, 3, 2.4, seed);
    const b = expandRecipe(STONE, 3, 2.4, seed);
    expect(a).toEqual(b);
    const c = expandRecipe(STONE, 3, 2.4, hash32('wall', 7, 3, 0, 'E'));
    expect(c.courses!.blocks).not.toEqual(a.courses!.blocks);
  });

  it('bornes : tout en [0,1]² (wobble borné, blocs tronqués aux bords), épaisseurs/nuances dans leur plage', () => {
    const e: DetailExpansion = expandRecipe(STONE, 3, 2.4, hash32('bornes'));
    for (const r of e.courses!.rows) {
      expect(r.v0).toBeGreaterThanOrEqual(0);
      expect(r.v1).toBeLessThanOrEqual(1);
      expect(r.v1).toBeGreaterThanOrEqual(r.v0); // monotonie : jamais d'inversion de joints
    }
    expect(e.courses!.rows[0].v0).toBe(0); // extrémités EXACTES (pas de wobble aux bords)
    expect(e.courses!.rows[e.courses!.rows.length - 1].v1).toBe(1);
    for (const b of e.courses!.blocks) {
      expect(b.u0).toBeGreaterThanOrEqual(0);
      expect(b.u1).toBeLessThanOrEqual(1);
      expect(b.u1).toBeGreaterThan(b.u0);
      expect(Math.abs(b.shade)).toBeLessThanOrEqual(0.12); // ±paletteVar
    }
    for (const s of e.speckles) {
      expect(s.u).toBeGreaterThanOrEqual(0);
      expect(s.u).toBeLessThan(1);
      expect(s.v).toBeGreaterThanOrEqual(0);
      expect(s.v).toBeLessThan(1);
      expect(s.rM).toBeGreaterThanOrEqual(0.02);
      expect(s.rM).toBeLessThanOrEqual(0.06);
      expect(STONE.speckle!.colors).toContain(s.color);
    }
  });

  it('stagger : les rangs impairs sont décalés de stagger×largeur moyenne (joints non alignés)', () => {
    // Largeur FIXE [1,1] (zéro aléa de largeur) → positions exactement prévisibles.
    const rec: DetailRecipe = { seedScope: 'tile', courses: { hM: 1, joint: '#000', jointW: 0.02, stagger: 0.5, blockWM: [1, 1] } };
    const e = expandRecipe(rec, 4, 2, hash32('stagger'));
    const rowU = (row: number) => e.courses!.blocks.filter((b) => b.v0 === row / 2).map((b) => [b.u0, b.u1]);
    expect(round4(rowU(0))).toEqual([[0, 0.25], [0.25, 0.5], [0.5, 0.75], [0.75, 1]]);
    // Rang 1 : départ à −0.5 m (tronqué à u=0) → joints verticaux au demi-pas du rang 0.
    expect(round4(rowU(1))).toEqual([[0, 0.125], [0.125, 0.375], [0.375, 0.625], [0.625, 0.875], [0.875, 1]]);
  });

  it('rang continu (bardeau/planche) : blockWM absent → rangs sans blocs, compte = hauteur/hM', () => {
    const rec: DetailRecipe = { seedScope: 'tile', courses: { hM: 0.25, joint: '#000', jointW: 0.01 } };
    const e = expandRecipe(rec, 3, 2, hash32('bardeaux'));
    expect(e.courses!.rows).toHaveLength(8); // 2 m / 0.25 m
    expect(e.courses!.blocks).toHaveLength(0);
  });

  it('densité speckle = perM2 × aire (arrondie)', () => {
    const rec: DetailRecipe = { seedScope: 'tile', speckle: { perM2: 3, rM: [0.02, 0.05], colors: ['#111'] } };
    expect(expandRecipe(rec, 4, 2.5, hash32('s')).speckles).toHaveLength(30); // 3 × 10 m²
    expect(expandRecipe(rec, 1, 1, hash32('s')).speckles).toHaveLength(3);
  });

  it('speckle vBias : tasse les taches vers le PIED (v moyen > uniforme), sans sortir de [0,1)', () => {
    const flat: DetailRecipe = { seedScope: 'tile', speckle: { perM2: 40, rM: [0.02, 0.05], colors: ['#111'] } };
    const foot: DetailRecipe = { seedScope: 'tile', speckle: { perM2: 40, rM: [0.02, 0.05], colors: ['#111'], vBias: 2 } };
    const mean = (r: DetailRecipe) => {
      const s = expandRecipe(r, 3, 3, hash32('vb')).speckles;
      for (const d of s) { expect(d.v).toBeGreaterThanOrEqual(0); expect(d.v).toBeLessThan(1); }
      return s.reduce((acc, d) => acc + d.v, 0) / s.length;
    };
    expect(mean(foot)).toBeGreaterThan(mean(flat));
  });

  it('tufts : densité = perM2 × aire, hauteur dans sa plage, couleur de la palette', () => {
    const rec: DetailRecipe = { seedScope: 'tile', tufts: { perM2: 1.5, hM: [0.1, 0.22], colors: ['#5c8a40', '#39592a'] } };
    const e = expandRecipe(rec, 2, 2, hash32('tile', 4, 6, 0));
    expect(e.tufts).toHaveLength(6); // 1.5 × 4 m²
    for (const t of e.tufts) {
      expect(t.u).toBeGreaterThanOrEqual(0);
      expect(t.u).toBeLessThan(1);
      expect(t.hM).toBeGreaterThanOrEqual(0.1);
      expect(t.hM).toBeLessThanOrEqual(0.22);
      expect(rec.tufts!.colors).toContain(t.color);
    }
  });

  it('bands : atV = centre, hauteur métrique → fraction v, clampée à la face', () => {
    const rec: DetailRecipe = { seedScope: 'instance', bands: [{ atV: 0.94, hM: 0.25, color: '#222' }, { atV: 1, hM: 0.5, color: '#333' }] };
    const e = expandRecipe(rec, 3, 2.5, hash32('b'));
    expect(round4(e.bands[0])).toEqual({ v0: 0.89, v1: 0.99, color: '#222' }); // 0.94 ± 0.05
    expect(round4(e.bands[1])).toEqual({ v0: 0.9, v1: 1, color: '#333' }); // plinthe : clamp bas de face
  });

  it('timber : un poteau à chaque bord + travées entières ; écharpes X = 2 diagonales/travée', () => {
    const rec: DetailRecipe = { seedScope: 'instance', timber: { postEveryM: 1, braces: 'X', wM: 0.12, color: '#3a2c1c' } };
    const e = expandRecipe(rec, 4, 2.6, hash32('t'));
    expect(e.timber!.posts).toEqual([0, 0.25, 0.5, 0.75, 1]);
    expect(e.timber!.braces).toHaveLength(8); // 4 travées × 2 diagonales
    const v: DetailRecipe = { seedScope: 'instance', timber: { postEveryM: 2, braces: 'V', wM: 0.12, color: '#3a2c1c' } };
    const ev = expandRecipe(v, 4, 2.6, hash32('t'));
    // V : deux segments qui se rejoignent en BAS au milieu de la travée.
    expect(ev.timber!.braces).toEqual([
      { u0: 0, v0: 0, u1: 0.25, v1: 1 }, { u0: 0.5, v0: 0, u1: 0.25, v1: 1 },
      { u0: 0.5, v0: 0, u1: 0.75, v1: 1 }, { u0: 1, v0: 0, u1: 0.75, v1: 1 },
    ]);
  });

  it("GOLDEN — expansion type figée byte-pour-byte (stabilité de l'aspect du monde)", () => {
    const e = expandRecipe(STONE, 1.2, 1.05, hash32('wall', 5, 9, 0, 'S'));
    expect(round4(e)).toMatchInlineSnapshot(`
      {
        "bands": [],
        "courses": {
          "blocks": [
            {
              "shade": 0.0166,
              "u0": 0,
              "u1": 0.6149,
              "v0": 0,
              "v1": 0.3205,
            },
            {
              "shade": -0.0305,
              "u0": 0.6149,
              "u1": 1,
              "v0": 0,
              "v1": 0.3205,
            },
            {
              "shade": 0.0852,
              "u0": 0,
              "u1": 0.1117,
              "v0": 0.3205,
              "v1": 0.6605,
            },
            {
              "shade": -0.1027,
              "u0": 0.1117,
              "u1": 0.8233,
              "v0": 0.3205,
              "v1": 0.6605,
            },
            {
              "shade": -0.0414,
              "u0": 0.8233,
              "u1": 1,
              "v0": 0.3205,
              "v1": 0.6605,
            },
            {
              "shade": 0.0697,
              "u0": 0,
              "u1": 0.5577,
              "v0": 0.6605,
              "v1": 1,
            },
            {
              "shade": 0.0862,
              "u0": 0.5577,
              "u1": 1,
              "v0": 0.6605,
              "v1": 1,
            },
          ],
          "joint": "#2e2a24",
          "jointWM": 0.02,
          "rows": [
            {
              "v0": 0,
              "v1": 0.3205,
            },
            {
              "v0": 0.3205,
              "v1": 0.6605,
            },
            {
              "v0": 0.6605,
              "v1": 1,
            },
          ],
        },
        "speckles": [
          {
            "color": "#4a4438",
            "rM": 0.0442,
            "u": 0.1095,
            "v": 0.4132,
          },
          {
            "color": "#556052",
            "rM": 0.0293,
            "u": 0.7138,
            "v": 0.1712,
          },
          {
            "color": "#556052",
            "rM": 0.0519,
            "u": 0.4673,
            "v": 0.0573,
          },
          {
            "color": "#556052",
            "rM": 0.0249,
            "u": 0.4779,
            "v": 0.304,
          },
        ],
        "tufts": [],
      }
    `);
  });
});
