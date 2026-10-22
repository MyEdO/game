import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RACINES_DES_ZONES } from '../scripts/guards/lib/couches.mjs';

/**
 * TÉMOIN des configurations JSON (#2928), qui ne dérivent rien de la table `COUCHES` (`couches.mjs`) :
 * `tsconfig.json` (`include`) et `knip.json` (`project`, `entry`) couvrent chaque racine des zones
 * (`RACINES_DES_ZONES`). Une suite que rien ne joue, elle, est refusée par `murs/suite-jouee` (`couchesLint.mjs`).
 */

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const json = (rel: string) => JSON.parse(readFileSync(join(ROOT, rel), 'utf8'));

describe('configurations JSON des racines des zones (#2928)', () => {
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
