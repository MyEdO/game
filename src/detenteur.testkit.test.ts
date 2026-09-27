import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { detenteur, enCollecte } from './detenteur.testkit';

/* Portée MODULE. Sous `sequence.hooks: 'stack'` (défaut de vitest), les `afterAll` d'une même portée
 * s'exécutent dans l'ordre INVERSE de leur enregistrement : celui-ci, posé AVANT l'appel de
 * `detenteur`, court APRÈS la libération qu'il enregistre, et la constate. */
let batiModule = 0;
afterAll(() => {
  expect(lireModule().n, 'portée module : la valeur n’a pas été libérée à la fin du fichier').toBe(2);
});
const lireModule = detenteur(() => ({ n: ++batiModule }));
const collecteDuModule = enCollecte();

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
