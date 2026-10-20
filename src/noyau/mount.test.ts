import { describe, it, expect } from 'vitest';
import { canMount, mountUp, dismount, handleMountDeath, isRider, isMount, mountOf, riderOf } from './mount';
import { occupiesTile, footprintN } from './monde/footprint';
import type { BattleState } from './etat';
import type { Scene } from './monde/scene';
import type { Combatant } from '../engine/types';
import type { SizeCategory } from '../engine/size';

const mk = (id: string, x: number, y: number, size?: SizeCategory): Combatant =>
  ({ id, name: id, pos: { x, y }, size, wounds: { current: 10, max: 10, base: 10 }, conditions: [] }) as unknown as Combatant;
const battle = (cs: Combatant[]): BattleState => ({ combatants: cs }) as unknown as BattleState;
const flatScene = (w: number, h: number): Scene =>
  ({ id: 's', name: 's', dimensions: { w, h }, ambiance: 'jour', layers: [{ z: 0, tiles: new Array(w * h).fill('herbe') }], entities: [], dialogues: [], triggers: [], encounters: [] }) as unknown as Scene;
/** Scène à 2 couches (sol z0 + chemin de ronde z1), les deux praticables — pour les cas z-aware (#802). */
const rampartScene = (w: number, h: number): Scene =>
  ({
    id: 's', name: 's', dimensions: { w, h }, ambiance: 'jour',
    layers: [
      { z: 0, tiles: new Array(w * h).fill('herbe') },
      { z: 1, tiles: new Array(w * h).fill('pierre') },
    ],
    entities: [], dialogues: [], triggers: [], encounters: [],
  }) as unknown as Scene;

describe('mount — combat monté (LDB 14 l.175-187)', () => {
  it('canMount : cavalier à pied adjacent à une monture libre (et pas sinon)', () => {
    const horse = mk('h', 5, 5, 'grande'); // 2×2 (5..6 × 5..6)
    const knight = mk('k', 7, 6); // colle au bord est
    expect(canMount(battle([horse, knight]), knight, horse)).toBe(true);
    const far = mk('f', 10, 10);
    expect(canMount(battle([horse, far]), far, horse)).toBe(false); // trop loin
  });

  it('mountUp : appaire + le cavalier partage la position de la monture', () => {
    const horse = mk('h', 5, 5, 'grande');
    const knight = mk('k', 7, 6);
    mountUp(knight, horse);
    expect(isRider(knight)).toBe(true);
    expect(isMount(horse)).toBe(true);
    expect(knight.pos).toEqual({ x: 5, y: 5 }); // monte SUR la monture
    const b = battle([horse, knight]);
    expect(mountOf(b, knight)).toBe(horse);
    expect(riderOf(b, horse)).toBe(knight);
    expect(canMount(b, knight, horse)).toBe(false); // déjà monté
  });

  it('dismount : défait l’appairage + cavalier à pied sur une case libre HORS empreinte', () => {
    const horse = mk('h', 5, 5, 'grande');
    const knight = mk('k', 7, 6);
    mountUp(knight, horse);
    dismount(battle([horse, knight]), flatScene(12, 12), knight);
    expect(knight.mountId).toBeUndefined();
    expect(horse.riderId).toBeUndefined();
    expect(occupiesTile(horse.pos!, footprintN(horse), knight.pos!.x, knight.pos!.y)).toBe(false);
  });

  it('handleMountDeath : à la mort de la monture, le cavalier est DÉMONTÉ (à pied, strict RAW)', () => {
    const horse = mk('h', 5, 5, 'grande');
    const knight = mk('k', 7, 6);
    mountUp(knight, horse);
    const r = handleMountDeath(battle([horse, knight]), flatScene(12, 12), horse);
    expect(r).toBe(knight);
    expect(knight.mountId).toBeUndefined();
    expect(horse.riderId).toBeUndefined();
    expect(occupiesTile(horse.pos!, footprintN(horse), knight.pos!.x, knight.pos!.y)).toBe(false); // dégagé de la monture
  });

  it('dismount sur un chemin de ronde (z1) : le cavalier retombe sur z1, pas au sol (#802)', () => {
    const horse = mk('h', 5, 5, 'grande');
    horse.pos = { x: 5, y: 5, z: 1 };
    const knight = mk('k', 7, 6);
    knight.pos = { x: 7, y: 6, z: 1 };
    mountUp(knight, horse);
    dismount(battle([horse, knight]), rampartScene(12, 12), knight);
    expect(knight.mountId).toBeUndefined();
    expect(knight.pos!.z).toBe(1);
  });

  it('handleMountDeath sur un chemin de ronde (z1) : le cavalier démonté reste sur z1 (#802)', () => {
    const horse = mk('h', 5, 5, 'grande');
    horse.pos = { x: 5, y: 5, z: 1 };
    const knight = mk('k', 7, 6);
    knight.pos = { x: 7, y: 6, z: 1 };
    mountUp(knight, horse);
    const r = handleMountDeath(battle([horse, knight]), rampartScene(12, 12), horse);
    expect(r).toBe(knight);
    expect(knight.pos!.z).toBe(1);
  });
});
