/**
 * LE SALON COOP (#3005, #3556) : la politique de session d'une partie à plusieurs, sur le relay (`relay.ts`) et la
 * session (`session.ts`), modèle hôte-autoritaire (spec coop §3).
 *  - HÔTE : crée une room sur le Worker (code de 6 caractères à partager) ; chaque écriture de l'état arme une
 *    diffusion lissée (`DIFFUSION_MS`) d'un instantané complet, différée tant que l'envoi est saturé (`BUFFER_MAX`) :
 *    seul le DERNIER état part.
 *  - INVITÉ : rejoint par code ; ses actions de l'allowlist partent en intention vers l'hôte (`emettreIntentInvite`),
 *    l'état local n'est que le reflet des instantanés reçus.
 * Reconnexion (spec v2 §6) : coupure d'un invité → son siège est réservé `GRACE_MS` (présence `away` chez l'hôte), il
 * reprend par token (persisté par room, `cleDuJeton`) ; passé la grâce, ses héros reviennent à l'hôte (`fermerLeSiege`).
 *
 * La plateforme s'injecte (`PortsDuSalon`) : la socket, la minuterie, la compression, l'URL et le `fetch` du relay, le
 * stockage du jeton, l'abonnement aux écritures de l'état et l'enrobage des actions de l'invité.
 */
import {
  appliquerLIntentionDUnSiege, argsAvecIntentionLocale, attribuerLEmplacement, attribuerLeHeros, buildDeLaCoop, fermerLeSiege,
  initialNet, instantaneDeLaCoop, intentEluLocalement, poserLeSiegeMJ, preparerLIntentLocal, refusDAttribuerLEmplacement, refusDAttribuerLeHeros,
  refusDuSiegeMJ, refuserGesteDuSiege, type Get, type NetState, type Set,
} from '../../noyau/index';
import { t } from '../../i18n';
import { RoomGuest, RoomHost, type PortsDuRelais } from './relay';
import { GuestSession, HostSession } from './session';

/** Siège réservé pendant la reconnexion d'un invité (spec v2 §6). */
export const GRACE_MS = 120_000;
/** Backpressure : au-delà, on diffère l'instantané (seul le DERNIER état partira). */
export const BUFFER_MAX = 256 * 1024;
/** Lissage de la diffusion : une rafale d'écritures (tour d'IA) = un instantané. */
const DIFFUSION_MS = 120;
/** Délai au-delà duquel rejoindre échoue. */
const DELAI_DE_CONNEXION_MS = 15_000;
/** Le code d'une room. */
const FORMAT_DU_CODE = /^[A-Z0-9]{6}$/;
/** Token de reprise persisté par room : un reload reprend le même siège. */
export const cleDuJeton = (code: string) => `wfrp4.coop.token.${code}`;

/** La réponse du relay à la création d'une room. */
export interface ReponseDuRelais {
  ok: boolean;
  json(): Promise<unknown>;
}

/** Le stockage du jeton de reprise. */
export interface StockageDuJeton {
  getItem(cle: string): string | null;
  setItem(cle: string, valeur: string): void;
}

/** La plateforme du salon, injectée par l'hôte. */
export interface PortsDuSalon extends PortsDuRelais {
  /** L'URL HTTP du relay, relue à chaque connexion. */
  relais: () => string;
  fetch: (url: string, init: { method: 'POST' }) => Promise<ReponseDuRelais>;
  /** Le stockage du jeton, relu à chaque accès ; null s'il est indisponible. */
  stockage: () => StockageDuJeton | null;
  /** Abonne `ecouteur` à chaque écriture de l'état ; rend le désabonnement. */
  abonner: (ecouteur: () => void) => () => void;
  /** L'enrobage des actions de l'allowlist chez l'invité, et son retrait. */
  invite: { intercepter(): void; restaurer(): void };
}

/**
 * Le sort d'UNE action de l'allowlist chez l'invité, dans cet ordre :
 *  - ÉLECTION LOCALE (`intentEluLocalement`) : le clic n'ouvre qu'un CHOIX D'ÉCRAN — le paramètre borné qui reste à
 *    demander — et se joue ENTIER chez le client, par son action locale. Rien ne part : le porteur élu est hors
 *    instantané, l'exécuter chez l'hôte y ferait naître un panneau étranger et n'en montrerait aucun à l'émetteur ;
 *  - sinon l'émetteur PRÉPARE chez lui ce que l'hôte ne pose pas (`preparerLIntentLocal` : l'intention qu'arme une
 *    offre jouée chez l'hôte), puis l'intent PART, avec l'intention ARMÉE ICI (`argsAvecIntentionLocale`) : elle est
 *    locale au client, l'hôte ne peut pas la relire dans son propre état, il la juge.
 */
