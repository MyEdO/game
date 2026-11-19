import base from '../../../vite.config';
import { fileURLToPath } from 'node:url';

const reporters = base.test?.reporters ?? ['default'];

/* Le régime de test de la base (pool, isolation, séquenceur), sans ses plugins ni ses `setupFiles` :
 * la fixture n'importe que `src/lib/detenteur.testkit.ts`. #4314 */
export default {
  test: {
    ...base.test,
    include: ['scripts/test/fixtures/detenteur-afterall.fixture.ts'],
    setupFiles: [],
    reporters: [...(Array.isArray(reporters) ? reporters : [reporters]), fileURLToPath(new URL('./detenteur-afterall.reporter.mjs', import.meta.url))],
  },
};
