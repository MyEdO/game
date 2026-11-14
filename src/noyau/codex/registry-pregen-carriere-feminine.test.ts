import { describe, it, expect } from 'vitest';
import { categoryByKey } from './registry';
import { findCareerById } from '../../data';
import { PRETIRE_DE_TEST, poserLesPretires } from '../creation/pretireDeTest.testkit';

/** Le sous-titre d'un prétiré du Codex porte la carrière au GENRE du prétiré (`careerLabelFor`). */
describe('Codex — pré-tirés : carrière au genre du prétiré', () => {
  const career = findCareerById('marchand')!;
  const sousTitre = (sex: 'F' | 'M') => {
    poserLesPretires([{ ...PRETIRE_DE_TEST, sex, carrieres: { marchand: 1 } }]);
    return categoryByKey('pregens')!.items.find((i) => i.id === PRETIRE_DE_TEST.id)!.sub;
  };

  it('prétiré F : forme féminine ; prétiré M : forme masculine', () => {
    expect(career.labelF).toBeTruthy();
    expect(career.labelF).not.toBe(career.label);
    expect(sousTitre('F')).toContain(career.labelF);
    expect(sousTitre('M')).toContain(career.label);
    expect(sousTitre('M')).not.toContain(career.labelF);
  });
});
