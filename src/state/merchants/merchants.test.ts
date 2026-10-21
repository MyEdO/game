import { describe, it, expect } from 'vitest';
import { findMerchantArchetypeById } from '../../data';

describe('registre archétypes marchands (#2)', () => {
  it('charge les archétypes depuis defs/ (clé = name)', () => {
    expect(findMerchantArchetypeById('armurier')).toMatchObject({ label: 'Armurier', settlement: 'ville', resaleRate: 0.5, bargainSkill: 45 });
    expect(findMerchantArchetypeById('armurier')?.category.categories).toContain('armor');
    expect(findMerchantArchetypeById('herboriste')?.category.subTypes).toContain('herbes-et-potions'); // id de Groupe
  });
});