export function emettreIntentInvite(
  get: Get,
  name: string,
  local: (...args: unknown[]) => unknown,
  envoyer: (action: string, args: unknown[]) => void,
  args: unknown[],
): void {
  if (intentEluLocalement(get, name, args)) {
    local(...args);
    return;
  }
  preparerLIntentLocal(get, name, args);
  envoyer(name, argsAvecIntentionLocale(get, name, args));
}

/** HÔTE : siège FERMÉ (départ définitif, fin de grâce) — `fermerLeSiege` (spec §6). */
function siegeFerme(get: Get, set: Set, seat: number): void {
  set({ net: fermerLeSiege(get().net, seat) });
  get().ecrireAuJournal(t('coop.seatClosed'));
}

/** Pose le réseau `apres(net)`, sauf si `refus` tombe : le refus se dit alors au siège qui décide
 *  (`refuserGesteDuSiege`) et `net` reste inchangé. */
function poserLeReseau(get: Get, set: Set, refus: string | null, apres: (net: NetState) => NetState): void {
  if (refus !== null) {
    refuserGesteDuSiege(get, set, refus);
    return;
  }
  const net = apres(get().net);
  if (net !== get().net) set({ net });
}

/** `attribuerLeHeros` (`noyau/sieges.ts`), refusé par `refusDAttribuerLeHeros`. */
export function netAssign(get: Get, set: Set, heroId: string, seat: number): void {
  const { net, party } = get();
  poserLeReseau(get, set, refusDAttribuerLeHeros(net, party, heroId, seat), (n) => attribuerLeHeros(n, party, heroId, seat));
}

/** `poserLeSiegeMJ` (`noyau/sieges.ts`), refusé par `refusDuSiegeMJ`. */
export function setGmSeat(get: Get, set: Set, seat: number | null): void {
  poserLeReseau(get, set, refusDuSiegeMJ(get().net, seat), (n) => poserLeSiegeMJ(n, seat));
}

/** `attribuerLEmplacement` (`noyau/sieges.ts`), refusé par `refusDAttribuerLEmplacement`. */
export function netAssignSlot(get: Get, set: Set, slot: number, seat: number): void {
  const { net, party } = get();
  poserLeReseau(get, set, refusDAttribuerLEmplacement(net, party, slot, seat), (n) => attribuerLEmplacement(n, party, slot, seat));
}

/** Un salon : au plus une session à la fois, hôte ou invité. Ses objets réseau vivants (sessions, sockets) restent
 *  dans sa fermeture, jamais dans l'état (non sérialisables, jamais dans les instantanés). */
export interface Salon {
  /** Devient HÔTE : crée la room sur le Worker → code court, attend les invités. false = service injoignable. */
  heberger(get: Get, set: Set, name: string): Promise<boolean>;
  /** INVITÉ : rejoint une room par son code. Résout null si connecté, sinon le message d'erreur. Un token stocké
   *  (reload) reprend le MÊME siège tant que la room vit. */
  rejoindre(get: Get, set: Set, appliquerSnapshot: (data: Record<string, unknown>) => void, codeRaw: string, name: string): Promise<string | null>;
  /** INVITÉ : envoie l'intention à l'hôte ; inerte hors session. */
  envoyer(action: string, args: unknown[]): void;
  /** Quitte la session (les deux rôles) — retour au mode local, actions restaurées. */
  quitter(set: Set): void;
}

