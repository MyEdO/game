import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RELAY_URL_PROD, relayHttpUrl, roomWsUrl, RelayClient, RoomGuest, RoomHost, type SocketLike } from './relay';
import { inflateB64 } from './compress';
import { GuestSession, HostSession } from './session';
import type { NetMessage } from './protocol';

class FakeSocket implements SocketLike {
  static last: FakeSocket | null = null;
  sent: string[] = [];
  closedWith: { code?: number } | null = null;
  bufferedAmount = 0;
  onSend: ((data: string) => void) | null = null;
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: unknown }) => void) | null = null;
  onclose: ((e: { code: number; reason: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(readonly url: string) {
    FakeSocket.last = this;
  }
  send(d: string): void {
    this.sent.push(d);
    this.onSend?.(d);
  }
  close(code?: number, reason?: string): void {
    this.closedWith = { code };
    this.onclose?.({ code: code ?? 1005, reason: reason ?? '' });
  }
  // helpers de test (côté « serveur ») :
  open(): void {
    this.onopen?.();
  }
  receive(d: string): void {
    this.onmessage?.({ data: d });
  }
  dropFromServer(code = 1006, reason = ''): void {
    this.onclose?.({ code, reason });
  }
}

const makeSocket = (url: string) => new FakeSocket(url);

function resumedHostSession() {
  let hostSocket: FakeSocket;
  let hostOnline = true;
  const roomHost = new RoomHost('ABC234', 'T', (url) => {
    hostSocket = new FakeSocket(url);
    hostSocket.onSend = (raw) => {
      const env = JSON.parse(raw) as Record<string, unknown>;
      if (env.to === 1) guestSocket.receive(JSON.stringify({ data: env.data, z: env.z }));
    };
    return hostSocket;
  });
  const roomGuest = new RoomGuest('ABC234', 'Anna', makeSocket);
  const guestSocket = FakeSocket.last!;
  guestSocket.onSend = (raw) => {
    const env = JSON.parse(raw) as Record<string, unknown>;
    if (hostOnline && (env.data != null || env.z != null)) {
      hostSocket.receive(JSON.stringify({ from: 1, data: env.data, z: env.z }));
    }
  };
  const snapshot = { gameTime: 7 };
  const campaign: Extract<NetMessage, { kind: 'campaign' }> = {
    kind: 'campaign', label: 'Campagne', scenes: [], startSceneId: 'depart', worldMap: null,
  };
  const received: string[] = [];
  const applySnapshot = vi.fn(() => { received.push('snapshot'); });
  const onCampaign = vi.fn(() => { received.push('campaign'); });
  const applyIntent = vi.fn();
  const host = new HostSession({
    build: 'test', allow: new Set(['battleEndTurn']), applyIntent,
    getSnapshot: () => ({ ...snapshot }), extraJoinMessages: () => [campaign],
  });
  const guest = new GuestSession({ build: 'test', label: 'Anna', applySnapshot, onCampaign });
  roomHost.onJoin = (seat) => host.addGuest(roomHost.seatTransport(seat), seat);
  roomHost.onResume = (seat) => {
    if (!host.seats[seat]) host.addGuest(roomHost.seatTransport(seat), seat);
  };
  roomGuest.onSeated = () => guest.connect(roomGuest);
  roomGuest.onReconnected = () => guest.rejoin();
  const onHostAway = vi.fn();
  roomGuest.onHostAway = onHostAway;
  hostSocket!.open();
  guestSocket.open();

  async function idle(): Promise<void> {
    await roomGuest.idle();
    await roomHost.idle();
    await roomHost.idle();
    await roomGuest.idle();
  }

  return {
    guest, host, snapshot, campaign, received, applySnapshot, onCampaign, applyIntent, onHostAway,
    idle,
    seatGuest() {
      guestSocket.receive(JSON.stringify({ evt: 'seated', seat: 1, token: 'TOK1' }));
      if (hostOnline) hostSocket.receive(JSON.stringify({ evt: 'join', seat: 1, name: 'Anna' }));
      else guestSocket.receive(JSON.stringify({ evt: 'host-down' }));
    },
    disconnectHost() {
      hostOnline = false;
      hostSocket.dropFromServer();
      guestSocket.receive(JSON.stringify({ evt: 'host-down' }));
    },
    resumeHost() {
      vi.advanceTimersByTime(1000);
      hostOnline = true;
      hostSocket.open();
      guestSocket.receive(JSON.stringify({ evt: 'host-up' }));
      hostSocket.receive(JSON.stringify({ evt: 'resume', seat: 1, name: 'Anna' }));
    },
    async close() {
      guest.close();
      await idle();
      host.close();
      roomHost.close();
    },
  };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe('URL du relais selon le mode Vite', () => {
  it.each(['test', 'development'])('sans override en mode %s : HTTP et WS locaux', (mode) => {
    vi.stubEnv('MODE', mode);
    vi.stubEnv('PROD', false);
    vi.stubEnv('VITE_RELAY_URL', undefined);
    expect(relayHttpUrl()).toBe('http://localhost:8787');
    const ws = new URL(roomWsUrl('ABC234', { role: 'guest', name: 'Anne & Bob' }));
    expect(ws.origin).toBe('ws://localhost:8787');
    expect(ws.pathname).toBe('/room/ABC234');
    expect([...ws.searchParams]).toEqual([['role', 'guest'], ['name', 'Anne & Bob']]);
  });

  it('sans override en production : HTTP et WS du Worker', () => {
    vi.stubEnv('PROD', true);
    vi.stubEnv('VITE_RELAY_URL', undefined);
    expect(relayHttpUrl()).toBe(RELAY_URL_PROD);
    const ws = new URL(roomWsUrl('ABC234', { role: 'host', token: 'test-token' }));
    expect(ws.origin).toBe(new URL(RELAY_URL_PROD).origin.replace(/^https/, 'wss'));
    expect(ws.pathname).toBe('/room/ABC234');
    expect(ws.searchParams.get('token')).toBe('test-token');
  });

  it.each([false, true])('override explicite prioritaire (PROD=%s)', (prod) => {
    vi.stubEnv('PROD', prod);
    vi.stubEnv('VITE_RELAY_URL', 'http://localhost:8799');
    expect(relayHttpUrl()).toBe('http://localhost:8799');
    expect(new URL(roomWsUrl('ABC234', { role: 'host' })).origin).toBe('ws://localhost:8799');
    vi.stubEnv('VITE_RELAY_URL', RELAY_URL_PROD);
    expect(relayHttpUrl()).toBe(RELAY_URL_PROD);
  });
});

describe('RelayClient (heartbeat + reconnexion)', () => {
  it('ping toutes les 10 s ; silence > 25 s → fermeture puis reconnexion à backoff', () => {
    const states: string[] = [];
    new RelayClient({ url: () => 'ws://x/room/ABC234?role=host&token=T', makeSocket, onEnvelope: () => {}, onState: (s) => states.push(s) });
    const first = FakeSocket.last!;
    first.open();
    vi.advanceTimersByTime(10_000);
    expect(first.sent).toContain('ping');
    first.receive('pong'); // vivant
    vi.advanceTimersByTime(30_000); // plus aucun pong → le client coupe lui-même
    expect(first.closedWith).not.toBeNull();
    expect(states).toContain('reconnecting');
    vi.advanceTimersByTime(1_000); // 1er retry
    expect(FakeSocket.last).not.toBe(first);
  });

  it('fermeture 4xxx du DO → fatale (raison remontée, AUCUNE reconnexion)', () => {
    const fatal = vi.fn();
    new RelayClient({ url: () => 'ws://x', makeSocket, onEnvelope: () => {}, onFatal: fatal });
    const ws = FakeSocket.last!;
    ws.open();
    ws.dropFromServer(4404, 'Partie inconnue ou expirée.');
    expect(fatal).toHaveBeenCalledWith('Partie inconnue ou expirée.');
    const same = FakeSocket.last;
    vi.advanceTimersByTime(60_000);
    expect(FakeSocket.last).toBe(same); // pas de nouvelle socket
  });
});

describe('RoomHost (démultiplexage par siège)', () => {
  it('join/gone remontent ; les enveloppes {from} sont routées au bon Transport virtuel', async () => {
    const rh = new RoomHost('ABC234', 'T', makeSocket);
    const ws = FakeSocket.last!;
    const onJoin = vi.fn();
    rh.onJoin = onJoin;
    ws.open();
    ws.receive(JSON.stringify({ evt: 'join', seat: 1, name: 'Anna' }));
    expect(onJoin).toHaveBeenCalledWith(1, 'Anna');
    const t1 = rh.seatTransport(1);
    const got: string[] = [];
    t1.onMessage((d) => got.push(d));
    ws.receive(JSON.stringify({ from: 1, data: 'BONJOUR' }));
    await rh.idle();
    expect(got).toEqual(['BONJOUR']);
    t1.send('SALUT');
    await rh.idle();
    expect(JSON.parse(ws.sent[ws.sent.length - 1])).toEqual({ to: 1, data: 'SALUT' });
  });

  it('gros payload → champ z compressé, restituable', async () => {
    const rh = new RoomHost('ABC234', 'T', makeSocket);
    const ws = FakeSocket.last!;
    ws.open();
    const t1 = rh.seatTransport(1);
    const big = JSON.stringify({ blob: 'x'.repeat(5000) });
    t1.send(big);
    await rh.idle();
    const env = JSON.parse(ws.sent[ws.sent.length - 1]) as { to: number; z?: string; data?: string };
    expect(env.data).toBeUndefined();
    expect(await inflateB64(env.z!)).toBe(big);
  });

  it('closeSeat déclenche le onClose du transport virtuel (fin de grace)', () => {
    const rh = new RoomHost('ABC234', 'T', makeSocket);
    FakeSocket.last!.open();
    const t1 = rh.seatTransport(1);
    const closed = vi.fn();
    t1.onClose(closed);
    rh.closeSeat(1);
    expect(closed).toHaveBeenCalled();
  });
});

describe('RoomGuest (Transport + reprise)', () => {
  it('invité assis pendant la coupure hôte : host-up rétablit campagne, snapshot et intents', async () => {
    const session = resumedHostSession();
    try {
      session.disconnectHost();
      session.seatGuest();
      await session.idle();
      expect(session.guest.joined).toBe(false);
      expect(session.applySnapshot).not.toHaveBeenCalled();
      expect(session.host.seats[1]).toBeUndefined();

      session.resumeHost();
      await session.idle();
      expect(session.applySnapshot).toHaveBeenCalledTimes(1);
      expect(session.applySnapshot).toHaveBeenCalledWith({ gameTime: 7 });
      expect(session.guest.joined).toBe(true);
      expect(session.onCampaign).toHaveBeenCalledTimes(1);
      expect(session.onCampaign).toHaveBeenCalledWith(session.campaign);
      expect(session.received).toEqual(['campaign', 'snapshot']);
      expect(session.onHostAway).toHaveBeenLastCalledWith(false);
      session.guest.sendIntent('battleEndTurn', []);
      await session.idle();
      expect(session.applyIntent).toHaveBeenCalledTimes(1);
      expect(session.applyIntent).toHaveBeenCalledWith('battleEndTurn', [], 1);
    } finally {
      await session.close();
    }
  });

  it('invité déjà joint : host-up reçoit spontanément l’état modifié pendant la coupure', async () => {
    const session = resumedHostSession();
    try {
      session.seatGuest();
      await session.idle();
      expect(session.applySnapshot).toHaveBeenCalledTimes(1);
      expect(session.applySnapshot).toHaveBeenCalledWith({ gameTime: 7 });

      session.disconnectHost();
      session.snapshot.gameTime = 9;
      session.resumeHost();
      await session.idle();
      expect(session.applySnapshot).toHaveBeenCalledTimes(2);
      expect(session.applySnapshot).toHaveBeenLastCalledWith({ gameTime: 9 });
      expect(session.onCampaign).toHaveBeenCalledTimes(2);
      expect(session.received).toEqual(['campaign', 'snapshot', 'campaign', 'snapshot']);
      expect(session.applyIntent).not.toHaveBeenCalled();
    } finally {
      await session.close();
    }
  });

  it('seated capture siège+token ; reconnexion → URL avec token + onReconnected', () => {
    const rg = new RoomGuest('ABC234', 'Anna', makeSocket);
    const first = FakeSocket.last!;
    expect(first.url).toContain('name=Anna');
    const reconnected = vi.fn();
    rg.onReconnected = reconnected;
    first.open();
    first.receive(JSON.stringify({ evt: 'seated', seat: 2, token: 'TOK22' }));
    expect(rg.seat).toBe(2);
    first.dropFromServer(1006);
    vi.advanceTimersByTime(1_000);
    const second = FakeSocket.last!;
    expect(second).not.toBe(first);
    expect(second.url).toContain('token=TOK22'); // reprise, plus de name=
    second.open();
    expect(reconnected).toHaveBeenCalled();
  });

  it('délivre data, et close() envoie ctl bye', async () => {
    const rg = new RoomGuest('ABC234', 'Anna', makeSocket);
    const ws = FakeSocket.last!;
    ws.open();
    const got: string[] = [];
    rg.onMessage((d) => got.push(d));
    ws.receive(JSON.stringify({ data: 'COUCOU' }));
    await rg.idle();
    expect(got).toEqual(['COUCOU']);
    rg.close();
    expect(ws.sent).toContain(JSON.stringify({ ctl: 'bye' }));
  });
});
