import { describe, it, expect } from 'vitest';
import { pushBackTiles, displaceSmaller } from './combatPlacement';
import { emptyScene, type Scene, type Terrain } from './monde/scene';
import type { Jeu } from './etat';
import type { Get } from './flowTypes';
import { mk, battle } from '../state/pionsEtages.testkit';

/**
 * Fixes z-blind #802 (pushBackTiles/displaceSmaller/nearestFreeOutside) : deux combattants superposés
 * à même (x,y) sur des étages différents doivent rester SÉPARÉS par les gestes de placement.
 */

describe('pushBackTiles — la poussée glisse sur SON étage (#802)', () => {
  function twoLayerScene(): Scene {
    const s = emptyScene(10, 10); // z0 : tout 'herbe' (marchable)
    const z1 = new Array(10 * 10).fill('herbe') as Terrain[];
    z1[5 * 10 + 6] = 'mur'; // (6,5) infranchissable à l'étage 1
    s.layers.push({ z: 1, tiles: z1 });
    return s;
  }

  it('un mur à l’étage de la cible bloque la poussée même si le SOL (z=0) y est libre', () => {
    const scene = twoLayerScene();
    const attacker = mk('a', 4, 5);
    const target = mk('t', 5, 5, 1); // à l'étage 1
    const get: Get = () => ({ scene, battle: battle([attacker, target]) }) as unknown as Jeu;
    const moved = pushBackTiles(get, attacker, target, 1);
    expect(moved).toBe(0);
    expect(target.pos).toEqual({ x: 5, y: 5, z: 1 }); // reste sur place, reste à z=1
  });

  it('même géométrie mais cible au sol (z=0) : le mur de l’étage 1 ne la concerne pas, elle glisse', () => {
    const scene = twoLayerScene();
    const attacker = mk('a', 4, 5);
    const target = mk('t', 5, 5); // sol
    const get: Get = () => ({ scene, battle: battle([attacker, target]) }) as unknown as Jeu;
    const moved = pushBackTiles(get, attacker, target, 1);
    expect(moved).toBe(1);
    expect(target.pos).toEqual({ x: 6, y: 5 });
  });
});

describe('displaceSmaller — ne dégage que sur SON étage (#802)', () => {
  it('un plus petit au même (x,y) mais à un AUTRE étage n’est PAS déplacé ; celui du MÊME étage l’est', () => {
    const scene = emptyScene(10, 10);
    const mover = mk('m', 5, 5, undefined, { size: 'grande' }); // empreinte 2×2 au sol
    const sameFloor = mk('s', 5, 5, undefined, { size: 'petite' });
    const upperFloor = mk('u', 5, 5, 1, { size: 'petite' });
    const b = battle([sameFloor, upperFloor]);
    const get: Get = () => ({ scene, battle: b }) as unknown as Jeu;

    const moved = displaceSmaller(get, mover);

    expect(moved).toBe(true);
    expect(upperFloor.pos).toEqual({ x: 5, y: 5, z: 1 }); // intact : autre étage, hors d'atteinte
    expect(sameFloor.pos).not.toEqual({ x: 5, y: 5 }); // dégagé de sous l'empreinte du mover
  });
});
