/**
 * Protocole coop — messages typés du transport, modèle hôte-autoritaire : les invités envoient
 * des INTENTS (action de store rejouable), l'hôte renvoie des SNAPSHOTS (état complet, mêmes
 * données JSON-sûres que la sauvegarde, `instantaneDeLaCoop`, `noyau/coop.ts`). `parseMessage` valide
 * la FORME de chaque message : le réseau est une entrée non fiable → null, jamais d'exception.
 *
 * `hello.build` : le format de l'état et l'empreinte des registres que nomme un snapshot
 * (`buildDeLaCoop`, `noyau/coop.ts`), comparée par l'hôte au hello.
 *
 * `error` : envoyé par l'hôte AVANT de fermer le transport (mismatch de protocole ou de format au hello)
 * pour distinguer une fermeture VOLONTAIRE d'une coupure réseau banale côté invité, qui en affiche
 * le motif précis.
 */
import { estObjet } from '../../lib/objet.mjs';

export const PROTOCOL_VERSION = 3;

export type NetMessage =
  | { kind: 'hello'; protocol: number; build: string; label: string }
  | { kind: 'intent'; action: string; args: unknown[]; seat: number }
  | { kind: 'snapshot'; data: Record<string, unknown> }
  | { kind: 'error'; reason: 'protocol-mismatch'; expected: number; got: number }
  | { kind: 'error'; reason: 'format-mismatch'; expected: string; got: string }
  | { kind: 'bye' };

export function serializeMessage(m: NetMessage): string {
  return JSON.stringify(m);
}

export function parseMessage(raw: string): NetMessage | null {
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!estObjet(v)) return null;
  const m = v;
  switch (m.kind) {
    case 'hello':
      return typeof m.protocol === 'number' && typeof m.build === 'string' && typeof m.label === 'string'
        ? { kind: 'hello', protocol: m.protocol, build: m.build, label: m.label }
        : null;
    case 'intent':
      return typeof m.action === 'string' && Array.isArray(m.args) && typeof m.seat === 'number'
        ? { kind: 'intent', action: m.action, args: m.args, seat: m.seat }
        : null;
    case 'snapshot':
      return estObjet(m.data)
        ? { kind: 'snapshot', data: m.data }
        : null;
    case 'error':
      if (m.reason === 'protocol-mismatch' && typeof m.expected === 'number' && typeof m.got === 'number')
        return { kind: 'error', reason: 'protocol-mismatch', expected: m.expected, got: m.got };
      return m.reason === 'format-mismatch' && typeof m.expected === 'string' && typeof m.got === 'string'
        ? { kind: 'error', reason: 'format-mismatch', expected: m.expected, got: m.got }
        : null;
    case 'bye':
      return { kind: 'bye' };
    default:
      return null;
  }
}
