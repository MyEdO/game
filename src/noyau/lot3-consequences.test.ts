import { describe, it, expect } from 'vitest';
import { applyEffects } from './combatEffects';
import { ouvrirLeBanc } from './banc.testkit';
import { hasCondition } from '../engine/conditions';
import type { Combatant } from '../engine/types';
import { combattantDeTest, blessuresDeBase } from '../engine/combattantDeTest.testkit';

const hero = (id: string, current: number): Combatant =>
  combattantDeTest({ id, label: id, kind: 'heros', dead: false, wounds: blessuresDeBase(20, current) });

describe('EffectOp hors combat (Effect `ops` : wounds / condition — vocabulaire des sorts)', () => {
  it('wounds on=party : chaque héros vivant perd `amount` PB', () => {
    const { getState, setState } = ouvrirLeBanc({ etat: { party: [hero('A', 12), hero('B', 5)] } });
    applyEffects(getState, setState, [{ type: 'ops', on: 'groupe', ops: [{ op: 'wounds', amount: 8 }] }]);
    expect(getState().party[0].wounds.current).toBe(4);
    expect(getState().party[1].wounds.current).toBe(0); // À Terre via loseWounds
  });

  it('wounds on=hero : seul le héros désigné est touché', () => {
    const { getState, setState } = ouvrirLeBanc({ etat: { party: [hero('A', 12), hero('B', 12)] } });
    applyEffects(getState, setState, [{ type: 'ops', on: 'heros', heroId: 'B', ops: [{ op: 'wounds', amount: 5 }] }]);
    expect(getState().party[0].wounds.current).toBe(12);
    expect(getState().party[1].wounds.current).toBe(7);
  });

  it('condition on=party : pose l’État sur tout le groupe (valeur par défaut 1)', () => {
    const { getState, setState } = ouvrirLeBanc({ etat: { party: [hero('A', 12), hero('B', 12)] } });
    applyEffects(getState, setState, [{ type: 'ops', on: 'groupe', ops: [{ op: 'condition', id: { id: 'en-flammes' } }] }]);
    expect(hasCondition(getState().party[0], 'en-flammes')).toBe(true);
    expect(hasCondition(getState().party[1], 'en-flammes')).toBe(true);
  });

  it('condition value : pose l’intensité demandée sur un héros', () => {
    const { getState, setState } = ouvrirLeBanc({ etat: { party: [hero('A', 12)] } });
    applyEffects(getState, setState, [{ type: 'ops', on: 'heros', ops: [{ op: 'condition', id: { id: 'empoisonne' }, value: 3 }] }]);
    expect(getState().party[0].conditions.find((c) => c.id === 'empoisonne')?.value).toBe(3);
  });
});
