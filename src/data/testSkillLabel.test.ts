import { describe, it, expect } from 'vitest';
import { testSkillLabel } from './index';

/** Contrat de `testSkillLabel` : la Spé vit dans la référence (#1765, #3012). Une `spec` sœur de
 *  `skill` est refusée par le mur `murs/sujet-spec` (banc `scripts/guards/lib/lint-parite.test.mjs`). */
describe('testSkillLabel — référence porteuse de sa Spé', () => {
  it('rend la Compétence spécialisée (LDB 46 l.24)', () => {
    expect(testSkillLabel({ skill: { id: 'langue', spec: 'magick' } })).toBe('Langue (Magick)');
  });
});
