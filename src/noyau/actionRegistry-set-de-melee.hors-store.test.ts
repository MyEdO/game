/**
 * Le gate `set-de-melee` de la Charge sur un porteur SANS set (statbloc de créature) : `setDeMelee`, `actionRegistry.ts`.
 *  · LDB 15 l.35 : « Si vous Chargez, votre action doit être un Test de Corps à corps pour attaquer un adversaire. »
 *  · LDB 14 l.155 : « Un Test de Corps à corps (Bagarre) réussi pour un combat à mains nues se gère exactement comme
 *    n'importe quel autre Test de Combat » — les Mains nues de l'arsenal (`LDB 62 l.28`) portent ce Test.
 */
import { describe, it, expect } from 'vitest';
import { ACTION_GATES, type ActionCtx } from './actionRegistry';
import { spawnEnemy } from './monde/spawn';
import { armeDeTest } from '../engine/objetsDeTest.testkit';
import { unarmedWeapon } from '../engine/items';
import type { Combatant } from '../engine/types';
import type { BattleState } from './etat';

const creature = (weapons: Combatant['weapons']): Combatant => {
  const c = spawnEnemy({ ref: 'humain' }, 'e1', { x: 0, y: 0 });
  return { ...c, loadouts: undefined, activeLoadoutId: undefined, weapons };
};
const gate = (active: Combatant) => ACTION_GATES['set-de-melee']({ scene: null, active, battle: { combatants: [active] } as unknown as BattleState, gameTime: 0 } satisfies ActionCtx);

describe('set-de-melee — porteur sans set (statbloc de créature)', () => {
  it('une arme de mêlée dans l’arsenal ouvre la Charge', () => {
    expect(gate(creature([armeDeTest('dague'), unarmedWeapon()])).ok).toBe(true);
  });

  it('un tireur dont l’arsenal porte les Mains nues charge, et frappe à mains nues (LDB 14 l.155)', () => {
    expect(gate(creature([armeDeTest('arc'), unarmedWeapon()])).ok).toBe(true);
  });

  it('un arsenal de tir sans aucune attaque de corps à corps ferme la Charge', () => {
    expect(gate(creature([armeDeTest('arc')])).ok).toBe(false);
  });

  it('sans autre arme que les Mains nues, le corps à corps reste ouvert', () => {
    expect(gate(creature([unarmedWeapon()])).ok).toBe(true);
    expect(gate(creature([])).ok).toBe(true);
  });
});
