import { describe, it, expect } from 'vitest';
import { emptyScene, type Scene, type WallClimb } from '../noyau/monde/scene';
import { pathTo, reachable, climbTraverseFor } from '../noyau/monde/path';

/**
 * Grimpant (LDB 85 l.160-162) : `MoveEnv.traverse` rend une arête `WallSeg.climb` traversable au pas
 * NORMAL pour `reachable`/`pathTo` — mur ET falaise (`surfaceLink` cliff) bypassés. Sans `traverse`, une
 * arête `climb` reste infranchissable au pathing (mur plein + falaise), comme avant #504.
 */
function cliffScene(climb: WallClimb): Scene {
  const s = emptyScene('scene-test', 4, 4);
  const w = 4;
  const h = new Array(w * 4).fill(0) as number[];
  h[0 * w + 2] = 4; // (2,0) sommet à 4 m
  s.layers[0].height = h;
  s.walls = [{ x: 2, y: 1, side: 'N', climb }];
  return s;
}

const empty = new Set<string>();
const foot = { x: 2, y: 1 };
const top = { x: 2, y: 0 };

describe('pathing — Grimpant (traverse)', () => {
  it('sans traverse : une arête climb reste infranchissable (mur + falaise)', () => {
    const reach = reachable(cliffScene({ kind: 'surface' }), foot, 10, { blocked: empty });
    expect(reach.has('2,0')).toBe(false);
    expect(pathTo(cliffScene({ kind: 'surface' }), foot, top, { blocked: empty })).toBeNull();
  });

  it('traverse.climb sans climbFullSpeed : PAS de bypass (coût variable non représenté dans ce BFS)', () => {
    const reach = reachable(cliffScene({ kind: 'surface' }), foot, 10, { blocked: empty, traverse: { climb: true } });
    expect(reach.has('2,0')).toBe(false);
  });

  it('traverse.climb + climbFullSpeed : arête surface franchie au pas NORMAL (coût 1)', () => {
    const reach = reachable(cliffScene({ kind: 'surface' }), foot, 10, { blocked: empty, traverse: { climb: true, climbFullSpeed: true } });
    expect(reach.get('2,0')).toBe(1); // 1 pas, PAS la ½ vitesse du joueur (climbMovementCost)
    const path = pathTo(cliffScene({ kind: 'surface' }), foot, top, { blocked: empty, traverse: { climb: true, climbFullSpeed: true } });
    expect(path).not.toBeNull();
    expect(path![path!.length - 1]).toMatchObject({ x: 2, y: 0 });
  });

  it('requiresGrimpeur n’est pas lu par le pathing (le pathing ignore la garde du Talent joueur)', () => {
    const reach = reachable(
      cliffScene({ kind: 'surface', requiresGrimpeur: true }),
      foot, 10, { blocked: empty, traverse: { climb: true, climbFullSpeed: true } },
    );
    expect(reach.get('2,0')).toBe(1);
  });

  it('climbTraverseFor : undefined sans capability (byte-identique à l’ancien MoveEnv)', () => {
    expect(climbTraverseFor(undefined)).toBeUndefined();
    expect(climbTraverseFor([])).toBeUndefined();
    expect(climbTraverseFor([{ id: 'vol' }])).toBeUndefined();
  });

  it('climbTraverseFor : Grimpant → { climb: true, climbFullSpeed: true }', () => {
    expect(climbTraverseFor([{ id: 'grimpant' }])).toEqual({ climb: true, climbFullSpeed: true });
  });

  it('non-régression : scène sans mur climb, reachable/pathTo inchangés avec ou sans traverse', () => {
    const s = emptyScene('scene-test', 4, 4);
    const withTraverse = reachable(s, { x: 0, y: 0 }, 5, { blocked: empty, traverse: { climb: true, climbFullSpeed: true } });
    const without = reachable(s, { x: 0, y: 0 }, 5, { blocked: empty });
    expect([...withTraverse.entries()].sort()).toEqual([...without.entries()].sort());
  });
});
