import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readCorpus } from '../../scripts/guards/lib/sourceCorpus.mjs';
import { scanJournalWrite } from '../../scripts/guards/lib/journalWrite.mjs';
import { estFichierVitest } from '../../scripts/guards/lib/fichierVitest.mjs';

/**
 * Garde-fou « composeur du journal » (#319). `….journal.slice(-40)` réinvente l'action canonique
 * `log` (`src/noyau/journal.ts`, action `log: (msg: string | string[]) => void`, source UNIQUE qui
 * pousse et plafonne à 40 lignes). Migration soldée (#319) : 18 sites → `get().log(...)`, BASELINE
 * ZÉRO partout — toute réapparition du motif hors `journal.ts` (son foyer) est une régression.
 *
 * `journal.ts` HORS SCAN : c'est le foyer de la primitive, son implémentation EST le motif.
 */

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const SCAN_DIRS = ['src/state', 'src/noyau'];
const FOYER = 'src/noyau/journal.ts';
const EXCLUDED = (rel: string) => estFichierVitest(rel) || rel === FOYER;

function countsByFile(): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const { rel, text } of readCorpus(SCAN_DIRS, { tests: true })) {
    if (EXCLUDED(rel)) continue;
    const n = scanJournalWrite(rel, text).length;
    if (n > 0) counts[rel] = n;
  }
  return counts;
}

describe('garde-fou « log » — composition du journal (cliquet, #319)', () => {
  it('aucun fichier de src/state ni de src/noyau (hors journal.ts) ne réinvente `.journal.slice(-40)`', () => {
    const counts = countsByFile();
    const offenders = Object.entries(counts).map(([rel, n]) => `${rel} : ${n} site(s)`);
    expect(
      offenders,
      `Nouvelle réinvention du composeur de journal — router par get().log(...) (${FOYER}) :\n${offenders.join('\n')}`,
    ).toEqual([]);
  });

  it('fail-closed : le scanner détecte une écriture SYNTHÉTIQUE du motif', () => {
    const regressed = "set({ journal: [...get().journal.slice(-40), 'ligne'] });";
    expect(scanJournalWrite('src/state/x.ts', regressed).length).toBe(1);
  });

  it('la primitive canonique elle-même (journal.ts, hors scan) porte bien le motif — sinon le foyer a bougé', () => {
    const src = readFileSync(join(ROOT, FOYER), 'utf8');
    expect(scanJournalWrite(FOYER, src).length).toBeGreaterThan(0);
  });
});
