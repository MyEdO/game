import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { roomWsUrl, RelayClient, RoomGuest, RoomHost } from './relay';
import { FakeSocket, compressionFactice, minuterieDuTest, portsDuTest } from './relay.testkit';
import { GuestSession, HostSession } from './session';

const BASE = 'http://localhost:8787';

const ports = portsDuTest();

function resumedHostSession() {
  let hostSocket: FakeSocket;
  let hostOnline = true;
  const roomHost = new RoomHost(BASE, 'ABC234', 'T', portsDuTest((url) => {
    hostSocket = new FakeSocket(url);
    hostSocket.onSend = (raw) => {
      const env = JSON.parse(raw) as Record<string, unknown>;
      if (env.to === 1) guestSocket.receive(JSON.stringify({ data: env.data, z: env.z }));
    };
    return hostSocket;
  }));
  const roomGuest = new RoomGuest(BASE, 'ABC234', 'Anna', ports);
  const guestSocket = FakeSocket.last!;
  guestSocket.onSend = (raw) => {
    const env = JSON.parse(raw) as Record<string, unknown>;
    if (hostOnline && (env.data != null || env.z != null)) {
      hostSocket.receive(JSON.stringify({ from: 1, data: env.data, z: env.z }));
    }
  };
  const snapshot = { gameTime: 7 };
  const applySnapshot = vi.fn();
  const applyIntent = vi.fn();
  const host = new HostSession({
    build: 'test', applyIntent,
    getSnapshot: () => ({ ...snapshot }),
  });
  const guest = new GuestSession({ build: 'test', label: 'Anna', applySnapshot });
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
    guest, host, snapshot, applySnapshot, applyIntent, onHostAway,
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

beforeEach(() => {
  vi.useFakeTimers();
  FakeSocket.instances = [];
});
afterEach(() => {
  vi.useRealTimers();
});

describe('URL de la room', () => {
  it('HTTP → WS, chemin de la room, paramètres dans l’ordre', () => {
    const ws = new URL(roomWsUrl(BASE, 'ABC234', { role: 'guest', name: 'Anne & Bob' }));
    expect(ws.origin).toBe('ws://localhost:8787');
    expect(ws.pathname).toBe('/room/ABC234');
    expect([...ws.searchParams]).toEqual([['role', 'guest'], ['name', 'Anne & Bob']]);
  });

  it('HTTPS → WSS', () => {
    const ws = new URL(roomWsUrl('https://relais.example', 'ABC234', { role: 'host', token: 'test-token' }));
    expect(ws.origin).toBe('wss://relais.example');
    expect(ws.searchParams.get('token')).toBe('test-token');
  });
});

describe('RelayClient (heartbeat + reconnexion)', () => {
  it('ping toutes les 10 s ; silence > 25 s → fermeture puis reconnexion à backoff', () => {
    const states: string[] = [];
    new RelayClient({ url: () => 'ws://x/room/ABC234?role=host&token=T', socket: ports.socket, minuterie: minuterieDuTest, onEnvelope: () => {}, onState: (s) => states.push(s) });
    const first = FakeSocket.last!;
    first.open();
    vi.advanceTimersByTime(10_000);
    expect(first.sent).toContain('ping');
    first.receive('pong'); // vivant
    vi.advanceTimersByTime(30_000); // plus aucun pong → le client coupe lui-même
    expect(first.closedWith).not.toBeNull();
    expect(states).toContain('reconnexion');
    vi.advanceTimersByTime(1_000); // 1er retry
    expect(FakeSocket.last).not.toBe(first);
  });

  it('fermeture 4xxx du DO → fatale (raison remontée, AUCUNE reconnexion)', () => {
    const fatal = vi.fn();
    new RelayClient({ url: () => 'ws://x', socket: ports.socket, minuterie: minuterieDuTest, onEnvelope: () => {}, onFatal: fatal });
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
    const rh = new RoomHost(BASE, 'ABC234', 'T', ports);
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
    const rh = new RoomHost(BASE, 'ABC234', 'T', ports);
    const ws = FakeSocket.last!;
    ws.open();
    const t1 = rh.seatTransport(1);
    const big = JSON.stringify({ blob: 'x'.repeat(5000) });
    t1.send(big);
    await rh.idle();
    const env = JSON.parse(ws.sent[ws.sent.length - 1]) as { to: number; z?: string; data?: string };
    expect(env.data).toBeUndefined();
    expect(await compressionFactice.decomprimer(env.z!)).toBe(big);
  });

  it('closeSeat déclenche le onClose du transport virtuel (fin de grace)', () => {
    const rh = new RoomHost(BASE, 'ABC234', 'T', ports);
    FakeSocket.last!.open();
    const t1 = rh.seatTransport(1);
    const closed = vi.fn();
    t1.onClose(closed);
    rh.closeSeat(1);
    expect(closed).toHaveBeenCalled();
  });
});

describe('RoomGuest (Transport + reprise)', () => {
  it('invité assis pendant la coupure hôte : host-up rétablit snapshot et intents', async () => {
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
      expect(session.onHostAway).toHaveBeenLastCalledWith(false);
      session.guest.sendIntent('terminerLeTour', []);
      await session.idle();
      expect(session.applyIntent).toHaveBeenCalledTimes(1);
      expect(session.applyIntent).toHaveBeenCalledWith('terminerLeTour', [], 1);
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
      expect(session.applyIntent).not.toHaveBeenCalled();
    } finally {
      await session.close();
    }
  });

  it('seated capture siège+token ; reconnexion → URL avec token + onReconnected', () => {
    const rg = new RoomGuest(BASE, 'ABC234', 'Anna', ports);
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
    const rg = new RoomGuest(BASE, 'ABC234', 'Anna', ports);
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

describe('panne des chaînes, messages illisibles (#3009)', () => {
  it('`comprimer` lève une fois : la panne, puis l’envoi suivant part', async () => {
    const pannes: unknown[] = [];
    let leve = true;
    const ports = { ...portsDuTest(undefined, (e) => pannes.push(e)), compression: { ...compressionFactice, comprimer: async (texte: string) => {
      if (leve) { leve = false; throw new Error('comprimer'); }
      return compressionFactice.comprimer(texte);
    } } };
    const rh = new RoomHost(BASE, 'ABC234', 'T', ports);
    const ws = FakeSocket.last!;
    ws.open();
    const t1 = rh.seatTransport(1);
    t1.send('x'.repeat(5000));
    t1.send('SUIVANT');
    await rh.idle();
    expect(pannes.map((e) => (e as Error).message)).toEqual(['comprimer']);
    expect(ws.sent.map((raw) => JSON.parse(raw) as unknown)).toEqual([{ to: 1, data: 'SUIVANT' }]);
  });

  it('au-delà de `WS_MAX` : la panne dit la taille, rien n’est envoyé, la console se tait', async () => {
    const pannes: unknown[] = [];
    const console_ = vi.spyOn(console, 'error').mockImplementation(() => {});
    const ports = { ...portsDuTest(undefined, (e) => pannes.push(e)), compression: { ...compressionFactice, comprimer: async () => 'z'.repeat(1_000_001) } };
    const rg = new RoomGuest(BASE, 'ABC234', 'Anna', ports);
    const ws = FakeSocket.last!;
    ws.open();
    rg.send('x'.repeat(5000));
    await rg.idle();
    expect(pannes).toHaveLength(1);
    expect((pannes[0] as Error).message).toContain('1000001 o');
    expect(ws.sent).toEqual([]);
    expect(console_).not.toHaveBeenCalled();
    console_.mockRestore();
  });

  it.each(['pas du json', 'null', '123', '"texte"', '[1]', JSON.stringify({ z: 'invalide' }), JSON.stringify({ from: 1, z: 'invalide' })])(
    'message illisible %s : ni livré, ni dit à la panne, rien ne lève',
    async (brut) => {
      const pannes: unknown[] = [];
      const ports = portsDuTest(undefined, (e) => pannes.push(e));
      const rg = new RoomGuest(BASE, 'ABC234', 'Anna', ports);
      const wsg = FakeSocket.last!;
      const rh = new RoomHost(BASE, 'ABC234', 'T', ports);
      const wsh = FakeSocket.last!;
      wsg.open();
      wsh.open();
      const got: string[] = [];
      rg.onMessage((d) => got.push(d));
      rh.seatTransport(1).onMessage((d) => got.push(d));
      wsg.receive(brut);
      wsh.receive(brut);
      await rg.idle();
      await rh.idle();
      expect(got).toEqual([]);
      expect(pannes).toEqual([]);
    },
  );

  it('client fermé : une enveloppe ne passe plus, un maillon en vol ne livre ni n’envoie', async () => {
    const enVol: (() => void)[] = [];
    const differee = <T,>(valeur: T) => new Promise<T>((r) => { enVol.push(() => r(valeur)); });
    const rg = new RoomGuest(BASE, 'ABC234', 'Anna', { ...ports, compression: {
      comprimer: (texte) => differee(`z:${texte}`),
      decomprimer: (b64) => differee(b64.slice(2)),
    } });
    const ws = FakeSocket.last!;
    ws.open();
    const got: string[] = [];
    const seated = vi.fn();
    rg.onMessage((d) => got.push(d));
    rg.onSeated = seated;
    ws.receive(JSON.stringify({ z: 'z:EN VOL' }));
    rg.send('x'.repeat(5000));
    await vi.advanceTimersByTimeAsync(0);
    expect(enVol).toHaveLength(2);
    rg.close();
    const envoyes = ws.sent.length;
    for (const reprendre of enVol) reprendre();
    ws.receive(JSON.stringify({ evt: 'seated', seat: 2, token: 'TARD' }));
    ws.receive(JSON.stringify({ data: 'TARD' }));
    await rg.idle();
    expect(got).toEqual([]);
    expect(seated).not.toHaveBeenCalled();
    expect(ws.sent).toHaveLength(envoyes);
  });
});
