/**
 * La suite du NOYAU (#2817, `SUITES_VITEST_DE_CI['test:noyau']`) : les tests hors store (`MOTIF_HORS_STORE`, que la suite principale exclut),
 * dans un graphe de modules PARTAGÉ par worker (`isolate: false`, #3412 : 191 s contre 729 s isolé), sans le store ni
 * le socle de test de `vite.config.ts`. Les données se chargent par la même porte que la suite : le gel du catalogue
 * (`src/data/overrides.ts`, #2097) et le greffon `proseSource()` ; son setup est `src/test-setup-noyau.ts` (#3058).
 */
import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';
// @ts-expect-error - plugin ESM JS (pas de types)
import { proseSource } from './scripts/source/prose-source-plugin.mjs';
import { SUITES_VITEST_DE_CI } from './scripts/guards/lib/racinesDeLaSuite.mjs';
import { DELAI_DE_TEST_MS } from './scripts/test/partition.mjs';

export default defineConfig({
  plugins: [proseSource()],
  test: {
    environment: 'node',
    include: [SUITES_VITEST_DE_CI['test:noyau'].motif],
    // Les effets du graphe partagé, fermés comme dans `vite.config.ts` : le mock de MODULE interdit
    // (`src/vi-mock-isolate-guard.test.ts`) ; un espion rendu avant le test SUIVANT de son fichier (`restoreMocks`
    // joue avant chaque test ; entre deux fichiers, Vitest les rend de lui-même) ; le propriétaire du jeu débranché à
    // la fin de chaque fichier (`src/test-setup-noyau.ts`).
    isolate: false,
    restoreMocks: true,
    pool: 'forks',
    testTimeout: DELAI_DE_TEST_MS,
    setupFiles: [fileURLToPath(new URL('./src/test-setup-noyau.ts', import.meta.url))],
  },
});
