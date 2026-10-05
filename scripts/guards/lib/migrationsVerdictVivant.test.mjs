// Banc de la garde `migrationsVerdictVivant.mjs` : le dépôt réel n'a AUCUNE migration datée qui atteint
// le verdict vivant ; sur une fixture, l'import direct et le ré-export transitif sont vus, `lib/` et les
// portes `replay*.mjs` ne sont pas des migrations.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { migrationsAuVerdictVivant } from './migrationsVerdictVivant.mjs';

const RACINE = fileURLToPath(new URL('../../../', import.meta.url));

test('#1887 : aucune migration datée du dépôt n’atteint le verdict vivant (`derive-decoupes.mjs`)', () => {
  assert.deepEqual(migrationsAuVerdictVivant({ racine: RACINE }), []);
});

test('#1887 : fixture — import direct et ré-export transitif vus ; `lib/` et `replay*.mjs` hors garde', () => {
  const racine = mkdtempSync(join(tmpdir(), 'verdict-vivant-'));
  try {
    const poser = (rel, texte) => {
      mkdirSync(dirname(join(racine, rel)), { recursive: true });
      writeFileSync(join(racine, rel), texte);
    };
    poser('scripts/source/derive-decoupes.mjs', 'export const judge = () => ({ verdict: "EXACT" });\n');
    poser('scripts/source/relais.mjs', "export { judge } from './derive-decoupes.mjs';\n");
    poser('scripts/source/neutre.mjs', 'export const rien = 0;\n');
    poser('scripts/migrations/2026-01-01-directe.mjs', "import { judge } from '../source/derive-decoupes.mjs';\njudge();\n");
    poser('scripts/migrations/2026-01-02-relais.mjs', "import { judge } from '../source/relais.mjs';\njudge();\n");
    poser('scripts/migrations/2026-01-03-propre.mjs', "import { rien } from '../source/neutre.mjs';\nconsole.log(rien);\n");
    poser('scripts/migrations/replay.mjs', "import '../source/derive-decoupes.mjs';\n");
    poser('scripts/migrations/lib/outil.mjs', "import '../../source/derive-decoupes.mjs';\n");
    assert.deepEqual(migrationsAuVerdictVivant({ racine }), [
      'scripts/migrations/2026-01-01-directe.mjs',
      'scripts/migrations/2026-01-02-relais.mjs',
    ]);
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
});
