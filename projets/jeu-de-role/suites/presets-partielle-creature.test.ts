/** Les profils de preset des paquets livrés passent les verrous de la partielle de créature (#2206) ; son contrat V1 :
 *  `src/data/schemas/grammaire/grammaire.test.ts`. */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { entreePartielle as creaturePartielle } from '../../../src/data/schemas/defs/creatures';
import { cheminsDesProjetsLivres } from '../../../scripts/guards/lib/projetsLivres.mjs';

type Preset = { id: string; profil?: { descRef?: unknown } };

describe('prose adressée des presets livrés (#2206)', () => {
  const profils = cheminsDesProjetsLivres()
    .flatMap((rel) => (JSON.parse(readFileSync(rel, 'utf8')) as { narratif?: { presetsPnj?: Preset[] } }).narratif?.presetsPnj ?? [])
    .filter((p) => p.profil !== undefined);

  it('les profils de preset du disque passent les verrous de la partielle de créature', () => {
    expect(profils.length).toBeGreaterThan(0);
    expect(profils.filter((p) => !creaturePartielle.safeParse(p.profil).success).map((p) => p.id)).toEqual([]);
  });
});
