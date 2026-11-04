import { describe, it, expect } from 'vitest';
import { merchantFamilies } from '../data/index';
import { MERCHANT_COL_RENDERERS } from './colonnesDuMarchand';

describe('merchantFamilies — cohérence des familles de présentation du marchand', () => {
  it('chaque colonne référencée existe dans le registre de renderers', () => {
    for (const f of merchantFamilies) {
      for (const col of f.columns) {
        expect(MERCHANT_COL_RENDERERS[col], `${f.id}: colonne fantôme "${col}"`).toBeDefined();
      }
    }
  });
});
