import { describe, it, expect } from 'vitest';
import { chooseEnemyAction, EnemyTurnInput } from '../noyau/monde/ai';
import { emptyScene } from '../noyau/monde/scene';
import type { Combatant, Weapon } from '../engine/types';

const MELEE: Weapon = { label: 'Épée', type: 'melee', damage: { plusBF: true, flat: 4 }, qualities: [] };

function mk(id: string, kind: 'hero' | 'enemy', pos: { x: number; y: number }, opts: Partial<Combatant> = {}): Combatant {
  return {
    id, label: id, kind, pos,
    wounds: { current: 10, max: 10 }, weapons: [MELEE], characteristics: {} as never,
    advantage: 0, conditions: [], armour: {} as never, skills: [], talents: [], movement: 4,
    ...opts,
  } as Combatant;
}
const scene = emptyScene(12, 12);
function input(enemy: Combatant, heroes: Combatant[], extra: Partial<EnemyTurnInput> = {}): EnemyTurnInput {
  return { enemy, heroes, scene, blocked: new Set(heroes.map((h) => `${h.pos!.x},${h.pos!.y}`)), movement: enemy.movement, spells: [], ...extra };
}

describe('Frénésie/Haine IA — contrainte de cible (LDB 21, P3)', () => {
  it('Haine active : vise un membre du groupe haï (pas le plus faible hors groupe)', () => {
    const e = mk('e', 'enemy', { x: 5, y: 5 }, { psychState: [{ type: 'haine', cible: 'elfe', active: true }] });
    const hated = mk('hated', 'hero', { x: 5, y: 6 }, { wounds: { current: 10, max: 10 }, groups: ['elfe'] }); // costaud mais haï
    const weak = mk('weak', 'hero', { x: 5, y: 4 }, { wounds: { current: 1, max: 10 }, groups: ['humain'] }); // faible mais non haï
    const action = chooseEnemyAction(input(e, [hated, weak]));
    const tid = (action as { targetId?: string; thenTargetId?: string }).targetId ?? (action as { thenTargetId?: string }).thenTargetId;
    expect(tid).toBe('hated');
  });

  it('Animosité active mais aucun membre du groupe visible → ciblage normal (le plus faible)', () => {
    const e = mk('e', 'enemy', { x: 5, y: 5 }, { psychState: [{ type: 'animosite', cible: 'elfe', active: true }] });
    const weak = mk('weak', 'hero', { x: 5, y: 6 }, { wounds: { current: 1, max: 10 }, groups: ['humain'] });
    const tough = mk('tough', 'hero', { x: 5, y: 4 }, { wounds: { current: 10, max: 10 }, groups: ['humain'] });
    const action = chooseEnemyAction(input(e, [weak, tough]));
    const tid = (action as { targetId?: string; thenTargetId?: string }).targetId ?? (action as { thenTargetId?: string }).thenTargetId;
    expect(tid).toBe('weak'); // pas de groupe haï présent → comportement habituel
  });
});
