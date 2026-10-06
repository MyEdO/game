import { describe, expect, it } from 'vitest';
import { readCorpus } from '../../../scripts/guards/lib/sourceCorpus.mjs';
import { estFichierVitest, estSuiteVitest } from '../../../scripts/guards/lib/fichierVitest.mjs';
import { specificateursDe } from '../../../scripts/guards/lib/importGraph.mjs';
import { analyserCorpus } from '../../../scripts/guards/lib/dialecte.mjs';
import type { SourceFile } from 'typescript/unstable/ast';
import type { Diagnostic } from 'typescript/unstable/sync';

/**
 * LE HARNAIS DE BANC RESTE DANS LES BANCS — `stage/banc-volumique.ts` est le SEUL fichier non-`.test.`
 * de `src/gameIso` à importer `vitest` (précédent unique du dépôt : `src/test-setup.ts`). Six faits
 * s'y tiennent, chacun réfutable seul :
 *  1. aucun fichier de PRODUCTION de `src/` n'importe le harnais — un renderer de banc, une
 *     rasterisation stubbée ou une purge de singletons embarqués dans le bundle de jeu, c'est du code
 *     de test livré au joueur ;
 *  2. aucun fichier de PRODUCTION de `src/gameIso/**` n'importe `vitest` — le harnais est le seul, et
 *     il n'a pas de jumeau côté production. EST DE LA PRODUCTION ce que vitest ne joue pas : ni
 *     `.test.` (`vitest run`) ni `.bench.` (`vitest bench`), qui importe l'API `bench` par
 *     construction. Ce fait ne dit RIEN d'un essaimage entre bancs : un deuxième harnais écrit dans
 *     un `.test.` importe `vitest` légitimement et lui échappe par construction — c'est le fait 3
 *     qui mord là ;
 *  3. `implements StageRenderer` n'apparaît qu'UNE fois dans tout `src/`, `.test.` COMPRIS : le
 *     renderer de banc est unique, et un banc qui se réécrit le sien au lieu de composer
 *     `BancRenderer` est détecté ;
 *  4. tout `.test.` qui importe le harnais appelle `brancherArdoise(` : un importeur sans ardoise
 *     démarre sur les caches de MODULE laissés chargés par le fichier précédent (`isolate: false`) ;
 *  5. tout `.test.` qui MONTE l'écran volumique l'appelle aussi — le fait 4 ne couvre que les
 *     IMPORTEURS du harnais, et un banc peut monter l'écran par un hôte (`EditorCanvas`) sans rien
 *     lui emprunter. Il hérite alors des DEUX drapeaux de module qui gouvernent le travail différé de
 *     l'écran (`sliceArmed` du cuiseur, `image` du battement), et les lègue armés au suivant.
 *
 *  6. AUCUN `.test.` de `src/**` ne pose une horloge d'images en `beforeAll` — ni assignation ni
 *     espion sur `requestAnimationFrame`, `cancelAnimationFrame` ou `performance.now`. Les espions
 *     sont rendus AVANT chaque test (`restoreMocks`, `vite.config.ts`), donc APRÈS le `beforeAll` du
 *     fichier : un voisin du worker qui a espionné le rAF global rend à ce banc celui de jsdom au
 *     seuil de son premier test (`isolate: false`), et un collecteur posé une fois pour toutes ne
 *     l'atteint jamais — l'écran arme sa boucle sur un rAF que le banc ne sert pas, et le banc rougit
 *     sur l'ORDRE DES FICHIERS du worker. La forme canonique est `brancherImagesPilotees()`
 *     (`banc-volumique.ts`), qui pose l'horloge et le collecteur À CHAQUE TEST.
 *
 * PÉRIMÈTRE : `src/**` en entier pour les faits 1, 3, 4, 5 et 6 ; `src/gameIso/**` pour le fait 2 (le
 * harnais est un harnais de rendu ; hors de `gameIso`, `src/test-setup.ts` est le point d'entrée
 * légitime).
 * Les imports littéraux (faits 1, 2, 4) se lisent sur l'AST. Le scan est TEXTUEL sur la forme
 * de DÉCLARATION `class X implements StageRenderer` (fait 3) et sur l'occurrence textuelle de `brancherArdoise(`
 * (fait 4), sur l'élément `<GameStage3D` et sur la pose de son renderer (`setStageRendererFactory(`,
 * fait 5 — le seul signal d'un montage INDIRECT). Un `await import()` dynamique au chemin composé à l'exécution, une ré-exportation du
 * harnais depuis un troisième module, une classe de banc déclarée sans clause `implements` (ou via un
 * alias de type), un appel de `brancherArdoise` enveloppé dans une fonction d'un autre fichier :
 * aucun n'existe aujourd'hui, aucun n'est couvert. Fait 6 : le bloc d'un `beforeAll` est borné par
 * ÉQUILIBRAGE DES PARENTHÈSES depuis son ouverture — une parenthèse en chaîne ou en commentaire DANS ce
 * bloc fausserait la borne, aucune n'existe ; une horloge posée par une fonction d'un AUTRE fichier
 * appelée depuis un `beforeAll` lui échappe.
 */

