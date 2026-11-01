/**
 * `especeDApparence` (#1897) : l'id d'espèce rules passe tel quel — aucun libellé n'entre dans l'espèce d'apparence.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { species, especeDApparence, DEFAULT_RACE_ID } from './index';
import { setDataset, resetData } from './overrides';
import { fauteDEspece } from './schemas/grammaire/valeurs';

afterEach(resetData);

describe('especeDApparence — id stable, jamais dérivé du libellé', () => {
  it('renommer le libellé d’une espèce ne change pas son espèce d’apparence', () => {
    const avant = especeDApparence('nains');
    setDataset('species', species.map((s) => (s.id === 'nains' ? { ...s, label: 'Nains des Montagnes' } : s)));
    expect(especeDApparence('nains')).toBe(avant);
    expect(fauteDEspece(especeDApparence('nains'))).toBeNull();
  });

  it('∀ espèce jouable, l’espèce d’apparence est son id', () => {
    expect(species.filter((s) => especeDApparence(s.id) !== s.id).map((s) => s.id)).toEqual([]);
  });

  it('sans argument, la race par défaut déclarée en donnée', () => {
    expect(especeDApparence(undefined)).toBe(DEFAULT_RACE_ID);
    expect(fauteDEspece(DEFAULT_RACE_ID)).toBeNull();
  });
});
