/**
 * Garde-fou de FIDÉLITÉ : l'éditeur de données réécrit les `src/data/*.json` via FS Access ; un
 * round-trip (lire → parser → `serializeDataset`) doit reproduire le fichier à l'octet près, sinon
 * la moindre sauvegarde produirait un diff de reformatage géant. Couvre TOUS les datasets réels.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { listerDossier } from '../../scripts/guards/lib/lister.mjs';
import { serializeDataset } from './serialize';

const DIR = __dirname;
const files = listerDossier(DIR).filter((f) => f.endsWith('.json'));

describe('serializeDataset — round-trip byte-fidèle des datasets app-owned', () => {
  for (const f of files) {
    it(`${f} : lire → parser → sérialiser == original`, () => {
      const raw = readFileSync(join(DIR, f), 'utf8');
      expect(serializeDataset(JSON.parse(raw))).toBe(raw);
    });
  }
});
