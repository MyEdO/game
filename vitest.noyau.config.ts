/**
 * La suite du NOYAU (#2817, `SUITES_VITEST_DE_CI['test:noyau']`) : les tests hors store (`MOTIF_HORS_STORE`, que la suite principale exclut),
 * chacun dans son propre graphe de modules (`isolate: true`), sans le store ni le socle de test de
 * `vite.config.ts`. Les données se chargent par la même porte que la suite : le gel du catalogue
 * (`src/data/overrides.ts`, #2097) et le greffon `proseSource()`.
 */
import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';
// @ts-expect-error - plugin ESM JS (pas de types)
import { proseSource } from './scripts/source/prose-source-plugin.mjs';
import { SUITES_VITEST_DE_CI } from './scripts/guards/lib/racinesDeLaSuite.mjs';

export default defineConfig({
  plugins: [proseSource()],
  test: {
    environment: 'node',
    include: [SUITES_VITEST_DE_CI['test:noyau'].motif],
    isolate: true,
    setupFiles: [fileURLToPath(new URL('./src/data/overrides.ts', import.meta.url))],
  },
});
