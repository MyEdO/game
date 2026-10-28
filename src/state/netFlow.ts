/**
 * Couture STORE ↔ réseau coop — module `(get,set)` comme combatFlow.
 *
 * Modèle hôte-autoritaire (spec coop §3) sur le relay WebSocket (`src/net/relay.ts`) :
 *  - HÔTE : crée une room sur le Worker (code 6 caractères à partager), exécute le store
 *    normalement ; un abonnement zustand THROTTLÉ diffuse un snapshot d'état complet après
 *    chaque changement — couvre aussi les tours d'IA (timers) sans instrumenter chaque action.
 *  - INVITÉ : rejoint par code ; les actions de combat de l'allowlist sont INTERCEPTÉES
 *    (enrobées au branchement, restaurées au départ) → parties en intent vers l'hôte ;
 *    l'état local n'est QUE le reflet des snapshots reçus.
 *
 * Reconnexion (spec v2 §6) : coupure d'un invité → son siège est réservé GRACE_MS (présence
 * « away » côté hôte), il reprend par token (y compris après un F5 : token en sessionStorage) ;
 * passé la grace, ses héros reviennent à l'hôte. La campagne custom voyage UNE fois au join
 * (message `paquetDeCampagne`), jamais dans les snapshots.
 *
 * Les objets réseau vivants (sessions, sockets) restent des SINGLETONS de module — jamais dans
 * le store (non sérialisables, jamais dans les snapshots).
 */
import type { GameState, RemplacerLEtat } from './store';
import { remettreLAdaptateur, useGame } from './store';
import { buildDeLaCoop, instantaneDeLaCoop, appliquerLInstantane } from '../noyau/coop';
import { HostSession, GuestSession } from '../hote/coop/session';
import { sanitizeIntentArgs } from './intents';
import { GUEST_INTENTS, appliquerLIntentionDUnSiege } from '../noyau/intentionsDeSiege';
import { argsAvecVerdictLocal } from '../noyau/localIntent';
import { RoomGuest, RoomHost, relayHttpUrl } from '../net/relay';
import { intentEluLocalement } from '../noyau/targetingModes';
import { bus, EVT } from '../noyau/bus';
import { scheduleFlowTimer, clearTrackedTimer } from '../web/minuteries';

import type { Get, Set } from '../noyau/flowTypes';
import { initialNet, type NetState } from '../noyau/etat';
import { attribuerLEmplacement, attribuerLeHeros, fermerLeSiege, poserLeSiegeMJ } from '../noyau/sieges';
import { t } from '../i18n';
import { stockageWeb } from '../web/stockageWeb';

/** Le nom d'un siège de coop : celui que le joueur a donné, sinon « Hôte » (siège 0) ou « Joueur n » (#1906) —
 *  SOURCE UNIQUE, jamais « L'hôte » pour un invité. */
export function nomDuSiege(net: Pick<NetState, 'seatNames'>, seat: number): string {
  return net.seatNames[seat] ?? (seat === 0 ? t('party.seat.host') : t('party.seat.player', { n: seat + 1 }));
}

// ── Singletons réseau (non sérialisables) ──────────────────────────────────────────────────────
let host: HostSession | null = null;
let guest: GuestSession | null = null;
let roomHost: RoomHost | null = null;
let roomGuest: RoomGuest | null = null;
let unsubscribe: (() => void) | null = null;
let originals: Record<string, (...args: unknown[]) => unknown> | null = null;
let broadcastTimer: ReturnType<typeof setTimeout> | null = null;
const graceTimers = new Map<number, ReturnType<typeof setTimeout>>();

/** Siège réservé pendant la reconnexion d'un invité (spec v2 §6). */
export const GRACE_MS = 120_000;
/** Backpressure : au-delà, on diffère le snapshot (seul le DERNIER état partira). */
const BUFFER_MAX = 256 * 1024;
/** Token de reprise persisté par room — un reload de l'onglet reprend le même siège. */
const tokenKey = (code: string) => `wfrp4.coop.token.${code}`;

/** Diffusion throttlée (trailing ~120 ms) : une rafale de mutations (tour d'IA) = un snapshot.
 *  Upload saturé (bufferedAmount) → on retente, seul le DERNIER état partira (coalescing). */
function scheduleBroadcast(get: Get): void {
  if (!host || broadcastTimer != null) return;
  broadcastTimer = scheduleFlowTimer(() => {
    broadcastTimer = null;
    if (!host) return;
    if ((roomHost?.relay.buffered() ?? 0) > BUFFER_MAX) {
      scheduleBroadcast(get);
      return;
    }
    host.broadcastSnapshot();
  }, 120);
}

/** L'invité applique un snapshot (`appliquerLInstantane`). Son interface se remet comme chez l'hôte
 *  (`remettreLAdaptateur`) quand la scène ou la partie change. */
