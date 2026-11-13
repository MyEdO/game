/** Les ports factices du relay (#3556) : une socket pilotée par le test, une compression réversible, une minuterie
 *  sur les minuteurs (factices sous `vi.useFakeTimers`) du test et une panne. */
import type { Compression, Minuterie, PortsDuRelais, SocketLike } from './relay';

/** Une socket dont le test joue le serveur : `open`, `receive`, `dropFromServer`. `fermetureDifferee` : `onclose` suit
 *  `close()` à la tâche suivante, comme la WebSocket du navigateur. */
export class FakeSocket implements SocketLike {
  static instances: FakeSocket[] = [];
  static get last(): FakeSocket | undefined {
    return FakeSocket.instances[FakeSocket.instances.length - 1];
  }
  sent: string[] = [];
  closedWith: { code?: number } | null = null;
  bufferedAmount = 0;
  onSend: ((data: string) => void) | null = null;
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: unknown }) => void) | null = null;
  onclose: ((e: { code: number; reason: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(readonly url: string, private readonly fermetureDifferee = false) {
    FakeSocket.instances.push(this);
  }
  send(d: string): void {
    this.sent.push(d);
    this.onSend?.(d);
  }
  close(code?: number, reason?: string): void {
    this.closedWith = { code };
    const fermer = () => this.onclose?.({ code: code ?? 1005, reason: reason ?? '' });
    if (this.fermetureDifferee) setTimeout(fermer, 0);
    else fermer();
  }
  open(): void {
    this.onopen?.();
  }
  receive(d: string): void {
    this.onmessage?.({ data: d });
  }
  dropFromServer(code = 1006, reason = ''): void {
    this.onclose?.({ code, reason });
  }
}

/** Réversible et distincte du clair : le champ `z` ne se lit qu'en passant par elle. */
export const compressionFactice: Compression = {
  comprimer: async (texte) => `z:${texte}`,
  decomprimer: async (b64) => (b64.startsWith('z:') ? b64.slice(2) : null),
};

export const minuterieDuTest: Minuterie = {
  programmer: (suite, delai) => {
    const id = setTimeout(suite, delai);
    return () => clearTimeout(id);
  },
};

/** Sans `panne` donnée, une panne relève : le maillon rejette, et le test qui ne l'attend pas tombe. */
export const portsDuTest = (
  socket: PortsDuRelais['socket'] = (url) => new FakeSocket(url),
  panne: PortsDuRelais['panne'] = (erreur) => { throw erreur; },
): PortsDuRelais => ({
  socket, minuterie: minuterieDuTest, compression: compressionFactice, panne,
});
