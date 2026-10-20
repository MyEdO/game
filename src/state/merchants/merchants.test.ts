import { describe, it, expect } from 'vitest';
import { MERCHANTS } from '../../noyau/monde/merchants/archetypes';

describe('registre archétypes marchands (#2)', () => {
  it('charge les archétypes depuis defs/ (clé = name)', () => {
    expect(MERCHANTS.armurier).toMatchObject({ label: 'Armurier', settlement: 'ville', resaleRate: 0.5, bargainSkill: 45 });
    expect(MERCHANTS.armurier.category.categories).toContain('armor');
    expect(MERCHANTS.herboriste.category.subTypes).toContain('herbes-et-potions'); // id de Groupe
  });
});
