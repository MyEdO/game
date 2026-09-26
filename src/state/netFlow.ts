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
 * (message `campaign`), jamais dans les snapshots.
 *
 * Les objets réseau vivants (sessions, sockets) restent des SINGLETONS de module — jamais dans
 * le store (non sérialisables, jamais dans les snapshots).
 */
import type { GameState } from './store';
import { useGame, registerScene, reposerPaquetDeCampagne } from './store';
import { snapshotSave, packHouseRules, unpackHouseRules } from './saves';
import { ruleOverrides, loadRuleOverrides } from '../engine/policy';
import { HostSession, GuestSession } from '../net/session';
import { GUEST_INTENTS, sanitizeIntentArgs } from '../net/intents';
import { intentAllowedFor, withActingSeat } from './netOwnership';
import { argsAvecVerdictLocal } from './localIntent';
import { RoomGuest, RoomHost, relayHttpUrl } from '../net/relay';
import type { NetMessage } from '../net/protocol';
import type { Scene } from './scene';
import { intentEluLocalement } from './targetingModes';
import { bus, EVT } from './bus';
import { scheduleFlowTimer, clearTrackedTimer } from './combatTimers';

import type { Get, Set } from './flowTypes';
import { t } from '../i18n';

/** Le nom d'un siège de coop : celui que le joueur a donné, sinon « Hôte » (siège 0) ou « Joueur n » (#1906) —
 *  SOURCE UNIQUE, jamais « L'hôte » pour un invité. */
export function nomDuSiege(net: Pick<NetState, 'seatNames'>, seat: number): string {
  return net.seatNames[seat] ?? (seat === 0 ? t('party.seat.host') : t('party.seat.player', { n: seat + 1 }));
}

/** État réseau SÉRIALISABLE (dans GameState). `ownership` : heroId → siège (0 = hôte).
 *  `slots` : siège attribué à chacun des 4 emplacements de l'écran d'équipe (0 = hôte). */
export interface NetState {
  mode: 'local' | 'host' | 'guest';
  mySeat: number;
  /** Code de room à 6 caractères (affiché/copiable par l'hôte, voyage dans les snapshots). */
  roomCode: string | null;
  seatNames: Record<number, string>;
  /** Vue HÔTE : sièges en cours de reconnexion (absent = connecté). */
  presence: Record<number, 'ok' | 'away'>;
  /** Vue INVITÉ : sa propre connexion (préservée à l'application des snapshots). */
  connection: 'ok' | 'reconnecting';
  /** Vue INVITÉ : l'hôte est-il momentanément déconnecté ? */
  hostAway: boolean;
  ownership: Record<string, number>;
  slots: number[];
  /** Rôle MJ (bac-à-sable) : le siège qui conduit TOUT le camp ennemi + les jets du monde, sur toutes les
   *  rencontres. `undefined` = IA (défaut, solo ET coop). UNIQUE (zéro ou un siège). Sérialisable (voyage
   *  dans les snapshots coop). Cf. `pilotedByHuman`/`aiDriven`/`controlsCombatant` (netOwnership). */
  gmSeat?: number;
}
export const initialNet = (): NetState => ({
  mode: 'local', mySeat: 0, roomCode: null, seatNames: {}, presence: {},
  connection: 'ok', hostAway: false, ownership: {}, slots: [0, 0, 0, 0],
});

// ── Singletons réseau (non sérialisables) ──────────────────────────────────────────────────────
let host: HostSession | null = null;
let guest: GuestSession | null = null;
let roomHost: RoomHost | null = null;
let roomGuest: RoomGuest | null = null;
let unsubscribe: (() => void) | null = null;
let originals: Record<string, (...args: unknown[]) => unknown> | null = null;
let broadcastTimer: ReturnType<typeof setTimeout> | null = null;
const graceTimers = new Map<number, ReturnType<typeof setTimeout>>();
let lastCampaign: unknown = null;

/** Siège réservé pendant la reconnexion d'un invité (spec v2 §6). */
export const GRACE_MS = 120_000;
/** Backpressure : au-delà, on diffère le snapshot (seul le DERNIER état partira). */
const BUFFER_MAX = 256 * 1024;
/** Token de reprise persisté par room — un reload de l'onglet reprend le même siège. */
const tokenKey = (code: string) => `wfrp4.coop.token.${code}`;

export const BUILD_ID = 'w4-dev'; // V1 : même build requis de part et d'autre (check au hello)

/** Snapshot d'état pour le réseau — mêmes clés que la sauvegarde, SANS les scènes du projet de
 *  campagne (313 Ko pour l'Arène : elles voyagent UNE fois au join via le message `campaign`,
 *  spec v2 §5). Un stub nom-seul reste : les invités affichent la campagne choisie (cartouche
 *  de l'écran d'équipe) sans jamais la charger eux-mêmes (« Commencer » est hôte-seul).
 *  La FORME de ce `data` est celle de la sauvegarde : `PROTOCOL_VERSION` (`net/protocol.ts`) versionne
 *  les messages, pas leur charge — c'est `SAVE_VERSION` qui date cette forme, et `BUILD_ID` ci-dessus
 *  qui refuse deux clients de builds différents au `hello`. */