const SRC = 'src';
const GAME_ISO = 'src/gameIso';
const HARNAIS = 'src/gameIso/stage/banc-volumique.ts';
/** Ce banc lui-même : il PLANTE les motifs qu'il cherche (chaînes, prose), il ne s'inclut pas. */
const SOI = 'src/gameIso/stage/banc-volumique.test.ts';

/** Les sources TypeScript d'une racine, tests COMPRIS, avec leur texte : la primitive de corpus les
 *  lit UNE fois par clé, et les faits scannent les deux mêmes racines (`src/`, `src/gameIso/`). */
const sources = (dir: string) => readCorpus([dir], { tests: true });

/** Le texte d'un fichier NOMMÉ de `src/`, pris au corpus. */
const texte = (rel: string): string => sources(SRC).find((f) => f.rel === rel)!.text;

/** Les fichiers de PRODUCTION d'une racine : aucun INSTRUMENT joué par Vitest — ni suite (`vitest
 *  run`) ni banc (`vitest bench`) —, et le harnais lui-même exclu. Un banc importe l'API `bench` de
 *  vitest par construction et aucun bundle de jeu ne l'embarque (`scripts/guards/lib/racinesDeLaSuite.mjs` ne le joue même
 *  pas en suite). La FORME du cliquet, jamais une liste de fichiers : le banc N+1 est couvert sans
 *  qu'on y revienne. Le prédicat vit en UN exemplaire, `scripts/guards/lib/fichierVitest.mjs`
 *  (#1788) : toute garde dont le périmètre est « la production » le consomme. */
const production = (dir: string) => sources(dir).filter(({ rel }) => !estFichierVitest(rel) && rel !== HARNAIS);

/** `fichier:ligne` de chaque import dont le spécifieur contient `motif`. */
export function importeurs(source: string, label: string, motif: RegExp, sourceFile?: SourceFile, diagnostics?: readonly Diagnostic[]): string[] {
  return specificateursDe(label, sourceFile ?? source, diagnostics)
    .filter(({ spec }) => motif.test(spec))
    .map(({ ligne, texte }) => `${label}:${ligne} → ${texte}`);
}

const SPEC_HARNAIS = /(?:^|\/)banc-volumique$/;
const SPEC_VITEST = /^vitest$/;

/** La forme d'une DÉCLARATION de classe portant la clause `implements StageRenderer` — ancrée en
 *  début de ligne : une mention en prose ou dans une chaîne (les cas plantés de ce fichier) n'en est
 *  pas une. */
const DECL_RENDERER = /^\s*(export\s+)?(default\s+)?(abstract\s+)?class\s+\w+\s+implements\s+StageRenderer\b/;

/** `fichier:ligne` de chaque déclaration de renderer de banc (clause `implements` littérale). */
export function renderersDeBanc(source: string, label: string): string[] {
  return source
    .split(/\r?\n/)
    .map((ligne, i) => ({ n: i + 1, ligne }))
    .filter(({ ligne }) => DECL_RENDERER.test(ligne))
    .map(({ n, ligne }) => `${label}:${n} → ${ligne.trim()}`);
}

/** Ce qu'un `beforeAll` n'a pas le droit de poser : les trois coutures d'HORLOGE D'IMAGES, en
 *  assignation (`x.requestAnimationFrame = …`, `performance.now = …`) comme en espion ou en stub
 *  (`vi.spyOn(performance, 'now')`, `vi.stubGlobal('requestAnimationFrame', …)`). */
