/**
 * Session coop — modèle HÔTE-AUTORITAIRE sur Transport injecté (transports du relay en prod,
 * FakeTransport en test). L'hôte est le SEUL à exécuter le store : les invités envoient des
 * intents (filtrés par allowlist), l'hôte les rejoue puis diffuse un snapshot d'état complet
 * (mêmes données JSON-sûres que la sauvegarde — cf. spec coop §3). Les sièges sont attribués
 * par la room (Durable Object) et injectés via `addGuest`.
 *
 * Cette couche ignore TOUT du store : `applyIntent`/`getSnapshot`/`applySnapshot` sont
 * injectés — testable sans réseau ni navigateur.
 */
import type { Transport } from './transport';
import { PROTOCOL_VERSION, parseMessage, serializeMessage, type NetMessage } from './protocol';

export interface Seat {
  label: string;
  transport: Transport;
}

export class HostSession {
  /** Sièges CONNECTÉS (handshake accompli), indexés par numéro (1..3 — 0 = l'hôte). */
  readonly seats: Record<number, Seat> = {};

  constructor(
    private readonly opts: {
      build: string;
      /** Actions de store qu'un invité a le droit de demander (le reste est ignoré). */
      allow: ReadonlySet<string>;
      applyIntent: (action: string, args: unknown[], seat: number) => void;
      getSnapshot: () => Record<string, unknown>;
      /** Envoyés au handshake ENTRE hello et snapshot (ex. la campagne custom — spec v2 §5). */
      extraJoinMessages?: () => NetMessage[];
      onSeatClosed?: (seat: number) => void;
    },
  ) {}

  /** Branche le transport d'un invité sur le siège attribué par la room (DO). */
  addGuest(transport: Transport, seat: number): void {
    let joined = false;
    transport.onMessage((raw) => {
      const m = parseMessage(raw);
      if (!m) return;
      if (m.kind === 'hello') {
        if (m.protocol !== PROTOCOL_VERSION) {
          // Motif typé AVANT la fermeture (cf. protocol.ts) : l'invité distingue « versions
          // incompatibles » d'une coupure réseau banale au lieu du chemin onClose générique.
          transport.send(serializeMessage({ kind: 'error', reason: 'protocol-mismatch', expected: PROTOCOL_VERSION, got: m.protocol }));
          transport.close();
          return;
        }
        if (m.build !== this.opts.build) {
          transport.send(serializeMessage({ kind: 'error', reason: 'format-mismatch', expected: this.opts.build, got: m.build }));
          transport.close();
          return;
        }
        this.seats[seat] = { label: m.label, transport };
        joined = true;
        transport.send(serializeMessage({ kind: 'hello', protocol: PROTOCOL_VERSION, build: this.opts.build, label: 'hôte' }));
        for (const extra of this.opts.extraJoinMessages?.() ?? []) transport.send(serializeMessage(extra));
        transport.send(serializeMessage({ kind: 'snapshot', data: this.opts.getSnapshot() }));
        return;
      }
      if (!joined) return; // tout sauf hello avant le handshake : ignoré
      if (m.kind === 'intent') {
        if (this.opts.allow.has(m.action)) this.opts.applyIntent(m.action, m.args, seat);
        return;
      }
      if (m.kind === 'bye') transport.close();
    });
    transport.onClose(() => {
      if (this.seats[seat]) {
        delete this.seats[seat];
        this.opts.onSeatClosed?.(seat);
      }
    });
  }

  /** Diffuse un message à tous les sièges connectés. */
  broadcast(m: NetMessage): void {
    const msg = serializeMessage(m);
    for (const s of Object.values(this.seats)) s.transport.send(msg);
  }

  /** Diffuse l'état autoritaire à tous les sièges connectés. */
  broadcastSnapshot(data: Record<string, unknown>): void {
    this.broadcast({ kind: 'snapshot', data });
  }

  send(seat: number, m: NetMessage): void {
    this.seats[seat]?.transport.send(serializeMessage(m));
  }

  close(): void {
    for (const s of Object.values(this.seats)) s.transport.close();
  }
}

export class GuestSession {
  joined = false;
  private transport: Transport | null = null;

  constructor(
    private readonly opts: {
      build: string;
      label: string;
      applySnapshot: (data: Record<string, unknown>) => void;
      /** Projet de campagne custom reçu au join (enregistré localement pour le rendu). */
      onCampaign?: (m: Extract<NetMessage, { kind: 'campaign' }>) => void;
      onAssign?: (heroId: string, seat: number) => void;
      /** Fermeture VOLONTAIRE de l'hôte pour incompatibilité de protocole (message `error` reçu
       *  AVANT le `onClose` du transport) — distinct d'une coupure réseau banale. */
      onProtocolMismatch?: (expected: number, got: number) => void;
      /** Même chose pour une forme d'état (`build`) différente de celle de l'hôte. */
      onFormatMismatch?: () => void;
      onClosed?: () => void;
    },
  ) {}

  connect(transport: Transport): void {
    this.transport = transport;
    transport.onMessage((raw) => {
      const m = parseMessage(raw);
      if (!m) return;
      if (m.kind === 'hello') {
        this.joined = true;
        return;
      }
      if (m.kind === 'snapshot') {
        this.opts.applySnapshot(m.data);
        return;
      }
      if (m.kind === 'campaign') {
        this.opts.onCampaign?.(m);
        return;
      }
      if (m.kind === 'assign') this.opts.onAssign?.(m.heroId, m.seat);
      if (m.kind === 'error' && m.reason === 'protocol-mismatch') this.opts.onProtocolMismatch?.(m.expected, m.got);
      if (m.kind === 'error' && m.reason === 'format-mismatch') this.opts.onFormatMismatch?.();
    });
    transport.onClose(() => {
      this.joined = false;
      this.opts.onClosed?.();
    });
    this.sayHello();
  }

  private sayHello(): void {
    this.transport?.send(serializeMessage({ kind: 'hello', protocol: PROTOCOL_VERSION, build: this.opts.build, label: this.opts.label }));
  }

  /** Reprise après reconnexion : re-handshake — l'hôte répond hello + extras + snapshot. */
  rejoin(): void {
    this.sayHello();
  }

  /** Demande à l'hôte de rejouer une action de store (il filtrera par allowlist). */
  sendIntent(action: string, args: unknown[]): void {
    this.transport?.send(serializeMessage({ kind: 'intent', action, args, seat: 0 }));
  }

  close(): void {
    this.transport?.send(serializeMessage({ kind: 'bye' }));
    this.transport?.close();
  }
}
