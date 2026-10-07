/**
 * Couche relay coop : connexion WebSocket au Worker Cloudflare (`server/`), heartbeat +
 * reconnexion à backoff avec reprise de siège par token, et compression des gros payloads
 * (champ `z` — l'enveloppe reste en clair pour le routage par le Durable Object).
 *
 * - `RelayClient`  : une connexion WS robuste (ping/pong, retry, fermetures 4xxx fatales).
 * - `RoomHost`     : démultiplexe l'unique WS hôte en un Transport VIRTUEL par siège —
 *                    `session.ts::addGuest` les consomme sans rien savoir du relay.
 * - `RoomGuest`    : EST un Transport (côté invité).
 * L'ordre des messages est préservé malgré la compression async : chaînes send/recv.
 */
import type { Transport } from './transport';
import { deflateB64, inflateB64 } from './compress';

export const RELAY_URL_PROD = 'https://w4-coop-relay.gauche-c.workers.dev';

export function relayHttpUrl(): string {
  return (import.meta.env?.VITE_RELAY_URL as string | undefined)
    ?? (import.meta.env.PROD ? RELAY_URL_PROD : 'http://localhost:8787');
}

export function roomWsUrl(code: string, params: Record<string, string>): string {
  const base = relayHttpUrl().replace(/^http/, 'ws');
  return `${base}/room/${code}?${new URLSearchParams(params).toString()}`;
}

/** Seuil de compression ; en dessous, le JSON part en clair (champ data). */
const COMPRESS_MIN = 2048;
/** Limite Cloudflare par message WS (1 Mio) — refus explicite, jamais de fermeture muette. */
const WS_MAX = 1_000_000;
const PING_MS = 10_000;
const PONG_TIMEOUT_MS = 25_000;
const RETRY_MAX_MS = 120_000;

export interface SocketLike {
  send(data: string): void;
  close(code?: number, reason?: string): void;
  bufferedAmount?: number;
  onopen: (() => void) | null;
  onmessage: ((e: { data: unknown }) => void) | null;
  onclose: ((e: { code: number; reason: string }) => void) | null;
  onerror: (() => void) | null;
}
export type MakeSocket = (url: string) => SocketLike;
export type ConnState = 'connecting' | 'ok' | 'reconnecting' | 'lost';

export interface RelayOpts {
  /** URL recalculée à CHAQUE tentative — permet d'ajouter le token de reprise. */
  url: () => string;
  makeSocket?: MakeSocket;
  onEnvelope: (env: Record<string, unknown>) => void;
  onState?: (s: ConnState) => void;
  /** Fermetures DÉFINITIVES : code 4xxx du DO (room inconnue/pleine/fermée) ou retry épuisé. */
  onFatal?: (reason: string) => void;
}

export class RelayClient {
  state: ConnState = 'connecting';
  private ws: SocketLike | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private lastPong = 0;
  private retryDelay = 1000;
  private retryStart = 0;
  private closed = false;

  constructor(private readonly opts: RelayOpts) {
    this.open();
  }

  private setState(s: ConnState): void {
    if (this.state === s) return;
    this.state = s;
    this.opts.onState?.(s);
  }

  private stopPing(): void {
    if (this.pingTimer != null) clearInterval(this.pingTimer);
    this.pingTimer = null;
  }

  private open(): void {
    const make = this.opts.makeSocket ?? ((url: string) => new WebSocket(url) as unknown as SocketLike);
    const ws = make(this.opts.url());
    this.ws = ws;
    ws.onopen = () => {
      this.lastPong = Date.now();
      this.retryDelay = 1000;
      this.retryStart = 0;
      this.setState('ok');
      this.pingTimer = setInterval(() => {
        if (Date.now() - this.lastPong > PONG_TIMEOUT_MS) {
          ws.close(); // demi-mort (NAT, veille…) → on coupe franchement, le retry reprend
          return;
        }
        ws.send('ping');
      }, PING_MS);
    };
    ws.onmessage = (e) => {
      if (e.data === 'pong') {
        this.lastPong = Date.now();
        return;
      }
      if (typeof e.data !== 'string') return;
      let env: Record<string, unknown>;
      try {
        env = JSON.parse(e.data) as Record<string, unknown>;
      } catch {
        return;
      }
      this.opts.onEnvelope(env);
    };
    ws.onclose = (e) => {
      this.stopPing();
      this.ws = null;
      if (this.closed) return;
      if (e.code >= 4000) {
        this.setState('lost');
        this.opts.onFatal?.(e.reason || 'Connexion refusée.');
        return;
      }
      this.scheduleRetry();
    };
    ws.onerror = () => {
      /* onclose suit toujours */
    };
  }

