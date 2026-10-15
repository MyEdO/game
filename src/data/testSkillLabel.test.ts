import { describe, it, expect } from 'vitest';
import { testSkillLabel } from './index';

/** Contrat de `testSkillLabel` : la Spé d'une RÉFÉRENCE vit dans la référence (#1765). Une `spec` sœur
 *  posée à côté d'une référence ne compile pas — le corps la perdrait en silence. */
describe('testSkillLabel — id + spec, ou référence porteuse de sa Spé', () => {
  it('les deux formes rendent la même Compétence spécialisée (LDB 46 l.24)', () => {
    expect(testSkillLabel({ skill: 'langue', spec: 'magick' })).toBe('Langue (Magick)');
    expect(testSkillLabel({ skill: { id: 'langue', spec: 'magick' } })).toBe('Langue (Magick)');
  });

  it('une `spec` sœur d\'une référence est refusée au typage', () => {
    // @ts-expect-error — la Spé d'une référence se pose DANS la référence.
    const fautif = testSkillLabel({ skill: { id: 'langue' }, spec: 'magick' });
    // @ts-expect-error — même refus sur la branche « ou caractéristique ».
    const fautifAvecCar = testSkillLabel({ skill: { id: 'langue' } as { id: string } | undefined, spec: 'magick', char: 'intelligence' });
    expect([fautif, fautifAvecCar]).toHaveLength(2);
  });
});
