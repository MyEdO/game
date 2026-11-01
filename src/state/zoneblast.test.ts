import { describe, it, expect } from 'vitest';
import { applyEffects } from '../noyau/combatEffects';
import { hasCondition } from '../engine/conditions';
import type { Effect } from '../data/schemas/defs-scenes/effets';
import type { Combatant } from '../engine/types';
import { blessuresSurLeProfil, blessuresDeBase } from '../engine/combattantDeTest.testkit';

const hero = (id: string, current: number): Combatant =>
  (blessuresSurLeProfil({ id, name: id, kind: 'hero', dead: false, wounds: blessuresDeBase(30, current), advantage: 0, conditions: [],
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 } }) as unknown as Combatant);

function fakeStore(party: Combatant[], partyPos: { x: number; y: number }) {
  let s: any = { battle: undefined, party, partyPos, flags: {}, journal: [], log: () => {} };
  const get = () => s;
  const set = (patch: any) => { s = { ...s, ...(typeof patch === 'function' ? patch(s) : patch) }; };
  return { get, set, state: () => s };
}

describe('zoneBlast — souffle de zone (hors combat : le groupe à partyPos)', () => {
  it('groupe DANS le rayon (Chebyshev) → dégâts + État', () => {
    const f = fakeStore([hero('A', 30)], { x: 5, y: 5 });
    applyEffects(f.get, f.set, [{ type: 'zoneBlast', center: { x: 6, y: 5 }, radius: 2, ops: [{ op: 'wounds', amount: 15 }, { op: 'condition', id: 'en-flammes' }] } as Effect]);
    expect(f.state().party[0].wounds.current).toBe(15);
    expect(hasCondition(f.state().party[0], 'en-flammes')).toBe(true);
  });

  it('groupe HORS du rayon → intact', () => {
    const f = fakeStore([hero('A', 30)], { x: 20, y: 20 });
    applyEffects(f.get, f.set, [{ type: 'zoneBlast', center: { x: 5, y: 5 }, radius: 2, ops: [{ op: 'wounds', amount: 15 }] } as Effect]);
    expect(f.state().party[0].wounds.current).toBe(30);
  });
});

describe('zoneBlast — souffle dans un DISQUE en combat (cibles par position)', () => {
  const combatant = (id: string, pos: { x: number; y: number }): Combatant =>
    ({ ...hero(id, 30), kind: 'enemy', pos } as unknown as Combatant);
  function combatStore(combatants: Combatant[]) {
    let s: any = { battle: { combatants }, party: [], partyPos: { x: 0, y: 0 }, flags: {}, journal: [], log: () => {} };
    return { get: () => s, set: (patch: any) => { s = { ...s, ...(typeof patch === 'function' ? patch(s) : patch) }; }, state: () => s };
  }
  it('les combattants dans le rayon encaissent dégâts + État ; ceux hors rayon intacts', () => {
    const near1 = combatant('n1', { x: 5, y: 5 });
    const near2 = combatant('n2', { x: 6, y: 6 });
    const far = combatant('f', { x: 12, y: 12 });
    const f = combatStore([near1, near2, far]);
    applyEffects(f.get, f.set, [{ type: 'zoneBlast', center: { x: 5, y: 5 }, radius: 2, ops: [{ op: 'wounds', amount: 10 }, { op: 'condition', id: 'en-flammes' }] } as Effect]);
    const cs = f.state().battle.combatants as Combatant[];
    expect(cs.find((c) => c.id === 'n1')!.wounds.current).toBe(20);
    expect(cs.find((c) => c.id === 'n2')!.wounds.current).toBe(20);
    expect(cs.find((c) => c.id === 'f')!.wounds.current).toBe(30);
    expect(hasCondition(cs.find((c) => c.id === 'n1')!, 'en-flammes')).toBe(true);
    expect(hasCondition(cs.find((c) => c.id === 'f')!, 'en-flammes')).toBe(false);
  });
});
