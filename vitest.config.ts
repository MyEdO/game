import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
// @ts-expect-error - plugin ESM JS (pas de types)
import { proseSource } from './scripts/source/prose-source-plugin.mjs';
import { EXCLUSIONS_DE_LA_SUITE, RACINES_DE_LA_SUITE } from './scripts/guards/lib/racinesDeLaSuite.mjs';
import { argumentsDeGenerationCode, verdictDeGenerationCode } from './scripts/gates/generationCode.mjs';
import { DELAI_DE_TEST_MS, TAS_WORKER_MO } from './scripts/test/partition.mjs';

const racine = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  plugins: [
    {
      name: 'registry-gen',
      buildStart() {
        const generation = spawnSync(process.execPath, ['scripts/docs/build-all.mjs', ...argumentsDeGenerationCode(true)], {
          cwd: racine,
          stdio: 'inherit',
        });
        const verdict = verdictDeGenerationCode(generation.status);
        if (verdict === 'differe') console.warn('registry-gen : vérification différée, l’écrivain des dérivés est tenu');
        if (verdict === 'echec') throw new Error(`registry-gen : cibles de code en échec (exit ${generation.status ?? generation.signal}) — npm run gen`);
      },
    },
    proseSource(),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'node',
    include: RACINES_DE_LA_SUITE.map(({ motif }) => motif),
    exclude: [...EXCLUSIONS_DE_LA_SUITE],
    isolate: false,
    restoreMocks: true,
    pool: 'forks',
    execArgv: [`--max-old-space-size=${TAS_WORKER_MO}`],
    logHeapUsage: true,
    testTimeout: DELAI_DE_TEST_MS,
    setupFiles: [
      fileURLToPath(new URL('./scripts/gates/vitestSansEcriture.mjs', import.meta.url)),
      resolve(racine, 'src/test-setup-noyau.ts'),
    ],
  },
});