const POSE_HORLOGE = [
  /\b(requestAnimationFrame|cancelAnimationFrame)\s*=[^=]/,
  /\bperformance\s*\.\s*now\s*=[^=]/,
  /\bvi\s*\.\s*(spyOn|stubGlobal)\s*\(\s*[^)]*?['"](requestAnimationFrame|cancelAnimationFrame|now)['"]/,
];

/**
 * Les `beforeAll` qui POSENT une horloge d'images, en `fichier:ligne → extrait`. Le bloc d'un
 * `beforeAll` va de son ouvrante à l'équilibrage de ses parenthèses.
 */
export function horlogesEnBeforeAll(source: string, label: string): string[] {
  const lignes = source.split(/\r?\n/);
  const out: string[] = [];
  for (let i = 0; i < lignes.length; i++) {
    if (!/\bbeforeAll\s*\(/.test(lignes[i])) continue;
    let profondeur = 0;
    let ouvert = false;
    for (let j = i; j < lignes.length; j++) {
      for (const c of lignes[j]) {
        if (c === '(') { profondeur++; ouvert = true; }
        else if (c === ')') profondeur--;
      }
      if (POSE_HORLOGE.some((r) => r.test(lignes[j]))) out.push(`${label}:${j + 1} → ${lignes[j].trim()}`);
      if (ouvert && profondeur <= 0) { i = j; break; }
    }
  }
  return out;
}

/** Un banc branche-t-il l'ardoise ? (occurrence textuelle de l'appel, pas de l'import seul). */
export const brancheLArdoise = (source: string): boolean => /\bbrancherArdoise\s*\(/.test(source);

/** Un `.test.` MONTE-t-il l'écran volumique ? Deux signaux, chacun suffisant : l'élément lui-même, et
 *  la POSE de son renderer de banc — un écran monté par un hôte (`EditorCanvas`) n'a que le second,
 *  et c'est pourtant le même écran, avec le même travail différé à hériter. */
export const monteLEcranVolumique = (source: string): boolean =>
  /<GameStage3D\b/.test(source) || /\bsetStageRendererFactory\s*\(/.test(source);

/** Les `.test.` de `src/**` qui importent le harnais, par chemin relatif à la racine. */
function bancs(): { chemin: string; source: string }[] {
  const liste: { chemin: string; source: string }[] = [];
  for (const { fichier: { rel, text }, sourceFile, diagnostics } of analyserCorpus(testsDuDepot().map(({ chemin, source }) => ({ rel: chemin, text: source })))) {
    if (importeurs(text, rel, SPEC_HARNAIS, sourceFile!, diagnostics).length > 0) liste.push({ chemin: rel, source: text });
  }
  return liste;
}

/** Les `.test.` de `src/**` (ce banc excepté), par chemin relatif à la racine. */
function testsDuDepot(): { chemin: string; source: string }[] {
  return sources(SRC)
    .filter(({ rel }) => estSuiteVitest(rel) && rel !== SOI)
    .map(({ rel, text }) => ({ chemin: rel, source: text }));
}

describe('le harnais de banc volumique reste dans les bancs (#1401)', () => {
  it('les diagnostics portent le site multiligne et le prédicat ne lit que le spécificateur', () => {
    const source = "// import 'vitest';\nimport {\n  it\n} from 'vitest';\nimport { vitest } from './sain';"
    expect(importeurs(source, 'fixture.ts', SPEC_VITEST)).toEqual([
      "fixture.ts:2 → import {\n  it\n} from 'vitest';",
    ]);
  });
  it('cas planté : un import du harnais depuis un fichier de production est détecté (preuve TDD)', () => {
    const planté = ['const x = 1;', "import { BancRenderer } from './banc-volumique';"].join('\n');
    expect(importeurs(planté, 'planté.ts', SPEC_HARNAIS)).toEqual([
      "planté.ts:2 → import { BancRenderer } from './banc-volumique';",
    ]);
    // …et un fichier qui ne l'importe pas ne déclenche RIEN : le détecteur ne mord pas dans le vide.
    expect(importeurs("import * as THREE from 'three';", 'sain.ts', SPEC_HARNAIS)).toEqual([]);
  });

  it('cas planté : un import de `vitest` est détecté avec son `fichier:ligne` (preuve TDD)', () => {
    const planté = "import { describe, it } from 'vitest';";
    expect(importeurs(planté, 'planté.ts', SPEC_VITEST)).toEqual([
      "planté.ts:1 → import { describe, it } from 'vitest';",
    ]);
  });

  it('le harnais existe bien, et il importe `vitest` — sans quoi les deux faits seraient vrais du vide', () => {
    const source = texte(HARNAIS);
    expect(importeurs(source, 'banc-volumique.ts', SPEC_VITEST).length,
      'le harnais n’importe plus `vitest` : cette garde ne garde plus rien').toBeGreaterThan(0);
  });

  it('AUCUN fichier de production de `src/` n’importe le harnais', () => {
    const fautifs: string[] = [];
    for (const { fichier: { rel, text }, sourceFile, diagnostics } of analyserCorpus(production(SRC))) {
      fautifs.push(...importeurs(text, rel, SPEC_HARNAIS, sourceFile!, diagnostics));
    }
    expect(fautifs, 'un harnais de banc embarqué dans le bundle de jeu').toEqual([]);
  });

  it('aucun non-`.test.` de `src/gameIso/**` hors le harnais n’importe `vitest`', () => {
    const fautifs: string[] = [];
    for (const { fichier: { rel, text }, sourceFile, diagnostics } of analyserCorpus(production(GAME_ISO))) {
      fautifs.push(...importeurs(text, rel, SPEC_VITEST, sourceFile!, diagnostics));
    }
    expect(fautifs, 'du code de test dans un fichier de production de `gameIso`').toEqual([]);
  });

  it('cas planté : une classe de banc déclarée ailleurs est détectée avec son `fichier:ligne` (preuve TDD)', () => {
    const planté = ['// entête', 'class MonRenderer implements StageRenderer {'].join('\n');
    expect(renderersDeBanc(planté, 'planté.ts')).toEqual([
      'planté.ts:2 → class MonRenderer implements StageRenderer {',
    ]);
    // …ni une classe d'un AUTRE contrat, ni une mention en prose ou en chaîne, ne déclenchent RIEN.
    expect(renderersDeBanc('class X implements StageRendererFactory {}', 'sain.ts')).toEqual([]);
    expect(renderersDeBanc('// class X implements StageRenderer — en prose', 'sain.ts')).toEqual([]);
  });

  it('`implements StageRenderer` n’apparaît qu’UNE fois dans tout `src/`, `.test.` compris', () => {
    const trouvés: string[] = [];
    for (const { rel, text } of sources(SRC)) {
      trouvés.push(...renderersDeBanc(text, rel));
    }
    expect(trouvés.length, `un renderer de banc a essaimé :\n${trouvés.join('\n')}`).toBe(1);
    expect(trouvés[0]).toContain('src/gameIso/stage/banc-volumique.ts:');
  });

  it('cas planté : un banc qui importe le harnais sans brancher l’ardoise est détecté (preuve TDD)', () => {
    expect(brancheLArdoise("import { quads } from './banc-volumique';\nquads();")).toBe(false);
    expect(brancheLArdoise("import { brancherArdoise } from './banc-volumique';\nbrancherArdoise();")).toBe(true);
    // L'import du symbole SEUL ne suffit pas : c'est l'APPEL qui pose l'afterEach.
    expect(brancheLArdoise("import { brancherArdoise } from './banc-volumique';")).toBe(false);
  });

  it('tout `.test.` qui importe le harnais APPELLE `brancherArdoise`', () => {
    const liste = bancs();
    expect(liste.length, 'plus aucun banc n’importe le harnais : ce fait serait vrai du vide').toBeGreaterThan(30);
    const sansArdoise = liste.filter(({ source }) => !brancheLArdoise(source)).map(({ chemin }) => chemin);
    expect(sansArdoise, 'un banc démarre sur les caches de MODULE du fichier précédent').toEqual([]);
  });

  it('cas planté : un banc qui MONTE l’écran volumique sans brancher l’ardoise est détecté (preuve TDD)', () => {
    expect(monteLEcranVolumique('act(() => root.render(<GameStage3D scene={s} />));')).toBe(true);
    // Le montage INDIRECT : aucun `<GameStage3D` dans la source, mais le renderer de banc y est posé.
    expect(monteLEcranVolumique('beforeAll(() => setStageRendererFactory(rendererDeBanc));')).toBe(true);
    // …et rien de tout cela ne se déclenche sur un banc qui ne monte pas cet écran.
    expect(monteLEcranVolumique("import { GameStage3D } from './GameStage3D';")).toBe(false);
    expect(monteLEcranVolumique('const x = 1;')).toBe(false);
  });

  it('tout `.test.` qui MONTE l’écran volumique APPELLE `brancherArdoise`', () => {
    const monteurs = testsDuDepot().filter(({ source }) => monteLEcranVolumique(source));
    expect(monteurs.length, 'plus aucun banc ne monte l’écran volumique : ce fait serait vrai du vide').toBeGreaterThan(30);
    const sansArdoise = monteurs.filter(({ source }) => !brancheLArdoise(source)).map(({ chemin }) => chemin);
    expect(sansArdoise, 'un banc monte l’écran volumique sur les drapeaux de module ARMÉS du fichier précédent : sa file de cuisson et sa boucle d’images peuvent n’être jamais servies').toEqual([]);
  });

  it('cas planté : une horloge d’images posée en `beforeAll` est détectée avec son `fichier:ligne` (preuve TDD)', () => {
    const planté = [
      'beforeAll(() => {',
      '  globalThis.requestAnimationFrame = ((cb) => rafs.push(cb));',
      '});',
    ].join('\n');
    expect(horlogesEnBeforeAll(planté, 'planté.ts')).toEqual([
      'planté.ts:2 → globalThis.requestAnimationFrame = ((cb) => rafs.push(cb));',
    ]);
    expect(horlogesEnBeforeAll("beforeAll(() => { vi.spyOn(performance, 'now').mockImplementation(() => h); });", 'p.ts'))
      .toEqual(["p.ts:1 → beforeAll(() => { vi.spyOn(performance, 'now').mockImplementation(() => h); });"]);
    expect(horlogesEnBeforeAll("beforeAll(() => { vi.stubGlobal('requestAnimationFrame', (cb) => f.push(cb)); });", 'p.ts')).toHaveLength(1);
    // …et la MÊME pose en `beforeEach` — la forme canonique — ne déclenche RIEN.
    expect(horlogesEnBeforeAll('beforeEach(() => { globalThis.requestAnimationFrame = collecteur; });', 'sain.ts')).toEqual([]);
    // …ni une LECTURE de l’horloge, ni une pose hors du bloc d’un `beforeAll`.
    expect(horlogesEnBeforeAll('beforeAll(() => { const t0 = performance.now(); });', 'sain.ts')).toEqual([]);
    expect(horlogesEnBeforeAll('beforeAll(() => setStageRendererFactory(f));\nglobalThis.requestAnimationFrame = x;', 'sain.ts')).toEqual([]);
  });

  it('AUCUN `.test.` de `src/**` ne pose une horloge d’images en `beforeAll`', () => {
    const tests = testsDuDepot();
    expect(tests.length, 'plus aucun test à scanner : ce fait serait vrai du vide').toBeGreaterThan(500);
    const fautifs: string[] = [];
    for (const { chemin, source } of tests) fautifs.push(...horlogesEnBeforeAll(source, chemin));
    expect(
      fautifs,
      'une horloge d’images posée en `beforeAll` ne survit pas à `restoreMocks` : la poser PAR TEST (`brancherImagesPilotees`)',
    ).toEqual([]);
  });

  it('la forme canonique EXISTE et SERT — sans quoi le fait 6 n’offrirait aucune issue', () => {
    expect(/export function brancherImagesPilotees\b/.test(texte(HARNAIS)),
      'la primitive d’images pilotées a disparu du harnais').toBe(true);
    const clients = bancs().filter(({ source }) => /\bbrancherImagesPilotees\s*\(/.test(source)).map(({ chemin }) => chemin);
    expect(clients.sort()).toEqual([
      'src/gameIso/stage/battement-unique.test.tsx',
      'src/gameIso/stage/chrome-jeton.test.tsx',
      'src/gameIso/stage/percage-hote.test.tsx',
      'src/gameIso/stage/walk-frame-loop.test.tsx',
      'src/gameIso/stage/weather-boucle.test.tsx',
    ]);
  });

  it('PRÉMISSE — le scan voit bien des fichiers : un périmètre vide rendrait les faits gratuits', () => {
    expect(production(SRC).length).toBeGreaterThan(500);
    expect(production(GAME_ISO).length).toBeGreaterThan(50);
  });
});
