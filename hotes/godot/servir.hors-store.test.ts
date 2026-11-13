/**
 * LE SERVEUR DE L'EXPORT WEB (#3086, `pont/CONTRAT.md`, section « Atelier 3D ») : `GET modeles/listage.json` rend
 * `{ manifestes, osDesRigides, erreurs, forme }`, les seuls manifestes validés contre leur GLB, de chacun les os qui
 * portent ses meshes rigides et la forme `glb`, en `no-store`, calculé au lancement puis à nouveau quand un fichier du
 * dossier change ; `GET modeles/<fichier>` sert le fichier en `no-store`,
 * 404 hors du dossier ou absent ; une URI malformée reçoit 400 et un dossier des modèles illisible passe dans
 * `erreurs`, le serveur continue. `deposerLesModeles` (#3778, #3946) écrit sous `modeles/` de l'export les mêmes
 * fichiers sans les GLB ni leur fiche d'import, le même listage en forme `scene`, et fait fabriquer la scène de chaque
 * modèle listé ; servi en `statique`, l'export rend ce dépôt.
 * Avec un dépôt (#3508, section « Éditeur ») : `GET depot/<id>` rend un projet manuscrit, prose matérialisée ;
 * `PUT depot/<id>` écrit à sa place un texte en forme dépôt de ce projet, et refuse tout autre texte sans rien écrire ;
 * `GET source/manifest.json` et `GET source/<livre>/<NNN>.md` rendent l'index des chapitres et le texte d'un chapitre du
 * `Source/` de ce dépôt-ci (#3606 M2g), 404 sans dépôt, export statique ou non.
 * Sans export (le pont vivant, `vivant.mjs`), seuls `modeles/`, `depot/` et `source/` répondent.
 */
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { baseDeTest, deposerModeleDeTest, elementSchema3, GLB_D_ELEMENT, GLB_DE_BASE } from './asset/modeles.testkit.ts';
import { empreinte } from './asset/empreinte.ts';
import { ecrireGlb } from './asset/glb.ts';
import { servir } from './servir.mjs';
import { deposerLesModeles, LISTAGE } from './listage.mjs';
import { dossierDesProjetsLivres, listerProjetsLivres, PROJETS_MANUSCRITS } from '../../scripts/guards/lib/projetsLivres.mjs';
import { lireProjetLivre } from '../../scripts/source/projetLivre.mjs';
import { listerDossier } from '../../scripts/guards/lib/lister.mjs';
import { cheminDuDepot } from '../../scripts/source/adresses.mjs';
import { books } from '../../src/data';

const racine = mkdtempSync(join(tmpdir(), 'servir-3086-'));
const web = join(racine, 'web');
const modeles = join(racine, 'modeles');
const sansCategorie: Record<string, unknown> = { ...elementSchema3('humanoide'), cle: { apparence: 'hache' } };
delete sansCategorie.categorie;
/** Un rigide tenu : sa tête et son manche pendent à l'os `root` d'un skin. */
const GLB_TENU = ecrireGlb({
  asset: { version: '2.0' }, nodes: [{ name: 'root', children: [1, 2] }, { name: 'tete', mesh: 0 }, { name: 'manche', mesh: 0 }],
  skins: [{ joints: [0] }], meshes: [{ primitives: [{ material: 0 }] }], materials: [{ name: 'metal' }],
}, null);
const masse = { ...elementSchema3('humanoide'), cle: { apparence: 'masse' }, glb: empreinte(GLB_TENU) };

let serveurs: { url: string; fermer: () => void }[] = [];
const demarrer = async (dossier = modeles) => {
  const s = await servir({ web, modeles: dossier });
  serveurs.push(s);
  return s.url;
};

