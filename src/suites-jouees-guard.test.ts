import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RACINES_DES_ZONES } from '../scripts/guards/lib/couches.mjs';
import { estSuiteVitest } from '../scripts/guards/lib/fichierVitest.mjs';
import { TRAVAIL, depotDe, listerImage } from '../scripts/guards/lib/gitPorte.mjs';
import { estDeLaSuiteDuNoyau, estDeLaSuiteVitest } from '../scripts/guards/lib/racinesDeLaSuite.mjs';

/**
 * SUITES JOUÉES (#2928) — sous les racines des zones (`RACINES_DES_ZONES`, `couches.mjs`), chaque suite
 * (`estSuiteVitest`) est jouée par la suite principale (`estDeLaSuiteVitest`) ou par celle du noyau
 * (`estDeLaSuiteDuNoyau`) : une suite que rien ne joue est typée, lintée, comptée par knip, et ne mesure rien.
 * Liste : l'arbre de travail par git (`TRAVAIL`), comme `suiteVitest.mjs`.
 *
 * TÉMOIN des configurations JSON, qui ne dérivent rien : `tsconfig.json` (`include`) et `knip.json` (`project`,
 * `entry`) couvrent chaque racine des zones.
 */

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const json = (rel: string) => JSON.parse(readFileSync(join(ROOT, rel), 'utf8'));
const jouee = (rel: string) => estDeLaSuiteVitest(rel) || estDeLaSuiteDuNoyau(rel);

describe('suites jouées sous les racines des zones (#2928)', () => {
  it('chaque suite de l’arbre sous une racine des zones est jouée par une suite Vitest', () => {
    const suites = listerImage(depotDe(ROOT), TRAVAIL, ...RACINES_DES_ZONES).filter(estSuiteVitest);
    expect(suites.length, 'aucune suite lue : la garde ne mesure rien').toBeGreaterThan(0);
    expect(suites.filter((rel) => !jouee(rel)), 'suites que ni la suite principale ni celle du noyau ne jouent').toEqual([]);
  });

  it('TÉMOIN : hors de `src/`, seule une suite hors store est jouée', () => {
    const cas = ['hotes/godot/pont/x.test.ts', 'hotes/godot/pont/x.hors-store.test.ts', 'src/hote/x.test.ts', 'src/hote/x.hors-store.test.ts'];
    expect(cas.map(jouee)).toEqual([false, true, true, true]);
  });

  it('`tsconfig.json` et `knip.json` couvrent chaque racine des zones', () => {
    const { include } = json('tsconfig.json') as { include: string[] };
    const { project, entry } = json('knip.json') as { project: string[]; entry: string[] };
    for (const r of RACINES_DES_ZONES) {
      expect(include, `tsconfig.json : include sans ${r}`).toContain(r);
      expect(project.some((g) => g.startsWith(`${r}/`)), `knip.json : project sans ${r}/`).toBe(true);
      expect(entry.some((g) => g.startsWith(`${r}/`)), `knip.json : entry sans ${r}/`).toBe(true);
    }
  });
});
