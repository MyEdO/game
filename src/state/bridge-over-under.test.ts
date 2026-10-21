import { describe, it, expect } from 'vitest';
import { emptyScene, isWalkable, type Scene } from '../noyau/monde/scene';
import type { Terrain } from '../data/schemas/defs-scenes/scene';
import { pathTo, walkNeighbors } from '../noyau/monde/path';

/**
 * PONT / TABLIER — over & under. Le relief auto-connecte les surfaces : on marche SOUS un tablier (on
 * reste au sol, z0), on MONTE dessus par une RAMPE (dénivelé ≤ STEP_MAX case par case → z1), et le
 * tablier perché reste une FALAISE tant qu'aucune rampe ne le rejoint (Δhauteur > STEP_MAX = non
 * marchable à pied). Aucun escalier explicite : tout se dérive de `surfaceLink` via `pathTo`/`walkNeighbors`.
 */

/**
 * Scène 8×3. Sol (z0) plat à 0 m, marchable partout. Couche z1 : un TABLIER à 4 m au-dessus du sol
 * ((2,1),(3,1)), une RAMPE descendante à l'est (h 3→2→1 en (4,1),(5,1),(6,1)) qui rejoint le sol, et
 * un tablier ISOLÉ perché à 5 m ((0,0)) SANS rampe.
 */
function bridgeScene(): Scene {
  const s = emptyScene('scene-test', 8, 3); // z0 : herbe, hauteur 0 partout
  const w = 8;
  const tiles = new Array(w * 3).fill('vide') as Terrain[];
  const height = new Array(w * 3).fill(0) as number[];
  const put = (x: number, y: number, h: number) => { tiles[y * w + x] = 'plancher'; height[y * w + x] = h; };
  put(2, 1, 4); put(3, 1, 4);        // tablier (au-dessus du sol)
  put(4, 1, 3); put(5, 1, 2); put(6, 1, 1); // rampe descendante vers le sol (est)
  put(0, 0, 5);                       // tablier isolé perché, sans rampe
  s.layers.push({ z: 1, tiles, height });
  return s;
}

const NO_BLOCK = { blocked: new Set<string>() };

describe('bridge — marcher SOUS le tablier reste au sol (z0)', () => {
  it('le chemin sol→sol passe SOUS les cases du tablier sans jamais monter (tout z=0)', () => {
    const s = bridgeScene();
    const path = pathTo(s, { x: 0, y: 1, z: 0 }, { x: 3, y: 1, z: 0 }, NO_BLOCK);
    expect(path).not.toBeNull();
    expect(path!.every((p) => (p.z ?? 0) === 0)).toBe(true); // jamais happé par le tablier à 4 m
    expect(path!.some((p) => p.x === 2 && p.y === 1 && (p.z ?? 0) === 0)).toBe(true); // bien SOUS le tablier (2,1)
  });
});

describe('bridge — monter la RAMPE mène sur le tablier (z1)', () => {
  it('le chemin sol→tablier grimpe la rampe et arrive à z1', () => {
    const s = bridgeScene();
    const path = pathTo(s, { x: 7, y: 1, z: 0 }, { x: 2, y: 1, z: 1 }, NO_BLOCK);
    expect(path).not.toBeNull();
    expect(path![0]).toEqual({ x: 7, y: 1 }); // départ au sol (z omis)
    expect(path![path!.length - 1]).toEqual({ x: 2, y: 1, z: 1 }); // arrivée sur le tablier
    expect(path!.some((p) => (p.z ?? 0) === 1)).toBe(true); // a bien basculé sur la couche haute
  });
});

describe('bridge — le tablier est une FALAISE depuis le sol qu’il surplombe', () => {
  it('walkNeighbors NE relie PAS le sol au tablier 4 m au-dessus (Δh > STEP_MAX), mais relie le sol sous lui', () => {
    const s = bridgeScene();
    const ns = walkNeighbors(s, { x: 2, y: 2, z: 0 }); // case de sol juste au sud de la pile du tablier
    const key = (p: { x: number; y: number; z?: number }) => `${p.x},${p.y},${p.z ?? 0}`;
    const keys = new Set(ns.map(key));
    expect(keys.has('2,1,1')).toBe(false); // pas de saut vertical sur le tablier (falaise)
    expect(keys.has('2,1,0')).toBe(true);  // mais le sol sous le tablier est bien voisin
  });

  it('un tablier ISOLÉ perché (aucune rampe) est INATTEIGNABLE à pied depuis le sol', () => {
    const s = bridgeScene();
    expect(isWalkable(s, 0, 0, 1)).toBe(true); // la surface existe (plancher)…
    expect(pathTo(s, { x: 4, y: 2, z: 0 }, { x: 0, y: 0, z: 1 }, NO_BLOCK)).toBeNull(); // …mais aucun chemin à pied
  });
});
