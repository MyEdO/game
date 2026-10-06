import { describe, it, expect } from 'vitest';
import { emptyScene, type Scene, type Terrain } from './scene';
import { pathTo, reachable, walkNeighbors, tileKey, tileFromKey } from './path';

/**
 * Pathfinding VERTICAL auto-dérivé du RELIEF (plus d'escaliers explicites) : la traversée d'une couche
 * à l'autre passe par `surfaceLink` — une RAMPE (marches ≤ STEP_MAX) relie le sol au tablier z1 ; une
 * FALAISE (Δhauteur > STEP_MAX) le coupe. Et le comportement à z=0 reste byte-identique (clés « x,y »
 * sans suffixe z).
 */

/**
 * Scène 4×4 : sol z0 plat (herbe, 0 m). Couche z1 = tablier (plancher) sur la moitié droite, à 4 m.
 * Si `withRamp`, une colonne de sol z0 monte en marches de 1 m (0→1→2→3) jusqu'à toucher le tablier
 * à 4 m (dernière marche à 3 m ↔ tablier à 4 m = ramp). Sinon le tablier reste une falaise (4 m d'un coup).
 */
function twoLayer(withRamp: boolean): Scene {
  const s = emptyScene(4, 4);
  const w = 4;
  const z1 = new Array(w * 4).fill('vide') as Terrain[];
  const h1 = new Array(w * 4).fill(0) as number[];
  for (let y = 0; y < 4; y++) for (const x of [2, 3]) { z1[y * w + x] = 'plancher'; h1[y * w + x] = 4; } // tablier à 4 m
  s.layers.push({ z: 1, tiles: z1, height: h1 });
  if (withRamp) {
    // Colonne x=1 sur le SOL : marches montantes 0→3 m, la dernière (à 3 m) jouxte le tablier z1 (4 m).
    s.layers[0].height = new Array(w * 4).fill(0) as number[];
    s.layers[0].height![0 * w + 1] = 1;
    s.layers[0].height![1 * w + 1] = 2;
    s.layers[0].height![2 * w + 1] = 3;
  }
  return s;
}

describe('path — traversée verticale par RAMPE (surfaceLink)', () => {
  const empty = new Set<string>();

  it('pathTo grimpe la rampe et atteint le tablier z1', () => {
    const path = pathTo(twoLayer(true), { x: 0, y: 2, z: 0 }, { x: 2, y: 2, z: 1 }, { blocked: empty });
    expect(path).not.toBeNull();
    expect(path![path!.length - 1]).toEqual({ x: 2, y: 2, z: 1 });
    expect(path!.some((p) => (p.z ?? 0) === 0)).toBe(true); // part du sol
    expect(path!.some((p) => (p.z ?? 0) === 1)).toBe(true); // bascule sur le tablier
  });

  it('sans rampe (falaise de 4 m), le tablier est INATTEIGNABLE depuis le sol', () => {
    expect(pathTo(twoLayer(false), { x: 0, y: 2, z: 0 }, { x: 2, y: 2, z: 1 }, { blocked: empty })).toBeNull();
  });

  it('reachable inclut les cases du tablier via la rampe (clé z-aware « x,y,z »)', () => {
    const reach = reachable(twoLayer(true), { x: 0, y: 2, z: 0 }, 20, { blocked: empty });
    expect(reach.has('2,2,1')).toBe(true); // le tablier atteint par la rampe
    expect(reach.has('3,3,1')).toBe(true);
  });

  it('sans rampe, reachable n’inclut AUCUNE case de tablier', () => {
    const reach = reachable(twoLayer(false), { x: 0, y: 2, z: 0 }, 20, { blocked: empty });
    expect(reach.has('2,2,1')).toBe(false); // le tablier reste inatteignable
    expect([...reach.keys()].every((k) => k.split(',').length === 2)).toBe(true); // aucune clé « x,y,z » d'étage
  });
});

