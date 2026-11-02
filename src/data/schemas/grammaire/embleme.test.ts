import { describe, expect, it } from 'vitest';
import { emblemeSchema, entityAppearanceSchema } from './valeurs';
import { lireComposition } from '../../../noyau/apparence/composition';

const composition = { race: { id: 'humain' }, sex: 'M', tete: { id: 'humain' } };

describe('référence d’emblème du porteur', () => {
  it('compose la même référence dans une apparence et une composition', () => {
    const embleme = { id: 'taureau-rouge' };
    expect(entityAppearanceSchema.parse({ embleme }).embleme).toEqual(embleme);
    expect(lireComposition({ ...composition, embleme }).ok).toBe(true);
  });

  it.each(['embleme-inconnu', 'plastron'])('refuse %s au parse, y compris dans chaque porteur', (id) => {
    expect(emblemeSchema.safeParse({ id }).success).toBe(false);
    expect(entityAppearanceSchema.safeParse({ embleme: { id } }).success).toBe(false);
    expect(lireComposition({ ...composition, embleme: { id } }).ok).toBe(false);
  });
});
