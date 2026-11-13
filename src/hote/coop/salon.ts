/**
 * LE SALON COOP (#3005, #3556) : la politique de session d'une partie à plusieurs, sur le relay (`relay.ts`) et la
 * session (`session.ts`), modèle hôte-autoritaire (spec coop §3).
 *  - HÔTE : crée une room sur le Worker (code de 6 caractères à partager) ; chaque écriture de l'état arme une
 *    diffusion lissée (`DIFFUSION_MS`) d'un instantané complet, différée tant que l'envoi est saturé (`BUFFER_MAX`) :
 *    seul le DERNIER état part.
 *  - INVITÉ : rejoint par code ; ses actions de l'allowlist partent en intention vers l'hôte
 *    (`transmettreLesIntentions`, `noyau/reseau.ts`), l'état local n'est que le reflet des instantanés reçus.
 * Reconnexion (spec v2 §6) : coupure d'un invité → son siège est réservé `GRACE_MS` (présence `absent` chez l'hôte), il
 * reprend par token (persisté par room, `cleDuJeton`) ; passé la grâce, ses héros reviennent à l'hôte (`fermerLeSiege`).
 *
 * La plateforme s'injecte (`PortsDuSalon`) : la socket, la minuterie, la compression, l'URL et le `fetch` du relay, le
 * stockage du jeton et l'abonnement aux écritures de l'état. Le salon lit l'état par `get` et l'écrit par la machinerie
 * du noyau (`poserLeReseau`, `ecrireAuJournal`, `transmettreLesIntentions`, `restaurerLesIntentions`), chez l'hôte par
 * le rappel `appliquer` que reçoit `heberger` et, chez l'invité, par le rappel `appliquerSnapshot` que reçoit `rejoindre`.
 * Une ouverture à la fois (`heberger` avant sa session posée, `rejoindre` avant `seated`), que `quitter` achève.
 */
import { buildDeLaCoop, fermerLeSiege, initialNet, instantaneDeLaCoop, type Get } from '../../noyau/index';
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
}

/** HÔTE : siège FERMÉ (départ définitif, fin de grâce) — `fermerLeSiege` (spec §6). */
function siegeFerme(get: Get, seat: number): void {
  get().poserLeReseau(fermerLeSiege(get().net, seat));
  get().ecrireAuJournal(t('coop.seatClosed'));
}

/** L'intention d'un invité, chez l'hôte : `action(...args)` au nom de `siege`. */
export type AppliquerLIntention = (action: string, args: unknown[], siege: number) => void;

/** Une ouverture en vol ; `finir` la clôt une fois, par une seule voie, et rend si c'était la sienne. */
interface Ouverture {
  vive(): boolean;
  finir(issue: string | null): boolean;
}

/** Un salon : au plus une session à la fois, hôte ou invité. Ses objets réseau vivants (sessions, sockets) restent
 *  dans sa fermeture, jamais dans l'état (non sérialisables, jamais dans les instantanés). */
export interface Salon {
  /** Devient HÔTE : crée la room sur le Worker → code court, attend les invités, applique leurs intentions par
   *  `appliquer`. Résout null s'il héberge, sinon le message d'erreur ; une levée en chemin va aussi à `panne`. */
  heberger(get: Get, appliquer: AppliquerLIntention, name: string): Promise<string | null>;
  /** INVITÉ : rejoint une room par son code. Résout null si connecté, sinon le message d'erreur ; une levée en chemin
   *  va aussi à `panne`. Un token stocké (reload) reprend le MÊME siège tant que la room vit. */
  rejoindre(get: Get, appliquerSnapshot: (data: Record<string, unknown>) => void, codeRaw: string, name: string): Promise<string | null>;
  /** Quitte la session (les deux rôles) — retour au mode local, actions restaurées. Une ouverture en vol se résout
   *  dans l'appel (`coop.ouvertureAbandonnee`). */
  quitter(get: Get): void;
}

