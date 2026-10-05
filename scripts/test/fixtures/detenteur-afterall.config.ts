import base from '../../../vite.config';
import { fileURLToPath } from 'node:url';

const reporters = base.test?.reporters ?? ['default'];

export default {
  ...base,
  test: {
    ...base.test,
    include: ['scripts/test/fixtures/detenteur-afterall.fixture.ts'],
    reporters: [...(Array.isArray(reporters) ? reporters : [reporters]), fileURLToPath(new URL('./detenteur-afterall.reporter.mjs', import.meta.url))],
  },
};