export function netSnapshot(get: Get): Record<string, unknown> {
  const { data } = snapshotSave(
    get() as unknown as Record<string, unknown>,
    useGame.getInitialState() as unknown as Record<string, unknown>,
    'net',
  );
  const pc = (data as { pendingCampaign?: GameState['pendingCampaign'] }).pendingCampaign;
  (data as Record<string, unknown>).pendingCampaign = pc
    ? { label: pc.label, scenes: [], startSceneId: pc.startSceneId, worldMap: null }
    : null;
  // L'INTENTION armée est un mode d'ÉCRAN, LOCAL au client (spec HUD zone 4) : elle ne voyage pas —
  // la case armée de l'hôte n'a rien à allumer chez ses invités.
  delete (data as Record<string, unknown>).localIntent;
  // MÊME raison pour le PORTEUR élu du mode Dissiper : le clic-token qui l'élit n'engage rien, il
  // ouvre le choix du paramètre CHEZ CE JOUEUR (spec HUD §1d). L'élection se joue donc chez
  // l'ÉMETTEUR (`emettreIntentInvite`), jamais par un intent — sinon elle atterrirait ici, à l'hôte.
  delete (data as Record<string, unknown>).dispelCarrierId;
  // MÊME raison pour le REFUS de geste (`refusVisible.ts`) : c'est la réponse faite à CE joueur sur SON
  // clic. L'hôte qui refuse son propre geste n'a rien à dire aux autres tables ; et quand il exécute
  // l'intent d'un invité, le refus éventuel appartient à l'invité, pas au sien.
  delete (data as Record<string, unknown>).refus;
  // Les règles maison de l'HÔTE voyagent avec l'état → parité hôte/invité (sinon l'invité calcule
  // sur SES propres surcharges localStorage et diverge).
  return packHouseRules(data, ruleOverrides());
}

function campaignMessage(pc: NonNullable<GameState['pendingCampaign']>): NetMessage {
  return { kind: 'campaign', label: pc.label, scenes: pc.scenes, startSceneId: pc.startSceneId, worldMap: pc.worldMap ?? null };
}

function campaignMessages(get: Get): NetMessage[] {
  const pc = get().pendingCampaign;
  if (pc) lastCampaign = pc;
  return pc ? [campaignMessage(pc)] : [];
}

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
    const pc = get().pendingCampaign;
    if (pc && pc !== lastCampaign) {
      lastCampaign = pc;
      host.broadcast(campaignMessage(pc)); // campagne chargée APRÈS le join → rattrapage
    }
    host.broadcastSnapshot(netSnapshot(get));
  }, 120);
}

/** L'invité applique un snapshot : état de l'hôte + SON identité réseau préservée.
 *  Pendant la composition d'équipe, son écran « créateur » LOCAL est aussi préservé (sinon
 *  chaque broadcast de l'hôte l'éjecterait en pleine création et perdrait son brouillon).
 *  L'INTENTION armée (`localIntent`, spec HUD zone 4) l'est au même titre : c'est un mode d'ÉCRAN du
 *  client — un snapshot de l'hôte (arrivant toutes les ~120 ms) désarmerait la case sous le doigt. */
