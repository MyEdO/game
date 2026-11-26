import { describe, expect, it } from 'vitest';
import { BIBLIOTHEQUE, RACINES_VIVANTES } from './_racines-vivantes.generated';
import { SCHEMA_DEFS } from './schemas/_registry.generated';

/** La BIBLIOTHÈQUE (#5069) : chaque document de `SCHEMA_DEFS`, dont les RACINES VIVANTES sont un sous-ensemble. */
describe('BIBLIOTHEQUE — les documents de SCHEMA_DEFS', () => {
  it('porte exactement un document par `file` de SCHEMA_DEFS', () => {
    expect(Object.keys(BIBLIOTHEQUE).sort()).toEqual(SCHEMA_DEFS.map((d) => d.file).sort());
  });

  it('RACINES_VIVANTES en est un sous-ensemble, aux mêmes objets', () => {
    const ecarts = Object.entries(RACINES_VIVANTES).filter(([fichier, racine]) => BIBLIOTHEQUE[fichier] !== racine).map(([fichier]) => fichier);
    expect(ecarts).toEqual([]);
  });
});
