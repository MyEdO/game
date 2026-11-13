/** Les ports factices du relay (#3556) : une socket pilotée par le test, une compression réversible, une minuterie
 *  sur les minuteurs (factices sous `vi.useFakeTimers`) du test et une panne ; ceux du salon : la création d'une room
 *  qui s'ouvre, un stockage en `Map`, et la lecture des instantanés qu'une socket hôte a émis. */
import type { Compression, Minuterie, PortsDuRelais, SocketLike } from './relay';
import type { ReponseDuRelais, StockageDuJeton } from './salon';

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

/** Le relay crée la room `ABC234`, de jeton d'hôte `HT`. */
export const roomOuverte = async (): Promise<ReponseDuRelais> => ({ ok: true, json: async () => ({ code: 'ABC234', hostToken: 'HT' }) });

/** Un stockage du jeton en `Map`, et la `Map` qu'il tient. */
export function stockageEnMap(): { stocke: Map<string, string>; stockage: () => StockageDuJeton } {
  const stocke = new Map<string, string>();
  return { stocke, stockage: () => ({ getItem: (k) => stocke.get(k) ?? null, setItem: (k, v) => { stocke.set(k, v); } }) };
}

/** Les instantanés que la socket hôte `ws` a envoyés au siège 1. */
export const instantanesAuSiege1 = (ws: FakeSocket) => ws.sent.flatMap((raw) => {
  if (raw === 'ping') return [];
  const env = JSON.parse(raw) as { to?: number; data?: string; z?: string };
  const texte = env.data ?? env.z?.slice(2);
  return env.to === 1 && texte && (JSON.parse(texte) as { kind: string }).kind === 'snapshot' ? [texte] : [];
});
