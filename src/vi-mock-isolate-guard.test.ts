import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fichiersDeLaSuite } from '../scripts/guards/lib/suiteVitest.mjs';
import { RACINES_DE_LA_SUITE } from '../scripts/guards/lib/racinesDeLaSuite.mjs';

/**
 * Garde-fou `isolate: false` × mock de MODULE — la suite tourne avec `test.isolate: false`
 * (`vite.config.ts`) : le graphe de modules est PARTAGÉ par worker. Un mock de module posé par un
 * fichier de test n'atteint donc pas un module déjà évalué par un fichier précédent du même worker :
 * la liaison dépend de l'ordre des fichiers, lui-même fonction du nombre de cœurs — vert en local,
 * rouge en CI (repro 2026-07-28, `resolve-membre.test.ts`, 5 seeds `--sequence.shuffle` sur 5).
 * Un besoin de tenue/donnée fabriquée s'enregistre dans le REGISTRE lu à l'appel (patron
 * `withTenue` de `src/gameIso/rig/parts/resolve-membre.test.ts`), jamais par mock de module.
 *
 * PÉRIMÈTRE : le mock de MODULE, et lui seul. L'autre famille du graphe partagé — l'espion posé sur
 * un namespace de module ou sur un prototype `three` — est fermée PAR CONSTRUCTION par
 * `test.restoreMocks: true` (vite.config.ts) : chaque espion est rendu après SON test, aucun ne fuit
 * vers les fichiers suivants du worker. La garde ne mesure donc que ce qu'elle couvre.
 * Les motifs traqués sont composés à l'exécution (jamais écrits en clair) : la garde est soumise à
 * la règle qu'elle fait respecter (#828) et ne se détecte pas elle-même.
 */

const ROOT = fileURLToPath(new URL('..', import.meta.url)); // racine du projet (src/ → ..)

const VI = 'vi';
/** Appels qui touchent au registre de modules du worker (composés, cf. #828) — le mock de MODULE, dont la
 *  liaison dépend de l'ordre, et la remise à zéro du registre, qui fait réévaluer aux fichiers suivants
 *  du worker des modules déjà chargés (deux instances d'un même singleton). */
const MODULE_MOCK_CALLS = [`${VI}.mock(`, `${VI}.doMock(`, `${VI}.resetModules(`];

/** `file:line` de chaque appel de mock de module d'une source. */
export function moduleMockHits(source: string, label: string): string[] {
  const out: string[] = [];
  source.split(/\r?\n/).forEach((line, i) => {
    for (const call of MODULE_MOCK_CALLS) if (line.includes(call)) out.push(`${label}:${i + 1} → ${line.trim()}`);
  });
  return out;
}

const VITE_CONFIG = readFileSync(join(ROOT, 'vite.config.ts'), 'utf8');
const ISOLATE_FALSE = /isolate\s*:\s*false/.test(VITE_CONFIG);

describe('garde-fou — mock de module interdit tant que la suite partage son graphe (`isolate: false`)', () => {
  it('la garde s\'arme sur l\'état RÉEL de vite.config.ts (`isolate: false` lu, jamais supposé)', () => {
    expect(ISOLATE_FALSE).toBe(true);
  });

  it('l’autre famille du graphe partagé est fermée par construction (`restoreMocks` LU dans la config)', () => {
    expect(
      /restoreMocks\s*:\s*true/.test(VITE_CONFIG),
      "l'en-tête de ce fichier affirme que `spyOn` est fermé par construction : `test.restoreMocks: true` doit exister dans vite.config.ts",
    ).toBe(true);
  });

  it('chaque racine de la suite porte au moins une suite — la garde ne mesure pas le vide', () => {
    const suites = fichiersDeLaSuite();
    for (const { dir } of RACINES_DE_LA_SUITE)
      expect(suites.some(({ rel }) => rel.startsWith(`${dir}/`)), `${dir} : aucune suite scannée`).toBe(true);
  });

  it('cas planté : un appel de mock de module est détecté avec son `fichier:ligne` (preuve TDD)', () => {
    const planted = ['const x = 1;', `${VI}.mock('./career', () => ({}));`].join('\n');
    expect(moduleMockHits(planted, 'plante.test.ts')[0]).toContain('plante.test.ts:2');
    expect(moduleMockHits(`${VI}.doMock('./x');`, 'p.test.ts')).toHaveLength(1);
    expect(moduleMockHits(`  ${VI}.resetModules();`, 'p.test.ts')[0]).toContain('p.test.ts:1');
  });

  it('faux positif écarté : un espion ou une assertion typée ne sont pas des mocks de module', () => {
    expect(moduleMockHits(`${VI}.spyOn(console, 'warn');`, 'p.test.ts')).toEqual([]);
    expect(moduleMockHits(`${VI}.mocked(window.matchMedia);`, 'p.test.ts')).toEqual([]);
  });

  it('aucun fichier de test du périmètre ne mocke de module', () => {
    if (!ISOLATE_FALSE) return; // suite isolée par fichier : la liaison redevient déterministe
    const offenders: string[] = [];
    for (const { rel, text } of fichiersDeLaSuite()) offenders.push(...moduleMockHits(text, rel));
    expect(offenders, `Mock de module sous \`isolate: false\` — la liaison dépend de l'ordre des fichiers du worker.\nEnregistrer la donnée fabriquée dans le registre lu à l'appel (patron \`withTenue\`, resolve-membre.test.ts) :\n${offenders.join('\n')}`).toEqual([]);
  });
});

/**
 * SINGLETONS D'OPTION sous `isolate: false` — même famille de défaut que le mock de module, mesurée
 * en vrai (2026-07-30) : `engine/fixedDie` porte l'option « Dés fixés » en variable de MODULE, donc
 * partagée par tous les fichiers d'un worker. Un fichier qui l'allume sans la rendre la fait fuir vers
 * les suivants — la fenêtre de pose de dé d'un Critique s'y ouvre, l'attaque suspend, les Blessures
 * n'arrivent jamais (`at-terre.test.ts` : « expected 3 to be <= 0 », vert ou rouge selon l'ordre).
 * La remise à zéro appartient donc au SOCLE (`src/test-setup.ts`), au même titre que les règles
 * optionnelles : aucun ordre d'exécution ne doit pouvoir décider du résultat.
 */
describe('singletons d’OPTION partagés — remis à zéro par le socle de test', () => {
  const SETUP = readFileSync(join(ROOT, 'src', 'test-setup.ts'), 'utf8');
  /** Le `beforeEach` du socle (le bloc qui prépare CHAQUE test), COMMENTAIRES RETIRÉS : un appel
   *  commenté ne remet rien à zéro — le lire comme tel serait une sonde menteuse. */
  const beforeEachBody = SETUP.slice(SETUP.indexOf('beforeEach(('), SETUP.indexOf('afterEach(('))
    .split('\n').map((l) => l.replace(/\/\/.*$/, '')).join('\n');

  it('le socle remet « Dés fixés » à zéro AVANT chaque test (pas seulement les fichiers qui y pensent)', () => {
    expect(beforeEachBody, "resetDesFixes() manque au beforeEach de src/test-setup.ts : l'option fuit d'un fichier à l'autre").toContain('resetDesFixes()');
    expect(SETUP).toContain("from './engine/fixedDie'");
  });

  it('les remises à zéro de singletons vivent AVANT le décor, dans le même beforeEach que les règles', () => {
    // Voisinage vérifié : la purge des règles optionnelles est la référence de cette famille.
    expect(beforeEachBody).toContain('loadRuleOverrides({})');
  });
});
