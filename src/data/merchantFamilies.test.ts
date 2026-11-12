import { describe, it, expect } from 'vitest';
import { merchantFamilies } from './index';

describe('merchantFamilies — cohérence des familles de présentation du marchand', () => {
  it('au plus une famille par règle de `match` (unit / shield / categorie)', () => {
    const unitFamilies = merchantFamilies.filter((f) => f.match.unit);
    const shieldFamilies = merchantFamilies.filter((f) => f.match.shield);
    expect(unitFamilies.length).toBeLessThanOrEqual(1);
    expect(shieldFamilies.length).toBeLessThanOrEqual(1);
    const categories = merchantFamilies.filter((f) => f.match.categorie).map((f) => f.match.categorie as string);
    expect(new Set(categories).size).toBe(categories.length);
  });
});
