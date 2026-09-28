/**
 * `rigSpeciesId` (#1897) : l'id d'espèce rules passe tel quel — aucun libellé n'entre dans l'id rig.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { species, rigSpeciesId, DEFAULT_RACE_ID } from './index';
import { setDataset, resetData } from './overrides';
import { fauteDEspece } from './schemas/grammaire/art';

afterEach(resetData);

describe('rigSpeciesId — id stable, jamais dérivé du libellé', () => {
  it('renommer le libellé d’une espèce ne change pas son id rig', () => {
    const avant = rigSpeciesId('nains');
    setDataset('species', species.map((s) => (s.id === 'nains' ? { ...s, label: 'Nains des Montagnes' } : s)));
    expect(rigSpeciesId('nains')).toBe(avant);
    expect(fauteDEspece(rigSpeciesId('nains'))).toBeNull();
  });

  it('∀ espèce jouable, l’id rig est son id', () => {
    expect(species.filter((s) => rigSpeciesId(s.id) !== s.id).map((s) => s.id)).toEqual([]);
  });

  it('sans argument, la race par défaut déclarée en donnée', () => {
    expect(rigSpeciesId(undefined)).toBe(DEFAULT_RACE_ID);
  });
});
