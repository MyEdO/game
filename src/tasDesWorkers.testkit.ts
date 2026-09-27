/**
 * Garde du tas d'un worker de la suite, partagée par le côté node (`tas-des-workers.test.ts`) et le
 * côté jsdom (`tas-des-workers-jsdom.test.ts`) du lanceur : la borne `TAS_WORKER_MO` de
 * scripts/test/partition.mjs, posée par `vite.config.ts` (`poolOptions.forks.execArgv`, #1801). Un
 * pool changé, ou un argv qui ne parvient plus au worker, rendrait en silence au worker un tas taillé
 * sur la machine entière.
 */
import { getHeapStatistics } from 'node:v8';
import { expect } from 'vitest';
import { TAS_WORKER_MO } from '../scripts/test/partition.mjs';

/** Ce worker tourne sous la borne de `TAS_WORKER_MO`, argv ET tas effectivement rendu par V8. */
export function verifierTasDuWorker(): void {
  expect(process.execArgv).toContain(`--max-old-space-size=${TAS_WORKER_MO}`);
  // V8 ajoute le jeune espace au vieil espace borné : 3 120 Mo rendus pour 3 072 (mesuré le 2026-09-26).
  expect(getHeapStatistics().heap_size_limit / 2 ** 20).toBeLessThan(TAS_WORKER_MO * 1.1);
}