  private scheduleRetry(): void {
    if (this.retryStart === 0) this.retryStart = Date.now();
    if (Date.now() - this.retryStart > RETRY_MAX_MS) {
      this.setState('lost');
      this.opts.onFatal?.('Connexion perdue.');
      return;
    }
    this.setState('reconnecting');
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      this.open();
    }, this.retryDelay);
    this.retryDelay = Math.min(this.retryDelay * 2, 10_000);
  }

  sendRaw(text: string): void {
    if (this.state === 'ok') this.ws?.send(text);
  }

  buffered(): number {
    return this.ws?.bufferedAmount ?? 0;
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.stopPing();
    if (this.retryTimer != null) clearTimeout(this.retryTimer);
    this.ws?.close(1000, 'bye');
  }
}

/** Enveloppe un payload : clair si petit, compressé (`z`) sinon ; null si > 1 Mio (refus loggé). */
async function packed(to: number | null, data: string): Promise<Record<string, unknown> | null> {
  const env: Record<string, unknown> = to == null ? {} : { to };
  if (data.length < COMPRESS_MIN) return { ...env, data };
  const z = await deflateB64(data);
  if (z.length > WS_MAX) {
    console.error(`[coop] message trop volumineux (${z.length} o compressés > 1 Mio) — non envoyé`);
    return null;
  }
  return { ...env, z };
}

/** Transport virtuel d'un siège côté hôte (recréé après la grace par netFlow). */
class VirtualSeat implements Transport {
  private msgCb: ((d: string) => void) | null = null;
  private closeCb: (() => void) | null = null;
  constructor(
    private readonly seat: number,
    private readonly out: (seat: number, data: string) => void,
  ) {}
  send(data: string): void {
    this.out(this.seat, data);
  }
  onMessage(cb: (d: string) => void): void {
    this.msgCb = cb;
  }
  onClose(cb: () => void): void {
    this.closeCb = cb;
  }
  close(): void {
    this.fireClose();
  }
  deliver(d: string): void {
    this.msgCb?.(d);
  }
  fireClose(): void {
    this.closeCb?.();
  }
}

export class RoomHost {
  readonly relay: RelayClient;
  onJoin: ((seat: number, name: string) => void) | null = null;
  onResume: ((seat: number, name: string) => void) | null = null;
  onGone: ((seat: number) => void) | null = null;
  onFatal: ((reason: string) => void) | null = null;
  onConnState: ((s: ConnState) => void) | null = null;
  private readonly transports = new Map<number, VirtualSeat>();
  private sendChain: Promise<void> = Promise.resolve();
  private recvChain: Promise<void> = Promise.resolve();

  constructor(code: string, hostToken: string, makeSocket?: MakeSocket) {
    this.relay = new RelayClient({
      url: () => roomWsUrl(code, { role: 'host', token: hostToken }),
      makeSocket,
      onEnvelope: (env) => this.handle(env),
      onState: (s) => this.onConnState?.(s),
      onFatal: (reason) => this.onFatal?.(reason),
    });
  }

  private handle(env: Record<string, unknown>): void {
    if (env.evt === 'join') {
      this.onJoin?.(Number(env.seat), String(env.name ?? ''));
      return;
    }
    if (env.evt === 'resume') {
      this.onResume?.(Number(env.seat), String(env.name ?? ''));
      return;
    }
    if (env.evt === 'gone') {
      this.onGone?.(Number(env.seat));
      return;
    }
    if (typeof env.from !== 'number') return;
    // Décompression SÉQUENTIELLE : l'ordre des messages d'un siège doit être préservé.
    this.recvChain = this.recvChain.then(async () => {
      const text = typeof env.z === 'string' ? await inflateB64(env.z) : typeof env.data === 'string' ? env.data : null;
      if (text != null) this.transports.get(env.from as number)?.deliver(text);
    });
  }