beforeAll(() => {
  mkdirSync(web, { recursive: true });
  writeFileSync(join(web, 'index.html'), '<html></html>');
  deposerModeleDeTest(modeles, 'humanoide', baseDeTest('humanoide'), GLB_DE_BASE);
  deposerModeleDeTest(modeles, 'epee', elementSchema3('humanoide'), GLB_D_ELEMENT);
  deposerModeleDeTest(modeles, 'masse', masse, GLB_TENU);
  deposerModeleDeTest(modeles, 'sansCategorie', sansCategorie, GLB_D_ELEMENT);
  deposerModeleDeTest(modeles, 'cleNonObjet', { ...elementSchema3('humanoide'), cle: 'epee' }, GLB_D_ELEMENT);
  deposerModeleDeTest(modeles, 'absent', { ...elementSchema3('humanoide'), cle: { apparence: 'dague' } }, GLB_D_ELEMENT);
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
    const r = await fetch(`${await demarrer()}modeles/${LISTAGE}`);
    expect(r.status).toBe(200);
    expect(r.headers.get('cache-control')).toBe('no-store');
    const { manifestes, erreurs } = await r.json();
    expect(Object.keys(manifestes).sort()).toEqual(['epee', 'humanoide', 'masse']);
    expect(manifestes.epee).toEqual(elementSchema3('humanoide'));
    expect(erreurs).toEqual([
      expect.stringMatching(/^absent\.glb : ENOENT$/),
      expect.stringMatching(/^cleNonObjet\.manifeste\.json : \[cle-mal-formee\] cle : /),
      expect.stringMatching(/^sansCategorie\.manifeste\.json : \[categorie-inconnue\] categorie : /),
    ]);
  });

  it('le listage rend, de chaque manifeste validé, les os qui portent ses meshes rigides', async () => {
    const { osDesRigides } = await (await fetch(`${await demarrer()}modeles/${LISTAGE}`)).json();
    expect(osDesRigides).toEqual({ humanoide: [], epee: ['root'], masse: ['root'] });
  });

  it('un modèle déposé après le lancement entre au listage suivant', async () => {
    const vivant = join(racine, 'vivant');
    cpSync(modeles, vivant, { recursive: true });
    const url = await demarrer(vivant);
    const lister = async () => Object.keys((await (await fetch(`${url}modeles/${LISTAGE}`)).json()).manifestes).sort();
    expect(await lister()).toEqual(['epee', 'humanoide', 'masse']);
    deposerModeleDeTest(vivant, 'hache', { ...elementSchema3('humanoide'), cle: { apparence: 'hache' } }, GLB_D_ELEMENT);
    expect(await lister()).toEqual(['epee', 'hache', 'humanoide', 'masse']);
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

  it('l’export statique porte sous `modeles/` le dossier sans ses GLB ni leur fiche d’import et le listage du serveur en forme `scene`, et fait fabriquer la scène de chaque modèle listé', async () => {
    const url = await demarrer();
    const sortie = join(racine, 'export');
    const cible = join(sortie, 'modeles');
    writeFileSync(join(modeles, 'epee.glb.import'), '[remap]');
    const commandes = deposerLesModeles(modeles, sortie, (aFabriquer) => aFabriquer);
    const servi = await (await fetch(`${url}modeles/${LISTAGE}`)).json();
    expect(servi.forme).toBe('glb');
    expect(JSON.parse(readFileSync(join(cible, LISTAGE), 'utf8'))).toEqual({ ...servi, forme: 'scene' });
    expect(listerDossier(cible)).toEqual([...listerDossier(modeles).filter((f) => !/\.glb(\.import)?$/.test(f)), LISTAGE].sort());
    expect(commandes).toEqual(Object.keys(servi.manifestes).map((id) => ({ id, glb: join(modeles, `${id}.glb`), scene: join(cible, `${id}.scn`) })));
    const statique = await servir({ web: sortie, statique: true });
    serveurs.push(statique);
    expect((await (await fetch(`${statique.url}modeles/${LISTAGE}`)).json()).forme).toBe('scene');
    expect((await fetch(`${statique.url}modeles/epee.glb`)).status).toBe(404);
  });

  it('un dossier des modèles qui n’est pas un dossier passe dans `erreurs`, et le serveur sert la suivante', async () => {
    const url = await demarrer(join(web, 'index.html'));
    const { manifestes, osDesRigides, erreurs } = await (await fetch(`${url}modeles/${LISTAGE}`)).json();
    expect([manifestes, osDesRigides]).toEqual([{}, {}]);
    expect(erreurs).toEqual([expect.stringMatching(/ : ENOTDIR$/)]);
    expect((await fetch(`${url}index.html`)).status).toBe(200);
  });
});

