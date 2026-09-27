import { describe, it, expect } from 'vitest';
import { useGame, type BattleState } from './store';
import { maybeOpenDefense } from './combatFlow';
import { seedBattleRng } from './battleRng';
import { testScene } from '../scenes/test-fixture';
import type { Combatant, Weapon } from '../engine/types';

// T3 — ennemi qui TIRE sur un héros : la modale de défense (pendingDefense) s'ouvre UNIQUEMENT si le
// RAW autorise une défense contre le tir (Protectrice 2+/Bout Portant/tireur Engagé), sinon résolution
// simple (false). Arc portée 60 m → Bout Portant si dist×2 ≤ 6, soit ≤ 3 tuiles.
const chars = { 'capacite-de-combat': 35, 'capacite-de-tir': 50, force: 35, endurance: 35, initiative: 30, agilite: 40, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 };
const mk = (id: string, kind: 'hero' | 'enemy', pos: { x: number; y: number }, weapons: Weapon[]): Combatant =>
  ({ id, name: id, kind, characteristics: chars, conditions: [], engagedWith: [], skills: [], talents: [],
     weapons, advantage: 0, size: 'moyenne', pos, wounds: { current: 18, max: 18 },
     armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }, movement: 4 } as unknown as Combatant);
const bow: Weapon = { name: 'Arc', type: 'ranged', damage: { plusBF: false, flat: 4 }, range: 60, qualities: [] } as unknown as Weapon;
const sword: Weapon = { name: 'Épée', type: 'melee', damage: { plusBF: true, flat: 0, bare: true }, uid: 'sw', qualities: [] } as unknown as Weapon;
const shield: Weapon = { name: 'Bouclier', type: 'melee', damage: { plusBF: true, flat: 0, bare: true }, uid: 'sh', qualities: [{ id: 'protectrice', value: 2 }] } as unknown as Weapon;

function setup(heroWeapons: Weapon[], enemyPos: { x: number; y: number }) {
  seedBattleRng(7);
  const enemy = mk('e', 'enemy', enemyPos, [bow]);
  const hero = mk('h', 'hero', { x: 0, y: 0 }, heroWeapons);
  const battle: BattleState = {
    combatants: [enemy, hero], order: [enemy.id, hero.id], baseOrder: [enemy.id, hero.id],
    turn: 0, round: 1, action: null, selectedSpellId: null, reachable: new Map(),
    movementUsed: 0, movedPreAction: false, acted: false, log: [], over: null,
  };
  useGame.setState({ battle, mode: 'battle', scene: testScene(), pendingDefense: null });
  return { enemy, hero };
}

describe('maybeOpenDefense — tir sur un héros (T3)', () => {
  it('héros à bouclier Protectrice 2+, tir à distance moyenne → modale (Parade, arme = bouclier)', () => {
    const { enemy, hero } = setup([sword, shield], { x: 10, y: 0 }); // 10 tuiles : pas bout portant
    expect(maybeOpenDefense(useGame.getState, useGame.setState, enemy, hero)).toBe(true);
    const pd = useGame.getState().pendingDefense!;
    expect(pd.weapon.type).toBe('ranged');
    expect(pd.modes).toEqual(['parade']);
    expect(pd.mode).toBe('parade');
    expect(pd.parryWeaponUid).toBe('sh');
    expect(pd.distanceTiles).toBe(10);
  });

  it('héros nu, tir à distance moyenne → PAS de modale (tir non opposable → false)', () => {
    const { enemy, hero } = setup([sword], { x: 10, y: 0 });
    expect(maybeOpenDefense(useGame.getState, useGame.setState, enemy, hero)).toBe(false);
    expect(useGame.getState().pendingDefense).toBeNull();
  });

  it('héros nu, tir à Bout Portant (1 tuile) → modale (Esquive)', () => {
    const { enemy, hero } = setup([sword], { x: 1, y: 0 });
    expect(maybeOpenDefense(useGame.getState, useGame.setState, enemy, hero)).toBe(true);
    expect(useGame.getState().pendingDefense!.modes).toContain('esquive');
  });
});