  /** Transport virtuel d'un siège — donné à `session.addGuest(t, seat)`. */
  seatTransport(seat: number): Transport {
    const t = new VirtualSeat(seat, (s, data) => {
      // Compression + envoi SÉQUENTIELS : un petit message ne doit pas doubler un gros en cours.
      this.sendChain = this.sendChain.then(async () => {
        const env = await packed(s, data);
        if (env) this.relay.sendRaw(JSON.stringify(env));
      });
    });
    this.transports.set(seat, t);
    return t;
  }

  /** Fin de grace : ferme le transport virtuel → `onSeatClosed` côté session. */
  closeSeat(seat: number): void {
    this.transports.get(seat)?.fireClose();
    this.transports.delete(seat);
  }

  /** Tests : attendre la fin des chaînes async (compression). */
  async idle(): Promise<void> {
    await this.sendChain;
    await this.recvChain;
  }

  close(): void {
    this.relay.sendRaw(JSON.stringify({ ctl: 'bye' })); // le DO ferme la room pour tout le monde
    this.relay.close();
  }
}

export class RoomGuest implements Transport {
  readonly relay: RelayClient;
  seat = 0;
  token = '';
  onSeated: ((seat: number) => void) | null = null;
  onFatal: ((reason: string) => void) | null = null;
  onReconnected: (() => void) | null = null;
  onHostAway: ((away: boolean) => void) | null = null;
  onConnState: ((s: ConnState) => void) | null = null;
  private msgCb: ((d: string) => void) | null = null;
  private closeCb: (() => void) | null = null;
  private sendChain: Promise<void> = Promise.resolve();
  private recvChain: Promise<void> = Promise.resolve();
  private wasReconnecting = false;

  constructor(code: string, name: string, makeSocket?: MakeSocket, resumeToken?: string) {
    if (resumeToken) this.token = resumeToken;
    this.relay = new RelayClient({
      // Token connu (reprise/reload) → resume ; sinon nouveau join nominatif.
      url: () => roomWsUrl(code, this.token ? { role: 'guest', token: this.token } : { role: 'guest', name }),
      makeSocket,
      onEnvelope: (env) => this.handle(env),
      onState: (s) => {
        this.onConnState?.(s);
        if (s === 'reconnecting') this.wasReconnecting = true;
        if (s === 'ok' && this.wasReconnecting) {
          this.wasReconnecting = false;
          this.onReconnected?.();
        }
        if (s === 'lost') this.closeCb?.();
      },
      onFatal: (reason) => this.onFatal?.(reason),
    });
  }

  private handle(env: Record<string, unknown>): void {
    if (env.evt === 'seated') {
      this.seat = Number(env.seat);
      this.token = String(env.token ?? '');
      this.onSeated?.(this.seat);
      return;
    }
    if (env.evt === 'host-down') {
      this.onHostAway?.(true);
      return;
    }
    if (env.evt === 'host-up') {
      this.onHostAway?.(false);
      this.onReconnected?.();
      return;
    }
    this.recvChain = this.recvChain.then(async () => {
      const text = typeof env.z === 'string' ? await inflateB64(env.z) : typeof env.data === 'string' ? env.data : null;
      if (text != null) this.msgCb?.(text);
    });
  }

  send(data: string): void {
    this.sendChain = this.sendChain.then(async () => {
      const env = await packed(null, data);
      if (env) this.relay.sendRaw(JSON.stringify(env));
    });
  }
  onMessage(cb: (d: string) => void): void {
    this.msgCb = cb;
  }
  onClose(cb: () => void): void {
    this.closeCb = cb;
  }
  /** Tests : attendre la fin des chaînes async (compression). */
  async idle(): Promise<void> {
    await this.sendChain;
    await this.recvChain;
  }
  close(): void {
    this.relay.sendRaw(JSON.stringify({ ctl: 'bye' })); // libère le siège côté DO
    this.relay.close();
  }
}