export function applyNetSnapshot(set: RemplacerLEtat, data: Record<string, unknown>): void {
  const mine = useGame.getState();
  const { etat, neuve, autreScene } = appliquerLInstantane(data, mine);
  if (neuve || autreScene) remettreLAdaptateur(neuve);
  set(etat);
  bus.emit(EVT.SCENE_DIRTY);
}

/**
 * SUBSTITUT D'INVITÉ pour UNE action de l'allowlist — corps UNIQUE de l'enrobage, isolé pour être
 * éprouvable hors session (une session réelle exige un relay).
 *
 * Deux sorts, dans cet ordre :
 *  - ÉLECTION LOCALE (`intentEluLocalement`) : le clic n'ouvre qu'un CHOIX D'ÉCRAN — le paramètre
 *    borné qui reste à demander — et se joue ENTIER dans le store du client, par son action locale.
 *    Rien ne part : le porteur élu est hors snapshot, l'exécuter chez l'hôte y ferait naître un
 *    panneau étranger et n'en montrerait aucun à l'émetteur ;
 *  - sinon l'intent PART, avec le VERDICT D'ARMEMENT calculé ICI, chez l'émetteur
 *    (`argsAvecVerdictLocal`) : l'intention est locale au client, l'hôte ne peut pas la relire dans
 *    son propre store.
 */
export function emettreIntentInvite(
  name: string,
  local: (...args: unknown[]) => unknown,
  envoyer: (action: string, args: unknown[]) => void,
  args: unknown[],
): void {
  if (intentEluLocalement(useGame.getState, name, args)) {
    local(...args);
    return;
  }
  envoyer(name, sanitizeIntentArgs(argsAvecVerdictLocal(useGame.getState, name, args)));
}

/** INVITÉ : enrobe les actions de l'allowlist → intents (l'état viendra du snapshot de l'hôte). */
export function interceptGuestActions(): void {
  if (originals) return;
  originals = {};
  const state = useGame.getState() as unknown as Record<string, unknown>;
  const wrapped: Record<string, unknown> = {};
  for (const name of GUEST_INTENTS) {
    const fn = state[name];
    if (typeof fn !== 'function') continue;
    const local = fn as (...args: unknown[]) => unknown;
    originals[name] = local;
    wrapped[name] = (...args: unknown[]) =>
      emettreIntentInvite(name, local, (action, a) => guest?.sendIntent(action, a), args);
  }
  useGame.setState(wrapped as Partial<GameState>);
}

/** Restaure les actions locales (fin de session invité). */
export function restoreGuestActions(): void {
  if (!originals) return;
  useGame.setState(originals as unknown as Partial<GameState>);
  originals = null;
}

function setPresence(get: Get, set: Set, seat: number, p: 'ok' | 'away'): void {
  set({ net: { ...get().net, presence: { ...get().net.presence, [seat]: p } } });
}

// ── Actions de store (déléguées par store.ts) ──────────────────────────────────────────────────

/** Devient HÔTE : crée la room sur le Worker → code court, attend les invités.
 *  false = service injoignable (l'UI affiche l'erreur). */
export async function netHostStart(get: Get, set: Set, name: string): Promise<boolean> {
  if (get().net.mode !== 'local') return false;
  let room: { code: string; hostToken: string };
  try {
    const res = await fetch(`${relayHttpUrl()}/rooms`, { method: 'POST' });
    if (!res.ok) return false;
    room = (await res.json()) as { code: string; hostToken: string };
  } catch {
    return false;
  }
  const rh = new RoomHost(room.code, room.hostToken);
  roomHost = rh;
  host = new HostSession({
    build: buildDeLaCoop(),
    applyIntent: (action, args, seat) => appliquerLIntentionDUnSiege(get, seat, action, args),
    getSnapshot: () => instantaneDeLaCoop(get()),
    campagne: () => get().pendingCampaign,
    onSeatClosed: (seat) => netSeatClosed(get, set, seat),
  });
  rh.onFatal = () => {
    get().log(t('coop.hostLinkLost'));
    netLeave(get, set);
  };
  rh.onJoin = (seat, gname) => {
    host?.addGuest(rh.seatTransport(seat), seat);
    set({ net: { ...get().net, seatNames: { ...get().net.seatNames, [seat]: gname }, presence: { ...get().net.presence, [seat]: 'ok' } } });
  };
  rh.onResume = (seat, gname) => {
    const t = graceTimers.get(seat);
    if (t != null) {
      clearTrackedTimer(t);
      graceTimers.delete(seat);
    }
    // Revenu APRÈS la grace : son siège a été fermé → re-join sur le même siège.
    if (!host?.seats[seat]) host?.addGuest(rh.seatTransport(seat), seat);
    set({ net: { ...get().net, seatNames: { ...get().net.seatNames, [seat]: gname }, presence: { ...get().net.presence, [seat]: 'ok' } } });
  };
  rh.onGone = (seat) => {
    setPresence(get, set, seat, 'away');
    graceTimers.set(seat, scheduleFlowTimer(() => {
      graceTimers.delete(seat);
      rh.closeSeat(seat); // → onClose du transport virtuel → onSeatClosed (héros à l'hôte)
    }, GRACE_MS));
  };
  set({ net: { ...initialNet(), mode: 'host', roomCode: room.code, seatNames: { 0: name } } });
  unsubscribe = useGame.subscribe(() => scheduleBroadcast(get));
  return true;
}

