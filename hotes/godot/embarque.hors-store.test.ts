/**
 * LE NOYAU EMBARQUÉ (#3951, `pont/CONTRAT.md`, section « Transport ») : le point d'entrée empaqueté
 * (`empaqueterLeProcessus`) tient seul dans son dossier `noyau/`, lit le bundle posé à côté de lui, annonce son
 * serveur, qui ne sert que `modeles/`, le dossier voisin de `noyau/`, rend une ligne par requête, garde le stockage du
 * bundle au fichier de son option `--stockage` et sort en 0 à la fin de son entrée.
 */
import { once } from 'node:events';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { empaqueterLeProcessus } from './construire.mjs';
import { LISTAGE } from './listage.mjs';
import { PONT } from './processus.mjs';
import { ouvrirLeProcessus, type ProcessusDuPont } from './processus.testkit';

const racine = mkdtempSync(join(tmpdir(), 'embarque-3951-'));
const noyau = join(racine, 'noyau');
const stockage = join(racine, 'donnees', 'stockage.json');
let tuyau: ProcessusDuPont;
let url = '';

beforeAll(async () => {
  mkdirSync(join(racine, 'modeles'), { recursive: true });
  writeFileSync(join(racine, 'modeles', LISTAGE), '{}');
  mkdirSync(noyau);
  writeFileSync(join(noyau, PONT), "globalThis.wfrpPont = { appelerEnOctets: (methode) => (localStorage.setItem('appelee', methode), JSON.stringify({ ok: true, methode })), octets: () => null }");
  tuyau = ouvrirLeProcessus(await empaqueterLeProcessus(noyau), `--stockage=${stockage}`);
  url = (JSON.parse(await tuyau.prochaine()) as { url: string }).url;
}, 60_000);
afterAll(() => {
  if (tuyau.processus.exitCode === null) tuyau.processus.kill();
  rmSync(racine, { recursive: true, force: true });
});

describe('noyau embarqué', () => {
  it('sert le listage des modèles déposés à côté de son dossier', async () => {
    expect((await fetch(`${url}modeles/${LISTAGE}`)).status).toBe(200);
  });

  it.each([`noyau/${PONT}`, `modeles/%2e%2e/noyau/${PONT}`, LISTAGE])('ne sert rien hors de modeles/ : %s', async (chemin) => {
    expect((await fetch(`${url}${chemin}`)).status).toBe(404);
  });

  it('rend à une requête la ligne du pont du bundle posé à côté de lui', async () => {
    expect(await tuyau.appel('vue')).toEqual({ ok: true, methode: 'vue' });
  });

  it('ce que le bundle écrit à son stockage vit au fichier de l’option --stockage', () => {
    expect(JSON.parse(readFileSync(stockage, 'utf8'))).toEqual({ appelee: 'vue' });
  });

  it('la fin de l’entrée le fait sortir en 0', async () => {
    tuyau.processus.stdin.end();
    expect((await once(tuyau.processus, 'exit'))[0]).toBe(0);
  });
});
