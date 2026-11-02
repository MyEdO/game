/**
 * LES MODULES `index` DE `src/` MESURÉS PAR KNIP (épique #2882, M-h) : un export sans lecteur d'un `index` (la
 * surface du noyau `src/noyau/index.ts`, la base `src/data/index.ts`…) est un export mort que `npm run deps:exports`
 * refuse. Knip ne le voit que si l'`index` n'est pas une ENTRÉE : ni nommé dans `knip.json`, ni désigné par un
 * littéral que knip prend pour entrée, exports tus (`new URL('…', import.meta.url)`, `import.meta.resolve('…')`,
 * `require.resolve('…')` : le fichier, ou l'`index` du dossier, que le littéral désigne). Un dossier se désigne par
 * `resolve(__dirname, …)` ou `join(dirname(fileURLToPath(import.meta.url)), …)`.
 */
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, posix, resolve } from 'node:path';
import { readCorpus } from '../scripts/guards/lib/sourceCorpus.mjs';
import { listerDossier } from '../scripts/guards/lib/lister.mjs';
import { SURFACE_DU_NOYAU } from '../scripts/guards/lib/couches.mjs';

const RACINE = resolve(__dirname, '..');
const LITTERAL = String.raw`(['"\x60])([^'"\x60$]+)\1`;
const ENTREES_DE_KNIP = [
  new RegExp(String.raw`new URL\(\s*${LITTERAL}\s*,\s*import\.meta\.url\s*,?\s*\)`, 'g'),
  new RegExp(String.raw`import\.meta\.resolve\(\s*${LITTERAL}\s*,?\s*\)`, 'g'),
  new RegExp(String.raw`require\.resolve\(\s*${LITTERAL}\s*,?\s*\)`, 'g'),
];
const INDEX = /^src\/(.+\/)?index(\.(ts|tsx|mts|js|mjs))?$/;

/** Les chemins (depuis la racine) que désignent les littéraux d'entrée de knip d'un fichier. */
function designesPar(rel: string, text: string): string[] {
  return ENTREES_DE_KNIP.flatMap((re) => [...text.matchAll(re)])
    .filter((m) => m[2]!.startsWith('.'))
    .map((m) => posix.normalize(join(dirname(rel), m[2]!).replace(/\\/g, '/')).replace(/\/$/, ''));
}

/** Le chemin désigne-t-il un module `index` de `src/` (le fichier, ou le dossier qui en porte un) ? */
function designeUnIndex(cible: string, racine = RACINE): boolean {
  if (INDEX.test(cible)) return true;
  if (!cible.startsWith('src')) return false;
  const abs = join(racine, cible);
  return existsSync(abs) && statSync(abs).isDirectory() && listerDossier(abs).some((n) => INDEX.test(`${cible}/${n}`));
}

describe('aucun `index` de `src/` n’est une entrée de knip', () => {
  it('`knip.json` n’en nomme aucun en entrée', () => {
    const knip = JSON.parse(readFileSync(join(RACINE, 'knip.json'), 'utf8')) as { entry: string[] };
    expect(knip.entry.length, 'knip.json sans entrées lues').toBeGreaterThan(3);
    expect(knip.entry.filter((e) => INDEX.test(e))).toEqual([]);
  });

  it('aucun littéral d’entrée de knip ne désigne un `index` de `src/` ni son dossier', () => {
    const configs = listerDossier(RACINE).filter((n) => /\.(ts|mts|mjs|js|cjs)$/.test(n))
      .map((rel) => ({ rel, text: readFileSync(join(RACINE, rel), 'utf8') }));
    const fichiers = [...readCorpus(['src', 'scripts'], { exts: ['.ts', '.tsx', '.mjs', '.mts'], tests: true }), ...configs];
    const designes = fichiers.flatMap((f) => designesPar(f.rel, f.text).map((cible) => ({ f: f.rel, cible })));
    expect(designes.length, 'le scan doit VOIR des littéraux d’entrée').toBeGreaterThan(50);
    expect(designes.filter(({ cible }) => designeUnIndex(cible)).map(({ f, cible }) => `${f} → ${cible}`)).toEqual([]);
  });

  it('le détecteur MORD sur chaque forme qui taisait un `index`', () => {
    // Les littéraux s'assemblent ici, sinon le scan de ce fichier les trouverait.
    const url = (chemin: string) => `new ${'URL'}('${chemin}', import.meta.url)`;
    expect(designesPar('src/state/x.test.ts', `fileURLToPath(${url('../noyau/')})`)).toEqual(['src/noyau']);
    expect(designesPar('src/state/x.test.ts', `new ${'URL'}('../noyau/', import.meta.url,)`), 'virgule finale').toEqual(['src/noyau']);
    expect(designesPar('src/data/x.test.ts', url('.'))).toEqual(['src/data']);
    expect(designesPar('src/noyau/x.test.ts', `import.meta.${'resolve'}('./index.ts')`)).toEqual([SURFACE_DU_NOYAU]);
    expect(designesPar('scripts/a/b.mjs', `require.${'resolve'}('../../src/data')`)).toEqual(['src/data']);
    expect(['src/noyau', 'src/data', SURFACE_DU_NOYAU, 'src/data/index'].every((c) => designeUnIndex(c))).toBe(true);
    expect(designeUnIndex('src/scenes'), 'un dossier sans `index` n’est pas une surface').toBe(false);
    expect(designeUnIndex('src/noyau/rollFlowSpecs.ts')).toBe(false);
  });
});
