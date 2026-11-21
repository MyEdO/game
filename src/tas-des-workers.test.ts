import { getHeapStatistics } from 'node:v8';
import { describe, expect, it } from 'vitest';
import { TAS_WORKER_MO } from '../scripts/test/partition.mjs';

describe('tas des workers de Vitest (#1801)', () => {
  it('ce worker tourne sous la borne de TAS_WORKER_MO', () => {
    expect(process.execArgv).toContain(`--max-old-space-size=${TAS_WORKER_MO}`);
    // V8 ajoute le jeune espace à la taille maximale de l’ancienne génération.
    expect(getHeapStatistics().heap_size_limit / 2 ** 20).toBeLessThan(TAS_WORKER_MO * 1.1);
  });
});
