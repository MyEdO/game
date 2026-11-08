import { describe, it, expect } from 'vitest';
import { garanti } from '../lib/garanti';
import { buildScene } from './mapSpec';
import { PLAN_DE_LA_CARAQUE } from './planDeLaCaraque';
import { reachedFloors, unreachableDescriptiveZones, zoneWalkableCells } from './mapQC';
import { heightAt, isDescriptiveZone, isWalkable } from './monde/scene';
import { reachable } from './monde/path';
import { planClimb } from './monde/climbMove';

const scene = buildScene(PLAN_DE_LA_CARAQUE);
const legende = garanti(PLAN_DE_LA_CARAQUE.zoneLegend, 'caraque', 'pièces du plan');
const calques = garanti(PLAN_DE_LA_CARAQUE.zoneMap, 'caraque', 'calque des pièces');

/** La première case marchable de la pièce `id`. */
const caseDe = (id: string) => zoneWalkableCells(scene, garanti(scene.effectZones?.find((zo) => zo.id === id), id, 'pièce'))[0];

describe('ponts de la caraque (MDG 12 l.286), compilés par buildScene', () => {
  it('un étage par pont, de la cale à la plage arrière, chacun à sa hauteur', () => {
    expect(scene.layers.map((l) => l.z)).toEqual([0, 1, 2, 3]);
    expect([0, 1, 2, 3].map((z) => heightAt(scene, 8, 2, z))).toEqual([-2, 0, 1.95, 5.6]);
    expect(heightAt(scene, 12, 2, 3)).toBe(5.85);
  });

  it('chaque pièce de la légende des plans est une zone, sous son nom', () => {
    const zones = (scene.effectZones ?? []).filter(isDescriptiveZone);
    expect(zones.map((z) => z.label).sort()).toEqual(Object.values(legende).map((p) => p.label).sort());
  });

  it('à pied, chaque pont dessert toutes ses pièces, et aucune échelle ne se gravit sans geste', () => {
    Object.entries(calques).forEach(([etage, rangees]) => {
      const z = Number(etage.slice(1));
      const premiere = garanti([...([] as string[]).concat(rangees).join('')].find((ch) => ch in legende), etage, 'pièce du pont');
      const depart = caseDe(garanti(legende[premiere].id, premiere, 'id de pièce'));
      expect(unreachableDescriptiveZones(scene, depart).filter((zo) => (zo.z ?? 0) === z).map((zo) => zo.id), etage).toEqual([]);
      expect(Math.max(...reachedFloors(scene, depart)), etage).toBeLessThanOrEqual(z);
    });
  });

  it('par les échelles de trappe, la cale dessert chaque case du navire jusqu’à la plage arrière', () => {
    const depart = caseDe('cale');
    const atteint = new Set([...reachable(scene, depart, 400, { blocked: new Set(), traverse: { climb: true, climbFullSpeed: true } }).keys()]
      .map((k) => (k.split(',').length === 2 ? `${k},0` : k)));
    atteint.add(`${depart.x},${depart.y},${depart.z}`);
    const isolees = scene.layers.flatMap(({ z }) => Array.from({ length: 18 * 5 }, (_, i) => ({ x: i % 18, y: Math.floor(i / 18), z })))
      .filter((c) => isWalkable(scene, c.x, c.y, c.z) && !atteint.has(`${c.x},${c.y},${c.z}`));
    expect(isolees).toEqual([]);
  });

  it('une échelle se gravit sans Test (LDB 15 l.55)', () => {
    for (const e of PLAN_DE_LA_CARAQUE.walls ?? []) {
      const z = e.z ?? 0;
      const vers = { x: e.x + (e.side === 'E' ? 1 : e.side === 'O' ? -1 : 0), y: e.y + (e.side === 'S' ? 1 : e.side === 'N' ? -1 : 0), z };
      expect(planClimb(scene, { x: e.x, y: e.y, z }, vers, false), `z${z} (${e.x},${e.y})`).toEqual({ kind: 'free' });
    }
  });
});
