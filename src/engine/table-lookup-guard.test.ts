import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readCorpus } from '../../scripts/guards/lib/sourceCorpus.mjs';
import { scanTableLookup } from '../../scripts/guards/lib/tableLookup.mjs';
import { estFichierVitest, estKitDeTest } from '../../scripts/guards/lib/fichierVitest.mjs';

/**
 * Garde-fou « lookup [min,max] hors engine/tables.ts » (#302). `findTableEntry`/`findTableEntryIndex`
 * sont la SOURCE UNIQUE du motif `table.find((e) => roll >= e.min && roll <= e.max)` — toute
 * réinvention du motif (recherche d'une entrée de table par fourchette via `.find`/`.findIndex`)
 * ailleurs réinvente le foyer. BASELINE ZÉRO partout hors `engine/tables.ts` (son foyer).
 *
 * `engine/tables.ts` HORS SCAN : c'est le foyer de la primitive, son implémentation EST le motif.
 */

const ROOT = fileURLToPath(new URL('../..', import.meta.url)); // src/engine/ → ../../ = racine du projet
const SCAN_DIRS = ['src'];
const EXCLUDED = (rel: string) => estFichierVitest(rel) || estKitDeTest(rel) || rel === 'src/engine/tables.ts';

function countsByFile(): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const { rel, text } of readCorpus(SCAN_DIRS, { tests: true })) {
    if (EXCLUDED(rel)) continue;
    const n = scanTableLookup(rel, text).length;
    if (n > 0) counts[rel] = n;
  }
  return counts;
}

describe('garde-fou « table.ts » — lookup [min,max] par fourchette (cliquet, #302)', () => {
  it('aucun fichier hors engine/tables.ts ne réinvente `.find((e) => roll >= e.min && roll <= e.max)`', () => {
    const counts = countsByFile();
    const offenders = Object.entries(counts).map(([rel, n]) => `${rel} : ${n} site(s)`);
    expect(
      offenders,
      `Nouvelle réinvention du lookup de table — router par findTableEntry/findTableEntryIndex (src/engine/tables.ts) :\n${offenders.join('\n')}`,
    ).toEqual([]);
  });

  it('fail-closed : le scanner détecte une écriture SYNTHÉTIQUE du motif', () => {
    const regressed = "const band = TABLE.find((e) => roll >= e.min && roll <= e.max)!;";
    expect(scanTableLookup('src/engine/x.ts', regressed).length).toBe(1);
  });

  it('la primitive canonique elle-même (tables.ts, hors scan) porte bien le motif — sinon le foyer a bougé', () => {
    const src = readFileSync(join(ROOT, 'src/engine/tables.ts'), 'utf8');
    expect(scanTableLookup('src/engine/tables.ts', src).length).toBeGreaterThan(0);
  });
});
