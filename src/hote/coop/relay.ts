/**
 * Client du relay coop : connexion au Worker Cloudflare (`server/`), heartbeat + reconnexion à backoff avec reprise de
 * siège par token, et compression des gros payloads (champ `z` — l'enveloppe reste en clair pour le routage par le
 * Durable Object). La plateforme s'injecte (`PortsDuRelais`) : la socket, la minuterie, la compression et la panne.
 *
 * - `RelayClient`  : une connexion robuste (ping/pong, retry, fermetures 4xxx fatales).
 * - `RoomHost`     : démultiplexe l'unique socket hôte en un Transport VIRTUEL par siège —
 *                    `session.ts::addGuest` les consomme sans rien savoir du relay.
 * - `RoomGuest`    : EST un Transport (côté invité).
 * L'ordre des messages est préservé malgré la compression async : chaînes send/recv (`enchainer`). Un client fermé ne
 * livre ni n'envoie plus rien.
 */
import type { Transport } from './transport';
import type { VerrouDesMots } from '../../noyau/index';

/** L'URL WebSocket de la room `code` sur le relay d'URL HTTP `base`. */
export function roomWsUrl(base: string, code: string, params: Record<string, string>): string {
  return `${base.replace(/^http/, 'ws')}/room/${code}?${new URLSearchParams(params).toString()}`;
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
export type ConnState = 'connexion' | 'connecte' | 'reconnexion' | 'perdu';
/** VERROU : un état de connexion ne prend que des mots du lexique (#3928). */
const verrouDeConnState: VerrouDesMots<ConnState> = true;
void verrouDeConnState;

/** Un appel différé de l'hôte : `programmer` rend de quoi l'annuler. */
export interface Minuterie {
  programmer(suite: () => void, delai: number): () => void;
}

/** La compression d'un payload en base64url, et sa restitution (null : entrée non fiable). */
export interface Compression {
  comprimer(texte: string): Promise<string>;
  decomprimer(b64: string): Promise<string | null>;
}

/** La plateforme du relay, injectée par l'hôte. */
export interface PortsDuRelais {
  socket: MakeSocket;
  minuterie: Minuterie;
  compression: Compression;
  /** Une levée dans une chaîne send/recv, ou un message refusé ; la chaîne passe au maillon suivant. */
  panne: (erreur: unknown) => void;
}

export interface RelayOpts {
  /** URL recalculée à CHAQUE tentative — permet d'ajouter le token de reprise. */
  url: () => string;
  socket: MakeSocket;
  minuterie: Minuterie;
  onEnvelope: (env: Record<string, unknown>) => void;
  onState?: (s: ConnState) => void;
  /** Fermetures DÉFINITIVES : code 4xxx du DO (room inconnue/pleine/fermée) ou retry épuisé. */
  onFatal?: (reason: string) => void;
}

export class RelayClient {
  state: ConnState = 'connexion';
  private ws: SocketLike | null = null;
  private arreterLePing: (() => void) | null = null;
  private annulerLeRetry: (() => void) | null = null;
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
    this.arreterLePing?.();
    this.arreterLePing = null;
  }

  /** Un battement toutes les `PING_MS`, réarmé à chaque battement. */
  private battre(ws: SocketLike): void {
    this.arreterLePing = this.opts.minuterie.programmer(() => {
      if (Date.now() - this.lastPong > PONG_TIMEOUT_MS) {
        ws.close(); // demi-mort (NAT, veille…) → on coupe franchement, le retry reprend
        return;
      }
      ws.send('ping');
      this.battre(ws);
    }, PING_MS);
  }

  private open(): void {
    const ws = this.opts.socket(this.opts.url());
    this.ws = ws;
    ws.onopen = () => {
      this.lastPong = Date.now();
      this.retryDelay = 1000;
      this.retryStart = 0;
      this.setState('connecte');
      this.battre(ws);
    };
    ws.onmessage = (e) => {
      if (e.data === 'pong') {
        this.lastPong = Date.now();
        return;
      }
      if (this.closed || typeof e.data !== 'string') return;
      let env: unknown;
      try {
        env = JSON.parse(e.data);
      } catch {
        return;
      }
      if (typeof env !== 'object' || env === null || Array.isArray(env)) return;
      this.opts.onEnvelope(env as Record<string, unknown>);
    };
    ws.onclose = (e) => {
      this.stopPing();
      this.ws = null;
      if (this.closed) return;
      if (e.code >= 4000) {
        this.setState('perdu');
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
      this.setState('perdu');
      this.opts.onFatal?.('Connexion perdue.');
      return;
    }
    this.setState('reconnexion');
    this.annulerLeRetry = this.opts.minuterie.programmer(() => {
      this.annulerLeRetry = null;
      this.open();
    }, this.retryDelay);
    this.retryDelay = Math.min(this.retryDelay * 2, 10_000);
  }

  sendRaw(text: string): void {
    if (this.state === 'connecte') this.ws?.send(text);
  }

  /** `close()` est passé : plus rien ne se livre ni ne s'envoie. */
  get ferme(): boolean {
    return this.closed;
  }

  buffered(): number {
    return this.ws?.bufferedAmount ?? 0;
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.stopPing();
    this.annulerLeRetry?.();
    this.ws?.close(1000, 'bye');
  }
}

/** Enveloppe un payload : clair si petit, compressé (`z`) sinon ; lève au-delà de `WS_MAX`. */
async function packed(compression: Compression, to: number | null, data: string): Promise<Record<string, unknown>> {
  const env: Record<string, unknown> = to == null ? {} : { to };
  if (data.length < COMPRESS_MIN) return { ...env, data };
  const z = await compression.comprimer(data);
  if (z.length > WS_MAX) throw new Error(`[coop] message trop volumineux, non envoyé : ${z.length} o compressés > ${WS_MAX} o`);
  return { ...env, z };
}

/** Le texte d'une enveloppe reçue : `z` décompressé, sinon `data` ; null si illisible. */
async function texteRecu(compression: Compression, env: Record<string, unknown>): Promise<string | null> {
  return typeof env.z === 'string' ? compression.decomprimer(env.z) : typeof env.data === 'string' ? env.data : null;
}

/** Le maillon de `chaine` qui `produit` une valeur puis la `livre`, tant que `relay` n'est pas fermé : une levée va à
 *  `panne`, la chaîne passe au maillon suivant. */
function enchainer<T>(chaine: Promise<void>, relay: RelayClient, panne: (erreur: unknown) => void, produire: () => Promise<T | null>, livrer: (valeur: T) => void): Promise<void> {
  return chaine
    .then(async () => {
      const valeur = await produire();
      if (valeur != null && !relay.ferme) livrer(valeur);
    })
    .catch(panne);
}

/** Transport virtuel d'un siège côté hôte (recréé après la grace par `salon.ts`). */
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

  constructor(base: string, code: string, hostToken: string, private readonly ports: PortsDuRelais) {
    this.relay = new RelayClient({
      url: () => roomWsUrl(base, code, { role: 'host', token: hostToken }),
      socket: ports.socket,
      minuterie: ports.minuterie,
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
    const from = env.from;
    if (typeof from !== 'number') return;
    // Décompression SÉQUENTIELLE : l'ordre des messages d'un siège doit être préservé.
    this.recvChain = enchainer(this.recvChain, this.relay, this.ports.panne, () => texteRecu(this.ports.compression, env), (text) => this.transports.get(from)?.deliver(text));
  }

  /** Transport virtuel d'un siège — donné à `session.addGuest(t, seat)`. */
  seatTransport(seat: number): Transport {
    const t = new VirtualSeat(seat, (s, data) => {
      // Compression + envoi SÉQUENTIELS : un petit message ne doit pas doubler un gros en cours.
      this.sendChain = enchainer(this.sendChain, this.relay, this.ports.panne, () => packed(this.ports.compression, s, data), (env) => this.relay.sendRaw(JSON.stringify(env)));
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

  constructor(base: string, code: string, name: string, private readonly ports: PortsDuRelais, resumeToken?: string) {
    if (resumeToken) this.token = resumeToken;
    this.relay = new RelayClient({
      // Token connu (reprise/reload) → resume ; sinon nouveau join nominatif.
      url: () => roomWsUrl(base, code, this.token ? { role: 'guest', token: this.token } : { role: 'guest', name }),
      socket: ports.socket,
      minuterie: ports.minuterie,
      onEnvelope: (env) => this.handle(env),
      onState: (s) => {
        this.onConnState?.(s);
        if (s === 'reconnexion') this.wasReconnecting = true;
        if (s === 'connecte' && this.wasReconnecting) {
          this.wasReconnecting = false;
          this.onReconnected?.();
        }
        if (s === 'perdu') this.closeCb?.();
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
    this.recvChain = enchainer(this.recvChain, this.relay, this.ports.panne, () => texteRecu(this.ports.compression, env), (text) => this.msgCb?.(text));
  }

  send(data: string): void {
    this.sendChain = enchainer(this.sendChain, this.relay, this.ports.panne, () => packed(this.ports.compression, null, data), (env) => this.relay.sendRaw(JSON.stringify(env)));
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
