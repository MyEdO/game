import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { VARIABLE_PARTIE } from '../scripts/test/partition.mjs';
import { tuerArbre } from '../scripts/gates/toutes.mjs';
import { detenteur, enCollecte } from './detenteur.testkit';

const PRECHARGE = './detenteur.testkit?precharge';
const registre = { precharge: (await import(/* @vite-ignore */ PRECHARGE)) as typeof import('./detenteur.testkit') };

/* Portée MODULE. Sous `sequence.hooks: 'stack'` (défaut de vitest), les `afterAll` d'une même portée
 * s'exécutent dans l'ordre INVERSE de leur enregistrement : celui-ci, posé AVANT l'appel de
 * `detenteur`, court APRÈS la libération qu'il enregistre, et la constate. */
let batiModule = 0;
afterAll(() => {
  expect(lireModule().n, 'portée module : la valeur n’a pas été libérée à la fin du fichier').toBe(2);
});
const lireModule = detenteur(() => ({ n: ++batiModule }));
const collecteDuModule = enCollecte();

describe('destructeur du détenteur', () => {
  let liberations = 0;
  let constructions = 0;
  describe('valeur utilisée', () => {
    const lire = detenteur(() => ({ n: ++constructions }), valeur => { liberations += valeur.n; });
    it('conserve la valeur jusqu’à la fin de portée', () => {
      expect(lire()).toBe(lire());
      expect(liberations).toBe(0);
    });
  });
  describe('valeur inutilisée', () => {
    detenteur(() => ({ n: ++constructions }), () => { liberations += 100; });
    it('ne construit rien', () => { expect(constructions).toBe(1); });
  });
  it('libère exactement la valeur construite', () => { expect(liberations).toBe(1); });

  it('le module réévalué ne réutilise pas la précharge', () => {
    expect(detenteur).not.toBe(registre.precharge.detenteur);
    expect(enCollecte).not.toBe(registre.precharge.enCollecte);
  });

  it('prouve le cycle afterAll réel et son erreur de destruction observable', async () => {
    const racine = fileURLToPath(new URL('../', import.meta.url));
    const fixture = fileURLToPath(new URL('../scripts/test/fixtures/detenteur-afterall.fixture.ts', import.meta.url)).replace(/\\/g, '/');
    const config = fileURLToPath(new URL('../scripts/test/fixtures/detenteur-afterall.config.ts', import.meta.url));
    const dossier = mkdtempSync(join(tmpdir(), 'detenteur-afterall-'));
    const fichier = join(dossier, 'rapport.json');
    const env: NodeJS.ProcessEnv = { ...process.env, WFRP_DETENTEUR_AFTERALL_RAPPORT: fichier };
    delete env[VARIABLE_PARTIE];
    try {
      const execution = await new Promise<{
        status: number | null; signal: NodeJS.Signals | null; erreur: Error | undefined;
        expiree: boolean; stdout: string; stderr: string;
      }>(resoudre => {
        const enfant = spawn(process.execPath, [
          fileURLToPath(new URL('../scripts/test/run.mjs', import.meta.url)),
          fixture, '--maxWorkers=1', '--config', config,
        ], { cwd: racine, env, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
        let stdout = '';
        let stderr = '';
        let erreur: Error | undefined;
        let expiree = false;
        enfant.stdout.setEncoding('utf8');
        enfant.stderr.setEncoding('utf8');
        enfant.stdout.on('data', texte => { stdout += texte; });
        enfant.stderr.on('data', texte => { stderr += texte; });
        enfant.on('error', faute => { erreur = faute; });
        const minuterie = setTimeout(() => {
          expiree = true;
          tuerArbre(enfant.pid);
        }, 60_000);
        enfant.on('close', (status, signal) => {
          clearTimeout(minuterie);
          resoudre({ status, signal, erreur, expiree, stdout, stderr });
        });
      });
      const diagnostic = `status=${execution.status}, signal=${execution.signal}, expiration=${execution.expiree}\n${execution.stdout}\n${execution.stderr}`;
      expect(execution.erreur, diagnostic).toBeUndefined();
      expect(execution.expiree, diagnostic).toBe(false);
      expect(execution.signal, diagnostic).toBeNull();
      expect(execution.status, diagnostic).toBe(1);
      let rapport;
      try {
        rapport = JSON.parse(readFileSync(fichier, 'utf8'));
      } catch (erreur) {
        throw new Error(`Rapport du cycle afterAll absent ou illisible : ${diagnostic}`, { cause: erreur });
      }
      expect(rapport.version, diagnostic).toBe(1);
      expect(rapport.reason, diagnostic).toBe('failed');
      expect(rapport.errors, diagnostic).toEqual([]);
      expect(rapport.modules, diagnostic).toHaveLength(1);
      expect(rapport.modules[0], diagnostic).toEqual({
        module: fixture,
        state: 'failed',
        errors: [],
        tests: [
          'la fabrique échouée ne produit aucune valeur',
          'afterAll ne détruit pas la fabrique échouée',
          'la valeur construite est partagée avant afterAll',
          'le même lecteur reconstruit et partage une nouvelle identité',
        ].map(name => ({ name, state: 'passed', mode: 'run', fails: false, errors: [] })),
        suites: [
          { name: 'fabrique échouée', state: 'passed', errors: [] },
          { name: 'après fabrique échouée', state: 'passed', errors: [] },
          { name: 'détenteur construit', state: 'failed', errors: [{ name: 'Error', message: 'DETENTEUR_AFTERALL_DESTRUCTION_ATTENDUE_2258' }] },
          { name: 'après destruction échouée', state: 'passed', errors: [] },
        ],
      });
      expect(Array.isArray(rapport.hooks), diagnostic).toBe(true);
      expect(rapport.hooks.every((hook: { name: string; type: string; owner: string | null; module: string }) =>
        hook.name === 'afterAll' && hook.module === fixture &&
        ((hook.type === 'module' && hook.owner === null) || (hook.type === 'suite' && typeof hook.owner === 'string')),
      ), diagnostic).toBe(true);
      for (const owner of ['fabrique échouée', 'détenteur construit', 'après destruction échouée']) {
        expect(rapport.hooks.filter((hook: { owner: string | null }) => hook.owner === owner), diagnostic).toEqual([
          { name: 'afterAll', type: 'suite', owner, module: fixture },
        ]);
      }
      expect(rapport.hooks.some((hook: { type: string }) => hook.type === 'module'), diagnostic).toBe(true);
    } finally {
      rmSync(dossier, { recursive: true, force: true });
    }
  }, 75_000);
});

describe('detenteur — lecteur paresseux, libéré au `afterAll` de la portée qui l’appelle (#1801)', () => {
  it('portée module : bâtit au premier appel, puis rend la MÊME valeur', () => {
    expect(lireModule()).toBe(lireModule());
    expect(batiModule).toBe(1);
  });

  let bati = 0;
  let lire = (): { n: number } => ({ n: -1 });

  describe('la portée qui tient la valeur', () => {
    lire = detenteur(() => ({ n: ++bati }));

    it('la fabrique ne court pas à la collecte', () => {
      expect(bati).toBe(0);
    });

    it('bâtit au premier appel, puis rend la MÊME valeur', () => {
      expect(lire()).toBe(lire());
      expect(bati).toBe(1);
    });
  });

  it('après la portée, la valeur est libérée : le lecteur rebâtit', () => {
    expect(lire().n).toBe(2);
  });
});

describe('detenteur — refusé hors de la collecte', () => {
  const collecteDuDescribe = enCollecte();
  let depuisLeHook: unknown;
  beforeAll(() => {
    try {
      detenteur(() => 0);
    } catch (e) {
      depuisLeHook = e;
    }
  });

  it('la collecte est reconnue en portée module et `describe`, pas à l’exécution', () => {
    expect([collecteDuModule, collecteDuDescribe, enCollecte()]).toEqual([true, true, false]);
  });

  it('appelé dans un `it`, il lève', () => {
    expect(() => detenteur(() => 0)).toThrow(/hors de la collecte/);
  });

  it('appelé dans un hook, il lève', () => {
    expect(String(depuisLeHook)).toMatch(/hors de la collecte/);
  });

  it('la tâche courante du runner porte le chemin RÉEL de ce fichier — la donnée que simule le cas suivant', () => {
    const etat = (globalThis as { __vitest_worker__?: { current?: { file?: { filepath: string } } } }).__vitest_worker__!;
    expect(etat.current?.file?.filepath).toBe(fileURLToPath(import.meta.url).replace(/\\/g, '/'));
  });

  it('lu depuis un AUTRE fichier que celui de sa collecte (testkit partagé), le lecteur lève', () => {
    // Le fichier suivant d'un worker est SIMULÉ en posant sa tâche dans l'état du runner — la même
    // donnée que la primitive lit ; un second fichier réel dépendrait de l'ordre des fichiers.
    const etat = (globalThis as { __vitest_worker__?: { current?: unknown } }).__vitest_worker__!;
    const courant = etat.current;
    etat.current = { type: 'test', result: {}, file: { filepath: '/depot/src/autre-suite.ts' } };
    try {
      expect(() => lireModule()).toThrow(/lu depuis \/depot\/src\/autre-suite\.ts/);
    } finally {
      etat.current = courant;
    }
    expect(lireModule().n).toBe(1);
  });
});
