/**
 * Session coop — hôte-autoritaire sur transport injecté (ici FakeTransport, en prod les
 * transports du relay) : handshake hello (version), intents d'invité FILTRÉS par l'allowlist
 * puis rejoués chez l'hôte, snapshots diffusés à tous les sièges, déconnexions, reprise.
 */
import { describe, it, expect, vi } from 'vitest';
import { FakeTransport } from './transport';
import { HostSession, GuestSession } from './session';
import { PROTOCOL_VERSION, serializeMessage } from './protocol';

const wire = (host: HostSession, name = 'Invité', seat = 1) => {
  const [a, b] = FakeTransport.pair();
  const guest = new GuestSession({ build: 'test', label: name, applySnapshot: vi.fn() });
  host.addGuest(a, seat);
  guest.connect(b);
  return { guest, seat };
};

const mkHost = () => {
  const applyIntent = vi.fn();
  const onSeatClosed = vi.fn();
  const host = new HostSession({
    build: 'test',
    allow: new Set(['battleEndTurn', 'battleClickEntity']),
    applyIntent,
    getSnapshot: () => ({ gameTime: 7 }),
    onSeatClosed,
  });
  return { host, applyIntent, onSeatClosed };
};

describe('session coop (net/session)', () => {
  it('handshake : l’invité reçoit hello + snapshot initial, l’hôte connaît le siège', () => {
    const { host } = mkHost();
    const applySnapshot = vi.fn();
    const [a, b] = FakeTransport.pair();
    const guest = new GuestSession({ build: 'test', label: 'Antoine', applySnapshot });
    const seat = 1;
    host.addGuest(a, seat);
    guest.connect(b);
    expect(guest.joined).toBe(true);
    expect(applySnapshot).toHaveBeenCalledWith({ gameTime: 7 });
    expect(host.seats[seat]?.label).toBe('Antoine');
  });

  it('intent allowlisté → applyIntent(action, args, seat) ; non listé → ignoré', () => {
    const { host, applyIntent } = mkHost();
    const { guest, seat } = wire(host);
    guest.sendIntent('battleEndTurn', []);
    expect(applyIntent).toHaveBeenCalledWith('battleEndTurn', [], seat);
    guest.sendIntent('loadGame', [1]); // hors allowlist : jamais rejoué
    expect(applyIntent).toHaveBeenCalledTimes(1);
  });

  it('broadcastSnapshot atteint TOUS les invités', () => {
    const { host } = mkHost();
    const s1 = vi.fn();
    const s2 = vi.fn();
    const [a1, b1] = FakeTransport.pair();
    const [a2, b2] = FakeTransport.pair();
    host.addGuest(a1, 1);
    host.addGuest(a2, 2);
    new GuestSession({ build: 'test', label: 'A', applySnapshot: s1 }).connect(b1);
    new GuestSession({ build: 'test', label: 'B', applySnapshot: s2 }).connect(b2);
    host.broadcastSnapshot({ gameTime: 99 });
    expect(s1).toHaveBeenLastCalledWith({ gameTime: 99 });
    expect(s2).toHaveBeenLastCalledWith({ gameTime: 99 });
  });

  it('version de protocole différente → siège refusé et fermé', () => {
    const { host } = mkHost();
    const [a, b] = FakeTransport.pair();
    const seat = 1;
    host.addGuest(a, seat);
    const closed = vi.fn();
    b.onClose(closed);
    b.send(serializeMessage({ kind: 'hello', protocol: PROTOCOL_VERSION + 1, build: 'x', label: 'Vieux' }));
    expect(host.seats[seat]).toBeUndefined();
    expect(closed).toHaveBeenCalled();
  });

  it('version de protocole différente → l’hôte envoie un motif typé AVANT de fermer, l’invité le distingue', () => {
    const { host } = mkHost();
    const [a, b] = FakeTransport.pair();
    const onProtocolMismatch = vi.fn();
    const onClosed = vi.fn();
    const order: string[] = [];
    const guest = new GuestSession({
      build: 'test',
      label: 'Invité',
      applySnapshot: vi.fn(),
      onProtocolMismatch: (expected, got) => {
        order.push('error');
        onProtocolMismatch(expected, got);
      },
      onClosed: () => {
        order.push('closed');
        onClosed();
      },
    });
    host.addGuest(a, 1);
    guest.connect(b); // handshake normal (même PROTOCOL_VERSION) → joined
    expect(guest.joined).toBe(true);
    // Rejoue un hello DÉCALÉ sur le même fil (ex. l'hôte redémarre sur une build incompatible) :
    // l'hôte doit émettre `error` AVANT de fermer, l'invité doit le recevoir avant le onClose générique.
    b.send(serializeMessage({ kind: 'hello', protocol: PROTOCOL_VERSION + 1, build: 'y', label: 'Invité' }));
    expect(onProtocolMismatch).toHaveBeenCalledWith(PROTOCOL_VERSION, PROTOCOL_VERSION + 1);
    expect(onClosed).toHaveBeenCalled();
    expect(order).toEqual(['error', 'closed']); // motif typé avant la fermeture générique
  });

  it('empreinte de format (`build`) différente → l’hôte envoie le motif typé, refuse le siège et ferme', () => {
    const { host } = mkHost();
    const [a, b] = FakeTransport.pair();
    const order: string[] = [];
    const guest = new GuestSession({
      build: 'autre-empreinte',
      label: 'Invité',
      applySnapshot: vi.fn(),
      onFormatMismatch: () => order.push('format'),
      onClosed: () => order.push('closed'),
    });
    host.addGuest(a, 1);
    guest.connect(b);
    expect(host.seats[1]).toBeUndefined();
    expect(guest.joined).toBe(false);
    expect(order).toEqual(['format', 'closed']);
  });

  it('déconnexion d’un invité → onSeatClosed(seat)', () => {
    const { host, onSeatClosed } = mkHost();
    const { guest, seat } = wire(host);
    guest.close();
    expect(onSeatClosed).toHaveBeenCalledWith(seat);
    expect(host.seats[seat]).toBeUndefined();
  });

  it('extraJoinMessages : envoyés entre hello et snapshot (campagne avant le 1er état)', () => {
    const order: string[] = [];
    const host = new HostSession({
      build: 'test',
      allow: new Set(),
      applyIntent: vi.fn(),
      getSnapshot: () => ({ gameTime: 1 }),
      extraJoinMessages: () => [{ kind: 'campaign', label: 'P', scenes: [], startSceneId: 's', worldMap: null }],
    });
    const [a, b] = FakeTransport.pair();
    host.addGuest(a, 1);
    const guest = new GuestSession({
      build: 'test',
      label: 'A',
      applySnapshot: () => order.push('snapshot'),
      onCampaign: () => order.push('campaign'),
    });
    guest.connect(b);
    expect(order).toEqual(['campaign', 'snapshot']);
  });

  it('rejoin : re-handshake après reconnexion → l’hôte renvoie un snapshot complet', () => {
    const { host } = mkHost();
    const applySnapshot = vi.fn();
    const [a, b] = FakeTransport.pair();
    const guest = new GuestSession({ build: 'test', label: 'A', applySnapshot });
    host.addGuest(a, 1);
    guest.connect(b);
    expect(applySnapshot).toHaveBeenCalledTimes(1);
    guest.rejoin();
    expect(applySnapshot).toHaveBeenCalledTimes(2);
  });

  it('un message illisible sur le fil ne casse rien (entrée non fiable)', () => {
    const { host, applyIntent } = mkHost();
    const [a, b] = FakeTransport.pair();
    host.addGuest(a, 1);
    b.send('{pas du json');
    b.send('{"kind":"intent"}');
    expect(applyIntent).not.toHaveBeenCalled();
  });
});