describe('servir, le dépôt', () => {
  const depot = join(racine, 'depot');
  const corpus = dossierDesProjetsLivres(depot);
  const [manuscrit, genere] = [true, false].map((m) => listerProjetsLivres().find((rel) => basename(rel) in PROJETS_MANUSCRITS === m)!);
  const idDe = (rel: string) => (JSON.parse(readFileSync(join(corpus, rel), 'utf8')) as { id: string }).id;
  const disque = () => readFileSync(join(corpus, manuscrit), 'utf8');
  let url = '';
  let id = '';

  beforeAll(async () => {
    for (const rel of [manuscrit, genere]) {
      mkdirSync(dirname(join(corpus, rel)), { recursive: true });
      cpSync(join(dossierDesProjetsLivres(), rel), join(corpus, rel));
    }
    const s = await servir({ web, depot });
    serveurs.push(s);
    url = s.url;
    id = idDe(manuscrit);
  });

  it('GET rend le projet manuscrit, prose matérialisée, en no-store ; un projet généré, un id inconnu reçoivent 404', async () => {
    const r = await fetch(`${url}depot/${id}`);
    expect([r.status, r.headers.get('cache-control')]).toEqual([200, 'no-store']);
    expect(await r.json()).toEqual(lireProjetLivre(manuscrit, depot));
    expect((await fetch(`${url}depot/${idDe(genere)}`)).status).toBe(404);
    expect((await fetch(`${url}depot/nulle-part`)).status).toBe(404);
  });

  it('sans export, seuls modeles/ et depot/ répondent, le reste reçoit 404', async () => {
    const s = await servir({ modeles, depot });
    serveurs.push(s);
    const statuts = await Promise.all([`modeles/${LISTAGE}`, 'modeles/epee.glb', `depot/${id}`, 'index.html', ''].map(async (c) => (await fetch(`${s.url}${c}`)).status));
    expect(statuts).toEqual([200, 200, 200, 404, 404]);
  });

  it('sans dépôt, depot/ n’est pas servi', async () => {
    expect((await fetch(`${await demarrer()}depot/${id}`)).status).toBe(404);
  });

  it('source/ sert l’index des chapitres et le texte d’un chapitre du Source/ de ce dépôt ; un chapitre absent reçoit 404', async () => {
    const manifeste = await fetch(`${url}source/manifest.json`);
    expect(manifeste.status).toBe(200);
    const [premier] = (await manifeste.json() as Record<string, { chapitres: { ch: string; fichier: string }[] }>)['livre-de-base'].chapitres;
    const chapitre = await fetch(`${url}source/livre-de-base/${premier.ch}.md`);
    const dir = books.find((b) => b.id === 'livre-de-base')!.dir!;
    expect([chapitre.status, await chapitre.text()]).toEqual([200, readFileSync(cheminDuDepot(join(dir, premier.fichier)), 'utf8').replace(/\r\n?/g, '\n')]);
    expect((await fetch(`${url}source/livre-de-base/999.md`)).status).toBe(404);
  });

  it('sans dépôt, source/ n’est pas servi, que l’export soit statique ou non', async () => {
    const statique = await servir({ web, statique: true });
    serveurs.push(statique);
    const statuts = await Promise.all([await demarrer(), statique.url].flatMap((u) => ['source/manifest.json', 'source/livre-de-base/01.md'].map(async (c) => (await fetch(`${u}${c}`)).status)));
    expect(statuts).toEqual([404, 404, 404, 404]);
  });

  it('PUT écrit un texte en forme dépôt du projet à sa place', async () => {
    const texte = disque().replace(/\n$/, ' \n');
    const r = await fetch(`${url}depot/${id}`, { method: 'PUT', body: texte });
    expect(r.status).toBe(200);
    expect(disque()).toBe(texte);
  });

  it.each([
    ['du texte illisible', () => '{', /^JSON illisible$/],
    ['un autre projet', () => disque().replace(`"id": "${id}"`, '"id": "autre"'), /^le projet autre au lieu de /],
    ['la prose matérialisée', () => JSON.stringify(lireProjetLivre(manuscrit, depot)), /descRef/],
  ])('PUT refuse %s en 422, sans rien écrire', async (_, texte, raison) => {
    const avant = disque();
    const r = await fetch(`${url}depot/${id}`, { method: 'PUT', body: texte() });
    expect([r.status, await r.text()]).toEqual([422, expect.stringMatching(raison)]);
    expect(disque()).toBe(avant);
  });

  it('une autre méthode reçoit 405', async () => {
    expect((await fetch(`${url}depot/${id}`, { method: 'DELETE' })).status).toBe(405);
  });
});