export function applyNetSnapshot(set: Set, data: Record<string, unknown>): void {
  const base = JSON.parse(JSON.stringify(useGame.getInitialState())) as Partial<GameState>;
  const mine = useGame.getState();
  const { game, rules } = unpackHouseRules(data);
  if (rules) loadRuleOverrides(rules); // l'invité adopte les règles maison de l'hôte (parité)
  const incoming = (game as { net?: NetState }).net;
  const keepCreator = mine.screen === 'creator' && (game as Partial<GameState>).screen === 'party';
  set({
    ...base,
    ...(game as Partial<GameState>),
    ...reposerPaquetDeCampagne((game as Partial<GameState>).campaignDoc),
    ...(keepCreator ? { screen: 'creator' as const } : null),
    localIntent: mine.localIntent,
    dispelCarrierId: mine.dispelCarrierId, // le porteur élu est le choix EN COURS de ce client
    refus: mine.refus, // le refus du CLIENT survit au snapshot : c'est SON retour de geste

    net: {
      ...(incoming ?? mine.net),
      mode: 'guest',
      mySeat: mine.net.mySeat,
      connection: mine.net.connection,
      hostAway: mine.net.hostAway,
    },
  });
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
    build: BUILD_ID,
    allow: GUEST_INTENTS,
    applyIntent: (action, args, seat) => {
      // Validation de POSSESSION (spec §4bis) : un invité ne pilote que SES combattants —
      // modale ouverte → seul son concerné agit ; sinon seul le propriétaire du tour actif.
      if (!intentAllowedFor(useGame.getState(), seat, action, args)) {
        get().log(t('coop.intentRefused', { action }));
        return;
      }
      // Composition d'équipe : le siège vient du transport, jamais des args de l'invité.
      // add = [hero, wealth, seat] ; replace = [oldId, hero, seat] → siège en 3ᵉ dans les deux cas.
      if (action === 'partyAddHero' || action === 'partyReplaceHero') args = [args[0], args[1], seat];
      const fn = (useGame.getState() as unknown as Record<string, unknown>)[action];
      // SIÈGE AGISSANT (#1017) : l'action s'exécute dans le store de l'HÔTE, mais AU NOM du siège
      // émetteur — sans quoi les gardes d'action bâties sur « le siège local possède-t-il ce
      // combattant ? » (`controlsCombatant`, ~30 sites de `combatSlice`) refusent en silence le geste
      // d'un invité sur SON propre héros. Couvre l'appel SYNCHRONE (cf. `withActingSeat`).
      if (typeof fn === 'function') withActingSeat(seat, () => (fn as (...a: unknown[]) => void)(...args));
    },
    getSnapshot: () => netSnapshot(get),
    extraJoinMessages: () => campaignMessages(get),
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
export function netJoin(get: Get, set: Set, codeRaw: string, name: string): Promise<string | null> {
  if (get().net.mode !== 'local') return Promise.resolve(t('coop.alreadyInSession'));
  const code = codeRaw.trim().toUpperCase();
  if (!/^[A-Z0-9]{6}$/.test(code)) return Promise.resolve(t('coop.badCode'));
  const stored = sessionStorage.getItem(tokenKey(code)) ?? undefined;
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
      sessionStorage.setItem(tokenKey(code), rg.token);
      if (settled) return; // reprise en cours de partie : déjà câblé
      settled = true;
      clearTrackedTimer(timeout);
      guest = new GuestSession({
        build: BUILD_ID,
        label: name,
        applySnapshot: (data) => applyNetSnapshot(set, data),
        onCampaign: (m) => {
          for (const s of m.scenes) registerScene(s as Scene);
        },
        // Motif typé de l'hôte (mismatch de protocole) : canal réutilisé du journal réseau
        // (déjà utilisé pour « Un joueur a quitté »/« Connexion perdue ») — distinct du
        // onClose générique qui suit juste après (silencieux, cf. session.ts).
        onProtocolMismatch: (expected, got) =>
          get().log(t('coop.protocolMismatch', { got, expected })),
        onClosed: () => netLeave(get, set),
      });
      set({ net: { ...initialNet(), mode: 'guest', mySeat: seat, roomCode: code, seatNames: { [seat]: name } } });
      interceptGuestActions();
      guest.connect(rg);
      resolve(null);
    };
  });
}

/** HÔTE : siège FERMÉ (départ définitif, fin de grâce). Ses héros ET ses emplacements reviennent à
 *  l'hôte (spec §6) — son ✓ ne sera plus requis. S'il portait le RÔLE MJ, le rôle est RETIRÉ : sans
 *  cette purge, `gmSeat` désignerait un siège absent — les ennemis resteraient « conduits par un
 *  humain » (`pilotedByHuman`) et leurs modales n'appartiendraient à personne. */
export function netSeatClosed(get: Get, set: Set, seat: number): void {
  const { seatNames, presence, ownership, slots, gmSeat } = get().net;
  const names = { ...seatNames };
  delete names[seat];
  const pres = { ...presence };
  delete pres[seat];
  const own = Object.fromEntries(Object.entries(ownership).map(([h, s]) => [h, s === seat ? 0 : s]));
  set({ net: { ...get().net, seatNames: names, presence: pres, ownership: own, slots: slots.map((s) => (s === seat ? 0 : s)), gmSeat: gmSeat === seat ? undefined : gmSeat } });
  get().log(t('coop.seatClosed'));
}

/** HÔTE : attribue un héros à un siège (lobby — « un certain nombre de personnages chacun »). */
export function netAssign(get: Get, set: Set, heroId: string, seat: number): void {
  if (get().net.mode !== 'host') return;
  set({ net: { ...get().net, ownership: { ...get().net.ownership, [heroId]: seat } } });
}

/** Pose/retire le RÔLE MJ (bac-à-sable) : `seat` conduit le camp ennemi + les jets du monde ; `null` = IA.
 *  UNIQUE (désigner un MJ retire le rôle à tout autre). Hôte-autoritaire en coop (comme `netAssign`) ;
 *  disponible en solo (mode local) pour le siège unique. `gmSeat` sérialisable → voyage dans les snapshots. */
export function setGmSeat(get: Get, set: Set, seat: number | null): void {
  if (get().net.mode === 'guest') return; // hôte-autoritaire (le rôle est décidé côté hôte / en solo)
  set({ net: { ...get().net, gmSeat: seat ?? undefined } });
}

/** HÔTE : attribue un EMPLACEMENT de l'écran d'équipe à un siège — le joueur le remplira
 *  lui-même (créer / charger un perso de son roster / pré-tiré). */
export function netAssignSlot(get: Get, set: Set, slot: number, seat: number): void {
  if (get().net.mode !== 'host' || slot < 0 || slot > 3) return;
  const slots = [...get().net.slots];
  slots[slot] = seat;
  set({ net: { ...get().net, slots } });
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
  lastCampaign = null;
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
