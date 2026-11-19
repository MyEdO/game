/**
 * Les ports de la page (#3009) : ce que le salon coop (`salon.ts`) demande au navigateur — l'adresse du relay, le
 * `fetch`, la socket, la compression (`compression.ts`) et le stockage du jeton (`stockageWeb`). Chaque port lit son
 * global à l'appel.
 */
import type { SocketLike } from './relay';
import type { PortsDuSalon } from './salon';
import { deflateB64, inflateB64 } from './compression';
import { stockageWeb } from '../stockageWeb';

export const RELAY_URL_PROD = 'https://w4-coop-relay.gauche-c.workers.dev';

/** L'URL HTTP du relay : `VITE_RELAY_URL`, sinon le Worker en production, sinon le relay local. */
export function relayHttpUrl(): string {
  return (import.meta.env?.VITE_RELAY_URL as string | undefined)
    ?? (import.meta.env.PROD ? RELAY_URL_PROD : 'http://localhost:8787');
}

/** Les ports du salon que la page fournit. */
export function portsDeLaPage(): Pick<PortsDuSalon, 'relais' | 'fetch' | 'socket' | 'compression' | 'stockage'> {
  return {
    relais: relayHttpUrl,
    fetch: (url, init) => fetch(url, init),
    socket: (url) => new WebSocket(url) as unknown as SocketLike,
    compression: { comprimer: deflateB64, decomprimer: inflateB64 },
    stockage: () => stockageWeb('sessionStorage'),
  };
}
