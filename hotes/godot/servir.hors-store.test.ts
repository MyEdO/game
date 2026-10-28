/**
 * LE SERVEUR DE L'EXPORT WEB (#3086, `pont/CONTRAT.md`, section « Atelier 3D ») : `GET modeles/` rend
 * `{ manifestes, erreurs }`, les seuls manifestes validés contre leur GLB, en `no-store` ; `GET modeles/<fichier>` sert le
 * fichier en `no-store`, 404 hors du dossier ou absent ; une URI malformée reçoit 400 et un dossier des modèles illisible
 * passe dans `erreurs`, le serveur continue.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { baseSchema3, deposerSchema3, elementSchema3, GLB_D_ELEMENT, GLB_DE_BASE } from './asset/schema3.testkit.ts';
import { servir } from './servir.mjs';

const racine = mkdtempSync(join(tmpdir(), 'servir-3086-'));
const web = join(racine, 'web');
const modeles = join(racine, 'modeles');
const sansCategorie: Record<string, unknown> = { ...elementSchema3('humanoide'), cle: { apparence: 'hache' } };
delete sansCategorie.categorie;

let serveurs: { url: string; fermer: () => void }[] = [];
const demarrer = async (dossier = modeles) => {
  const s = await servir({ web, modeles: dossier });
  serveurs.push(s);
  return s.url;
};

beforeAll(() => {
  mkdirSync(web, { recursive: true });
  writeFileSync(join(web, 'index.html'), '<html></html>');
  deposerSchema3(modeles, 'humanoide', baseSchema3('humanoide'), GLB_DE_BASE);
  deposerSchema3(modeles, 'epee', elementSchema3('humanoide'), GLB_D_ELEMENT);
  deposerSchema3(modeles, 'sansCategorie', sansCategorie, GLB_D_ELEMENT);
  deposerSchema3(modeles, 'cleNonObjet', { ...elementSchema3('humanoide'), cle: 'epee' }, GLB_D_ELEMENT);
  deposerSchema3(modeles, 'absent', { ...elementSchema3('humanoide'), cle: { apparence: 'dague' } }, GLB_D_ELEMENT);
  rmSync(join(modeles, 'absent.glb'));
  mkdirSync(join(modeles, 'sous'));
});
afterAll(() => {
  serveurs.forEach((s) => s.fermer());
  serveurs = [];
  rmSync(racine, { recursive: true, force: true });
});

describe('servir', () => {
  it('le listage rend exactement les manifestes validés contre leur GLB, et les erreurs des autres, en no-store', async () => {
    const r = await fetch(`${await demarrer()}modeles/`);
    expect(r.status).toBe(200);
    expect(r.headers.get('cache-control')).toBe('no-store');
    const { manifestes, erreurs } = await r.json();
    expect(Object.keys(manifestes).sort()).toEqual(['epee', 'humanoide']);
    expect(manifestes.epee).toEqual(elementSchema3('humanoide'));
    expect(erreurs).toEqual([
      expect.stringMatching(/^absent\.glb : ENOENT$/),
      expect.stringMatching(/^cleNonObjet\.manifeste\.json : \[cle-mal-formee\] cle : /),
      expect.stringMatching(/^sansCategorie\.manifeste\.json : \[categorie-inconnue\] categorie : /),
    ]);
  });

  it('un fichier du dossier est servi en no-store', async () => {
    const r = await fetch(`${await demarrer()}modeles/epee.glb`);
    expect([r.status, r.headers.get('cache-control'), r.headers.get('content-type')]).toEqual([200, 'no-store', 'model/gltf-binary']);
    expect(new Uint8Array(await r.arrayBuffer())).toEqual(GLB_D_ELEMENT);
  });

  it.each([['une évasion', 'modeles/..%2Fweb%2Findex.html'], ['un absent', 'modeles/absent.glb'], ['un dossier', 'modeles/sous']])('%s reçoit 404', async (_, chemin) => {
    expect((await fetch(`${await demarrer()}${chemin}`)).status).toBe(404);
  });

  it('une URI malformée reçoit 400, et le serveur sert la suivante', async () => {
    const url = await demarrer();
    expect((await fetch(`${url}%E0%A4%A`)).status).toBe(400);
    expect(await (await fetch(`${url}index.html`)).text()).toBe('<html></html>');
  });

  it('un dossier des modèles qui n’est pas un dossier passe dans `erreurs`, et le serveur sert la suivante', async () => {
    const url = await demarrer(join(web, 'index.html'));
    const { manifestes, erreurs } = await (await fetch(`${url}modeles/`)).json();
    expect(manifestes).toEqual({});
    expect(erreurs).toEqual([expect.stringMatching(/ : ENOTDIR$/)]);
    expect((await fetch(`${url}index.html`)).status).toBe(200);
  });
});
