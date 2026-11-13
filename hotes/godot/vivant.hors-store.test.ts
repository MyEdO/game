/**
 * LE PONT VIVANT (#3945, `pont/CONTRAT.md`, section « Transport ») : `node hotes/godot/vivant.mjs` annonce sur sa
 * première ligne l'URL de son serveur, puis rend à chaque ligne `[methode, json|null]` de son entrée la ligne JSON que
 * rend `wfrpPont.appelerEnOctets` ; une réponse qui porte des octets la précède de la ligne `octets <n>` et la suit de
 * ses `n` octets bruts (#3948). La fin de son entrée le fait sortir en 0. Le pont tiré d'un bundle (`pontDuBundle`)
 * écrit sur la `console` donnée.
 */
import { Console } from 'node:console';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createServer, type IncomingMessage } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Duplex } from 'node:stream';
import { PassThrough } from 'node:stream';
import { setTimeout as delai } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { LISTAGE } from './listage.mjs';
import { BORNE_DE_SORTIE_MS, pontDuBundle } from './processus.mjs';
import { ouvrirLeProcessus, sansModeNiRelais, type ProcessusDuPont } from './processus.testkit';
import { stockageDuProcessus } from './stockage.mjs';
import type { MaillageDeLaPile, PileDemandee } from './pont/pile';
import type { EnteteDesMorceaux } from './pont/octets';
import type { MondeDuPont } from './pont/pont';

const VIVANT = fileURLToPath(new URL('./vivant.mjs', import.meta.url));
/** Le lancement bâtit le bundle et charge les assets : ~10 s. */
const LANCEMENT_MS = 120_000;

let tuyau: ProcessusDuPont;
let url = '';

beforeAll(async () => {
  tuyau = ouvrirLeProcessus(VIVANT);
  url = (JSON.parse(await tuyau.prochaine()) as { url: string }).url;
}, LANCEMENT_MS);
afterAll(() => {
  if (tuyau.processus.exitCode === null) tuyau.processus.kill();
});

