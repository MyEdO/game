import { describe, expect, it } from 'vitest';
import { trappingRefSchema } from './schemas/grammaire/reference';
import { itemFromTrappingRef } from '../engine/items';

/** MDG 07 l.219 ; LDB 62 l.127 */
const DOTATION_D_OLG = { id: 'arme-simple' };

describe('dotation d’Olg — possession de catalogue', () => {
  it('la référence de hache produit une possession de mêlée', () => {
    const reference = trappingRefSchema.parse(DOTATION_D_OLG);
    if (!('id' in reference)) throw new Error('La dotation ne désigne pas un objet.');
    expect(reference).toStrictEqual(DOTATION_D_OLG);
    expect(itemFromTrappingRef(reference)).toMatchObject({ trappingId: 'arme-simple', kind: 'melee' });
  });
});
