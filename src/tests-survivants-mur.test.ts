/**
 * MUR DES TESTS SURVIVANTS (#3058) : une suite d'une zone qui survit à la bascule (`survit`, `COUCHES`) lit toute zone
 * qui survit, jamais une zone qui ne survit pas, ni un paquet de l'hôte web, ni un module hors des zones que sa ligne
 * n'ouvre pas à ses tests (`tests.outillage`). Le mur est `murs/tests-survivants` (`scripts/guards/lib/couchesLint.mjs`), joué par la gate `lint` ; la config
 * exempte les fichiers du stock `scripts/guards/lib/testsSurvivantsStock.mjs`. Ce banc mesure :
 *  1. CONTRAT de l'outillage des tests — une zone qui en déclare survit, chacun de ses chemins existe hors des zones ;
 *  2. ORACLE — `fermetureDUnTest` rend, sur une table écrite à la main, le verdict de chaque classe d'arc ;
 *  3. MORSURE — sur la config RÉSOLUE, une suite neuve hors du stock qui lit `src/state` est refusée, ses voisines
 *     ouvertes passent, et un fichier du stock est exempté ;
 *  4. STOCK — la mesure du mur sur toutes les suites des zones qui survivent, exemption levée, site par site, est le
 *     stock : un site de plus dans un fichier déjà stocké le fait croître.
 */
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { lintFixtures, selectionnerMessages } from '../scripts/guards/lib/lint.testkit.mjs';
import { COUCHES, estZone, fermetureDUnTest, zoneDe } from '../scripts/guards/lib/couches.mjs';
import { FERME_AU_TEST } from '../scripts/guards/lib/couchesLint.mjs';
import { estSuiteVitest } from '../scripts/guards/lib/fichierVitest.mjs';
import { TESTS_SURVIVANTS_STOCK } from '../scripts/guards/lib/testsSurvivantsStock.mjs';
import { ecartDuVolet } from '../scripts/guards/lib/stock.mjs';

const REGLE = 'murs/tests-survivants';
const STOCK = 'scripts/guards/lib/testsSurvivantsStock.mjs';
const RACINE = fileURLToPath(new URL('..', import.meta.url));
const existe = (rel: string) => existsSync(new URL(`../${rel}`, import.meta.url));

/** Les messages du mur sur chaque fixture, sous la config résolue (ou `configuration`). */
const pris = (fixtures: { filePath: string; code: string }[], configuration?: object) =>
  lintFixtures(fixtures, configuration).map((res) => selectionnerMessages(res, (m) => m.message.includes('#3058')).map((m) => {
    expect(m.ruleId, m.message).toBe(REGLE);
    return FERME_AU_TEST.exec(m.message)?.[1] ?? m.message;
  }));

