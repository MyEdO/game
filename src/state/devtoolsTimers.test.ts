import { afterEach, describe, expect, it, vi } from 'vitest';
import { browserFreezeTimeout, browserUnfreezeTimeout } from './devtoolsTimers';

afterEach(() => {
  browserUnfreezeTimeout();
  vi.useRealTimers();
});

describe('noyau browser de délais forcés', () => {
  it('se sérialise sans app, remappe la séquence puis son dernier délai, conserve chaque callback et restaure sans reprogrammer', () => {
    vi.useFakeTimers();
    const original = globalThis.setTimeout;
    const freeze = (0, eval)(`(${browserFreezeTimeout.toString()})`) as typeof browserFreezeTimeout;
    const unfreeze = (0, eval)(`(${browserUnfreezeTimeout.toString()})`) as typeof browserUnfreezeTimeout;
    const calls: string[] = [];
    setTimeout(() => calls.push('déjà posé'), 25);
    expect(freeze([100, 200])).toEqual({ delays: [100, 200] });
    setTimeout((arg: string) => calls.push(arg), 15, 'argument');
    setTimeout(() => calls.push('deuxième'), 20);
    setTimeout(() => calls.push('dernier réutilisé'), 1);
    vi.advanceTimersByTime(25);
    expect(calls).toEqual(['déjà posé']);
    vi.advanceTimersByTime(75);
    expect(calls).toEqual(['déjà posé', 'argument']);
    vi.advanceTimersByTime(100);
    expect(calls).toEqual(['déjà posé', 'argument', 'deuxième', 'dernier réutilisé']);
    freeze([0]);
    setTimeout(() => calls.push('accéléré'), 9999);
    vi.advanceTimersByTime(0);
    expect(calls[calls.length - 1]).toBe('accéléré');
    freeze([]);
    setTimeout(() => calls.push('inchangé'), 50);
    vi.advanceTimersByTime(49);
    expect(calls[calls.length - 1]).toBe('accéléré');
    vi.advanceTimersByTime(1);
    expect(calls[calls.length - 1]).toBe('inchangé');
    freeze([60000]);
    setTimeout(() => calls.push('armé sous patch'), 0);
    expect(unfreeze()).toBe(true);
    expect(unfreeze()).toBe(false);
    expect(globalThis.setTimeout).toBe(original);
    setTimeout(() => calls.push('rétabli'), 10);
    vi.advanceTimersByTime(10);
    expect(calls[calls.length - 1]).toBe('rétabli');
    vi.advanceTimersByTime(59990);
    expect(calls[calls.length - 1]).toBe('armé sous patch');
    expect(calls).toHaveLength(8);
  });

  it('refuse les délais invalides avant tout patch', () => {
    const original = globalThis.setTimeout;
    for (const delays of [[-1], [NaN], [Infinity], [0.5], [2147483648], new Array<number>(1), null])
      expect(() => browserFreezeTimeout(delays as number[])).toThrow(/delays/);
    expect(globalThis.setTimeout).toBe(original);
  });
});
