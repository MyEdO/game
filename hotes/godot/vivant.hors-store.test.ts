/**
 * LE PONT VIVANT (#3945, `pont/CONTRAT.md`, section « Transport ») : `node hotes/godot/vivant.mjs` annonce sur sa
 * première ligne l'URL de son serveur, puis rend à chaque ligne `[methode, json|null]` de son entrée la ligne que rend
 * `wfrpPont.appeler` ; sa sortie ne porte que ces lignes, et la fin de son entrée le fait sortir en 0. Le pont tiré
 * d'un bundle (`pontDuBundle`) écrit sur la `console` donnée.
 */
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { Console } from 'node:console';
import { once } from 'node:events';
import { createInterface } from 'node:readline';
import { PassThrough } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { pontDuBundle } from './construire.mjs';
import { LISTAGE } from './listage.mjs';

const VIVANT = fileURLToPath(new URL('./vivant.mjs', import.meta.url));
/** Le lancement bâtit le bundle et charge les assets : ~10 s. */
const LANCEMENT_MS = 120_000;

let processus: ChildProcessWithoutNullStreams;
let lignes: AsyncIterator<string>;
const sortie: string[] = [];
let url = '';

const prochaine = async () => {
  const { value, done } = await lignes.next();
  if (done) throw new Error('sortie standard close');
  sortie.push(value);
  return value;
};
const appel = async (methode: string, entree?: unknown) => {
  processus.stdin.write(`${JSON.stringify([methode, entree === undefined ? null : JSON.stringify(entree)])}\n`);
  return JSON.parse(await prochaine()) as { ok: boolean; vue?: unknown; erreur?: { categorie: string } };
};

beforeAll(async () => {
  processus = spawn(process.execPath, [VIVANT], { stdio: ['pipe', 'pipe', 'pipe'] });
  processus.stderr.resume();
  lignes = createInterface({ input: processus.stdout, crlfDelay: Infinity })[Symbol.asyncIterator]();
  url = (JSON.parse(await prochaine()) as { url: string }).url;
}, LANCEMENT_MS);
afterAll(() => {
  if (processus.exitCode === null) processus.kill();
});

describe('vivant', () => {
  it('annonce l’URL d’un serveur qui sert le listage des modèles', async () => {
    expect(url).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/$/);
    expect((await fetch(`${url}modeles/${LISTAGE}`)).status).toBe(200);
  });

  it('demarrer dome rend ok: true avec sa vue', async () => {
    const r = await appel('demarrer', { scenario: 'dome' });
    expect([r.ok, r.vue != null]).toEqual([true, true]);
  });

  it('une requête de plus de 300 Ko reçoit sa réponse', async () => {
    const r = await appel('vue', { bourrage: 'a'.repeat(300_000) });
    expect([r.ok, r.erreur?.categorie]).toEqual([false, 'validation']);
  });

  it('la fin de l’entrée le fait sortir en 0, sa sortie n’ayant porté que l’annonce et une ligne par requête', async () => {
    processus.stdin.end();
    const [code] = await once(processus, 'exit');
    for (let r = await lignes.next(); !r.done; r = await lignes.next()) sortie.push(r.value);
    expect(code).toBe(0);
    expect(sortie).toHaveLength(3);
  });
});

describe('pontDuBundle', () => {
  it('la console du bundle est celle donnée', () => {
    const flux = new PassThrough();
    const pont = pontDuBundle("globalThis.wfrpPont = { appeler: () => (console.log('du noyau'), '{}') }", new Console(flux));
    pont.appeler('vue');
    flux.end();
    expect(String(flux.read())).toBe('du noyau\n');
  });
});
