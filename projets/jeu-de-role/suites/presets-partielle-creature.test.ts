/** Les profils de preset des paquets livrés passent les verrous de la partielle de créature (#2206). */
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

  it('une adresse livrée, doublée d’une prose, refuse la partielle de créature (V1)', () => {
    const adresse = profils.map((p) => p.profil!.descRef).find((r) => r !== undefined);
    expect(adresse).toBeDefined();
    expect(creaturePartielle.safeParse({ desc: 'Une prose.', descRef: adresse }).success).toBe(false);
  });
});
