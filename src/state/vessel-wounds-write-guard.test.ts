import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readCorpus } from '../../scripts/guards/lib/sourceCorpus.mjs';
import { scanVesselWoundsWrite } from '../../scripts/guards/lib/vesselWoundsWrite.mjs';
import { estFichierVitest } from '../../scripts/guards/lib/fichierVitest.mjs';

/**
 * Garde-fou « écriture de la coque hors seam » (#302, #296). SOURCE UNIQUE de `state.vessel.wounds` :
 * `shipDamage.ts` (mutation du Combattant-coque) + `seaVoyageFlow.ts` (persistance
 * `set({ vessel: { ...vessel, wounds } })`, via `setVesselHull`/`persistHullWounds`/
 * `damageVesselHull`/`healVesselHull`). BASELINE ZÉRO ailleurs dans `src/state`.
 *
 * `shipDamage.ts`/`seaVoyageFlow.ts` HORS SCAN : ce sont les 2 foyers, leur implémentation EST le motif.
 */

const ROOT = fileURLToPath(new URL('../..', import.meta.url)); // src/state/ → ../../ = racine du projet
const SCAN_DIRS = ['src/state', 'src/noyau'];
const FOYERS = new Set(['src/state/shipDamage.ts', 'src/state/seaVoyageFlow.ts']);
const EXCLUDED = (rel: string) => estFichierVitest(rel) || FOYERS.has(rel);

function countsByFile(): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const { rel, text } of readCorpus(SCAN_DIRS, { tests: true })) {
    if (EXCLUDED(rel)) continue;
    const n = scanVesselWoundsWrite(rel, text).length;
    if (n > 0) counts[rel] = n;
  }
  return counts;
}

describe('garde-fou « coque » — écriture de state.vessel.wounds hors seam (cliquet, #302/#296)', () => {
  it('aucun fichier de src/state (hors shipDamage.ts/seaVoyageFlow.ts) ne réécrit `vessel.wounds` en direct', () => {
    const counts = countsByFile();
    const offenders = Object.entries(counts).map(([rel, n]) => `${rel} : ${n} site(s)`);
    expect(
      offenders,
      `Nouvelle écriture de coque hors seam — router par setVesselHull/damageVesselHull/healVesselHull/persistHullWounds (src/state/seaVoyageFlow.ts) :\n${offenders.join('\n')}`,
    ).toEqual([]);
  });

  it('fail-closed : le scanner détecte une écriture SYNTHÉTIQUE du motif', () => {
    const regressed = "set({ vessel: { ...vessel, wounds: { current: 3, max: 10 } } });";
    expect(scanVesselWoundsWrite('src/state/x.ts', regressed).length).toBe(1);
  });

  it('le foyer de persistance (seaVoyageFlow.ts, hors scan) porte bien le motif — sinon le foyer a bougé', () => {
    // shipDamage.ts est l'AUTRE foyer (mutation du Combattant-coque via applyOps, jamais un
    // spread `vessel:` — motif structurellement différent, cf. sa docstring) : rien à vérifier ici.
    const src = readFileSync(join(ROOT, 'src/state/seaVoyageFlow.ts'), 'utf8');
    expect(scanVesselWoundsWrite('src/state/seaVoyageFlow.ts', src).length).toBeGreaterThan(0);
  });
});
