/**
 * Transport coop — interface minuscule consommée par `session.ts`, implémentations :
 * - `RoomHost`/`RoomGuest` (`net/relay.ts`, hôte web) : WebSocket via le Worker relay (`server/`), prod.
 * - `FakeTransport.pair()` (`transport.testkit.ts`) : paire en mémoire pour les tests.
 */
export interface Transport {
  send(data: string): void;
  onMessage(cb: (data: string) => void): void;
  onClose(cb: () => void): void;
  close(): void;
}
