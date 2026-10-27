/**
 * Transport coop — interface minuscule consommée par `session.ts`, implémentations :
 * - `RoomHost`/`RoomGuest` (`net/relay.ts`, hôte web) : WebSocket via le Worker relay (`server/`), prod.
 * - `FakeTransport.pair()` : paire en mémoire pour les tests (session/intents sans réseau).
 */
export interface Transport {
  send(data: string): void;
  onMessage(cb: (data: string) => void): void;
  onClose(cb: () => void): void;
  close(): void;
}

/** Paire de transports en mémoire (tests) : ce que A envoie, B le reçoit, et inversement. */
export class FakeTransport implements Transport {
  private peer: FakeTransport | null = null;
  private msgCb: ((data: string) => void) | null = null;
  private closeCb: (() => void) | null = null;
  private closed = false;

  static pair(): [FakeTransport, FakeTransport] {
    const a = new FakeTransport();
    const b = new FakeTransport();
    a.peer = b;
    b.peer = a;
    return [a, b];
  }

  send(data: string): void {
    if (this.closed || !this.peer) return;
    this.peer.msgCb?.(data);
  }
  onMessage(cb: (data: string) => void): void {
    this.msgCb = cb;
  }
  onClose(cb: () => void): void {
    this.closeCb = cb;
  }
  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.peer?.closeCb?.();
  }
}
