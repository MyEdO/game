import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyNetSnapshot, netAssign, netAssignSlot, netHostStart, netJoin, netLeave, setGmSeat } from './netFlow';
import { t } from '../i18n';
import { makePregens } from '../data/pregens';
import { instantaneDeLaCoop } from '../noyau/coop';
import { initialNet } from '../noyau/etat';
import { useGame } from './store';
import type { SocketLike } from '../net/relay';
import { emptyScene } from '../noyau/monde/scene';

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

describe('invité : son interface se remet comme chez l’hôte au changement de scène ou de partie (#3041)', () => {
  const INTERFACE_GLISSEE = { camPan: { x: 7, y: -3 }, camEdge: true, inspectId: 'pnj-de-a', sheetId: 'heros-x' };
  const interfaceDeLInvite = () => {
    const { camPan, camEdge, inspectId, sheetId } = useGame.getState();
    return { camPan, camEdge, inspectId, sheetId };
  };
  /** L'hôte joue : scène A, une heure passe, puis transition en B ; puis une partie neuve repart en A. */
  function snapshotsDeLHote() {
    const projet = { scenes: [emptyScene('scene-a', 6, 6), emptyScene('scene-b', 6, 6)], entryId: 'scene-a', projet: null };
    useGame.getState().loadProject(projet);
    const enA = instantaneDeLaCoop(useGame.getState());
    useGame.getState().advanceTime(60);
    const enAPlusTard = instantaneDeLaCoop(useGame.getState());
    useGame.getState().transitionTo('scene-b');
    const enB = instantaneDeLaCoop(useGame.getState());
    useGame.getState().loadProject(projet);
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

describe('lobby de l’hôte : une attribution refusée laisse `net` inchangé et dit son refus (#3059 F10)', () => {
  const hote = () => ({ ...initialNet(), mode: 'host' as const, roomCode: 'ABC234', seatNames: { 0: 'Hôte', 1: 'Anna' }, rangs: { h: 0 } });
  beforeEach(() => { useGame.setState({ net: hote(), party: [{ ...makePregens()[0], id: 'h' }], battle: null }); });

  it('netAssignSlot vers un emplacement occupé, puis vers un siège hors de la table ; netAssign et setGmSeat vers un siège hors de la table', () => {
    const avant = useGame.getState().net;
    const journal = useGame.getState().journal.length;
    netAssignSlot(useGame.getState, useGame.setState, 0, 1);
    netAssignSlot(useGame.getState, useGame.setState, 1, 7);
    netAssign(useGame.getState, useGame.setState, 'h', 7);
    netAssign(useGame.getState, useGame.setState, 'absent', 1);
    setGmSeat(useGame.getState, useGame.setState, 7);
    expect(useGame.getState().net).toBe(avant);
    expect(useGame.getState().journal.slice(journal)).toEqual([
      t('coop.assign.slotTaken'), t('coop.assign.seatUnknown'), t('coop.assign.seatUnknown'), t('coop.assign.heroAbsent'), t('coop.assign.seatUnknown'),
    ]);
  });

  it('les mêmes gestes vers un emplacement vide et un siège de la table s’appliquent', () => {
    netAssignSlot(useGame.getState, useGame.setState, 1, 1);
    netAssign(useGame.getState, useGame.setState, 'h', 1);
    setGmSeat(useGame.getState, useGame.setState, 1);
    expect(useGame.getState().net).toMatchObject({ slots: [0, 1, 0, 0], ownership: { h: 1 }, gmSeat: 1 });
  });
});
