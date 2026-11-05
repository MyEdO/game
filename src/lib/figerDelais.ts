export function browserFreezeTimeout(delays: number[]): { delays: number[] } {
  if (!Array.isArray(delays) || Array.from(delays).some((d) => !Number.isInteger(d) || d < 0 || d > 2147483647))
    throw new Error('freezeTimeout : delays doit contenir des délais entiers de 0 à 2147483647 ms');
  const host = globalThis as typeof globalThis & {
    __wfrpTimeoutFreeze?: { original: typeof globalThis.setTimeout; delays: number[]; next: number };
  };
  const state = host.__wfrpTimeoutFreeze;
  if (state) {
    state.delays = [...delays];
    state.next = 0;
  } else {
    const frozen = { original: host.setTimeout, delays: [...delays], next: 0 };
    host.__wfrpTimeoutFreeze = frozen;
    host.setTimeout = ((...args: Parameters<typeof globalThis.setTimeout>) => {
      if (frozen.delays.length) args[1] = frozen.delays[Math.min(frozen.next++, frozen.delays.length - 1)];
      return frozen.original.apply(host, args);
    }) as typeof globalThis.setTimeout;
  }
  return { delays: [...delays] };
}

export function browserUnfreezeTimeout(): boolean {
  const host = globalThis as typeof globalThis & {
    __wfrpTimeoutFreeze?: { original: typeof globalThis.setTimeout; delays: number[]; next: number };
  };
  const state = host.__wfrpTimeoutFreeze;
  if (!state) return false;
  host.setTimeout = state.original;
  delete host.__wfrpTimeoutFreeze;
  return true;
}
