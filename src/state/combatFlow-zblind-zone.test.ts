/**
 * z-blindness du placement de ZONE (#798) — deux sites `combatFlow.ts` :
 *  - `castCommitZone` (pose au CLIC d'un sort à ZdE, LDB 46/47) : `inZone` filtrait en Chebyshev 2D
 *    (`chebyshev(c.pos, pt)`) SANS comparer l'étage — une cible de même (x,y) à un autre étage que le
 *    point cliqué se retrouvait dans la zone.
 *  - `placeZoneFromOp` (zone PERSISTANTE posée par un sort, `applyCast` → `placeSpellZone`) : les cases
 *    (`discTiles`/`wallTiles`) ne portaient PAS l'étage de la cible → `zoneCovers` (qui compare
 *    `t.z ?? 0`/`p.z ?? 0`) traitait la zone comme posée au REZ, quel que soit l'étage réel de la cible.
 * Ce module verrouille les deux — même patron que `zoneAreaTiles` (`z` propagé, #782/#799).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { castCommitZone, applyCast } from '../noyau/combatFlow';
import { zoneCovers } from '../noyau/monde/zones';
import { emptyScene } from '../noyau/monde/scene';
import { pregen, PREGEN } from '../data/pregens';
import { findSpell } from '../data';
import type { Combatant } from '../engine/types';
import type { CastResult } from '../engine/magic';

const okCast = (): CastResult => ({ cast: true, roll: 11, target: 80, sl: 4, isCritical: false, isFumble: false, log: 'lancé' });

function caster(x: number, y: number, z: number, id = 'caster'): Combatant {
  const h = pregen(PREGEN.sorcier);
  h.id = id; h.label = id; h.pos = { x, y, z };
  h.wounds = { ...h.wounds, max: 99, current: 99 };
  const sk = h.skills.find((s) => s.id === 'langue');
  if (sk) sk.advances = Math.max(sk.advances, 40);
  else h.skills.push({ id: 'langue', spec: 'magick', characteristic: 'intelligence', advances: 40 } as never);
  h.spells = ['explosion', 'sang-de-la-terre', ...(h.spells ?? [])];
  return h;
}

const foe = (id: string, x: number, y: number, z: number, wounds = 40): Combatant =>
  ({ id, label: id, name: id, kind: 'enemy', pos: { x, y, z }, wounds: { current: wounds, max: wounds }, advantage: 0,
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }, conditions: [], traits: [], talents: [], skills: [], weapons: [] }) as unknown as Combatant;

describe('Placement de zone — z-blindness (#798)', () => {
  beforeEach(() => {
    vi.useFakeTimers(); vi.clearAllTimers();
    useGame.setState({ battle: null, party: [], journal: [], pendingCast: null, pendingCascade: null, pendingLogQueue: [] });
    useGame.getState().seedRng(17);
  });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  it("castCommitZone : le clic sur l'étage 1 ne touche PAS un ennemi de même (x,y) posté à l'étage 0", () => {
    const c = caster(5, 5, 1);
    const sameFloor = foe('e-same', 8, 5, 1);
    const ghost = foe('e-ghost', 8, 5, 0); // même (x,y), étage 0
    const battle = {
      combatants: [c, sameFloor, ghost], order: [c.id, 'e-same', 'e-ghost'], baseOrder: [c.id, 'e-same', 'e-ghost'],
      turn: 0, round: 1, action: 'cast', selectedSpellId: 'explosion', reachable: new Map(),
      movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null,
    } as never;
    useGame.setState({ battle, scene: undefined, party: [] });
    useGame.setState({
      pendingCast: {
        casterId: c.id, targetId: c.id, spellId: 'explosion', missile: true, focused: false,
        result: okCast() as never,
        zone: { center: null, radius: 2, r0m: 2, placing: true },
      } as never,
    });
    castCommitZone(useGame.getState, useGame.setState, { x: 8, y: 5, z: 1 });
    const get = (id: string) => useGame.getState().battle!.combatants.find((cc) => cc.id === id)!;
    expect(get('e-same').wounds.current).toBeLessThan(40); // même étage que le point cliqué → touché
    expect(get('e-ghost').wounds.current).toBe(40); // autre étage, même (x,y) -> hors de l'aire (non touché)
  });

  it("placeZoneFromOp : la zone persistante posée à l'étage de la cible ne couvre pas le même (x,y) à un autre étage", () => {
    const c = caster(5, 10, 1);
    c.pos = { x: 5, y: 10, z: 1 };
    const battle = { combatants: [c], order: [c.id], baseOrder: [c.id], turn: 0, round: 1, acted: false, log: [], over: null, zones: [] } as never;
    useGame.setState({ battle, scene: undefined, party: [] });
    const ok = okCast();
    applyCast(useGame.getState, useGame.setState, c, c, findSpell('Sang de la Terre')!, ok, false, false);
    const zone = (useGame.getState().battle!.zones ?? []).find((z) => z.label === findSpell('Sang de la Terre')!.label)!;
    expect(zone).toBeTruthy();
    expect(zone.tiles.length).toBeGreaterThan(0);
    expect(zone.tiles.some((t) => t.x === 5 && t.y === 10 && (t.z ?? 0) === 1)).toBe(true);
    expect(zoneCovers(zone, { x: 5, y: 10, z: 0 })).toBe(false); // même case, étage 0 : PAS couverte
    expect(zoneCovers(zone, { x: 5, y: 10, z: 1 })).toBe(true); // étage de la cible : couverte
  });

  // #1176 : la géométrie de pose (discTiles/wallTiles) n'est pas bornée — une zone posée au COIN
  // stockait des cases négatives dans `battle.zones`, que le builder de surbrillances émettait telles
  // quelles. L'invariant se tient au SITE D'ÉCRITURE (`clampZoneTiles`).
  it('placeZoneFromOp : une zone posée au coin ne stocke QUE des cases de la carte', () => {
    const c = caster(0, 0, 0);
    c.pos = { x: 0, y: 0 };
    const battle = { combatants: [c], order: [c.id], baseOrder: [c.id], turn: 0, round: 1, acted: false, log: [], over: null, zones: [] } as never;
    useGame.setState({ battle, scene: emptyScene(6, 6), party: [] });
    applyCast(useGame.getState, useGame.setState, c, c, findSpell('Sang de la Terre')!, okCast(), false, false);
    const zone = (useGame.getState().battle!.zones ?? []).find((z) => z.label === findSpell('Sang de la Terre')!.label)!;
    expect(zone).toBeTruthy();
    expect(zone.tiles.length).toBeGreaterThan(0);
    expect(zone.tiles.filter((t) => t.x < 0 || t.y < 0 || t.x >= 6 || t.y >= 6)).toEqual([]);
    expect(zone.tiles.some((t) => t.x === 0 && t.y === 0)).toBe(true); // le centre reste posé
  });
});
