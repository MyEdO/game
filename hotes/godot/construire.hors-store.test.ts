/**
 * LE BUNDLE DU PONT LU ET EXÉCUTÉ (#3009, `pont/CONTRAT.md`, section « Transport ») : sur un bundle bâti
 * (`empaqueter`), une passe de `lecturesDuBundle` ne laisse aucun nom de navigateur hors de ce que le processus porte
 * (`API_DU_NAVIGATEUR`) ou compte (`HORS_DU_PROCESSUS`) ; `salon` répond dans le contexte du processus ; le mode que
 * l'appelant dit à `empaqueter` est celui du bundle, l'adresse du relay comprise (`relayHttpUrl`) ; sans entrée posée, le
 * bundle démarre le pont sur le contenu de test du commun, et `--entree` le bâtit depuis l'entrée qu'il nomme (#4936).
 */
import { execFile } from 'node:child_process';
import { Console } from 'node:console';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, truncateSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PassThrough } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { RELAY_URL_PROD } from '../../src/hote/coop/page';
import { API_DU_NAVIGATEUR, HORS_DU_PROCESSUS, PONT, ecartsDesLectures, pontDuBundle } from './processus.mjs';
import { sansModeNiRelais } from './processus.testkit';
import { stockageDuProcessus } from './stockage.mjs';
import { ecartsDeLaCopie, erreursDeLaRecette, fichiersAuDelaDeGitHub, signaturesDu } from './construire.mjs';

/** Deux bundles bâtis, l'un lu par `lecturesDuBundle`, puis `--pont-seul` : ~55 s. */
const CONSTRUCTION_MS = 180_000;
const CONSTRUIRE = new URL('./construire.mjs', import.meta.url);

/** L'environnement des enfants (`sansModeNiRelais`). */
const ENV = sansModeNiRelais();

/** L'entrée du jeu de rôle (`package.json`, scripts `godot:*`). */
const ENTREE_DU_JEU_DE_ROLE = '/hotes/godot/pont/entree-jeu-de-role.ts';
/** Une scène du paquet de test du commun (`src/scenes/fixtures/paquet-de-test.json`), que seul son contenu porte. */
const SCENE_DU_COMMUN = 'scene-de-test-a';

/** Ce qu'un bundle porte de son mode : l'adresse de prod, l'adresse locale, la branche de développement de
 *  `openValues` (`src/engine/tests.ts`). */
const marques = (code: string) => ({
  prod: code.includes(RELAY_URL_PROD),
  local: code.includes('http://localhost:8787'),
  developpement: code.includes('départage sans valeur nue'),
});

/** `node <args>` sous `ENV` : son code de sortie et ses sorties. */
const enfant = (args: string[]) => new Promise<{ code: number; stdout: string; stderr: string }>((resoudre) => {
  execFile(process.execPath, args, { env: ENV, maxBuffer: 1 << 24 }, (erreur, stdout, stderr) => {
    resoudre({ code: erreur ? Number(erreur.code ?? 1) : 0, stdout, stderr });
  });
});

const dossier = mkdtempSync(join(tmpdir(), 'construire-3009-'));
const sortie = join(dossier, 'pont-seul');
let lectures: Record<string, number> = {};
let levier: { production: string; developpement: string; apres: (string | null)[] };
let pontSeul: { code: number; stderr: string };
let code = '';

/** D1 et C1 : un processus à lui (la passe du `Linter` tient ~1,5 Go, hors du tas du worker) bâtit en production sous
 *  `NODE_ENV=development`, puis en développement, `NODE_ENV` retiré. D2 et C3 : `--pont-seul --sortie`, le chemin de
 *  ce qui se livre, après lui : deux passes du `Linter` à la fois ne tiennent pas sur tout poste. */
beforeAll(async () => {
  const script = `const { empaqueter, lecturesDuBundle } = await import(${JSON.stringify(CONSTRUIRE.href)});
const { writeFileSync } = await import('node:fs');
const etat = () => ('NODE_ENV' in process.env ? process.env.NODE_ENV : null);
process.env.NODE_ENV = 'development';
const { code: production } = await empaqueter(null, 'production');
const apres = [etat()];
delete process.env.NODE_ENV;
const { code: developpement } = await empaqueter(null, 'development');
apres.push(etat());
writeFileSync(${JSON.stringify(join(dossier, 'production.js'))}, production);
writeFileSync(${JSON.stringify(join(dossier, 'developpement.js'))}, developpement);
process.stdout.write(JSON.stringify({ lectures: lecturesDuBundle(production), apres }));`;
  const d1 = await enfant(['--input-type=module', '-e', script]);
  const d2 = await enfant([fileURLToPath(CONSTRUIRE), '--pont-seul', '--sortie', sortie, '--entree', ENTREE_DU_JEU_DE_ROLE]);
  if (d1.code !== 0) throw new Error(`l’enfant de D1 sort en ${d1.code} :\n${d1.stderr}`);
  const lu = JSON.parse(d1.stdout) as { lectures: Record<string, number>; apres: (string | null)[] };
  lectures = lu.lectures;
  levier = { production: readFileSync(join(dossier, 'production.js'), 'utf8'), developpement: readFileSync(join(dossier, 'developpement.js'), 'utf8'), apres: lu.apres };
  pontSeul = d2;
  code = d2.code === 0 ? readFileSync(join(sortie, PONT), 'utf8') : '';
}, CONSTRUCTION_MS);
afterAll(() => rmSync(dossier, { recursive: true, force: true }));

