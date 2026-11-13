import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RELAY_URL_PROD, applyNetSnapshot, relayHttpUrl, salon } from './netFlow';
import { instantaneDeLaCoop } from '../noyau/coop';
import { initialNet } from '../noyau/etat';
import { useGame } from './store';
import type { SocketLike } from '../hote/coop/relay';
import { emptyScene } from '../noyau/monde/scene';

class FakeSocket implements SocketLike {
  static instances: FakeSocket[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: unknown }) => void) | null = null;
  onclose: ((e: { code: number; reason: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(readonly url: string) { FakeSocket.instances.push(this); }
  send(): void {}
  close(): void {}
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
  salon.quitter(useGame.getState);
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe('URL du relais selon le mode Vite', () => {
  it.each(['test', 'development'])('sans override en mode %s : relais local', (mode) => {
    vi.stubEnv('MODE', mode);
    expect(relayHttpUrl()).toBe('http://localhost:8787');
  });

  it('sans override en production : le Worker', () => {
    vi.stubEnv('PROD', true);
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

describe('relais local injoignable', () => {
  it('héberger refuse et conserve le mode local lorsque POST /rooms échoue', async () => {
    const urls: string[] = [];
    vi.stubGlobal('fetch', async (url: string) => {
      urls.push(url);
      throw new TypeError('Failed to fetch');
    });
    expect(await salon.heberger(useGame.getState, 'Anne')).toBe(false);
    expect(urls).toEqual(['http://localhost:8787/rooms']);
    expect(useGame.getState().net.mode).toBe('local');
    expect(FakeSocket.instances).toHaveLength(0);
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('invité : son interface se remet comme chez l’hôte au changement de scène ou de partie (#3041)', () => {
  const INTERFACE_GLISSEE = { camPan: { x: 7, y: -3 }, camEdge: true, inspectId: 'pnj-de-a', sheetId: 'heros-x' };
  const interfaceDeLInvite = () => {
    const { camPan, camEdge, inspectId, sheetId } = useGame.getState();
    return { camPan, camEdge, inspectId, sheetId };
  };
  /** L'hôte joue : scène A, une heure passe, puis transition en B ; puis une partie neuve repart en A. */
  function snapshotsDeLHote() {
    const projet = { scenes: [emptyScene('scene-a', 6, 6), emptyScene('scene-b', 6, 6)], entryId: 'scene-a', projet: null };
    useGame.getState().chargerLeProjet(projet);
    const enA = instantaneDeLaCoop(useGame.getState());
    useGame.getState().avancerLeTemps(60);
    const enAPlusTard = instantaneDeLaCoop(useGame.getState());
    useGame.getState().quitterLaScene('scene-b');
    const enB = instantaneDeLaCoop(useGame.getState());
    useGame.getState().chargerLeProjet(projet);
    const partieNeuve = instantaneDeLaCoop(useGame.getState());
    return { enA, enAPlusTard, enB, partieNeuve };
  }
  function inviteRecoit(avant: Record<string, unknown>, apres: Record<string, unknown>) {
    applyNetSnapshot(useGame.setState, avant);
    useGame.setState(INTERFACE_GLISSEE);
    applyNetSnapshot(useGame.setState, apres);
  }

  it('l’hôte passe en scène B : caméra remise, le reste gardé comme chez l’hôte (`REMIS_A_CHAQUE_ENTREE`)', () => {
    const { enAPlusTard, enB } = snapshotsDeLHote();
    inviteRecoit(enAPlusTard, enB);
    expect(useGame.getState().scene?.id).toBe('scene-b');
    expect(interfaceDeLInvite()).toEqual({ ...INTERFACE_GLISSEE, camPan: { x: 0, y: 0 }, camEdge: false });
  });

  it('l’hôte repart d’une partie neuve dans la même scène : toute l’interface se remet', () => {
    const { enAPlusTard, partieNeuve } = snapshotsDeLHote();
    inviteRecoit(enAPlusTard, partieNeuve);
    expect(useGame.getState().scene?.id).toBe('scene-a');
    expect(interfaceDeLInvite()).toEqual({ camPan: { x: 0, y: 0 }, camEdge: false, inspectId: null, sheetId: null });
  });

  it('même scène, même partie : l’invité garde son interface', () => {
    const { enA, enAPlusTard } = snapshotsDeLHote();
    inviteRecoit(enA, enAPlusTard);
    expect(interfaceDeLInvite()).toEqual(INTERFACE_GLISSEE);
  });
});
