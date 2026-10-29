import { describe, it, expect } from 'vitest';
import { applyEffects } from '../noyau/combatEffects';
import { hasCondition } from '../engine/conditions';
import type { Combatant } from '../engine/types';
import { combattantDeTest } from '../engine/combattantDeTest.testkit';
import { blessuresDeBase } from '../engine/characteristics';

const hero = (id: string, current: number): Combatant =>
  combattantDeTest({ id, label: id, kind: 'hero', dead: false, wounds: blessuresDeBase(20, current) });

function fakeStore(party: Combatant[]) {
  let s: any = { battle: undefined, party, flags: {}, journal: [], log: () => {} };
  const get = () => s;
  const set = (patch: any) => { s = { ...s, ...(typeof patch === 'function' ? patch(s) : patch) }; };
  return { get, set, state: () => s };
}

describe('EffectOp hors combat (Effect `ops` : wounds / condition — vocabulaire des sorts)', () => {
  it('wounds on=party : chaque héros vivant perd `amount` PB', () => {
    const f = fakeStore([hero('A', 12), hero('B', 5)]);
    applyEffects(f.get, f.set, [{ type: 'ops', on: 'party', ops: [{ op: 'wounds', amount: 8 }] }]);
    expect(f.state().party[0].wounds.current).toBe(4);
    expect(f.state().party[1].wounds.current).toBe(0); // À Terre via loseWounds
  });

  it('wounds on=hero : seul le héros désigné est touché', () => {
    const f = fakeStore([hero('A', 12), hero('B', 12)]);
    applyEffects(f.get, f.set, [{ type: 'ops', on: 'hero', heroId: 'B', ops: [{ op: 'wounds', amount: 5 }] }]);
    expect(f.state().party[0].wounds.current).toBe(12);
    expect(f.state().party[1].wounds.current).toBe(7);
  });

  it('condition on=party : pose l’État sur tout le groupe (valeur par défaut 1)', () => {
    const f = fakeStore([hero('A', 12), hero('B', 12)]);
    applyEffects(f.get, f.set, [{ type: 'ops', on: 'party', ops: [{ op: 'condition', id: 'en-flammes' }] }]);
    expect(hasCondition(f.state().party[0], 'en-flammes')).toBe(true);
    expect(hasCondition(f.state().party[1], 'en-flammes')).toBe(true);
  });

  it('condition value : pose l’intensité demandée sur un héros', () => {
    const f = fakeStore([hero('A', 12)]);
    applyEffects(f.get, f.set, [{ type: 'ops', on: 'hero', ops: [{ op: 'condition', id: 'empoisonne', value: 3 }] }]);
    expect(f.state().party[0].conditions.find((c: any) => c.id === 'empoisonne')?.value).toBe(3);
  });
});
