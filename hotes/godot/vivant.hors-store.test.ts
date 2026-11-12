/**
 * LE PONT VIVANT (#3945, `pont/CONTRAT.md`, section « Transport ») : `node hotes/godot/vivant.mjs` annonce sur sa
 * première ligne l'URL de son serveur, puis rend à chaque ligne `[methode, json|null]` de son entrée la ligne JSON que
 * rend `wfrpPont.appelerEnOctets` ; une réponse qui porte des octets la précède de la ligne `octets <n>` et la suit de
 * ses `n` octets bruts (#3948). La fin de son entrée le fait sortir en 0. Le pont tiré d'un bundle (`pontDuBundle`)
 * écrit sur la `console` donnée.
 */
import { Console } from 'node:console';
import { once } from 'node:events';
import { PassThrough } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { LISTAGE } from './listage.mjs';
import { pontDuBundle } from './processus.mjs';
import { ouvrirLeProcessus, type ProcessusDuPont } from './processus.testkit';
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
});
