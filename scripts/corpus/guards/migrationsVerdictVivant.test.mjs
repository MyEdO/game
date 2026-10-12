import { test } from 'node:test'

import assert from 'node:assert/strict'

import { fileURLToPath } from 'node:url'

import { migrationsAuVerdictVivant } from '../../guards/lib/migrationsVerdictVivant.mjs'

const RACINE = fileURLToPath(new URL('../../../', import.meta.url));

test('#1887 : aucune migration datée du dépôt n’atteint le verdict vivant (`derive-decoupes.mjs`)', () => {
  assert.deepEqual(migrationsAuVerdictVivant({ racine: RACINE }), []);
});
