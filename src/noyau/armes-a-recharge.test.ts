/**
 * Sélecteur `armes-a-recharge` du registre d'actions, lu par la console : les armes à distance qui ont un
 * cycle de charge. LDB 62 l.333-335
 */
import { describe, it, expect } from 'vitest';
import { ACTION_CANDIDATES } from './actionRegistry';
import type { Combatant, Weapon } from '../engine/types';

const arme = (uid: string, type: Weapon['type'], reload?: number) => ({ uid, type, reload }) as unknown as Weapon;
const ARBALETRIER = { id: 'x', weapons: [arme('arbalete', 'distance', 1), arme('arc', 'distance', 0), arme('fronde', 'distance'), arme('epee', 'melee', 2)] } as unknown as Combatant;

describe('armes-a-recharge — armes à distance à Recharge', () => {
  it('exactement les armes à distance dont la Recharge est positive', () => {
    const armes = ACTION_CANDIDATES['armes-a-recharge']({ active: ARBALETRIER } as never) as Weapon[];
    expect(armes.map((w) => w.uid)).toEqual(['arbalete']);
  });
});