export function creerLeSalon(ports: PortsDuSalon): Salon {
  let host: HostSession | null = null;
  let guest: GuestSession | null = null;
  let roomHost: RoomHost | null = null;
  let roomGuest: RoomGuest | null = null;
  let desabonner: (() => void) | null = null;
  let annulerLaDiffusion: (() => void) | null = null;
  const graces = new Map<number, () => void>();

  function diffuser(): void {
    if (!host || annulerLaDiffusion != null) return;
    annulerLaDiffusion = ports.minuterie.programmer(() => {
      annulerLaDiffusion = null;
      if (!host) return;
      if ((roomHost?.relay.buffered() ?? 0) > BUFFER_MAX) {
        diffuser();
        return;
      }
      host.broadcastSnapshot();
    }, DIFFUSION_MS);
  }

  function presente(get: Get, set: Set, seat: number, gname: string): void {
    set({ net: { ...get().net, seatNames: { ...get().net.seatNames, [seat]: gname }, presence: { ...get().net.presence, [seat]: 'present' } } });
  }

  function quitter(set: Set): void {
    desabonner?.();
    desabonner = null;
    annulerLaDiffusion?.();
    annulerLaDiffusion = null;
    for (const annuler of graces.values()) annuler();
    graces.clear();
    host?.close();
    host = null;
    guest?.close();
    guest = null;
    roomHost?.close();
    roomHost = null;
    roomGuest?.close();
    roomGuest = null;
    ports.invite.restaurer();
    set({ net: initialNet() });
  }

  async function heberger(get: Get, set: Set, name: string): Promise<boolean> {
    if (get().net.mode !== 'local') return false;
    let room: { code: string; hostToken: string };
    try {
      const res = await ports.fetch(`${ports.relais()}/rooms`, { method: 'POST' });
      if (!res.ok) return false;
      room = (await res.json()) as { code: string; hostToken: string };
    } catch {
      return false;
    }
    const rh = new RoomHost(ports.relais(), room.code, room.hostToken, ports);
    roomHost = rh;
    host = new HostSession({
      build: buildDeLaCoop(),
      applyIntent: (action, args, seat) => appliquerLIntentionDUnSiege(get, seat, action, args),
      getSnapshot: () => instantaneDeLaCoop(get()),
      campagne: () => get().pendingCampaign,
      onSeatClosed: (seat) => siegeFerme(get, set, seat),
    });
    rh.onFatal = () => {
      get().ecrireAuJournal(t('coop.hostLinkLost'));
      quitter(set);
    };
    rh.onJoin = (seat, gname) => {
      host?.addGuest(rh.seatTransport(seat), seat);
      presente(get, set, seat, gname);
    };
    rh.onResume = (seat, gname) => {
      graces.get(seat)?.();
      graces.delete(seat);
      // Revenu APRÈS la grace : son siège a été fermé → re-join sur le même siège.
      if (!host?.seats[seat]) host?.addGuest(rh.seatTransport(seat), seat);
      presente(get, set, seat, gname);
    };
    rh.onGone = (seat) => {
      set({ net: { ...get().net, presence: { ...get().net.presence, [seat]: 'absent' } } });
      graces.set(seat, ports.minuterie.programmer(() => {
        graces.delete(seat);
        rh.closeSeat(seat); // → onClose du transport virtuel → onSeatClosed (héros à l'hôte)
      }, GRACE_MS));
    };
    set({ net: { ...initialNet(), mode: 'hote', roomCode: room.code, seatNames: { 0: name } } });
    desabonner = ports.abonner(diffuser);
    return true;
  }

  function rejoindre(get: Get, set: Set, appliquerSnapshot: (data: Record<string, unknown>) => void, codeRaw: string, name: string): Promise<string | null> {
    if (get().net.mode !== 'local') return Promise.resolve(t('coop.alreadyInSession'));
    const code = codeRaw.trim().toUpperCase();
    if (!FORMAT_DU_CODE.test(code)) return Promise.resolve(t('coop.badCode'));
    const stored = ports.stockage()?.getItem(cleDuJeton(code)) ?? undefined;
    return new Promise((resolve) => {
      let settled = false;
      const fail = (msg: string) => {
        if (settled) return;
        settled = true;
        quitter(set);
        resolve(msg);
      };
      const annulerLeDelai = ports.minuterie.programmer(() => fail(t('coop.joinFailed')), DELAI_DE_CONNEXION_MS);
      const rg = new RoomGuest(ports.relais(), code, name, ports, stored);
      roomGuest = rg;
      rg.onFatal = (reason) => {
        if (settled) {
          get().ecrireAuJournal(t('coop.reason', { reason }));
          quitter(set);
          return;
        }
        fail(reason);
      };
      rg.onHostAway = (away) => {
        if (get().net.mode === 'invite') set({ net: { ...get().net, hostAway: away } });
      };
      rg.onConnState = (s) => {
        if (get().net.mode === 'invite') set({ net: { ...get().net, connection: s === 'connecte' ? 'connecte' : 'reconnexion' } });
      };
      rg.onReconnected = () => guest?.rejoin();
      rg.onSeated = (seat) => {
        ports.stockage()?.setItem(cleDuJeton(code), rg.token);
        if (settled) return; // reprise en cours de partie : déjà câblé
        settled = true;
        annulerLeDelai();
        guest = new GuestSession({
          build: buildDeLaCoop(),
          label: name,
          applySnapshot: appliquerSnapshot,
          // Motif typé de l'hôte (mismatch de protocole) : canal du journal réseau, distinct du onClose générique
          // qui suit juste après (silencieux, cf. session.ts).
          onProtocolMismatch: (expected, got) => get().ecrireAuJournal(t('coop.protocolMismatch', { got, expected })),
          onFormatMismatch: () => get().ecrireAuJournal(t('coop.formatMismatch')),
          onClosed: () => quitter(set),
        });
        set({ net: { ...initialNet(), mode: 'invite', mySeat: seat, roomCode: code, seatNames: { [seat]: name } } });
        ports.invite.intercepter();
        guest.connect(rg);
        resolve(null);
      };
    });
  }

  return {
    heberger,
    rejoindre,
    envoyer: (action, args) => guest?.sendIntent(action, args),
    quitter,
  };
}
