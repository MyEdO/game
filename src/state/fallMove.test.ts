import { describe, it, expect } from 'vitest';
import { emptyScene, type Scene, type Terrain } from './scene';
import { planFranchissement, mouvementDeLAllege } from './fallMove';
import { pathTo } from './path';

/**
 * `planFranchissement` (LDB 15 l.82 ; #700) : le geste qui QUITTE une surface par une arête. Falaise
 * descendante, ou croisée franchissable d'étage → `fall` (hauteur RÉELLE, case d'arrivée AVEC sa
 * couche) ; croisée franchissable de plain-pied → `enjamber` ; tout le reste → `none` nommé.
 */

// Scène 4×4 : falaise de 4 m entre le sommet (2,0) à 4 m et le pied (2,1) à 0 m — AUCUNE arête `climb`.
function cliffScene(): Scene {
  const s = emptyScene(4, 4);
  const w = 4;
  const h = new Array(w * 4).fill(0) as number[];
  h[0 * w + 2] = 4; // (2,0) sommet à 4 m
  s.layers[0].height = h;
  return s;
}

const top = { x: 2, y: 0 }; // sommet (4 m)
const foot = { x: 2, y: 1 }; // pied (0 m)

/** Étage : la case (1,1) existe à la couche 1, à 4 m ; partout ailleurs la couche 1 est `vide`. Une
 *  croisée sur l'arête E de (1,1), couche 1, donne sur la rue (2,1) au rez. */
function etageScene(crossable: boolean): Scene {
  const s = emptyScene(4, 3);
  const n = 4 * 3;
  const tiles = new Array(n).fill('vide') as Terrain[];
  tiles[1 * 4 + 1] = s.layers[0].tiles[0];
  const height = new Array(n).fill(0) as number[];
  height[1 * 4 + 1] = 4;
  s.layers.push({ z: 1, tiles, height });
  s.walls = [{ x: 1, y: 1, side: 'E', z: 1, window: true, ...(crossable ? { crossable: true, allege: 1 } : {}) }];
  return s;
}

/** Plain-pied : un couloir 3×1, une croisée d'allège `allege` m sur l'arête E de (1,0) — aucun détour possible. */
function plainPiedScene(crossable: boolean, allege = 1): Scene {
  const s = emptyScene(3, 1);
  s.walls = [{ x: 1, y: 0, side: 'E', window: true, ...(crossable ? { crossable: true, allege } : {}) }];
  return s;
}

describe('planFranchissement — falaise', () => {
  it('falaise descendante, sans arête climb → saut, hauteur RÉELLE (4 m), arrivée au pied (couche 0)', () => {
    expect(planFranchissement(cliffScene(), top, foot)).toEqual({ kind: 'fall', metres: 4, to: { x: 2, y: 1, z: 0 } });
  });

  it('sens ASCENDANT (pied → sommet) → aucune surface à atteindre', () => {
    expect(planFranchissement(cliffScene(), foot, top)).toEqual({ kind: 'none', raison: 'aucune-surface' });
  });

  it('arête grimpable (`climb`) → flux dédié', () => {
    const s = cliffScene();
    s.walls = [{ x: 2, y: 1, side: 'N', climb: { kind: 'surface' } }];
    expect(planFranchissement(s, top, foot)).toEqual({ kind: 'none', raison: 'escalade' });
  });

  it('mur plein sur l’arête → murée', () => {
    const s = cliffScene();
    s.walls = [{ x: 2, y: 1, side: 'N' }];
    expect(planFranchissement(s, top, foot)).toEqual({ kind: 'none', raison: 'muree' });
  });

  it('dénivelé ≤ seuil sans croisée → la marche, pas un geste', () => {
    const s = emptyScene(4, 4);
    const h = new Array(16).fill(0) as number[];
    h[2] = 1; // 1 m : ≤ STEP_MAX_M → `ramp`
    s.layers[0].height = h;
    expect(planFranchissement(s, { x: 2, y: 0 }, { x: 2, y: 1 })).toEqual({ kind: 'none', raison: 'marche' });
  });

  it('cases non adjacentes ou diagonales → non-adjacente', () => {
    expect(planFranchissement(cliffScene(), top, { x: 3, y: 3 })).toEqual({ kind: 'none', raison: 'non-adjacente' });
    expect(planFranchissement(cliffScene(), top, { x: 3, y: 1 })).toEqual({ kind: 'none', raison: 'non-adjacente' });
  });

  it('case d’arrivée non marchable (mur) → aucune surface', () => {
    const s = cliffScene();
    s.layers[0].tiles[1 * 4 + 2] = 'mur';
    expect(planFranchissement(s, top, foot)).toEqual({ kind: 'none', raison: 'aucune-surface' });
  });
});

