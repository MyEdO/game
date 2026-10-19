import { describe, expect, it } from 'vitest';
import {
  coursesKey,
  coursesPeriod,
  coursesPeriodM,
  groundCoursesPeriod,
  groundPeriodM,
  patternWM,
  roofCourseStepM,
  rowBoundaries,
  GROUND_ROWS,
  type Courses,
} from './courses';
import { tousLesTerrains } from '../../noyau/monde/terrain';
import { structureAppearances, matieresDe } from '../../data';

/**
 * Le TRACÉ DE PÉRIODE est ce qui doit BOUCLER : un motif dont les bords ne se rejoignent pas dessine
 * une grille de coutures à travers toute une place pavée. Les invariants sont donc ceux de la couture
 * (extrémités exactes, aucun joint au bord) et du déterminisme (même seed → même pierre).
 */

/** Toutes les recettes d'assises AUTHORÉES du dépôt — la population que le rendu rencontre. Relue à
 *  CHAQUE appel : `matieresDe` interroge le document VIVANT (`data/overrides`), qu'une retouche au
 *  Codex remplace ; une vue prise au chargement du module jugerait un catalogue qui n'est plus celui
 *  du rendu. */
const RECETTES = (): [string, Courses][] =>
  [...structureAppearances, ...matieresDe('relief'), ...tousLesTerrains()]
    .map((d) => [d.id, d.detail?.courses] as [string, Courses | undefined])
    .filter((e): e is [string, Courses] => Boolean(e[1]));

const PIERRE: Courses = { hM: 0.5, joint: '#555', jointW: 0.03, stagger: 0.5, blockWM: [0.6, 1.1], edgeWobble: 0.02, paletteVar: 0.08 };
const PLANCHE: Courses = { hM: 0.35, joint: '#333', jointW: 0.02 };

describe('la population authorée est bien celle que le test parcourt', () => {
  it('le dépôt porte des recettes d’assises, à blocs comme continues', () => {
    expect(RECETTES().length).toBeGreaterThan(3);
    expect(RECETTES().some(([, c]) => c.blockWM)).toBe(true);
  });
});

describe('patternWM / périodes métriques', () => {
  it('rang CONTINU (sans blocs) : période de 2 m ; avec blocs : ~4 blocs moyens, jamais moins de 1,6 m', () => {
    expect(patternWM(PLANCHE)).toBe(2);
    expect(patternWM(PIERRE)).toBeCloseTo(2 * (0.6 + 1.1), 12);
    expect(patternWM({ ...PIERRE, blockWM: [0.2, 0.3] })).toBe(1.6);
  });

  it('la période d’un MUR fait deux rangs de haut, celle d’un SOL en fait GROUND_ROWS et double sa largeur', () => {
    expect(coursesPeriodM(PIERRE)).toEqual({ u: patternWM(PIERRE), v: 2 * PIERRE.hM });
    expect(groundPeriodM(PIERRE)).toEqual({ u: 2 * patternWM(PIERRE), v: GROUND_ROWS * PIERRE.hM });
  });
});

describe('rowBoundaries — les joints verticaux d’un rang', () => {
  it('aucune borne au BORD de période : le bloc y chevauche la couture', () => {
    for (const [id, c] of RECETTES()) {
      const W = patternWM(c);
      for (let v = 0; v < 3; v++)
        for (const parity of [0, 1] as const)
          for (const b of rowBoundaries(c, coursesKey(c), v, parity)) expect([id, b > 0.05 && b < W - 0.05]).toEqual([id, true]);
    }
  });

  it('bornes STRICTEMENT croissantes (jamais deux joints superposés)', () => {
    for (const [id, c] of RECETTES())
      for (const parity of [0, 1] as const) {
        const b = rowBoundaries(c, coursesKey(c), 0, parity);
        expect([id, b]).toEqual([id, [...b].sort((x, y) => x - y)]);
        expect([id, new Set(b).size]).toEqual([id, b.length]);
      }
  });

  it('DÉTERMINISTE au seed : mêmes (clé, variante, parité) → mêmes bornes ; parités et variantes DIVERGENT', () => {
    const k = coursesKey(PIERRE);
    expect(rowBoundaries(PIERRE, k, 0, 0)).toEqual(rowBoundaries(PIERRE, k, 0, 0));
    expect(rowBoundaries(PIERRE, k, 0, 0)).not.toEqual(rowBoundaries(PIERRE, k, 0, 1));
    expect(rowBoundaries(PIERRE, k, 0, 0)).not.toEqual(rowBoundaries(PIERRE, k, 1, 0));
  });

  it('un joint qui tomberait À RAS de la couture est ÉCARTÉ (le bloc y chevauche le bord de période)', () => {
    // Blocs d'1 m pile, rang impair décalé de 0,98 m : le premier joint tomberait à u = 0,02 — collé au
    // bord de période, il y dessinerait une ligne verticale visible à chaque raccord du motif.
    const àRas: Courses = { hM: 0.5, joint: '#555', jointW: 0.03, stagger: 0.98, blockWM: [1, 1] };
    expect(patternWM(àRas)).toBe(4);
    expect(rowBoundaries(àRas, 'aras', 0, 1)).toEqual([1.02, 2.02, 3.02].map((v) => expect.closeTo(v, 9)));
  });

  it('rang CONTINU (bardeau, planche) : aucun joint vertical', () => {
    expect(rowBoundaries(PLANCHE, coursesKey(PLANCHE), 0, 0)).toEqual([]);
  });
});

