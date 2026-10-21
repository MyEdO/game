import { describe, it, expect } from 'vitest';
import { emptyScene, surfaceLink, heightAt, type Scene, type Terrain } from '../noyau/monde/scene';
import { gradeBetween, isWalkableGrade, verticalTiles, metricToLift, STEP_MAX_M, METRES_PER_LEVEL } from '../noyau/monde/relief';

/**
 * RELIEF — auto-connexion des surfaces par la HAUTEUR MÉTRIQUE (modèle unifié : plus d'escaliers ni
 * d'élévation cosmétique). `surfaceLink(scene, a, b)` classe le lien vertical entre deux cases
 * 4-voisines selon |Δhauteur| vs `STEP_MAX_M` : `flat` (Δ0), `ramp` (0 < Δ ≤ STEP_MAX, marchable),
 * `cliff` (Δ > STEP_MAX, infranchissable à pied). La couche `z` N'INTERVIENT PAS dans le classement —
 * seule compte la hauteur RÉELLE des deux surfaces (`heightAt`), fût-ce à cheval sur deux couches.
 */

/** Scène 1 rangée (largeur w) avec un tableau `height` explicite sur la couche de base. */
function ridge(heights: number[]): Scene {
  const w = heights.length;
  const s = emptyScene('scene-test', w, 1);
  s.layers[0].height = [...heights];
  return s;
}

describe('gradeBetween — classement flat/ramp/cliff par |Δhauteur| (STEP_MAX_M = 1 m)', () => {
  it('STEP_MAX_M vaut 1 m (seuil DESIGN documenté)', () => {
    expect(STEP_MAX_M).toBe(1);
  });
  it('Δ = 0 → flat', () => {
    expect(gradeBetween(5, 5)).toBe('flat');
    expect(gradeBetween(0, 0)).toBe('flat');
  });
  it('0 < Δ ≤ STEP_MAX → ramp (y compris pile à STEP_MAX)', () => {
    expect(gradeBetween(0, 0.5)).toBe('ramp');
    expect(gradeBetween(0, STEP_MAX_M)).toBe('ramp'); // 1.0 m : marche franchissable
    expect(gradeBetween(3, 2)).toBe('ramp'); // descente symétrique
  });
  it('Δ > STEP_MAX → cliff', () => {
    expect(gradeBetween(0, STEP_MAX_M + 0.5)).toBe('cliff'); // 1.5 m
    expect(gradeBetween(0, 4)).toBe('cliff'); // un étage de mur (4 m)
    expect(gradeBetween(4, 0)).toBe('cliff'); // dénivelé négatif, même verdict
  });
  it('isWalkableGrade : flat/ramp marchables, cliff non', () => {
    expect(isWalkableGrade('flat')).toBe(true);
    expect(isWalkableGrade('ramp')).toBe(true);
    expect(isWalkableGrade('cliff')).toBe(false);
  });
});

describe('surfaceLink — même couche (hauteurs croissantes le long d’une crête)', () => {
  // Rangée de 5 cases aux hauteurs [0, 0, 1, 2.5, 2.5].
  const s = ridge([0, 0, 1, 2.5, 2.5]);

  it('deux cases de même hauteur → flat, drop 0', () => {
    expect(surfaceLink(s, { x: 0, y: 0 }, { x: 1, y: 0 })).toEqual({ grade: 'flat', drop: 0 });
    expect(surfaceLink(s, { x: 3, y: 0 }, { x: 4, y: 0 })).toEqual({ grade: 'flat', drop: 0 });
  });

  it('marche d’exactement STEP_MAX → ramp, drop signé (b − a)', () => {
    expect(surfaceLink(s, { x: 1, y: 0 }, { x: 2, y: 0 })).toEqual({ grade: 'ramp', drop: 1 }); // 0 → 1
    expect(surfaceLink(s, { x: 2, y: 0 }, { x: 1, y: 0 })).toEqual({ grade: 'ramp', drop: -1 }); // 1 → 0, drop négatif
  });

  it('dénivelé > STEP_MAX → cliff (on n’y descend qu’en chutant)', () => {
    expect(surfaceLink(s, { x: 2, y: 0 }, { x: 3, y: 0 })).toEqual({ grade: 'cliff', drop: 1.5 }); // 1 → 2.5
  });

  it('cases NON 4-adjacentes → null', () => {
    expect(surfaceLink(s, { x: 0, y: 0 }, { x: 2, y: 0 })).toBeNull(); // 2 cases d'écart
    expect(surfaceLink(s, { x: 0, y: 0 }, { x: 0, y: 0 })).toBeNull(); // même case
  });
});

describe('surfaceLink — CROSS-COUCHE : le grade vient des hauteurs, PAS de l’index z', () => {
  /** Couche 0 (herbe) + couche 1 (plancher sur une case), chacune avec sa hauteur métrique. */
  function twoLayer(h0: number, h1: number): Scene {
    const s = emptyScene('scene-test', 2, 1);
    s.layers[0].height = [h0, h0];
    const tiles = new Array(2).fill('vide') as Terrain[];
    tiles[1] = 'plancher';
    s.layers.push({ z: 1, tiles, height: [0, h1] });
    return s;
  }

  it('un tablier z1 à la MÊME hauteur qu’un sol z0 voisin → flat (marchable), malgré Δz = 1', () => {
    const s = twoLayer(3, 3); // sol (0,0) à 3 m ; tablier (1,0,z1) à 3 m
    expect(heightAt(s, 0, 0, 0)).toBe(3);
    expect(heightAt(s, 1, 0, 1)).toBe(3);
    expect(surfaceLink(s, { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 1 })).toEqual({ grade: 'flat', drop: 0 });
  });

  it('un tablier z1 à 0,5 m au-dessus du sol z0 voisin → ramp cross-couche', () => {
    const s = twoLayer(3, 3.5);
    expect(surfaceLink(s, { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 1 })).toEqual({ grade: 'ramp', drop: 0.5 });
  });

  it('un tablier z1 perché 5 m au-dessus du sol z0 voisin → cliff (il faut grimper)', () => {
    const s = twoLayer(3, 8);
    expect(surfaceLink(s, { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 1 })).toEqual({ grade: 'cliff', drop: 5 });
  });
});

describe('conversions métriques (relief.ts)', () => {
  it('verticalTiles = |Δhauteur| ÷ échelle métrique de la case', () => {
    expect(verticalTiles(0, 4, 2)).toBe(2); // 4 m ÷ 2 m/case = 2 cases
    expect(verticalTiles(0, 4, 10)).toBe(0.4); // échelle MER : 4 m ÷ 10 m/case
    expect(verticalTiles(3, 3, 2)).toBe(0); // même altitude → aucune séparation verticale
  });
  it('metricToLift = mètres ÷ METRES_PER_LEVEL (pont mètres → projection iso)', () => {
    expect(METRES_PER_LEVEL).toBe(4);
    expect(metricToLift(4)).toBe(1); // un « niveau » écran = 4 m
    expect(metricToLift(8)).toBe(2);
    expect(metricToLift(0)).toBe(0);
  });
});
