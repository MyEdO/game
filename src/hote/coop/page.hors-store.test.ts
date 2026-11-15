/** Les ports de la page (#3009) : l'adresse du relay selon le mode Vite, et chaque port lu à l'appel. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RELAY_URL_PROD, portsDeLaPage, relayHttpUrl } from './page';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('URL du relais selon le mode Vite', () => {
  it.each(['test', 'development'])('sans override en mode %s : relais local', (mode) => {
    vi.stubEnv('PROD', false);
    vi.stubEnv('VITE_RELAY_URL', undefined);
    vi.stubEnv('MODE', mode);
    expect(relayHttpUrl()).toBe('http://localhost:8787');
  });

  it('sans override en production : le Worker', () => {
    vi.stubEnv('PROD', true);
    vi.stubEnv('VITE_RELAY_URL', undefined);
    expect(relayHttpUrl()).toBe(RELAY_URL_PROD);
  });

  it.each([false, true])('override explicite prioritaire (PROD=%s)', (prod) => {
    vi.stubEnv('PROD', prod);
    vi.stubEnv('VITE_RELAY_URL', 'http://localhost:8799');
    expect(relayHttpUrl()).toBe('http://localhost:8799');
    vi.stubEnv('VITE_RELAY_URL', RELAY_URL_PROD);
    expect(relayHttpUrl()).toBe(RELAY_URL_PROD);
  });
});

describe('ports de la page', () => {
  it('la socket et le `fetch` se lisent au global à l’appel, pas à la création des ports', async () => {
    const ports = portsDeLaPage();
    const urls: string[] = [];
    vi.stubGlobal('WebSocket', class { constructor(url: string) { urls.push(`ws ${url}`); } });
    vi.stubGlobal('fetch', async (url: string) => { urls.push(`fetch ${url}`); return { ok: true, json: async () => ({}) }; });
    ports.socket('ws://relais/room/ABC234');
    await ports.fetch('http://relais/rooms', { method: 'POST' });
    expect(urls).toEqual(['ws ws://relais/room/ABC234', 'fetch http://relais/rooms']);
  });
});