describe('coursesPeriod — le tracé d’une période VERTICALE', () => {
  it('les lignes de rang REJOIGNENT leur hauteur de départ : la période boucle sans couture', () => {
    for (const [id, c] of RECETTES()) {
      const p = coursesPeriod(c, coursesKey(c), 0);
      for (const l of p.lines) {
        expect([id, l.pts[l.pts.length - 1].u]).toEqual([id, p.wM]);
        expect([id, l.pts[l.pts.length - 1].y]).toEqual([id, l.y0]);
      }
    }
  });

  it('le tremblé reste borné par `edgeWobble` (une ligne de joint ne part pas dans le rang voisin)', () => {
    const p = coursesPeriod(PIERRE, coursesKey(PIERRE), 0);
    for (const l of p.lines) for (const pt of l.pts) expect(Math.abs(pt.y - l.y0)).toBeLessThanOrEqual(PIERRE.edgeWobble!);
  });

  it('deux lignes (y=0 et y=hM), et les joints verticaux des DEUX parités', () => {
    const p = coursesPeriod(PIERRE, coursesKey(PIERRE), 0);
    expect(p.lines.map((l) => l.y0)).toEqual([0, PIERRE.hM]);
    expect(p.hM).toBe(2 * PIERRE.hM);
    const k = coursesKey(PIERRE);
    expect(p.verticals.filter((v) => v.y0 === 0).map((v) => v.u)).toEqual(rowBoundaries(PIERRE, k, 0, 0));
    expect(p.verticals.filter((v) => v.y0 === PIERRE.hM).map((v) => v.u)).toEqual(rowBoundaries(PIERRE, k, 0, 1));
    for (const v of p.verticals) expect(v.y1 - v.y0).toBeCloseTo(PIERRE.hM, 12);
  });
});

describe('groundCoursesPeriod — le tracé d’une période de SOL', () => {
  const sol = groundCoursesPeriod(PIERRE, coursesKey(PIERRE));

  it('GROUND_ROWS rangs, la largeur d’une période de sol, extrémités exactes', () => {
    expect(sol.lines.length).toBe(GROUND_ROWS);
    expect(sol.wM).toBe(2 * patternWM(PIERRE));
    expect(sol.hM).toBe(GROUND_ROWS * PIERRE.hM);
    for (const l of sol.lines) expect(l.pts[l.pts.length - 1]).toEqual({ u: sol.wM, y: l.y0 });
  });

  it('les blocs nuancés tiennent DANS la période et dans leur rang', () => {
    const blocs = [...sol.light, ...sol.dark];
    expect(blocs.length).toBeGreaterThan(0);
    for (const b of blocs) {
      expect(b.u0).toBeGreaterThanOrEqual(0);
      expect(b.u1).toBeLessThanOrEqual(sol.wM);
      expect(b.u1).toBeGreaterThan(b.u0);
      expect(b.v1 - b.v0).toBeCloseTo(PIERRE.hM - 0.1, 9); // hauteur de rang moins les deux retraits
    }
  });

  it('clair et sombre sont DISJOINTS (un bloc ne reçoit pas les deux voiles)', () => {
    const clé = (b: { u0: number; v0: number }) => `${b.u0.toFixed(6)},${b.v0.toFixed(6)}`;
    const clairs = new Set(sol.light.map(clé));
    expect(sol.dark.filter((b) => clairs.has(clé(b)))).toEqual([]);
  });

  it('sans `paletteVar` : des joints, aucun bloc nuancé', () => {
    const nu = groundCoursesPeriod({ ...PIERRE, paletteVar: undefined }, 'nu');
    expect(nu.verticals.length).toBeGreaterThan(0);
    expect([nu.light, nu.dark]).toEqual([[], []]);
  });

  it('DÉTERMINISTE au seed : deux appels rendent le même tracé', () => {
    expect(groundCoursesPeriod(PIERRE, coursesKey(PIERRE))).toEqual(sol);
  });
});

describe('roofCourseStepM — le pas de rang d’un PAN suit SA pente', () => {
  const HM = PIERRE.hM;

  it('sans pente déclarée : la pente de référence, découpée en un nombre ENTIER de rangs', () => {
    const slope = 1.7;
    const step = roofCourseStepM(undefined, HM, slope);
    expect(slope / step).toBeCloseTo(Math.round(slope / step), 10);
    expect(step).toBeCloseTo(slope / Math.max(1, Math.round(slope / HM)), 10);
  });

  it('avec pente : le rang ne se coupe jamais en deux à l’arêtier (compte entier, pas ajusté)', () => {
    for (const pitch of [0.6, 1.2, 2.4, 3.3]) {
      const step = roofCourseStepM(pitch, HM, 1.7);
      const n = pitch / step;
      expect(n).toBeCloseTo(Math.round(n), 10);
      expect(Math.round(n)).toBeGreaterThanOrEqual(1);
      // Le pas RESTE proche de la hauteur de rang de la recette (jamais un rang de nature différente).
      expect(step).toBeGreaterThan(HM / 2);
      expect(step).toBeLessThan(HM * 2);
    }
  });

  it('deux pentes différentes donnent des pas DIFFÉRENTS (l’échelle est par ÉLÉMENT)', () => {
    expect(roofCourseStepM(1.2, HM, 1.7)).not.toBeCloseTo(roofCourseStepM(1.45, HM, 1.7), 6);
  });

  it('une pente NULLE ne fabrique pas de rang (pas nul, jamais une division par zéro)', () => {
    expect(roofCourseStepM(0, HM, 1.7)).toBe(0);
  });
});
