import { describe, it, expect } from 'vitest';
import { pushAway } from './path';
import type { Scene } from './scene';

/**
 * Jalon 2.6 — géométrie des déplacements forcés : Poussée (LDB 47 l.479 « repoussées de BFM
 * mètres », recul en ligne jusqu'à l'obstacle) ; la Téléportation réutilise flyReachable
 * (déjà testé) + le mode 'teleport' de battleClickTile.
 */
const scene = (w: number, h: number, walls: string[] = []): Scene => {
  const tiles = new Array(w * h).fill('herbe');
  for (const k of walls) {
    const [x, y] = k.split(',').map(Number);
    tiles[y * w + x] = 'mur';
  }
  return {
    id: 's', name: 's', dimensions: { w, h }, ambiance: 'jour',
    layers: [{ z: 0, tiles }], entities: [], dialogues: [], triggers: [], encounters: [],
  } as unknown as Scene;
};

describe('pushAway — recul en ligne (Poussée)', () => {
  it('repousse de N cases dans la direction opposée au lanceur', () => {
    const s = scene(10, 10);
    const r = pushAway(s, { x: 2, y: 5 }, { x: 4, y: 5 }, 2, { blocked: new Set() });
    expect(r).toEqual({ dest: { x: 6, y: 5 }, pushed: 2, collided: false });
  });

  it('diagonale : le recul suit le signe de dx/dy', () => {
    const s = scene(10, 10);
    const r = pushAway(s, { x: 2, y: 2 }, { x: 3, y: 3 }, 2, { blocked: new Set() });
    expect(r.dest).toEqual({ x: 5, y: 5 });
  });

  it('s’arrête devant un mur (collision signalée — Dégâts = distance restante, MJ)', () => {
    const s = scene(10, 10, ['6,5']);
    const r = pushAway(s, { x: 2, y: 5 }, { x: 4, y: 5 }, 3, { blocked: new Set() });
    expect(r).toEqual({ dest: { x: 5, y: 5 }, pushed: 1, collided: true });
  });

  it('s’arrête devant un occupant ; cible au contact du lanceur sans direction → immobile', () => {
    const s = scene(10, 10);
    const r = pushAway(s, { x: 2, y: 5 }, { x: 4, y: 5 }, 3, { blocked: new Set(['5,5']) });
    expect(r).toEqual({ dest: { x: 4, y: 5 }, pushed: 0, collided: true });
    const same = pushAway(s, { x: 4, y: 5 }, { x: 4, y: 5 }, 3, { blocked: new Set() });
    expect(same.pushed).toBe(0); // superposé : pas de direction → pas de recul (cas dégénéré sûr)
  });
});
