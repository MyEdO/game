import { describe, it, expect } from 'vitest';
import { garanti } from '../lib/garanti';
import { buildScene } from './mapSpec';
import { PLAN_DE_LA_CARAQUE } from './planDeLaCaraque';
import { reachedFloors, unreachableDescriptiveZones, zoneWalkableCells } from './mapQC';
import { heightAt, isDescriptiveZone, isWalkable, tileAt } from './monde/scene';
import { estAbsent } from './monde/terrain';
import { reachable } from './monde/path';
import { planClimb } from './monde/climbMove';

const scene = buildScene(PLAN_DE_LA_CARAQUE);
const legende = garanti(PLAN_DE_LA_CARAQUE.zoneLegend, 'caraque', 'pièces du plan');
const calques = garanti(PLAN_DE_LA_CARAQUE.zoneMap, 'caraque', 'calque des pièces');

/** La première case marchable de la pièce `id`. */
const caseDe = (id: string) => zoneWalkableCells(scene, garanti(scene.effectZones?.find((zo) => zo.id === id), id, 'pièce'))[0];

describe('ponts de la caraque (MDG p.99), compilés par buildScene', () => {
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

describe('la caraque posée dans une scène (poserLeNavire)', () => {
  const bassin = (cap: 'N' | 'E' | 'S' | 'O') =>
    buildScene({ id: 'bassin', label: 'Bassin', size: [24, 24], terrain: 'eau', navires: [{ ref: 'caraque', id: 'c1', x: 3, y: 2, cap, hauteur: 1 }] });

  it('au cap O, ses ponts se posent tels quels, décalés de la pose', () => {
    const s = bassin('O');
    for (const z of [0, 1, 2, 3])
      for (let y = 0; y < 5; y++)
        for (let x = 0; x < 18; x++)
          if (!estAbsent(tileAt(scene, x, y, z))) expect(heightAt(s, 3 + x, 2 + y, z), `${x},${y},${z}`).toBe(heightAt(scene, x, y, z) + 1);
    expect(tileAt(s, 0, 0, 0)).toBe('eau');
  });

  it('au cap N, la proue au nord et tribord à l’est ; ses pièces prennent l’id de la pose', () => {
    const s = bassin('N');
    // la case de cale (8, 2) du plan, au centre : x = 3 + (5 - 1 - 2), y = 2 + 8
    expect(heightAt(s, 5, 10, 0)).toBe(-1);
    // l'infirmerie, à tribord de la cale (y = 0..1 du plan), passe à l'est (x = 3 + 3..4)
    const infirmerie = garanti(s.effectZones?.find((z) => z.id === 'c1-infirmerie'), 'c1-infirmerie', 'pièce posée');
    expect(new Set(infirmerie.tiles!.map((t) => t.x))).toEqual(new Set([6, 7]));
  });

  it('à tout cap, les échelles mènent encore de la cale à la plage arrière', () => {
    for (const cap of ['N', 'E', 'S', 'O'] as const) {
      const s = bassin(cap);
      const piece = (id: string) => zoneWalkableCells(s, garanti(s.effectZones?.find((zo) => zo.id === id), id, 'pièce'))[0];
      const haut = piece('c1-plage-arriere');
      const atteint = reachable(s, piece('c1-cale'), 400, { blocked: new Set(), traverse: { climb: true, climbFullSpeed: true } });
      expect([...atteint.keys()], cap).toContain(`${haut.x},${haut.y},${haut.z}`);
    }
  });
});