describe('path — non-régression à z=0 (clés « x,y » sans suffixe)', () => {
  it('reachable garde les clés 2D pour une scène mono-couche', () => {
    const reach = reachable(emptyScene(4, 4), { x: 0, y: 0 }, 10, { blocked: new Set<string>() });
    expect(reach.has('3,3')).toBe(true); // atteignable (Manhattan 6 ≤ 10)
    expect([...reach.keys()].every((k) => k.split(',').length === 2)).toBe(true); // jamais « x,y,0 »
  });

  it('pathTo rend un chemin 2D au sol', () => {
    const path = pathTo(emptyScene(4, 4), { x: 0, y: 0 }, { x: 3, y: 0 }, { blocked: new Set<string>() });
    expect(path).not.toBeNull();
    expect(path!.map((p) => p.x)).toEqual([0, 1, 2, 3]);
    expect(path!.every((p) => (p.z ?? 0) === 0)).toBe(true);
  });
});

/**
 * UN MUR N'ARRÊTE LE PAS QU'À LA HAUTEUR OÙ ON LE FRANCHIT (#1780). Le pas inter-couches se juge sur
 * l'arête de la couche la PLUS HAUTE : celle du dessous passe sous les pieds. Sans cette règle, une
 * rampe qui atteint la cote de l'étage bute sur la cloison du rez qu'elle SURVOLE — affordance morte.
 */
describe('path — un pas qui change de couche ne voit que l’arête de la couche SUPÉRIEURE', () => {
  const empty = new Set<string>();
  /** Rampe de `twoLayer`, plus un mur sur l'arête entre (1,2) et (2,2) — la marche haute et le tablier. */
  const avecMur = (z: number): Scene => {
    const s = twoLayer(true);
    s.walls = [{ x: 1, y: 2, side: 'E', ...(z ? { z } : {}) }];
    return s;
  };

  it('la cloison du REZ sous la rampe laisse passer : la rampe l’enjambe', () => {
    const path = pathTo(avecMur(0), { x: 0, y: 2, z: 0 }, { x: 2, y: 2, z: 1 }, { blocked: empty });
    expect(path).not.toBeNull();
  });

  it('CONTRE-ÉPREUVE : la même arête murée à l’ÉTAGE barre le pas, dans les deux sens', () => {
    expect(pathTo(avecMur(1), { x: 1, y: 2, z: 0 }, { x: 2, y: 2, z: 1 }, { blocked: empty })).toBeNull();
    expect(pathTo(avecMur(1), { x: 2, y: 2, z: 1 }, { x: 1, y: 2, z: 0 }, { blocked: empty })).toBeNull();
  });

  it('le pas à PLAT reste barré par l’arête de sa propre couche (la règle ne perce rien d’horizontal)', () => {
    const s = avecMur(0);
    expect(pathTo(s, { x: 1, y: 3, z: 0 }, { x: 2, y: 3, z: 0 }, { blocked: empty })).not.toBeNull(); // pas de mur en y3
    expect(walkNeighbors(s, { x: 1, y: 2, z: 0 }).some((n) => n.x === 2 && n.y === 2 && (n.z ?? 0) === 0)).toBe(false);
  });
});

describe('path — tileFromKey, réciproque de tileKey', () => {
  it('« x,y » rend la case au sol, sans z (convention de `Pt`)', () => {
    expect(tileFromKey('3,4')).toEqual({ x: 3, y: 4 });
    expect('z' in tileFromKey('3,4')).toBe(false);
  });

  it('« x,y,z » rend la case de l’étage, z compris', () => {
    expect(tileFromKey('3,4,1')).toEqual({ x: 3, y: 4, z: 1 });
  });

  it('aller-retour : chaque clé de `reachable` à l’étage redonne sa case', () => {
    const reach = reachable(twoLayer(true), { x: 0, y: 2, z: 0 }, 20, { blocked: new Set<string>() });
    for (const k of reach.keys()) {
      const t = tileFromKey(k);
      expect(tileKey(t.x, t.y, t.z ?? 0)).toBe(k);
    }
    expect(tileFromKey('2,2,1').z).toBe(1);
    expect(reach.has('2,2,1')).toBe(true);
  });
});
