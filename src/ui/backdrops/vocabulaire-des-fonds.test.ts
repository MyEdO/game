/**
 * #2968 P-art — l'espace `vocabulaire:fonds` (`src/data/schemas/grammaire/vocabulaires.ts`) est la projection du
 * registre des bandes d'ambiance : mêmes ids, mêmes libellés, même ordre que `BACKDROP_DEFS`.
 */
import { describe, expect, it } from 'vitest';
import { BACKDROP_DEFS } from '.';
import { VOCABULAIRES } from '../../data/schemas/grammaire/vocabulaires';
import { IDS_PAR_ESPACE } from '../../data/schemas/_ids.generated';

describe('#2968 P-art — le vocabulaire des fonds est le registre `src/ui/backdrops/defs`', () => {
  it('ses ids et libellés sont ceux du registre', () => {
    expect(BACKDROP_DEFS.length).toBeGreaterThan(0);
    expect(VOCABULAIRES.fonds).toEqual(Object.fromEntries(BACKDROP_DEFS.map((b) => [b.id, b.label])));
  });

  it('l’index des ids porte l’espace `vocabulaire:fonds`, les ids du registre dans son ordre', () => {
    expect(IDS_PAR_ESPACE['vocabulaire:fonds']).toEqual(BACKDROP_DEFS.map((b) => b.id));
  });
});
