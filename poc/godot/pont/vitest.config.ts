import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: fileURLToPath(new URL('../../..', import.meta.url)),
  test: {
    environment: 'node',
    include: ['poc/godot/pont/*.test.ts'],
    testTimeout: 60_000,
  },
});
