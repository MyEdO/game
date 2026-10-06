import { describe, it, expect } from 'vitest';
import { findTrappingById, type TrappingData } from '../data';
import { resoudreObjet } from './items';
import { avecObjetsDeCampagne } from './objetDeTest.testkit';

/**
 * ISOLATION du fournisseur des objets de campagne (`brancherObjetsDeCampagne`, #2324) sous
 * `isolate: false` : un objet posé par un test ne se résout plus au test SUIVANT. Les deux cas se
 * suivent dans l'ordre de déclaration : le second lit ce que le premier a laissé.
 */
const SCEAU: TrappingData = { ...findTrappingById('dague')!, id: 'campagne-sceau-isole', label: 'Sceau isolé' };

describe('fournisseur des objets de campagne — isolation entre deux tests (#2324)', () => {
  it('(1/2) la couche posée par ce test est vue', () => {
    avecObjetsDeCampagne([SCEAU], () => expect(resoudreObjet(SCEAU.id)?.label).toBe('Sceau isolé'));
  });

  it('(2/2) le test suivant repart sans elle', () => {
    expect(resoudreObjet(SCEAU.id)).toBeUndefined();
  });
});
