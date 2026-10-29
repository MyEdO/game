/**
 * z-blindness des manœuvres de ZONE (Souffle/Vomi/Hurlement, #798) — `combatantsWithinRadius` (défaut
 * z-aware, cf. `combatGeometry.ts`) protège déjà `resolveManeuver` (targeting `zone`/`allFoes`, sites
 * combatManeuvers.ts:410/418/432) puisque `attacker.pos`/`center.pos` PORTENT leur `z`. Le SEUL trou
 * restant : la zone de Fumée (Souffle (Fumée)) posait ses cases via `smokeZone` SANS propager le `z` du
 * centre — une case de même (x,y) à un autre étage se retrouvait donc « couverte » (`zoneCovers` compare
 * `t.z ?? 0` à `p.z ?? 0`). Ce test verrouille la propagation.
 */
import { describe, it, beforeEach, expect } from 'vitest';
import { resolveManeuver } from './combatManeuvers';
import { zoneCovers } from './monde/zones';
import { ouvrirLeBanc, type Banc } from './banc.testkit';
import { seedBattleRng } from './battleRng';
import { findManeuverById } from '../data';
import { souffleDuType } from '../engine/creatureAttacks';
import type { Combatant } from '../engine/types';
import type { Pt } from './monde/path';

let banc: Banc;
beforeEach(() => { banc = ouvrirLeBanc(); });

const mk = (id: string, kind: 'hero' | 'enemy', x: number, y: number, z: number): Combatant =>
  ({
    id, label: id, kind, pos: { x, y, z },
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
    wounds: { current: 20, max: 20 }, advantage: 3, conditions: [], traits: [], talents: [], skills: [], weapons: [],
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
  }) as unknown as Combatant;

const miniScene = () =>
  ({ id: 's', name: 's', dimensions: { w: 40, h: 40 }, metresPerTile: 2, ambiance: 'jour',
    layers: [{ z: 0, tiles: new Array(40 * 40).fill('herbe') }, { z: 1, tiles: new Array(40 * 40).fill('herbe') }],
    entities: [], dialogues: [], triggers: [], encounters: [] });

function mountBattle(combatants: Combatant[]) {
  seedBattleRng(3);
  banc.setState({
    battle: { combatants, order: combatants.map((c) => c.id), turn: 0, round: 1, acted: false, log: [], zones: [] } as never,
    scene: miniScene() as never,
    party: [], facing: {},
  });
  const set: Parameters<typeof resolveManeuver>[1] = (p) => banc.setState(p as never);
  return { get: () => banc.getState(), set };
}

describe('resolveManeuver — zone (Souffle Fumée, z-blindness #798)', () => {
  it("la zone se pose à l'étage du centre — ne couvre PAS la même case (x,y) à un autre étage", () => {
    const attacker = mk('atk', 'hero', 3, 5, 1);
    const target = mk('tgt', 'enemy', 5, 5, 1); // centre = chosenTarget, étage 1
    const { get, set } = mountBattle([attacker, target]);
    resolveManeuver(get, set, attacker, souffleDuType(findManeuverById('souffle')!, 'fumee'), 0, null, 0, target);
    const zones = get().battle!.zones!;
    const zone = zones[zones.length - 1];
    expect(zone.tiles.length).toBeGreaterThan(0);
    expect(zone.tiles.some((t: Pt) => t.x === 5 && t.y === 5 && (t.z ?? 0) === 1)).toBe(true);
    expect(zoneCovers(zone, { x: 5, y: 5, z: 0 })).toBe(false); // étage 0 : PAS couvert
    expect(zoneCovers(zone, { x: 5, y: 5, z: 1 })).toBe(true); // étage 1 (celui du centre) : couvert
  });
  it('BE 0 : la Fumée dure 0 Round — aucune zone posée (LDB 85 l.329, #1817)', () => {
    const attacker = { ...mk('atk', 'hero', 3, 5, 0), characteristics: { ...mk('x', 'hero', 0, 0, 0).characteristics, endurance: 9 } } as Combatant;
    const target = mk('tgt', 'enemy', 5, 5, 0);
    const { get, set } = mountBattle([attacker, target]);
    resolveManeuver(get, set, attacker, souffleDuType(findManeuverById('souffle')!, 'fumee'), 0, null, 0, target);
    expect(get().battle!.zones).toEqual([]);
  });
});