describe('vivant', () => {
  it('annonce l’URL d’un serveur qui sert le listage des modèles', async () => {
    expect(url).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/$/);
    expect((await fetch(`${url}modeles/${LISTAGE}`)).status).toBe(200);
  });

  it('demarrer dome rend ok: true avec sa vue', async () => {
    const r = await tuyau.appel('demarrer', { scenario: 'dome' });
    expect([r.ok, r.vue != null]).toEqual([true, true]);
  });

  it('morceaux sort la ligne `octets <n>`, sa ligne JSON puis ses n octets bruts, et la requête suivante est répondue', async () => {
    const monde = (await tuyau.appel('monde')) as unknown as MondeDuPont;
    const cles = (liste: { cle: string }[]) => liste.map(({ cle }) => cle);
    const entree = { source: 'partie', volume: cles(monde.monde!.morceaux), toits: cles(monde.toits), couronnes: cles(monde.couronnes) };
    tuyau.processus.stdin.write(`${JSON.stringify(['morceaux', JSON.stringify(entree)])}\n${JSON.stringify(['vue', null])}\n`);
    const n = /^octets (\d+)$/.exec(await tuyau.prochaine());
    expect(n, 'la ligne `octets <n>`').not.toBeNull();
    const entete = JSON.parse(await tuyau.prochaine()) as EnteteDesMorceaux & { ok: boolean };
    const octets = await tuyau.octets(Number(n![1]));
    expect(octets.includes(0x0a), 'des octets 0x0a parmi les octets bruts').toBe(true);
    const geometries = [...entete.volume, ...entete.toits, ...entete.couronnes];
    expect([entete.ok, entete.octets, geometries[geometries.length - 1].cases[1]]).toEqual([true, octets.length, octets.length]);
    const suivante = JSON.parse(await tuyau.prochaine()) as { ok: boolean; vue?: unknown };
    expect([suivante.ok, suivante.vue != null]).toEqual([true, true]);
  });

  it('une requête de plus de 300 Ko reçoit sa réponse', async () => {
    const r = await tuyau.appel('vue', { bourrage: 'a'.repeat(300_000) });
    expect([r.ok, r.erreur?.categorie]).toEqual([false, 'validation']);
  });

  it('une requête dont une chaîne porte U+2028 ou U+2029, que le JSON.stringify de Godot laisse bruts, est une ligne', async () => {
    const r = await tuyau.appel('vue', { x: 'a b c' });
    expect([r.ok, r.erreur?.categorie]).toEqual([false, 'validation']);
  });

  it('une ligne resoudreLaPile suivie d’une autre requête rend leurs deux réponses dans cet ordre', async () => {
    const pile = JSON.stringify({ pieces: [], parents: {}, osDeChaine: [], peau: [] });
    tuyau.processus.stdin.write(`${JSON.stringify(['resoudreLaPile', pile])}\n${JSON.stringify(['vue', null])}\n`);
    const premiere = JSON.parse(await tuyau.prochaine()) as { ok: boolean; bilan?: unknown };
    const seconde = JSON.parse(await tuyau.prochaine()) as { ok: boolean; bilan?: unknown };
    expect([premiere.ok, premiere.bilan != null, seconde.bilan]).toEqual([true, true, undefined]);
  });

  it('une pile d’une pièce à un maillage rend ok: true', async () => {
    const enBase64 = (t: Float32Array | Int32Array): string => Buffer.from(t.buffer).toString('base64');
    const maillage: MaillageDeLaPile = {
      positions: enBase64(Float32Array.from([0, 0, 0, 0.1, 0, 0, 0, 0.1, 0])), indices: enBase64(Int32Array.from([0, 2, 1])),
      os: enBase64(new Int32Array(12)), poids: enBase64(Float32Array.from([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0])), noms: ['bras'],
    };
    const demande: PileDemandee = { pieces: [{ rang: -1, accessoire: false, maillages: [maillage] }], parents: {}, osDeChaine: [], peau: [] };
    tuyau.processus.stdin.write(`${JSON.stringify(['resoudreLaPile', JSON.stringify(demande)])}\n`);
    const r = JSON.parse(await tuyau.prochaine()) as { ok: boolean; erreur?: unknown };
    expect([r.ok, r.erreur]).toEqual([true, undefined]);
  });

  it('la fin de l’entrée le fait sortir en 0, sa sortie n’ayant porté que l’annonce, une ligne par requête et la ligne `octets <n>` de morceaux', async () => {
    tuyau.processus.stdin.end();
    const [code] = await once(tuyau.processus, 'exit');
    expect([code, (await tuyau.reste()).length]).toEqual([0, 0]);
    expect(tuyau.sortie).toHaveLength(11);
  });
});

describe('pontDuBundle', () => {
  it('la console du bundle est celle donnée', () => {
    const flux = new PassThrough();
    const pont = pontDuBundle("globalThis.wfrpPont = { appeler: () => (console.log('du noyau'), '{}') }", new Console(flux), stockageDuProcessus(null));
    pont.appeler('vue');
    flux.end();
    expect(String(flux.read())).toBe('du noyau\n');
  });

  it('C2 — `sessionStorage` est un stockage en mémoire neuf : relu, distinct de `localStorage`, jamais au fichier de `--stockage`', () => {
    const dossier = mkdtempSync(join(tmpdir(), 'session-3009-'));
    const fichier = join(dossier, 'stockage.json');
    try {
      const bundle = "globalThis.wfrpPont = { appeler: () => (sessionStorage.setItem('jeton', 'J'), localStorage.setItem('sauve', 'S'), JSON.stringify([sessionStorage.getItem('jeton'), localStorage.getItem('jeton'), sessionStorage.getItem('sauve')])) }";
      const pont = pontDuBundle(bundle, new Console(new PassThrough()), stockageDuProcessus(fichier));
      expect(JSON.parse(pont.appeler('vue'))).toEqual(['J', null, null]);
      expect(JSON.parse(readFileSync(fichier, 'utf8'))).toEqual({ sauve: 'S' });
    } finally {
      rmSync(dossier, { recursive: true, force: true });
    }
  });
});