describe('mur des tests survivants (#3058)', () => {
  it('CONTRAT : l’outillage des tests est celui d’une zone qui survit, vers des chemins hors des zones', () => {
    const declares = Object.entries(COUCHES).filter(([, c]) => c.tests);
    expect(declares.length, 'aucun droit de test déclaré : le contrat ne mesure rien').toBeGreaterThan(0);
    for (const [z, { tests = {}, survit }] of declares) {
      expect(survit, `${z} déclare un outillage de test sans survivre`).toBe(true);
      for (const chemin of tests.outillage ?? []) expect([zoneDe(chemin), existe(chemin)], `${z} → ${chemin}`).toEqual([null, true]);
    }
  });

  it('ORACLE : `fermetureDUnTest` rend le verdict écrit à la main de chaque classe d’arc', () => {
    const oracle: [de: string, cible: string, verdict: ReturnType<typeof fermetureDUnTest>][] = [
      ['noyau', 'src/noyau/cascade.ts', null], // sa zone
      ['noyau', 'src/engine/types.ts', null], // sa production
      ['noyau', 'src/scenes/test-scenarios/embuscade.ts', null], // survit
      ['noyau', 'src/state/store.ts', 'zone'], // ne survit pas
      ['noyau', 'src/ui/x.tsx', 'zone'],
      ['noyau', 'src/test-setup.ts', 'zone'], // racine
      ['noyau', 'src/hoteTexte/x.ts', null], // survit, hors du sens des couches
      ['engine', 'src/noyau/x.ts', null],
      ['lib', 'src/gameIso/x.ts', 'zone'],
      ['hotes', 'src/web/x.ts', 'zone'],
      ['noyau', 'scripts/guards/lib/couches.mjs', null], // outillage de ses tests
      ['noyau', 'scripts/ops/x.mjs', 'hors-zone'],
      ['geometry', 'scripts/guards/lib/couches.mjs', 'hors-zone'], // aucun droit de test
      ['noyau', 'src/zz-inconnue/x.ts', null], // dossier sans ligne : `murs/zone` le refuse
      ['state', 'src/ui/x.tsx', null], // ne survit pas : pas jugée
      ['racine', 'src/state/store.ts', null],
    ];
    expect(oracle.map(([de, cible]) => fermetureDUnTest(de, cible))).toEqual(oracle.map(([, , v]) => v));
  });

  it('MORSURE : une suite neuve hors du stock qui lit `src/state` est refusée ; ses voisines ouvertes passent, le stock est exempté', () => {
    const stocke = TESTS_SURVIVANTS_STOCK.find((e) => e.fichier.startsWith('src/noyau/'))!.fichier;
    const code = (spec: string) => `import { x } from '${spec}';\nexport const y = x;\n`;
    expect(pris([
      { filePath: 'src/noyau/zz-temoin-mur.test.ts', code: code('../state/store') },
      { filePath: 'src/noyau/zz-temoin-mur.test.ts'.replace('mur', 'type'), code: `import type { GameState } from '../state/store';\nexport type A = GameState;\n` },
      { filePath: 'src/noyau/zz-temoin-paquet.test.ts', code: code('zustand') },
      { filePath: 'src/scenes/zz-temoin-mur.test.ts', code: code('../ui/x') },
      { filePath: 'src/noyau/zz-temoin-ouvert.test.ts', code: code('../scenes/test-scenarios/embuscade') },
      { filePath: 'src/noyau/zz-temoin-kit.testkit.ts', code: code('./banc.testkit') },
      { filePath: 'src/state/zz-temoin-mur.test.ts', code: code('../ui/x') },
      { filePath: stocke, code: code('../state/store') },
    ])).toEqual([['state'], ['state'], ['zustand'], ['ui'], [], [], [], []]);
  });

  it('STOCK : la mesure du mur, exemption levée, sur toutes les suites des zones qui survivent, est son stock', () => {
    const suites = execFileSync('git', ['ls-files', '-co', '--exclude-standard'], { cwd: RACINE, encoding: 'utf8' }).split('\n')
      .filter((f) => { const z = zoneDe(f); return estZone(z) && COUCHES[z].survit === true && estSuiteVitest(f); });
    const configuration = { overrides: [{ files: ['**/*'], rules: { [REGLE]: 'error' } }] };
    const mesures = lintFixtures(suites.map((filePath) => ({ filePath, code: readFileSync(new URL(`../${filePath}`, import.meta.url), 'utf8') })), configuration);
    const sites = mesures.flatMap((res, i) => selectionnerMessages(res, (m) => m.ruleId === REGLE)
      .map((m) => ({ file: suites[i], ref: FERME_AU_TEST.exec(m.message)![1] })));
    const { neuves, perimees } = ecartDuVolet({ sites, stock: TESTS_SURVIVANTS_STOCK, ou: STOCK });
    expect(neuves, `Suites NEUVES d’une zone qui survit qui lisent une zone qu’elle ne survit pas — piloter le noyau par son banc (\`src/noyau/banc.testkit.ts\`) :\n  ${neuves.join('\n  ')}`).toEqual([]);
    expect(perimees, `Entrées de ${STOCK} soldées — retirer leur ligne :\n  ${perimees.join('\n  ')}`).toEqual([]);
  }, 120_000);
});