export function creerLeSalon(ports: PortsDuSalon): Salon {
  let host: HostSession | null = null;
  let guest: GuestSession | null = null;
  let roomHost: RoomHost | null = null;
  let roomGuest: RoomGuest | null = null;
  let desabonner: (() => void) | null = null;
  let annulerLaDiffusion: (() => void) | null = null;
  let ouverture: Ouverture | null = null;
  const graces = new Map<number, () => void>();

  /** Pose l'ouverture en vol ; sa fin `annule` ce qu'elle a armé puis `resolve` son issue. */
  function commencer(resolve: (issue: string | null) => void, annuler: () => void = () => {}): Ouverture {
    const o: Ouverture = {
      vive: () => ouverture === o,
      finir: (issue) => {
        if (ouverture !== o) return false;
        ouverture = null;
        annuler();
        resolve(issue);
        return true;
      },
    };
    ouverture = o;
    return o;
  }

  /** L'échec `issue` de l'ouverture `o`, puis le ménage de ce qu'elle a posé. */
  function echouer(get: Get, o: Ouverture, issue: string): void {
    if (o.finir(issue)) quitter(get);
  }

  /** Le refus d'ouvrir : déjà en session ou en ouverture, ou nom vide. */
  function refusDOuvrir(get: Get, name: string): string | null {
    if (get().net.mode !== 'local' || ouverture) return t('coop.alreadyInSession');
    if (!name.trim()) return t('coop.nomRequis');
    return null;
  }

  /** La room créée sur le Worker ; null si le service est injoignable. */
  async function creerLaRoom(): Promise<{ code: string; hostToken: string } | null> {
    try {
      const res = await ports.fetch(`${ports.relais()}/rooms`, { method: 'POST' });
      if (!res.ok) return null;
      return (await res.json()) as { code: string; hostToken: string };
    } catch {
      return null;
    }
  }

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

  function presente(get: Get, seat: number, gname: string): void {
    get().poserLeReseau({ ...get().net, seatNames: { ...get().net.seatNames, [seat]: gname }, presence: { ...get().net.presence, [seat]: 'present' } });
  }

  function quitter(get: Get): void {
    ouverture?.finir(t('coop.ouvertureAbandonnee'));
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
    get().restaurerLesIntentions();
    get().poserLeReseau(initialNet());
  }

  function heberger(get: Get, appliquer: AppliquerLIntention, name: string): Promise<string | null> {
    const refus = refusDOuvrir(get, name);
    if (refus) return Promise.resolve(refus);
    return new Promise((resolve) => {
      const o = commencer(resolve);
      void creerLaRoom().then((room) => {
        if (!room) o.finir(t('coop.hote.erreur'));
        else if (o.vive()) {
          try {
            poserLHote(get, appliquer, name, room);
          } catch (erreur) {
            echouer(get, o, t('coop.hote.erreur'));
            ports.panne(erreur);
            return;
          }
          o.finir(null);
        }
      });
    });
  }

  function poserLHote(get: Get, appliquer: AppliquerLIntention, name: string, room: { code: string; hostToken: string }): void {
    const rh = new RoomHost(ports.relais(), room.code, room.hostToken, ports);
    roomHost = rh;
    host = new HostSession({
      build: buildDeLaCoop(),
      applyIntent: appliquer,
      getSnapshot: () => instantaneDeLaCoop(get()),
      onSeatClosed: (seat) => siegeFerme(get, seat),
    });
    rh.onFatal = () => {
      get().ecrireAuJournal(t('coop.hote.lienPerdu'));
      quitter(get);
    };
    rh.onJoin = (seat, gname) => {
      host?.addGuest(rh.seatTransport(seat), seat);
      presente(get, seat, gname);
    };
    rh.onResume = (seat, gname) => {
      graces.get(seat)?.();
      graces.delete(seat);
      // Revenu APRÈS la grace : son siège a été fermé → re-join sur le même siège.
      if (!host?.seats[seat]) host?.addGuest(rh.seatTransport(seat), seat);
      presente(get, seat, gname);
    };
    rh.onGone = (seat) => {
      get().poserLeReseau({ ...get().net, presence: { ...get().net.presence, [seat]: 'absent' } });
      graces.set(seat, ports.minuterie.programmer(() => {
        graces.delete(seat);
        rh.closeSeat(seat); // → onClose du transport virtuel → onSeatClosed (héros à l'hôte)
      }, GRACE_MS));
    };
    get().poserLeReseau({ ...initialNet(), mode: 'hote', roomCode: room.code, seatNames: { 0: name } });
    desabonner = ports.abonner(diffuser);
  }

  function rejoindre(get: Get, appliquerSnapshot: (data: Record<string, unknown>) => void, codeRaw: string, name: string): Promise<string | null> {
    const refus = refusDOuvrir(get, name);
    if (refus) return Promise.resolve(refus);
    const code = codeRaw.trim().toUpperCase();
    if (!FORMAT_DU_CODE.test(code)) return Promise.resolve(t('coop.badCode'));
    const stored = ports.stockage()?.getItem(cleDuJeton(code)) ?? undefined;
    return new Promise((resolve) => {
      const o = commencer(resolve, ports.minuterie.programmer(() => echouer(get, o, t('coop.joinFailed')), DELAI_DE_CONNEXION_MS));
      let rg: RoomGuest;
      try {
        rg = new RoomGuest(ports.relais(), code, name, ports, stored);
      } catch (erreur) {
        echouer(get, o, t('coop.joinFailed'));
        ports.panne(erreur);
        return;
      }
      roomGuest = rg;
      rg.onFatal = (reason) => {
        if (o.vive()) {
          echouer(get, o, reason);
          return;
        }
        get().ecrireAuJournal(t('coop.reason', { reason }));
        quitter(get);
      };
      rg.onHostAway = (away) => {
        if (get().net.mode === 'invite') get().poserLeReseau({ ...get().net, hoteAbsent: away });
      };
      rg.onConnState = (s) => {
        if (get().net.mode === 'invite') get().poserLeReseau({ ...get().net, connection: s === 'connecte' ? 'connecte' : 'reconnexion' });
      };
      rg.onReconnected = () => guest?.rejoin();
      rg.onSeated = (seat) => {
        ports.stockage()?.setItem(cleDuJeton(code), rg.token);
        if (!o.vive()) return; // reprise en cours de partie : déjà câblé
        guest = new GuestSession({
          build: buildDeLaCoop(),
          label: name,
          applySnapshot: appliquerSnapshot,
          // Motif typé de l'hôte (mismatch de protocole) : canal du journal réseau, distinct du onClose générique
          // qui suit juste après (silencieux, cf. session.ts).
          onProtocolMismatch: (expected, got) => get().ecrireAuJournal(t('coop.protocolMismatch', { got, expected })),
          onFormatMismatch: () => get().ecrireAuJournal(t('coop.formatMismatch')),
          onClosed: () => quitter(get),
        });
        get().poserLeReseau({ ...initialNet(), mode: 'invite', mySeat: seat, roomCode: code, seatNames: { [seat]: name } });
        get().transmettreLesIntentions((action, args) => guest?.sendIntent(action, args));
        guest.connect(rg);
        o.finir(null);
      };
    });
  }

  return {
    heberger,
    rejoindre,
    quitter,
  };
}
