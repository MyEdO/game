import { describe, it, expect } from 'vitest';
import { combatantsWithinRadius, occupied, findFreeTile } from './combatGeometry';
import { emptyScene, type Terrain } from './scene';
import type { BattleState } from '../../state/store';
import { mk, battle } from '../../state/pionsEtages.testkit';

/**
 * Fixes z-blind #798 (combatantsWithinRadius) / #799 (occupied — bloqueurs + barrières) / #802
 * (findFreeTile) : deux combattants/barrières superposés à même (x,y) sur des étages différents
 * doivent rester SÉPARÉS par tout ce module.
 */

describe('combatantsWithinRadius — défaut Z-AWARE (#798)', () => {
  it('un combattant au même (x,y) mais à un autre étage que le centre est HORS rayon', () => {
    const upper = mk('u', 5, 5, 1);
    const sameFloor = mk('s', 5, 5);
    const found = combatantsWithinRadius({ x: 5, y: 5 }, 3, [upper, sameFloor]);
    expect(found.map((c) => c.id)).toEqual(['s']);
  });

  it('un centre lui-même posé en étage (z fourni) ne compte que son étage', () => {
    const upper = mk('u', 5, 5, 1);
    const ground = mk('g', 5, 5);
    const found = combatantsWithinRadius({ x: 5, y: 5, z: 1 }, 3, [upper, ground]);
    expect(found.map((c) => c.id)).toEqual(['u']);
  });
});

describe('occupied — bloqueurs ET barrières séparés par étage (#799)', () => {
  it('un bloqueur z=1 est invisible au sol, visible à son étage', () => {
    const mover = mk('m', 0, 0);
    const upper = mk('u', 5, 5, 1);
    const blocked = occupied(battle([mover, upper]), mover);
    expect(blocked.has('5,5')).toBe(false);
    expect(blocked.has('5,5,1')).toBe(true);
  });

  it('une barrière posée à z=1 ne bloque plus le sol (z=0), seulement son étage', () => {
    const mover = mk('m', 0, 0);
    const b = battle([mover], [{ label: 'mur-arcane', tiles: [{ x: 5, y: 5, z: 1 }], rounds: 1, permanent: true, barrier: {} }] as BattleState['zones']);
    const blocked = occupied(b, mover);
    expect(blocked.has('5,5')).toBe(false);
    expect(blocked.has('5,5,1')).toBe(true);
  });

  it('une barrière au sol (z omis) bloque comme avant', () => {
    const mover = mk('m', 0, 0);
    const b = battle([mover], [{ label: 'mur-arcane', tiles: [{ x: 5, y: 5 }], rounds: 1, permanent: true, barrier: {} }] as BattleState['zones']);
    expect(occupied(b, mover).has('5,5')).toBe(true);
  });
});

describe('findFreeTile — Z-AWARE, replie sur les couches supérieures (#802)', () => {
  it('sol (z=0) libre → renvoie une case SANS z (byte-identique à l’ancien comportement)', () => {
    const scene = emptyScene(3, 3); // tout 'herbe'
    expect(findFreeTile(scene)).toEqual({ x: 0, y: 0 });
  });

  it('sol totalement bloqué, étage 1 libre → replie sur l’étage 1 (z posé)', () => {
    const scene = emptyScene(3, 3);
    scene.layers[0].tiles = new Array(9).fill('mur') as Terrain[];
    scene.layers.push({ z: 1, tiles: new Array(9).fill('herbe') as Terrain[] });
    expect(findFreeTile(scene)).toEqual({ x: 0, y: 0, z: 1 });
  });
});
