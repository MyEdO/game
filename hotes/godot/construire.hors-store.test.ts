/**
 * LE BUNDLE DU PONT LU ET EXÉCUTÉ (#3009, `pont/CONTRAT.md`, section « Transport ») : sur un bundle bâti
 * (`empaqueter`), une passe de `lecturesDuBundle` ne laisse aucun nom de navigateur hors de ce que le processus porte
 * (`API_DU_NAVIGATEUR`) ou compte (`HORS_DU_PROCESSUS`) ; `salon` répond dans le contexte du processus ; le mode que
 * l'appelant dit à `empaqueter` est celui du bundle, l'adresse du relay comprise (`relayHttpUrl`).
 */
import { execFile } from 'node:child_process';
import { Console } from 'node:console';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PassThrough } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { RELAY_URL_PROD } from '../../src/hote/coop/page';
import { API_DU_NAVIGATEUR, HORS_DU_PROCESSUS, PONT, ecartsDesLectures, pontDuBundle } from './processus.mjs';
import { sansModeNiRelais } from './processus.testkit';
import { stockageDuProcessus } from './stockage.mjs';

/** Deux bundles bâtis, l'un lu par `lecturesDuBundle`, puis `--pont-seul` : ~55 s. */
const CONSTRUCTION_MS = 180_000;
const CONSTRUIRE = new URL('./construire.mjs', import.meta.url);

/** L'environnement des enfants (`sansModeNiRelais`). */
const ENV = sansModeNiRelais();

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
  const d2 = await enfant([fileURLToPath(CONSTRUIRE), '--pont-seul', '--sortie', sortie]);
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
