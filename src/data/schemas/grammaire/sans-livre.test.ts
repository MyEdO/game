import { describe, expect, it } from 'vitest';
import { SCHEMA_DEFS } from '../_registry.generated';
import { CONTENU_A_SOURCER, exigeSource, provenanceMesuree } from './sans-livre';

describe('provenance des documents de contenu', () => {
  it('aucun document de contenu n’est exempté de sa provenance', () => {
    expect(Object.keys(CONTENU_A_SOURCER)).toEqual([]);
  });

  it('la provenance mesurée est celle que la fabrique exige, pour chaque type de document', () => {
    const ecarts = SCHEMA_DEFS.map((d) => d.file.replace(/\.json$/, '')).filter((t) => provenanceMesuree(t) !== exigeSource(t));
    expect(ecarts).toEqual([]);
  });
});
