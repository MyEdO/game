import { describe, it, expect } from 'vitest';
import { readCorpus } from '../scripts/guards/lib/sourceCorpus.mjs';
import { scanInBattleFind } from '../scripts/guards/lib/inBattleFind.mjs';
import { estFichierVitest, estKitDeTest } from '../scripts/guards/lib/fichierVitest.mjs';

/**
 * Garde-fou « recherche de combattant EN COMBAT par id » (#279, F1 du programme structurel #276).
 * `X.combatants.find((c) => c.id === …)` réinvente `inBattleId(battle, id)`
 * (`src/noyau/monde/combatants.ts`). Le détecteur mesure aussi les prédicats composés.
 *
 * Le FOYER de la primitive (`combatants.ts`) est SCANNÉ comme le reste : son unique site est gelé en
 * baseline, pas exempté en bloc — une exemption au FICHIER masquerait tout ajout futur.
 *
 * MODE CLIQUET (patron `hardcode.mjs`/`combat-hardcode-guard.test.ts`) : `BASELINES` gèle, PAR
 * FICHIER, le nombre de sites tolérés au recensement. Le test échoue si un fichier DÉPASSE sa
 * baseline (régression : nouveau find-par-id réinventé) OU si une baseline est devenue trop haute
 * (fichier assaini sans abaissement).
 */

const SCAN_DIRS = ['src/noyau'];
const EXCLUDED = (rel: string) => estFichierVitest(rel) || estKitDeTest(rel);

const BASELINES: Record<string, number> = {
  // Le détecteur mesure aussi le foyer de la primitive.
  'src/noyau/monde/combatants.ts': 1,
  'src/noyau/combat/recover.ts': 1,
  'src/noyau/combatFlow.ts': 1,
};

function countsByFile(): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const { rel, text } of readCorpus(SCAN_DIRS, { tests: true })) {
    if (EXCLUDED(rel)) continue;
    const n = scanInBattleFind(rel, text).length;
    if (n > 0) counts[rel] = n;
  }
  return counts;
}

describe('garde-fou « inBattleId » — find-par-id combattant EN COMBAT (cliquet, #279)', () => {
  it('aucun fichier du noyau ne dépasse sa baseline gelée', () => {
    const counts = countsByFile();
    const offenders: string[] = [];
    for (const [rel, n] of Object.entries(counts)) {
      const baseline = BASELINES[rel] ?? 0;
      if (n > baseline) offenders.push(`${rel} : ${n} sites (baseline gelée ${baseline})`);
    }
    expect(
      offenders,
      'Nouveau(x) find-par-id réinventé(s) — migrer vers inBattleId(battle, id) ' +
        `(src/noyau/monde/combatants.ts), ou si prédicat composé légitime AUGMENTER la baseline :\n${offenders.join('\n')}`,
    ).toEqual([]);
  });

  it('CLIQUET : toute baseline devenue trop haute (fichier assaini) doit être ABAISSÉE', () => {
    const counts = countsByFile();
    const stale: string[] = [];
    for (const [rel, baseline] of Object.entries(BASELINES)) {
      const n = counts[rel] ?? 0;
      if (n < baseline) stale.push(`${rel} : baseline ${baseline}, réel ${n} — ABAISSER la baseline`);
    }
    expect(stale, 'Baseline(s) PÉRIMÉE(s) — abaisser ces entrées de BASELINES').toEqual([]);
  });
});
