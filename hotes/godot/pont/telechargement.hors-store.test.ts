// Le téléchargement de la page pour Godot (#4402, `CONTRAT.md`, section « Transport ») : le corps lu entier, bloc après
// bloc, remis en un `ArrayBuffer` ; le silence abandonne, une requête qui lève échoue.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { telecharger, type IssueDuTelechargement } from './telechargement';

type Rendu = [IssueDuTelechargement, number, string, string];

/** Le rendu de `telecharger`, le corps décodé en texte. */
const telechargement = (corps = '', entetes: string[] = [], silenceS = 1) =>
  new Promise<Rendu>((resolve) =>
    telecharger('http://jeu/x', corps === '' ? 'GET' : 'PUT', corps, JSON.stringify(entetes), silenceS, (issue, statut, octets, raison) =>
      resolve([issue, statut, new TextDecoder().decode(octets), raison])));

/** Un flux qui livre `blocs`, puis se ferme ; avec `arret`, se tait jusqu'à ce qu'il le coupe, comme le `fetch` de la
 *  page. */
const flux = (blocs: string[], arret?: AbortSignal) =>
  new ReadableStream<Uint8Array>({
    start(controle) {
      for (const bloc of blocs) controle.enqueue(new TextEncoder().encode(bloc));
      if (!arret) controle.close();
      else arret.addEventListener('abort', () => controle.error(arret.reason));
    },
  });

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('telecharger', () => {
  it('rend le corps reçu en plusieurs blocs en un seul, avec son statut ; envoie verbe, corps et en-têtes', async () => {
    const appel = vi.fn(async () => new Response(flux(['un ', 'deux ', 'trois']), { status: 200 }));
    vi.stubGlobal('fetch', appel);
    expect(await telechargement('texte', ['Content-Type: text/markdown'])).toEqual(['reponse', 200, 'un deux trois', '']);
    const [adresse, options] = appel.mock.calls[0] as unknown as [string, RequestInit];
    expect([adresse, options.method, options.body, options.headers]).toEqual(['http://jeu/x', 'PUT', 'texte', [['Content-Type', 'text/markdown']]]);
  });

  it('rend le statut et le corps d’une réponse qui n’est pas un 200', async () => {
    vi.stubGlobal('fetch', async () => new Response('introuvable', { status: 404 }));
    expect(await telechargement()).toEqual(['reponse', 404, 'introuvable', '']);
  });

  it('abandonne en silence quand aucun octet n’arrive pendant le délai, ce qui est reçu rendu', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', async (_adresse: string, options: RequestInit) => new Response(flux(['debut'], options.signal!), { status: 200 }));
    const rendu = telechargement('', [], 0.05);
    await vi.advanceTimersByTimeAsync(49);
    await vi.advanceTimersByTimeAsync(1);
    const [issue, statut, recu] = await rendu;
    expect([issue, statut, recu]).toEqual(['silence', 200, 'debut']);
  });

  it('échoue avec la raison quand la requête lève', async () => {
    vi.stubGlobal('fetch', async () => {
      throw new TypeError('Failed to fetch');
    });
    expect(await telechargement()).toEqual(['echec', 0, '', 'Failed to fetch']);
  });
});