/** Un relay MUET : il répond à `POST /rooms` si `repondre`, accepte la poignée de main d'une WebSocket, puis ne répond
 *  plus à rien, fermeture comprise. `recu` : chaque requête reçue, dans l'ordre. */
async function relaisMuet(repondre: boolean) {
  const recu: string[] = [];
  const liens = new Set<Duplex>();
  const serveur = createServer((req: IncomingMessage, res) => {
    recu.push(`${req.method} ${req.url}`);
    liens.add(req.socket);
    if (repondre) res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ code: 'ABC234', hostToken: 'HT' }));
  });
  serveur.on('upgrade', (req: IncomingMessage, lien: Duplex) => {
    recu.push(`upgrade ${req.url}`);
    liens.add(lien);
    const accepte = createHash('sha1').update(`${req.headers['sec-websocket-key']}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`).digest('base64');
    lien.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accepte}\r\n\r\n`);
  });
  serveur.listen(0, '127.0.0.1');
  await once(serveur, 'listening');
  const fermer = () => {
    for (const lien of liens) lien.destroy();
    serveur.close();
  };
  return { url: `http://127.0.0.1:${(serveur.address() as AddressInfo).port}`, recu, fermer };
}

describe('C5 — la fin de l’entrée borne la sortie, quoi que retienne le relay', () => {
  it.each([
    ['la socket ouverte, le relay muet', true, ['POST /rooms', 'upgrade /room/ABC234']],
    ['`POST /rooms` sans réponse', false, ['POST /rooms']],
  ])('%s : le relay de `VITE_RELAY_URL` est visé, et le processus sort en 0 dans la borne', async (_cas, repondre, attendu) => {
    const relais = await relaisMuet(repondre);
    const p = ouvrirLeProcessus(VIVANT, [], { ...process.env, VITE_RELAY_URL: relais.url });
    try {
      await p.prochaine();
      expect((await p.appel('demarrer', { scenario: 'dome' })).ok).toBe(true);
      expect((await p.appel('salon', { type: 'heberger', args: ['Anne'] })).ok).toBe(true);
      await vi.waitFor(() => expect(relais.recu.map((r) => r.split('?')[0])).toEqual(attendu), { timeout: 10_000 });
      p.processus.stdin.end();
      const sortie = await Promise.race([once(p.processus, 'exit').then(([code]) => code), delai(BORNE_DE_SORTIE_MS + 5_000, 'toujours vivant')]);
      expect(sortie).toBe(0);
    } finally {
      if (p.processus.exitCode === null) p.processus.kill();
      relais.fermer();
    }
  }, LANCEMENT_MS);
});

/** Le témoin de `fetch` de D3, préchargé avant `vivant.mjs` : il note l'adresse visée sur la sortie d'erreur et ne
 *  joint rien. */
const TEMOIN = "globalThis.fetch = (url) => (process.stderr.write(`[témoin] ${url}\\n`), new Promise(() => {}));";

describe('D3 — le bundle de `vivant.mjs` est de développement', () => {
  it('sans `VITE_RELAY_URL` ni `NODE_ENV`, `salon { heberger }` vise le relay local, `/rooms`', async () => {
    const env = sansModeNiRelais();
    env.NODE_OPTIONS = `${env.NODE_OPTIONS ?? ''} --import=data:text/javascript,${encodeURIComponent(TEMOIN)}`.trim();
    const p = ouvrirLeProcessus(VIVANT, [], env);
    let erreur = '';
    p.processus.stderr.on('data', (morceau: Buffer) => { erreur += morceau.toString('utf8'); });
    const visees = () => [...erreur.matchAll(/^\[témoin\] (\S+)$/gm)].map(([, url]) => url.split('?')[0]);
    try {
      await p.prochaine();
      expect((await p.appel('demarrer', { scenario: 'dome' })).ok).toBe(true);
      expect((await p.appel('salon', { type: 'heberger', args: ['Anne'] })).ok).toBe(true);
      await vi.waitFor(() => expect(visees()).toEqual(['http://localhost:8787/rooms']), { timeout: 10_000 });
    } finally {
      if (p.processus.exitCode === null) p.processus.kill();
    }
  }, LANCEMENT_MS);
});
