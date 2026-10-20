import { describe, it, expect } from 'vitest';
import { beatHold } from './combatDirector';
import { TEMPO } from './monde/tempo';
import { ev } from './combatLog';
import type { Get } from './flowTypes';

const cs = [
  { id: 'h1', name: 'Bidule', kind: 'hero' },
  { id: 'e1', name: 'Machin', kind: 'monster' },
];
const fakeGet = (log: unknown[]): Get => (() => ({ battle: { log, combatants: cs } } as never));

describe('beatHold — tenue = base TEMPO × ton du dernier évènement marquant', () => {
  it('ton normal (attaque) = base inchangée', () => {
    const get = fakeGet([ev('attack', 'Machin attaque Bidule', 'e1', 'h1')]);
    expect(beatHold(get, 'postAttack')).toBe(TEMPO.postAttack);
  });
  it('ton grave (mise à mort) = ×1,5', () => {
    const get = fakeGet([ev('death', 'Bidule est mis hors de combat !', 'h1')]);
    expect(beatHold(get, 'postAttack')).toBe(Math.round(TEMPO.postAttack * 1.5));
  });
  it('ton grave (critique) = ×1,5', () => {
    const get = fakeGet([ev('crit', 'Critique !', 'e1', 'h1')]);
    expect(beatHold(get, 'postAttack')).toBe(Math.round(TEMPO.postAttack * 1.5));
  });
  it('ton fort (Peur) = ×1,25', () => {
    const get = fakeGet([ev('fear', 'Machin panique', 'e1')]);
    expect(beatHold(get, 'turnHandoff')).toBe(Math.round(TEMPO.turnHandoff * 1.25));
  });
  it('sans combat → base normale', () => {
    const get = (() => ({ battle: null } as never)) as Get;
    expect(beatHold(get, 'autoResolve')).toBe(TEMPO.autoResolve);
  });
  it('ne retient que le DERNIER évènement IMPORTANT (ignore damage non important)', () => {
    const get = fakeGet([ev('death', 'Bidule est mis hors de combat !', 'h1'), ev('damage', '3 dégâts', 'h1')]);
    expect(beatHold(get, 'postAttack')).toBe(Math.round(TEMPO.postAttack * 1.5));
  });
});
