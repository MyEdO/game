import { describe, it, expect } from 'vitest';
import { applyEffects, fireScheduledEffects } from '../noyau/combatEffects';
import { flowFromEffects, type Flow } from '../noyau/monde/flow';
import type { Effect } from '../noyau/monde/scene';

/** Harnais minimal {get,set} : applyEffects/fireScheduledEffects ne touchent que flags/scheduledEffects
 *  pour des effets `setFlag` (pas de combat, butin ni journal). */
function fakeStore(init: Record<string, unknown> = {}) {
  let s: any = { battle: undefined, flags: {}, scheduledEffects: [], gameTime: 0, journal: [], log: () => {}, ...init };
  const get = () => s;
  const set = (patch: any) => {
    s = { ...s, ...(typeof patch === 'function' ? patch(s) : patch) };
  };
  return { get, set, state: () => s };
}

const boom = (flag = 'boom'): Flow => flowFromEffects([{ type: 'setFlag', flag }]);

describe('Lot 0 — minuterie delayedEffect', () => {
  it('afterMinutes : programme l’échéance à gameTime+N, ne se déclenche qu’au franchissement', () => {
    const f = fakeStore({ gameTime: 1000 });
    applyEffects(f.get, f.set, [{ type: 'delayedEffect', afterMinutes: 60, flow: boom() } as Effect]);
    expect(f.state().scheduledEffects).toHaveLength(1);
    expect(f.state().scheduledEffects[0].executeAt).toBe(1060);

    f.set({ gameTime: 1059 });
    fireScheduledEffects(f.get, f.set);
    expect(f.state().flags.boom).toBeUndefined();
    expect(f.state().scheduledEffects).toHaveLength(1);

    f.set({ gameTime: 1060 });
    fireScheduledEffects(f.get, f.set);
    expect(f.state().flags.boom).toBe(true);
    expect(f.state().scheduledEffects).toHaveLength(0);
  });

  it('cancelFlag posé avant l’échéance → l’effet est annulé (désamorçage), et retiré de la file', () => {
    const f = fakeStore({ gameTime: 0 });
    applyEffects(f.get, f.set, [{ type: 'delayedEffect', afterMinutes: 10, cancelFlag: 'desamorce', flow: boom() } as Effect]);
    f.set({ flags: { desamorce: true }, gameTime: 99 });
    fireScheduledEffects(f.get, f.set);
    expect(f.state().flags.boom).toBeUndefined();
    expect(f.state().scheduledEffects).toHaveLength(0);
  });

  it('atHour/atMinute : programme à la PROCHAINE occurrence de l’heure du jour', () => {
    const f = fakeStore({ gameTime: 20 * 60 }); // 20:00
    applyEffects(f.get, f.set, [{ type: 'delayedEffect', atHour: 22, atMinute: 45, flow: boom('acte2') } as Effect]);
    expect(f.state().scheduledEffects[0].executeAt).toBe(22 * 60 + 45);
  });
});
