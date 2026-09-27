/**
 * Tas d'un worker du côté node de la suite (#1801) : garde de `src/tasDesWorkers.testkit.ts`.
 */
import { describe, it } from 'vitest';
import { verifierTasDuWorker } from './tasDesWorkers.testkit';

describe('tas des workers de la suite, côté node (#1801)', () => {
  it('ce worker tourne sous la borne de TAS_WORKER_MO', () => {
    verifierTasDuWorker();
  });
});
