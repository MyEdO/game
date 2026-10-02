import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { scanBatchNavalQuarantine } from '../../scripts/guards/lib/batchNavalQuarantine.mjs';

/**
 * QUARANTAINE D'IMPORT du BATCH GÉNÉRIQUE de cascade (#328 — dé-navalisation). Le séquenceur générique
 * (`cascade.ts`), la modale générique (`CascadeModal.tsx`) et le module de types côté cascade
 * (`pendings.ts`) ne doivent IMPORTER RIEN du domaine naval (`shipCrew`/`shipManeuver`/`crewMorale`/
 * `crew-roles`). Le participant batch est GÉNÉRIQUE : sa présentation est résolue À LA CONSTRUCTION par
 * le flux propriétaire (naval), jamais dérivée dans la machinerie. Garde STRUCTURELLE (le couplage
 * machinerie→domaine devient INEXPRIMABLE), patron `combat-event-port-guard` : whitelist FIXE, zéro
 * violation tolérée (pas de baseline à faire décroître).
 */

const ROOT = fileURLToPath(new URL('../..', import.meta.url));

/** Modules GÉNÉRIQUES sous quarantaine (POSIX relatifs à la racine). */
const QUARANTINED_FILES = [
  'src/state/cascade.ts',
  'src/ui/CascadeModal.tsx',
  'src/state/pendings.ts',
];

describe('quarantaine d’import — batch générique de cascade dé-navalisé (#328)', () => {
  it('les acquisitions navales littérales sont vues, les commentaires et chaînes restent inertes', () => {
    const source = "/* import './shipCrew'; */\nconst texte = \"import './shipCrew'\";\nimport './shipCrew';\nconst p = import('./shipManeuver');";
    expect(scanBatchNavalQuarantine('fixture.ts', source)).toEqual([
      { line: 3, source: './shipCrew' },
      { line: 4, source: './shipManeuver' },
    ]);
  });
  for (const rel of QUARANTINED_FILES) {
    it(`${rel} n’importe RIEN de shipCrew/shipManeuver/crewMorale/crew-roles`, () => {
      const contenu = readFileSync(`${ROOT}/${rel}`, 'utf8');
      const offenders = scanBatchNavalQuarantine(rel, contenu).map((f) => `${rel}:${f.line} importe de '${f.source}'`);
      expect(
        offenders,
        'Couplage naval ré-introduit dans la machinerie de batch générique — le flux propriétaire doit ' +
          `RÉSOUDRE la présentation à la construction (BatchParticipant) :\n${offenders.join('\n')}`,
      ).toEqual([]);
    });
  }

  it('FAIL-CLOSED : un import naval fictif est DÉTECTÉ (valeur ET type)', () => {
    const fake =
      "import { crewRoleValue } from '../engine/crewMorale';\n" +
      "import type { CrewRoleRoll } from './shipManeuver';\n" +
      "import { findCrewRoleById } from '../data/crew-roles.json';\n";
    const found = scanBatchNavalQuarantine('fixture.ts', fake).map((f) => f.source);
    expect(found).toEqual(['../engine/crewMorale', './shipManeuver', '../data/crew-roles.json']);
  });

  it('FAIL-CLOSED : un import NEUTRE (pendings, tests) n’est PAS matché', () => {
    expect(scanBatchNavalQuarantine('fixture.ts', "import type { CascadeStep } from './pendings';")).toEqual([]);
    expect(scanBatchNavalQuarantine('fixture.ts', "import { rollTest } from '../engine/tests';")).toEqual([]);
  });
});
