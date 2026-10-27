import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyNetSnapshot, buildDeLaCoop, netHostStart, netJoin, netLeave } from './netFlow';
import { initialNet } from '../noyau/etat';
import { useGame } from './store';
import type { SocketLike } from '../net/relay';
import { FORMAT_SAVE } from '../noyau/persistance/formats.generated';
import { setDataset } from '../data/overrides';
import { etats } from '../data';
import { OPTIONAL_RULES } from '../engine/policy';

const ETATS_LIVRES = structuredClone(etats);
const REGLES_LIVREES = structuredClone(OPTIONAL_RULES);

class FakeSocket implements SocketLike {
  static instances: FakeSocket[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: unknown }) => void) | null = null;
  onclose: ((e: { code: number; reason: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  closed = false;
  constructor(readonly url: string) { FakeSocket.instances.push(this); }
  send(): void {}
  close(code = 1000, reason = ''): void {
    this.closed = true;
    this.onclose?.({ code, reason });
  }
  drop(): void { this.onclose?.({ code: 1006, reason: '' }); }
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubEnv('PROD', false);
  vi.stubEnv('VITE_RELAY_URL', undefined);
  vi.stubGlobal('WebSocket', FakeSocket);
  FakeSocket.instances = [];
  useGame.setState({ net: initialNet() });
});

afterEach(() => {
  netLeave(useGame.getState, useGame.setState);
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe('relais local injoignable', () => {
  it('héberger refuse et conserve le mode local lorsque POST /rooms échoue', async () => {
    const urls: string[] = [];
    vi.stubGlobal('fetch', async (url: string) => {
      urls.push(url);
      throw new TypeError('Failed to fetch');
    });
    expect(await netHostStart(useGame.getState, useGame.setState, 'Anne')).toBe(false);
    expect(urls).toEqual(['http://localhost:8787/rooms']);
    expect(useGame.getState().net.mode).toBe('local');
    expect(FakeSocket.instances).toHaveLength(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('rejoindre expire en français après fermeture 1006, sans socket ni timer survivant', async () => {
    const joining = netJoin(useGame.getState, useGame.setState, (d) => applyNetSnapshot(useGame.setState, d), 'abc234', 'Anne & Bob');
    const first = FakeSocket.instances[0];
    expect(new URL(first.url).origin).toBe('ws://localhost:8787');
    expect(new URL(first.url).pathname).toBe('/room/ABC234');
    expect(new URL(first.url).searchParams.get('name')).toBe('Anne & Bob');
    first.drop();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(FakeSocket.instances).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(14_000);
    expect(await joining).toBe('Connexion impossible — réessayez.');
    expect(useGame.getState().net.mode).toBe('local');
    expect(FakeSocket.instances[1].closed).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(120_000);
    expect(FakeSocket.instances).toHaveLength(2);
  });
});

describe('build du handshake coop : format ET registres (#1463 LD.1)', () => {
  afterEach(() => {
    setDataset('etats', structuredClone(ETATS_LIVRES));
    setDataset('reglesOptionnelles', structuredClone(REGLES_LIVREES));
  });

  it('porte le format de l’état, et change quand un registre que nomme un snapshot change', () => {
    const base = buildDeLaCoop();
    expect(base.startsWith(`${FORMAT_SAVE}.`)).toBe(true);
    expect(buildDeLaCoop(), 'déterministe').toBe(base);
    setDataset('etats', [...structuredClone(ETATS_LIVRES), { ...structuredClone(ETATS_LIVRES[0]), id: 'etat-de-fixture' }]);
    expect(buildDeLaCoop()).not.toBe(base);
    setDataset('etats', structuredClone(ETATS_LIVRES));
    expect(buildDeLaCoop()).toBe(base);
    const mode = REGLES_LIVREES.findIndex((r) => r.kind === 'mode');
    setDataset('reglesOptionnelles', REGLES_LIVREES.map((r, i) => (i === mode ? { ...structuredClone(r), options: [...(r.options ?? []), 'option-de-fixture'] } : structuredClone(r))));
    expect(buildDeLaCoop()).not.toBe(base);
  });
});
