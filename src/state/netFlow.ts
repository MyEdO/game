/**
 * Couture STORE ↔ salon coop (`hote/coop/salon.ts`) — module `(get,set)` comme combatFlow : les implémentations web
 * des ports du salon (WebSocket, minuterie tracée, compression `net/compress.ts`, URL du relay, `fetch`,
 * `sessionStorage`, abonnement zustand) et l'application d'un instantané au store.
 */
import type { RemplacerLEtat } from './store';
import { remettreLAdaptateur, useGame } from './store';
import { appliquerLInstantane } from '../noyau/coop';
import { creerLeSalon } from '../hote/coop/salon';
import type { SocketLike } from '../hote/coop/relay';
import { bus, EVT } from '../noyau/bus';
import { scheduleFlowTimer, clearTrackedTimer } from '../web/minuteries';
import { deflateB64, inflateB64 } from '../net/compress';
import { stockageWeb } from '../hote/stockageWeb';

export const RELAY_URL_PROD = 'https://w4-coop-relay.gauche-c.workers.dev';

export function relayHttpUrl(): string {
  return (import.meta.env?.VITE_RELAY_URL as string | undefined)
    ?? (import.meta.env.PROD ? RELAY_URL_PROD : 'http://localhost:8787');
}

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
