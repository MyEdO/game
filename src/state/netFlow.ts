/**
 * Couture STORE ↔ salon coop (`hote/coop/salon.ts`) — module `(get,set)` comme combatFlow : les implémentations web
 * des ports du salon (WebSocket, minuterie tracée, compression `net/compress.ts`, URL du relay, `fetch`,
 * `sessionStorage`, abonnement zustand), l'enrobage des actions de l'allowlist chez l'invité (enrobées au
 * branchement, restaurées au départ) et l'application d'un instantané au store.
 */
import type { GameState, RemplacerLEtat } from './store';
import { remettreLAdaptateur, useGame } from './store';
import { appliquerLInstantane } from '../noyau/coop';
import { creerLeSalon, emettreIntentInvite } from '../hote/coop/salon';
import type { SocketLike } from '../hote/coop/relay';
import { sanitizeIntentArgs } from './intents';
import { GUEST_INTENTS } from '../noyau/intentionsDeSiege';
import { bus, EVT } from '../noyau/bus';
import { scheduleFlowTimer, clearTrackedTimer } from '../web/minuteries';
import { deflateB64, inflateB64 } from '../net/compress';
import { stockageWeb } from '../hote/stockageWeb';

export const RELAY_URL_PROD = 'https://w4-coop-relay.gauche-c.workers.dev';

export function relayHttpUrl(): string {
  return (import.meta.env?.VITE_RELAY_URL as string | undefined)
    ?? (import.meta.env.PROD ? RELAY_URL_PROD : 'http://localhost:8787');
}

let originals: Record<string, (...args: unknown[]) => unknown> | null = null;

/** Le salon de l'hôte web, ses ports branchés. */
export const salon = creerLeSalon({
  relais: relayHttpUrl,
  fetch: (url, init) => fetch(url, init),
  socket: (url) => new WebSocket(url) as unknown as SocketLike,
  minuterie: {
    programmer: (suite, delai) => {
      const id = scheduleFlowTimer(suite, delai);
      return () => clearTrackedTimer(id);
    },
  },
  compression: { comprimer: deflateB64, decomprimer: inflateB64 },
  stockage: () => stockageWeb('sessionStorage'),
  abonner: (ecouteur) => useGame.subscribe(ecouteur),
  invite: { intercepter: interceptGuestActions, restaurer: restoreGuestActions },
});

/** L'invité applique un snapshot (`appliquerLInstantane`). Son interface se remet comme chez l'hôte
 *  (`remettreLAdaptateur`) quand la scène ou la partie change. */
export function applyNetSnapshot(set: RemplacerLEtat, data: Record<string, unknown>): void {
  const mine = useGame.getState();
  const { etat, neuve, autreScene } = appliquerLInstantane(data, mine);
  if (neuve || autreScene) remettreLAdaptateur(neuve);
  set(etat);
  bus.emit(EVT.SCENE_DIRTY);
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
      emettreIntentInvite(useGame.getState, name, local, (action, a) => salon.envoyer(action, sanitizeIntentArgs(a)), args);
  }
  useGame.setState(wrapped as Partial<GameState>);
}

/** Restaure les actions locales (fin de session invité). */
export function restoreGuestActions(): void {
  if (!originals) return;
  useGame.setState(originals as unknown as Partial<GameState>);
  originals = null;
}
