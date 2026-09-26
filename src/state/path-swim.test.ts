import { describe, it, expect } from 'vitest';
import { reachable, pathTo } from './path';
import { moveEnv } from './combatFlow';
import type { Scene } from './scene';
import type { BattleState } from './store';
import type { Combatant } from '../engine/types';

/**
 * Traversée aquatique (MSRC 15 l.139 / MDG 16 l.17 / LDB 85 l.21) : une créature à terrain d'élection `eau`
 * (op passive `offTerrainMod` → `requiredTerrains`) TRAVERSE l'eau bien qu'elle soit `walkable:false`
 * pour tous les autres. Le pathing lit `MoveEnv.swim` ; `moveEnv(battle, mover)` le dérive du mover.
 * Sans le trait, l'eau reste un mur — et `swim` ne débloque QUE l'eau, pas les autres non-marchables.
 */
const river = (): Scene => ({
  id: 's', label: 'Gué', dimensions: { w: 3, h: 1 },
  layers: [{ z: 0, tiles: ['sol', 'eau', 'sol'] }],
  entities: [], dialogues: [], triggers: [],
} as unknown as Scene);

const EAU = new Set(['eau']);
const NO = { blocked: new Set<string>() };
const SWIM = { blocked: new Set<string>(), swim: EAU };

const mk = (traits: { id: string }[]): Combatant => ({
  id: 'm', name: 'Bête', kind: 'enemy', pos: { x: 0, y: 0 },
  characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 0, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
  movement: 6, wounds: { current: 20, max: 20, base: 20 }, weapons: [], skills: [], talents: [],
  traits, conditions: [],
} as unknown as Combatant);

describe('path — traversée aquatique (MoveEnv.swim)', () => {
  it('sans swim, l’eau bloque : (0,0) n’atteint pas la rive opposée à travers le gué', () => {
    const d = reachable(river(), { x: 0, y: 0 }, 3, NO);
    expect(d.has('1,0')).toBe(false); // la case d'eau
    expect(d.has('2,0')).toBe(false); // la rive opposée, derrière l'eau
    expect(pathTo(river(), { x: 0, y: 0 }, { x: 2, y: 0 }, NO)).toBeNull();
  });

  it('avec swim={eau}, l’eau est traversable : la rive opposée devient atteignable', () => {
    const d = reachable(river(), { x: 0, y: 0 }, 3, SWIM);
    expect(d.get('1,0')).toBe(1); // entre dans l'eau
    expect(d.get('2,0')).toBe(2); // ressort sur l'autre rive
    const p = pathTo(river(), { x: 0, y: 0 }, { x: 2, y: 0 }, SWIM);
    expect(p?.map((q) => q.x)).toEqual([0, 1, 2]);
  });

  it('swim ne débloque QUE ses terrains : le vide reste infranchissable', () => {
    const s = { ...river(), layers: [{ z: 0, tiles: ['sol', 'vide', 'sol'] }] } as unknown as Scene;
    const d = reachable(s, { x: 0, y: 0 }, 3, SWIM); // swim={eau} n'ouvre pas 'vide'
    expect(d.has('2,0')).toBe(false);
  });
});

describe('moveEnv — dérive swim du mover (requiredTerrains)', () => {
  const battle = (c: Combatant): BattleState => ({ combatants: [c] } as unknown as BattleState);

  it('un mover Aquatique reçoit swim={eau}', () => {
    const env = moveEnv(battle(mk([{ id: 'aquatique' }])), mk([{ id: 'aquatique' }]));
    expect(env.swim && [...env.swim]).toEqual(['eau']);
  });

  it('un mover Amphibie reçoit swim={eau} (élection sans malus)', () => {
    const env = moveEnv(battle(mk([{ id: 'amphibie' }])), mk([{ id: 'amphibie' }]));
    expect(env.swim && [...env.swim]).toEqual(['eau']);
  });

  it('un mover terrestre n’a pas de swim', () => {
    const env = moveEnv(battle(mk([{ id: 'coriace' }])), mk([{ id: 'coriace' }]));
    expect(env.swim).toBeUndefined();
  });
});