describe('planFranchissement — croisée (#700)', () => {
  const chambre = { x: 1, y: 1, z: 1 };
  const rue = { x: 2, y: 1 };

  it('croisée franchissable d’étage → chute PAR une croisée : dénivelé réel (4 m), arrivée à la couche BASSE', () => {
    expect(planFranchissement(etageScene(true), chambre, rue)).toEqual({ kind: 'fall', metres: 4, to: { x: 2, y: 1, z: 0 }, allege: 1 });
  });

  it('croisée NON franchissable d’étage → murée, aucun saut', () => {
    expect(planFranchissement(etageScene(false), chambre, rue)).toEqual({ kind: 'none', raison: 'muree' });
  });

  it('croisée franchissable de plain-pied → enjamber', () => {
    expect(planFranchissement(plainPiedScene(true), { x: 1, y: 0 }, { x: 2, y: 0 })).toEqual({ kind: 'enjamber', to: { x: 2, y: 0, z: 0 }, allege: 1 });
  });

  it('l’enjambée porte l’allège de CETTE croisée, et son coût la suit (LDB 15 l.55, ½ vitesse)', () => {
    const basse = planFranchissement(plainPiedScene(true, 0.5), { x: 1, y: 0 }, { x: 2, y: 0 });
    const haute = planFranchissement(plainPiedScene(true, 3), { x: 1, y: 0 }, { x: 2, y: 0 });
    expect(basse).toEqual({ kind: 'enjamber', to: { x: 2, y: 0, z: 0 }, allege: 0.5 });
    expect(haute).toEqual({ kind: 'enjamber', to: { x: 2, y: 0, z: 0 }, allege: 3 });
    if (basse.kind !== 'enjamber' || haute.kind !== 'enjamber') throw new Error('enjambée attendue');
    expect(mouvementDeLAllege(basse.allege, 2)).toBe(1);
    expect(mouvementDeLAllege(haute.allege, 2)).toBe(3);
  });

  it('croisée franchissable SANS allège authorée → ne se franchit pas (#700 issuecomment-5984719806)', () => {
    const plain = plainPiedScene(true);
    plain.walls = [{ x: 1, y: 0, side: 'E', window: true, crossable: true }];
    expect(planFranchissement(plain, { x: 1, y: 0 }, { x: 2, y: 0 })).toEqual({ kind: 'none', raison: 'muree' });
    const etage = etageScene(true);
    etage.walls = [{ x: 1, y: 1, side: 'E', z: 1, window: true, crossable: true }];
    expect(planFranchissement(etage, chambre, rue)).toEqual({ kind: 'none', raison: 'muree' });
  });

  it('croisée NON franchissable de plain-pied → murée', () => {
    expect(planFranchissement(plainPiedScene(false), { x: 1, y: 0 }, { x: 2, y: 0 })).toEqual({ kind: 'none', raison: 'muree' });
  });

  it('le pathfinding ne traverse JAMAIS la croisée franchissable (arbitrage #1712)', () => {
    expect(pathTo(plainPiedScene(true), { x: 1, y: 0 }, { x: 2, y: 0 }, { blocked: new Set() })).toBeNull();
  });
});