/** INVITÉ : rejoint une room par son code. Résout null si connecté, sinon le message d'erreur.
 *  Un token en sessionStorage (reload d'onglet) reprend le MÊME siège tant que la room vit. */
export function netJoin(get: Get, set: Set, appliquerSnapshot: (data: Record<string, unknown>) => void, codeRaw: string, name: string): Promise<string | null> {
  if (get().net.mode !== 'local') return Promise.resolve(t('coop.alreadyInSession'));
  const code = codeRaw.trim().toUpperCase();
  if (!/^[A-Z0-9]{6}$/.test(code)) return Promise.resolve(t('coop.badCode'));
  const stored = stockageWeb('sessionStorage')?.getItem(tokenKey(code)) ?? undefined;
  return new Promise((resolve) => {
    let settled = false;
    const fail = (msg: string) => {
      if (settled) return;
      settled = true;
      netLeave(get, set);
      resolve(msg);
    };
    const timeout = scheduleFlowTimer(() => fail(t('coop.joinFailed')), 15_000);
    const rg = new RoomGuest(code, name, undefined, stored);
    roomGuest = rg;
    rg.onFatal = (reason) => {
      if (settled) {
        get().log(t('coop.reason', { reason }));
        netLeave(get, set);
        return;
      }
      fail(reason);
    };
    rg.onHostAway = (away) => {
      if (get().net.mode === 'guest') set({ net: { ...get().net, hostAway: away } });
    };
    rg.onConnState = (s) => {
      if (get().net.mode === 'guest') set({ net: { ...get().net, connection: s === 'ok' ? 'ok' : 'reconnecting' } });
    };
    rg.onReconnected = () => guest?.rejoin();
    rg.onSeated = (seat) => {
      stockageWeb('sessionStorage')?.setItem(tokenKey(code), rg.token);
      if (settled) return; // reprise en cours de partie : déjà câblé
      settled = true;
      clearTrackedTimer(timeout);
      guest = new GuestSession({
        build: buildDeLaCoop(),
        label: name,
        applySnapshot: appliquerSnapshot,
        // Motif typé de l'hôte (mismatch de protocole) : canal réutilisé du journal réseau
        // (déjà utilisé pour « Un joueur a quitté »/« Connexion perdue ») — distinct du
        // onClose générique qui suit juste après (silencieux, cf. session.ts).
        onProtocolMismatch: (expected, got) =>
          get().log(t('coop.protocolMismatch', { got, expected })),
        onFormatMismatch: () => get().log(t('coop.formatMismatch')),
        onClosed: () => netLeave(get, set),
      });
      set({ net: { ...initialNet(), mode: 'guest', mySeat: seat, roomCode: code, seatNames: { [seat]: name } } });
      interceptGuestActions();
      guest.connect(rg);
      resolve(null);
    };
  });
}

/** HÔTE : siège FERMÉ (départ définitif, fin de grâce) — `fermerLeSiege` (spec §6). */
export function netSeatClosed(get: Get, set: Set, seat: number): void {
  set({ net: fermerLeSiege(get().net, seat) });
  get().log(t('coop.seatClosed'));
}

/** Pose `net` s'il diffère du réseau courant : un réducteur qui refuse rend `net` inchangé. */
function poserLeReseau(get: Get, set: Set, net: NetState): void {
  if (net !== get().net) set({ net });
}

/** `attribuerLeHeros` (`noyau/sieges.ts`). */
export function netAssign(get: Get, set: Set, heroId: string, seat: number): void {
  poserLeReseau(get, set, attribuerLeHeros(get().net, heroId, seat));
}

/** `poserLeSiegeMJ` (`noyau/sieges.ts`). */
export function setGmSeat(get: Get, set: Set, seat: number | null): void {
  poserLeReseau(get, set, poserLeSiegeMJ(get().net, seat));
}

/** `attribuerLEmplacement` (`noyau/sieges.ts`). */
export function netAssignSlot(get: Get, set: Set, slot: number, seat: number): void {
  poserLeReseau(get, set, attribuerLEmplacement(get().net, slot, seat));
}

/** Quitte la session (les deux rôles) — retour au mode local, actions restaurées. */
export function netLeave(_get: Get, set: Set): void {
  unsubscribe?.();
  unsubscribe = null;
  if (broadcastTimer != null) {
    clearTrackedTimer(broadcastTimer);
    broadcastTimer = null;
  }
  for (const t of graceTimers.values()) clearTrackedTimer(t);
  graceTimers.clear();
  host?.close();
  host = null;
  guest?.close();
  guest = null;
  roomHost?.close();
  roomHost = null;
  roomGuest?.close();
  roomGuest = null;
  restoreGuestActions();
  set({ net: initialNet() });
}