describe('C1 — la lecture du bundle', () => {
  it('aucun écart avec `API_DU_NAVIGATEUR` et `HORS_DU_PROCESSUS`', () => {
    expect(ecartsDesLectures(lectures, API_DU_NAVIGATEUR, HORS_DU_PROCESSUS)).toEqual([]);
  });

  it('`WebSocket` retiré de l’API : l’écart le nomme', () => {
    const api = API_DU_NAVIGATEUR.filter((nom) => nom !== 'WebSocket');
    expect(ecartsDesLectures(lectures, api, HORS_DU_PROCESSUS)).toEqual([`WebSocket : lu ${lectures.WebSocket}, ni porté par le processus ni dans la table`]);
  });

  it.each([-1, 1])('le compte de `self` décalé de %i : l’écart le nomme', (decalage) => {
    const table = { ...HORS_DU_PROCESSUS, self: { ...HORS_DU_PROCESSUS.self, lectures: HORS_DU_PROCESSUS.self.lectures + decalage } };
    expect(ecartsDesLectures(lectures, API_DU_NAVIGATEUR, table)).toEqual([`self : lu ${lectures.self}, table ${table.self.lectures}`]);
  });

  it('un nom ajouté à la table que le bundle ne lit pas : l’écart le nomme', () => {
    const table = { ...HORS_DU_PROCESSUS, process: { lectures: 1, garde: 'aucune' } };
    expect(ecartsDesLectures(lectures, API_DU_NAVIGATEUR, table)).toEqual(['process : lu 0, table 1']);
  });
});

describe('C3 — l’exécution dans le contexte du processus', () => {
  it('`salon` sans entrée répond ok: true avec ses zones, « Héberger » offert, et `erreursGlobales` reste vide', () => {
    const pont = pontDuBundle(code, new Console(new PassThrough()), stockageDuProcessus(null));
    const appel = (methode: string, entree?: unknown) => JSON.parse(pont.appeler(methode, entree === undefined ? null : JSON.stringify(entree)));
    expect(appel('demarrer', { scenario: 'dome' }).ok).toBe(true);
    const r = appel('salon') as { ok: boolean; zones: { 'salon.etat': unknown[]; 'salon.gestes': { id: string; refus: string | null }[] } };
    expect([r.ok, r.zones['salon.etat'], r.zones['salon.gestes'].find((g) => g.id === 'heberger')?.refus]).toEqual([true, [], null]);
    expect(appel('erreursGlobales')).toEqual({ ok: true, erreurs: [] });
  });
});

describe('D1 — le mode dit à `empaqueter` est celui du bundle, quoi que le processus ait fait avant', () => {
  it('`production` : l’adresse de prod, ni l’adresse locale ni la branche de développement', () => {
    expect(marques(levier.production)).toEqual({ prod: true, local: false, developpement: false });
  });

  it('`development` : l’adresse locale et la branche de développement, pas l’adresse de prod', () => {
    expect(marques(levier.developpement)).toEqual({ prod: false, local: true, developpement: true });
  });

  it('après chaque construction, `NODE_ENV` est ce qu’il était avant, absent compris', () => {
    expect(levier.apres).toEqual(['development', null]);
  });
});

describe('D2 — `--pont-seul --sortie` écrit un bundle de production', () => {
  it('sort en 0, et le bundle écrit porte l’adresse de prod, ni l’adresse locale ni la branche de développement', () => {
    expect(pontSeul.code, pontSeul.stderr).toBe(0);
    expect(marques(code)).toEqual({ prod: true, local: false, developpement: false });
  });
});

describe('l’entrée du jeu (#4936)', () => {
  it('sans entrée posée, le bundle porte le contenu de test du commun ; `--entree` le bâtit depuis l’entrée nommée, sans lui', () => {
    expect(code, 'le bundle de `--pont-seul`').not.toBe('');
    expect([levier.production.includes(SCENE_DU_COMMUN), levier.developpement.includes(SCENE_DU_COMMUN), code.includes(SCENE_DU_COMMUN)]).toEqual([true, true, false]);
  });
});

