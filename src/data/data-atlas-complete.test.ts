/**
 * Garde de COMPLÉTUDE de l'atlas des données : tout `src/data/*.json` doit être cartographié dans
 * `docs/donnees.md` (§A). Empêche la carte de pourrir quand un fichier data est ajouté sans être
 * cartographié. Scan de `src/data` SEUL (jamais les worktrees). Frontière de nom pour éviter qu'un nom
 * plus long ne satisfasse un plus court (`river-criticals.json` ne compte pas pour `criticals.json`).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { listerDossier } from '../../scripts/guards/lib/lister.mjs';
import { echapperRegex } from '../lib/regex';

const DATA_DIR = fileURLToPath(new URL('.', import.meta.url));
const ATLAS = readFileSync(fileURLToPath(new URL('../../docs/donnees.md', import.meta.url)), 'utf8');

const mentioned = (file: string): boolean =>
  new RegExp(`(?<![A-Za-z0-9_-])${echapperRegex(file)}`).test(ATLAS);

describe('atlas des données (docs/donnees.md) — complétude', () => {
  const files = listerDossier(DATA_DIR).filter((f) => f.endsWith('.json'));
  for (const f of files) {
    it(`${f} est cartographié dans docs/donnees.md`, () => {
      expect(mentioned(f)).toBe(true);
    });
  }
});
