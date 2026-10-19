import { describe, it, expect } from 'vitest';
import { chooseEnemyAction, type EnemyTurnInput } from './ai';
import { emptyScene, type Scene } from '../noyau/monde/scene';
import type { Combatant, Weapon } from '../engine/types';

/**
 * Grimpant (LDB 85 l.160-162) : une créature à `traverse.climb`+`climbFullSpeed` (EnemyTurnInput,
 * dérivé de `climbTraverseFor` au site constructeur, `combatFlow.buildAiInput`) exploite AUTOMATIQUEMENT
 * les cases atteignables par-delà une arête `WallSeg.climb` — aucun branchement par-nom, `chooseEnemyAction`
 * réutilise le MÊME `reach` que `path-climb.test.ts` valide au niveau BFS.
 */
const MELEE: Weapon = { label: 'Griffes', type: 'melee', damage: { plusBF: true, flat: 4 }, qualities: [] };

// Plateau (y 0-1, h=4 m) séparé du sol (y 2-4, h=0 m) par une falaise ; seule l'arête N de (2,2) (entre
// (2,1) et (2,2)) est grimpable — chemin OBLIGÉ vers le plateau.
function cliffScene(): Scene {
  const s = emptyScene(5, 5);
  const w = 5, h = 5;
  const height = new Array(w * h).fill(0) as number[];
  for (let y = 0; y <= 1; y++) for (let x = 0; x < w; x++) height[y * w + x] = 4;
  s.layers[0].height = height;
  s.walls = [{ x: 2, y: 2, side: 'N', climb: { kind: 'surface' } }];
  return s;
}

function mk(id: string, kind: 'hero' | 'enemy', pos: { x: number; y: number; h?: number }, opts: Partial<Combatant> = {}): Combatant {
  return {
    id, label: id, kind, pos, wounds: { current: 10, max: 10 }, weapons: [MELEE],
    characteristics: {} as never, advantage: 0, conditions: [], armour: {} as never, skills: [], talents: [], movement: 4,
    ...opts,
  } as Combatant;
}

function input(enemy: Combatant, heroes: Combatant[], extra: Partial<EnemyTurnInput> = {}): EnemyTurnInput {
  return { enemy, heroes, scene: cliffScene(), blocked: new Set(), movement: enemy.movement, spells: [], ...extra };
}

describe("IA — Grimpant exploite les cases atteignables par-delà la falaise", () => {
  const enemy = mk('e', 'enemy', { x: 2, y: 4, h: 0 }, { traits: [{ id: 'grimpant' }] });
  const hero = mk('h', 'hero', { x: 2, y: 0, h: 4 });

  it('SANS traverse (capability non branchée à l’entrée IA) : reste coincé au pied de la falaise', () => {
    const action = chooseEnemyAction(input(enemy, [hero], { movement: 4 }));
    expect(action.kind).toBe('move');
    if (action.kind !== 'move') throw new Error('attendu move');
    expect(action.to.y).toBeGreaterThanOrEqual(2); // n'a jamais franchi l'arête
  });

  it('AVEC traverse (Grimpant) : franchit la falaise et se rapproche sur le plateau', () => {
    const action = chooseEnemyAction(input(enemy, [hero], { movement: 4, traverse: { climb: true, climbFullSpeed: true } }));
    expect(action.kind).toBe('move');
    if (action.kind !== 'move') throw new Error('attendu move');
    expect(action.to.y).toBeLessThanOrEqual(1); // a grimpé sur le plateau, plus proche de la cible
  });
});