describe('la copie importée du projet, mise à jour des seuls fichiers changés', () => {
  /** Un projet d'essai : un script, une texture, un `.godot` et un `.godot` imbriqué que la signature ignore. */
  const projet = () => {
    const d = join(dossier, `projet-${Math.random().toString(36).slice(2)}`);
    for (const rel of ['scripts/a.gd', 'textures/herbe.jpg', '.godot/imported/x', 'sous/.godot/y']) {
      mkdirSync(join(d, rel, '..'), { recursive: true });
      writeFileSync(join(d, rel), rel);
    }
    return d;
  };
  it('signe chaque fichier par sa taille et sa date, hors de tout `.godot`', () => {
    expect(Object.keys(signaturesDu(projet())).sort()).toEqual([join('scripts', 'a.gd'), join('textures', 'herbe.jpg')]);
  });
  it('copie le neuf et le changé en taille ou en date, retire le parti, laisse l’inchangé', () => {
    const d = projet();
    const avant = signaturesDu(d);
    writeFileSync(join(d, 'scripts', 'b.gd'), 'neuf');
    utimesSync(join(d, 'scripts', 'a.gd'), 1, 1);
    rmSync(join(d, 'textures', 'herbe.jpg'));
    expect(ecartsDeLaCopie(avant, signaturesDu(d))).toEqual({ copier: [join('scripts', 'a.gd'), join('scripts', 'b.gd')], retirer: [join('textures', 'herbe.jpg')] });
    expect(ecartsDeLaCopie(signaturesDu(d), signaturesDu(d))).toEqual({ copier: [], retirer: [] });
  });
});

describe('les erreurs attendues d’une recette autonome (`ERREURS_ATTENDUES`)', () => {
  const RECETTE = 'res://recettes/essai.gd';
  const ATTENDUE = '[aretes] modele-absent : absent-du-listage';
  const source = (attendues: string) => `extends SceneTree\n\nconst RECETTE_AUTONOME := true\nconst ERREURS_ATTENDUES := ${attendues}\n`;
  const lignes = (...erreurs: string[]) => ['[essai] version=4.7', ...erreurs.map((e) => `ERROR: ${e}`), '   at: x (y.gd:1)', '[essai] erreurs=0'];
  it('sans déclaration, chaque erreur reste', () => {
    expect(erreursDeLaRecette(RECETTE, 'extends SceneTree\n', lignes(ATTENDUE))).toEqual([`ERROR: ${ATTENDUE}`]);
  });
  it('une attendue dite autant de fois que déclarée est retirée, les autres erreurs restent', () => {
    expect(erreursDeLaRecette(RECETTE, source(JSON.stringify([ATTENDUE])), lignes(ATTENDUE))).toEqual([]);
    expect(erreursDeLaRecette(RECETTE, source(JSON.stringify([ATTENDUE, ATTENDUE])), lignes(ATTENDUE, 'autre', ATTENDUE))).toEqual(['ERROR: autre']);
    expect(erreursDeLaRecette(RECETTE, source(JSON.stringify([ATTENDUE])), [`SCRIPT ERROR: ${ATTENDUE}`])).toEqual([]);
  });
  it('une attendue absente ou dite trop souvent est une faute', () => {
    expect(erreursDeLaRecette(RECETTE, source(JSON.stringify([ATTENDUE])), lignes())).toEqual([`${RECETTE} : erreur attendue 1 fois, dite 0 fois : ${ATTENDUE}`]);
    expect(erreursDeLaRecette(RECETTE, source(JSON.stringify([ATTENDUE])), lignes(ATTENDUE, ATTENDUE))).toEqual([`${RECETTE} : erreur attendue 1 fois, dite 2 fois : ${ATTENDUE}`]);
  });
  it('une déclaration illisible est une faute', () => {
    expect(erreursDeLaRecette(RECETTE, source('["a", 2]'), lignes())).toEqual([`${RECETTE} : ERREURS_ATTENDUES illisible : ["a", 2]`]);
    expect(erreursDeLaRecette(RECETTE, source("['a']"), lignes())).toEqual([`${RECETTE} : ERREURS_ATTENDUES illisible : ['a']`]);
  });
});

describe('la garde de l’export Web : aucun fichier au-delà de ce que GitHub tient (#4402)', () => {
  it('nomme, à toute profondeur, chaque fichier de plus de 104 857 600 octets, et lui seul', () => {
    const d = join(dossier, `export-${Math.random().toString(36).slice(2)}`);
    mkdirSync(join(d, 'modeles'), { recursive: true });
    for (const [rel, taille] of [['index.pck', 104_857_601], ['textures.pck', 104_857_600], [join('modeles', 'lourd.scn'), 200_000_000]] as const) {
      writeFileSync(join(d, rel), '');
      truncateSync(join(d, rel), taille);
    }
    expect(fichiersAuDelaDeGitHub(d)).toEqual([{ fichier: 'index.pck', taille: 104_857_601 }, { fichier: 'modeles/lourd.scn', taille: 200_000_000 }]);
  });
});
