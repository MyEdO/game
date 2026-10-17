/**
 * Protocole coop — messages typés du transport, modèle hôte-autoritaire : les invités envoient
 * des INTENTS (action de store rejouable), l'hôte renvoie des SNAPSHOTS (état complet, mêmes
 * données JSON-sûres que la sauvegarde) et transfère la campagne custom UNE fois au join
 * (`campaign`). `parseMessage` valide la FORME de chaque message : le réseau est une entrée
 * non fiable → null, jamais d'exception.
 *
 * `hello.build` : le format de l'état (`FORMAT_SAVE`, `state/netFlow.ts`), comparée par
 * l'hôte au hello.
 *
 * `error` : envoyé par l'hôte AVANT de fermer le transport (mismatch de protocole ou de format au hello)
 * pour distinguer une fermeture VOLONTAIRE d'une coupure réseau banale côté invité. N'entraîne
 * PAS un bump de PROTOCOL_VERSION : c'est un AJOUT de type de message, les formes existantes
 * (`hello`/`intent`/`snapshot`/…) sont inchangées — un invité plus ANCIEN qui ne connaît pas
 * encore `error` le voit juste rejeté par `parseMessage` (→ null) et retombe sur la fermeture
 * silencieuse préexistante ; un invité à jour affiche le motif précis.
 */
export const PROTOCOL_VERSION = 1;

export type NetMessage =
  | { kind: 'hello'; protocol: number; build: string; label: string }
  | { kind: 'intent'; action: string; args: unknown[]; seat: number }
  | { kind: 'snapshot'; data: Record<string, unknown> }
  | { kind: 'campaign'; label: string; scenes: unknown[]; startSceneId: string; worldMap: unknown }
  | { kind: 'assign'; heroId: string; seat: number }
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
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const m = v as Record<string, unknown>;
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
      return m.data != null && typeof m.data === 'object' && !Array.isArray(m.data)
        ? { kind: 'snapshot', data: m.data as Record<string, unknown> }
        : null;
    case 'campaign':
      return typeof m.label === 'string' && Array.isArray(m.scenes) && typeof m.startSceneId === 'string'
        ? { kind: 'campaign', label: m.label, scenes: m.scenes, startSceneId: m.startSceneId, worldMap: m.worldMap ?? null }
        : null;
    case 'assign':
      return typeof m.heroId === 'string' && typeof m.seat === 'number'
        ? { kind: 'assign', heroId: m.heroId, seat: m.seat }
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
